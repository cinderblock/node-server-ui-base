import { inDirectory, type SSH } from './ssh.ts';
import type { ClientChannel } from 'ssh2';
import { remoteDataPrinter } from './remoteDataPrinter.ts';
import type { Debug } from './watchBuildTransferRun.ts';

/**
 * Install the daemon's production dependencies on the remote with the remote's own `npm`.
 *
 * The lockfile (`bun.lock`) covers the whole workspace, so it is not sent. The remote resolves `package.json` itself.
 */
export async function remoteExecNpm(ssh: SSH, cwd: string, log?: Debug): Promise<void> {
  const args: string[] = [];

  args.push('install');
  // Don't install dev dependencies
  args.push('--omit=dev');
  // The workspace lockfile lives locally
  args.push('--no-package-lock');
  // Quieter output
  args.push('--no-audit', '--no-fund');
  // No "new npm available" nag in the deploy output
  args.push('--no-update-notifier');

  try {
    // Run in the module directory
    const npm: ClientChannel = await ssh.spawn(...inDirectory(cwd, 'npm', args));
    npm.allowHalfOpen = false;

    // Remove verboseness from ssh.spawn
    npm.removeAllListeners('finish');
    npm.removeAllListeners('close');

    if (log) {
      npm.on('data', remoteDataPrinter(log, 'npm', 'stdout'));
      npm.stderr.on('data', remoteDataPrinter(log, 'npm', 'stderr'));
    }

    return new Promise((resolve, reject) =>
      npm.on('exit', (code: number | null) => {
        if (code) reject(code);
        else resolve();
      }),
    );
  } catch (e) {
    log?.error('Error running remote npm', e);
  }
}
