#!/usr/bin/env bun
/**
 * Run `npm` in the daemon's directory on the remote, with the local `daemon/package.json`.
 *
 * Useful for packages with native code that must be resolved on the remote. The (possibly changed)
 * `package.json` is copied back afterward.
 *
 * Usage: `bun run remote -- <npm args>`, for example `bun run remote -- run kill`
 */
import { fileURLToPath } from 'node:url';
import { SSH } from './src/ssh.ts';
import config from './config.ts';
import { remoteDataPrinter } from './src/remoteDataPrinter.ts';
import { automaticPrivateKey } from './utils/automaticPrivateKey.ts';
import * as log from './utils/debug.ts';

const { remote, connect } = config;

const args = process.argv.slice(2);

const files = ['package.json'];

const moduleDir = 'daemon';

function localFile(name: string): string {
  return fileURLToPath(new URL(`../${moduleDir}/${name}`, import.meta.url));
}

function remoteFile(name: string): string {
  return `${remote.directory}/${moduleDir}/${name}`;
}

async function remoteNpm(): Promise<number> {
  await automaticPrivateKey(connect);

  const ssh = new SSH({ ...connect, reconnectTries: 1 });

  try {
    await ssh.connect();
  } catch (e) {
    log.error('Failed to connect', e);
    return 1;
  }

  try {
    // TODO: Lock file to prevent multiple people running this at once
    const sftp = ssh.sftp();

    await ssh.exec('mkdir', ['-p', `${remote.directory}/${moduleDir}`]);

    // Copy latest local files to remote
    await Promise.all(files.map(name => sftp.fastPut(localFile(name), remoteFile(name))));

    // Run remote npm
    const npm = await ssh.spawn('npm', ['--prefix', `${remote.directory}/${moduleDir}`, ...args]);
    npm.on('data', remoteDataPrinter(log, 'npm', 'stdout'));
    npm.stderr.on('data', remoteDataPrinter(log, 'npm', 'stderr'));
    const exitCode: number = await new Promise(resolve => npm.on('exit', (code: number | null) => resolve(code ?? 0)));

    if (exitCode) log.error('Non-zero exit code:', exitCode);

    // Copy latest remote files back to local
    await Promise.all(files.map(name => sftp.fastGet(remoteFile(name), localFile(name))));

    return exitCode;
  } catch (e) {
    log.error('Error:', e);
    return 1;
  } finally {
    await ssh.close();
  }
}

process.exitCode = await remoteNpm();
