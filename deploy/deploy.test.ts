/**
 * End to end test of `watchBuildTransferRun` against a throwaway in-process SSH server.
 *
 * The "remote" is a temporary directory on this machine. Commands run there with `sh`, so this needs a POSIX shell
 * (Git Bash on Windows) and `npm`. It installs the daemon's real dependencies from the npm registry.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import {
  closeSync,
  fstatSync,
  mkdtempSync,
  openSync,
  readSync,
  rmSync,
  statSync,
  writeSync,
  type Stats,
} from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Server, utils, type Connection } from 'ssh2';
import { io } from 'socket.io-client';
import type { State } from '../shared/State.ts';
import { Folder as ConfigFolderHandler } from './src/ConfigurationsHandler.ts';
import type { SSH } from './src/ssh.ts';
import watchBuildTransferRun, { type Deployment } from './src/watchBuildTransferRun.ts';

const { STATUS_CODE, flagsToString } = utils.sftp;

const sh = Bun.which('sh');

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address ? resolve(address.port) : reject()));
    });
  });
}

function attrs(stats: Stats) {
  return {
    mode: stats.mode,
    uid: stats.uid,
    gid: stats.gid,
    size: stats.size,
    atime: Math.floor(stats.atimeMs / 1000),
    mtime: Math.floor(stats.mtimeMs / 1000),
  };
}

/**
 * A minimal SSH server: password auth, `exec` with `sh -c`, and the SFTP requests `ssh2`'s client uses for
 * `fastPut`, `fastGet` and `writeFile`. Paths are relative to `root`.
 */
function makeFakeRemote(root: string, shell: string) {
  const commands: string[] = [];
  /** Everything the remote's commands printed, for failure messages */
  const transcript: string[] = [];
  const children = new Set<ChildProcess>();

  /**
   * Kill everything the remote started, including grandchildren (the daemon runs under `sh`)
   */
  function killAll(): void {
    for (const child of children) {
      if (child.exitCode !== null || child.pid === undefined) continue;
      if (process.platform === 'win32') spawnSync('taskkill', ['/T', '/F', '/PID', String(child.pid)]);
      else {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          // Already gone
        }
      }
    }
  }

  const server = new Server({ hostKeys: [utils.generateKeyPairSync('ed25519').private] }, (client: Connection) => {
    client.on('authentication', ctx => {
      if (ctx.method === 'password' && ctx.username === 'pi' && ctx.password === 'test') ctx.accept();
      else ctx.reject(['password']);
    });

    client.on('ready', () => {
      client.on('session', acceptSession => {
        const session = acceptSession();

        session.on('exec', (accept, _reject, info) => {
          commands.push(info.command);
          const channel = accept();
          const child = spawn(shell, ['-c', info.command], {
            cwd: root,
            stdio: ['ignore', 'pipe', 'pipe'],
            // Own process group, so `killAll` can take the whole tree down
            detached: process.platform !== 'win32',
          });
          children.add(child);
          child.stdout.pipe(channel, { end: false });
          child.stderr.pipe(channel.stderr, { end: false });
          child.stdout.on('data', (d: Buffer) => transcript.push(d.toString()));
          child.stderr.on('data', (d: Buffer) => transcript.push(d.toString()));
          child.on('exit', code => transcript.push(`[${info.command.split(' ')[0]} exited ${code}]\n`));
          child.on('close', code => {
            children.delete(child);
            try {
              channel.exit(code ?? 1);
              channel.end();
            } catch {
              // The client already went away (killed during teardown)
            }
          });
        });

        session.on('sftp', accept => {
          const sftp = accept();
          const handles = new Map<number, number>();
          let nextHandle = 0;

          const fdOf = (handle: Buffer) => handles.get(handle.readUInt32BE(0));

          sftp.on('OPEN', (reqid, filename, flags) => {
            try {
              const fd = openSync(resolve(root, filename), flagsToString(flags) ?? 'r');
              const handle = Buffer.alloc(4);
              handle.writeUInt32BE(nextHandle);
              handles.set(nextHandle++, fd);
              sftp.handle(reqid, handle);
            } catch {
              sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
            }
          });
          sftp.on('WRITE', (reqid, handle, offset, data) => {
            const fd = fdOf(handle);
            if (fd === undefined) return sftp.status(reqid, STATUS_CODE.FAILURE);
            writeSync(fd, data, 0, data.length, offset);
            sftp.status(reqid, STATUS_CODE.OK);
          });
          sftp.on('READ', (reqid, handle, offset, length) => {
            const fd = fdOf(handle);
            if (fd === undefined) return sftp.status(reqid, STATUS_CODE.FAILURE);
            const buffer = Buffer.alloc(length);
            const read = readSync(fd, buffer, 0, length, offset);
            if (read) sftp.data(reqid, buffer.subarray(0, read));
            else sftp.status(reqid, STATUS_CODE.EOF);
          });
          sftp.on('FSTAT', (reqid, handle) => {
            const fd = fdOf(handle);
            if (fd === undefined) return sftp.status(reqid, STATUS_CODE.FAILURE);
            sftp.attrs(reqid, attrs(fstatSync(fd)));
          });
          const stat = (reqid: number, path: string) => {
            try {
              sftp.attrs(reqid, attrs(statSync(resolve(root, path))));
            } catch {
              sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
            }
          };
          sftp.on('STAT', stat);
          sftp.on('LSTAT', stat);
          sftp.on('FSETSTAT', reqid => sftp.status(reqid, STATUS_CODE.OK));
          sftp.on('SETSTAT', reqid => sftp.status(reqid, STATUS_CODE.OK));
          sftp.on('CLOSE', (reqid, handle) => {
            const id = handle.readUInt32BE(0);
            const fd = handles.get(id);
            if (fd !== undefined) closeSync(fd);
            handles.delete(id);
            sftp.status(reqid, STATUS_CODE.OK);
          });
        });
      });
    });
  });

  return { server, commands, transcript, killAll };
}

let root: string;
let remote: ReturnType<typeof makeFakeRemote>;
let deployment: Deployment | undefined;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'nsub-deploy-'));
  remote = makeFakeRemote(root, sh!);
  await new Promise<void>(resolve => remote.server.listen(0, '127.0.0.1', resolve));
});

afterAll(async () => {
  await deployment?.stop();
  remote?.killAll();
  remote?.server.close();
  // Windows releases the killed daemon's files a moment later
  rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

test.skipIf(!sh)(
  'compiles, uploads, installs and starts the daemon on the remote',
  async () => {
    const daemonPort = await freePort();
    const directory = 'my-daemon';

    let output = '';
    const started = Promise.withResolvers<void>();

    const start = async (ssh: SSH) => {
      // Like systemd would: run the deployed daemon with Node, from its directory
      const channel = await ssh.spawn('sh', [
        '-c',
        `cd ${directory}/daemon && PORT=${daemonPort} FORCE_COLOR=0 exec node --enable-source-maps src/main.js`,
      ]);
      channel.on('data', (data: Buffer) => {
        output += data.toString();
        if (output.includes('Listening:')) started.resolve();
      });
      channel.stderr.on('data', (data: Buffer) => (output += data.toString()));
    };

    deployment = await watchBuildTransferRun({
      connect: {
        host: '127.0.0.1',
        port: (remote.server.address() as { port: number }).port,
        username: 'pi',
        password: 'test',
        reconnectTries: 1,
      },
      postCompile(data) {
        ConfigFolderHandler(data, { remoteModuleDir: `${directory}/daemon`, selectedConfig: 'config.example' });
      },
      remote: { directory, start },
      proxy: false,
    });

    await Promise.race([
      started.promise,
      Bun.sleep(150_000).then(() => {
        throw new Error(
          `Daemon did not start.\nOutput:\n${output}\nCommands:\n${remote.commands.join('\n')}\nRemote output:\n${remote.transcript.join('')}`,
        );
      }),
    ]);

    // The deployed files are where the systemd unit expects them
    for (const file of ['package.json', 'src/main.js', 'src/main.js.map', 'src/configs/config.js']) {
      expect(statSync(join(root, directory, 'daemon', file)).isFile()).toBe(true);
    }
    expect(statSync(join(root, directory, 'daemon', 'node_modules', 'socket.io')).isDirectory()).toBe(true);
    expect(
      remote.commands.some(c =>
        c.startsWith(
          'npm --prefix my-daemon/daemon install --omit=dev --no-package-lock --no-audit --no-fund --no-update-notifier',
        ),
      ),
    ).toBe(true);

    // And it works
    const socket = io(`http://127.0.0.1:${daemonPort}`, { transports: ['websocket'], reconnection: false });
    try {
      const state = await new Promise<State>(resolve => socket.once('update', resolve));
      expect(state.userControls.sequence).toBe(0);
    } finally {
      socket.close();
    }
  },
  180_000,
);
