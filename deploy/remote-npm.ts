#!/usr/bin/env node
import { resolve } from 'path';

import SSH from 'node-ssh';

import config from './config';

const { remote } = config;

const args = ['daemon', '--non-interactive', ...process.argv.slice(2)];
// console.log('args:', args);

const files = ['daemon/package.json', 'daemon/yarn.lock'];

function localFile(name: string): string {
  return resolve(__dirname, '..', name);
}

function remoteFile(name: string): string {
  return remote.directory + '/' + name;
}

async function remoteYarn(): Promise<void> {
  try {
    const ssh = new SSH();

    const sshConnection = await ssh.connect(remote.connect);

    try {
      // TODO: Lock file to prevent multiple people running this at once

      // Copy latest local yarn files to remote
      await sshConnection.putFiles(files.map(name => ({ local: localFile(name), remote: remoteFile(name) })));

      // Run remote yarn
      const { code: exitCode, signal, stdout: result, stderr: err } = await sshConnection.exec('yarn', args, {
        cwd: remote.directory,
        onStdout: (chunk: Buffer) => process.stdout.write(chunk.toString('utf8')),
        onStderr: (chunk: Buffer) => process.stderr.write(chunk.toString('utf8')),
        stream: 'both',
      });

      if (exitCode) console.log('Non-zero exit code:', exitCode);

      // Copy latest remote yarn files back to local
      await Promise.all(files.map(name => sshConnection.getFile(localFile(name), remoteFile(name))));
    } catch (e) {
      console.log('Error:', e);
    }

    sshConnection.dispose();
  } catch (e) {
    console.log('Failed to connect');
  }
}

remoteYarn();
