/**
 * Custom Elements Manifest adapter — the framework-agnostic proof.
 *
 * Web Component libraries (Shoelace, Lit-based systems, FAST, …) already
 * publish `custom-elements.json` (https://custom-elements-manifest.open-wc.org).
 * CEM *describes* an API but never verifies it (docs/08); this adapter reads
 * that description into the same ExtractedComponent shape as the React
 * adapter, so proposals and reconciliation work identically. One adapter,
 * an entire ecosystem of libraries — no per-framework parser needed when a
 * standard manifest exists.
 */
import { readFileSync } from 'node:fs';
import type { ExtractedComponent, ExtractedProp } from '../types.js';

interface CemType {
  text?: string;
}
interface CemAttrOrMember {
  name: string;
  kind?: string;
  type?: CemType;
  default?: string;
  description?: string;
  privacy?: string;
}
interface CemEvent {
  name: string;
  description?: string;
}
interface CemDeclaration {
  kind?: string;
  customElement?: boolean;
  name?: string;
  tagName?: string;
  description?: string;
  attributes?: CemAttrOrMember[];
  members?: CemAttrOrMember[];
  events?: CemEvent[];
}
interface CemModule {
  path?: string;
  declarations?: CemDeclaration[];
}

/** "'sm' | 'md' | 'lg'" → ['sm','md','lg'] (CEM types are plain text). */
function parseUnion(text: string): string[] | null {
  const parts = text.split('|').map((p) => p.trim());
  const values: string[] = [];
  for (const p of parts) {
    const m = p.match(/^['"]([^'"]*)['"]$/);
    if (m) values.push(m[1]);
    else if (p === 'undefined') continue;
    else return null;
  }
  return values.length > 0 ? values : null;
}

function stripQuotes(s: string | undefined): string | number | boolean | undefined {
  if (s === undefined) return undefined;
  const m = s.match(/^['"](.*)['"]$/);
  if (m) return m[1];
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function classify(typeText: string | undefined): Pick<ExtractedProp, 'kind' | 'values'> {
  if (!typeText) return { kind: 'other' };
  const union = parseUnion(typeText);
  if (union) return { kind: 'enum', values: union };
  if (typeText === 'boolean') return { kind: 'boolean' };
  if (typeText === 'string') return { kind: 'string' };
  if (typeText === 'number') return { kind: 'number' };
  return { kind: 'other' };
}

/** "sl-remove" → "onRemove"-style camel event prop name for reconciliation. */
const eventPropName = (eventName: string): string =>
  'on' +
  eventName
    .replace(/^[a-z0-9]+-/, '') // vendor prefix (sl-remove → remove)
    .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    .replace(/^[a-z]/, (c) => c.toUpperCase());

export function extractCem(manifestPath: string): ExtractedComponent[] {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { modules?: CemModule[] };
  const out: ExtractedComponent[] = [];
  for (const mod of manifest.modules ?? []) {
    for (const decl of mod.declarations ?? []) {
      if (!decl.customElement && decl.kind !== 'class') continue;
      const name = decl.name ?? decl.tagName;
      if (!name) continue;
      const props: ExtractedProp[] = [];
      const seen = new Set<string>();
      // attributes carry the public API; fall back to public fields
      const sources = [
        ...(decl.attributes ?? []),
        ...(decl.members ?? []).filter((m) => m.kind === 'field' && m.privacy !== 'private' && m.privacy !== 'protected'),
      ];
      for (const a of sources) {
        if (seen.has(a.name)) continue;
        seen.add(a.name);
        const def = stripQuotes(a.default);
        props.push({
          name: a.name,
          optional: true, // CEM does not model requiredness
          ...classify(a.type?.text),
          ...(def !== undefined && def !== '' ? { default: def } : {}),
          ...(a.description ? { description: a.description } : {}),
          confidence: 'declared',
        });
      }
      for (const e of decl.events ?? []) {
        props.push({
          name: eventPropName(e.name),
          kind: 'event',
          optional: true,
          ...(e.description ? { description: `${e.description} (CEM event "${e.name}")` } : { description: `CEM event "${e.name}"` }),
          confidence: 'inferred', // prop-name spelling is our mapping, not the manifest's
        });
      }
      out.push({
        name,
        source: `${manifestPath}${mod.path ? ` (${mod.path})` : ''}`,
        adapter: 'cem',
        ...(decl.description ? { description: decl.description } : {}),
        props,
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
