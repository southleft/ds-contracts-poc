/**
 * Receipts for the OWNER'S END-TO-END SEND (plugin bridge → styled preview) —
 * `npm run extract:figma:cbds:bridge:check`.
 *
 * Fixture: extract/figma/fixtures/cbds-plugin-button-brand-primary.dump.json
 * — the LIVE plugin-transport dump of the owner's CBDS "Button-Brand Primary"
 * set (file WofZT8xaxXuc2Q6Je9S4XE, node 258-1838), remapped to dump v1.4
 * (`_variables` resolved values + literal minHeight carried).
 *
 * The field failure: the proposal bound his REAL token names ({bg.brand.
 * default}, {spacing.100}, …) and the playground referee refused ALL NINE
 * ("does not exist in tokens/") because it knew only the repo corpus — his
 * tokens had nowhere to register. His notes also showed root paddingLeft/
 * paddingRight and height dropped as 'bindings differ across variants without
 * correlating to any variant axis', and minHeight 44 dropped as
 * min-max-size-unsupported ×15.
 *
 * This receipt replays the committed fixture through the SAME functions the
 * playground receive path runs (proposeBatchFromDump → capturedTokensFromDump
 * → the token-source layering rule → generateCss referee → emitHtml preview)
 * and pins, numerically:
 *
 *   1. CAPTURED LAYER   18 variables register (none shadowed by repo tokens);
 *                       resolution is exact (#0e61ba, 16px, 48px, …)
 *   2. ZERO REFUSALS    the referee (generateCss over the layered inventory)
 *                       reports zero violations — no "does not exist in
 *                       tokens/" anywhere
 *   3. REAL REFS        the contract JSON binds his names: bg.brand.default /
 *                       hover / pressed, bg.disabled, border.focus,
 *                       text.inverse-primary, spacing.100/150/200,
 *                       corner-radius.100, component-size.* per size
 *   4. CORRELATION      padding-inline and height carried per size as
 *                       tokensByProp ({spacing.200} large/medium,
 *                       {spacing.150} small; component-size.xlarge/large/
 *                       medium) — correlation over the default-state
 *                       occurrences, injectivity NOT required
 *   5. MIN-HEIGHT       the literal minHeight 44 carries (minted px fact,
 *                       resolves 44px) — the tap-target renders
 *   6. PREVIEW          emitHtml (the playground preview engine) renders a
 *                       focusable <button> whose computed values resolve to
 *                       the dump's numbers: background #0e61ba, hover
 *                       #003e81, active #002854, disabled #dfe3eb, focus
 *                       outline #0e61ba/2px, padding-inline 16px (12px
 *                       small), height 48px (32px small), min-height 44px,
 *                       label #fcfeff
 *
 * Node script over pure functions — the same shell/core split as
 * extract/figma/cbds-check.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { loadTokenCorpus } from './tokens.js';
import { loadContracts } from './propose.js';
import { proposeBatchFromDump } from '../../core/propose-figma.js';
import { capturedTokensFromDump } from '../../core/captured-tokens.js';
import { emitHtml } from '../../core/emit-html.js';
import { emitReact, generateCss } from '../../core/emit-react.js';
import { flattenTokens, tokenInventoryFromJson } from '../../core/tokens.js';

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

type J = Record<string, any>;

// ---------------------------------------------------------------------------
// The owner's send, replayed: the SAME batch function the playground runs
// ---------------------------------------------------------------------------

console.log('CBDS plugin-bridge send (cbds-plugin-button-brand-primary.dump.json, dump v1.4)');
const dump = read(path.join('extract', 'figma', 'fixtures', 'cbds-plugin-button-brand-primary.dump.json'));
const corpus = loadTokenCorpus(ROOT);
const loaded = loadContracts(path.resolve(ROOT, 'contracts'));
const batch = proposeBatchFromDump(dump, {
  corpus,
  contractIdByName: loaded.byName,
  contractsById: loaded.byId,
  fileKey: 'WofZT8xaxXuc2Q6Je9S4XE',
  mintUnbound: true,
});
check('1 proposed, 0 skipped (the send completes)', batch.proposals.length === 1 && batch.skipped.length === 0);
const proposal = batch.proposals[0];
const c = proposal.contract as J;
const rootTokens: Record<string, string> = c.anatomy.root.tokens ?? {};
const rootByProp: { prop?: string; map?: Record<string, Record<string, string>> } = c.anatomy.root.tokensByProp ?? {};
const rootStates: Record<string, Record<string, string>> = c.anatomy.root.states ?? {};

// ---------------------------------------------------------------------------
// 1. Captured-token layer — his real variables register with exact values
// ---------------------------------------------------------------------------

console.log('\n1. Captured tokens (dump v1.4 _variables → import-scoped layer)');
const captured = capturedTokensFromDump(dump);
check('the dump carries a captured-token layer', captured !== null);
check(`18 variables captured, 18 registrable, 0 skipped (got ${captured?.count}/${captured?.skipped.length ?? '?'} skips)`, captured?.count === 18 && captured?.skipped.length === 0);
const capturedValue = new Map((captured?.entries ?? []).map((e) => [e.path, e.value]));
const EXACT: Array<[string, string]> = [
  ['bg.brand.default', '#0e61ba'],
  ['bg.brand.hover', '#003e81'],
  ['bg.brand.pressed', '#002854'],
  ['bg.disabled', '#dfe3eb'],
  ['text.inverse-primary', '#fcfeff'],
  ['border.focus', '#0e61ba'],
  ['spacing.100', '8px'],
  ['spacing.150', '12px'],
  ['spacing.200', '16px'],
  ['corner-radius.100', '8px'],
  ['component-size.xlarge', '48px'],
  ['component-size.large', '40px'],
  ['component-size.medium', '32px'],
];
for (const [p, v] of EXACT) {
  check(`captured {${p}} resolves EXACTLY to ${v}`, capturedValue.get(p) === v);
}

// The playground layering rule: repo tokens win on name collision. None of
// his names collide, so ALL 18 register (a shadow would be receipted by name).
const repoInventory = tokenInventoryFromJson([
  read('tokens/primitives.tokens.json'),
  read('tokens/semantic.tokens.json'),
  read('tokens/modes/semantic.light.tokens.json'),
  read('tokens/modes/semantic.dark.tokens.json'),
]);
const shadowed = (captured?.entries ?? []).filter((e) => repoInventory.has(e.path));
check('zero captured names shadow repo tokens — all 18 register', shadowed.length === 0);

// ---------------------------------------------------------------------------
// 2. ZERO refusals — the referee resolves every ref through the layered set
// ---------------------------------------------------------------------------

console.log('\n2. Referee (generateCss over repo + captured + minted): zero refusals');
const contract: Contract = ContractSchema.parse(c);
const stubs = (proposal.childStubs ?? []).map((s) => ContractSchema.parse(s));
const layeredInventory = new Set<string>([
  ...repoInventory,
  ...(captured?.entries ?? []).map((e) => e.path),
  ...[...flattenTokens((proposal.mintedTokens?.tree ?? {}) as Record<string, unknown>).keys()],
]);
const refusals: string[] = [];
generateCss(contract, layeredInventory, refusals);
check(`ZERO referee violations (got ${refusals.length})`, refusals.length === 0);
check(
  'in particular: zero "does not exist in tokens/" refusals (the owner saw NINE)',
  !refusals.some((e) => e.includes('does not exist in tokens/')),
);
// Control: WITHOUT the captured layer, the owner's refusal class reproduces.
const withoutCaptured: string[] = [];
generateCss(
  contract,
  new Set<string>([...repoInventory, ...[...flattenTokens((proposal.mintedTokens?.tree ?? {}) as Record<string, unknown>).keys()]]),
  withoutCaptured,
);
check(
  `control: WITHOUT the captured layer the referee refuses his real names by name (got ${withoutCaptured.filter((e) => e.includes('does not exist in tokens/')).length} refusals)`,
  withoutCaptured.filter((e) => e.includes('does not exist in tokens/')).length >= 9,
);

// ---------------------------------------------------------------------------
// 3. Real token names in the contract JSON
// ---------------------------------------------------------------------------

console.log('\n3. Real token names bound in the contract JSON');
check('root background-color = {bg.brand.default}', rootTokens['background-color'] === '{bg.brand.default}');
check('root gap = {spacing.100}', rootTokens['gap'] === '{spacing.100}');
check('root padding-block = {spacing.100}', rootTokens['padding-block'] === '{spacing.100}');
check('root border-radius = {corner-radius.100}', rootTokens['border-radius'] === '{corner-radius.100}');
check('hover state = {bg.brand.hover}', rootStates.hover?.['background-color'] === '{bg.brand.hover}');
check('active state (pressed promoted) = {bg.brand.pressed}', rootStates.active?.['background-color'] === '{bg.brand.pressed}');
check('disabled state = {bg.disabled}', rootStates.disabled?.['background-color'] === '{bg.disabled}');
check('focus-visible outline-color = {border.focus}', rootStates['focus-visible']?.['outline-color'] === '{border.focus}');
check('label color = {text.inverse-primary}', (c.anatomy.root.parts?.Button?.tokens ?? {})['color'] === '{text.inverse-primary}');

// ---------------------------------------------------------------------------
// 4. Axis correlation by VALUE — padding-inline + height carried per size
// ---------------------------------------------------------------------------

console.log('\n4. Correlation over the default-state occurrences (value-level, non-injective)');
check('root padding-inline base = {spacing.200} (large/medium)', rootTokens['padding-inline'] === '{spacing.200}');
check('tokensByProp rides the `size` axis', rootByProp.prop === 'size');
check(
  'tokensByProp small override: padding-inline = {spacing.150}',
  rootByProp.map?.small?.['padding-inline'] === '{spacing.150}',
);
check(
  'large/medium share {spacing.200} — a valid (non-injective) function of size, no medium padding override needed',
  rootByProp.map?.medium?.['padding-inline'] === undefined,
);
check('root height base = {component-size.xlarge} (large)', rootTokens['height'] === '{component-size.xlarge}');
check('tokensByProp medium override: height = {component-size.large}', rootByProp.map?.medium?.['height'] === '{component-size.large}');
check('tokensByProp small override: height = {component-size.medium}', rootByProp.map?.small?.['height'] === '{component-size.medium}');
check(
  'the old drift note is GONE (no "bindings differ across variants without correlating" for padding/height)',
  !proposal.notes.some((n) => /padding(Left|Right)|root height/.test(n) && n.includes('without correlating to any variant axis')),
);
check(
  'the carry is NOTED (function of variant axis "size" by VALUE, tokensByProp)',
  proposal.notes.some((n) => n.includes('padding-inline') && n.includes('function of variant axis "size" by VALUE')) &&
    proposal.notes.some((n) => n.startsWith('Button-Brand Primary:root height:') && n.includes('by VALUE')),
);

// ---------------------------------------------------------------------------
// 5. min-height 44 carried
// ---------------------------------------------------------------------------

console.log('\n5. Literal minHeight 44 (the tap-target fact) carried');
const minted = new Map<string, string>();
for (const [p, entry] of flattenTokens((proposal.mintedTokens?.tree ?? {}) as Record<string, unknown>)) {
  minted.set(p, String(entry.value));
}
const minHeightRef = rootTokens['min-height'];
check('root min-height binds a minted px fact', typeof minHeightRef === 'string' && minHeightRef.startsWith('{imported.'));
check(
  `min-height resolves EXACTLY to 44px (got ${minted.get((minHeightRef ?? '{}').slice(1, -1))})`,
  minted.get((minHeightRef ?? '{}').slice(1, -1)) === '44px',
);
check(
  'the min-max-size-unsupported degradation is RETIRED for the literal case (fixture carries zero)',
  Array.isArray(dump._degradations) && (dump._degradations as unknown[]).length === 0,
);
check('zero UNBOUND leftovers (every raw literal minted or refused by name)', proposal.unbound.length === 0);

// ---------------------------------------------------------------------------
// 6. The preview — emitHtml (the playground preview engine), computed values
// ---------------------------------------------------------------------------

console.log('\n6. Preview render (emitHtml — the playground preview surface)');
const contracts = new Map<string, Contract>([[contract.id, contract]]);
for (const s of stubs) contracts.set(s.id, s);
let html = '';
let css = '';
try {
  const emitted = emitHtml(contract, { tokens: layeredInventory, icons: new Map(), contracts });
  html = emitted.html;
  css = emitted.css;
} catch (e) {
  check(`emitHtml green — ${String(e).split('\n')[0]}`, false);
}
check('renders a focusable <button> (not a div)', html.includes('<button'));

/** Computed value of `cssProp` in the rule for `selector` — var() refs are
 *  resolved through the layered values (captured + minted), i.e. what the
 *  browser computes once the preview stylesheet is on the page. */
const values = new Map<string, string>([...capturedValue, ...minted]);
const computed = (selector: string, cssProp: string): string | undefined => {
  // CSS cascade: same-specificity rules for the same selector — the LAST
  // declaration wins (the boilerplate :disabled/:focus-visible rules precede
  // the state-token rules).
  let decl: string | undefined;
  const needle = `${selector} {`;
  for (let at = css.indexOf(needle); at >= 0; at = css.indexOf(needle, at + 1)) {
    const rule = css.slice(at + needle.length, css.indexOf('}', at));
    for (const line of rule.split('\n').map((l) => l.trim())) {
      if (line.startsWith(`${cssProp}:`)) decl = line;
    }
  }
  if (!decl) return undefined;
  const value = decl.slice(cssProp.length + 1).replace(/;$/, '').trim();
  const ref = value.match(/^var\(--([a-z0-9-]+)\)$/i);
  if (!ref) return value;
  // custom-property name → token path (token segments contain hyphens).
  const name = ref[1];
  for (const p of values.keys()) {
    if (p.split('.').join('-') === name) return values.get(p);
  }
  return undefined;
};

const k = '.button-brand-primary';
check(`computed background = #0e61ba from HIS {bg.brand.default} (got ${computed(k, 'background-color')})`, computed(k, 'background-color') === '#0e61ba');
check(`computed padding-inline = 16px (large; got ${computed(k, 'padding-inline')})`, computed(k, 'padding-inline') === '16px');
check(`computed padding-block = 8px (got ${computed(k, 'padding-block')})`, computed(k, 'padding-block') === '8px');
check(`computed height = 48px (large; got ${computed(k, 'height')})`, computed(k, 'height') === '48px');
check(`computed min-height = 44px (got ${computed(k, 'min-height')})`, computed(k, 'min-height') === '44px');
check(`computed border-radius = 8px (got ${computed(k, 'border-radius')})`, computed(k, 'border-radius') === '8px');
check(
  `size=small: computed padding-inline = 12px from {spacing.150} (got ${computed(`${k}--size-small`, 'padding-inline')})`,
  computed(`${k}--size-small`, 'padding-inline') === '12px',
);
check(
  `size=small: computed height = 32px from {component-size.medium} (got ${computed(`${k}--size-small`, 'height')})`,
  computed(`${k}--size-small`, 'height') === '32px',
);
check(
  `size=medium: computed height = 40px from {component-size.large} (got ${computed(`${k}--size-medium`, 'height')})`,
  computed(`${k}--size-medium`, 'height') === '40px',
);
check(
  `:hover computed background = #003e81 from HIS {bg.brand.hover} (got ${computed(`${k}:hover:not(:disabled)`, 'background-color')})`,
  computed(`${k}:hover:not(:disabled)`, 'background-color') === '#003e81',
);
check(
  `:active computed background = #002854 from HIS {bg.brand.pressed} (got ${computed(`${k}:active:not(:disabled)`, 'background-color')})`,
  computed(`${k}:active:not(:disabled)`, 'background-color') === '#002854',
);
check(
  `:disabled computed background = #dfe3eb from HIS {bg.disabled} (got ${computed(`${k}:disabled`, 'background-color')})`,
  computed(`${k}:disabled`, 'background-color') === '#dfe3eb',
);
check(
  `:focus-visible computed outline-color = #0e61ba from HIS {border.focus} (got ${computed(`${k}:focus-visible`, 'outline-color')})`,
  computed(`${k}:focus-visible`, 'outline-color') === '#0e61ba',
);
check(
  `:focus-visible computed outline-width = 2px (drawn Focus ring stroke; got ${computed(`${k}:focus-visible`, 'outline-width')})`,
  computed(`${k}:focus-visible`, 'outline-width') === '2px',
);
check(
  'the :focus-visible boilerplate ships (outline-style solid + offset — the ring shows on Tab)',
  css.includes(`${k}:focus-visible`) && css.includes('outline-style: solid'),
);
check(
  `label computed color = #fcfeff from HIS {text.inverse-primary} (got ${computed(`${k}__Button`, 'color')})`,
  computed(`${k}__Button`, 'color') === '#fcfeff',
);

// emitReact sanity on the same layered inventory (the code surface).
let tsx = '';
try {
  tsx = emitReact(contract, { tokens: layeredInventory, icons: new Map(), contracts }).tsx;
} catch (e) {
  check(`emitReact green — ${String(e).split('\n')[0]}`, false);
}
check('emitReact: <button + native disabled on the same layered inventory', tsx.includes('<button') && tsx.includes('disabled={disabled}'));

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} bridge-send invariant(s) failed`);
  process.exit(1);
}
console.log('\n✔ the owner\'s send holds end to end: captured layer registered + resolved, ZERO refusals, real refs, per-size padding/height, min-height 44, styled focusable preview');
