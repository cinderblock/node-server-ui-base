import { expect, test } from 'bun:test';
import ExponentialFilter from './ExponentialFilter';

test('starts at the first value and then smooths', () => {
  const filter = ExponentialFilter(0.5);
  expect(filter(10)).toBe(10);
  expect(filter(20)).toBe(15);
  expect(filter(15)).toBe(15);
});

test('rejects non-finite input', () => {
  const filter = ExponentialFilter(0.1);
  expect(() => filter(NaN)).toThrow('Non finite argument');
  expect(() => filter(Infinity)).toThrow();
});
