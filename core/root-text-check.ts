/**
 * ROOT TEXT — the root IS the text node, and the canvas must draw it.
 *
 *   npx tsx core/root-text-check.ts
 *
 * THE DEFECT THIS PINS (found by the canvas round-trip gate,
 * conformance/canvas.ts, 2026-08-22). A contract whose ROOT carries `text`
 * (`anatomy.root.text` — a `<div>Sample</div>` captured as one element, the
 * conformance cases color-hex / custom-prop-two-hop / var-fallback-chain /
 * webkit-text-fill-color / text-overflow-ellipsis, and Fluent's Tooltip
 * whose root is the copy plus an arrow part) was never lowered:
 * `partToSpecs` reads `part.text` for CHILD parts only, and the root
 * handling in compileComponentData knew `icon`, `parts` and the `children`
 * text prop — not `text`. The variant compiled to `children: []`, the mock
 * drew a 1×1 empty box, the dump read back no TEXT node, the proposal
 * carried neither the characters nor the root's color / font-size /
 * font-weight, and ZERO code-only facts named any of it. Five of the gate's
 * six SILENT rows were this one hole.
 *
 * THE SPELLING. The root frame hosts ONE TEXT child named `label` — the same
 * name the generator gives the auto-injected `children` label, and the name
 * the proposer's sole-root-text hoist rule already looks for
 * (propose-figma.ts: "a root whose only child is the auto-injected `label`
 * text node … its text tokens hoist to the root"). The text child inherits
 * the root's text context exactly as a child text part does (applyStyling
 * over an empty part inherits fontSize / textFill / weight / truncation),
 * so nothing bespoke is invented: the root simply hosts the text it declared.
 *
 * What this check holds, end to end on the mock canvas (plan → run → dump →
 * propose — the plugin's own chain, as conformance/canvas.ts runs it):
 *
 *   1. the built variant carries exactly one child, a TEXT node named
 *      `label`, with the root's characters;
 *   2. its fill is the root's bound `color` variable (or the literal hex
 *      when the root carries a literal), its fontSize the bound `font-size`
 *      token's value, its face the bound `font-weight`'s style name;
 *   3. a declared `text-overflow: ellipsis` on the root DRAWS as
 *      textTruncation ENDING on that node (the canvas holds it) — and the
 *      return leg NAMES the CSS channel, never a silent drop;
 *   4. the proposal carries the characters and the color back — and, for a
 *      sole root text, at the EXACT spelling that was sent (anatomy.root.text
 *      + root.tokens.color, R7's unbound-label hoist);
 *   5. no code-only fact claims the color / size / weight were dropped;
 *   6. (R7) a LITERAL ink draws as the text fill on root and child alike and
 *      returns as literals.color; a literal the canvas has no field for
 *      (in-flow inset, percentage radius) is a NAMED channel fact.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  ContractSchema,
  createFigmaEngine,
  dumpCapturesHidden,
  proposeBatchFromDump,
  tokenCorpusFromJson,
  tokenSetTokenTrees,
  type CodeOnlyFact,
  type Contract,
  type TokenSetPayload,
} from './index.js';
import { createPluginEngine } from '../figma-sync/plugin/engine/entry.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import { mergeTokenTrees } from '../extract/figma/tokens.js';

const ROOT = process.cwd();
const failures: string[] = [];
const check = (label: string, condition: boolean): void => {
  if (!condition) failures.push(label);
  console.log(`  ${condition ? '✔' : '✖'} ${label}`);
};

/** The dump script EXACTLY as the plugin runs it: the ui.html #dump-source
 *  block (drift-guarded against extract/figma/dump.plugin.js), scoped to one
 *  set the way the Propose tab scopes it. Mirrors conformance/canvas.ts. */
function dumpSourceFor(setName: string): string {
  const ui = readFileSync(path.join(ROOT, 'figma-sync', 'plugin', 'ui.html'), 'utf8');
  const openTag = '<script type="text/plain" id="dump-source">';
  const start = ui.indexOf(openTag);
  if (start < 0) throw new Error('figma-sync/plugin/ui.html carries no #dump-source block');
  const source = ui.slice(start + openTag.length, ui.indexOf('</script>', start)).replace(/^\n/, '');
  const scoped = source.replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify([setName])};`);
  if (scoped === source) throw new Error('the dump script TARGET_SETS seam did not scope');
  return scoped;
}

/** Word-boundary search — the same rule the canvas gate reads its naming
 *  union with: `color` is not satisfied by `background-color`. */
const namesWord = (hay: string, word: string): boolean =>
  new RegExp(`(^|[^a-z0-9-])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9-])`, 'i').test(hay);

// ---------------------------------------------------------------------------
// the seeds: a bound root text and a literal-colour root text
// ---------------------------------------------------------------------------
const dtcg = {
  'root-text': {
    color: { $type: 'color', $value: '#1976d2' },
    'font-size': { $type: 'dimension', $value: '14px' },
    'font-weight': { $type: 'number', $value: '700' },
  },
};
const flat: Record<string, unknown> = {
  'root-text.color': dtcg['root-text'].color,
  'root-text.font-size': dtcg['root-text']['font-size'],
  'root-text.font-weight': dtcg['root-text']['font-weight'],
};
const tokenSet: TokenSetPayload = { name: 'RootText', base: flat };

const seed = (id: string, name: string, root: Record<string, unknown>): Record<string, unknown> => ({
  $schema: './contract.schema.json',
  id,
  name,
  version: '0.1.0',
  status: 'draft',
  description: `root-text check seed ${name}`,
  semantics: { element: 'div' },
  props: [],
  states: [],
  anatomy: { root },
  bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: '@ds-contracts/root-text-check', export: name } } },
});

const BOUND = seed('check.root-text-bound', 'RootTextBound', {
  layout: { display: 'flex' },
  text: 'Sample',
  declared: { 'box-sizing': 'border-box', 'font-family': 'monospace' },
  tokens: { color: '{root-text.color}', 'font-size': '{root-text.font-size}', 'font-weight': '{root-text.font-weight}' },
});
const ELLIPSIS = seed('check.root-text-ellipsis', 'RootTextEllipsis', {
  declared: {
    display: 'block',
    'box-sizing': 'border-box',
    'overflow-x': 'hidden',
    'overflow-y': 'hidden',
    'text-overflow': 'ellipsis',
    'text-wrap-mode': 'nowrap',
  },
  text: 'A very long label that will not fit',
  tokens: { color: '{root-text.color}', 'font-size': '{root-text.font-size}', 'font-weight': '{root-text.font-weight}' },
  literals: { width: '96px' },
});
/** LITERAL INK (R7, 2026-08-22). A LITERAL `color` (`literals.color`, the v14
 *  literal-ink channel the proposer's own liftUnboundTextPaintsToLiterals
 *  emits) compiled to NOTHING on roots AND child text parts alike —
 *  applyLiterals had no `color` case and its `default: break` named nothing
 *  (the S9 class of the 2026-07-27 audit, fourth occurrence). Measured
 *  before the fix: root #1976d2 + child #ff0000 → drawn as [label: no fill,
 *  sub: no fill], 0 code-only facts, color named by NOTHING. The seed now
 *  PINS the fix: the literal is the TEXT fill on the canvas (a literal
 *  paint, no variable), the child's own literal wins over the root's
 *  inherited one, and the proposal carries both back as literals. */
const LITERAL_INK = seed('check.root-text-literal-ink', 'RootTextLiteralInk', {
  layout: { display: 'flex' },
  text: 'Sample',
  literals: { color: '#1976d2' },
  parts: { sub: { text: 'child', literals: { color: '#ff0000' } } },
});
/** THE NAMED DEFAULT (R7). A literal channel the literal lowering has NO
 *  case for must land in codeOnlyFacts — never fall out of the switch. The
 *  schema admits exactly two such shapes today: an inset on an IN-FLOW box
 *  (`top` on a static part — the token path names the same thing) and a
 *  value the px parser cannot spell (`border-radius: 50%`, the storybook
 *  circle/dot pill — Figma's cornerRadius is px, so the percentage was a
 *  silent drop). Both are named with kind `channel`. */
const NAMED_DEFAULT = seed('check.literal-named-default', 'LiteralNamedDefault', {
  layout: { display: 'flex' },
  literals: { 'border-radius': '50%', width: '24px', height: '24px', 'background-color': '#1976d2' },
  parts: { pin: { text: 'pin', declared: { position: 'static' }, literals: { top: '4px' } } },
});
const WITH_PART = seed('check.root-text-with-part', 'RootTextWithPart', {
  layout: { display: 'flex' },
  text: 'Tooltip copy',
  tokens: { color: '{root-text.color}', 'font-size': '{root-text.font-size}' },
  parts: { arrow: { layout: { display: 'flex' }, literals: { width: '8px', height: '8px', 'background-color': '#1976d2' } } },
});

interface DumpText {
  name: string;
  type: string;
  text?: { characters?: string; fontSize?: number | null; fontStyle?: string | null };
  fill?: { var?: string; hex?: string };
  children?: DumpText[];
}
interface DumpSet {
  variants: Array<{ name: string; bbox: { width: number; height: number }; children: DumpText[] }>;
}

async function roundTrip(contractJson: Record<string, unknown>): Promise<{
  facts: CodeOnlyFact[];
  variant: DumpSet['variants'][number] | undefined;
  textNode: { textTruncation?: string } | null;
  union: string;
  proposalAnatomy: Record<string, unknown> | undefined;
}> {
  const contract = ContractSchema.parse(contractJson) as Contract;
  const bundle = { type: 'CONTRACTS-BUNDLE', version: 1, tokenSet, contracts: [contractJson] };
  const plugin = createPluginEngine({
    tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
    contracts: [],
    icons: {},
  });
  const parsed = plugin.parseIncomingText(JSON.stringify(bundle));
  if (!parsed.ok) throw new Error(`plugin parse refused: ${parsed.issue.headline}`);
  const plan = plugin.planGenerate(parsed.contracts, { withTokens: true, fileKey: '', tokenSet: parsed.tokenSet, icons: parsed.icons });
  if (!plan.ok) throw new Error(`plugin plan refused: ${plan.issues.map((i) => i.headline).join('; ')}`);
  const union: string[] = [...plan.notes];

  const engine = createFigmaEngine({ tokens: tokenSetTokenTrees(tokenSet), icons: new Map() });
  const data = engine.compileComponentData(contract, new Map([[contract.id, contract]]));
  const facts = data.codeOnlyFacts ?? [];
  for (const f of facts) union.push(`code-only ${f.kind} ${f.part}.${f.channel} = ${f.value} — ${f.reason}`);
  union.push(data.description);

  const { figma, root } = createFigmaMock();
  const ctx = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (code: string): Promise<unknown> => vm.runInContext(`(async () => {\n${code}\n})()`, ctx, { timeout: 300_000 }) as Promise<unknown>;
  for (const step of plan.steps) {
    const result = (await run(step.code)) as { results?: Array<Record<string, unknown>> } | undefined;
    if (step.kind === 'component') union.push(`step result: ${JSON.stringify(result?.results?.[0] ?? {})}`);
  }
  type Marked = { name: string; type: string; getSharedPluginData: (ns: string, k: string) => string };
  const node = root.findOne(
    (n: Marked) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.getSharedPluginData('ds_contracts', 'contractId') === contract.id,
  ) as (Marked & { findOne: (f: (n: { type: string }) => boolean) => unknown }) | null;
  if (!node) throw new Error(`${contract.name}: the set was not built in the mock`);
  const textNode = node.findOne((n: { type: string }) => n.type === 'TEXT') as { textTruncation?: string } | null;

  const dump = (await run(dumpSourceFor(node.name))) as Record<string, unknown>;
  for (const d of (dump._degradations ?? []) as Array<{ code: string; nodePath: string; message: string }>) {
    union.push(`degradation ${d.code} @ ${d.nodePath}: ${d.message}`);
  }
  const set = dump[node.name] as DumpSet | undefined;

  const corpus = tokenCorpusFromJson({ primitives: {}, semantic: mergeTokenTrees([dtcg]), light: {}, brandDefault: {} });
  const batch = proposeBatchFromDump(dump, {
    corpus,
    contractIdByName: new Map([[contract.name, contract.id]]),
    contractsById: new Map([[contract.id, contractJson as never]]),
    contractIdByKey: new Map(),
    fileKey: null,
    projectionMode: 'exact',
    mintUnbound: true,
    hiddenCaptured: dumpCapturesHidden(dump._provenance as never),
  });
  for (const s of batch.skipped) union.push(`skip: ${s.reason}${s.detail ? ` — ${s.detail}` : ''}`);
  union.push(...batch.notes);
  const proposal = batch.proposals.find((p) => p.setName === node.name) ?? batch.proposals[0];
  if (proposal) {
    union.push(...proposal.notes);
    for (const u of proposal.unbound) union.push(`unbound ${u.nodePath} ${u.property} = ${String(u.value)}`);
  }
  return {
    facts,
    variant: set?.variants[0],
    textNode,
    union: union.join('\n'),
    proposalAnatomy: (proposal?.contract as { anatomy?: Record<string, unknown> } | undefined)?.anatomy,
  };
}

/** Where the proposal spells the root's text + colour. R7: for a SOLE
 *  unbound `label` text the spelling is pinned to `anatomy.root.text` (the
 *  proposer's hoist rule, propose-figma.ts); a root text BESIDE a part keeps
 *  the `parts.label` path, so that case asserts only that the facts came back. */
const findText = (anatomy: Record<string, unknown> | undefined, characters: string): string | undefined => {
  const walk = (name: string, part: Record<string, unknown>): string | undefined => {
    if (part.text === characters) return name;
    for (const [n, p] of Object.entries((part.parts ?? {}) as Record<string, Record<string, unknown>>)) {
      const hit = walk(`${name}.parts.${n}`, p);
      if (hit) return hit;
    }
    return undefined;
  };
  const root = anatomy?.root as Record<string, unknown> | undefined;
  return root ? walk('root', root) : undefined;
};
const findChannel = (anatomy: Record<string, unknown> | undefined, channel: string): Array<{ at: string; value: string }> => {
  const out: Array<{ at: string; value: string }> = [];
  const walk = (name: string, part: Record<string, unknown>): void => {
    for (const where of ['tokens', 'literals'] as const) {
      const m = part[where] as Record<string, string> | undefined;
      if (m && typeof m[channel] === 'string') out.push({ at: `${name}.${where}.${channel}`, value: m[channel] });
    }
    for (const [n, p] of Object.entries((part.parts ?? {}) as Record<string, Record<string, unknown>>)) walk(`${name}.parts.${n}`, p);
  };
  const root = anatomy?.root as Record<string, unknown> | undefined;
  if (root) walk('root', root);
  return out;
};

// ---------------------------------------------------------------------------
console.log('root-text: a BOUND root text (color / font-size / font-weight tokens)');
{
  const r = await roundTrip(BOUND);
  const kids = r.variant?.children ?? [];
  const label = kids[0];
  check('the variant carries exactly ONE child', kids.length === 1);
  check('that child is a TEXT node named "label"', label?.type === 'TEXT' && label?.name === 'label');
  check('it draws the root\'s characters ("Sample")', label?.text?.characters === 'Sample');
  check('its fill is the root\'s bound color variable (root-text/color)', label?.fill?.var === 'root-text/color');
  check('its fontSize is the bound font-size token\'s value (14)', label?.text?.fontSize === 14);
  check('its face is the bound font-weight\'s style (700 → Bold)', label?.text?.fontStyle === 'Bold');
  check('the variant box is no longer the 1×1 empty box', (r.variant?.bbox.width ?? 0) > 1 && (r.variant?.bbox.height ?? 0) > 1);
  check(
    'no code-only fact claims color / font-size / font-weight were dropped',
    !r.facts.some((f) => ['color', 'font-size', 'font-weight'].includes(f.channel)),
  );
  const textAt = findText(r.proposalAnatomy, 'Sample');
  const colors = findChannel(r.proposalAnatomy, 'color');
  check(`the proposal carries the characters back${textAt ? ` (at ${textAt})` : ''}`, textAt !== undefined);
  // R7: the EXACT spelling closes — the sole unbound `label` TEXT child is the
  // root's own text, so it comes back as anatomy.root.text with the colour
  // hoisted to root.tokens (the proposer's sole-label hoist used to require a
  // BOUND text property and handed back parts.label.text instead).
  check('the characters come back at anatomy.root.text — the exact spelling that was sent (idempotent round trip)', textAt === 'root');
  check(
    `the proposal carries the color back as {root-text.color} at root.tokens.color${colors.length > 0 ? ` (at ${colors.map((c) => c.at).join(', ')})` : ''}`,
    colors.some((c) => c.value === '{root-text.color}' && c.at === 'root.tokens.color'),
  );
  check('the proposal proposes NO parts (the label was the root text, not a part)', (r.proposalAnatomy?.root as { parts?: unknown } | undefined)?.parts === undefined);
  check('the hoist is NAMED in the proposal notes (sole unbound root text hoisted)', /sole root text node named "label".*hoisted to anatomy\.root\.text/.test(r.union));
}

console.log('root-text: a block root text with a fixed width and text-overflow: ellipsis');
{
  const r = await roundTrip(ELLIPSIS);
  const kids = r.variant?.children ?? [];
  const label = kids[0];
  check('the variant carries exactly ONE child, a TEXT node named "label"', kids.length === 1 && label?.type === 'TEXT' && label?.name === 'label');
  check('it draws the root\'s characters', label?.text?.characters === 'A very long label that will not fit');
  check('its fill / fontSize / face follow the bound tokens (root-text/color, 14, Bold)', label?.fill?.var === 'root-text/color' && label?.text?.fontSize === 14 && label?.text?.fontStyle === 'Bold');
  check('text-overflow: ellipsis DRAWS — the canvas TEXT node carries textTruncation ENDING', r.textNode?.textTruncation === 'ENDING');
  check(
    'the return leg NAMES text-overflow as a CSS word (dump degradation / facts / notes) — never a silent drop',
    namesWord(r.union, 'text-overflow'),
  );
  const colors = findChannel(r.proposalAnatomy, 'color');
  check(
    `the proposal carries the color back as {root-text.color}${colors.length > 0 ? ` (at ${colors.map((c) => c.at).join(', ')})` : ''}`,
    colors.some((c) => c.value === '{root-text.color}'),
  );
}

console.log('root-text: LITERAL INK (literals.color) on the root text and on a child text part');
{
  const r = await roundTrip(LITERAL_INK);
  const kids = r.variant?.children ?? [];
  const inks = kids.map((k) => `${k.name}: ${k.fill?.hex ?? k.fill?.var ?? 'no fill'}`).join(', ');
  console.log(`    drawn as [${inks}]; ${r.facts.length} code-only fact(s)`);
  check('the root text and the child text both reach the canvas', kids.length === 2 && kids[0]?.text?.characters === 'Sample' && kids[1]?.text?.characters === 'child');
  // The dump spells a raw paint as { hex: "rrggbb" } (no `#`).
  const hexOf = (k: DumpText | undefined) => k?.fill?.hex?.replace('#', '').toLowerCase();
  check('the root literal ink IS the root text\'s fill on the canvas (#1976d2, a literal paint — no variable)', hexOf(kids[0]) === '1976d2' && kids[0]?.fill?.var === undefined);
  check('the child\'s OWN literal ink wins over the inherited root ink (#ff0000)', hexOf(kids[1]) === 'ff0000' && kids[1]?.fill?.var === undefined);
  check('no code-only fact claims color was dropped (it was drawn)', !r.facts.some((f) => f.channel === 'color'));
  const colors = findChannel(r.proposalAnatomy, 'color');
  check(
    `the proposal carries BOTH literal inks back as literals.color${colors.length > 0 ? ` (at ${colors.map((c) => `${c.at}=${c.value}`).join(', ')})` : ''}`,
    colors.some((c) => c.value.toLowerCase() === '#1976d2' && c.at.endsWith('.literals.color')) &&
      colors.some((c) => c.value.toLowerCase() === '#ff0000' && c.at.endsWith('.literals.color')),
  );
}

console.log('root-text: THE NAMED DEFAULT — a literal the literal lowering cannot draw is a code-only fact, never a silent drop');
{
  const r = await roundTrip(NAMED_DEFAULT);
  const named = (channel: string) => r.facts.filter((f) => f.kind === 'channel' && f.channel === channel);
  const top = named('top');
  const radius = named('border-radius');
  check(`an in-flow literal inset (parts.pin literals.top = 4px) is NAMED as a channel fact (${top.length} fact(s))`, top.length === 1 && top[0].part === 'pin' && top[0].value === '4px');
  check('…with the literal-channel reason ("no canvas field for this literal channel")', top.some((f) => f.reason.startsWith('no canvas field for this literal channel')));
  check(`a percentage literal radius (border-radius: 50%) is NAMED as a channel fact (${radius.length} fact(s))`, radius.length === 1 && radius[0].part === 'root' && radius[0].value === '50%');
  check('…with the literal-channel reason', radius.some((f) => f.reason.startsWith('no canvas field for this literal channel')));
  check('the facts reach the plan/union text (the plugin report names them)', namesWord(r.union, 'border-radius') && /pin\.top = 4px/.test(r.union));
}

console.log('root-text: a root text BESIDE a part (the Fluent Tooltip shape: copy + arrow)');
{
  const r = await roundTrip(WITH_PART);
  const kids = r.variant?.children ?? [];
  check('the variant carries TWO children — the text first, then the part', kids.length === 2 && kids[0]?.type === 'TEXT' && kids[0]?.name === 'label' && kids[1]?.name === 'arrow');
  check('the text draws the root\'s characters with the root\'s color', kids[0]?.text?.characters === 'Tooltip copy' && kids[0]?.fill?.var === 'root-text/color');
  const textAt = findText(r.proposalAnatomy, 'Tooltip copy');
  check(`the proposal carries the characters back${textAt ? ` (at ${textAt})` : ''}`, textAt !== undefined);
}

if (failures.length > 0) {
  console.error(`\n✘ root-text: ${failures.length} pin(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✔ root-text: a root that IS the text node draws its characters, colour, size and weight on the canvas, and the return leg names what it cannot carry');
