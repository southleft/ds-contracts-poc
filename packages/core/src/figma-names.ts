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
