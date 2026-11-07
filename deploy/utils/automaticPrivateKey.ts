import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ConnectOptions } from '../src/ssh.ts';

export async function automaticPrivateKey(opts: ConnectOptions): Promise<void> {
  if (opts.agent || opts.privateKey || opts.password || opts.identity) return;

  if (process.env.SSH_AUTH_SOCK) opts.agent = process.env.SSH_AUTH_SOCK;
  else if (process.platform === 'win32') opts.agent = 'pageant';
  else {
    // No agent detected
  }

  if (!opts.agent) {
    const keyFiles = ['id_ed25519', 'id_ecdsa', 'id_rsa'];
    for (const keyFile of keyFiles) {
      try {
        const file = join(homedir(), '.ssh', keyFile);
        opts.privateKey = await readFile(file);
        console.log('Found and loaded private key file:', file);
        break;
      } catch {
        // Try the next one
      }
    }
    if (!opts.privateKey) {
      // No private key found!
    }
  }
}
