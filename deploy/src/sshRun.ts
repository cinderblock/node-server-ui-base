import type { SSH } from './ssh.ts';
import type { ClientChannel, ExecOptions } from 'ssh2';
import type * as debug from '../utils/debug.ts';

export async function sshSpawn(
  log: typeof debug,
  ssh: SSH,
  args: string[],
  options: ExecOptions = {},
): Promise<ClientChannel> {
  const cmd = args.shift();

  if (!cmd) throw new Error('Must specify a command to run');

  const spawn: ClientChannel = await ssh.spawn(cmd, args, options);

  spawn.allowHalfOpen = false;

  // Remove verboseness from ssh.spawn
  spawn.removeAllListeners('finish');
  spawn.removeAllListeners('close');

  spawn.on('error', log.variable);

  return spawn;
}
