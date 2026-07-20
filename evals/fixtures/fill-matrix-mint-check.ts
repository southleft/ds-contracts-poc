/**
 * fill-matrix-mint eval body — live-gauntlet class ① (fill-matrix-depth-drop):
 * a two-axis color matrix whose bound token paths differ in segment depth
 * (CBDS Badge `bg.brand.default` vs `bg.surface-primary`) used to DROP the
 * root fill entirely — Badge diffed 96.85% masked, Chip 98.58%, rendering as
 * bare label text. Replays the committed fixture slice (Badge + Chip + Alert
 * + their variables, verbatim from the banked v1.6 kit dump) through the
 * shipping propose→referee→emit path and pins the fix:
 *
 *   · Badge root fill  → pair-minted   {imported.badge.root.background-color.{type}.{style}}
 *   · Alert root fill  → pair-minted   (two-axis, root)
 *   · Chip  root fill  → TRIPLE-minted {imported.chip.root.background-color.{type}.{style}.{state}}
 *     (f(type, style, state) is irreducible to any axis pair — the variant3
 *     mint class + three-placeholder root refs across all four emitters)
 *   · every minted leaf's value is the CAPTURED variable's resolved literal
 *   · referee-clean, all four emitters emit, emit-html carries the compound
 *     enum-class background rules (the visual-parity render path)
 *   · the drift stays NAMED (the observed refs are the rename targets) —
 *     routed, never silent
 *
 * Exits non-zero with a named failure on any violated expectation.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema } from '../../scripts/contract-schema.js';
import { capturedTokensFromDump } from '../../core/captured-tokens.js';
import { emitHtml } from '../../core/emit-html.js';
import { emitters, type EmitterCtx } from '../../core/emitter.js';
import { generateCss, validateContract } from '../../core/emit-react.js';
import { dumpCapturesHidden, proposeBatchFromDump } from '../../core/propose-figma.js';
import { flattenTokens, tokenInventoryFromJson, type TokenTreeInput } from '../../core/tokens.js';
import { loadTokenCorpus } from '../../extract/figma/tokens.js';
import { loadContracts } from '../../extract/figma/propose.js';

const fail = (msg: string): never => {
  console.error(`✘ fill-matrix-mint: ${msg}`);
  process.exit(1);
};

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;
const dump = read('extract/figma/gauntlet/live/fixtures/fill-matrix-depth-drop-badge-chip-alert.dump.json');

const corpus = loadTokenCorpus(ROOT);
const loaded = loadContracts(path.resolve(ROOT, 'contracts'));
const batch = proposeBatchFromDump(dump, {
  corpus,
  contractIdByName: loaded.byName,
  contractIdByKey: loaded.byKey,
  contractsById: loaded.byId,
  fileKey: (dump._provenance as { fileKey?: string } | undefined)?.fileKey ?? null,
  mintUnbound: true,
  hiddenCaptured: dumpCapturesHidden(dump._provenance as never),
});

const repoTrees = {
  primitives: read('tokens/primitives.tokens.json'),
  semantic: read('tokens/semantic.tokens.json'),
  light: read('tokens/modes/semantic.light.tokens.json'),
  dark: read('tokens/modes/semantic.dark.tokens.json'),
};
const repoInventory = tokenInventoryFromJson([repoTrees.primitives, repoTrees.semantic, repoTrees.light, repoTrees.dark]);
const captured = capturedTokensFromDump(dump);
const capturedEntries = captured?.entries ?? [];
const capturedValueByPath = new Map(capturedEntries.map((e) => [e.path, e.value]));
const baseInventory = new Set<string>([...repoInventory, ...capturedEntries.map((e) => e.path)]);
const icons = new Map<string, string>(
  readdirSync(path.join(ROOT, 'assets', 'icons'))
    .filter((f) => f.endsWith('.svg'))
    .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(ROOT, 'assets', 'icons', f), 'utf8').trim()]),
);
const brands = Object.fromEntries(
  readdirSync(path.join(ROOT, 'tokens', 'modes'))
    .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
    .map((f) => [f.replace(/^brand\.|\.tokens\.json$/g, ''), read(`tokens/modes/${f}`)]),
);
const repoContracts = new Map(
  readdirSync(path.join(ROOT, 'contracts'))
    .filter((f) => f.endsWith('.contract.json'))
    .map((f) => ContractSchema.parse(read(path.join('contracts', f))))
    .map((c) => [c.id, c] as const),
);
const mergeTrees = (docs: Record<string, unknown>[]): Record<string, unknown> => {
  const merge = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...a };
    for (const [k, v] of Object.entries(b)) {
      const prev = out[k];
      out[k] =
        prev && v && typeof prev === 'object' && typeof v === 'object' && !Array.isArray(prev) && !Array.isArray(v)
          ? merge(prev as Record<string, unknown>, v as Record<string, unknown>)
          : v;
    }
    return out;
  };
  return docs.reduce(merge, {});
};

const EXPECT: Record<string, { placeholders: number; compound: RegExp }> = {
  Badge: { placeholders: 2, compound: /^\{imported\.badge\.root\.background-color\.\{type\}\.\{style\}\}$/ },
  Chip: { placeholders: 3, compound: /^\{imported\.chip\.root\.background-color\.\{type\}\.\{style\}\.\{state\}\}$/ },
  Alert: { placeholders: 2, compound: /^\{imported\.alert\.root\.background-color\.\{type\}\.\{style\}\}$/ },
};

for (const [setName, expect] of Object.entries(EXPECT)) {
  const p = batch.proposals.find((x) => x.setName === setName);
  if (!p) fail(`${setName}: not proposed`);
  const contract = ContractSchema.parse(p!.contract);
  const rootTokens = (contract.anatomy.root.tokens ?? {}) as Record<string, string>;
  const bg = rootTokens['background-color'];
  if (!bg) fail(`${setName}: root background-color DROPPED — the class-① silent paint loss is back`);
  if (!expect.compound.test(bg)) {
    fail(`${setName}: root background-color is ${JSON.stringify(bg)} — expected the ${expect.placeholders}-placeholder minted ref (${expect.compound})`);
  }
  // The drift stays NAMED and routed — never silent.
  const routed = p!.notes.find((n) => n.includes(`${setName}:root fill: token paths differ in depth`) && n.includes('routed to the mint pass'));
  if (!routed) fail(`${setName}: the depth-drift note (with mint routing) is missing — the refusal must stay named`);
  // Minted leaves carry the CAPTURED resolved literals.
  for (const entry of p!.mintedTokens?.entries ?? []) {
    if (!entry.ref.startsWith(`{imported.${setName.toLowerCase()}.root.background-color.`)) continue;
    const site = entry.usageSites[0] ?? '';
    const m = site.match(/\(([^)]+)\)/);
    if (!m) continue;
    const axisValues = Object.fromEntries(m[1].split(', ').map((kv) => kv.split('=') as [string, string]));
    const variant = (dump[setName] as { variants: Array<{ name: string; fill?: { var?: string } }> }).variants.find((v) =>
      Object.entries(axisValues).every(([k, val]) => v.name.includes(`${k}=${val}`)),
    );
    const boundPath = variant?.fill?.var?.split('/').join('.');
    if (boundPath && capturedValueByPath.get(boundPath) !== entry.value) {
      fail(`${setName}: minted ${entry.ref} = ${entry.value} but the captured value of ${boundPath} is ${capturedValueByPath.get(boundPath)}`);
    }
  }
  // Referee + all four emitters + the emit-html compound rules.
  const contracts = new Map(repoContracts);
  contracts.set(contract.id, contract);
  for (const raw of p!.childStubs ?? []) {
    const stub = ContractSchema.safeParse(raw);
    if (stub.success && !contracts.has(stub.data.id)) contracts.set(stub.data.id, stub.data);
  }
  const mintedTree = (p!.mintedTokens?.tree ?? {}) as Record<string, unknown>;
  const inventory = new Set<string>([...baseInventory, ...flattenTokens(mintedTree).keys()]);
  const errors: string[] = [];
  validateContract(contract, contracts, errors, icons);
  const css = generateCss(contract, inventory, errors);
  if (errors.length > 0) fail(`${setName}: referee violations after the fix: ${errors.slice(0, 3).join(' | ')}`);
  const compoundRules = (css.match(/^(?:\.[a-z-]+-[a-z0-9-]+){2,3} \{/gm) ?? []).length;
  if (compoundRules === 0) fail(`${setName}: generateCss emitted no compound enum-class rules for the minted matrix`);
  const tokens: TokenTreeInput = {
    ...repoTrees,
    semantic: mergeTrees([repoTrees.semantic as Record<string, unknown>, (captured?.tree ?? {}) as Record<string, unknown>, mintedTree]),
    brands,
  } as TokenTreeInput;
  const ctx: EmitterCtx = { tokens, icons, contracts, mintedTokens: mintedTree };
  for (const emitter of emitters) {
    try {
      emitter.emit(contract, ctx);
    } catch (e) {
      fail(`${setName}: emitter ${emitter.name} refused: ${(e as Error).message.split('\n')[0]}`);
    }
  }
  const html = emitHtml(contract, ctx);
  const htmlMinted = (html.css.match(/background-color: var\(--imported-/g) ?? []).length;
  if (htmlMinted === 0) fail(`${setName}: emit-html carries no minted background rules — the parity render would still drop the box`);
  console.log(`  ${setName}: ${bg} — referee-clean, 4/4 emitters, ${htmlMinted} emit-html background rules`);
}

console.log('fill-matrix-mint ok: Badge/Alert pair-minted, Chip triple-minted, drift named, never a silent paint drop');
