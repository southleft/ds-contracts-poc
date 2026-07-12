/**
 * The engine's DATA, bundled — the same trees, SVGs, and contracts the CLI
 * reads from disk, imported here at build time so the browser runs the real
 * pipeline over the real inputs. Everything downstream (preview, emitters,
 * proposers) consumes these maps; nothing re-reads or re-derives.
 */
import {
  ContractSchema,
  tokenCorpusFromJson,
  tokenInventoryFromJson,
  type Contract,
  type TokenTreeInput,
} from '../../../core/index.js';

import primitives from '../../../tokens/primitives.tokens.json';
import semantic from '../../../tokens/semantic.tokens.json';
import light from '../../../tokens/modes/semantic.light.tokens.json';
import dark from '../../../tokens/modes/semantic.dark.tokens.json';
import brandDefault from '../../../tokens/modes/brand.default.tokens.json';
import brandAurora from '../../../tokens/modes/brand.aurora.tokens.json';

// The generated token custom-property stylesheets (src/styles/tokens*.css) —
// injected into the preview iframe so var(--…) references resolve, exactly
// as a page consuming the html emitter would include them.
import tokensCss from '../../../src/styles/tokens.css?raw';
import tokensDarkCss from '../../../src/styles/tokens.dark.css?raw';
import tokensBrandsCss from '../../../src/styles/tokens.brands.css?raw';

/** Parsed DTCG trees in the shape every emitter ctx expects. */
export const tokenTree: TokenTreeInput = {
  primitives,
  semantic,
  light,
  dark,
  brands: { default: brandDefault, aurora: brandAurora },
};

/** Token path inventory — EmitCtx.tokens for the react/html emitters. */
export const tokenInventory: Set<string> = tokenInventoryFromJson([primitives, semantic, light, dark]);

/** Corpus for design→contract proposals (same trees the CLI corpus loads). */
export const corpus = tokenCorpusFromJson({ primitives, semantic, light, brandDefault });

/** Trees for the code→contract token index ([primitives, semantic, light, dark],
 *  mirroring extract/adapters/css-module.ts DEFAULT_TOKEN_SOURCES). */
export const tokenTreesForCode: unknown[] = [primitives, semantic, light, dark];

export const tokenStylesheets = { base: tokensCss, dark: tokensDarkCss, brands: tokensBrandsCss };

// ---------------------------------------------------------------------------
// All 51 shipping contracts, schema-parsed at startup.
// ---------------------------------------------------------------------------

const contractModules = import.meta.glob('../../../contracts/*.contract.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

export const contractsById = new Map<string, Contract>();
/** The raw JSON (pretty-printable into the editor without schema round-trip drift). */
export const rawContractById = new Map<string, unknown>();

for (const raw of Object.values(contractModules)) {
  const parsed = ContractSchema.safeParse(raw);
  if (parsed.success) {
    contractsById.set(parsed.data.id, parsed.data);
    rawContractById.set(parsed.data.id, raw);
  }
}

/** Figma set/component name → contract id (proposeFromFigmaDump correlation). */
export const contractIdByName = new Map<string, string>(
  [...contractsById.values()].map((c) => [c.name, c.id]),
);

/** componentSetKey → contract id (dump v1.5 SESSION LINKING — nested
 *  instances resolve by publish key FIRST, rename-safe on both sides). */
export const contractIdByKey = new Map<string, string>(
  [...contractsById.values()]
    .filter((c) => c.anchors.figma.componentSetKey !== null)
    .map((c) => [c.anchors.figma.componentSetKey!, c.id]),
);

// ---------------------------------------------------------------------------
// Icon assets — the same assets/icons/*.svg the generator inlines.
// ---------------------------------------------------------------------------

const iconModules = import.meta.glob('../../../assets/icons/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

export const icons = new Map<string, string>(
  Object.entries(iconModules).map(([p, svg]) => [
    p.split('/').pop()!.replace(/\.svg$/, ''),
    svg.trim(),
  ]),
);
