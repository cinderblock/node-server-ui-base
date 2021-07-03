export function isNullish(v: unknown): v is null | undefined {
  if (v === null) return true;
  if (v === undefined) return true;
  return false;
}
