import { revisionOf } from './contract-provenance.js';
import { assertNativeTokenTree, type NativeTokenContextInput } from './native-token-context.js';
import { flattenTokens, type TokenTreeInput } from './tokens.js';

export interface LayeredNativeTokenMode {
  sourceMode: 'light' | 'dark';
  brand: string;
  nativeModeName: string;
}

/** Allocation input only. The component compiler must keep the original
 * layered trees, including the layer that carries imported typography.
 * Contexts are explicit host selections, never inferred source observations.
 * This grants no write authority and creates no variables or text styles.
 * The existing scoped token planner/writer owns alias validation, native
 * typing, allocation identity, and exact independent readback. */
export function layeredNativeTokenModes(
  layers: TokenTreeInput,
  contexts: LayeredNativeTokenMode[],
): { tokensSha256: string; modes: NativeTokenContextInput['modes'] } {
  const refuse = (code: string): never => { throw Error(`layered-native-tokens-${code}`); };
  const ancestors = new Set<object>();
  const assertJson = (value: unknown): void => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (typeof value !== 'object' || ancestors.has(value) ||
        (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null))
      return refuse('tree-not-json');
    ancestors.add(value);
    for (const child of Object.values(value)) assertJson(child);
    ancestors.delete(value);
  };
  assertJson(layers);
  if (!layers || !layers.brands || typeof layers.brands !== 'object' || Array.isArray(layers.brands))
    refuse('layers-invalid');
  for (const tree of [layers.primitives, layers.semantic, layers.light, layers.dark, ...Object.values(layers.brands)])
    assertNativeTokenTree(tree);
  if (!Array.isArray(contexts) || !contexts.length) refuse('contexts-missing');
  const selected = new Set<string>(), names = new Set<string>();
  const modes = contexts.map(context => {
    if (!context || !['light', 'dark'].includes(context.sourceMode) ||
        typeof context.brand !== 'string' || !Object.hasOwn(layers.brands, context.brand) ||
        typeof context.nativeModeName !== 'string' || !context.nativeModeName.trim() ||
        context.nativeModeName.trim() !== context.nativeModeName)
      refuse('context-invalid');
    const key = JSON.stringify([context.sourceMode, context.brand]);
    if (selected.has(key) || names.has(context.nativeModeName)) refuse('context-ambiguous');
    selected.add(key); names.add(context.nativeModeName);
    // Same precedence as createFigmaEngine's selected-context resolver.
    // Alias leaves stay aliases; no equal-valued substitute is introduced.
    const table = new Map([
      ...flattenTokens(layers.primitives), ...flattenTokens(layers.brands[context.brand]),
      ...flattenTokens(layers.semantic), ...flattenTokens(layers[context.sourceMode]),
    ]);
    const tokens: Record<string, unknown> = Object.fromEntries([...table].map(([path, entry]) => [path, {
      $type: entry.type, $value: entry.value,
      ...(entry.extensions ? { $extensions: entry.extensions } : {}),
    }]));
    // Validation precedes cloning so non-JSON values cannot be laundered.
    // Native scalar support is decided by prepareNativeTokenContext.
    const tokenTreeRevision = revisionOf(tokens);
    const detached = JSON.parse(JSON.stringify(tokens)) as Record<string, unknown>;
    if (revisionOf(detached) !== tokenTreeRevision) refuse('tree-not-json');
    return { sourceMode: context.sourceMode, brand: context.brand, nativeModeName: context.nativeModeName,
      tokens: detached, tokenTreeRevision };
  });
  return { tokensSha256: revisionOf(layers).slice('sha256:'.length), modes };
}
