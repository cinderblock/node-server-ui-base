// Extended from https://stackoverflow.com/a/41791149/4612476

/**
 * Run `fn` for each item, one at a time, waiting for each returned promise before starting the next.
 *
 * @param items An array of items.
 * @param fn A function that accepts an item from the array and returns a promise.
 * @returns The resolved values, in order.
 */
export default async function forEachPromise<T, Y>(
  items: T[],
  fn: (v: T, i: number, a: T[]) => PromiseLike<Y>,
): Promise<Y[]> {
  const results: Y[] = [];
  for (const [i, item] of items.entries()) results.push(await fn(item, i, items));
  return results;
}
