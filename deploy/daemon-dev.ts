#!/usr/bin/env node

if (require.main === module) throw new Error('Incorrect usage');

import * as log from './utils/debug';
import watchBuildTransferRun from './src/watchBuildTransferRun';
import { Options } from './src/watchBuildTransferRun';
import { sshSpawn } from './src/sshRun';
import { Folder as ConfigFolderHandler } from './src/ConfigurationsHandler';
import { remoteDataPrinter } from './src/remoteDataPrinter';
import SSH2Promise from 'ssh2-promise';

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

let journal: ThenArg<ReturnType<typeof sshSpawn>>;

const daemonName = 'my-daemon'
const directory = daemonName;

type CleanOptions =
  /**
   * Don't
   */
  | false
  /**
   * Clean compiled sources
   */
  | true
  /**
   * node_modules
   */
  | 'full'
  /**
   * node_modules + yarn/npm cache
   */
  | 'cache';

const clean = true as CleanOptions;

const stop = (ssh: SSH2Promise): Promise<void> => sshSpawn(log, ssh, ['sudo', 'systemctl', 'stop', daemonName]);

const start = async (ssh: SSH2Promise): Promise<void> => {
  if (!journal) {
    journal = await sshSpawn(log, ssh, ['journalctl', '-fu', daemonName, '-n0']);
    journal.stdin.on('data', remoteDataPrinter(log, 'journalctl', 'stdout'));
    journal.stderr.on('data', remoteDataPrinter(log, 'journalctl', 'stderr'));
  }
  await sshSpawn(log, ssh, ['sudo', 'systemctl', 'start', daemonName]);
};

const raspberryPiConfig: Options = {
  connect: {
    username: 'pi',
    password: 'raspberry',
    host: 'raspberrypi',
  },
  async onConnect(ssh) {
    await stop(ssh);

    async function cleanYarnCache() {
      await ssh.exec('yarn', ['cache', 'clean']);
    }

    async function cleanNpmCache() {
      await ssh.exec('npm', ['cache', 'clean']);
    }

    if (clean) {
      const modules = `${directory}/daemon/node_modules`;
      const temp = 'temp_node_modules';

      // Save node_modules optionally
      const restore =
        clean === true &&
        (await ssh.exec('mv', [modules, temp]).then(
          () => true,
          () => {
            ssh.exec('rm', ['-rf', temp]).catch(() => {});
            return false;
          },
        ));

      if (clean === 'cache') {
        await Promise.all([cleanYarnCache().catch(() => {}), cleanNpmCache()]);
      }

      // Clean
      await ssh.exec('rm', ['-rf', directory]);

      // Restore saved
      if (restore) {
        await ssh.exec('mkdir', ['-p', `${directory}/daemon`]);
        await ssh.exec('mv', [temp, modules]);
      }
    }

    await ssh.exec('mkdir', ['-p', `${directory}/data`]);
  },
  postCompile(data) {
    ConfigFolderHandler(data, { remoteModuleDir: `${directory}/daemon`, selectedConfig: 'test1' });
  },
  remote: {
    directory,
    stop,
    start,
  },
  log,
};

watchBuildTransferRun(raspberryPiConfig).catch(e => log.error('Main Failure:', e.toString()));
