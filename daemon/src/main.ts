import { realpathSync } from 'node:fs';
import { PerformanceObserver } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import type { State } from '../../shared/State.js';
import { makeClientHandler } from './ClientHandler.js';
import { handleIncomingControls, realControls } from './UserControls.js';

function isEntryPoint(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (!isEntryPoint()) throw new Error('Do not import this file. Run it directly.');

console.log('Hello world!');

// Our "mains"
// import './Monitor/main.js';

const state: State = {
  debug: { heapUsed: 0, gc: { count: 0 } },
  time: Date.now(),
  userControls: realControls,
};

// Garbage collection stats, where the runtime reports them (Node does, Bun does not)
try {
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      state.debug.gc.count++;
      state.debug.gc.duration = entry.duration;
    }
  }).observe({ entryTypes: ['gc'] });
} catch {
  // Not supported here
}

const clients = makeClientHandler();

// Nothing to do if we can't talk to anyone. The error was already logged.
clients.listening.catch(() => process.exit(1));

clients.onControlUpdate(handleIncomingControls);

// Send the latest state to every connected UI
const interval = setInterval(() => {
  state.time = Date.now();
  state.debug.heapUsed = process.memoryUsage().heapUsed;
  clients.update(state);
}, 100);

function shutdown(): void {
  clearInterval(interval);
  clients.close().then(() => process.exit());
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
