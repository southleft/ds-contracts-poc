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
 *   5b. stale-base — G3's guard half (docs/18 Flow 7 step 4): a base that is
 *                  NOT what the set's stored sync fingerprint says the canvas
 *                  was last synced from WARNS by name ("may contain reverts")
 *                  in the summary + envelope; a matching base stays silent;
 *                  absent markers verdict 'unverifiable', never 'match'
 *   6. pr        — the dry-run PR plan, exact lines, zero network
 *   6b. canvas→code — task #40: a proposal names the files it becomes and
 *                  STAMPS the round-trip fact (tool-generated vs hand-built
 *                  vs unrecorded) into the CONTRACT-PROPOSAL envelope that
 *                  `ds-contracts propose-pr` reads
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
const sandbox = {
  window: {},
  TextEncoder,
  TextDecoder,
  console: { log() {}, warn() {}, error() {} },
};
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

// --- 3b. nested semantic identity ------------------------------------------
{
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const childA = clone(badge);
  childA.id = 'test.identity-child-a';
  childA.name = 'CollisionChild';
  childA.anchors.figma = { fileKey: null, componentSetKey: null, nodeId: null };
  const childB = clone(childA);
  childB.id = 'test.identity-child-b';
  childB.description = 'The authoritative same-name child.';

  const parent = clone(JSON.parse(read('contracts/card.contract.json')));
  parent.id = 'test.identity-parent';
  parent.name = 'IdentityParent';
  parent.description = 'Exercises ordinary refs, slot defaults, and slot preferred values by semantic identity.';
  parent.props = [];
  parent.anatomy.root.parts = {
    chosen: { component: { id: childB.id } },
    choice: {
      slot: {
        name: 'choice',
        figmaProperty: 'Choice',
        required: true,
        accepts: [childB.id],
        defaultContent: [{ id: childB.id }],
      },
    },
  };
  parent.anchors.figma = { fileKey: null, componentSetKey: null, nodeId: null };

  const identityMock = createFigmaMock();
  const runIdentity = (code) =>
    vm.runInContext(
      `(async () => {\n${code}\n})()`,
      vm.createContext({ figma: identityMock.figma, console: { log() {}, warn() {}, error() {} } }),
      { timeout: 120_000 },
    );
  const initial = DSC.planGenerate([childA, childB, parent], { withTokens: true, fileKey: '' });
  assert(initial.ok, `semantic identity fixture plans (${initial.ok ? '' : initial.issues.map((i) => i.headline).join('; ')})`);
  for (const step of initial.steps) await runIdentity(step.code);

  const marked = (id) =>
    identityMock.root.findOne(
      (n) =>
        (n.type === 'COMPONENT_SET' || (n.type === 'COMPONENT' && n.parent?.type !== 'COMPONENT_SET')) &&
        n.getSharedPluginData('ds_contracts', 'contractId') === id,
    );
  const childANode = marked(childA.id);
  let childBNode = marked(childB.id);
  let parentNode = marked(parent.id);
  assert(childANode && childBNode && childANode !== childBNode, 'fresh same-name children retain distinct semantic identities');
  const ownerOf = async (inst) => {
    const main = await inst.getMainComponentAsync();
    return main.parent?.type === 'COMPONENT_SET' ? main.parent : main;
  };
  let ordinary = parentNode.findOne((n) => n.type === 'INSTANCE' && n.name === 'chosen');
  assert(ordinary && (await ownerOf(ordinary)) === childBNode, 'same-name distinct-ID parent targets the authoritative child');
  // NATIVE SLOTS: the slot is a real SlotNode whose LAYER NAME is the SLOT
  // property's display name (the contract's slot.figmaProperty), and
  // `accepts` rides preferredValues on the SLOT definition — not an
  // INSTANCE_SWAP property pointing at a dashed placeholder.
  const choiceEntry = Object.entries(parentNode.componentPropertyDefinitions).find(
    ([key, d]) => d.type === 'SLOT' && key.split('#')[0] === 'Choice',
  );
  assert(choiceEntry, 'the contract slot minted a native SLOT property named Choice');
  const choiceDef = choiceEntry[1];
  assert(
    choiceDef?.preferredValues?.some((v) => v.key === childBNode.key) &&
      !choiceDef.preferredValues.some((v) => v.key === childANode.key),
    'slot preferred values resolve the authoritative child identity',
  );
  assert(
    typeof choiceDef.description === 'string' && choiceDef.description.includes('REFUSED BY FIGMA'),
    'the SLOT description names the constraint Figma cannot enforce (this fixture declares required: true)',
  );
  const choiceSlot = parentNode.findOne((n) => n.type === 'SLOT' && n.name === 'Choice');
  assert(
    choiceSlot && choiceSlot.componentPropertyReferences.slotContentId === choiceEntry[0],
    'the slot node is bound to that property id (slotContentId)',
  );
  const slotDefault = choiceSlot?.findOne((n) => n.type === 'INSTANCE');
  assert(slotDefault && (await ownerOf(slotDefault)) === childBNode, 'slot default resolves the authoritative child identity');
  assert(
    !parentNode.findOne((n) => n.name === 'Slot') &&
      !identityMock.root.findOne((n) => n.type === 'COMPONENT' && n.name === 'Slot'),
    'no dashed "Slot" utility component or instance is minted anywhere',
  );
  console.log('✔ nested semantic identity: ordinary refs, NATIVE slot defaults, and SLOT preferredValues bind same-name children by contractId, never canvas name');

  // Anchor adoption is rename-stable and amends the existing node/key. Clear
  // the semantic marker to force the second resolver tier explicitly.
  const childBKey = childBNode.key;
  const childBId = childBNode.id;
  childBNode.name = 'Designer-renamed child';
  childBNode.setSharedPluginData('ds_contracts', 'contractId', '');
  const anchoredB = clone(childB);
  anchoredB.description += ' Amended through its stable anchor.';
  anchoredB.anchors.figma.componentSetKey = childBKey;
  const anchorPlan = DSC.planGenerate([anchoredB], { withTokens: false, fileKey: '' });
  assert(anchorPlan.ok, 'rename-stability anchor fixture plans');
  for (const step of anchorPlan.steps) await runIdentity(step.code);
  childBNode = marked(childB.id);
  assert(childBNode?.id === childBId && childBNode.key === childBKey, 'anchor-based amend preserves node id and component key');

  const parentV2 = clone(parent);
  parentV2.description += ' Rebuilt after the child rename.';
  const renamePlan = DSC.planGenerate([anchoredB, parentV2], { withTokens: false, fileKey: '' });
  assert(renamePlan.ok, 'rename-stability parent fixture plans');
  for (const step of renamePlan.steps) await runIdentity(step.code);
  parentNode = marked(parent.id);
  ordinary = parentNode.findOne((n) => n.type === 'INSTANCE' && n.name === 'chosen');
  assert(ordinary && (await ownerOf(ordinary)) === childBNode, 'child rename does not change nested semantic binding');
  console.log(`✔ rename stability + amend key preservation: anchor adoption kept node ${childBId} / key ${childBKey}, and rebuilt parent refs still target it`);

  // Two old generated nodes with the same legacy name are not evidence for
  // either one. The resolver must refuse before creating or amending.
  const legacyMock = createFigmaMock();
  for (let i = 0; i < 2; i++) {
    const legacy = legacyMock.figma.createComponent();
    legacy.name = childA.name;
    legacy.setSharedPluginData('ds_contracts', 'specHash', `legacy-${i}`);
    legacyMock.figma.currentPage.appendChild(legacy);
  }
  const legacyPlan = DSC.planGenerate([childA], { withTokens: false, fileKey: '' });
  assert(legacyPlan.ok, 'duplicate legacy refusal fixture plans');
  let legacyRefusal = '';
  try {
    for (const step of legacyPlan.steps) {
      await vm.runInContext(
        `(async () => {\n${step.code}\n})()`,
        vm.createContext({ figma: legacyMock.figma, console: { log() {}, warn() {}, error() {} } }),
        { timeout: 120_000 },
      );
    }
  } catch (error) {
    legacyRefusal = String(error?.message ?? error);
  }
  assert(
    legacyRefusal.includes('duplicate explicit legacy-generated name') && legacyRefusal.includes(childA.name),
    `duplicate legacy targets refuse by name (got "${legacyRefusal}")`,
  );
  console.log('✔ duplicate legacy refusal: two unmarked generated same-name targets are ambiguous and the sync refuses instead of guessing');

  const foreignMock = createFigmaMock();
  const foreign = foreignMock.figma.createComponent();
  foreign.name = childA.name;
  foreignMock.figma.currentPage.appendChild(foreign);
  const foreignPlan = DSC.planGenerate([childA], { withTokens: true, fileKey: '' });
  assert(foreignPlan.ok, 'unmarked foreign same-name fixture plans');
  for (const step of foreignPlan.steps) {
    await vm.runInContext(
      `(async () => {\n${step.code}\n})()`,
      vm.createContext({ figma: foreignMock.figma, console: { log() {}, warn() {}, error() {} } }),
      { timeout: 120_000 },
    );
  }
  const generated = foreignMock.root.findOne(
    (n) =>
      (n.type === 'COMPONENT_SET' || (n.type === 'COMPONENT' && n.parent?.type !== 'COMPONENT_SET')) &&
      n.getSharedPluginData('ds_contracts', 'contractId') === childA.id,
  );
  assert(
    generated && generated !== foreign && foreign.getSharedPluginData('ds_contracts', 'contractId') === '',
    'an unmarked foreign same-name component is never adopted',
  );
  console.log('✔ fresh semantic identity: an unmarked foreign same-name node remains untouched while a separately marked target is created');
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
  const storedHash = markerOf(badge.id)?.getSharedPluginData('ds_contracts', 'specHash');
  assert(
    dump._provenance && dump._provenance.dumpVersion === '1.30',
    `dump v1.30: provenance dumpVersion is 1.30 (got ${dump._provenance && dump._provenance.dumpVersion})`,
  );
  assert(
    storedHash && dump.Badge.specHash === storedHash,
    `dump v1.30 carries the stamped specHash (got ${dump.Badge.specHash} vs stored ${storedHash})`,
  );
  const storedVersion = markerOf(badge.id)?.getSharedPluginData('ds_contracts', 'version');
  assert(
    storedVersion && dump.Badge.version === storedVersion,
    `dump v1.30 carries the stamped version (got ${dump.Badge.version} vs stored ${storedVersion})`,
  );
  {
    const subject = markerOf(badge.id);
    const v0 = subject && subject.children && subject.children[0];
    assert(v0, 'dump v1.30: Badge has a variant to pin min/max defaults');
    const prior = { minWidth: v0.minWidth, minHeight: v0.minHeight, maxWidth: v0.maxWidth, maxHeight: v0.maxHeight };
    v0.minWidth = 0;
    v0.minHeight = 0;
    v0.maxWidth = 0;
    v0.maxHeight = 0;
    const dumpZero = await runScript(scoped);
    const hasZero = (n) => {
      if (!n || typeof n !== 'object') return false;
      if (n.minWidth === 0 || n.minHeight === 0 || n.maxWidth === 0 || n.maxHeight === 0) return true;
      return (n.children || []).some(hasZero) || (n.variants || []).some(hasZero);
    };
    assert(!hasZero(dumpZero.Badge), 'dump v1.30 omits Figma-default min/max 0 (FC-DUMP-MINMAX-ZERO-INVENTED)');
    v0.minWidth = 44;
    const dumpTap = await runScript(scoped);
    assert(
      dumpTap.Badge.variants[0].minWidth === 44,
      `dump v1.30 still carries a drawn minWidth 44 (got ${dumpTap.Badge.variants[0] && dumpTap.Badge.variants[0].minWidth})`,
    );
    v0.minWidth = prior.minWidth;
    v0.minHeight = prior.minHeight;
    v0.maxWidth = prior.maxWidth;
    v0.maxHeight = prior.maxHeight;
  }
  {
    // FC-PLUGIN-SECTION-SELECTION: selecting the host Section around a
    // standalone COMPONENT (live Flowbite Card / Kbd) used to resolve
    // nothing. Lift the real function out of code.js and drive it.
    const codeJs = read('figma-sync/plugin/code.js');
    const startMark = '// --- SELECTION SET NAMES (start)';
    const endMark = '// --- SELECTION SET NAMES (end)';
    const s = codeJs.indexOf(startMark);
    const e = codeJs.indexOf(endMark);
    assert(s >= 0 && e > s, 'code.js carries the marked SELECTION SET NAMES block');
    const fnCtx = vm.createContext({ figma });
    vm.runInContext(`${codeJs.slice(s, e)}\nglobalThis.selectionSetNames = selectionSetNames;`, fnCtx);
    const page = figma.currentPage;
    const priorSel = page.selection;
    const section = figma.createSection();
    section.name = 'Kbd host';
    page.appendChild(section);
    const hosted = figma.createComponent();
    hosted.name = 'Kbd';
    section.appendChild(hosted);
    page.selection = [section];
    const fromSection = await fnCtx.selectionSetNames();
    page.selection = [hosted];
    const fromComp = await fnCtx.selectionSetNames();
    const empty = figma.createSection();
    empty.name = 'Empty host';
    page.appendChild(empty);
    page.selection = [empty];
    const fromEmpty = await fnCtx.selectionSetNames();
    page.selection = priorSel;
    section.remove();
    empty.remove();
    assert(
      JSON.stringify(fromSection) === JSON.stringify(['Kbd']),
      `FC-PLUGIN-SECTION-SELECTION: selecting the host Section names the hosted COMPONENT (got ${JSON.stringify(fromSection)})`,
    );
    assert(
      JSON.stringify(fromComp) === JSON.stringify(['Kbd']),
      `FC-PLUGIN-SECTION-SELECTION: selecting the standalone COMPONENT still names it (got ${JSON.stringify(fromComp)})`,
    );
    assert(
      JSON.stringify(fromEmpty) === JSON.stringify([]),
      `FC-PLUGIN-SECTION-SELECTION: an empty Section still resolves nothing (got ${JSON.stringify(fromEmpty)})`,
    );
  }
  const structuredDefs = dump.Badge.propertyDefinitions ?? {};
  const structuredAxes = Object.keys(structuredDefs)
    .filter((key) => structuredDefs[key].type === 'VARIANT')
    .sort();
  assert(structuredAxes.length > 0, 'dump v1.14 captures structured VARIANT definitions');
  assert(
    dump.Badge.variants.every(
      (variant) =>
        variant.variantProperties &&
        JSON.stringify(Object.keys(variant.variantProperties).sort()) ===
          JSON.stringify(structuredAxes),
    ),
    'dump v1.14 captures a complete structured tuple on every direct variant row',
  );

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
  assert(
    exported.projection?.status === 'verified-exact',
    'a structured tool-generated set exports returned-tuple verified exactness',
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

  // --- dump v1.12: WRAPPING is READ BACK ------------------------------------
  // core/emit-figma-script.ts has written `node.layoutWrap = 'WRAP'` from a
  // contract's `layout.wrap` since v15, and NOTHING read it back — a wrapping
  // chip row went to the canvas correctly and returned as a single line with no
  // receipt at all. Zero of 804 committed contracts use `layout.wrap`, which is
  // exactly why it survived: invisible until an adopter's tag group is the
  // first thing they try. Proven here against the REAL dump source (the
  // ui.html block, drift-guarded), not a paraphrase of it.
  const setNode = markerOf(badge.id);
  const variantNode = (setNode.children || []).find((c) => c.layoutMode && c.layoutMode !== 'NONE');
  assert(variantNode, 'the mock Badge set has an auto-layout variant to wrap');
  assert(
    variantNode.layoutWrap === 'NO_WRAP',
    `the mock defaults layoutWrap to the REAL Plugin API default (got ${variantNode.layoutWrap})`,
  );
  const noWrap = await runScript(scoped);
  const layoutOf = (d) => (d.Badge.variants.find((v) => v.layout) || {}).layout;
  assert(layoutOf(noWrap) && layoutOf(noWrap).wrap === undefined,
    'a NON-wrapping stack carries no `wrap` key (absence means one line — the key is not written as false)');

  variantNode.layoutWrap = 'WRAP';
  variantNode.itemSpacing = 4;
  variantNode.counterAxisSpacing = 12;
  const wrapped = layoutOf(await runScript(scoped));
  assert(wrapped.wrap === true, `layoutWrap 'WRAP' is captured as layout.wrap (got ${JSON.stringify(wrapped)})`);
  assert(wrapped.rowSpacing === 12, `a DISTINCT counterAxisSpacing is captured as rowSpacing (got ${wrapped.rowSpacing})`);

  // THE SYNC STATE READS AS A NUMBER EQUAL TO itemSpacing — it does NOT read as
  // null. `null` is write-only ("This will never return null"), so an earlier
  // cut of this pin set null and tested a branch Figma cannot reach: it proved
  // nothing about the state that actually occurs. This is the real one.
  variantNode.counterAxisSpacing = variantNode.itemSpacing;
  const followed = layoutOf(await runScript(scoped));
  assert(followed.wrap === true && followed.rowSpacing === undefined,
    `a SYNCED counterAxisSpacing (a number EQUAL to itemSpacing — the state Figma actually returns) invents no rowSpacing fact (got ${followed.rowSpacing})`);

  // The one wrap fact with no vocabulary anywhere is REFUSED BY NAME rather
  // than silently rendering as packed lines.
  variantNode.counterAxisAlignContent = 'SPACE_BETWEEN';
  const distributed = await runScript(scoped);
  const degradations = distributed._degradations || [];
  assert(
    degradations.some((d) => d.code === 'wrap-align-content-unsupported'),
    `counterAxisAlignContent SPACE_BETWEEN is named as a degradation (got ${degradations.map((d) => d.code).join(', ')})`,
  );
  variantNode.counterAxisAlignContent = 'AUTO';
  variantNode.layoutWrap = 'NO_WRAP';

  // --- dump v1.12: ALL FIVE CONSTRAINT VALUES ------------------------------
  // Figma's ConstraintType is MIN|CENTER|MAX|STRETCH|SCALE and both capture
  // sites mapped only three, so `H['STRETCH']` was undefined and the `if (h &&
  // v)` guard dropped the WHOLE field — which propose then reads as
  // `?? 'LEFT'` / `?? 'TOP'`. A substituted constraint, not a lost one.
  // The abs block needs an ABSOLUTELY-PLACED child (layoutPositioning
  // 'ABSOLUTE', or any child of a non-auto-layout parent) — constraints only
  // ride an absolute box.
  const constrained = (variantNode.children || []).find((c) => c.constraints);
  if (constrained) {
    const priorC = constrained.constraints;
    const priorPos = constrained.layoutPositioning;
    constrained.layoutPositioning = 'ABSOLUTE';
    constrained.constraints = { horizontal: 'STRETCH', vertical: 'STRETCH' };
    const stretchDump = await runScript(scoped);
    const findBox = (node) => {
      if (!node || typeof node !== 'object') return undefined;
      if (node.abs && node.abs.constraints && node.abs.constraints.horizontal === 'STRETCH') return node.abs;
      for (const ch of node.children || []) {
        const hit = findBox(ch);
        if (hit) return hit;
      }
      return undefined;
    };
    const stretched = stretchDump.Badge.variants.map(findBox).find(Boolean);
    assert(
      stretched && stretched.constraints.vertical === 'STRETCH',
      `STRETCH survives the capture (got ${stretched ? JSON.stringify(stretched.constraints) : 'the field DROPPED — the pre-v1.12 bug'})`,
    );
    constrained.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    const scaleDump = await runScript(scoped);
    const findScale = (node) => {
      if (!node || typeof node !== 'object') return undefined;
      if (node.abs && node.abs.constraints && node.abs.constraints.horizontal === 'SCALE') return node.abs;
      for (const ch of node.children || []) {
        const hit = findScale(ch);
        if (hit) return hit;
      }
      return undefined;
    };
    assert(scaleDump.Badge.variants.map(findScale).find(Boolean), 'SCALE survives the capture too (it is refused later, BY NAME — but the fact must reach the decision)');
    constrained.constraints = priorC;
    constrained.layoutPositioning = priorPos;
    console.log(
      '✔ dump v1.12 constraints: STRETCH and SCALE survive the capture — both were silently dropped by a 3-of-5 value map, and propose reads an absent field as LEFT×TOP, so the engine substituted a constraint rather than losing one',
    );
  }

  // THE CRASH THE MOCK USED TO ABSORB. layoutWrap is HORIZONTAL-only and Figma
  // THROWS otherwise; `layout: { direction: 'column', wrap: true }` is legal
  // CSS and schema-valid, so an ordinary contract killed the generate run from
  // v15 until this round. The mock now enforces the precondition, and
  // emit-figma-script guards the write.
  let columnThrew = false;
  try {
    variantNode.layoutMode = 'VERTICAL';
    variantNode.layoutWrap = 'WRAP';
  } catch {
    columnThrew = true;
  }
  variantNode.layoutMode = 'HORIZONTAL';
  variantNode.layoutWrap = 'NO_WRAP';
  assert(columnThrew, 'the mock ENFORCES the API precondition: setting layoutWrap on a VERTICAL stack throws, as Figma does');
  console.log(
    "✔ layoutWrap precondition: the mock throws on a VERTICAL stack exactly as Figma does, and emit-figma-script now guards the write (`l.wrap && node.layoutMode === 'HORIZONTAL'`) and leaves a † receipt naming the dropped column wrap — a contract spelling `direction: column, wrap: true` is legal CSS, schema-valid, and used to kill the whole run",
  );
  console.log(
    '✔ dump v1.12 wrap: layoutWrap WRAP → layout.wrap, a DISTINCT counterAxisSpacing → rowSpacing, a SYNCED one (a number EQUAL to itemSpacing — null is write-only and never read back) invents nothing, and counterAxisAlignContent SPACE_BETWEEN is refused BY NAME — the return leg the emitter has been writing to since v15',
  );
}

// --- 5b. G3 STALE-BASE GUARD (partial) --------------------------------------
// docs/18 Flow 7 step 4: Propose against a base the canvas was NOT last
// synced from manufactures the engineer's merged change as the designer's
// revert. The guard compares the set's stored sync fingerprint (the
// ds_contracts specHash markers) against the provided base and WARNS — in
// the summary (→ PR body + export envelope) and as a structured verdict.
// The mock canvas was amended to Badge v9.9.9 in section 4, so the ORIGINAL
// v1 badge contract is exactly the stale base of the story.
{
  const ui = read('figma-sync/plugin/ui.html');
  const openTag = '<script type="text/plain" id="dump-source">';
  const start = ui.indexOf(openTag);
  const source = ui.slice(start + openTag.length, ui.indexOf('</script>', start)).replace(/^\n/, '');
  const scoped = source.replace(
    /^const TARGET_SETS = \[[^\n]*\];$/m,
    `const TARGET_SETS = ${JSON.stringify(['Badge'])};`,
  );
  const dump = await runScript(scoped);
  const inv = (await runScript(DSC.inventoryScriptSource())).inventory;
  const row = inv.find((r) => r.contractId === badge.id);
  assert(row && row.specHash, 'the marked Badge row carries its stored sync fingerprint');
  const markers = { contractId: row.contractId, specHash: row.specHash, version: row.version };

  // The contract the canvas WAS last synced from (section 4's vNext, rebuilt
  // byte-identically): a FRESH base — verdict 'match', zero warnings.
  const vNext = JSON.parse(JSON.stringify(badge));
  vNext.version = '9.9.9';
  vNext.props.push({
    name: 'experimental',
    description: 'Harness-added boolean prop (update-report fixture).',
    type: 'boolean',
    default: false,
    bindings: { figma: { kind: 'BOOLEAN', property: 'Experimental' }, code: { prop: 'experimental' } },
  });
  const fresh = DSC.proposeDiff(dump, 'Badge', vNext, { canvasMarkers: markers });
  assert(fresh.ok, `fresh-base propose succeeds (${fresh.ok ? '' : fresh.issue.headline})`);
  assert(
    fresh.baseFreshness && fresh.baseFreshness.verdict === 'match' && fresh.baseFreshness.stale === false,
    `a base matching the stored sync fingerprint verdicts 'match' (got ${JSON.stringify(fresh.baseFreshness)})`,
  );
  assert(
    !fresh.summaryLines.some((l) => l.includes('Stale base')),
    'a fresh base adds NO warning line — the guard never manufactures an alarm',
  );

  // The ORIGINAL v1 badge: a STALE base — the diff would read the applied
  // v9.9.9 changes as the designer's edits, and dropping them is a revert.
  const stale = DSC.proposeDiff(dump, 'Badge', badge, { canvasMarkers: markers });
  assert(stale.ok, 'stale-base propose still succeeds — warn and name, never block');
  assert(
    stale.baseFreshness && stale.baseFreshness.verdict === 'stale' && stale.baseFreshness.stale === true,
    `a base that is not what the canvas last synced from verdicts 'stale' (got ${JSON.stringify(stale.baseFreshness)})`,
  );
  assert(
    stale.summaryLines[0].includes('last synced from a different contract version') &&
      stale.summaryLines[0].includes('may contain reverts'),
    `the warning LEADS the summary and names the revert risk (got "${stale.summaryLines[0]}")`,
  );
  assert(
    stale.summaryLines[0].includes(`v${row.version}`) && stale.summaryLines[0].includes(`v${badge.version}`),
    'the warning names both versions (canvas-synced vs provided base)',
  );
  const staleExport = JSON.parse(stale.exportJson);
  assert(
    staleExport.baseFreshness && staleExport.baseFreshness.verdict === 'stale',
    'the CONTRACT-PROPOSAL envelope carries the structured stale verdict',
  );
  assert(
    staleExport.summary.some((l) => l.includes('may contain reverts')),
    'the export/PR summary carries the warning line (propose-pr prints summary lines into the PR body)',
  );

  // No markers passed (every pre-guard caller): 'unverifiable' BY NAME —
  // never a silent 'match', never a manufactured warning.
  const unknown = DSC.proposeDiff(dump, 'Badge', badge);
  assert(
    unknown.ok && unknown.baseFreshness.verdict === 'unverifiable' && unknown.baseFreshness.stale === false,
    `no markers → verdict 'unverifiable' by name (got ${JSON.stringify(unknown.ok ? unknown.baseFreshness : unknown.issue)})`,
  );
  assert(
    !unknown.summaryLines.some((l) => l.includes('Stale base')),
    'an unverifiable base adds no warning line',
  );
  console.log(
    '✔ G3 stale-base guard (partial): a base matching the stored sync fingerprint stays silent; the pre-sync v1 base WARNS by name ("may contain reverts") in summary + envelope; absent markers verdict "unverifiable", never a silent match',
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
  // THE HARNESS MUST PRELOAD EXACTLY AS THE EMITTED SCRIPT DOES. v6 refuses to
  // compute over an unloaded name map (core/canvas-fingerprint.ts) so that a
  // forgotten preload cannot masquerade as a canvas edit — and this gate was
  // one of the three call sites that forgot, reading 'canvas-edited' on an
  // untouched tree. Declaring an EMPTY map here would be equally wrong in the
  // other direction: the mock DOES serve variables, the stamp was computed
  // with their names resolved, and hashing the recompute over (unresolved)
  // would manufacture the very mismatch this pin exists to disprove. So the
  // harness awaits the real loader against the same mock the stamp came from.
  const fpApi = new Function(
    `${srcMatch[1]}; return { fp: dsCanvasFingerprint, load: dsLoadVarNames, setNames: dsSetVarNames };`,
  )();
  await (async () => {
    const prev = globalThis.figma;
    globalThis.figma = figma;
    try { await fpApi.load(); } finally { globalThis.figma = prev; }
  })();
  const fp = fpApi.fp;
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
  assert(stored.startsWith('v6:'), 'drift gate: stamps carry the v6 version prefix (binding-bearing scheme)');
  assert(fp(subject) === stored, 'drift gate: recomputing the fingerprint over the untouched tree MATCHES the stamp (module ≡ emitted copy)');
  // simulate a designer edit: swap a fill somewhere in the tree
  const victim = subject.findAll((n) => (n.fills ?? []).some((f) => f.type === 'SOLID'))[0];
  assert(victim, 'drift gate: an editable filled node exists');
  // LOCALIZATION (live finding: "which of the 63 buttons?"): per-variant
  // stamps exist and the edit resolves to EXACTLY the containing variant.
  const variants = subject.children ?? [];
  assert(variants.length > 0 && variants.every((v) => (v.getSharedPluginData('ds_contracts', 'canvasFingerprint') || '').startsWith('v6:')), 'drift gate: every VARIANT carries its own v6 fingerprint stamp');
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
  // FC-PLUGIN-STANDALONE-DRIFT-SNAPSHOT: Flowbite Card/Kbd are COMPONENT
  // roots. Check Drift used to report canvas-edited with empty
  // editedVariants because the WHAT drill-down walked SET children only.
  {
    const snapFn = new Function(`${srcMatch[1]}; return dsCanvasSnapshot;`)();
    const solo = figma.createComponent();
    solo.name = 'Kbd';
    solo.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 }, opacity: 1 }];
    root.children[0].appendChild(solo);
    solo.setSharedPluginData('ds_contracts', 'contractId', 'flowbite.kbd');
    const storedSoloSnap = snapFn(solo);
    assert(storedSoloSnap.some((l) => l.includes('|fill|')), 'drift gate: standalone COMPONENT snapshot carries fill');
    solo.setSharedPluginData('ds_contracts', 'canvasSnapshot', JSON.stringify(storedSoloSnap));
    solo.setSharedPluginData('ds_contracts', 'canvasFingerprint', fp(solo));
    const priorSoloFills = solo.fills;
    solo.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 1 }, opacity: 1 }];
    assert(
      fp(solo) !== solo.getSharedPluginData('ds_contracts', 'canvasFingerprint'),
      'FC-PLUGIN-STANDALONE-DRIFT-SNAPSHOT: a standalone fill edit changes the fingerprint',
    );
    const freshSoloSnap = snapFn(solo);
    const soloChanged = freshSoloSnap.filter((l) => !storedSoloSnap.includes(l));
    assert(
      soloChanged.some((l) => l.includes('|fill|') && l.includes('"r":1')),
      'FC-PLUGIN-STANDALONE-DRIFT-SNAPSHOT: standalone snapshot names the edited fill',
    );
    const codeJsSolo = read('figma-sync/plugin/code.js');
    assert(
      /FC-PLUGIN-STANDALONE-DRIFT-SNAPSHOT[\s\S]{0,500}node\.type === 'COMPONENT'[\s\S]{0,200}pushEditedSnapshot\(node\)/.test(codeJsSolo),
      'FC-PLUGIN-STANDALONE-DRIFT-SNAPSHOT: check-drift drills COMPONENT canvasSnapshot',
    );
    solo.fills = priorSoloFills;
    solo.remove();
  }
  console.log(`✔ drift round: canvasFingerprint stamped on ${sets.length} sets; untouched≡stamp, edited≠stamp, reverted≡stamp — Check Drift is mechanically grounded and LOCALIZES to the exact variant (SET children + standalone COMPONENT)`);
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
  // TASK #38 (the harness recapture wave): 14 → 13. The one that left is
  // `autocomplete-autocomplete-clearindicator` — MUI renders the clear button
  // `visibility: hidden` in every combo of the closed-state capture, so the
  // part paints no ink anywhere and the engine's `non-painting-part` refusal
  // drops it. MUI's shipped artifacts predated that refusal, so the bundle
  // had been carrying a glyph for a button the browser draws nowhere. A
  // DECREASE here is the phantom leaving, not coverage lost.
  // Wave 5 denominator (2026-08-05): 13 → 22 as circular-progress + other
  // promoted SVG assets joined the MUI bundle paste surface.
  assert(
    parsed.icons && Object.keys(parsed.icons).length === 22,
    `the bundle surfaces its 22 icon assets (got ${parsed.icons ? Object.keys(parsed.icons).length : 'none'})`,
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
  // Wave 5 denominator (2026-08-05): Accordion→TextField carried set expanded
  // from 11 to 27 COMPONENT_SETs as Alert/Avatar/Badge/… joined the paste surface.
  assert(
    shapeA === 'Accordion(4), Alert(12), Autocomplete(2), Avatar(3), Badge(14), Button(75), Card(4), Checkbox(3), Chip(28), CircularProgress(2), Dialog(5), Divider(3), Drawer(2), Fab(9), IconButton(9), InputAdornment(2), LinearProgress(2), Link(42), Paper(8), Radio(14), Select(2), Slider(12), Snackbar(3), Switch(28), Table(2), Tabs(6), TextField(6)',
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
  // ORPHAN-LEAF + ROW-RULE ROUND (tasks #42/#35): 1684 -> 1543. MUI's shipped
  // minted tree lost 141 leaves — every one of them a variable NOTHING bound:
  // 124 `row-rule-color` refs (a `currentcolor` mirror Chromium enumerates and
  // no library authored) and the leaves of parts the anatomy promotion had
  // already refused by name. The EQUIVALENCE this pin exists for is unchanged
  // and is what matters: the bundle path and the compiled-script path land the
  // SAME count and the same NAME inventory.
  // Wave 5 denominator (2026-08-05): 1543 → 2136 as carried Alert…TextField
  // contracts joined the mint surface.
  // Wave 6 (2026-08-20): 2136 → 2144 — inventory moved with the token tree
  // 2026-08-22: 2144 → 2143 — the promoter's authored-facts ledger pruned the
  // orphan `imported.link.root.width` leaf (16889547 had unbound it by hand).
  // regen that shipped the node-opacity unbind; both paths still agree.
  assert(
    mockA.variables.length === 2143 && mockB.variables.length === 2143,
    `both paths land 2143 variables (bundle ${mockA.variables.length}, script ${mockB.variables.length})`,
  );
  assert(
    aliasCountOf(mockA) === 134 && aliasCountOf(mockB) === 134,
    `both paths carry 134 Figma-native alias variables (bundle ${aliasCountOf(mockA)}, script ${aliasCountOf(mockB)})`,
  );
  const namesA = mockA.variables.map((v) => v.name).sort().join('\n');
  const namesB = mockB.variables.map((v) => v.name).sort().join('\n');
  assert(namesA === namesB, 'bundle path ≡ script path on the full variable NAME inventory');

  // --- MUI REGEN ROUND (task #31) — REVIEW-THEN-REPIN -----------------------
  // Every counted number above (set shapes, variant grids, variable inventory,
  // the resolved fill) was UNMOVED by the three fixes MUI's artifacts were
  // stale by. That is the finding, not the reassurance: these pins are
  // STRUCTURALLY BLIND to the class of defect the fixes address, which is why
  // GENESIS-BATCH.figma.js could sit three engine fixes out of date while this
  // check stayed green. Two pins at the level where the fixes actually live,
  // asserted on BOTH paths so a stale compiled script fails here too.
  const geomOf = (mock) => {
    const dialogCells = mock.root.findAll((n) => n.type === 'COMPONENT' && /^Max width=/.test(n.name));
    const iconBox = (nm) => mock.root.findAll((n) => n.name === nm).map((n) => ({
      w: Math.round(n.width), h: Math.round(n.height),
      kid: (n.children ?? []).some((c) => c.name === `${nm}-icon`),
      fills: (n.fills ?? []).length > 0,
    }));
    return {
      dialogWidths: [...new Set(dialogCells.map((n) => Math.round(n.width)))].sort((a, b) => a - b),
      clear: iconBox('autocomplete-clearindicator'),
      popup: iconBox('autocomplete-popupindicator'),
    };
  };
  const gA = geomOf(mockA);
  const gB = geomOf(mockB);
  // D5 — the Dialog root is a viewport-pinned full-bleed scrim, so the floor
  // measured its width as the CAPTURE VIEWPORT (900px) and the emitter baked
  // it. Every Dialog cell drew 900px wide: a number that exists nowhere in MUI.
  assert(
    !gA.dialogWidths.includes(900) && !gB.dialogWidths.includes(900),
    `D5: no Dialog cell may carry the 900px CAPTURE STAGE width (bundle ${gA.dialogWidths.join('/')}, script ${gB.dialogWidths.join('/')})`,
  );
  assert(
    JSON.stringify(gA.dialogWidths) === JSON.stringify(gB.dialogWidths) && gA.dialogWidths.join() === '496',
    `D5: both paths hug the Dialog to its real content width 496 (bundle ${gA.dialogWidths.join('/')}, script ${gB.dialogWidths.join('/')})`,
  );
  // D6b — an icon part can also be a BOX. MUI's Autocomplete POPUP indicator
  // is a real button (background + 1px border + padding) that lowered to a
  // bare glyph, throwing the whole control box away.
  //
  // TASK #38 (the harness recapture wave): the CLEAR indicator is no longer
  // asserted present here, and its absence is asserted instead. MUI renders
  // it `visibility: hidden` until the field is hovered or focused, so in every
  // combo of the closed-state capture it paints no ink and no descendant of it
  // paints either — the engine's `non-painting-part` refusal drops it. MUI's
  // shipped artifacts predated that refusal, so this pin had been asserting
  // that a phantom (a fully-visible 28x28 button with an SVG glyph the browser
  // draws nowhere) was on the canvas. Inverted, not deleted.
  const boxOk = (rows) => rows.length > 0 && rows.every((r) => r.w === 28 && r.h === 28 && r.kid && r.fills);
  assert(
    boxOk(gA.popup) && boxOk(gB.popup),
    `D6b: the Autocomplete popup indicator must carry a 28x28 filled control box with an -icon child, not a bare vector (bundle ${JSON.stringify(gA.popup[0])}, script ${JSON.stringify(gB.popup[0])})`,
  );
  assert(
    gA.clear.length === 0 && gB.clear.length === 0,
    `D6b/phantom: \`autocomplete-clearindicator\` must NOT reach the canvas on either path — MUI hides it with \`visibility: hidden\` in every captured combo, so it paints nothing anywhere (bundle ${gA.clear.length}, script ${gB.clear.length})`,
  );
  console.log(
    `✔ MUI regen (task #31) — the three fixes are pinned where they LIVE, on both paths: Dialog cells hug 496 and can never carry the 900px capture stage again (D5); the Autocomplete POPUP indicator carries a 28x28 filled control box with an -icon child instead of a bare glyph, and the visibility:hidden CLEAR indicator — a phantom the shipped artifacts carried until the task-#38 recapture — reaches neither path (D6b). Every pre-existing equivalence number above was UNMOVED by these fixes — which is exactly why a stale GENESIS-BATCH could pass this check for a whole round`,
  );

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
    `✔ foreign token set (MUI): mui.bundle.json — ONE JSON paste — plans tokenSet-first ("MUI" collection) and builds ${shapeA} + standalone ${soloA} with 2143 variables (134 Figma-native aliases), EQUIVALENT to the compiled-script path (sets, standalone, variants, variable inventory); contained-primary Button fill resolves #1976d2; a ref outside base+minted refuses BY NAME`,
  );

  // --- NESTED MODES ARE REFUSED, NOT SILENTLY FLATTENED TO BASE -----------
  // The tokenSet's `base` is FLAT (dot-path names); its `modes` must use the
  // SAME flat names. Nothing enforced that. A nested mode tree — which is what
  // DTCG looks like by default, and exactly what a captured Figma variable
  // collection produces — has no key matching any base name, so every lookup
  // missed, every variable kept its base value, and the plugin built a
  // two-mode collection whose Dark mode WAS its Light mode. Reported as
  // success the whole way: the CLI printed "modes: light/dark" and the
  // generated script header printed "Light/Dark modes, N variables".
  //
  // Carbon's pin above already requires light !== dark, and it did not catch
  // this: every committed bundle happens to carry FLAT modes, so the nested
  // path was never exercised. The guard therefore belongs on the REFEREE,
  // where shape is decided, rather than on any one library's values.
  {
    // Driven through parseIncomingValue — the SAME entrypoint the Generate tab
    // calls on a paste — so the pin covers the door a user actually hits.
    const mkBundle = (modes) => ({
      type: 'CONTRACTS-BUNDLE',
      version: 1,
      contracts: [badge],
      tokenSet: { name: 'ShapePin', base: { 'color.bg': { $type: 'color', $value: '#ffffff' } }, modes },
    });
    const okFlat = DSC.parseIncomingValue(
      mkBundle({ light: { 'color.bg': { $value: '#ffffff' } }, dark: { 'color.bg': { $value: '#000000' } } }),
    );
    assert(okFlat.ok, `a FLAT modes object still parses (got: ${okFlat.ok ? '' : okFlat.issue.headline})`);

    const bad = DSC.parseIncomingValue(
      mkBundle({ light: { color: { bg: { $value: '#ffffff' } } }, dark: { color: { bg: { $value: '#000000' } } } }),
    );
    assert(!bad.ok, 'a NESTED modes object is REFUSED (it used to parse, then silently render as base)');
    const msg = bad.ok ? '' : bad.issue.headline;
    assert(
      msg.includes('NESTED') && msg.includes('"color"') && msg.includes('FLAT'),
      `the refusal names the offending key and the required shape (got: ${msg})`,
    );
  }
  console.log(
    '✔ tokenSet modes: a FLAT modes object parses and a NESTED one is REFUSED BY NAME — the shape was documented and unenforced, so a nested mode tree (what DTCG and a captured Figma collection both look like) silently rendered Dark as Light while every layer reported success',
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

    // dump v1.27: CHANGE_TO wiring is NAMED, not silent. The State axis
    // recovers the matrix; dump does not invent onClick. Pin against the
    // real #dump-source block (drift-guarded), on the MUI Button that
    // this block already proved carries exactly 3 Default-plane sources.
    {
      const ui = read('figma-sync/plugin/ui.html');
      const openTag = '<script type="text/plain" id="dump-source">';
      const start = ui.indexOf(openTag);
      assert(start >= 0, 'dump v1.27: ui.html carries the #dump-source block');
      const source = ui.slice(start + openTag.length, ui.indexOf('</script>', start)).replace(/^\n/, '');
      const scopedButton = source.replace(
        /^const TARGET_SETS = \[[^\n]*\];$/m,
        `const TARGET_SETS = ${JSON.stringify(['Button'])};`,
      );
      assert(scopedButton !== source, 'dump v1.27: TARGET_SETS scopes to Button');
      const buttonDump = await runIn(mockA, scopedButton);
      const rxNotes = (buttonDump._degradations || []).filter((d) => d.code === 'prototype-reactions-unsupported');
      assert(
        buttonDump._provenance && buttonDump._provenance.dumpVersion === '1.30',
        `dump v1.30: provenance dumpVersion is 1.30 (got ${buttonDump._provenance && buttonDump._provenance.dumpVersion})`,
      );
      assert(
        rxNotes.length === wiringA.length,
        `dump v1.27 names every Button Default-plane reaction source (got ${rxNotes.length} vs ${wiringA.length} wired variants)`,
      );
      assert(
        rxNotes.every((d) => d.message.includes('ON_HOVER→CHANGE_TO') && d.message.includes('ON_PRESS→CHANGE_TO') && d.message.includes('does not invent onClick')),
        `dump v1.27 receipts name both CHANGE_TO wires and refuse onClick (got ${rxNotes.map((d) => d.message).join(' | ')})`,
      );
    }

    // 10. FINGERPRINT v5 sees reactions — the v4 blindness this round closes.
    const fpSrc = read('core/canvas-fingerprint.ts').match(/FINGERPRINT_SRC: string = `([\s\S]*?)`;/)[1];
    const fpFn = new Function(`${fpSrc}; return dsCanvasFingerprint;`)();
    const snapFn = new Function(`${fpSrc}; return dsCanvasSnapshot;`)();
    const beforeFp = fpFn(src);
    const lines = snapFn(src).filter((l) => l.includes('|reaction|'));
    assert(
      lines.length === 2 && lines[0].includes('ON_HOVER') && lines[0].includes('State=Hover') && !/\d+:\d+/.test(lines[0].split('|reaction|')[1]),
      `prototype wiring: the fingerprint snapshot records reactions by DESTINATION NAME, never node id (got ${JSON.stringify(lines[0] ?? '(none)')})`,
    );
    await src.setReactionsAsync([src.reactions[0]]); // a designer strips the press wiring
    assert(
      fpFn(src) !== beforeFp,
      'prototype wiring: STRIPPING a reaction changes the fingerprint — the drift signal v4 was blind to',
    );
    assert(
      beforeFp.startsWith('v6:') && fpFn(src).startsWith('v6:'),
      'prototype wiring: fingerprints carry the v6 prefix',
    );

    console.log(
      `✔ prototype wiring (MUI Button, 75 variants): ${wiringA.length} State=Default cells carry [ON_HOVER→Hover, ON_PRESS→Active] CHANGE_TO their State= siblings, transition null; State=Focus Visible + State=Disabled are destinations of NOTHING (no Figma trigger exists — EXCLUDED BY NAME); off-default-axis bases and all previews carry ZERO; bundle path ≡ script path; the mock refuses plain assignment AND a cross-set CHANGE_TO by name; the fingerprint catches a stripped reaction`,
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
  // 2026-08-22: 54 → 80. The exact-conversion wave (d563be65, c924c9c2)
  // added 26 alias leaves to astryx-minted.dtcg.json AFTER the committed
  // bundle was last built (1427b77d), and that bundle could not be rebuilt by
  // its own recipe once Banner promoted its status glyphs (`--icons` became
  // required) — so this pin measured a stale artifact for weeks. The bundle
  // is a pure function of its inputs; the minted tree carries 80 alias
  // leaves today (count them: every `$value` of the form `{…}`).
  assert(astryx.aliases === 80, `astryx bundle carries the 80 re-anchored minted aliases (got ${astryx.aliases})`);
  const hex2 = (x) => Math.round((x || 0) * 255).toString(16).padStart(2, '0');
  // One pin per DECISION ARM, so a mis-targeted arm cannot hide behind a count:
  // three of the original tone rules, plus one leaf from each of the reviewed
  // round's five value groups.
  for (const [leaf, want] of [
    // 2026-08-22: the four `row-rule-color` tone leaves this block pinned were
    // pruned from the minted tree by the row-rule ledger (task #43) after the
    // bundle was last built; the badge tone arms are pinned on the leaves the
    // tree carries today (light values read from astryx.light.dtcg.json).
    ['imported/badge/root/color/blue', '#00458c'],
    ['imported/badge/root/color/red', '#89001a'],
    ['imported/badge/root/color/yellow', '#584400'],
    ['imported/badge/root/color/warning', '#171717'],
    ['imported/button/label/color/primary', '#ffffff'],
    ['imported/button/label/color/destructive', '#ffffff'],
    ['imported/button/label/color/ghost', '#171717'],
    ['imported/card/root/border-top-color/default', '#d4d4d4'],
    ['imported/slider/slider-track/background-color', '#ccd3db'],
    ['imported/shared/color-0064e0', '#262626'],
    ['imported/slider/label/color', '#737373'],
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
  // 2026-08-22: read the decided-literal leaves from the ledger's own `literals`
  // rows (the two `shared/color-*` leaves this block used to name were renamed
  // by the re-capture); today they are:
  for (const leaf of ["imported/button/root/background-color/ghost", "imported/card/root/background-color/transparent", "imported/badge/root/background-color/neutral"]) {
    const v = astryx.byName.get(leaf);
    assert(v, `astryx bundle emits ${leaf}`);
    const first = v.valuesByMode[Object.keys(v.valuesByMode)[0]];
    assert(!(first && first.type === 'VARIABLE_ALIAS'), `${leaf} is DECIDED-LITERAL (tokens/reanchor-decisions.json "literals") and must stay a literal, not an alias`);
  }
  const polaris = await exercise('examples/polaris/figma/polaris.bundle.json', 'Polaris', 12);
  assert(polaris.built === 12, `polaris bundle builds all 12 components incl. icon-bearing ones (got ${polaris.built})`);
  // CARBON ROUND (library #7, the generality CONTROL CASE): the same engine
  // path, a config-only library. Two pins beyond "it builds", both of them
  // things only Carbon can prove:
  //   (1) REAL MODES. Carbon themes are CLASS SCOPES (.cds--white / .cds--g100),
  //       so Light and Dark are two complete inventories of the SAME names —
  //       a mode pair with no guessing. A base colour must differ per mode.
  //   (2) the DEFAULTLESS-AXIS pin (no "Unset" variant cell ever reaches the
  //       canvas) lives where the variant grid is built — examples/carbon/
  //       scripts/figma-compile-receipt.mjs.
  const carbon = await exercise('examples/carbon/figma/carbon.bundle.json', 'Carbon', 10);
  assert(carbon.built === 10, `carbon bundle builds all 10 components (got ${carbon.built})`);
  {
    const layer = carbon.byName.get('layer-01');
    assert(layer, 'carbon bundle emits the base token layer-01');
    const modes = Object.values(layer.valuesByMode);
    assert(modes.length === 2, `carbon layer-01 carries TWO modes (got ${modes.length}) — Carbon's Light/Dark are two real theme blocks, not one theme twice`);
    const hx = (v) => `#${['r', 'g', 'b'].map((k) => Math.round((v[k] || 0) * 255).toString(16).padStart(2, '0')).join('')}`;
    const [lv, dv] = modes.map(hx);
    assert(lv === '#f4f4f4' && dv === '#262626', `carbon layer-01 resolves .cds--white #f4f4f4 / .cds--g100 #262626 (got ${lv} / ${dv}) — if these were equal the Dark mode would be the Light theme wearing a different label`);
  }
  // ALTITUDE ROUND (library #8, the FIRST SHADOW-DOM subject): the same engine
  // path again, on a library whose every contract part was read from INSIDE an
  // open shadow root. Two pins beyond "it builds":
  //   (1) THE DEPTH-2 PART. al-avatar's `hasBadge` mounts a nested <al-badge>
  //       — a custom element with its OWN shadow root — inside the avatar's
  //       shadow tree. The promoted contract carries the nested HOST and its
  //       inner box as parts, so the built canvas must too. If the reader had
  //       stopped at the first shadow boundary this set would be a bare circle.
  //   (2) REAL MODES from two shipped stylesheets (tokens-light/dark.css).
  //       Altitude's dark mode is THIN by its own choice — brand and status
  //       colours are identical in both — so the pin targets a token that does
  //       move rather than asserting a large diff that does not exist.
  const altitude = await exercise('examples/altitude/figma/altitude.bundle.json', 'Altitude', 8);
  assert(altitude.built === 8, `altitude bundle builds all 8 shadow-DOM components (got ${altitude.built})`);
  {
    const content = altitude.byName.get('theme-color-content-default');
    assert(content, 'altitude bundle emits the base token theme-color-content-default');
    const modes = Object.values(content.valuesByMode);
    assert(modes.length === 2, `altitude theme-color-content-default carries TWO modes (got ${modes.length})`);
    const hx = (v) => `#${['r', 'g', 'b'].map((k) => Math.round((v[k] || 0) * 255).toString(16).padStart(2, '0')).join('')}`;
    const [lv, dv] = modes.map(hx);
    assert(lv === '#101010' && dv === '#f8f8f6', `altitude theme-color-content-default resolves tokens-light #101010 / tokens-dark #f8f8f6 (got ${lv} / ${dv}) — equal values would mean the alias chain was resolved against ONE block instead of each mode's own`);
    // (1) the depth-2 part, read off the bundle's own contract payload.
    const altBundle = JSON.parse(read('examples/altitude/figma/altitude.bundle.json'));
    const avatar = (altBundle.contracts ?? []).find((c) => String(c.id) === 'altitude.avatar');
    assert(avatar, 'altitude bundle carries the altitude.avatar contract');
    const avatarJson = JSON.stringify(avatar);
    for (const part of ['avatar__badge', 'badge']) {
      assert(avatarJson.includes(`"${part}"`), `altitude.avatar carries the "${part}" part — read from a shadow root NESTED inside another shadow root (depth-2)`);
    }
  }
  const docs = await exercise('examples/astryx/figma/astryx-docs.bundle.json', 'Astryx (docs theme)', 13);
  assert(docs.built === 13 && docs.vars === astryx.vars, `docs-theme bundle builds the same 13 with the same variable count (${docs.built}, ${docs.vars} vs ${astryx.vars})`);
  assert(docs.aliases === astryx.aliases, `docs-theme bundle carries the SAME ${astryx.aliases} minted aliases — re-anchoring is what makes them re-theme (got ${docs.aliases})`);
  console.log(`✔ sibling bundles — astryx (13 built, ${astryx.vars} vars, ${astryx.aliases} re-anchored minted aliases resolving the unchanged neutral light values), polaris (12 built incl. 22 embedded icons, ${polaris.vars} vars), altitude (8 built from SHADOW-DOM captures, ${altitude.vars} vars, depth-2 nested-shadow parts intact, Light/Dark proven distinct on theme-color-content-default), astryx docs-theme (13 built, same inventory re-skinned, same ${docs.aliases} aliases — these ${docs.aliases} now DO re-theme): carbon (10 built, ${carbon.vars} vars, Light/Dark = .cds--white/.cds--g100 proven distinct on layer-01): the JSON-only rule holds for EVERY example round through the real engine path`);
}

// --- N+5. BROWNFIELD: scan an unmarked set, propose it with NO base, and
//          prove the read-only guard is enforcement rather than a label -----
{
  // A hand-built set: no ds_contracts marker anywhere. This is the file every
  // brownfield designer actually has, and the shape the plugin used to drop.
  await runScript(`
const page = figma.root.children[0];
const a = figma.createComponent(); a.name = 'Size=sm';
const b = figma.createComponent(); b.name = 'Size=lg';
page.appendChild(a); page.appendChild(b);
const set = figma.combineAsVariants([a, b], page);
set.name = 'HandBuilt';
return { ok: true };
`);

  // (a) SCAN — the same walk, marker filter off.
  const scan = await runScript(DSC.scanScriptSource());
  const scanRows = scan.inventory;
  const hand = scanRows.find((r) => r.name === 'HandBuilt');
  assert(hand, 'scanScriptSource() returns the hand-built set the marked inventory drops');
  assert(hand.contractBacked === false, 'the hand-built row is marked contractBacked:false, not hidden');
  assert(
    JSON.stringify(hand.variantAxes) === JSON.stringify({ Size: ['sm', 'lg'] }),
    `the scan carries the set's variant axes (got ${JSON.stringify(hand.variantAxes)})`,
  );
  assert(hand.propKinds && hand.propKinds.variant === 1, 'the scan counts property kinds per set');
  const marked = await runScript(DSC.inventoryScriptSource());
  assert(
    marked.inventory.every((r) => r.contractBacked) &&
      !marked.inventory.some((r) => r.name === 'HandBuilt'),
    'the MARKED inventory is untouched — no unmarked row leaks into the update check',
  );
  assert(
    marked.inventory.length > 0 && scanRows.length > marked.inventory.length,
    `the scan is a strict superset (${scanRows.length} scanned vs ${marked.inventory.length} contract-backed)`,
  );
  const report = DSC.scanReport(scanRows);
  assert(
    report.total === scanRows.length && report.backed === marked.inventory.length && report.foreign >= 1,
    `scanReport counts both halves (total ${report.total}, backed ${report.backed}, foreign ${report.foreign})`,
  );
  assert(
    report.headline === `${report.total} component sets — ${report.backed} contract-backed, ${report.foreign} not yet.`,
    `the scan headline names both halves (got "${report.headline}")`,
  );
  const scanExport = JSON.parse(DSC.scanExportJson(scanRows, 'TESTFILE'));
  assert(
    scanExport.type === 'FIGMA-FILE-SCAN' && scanExport.totals.notUnderContract === report.foreign,
    'the scan export artifact carries the totals and every set',
  );

  // (b) BASE-LESS PROPOSE — the `if` that was the whole B2 blocker.
  const ui = read('figma-sync/plugin/ui.html');
  const openTag = '<script type="text/plain" id="dump-source">';
  const start = ui.indexOf(openTag);
  const source = ui.slice(start + openTag.length, ui.indexOf('</script>', start)).replace(/^\n/, '');
  const scopedHand = source.replace(
    /^const TARGET_SETS = \[[^\n]*\];$/m,
    `const TARGET_SETS = ${JSON.stringify(['HandBuilt'])};`,
  );
  const handDump = await runScript(scopedHand);
  assert(handDump && handDump.HandBuilt, 'the embedded dump script reads the hand-built set');
  const baseless = DSC.proposeDiff(handDump, 'HandBuilt', null);
  assert(baseless.ok, `a base-less propose SUCCEEDS (${baseless.ok ? '' : baseless.issue.headline})`);
  assert(baseless.baseless === true, 'the result declares itself base-less');
  assert(
    baseless.summaryLines[0] === `No base contract — proposing "${baseless.proposal.id}" v${baseless.proposal.version} from what is drawn.`,
    `the first line says proposal, not diff (got "${baseless.summaryLines[0]}")`,
  );
  assert(
    baseless.summaryLines.some((l) => l.startsWith('prop size (enum(sm|lg))')),
    `the base-less summary describes the drawn API (got: ${baseless.summaryLines.join(' | ')})`,
  );
  assert(
    baseless.summaryLines[baseless.summaryLines.length - 1].startsWith('Scope: this is a proposal READ FROM THE CANVAS'),
    'the base-less summary ends with its OWN scope note, not the diff scope note',
  );
  assert(
    baseless.summaryLines.some((l) => l.indexOf('nearest-token suggestions come from the tokens baked into this plugin build') >= 0),
    'the base-less summary NAMES the token corpus its suggestions came from',
  );
  const baselessExport = JSON.parse(baseless.exportJson);
  assert(
    baselessExport.type === 'CONTRACT-PROPOSAL' && baselessExport.baseContractId === null &&
      baselessExport.baseVersion === null && baselessExport.proposedContract,
    'the base-less export is a CONTRACT-PROPOSAL with a null base, never a fabricated one',
  );
  assert(
    baselessExport.projection?.status === 'verified-exact',
    'a structured hand-built set is exact on canvas-expressible variant projection even though generated code remains an inversion',
  );
  const legacyHandDump = JSON.parse(JSON.stringify(handDump));
  delete legacyHandDump.HandBuilt.propertyDefinitions;
  for (const variant of legacyHandDump.HandBuilt.variants) {
    delete variant.variantProperties;
  }
  const explicitLegacy = DSC.proposeDiff(
    legacyHandDump,
    'HandBuilt',
    null,
    { toolGenerated: false },
  );
  assert(
    explicitLegacy.ok &&
      JSON.parse(explicitLegacy.exportJson).projection?.status ===
        'legacy-unverified',
    'only an explicitly hand-built legacy dump enters reviewable inversion',
  );
  const unknownLegacy = DSC.proposeDiff(
    legacyHandDump,
    'HandBuilt',
    null,
  );
  assert(
    !unknownLegacy.ok &&
      unknownLegacy.issue.headline.includes(
        'structured propertyDefinitions',
      ),
    'legacy evidence with unknown provenance refuses exact conversion',
  );
  // The WITH-base path is untouched, byte for byte.
  const withBase = DSC.proposeDiff(await runScript(
    source.replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify(['Badge'])};`),
  ), 'Badge', badge);
  assert(withBase.ok && withBase.baseless === false, 'the with-base path still diffs');
  assert(
    withBase.summaryLines[withBase.summaryLines.length - 1].startsWith('Scope: this diff covers the API surface'),
    'the with-base diff keeps its own scope note verbatim',
  );
  // A present-but-broken base is still a named refusal — only ABSENCE is ok.
  const broken = DSC.proposeDiff(handDump, 'HandBuilt', { id: 'nope' });
  assert(
    !broken.ok && broken.issue.headline.indexOf('does not parse against the schema') >= 0,
    'a base that is present but does not parse is STILL refused by name',
  );

  // (c) FOREIGN TOKEN CORPUS — the suggestions follow the user's tokens.
  const foreignSet = {
    name: 'Acme',
    base: { 'acme.color.brand': { $type: 'color', $value: '#123456' } },
  };
  const foreign = DSC.proposeDiff(handDump, 'HandBuilt', null, { tokenSet: foreignSet });
  assert(
    foreign.ok && foreign.tokenSource === 'your token set "Acme" (from the bundle you pasted)',
    `a bundle-carried token set becomes the proposal corpus (got "${foreign.ok ? foreign.tokenSource : foreign.issue.headline}")`,
  );
  assert(
    foreign.summaryLines.some((l) => l.indexOf('your token set "Acme"') >= 0),
    'the report names the foreign corpus in words, so a wrong suggestion is attributable',
  );

  console.log(
    `✔ brownfield: scan sees ${report.total} sets (${report.backed} contract-backed, ${report.foreign} hand-built) where the marked inventory saw ${marked.inventory.length}; a base-less propose on "HandBuilt" returns a proposal (not a refusal) naming its corpus; a foreign tokenSet replaces that corpus by name; with-base diff and the parse refusal are unchanged`,
  );

  // (d) CANVAS → CODE (task #40) — THE ASYMMETRY, stamped and shown.
  // A proposal now says what code it becomes and how far that code can be
  // trusted. The two answers must never be interchangeable: a set this tool
  // GENERATED round-trips byte for byte; a HAND-BUILT set is an inversion,
  // so its code is a starting point. `propose-pr` reads the same stamp out
  // of the export envelope and prints the same sentence on the PR.
  const handProp = DSC.proposeDiff(handDump, 'HandBuilt', null, { toolGenerated: false });
  const toolProp = DSC.proposeDiff(handDump, 'HandBuilt', null, { toolGenerated: true });
  const unknownProp = DSC.proposeDiff(handDump, 'HandBuilt', null);
  assert(
    handProp.provenance === 'hand-built' && toolProp.provenance === 'tool-generated' &&
      unknownProp.provenance === 'unrecorded',
    'proposeDiff maps the marker fact to exactly three provenances — and an ABSENT fact is "unrecorded", never quietly hand-built',
  );
  assert(
    handProp.codePlan.sentence.indexOf('STARTING POINT, NOT A REPRODUCTION') >= 0 &&
      handProp.codePlan.sentence.indexOf('INVERSION') >= 0,
    'the hand-built sentence refuses to call the generated component a reproduction',
  );
  assert(
    toolProp.codePlan.sentence.indexOf('true round trip') >= 0 &&
      toolProp.codePlan.sentence.indexOf('byte for byte') >= 0,
    'the tool-generated sentence claims the round trip in those words',
  );
  assert(
    unknownProp.codePlan.sentence.indexOf('No canvas provenance was recorded') >= 0,
    'an unrecorded provenance says so instead of picking a side',
  );
  const handEnvelope = JSON.parse(handProp.exportJson);
  const toolEnvelope = JSON.parse(toolProp.exportJson);
  const unknownEnvelope = JSON.parse(unknownProp.exportJson);
  assert(
    handEnvelope.provenance.toolGenerated === false && handEnvelope.provenance.kind === 'hand-built' &&
      toolEnvelope.provenance.toolGenerated === true &&
      unknownEnvelope.provenance.toolGenerated === null,
    'the CONTRACT-PROPOSAL envelope CARRIES the fact (true / false / null) — this is what propose-pr reads to print the right sentence',
  );
  // The file list the Send panel shows is the file list the CLI writes:
  // both come from core/canvas-code-plan.ts. Named paths, not a shape.
  const plan = DSC.codePlanFor('Badge', 'tool-generated');
  const expectedPaths = ['Badge/Badge.module.css', 'Badge/Badge.tsx', 'Badge/index.ts'];
  assert(
    JSON.stringify(plan.paths) === JSON.stringify(expectedPaths),
    `the react code plan names the files generate writes (got ${JSON.stringify(plan.paths)})`,
  );
  assert(
    plan.target === 'react' && plan.targetLabel === 'React + CSS Modules' &&
      plan.altTargets.join(',') === 'html,react-inline',
    `the plan names its default target and the alternatives a repo can pick (got ${plan.target} / ${JSON.stringify(plan.altTargets)})`,
  );
  assert(
    DSC.codePlanFor('Badge', 'hand-built').headline.indexOf('starting point, not a reproduction') >= 0,
    'the one-line headline carries the same asymmetry as the sentence',
  );
  console.log(
    '✔ canvas→code (task #40): a proposal states what code it becomes (react → Badge/Badge.module.css, Badge/Badge.tsx, Badge/index.ts; html + react-inline named as alternatives) and stamps the round-trip fact into the CONTRACT-PROPOSAL envelope — tool-generated says "byte for byte", hand-built says "STARTING POINT, NOT A REPRODUCTION", and an unknown marker says "not recorded" rather than either',
  );

  // (e) ENVELOPE v2 — THE EXPORT CARRIES ALL THREE ENGINE OUTPUTS (ranked
  // item #5). proposeFromDump has always returned { contract, notes,
  // unbound, mintedTokens?, childStubs? }; the CONTRACT-PROPOSAL export used
  // to carry only the contract, so the engine's own "auto-proposed alongside
  // (childStubs…)" note was a false receipt on every export surface and the
  // received contract's refs refused by name. THIS PIN IS THE FALSIFICATION
  // GATE: it fails if either payload ever goes missing from the envelope
  // again. The set below is engineered to force BOTH payloads — a nested
  // INSTANCE of a component with no contract in scope (→ childStubs) and a
  // raw, token-less fill (→ mintedTokens via mintUnbound).
  await runScript(`
const page = figma.root.children[0];
const foreign = figma.createComponent(); foreign.name = 'ForeignChip';
foreign.resize(24, 24);
foreign.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.1, b: 0.9 } }];
page.appendChild(foreign);
const mk = (state) => {
  const c = figma.createComponent(); c.name = 'State=' + state;
  c.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.32, b: 0.11 } }];
  c.appendChild(foreign.createInstance());
  page.appendChild(c);
  return c;
};
const set = figma.combineAsVariants([mk('rest'), mk('busy')], page);
set.name = 'HostCard';
return { ok: true };
`);
  const hostDump = await runScript(
    source.replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify(['HostCard'])};`),
  );
  assert(hostDump && hostDump.HostCard, 'envelope v2: the dump captures the HostCard set (foreign instance + raw fill)');
  const withStub = DSC.proposeDiff(hostDump, 'HostCard', null, { toolGenerated: false });
  assert(withStub.ok, `envelope v2: HostCard proposes (${withStub.ok ? '' : withStub.issue.headline})`);
  const v2 = JSON.parse(withStub.exportJson);
  assert(
    Array.isArray(v2.childStubs) && v2.childStubs.length >= 1 && v2.childStubs.every((s) => s && typeof s.id === 'string'),
    'ENVELOPE v2 REGRESSION: the CONTRACT-PROPOSAL export no longer carries childStubs — the received contract ships dangling component refs that generate refuses by name (ranked #5)',
  );
  assert(
    v2.mintedTokens && v2.mintedTokens.tree && typeof v2.mintedTokens.tree === 'object' &&
      !Array.isArray(v2.mintedTokens.tree) && Object.keys(v2.mintedTokens.tree).length >= 1 &&
      typeof v2.mintedTokens.count === 'number' && v2.mintedTokens.count >= 1,
    'ENVELOPE v2 REGRESSION: the CONTRACT-PROPOSAL export no longer carries mintedTokens — the proposal\'s {imported.*} refs have nothing to resolve through (ranked #5)',
  );
  const stubIds = v2.childStubs.map((s) => s.id);
  const proposedJson2 = JSON.stringify(v2.proposedContract);
  assert(
    stubIds.some((id) => proposedJson2.includes(`"${id}"`)),
    `envelope v2: the proposed contract references a carried stub (${stubIds.join(', ')}) — the stub is a payload the contract needs, not a passenger`,
  );
  // The typed result mirrors the envelope — the Send tab reads these fields
  // off proposeDiff directly.
  assert(
    Array.isArray(withStub.childStubs) && withStub.childStubs.length === v2.childStubs.length &&
      withStub.mintedTokens && withStub.mintedTokens.count === v2.mintedTokens.count,
    'envelope v2: proposeDiff\'s typed result carries the same childStubs/mintedTokens the exportJson does',
  );
  console.log(
    `✔ envelope v2: the CONTRACT-PROPOSAL export carries ALL THREE engine outputs — proposedContract + ${v2.childStubs.length} childStub(s) (${stubIds.join(', ')}) + mintedTokens (${v2.mintedTokens.count} token(s)); this pin fails the build if either payload is ever dropped again`,
  );

  // (f) THE PR DOOR CARRIES THE ENVELOPE TOO. The copy/download and pairing
  // doors ship childStubs + mintedTokens; the GitHub PR door used to plan
  // exactly ONE PUT (the contract alone), so a hand-built set with nested
  // instances landed a PR whose contract references child ids and minted
  // token refs that were NOT in the PR — `generate` refuses it by name.
  // The plan must now file every payload under the SAME names the CLI's
  // propose-pr writes (contracts/<stem>.contract.json per stub,
  // <contractId>.minted.dtcg.json for the tree), and the PR body must list
  // every file.
  const hostId = String(v2.proposedContract.id);
  const prBase = {
    owner: 'acme',
    repo: 'design-system',
    base: 'main',
    path: `contracts/${hostId.replace(/^[^.]+\./, '')}.contract.json`,
    contractJson: JSON.stringify(withStub.proposal, null, 2) + '\n',
    contractId: hostId,
    baseVersion: '(new — no base contract in the repo yet)',
    summaryLines: withStub.summaryLines,
    branchSuffix: 'fixture',
  };
  const envPlan = DSC.prPlan({ ...prBase, childStubs: withStub.childStubs, mintedTokens: withStub.mintedTokens });
  const envPuts = envPlan.requests.filter((r) => r.method === 'PUT');
  assert(
    envPuts.length === 1 + withStub.childStubs.length + 1,
    `PR DOOR REGRESSION: a proposal carrying ${withStub.childStubs.length} childStub(s) + mintedTokens must plan ${1 + withStub.childStubs.length + 1} PUTs (contract + each stub + minted tree) — got ${envPuts.length}`,
  );
  // Per-file paths: the CLI's propose-pr convention, byte for byte.
  const expectStubPaths = stubIds.map((id) => `contracts/${String(id).replace(/^[^.]+\./, '')}.contract.json`);
  const expectMintedPath = `contracts/${hostId}.minted.dtcg.json`;
  const plannedPaths = envPlan.files.map((f) => f.path);
  assert(
    JSON.stringify(plannedPaths) === JSON.stringify([prBase.path, ...expectStubPaths, expectMintedPath]),
    `PR plan file paths must match the CLI's propose-pr layout — expected ${JSON.stringify([prBase.path, ...expectStubPaths, expectMintedPath])}, got ${JSON.stringify(plannedPaths)}`,
  );
  assert(
    envPuts.every((r, i) => r.url.endsWith('/contents/' + plannedPaths[i])),
    'each planned PUT commits its own file (request order = file order)',
  );
  // The bytes are the CLI's bytes: stub files are the stub documents, the
  // tokens file is the minted tree — pretty-printed with a trailing newline.
  assert(
    withStub.childStubs.every((stub, i) => envPlan.files[i + 1].contents === JSON.stringify(stub, null, 2) + '\n') &&
      envPlan.files[envPlan.files.length - 1].contents === JSON.stringify(withStub.mintedTokens.tree, null, 2) + '\n',
    'sidecar file contents are the envelope payloads verbatim (2-space JSON + trailing newline, the CLI spelling)',
  );
  // The body names every file and keeps the provenance-honesty copy.
  assert(
    envPlan.body.includes('## Files') &&
      [prBase.path, ...expectStubPaths, expectMintedPath].every((p) => envPlan.body.includes('`' + p + '`')),
    'the PR body lists EVERY file the PR carries, by path',
  );
  assert(
    envPlan.body.includes('_The contract file in this PR is the proposed document; review it like any other contract diff._'),
    'the envelope-carrying body keeps the existing review-honesty sentence',
  );
  // Dry-run lines surface the same plan — one numbered step per request.
  const envDry = DSC.prDryRunLines({ ...prBase, childStubs: withStub.childStubs, mintedTokens: withStub.mintedTokens });
  assert(
    [prBase.path, ...expectStubPaths, expectMintedPath].every((p) => envDry.some((l) => l.includes(`Commit ${p} on `))),
    'the dry run names every planned commit, sidecars included',
  );
  // RED TEST — strip the payloads from the envelope: the plan must FALL BACK
  // to the documented contract-only shape (docs/00-choose-your-path.md, the
  // GitHub PR door), byte-identical to the historic 4-step plan: one PUT,
  // no Files section, same honesty sentence. Nothing may be invented.
  const bare = DSC.prPlan(prBase);
  assert(
    bare.requests.length === 4 && bare.requests.filter((r) => r.method === 'PUT').length === 1 && bare.files.length === 1,
    'a proposal WITHOUT childStubs/mintedTokens plans exactly the historic contract-only 4 steps (GET, POST branch, 1 PUT, POST pulls)',
  );
  assert(
    !bare.body.includes('## Files') &&
      bare.body.includes('_The contract file in this PR is the proposed document; review it like any other contract diff._'),
    'the contract-only body keeps the documented wording — no invented Files section',
  );
  // RED TEST — a stub with no id is a NAMED refusal before any request is
  // planned, never a silent drop back to a contract-only PR.
  let stubRefusal = null;
  try {
    DSC.prPlan({ ...prBase, childStubs: [{ name: 'NoIdStub' }] });
  } catch (e) {
    stubRefusal = String((e && e.message) || e);
  }
  assert(
    stubRefusal && stubRefusal.includes('REFUSED') && stubRefusal.includes('no non-empty string id'),
    `a stub without an id must refuse BY NAME, not silently drop the file (got: ${stubRefusal})`,
  );
  // RED TEST — two files planning the same destination refuse by name (the
  // CLI's assertUniqueDestinations, mirrored).
  let dupRefusal = null;
  try {
    DSC.prPlan({ ...prBase, childStubs: [{ id: hostId }] });
  } catch (e) {
    dupRefusal = String((e && e.message) || e);
  }
  assert(
    dupRefusal && dupRefusal.includes('REFUSED') && dupRefusal.includes('same destination'),
    `a stub colliding with the main contract destination must refuse BY NAME (got: ${dupRefusal})`,
  );
  console.log(
    `✔ PR door envelope: a proposal with ${withStub.childStubs.length} childStub(s) + mintedTokens plans ${envPuts.length} PUTs under the CLI's propose-pr file names (${plannedPaths.join(', ')}), the body lists every file; stripping the payloads falls back to the documented contract-only 4-step plan, and an id-less or colliding stub refuses BY NAME`,
  );
  if (process.argv.includes('--show-brownfield')) {
    console.log('\n--- scan rows (plain words) ---\n  ' + report.lines.join('\n  '));
    console.log('\n--- base-less proposal for "HandBuilt" ---\n  ' + baseless.summaryLines.join('\n  ') + '\n');
  }
}

// --- N+6. READ-ONLY is ENFORCED, not asserted -------------------------------
// The guard lives in code.js (the sandbox side — it cannot import the engine
// bundle, which runs in the UI iframe). Pin the REAL bytes: lift the marked
// block out of code.js, run it here, and drive it against the mock file.
{
  const codeJs = read('figma-sync/plugin/code.js');
  const startMark = '// --- READ-ONLY GUARD (start)';
  const endMark = '// --- READ-ONLY GUARD (end)';
  const s = codeJs.indexOf(startMark);
  const e = codeJs.indexOf(endMark);
  assert(s >= 0 && e > s, 'code.js carries the marked READ-ONLY GUARD block');
  const guardSrc = codeJs.slice(s, e);
  const guardCtx = vm.createContext({});
  vm.runInContext(`${guardSrc}\nglobalThis.createReadOnlyFigma = createReadOnlyFigma;`, guardCtx);
  const guarded = guardCtx.createReadOnlyFigma(figma);

  // Same execution shape code.js uses for a readOnly engine-run: the `figma`
  // global is SHADOWED by the façade.
  const roContext = vm.createContext({ console: { log() {}, warn() {}, error() {} }, __guarded: guarded });
  const runReadOnly = (code) =>
    vm.runInContext(
      `(async (figma) => {\n${code}\n})(__guarded)`,
      roContext,
      { timeout: 120_000 },
    );

  // 1. every read-only script the UI runs still WORKS through the façade.
  const roScan = await runReadOnly(DSC.scanScriptSource());
  const plainScan = await runScript(DSC.scanScriptSource());
  assert(
    JSON.stringify(roScan) === JSON.stringify(plainScan),
    'the guarded run returns byte-identical rows to the unguarded one — the façade is transparent to reads',
  );
  const roLog = await runReadOnly(DSC.applyLogScriptSource());
  assert('applyLog' in roLog, 'the apply-log read runs through the façade');
  const uiSrc = read('figma-sync/plugin/ui.html');
  const dumpStart = uiSrc.indexOf('<script type="text/plain" id="dump-source">');
  const dumpSrc = uiSrc
    .slice(dumpStart + '<script type="text/plain" id="dump-source">'.length, uiSrc.indexOf('</script>', dumpStart))
    .replace(/^\n/, '')
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify(['Badge'])};`);
  const roDump = await runReadOnly(dumpSrc);
  assert(roDump && roDump.Badge, 'the Send-tab dump — variables, resolveForConsumer and all — runs through the façade');

  // 2. every write REFUSES BY NAME.
  const refusals = [
    ['figma.createFrame()', 'const f = figma.createFrame(); return f;'],
    ['node.setSharedPluginData', "await figma.loadAllPagesAsync(); figma.root.children[0].setSharedPluginData('ds_contracts', 'x', 'y'); return 1;"],
    ['property assignment', 'await figma.loadAllPagesAsync(); figma.root.children[0].name = "hacked"; return 1;'],
    ['node.remove()', "await figma.loadAllPagesAsync(); const n = figma.root.children[0].findAllWithCriteria({ types: ['COMPONENT_SET'] })[0]; n.remove(); return 1;"],
    ['figma.variables.createVariable', "figma.variables.createVariableCollection('x'); return 1;"],
  ];
  for (const [what, code] of refusals) {
    let threw = null;
    try {
      await runReadOnly(code);
    } catch (err) {
      threw = err;
    }
    assert(threw, `read-only REFUSES ${what} (it did not throw)`);
    assert(
      String(threw.message).startsWith('Read-only run refused '),
      `the ${what} refusal is the named plain-words one (got "${threw && threw.message}")`,
    );
  }
  // 3. …and the refusals changed nothing.
  const after = await runScript(DSC.scanScriptSource());
  assert(
    JSON.stringify(after.inventory) === JSON.stringify(plainScan.inventory),
    'after five refused writes the file is byte-identical — the guard blocked, it did not half-apply',
  );
  // 4. the UI only ever asks for readOnly on scripts that read.
  const readOnlyCalls = (uiSrc.match(/readOnly:\s*true/g) || []).length;
  assert(readOnlyCalls >= 5, `the UI marks its audit runs readOnly (found ${readOnlyCalls})`);
  assert(
    codeJs.indexOf('runScript(String(msg.code || \'\'), { readOnly: !!msg.readOnly })') >= 0,
    'the engine-run handler THREADS readOnly into the runner (the flag used to be dropped on the floor)',
  );
  console.log(
    `✔ read-only enforced: the marker inventory, apply log, file scan and Send dump all run byte-identically through the guarded figma façade, while createFrame / setSharedPluginData / name= / remove() / createVariableCollection each refuse BY NAME and leave the file unchanged`,
  );
}

console.log('plugin-engine-check: all flows green (bundle, generate, sample-library, order, update-report, style-diff, drift-aware-update, apply, propose-diff, stale-base-guard, pr-dry-run, composite-plugin-path, composite-reverse-journey, drift-fingerprint, foreign-token-bundle, prototype-wiring, standing-channel, sibling-bundles, brownfield-scan, base-less-propose, canvas-code-plan, read-only-enforcement)');
