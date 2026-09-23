import { ContractSchema, contractDependencyEdges, type Contract } from '../../scripts/contract-schema.js';
import type { TokenTreeInput } from '../../core/tokens.js';

export const MAX_BYTES = 5 * 1024 * 1024;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function assertData(value: unknown, depth = 0): void {
  if (depth > 64) throw Error('react-library-data-too-deep');
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('react-library-unsafe-data-key');
    assertData(child, depth + 1);
  }
}
export function parseLibraryRequest(value: unknown): { root: Contract; contracts: Contract[]; tokens: TokenTreeInput; icons: Array<[string, string]> } {
  assertData(value);
  if (!record(value) || Object.keys(value).some(k => !['rootId', 'contracts', 'tokens', 'icons'].includes(k))) throw Error('react-library-invalid-request');
  if (!Array.isArray(value.contracts) || value.contracts.length < 1 || value.contracts.length > 30) throw Error('react-library-family-limit: expected 1–30 components');
  const contracts = value.contracts.map(c => {
    const parsed = ContractSchema.safeParse(c);
    if (!parsed.success) throw Error('react-library-contract-invalid: ' + parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
    return parsed.data;
  });
  const ids = new Set<string>(), names = new Set<string>();
  for (const c of contracts) {
    // These names become folder names and ESM exports, never arbitrary paths.
    if (!/^[A-Z][A-Za-z0-9]*$/.test(c.name)) throw Error('react-library-invalid-component-name');
    if (ids.has(c.id) || names.has(c.name.toLowerCase())) throw Error('react-library-duplicate-component');
    ids.add(c.id); names.add(c.name.toLowerCase());
  }
  const root = contracts.find(c => c.id === value.rootId);
  if (!root) throw Error('react-library-root-missing');
  const byId = new Map(contracts.map(c => [c.id, c])), reached = new Set<string>();
  const visit = (c: Contract) => {
    if (reached.has(c.id)) return;
    reached.add(c.id);
    for (const edge of contractDependencyEdges(c)) {
      const child = byId.get(edge.id);
      if (!child) throw Error(`react-library-dependency-missing: ${edge.id}`);
      visit(child);
    }
  };
  visit(root);
  if (reached.size !== contracts.length) throw Error('react-library-unrelated-components');
  const tokens = value.tokens;
  if (!record(tokens) || Object.keys(tokens).some(k => !['primitives', 'semantic', 'light', 'dark', 'brands'].includes(k)) || !['primitives', 'semantic', 'light', 'dark', 'brands'].every(k => record(tokens[k]))) throw Error('react-library-invalid-tokens');
  if (Object.entries(tokens.brands as Record<string, unknown>).some(([key, tree]) => !/^[a-z0-9][a-z0-9-]*$/.test(key) || !record(tree))) throw Error('react-library-invalid-brand');
  if (!Array.isArray(value.icons) || value.icons.length > 1000) throw Error('react-library-invalid-icons');
  const iconNames = new Set<string>();
  const icons = value.icons.map(row => {
    if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(row[0]) || typeof row[1] !== 'string' || row[1].length > 200_000 || iconNames.has(row[0])) throw Error('react-library-invalid-icon');
    iconNames.add(row[0]); return row as [string, string];
  });
  return { root, contracts, tokens: tokens as unknown as TokenTreeInput, icons };
}


export type ReactLibraryInput = ReturnType<typeof parseLibraryRequest>;
