/**
 * Canonical spellings shared by browser-safe Figma projection code.
 *
 * These intentionally match the established proposal spellings. Keeping them
 * independent lets core validators reject lossy canonicalization before any
 * object or enum map can overwrite an earlier source value.
 */
export const camel = (value: string): string => {
  const spelled = value
    .trim()
    .split(/[\s_-]+/)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");
  const sanitized = spelled.replace(/[^A-Za-z0-9]/g, "");
  return sanitized.length > 0 ? sanitized : spelled;
};

export const canonicalPropName = (property: string): string => {
  const bare = property.split("#")[0].trim();
  if (/^[a-z][A-Za-z0-9]*$/.test(bare)) return bare;
  const name = camel(bare.replace(/[^A-Za-z0-9 _-]+/g, " ").trim());
  return /^[a-z]/.test(name) ? name : `p${name}`;
};

/** Allocate only colliding source spellings. Names already accepted by the
 * converter remain unchanged; a later natural name cannot be overwritten by
 * an allocated suffix. Sorting makes source traversal order irrelevant.
 * Original design spellings remain the keys and are never merged. */
export function allocateFigmaPropertyNames(properties: readonly string[]): Record<string, string> {
  const groups = new Map<string, string[]>();
  for (const property of [...new Set(properties)].sort()) {
    const base = canonicalPropName(property);
    const group = groups.get(base) ?? [];
    group.push(property); groups.set(base, group);
  }
  const taken = new Set(groups.keys());
  const aliases: Record<string, string> = Object.create(null);
  for (const [base, group] of [...groups.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (group.length < 2) continue;
    let ordinal = 1;
    for (const property of group) {
      let name: string;
      do { name = `${base}${ordinal++}`; } while (taken.has(name));
      taken.add(name); aliases[property] = name;
    }
  }
  return aliases;
}
