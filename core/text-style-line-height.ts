/** Line height belongs to a captured style only when the neighboring token
 * carries the same source identity. Numeric coincidence is not evidence. */
export type StyleLineHeight = { value: number; unit: 'PIXELS' | 'PERCENT' };
export function capturedStyleLineHeight(
  sizePath: string,
  identity: { name: string; key?: string },
  read: (path: string) => { value: unknown; identity?: { name?: unknown; key?: unknown } } | undefined,
): StyleLineHeight | undefined {
  const path = sizePath.replace(/\.font-size(?=\.|$)/, '.line-height');
  const entry = read(path);
  if (!entry || entry.identity?.name !== identity.name || entry.identity.key !== identity.key) return undefined;
  const raw = entry.value;
  const match = String(raw).trim().match(/^(\d+(?:\.\d+)?)(px|rem|em|%)?$/);
  if (!match) throw new Error(`text-style-identity-refused: unsupported line height at ${path}`);
  const n = Number(match[1]), unit = match[2];
  if (!Number.isFinite(n)) throw new Error(`text-style-identity-refused: nonfinite line height at ${path}`);
  if (unit === '%' || (!unit && n > 0 && n <= 4)) return { value: unit === '%' ? n : n * 100, unit: 'PERCENT' };
  return { value: n * (unit === 'rem' || unit === 'em' ? 16 : 1), unit: 'PIXELS' };
}
export function sameStyleLineHeight(a: StyleLineHeight | undefined, b: StyleLineHeight | undefined): boolean {
  return a?.unit === b?.unit && a?.value === b?.value;
}
