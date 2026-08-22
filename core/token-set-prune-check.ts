/**
 * FC-APPLY-TOKENS-NOT-PRUNED — the token prune is OPT-IN and honest.
 *
 *   Door 1 (default, no flag): apply upserts, removes NOTHING, and NAMES the
 *     leftovers in the owned collection(s) in the result (`leftovers`),
 *     `pruned` stays 0.
 *   Door 2 (`globalThis.DS_PRUNE_TOKENS === true`): removes unreferenced
 *     leftovers in the owned collection(s) only. Node-bound, alias-target and
 *     STYLE-bound leftovers stay; other collections are untouched.
 *   Door 3 (flag on, runtime lacks a style reader): prune is skipped entirely
 *     and `pruneSkipped` names the missing reader — never a silent delete.
 *
 * The repo mock (scripts/plugin-engine-mock-figma.mjs) exposes text styles
 * only; paint/effect/grid readers are stubbed here for Door 2 and left
 * absent for Door 3. Not this check's file to extend.
 *
 * THREE MORE DOORS on the same runtime (all pinned below, RED before the fix):
 *   Values   — a DTCG object-form / array `$value` (shadow, typography) has no
 *              Figma variable shape. It used to `String()` to "[object Object]"
 *              and ship as a STRING variable that draws nothing. Now it is
 *              refused BY NAME at bundle time (`unsupportedTokenValues`, the
 *              CLI) and SKIPPED by name in the runtime (`skippedValues`).
 *   Modes    — a Dark mode is added ONLY when the tokenSet carries dark values
 *              (no more cloned Dark == Light); an `addMode` the plan refuses
 *              (Starter: one mode per collection) is NAMED in `modeSkipped`,
 *              not thrown — the Light values still land.
 *   Edits    — a re-paste never silently reverts a designer's edit to a
 *              variable VALUE. What each apply wrote is recorded per mode
 *              (shared plugin data ds_contracts/appliedValues); a canvas value
 *              that is neither the bundle's nor the last applied is NAMED in
 *              `variableDrift` and KEPT unless `globalThis.DS_OVERWRITE_TOKENS
 *              === true` (same door style as DS_PRUNE_TOKENS / DS_CREATE_ONLY).
 *
 *   npx tsx core/token-set-prune-check.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { emitTokenSetScript, unsupportedTokenValues, type TokenSetPayload } from './token-set.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';

// The mock is untyped JS; this is the slice of it the check touches.
interface MockVariable {
  id: string;
  name: string;
  variableCollectionId: string;
  resolvedType: string;
  valuesByMode: Record<string, unknown>;
  setValueForMode(modeId: string, value: unknown): void;
}
interface MockCollection {
  id: string;
  name: string;
  modes: { modeId: string; name: string }[];
}
interface MockNode {
  appendChild(node: MockNode): void;
  setBoundVariable(field: string, variable: MockVariable): void;
}
interface MockTextStyle {
  id: string;
  boundVariables?: Record<string, { type: 'VARIABLE_ALIAS'; id: string }>;
}
interface MockFigma {
  createFrame(): MockNode;
  createTextStyle(): MockTextStyle;
  getLocalTextStylesAsync(): Promise<MockTextStyle[]>;
  getLocalPaintStylesAsync?: () => Promise<unknown[]>;
  getLocalEffectStylesAsync?: () => Promise<unknown[]>;
  getLocalGridStylesAsync?: () => Promise<unknown[]>;
  variables: {
    createVariableCollection(name: string): MockCollection;
    createVariable(name: string, collection: MockCollection, type: string): MockVariable;
  };
}
interface MockHandle {
  figma: MockFigma;
  firstPage: MockNode;
  variables: MockVariable[];
  collections: MockCollection[];
}
interface PruneResult {
  pruned: number;
  leftovers: string[];
  pruneSkipped: string | null;
  skippedValues: string[];
  modeSkipped: string | null;
  modes: string[];
  variableDrift: { name: string; mode: string; canvas: string | null; bundle: string; applied: string | null }[];
  driftOverwritten: boolean;
}

const failures: string[] = [];
const check = (label: string, condition: boolean): void => {
  if (!condition) failures.push(label);
  console.log(`  ${condition ? '✔' : '✖'} ${label}`);
};

const script = emitTokenSetScript(
  {
    name: 'Tokens',
    base: { 'color-bg': { $type: 'color', $value: '#111111' } },
    minted: {},
  },
  null,
);

console.log('Script text');
check('token script names FC-APPLY-TOKENS-NOT-PRUNED', script.includes('FC-APPLY-TOKENS-NOT-PRUNED'));
check('token script gates removal on globalThis.DS_PRUNE_TOKENS === true', script.includes('globalThis.DS_PRUNE_TOKENS === true'));
check('token script only walks owned collections', script.includes('owned.get(v.variableCollectionId)'));
check('token script keeps node-bound leftovers', script.includes('referenced.has(v.id)'));
check('token script keeps foreign alias targets', script.includes('aliasTargets.has(v.id)'));
check(
  'token script walks paint/text/effect/grid style bindings',
  ['getLocalPaintStylesAsync', 'getLocalTextStylesAsync', 'getLocalEffectStylesAsync', 'getLocalGridStylesAsync'].every((k) => script.includes(k)),
);
check('token script removes only behind the flag', script.includes('if (willPrune) v.remove()'));
check('token script returns leftovers by name', script.includes('leftovers, pruneSkipped'));

/** A file with one owned `Tokens` collection holding: an unreferenced alias
 *  chain (leaf → mid → gone), a node-bound leftover, a leftover a foreign
 *  collection aliases, a leftover a local TEXT STYLE binds; plus a foreign
 *  collection with its own leftover. */
function scenario(): MockHandle {
  const handle = createFigmaMock() as unknown as MockHandle;
  const { figma, firstPage } = handle;
  const tokensCol = figma.variables.createVariableCollection('Tokens');
  const light = tokensCol.modes[0].modeId;

  const gone = figma.variables.createVariable('imported/text-input/gone', tokensCol, 'FLOAT');
  gone.setValueForMode(light, 1);
  const mid = figma.variables.createVariable('imported/text-input/mid', tokensCol, 'FLOAT');
  mid.setValueForMode(light, { type: 'VARIABLE_ALIAS', id: gone.id });
  const leaf = figma.variables.createVariable('imported/text-input/leaf', tokensCol, 'FLOAT');
  leaf.setValueForMode(light, { type: 'VARIABLE_ALIAS', id: mid.id });

  const bound = figma.variables.createVariable('imported/spinner/bound', tokensCol, 'FLOAT');
  bound.setValueForMode(light, 0.5);
  const frame = figma.createFrame();
  firstPage.appendChild(frame);
  frame.setBoundVariable('opacity', bound);

  const aliased = figma.variables.createVariable('imported/spinner/aliased', tokensCol, 'FLOAT');
  aliased.setValueForMode(light, 2);
  const mui = figma.variables.createVariableCollection('MUI');
  const foreign = figma.variables.createVariable('mui/points-at-leftover', mui, 'FLOAT');
  foreign.setValueForMode(mui.modes[0].modeId, { type: 'VARIABLE_ALIAS', id: aliased.id });
  const other = figma.variables.createVariable('imported/text-input/other-col', mui, 'FLOAT');
  other.setValueForMode(mui.modes[0].modeId, 9);

  // A designer's text style bound to a leftover — the audit's case: no scene
  // node references it, only the style does.
  const styleBound = figma.variables.createVariable('imported/heading/style-bound', tokensCol, 'FLOAT');
  styleBound.setValueForMode(light, 24);
  const style = figma.createTextStyle();
  style.boundVariables = { fontSize: { type: 'VARIABLE_ALIAS', id: styleBound.id } };

  return handle;
}

const CHAIN = ['imported/text-input/leaf', 'imported/text-input/mid', 'imported/text-input/gone'];
const KEPT = ['imported/spinner/bound', 'imported/spinner/aliased', 'imported/heading/style-bound', 'imported/text-input/other-col', 'color-bg'];

const run = new Function('figma', 'return (async () => {\n' + script + '\n})()') as (figma: unknown) => Promise<PruneResult>;
const stubMissingStyleReaders = (figma: MockFigma): void => {
  figma.getLocalPaintStylesAsync = async () => [];
  figma.getLocalEffectStylesAsync = async () => [];
  figma.getLocalGridStylesAsync = async () => [];
};
const g = globalThis as { DS_PRUNE_TOKENS?: unknown };

console.log('\nDoor 1 — default (no DS_PRUNE_TOKENS): nothing removed, leftovers named');
{
  delete g.DS_PRUNE_TOKENS;
  const h = scenario();
  stubMissingStyleReaders(h.figma);
  const result = await run(h.figma);
  const names = new Set(h.variables.map((v) => v.name));
  check('default: every leftover still exists', [...CHAIN, ...KEPT].every((n) => names.has(n)));
  check('default: pruned is 0', result.pruned === 0);
  check('default: leftovers names the unreferenced chain, in unwind order', JSON.stringify(result.leftovers) === JSON.stringify(CHAIN));
  check('default: node-bound, alias-target and style-bound are NOT named as leftovers', !result.leftovers.some((n) => KEPT.includes(n)));
  check('default: pruneSkipped is null', result.pruneSkipped === null);
}

console.log('\nDoor 2 — DS_PRUNE_TOKENS = true with all four style readers: removes unreferenced only');
{
  g.DS_PRUNE_TOKENS = true;
  const h = scenario();
  stubMissingStyleReaders(h.figma);
  const result = await run(h.figma);
  delete g.DS_PRUNE_TOKENS;
  const names = new Set(h.variables.map((v) => v.name));
  check('flag on: unreferenced leftover chain is pruned', CHAIN.every((n) => !names.has(n)));
  check('flag on: node-bound leftover stays', names.has('imported/spinner/bound'));
  check('flag on: foreign-aliased leftover stays', names.has('imported/spinner/aliased'));
  check('flag on: text-style-bound leftover stays', names.has('imported/heading/style-bound'));
  check('flag on: other-collection leftover stays', names.has('imported/text-input/other-col'));
  check('flag on: bundle token is upserted', names.has('color-bg'));
  check('flag on: pruned count matches the unreferenced chain', result.pruned === 3);
  check('flag on: leftovers names what was removed', JSON.stringify(result.leftovers) === JSON.stringify(CHAIN));
  check('flag on: pruneSkipped is null', result.pruneSkipped === null);
}

console.log('\nDoor 3 — DS_PRUNE_TOKENS = true but the runtime lacks paint/effect/grid readers: prune skipped, by name');
{
  g.DS_PRUNE_TOKENS = true;
  const h = scenario(); // the repo mock as-is: text styles only
  const result = await run(h.figma);
  delete g.DS_PRUNE_TOKENS;
  const names = new Set(h.variables.map((v) => v.name));
  check('guard: nothing removed', [...CHAIN, ...KEPT].every((n) => names.has(n)));
  check('guard: pruned is 0', result.pruned === 0);
  check(
    'guard: pruneSkipped names the missing readers',
    typeof result.pruneSkipped === 'string' &&
      ['getLocalPaintStylesAsync', 'getLocalEffectStylesAsync', 'getLocalGridStylesAsync'].every((k) => result.pruneSkipped!.includes(k)) &&
      !result.pruneSkipped.includes('getLocalTextStylesAsync'),
  );
  check('guard: leftovers still named', JSON.stringify(result.leftovers) === JSON.stringify(CHAIN));
}

// ---------------------------------------------------------------------------
// Door: VALUES — composite $values never ship as "[object Object]"
// ---------------------------------------------------------------------------
const runScript = (text: string) =>
  new Function('figma', 'return (async () => {\n' + text + '\n})()') as (figma: unknown) => Promise<PruneResult>;
const g2 = globalThis as { DS_OVERWRITE_TOKENS?: unknown };
const SHADOW = { color: '#00000040', offsetX: '0px', offsetY: '1px', blur: '2px', spread: '0px' };

console.log('\nDoor: VALUES — object-form / array $value is refused by name, never stringified');
{
  const composite: TokenSetPayload = {
    name: 'Composite',
    base: {
      'color.bg': { $type: 'color', $value: '#ffffff' },
      'shadow.sm': { $type: 'shadow', $value: SHADOW },
      'shadow.md': { $type: 'shadow', $value: [SHADOW, { ...SHADOW, offsetY: '4px' }] },
      'flag.on': { $type: 'boolean', $value: true },
    },
    modes: { dark: { 'color.bg': { $value: '#000000' }, 'shadow.sm': { $value: { ...SHADOW, color: '#ffffff40' } } } },
    minted: { imported: { card: { shadow: { $value: SHADOW }, radius: { $value: '8px' } } } },
  };
  const refused = unsupportedTokenValues(composite);
  check(
    'bundle time: unsupportedTokenValues names every composite with its shape',
    refused.length === 4 &&
      refused.some((r) => r.startsWith('shadow/sm: object-form {color, offsetX')) &&
      refused.some((r) => r.startsWith('shadow/md: array[2]')) &&
      refused.some((r) => r === 'flag/on: boolean') &&
      refused.some((r) => r.startsWith('imported/card/shadow: object-form')),
  );
  const text = emitTokenSetScript(composite, null);
  check('script text never carries "[object Object]"', !text.includes('[object Object]'));
  check('script header names the skipped composites', text.includes('SKIPPED by name') && text.includes('shadow/sm: object-form'));
  const h = createFigmaMock() as unknown as MockHandle;
  const result = await runScript(text)(h.figma);
  const byName = new Map(h.variables.map((v) => [v.name, v]));
  check('runtime: result.skippedValues names the four composites', result.skippedValues.length === 4 && result.skippedValues.some((x) => x.startsWith('shadow/sm:')));
  check('runtime: no composite became a variable', !byName.has('shadow/sm') && !byName.has('shadow/md') && !byName.has('flag/on') && !byName.has('imported/card/shadow'));
  check(
    'runtime: no variable value is "[object Object]"',
    h.variables.every((v) => Object.values(v.valuesByMode).every((x) => typeof x !== 'string' || !x.includes('[object Object]'))),
  );
  check('runtime: the scalar siblings still land (color/bg COLOR, imported/card/radius FLOAT 8)', byName.get('color/bg')?.resolvedType === 'COLOR' && byName.get('imported/card/radius')?.resolvedType === 'FLOAT');
}

// ---------------------------------------------------------------------------
// Door: MODES — Dark only when the set carries dark values; addMode refusal named
// ---------------------------------------------------------------------------
console.log('\nDoor: MODES — Dark is a fact of the tokenSet, and a plan that refuses it is named');
{
  const modeless: TokenSetPayload = { name: 'Modeless', base: { 'color.bg': { $type: 'color', $value: '#111111' }, 'space.x': { $type: 'dimension', $value: '4px' } } };
  const h = createFigmaMock() as unknown as MockHandle;
  const result = await runScript(emitTokenSetScript(modeless, null))(h.figma);
  const col = h.collections.find((c) => c.name === 'Modeless')!;
  check('modeless set: ONE mode, named "Value" — no cloned Dark', col.modes.length === 1 && col.modes[0].name === 'Value' && JSON.stringify(result.modes) === '["Value"]');
  check('modeless set: modeSkipped is null (nothing was attempted)', result.modeSkipped === null);

  const twoMode: TokenSetPayload = {
    name: 'TwoMode',
    base: { 'color.bg': { $type: 'color', $value: '#111111' } },
    modes: { light: { 'color.bg': { $value: '#111111' } }, dark: { 'color.bg': { $value: '#eeeeee' } } },
  };
  const h2 = createFigmaMock() as unknown as MockHandle;
  const r2 = await runScript(emitTokenSetScript(twoMode, null))(h2.figma);
  const col2 = h2.collections.find((c) => c.name === 'TwoMode')!;
  const bg2 = h2.variables.find((v) => v.name === 'color/bg')!;
  const darkId2 = col2.modes.find((m) => m.name === 'Dark')?.modeId ?? '';
  check('dark-carrying set: Light + Dark, dark value written', JSON.stringify(r2.modes) === '["Light","Dark"]' && (bg2.valuesByMode[darkId2] as { r: number }).r > 0.9);

  // Starter plan: addMode throws. The apply must not — it names the limit.
  const h3 = createFigmaMock({ modeLimit: 1 }) as unknown as MockHandle;
  let threw: string | null = null;
  let r3: PruneResult | null = null;
  try {
    r3 = await runScript(emitTokenSetScript(twoMode, null))(h3.figma);
  } catch (e) {
    threw = e instanceof Error ? e.message : String(e);
  }
  const col3 = h3.collections.find((c) => c.name === 'TwoMode');
  const bg3 = h3.variables.find((v) => v.name === 'color/bg');
  check(`starter plan: the apply does not throw (${threw ?? 'ok'})`, threw === null);
  check(
    'starter plan: modeSkipped names the Dark mode, the plan limit, and that dark values were not written',
    typeof r3?.modeSkipped === 'string' && r3.modeSkipped.includes('Dark mode not added') && r3.modeSkipped.includes('Limited to 1 modes') && r3.modeSkipped.includes('NOT written'),
  );
  check('starter plan: the Light value still lands in the single mode', col3?.modes.length === 1 && bg3 !== undefined && Object.keys(bg3.valuesByMode).length === 1);
}

// ---------------------------------------------------------------------------
// Door: EDITS — a re-paste keeps designer-edited values, by name
// ---------------------------------------------------------------------------
console.log('\nDoor: EDITS — designer-edited variable values are named and kept unless DS_OVERWRITE_TOKENS');
{
  const setV1: TokenSetPayload = {
    name: 'Edits',
    base: { 'color.bg': { $type: 'color', $value: '#111111' }, 'space.x': { $type: 'dimension', $value: '4px' }, 'font.stack': { $type: 'fontFamily', $value: 'Inter' } },
    minted: { imported: { card: { bg: { $value: '{color.bg}' } } } },
  };
  const setV2: TokenSetPayload = {
    name: 'Edits',
    base: { 'color.bg': { $type: 'color', $value: '#222222' }, 'space.x': { $type: 'dimension', $value: '8px' }, 'font.stack': { $type: 'fontFamily', $value: 'Inter' } },
    minted: { imported: { card: { bg: { $value: '{space.x}' } } } },
  };
  delete g2.DS_OVERWRITE_TOKENS;
  const h = createFigmaMock() as unknown as MockHandle;
  const first = await runScript(emitTokenSetScript(setV1, null))(h.figma);
  check('first apply: no drift named', first.variableDrift.length === 0);
  const again = await runScript(emitTokenSetScript(setV1, null))(h.figma);
  check('identical re-paste: no drift named', again.variableDrift.length === 0);

  const col = h.collections.find((c) => c.name === 'Edits')!;
  const modeId = col.modes[0].modeId;
  const bg = h.variables.find((v) => v.name === 'color/bg')!;
  const spaceX = h.variables.find((v) => v.name === 'space/x')!;
  const cardBg = h.variables.find((v) => v.name === 'imported/card/bg')!;
  const fontStack = h.variables.find((v) => v.name === 'font/stack')!;
  // The designer edits color/bg to red and re-points the minted alias; the
  // bundle moves color/bg, space/x and the alias target.
  bg.setValueForMode(modeId, { r: 1, g: 0, b: 0, a: 1 });
  cardBg.setValueForMode(modeId, { type: 'VARIABLE_ALIAS', id: fontStack.id });
  const second = await runScript(emitTokenSetScript(setV2, null))(h.figma);
  const bgVal = bg.valuesByMode[modeId] as { r: number; g: number; b: number };
  const drift = second.variableDrift;
  check(
    'moved bundle + designer edit: variableDrift names color/bg [Value] with canvas and bundle spellings',
    drift.some((d) => d.name === 'color/bg' && d.mode === 'Value' && d.canvas === 'rgba(1,0,0,1)' && d.bundle?.startsWith('rgba(0.1333')),
  );
  check('moved bundle + designer edit: the re-pointed alias is named too', drift.some((d) => d.name === 'imported/card/bg' && d.canvas === 'alias:font/stack' && d.bundle === 'alias:space/x'));
  check('door closed: the designer\'s red stays on the canvas', bgVal.r === 1 && bgVal.g === 0);
  check('door closed: the re-pointed alias stays', (cardBg.valuesByMode[modeId] as { id: string }).id === fontStack.id);
  check('door closed: the untouched variable still follows the bundle (space/x 4 → 8)', spaceX.valuesByMode[modeId] === 8);
  check('door closed: driftOverwritten is false', second.driftOverwritten === false);
  check('door closed: exactly the two edited values are named, nothing else', drift.length === 2);

  g2.DS_OVERWRITE_TOKENS = true;
  const third = await runScript(emitTokenSetScript(setV2, null))(h.figma);
  delete g2.DS_OVERWRITE_TOKENS;
  const bgVal3 = bg.valuesByMode[modeId] as { r: number };
  check('door open (DS_OVERWRITE_TOKENS): the bundle wins and the drift is STILL named', third.driftOverwritten === true && third.variableDrift.length === 2 && Math.abs(bgVal3.r - 0x22 / 255) < 1e-6);
  check('door open: the alias follows the bundle', (cardBg.valuesByMode[modeId] as { id: string }).id === spaceX.id);
  const fourth = await runScript(emitTokenSetScript(setV2, null))(h.figma);
  check('after the overwrite: a re-paste names nothing (the record caught up)', fourth.variableDrift.length === 0);

  // A variable that predates the record (no appliedValues) and differs from
  // the bundle cannot be proven ours — named, kept; never a silent revert.
  const legacy = createFigmaMock() as unknown as MockHandle;
  const legacyCol = legacy.figma.variables.createVariableCollection('Edits');
  const legacyVar = legacy.figma.variables.createVariable('color/bg', legacyCol, 'COLOR');
  legacyVar.setValueForMode(legacyCol.modes[0].modeId, { r: 0, g: 1, b: 0, a: 1 });
  const legacyResult = await runScript(emitTokenSetScript(setV1, null))(legacy.figma);
  check(
    'legacy variable (no apply record) that differs from the bundle: named with applied=null and kept',
    legacyResult.variableDrift.length === 1 && legacyResult.variableDrift[0]!.applied === null && (legacyVar.valuesByMode[legacyCol.modes[0].modeId] as { g: number }).g === 1,
  );
}

console.log('\nFirst-party tokens script');
const firstParty = readFileSync(path.join(process.cwd(), 'figma-sync', '01-tokens.js'), 'utf8');
check(
  'first-party tokens script shares the same opt-in prune runtime',
  firstParty.includes('FC-APPLY-TOKENS-NOT-PRUNED') &&
    firstParty.includes('owned.set(prim.id') &&
    firstParty.includes('globalThis.DS_PRUNE_TOKENS === true') &&
    firstParty.includes('if (willPrune) v.remove()'),
);
check(
  'first-party tokens script shares the same value door (DS_OVERWRITE_TOKENS, applyValue on every collection)',
  firstParty.includes('FC-APPLY-TOKENS-KEEP-EDITS') &&
    firstParty.includes('globalThis.DS_OVERWRITE_TOKENS === true') &&
    firstParty.includes("applyValue(v, primModeId, 'Value'") &&
    firstParty.includes("applyValue(v, lightModeId, 'Light'") &&
    !firstParty.includes('v.setValueForMode(primModeId'),
);

if (failures.length > 0) {
  console.error(`\n✘ token-set-prune: ${failures.length} pin(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✔ token-set-prune: prune is opt-in (DS_PRUNE_TOKENS), names leftovers by default, keeps node/alias/style-bound when on; composite $values refused by name; Dark only when carried (addMode refusal named); designer-edited values named and kept unless DS_OVERWRITE_TOKENS');
