/** Source-variable identity requires a matching authored declaration, computed
 * channel, in-scope variable value and compiled token. Equal paint is not an
 * identity join. Shared by root-only and complete initial-state compilation. */
import { flattenTokens } from '../core/tokens.js';
import { resolveTokens, type Part } from '../scripts/contract-schema.js';
import { normalizeValue, type CapturedNode } from '../extract/computed/lib.js';
import type { ReactStyleOrigin } from './react-style-origin.js';

export interface ReactSourceBindingProjection {
  sourceBindings: Array<{ channel: string; variable?: string; tokenPath?: string; reason?: string }>;
  tokens: Record<string, unknown>;
}
export function observeReactSourceBindings(root: CapturedNode, part: Part, tokens: Record<string, unknown>,
  styleOrigin: ReactStyleOrigin, rootPath: string, values: Record<string, string> = {}): ReactSourceBindingProjection {
  if (styleOrigin.version !== 1) throw Error('react-root-visual-style-origin-version');
  const origin = styleOrigin.roots.find(r => r.path === rootPath);
  if (!origin || origin.tag !== root.tag) throw Error('react-root-visual-style-origin-mismatch');
  const refs = resolveTokens(part, values), leaves = flattenTokens(tokens), named = new Map<string, unknown>(), selectors = new Map<string, Set<string>>();
  const sourceBindings = origin.channels.map(binding => {
    const base = { channel: binding.channel, ...(binding.variable ? { variable: binding.variable } : {}) };
    let ref = refs[binding.channel];
    for (const [property, value] of Object.entries(values)) ref = ref?.replaceAll('{' + property + '}', value);
    const leaf = typeof ref === 'string' ? leaves.get(ref.slice(1, -1)) : undefined;
    if (binding.status !== 'direct-variable' || !binding.variable || !binding.rawValue || !binding.computedValue)
      return { ...base, reason: binding.reason ?? 'source-binding-unresolved' };
    if (normalizeValue(binding.computedValue) !== normalizeValue(root.style[binding.channel]) ||
        normalizeValue(binding.rawValue) !== normalizeValue(binding.computedValue) ||
        normalizeValue(root.style[binding.variable] ?? '') !== normalizeValue(binding.rawValue))
      return { ...base, reason: 'source-variable-value-needs-resolution' };
    if (!leaf || !['color', 'number'].includes(leaf.type)) return { ...base, reason: 'projected-channel-not-token-bound' };
    const scoped = new Set(styleOrigin.roots.flatMap(r => r.channels.filter(c => c.variable === binding.variable && c.rawValue).map(c => c.rawValue)));
    if (scoped.size !== 1) return { ...base, reason: 'source-variable-scope-conflict' };
    const key = 'v' + Buffer.from(binding.variable, 'utf8').toString('hex'), tokenPath = 'source.css.' + key;
    const names = selectors.get(key) ?? new Set<string>();
    for (const selector of binding.selectors) names.add(selector); selectors.set(key, names);
    named.set(key, { $type: leaf.type, $value: leaf.value, $extensions: { 'dev.ds-contracts.css-source': {
      variable: binding.variable, rawValue: binding.rawValue, selectors: [...names].sort(),
    } } });
    return { ...base, tokenPath };
  });
  return { sourceBindings, tokens: named.size ? { source: { css: Object.fromEntries(named) } } : {} };
}
