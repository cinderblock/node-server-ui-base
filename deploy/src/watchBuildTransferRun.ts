import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { Observable, combineLatest, merge } from 'rxjs';
import { debounceTime, map, filter, mergeMap } from 'rxjs/operators';

import observeFileChange from '../utils/observeFile.ts';
import { SSH, type ConnectOptions } from './ssh.ts';
import type * as debug from '../utils/debug.ts';
import { isPathString, isDirectoryString } from '../utils/pathTypeDiscriminators.ts';
import { reduceFileListToMinimalDirs } from '../utils/reduceFileListToMinimalDirs.ts';
import { getCompiledSourcesFromProgram } from './getCompiledSourcesFromProgram.ts';
import { mkdir } from '../utils/mkdir.ts';
import { remoteExecNpm } from './remoteExecNpm.ts';
import { automaticPrivateKey } from '../utils/automaticPrivateKey.ts';
import { makeProxyServer } from '../utils/makeProxyServer.ts';
import { remoteOutputPaths } from './remoteOutputPaths.ts';
import type { Sources } from './Sources.ts';

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: path => path,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine,
};

export type Debug = typeof debug;

export type Options = {
  /**
   * Connect options passed to ssh
   *
   * @note The multiple hop ssh scheme requires `nc` to be available
   */
  connect: ConnectOptions;

  /**
   * Some function to run on the sources before they are sent to remote
   */
  postCompile?: (data: Sources) => void;

  /**
   * Get access to ssh connection after it starts
   */
  onConnect?: (ssh: SSH) => Promise<void>;

  /**
   * Options related to settings on the remote system
   */
  remote: {
    /**
     * Directory on remote that we put everything into
     */
    directory: string;

    /**
     * Function to call to stop running services before deploying
     */
    stop?: (ssh: SSH) => Promise<void>;
    /**
     * Function to call to start running services after deploying
     */
    start?: (ssh: SSH) => Promise<void>;
  };

  /**
   * Options for local system
   */
  local?: {
    /**
     * Root of project to sync to remote. Must end with `/`.
     *
     * Defaults to the root of this repository.
     */
    basePath?: string;
    /**
     * Dir inside basePath that is built and synced to remote
     */
    moduleDir?: string;
  };

  /**
   * List of files not compiled by typescript to move over manually
   *
   * `package.json` will automatically be included.
   */
  manualSyncFiles?: string[];

  /**
   * Where to log status to
   */
  log?: Debug;

  /**
   * Forward a local port to the daemon on the remote, so a locally running UI can reach it.
   *
   * Default: local port 8000 to remote port 8000. `false` disables it.
   */
  proxy?: { localPort?: number; remotePort?: number } | false;

  exitAfterDeploy?: boolean;
};

export type Deployment = {
  /**
   * Stop watching, close the proxy, and disconnect
   */
  stop(): Promise<void>;
};

/**
 * Root of this repository, with a trailing `/`
 */
const repoRoot = fileURLToPath(new URL('../../', import.meta.url)).replaceAll('\\', '/');

export default async function watchBuildTransferRun(options: Options): Promise<Deployment> {
  if (options.local?.basePath !== undefined && !isPathString(options.local.basePath))
    throw new Error('Invalid path specified for options.local.basePath');
  const basePath = options.local?.basePath ?? repoRoot;

  if (options.local?.moduleDir !== undefined && !isDirectoryString(options.local.moduleDir))
    throw new Error('Invalid module directory specified for options.local.moduleDir');
  const moduleDir = options.local?.moduleDir ?? 'daemon';

  if (options.remote.directory === undefined || !isDirectoryString(options.remote.directory))
    throw new Error('Invalid remote directory specifier string');
  const remotePath = options.remote.directory ? `${options.remote.directory}/` : '';

  const localModuleDir = basePath + moduleDir;
  const remoteModuleDir = remotePath + moduleDir;

  const remoteStop = options.remote.stop || ((): Promise<void> => Promise.resolve());
  const remoteStart = options.remote.start || ((): Promise<void> => Promise.resolve());

  if (!options.connect.host) throw new Error('Must specify remote host');

  const configPath = ts.findConfigFile(localModuleDir, ts.sys.fileExists, 'tsconfig.build.json');
  if (!configPath) throw new Error('Could not find a valid tsconfig.build.json.');

  await automaticPrivateKey(options.connect);

  options.connect.reconnectDelay = options.connect.reconnectDelay ?? 250;

  options.connect.algorithms = {
    compress: ['zlib@openssh.com', 'zlib', 'none'],
    ...options.connect.algorithms,
  };

  // Let the daemon's commands use our SSH agent, when we have one
  if (options.connect.agent) options.connect.agentForward ??= true;

  options.log?.info('Connecting ...', { ...options.connect, password: undefined, privateKey: undefined });

  const ssh = new SSH(options.connect);

  await ssh.connect().catch((e: Error) => {
    options.log?.error(e?.name, e);
    throw new Error('Connection failed');
  });

  await options.onConnect?.(ssh);

  const sftp = ssh.sftp();

  await mkdir(ssh, remoteModuleDir);

  const manualSyncFiles = options.manualSyncFiles || [];

  // Always sync package.json
  manualSyncFiles.push('package.json');

  async function updatePackagesAndManualTransfers(): Promise<void> {
    options.log?.info('📦 Synchronizing files');

    const dirs = reduceFileListToMinimalDirs(manualSyncFiles)
      // Prepend remote directory
      .map(d => [remoteModuleDir, d].join('/'));

    if (dirs.length) await mkdir(ssh, dirs);

    await Promise.all(
      manualSyncFiles.map(f =>
        sftp.fastPut(localModuleDir + '/' + f, remoteModuleDir + '/' + f).catch((e: Error) => {
          options.log?.error(e && e.name, 'Failed to put', f, localModuleDir, remoteModuleDir, e);
        }),
      ),
    );

    options.log?.info('📦 Updating module dependencies');

    await remoteExecNpm(ssh, remoteModuleDir, options.log);

    options.log?.info('📦 Dependencies up to date');
  }

  /**
   * Local directory the compiler thinks it is writing to. Nothing is written there; output goes to the remote.
   */
  const virtualOutDir = basePath + '.deploy-out';

  /**
   * Read the program, process it if necessary, and write to remote.
   * @param program TypeScript Compiler Program
   */
  async function handleCompiledSources(program: ts.EmitAndSemanticDiagnosticsBuilderProgram): Promise<void> {
    const data = remoteOutputPaths(getCompiledSourcesFromProgram(program), virtualOutDir, remotePath);

    options.postCompile?.(data);

    // Get a minimized list of the directories needed to be made
    const dirs = reduceFileListToMinimalDirs(data.map(({ filename }) => filename));

    if (dirs.length) await mkdir(ssh, dirs);

    // Write all the compiled output from TypeScript Compiler to remote
    await Promise.all(data.map(({ filename, source }) => sftp.writeFile(filename, source)));
  }

  // Create a proxy so that the ui running locally can talk to the daemon as if it were also running locally
  const proxy =
    options.proxy === false
      ? undefined
      : makeProxyServer({ remoteHost: options.connect.host, remotePort: 8000, ...options.proxy });
  // ssh.addTunnel is easier but breaks easier. So, we use the above instead.
  // ssh.addTunnel({ localPort: 8000, remoteAddr: 'localhost', remotePort: 8000 });

  let buildingCount = 0;

  function markBuilding(): void {
    buildingCount++;
  }

  function doneBuilding(): void {
    buildingCount--;
  }

  const packageUpdates = merge(...manualSyncFiles.map(f => observeFileChange(localModuleDir + '/' + f)))
    // Writes to these files come in bursts. We only need to react after the burst is done.
    .pipe(debounceTime(200))
    // Mark that we're building and shouldn't start a run
    .pipe(map(markBuilding))
    .pipe(mergeMap(() => remoteStop(ssh)))
    // Copy the files and run npm over ssh. Don't re-run until that is complete.
    .pipe(mergeMap(updatePackagesAndManualTransfers))
    .pipe(map(doneBuilding))
    .pipe(map(() => options.log?.green('✔ Packages updated')));

  const buildAndPush = new Observable<void>(observable => {
    const host = ts.createWatchCompilerHost(
      configPath,

      { outDir: virtualOutDir, rootDir: basePath },

      ts.sys,

      ts.createEmitAndSemanticDiagnosticsBuilderProgram,

      (diagnostic: ts.Diagnostic): void =>
        options.log?.error(
          'Error',
          diagnostic.code,
          ':',
          ts.flattenDiagnosticMessageText(diagnostic.messageText, formatHost.getNewLine()),
        ),

      (diagnostic: ts.Diagnostic): void =>
        options.log?.info('TypeScript:', ts.formatDiagnostic(diagnostic, formatHost).trimEnd()),
    );

    const origCreateProgram = host.createProgram;
    host.createProgram = (rootNames, opts, host, oldProgram): ts.EmitAndSemanticDiagnosticsBuilderProgram => {
      options.log?.cyan('🔨 Starting new compilation');
      markBuilding();
      remoteStop(ssh);
      return origCreateProgram(rootNames, opts, host, oldProgram);
    };

    host.afterProgramCreate = async (program): Promise<void> => {
      options.log?.magenta('🔨 Finished compilations');

      await handleCompiledSources(program);

      observable.next();
    };

    const watch = ts.createWatchProgram(host);

    return (): void => watch.close();
  })
    .pipe(map(doneBuilding))
    .pipe(map(() => options.log?.green('✔ Sources updated')));

  const subscription = combineLatest([packageUpdates, buildAndPush])
    .pipe(filter(() => buildingCount == 0))
    .subscribe({
      next: async () => {
        await remoteStart(ssh);

        if (options.exitAfterDeploy) process.exit();
      },
      error: e => {
        options.log?.error('Error in Observable:', String(e));
        ssh.close();
      },
    });

  return {
    async stop() {
      subscription.unsubscribe();
      proxy?.close();
      await ssh.close();
    },
  };
}

// TODO: Connect debugger/source maps to running node instance

// TODO: Handle user input. forward to remote. What about exit signal?
