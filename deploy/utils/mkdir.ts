import type { SSH } from '../src/ssh.ts';

/**
 * Helper function to create directories on our connected host.
 * @param dir Directory (or array of) to create on connected remote
 */
export async function mkdir(ssh: SSH, dir: string | string[]): Promise<unknown> {
  if (!dir.length) throw new Error('Invalid mkdir list');

  return ssh.exec('mkdir', ['-p', ...(typeof dir === 'string' ? [dir] : dir)]);
}
