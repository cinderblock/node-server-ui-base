import { expect, test } from 'bun:test';
import { recursiveAssign } from './recursiveAssign.js';

test('assigns nested values without replacing nested objects', () => {
  const nested = { str: 'foo', keep: true };
  const target = { num: 1, nested };

  recursiveAssign(target, { nested: { str: 'bar' } });

  expect(target).toEqual({ num: 1, nested: { str: 'bar', keep: true } });
  expect(target.nested).toBe(nested);
});

test('leaves untouched keys alone', () => {
  const target = { a: 1, b: 2 };
  recursiveAssign(target, { b: 3 });
  expect(target).toEqual({ a: 1, b: 3 });
});
