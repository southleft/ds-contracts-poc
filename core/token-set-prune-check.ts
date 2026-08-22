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
 *   npx tsx core/token-set-prune-check.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { emitTokenSetScript } from './token-set.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';

// The mock is untyped JS; this is the slice of it the check touches.
interface MockVariable {
  id: string;
  name: string;
  setValueForMode(modeId: string, value: unknown): void;
}
interface MockCollection {
  id: string;
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
}
interface PruneResult {
  pruned: number;
  leftovers: string[];
  pruneSkipped: string | null;
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

console.log('\nFirst-party tokens script');
const firstParty = readFileSync(path.join(process.cwd(), 'figma-sync', '01-tokens.js'), 'utf8');
check(
  'first-party tokens script shares the same opt-in prune runtime',
  firstParty.includes('FC-APPLY-TOKENS-NOT-PRUNED') &&
    firstParty.includes('owned.set(prim.id') &&
    firstParty.includes('globalThis.DS_PRUNE_TOKENS === true') &&
    firstParty.includes('if (willPrune) v.remove()'),
);

if (failures.length > 0) {
  console.error(`\n✘ token-set-prune: ${failures.length} pin(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✔ token-set-prune: prune is opt-in (DS_PRUNE_TOKENS), names leftovers by default, keeps node/alias/style-bound when on');
