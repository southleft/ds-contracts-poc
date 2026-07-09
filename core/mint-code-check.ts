/**
 * Receipts for code-import token minting — `npm run mint:code:check`.
 *
 * A synthetic CSS set shaped like the wild (a BEM button whose stylesheet
 * speaks raw literals AND foreign `var(--cbds-*)` custom properties, with a
 * separate tokens.css carrying the `:root` declarations) exercises every
 * rule core/mint-code.ts promises:
 *
 *   1. HARVEST      :root/html declarations found across the CSS set, chains
 *                   and fallbacks followed; @media-scoped overrides ignored.
 *   2. UNIFORM      one resolvable value → one imported.* leaf.
 *   3. DEDUPE       an identical literal at ≥3 uniform sites → ONE
 *                   imported.shared.* leaf binding every site.
 *   4. VARIANTS     per-axis-class values → a leaf per axis value + the
 *                   substituted ref, base rule filling uncovered values;
 *                   partial coverage and multi-axis conditioning mint
 *                   NOTHING, by name.
 *   5. STATES       state rules mint under …​.<part>.<state>.<css-property>.
 *   6. VERBATIM     a var() with no reachable declaration is carried
 *                   verbatim — named, never guessed.
 *   7. INVARIANTS   imported.-namespace only, deterministic output,
 *                   mintedTokenCss carries every literal.
 *
 * Node script over pure functions — the same shell/core split as mint-check.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  collectRootCustomProps,
  mintFromCss,
  type CodeMintFinding,
} from './mint-code.js';
import { MINT_NAMESPACE, mintedTokenCss, type MintAxis } from './mint-tokens.js';
import { proposeFromCode } from './propose-code.js';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { emitReact } from './emit-react.js';
import { emitHtml } from './emit-html.js';
import { tokenInventoryFromJson } from './tokens.js';

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

// ---------------------------------------------------------------------------
// Synthetic CSS set — tokens.css (:root vocabulary) + a dark override to skip
// ---------------------------------------------------------------------------

const tokensCss = `
/* auto-generated */
:root {
  --acme-blue-600: #0e61ba;
  --acme-blue-700: #003e81;
  --acme-grey-200: #F5F7FA;
  --acme-red-600: #b51833;
  --acme-bg-brand: var(--acme-blue-600);
  --acme-bg-brand-hover: var(--acme-blue-700);
  --acme-bg-surface: var(--acme-grey-200);
  --acme-bg-danger: var(--acme-red-600);
  --acme-spacing-100: 0.5rem;
  --acme-radius: 8px;
  --acme-weight: 600;
}
@media (prefers-color-scheme: dark) {
  :root {
    --acme-bg-brand: #ffffff; /* must NOT win — media-scoped */
  }
}
:root[data-theme='dark'] {
  --acme-bg-brand: #000000; /* must NOT win — attribute-scoped */
}
html {
  --acme-line: 20px;
}
`;

const props = collectRootCustomProps([tokensCss, `:root { --acme-radius: 8px; }`]);

console.log('\nHarvest (:root custom properties)');
check('declarations harvested from :root and html', props.get('acme-spacing-100') === '0.5rem' && props.get('acme-line') === '20px');
check('media-scoped :root override ignored (base value wins)', props.get('acme-bg-brand') === 'var(--acme-blue-600)');
check('attribute-scoped :root ignored', props.get('acme-blue-600') === '#0e61ba');

// ---------------------------------------------------------------------------
// Findings — the extractor's view of a BEM button (variant + size axes)
// ---------------------------------------------------------------------------

const axes: MintAxis[] = [
  { propName: 'variant', values: ['primary', 'surface', 'danger', 'ghost'] },
  { propName: 'size', values: ['small', 'medium', 'large'] },
];

const f = (
  selector: string,
  part: string,
  cssProperty: string,
  raw: string,
  extra: Partial<CodeMintFinding> = {},
): CodeMintFinding => ({ selector, part, cssProperty, raw, ...extra });

const findings: CodeMintFinding[] = [
  // base rule: foreign vars (chained), a raw literal, a rem dimension
  f('.btn', 'root', 'background-color', 'var(--acme-bg-brand)'),
  f('.btn', 'root', 'gap', 'var(--acme-spacing-100)'),
  f('.btn', 'root', 'border-radius', 'var(--acme-radius)'),
  f('.btn', 'root', 'font-weight', 'var(--acme-weight)'),
  f('.btn', 'root', 'line-height', 'var(--acme-line)'),
  f('.btn', 'root', 'min-height', '40px'),
  // variant classes cover 3 of 4 values; primary fills from the base rule
  f('.btn--surface', 'root', 'background-color', 'var(--acme-bg-surface)', { axis: { prop: 'variant', value: 'surface' } }),
  f('.btn--danger', 'root', 'background-color', 'var(--acme-bg-danger)', { axis: { prop: 'variant', value: 'danger' } }),
  f('.btn--ghost', 'root', 'background-color', 'transparent', { axis: { prop: 'variant', value: 'ghost' } }),
  // size axis on min-height, base = medium's value
  f('.btn--small', 'root', 'min-height', '32px', { axis: { prop: 'size', value: 'small' } }),
  f('.btn--medium', 'root', 'min-height', '40px', { axis: { prop: 'size', value: 'medium' } }),
  f('.btn--large', 'root', 'min-height', '48px', { axis: { prop: 'size', value: 'large' } }),
  // state rule (hover) with a variant override — substituted under the state
  f('.btn:hover', 'root', 'background-color', 'var(--acme-bg-brand-hover)', { state: 'hover' }),
  // dedupe: #333333 at three separate uniform sites
  f('.btn__icon-left', 'iconLeft', 'color', '#333333'),
  f('.btn__icon-right', 'iconRight', 'color', '#333333'),
  f('.btn__label', 'label', 'color', '#333333'),
  // var with a fallback whose var is undeclared → fallback resolves
  f('.btn__label', 'label', 'font-size', 'var(--acme-undeclared, 16px)'),
  // carried verbatim: no declaration anywhere, no fallback
  f('.btn', 'root', 'color', 'var(--acme-text-inverse)'),
  // unmintable: resolves to a keyword that is not a color/dimension/number
  f('.btn', 'root', 'white-space', 'nowrap'),
  // partial coverage without a base rule → refusal
  f('.btn--small', 'root', 'letter-spacing', '0.5px', { axis: { prop: 'size', value: 'small' } }),
  // conditioned on an axis that is not declared → refusal
  f('.btn--fancy', 'root', 'outline-width', '2px', { axis: { prop: 'fancy', value: 'yes' } }),
];

const result = mintFromCss('Button', findings, axes, props);
const byRef = new Map(result.entries.map((e) => [e.ref, e]));
const bindingOf = (part: string, cssProperty: string, state?: string) =>
  result.bindings.find((b) => b.part === part && b.cssProperty === cssProperty && b.state === state);

console.log('\nUniform + foreign-var resolution');
check('chained var resolves to the literal (gap → 0.5rem)', byRef.get('{imported.button.root.gap}')?.value === '0.5rem');
check('px leaf minted (border-radius → 8px)', byRef.get('{imported.button.root.border-radius}')?.value === '8px');
check('number leaf minted (font-weight → 600)', byRef.get('{imported.button.root.font-weight}')?.value === '600');
check('html-block declaration resolves (line-height → 20px)', byRef.get('{imported.button.root.line-height}')?.value === '20px');
check('fallback resolves when the var is undeclared (font-size → 16px)', byRef.get('{imported.button.label.font-size}')?.value === '16px');

console.log('\nDedupe');
const shared = byRef.get('{imported.shared.color-333333}');
check('#333333 ×3 uniform sites → imported.shared.color-333333', shared?.value === '#333333');
check('the shared leaf lists all 3 usage sites', (shared?.usageSites.length ?? 0) === 3);
check(
  'all three parts bind the shared leaf',
  ['iconLeft', 'iconRight', 'label'].every((p) => bindingOf(p, 'color')?.ref === '{imported.shared.color-333333}'),
);

console.log('\nVariants');
check(
  'variant-classed background binds the substituted ref',
  bindingOf('root', 'background-color')?.ref === '{imported.button.root.background-color.{variant}}',
);
check(
  'uncovered primary fills from the base rule (cascade default)',
  byRef.get('{imported.button.root.background-color.primary}')?.value === '#0e61ba',
);
check(
  'per-variant leaves carry the resolved literals',
  byRef.get('{imported.button.root.background-color.surface}')?.value === '#f5f7fa' &&
    byRef.get('{imported.button.root.background-color.danger}')?.value === '#b51833' &&
    byRef.get('{imported.button.root.background-color.ghost}')?.value === 'transparent',
);
check(
  'size-classed min-height binds the substituted ref',
  bindingOf('root', 'min-height')?.ref === '{imported.button.root.min-height.{size}}',
);
check(
  'size leaves carry the literals',
  byRef.get('{imported.button.root.min-height.small}')?.value === '32px' &&
    byRef.get('{imported.button.root.min-height.large}')?.value === '48px',
);

console.log('\nStates');
check(
  'hover rule mints under the state segment',
  bindingOf('root', 'background-color', 'hover')?.ref === '{imported.button.root.hover.background-color}' &&
    byRef.get('{imported.button.root.hover.background-color}')?.value === '#003e81',
);

console.log('\nRefusals (named, never guessed)');
const verbatim = result.carriedVerbatim[0];
check(
  'undeclared var carried verbatim with the expression and reason',
  result.carriedVerbatim.length === 1 &&
    verbatim?.expression === 'var(--acme-text-inverse)' &&
    verbatim?.reason.includes('no :root declaration'),
);
check(
  'unmintable keyword refused by name',
  bindingOf('root', 'white-space')?.ref === null &&
    (bindingOf('root', 'white-space')?.reason ?? '').includes('not a color, dimension, or number'),
);
check(
  'partial axis coverage without a base rule refused by name',
  bindingOf('root', 'letter-spacing')?.ref === null &&
    (bindingOf('root', 'letter-spacing')?.reason ?? '').includes('1/3 values'),
);
check(
  'undeclared axis refused by name',
  bindingOf('root', 'outline-width')?.ref === null &&
    (bindingOf('root', 'outline-width')?.reason ?? '').includes('not a declared enum axis'),
);

console.log('\nInvariants');
check('every minted ref lives under the imported. namespace', result.entries.every((e) => e.ref.startsWith(`{${MINT_NAMESPACE}.`)));
check('count equals the leaf ledger', result.count === result.entries.length);
const again = mintFromCss('Button', findings, axes, props);
check('minting is deterministic', JSON.stringify(again) === JSON.stringify(result));
const css = mintedTokenCss(result.tree);
check(
  'mintedTokenCss carries every literal the bindings resolve to',
  result.entries.every((e) => css.includes(`--${e.ref.slice(1, -1).split('.').join('-')}: ${e.value};`)),
);

// ---------------------------------------------------------------------------
// Wired path — proposeFromCode with mintUnbound over a BEM button whose
// stylesheet speaks only foreign var()s + raw literals (the CBDS shape)
// ---------------------------------------------------------------------------

const wildTsx = `
import React from "react";
import { clsx } from "clsx";
import styles from "./WildButton.module.css";

type Variant = "primary" | "surface" | "danger";
type Size = "small" | "medium";

export type WildButtonProps = {
  variant?: Variant;
  size?: Size;
  children?: React.ReactNode;
};

export const WildButton: React.FC<WildButtonProps> = ({
  variant = "primary",
  size = "medium",
  children,
}) => (
  <button
    className={clsx(
      styles["wild-button"],
      variant !== "primary" && styles[\`wild-button--\${variant}\`],
      size !== "medium" && styles[\`wild-button--\${size}\`],
    )}
  >
    {children}
  </button>
);
`;

const wildCss = `
.wild-button {
  display: inline-flex;
  align-items: center;
  padding: var(--acme-spacing-100) 16px;
  border-radius: var(--acme-radius);
  background-color: var(--acme-bg-brand);
  color: var(--acme-text-inverse);
  min-height: 40px;

  &:hover:not(:disabled) {
    background-color: var(--acme-bg-brand-hover);
  }
}

.wild-button--surface {
  background-color: var(--acme-bg-surface);
}

.wild-button--danger {
  background-color: var(--acme-bg-danger);
}

.wild-button--small {
  min-height: 32px;
}
`;

console.log('\nWired: proposeFromCode default (mint off — report-only behavior unchanged)');
const sourceInput = { sourcePath: 'acme/WildButton.tsx', source: wildTsx, css: wildCss };
const plain = proposeFromCode(sourceInput, { tokens: [] });
const plainProposal = plain.proposals[0]?.proposal;
check('no mintedTokens on the result', plainProposal?.mintedTokens === undefined);
check('no imported.* ref anywhere', !JSON.stringify(plainProposal?.contract ?? {}).includes(`{${MINT_NAMESPACE}.`));
check(
  'foreign vars stay named refusals',
  (plainProposal?.notes ?? []).some((n) => n.includes('var(--acme-bg-brand) which resolves to NO token')),
);
check(
  'raw literals stay RAW VALUE report entries',
  (plainProposal?.notes ?? []).some((n) => n.includes('RAW VALUE') && n.includes('min-height: 40px')),
);

console.log('\nWired: proposeFromCode with mintUnbound + extraCss (tokens.css)');
const minted2 = proposeFromCode(sourceInput, { tokens: [], mintUnbound: true, extraCss: [tokensCss] });
const proposal = minted2.proposals[0]?.proposal;
const contract2 = proposal?.contract as Record<string, any>;
const rootPart = contract2?.anatomy?.root;
check('mintedTokens returned on the proposal', (proposal?.mintedTokens?.count ?? 0) > 0);
check(
  'variant-classed background binds the substituted ref in the CONTRACT',
  rootPart?.tokens?.['background-color'] === '{imported.wild-button.root.background-color.{variant}}',
);
check(
  'padding shorthand split and minted (padding-inline 16px)',
  rootPart?.tokens?.['padding-inline'] === '{imported.wild-button.root.padding-inline}',
);
check(
  'hover state bound to the minted state leaf',
  rootPart?.states?.hover?.['background-color'] === '{imported.wild-button.root.hover.background-color}',
);
check('hover reaches the contract states list', (contract2?.states ?? []).includes('hover'));
check(
  'unresolvable var carried verbatim in the notes, not bound',
  (proposal?.notes ?? []).some((n) => n.startsWith('CARRIED VERBATIM') && n.includes('var(--acme-text-inverse)')) &&
    rootPart?.tokens?.color === undefined,
);
check(
  'MINTED notes name every leaf as provisional',
  (proposal?.mintedTokens?.entries ?? []).every((e) =>
    (proposal?.notes ?? []).some((n) => n.includes(e.ref) && n.includes('rename against your real tokens (provisional)')),
  ),
);
check(
  'bound sites no longer report as refusals',
  !(proposal?.notes ?? []).some((n) => n.includes('var(--acme-bg-brand) which resolves to NO token')),
);

// The minted proposal validates and GENERATES: emitReact + emitHtml run green
// with an inventory of the repo trees + the minted tree.
const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;
let generated = true;
let htmlCss = '';
try {
  const parsed: Contract = ContractSchema.parse(contract2);
  const inventory = tokenInventoryFromJson([
    read('tokens/primitives.tokens.json'),
    read('tokens/semantic.tokens.json'),
    read('tokens/modes/semantic.light.tokens.json'),
    read('tokens/modes/semantic.dark.tokens.json'),
    proposal?.mintedTokens?.tree ?? {},
  ]);
  const emitCtx = { tokens: inventory, icons: new Map<string, string>(), contracts: new Map([[parsed.id, parsed]]) };
  emitReact(parsed, emitCtx);
  htmlCss = emitHtml(parsed, emitCtx).css;
} catch (e) {
  generated = false;
  console.error(String(e));
}
check('emitReact + emitHtml run green with repo + minted trees', generated);
check(
  'emitted css references the minted custom properties per variant',
  htmlCss.includes('var(--imported-wild-button-root-background-color-danger)') &&
    htmlCss.includes('var(--imported-wild-button-root-hover-background-color)'),
);

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} code-minting invariant(s) failed`);
  process.exit(1);
}
console.log('\n✔ all code-minting invariants hold (harvest, uniform, dedupe, variants, states, verbatim, wiring, generation)');
