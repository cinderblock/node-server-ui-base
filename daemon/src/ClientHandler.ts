import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { uptime } from 'node:os';
import chalk from 'chalk';
import { Server, type Socket } from 'socket.io';
import { startServer } from 'server-starter';
import type { State } from '../../shared/State.js';
import type { UserControlUpdate } from '../../shared/UserControls.js';

let clientID = 0;

export type UserControlsHandler = (userControls: UserControlUpdate) => void;
export type TeardownHandler = () => void;

export type StateUpdater = (state: State) => void;

export type ClientHandlerOptions = {
  /**
   * TCP port or unix socket path to listen on.
   *
   * Defaults to the `PORT` environment variable, or 8000.
   */
  listen?: number | string;
};

const controlListeners: UserControlsHandler[] = [];

function defaultListen(): number | string {
  const env = process.env.PORT;
  if (!env) return 8000;
  return /^\d+$/.test(env) ? Number(env) : env;
}

export function makeClientHandler({ listen = defaultListen() }: ClientHandlerOptions = {}): {
  onControlUpdate: (handler: UserControlsHandler) => TeardownHandler;
  close: () => Promise<void>;
  update: StateUpdater;
  listening: Promise<AddressInfo | string | null>;
} {
  // Helper function that is run every time a new webUI connects to us
  function setupClientSocket(sock: Socket): void {
    const ID = clientID++;

    // TODO: Do we trust the proxy to set true `x-real-ip` header?
    const headers = sock.conn.request.headers;
    const address = headers['x-forwarded-for'] || headers['x-real-ip'] || sock.handshake.address;
    console.log(chalk.green('Client connected:'), chalk.cyan(address), chalk.grey(`#${ID}`));

    // Give clients a our startup time once
    sock.emit('startupTime', Date.now() - uptime() * 1000);

    // Don't listen to client events for a sec on startup.
    // Ignores events that were "sent" after server shutdown (and are therefore still pending)
    setTimeout(() => {
      sock.on('userControls', (userControls: UserControlUpdate) => {
        // Received user controls
        controlListeners.forEach(handler => handler(userControls));
      });
    }, 500);
  }

  const server = createServer();

  const io = new Server(server, {
    serveClient: false,
    transports: ['websocket'],
    pingInterval: 1000,
  });

  // When a new client connects, setup handlers for the possible incoming commands
  io.on('connection', setupClientSocket);

  const listening = startServer(
    server,
    typeof listen === 'number'
      ? { listen }
      : {
          listen,
          // socketMode: 0o777,
          // socketOwner: {
          //   user: 'pi',
          //   group: 'www-data',
          // },
        },
  );

  listening.then(
    info =>
      console.log(chalk.green('Listening:'), chalk.cyan(info === null || typeof info === 'string' ? info : info.port)),
    err => console.log(chalk.red('ERROR:'), err),
  );

  function onControlUpdate(handler: UserControlsHandler): TeardownHandler {
    controlListeners.push(handler);

    // Return a cleanup function
    return (): void => {
      const i = controlListeners.indexOf(handler);
      if (i < 0) return;
      controlListeners.splice(i, 1);
    };
  }

  return {
    onControlUpdate,
    close: (): Promise<void> => new Promise<void>(resolve => io.close(() => resolve())),
    update: (state): void => {
      io.volatile.emit('update', state);
    },
    listening,
  };
}
