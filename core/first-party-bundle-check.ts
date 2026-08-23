/**
 * FIRST-PARTY BUNDLE — the README's headline corpus rides `figma bundle`.
 *
 *   npx tsx core/first-party-bundle-check.ts
 *
 * THE DEFECT THIS PINS (verified 2026-08-22, adopter-facing). The 56
 * contracts in contracts/ resolve against tokens/ — a LAYERED token set:
 * primitives + brand.<name> + semantic + light/dark modes (the layering
 * scripts/build-tokens.mjs and core/emit-tokens-css.ts `tokensCssLayers`
 * apply). `figma bundle --tokens` took only a flat <base[,minted]> plus
 * `--modes light,dark`: no brand slot, no semantic slot, and a mode-only
 * token was an orphan. The CLI printed ✔ (51 contracts; 5 layout stubs are
 * refused as drawable-empty) and inside the plugin 34 of the 51 refused
 * with "Cannot resolve token" — ONE PER PASTE, because planGenerate returned
 * at the first compile refusal.
 *
 * What this check holds, building the bundle the way an adopter would
 * (`figma bundle <contracts> --tokens tokens --icons assets/icons`) and
 * running it through the plugin engine over the mock Figma runtime:
 *
 *   1. the whole directory refuses by name, listing EVERY stub at once;
 *   2. the 51 drawable contracts bundle — the tokenSet carries `layers`
 *      (primitives / brands.default+aurora / semantic / light / dark) and
 *      every codeOnlyFacts row compiled (no `refused` row);
 *   3. the plugin plans 51/51 against the bundle's own layers (an engine
 *      baked with NOTHING — the adopter's plugin knows only the paste), the
 *      tokens step is the Primitives / Brand / Semantic upsert, and every
 *      step RUNS in the mock file: every variable a component binds exists
 *      (the runtime's `need()` throws "Missing variable" otherwise), Brand
 *      carries Default + Aurora, Semantic carries Light + Dark, and 51
 *      component sets carry the ds_contracts/contractId marker;
 *   4. the OLD flat shape (base = primitives, minted = semantic, modes =
 *      light/dark) still refuses — but the plugin now names ALL 34 at once,
 *      not the first one; and the CLI, handed the flat spelling that
 *      leaves the brand layer out, refuses by name with the full list
 *      instead of printing ✔.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createPluginEngine } from '../figma-sync/plugin/engine/entry.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import { isDrawableEmptyContract } from '../packages/cli/src/commands/figma.js';
import type { TokenSetPayload, TokenTreeInput } from './index.js';

const ROOT = process.cwd();
const failures: string[] = [];
const check = (label: string, condition: boolean): void => {
  if (!condition) failures.push(label);
  console.log(`  ${condition ? '✔' : '✖'} ${label}`);
};
const tsx = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const cli = (args: string[]) =>
  spawnSync(tsx, ['packages/cli/src/cli.ts', ...args], { cwd: ROOT, encoding: 'utf8' });

const allFiles = readdirSync(path.join(ROOT, 'contracts'))
  .filter((f) => f.endsWith('.contract.json'))
  .sort()
  .map((f) => path.join('contracts', f));
const stubFiles = allFiles.filter((f) => isDrawableEmptyContract(JSON.parse(readFileSync(path.join(ROOT, f), 'utf8'))));
const drawable = allFiles.filter((f) => !stubFiles.includes(f));
const stubIds = stubFiles.map((f) => String((JSON.parse(readFileSync(path.join(ROOT, f), 'utf8')) as { id: string }).id));
check(`contracts/ holds 56 contracts, 5 drawable-empty layout stubs (${stubIds.join(', ')})`, allFiles.length === 56 && stubFiles.length === 5 && drawable.length === 51);

const EMPTY_BAKED: TokenTreeInput = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const flattenDtcg = (node: Record<string, unknown>, prefix: string[] = [], out: Record<string, unknown> = {}): Record<string, unknown> => {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('$')) continue;
    if (v && typeof v === 'object' && '$value' in (v as object)) out[[...prefix, k].join('.')] = v;
    else if (v && typeof v === 'object') flattenDtcg(v as Record<string, unknown>, [...prefix, k], out);
  }
  return out;
};
const readJson = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;

const dir = mkdtempSync(path.join(tmpdir(), 'first-party-bundle-'));
try {
  // --- 1. the whole directory: every stub named in ONE refusal ------------
  {
    const r = cli(['figma', 'bundle', 'contracts', '--tokens', 'tokens', '--icons', 'assets/icons', '--out', path.join(dir, 'all.json')]);
    const err = r.stderr + r.stdout;
    check('`figma bundle contracts --tokens tokens` refuses (non-zero exit) — layout stubs are drawable-empty', r.status !== 0);
    check('the refusal is drawable-empty and names ALL five stubs at once', /drawable-empty/.test(err) && stubIds.every((id) => err.includes(id)));
  }

  // --- 2. the adopter's bundle: 51 contracts over the layered tokens/ -----
  const bundlePath = path.join(dir, 'first-party.bundle.json');
  const build = cli(['figma', 'bundle', ...drawable, '--tokens', 'tokens', '--icons', 'assets/icons', '--name', 'DS Contracts', '--out', bundlePath]);
  check(`figma bundle <51 contracts> --tokens tokens --icons assets/icons exits 0 (${build.status})`, build.status === 0);
  if (build.status !== 0) console.log((build.stderr + build.stdout).split('\n').slice(0, 12).map((l) => `      ${l}`).join('\n'));
  check('the CLI line says the set is layered, with Primitives / Brand / Semantic collections', /layered:/.test(build.stdout) && /Primitives \/ Brand \/ Semantic/.test(build.stdout));
  const expect = {
    primitives: Object.keys(flattenDtcg(readJson('tokens/primitives.tokens.json'))).length,
    semantic: Object.keys(flattenDtcg(readJson('tokens/semantic.tokens.json'))).length,
    light: Object.keys(flattenDtcg(readJson('tokens/modes/semantic.light.tokens.json'))).length,
    dark: Object.keys(flattenDtcg(readJson('tokens/modes/semantic.dark.tokens.json'))).length,
    brand: Object.keys(flattenDtcg(readJson('tokens/modes/brand.default.tokens.json'))).length,
  };
  const plugin = createPluginEngine({ tokens: EMPTY_BAKED, contracts: [], icons: {} });
  const drawableRaw = drawable.map((f) => readJson(f));
  // The icon assets the bundle would carry (--icons assets/icons), so stage 4
  // isolates the TOKEN refusals — an icon refusal is a different door.
  const iconAssets: Record<string, string> = Object.fromEntries(
    readdirSync(path.join(ROOT, 'assets', 'icons'))
      .filter((f) => f.endsWith('.svg'))
      .sort()
      .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(ROOT, 'assets', 'icons', f), 'utf8').trim()]),
  );
  if (build.status !== 0) {
    // RED on the unfixed tree: nothing downstream can run — name it.
    for (const label of [
      'bundle carries 51 contracts',
      'tokenSet carries `layers`',
      'the plugin plans 51/51',
      'every plan step RUNS in the mock file',
      '51/51 component sets carry the ds_contracts/contractId marker',
    ]) check(`${label} — NOT REACHED: the CLI refused the layered --tokens spelling`, false);
  } else {
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8')) as {
    tokenSet: TokenSetPayload;
    icons?: Record<string, string>;
    contracts: Array<{ id: string }>;
    codeOnlyFacts?: Array<{ contractId: string; name: string; facts?: unknown[]; refused?: string }>;
  };
  check('bundle carries 51 contracts', bundle.contracts.length === 51);
  const layers = bundle.tokenSet.layers;
  check('tokenSet carries `layers` — primitives, semantic, light, dark, brands', layers !== undefined && ['primitives', 'semantic', 'light', 'dark', 'brands'].every((k) => k in (layers ?? {})));
  check('layers.brands carries default AND aurora (the brand dimension survives the bundle)', !!layers && Object.keys(layers.brands).sort().join(',') === 'aurora,default');
  const got = layers
    ? {
        primitives: Object.keys(flattenDtcg(layers.primitives)).length,
        semantic: Object.keys(flattenDtcg(layers.semantic)).length,
        light: Object.keys(flattenDtcg(layers.light)).length,
        dark: Object.keys(flattenDtcg(layers.dark)).length,
        brand: Object.keys(flattenDtcg(layers.brands.default ?? {})).length,
      }
    : null;
  check(`every layer lands whole — ${JSON.stringify(expect)}`, JSON.stringify(got) === JSON.stringify(expect));
  const refusedRows = (bundle.codeOnlyFacts ?? []).filter((r) => r.refused !== undefined);
  check('codeOnlyFacts has 51 rows and NONE is refused (every contract compiled at bundle time)', (bundle.codeOnlyFacts ?? []).length === 51 && refusedRows.length === 0);
  check('a second build is byte-identical', (() => {
    const again = path.join(dir, 'again.json');
    execFileSync(tsx, ['packages/cli/src/cli.ts', 'figma', 'bundle', ...drawable, '--tokens', 'tokens', '--icons', 'assets/icons', '--name', 'DS Contracts', '--out', again], { cwd: ROOT, stdio: 'pipe' });
    return readFileSync(again, 'utf8') === readFileSync(bundlePath, 'utf8');
  })());

  // --- 3. the plugin, baked with NOTHING: 51/51 plan, every step runs -----
  const parsed = plugin.parseIncomingText(readFileSync(bundlePath, 'utf8'));
  check('the plugin parses the bundle (tokenSet with layers accepted)', parsed.ok && parsed.kind === 'bundle' && parsed.tokenSet !== null);
  if (!parsed.ok) throw new Error(parsed.issue.headline);
  const plan = plugin.planGenerate(parsed.contracts, { withTokens: true, fileKey: '', tokenSet: parsed.tokenSet, icons: parsed.icons });
  check(`the plugin plans 51/51 (${plan.ok ? `${plan.steps.filter((s) => s.kind === 'component').length} component steps` : `${plan.issues.length} issue(s): ${plan.issues.slice(0, 3).map((i) => i.headline).join(' | ')}…`})`, plan.ok && plan.steps.filter((s) => s.kind === 'component').length === 51);
  if (!plan.ok) throw new Error('plan refused');
  const tokenSteps = plan.steps.filter((s) => s.kind === 'tokens');
  check('exactly one tokens step, and it is the Primitives / Brand / Semantic upsert (not a flat named collection)', tokenSteps.length === 1 && /Primitives \/ Brand \/ Semantic/.test(tokenSteps[0].title) && tokenSteps[0].code.includes("createVariableCollection('Semantic')"));

  const mock = createFigmaMock() as unknown as {
    figma: unknown;
    root: { findAll: (p: (n: MockNode) => boolean) => MockNode[] };
    variables: Array<{ name: string; variableCollectionId: string }>;
    collections: Array<{ id: string; name: string; modes: Array<{ name: string }> }>;
  };
  interface MockNode { type: string; getSharedPluginData: (ns: string, k: string) => string }
  const ctx = vm.createContext({ figma: mock.figma, console: { log() {}, warn() {}, error() {} } });
  const run = (code: string): Promise<unknown> => vm.runInContext(`(async () => {\n${code}\n})()`, ctx, { timeout: 300_000 }) as Promise<unknown>;
  const stepFailures: string[] = [];
  for (const step of plan.steps) {
    try {
      await run(step.code);
    } catch (e) {
      stepFailures.push(`${step.title}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  check(`every plan step RUNS in the mock file — no "Missing variable", no throw (${stepFailures.length} failed)`, stepFailures.length === 0);
  for (const f of stepFailures.slice(0, 10)) console.log(`      ${f}`);
  const colByName = new Map(mock.collections.map((c) => [c.name, c]));
  const modesOf = (name: string) => (colByName.get(name)?.modes ?? []).map((m) => m.name).sort().join(',');
  check(`Brand collection carries Aurora + Default modes (${modesOf('Brand')})`, modesOf('Brand') === 'Aurora,Default');
  check(`Semantic collection carries Dark + Light modes (${modesOf('Semantic')})`, modesOf('Semantic') === 'Dark,Light');
  const varsIn = (name: string) => mock.variables.filter((v) => v.variableCollectionId === colByName.get(name)?.id).length;
  check(`Primitives / Brand / Semantic variable counts equal the layers (${varsIn('Primitives')} / ${varsIn('Brand')} / ${varsIn('Semantic')})`, varsIn('Primitives') === expect.primitives && varsIn('Brand') === expect.brand && varsIn('Semantic') === expect.semantic + expect.light);
  const built = new Set(
    mock.root
      .findAll((n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.getSharedPluginData('ds_contracts', 'contractId') !== '')
      .map((n) => n.getSharedPluginData('ds_contracts', 'contractId')),
  );
  const missing = bundle.contracts.map((c) => c.id).filter((id) => !built.has(id));
  check(`51/51 component sets carry the ds_contracts/contractId marker (${missing.length} missing${missing.length ? `: ${missing.join(', ')}` : ''})`, missing.length === 0);
  }

  // --- 4. the OLD flat shape still refuses — now ALL at once --------------
  {
    const flat: TokenSetPayload = {
      name: 'Tokens',
      base: flattenDtcg(readJson('tokens/primitives.tokens.json')),
      minted: readJson('tokens/semantic.tokens.json'),
      modes: {
        light: flattenDtcg(readJson('tokens/modes/semantic.light.tokens.json')),
        dark: flattenDtcg(readJson('tokens/modes/semantic.dark.tokens.json')),
      },
    };
    const old = plugin.planGenerate(drawableRaw, { withTokens: true, fileKey: '', tokenSet: flat, icons: iconAssets });
    const refusals = old.ok ? [] : old.issues.filter((i) => /refused: Cannot resolve token/.test(i.headline));
    check(`the flat base+minted+modes shape (no brand layer) refuses ${old.ok ? 0 : refusals.length} contract(s) in ONE plan${!old.ok && refusals.length === 1 ? ` — ONE PER PASTE: ${old.issues[0]?.headline}` : ''} — pinned 34 at once`, !old.ok && refusals.length === 34);
    check('the refusal is headed by the count so the list reads as one receipt', !old.ok && /^34 of 51 contract\(s\) refused/.test(old.issues[0]?.headline ?? ''));
    const flatCli = cli([
      'figma', 'bundle', ...drawable,
      '--tokens', 'tokens/primitives.tokens.json,tokens/semantic.tokens.json',
      '--modes', 'tokens/modes/semantic.light.tokens.json,tokens/modes/semantic.dark.tokens.json',
      '--icons', 'assets/icons', '--out', path.join(dir, 'flat.json'),
    ]);
    const text = flatCli.stderr + flatCli.stdout;
    check(`the CLI, handed primitives+semantic+modes WITHOUT the brand layer, refuses (exit ${flatCli.status}) instead of printing ✔`, flatCli.status !== 0 && !/✔ Bundle written/.test(text));
    check('…and the refusal names the unresolved brand-layer token AND the empty brand slot (the token set itself refuses before any contract compiles)', /Cannot resolve token "font\.control\./.test(text) && /EMPTY SLOTS: brand\.default/.test(text));
    // With the brand layer present but the MODES left out, the token set
    // compiles and it is the CONTRACTS that refuse — every one of them named.
    const noModes = cli([
      'figma', 'bundle', ...drawable,
      '--tokens', 'tokens/primitives.tokens.json,tokens/semantic.tokens.json,tokens/modes/brand.default.tokens.json,tokens/modes/brand.aurora.tokens.json',
      '--icons', 'assets/icons', '--out', path.join(dir, 'nomodes.json'),
    ]);
    const nm = noModes.stderr + noModes.stdout;
    const named = (nm.match(/^\s+- .+ \(ds\.[a-z-]+, .+\.contract\.json\): /gm) ?? []).length;
    const counted = /(\d+) of 51 contract\(s\) do not compile/.exec(nm);
    check(`…and without the mode layers the CLI refuses (exit ${noModes.status}) listing EVERY refusing contract by name (${named} named, header says ${counted?.[1] ?? '?'}) with the empty light/dark slots`, noModes.status !== 0 && counted !== null && named === Number(counted[1]) && named > 1 && /EMPTY SLOTS: light, dark/.test(nm));
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n✘ first-party-bundle: ${failures.length} pin(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✔ first-party-bundle: the 51 first-party contracts ride `figma bundle --tokens tokens` and build 51/51 in the plugin over the layered token set');
