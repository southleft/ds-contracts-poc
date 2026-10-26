/** Raw source evidence, independent of the contract schema. A complete capture
 * is not a claim that any paint in the stack is supported by a renderer. */
export interface SourceFillStack {
  version: 1;
  order: 'bottom-to-top';
  complete: true;
  paints: Array<{ index: number; paint: unknown }>;
}

/** Clone all enumerable source data, including unsupported fields and explicit
 * null/false/zero values. No defaults, visibility filtering or paint reduction. */
function cloneFillStackValue(value: unknown): unknown {
  if (Array.isArray(value)) return Array.from(value, cloneFillStackValue);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneFillStackValue(child)]));
  return value;
}

/** Figma paints draw bottom-to-top. Every observed array, including empty and
 * single-paint arrays, is complete; the existing paint channels are unchanged.
 * REST's top-level imageRef is spelled imageHash for native parity. An unusual
 * source containing both names retains both instead of overwriting evidence. */
export function observeFillStack(input: unknown, transport: 'native' | 'rest' = 'native'): SourceFillStack | undefined {
  if (!Array.isArray(input)) return undefined;
  const paints = Array.from(input, (raw, index) => {
    let paint = cloneFillStackValue(raw);
    if (transport === 'rest' && paint && typeof paint === 'object' && !Array.isArray(paint) &&
        Object.hasOwn(paint, 'imageRef') && !Object.hasOwn(paint, 'imageHash')) {
      paint = Object.fromEntries(Object.entries(paint).map(([key, value]) => [key === 'imageRef' ? 'imageHash' : key, value]));
    }
    return { index, paint };
  });
  return { version: 1, order: 'bottom-to-top', complete: true, paints };
}

/** Only observed per-paint binding records seed the existing consumer reader.
 * Nested bindings (for example gradient stops) and invisible paints count too;
 * this helper cannot infer a variable, a mode, or a resolved value. */
export function fillStackVariableIds(stack: SourceFillStack): string[] {
  const ids = new Set<string>();
  const bindings = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value)) {
      const alias = value as Record<string, unknown>;
      if (alias.type === 'VARIABLE_ALIAS' && typeof alias.id === 'string' && alias.id) ids.add(alias.id);
    }
    for (const child of Object.values(value)) bindings(child);
  };
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'boundVariables') bindings(child);
      else visit(child);
    }
  };
  for (const { paint } of stack.paints) visit(paint);
  return [...ids];
}
