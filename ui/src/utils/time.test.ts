import { expect, test } from 'bun:test';
import { secondsToHumanReadable } from './time';

test.each([
  [1, '1.00s'],
  [65, '65.0s'],
  [200, '3.3m'],
  [7000, '1.9h'],
  [140_000, '39h'],
  [300_000, '3.5d'],
  [-65, '-65.0s'],
])('%p seconds is %p', (seconds, expected) => {
  expect(secondsToHumanReadable(seconds)).toBe(expected);
});
