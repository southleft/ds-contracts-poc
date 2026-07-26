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
 *                  place: same node id, props added, markers updated.
 *                  Plus G8 (a recolor-only update itemizes per channel —
 *                  no "interior/style changes" jargon) and G2 (the check
 *                  recomputes canvas state; a canvas-edited target warns
 *                  BY NAME and defaults UNCHECKED — the covenant repair)
 *   5. propose   — the ui.html-embedded dump script runs against the mock
 *                  file; proposeDiff yields a proposal + bounded API diff
 *                  (a mutated base surfaces its +prop/default lines)
 *   6. pr        — the dry-run PR plan, exact lines, zero network
 *   (2b. G9 — the baked sample bundle parses, plans tokens-first, builds)
 *   7. channel   — G1's plugin half: the apply log (root pluginData, key
 *                  fingerprint never the key), the FRESHNESS GUARD that
 *                  closes the silent-downgrade hole (an out-of-order
 *                  delivery unchecks every row and names both numbers,
 *                  while paste / pairing-code updates stay unchanged), and
 *                  the provenance line. The worker half lives in
 *                  workers/assist/test/channel.test.ts + the
 *                  `channel-round-trip` eval — this file runs under plain
 *                  node and cannot import the TypeScript worker.
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

// --- 2b. G9 sample-library cold start --------------------------------------
// The Generate tab's "Build the sample library" button feeds this exact
// bundle into the existing generate path — no paste, no repo. The pin: the
// baked export parses as a CONTRACTS-BUNDLE carrying the curated four,
// plans tokens-first, and BUILDS in the mock file.
{
  const json = DSC.sampleBundleJson();
  assert(typeof json === 'string' && json.length > 0, 'G9: the engine exports a baked sample bundle');
  const parsed = DSC.parseIncomingText(json);
  assert(parsed.ok && parsed.kind === 'bundle', 'G9: the sample bundle parses as a CONTRACTS-BUNDLE');
  const ids = parsed.contracts.map((c) => c.id);
  for (const want of ['ds.card', 'ds.badge', 'ds.avatar', 'ds.button']) {
    assert(ids.includes(want), `G9: the sample bundle carries ${want} (got ${ids.join(', ')})`);
  }
  const plan = DSC.planGenerate(parsed.contracts, { withTokens: true, fileKey: '' });
  assert(plan.ok, `G9: the sample bundle plans clean (${plan.ok ? '' : plan.issues.map((i) => i.headline).join('; ')})`);
  assert(plan.steps[0].kind === 'tokens', 'G9: the sample builds tokens first');
  for (const step of plan.steps) await runScript(step.code);
  for (const id of ['ds.card', 'ds.badge', 'ds.avatar', 'ds.button']) {
    assert(markerOf(id), `G9: ${id} built in the mock file`);
  }
  console.log('✔ G9 sample library: the baked bundle (Card, Badge, Avatar, Button) parses, plans tokens-first, and builds in the mock — the no-paste cold start');
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

  // --- G8: plain-words style diffs ----------------------------------------
  // A recolor-only update must itemize per channel (both compiled specs are
  // in hand at plan time) instead of collapsing into the jargon phrase
  // "interior/style changes (no API change)".
  {
    const style = JSON.parse(JSON.stringify(badge));
    style.version = '1.2.0';
    const t = style.anatomy.root.tokens;
    const bg = t['background-color'];
    t['background-color'] = t['color'];
    t['color'] = bg;
    const planStyle = DSC.updatePlan([style], inventory);
    const row = planStyle.rows[0];
    assert(row.action === 'amend', `G8: the recolor plans as an amend (got ${row.action}: ${row.line})`);
    assert(Array.isArray(row.styleChanges) && row.styleChanges.length > 0,
      `G8: a style-only update carries itemized per-channel changes (got ${JSON.stringify(row.styleChanges)})`);
    const fillChange = row.styleChanges.find(
      (c) => c.channel === 'fill' && String(c.was).includes('background') && String(c.now).includes('foreground'),
    );
    assert(fillChange, `G8: the recolor names both variables on the fill channel (got ${JSON.stringify(row.styleChanges).slice(0, 300)})`);
    assert(row.line.includes('style change') && !row.line.includes('interior/style'),
      `G8: the amend line speaks plain words, not "interior/style changes" (got "${row.line}")`);
    console.log(`✔ G8 style diff: a recolor-only update itemizes per channel (${row.styleChanges.length} change(s); fill ${fillChange.was} → ${fillChange.now}) with the drift report's language — no more "interior/style changes"`);
  }

  // --- G2: drift-aware update check (covenant repair) ----------------------
  // The check RECOMPUTES each target set's canvas state; a canvas-edited set
  // gets a NAMED overwrite warning and its Apply box defaults UNCHECKED —
  // warn and default-safe, never blocked. This is the exact reachable state
  // that silently ate a designer's edit before this pin existed.
  {
    const subject = markerOf(badge.id);
    const victim = subject.findAll((n) => (n.fills ?? []).some((f) => f.type === 'SOLID'))[0];
    assert(victim, 'G2: an editable filled node exists in the Badge set');
    const priorFills = victim.fills;
    victim.fills = [{ type: 'SOLID', color: { r: 0, g: 1, b: 1 }, opacity: 1 }];
    const invEdited = (await runScript(DSC.inventoryScriptSource())).inventory;
    const invRow = invEdited.find((r) => r.contractId === badge.id);
    assert(invRow && invRow.drift === 'canvas-edited',
      `G2: the inventory scan recomputes the canvas state and flags the edit (drift=${invRow && invRow.drift})`);
    const planEdited = DSC.updatePlan([vNext], invEdited);
    const rowE = planEdited.rows[0];
    assert(rowE.action === 'amend' && rowE.canvasEdited === true, 'G2: the amend row knows its target is canvas-edited');
    assert(rowE.defaultSelected === false, 'G2: a canvas-edited target defaults to UNCHECKED (warn and default-safe, never blocked)');
    assert(rowE.warning && rowE.warning.includes('un-proposed canvas edits') && rowE.warning.includes('overwrite'),
      `G2: the overwrite warning is NAMED (got "${rowE.warning}")`);
    assert(planEdited.lines.some((l) => l.includes('un-proposed canvas edits')),
      'G2: the report itself carries the overwrite warning line');
    victim.fills = priorFills;
    const invClean = (await runScript(DSC.inventoryScriptSource())).inventory;
    const planClean = DSC.updatePlan([vNext], invClean);
    assert(planClean.rows[0].canvasEdited !== true && planClean.rows[0].defaultSelected === true && !planClean.rows[0].warning,
      'G2: reverting the edit restores default-checked with no warning');
    console.log('✔ G2 drift-aware update check: a canvas-edited target gets a NAMED overwrite warning and its Apply box defaults UNCHECKED; reverting the edit restores default-checked');
  }

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

// --- N+2. DRIFT ROUND: canvas fingerprint stamp + edit detection ------------
// Genesis stamps ds_contracts/canvasFingerprint on every built set; Check
// Drift recomputes it. The gate proves the full triangle headlessly: (1) the
// stamp exists after a build, (2) recomputing over the untouched tree
// MATCHES (deterministic walker), (3) a canvas edit (fill swap) MISMATCHES,
// (4) re-running the sync script re-stamps back to a match. The recompute
// uses the canonical module (core/canvas-fingerprint.ts) EVALUATED FRESH —
// pinning the emitted copy and the module in lockstep.
{
  const fpModule = read('core/canvas-fingerprint.ts');
  const srcMatch = fpModule.match(/FINGERPRINT_SRC: string = `([\s\S]*?)`;/);
  assert(srcMatch, 'drift gate: FINGERPRINT_SRC extractable from core/canvas-fingerprint.ts');
  const fp = new Function(`${srcMatch[1]}; return dsCanvasFingerprint;`)();
  // LOCKSTEP, BY BYTES (this round): the old gate only EVALUATED the module
  // copy — code.js's hand-maintained twin could silently diverge while every
  // assertion stayed green. Pin the actual bytes.
  assert(
    read('figma-sync/plugin/code.js').includes(srcMatch[1]),
    'drift gate: figma-sync/plugin/code.js carries FINGERPRINT_SRC BYTE-IDENTICALLY (module ≡ plugin copy)',
  );
  const sets = root.findAll((n) => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId'));
  assert(sets.length > 0, 'drift gate: generated sets exist on the mock canvas');
  const withStamp = sets.filter((n) => n.getSharedPluginData('ds_contracts', 'canvasFingerprint'));
  assert(withStamp.length === sets.length, `drift gate: every generated set carries a canvasFingerprint stamp (${withStamp.length}/${sets.length})`);
  const subject = withStamp[0];
  const stored = subject.getSharedPluginData('ds_contracts', 'canvasFingerprint');
  assert(stored.startsWith('v5:'), 'drift gate: stamps carry the v5 version prefix (reaction-bearing scheme)');
  assert(fp(subject) === stored, 'drift gate: recomputing the fingerprint over the untouched tree MATCHES the stamp (module ≡ emitted copy)');
  // simulate a designer edit: swap a fill somewhere in the tree
  const victim = subject.findAll((n) => (n.fills ?? []).some((f) => f.type === 'SOLID'))[0];
  assert(victim, 'drift gate: an editable filled node exists');
  // LOCALIZATION (live finding: "which of the 63 buttons?"): per-variant
  // stamps exist and the edit resolves to EXACTLY the containing variant.
  const variants = subject.children ?? [];
  assert(variants.length > 0 && variants.every((v) => (v.getSharedPluginData('ds_contracts', 'canvasFingerprint') || '').startsWith('v5:')), 'drift gate: every VARIANT carries its own v5 fingerprint stamp');
  const owner = (() => { let n = victim; while (n && n.parent !== subject) n = n.parent; return n; })();
  assert(owner, 'drift gate: the edited node resolves to a variant of the set');
  const priorFills = victim.fills;
  victim.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 1 }, opacity: 1 }];
  assert(fp(subject) !== stored, 'drift gate: a canvas edit changes the recomputed fingerprint (CANVAS-EDITED detectable)');
  const flagged = variants.filter((v) => fp(v) !== v.getSharedPluginData('ds_contracts', 'canvasFingerprint'));
  assert(flagged.length === 1 && flagged[0] === owner, `drift gate: the edit LOCALIZES to exactly the containing variant (flagged ${flagged.length}: ${flagged.map((f) => f.name).join(',')})`);
  // v3 (live finding "what changed?"): the stored snapshot diffs against a
  // fresh one and NAMES the edited channel with old and new values.
  {
    const snapFn = new Function(`${srcMatch[1]}; return dsCanvasSnapshot;`)();
    const storedSnap = JSON.parse(owner.getSharedPluginData('ds_contracts', 'canvasSnapshot') || '[]');
    assert(storedSnap.length > 0, 'drift gate: variants carry a stored snapshot');
    const freshSnap = snapFn(owner);
    const changed = freshSnap.filter((l) => !storedSnap.includes(l));
    assert(changed.length >= 1 && changed.some((l) => l.includes('|fill|') && l.includes('"r":1') ), `drift gate: the snapshot diff NAMES the edited fill with its new value (changed: ${changed.slice(0, 2).join(' ;; ').slice(0, 160)})`);
  }
  victim.fills = priorFills;
  assert(fp(subject) === stored, 'drift gate: reverting the edit restores the match');
  // v4 (live finding: description + added property were invisible): set-level
  // edits diff against the set's own shallow snapshot.
  {
    const setSnapFn = new Function(`${srcMatch[1]}; return dsCanvasSetSnapshot;`)();
    const storedSet = JSON.parse(subject.getSharedPluginData('ds_contracts', 'canvasSetSnapshot') || '[]');
    const priorDesc = subject.description;
    subject.description = 'edited by a designer';
    const freshSet = setSnapFn(subject);
    assert(freshSet.some((l) => l.includes('|description|edited by a designer')) && !storedSet.some((l) => l.includes('edited by a designer')),
      'drift gate: a SET DESCRIPTION edit appears in the set-snapshot diff');
    subject.description = priorDesc;
    subject.addComponentProperty('Loading', 'BOOLEAN', false);
    const freshSet2 = setSnapFn(subject);
    assert(freshSet2.some((l) => l.includes('|propdef|') && l.includes('Loading')),
      'drift gate: an ADDED COMPONENT PROPERTY appears in the set-snapshot diff');
    // LIVE FINDING (round 2): the plugin HANDLER's diff parser is its own
    // code path — extract diffSnapshots from code.js and pin the three edit
    // classes end-to-end (the first parser collided keys per node and
    // reported NOTHING while every module-level check stayed green).
    const codeJs = read('figma-sync/plugin/code.js');
    const dm = codeJs.match(/const diffSnapshots = function \(storedLines, freshLines\) \{[\s\S]*?\n          \};/);
    assert(dm, 'drift gate: diffSnapshots extractable from code.js');
    const diffFn = new Function('storedLines', 'freshLines', `${dm[0]}\nreturn diffSnapshots(storedLines, freshLines);`);
    const stored2 = [':COMPONENT_SET/Button|description|old words', ':COMPONENT_SET/Button|propdef|Disabled:BOOLEAN=false', ':COMPONENT_SET/Button|propdef|Label:TEXT=Button'];
    const fresh2 = [':COMPONENT_SET/Button|description|new words', ':COMPONENT_SET/Button|propdef|Disabled:BOOLEAN=false', ':COMPONENT_SET/Button|propdef|Label:TEXT=Button', ':COMPONENT_SET/Button|propdef|Loading:BOOLEAN=false'];
    const d2 = diffFn(stored2, fresh2);
    assert(d2.some((c) => c.what.endsWith('|description') && c.was === 'old words' && c.now === 'new words'),
      `drift gate: handler diff pairs a DESCRIPTION edit was→now (got ${JSON.stringify(d2).slice(0, 160)})`);
    assert(d2.some((c) => c.what.endsWith('|propdef') && c.was === '(absent)' && c.now.includes('Loading')),
      'drift gate: handler diff reports an ADDED property as (absent)→value without colliding with existing propdefs');
    assert(d2.length === 2, `drift gate: unchanged propdef lines do NOT report (got ${d2.length} changes)`);
    const d3 = diffFn(['/0:FRAME/label|fill|[{"r":1}]', '/0:FRAME/label|sizing|HUG/HUG '], ['/0:FRAME/label|fill|[{"r":0}]', '/0:FRAME/label|sizing|HUG/HUG ']);
    assert(d3.length === 1 && d3[0].what.endsWith('|fill') && d3[0].was.includes('"r":1') && d3[0].now.includes('"r":0'),
      'drift gate: handler diff pairs a FILL edit was→now while sibling facts on the same node stay quiet');
  }
  console.log(`✔ drift round: canvasFingerprint stamped on ${sets.length} sets; untouched≡stamp, edited≠stamp, reverted≡stamp — Check Drift is mechanically grounded and LOCALIZES to the exact variant`);
}

// --- N+3. FOREIGN TOKEN SET — the JSON-only Generate for a foreign library -
// The owner's wall, live: "I thought we were entering contracts as JSON but
// you keep giving me JavaScript." A foreign round (MUI) is now ONE JSON
// paste: examples/mui/figma/mui.bundle.json (contracts + tokenSet) through
// the REAL engine bundle path must build EXACTLY what the compiled-script
// path (GENESIS-BATCH.figma.js) builds — same component sets and variant
// counts, same variable count including the Figma-native source aliases,
// same bound values. Plus the refusal: a contract ref outside base + minted
// still refuses BY NAME.
{
  const bundleText = read('examples/mui/figma/mui.bundle.json');
  const parsed = DSC.parseIncomingText(bundleText);
  assert(parsed.ok && parsed.kind === 'bundle', 'mui.bundle.json parses as a CONTRACTS-BUNDLE');
  assert(parsed.tokenSet && parsed.tokenSet.name === 'MUI', 'the bundle surfaces its tokenSet (collection "MUI")');
  // MOLECULE round: the bundle carries Autocomplete's floor-reconstructed
  // icon SVGs — JSON stays the only thing a user pastes. ORGANISM round: +10
  // (3 Checkbox glyphs, 4 Table, 3 TablePagination).
  assert(
    parsed.icons && Object.keys(parsed.icons).length === 14,
    `the bundle surfaces its 14 icon assets (got ${parsed.icons ? Object.keys(parsed.icons).length : 'none'})`,
  );
  const plan = DSC.planGenerate(parsed.contracts, { withTokens: true, fileKey: '', tokenSet: parsed.tokenSet, icons: parsed.icons });
  assert(plan.ok, `the foreign bundle plans clean (${plan.ok ? '' : plan.issues.map((i) => i.headline).join('; ')})`);
  assert(
    plan.steps[0].kind === 'tokens' && plan.steps[0].title.includes('"MUI"'),
    `the tokens step syncs the bundle's own tokenSet first, named (got "${plan.steps[0].title}")`,
  );
  assert(
    plan.steps.filter((s) => s.kind === 'tokens').length === 1,
    'no baked deps ride along, so ONLY the tokenSet collection syncs — the repo collections stay out of a foreign file',
  );

  const silent = { log() {}, warn() {}, error() {} };
  const runIn = (mock, code) =>
    vm.runInContext(`(async () => {\n${code}\n})()`, vm.createContext({ figma: mock.figma, console: silent }), {
      timeout: 300_000,
    });

  // Bundle path (fresh mock file A).
  const mockA = createFigmaMock();
  for (const step of plan.steps) await runIn(mockA, step.code);
  // Script path (fresh mock file B) — the committed compiled-script journey.
  const mockB = createFigmaMock();
  await runIn(mockB, read('examples/mui/figma/GENESIS-BATCH.figma.js'));

  const setShape = (mock) =>
    mock.root
      .findAll((n) => n.type === 'COMPONENT_SET')
      .map((s) => `${s.name}(${s.children.length})`)
      .sort()
      .join(', ');
  const shapeA = setShape(mockA);
  const shapeB = setShape(mockB);
  // STATE-PLANE PROJECTION round: Switch 14 → 28 (`checked` reclassified from
  // an out-of-vocabulary stateProp to a real VARIANT AXIS) and Button 63 → 75
  // (the figmaStatePreviews probe accepted a State axis). Both must survive
  // the JSON-only paste identically to the compiled-script path.
  assert(
    shapeA === 'Accordion(4), Autocomplete(2), Button(75), Card(4), Checkbox(3), Chip(28), Dialog(5), Slider(12), Switch(28), Table(2), Tabs(6)',
    `the bundle path builds the exact MUI set shape (got ${shapeA})`,
  );
  assert(shapeA === shapeB, `bundle path ≡ script path on component sets (${shapeA} vs ${shapeB})`);
  // MOLECULE round: Menu and Tooltip have no variant axes — they build
  // STANDALONE COMPONENTs, a shape the set pin above cannot see. ORGANISM
  // round: TablePagination joins them (fixed count/rowsPerPage/page).
  const SOLO = new Set(['Menu', 'Tooltip', 'TablePagination']);
  const standaloneShape = (mock) =>
    mock.root
      .findAll((n) => n.type === 'COMPONENT' && SOLO.has(n.name))
      .map((n) => n.name)
      .sort()
      .join(', ');
  const soloA = standaloneShape(mockA);
  const soloB = standaloneShape(mockB);
  assert(soloA === 'Menu, TablePagination, Tooltip', `the bundle path builds the standalone Menu + TablePagination + Tooltip components (got ${soloA || 'none'})`);
  assert(soloA === soloB, `bundle path ≡ script path on standalone components (${soloA} vs ${soloB})`);

  const aliasCountOf = (mock) =>
    mock.variables.filter((v) =>
      Object.values(v.valuesByMode).some((val) => val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS'),
    ).length;
  assert(
    mockA.variables.length === 1653 && mockB.variables.length === 1653,
    `both paths land 1653 variables (bundle ${mockA.variables.length}, script ${mockB.variables.length})`,
  );
  assert(
    aliasCountOf(mockA) === 73 && aliasCountOf(mockB) === 73,
    `both paths carry 73 Figma-native alias variables (bundle ${aliasCountOf(mockA)}, script ${aliasCountOf(mockB)})`,
  );
  const namesA = mockA.variables.map((v) => v.name).sort().join('\n');
  const namesB = mockB.variables.map((v) => v.name).sort().join('\n');
  assert(namesA === namesB, 'bundle path ≡ script path on the full variable NAME inventory');

  // Spot-check a bound value end to end: the contained-primary Button root
  // fill must resolve (through the minted alias → base token) to MUI's
  // palette-primary-main #1976d2.
  const buttonSet = mockA.root.findOne((n) => n.type === 'COMPONENT_SET' && n.name === 'Button');
  const contained = buttonSet.children.find((c) => c.name.includes('Variant=Contained') && c.name.includes('Color=Primary') && c.name.includes('Size=Medium'));
  assert(contained, 'the Contained/Primary/Medium Button variant exists in the bundle-built set');
  const fillBound = (contained.fills ?? []).find((f) => f.boundVariables && f.boundVariables.color);
  assert(fillBound, 'the contained-primary Button root fill is variable-bound');
  const fillVar = mockA.variables.find((v) => v.id === fillBound.boundVariables.color.id);
  const resolved = fillVar.resolveForConsumer();
  const hex = (x) => Math.round((x || 0) * 255).toString(16).padStart(2, '0');
  const resolvedHex = resolved && resolved.value ? `#${hex(resolved.value.r)}${hex(resolved.value.g)}${hex(resolved.value.b)}` : '(unresolved)';
  assert(
    fillVar.name === 'imported/button/root/background-color/contained/primary' && resolvedHex === '#1976d2',
    `the contained-primary fill binds ${fillVar.name} and resolves ${resolvedHex} (want #1976d2 via the palette-primary-main alias)`,
  );

  // The refusal: a contract ref outside base + minted refuses BY NAME at
  // plan time (font-weight resolves LITERALLY — weight → Inter style name —
  // so the emitter's own "Cannot resolve token" fires; purely bindable
  // channels keep the runtime's named 'Missing variable' throw instead).
  const broken = JSON.parse(JSON.stringify(parsed.contracts.find((c) => c.id === 'mui.button')));
  broken.anatomy.root.tokens['font-weight'] = '{no.such.token}';
  const refused = DSC.planGenerate([broken], { withTokens: true, fileKey: '', tokenSet: parsed.tokenSet });
  assert(!refused.ok, 'a contract ref outside base+minted is refused');
  assert(
    refused.issues.some((i) => i.headline.includes('Cannot resolve token') && i.headline.includes('no.such.token')),
    `the refusal names the token (got: ${refused.ok ? '' : refused.issues.map((i) => i.headline).join('; ')})`,
  );

  console.log(
    `✔ foreign token set (MUI): mui.bundle.json — ONE JSON paste — plans tokenSet-first ("MUI" collection) and builds ${shapeA} + standalone ${soloA} with 1653 variables (73 Figma-native aliases), EQUIVALENT to the compiled-script path (sets, standalone, variants, variable inventory); contained-primary Button fill resolves #1976d2; a ref outside base+minted refuses BY NAME`,
  );

  // --- PROTOTYPE WIRING: the State axis is LIVE, and its limits are named --
  // MUI Button declares states ["disabled","active","focus-visible","hover"]
  // and opts into figmaStatePreviews, so its State=Default cells on the
  // default (Size=Medium) plane must carry EXACTLY [ON_HOVER→Hover,
  // ON_PRESS→Active]. Everything else in the set must carry ZERO — and the
  // two states Figma has no trigger for must be destinations of NOTHING.
  {
    const setOf = (mock) => mock.root.findOne((n) => n.type === 'COMPONENT_SET' && n.name === 'Button');
    const wiringOf = (mock) => {
      const set = setOf(mock);
      const nameById = new Map(set.children.map((c) => [c.id, c.name]));
      return set.children
        .filter((c) => c.reactions.length > 0)
        .map((c) => `${c.name} :: ${c.reactions
          .map((r) => `${r.trigger.type}→${r.actions[0].navigation} ${nameById.get(r.actions[0].destinationId) ?? '(external)'}`)
          .join(' | ')}`)
        .sort();
    };
    const wiringA = wiringOf(mockA);
    const wiringB = wiringOf(mockB);
    const setA = setOf(mockA);

    // 1. exactly the three default-plane State=Default cells are sources
    //    (Variant is the PRIMARY axis; Color/Size sit at values[0]).
    assert(
      wiringA.length === 3,
      `prototype wiring: exactly 3 Button variants carry reactions — one per primary-axis value on the default plane (got ${wiringA.length}: ${wiringA.map((w) => w.split(' :: ')[0]).join(' / ')})`,
    );
    assert(
      wiringA.every((w) => w.startsWith('Variant=') && w.split(' :: ')[0].endsWith(', State=Default')),
      `prototype wiring: every source is a State=Default variant (got ${wiringA.map((w) => w.split(' :: ')[0]).join(' / ')})`,
    );
    // 2. each source carries EXACTLY [ON_HOVER→Hover, ON_PRESS→Active], in
    //    that canonical order, CHANGE_TO a sibling differing ONLY in State=.
    for (const w of wiringA) {
      const [from, wires] = w.split(' :: ');
      const axis = from.slice(0, from.length - ', State=Default'.length);
      assert(
        wires === `ON_HOVER→CHANGE_TO ${axis}, State=Hover | ON_PRESS→CHANGE_TO ${axis}, State=Active`,
        `prototype wiring: "${from}" carries exactly [ON_HOVER→Hover, ON_PRESS→Active] to siblings differing ONLY in the State= segment (got ${wires})`,
      );
    }
    // 3. transition is ALWAYS null — durations are not contract facts.
    assert(
      setA.children.every((c) => c.reactions.every((r) => r.actions.every((a) => a.transition === null))),
      'prototype wiring: every action carries transition:null (animation stays code-only, per the capability matrix)',
    );
    // 4. POSITIVE ASSERTION of the named exclusions: Figma has no focus or
    //    disabled trigger, so those previews are destinations of NOTHING.
    const destinations = new Set(
      setA.children.flatMap((c) => c.reactions.flatMap((r) => r.actions.map((a) => a.destinationId))),
    );
    const destNames = [...destinations].map((id) => setA.children.find((c) => c.id === id)?.name ?? '(external)');
    assert(
      !destNames.some((n) => n.includes('State=Focus Visible')),
      `prototype wiring: State=Focus Visible is the destination of NOTHING — EXCLUDED BY NAME (no focus trigger exists in Figma's Trigger union); preview-only`,
    );
    assert(
      !destNames.some((n) => n.includes('State=Disabled')),
      'prototype wiring: State=Disabled is the destination of NOTHING — EXCLUDED BY NAME (no disabled trigger exists); preview-only',
    );
    // 5. off-default-axis base variants carry ZERO — the receipted coverage
    //    limit (previews pin non-primary axes to values[0]).
    const offPlane = setA.children.filter(
      (c) => c.name.endsWith(', State=Default') && !(c.name.includes('Color=Primary') && c.name.includes('Size=Medium')),
    );
    assert(offPlane.length > 0, 'prototype wiring: the set HAS off-default-axis base variants (else the limit is untested)');
    assert(
      offPlane.every((c) => c.reactions.length === 0),
      `prototype wiring: off-default-axis base variants carry ZERO reactions — a NAMED coverage limit, not a silent skip (${offPlane.filter((c) => c.reactions.length > 0).length} violations of ${offPlane.length})`,
    );
    // 6. preview variants themselves carry ZERO (hover/press auto-revert).
    const previews = setA.children.filter((c) => !c.name.endsWith(', State=Default'));
    assert(
      previews.length > 0 && previews.every((c) => c.reactions.length === 0),
      'prototype wiring: preview variants carry ZERO reactions — hover/press auto-revert, so no return wiring is emitted',
    );
    // 7. the JSON-only paste wires IDENTICALLY to the compiled-script path.
    assert(
      wiringA.join('\n') === wiringB.join('\n'),
      'prototype wiring: bundle path ≡ script path on the full reaction wiring (names, triggers, destinations)',
    );
    // 8. a NON-OPTED contract's set is untouched — hand prototyping survives.
    const chip = mockA.root.findOne((n) => n.type === 'COMPONENT_SET' && n.name === 'Chip');
    assert(
      chip && chip.children.every((c) => c.reactions.length === 0),
      'prototype wiring: a contract without state previews (Chip) has ZERO reactions anywhere — non-opted sets are never touched',
    );

    // 9. THE MOCK'S REFUSALS (real-Figma fidelity, so the failure classes
    //    cannot pass headlessly).
    const src = setA.children.find((c) => c.reactions.length > 0);
    let assignThrew = '';
    try { src.reactions = []; } catch (e) { assignThrew = e.message; }
    assert(
      assignThrew.includes('read-only') && assignThrew.includes('setReactionsAsync'),
      `prototype wiring: plain assignment to node.reactions REFUSES BY NAME (got: ${assignThrew || 'NO THROW — a false green'})`,
    );
    const otherSet = mockA.root.findOne((n) => n.type === 'COMPONENT_SET' && n.name === 'Chip');
    let crossThrew = '';
    try {
      await src.setReactionsAsync([
        { trigger: { type: 'ON_HOVER' }, actions: [{ type: 'NODE', destinationId: otherSet.children[0].id, navigation: 'CHANGE_TO', transition: null }] },
      ]);
    } catch (e) { crossThrew = e.message; }
    assert(
      crossThrew.includes('not a variant of the same component set'),
      `prototype wiring: a CHANGE_TO destination in a DIFFERENT component set REFUSES BY NAME (got: ${crossThrew || 'NO THROW — a false green'})`,
    );
    assert(
      src.reactions.length === 2,
      'prototype wiring: the refused write left the existing reactions intact (no partial application)',
    );

    // 10. FINGERPRINT v5 sees reactions — the v4 blindness this round closes.
    const fpSrc = read('core/canvas-fingerprint.ts').match(/FINGERPRINT_SRC: string = `([\s\S]*?)`;/)[1];
    const fpFn = new Function(`${fpSrc}; return dsCanvasFingerprint;`)();
    const snapFn = new Function(`${fpSrc}; return dsCanvasSnapshot;`)();
    const beforeFp = fpFn(src);
    const lines = snapFn(src).filter((l) => l.includes('|reaction|'));
    assert(
      lines.length === 2 && lines[0].includes('ON_HOVER') && lines[0].includes('State=Hover') && !/\d+:\d+/.test(lines[0].split('|reaction|')[1]),
      `prototype wiring: the v5 snapshot records reactions by DESTINATION NAME, never node id (got ${JSON.stringify(lines[0] ?? '(none)')})`,
    );
    await src.setReactionsAsync([src.reactions[0]]); // a designer strips the press wiring
    assert(
      fpFn(src) !== beforeFp,
      'prototype wiring: STRIPPING a reaction changes the v5 fingerprint — the drift signal v4 was blind to',
    );
    assert(
      beforeFp.startsWith('v5:') && fpFn(src).startsWith('v5:'),
      'prototype wiring: fingerprints carry the v5 prefix',
    );

    console.log(
      `✔ prototype wiring (MUI Button, 75 variants): ${wiringA.length} State=Default cells carry [ON_HOVER→Hover, ON_PRESS→Active] CHANGE_TO their State= siblings, transition null; State=Focus Visible + State=Disabled are destinations of NOTHING (no Figma trigger exists — EXCLUDED BY NAME); off-default-axis bases and all previews carry ZERO; bundle path ≡ script path; the mock refuses plain assignment AND a cross-set CHANGE_TO by name; v5 fingerprint catches a stripped reaction`,
    );
  }
}

// --- N+4. THE STANDING CHANNEL, plugin side (G1 S1+S2) ----------------------
// The WORKER half of this round (claim → publish → non-consuming read, the
// write/read key split) is pinned by workers/assist/test/channel.test.ts and
// by the `channel-round-trip` eval, which can import the TypeScript worker
// under tsx. This gate — plain node, no TS loader — owns the PLUGIN half, and
// owns it through the REAL BUILT BUNDLE, so `window.DSC` losing any of these
// functions is a red gate rather than a runtime surprise in Figma.
//
// THE DEFECT THIS FLOW EXISTS FOR: before this round `updatePlan` compared
// specHash for EQUALITY only. No ordering existed anywhere, so an OLDER
// bundle applied as an ordinary, default-SELECTED change — a silent
// downgrade. Pin 6 below is the one that would go red if that came back.
{
  const silentC = { log() {}, warn() {}, error() {} };
  const mockC = createFigmaMock();
  const runC = (code) =>
    vm.runInContext(`(async () => {\n${code}\n})()`, vm.createContext({ figma: mockC.figma, console: silentC }), {
      timeout: 120_000,
    });

  // 1. The bundle actually carries the channel surface.
  for (const fn of [
    'channelFingerprint', 'parseApplyLog', 'appendApplyEntry', 'lastAppliedSeq',
    'channelFreshness', 'provenanceLine', 'relativeWhen', 'applyLogScriptSource',
    'recordApplyScriptSource',
  ]) {
    assert(typeof DSC[fn] === 'function', `channel: window.DSC exposes ${fn}() — the built bundle, not just the source`);
  }

  // 2. The read key never reaches the file: the log stores a FINGERPRINT.
  const READ_KEY = 'dscr_' + 'ab12cd34'.repeat(8);
  const fp = DSC.channelFingerprint(READ_KEY);
  assert(fp === 'dscr_ab12cd3' && READ_KEY.indexOf(fp) === 0 && fp.length === 12,
    `channel: the apply log stores a 12-char fingerprint, never the key (got ${fp})`);

  // 3. An unreadable apply log is "no history", never an error — a corrupt
  //    record must never be able to block an update.
  for (const junk of [null, undefined, '', 'not json', '[]', '{}', '{"entries":"nope"}', '{"entries":[1,"x",null]}']) {
    const log = DSC.parseApplyLog(junk);
    assert(log && log.version === 1 && Array.isArray(log.entries),
      `channel: parseApplyLog(${JSON.stringify(junk)}) degrades to an empty log instead of throwing`);
  }

  // 4. Seq numbers are scoped PER CHANNEL — two channels number
  //    independently, so comparing across them would manufacture warnings.
  {
    let log = DSC.parseApplyLog(null);
    log = DSC.appendApplyEntry(log, { source: 'channel', channel: 'dscr_aaaaaaa', seq: 7, publishedAt: null, appliedAt: 'x', contractIds: [], bytes: null });
    log = DSC.appendApplyEntry(log, { source: 'channel', channel: 'dscr_bbbbbbb', seq: 2, publishedAt: null, appliedAt: 'x', contractIds: [], bytes: null });
    log = DSC.appendApplyEntry(log, { source: 'paste', channel: null, seq: null, publishedAt: null, appliedAt: 'x', contractIds: [], bytes: null });
    assert(DSC.lastAppliedSeq(log, 'dscr_aaaaaaa') === 7, 'channel: lastAppliedSeq reads its own channel');
    assert(DSC.lastAppliedSeq(log, 'dscr_bbbbbbb') === 2, 'channel: a second channel keeps its own numbering');
    assert(DSC.lastAppliedSeq(log, 'dscr_ccccccc') === null, 'channel: an unknown channel has NO history — nothing is claimed');
    assert(DSC.lastAppliedSeq(log, null) === null, 'channel: a source without a channel (paste/pairing code) has no ordering');
    // The cap is real, and newest-first.
    let big = DSC.parseApplyLog(null);
    for (let i = 1; i <= DSC.APPLY_LOG_MAX_ENTRIES + 10; i++) {
      big = DSC.appendApplyEntry(big, { source: 'channel', channel: 'dscr_aaaaaaa', seq: i, publishedAt: null, appliedAt: 'x', contractIds: [], bytes: null });
    }
    assert(big.entries.length === DSC.APPLY_LOG_MAX_ENTRIES && big.entries[0].seq === DSC.APPLY_LOG_MAX_ENTRIES + 10,
      `channel: the apply log is capped at ${DSC.APPLY_LOG_MAX_ENTRIES}, newest first (got ${big.entries.length}, head #${big.entries[0].seq})`);
  }

  // 5. THE FRESHNESS VERDICTS, each named.
  {
    const empty = DSC.parseApplyLog(null);
    const fresh0 = DSC.channelFreshness({ seq: 1 }, empty, fp);
    assert(fresh0.stale === false && fresh0.lastAppliedSeq === null,
      'channel: a first-ever delivery is NOT stale (nothing to compare) — the guard never fires on a fresh file');
    const applied = DSC.appendApplyEntry(empty, { source: 'channel', channel: fp, seq: 7, publishedAt: null, appliedAt: 'x', contractIds: [], bytes: null });
    assert(DSC.channelFreshness({ seq: 8 }, applied, fp).stale === false, 'channel: a newer delivery is not stale');
    const same = DSC.channelFreshness({ seq: 7 }, applied, fp);
    assert(same.stale === true && same.line.includes('#7') && same.line.includes('last applied'),
      `channel: re-delivering the SAME number is named (got "${same.line}")`);
    const older = DSC.channelFreshness({ seq: 3 }, applied, fp);
    assert(
      older.stale === true && older.line.includes('#3') && older.line.includes('#7') && older.line.includes('BACKWARDS'),
      `channel: an OLDER delivery names BOTH numbers and says which way it would move the library (got "${older.line}")`,
    );
  }

  // 6. THE GUARD IN THE REPORT — the silent-downgrade fix itself. Build Badge
  //    in a fresh mock, then plan a bumped version twice: once as a normal
  //    delivery (default-SELECTED, today's behaviour, unchanged) and once as
  //    a stale one (default-UNCHECKED, named).
  {
    const parsed = DSC.parseIncomingText(read('contracts/badge.contract.json'));
    const genPlan = DSC.planGenerate(parsed.contracts, { withTokens: true, fileKey: '' });
    for (const step of genPlan.steps) await runC(step.code);
    const inv = (await runC(DSC.inventoryScriptSource())).inventory;

    const vNext = JSON.parse(read('contracts/badge.contract.json'));
    vNext.version = '9.9.9';
    vNext.props.push({
      name: 'experimental',
      description: 'Harness-added boolean prop (channel-guard fixture).',
      type: 'boolean',
      default: false,
      bindings: { figma: { kind: 'BOOLEAN', property: 'Experimental' }, code: { prop: 'experimental' } },
    });

    // (a) No freshness argument at all — the paste / pairing-code path. This
    //     is the REGRESSION pin: today's behaviour must not move an inch.
    const planPlain = DSC.updatePlan([vNext], inv);
    assert(planPlain.rows[0].action === 'amend' && planPlain.rows[0].defaultSelected === true,
      'channel: a plain paste/pairing-code update still starts CHECKED — the guard cannot leak into the paths that carry no ordering');
    assert(!planPlain.lines.some((l) => l.indexOf('Out of order') === 0),
      'channel: no out-of-order banner appears without a channel delivery');

    // (b) A FRESH channel delivery behaves identically.
    const freshVerdict = DSC.channelFreshness({ seq: 9 }, DSC.parseApplyLog(null), fp);
    const planFresh = DSC.updatePlan([vNext], inv, null, null, freshVerdict);
    assert(planFresh.rows[0].defaultSelected === true, 'channel: a fresh delivery starts CHECKED like any other update');

    // (c) A STALE delivery: every actionable row unchecked, named on the row
    //     AND banner-lined above the counts.
    const staleLog = DSC.appendApplyEntry(DSC.parseApplyLog(null), { source: 'channel', channel: fp, seq: 12, publishedAt: null, appliedAt: 'x', contractIds: [], bytes: null });
    const staleVerdict = DSC.channelFreshness({ seq: 4 }, staleLog, fp);
    const planStale = DSC.updatePlan([vNext], inv, null, null, staleVerdict);
    const row = planStale.rows[0];
    assert(row.action === 'amend', `channel: the stale delivery still plans as an amend (got ${row.action})`);
    assert(row.defaultSelected === false,
      'channel: THE SILENT-DOWNGRADE FIX — an out-of-order delivery starts UNCHECKED (before this round it started checked)');
    assert(row.warning && row.warning.includes('#4') && row.warning.includes('#12'),
      `channel: the row itself names both delivery numbers (got "${row.warning}")`);
    const banner = planStale.lines.find((l) => l.indexOf('⚠ Out of order') === 0);
    assert(banner && banner.includes('#4') && banner.includes('#12'),
      `channel: the report carries an out-of-order banner naming both numbers (got "${banner}")`);
    assert(planStale.lines[planStale.lines.length - 1] === 'Nothing has been applied — review the list, then Apply.',
      'channel: the nothing-applied tail is still last — the guard warns, it never blocks');

    // (d) The guard warns and DEFAULTS safe; it does not disable the machinery.
    const applySteps = DSC.updateApplySteps([vNext], [vNext.id], { fileKey: '' });
    assert(applySteps.ok === true,
      'channel: a deliberate rollback is still possible — the guard unchecks boxes, it does not block Apply');
  }

  // 7. THE APPLY LOG round-trips through the REAL Plugin API scripts in the
  //    mock file: read (empty) → write → read (populated) → cap holds.
  {
    const before = await runC(DSC.applyLogScriptSource());
    assert(before.applyLog === null || before.applyLog === '',
      'channel: a file with no history reads an empty apply log');
    const entry = {
      source: 'channel', channel: fp, seq: 5,
      publishedAt: '2026-07-25T12:00:00.000Z', appliedAt: '2026-07-25T12:04:00.000Z',
      contractIds: ['ds.badge'], bytes: 1234,
    };
    const wrote = await runC(DSC.recordApplyScriptSource(entry));
    assert(wrote.applyLogEntries === 1 && wrote.seq === 5, `channel: the record script writes one entry (got ${JSON.stringify(wrote)})`);
    const after = DSC.parseApplyLog((await runC(DSC.applyLogScriptSource())).applyLog);
    assert(after.entries.length === 1 && after.entries[0].seq === 5 && after.entries[0].channel === fp,
      'channel: the entry round-trips through root pluginData byte-for-byte');
    assert(DSC.lastAppliedSeq(after, fp) === 5, 'channel: the file now REMEMBERS delivery #5');
    // …and the memory is what makes the guard fire on the next delivery.
    assert(DSC.channelFreshness({ seq: 5 }, after, fp).stale === true,
      'channel: the freshness guard reads the record the apply just wrote — memory and guard are one loop');
    assert(DSC.channelFreshness({ seq: 6 }, after, fp).stale === false, 'channel: the next real delivery passes');
    // A second write is prepended, not appended.
    await runC(DSC.recordApplyScriptSource({ ...entry, seq: 6 }));
    const after2 = DSC.parseApplyLog((await runC(DSC.applyLogScriptSource())).applyLog);
    assert(after2.entries.length === 2 && after2.entries[0].seq === 6, 'channel: the newest entry is the head');
    // The key itself is NOWHERE in the file.
    const stored = mockC.root.getSharedPluginData('ds_contracts', 'applyLog');
    assert(stored.indexOf(READ_KEY) < 0 && stored.indexOf(fp) > 0,
      'channel: the full read key never lands in the file — only the fingerprint does');
  }

  // 8. PROVENANCE rendering (S2): the exact line shown above the report, and
  //    the honest fallback when CI published nothing about itself.
  {
    const now = new Date('2026-07-25T12:04:00Z');
    const line = DSC.provenanceLine(
      { repo: 'acme/design-system', runId: '17654321', commit: '9f1c2ab3d4e5f6', ref: 'refs/heads/main' },
      '2026-07-25T12:00:00Z',
      now,
    );
    assert(
      line === 'acme/design-system — CI run #17654321, commit 9f1c2ab, branch main, published 4 minutes ago.',
      `channel: the provenance line reads exactly "acme/design-system — CI run #17654321, commit 9f1c2ab, branch main, published 4 minutes ago." (got "${line}")`,
    );
    const none = DSC.provenanceLine(null, '2026-07-25T12:00:00Z', now);
    assert(
      none === 'Unattributed delivery (no CI provenance was published with it) — published 4 minutes ago.',
      `channel: a delivery with no provenance says UNATTRIBUTED rather than showing blanks (got "${none}")`,
    );
    assert(DSC.relativeWhen(null, now) === 'at an unrecorded time', 'channel: a missing timestamp is named, never guessed');
    assert(DSC.relativeWhen('2026-07-23T12:00:00Z', now) === '2 days ago', 'channel: relative time reads in days once it is old');
  }

  console.log(
    '✔ standing channel (plugin side, through the built bundle): apply log stores a 12-char fingerprint not the key; a corrupt log degrades to "no history"; seq is scoped per channel and capped at 50 newest-first; the freshness guard is silent on a first/newer delivery and NAMES both numbers on an equal/older one; THE SILENT-DOWNGRADE FIX — a stale delivery unchecks every row and banners the report while paste/pairing-code updates stay byte-identically checked; the record script round-trips through root pluginData and is what the guard then reads; provenance renders exactly, unattributed deliveries say so',
  );
}

// --- N+3. SIBLING BUNDLES (72b5075 follow-up): astryx + polaris + docs-theme
// through the same real engine bundle path. Result-level pins: parse, plan
// (tokenSet-first), execute in a fresh mock, marked-node + variable counts.
{
  const silent2 = { log() {}, warn() {}, error() {} };
  const runIn2 = (mock, code) =>
    vm.runInContext(`(async () => {\n${code}\n})()`, vm.createContext({ figma: mock.figma, console: silent2 }), {
      timeout: 300_000,
    });
  const exercise = async (file, expectName, expectContracts) => {
    const text = read(file);
    const parsed = DSC.parseIncomingText(text);
    assert(parsed.ok && parsed.kind === 'bundle', `${file} parses as a CONTRACTS-BUNDLE`);
    assert(parsed.tokenSet && parsed.tokenSet.name === expectName, `${file} carries tokenSet "${expectName}"`);
    assert(parsed.contracts.length === expectContracts, `${file}: ${expectContracts} contracts (got ${parsed.contracts.length})`);
    const plan = DSC.planGenerate(parsed.contracts, { withTokens: true, fileKey: '', tokenSet: parsed.tokenSet, icons: parsed.icons });
    assert(plan.ok, `${file} plans clean (${plan.ok ? '' : plan.issues.map((i) => i.headline).join('; ')})`);
    assert(plan.steps[0].kind === 'tokens' && plan.steps[0].title.includes(`"${expectName}"`), `${file}: tokenSet syncs first`);
    const mock = createFigmaMock();
    for (const step of plan.steps) await runIn2(mock, step.code);
    const built = mock.root.findAll(
      (n) => (n.type === 'COMPONENT_SET' || (n.type === 'COMPONENT' && n.parent?.type !== 'COMPONENT_SET')) && n.getSharedPluginData('ds_contracts', 'contractId'),
    );
    const vars = await mock.figma.variables.getLocalVariablesAsync();
    // RE-ANCHORING ROUND: a re-anchored minted leaf must land as a REAL Figma
    // variable alias (mode-following), not as a frozen literal.
    const aliases = vars.filter((v) => Object.values(v.valuesByMode).some((x) => x && typeof x === 'object' && x.type === 'VARIABLE_ALIAS'));
    return { built: built.length, vars: vars.length, aliases: aliases.length, byName: new Map(vars.map((v) => [v.name, v])) };
  };
  const astryx = await exercise('examples/astryx/figma/astryx.bundle.json', 'Astryx', 13);
  assert(astryx.built === 13, `astryx bundle builds all 13 components (got ${astryx.built})`);
  // The 54 re-anchored minted leaves (examples/astryx/tokens/reanchor-decisions.json:
  // the 9 auto-clean badge tone rules + the 45 landed by the REVIEWED round)
  // arrive through the ENGINE path as Figma-native aliases and RESOLVE to the
  // same theme-neutral light values the literals carried — the light plane is
  // untouched; what changed is that they now FOLLOW the mode.
  assert(astryx.aliases === 54, `astryx bundle carries the 54 re-anchored minted aliases (got ${astryx.aliases})`);
  const hex2 = (x) => Math.round((x || 0) * 255).toString(16).padStart(2, '0');
  // One pin per DECISION ARM, so a mis-targeted arm cannot hide behind a count:
  // three of the original tone rules, plus one leaf from each of the reviewed
  // round's five value groups.
  for (const [leaf, want] of [
    ['imported/badge/root/row-rule-color/blue', '#042f97'],
    ['imported/badge/root/row-rule-color/red', '#7b0210'],
    ['imported/badge/root/row-rule-color/yellow', '#753f07'],
    ['imported/badge/root/row-rule-color/warning', '#0a1317'],
    ['imported/button/label/color/primary', '#ffffff'],
    ['imported/button/label/color/destructive', '#ffffff'],
    ['imported/button/label/color/ghost', '#0a1317'],
    ['imported/card/root/border-top-color/default', '#ccd3db'],
    ['imported/slider/slider-track/background-color', '#ccd3db'],
    ['imported/shared/color-0064e0', '#0064e0'],
    ['imported/slider/label/color', '#4e606f'],
  ]) {
    const v = astryx.byName.get(leaf);
    assert(v, `astryx bundle emits ${leaf}`);
    const first = v.valuesByMode[Object.keys(v.valuesByMode)[0]];
    assert(first && first.type === 'VARIABLE_ALIAS', `${leaf} is a VARIABLE_ALIAS, not a frozen literal`);
    const r = v.resolveForConsumer();
    const got = r && r.value ? `#${hex2(r.value.r)}${hex2(r.value.g)}${hex2(r.value.b)}` : '(unresolved)';
    assert(got === want, `${leaf} resolves the unchanged neutral light value ${want} (got ${got})`);
  }
  // …and the two leaves the review DECIDED to keep literal must still be
  // literals: a resolved queue is not the same as an empty one.
  for (const leaf of ['imported/shared/color-ffffff', 'imported/shared/color-0a1317']) {
    const v = astryx.byName.get(leaf);
    assert(v, `astryx bundle emits ${leaf}`);
    const first = v.valuesByMode[Object.keys(v.valuesByMode)[0]];
    assert(!(first && first.type === 'VARIABLE_ALIAS'), `${leaf} is DECIDED-LITERAL (tokens/reanchor-decisions.json "literals") and must stay a literal, not an alias`);
  }
  const polaris = await exercise('examples/polaris/figma/polaris.bundle.json', 'Polaris', 12);
  assert(polaris.built === 12, `polaris bundle builds all 12 components incl. icon-bearing ones (got ${polaris.built})`);
  const docs = await exercise('examples/astryx/figma/astryx-docs.bundle.json', 'Astryx (docs theme)', 13);
  assert(docs.built === 13 && docs.vars === astryx.vars, `docs-theme bundle builds the same 13 with the same variable count (${docs.built}, ${docs.vars} vs ${astryx.vars})`);
  assert(docs.aliases === astryx.aliases, `docs-theme bundle carries the SAME ${astryx.aliases} minted aliases — re-anchoring is what makes them re-theme (got ${docs.aliases})`);
  console.log(`✔ sibling bundles — astryx (13 built, ${astryx.vars} vars, ${astryx.aliases} re-anchored minted aliases resolving the unchanged neutral light values), polaris (12 built incl. 22 embedded icons, ${polaris.vars} vars), astryx docs-theme (13 built, same inventory re-skinned, same ${docs.aliases} aliases — these ${docs.aliases} now DO re-theme): the JSON-only rule holds for EVERY example round through the real engine path`);
}

console.log('plugin-engine-check: all flows green (bundle, generate, sample-library, order, update-report, style-diff, drift-aware-update, apply, propose-diff, pr-dry-run, composite-plugin-path, composite-reverse-journey, drift-fingerprint, foreign-token-bundle, prototype-wiring, standing-channel, sibling-bundles)');
