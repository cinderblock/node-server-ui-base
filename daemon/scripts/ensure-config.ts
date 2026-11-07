// Create `daemon/src/configs/config.ts` from the example on first install.
// That file is git-ignored so each machine can keep its own settings.
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const configs = new URL('../src/configs/', import.meta.url);
const target = fileURLToPath(new URL('config.ts', configs));

if (!existsSync(target)) {
  copyFileSync(fileURLToPath(new URL('config.example.ts', configs)), target);
  console.log('Created', target, 'from config.example.ts');
}
