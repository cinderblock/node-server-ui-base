import { expect, test } from 'bun:test';
import { isNullish } from './isNullish';
import { noFail } from './noFail';

test('noFail returns the result, or undefined on a throw', () => {
  const parse = noFail((s: string) => JSON.parse(s) as unknown);
  expect(parse('{"a":1}')).toEqual({ a: 1 });
  expect(parse('{')).toBeUndefined();
});

test('isNullish', () => {
  expect(isNullish(null)).toBe(true);
  expect(isNullish(undefined)).toBe(true);
  expect(isNullish(0)).toBe(false);
  expect(isNullish('')).toBe(false);
});
