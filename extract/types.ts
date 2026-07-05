/**
 * Brownfield extraction — shared shapes (docs/11, roadmap Phase 2).
 *
 * Every adapter (React/TS, Custom Elements Manifest, future Vue/Svelte/…)
 * normalizes a pre-existing component library into ExtractedComponent[].
 * From there the pipeline is adapter-agnostic: propose.ts turns extractions
 * into ContractSchema-valid PROPOSED contracts, and reconcile.ts joins a
 * code-side extraction with a design-side extraction into the disagreement
 * report — the first artifact a brownfield org gets, before any contract
 * is adopted.
 *
 * Scope discipline (docs/11): extraction targets the differ's scope — the
 * API surface (props, variants, defaults, booleans, text, events). Anatomy
 * is never inferred from foreign code; it stays human-owned.
 */

export type PropKind = 'enum' | 'boolean' | 'string' | 'number' | 'node' | 'event' | 'other';

export interface ExtractedProp {
  name: string;
  kind: PropKind;
  /** enum members, for kind 'enum' */
  values?: string[];
  default?: string | number | boolean;
  optional: boolean;
  description?: string;
  /** 'declared' — read directly from source syntax. 'inferred' — a heuristic
   *  filled a gap (e.g. one-hop type-alias resolution). Reconciliation and
   *  the proposal report surface anything below 'declared' for human review. */
  confidence: 'declared' | 'inferred';
}

export interface ExtractedComponent {
  name: string;
  /** file (React) or manifest path (CEM) this was read from */
  source: string;
  adapter: string;
  description?: string;
  props: ExtractedProp[];
  /** CSS custom properties consumed, when the adapter can see a stylesheet */
  cssVars?: string[];
}

/** A design-side component set, from extract/figma-dump.js or the parity
 *  snapshot. Property names/options are as the design tool spells them. */
export interface DesignComponent {
  name: string;
  variantProps: Record<string, string[]>;
  boolProps: string[];
  textProps: string[];
  swapProps: string[];
}

export interface ExtractConfig {
  code: {
    adapter: 'react-tsx' | 'cem';
    /** react-tsx: directory to scan recursively for components */
    root?: string;
    /** cem: path to custom-elements.json */
    manifest?: string;
  };
  design?: {
    /** Path to a JSON dump produced by extract/figma-dump.js, or the string
     *  "parity-snapshot" to reconcile against parity/snapshots/figma-components.json */
    source: string;
  };
  /** Contract id prefix for proposals (default "ds") */
  idPrefix?: string;
  /** Output directory (default "extract/out") */
  out?: string;
}

export const normalizeName = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]/g, '');

export const kebab = (s: string): string =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();

export const titleCase = (s: string): string =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
