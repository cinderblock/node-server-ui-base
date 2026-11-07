/**
 * Create a new version of a function that, on exception, simply returns undefined instead
 * @param original Function to wrap
 */
export function noFail<Func extends (...args: Args[]) => Result, Result, Args = any>(
  original: Func,
): (...args: Parameters<Func>) => Result {
  return (...args: Parameters<Func>): Result => {
    try {
      return original(...args);
    } catch (e) {}
    return (undefined as unknown) as Result;
  };
}
