#!/usr/bin/env bun
/**
 * Watch the daemon's sources, compile them, push them to the remote, and (re)start the remote daemon.
 *
 * Remote settings live in `config.ts`.
 */
import config from './config.ts';
import watchBuildTransferRun from './src/watchBuildTransferRun.ts';
import * as log from './utils/debug.ts';

watchBuildTransferRun(config).catch(e => log.error('Main Failure:', String(e)));
