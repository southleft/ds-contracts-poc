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

/** Inferred code bindings must be legal in strict module/function scope.
 * Original Figma property spelling remains in its binding and projection. */
const RESERVED_BINDINGS=new Set(['await','break','case','catch','class','const','continue','debugger','default','delete','do','else','enum','export','extends','false','finally','for','function','if','implements','import','in','instanceof','interface','let','new','null','package','private','protected','public','return','static','super','switch','this','throw','true','try','typeof','var','void','while','with','yield','arguments','eval']);
/** Strip only Figma's terminal identity; a display name may itself contain '#'. */
export const figmaPropertyDisplayName = (property:string):string => property.replace(/#[0-9]+:[0-9]+(?::[0-9]+)?$/, '');
export const canonicalPropName = (property: string): string => {
  const bare = figmaPropertyDisplayName(property).trim();
  const spelled=/^[a-z][A-Za-z0-9]*$/.test(bare)?bare:camel(bare.replace(/[^A-Za-z0-9 _-]+/g, " ").trim());
  const name=/^[a-z]/.test(spelled)?spelled:`p${spelled}`;
  return RESERVED_BINDINGS.has(name)?`${name}Prop`:name;
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
