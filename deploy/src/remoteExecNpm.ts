import SSH2Promise = require('ssh2-promise');
import { ClientChannel, ExecOptions } from 'ssh2';
import { remoteDataPrinter } from './remoteDataPrinter';
import { Debug } from './watchBuildTransferRun';

export async function remoteExecNpm(ssh: SSH2Promise, cwd: string, log?: Debug): Promise<void> {
  const execOptions: ExecOptions = {};

  const args: string[] = [];

  // Run all npm commands in module directory
  args.push('--cwd', cwd);

  // Use Npm's CI mode for remote install
  args.push('ci');

  // Output streaming is not yet supported
  // args.push('--no-progress');

  try {
    const npm: ClientChannel = await ssh.spawn('npm', args, execOptions);
    npm.allowHalfOpen = false;

    // Remove verboseness from ssh.spawn
    npm.removeAllListeners('finish');
    npm.removeAllListeners('close');

    if (log) {
      npm.on('data', remoteDataPrinter(log, 'npm', 'stdout'));
      npm.stderr.on('data', remoteDataPrinter(log, 'npm', 'stderr'));
    }

    return new Promise((resolve, reject) =>
      npm.on('exit', code => {
        if (code) reject(code);
        else resolve();
      }),
    );
  } catch (e) {
    log?.error('Error running remote npm', e);
  }
}
