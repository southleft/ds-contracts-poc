/**
 * PLUGIN ENGINE HEADLESS CHECK — `node scripts/plugin-engine-check.mjs`.
 *
 * The core-browser-check VM pattern applied to the Figma plugin: build the
 * REAL engine bundle (the bytes the zip embeds in ui.html), load it in a VM
 * `window` sandbox, and drive every plugin flow against a mocked `figma`
 * global (scripts/plugin-engine-mock-figma.mjs) — no Figma, no network:
 *
 *   1. bundle    — fresh esbuild output matches the committed drift-guard
 *                  receipt (figma-sync/plugin/engine.receipt.json)
 *   2. generate  — Badge contract → tokens + component + version-marker
 *                  scripts EXECUTED in the mock file; the stored
 *                  ds_contracts/specHash equals the engine's mirror (the
 *                  update report's "unchanged" detection can never drift
 *                  from the emitted runtime silently)
 *   3. ordering  — a bundle whose contract references others syncs the
 *                  dependencies first (sortByDependencies closure)
 *   4. update    — the EXACT plain-words change report (unchanged / new /
 *                  version → version with +prop), then Apply amends in
 *                  place: same node id, props added, markers updated
 *   5. propose   — the ui.html-embedded dump script runs against the mock
 *                  file; proposeDiff yields a proposal + bounded API diff
 *                  (a mutated base surfaces its +prop/default lines)
 *   6. pr        — the dry-run PR plan, exact lines, zero network
 *
 * Every ✔ line below is pinned by evals (plugin-engine-bundle,
 * plugin-update-report, plugin-propose-dry-run).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { buildEngineBundle, verifyEngineReceipt } from './build-plugin-zip.mjs';
import { createFigmaMock } from './plugin-engine-mock-figma.mjs';

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const fail = (msg) => {
  console.error(`✖ plugin-engine-check: ${msg}`);
  process.exit(1);
};
const assert = (cond, what) => {
  if (!cond) fail(`pin failed: ${what}`);
};

// --- 1. bundle + drift-guard receipt ---------------------------------------
const bundle = await buildEngineBundle();
await verifyEngineReceipt(bundle);
console.log(
  `✔ engine bundle fresh vs committed receipt: ${bundle.minifiedBytes} bytes minified, ${bundle.inputFiles} inputs, hash ${bundle.inputHash.slice(0, 12)}…`,
);

// --- load the bundle in a bare VM (window sandbox, no node globals) --------
const { figma, root } = createFigmaMock();
const sandbox = { window: {}, console: { log() {}, warn() {}, error() {} } };
vm.createContext(sandbox);
vm.runInContext(bundle.code, sandbox, { timeout: 120_000 });
const DSC = sandbox.window.DSC;
assert(DSC && typeof DSC.planGenerate === 'function', 'window.DSC exposes the engine API');

// Script executor — code.js's runScript, replayed against the mock figma.
const scriptContext = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
const runScript = (code) =>
  vm.runInContext(`(async () => {\n${code}\n})()`, scriptContext, { timeout: 120_000 });

const markerOf = (contractId) =>
  root.findOne(
    (n) =>
      (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') &&
      n.getSharedPluginData('ds_contracts', 'contractId') === contractId,
  );

// --- 2. generate: Badge ----------------------------------------------------
const badge = JSON.parse(read('contracts/badge.contract.json'));
{
  const parsed = DSC.parseIncomingText(read('contracts/badge.contract.json'));
  assert(parsed.ok && parsed.kind === 'contract', 'badge parses as a single contract document');
  const plan = DSC.planGenerate(parsed.contracts, { withTokens: true, fileKey: '' });
  assert(plan.ok, `badge generate plan is accepted (${plan.ok ? '' : plan.issues.map((i) => i.headline).join('; ')})`);
  assert(plan.steps[0].kind === 'tokens', 'tokens script runs first');
  for (const step of plan.steps) await runScript(step.code);
  const node = markerOf(badge.id);
  assert(node, 'a node carrying the ds_contracts/contractId marker exists after generate');
  const stored = node.getSharedPluginData('ds_contracts', 'specHash');
  const mirror = DSC.specHashOf(badge);
  assert(stored !== '' && stored === mirror, `stored specHash (${stored}) equals the engine mirror (${mirror}) — the runtime and the report can never disagree silently`);
  assert(node.getSharedPluginData('ds_contracts', 'version') === badge.version, 'version marker recorded');
  console.log(
    `✔ headless generate: Badge v${badge.version} synced into the mock file (${node.type}, node ${node.id}); stored specHash equals the engine mirror (${mirror})`,
  );
}

// --- 3. bundle ordering (dependencies first) -------------------------------
{
  // Find a shipping contract that references other contracts.
  let composite = null;
  const { readdirSync } = await import('node:fs');
  for (const f of readdirSync(path.join(ROOT, 'contracts')).sort()) {
    if (!f.endsWith('.contract.json')) continue;
    const c = JSON.parse(read(`contracts/${f}`));
    const text = JSON.stringify(c.anatomy);
    if (text.includes('"component"')) {
      composite = c;
      break;
    }
  }
  assert(composite, 'a composite contract (component refs) exists in contracts/');
  const plan = DSC.planGenerate([composite], { withTokens: false, fileKey: '' });
  assert(plan.ok, `composite plan accepted (${plan.ok ? '' : plan.issues.map((i) => i.headline).join('; ')})`);
  const componentSteps = plan.steps.filter((s) => s.kind === 'component');
  assert(componentSteps.length > 1, `composite plan syncs its dependencies too (${componentSteps.length} component steps)`);
  assert(
    componentSteps[componentSteps.length - 1].contractId === composite.id,
    'the composite itself runs LAST (dependencies first)',
  );
  console.log(
    `✔ bundle order: ${composite.id} plans ${componentSteps.length} component scripts, dependencies first (${componentSteps.map((s) => s.contractId).join(' → ')})`,
  );
}

// --- 4. update-library report + apply --------------------------------------
{
  // v-next Badge: bumped version + one added boolean prop.
  const vNext = JSON.parse(JSON.stringify(badge));
  vNext.version = '9.9.9';
  vNext.props.push({
    name: 'experimental',
    description: 'Harness-added boolean prop (update-report fixture).',
    type: 'boolean',
    default: false,
    bindings: { figma: { kind: 'BOOLEAN', property: 'Experimental' }, code: { prop: 'experimental' } },
  });
  const switchContract = JSON.parse(read('contracts/switch.contract.json'));

  const inventoryMsg = await runScript(DSC.inventoryScriptSource());
  const inventory = inventoryMsg.inventory;
  assert(Array.isArray(inventory) && inventory.length >= 1, 'inventory scan finds the marked Badge');

  const plan = DSC.updatePlan([vNext, switchContract], inventory);
  assert(
    plan.lines[0] === `• Badge ${badge.version} → 9.9.9: +prop Experimental.`,
    `amend line reads exactly: "• Badge ${badge.version} → 9.9.9: +prop Experimental." (got "${plan.lines[0]}")`,
  );
  assert(
    plan.lines[1].startsWith(`• Switch ${switchContract.version}: new — will be created (`),
    `new line reads "• Switch ${switchContract.version}: new — will be created (…)" (got "${plan.lines[1]}")`,
  );
  assert(
    plan.lines[2] === '1 to update · 1 new · 0 unchanged.',
    `counts line reads "1 to update · 1 new · 0 unchanged." (got "${plan.lines[2]}")`,
  );
  assert(
    plan.lines[3] === 'Nothing has been applied — review the list, then Apply.',
    'the report ends with the nothing-applied tail',
  );
  const planSame = DSC.updatePlan([badge], inventory);
  assert(
    planSame.lines[0] === `• Badge ${badge.version}: unchanged — will be skipped.`,
    `unchanged line reads exactly: "• Badge ${badge.version}: unchanged — will be skipped." (got "${planSame.lines[0]}")`,
  );
  const planDup = DSC.updatePlan([badge, vNext], inventory);
  assert(
    planDup.rows[1].action === 'refused' && planDup.rows[1].line.includes('twice'),
    'a bundle carrying the same contract id twice is refused BY NAME',
  );
  console.log('✔ update report (before anything applies):');
  for (const line of plan.lines) console.log(`    ${line}`);
  console.log(`    ${planSame.lines[0]}`);

  // Apply the amend only; the Badge node must be amended IN PLACE.
  const before = markerOf(badge.id);
  const beforeId = before.id;
  const apply = DSC.updateApplySteps([vNext, switchContract], [vNext.id], { fileKey: '' });
  assert(apply.ok, `apply plan accepted (${apply.ok ? '' : apply.issues.map((i) => i.headline).join('; ')})`);
  let amendReport = null;
  for (const step of apply.steps) {
    const result = await runScript(step.code);
    if (step.kind === 'component' && result && result.results) amendReport = result.results[0];
  }
  assert(amendReport && amendReport.amended === true, 'apply amends (not recreates) the existing set');
  assert(amendReport.nodeId === beforeId, `node id preserved across the amend (${beforeId})`);
  assert(
    Array.isArray(amendReport.addedProps) && amendReport.addedProps.includes('Experimental'),
    'the amend report names the added property',
  );
  const after = markerOf(badge.id);
  assert(after.getSharedPluginData('ds_contracts', 'version') === '9.9.9', 'version marker updated by apply');
  assert(
    after.getSharedPluginData('ds_contracts', 'specHash') === DSC.specHashOf(vNext),
    'specHash marker updated to the v-next mirror',
  );
  console.log(
    `✔ apply: Badge amended in place (same node ${beforeId}), +prop Experimental, markers updated to v9.9.9`,
  );
}

// --- 5. propose change: dump the mock canvas → diff vs the base ------------
{
  // The dump script exactly as the plugin runs it: the ui.html #dump-source
  // block (drift-guarded against extract/figma/dump.plugin.js), TARGET_SETS
  // scoped the way the Propose tab scopes it.
  const ui = read('figma-sync/plugin/ui.html');
  const openTag = '<script type="text/plain" id="dump-source">';
  const start = ui.indexOf(openTag);
  assert(start >= 0, 'ui.html carries the #dump-source block');
  const source = ui.slice(start + openTag.length, ui.indexOf('</script>', start)).replace(/^\n/, '');
  const scoped = source.replace(
    /^const TARGET_SETS = \[[^\n]*\];$/m,
    `const TARGET_SETS = ${JSON.stringify(['Badge'])};`,
  );
  assert(scoped !== source, 'the dump script TARGET_SETS seam scopes');
  const dump = await runScript(scoped);
  assert(dump && dump.Badge, 'the dump captures the mock-built Badge set');

  const diff = DSC.proposeDiff(dump, 'Badge', badge);
  assert(diff.ok, `proposeDiff proposes from the drawn set (${diff.ok ? '' : diff.issue.headline})`);
  assert(
    diff.summaryLines[diff.summaryLines.length - 1].startsWith('Scope: this diff covers the API surface'),
    'the diff ends with its named scope note',
  );
  const exported = JSON.parse(diff.exportJson);
  assert(
    exported.type === 'CONTRACT-PROPOSAL' && exported.baseContractId === badge.id && exported.proposedContract,
    'the export artifact carries base id/version + the proposed contract',
  );

  // Delta detection: a base missing a prop the drawn set carries must
  // surface it as +prop; a changed default must surface the default line.
  const enumProp = badge.props.find((p) => p.type && p.type.enum && p.default !== undefined);
  assert(enumProp, 'badge has an enum prop with a default (diff fixture)');
  const mutatedBase = JSON.parse(JSON.stringify(badge));
  mutatedBase.props = mutatedBase.props.filter((p) => p.name !== enumProp.name);
  const diffMut = DSC.proposeDiff(dump, 'Badge', mutatedBase);
  assert(diffMut.ok, 'proposeDiff vs the mutated base succeeds');
  assert(
    diffMut.summaryLines.some((l) => l.startsWith(`+prop ${enumProp.name} `)),
    `the diff surfaces the drawn-but-missing prop as "+prop ${enumProp.name} …" (got: ${diffMut.summaryLines.join(' | ')})`,
  );
  console.log(
    `✔ propose: mock canvas dumped through the embedded dump script → proposal + bounded diff; a base missing "${enumProp.name}" surfaces "+prop ${enumProp.name}" by name`,
  );
}

// --- 6. PR dry-run plan ----------------------------------------------------
{
  const lines = DSC.prDryRunLines({
    owner: 'acme',
    repo: 'design-system',
    base: 'main',
    path: 'contracts/badge.contract.json',
    contractJson: '{}',
    contractId: badge.id,
    baseVersion: badge.version,
    summaryLines: ['+prop experimental (boolean)'],
    branchSuffix: 'fixture',
  });
  const expected = [
    'DRY RUN — no request leaves this window. The live run would:',
    '1. Confirm base branch "main" exists — GET https://api.github.com/repos/acme/design-system/git/ref/heads/main',
    '2. Create branch ds-contracts/propose-ds.badge-fixture — POST https://api.github.com/repos/acme/design-system/git/refs',
    '3. Commit contracts/badge.contract.json on ds-contracts/propose-ds.badge-fixture — PUT https://api.github.com/repos/acme/design-system/contents/contracts/badge.contract.json',
    '4. Open the pull request — POST https://api.github.com/repos/acme/design-system/pulls',
    'Branch: ds-contracts/propose-ds.badge-fixture',
    "Token: used for these requests only, kept in this window's memory, never stored.",
  ];
  for (let i = 0; i < expected.length; i++) {
    assert(lines[i] === expected[i], `PR dry-run line ${i + 1} reads exactly "${expected[i]}" (got "${lines[i]}")`);
  }
  console.log('✔ PR dry-run plan: 4 named REST steps, deterministic branch, session-only token note — zero network');
}

// --- N. multi-root composite (depth Stage C) builds via the LIVE plugin path
// The exact path `ds-contracts figma push` + the plugin's Receive-by-code
// trigger: parse a CONTRACTS-BUNDLE, planGenerate (tokens first, deps ordered),
// execute in the mock, and confirm the advanced composite's anatomy — a
// multi-root Modal whose body holds a nested ds.card INSTANCE and a tags ROW of
// N ds.badge INSTANCEs. Proves the packaged engine (window.DSC) — not just the
// raw emitter — reproduces code≡canvas for advanced composition.
{
  const composite = JSON.parse(read('examples/depth-composite/composite-modal.contract.json'));
  const deps = ['card', 'badge', 'avatar', 'button'].map((n) =>
    JSON.parse(read(`contracts/${n}.contract.json`)),
  );
  const bundleText = JSON.stringify({ type: 'CONTRACTS-BUNDLE', version: 1, contracts: [composite, ...deps] });
  const parsed = DSC.parseIncomingText(bundleText);
  assert(parsed.ok && parsed.kind === 'bundle', 'composite CONTRACTS-BUNDLE parses');
  const plan = DSC.planGenerate(parsed.contracts, { withTokens: true, fileKey: '' });
  assert(plan.ok, `composite plan accepted (${plan.ok ? '' : plan.issues.map((i) => i.headline).join('; ')})`);
  assert(plan.steps[0].kind === 'tokens', 'composite plan runs tokens first');
  for (const step of plan.steps) {
    // LIVE FINDING 2026-07-22 (pinned by the named refusal + Desktop Bridge):
    // a fresh instance's componentProperties can LAG behind its set within a
    // session, listing only VARIANT axes. Simulate the lag on the Button set
    // for the composite step — the runtime must still resolve + apply the
    // footer Label via the set's componentPropertyDefinitions (the full-key
    // setProperties path that probe-verified works during the lag).
    if (step.kind === 'component' && step.contractId === 'ds.composite-modal') {
      const buttonSet = root.findOne(
        (n) => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === 'ds.button',
      );
      assert(buttonSet, 'the Button set exists before the composite step (lag-simulation target)');
      buttonSet._hideNonVariantOnInstances = true;
    }
    await runScript(step.code);
  }
  const built = root.findOne((n) => n.type === 'COMPONENT' && n.name === 'CompositeModal');
  assert(built, 'the plugin engine built the CompositeModal COMPONENT');
  const b = (s) => (s ?? '').replace(/ \d+$/, '');
  const kid = (n, nm) => (n?.children ?? []).find((c) => b(c.name) === nm) ?? null;
  const dialog = kid(built, 'dialog'), body = kid(dialog, 'body');
  const summary = kid(body, 'summary'), tagsRow = kid(body, 'tags');
  const tags = (tagsRow?.children ?? []).filter((c) => b(c.name) === 'tag' && c.type === 'INSTANCE');
  const roots = (built.children ?? []).map((c) => c.name);
  assert(roots.includes('dialog') && roots.includes('backdrop'), 'composite has dialog+backdrop sibling roots');
  assert(summary?.type === 'INSTANCE', 'body.summary is a nested ds.card INSTANCE');
  assert(tagsRow?.type === 'FRAME' && tags.length === 3, 'body.tags is a row FRAME of 3 ds.badge INSTANCEs');
  assert(built.getSharedPluginData('ds_contracts', 'contractId') === 'ds.composite-modal', 'composite identity marker recorded');

  // LIVE-CANVAS REGRESSIONS (2026-07-21, handoff 08#1) — the two composite
  // defects the real canvas caught and 146 headless gates missed. The mock
  // now models auto-layout sizing and instance-property reflection, so both
  // classes fail HERE, forever, before any live run:
  //   (1) the dialog must establish a real width — the hug↔fill degenerate
  //       collapsed it to ~3px live;
  //   (2) repeated set-instance TEXT properties must actually reflect on the
  //       instance's text nodes — live they kept the default "Badge".
  assert(
    dialog && dialog.width >= 200,
    `the dialog establishes a real width (got ${dialog?.width}px — the live collapse was ~3px)`,
  );
  const tagTexts = tags.map((t) => {
    const textNode = t.findAll((n) => n.type === 'TEXT' && n.characters)[0];
    return textNode ? textNode.characters : '(no text node)';
  });
  const wantTags = ['Shipping', 'Gift wrap', 'Priority'];
  assert(
    JSON.stringify(tagTexts) === JSON.stringify(wantTags),
    `repeated ds.badge instances carry the item text from the contract sample (want ${JSON.stringify(wantTags)}, got ${JSON.stringify(tagTexts)})`,
  );
  const summaryTitle = (summary?.findAll((n) => n.type === 'TEXT' && n.characters === 'Order summary') ?? []).length;
  assert(summaryTitle > 0, 'the composed ds.card instance reflects its Title ("Order summary") onto a text node');
  // v1.1.0 contract: the footer actions are ds.button SET-instances (the same
  // wiring class as the badges) with their Label text applied and a real gap.
  const footer = kid(dialog, 'footer');
  const footerTexts = (footer?.findAll((n) => n.type === 'TEXT') ?? []).map((n) => n.characters);
  assert(
    footerTexts.includes('Cancel') && footerTexts.includes('Save'),
    `footer ds.button instances reflect Cancel/Save labels (got ${JSON.stringify(footerTexts)})`,
  );
  assert(
    footer && (footer.itemSpacing > 0 || footer.boundVariables?.itemSpacing),
    `footer carries a real gap (itemSpacing ${footer?.itemSpacing}, bound ${JSON.stringify(footer?.boundVariables?.itemSpacing ?? null)})`,
  );
  const backdrop = kid(built, 'backdrop');
  assert(
    backdrop && backdrop.layoutPositioning === 'ABSOLUTE' && built.children[0] === backdrop,
    'the backdrop is an inset overlay painted BEHIND the dialog (first child, absolute)',
  );
  // Owner request (2026-07-21): every generated component is hosted on a
  // named SECTION with a background fill — never floating on the canvas.
  assert(
    built.parent?.type === 'SECTION' &&
      built.parent.getSharedPluginData('ds_contracts', 'hostFor') === 'ds.composite-modal' &&
      (built.parent.fills ?? []).length > 0 &&
      built.parent.width > built.width,
    `the composite is hosted on a marked, filled SECTION (parent ${built.parent?.type})`,
  );
  console.log(
    `✔ plugin path — multi-root composite: window.DSC parsed the pushed bundle, planned ${plan.steps.length} steps (tokens → deps → composite), executed in the mock, built CompositeModal {dialog, backdrop} with a nested ds.card summary INSTANCE + a tags row of ${tags.length} ds.badge INSTANCEs (code≡canvas, the live Receive result)`,
  );
}

// --- N+1. REVERSE JOURNEY (design→code) for the advanced composite ----------
// The composite built above (composite-plugin-path) is on the mock canvas.
// Dump it exactly as the Propose tab does and run design→contract: the
// proposed anatomy must RECOVER the advanced composition — both roots
// (dialog+backdrop), the composed ds.card INSTANCE, and the repeated ds.badge
// collection. Proves the design→code direction handles multi-root composites,
// the mirror of the emit-side multi-root work (extraction wraps in a single
// `root` — the COMPONENT-as-root convention — with dialog/backdrop as parts).
{
  const compositeC = JSON.parse(read('examples/depth-composite/composite-modal.contract.json'));
  const ui2 = read('figma-sync/plugin/ui.html');
  const openTag2 = '<script type="text/plain" id="dump-source">';
  const s2 = ui2.indexOf(openTag2);
  const src2 = ui2.slice(s2 + openTag2.length, ui2.indexOf('</script>', s2)).replace(/^\n/, '');
  const scoped2 = src2.replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify(['CompositeModal'])};`);
  const dump2 = await runScript(scoped2);
  assert(dump2 && dump2.CompositeModal, 'the dump captures the multi-root CompositeModal set');
  const diff2 = DSC.proposeDiff(dump2, 'CompositeModal', compositeC);
  assert(diff2.ok, `proposeDiff recovers a contract from the drawn composite (${diff2.ok ? '' : diff2.issue?.headline})`);
  const proposed = JSON.parse(diff2.exportJson).proposedContract;
  // walk the recovered anatomy (COMPONENT-as-root wrapper)
  const rootPart = proposed.anatomy?.root ?? Object.values(proposed.anatomy ?? {})[0];
  const rp = rootPart?.parts ?? {};
  const dialog = rp.dialog, backdrop = rp.backdrop;
  const body = dialog?.parts?.body;
  const summary = body?.parts?.summary;
  const tagsWrap = body?.parts?.tags;
  const tag = tagsWrap?.parts?.tag;
  assert(dialog && backdrop, 'design→code recovers BOTH roots (dialog + backdrop) of the multi-root composite');
  assert(summary?.component, 'design→code recovers the composed ds.card summary as an INSTANCE');
  assert(tag?.component && tag?.repeat, 'design→code recovers the repeated ds.badge collection (tags > tag, repeat + component)');
  console.log(
    `✔ reverse journey (design→code): the drawn composite dumps and proposes back a contract that recovers dialog+backdrop, a composed ${summary.component.id} INSTANCE, and a repeated ${tag.component.id} collection — advanced composition round-trips in BOTH directions`,
  );
}

console.log('plugin-engine-check: all flows green (bundle, generate, order, update-report, apply, propose-diff, pr-dry-run, composite-plugin-path, composite-reverse-journey)');
