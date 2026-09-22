/** Included only by React modules with an explicitly keyed repeat. Validate
 * before React reconciles: duplicate/missing keys must not transfer another
 * item's state or silently fall back to its position. */
export const REACT_REPEAT_RUNTIME = String.raw`function __dscRepeatItems<T extends Record<string, unknown>>(items: T[] | undefined, field: keyof T): T[] | undefined {
  if (items === undefined) return undefined;
  if (!Array.isArray(items)) throw Error('repeat-items-invalid');
  const keys = new Set<string>();
  for (const item of items) {
    if (!item || !Object.prototype.hasOwnProperty.call(item, field) || typeof item[field] !== 'string' || item[field].length === 0)
      throw Error('repeat-key-invalid');
    const key = item[field] as string;
    if (keys.has(key)) throw Error('repeat-key-duplicate');
    keys.add(key);
  }
  return items;
}

`;
