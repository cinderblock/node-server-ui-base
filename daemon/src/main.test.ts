import { afterAll, beforeAll, expect, test } from 'bun:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { io, type Socket } from 'socket.io-client';
import type { State } from '../../shared/State.js';

/**
 * Starts the real daemon and talks to it the way the UI does.
 *
 * By default the daemon runs from source with Bun. Set `DAEMON_RUNTIME=node` to run the compiled output
 * (`bun run build` first) with Node instead, which is how it runs on a deployed system.
 */

const daemonDir = fileURLToPath(new URL('..', import.meta.url));

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address ? resolve(address.port) : reject()));
    });
  });
}

let daemon: ChildProcess;
let port: number;
let output = '';

beforeAll(async () => {
  port = await freePort();

  const command =
    process.env.DAEMON_RUNTIME === 'node'
      ? ['node', '--enable-source-maps', 'build/daemon/src/main.js']
      : [process.execPath, 'src/main.ts'];

  daemon = spawn(command[0]!, command.slice(1), {
    cwd: daemonDir,
    env: { ...process.env, PORT: String(port), FORCE_COLOR: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Daemon did not start:\n${output}`)), 10_000);
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes('Listening:')) {
        clearTimeout(timeout);
        resolve();
      }
    };
    daemon.stdout!.on('data', onData);
    daemon.stderr!.on('data', onData);
    daemon.once('exit', code => reject(new Error(`Daemon exited with ${code}:\n${output}`)));
  });
});

afterAll(() => {
  daemon?.kill();
});

function connect(): Socket {
  return io(`http://localhost:${port}`, { transports: ['websocket'], reconnection: false });
}

function next<T>(socket: Socket, event: string): Promise<T> {
  return new Promise(resolve => socket.once(event, resolve));
}

test('sends startup time and state updates', async () => {
  const socket = connect();
  try {
    const startupTime = await next<number>(socket, 'startupTime');
    expect(startupTime).toBeLessThanOrEqual(Date.now());

    const state = await next<State>(socket, 'update');
    expect(Math.abs(state.time - Date.now())).toBeLessThan(5_000);
    expect(state.debug.heapUsed).toBeGreaterThan(0);
    expect(state.userControls.sequence).toBe(0);
  } finally {
    socket.close();
  }
});

test('applies user controls from the UI', async () => {
  const socket = connect();
  try {
    await next(socket, 'connect');

    // The daemon ignores client events for a moment after connecting
    await Bun.sleep(700);

    socket.emit('userControls', { sequence: 42 });

    const deadline = Date.now() + 5_000;
    let state: State;
    do state = await next<State>(socket, 'update');
    while (state.userControls.sequence !== 42 && Date.now() < deadline);

    expect(state.userControls.sequence).toBe(42);

    // Invalid values are rejected by the protected setters
    socket.emit('userControls', { sequence: 'not a number' });
    await Bun.sleep(300);
    expect((await next<State>(socket, 'update')).userControls.sequence).toBe(42);
  } finally {
    socket.close();
  }
});

test('logs the greeting', () => {
  expect(output).toContain('Hello world!');
});
