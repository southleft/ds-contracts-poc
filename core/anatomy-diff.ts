/**
 * Contract anatomy → channel lines (Wave 7).
 *
 * Flattens part-tree + layout + token bindings already present on a contract
 * into `part|channel|value` lines so core/channel-diff can pair them. This is
 * the contract↔contract half of anatomy-level parity (canvas half lives in
 * parity/variant-drift.ts + the v6 fingerprint).
 */
import type { Contract } from '../scripts/contract-schema.js';
import { diffChannelLines, type ChannelChange } from './channel-diff.js';

export type AnatomyPartNode = {
  layout?: Record<string, unknown>;
  tokens?: Record<string, unknown>;
  declared?: Record<string, unknown>;
  parts?: Record<string, AnatomyPartNode>;
  states?: Record<string, Record<string, unknown>>;
  element?: string;
  content?: unknown;
  component?: unknown;
  [k: string]: unknown;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function flattenBindings(
  partPath: string,
  bag: Record<string, unknown> | undefined,
  kind: string,
  out: string[],
): void {
  if (!bag) return;
  for (const [channel, raw] of Object.entries(bag)) {
    if (raw === undefined || raw === null) continue;
    if (isPlainObject(raw) && !('$value' in raw) && !('ref' in raw)) {
      // nested axis map — emit each leaf
      for (const [axis, leaf] of Object.entries(raw)) {
        const value =
          typeof leaf === 'string' || typeof leaf === 'number' || typeof leaf === 'boolean'
            ? String(leaf)
            : JSON.stringify(leaf);
        out.push(`${partPath}|${kind}.${channel}.${axis}|${value}`);
      }
      continue;
    }
    const value =
      typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean'
        ? String(raw)
        : JSON.stringify(raw);
    out.push(`${partPath}|${kind}.${channel}|${value}`);
  }
}

function walkPart(partPath: string, node: AnatomyPartNode, out: string[]): void {
  if (node.element !== undefined) out.push(`${partPath}|element|${String(node.element)}`);
  if (node.content !== undefined) {
    out.push(
      `${partPath}|content|${
        typeof node.content === 'string' ? node.content : JSON.stringify(node.content)
      }`,
    );
  }
  if (node.component !== undefined) {
    out.push(`${partPath}|component|${JSON.stringify(node.component)}`);
  }
  flattenBindings(partPath, node.layout as Record<string, unknown> | undefined, 'layout', out);
  flattenBindings(partPath, node.tokens as Record<string, unknown> | undefined, 'tokens', out);
  flattenBindings(partPath, node.declared as Record<string, unknown> | undefined, 'declared', out);
  if (node.states) {
    for (const [state, bag] of Object.entries(node.states)) {
      if (!isPlainObject(bag)) continue;
      flattenBindings(partPath, bag, `state.${state}`, out);
    }
  }
  if (node.parts) {
    for (const [name, child] of Object.entries(node.parts)) {
      if (!isPlainObject(child)) continue;
      walkPart(`${partPath}/${name}`, child as AnatomyPartNode, out);
    }
  }
}

/** Snapshot lines for one contract's anatomy (stable-sorted). */
export function anatomyChannelLines(contract: Contract): string[] {
  const anatomy = (contract as { anatomy?: AnatomyPartNode }).anatomy;
  if (!anatomy || !isPlainObject(anatomy)) return [];
  const out: string[] = [];
  // Contract anatomy is usually `{ root: { … } }` or `{ root: {}, parts: {} }`.
  if (anatomy.parts || anatomy.layout || anatomy.tokens || anatomy.element) {
    walkPart('root', anatomy, out);
  } else {
    for (const [name, child] of Object.entries(anatomy)) {
      if (!isPlainObject(child)) continue;
      walkPart(name === 'root' ? 'root' : `root/${name}`, child as AnatomyPartNode, out);
    }
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Diff two contracts' anatomies with the shared channel vocabulary. */
export function diffContractAnatomy(
  before: Contract,
  after: Contract,
): ChannelChange[] {
  return diffChannelLines(anatomyChannelLines(before), anatomyChannelLines(after));
}

/** Token refs (`{a.b.c}`) → CSS custom-property names (`a-b-c`). */
export function tokenRefToCssVar(ref: string): string | null {
  const m = ref.match(/^\{([a-zA-Z0-9][a-zA-Z0-9._-]*)\}$/);
  if (!m) return null;
  const path = m[1]!;
  // Axis placeholders like `{variant}` / `{size}` are not tokens.
  if (!path.includes('.')) return null;
  return path.split('.').join('-');
}

/** Collect CSS custom-property names implied by contract anatomy bindings. */
export function expectedCssVarsFromAnatomy(contract: Contract): string[] {
  const vars = new Set<string>();
  for (const line of anatomyChannelLines(contract)) {
    const value = line.slice(line.lastIndexOf('|') + 1);
    const css = tokenRefToCssVar(value);
    if (css) vars.add(css);
  }
  return [...vars].sort();
}
