import type { SSH } from './src/ssh.ts';
import { Folder as ConfigFolderHandler } from './src/ConfigurationsHandler.ts';
import { remoteDataPrinter } from './src/remoteDataPrinter.ts';
import { sshSpawn } from './src/sshRun.ts';
import type { Options } from './src/watchBuildTransferRun.ts';
import * as log from './utils/debug.ts';

/**
 * Name of the systemd service on the remote. See `my-daemon.service`.
 */
export const daemonName = 'my-daemon';

/**
 * Directory on the remote, relative to the remote user's home, that everything is deployed to.
 */
export const directory = daemonName;

/**
 * Which file in `daemon/src/configs/` (without extension) the deployed daemon uses.
 */
export const selectedConfig = 'config.example';

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
   * node_modules + npm cache
   */
  | 'cache';

const clean = true as CleanOptions;

let journal: Awaited<ReturnType<typeof sshSpawn>> | undefined;

const stop = (ssh: SSH): Promise<void> => sshSpawn(log, ssh, ['sudo', 'systemctl', 'stop', daemonName]).then(() => {});

const start = async (ssh: SSH): Promise<void> => {
  if (!journal) {
    journal = await sshSpawn(log, ssh, ['journalctl', '-fu', daemonName, '-n0']);
    journal.on('data', remoteDataPrinter(log, 'journalctl', 'stdout'));
    journal.stderr.on('data', remoteDataPrinter(log, 'journalctl', 'stderr'));
  }
  await sshSpawn(log, ssh, ['sudo', 'systemctl', 'start', daemonName]);
};

const config: Options = {
  connect: {
    username: 'pi',
    host: 'raspberrypi',
    // Uses your ssh agent (or ~/.ssh/id_*) unless a password or key is given here
  },
  async onConnect(ssh) {
    await stop(ssh);

    async function cleanNpmCache() {
      await ssh.exec('npm', ['cache', 'clean', '--force']);
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
        await cleanNpmCache().catch(() => {});
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
    ConfigFolderHandler(data, { remoteModuleDir: `${directory}/daemon`, selectedConfig });
  },
  remote: {
    directory,
    stop,
    start,
  },
  log,
};

export default config;
