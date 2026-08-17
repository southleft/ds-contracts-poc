/**
 * THE PHASE 1 EXIT-CRITERION GATE — `npm run variant-drift:check`.
 *
 * docs/12-roadmap.md Phase 1 exits when "the differ (not a human with a
 * screenshot) catches a hand-made change to a part's layout inside one
 * variant". This file IS that test, offline, with no Figma.
 *
 * IT DRIVES THE REAL DIFFER. Every section below spawns `parity/diff.ts`
 * itself — the same script `npm run parity` runs — pointed at a snapshot
 * directory via PARITY_SNAPSHOT_DIR and at a scratch report via
 * PARITY_REPORT, then reads the emitted JSON. Nothing here re-implements the
 * comparison, so the gate cannot pass while the differ is broken.
 *
 * WHAT THE COMMITTED FIXTURE PAIR IS.
 *   parity/fixtures/variant-drift/pristine/figma-components.json
 *   parity/fixtures/variant-drift/edited/figma-components.json
 * Both are the OUTPUT OF parity/extract-figma.plugin.js ITSELF — the real
 * file, executed unmodified against the mocked Figma canvas (see runPlugin
 * below) — filtered to three sets. Nothing about their shape is asserted by
 * hand, so a fixture describing a wire format the plugin does not produce is
 * not a thing that can happen here. They differ in exactly one place: in
 * `edited`, the AccordionItem set's State=Closed variant has had a FOUR-WAY
 * hand edit applied to its nested `trigger` part —
 *
 *     paddingLeft         12 → 24
 *     itemSpacing          8 → 16
 *     counterAxisAlignItems  CENTER → MAX
 *     boundVariables.paddingLeft   space/inset-x/sm → detached
 *
 * — recorded the way a real extraction would record it: the STAMP
 * (`fingerprint`/`snapshot`, what the plugin last generated) is untouched,
 * and the RECOMPUTE (`live`/`liveSnapshot`, the node as it stands) carries the
 * edit. That asymmetry is the hand edit. Nothing re-stamps when a designer
 * drags a handle, which is why reading pluginData alone can never see this
 * and why the plugin recomputes in-session.
 *
 * Rebuild them with `--rebuild-fixtures` (they are generated from the
 * committed contracts through the real engine, so they cannot drift into
 * fiction), re-embed the fingerprint source with `--embed`.
 *
 * THE SECTIONS:
 *   §0   the plugin carries FINGERPRINT_SRC byte-identically and performs an
 *        explicit, error-preserving variable-name preload
 *   §0b  the plugin is EXECUTED against the mocked canvas — 51 sets / 195
 *        rows — and every row must carry both a v6 stamp and a non-null
 *        in-session recompute that EQUALS it on an untouched file. Also
 *        re-derives what a defaultVariant-only nestedInstances walk would
 *        have returned and fails on the difference.
 *   §1   PRISTINE  → the differ reports ZERO figma-canvas findings
 *   §2   EDITED    → exactly ONE finding, naming the VARIANT, carrying the
 *                    snapshot line diff for the edited channels
 *   §3   ABSENCE   → a snapshot with no `variants` at all is NOT EXTRACTED,
 *                    never "no drift" (the false-receipt guard)
 *   §4   VERSION   → a v5 stamp is `version-changed` and a null stamp is
 *                    `unstamped`; neither is ever `canvas-edited`
 *   §5   THE COMPILE RAN — one row moved to a bogus hash with stamp and
 *        recompute AGREEING must report contract-divergent and quote the
 *        fingerprint the offline compile derived. Without this section the
 *        compile is dead weight in the green path: §1 is clean whether the
 *        contract matched every row or produced nothing at all.
 *   §6   THE PARTIAL-CHECKOUT CALLER — site/src/how-replays.ts and
 *        evals/run.ts run this differ from a scratch without figma-sync, so
 *        the engine bundle cannot build there. Reproduced exactly: the hand
 *        edit must STILL be caught (it needs no compile) and the missing
 *        contract axis must be NAMED 'compile-unavailable', not pass as
 *        agreement.
 *
 * FALSIFICATION — run, and the output recorded in the commit message rather
 * than asserted here. Each of these was applied and reverted:
 *   1. delete the `live !== fingerprint` branch in parity/variant-drift.ts →
 *      §2 goes GREEN with 0 findings. That green is the defect this whole
 *      item exists to remove.
 *   2. make that branch fire on equality too → §1 goes RED with 9
 *      canvas-edited findings over the UNTOUCHED fixture.
 *   3. make notExtractedFinding always return null → §3 red, 0 findings.
 *   4. make compileVariantFingerprints return an empty map → §5 red, 0
 *      findings, while §1–§4 stay green (this is why §5 exists).
 *   5. perturb the fingerprint inside the plugin's inlined block → §0 red on
 *      the byte-compare.
 *   6. narrow the nestedInstances probe to `[node.children[0]]` — a spelling
 *      no grep for `defaultVariant` can see → §0b red, "AccordionItem:
 *      missing Slot".
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { FINGERPRINT_SRC } from '../core/canvas-fingerprint.js';
import { compileMockCanvas, variantNodesOf, type FigmaNodeLike, type MockCanvas } from './variant-drift.js';

const ROOT = process.cwd();
const PLUGIN = path.join(ROOT, 'parity', 'extract-figma.plugin.js');
const FIXTURES = path.join(ROOT, 'parity', 'fixtures', 'variant-drift');
const BEGIN = '// >>> BEGIN FINGERPRINT_SRC (generated from core/canvas-fingerprint.ts — do not edit)';
const END = '// <<< END FINGERPRINT_SRC';

/** The three sets the fixtures carry. AccordionItem is the subject: its
 *  State=Closed variant has a nested `trigger` FRAME with a real auto-layout
 *  line AND four variable bindings, which is exactly the shape the exit
 *  criterion names. Badge and Avatar are along so the fixture is not a
 *  single-row special case and the "clean" verdict has company. */
const FIXTURE_SETS = ['AccordionItem', 'Badge', 'Avatar'];
const SUBJECT_SET = 'AccordionItem';
const SUBJECT_VARIANT = 'State=Closed';
const SUBJECT_PART = 'trigger';

const fail = (msg: string): never => {
  console.error(`\n✖ variant-drift-check: ${msg}\n`);
  process.exit(1);
};
const assert = (cond: unknown, what: string): void => {
  if (!cond) fail(`pin failed: ${what}`);
};

// ---------------------------------------------------------------------------
// §0 · the plugin's inlined fingerprint source
// ---------------------------------------------------------------------------

const embed = (): void => {
  const src = readFileSync(PLUGIN, 'utf8');
  const start = src.indexOf(BEGIN);
  const end = src.indexOf(END);
  if (start < 0 || end < 0) fail('parity/extract-figma.plugin.js has no FINGERPRINT_SRC marker block');
  const next = `${src.slice(0, start + BEGIN.length)}\n${FINGERPRINT_SRC.trim()}\n${src.slice(end)}`;
  if (next === src) {
    console.log('  §0 embed — already byte-identical, nothing to do.');
    return;
  }
  writeFileSync(PLUGIN, next, 'utf8');
  console.log(`  §0 embed — re-embedded FINGERPRINT_SRC (${FINGERPRINT_SRC.trim().length} chars) into parity/extract-figma.plugin.js`);
};

const checkEmbed = (): void => {
  const src = readFileSync(PLUGIN, 'utf8');
  const start = src.indexOf(BEGIN);
  const end = src.indexOf(END);
  assert(start >= 0 && end > start, '§0 parity/extract-figma.plugin.js carries the FINGERPRINT_SRC marker block');
  const block = src.slice(start + BEGIN.length, end).trim();
  assert(
    block === FINGERPRINT_SRC.trim(),
    `§0 the inlined copy is BYTE-IDENTICAL to core/canvas-fingerprint.ts's FINGERPRINT_SRC — a private twin is how the transport starts computing a different hash than the stamp it compares against (embedded ${block.length} chars, module ${FINGERPRINT_SRC.trim().length}; run: npx tsx parity/variant-drift-check.ts --embed)`,
  );
  // Extraction performs its own preload because dsLoadVarNames deliberately
  // swallows lookup errors for generation compatibility. Evidence collection
  // must retain that failure instead of blessing an empty map as loaded.
  assert(
    /await figma\.variables\.getLocalVariablesAsync\(\)/.test(src) &&
      /variableNameLoadError/.test(src) &&
      /dsSetVarNames\(variableNames\)/.test(src),
    '§0 the plugin explicitly preloads variable names and retains lookup failures instead of silently marking an empty map loaded',
  );
  assert(
    src.includes("getSharedPluginData('ds_contracts', 'canvasFingerprint')") &&
      src.includes("getSharedPluginData('ds_contracts', 'canvasSnapshot')"),
    '§0 the plugin reads BOTH stamps back off the canvas (this was `grep -c getSharedPluginData` = 0 before this round)',
  );
  assert(
    src.includes('dsCanvasFingerprint(node)') && src.includes('dsCanvasSnapshot(node)'),
    '§0 the plugin ALSO recomputes in-session — the stamp alone is a memory of a past generation and cannot see a hand edit',
  );
  // CODE only — the header explains the fix by naming the old probe, and a
  // whole-file grep would fail on its own changelog.
  const code = src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');
  assert(
    !/defaultVariant/.test(code),
    '§0 nestedInstances walks EVERY variant, not node.defaultVariant — a nested instance living only in a non-default variant was invisible to diff.ts componentRefsOf check',
  );
  // Deliberately NOT pinning the exact source line of the probe. Matching a
  // spelling is reading the switch; §0b throws it — it re-derives what a
  // default-variant-only walk would return and fails on the difference, which
  // catches `[node.children[0]]` and every other way of writing the old bug.
  console.log(`  §0 plugin transport      FINGERPRINT_SRC inlined byte-identically (${block.length} chars), error-preserving preload present, stamps read, live recompute present, defaultVariant probe gone`);
};

// ---------------------------------------------------------------------------
// Running the ACTUAL extraction plugin, offline
// ---------------------------------------------------------------------------

interface PluginSet {
  name: string;
  nodeId: string;
  key: string;
  description: string;
  variantCount: number;
  properties: Record<string, unknown>;
  nestedInstances: string[];
  contractId: string | null;
  setFingerprint: string | null;
  setSnapshot: string[] | null;
  setLive: string | null;
  setLiveSnapshot: string[] | null;
  setMeasurementError: string | null;
  variants: VariantRow[];
}
interface PluginOutput {
  fileName: string;
  fileKey: string | null;
  extractedAt: number;
  sets: PluginSet[];
  collections: unknown[];
}

/** Execute parity/extract-figma.plugin.js — the real file, unmodified — over
 *  the mocked Figma canvas. This is what makes §0 an EXECUTION rather than a
 *  set of greps, and what makes the committed fixtures genuine plugin output
 *  instead of a hand-assembled shape someone believed the plugin returns.
 *
 *  TWO SHIMS, and both are gaps in scripts/plugin-engine-mock-figma.mjs, not
 *  in the plugin:
 *    · INSTANCE nodes produced by `_cloneForInstance` (a nested instance
 *      inside a component) never get `getMainComponentAsync`; only the ones
 *      from `createInstance` do.
 *    · MockCollection has no `variableIds`, and MockVariable spells its code
 *      syntax `_codeSyntax`.
 *  The variable half of the plugin is unchanged by this round and is covered
 *  by `npm run tokens:snapshot:check`; the shims exist so the whole script
 *  runs to completion rather than to make it pass. */
async function runPlugin(
  canvas: MockCanvas,
  options: { variableLookupFailure?: Error } = {},
): Promise<PluginOutput> {
  const patchInstances = (n: FigmaNodeLike): void => {
    if (n.type === 'INSTANCE' && typeof n.getMainComponentAsync !== 'function') {
      (n as { getMainComponentAsync?: unknown }).getMainComponentAsync = async () =>
        (n as { _mainComponent?: unknown })._mainComponent ?? null;
    }
    for (const k of n.children ?? []) patchInstances(k);
  };
  patchInstances(canvas.root);

  const figma = canvas.figma as {
    variables: {
      getLocalVariablesAsync(): Promise<Array<Record<string, unknown>>>;
      getLocalVariableCollectionsAsync(): Promise<Array<Record<string, unknown>>>;
    };
  };
  const allVars = await figma.variables.getLocalVariablesAsync();
  for (const v of allVars) if (v.codeSyntax === undefined) v.codeSyntax = v._codeSyntax ?? {};
  for (const c of await figma.variables.getLocalVariableCollectionsAsync()) {
    if (c.variableIds === undefined) {
      c.variableIds = allVars.filter((v) => v.variableCollectionId === c.id).map((v) => v.id);
    }
  }
  if (options.variableLookupFailure) {
    figma.variables.getLocalVariablesAsync = async () => {
      throw options.variableLookupFailure;
    };
  }

  const src = readFileSync(PLUGIN, 'utf8');
  const ctx = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  return (await vm.runInContext(`(async () => {\n${src}\n})()`, ctx, { timeout: 300_000 })) as PluginOutput;
}

// ---------------------------------------------------------------------------
// Fixture construction
// ---------------------------------------------------------------------------

interface VariantRow {
  name: string;
  fingerprint: string | null;
  snapshot: string[] | null;
  live: string | null;
  liveSnapshot: string[] | null;
  measurementError: string | null;
}

/** THE HAND EDIT. Applied to the live mock node, then recomputed — so the
 *  fixture's `live` half is a genuine fingerprint of genuinely edited
 *  geometry, not a string someone typed. */
function applyPartLayoutEdit(variant: FigmaNodeLike): { part: FigmaNodeLike; before: string } {
  const find = (n: FigmaNodeLike): FigmaNodeLike | null => {
    if (n.name === SUBJECT_PART && n.layoutMode && n.layoutMode !== 'NONE') return n;
    for (const k of n.children ?? []) {
      const hit = find(k);
      if (hit) return hit;
    }
    return null;
  };
  const part = find(variant);
  if (!part) throw new Error(`fixture: no auto-layout part named "${SUBJECT_PART}" inside ${variant.name}`);
  const before = `pad ${String(part.paddingLeft)} gap ${String(part.itemSpacing)} counter ${String(part.counterAxisAlignItems)} bound:paddingLeft ${part.boundVariables && (part.boundVariables as Record<string, unknown>).paddingLeft ? 'yes' : 'no'}`;
  part.paddingLeft = 24;
  part.itemSpacing = 16;
  part.counterAxisAlignItems = 'MAX';
  const bv = part.boundVariables as Record<string, unknown> | undefined;
  if (!bv || !bv.paddingLeft) throw new Error('fixture: the subject part carries no paddingLeft binding to detach');
  delete bv.paddingLeft;
  return { part, before };
}

async function rebuildFixtures(): Promise<void> {
  const canvas = await compileMockCanvas(path.join(ROOT, 'contracts'));
  const contracts = JSON.parse(
    readFileSync(path.join(ROOT, 'contracts', 'badge.contract.json'), 'utf8'),
  ) as { anchors: { figma: { fileKey: string } } };

  // ── pristine: the REAL plugin over the untouched generated canvas. Its
  // `fingerprint` rows are the pluginData the generate step actually wrote;
  // its `live` rows are the plugin's own in-session recompute. Nothing here
  // is assembled by hand, so the fixture cannot describe a wire format the
  // plugin does not produce.
  const keep = (out: PluginOutput) => out.sets.filter((s) => FIXTURE_SETS.includes(s.name));
  const pristineSets = keep(await runPlugin(canvas));
  if (pristineSets.length !== FIXTURE_SETS.length) {
    throw new Error(`fixture: the plugin returned ${pristineSets.length} of the ${FIXTURE_SETS.length} wanted sets`);
  }

  // ── edited: THE HAND EDIT, applied to the live mock node, then the SAME
  // plugin run again. Its pluginData was never rewritten — nothing re-stamps
  // when a designer drags a handle — so the `fingerprint` rows still describe
  // the pre-edit geometry while `live` carries the edit. That asymmetry is
  // not staged; it is what the plugin returns.
  const subjectSet = canvas.sets.find((n) => n.name === SUBJECT_SET);
  if (!subjectSet) throw new Error(`fixture: the compile produced no set named ${SUBJECT_SET}`);
  const subjectVariant = variantNodesOf(subjectSet).find((v) => v.name === SUBJECT_VARIANT);
  if (!subjectVariant) throw new Error(`fixture: ${SUBJECT_SET} has no variant named ${SUBJECT_VARIANT}`);
  const { before } = applyPartLayoutEdit(subjectVariant);
  const editedSets = keep(await runPlugin(canvas));

  const wrap = (sets: unknown[], note: string) => ({
    fileName: 'ds-contracts fixture — real parity/extract-figma.plugin.js output over the mocked canvas (rebuild: npx tsx parity/variant-drift-check.ts --rebuild-fixtures)',
    fileKey: contracts.anchors.figma.fileKey,
    // Frozen on purpose: a fixture whose age moves would make the gate's
    // verdict depend on the wall clock. The gate passes MAX_SNAPSHOT_AGE_DAYS.
    extractedAt: 1754000000000,
    _fixture: note,
    sets,
    collections: [],
  });

  for (const [dir, sets, note] of [
    ['pristine', pristineSets, 'Untouched compile of the committed contracts: every variant\'s stamp and same-session recompute agree.'],
    [
      'edited',
      editedSets,
      `Identical to pristine except ${SUBJECT_SET} / ${SUBJECT_VARIANT}: its nested "${SUBJECT_PART}" part was hand-edited four ways (paddingLeft 12→24, itemSpacing 8→16, counterAxisAlignItems CENTER→MAX, paddingLeft binding detached). The STAMP is untouched — nothing re-stamps on a hand edit — and the recompute carries the edit. Was: ${before}`,
    ],
  ] as const) {
    const out = path.join(FIXTURES, dir);
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, 'figma-components.json'), JSON.stringify(wrap(sets, note), null, 2) + '\n');
    console.log(`  wrote ${path.relative(ROOT, path.join(out, 'figma-components.json'))} (${sets.length} sets)`);
  }
}

// ---------------------------------------------------------------------------
// Driving the REAL differ
// ---------------------------------------------------------------------------

interface ReportFinding {
  surface: string;
  classification: string;
  subject: string;
  detail: string;
  driftKind?: string;
  lines?: Array<{ what: string; was: string; now: string }>;
}

const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const scratch = mkdtempSync(path.join(os.tmpdir(), 'variant-drift-'));

/** Run parity/diff.ts over a snapshot dir and return its figma-canvas
 *  findings. Its exit code is IGNORED on purpose — the fixtures deliberately
 *  carry three sets out of 51, so the code/token surfaces are loud; this gate
 *  is about ONE surface and reads it out of the report the differ writes. */
interface DifferRun {
  /** figma-canvas drift findings (the ones that fail the check). */
  canvas: ReportFinding[];
  /** the NOT-MEASURED bucket — surfaces the differ could not look at. */
  unmeasured: Array<{ subject: string; detail: string; driftKind: string }>;
  stdout: string;
}

function runDiffer(snapshotDir: string, label: string): DifferRun {
  const report = path.join(scratch, `${label}.report.json`);
  const r = spawnSync(TSX, ['parity/diff.ts'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      PARITY_SNAPSHOT_DIR: snapshotDir,
      PARITY_REPORT: report,
      MAX_SNAPSHOT_AGE_DAYS: '100000',
    },
  });
  if (r.status === null || r.status > 1) {
    fail(`§ the differ did not complete over ${label} (exit ${r.status})\n${r.stdout ?? ''}\n${r.stderr ?? ''}`);
  }
  if (!existsSync(report)) fail(`§ the differ wrote no report for ${label}`);
  const parsed = JSON.parse(readFileSync(report, 'utf8')) as {
    findings: ReportFinding[];
    unmeasured?: Array<{ subject: string; detail: string; driftKind: string }>;
  };
  return {
    canvas: parsed.findings.filter((f) => f.surface === 'figma-canvas'),
    unmeasured: parsed.unmeasured ?? [],
    stdout: `${r.stdout ?? ''}${r.stderr ?? ''}`,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (process.argv.includes('--embed')) {
  embed();
  process.exit(0);
}
if (process.argv.includes('--rebuild-fixtures')) {
  await rebuildFixtures();
  process.exit(0);
}

checkEmbed();

for (const dir of ['pristine', 'edited']) {
  assert(
    existsSync(path.join(FIXTURES, dir, 'figma-components.json')),
    `the committed fixture parity/fixtures/variant-drift/${dir}/figma-components.json exists (rebuild: npx tsx parity/variant-drift-check.ts --rebuild-fixtures)`,
  );
}

// ── §0b THE PLUGIN, EXECUTED ───────────────────────────────────────────────
// The greps above say the right identifiers are present. This RUNS the file.
// It is the difference between reading a switch and throwing it: a plugin
// whose recompute throws on every node would satisfy every pin in §0 and
// return `live: null` everywhere, and diff.ts treats a null `live` as "not
// compared" — a silent, total downgrade of the surface this gate exists for.
{
  const canvas = await compileMockCanvas(path.join(ROOT, 'contracts'), [
    path.join(FIXTURES, 'witness.contract.json'),
  ]);
  const out = await runPlugin(canvas);
  const rows = out.sets.flatMap((s) => s.variants ?? []);
  assert(out.sets.length > 0 && rows.length > 0, `§0b the plugin returned sets with variant rows (${out.sets.length} sets, ${rows.length} rows)`);
  assert(
    out.sets.every((s) => Array.isArray(s.variants) && s.variants.length === s.variantCount),
    '§0b every set carries one variant row per variant (a COMPONENT_SET dumps its children, a standalone COMPONENT dumps itself — mirroring emit-figma-script.ts dsStampFingerprints)',
  );
  const nullLive = rows.filter((r) => typeof r.live !== 'string' || !r.live);
  assert(
    nullLive.length === 0,
    `§0b every row carries a non-null in-session recompute — ${nullLive.length}/${rows.length} came back null, which diff.ts reads as "not compared" and would silently blank this whole surface`,
  );
  const nullStamp = rows.filter((r) => typeof r.fingerprint !== 'string' || !r.fingerprint!.startsWith('v6:'));
  assert(nullStamp.length === 0, `§0b every row carries the v6 stamp read back off the canvas (${nullStamp.length}/${rows.length} missing)`);
  assert(
    rows.every((r) => r.live === r.fingerprint),
    '§0b over an UNTOUCHED generated canvas the recompute EQUALS the stamp — otherwise the plugin would report every variant edited on a file nobody has touched (the false-alarm shape v6 refuses over an unloaded name map)',
  );
  assert(
    rows.every((r) => Array.isArray(r.snapshot) && Array.isArray(r.liveSnapshot) && r.snapshot!.length > 0),
    '§0b both snapshots come back as line arrays — without them a canvas-edited verdict has no line diff to show',
  );
  assert(
    out.sets.every(
      (s) =>
        typeof s.setFingerprint === 'string' &&
        typeof s.setLive === 'string' &&
        Array.isArray(s.setSnapshot) &&
        Array.isArray(s.setLiveSnapshot) &&
        s.setMeasurementError == null,
    ),
    '§0b every set transports its stamped and live component-set metadata measurement',
  );
  assert(
    !rows.some((r) => (r.liveSnapshot ?? []).some((l) => l.includes('(unresolved)') || l.includes('VariableID:'))),
    '§0b no row leaks "(unresolved)" or a run-scoped VariableID — either would mean the dsLoadVarNames() preload did not take, and the hash would disagree with the stamp for a reason that is not a canvas edit',
  );
  // THE nestedInstances FIX, MEASURED — the old probe was
  // `node.type === 'COMPONENT_SET' ? node.defaultVariant : node`, so an
  // instance living only in a non-default variant was invisible. Re-derive
  // what a default-variant-only walk WOULD have returned and name the
  // difference, rather than asserting the fix from the diff.
  const ownerOf = (n: FigmaNodeLike): string | null => {
    const main = (n as { _mainComponent?: { name?: string; parent?: { type: string; name: string } } })._mainComponent;
    if (!main) return null;
    return main.parent?.type === 'COMPONENT_SET' ? main.parent.name : (main.name ?? null);
  };
  const ownersIn = (n: FigmaNodeLike, into: Set<string>): Set<string> => {
    if (n.type === 'INSTANCE') {
      const o = ownerOf(n);
      if (o) into.add(o);
    }
    for (const k of n.children ?? []) ownersIn(k, into);
    return into;
  };
  const widened: string[] = [];
  for (const node of canvas.sets) {
    // Recreate the OLD probe: defaultVariant (not children[0]). A set whose
    // first child is a non-default that already hosts the extra instance
    // would make children[0] look complete and hide the witness.
    const defaultNode =
      node.type === 'COMPONENT_SET'
        ? ((node as FigmaNodeLike & { defaultVariant?: FigmaNodeLike }).defaultVariant ??
          variantNodesOf(node)[0])
        : node;
    const defaultOnly = defaultNode ? ownersIn(defaultNode, new Set()) : new Set<string>();
    const everyVariant = new Set<string>();
    for (const v of variantNodesOf(node)) ownersIn(v, everyVariant);
    const extra = [...everyVariant].filter((o) => !defaultOnly.has(o));
    if (extra.length > 0) widened.push(`${node.name}⊃${extra.join('+')}`);
    // The plugin's own answer must be the every-variant one, not the old one.
    const reported = new Set(out.sets.find((s) => s.name === node.name)?.nestedInstances ?? []);
    assert(
      [...everyVariant].every((o) => reported.has(o)),
      `§0b ${node.name}: the plugin reports every nested instance found across ALL variants (missing ${[...everyVariant].filter((o) => !reported.has(o)).join(', ')})`,
    );
  }
  assert(
    widened.length > 0,
    '§0b the corpus contains at least one set whose non-default variant hosts an instance the default variant does not — without a witness this fix is untested, and the pin above would hold for a plugin that still probed defaultVariant only',
  );
  console.log(
    `  §0b plugin EXECUTED      ${out.sets.length} sets / ${rows.length} rows, every row v6-stamped AND recomputed, recompute ≡ stamp on an untouched canvas, 0 unresolved names`,
  );
  console.log(
    `  §0b nestedInstances      every-variant walk beats a defaultVariant-only walk on ${widened.length} set(s): ${widened.join(', ')} — invisible to diff.ts componentRefsOf check before this round`,
  );
}

// ── §0c VARIABLE LOOKUP FAILS LOUD ─────────────────────────────────────────
{
  const canvas = await compileMockCanvas(path.join(ROOT, 'contracts'));
  const out = await runPlugin(canvas, { variableLookupFailure: new Error('falsified variable API outage') });
  const rows = out.sets.flatMap((s) => s.variants);
  assert(
    rows.length > 0 &&
      rows.every(
        (r) =>
          r.live === null &&
          r.liveSnapshot === null &&
          /variable-name preload failed.*falsified variable API outage/.test(r.measurementError ?? ''),
      ),
    '§0c a variable-name preload failure yields null live measurements WITH useful error evidence on every variant',
  );
  assert(
    out.sets.every(
      (s) =>
        s.setLive === null &&
        /variable-name preload failed.*falsified variable API outage/.test(s.setMeasurementError ?? ''),
    ),
    '§0c the same variable lookup failure is explicit on component-set metadata measurements',
  );
  console.log(`  §0c lookup failure loud  ${rows.length} variant measurements refused with preserved variable API evidence`);
}

// ── §1 PRISTINE ────────────────────────────────────────────────────────────
const pristineRun = runDiffer(path.join(FIXTURES, 'pristine'), 'pristine');
const pristine = pristineRun.canvas;
assert(
  pristine.length === 0,
  `§1 the differ reports the UNTOUCHED fixture clean on the canvas surface — ${pristine.length} finding(s): ${pristine.map((f) => `${f.driftKind} ${f.subject}`).join(' , ')}`,
);
// The clean verdict must be clean BECAUSE it compared, not because it found
// nothing to compare. A fixture that stopped carrying `variants` would also
// print zero canvas findings — and would print the not-extracted gap instead,
// which §3 pins; here we pin the positive side by counting the rows.
const pristineDoc = JSON.parse(readFileSync(path.join(FIXTURES, 'pristine', 'figma-components.json'), 'utf8')) as {
  sets: Array<{ name: string; variants?: VariantRow[] }>;
};
const comparedRows = pristineDoc.sets.reduce((n, s) => n + (s.variants?.length ?? 0), 0);
assert(
  pristineDoc.sets.length === FIXTURE_SETS.length && comparedRows > 0,
  `§1 the clean verdict compared something: ${pristineDoc.sets.length} sets / ${comparedRows} variant rows`,
);
assert(
  pristineDoc.sets.every((s) => (s.variants ?? []).every((v) => typeof v.live === 'string' && v.live.startsWith('v6:'))),
  '§1 every pristine row carries a non-null v6 `live` recompute — a null `live` is "not compared", and a fixture full of them would pass §1 for the wrong reason',
);
console.log(`  §1 pristine clean        0 canvas findings over ${pristineDoc.sets.length} sets / ${comparedRows} variant rows, every row carrying a v6 recompute`);

// ── §2 EDITED — THE EXIT CRITERION ─────────────────────────────────────────
const edited = runDiffer(path.join(FIXTURES, 'edited'), 'edited').canvas;
assert(
  edited.length === 1,
  `§2 the differ reports EXACTLY ONE canvas finding over the hand-edited fixture — got ${edited.length}: ${edited.map((f) => `${f.driftKind} ${f.subject}`).join(' , ')}`,
);
const hit = edited[0];
assert(hit.driftKind === 'canvas-edited', `§2 the finding is classified 'canvas-edited' (got ${hit.driftKind})`);
assert(
  hit.subject === `${SUBJECT_SET} / ${SUBJECT_VARIANT}`,
  `§2 the finding NAMES THE VARIANT, not just the set — expected "${SUBJECT_SET} / ${SUBJECT_VARIANT}", got "${hit.subject}"`,
);
const lines = hit.lines ?? [];
assert(lines.length > 0, '§2 the finding carries the snapshot line diff (a verdict with no lines is an accusation, not a report)');
const layoutLine = lines.find((c) => c.what.endsWith(`${SUBJECT_PART}|layout`));
assert(layoutLine, `§2 the line diff names the edited PART's layout channel (…${SUBJECT_PART}|layout) — got: ${lines.map((c) => c.what).join(', ')}`);
assert(
  /pad 8,12,8,12/.test(layoutLine!.was) && /pad 8,12,8,24/.test(layoutLine!.now),
  `§2 the layout line carries the padding move 12 → 24 (was "${layoutLine!.was}", now "${layoutLine!.now}")`,
);
assert(
  /gap 8 /.test(layoutLine!.was) && /gap 16 /.test(layoutLine!.now),
  `§2 the layout line carries the itemSpacing move 8 → 16 (was "${layoutLine!.was}", now "${layoutLine!.now}")`,
);
assert(
  /\/CENTER /.test(layoutLine!.was) && /\/MAX /.test(layoutLine!.now),
  `§2 the layout line carries the counter-axis move CENTER → MAX (was "${layoutLine!.was}", now "${layoutLine!.now}")`,
);
const detached = lines.find((c) => c.what.endsWith('bound:paddingLeft') && c.now === '(removed)');
assert(
  detached,
  `§2 the line diff names the DETACHED binding as removed (…|bound:paddingLeft → (removed)) — the edit v5 could not see at all; got: ${lines.map((c) => `${c.what} ${c.was}→${c.now}`).join(' | ')}`,
);
console.log(`  §2 hand edit CAUGHT      ${hit.subject} — ${lines.length} line(s):`);
for (const c of lines) console.log(`       ${c.what}: ${c.was} → ${c.now}`);

// ── §2b FAILED MEASUREMENT FAILS CLOSED ────────────────────────────────────
const failedMeasurementDir = path.join(scratch, 'failed-measurement');
mkdirSync(failedMeasurementDir, { recursive: true });
{
  const doc = JSON.parse(readFileSync(path.join(FIXTURES, 'pristine', 'figma-components.json'), 'utf8')) as {
    sets: Array<{ variants?: VariantRow[] }>;
  };
  const rows = doc.sets.flatMap((s) => s.variants ?? []);
  rows[0].live = null;
  rows[0].measurementError = 'fingerprint recomputation returned null';
  delete (rows[1] as Partial<VariantRow>).live;
  rows[1].measurementError = 'fingerprint recomputation threw: falsified getter explosion';
  delete (rows[2] as Partial<VariantRow>).live;
  rows[2].measurementError = null;
  writeFileSync(path.join(failedMeasurementDir, 'figma-components.json'), JSON.stringify(doc, null, 2));
}
const failedMeasurements = runDiffer(failedMeasurementDir, 'failed-measurement').canvas.filter(
  (f) => f.driftKind === 'measurement-failed',
);
assert(
  failedMeasurements.length === 3,
  `§2b null, undefined, and throwing live recomputations each fail closed as measurement-failed — got ${failedMeasurements.length}`,
);
assert(
  failedMeasurements.some((f) => /returned null/.test(f.detail)) &&
    failedMeasurements.some((f) => /getter explosion/.test(f.detail)) &&
    failedMeasurements.some((f) => /no fingerprint and no error evidence/.test(f.detail)),
  `§2b measurement failures preserve thrown/null evidence and name missing evidence honestly — got: ${failedMeasurements.map((f) => f.detail).join(' | ')}`,
);
console.log('  §2b measurement closed   null + undefined + throw evidence each report blocking measurement-failed');

// ── §2c COMPONENT-SET METADATA EDIT ───────────────────────────────────────
const setEditDir = path.join(scratch, 'set-metadata-edit');
mkdirSync(setEditDir, { recursive: true });
{
  const doc = JSON.parse(readFileSync(path.join(FIXTURES, 'pristine', 'figma-components.json'), 'utf8')) as {
    sets: PluginSet[];
  };
  const set = doc.sets.find((s) => s.name === SUBJECT_SET)!;
  const liveSetSnapshot =
    set.setLiveSnapshot ?? fail('pin failed: §2c fixture carries a live component-set metadata snapshot');
  const line = liveSetSnapshot.findIndex((l) => l.includes('|description|'));
  assert(line >= 0, '§2c fixture carries a component-set description snapshot line to falsify');
  liveSetSnapshot[line] = liveSetSnapshot[line].replace('generated from contract', 'hand edited in Figma');
  set.setLive = 'v6:999';
  writeFileSync(path.join(setEditDir, 'figma-components.json'), JSON.stringify(doc, null, 2));
}
const setEdit = runDiffer(setEditDir, 'set-metadata-edit').canvas;
assert(
  setEdit.length === 1 &&
    setEdit[0].driftKind === 'canvas-edited' &&
    setEdit[0].subject === `${SUBJECT_SET} / (component set)`,
  `§2c a set description edit is blocking canvas-edited on the component set — got ${setEdit.map((f) => `${f.driftKind} ${f.subject}`).join(', ')}`,
);
assert(
  (setEdit[0].lines ?? []).some((line) => line.what.endsWith('|description')),
  `§2c the set metadata finding carries the changed description line — got ${(setEdit[0].lines ?? []).map((l) => l.what).join(', ')}`,
);
console.log('  §2c set metadata caught  component-set description edit reports blocking canvas-edited');

// ── §3 ABSENCE IS A NAMED GAP ──────────────────────────────────────────────
// The single place this work could quietly become a false receipt: a snapshot
// with no `variants` at all must report NOT EXTRACTED, never "no drift".
const strippedDir = path.join(scratch, 'stripped');
mkdirSync(strippedDir, { recursive: true });
{
  const doc = JSON.parse(readFileSync(path.join(FIXTURES, 'edited', 'figma-components.json'), 'utf8')) as {
    sets: Array<Record<string, unknown>>;
  };
  for (const s of doc.sets) delete s.variants;
  writeFileSync(path.join(strippedDir, 'figma-components.json'), JSON.stringify(doc, null, 2));
}
const strippedRun = runDiffer(strippedDir, 'stripped');
const strippedAbsent = strippedRun.unmeasured.filter((f) => f.driftKind === 'not-extracted');
assert(
  strippedAbsent.length === 1,
  `§3 a snapshot with NO \`variants\` lands exactly one not-extracted entry in the NOT-MEASURED bucket — got ${strippedRun.unmeasured.length}: ${strippedRun.unmeasured.map((f) => `${f.driftKind} ${f.subject}`).join(' , ')}`,
);
assert(
  !strippedRun.canvas.some((f) => f.driftKind === 'canvas-edited'),
  '§3 the very same HAND-EDITED fixture, with the transport removed, reports NO canvas-edited finding — proving the verdict comes from the wire and not from somewhere else',
);
assert(
  /NOT CHECKED|not checked/i.test(strippedAbsent[0].detail) && /3 of 3/.test(strippedAbsent[0].detail),
  `§3 the gap says how many sets went unchecked and that they went UNCHECKED, not clean (got: ${strippedAbsent[0].detail})`,
);
// THE BANNER IS THE FALSE RECEIPT. A reader who stops at line one must not
// read the word "clean" over a surface nobody looked at. This is the pin that
// makes the unmeasured bucket honest rather than a quiet exemption.
assert(
  !/✔ Parity clean/.test(strippedRun.stdout),
  `§3 the differ REFUSES the "✔ Parity clean" banner while anything is unmeasured — that banner over an unread canvas surface is the exact false receipt this bucket exists to prevent. Got:\n${strippedRun.stdout.split('\n').slice(0, 4).join('\n')}`,
);
assert(
  /NOT MEASURED/.test(strippedRun.stdout),
  `§3 the console names the NOT MEASURED section, not only report.json (a gap only a machine can see is a gap nobody reads). Got:\n${strippedRun.stdout.split('\n').slice(0, 6).join('\n')}`,
);
// …and the pristine fixture, which IS fully extracted on the canvas-variant
// surface, must not carry a not-extracted gap — otherwise §1's "clean" would
// be hiding behind the same exemption. Other named unmeasured surfaces
// (slot-pre-native: the fixture predates native SLOT properties) are allowed;
// they are not this section's subject.
assert(
  !pristineRun.unmeasured.some((f) => f.driftKind === 'not-extracted'),
  `§3 the fully-extracted fixture has no not-extracted gap, so §1's clean verdict is not standing on an unread canvas (got ${pristineRun.unmeasured.map((f) => f.driftKind).join(', ')})`,
);
console.log(`  §3 absence named         ${strippedAbsent[0].detail.slice(0, 110)}… — and the "Parity clean" banner is refused`);

// ── §4 VERSION HONESTY (+ the unstamped branch) ────────────────────────────
// Both are applied to the HAND-EDITED fixture on purpose: an incomparable
// stamp must suppress the canvas-edited verdict, because "edited" over a
// stamp you cannot compare is a false alarm on a file nobody touched.
const oldDir = path.join(scratch, 'oldstamp');
mkdirSync(oldDir, { recursive: true });
{
  const doc = JSON.parse(readFileSync(path.join(FIXTURES, 'edited', 'figma-components.json'), 'utf8')) as {
    sets: Array<{ name: string; variants?: VariantRow[] }>;
  };
  const rows = doc.sets.flatMap((s) => s.variants ?? []);
  for (const v of rows) v.fingerprint = (v.fingerprint ?? '').replace(/^v6:/, 'v5:');
  // The LAST row, deliberately not the hand-edited one — §4 needs the
  // version verdict to land ON the edited variant to prove it suppresses
  // 'canvas-edited', and a separate row to prove the unstamped branch.
  rows[rows.length - 1].fingerprint = null; // never stamped at all
  writeFileSync(path.join(oldDir, 'figma-components.json'), JSON.stringify(doc, null, 2));
}
const older = runDiffer(oldDir, 'oldstamp').canvas;
const versioned = older.filter((f) => f.driftKind === 'version-changed');
const unstamped = older.filter((f) => f.driftKind === 'unstamped');
assert(
  versioned.length === 8 && unstamped.length === 1 && older.length === 9,
  `§4 8 older stamps report 'version-changed' and the 1 missing stamp reports 'unstamped' — got ${older.map((f) => f.driftKind).join(', ')}`,
);
assert(
  !older.some((f) => f.driftKind === 'canvas-edited'),
  '§4 an incomparable stamp is NEVER reported as canvas-edited — that would be a false alarm on an untouched file (the entry.ts:842 rule, one spelling)',
);
assert(
  versioned.some((f) => f.subject === `${SUBJECT_SET} / ${SUBJECT_VARIANT}`),
  '§4 the version verdict is per-variant too, named the same way — including over the row that WAS hand-edited',
);
console.log(`  §4 version honesty       ${versioned.length} version-changed + ${unstamped.length} unstamped, 0 canvas-edited (over the EDITED fixture)`);

// ── §5 THE OFFLINE COMPILE ACTUALLY RAN AND COMPARED ───────────────────────
// Without this section the compile is dead weight in the green path: §1 is
// clean whether the contract compile matched every row or produced NOTHING
// AT ALL, because an unmatched set simply skips the contract axis. So move
// ONE row's stamp AND its recompute to the same bogus hash — no hand edit,
// just a canvas generated from a different contract revision — and require
// the differ to name it AND to quote the fingerprint the compile derived.
const divergentDir = path.join(scratch, 'divergent');
mkdirSync(divergentDir, { recursive: true });
let compiledWant = '';
{
  const doc = JSON.parse(readFileSync(path.join(FIXTURES, 'pristine', 'figma-components.json'), 'utf8')) as {
    sets: Array<{ name: string; variants?: VariantRow[] }>;
  };
  const row = doc.sets.find((s) => s.name === SUBJECT_SET)!.variants!.find((v) => v.name === SUBJECT_VARIANT)!;
  compiledWant = row.fingerprint!; // what the contract compiles to, today
  row.fingerprint = 'v6:1';
  row.live = 'v6:1'; // stamp and recompute AGREE — nobody edited the canvas
  writeFileSync(path.join(divergentDir, 'figma-components.json'), JSON.stringify(doc, null, 2));
}
const divergentRun = runDiffer(divergentDir, 'divergent');
const divergent = divergentRun.canvas;
const divergentInfo = divergentRun.unmeasured.filter((f) => f.driftKind === 'contract-divergent-informational');
const sabotaged = divergentInfo.find((f) => f.subject === `${SUBJECT_SET} / ${SUBJECT_VARIANT}`);
assert(
  divergent.length === 0 && sabotaged,
  `§5 mock-to-live contract divergence is visible but non-blocking pending a real-Figma compatibility receipt — blocking=${divergent.length}, informational=${divergentInfo.length} (wanted subject ${SUBJECT_SET} / ${SUBJECT_VARIANT})`,
);
assert(
  sabotaged!.detail.includes(compiledWant),
  `§5 the informational comparison quotes the fingerprint the OFFLINE COMPILE derived (${compiledWant}) — this pins that the compile actually ran. Got: ${sabotaged!.detail}`,
);
console.log(`  §5 offline compile info  non-blocking contract divergence on ${sabotaged!.subject}, quoting ${compiledWant}`);

// ── §6 THE PARTIAL-CHECKOUT CALLER ─────────────────────────────────────────
// site/src/how-replays.ts:135 and evals/run.ts both run this differ from a
// scratch that carries contracts/tokens/scripts/core/parity/src/packages and
// NOT figma-sync — so buildEngineBundle, which esbuilds from
// figma-sync/plugin/engine/entry.ts, cannot run there. Reproduce that caller
// exactly and require two things: the hand edit is STILL caught (it needs no
// compile), and the missing contract axis is NAMED rather than passing as
// agreement.
{
  const partial = path.join(scratch, 'partial');
  mkdirSync(partial, { recursive: true });
  for (const dir of ['contracts', 'tokens', 'scripts', 'core', 'parity', 'src', 'packages']) {
    cpSync(path.join(ROOT, dir), path.join(partial, dir), {
      recursive: true,
      filter: dir === 'packages' ? (src: string) => path.basename(src) !== 'dist' : undefined,
    });
  }
  for (const f of ['package.json', 'tsconfig.json']) cpSync(path.join(ROOT, f), path.join(partial, f));
  symlinkSync(path.join(ROOT, 'node_modules'), path.join(partial, 'node_modules'), 'dir');
  assert(!existsSync(path.join(partial, 'figma-sync')), '§6 the partial checkout genuinely lacks figma-sync (otherwise the compile would succeed and this section would prove nothing)');

  const report = path.join(scratch, 'partial.report.json');
  const r = spawnSync(TSX, ['parity/diff.ts'], {
    cwd: partial,
    encoding: 'utf8',
    env: {
      ...process.env,
      PARITY_SNAPSHOT_DIR: path.join(FIXTURES, 'edited'),
      PARITY_REPORT: report,
      MAX_SNAPSHOT_AGE_DAYS: '100000',
    },
  });
  assert(r.status !== null && r.status <= 1, `§6 the differ completed in the partial checkout (exit ${r.status})\n${r.stdout ?? ''}${r.stderr ?? ''}`);
  const doc = JSON.parse(readFileSync(report, 'utf8')) as {
    findings: ReportFinding[];
    unmeasured: Array<{ subject: string; driftKind: string }>;
  };
  const canvas = doc.findings.filter((f) => f.surface === 'figma-canvas');
  assert(
    canvas.length === 1 && canvas[0].driftKind === 'canvas-edited' && canvas[0].subject === `${SUBJECT_SET} / ${SUBJECT_VARIANT}`,
    `§6 the HAND EDIT is still caught with no engine to compile against — got ${canvas.map((f) => `${f.driftKind} ${f.subject}`).join(' , ') || '(nothing)'}`,
  );
  assert(
    doc.unmeasured.some((u) => u.driftKind === 'compile-unavailable'),
    `§6 the missing contract axis is NAMED as unmeasured, not silently skipped — got ${doc.unmeasured.map((u) => u.driftKind).join(', ') || '(empty bucket)'}`,
  );
  console.log(
    `  §6 partial checkout      no figma-sync ⇒ no engine bundle: the hand edit is STILL caught (${canvas[0].subject}) and the contract axis is named 'compile-unavailable', not passed as agreement`,
  );
}

rmSync(scratch, { recursive: true, force: true });

console.log(
  `\n✔ variant-drift-check: the DIFFER catches a hand-made change to a part's layout inside ONE variant.\n` +
    `  parity/diff.ts, run over ${path.relative(ROOT, path.join(FIXTURES, 'edited'))}, names ${SUBJECT_SET} / ${SUBJECT_VARIANT} and prints the four edited channels;\n` +
    `  run over ${path.relative(ROOT, path.join(FIXTURES, 'pristine'))} it reports the canvas surface clean; with the transport stripped it reports NOT EXTRACTED, not clean.`,
);
