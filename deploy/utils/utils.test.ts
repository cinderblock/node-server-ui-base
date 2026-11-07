import { expect, test } from 'bun:test';
import { filterInPlace } from './filterInPlace.ts';
import forEachPromise from './forEachPromise.ts';
import { isDirectoryString, isPathString } from './pathTypeDiscriminators.ts';
import { reduceFileListToMinimalDirs } from './reduceFileListToMinimalDirs.ts';

test('reduceFileListToMinimalDirs keeps only the deepest dirs', () => {
  expect(
    reduceFileListToMinimalDirs([
      'package.json',
      'my-daemon/daemon/src/main.js',
      'my-daemon/daemon/src/utils/debug.js',
      'my-daemon/daemon/src/utils/mkdir.js',
      'my-daemon/shared/State.js',
    ]),
  ).toEqual(['my-daemon/daemon/src/utils', 'my-daemon/shared']);
});

test('path discriminators', () => {
  expect(isDirectoryString('daemon')).toBe(true);
  expect(isDirectoryString('daemon/')).toBe(false);
  expect(isDirectoryString('')).toBe(false);
  expect(isPathString('../')).toBe(true);
  expect(isPathString('')).toBe(true);
  expect(isPathString('..')).toBe(false);
});

test('filterInPlace keeps the same array', () => {
  const a = [1, 2, 3, 4, 5];
  const b = filterInPlace(a, n => n % 2 === 1);
  expect(b).toBe(a);
  expect(a).toEqual([1, 3, 5]);
});

test('forEachPromise runs one at a time, in order', async () => {
  const order: string[] = [];
  const results = await forEachPromise([30, 10, 20], async (ms, i) => {
    order.push(`start ${i}`);
    await Bun.sleep(ms);
    order.push(`end ${i}`);
    return ms * 2;
  });
  expect(results).toEqual([60, 20, 40]);
  expect(order).toEqual(['start 0', 'end 0', 'start 1', 'end 1', 'start 2', 'end 2']);
});
