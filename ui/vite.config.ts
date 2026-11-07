import { hostname } from 'node:os';
import react from '@vitejs/plugin-react';
import chalk from 'chalk';
import qrcode from 'qrcode-terminal';
import { defineConfig, type Plugin } from 'vite';

/**
 * Where the daemon is listening. `deploy`'s `dev:daemon` forwards this port to the remote daemon.
 */
const daemon = process.env.DAEMON_URL ?? 'http://localhost:8000';

/**
 * Print a link for this machine and a QR code for phones on the same network.
 */
function phoneLink(): Plugin {
  return {
    name: 'phone-link',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address();
        if (!address || typeof address === 'string') return;

        const localURL = `http://localhost:${address.port}`;
        const remoteURL = `http://${hostname()}:${address.port}`;

        console.log();
        console.log(chalk.yellow('Ctrl + click here:'), chalk.underline.blue(localURL));
        console.log();
        console.log(chalk.yellow('On your phone:'), chalk.underline.blue(remoteURL));
        console.log();
        qrcode.generate(remoteURL, { small: true });
        console.log();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), phoneLink()],
  server: {
    port: 9001,
    host: '0.0.0.0',
    proxy: {
      '/socket.io': {
        target: daemon,
        ws: true,
        xfwd: true,
      },
      '/dataFiles': {
        target: 'http://raspberrypi',
        xfwd: true,
      },
    },
  },
  build: {
    sourcemap: true,
  },
});
