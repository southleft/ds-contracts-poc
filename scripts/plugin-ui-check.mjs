/**
 * UI SMOKE — the plugin UI has no automated visual gate, so drive the REAL
 * packaged ui.html (figma-sync/plugin-dist, engine injected) in Chrome with a
 * code.js SIMULATOR and assert the re-housed IA behaves.
 */
import { chromium } from 'playwright-core';
import path from 'node:path';

const ROOT = process.cwd();
const FILE = 'file://' + path.join(ROOT, 'figma-sync', 'plugin-dist', 'ui.html');

const fails = [];
const shown = async (sel) => !(await page.locator(sel).evaluate((e) => e.hidden));
const ok = (cond, what) => { console.log((cond ? '✔ ' : '✖ ') + what); if (!cond) fails.push(what); };

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 640, height: 680 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

// --- the code.js simulator, installed before ui.html's script runs ---------
await page.addInitScript(() => {
  const saved = JSON.parse(localStorage.getItem('sim') || '{}');
  window.__sim = Object.assign({ markedSets: [], allSets: null, applyLog: null, channel: null, drift: null, channelKey: '', uiState: null }, saved);
  window.__sim.sent = [];
  window.__sim.readOnlyRuns = [];
  window.__simSave = () => localStorage.setItem('sim', JSON.stringify({
    markedSets: window.__sim.markedSets, allSets: window.__sim.allSets, applyLog: window.__sim.applyLog,
    channel: window.__sim.channel, drift: window.__sim.drift,
    channelKey: window.__sim.channelKey, uiState: window.__sim.uiState,
  }));
  const post = (m) => window.postMessage({ pluginMessage: m }, '*');
  window.addEventListener('message', (ev) => {
    const msg = ev.data && ev.data.pluginMessage;
    if (!msg || !msg.type) return;
    window.__sim.sent.push(msg.type);
    if (msg.type === 'ui-ready') post({ type: 'init', fileKey: 'TESTFILE' });
    else if (msg.type === 'channel-key-load') post({ type: 'channel-key', key: window.__sim.channelKey || '' });
    else if (msg.type === 'channel-key-save') post({ type: 'channel-key-saved', ok: true, key: msg.key });
    else if (msg.type === 'ui-state-load') post({ type: 'ui-state', key: msg.key, value: window.__sim.uiState || null });
    else if (msg.type === 'check-drift') post(Object.assign({ type: 'drift-result' }, window.__sim.drift));
    else if (msg.type === 'channel-check') post(Object.assign({ type: 'channel-check-result', replyTo: msg.replyTo }, window.__sim.channel));
    else if (msg.type === 'engine-run') {
      const code = String(msg.code || '');
      if (msg.readOnly) window.__sim.readOnlyRuns.push(code.slice(0, 60));
      // The SCAN and the marked inventory are the same emitted walk with the
      // marker filter on/off — the simulator tells them apart the same way a
      // reader does: the scan keeps unmarked rows instead of `continue`ing.
      const isScan = code.indexOf('const contractBacked = !!(contractId || specHash)') >= 0;
      if (code.indexOf('Design-side ANATOMY dump') >= 0) post({ type: 'engine-result', id: msg.id, ok: true, result: window.__sim.dump || {} });
      else if (code.indexOf('apply log') >= 0) post({ type: 'engine-result', id: msg.id, ok: true, result: { applyLog: window.__sim.applyLog } });
      else if (isScan) post({ type: 'engine-result', id: msg.id, ok: true, result: { inventory: window.__sim.allSets || window.__sim.markedSets } });
      else if (code.indexOf('marker inventory') >= 0) post({ type: 'engine-result', id: msg.id, ok: true, result: { inventory: window.__sim.markedSets } });
      else post({ type: 'engine-result', id: msg.id, ok: true, result: {} });
    }
  });
});

await page.goto(FILE);
await page.waitForTimeout(400);

// --- 1. cold open: no marked sets, no key --------------------------------
ok(await page.locator('#panel-build').evaluate((e) => e.classList.contains('active')), 'cold open defaults to Build (no marked sets)');
ok(await shown('#build-empty'), 'Build shows the sample-library empty state');
ok(await page.locator('#gen-sample').evaluate((e) => e.className === 'primary'), 'the sample button is the panel primary while empty');
ok(await page.locator('#gen-run').evaluate((e) => e.className === 'secondary'), 'Generate steps back to secondary while empty');
ok(await page.locator('#gen-run').textContent() === 'Generate in this file', 'Generate label reads "Generate in this file" on a fresh file');

// --- FIRST-RUN COMPREHENSION (the owner's report: "I don't think it's that
//     intuitive to understand what I should be doing with it"). Measured on
//     the packaged ui.html: "contract" appeared four times on the first screen
//     and was never defined, the paste instruction was printed twice verbatim,
//     and where the file comes from lived only inside a collapsed <details>.
{
  ok(await page.locator('#build-what').isVisible(), 'FIRST RUN: the empty card DEFINES what a contract is');
  const what = await page.locator('#build-what').textContent();
  ok(/JSON file/.test(what), '…in plain words ("JSON file"), not jargon');
  ok(what.includes('ds-contracts onboard'), '…and names WHERE it comes from — the command a developer runs');
  ok(/Changes/.test(what) && /Send/.test(what), '…and what the other two tabs are for, so the loop is legible before anything is built');
  ok(!(await shown('#build-guidance')),
    'the guidance line is HIDDEN while the definition is up — the first screen said the same thing twice');
  const panel = await page.locator('#panel-build').innerText();
  const pasteLines = panel.split('\n').filter((l) => /paste/i.test(l) && l.trim().length > 12);
  ok(pasteLines.length <= 1,
    'at most ONE paste instruction on the first screen (was two, verbatim) — got: ' + JSON.stringify(pasteLines));
}
ok(!(await shown('#drift-actions')), 'Changes hides the drift button when the file has no marked sets');
ok(await shown('#drift-empty'), 'Changes shows the no-sets empty state');
ok(await shown('#channel-setup'), 'no key = SETUP state, not an error');
ok(!(await shown('#channel-connected')), 'connected state hidden without a key');
ok(!(await shown('#changes-dot')), 'no waiting-update dot on open');

// tabs
for (const t of ['changes', 'send', 'advanced', 'build']) {
  await page.click('#tab-' + t);
  const active = await page.locator('#panel-' + t).evaluate((e) => e.classList.contains('active'));
  ok(active, 'tab ' + t + ' activates its panel');
}
ok(await page.locator('#tab-advanced').evaluate((e) => getComputedStyle(e).marginLeft === 'auto' || e.classList.contains('tab-advanced')), 'Advanced is right-aligned in the tab bar');
ok((await page.locator('#tab-advanced').textContent()).includes('Advanced'), 'Advanced carries a visible text label');
ok(await page.locator('#engine-stamp').evaluate((e) => e.textContent.indexOf('engine ') === 0), 'engine stamp lives in Advanced → Diagnostics');

// pairing code is folded away and appears exactly once
ok(await page.locator('#gen-code').count() === 1 && await page.locator('.pair-code').count() === 2,
  'Receive-by-code appears once in Build (the other pair-code field is Send-to-repo)');
ok(!(await page.locator('#gen-code').isVisible()), 'Receive by code starts collapsed inside <details>');

// typing hides the empty state
await page.fill('#gen-input', '{"id":"x"}');
await page.waitForTimeout(120);
ok(!(await shown('#build-empty')), 'typing in the paste box retires the empty state');
await page.fill('#gen-input', '');
await page.waitForTimeout(120);
ok(await shown('#build-empty'), 'clearing the paste box brings it back');

// --- 2. drift report ------------------------------------------------------
await page.evaluate(() => {
  window.__sim.markedSets = [{ contractId: 'ds.badge', name: 'Badge', nodeId: '1:1', specHash: 'h', props: [], version: '1.0.0', key: null, drift: 'in-sync' }];
  window.__sim.drift = {
    ok: true,
    rows: [
      { nodeId: '1:1', name: 'Badge', page: 'Page 1', contractId: 'ds.badge', status: 'in-sync', editedVariants: [], setChanges: [] },
      {
        nodeId: '2:2', name: 'Button', page: 'Page 1', contractId: 'ds.button', status: 'canvas-edited',
        setChanges: [],
        editedVariants: [{
          nodeId: '2:3', name: 'Variant=Primary', changes: [
            { what: '/0:FRAME/label|fill', was: '[{"type":"SOLID","color":{"r":1,"g":0,"b":0}}]', now: '[{"type":"SOLID","color":{"r":0,"g":0,"b":1}}]' },
          ],
        }],
      },
    ],
  };
  window.__simSave();
});
await page.reload();
await page.waitForTimeout(400);
await page.click('#tab-changes');
ok(await shown('#drift-actions'), 'the drift button appears once the file has marked sets');
ok(await page.locator('#drift-check').isVisible(), 'HIDDEN-ATTRIBUTE GATE: a shown section is really visible');
ok(!(await page.locator('#drift-empty').isVisible()), 'HIDDEN-ATTRIBUTE GATE: a hidden section is really invisible');
await page.click('#drift-check');
await page.waitForTimeout(200);
const driftHtml = await page.locator('#drift-results').innerHTML();
ok(driftHtml.includes('In sync') && !driftHtml.includes('✅'), 'drift status reads "In sync" — no emoji');
ok(driftHtml.includes('Canvas edited') && !driftHtml.includes('⚠'), 'drift status reads "Canvas edited" — no emoji');
ok(driftHtml.includes('text-success') && driftHtml.includes('text-warning'), 'status words carry theme colour classes');
ok(!driftHtml.includes('<s>'), 'no strikethrough in the was → now diff');
ok(driftHtml.includes('class="swatch"'), 'paint diffs render an 8px swatch');
ok(driftHtml.includes('class="diff-line"'), 'diff lines are classed, not inline-styled');
ok(!/style="(?!background)/.test(driftHtml), 'no style="" in the drift markup except a swatch fill');
const hexes = (driftHtml.match(/#[0-9a-fA-F]{3,8}/g) || []).filter((h) => !driftHtml.includes('background:' + h));
ok(hexes.length === 0, 'no literal hex in the drift markup outside swatch fills/values (dark-mode fix) — found: ' + JSON.stringify(hexes));
ok(driftHtml.includes('>Propose this change<') && driftHtml.includes('row-action'), '"Propose this change" is a link, not a button');
ok((await page.locator('#drift-last').textContent()).indexOf('Drift last checked:') === 0, 'drift records a "last checked" line');
ok(await page.evaluate(() => window.__sim.sent.includes('ui-state-save')), 'the last-checked line is persisted through code.js');

// propose deep-link into Send
await page.click('.drift-propose');
await page.waitForTimeout(150);
ok(await page.locator('#panel-send').evaluate((e) => e.classList.contains('active')), 'a drifted row deep-links into Send');
ok(await page.locator('#prop-set').inputValue() === 'Button', 'the deep-link pre-names the set');

// --- 3. shared check report in Build (marked sets exist) ------------------
await page.evaluate(() => {
  window.__sim.markedSets = [{ contractId: 'ds.badge', name: 'Badge', nodeId: '1:1', specHash: 'stale', props: [], version: '1.0.0', key: null, drift: 'in-sync' }];
  window.__simSave();
});
await page.reload();
await page.waitForTimeout(400);
ok(await page.locator('#panel-changes').evaluate((e) => e.classList.contains('active')), 'with marked sets the default tab is Changes');
await page.click('#tab-build');
ok(await page.locator('#gen-run').textContent() === 'Check against this file', 'with marked sets Build\'s one button runs the CHECK');
ok(await shown('#build-guidance'),
  'with the empty card gone the guidance line RETURNS — hiding it on a first run must not lose the only instruction later');
// isVisible(), not shown(): #build-what is hidden by its ANCESTOR (#build-empty),
// and the shown() helper only reads the element's own `hidden` attribute.
ok(!(await page.locator('#build-what').isVisible()), '…and the first-run definition steps aside once the file has contract-backed sets');
ok(!(await shown('#build-empty')), 'no empty state once the file has contract-backed sets');
const sample = await page.evaluate(() => window.DSC.sampleBundleJson());
ok(!!sample, 'the packaged build carries the baked sample bundle');
await page.fill('#gen-input', sample);
await page.click('#gen-run');
await page.waitForTimeout(600);
const rep = await page.locator('#gen-result').innerHTML();
ok(rep.includes('Change report'), 'Build renders the SHARED check report');
ok(rep.includes('What’s protected'), 'the "What\'s protected" card survives inside the report');
ok(rep.includes('<details') && rep.includes('<summary'), '…folded into a details whose summary states the promise');
ok(rep.includes('input type="checkbox"') || (await page.locator('#gen-result input[type=checkbox]').count()) > 0, 'per-set checkboxes survive');
ok(rep.includes('report-status'), 'rows carry a right-aligned status word');
ok(!(!(await shown('#build-apply'))), 'Apply appears once a check produced rows');
ok(!/style="(?!background)/.test(rep), 'no inline style in the check report except swatch fills');

// --- 4. channel: connected + a STALE delivery ----------------------------
await page.evaluate(() => {
  window.__sim.channelKey = 'dscr_' + 'a'.repeat(64);
  window.__sim.applyLog = JSON.stringify({ version: 1, entries: [{ source: 'channel', channel: 'dscr_aaaaaaa', seq: 7, publishedAt: null, appliedAt: '2026-01-01T00:00:00.000Z', contractIds: ['ds.badge'], bytes: null }] });
  window.__simSave();
});
await page.reload();
await page.waitForTimeout(300);
await page.evaluate(async () => {
  const sample = window.DSC.sampleBundleJson();
  window.__sim.channel = { status: 'update', seq: 3, publishedAt: new Date().toISOString(), bytes: 100, provenance: { repo: 'acme/ds', runId: '17', commit: '9f1c2ab0000' }, bundle: JSON.parse(sample) };
});
await page.waitForTimeout(200);
ok(await shown('#channel-connected'), 'a saved key shows the Connected state');
ok((await page.locator('#channel-connected').textContent()).includes('Connected'), '…labelled "From your team — Connected"');
ok(await shown('#channel-change'), '…with a Change key link');
await page.click('#tab-changes');
await page.click('#channel-check');
await page.waitForTimeout(800);
const chRep = await page.locator('#changes-result').innerHTML();
ok(chRep.includes('Change report'), 'a channel delivery renders the shared report INLINE in Changes');
ok(chRep.includes('class="note"'), 'the freshness guard uses the .note pattern');
ok(chRep.includes('is older than what this file already applied (#7)') && chRep.includes('All boxes start unchecked.'),
  'the freshness copy is the decided sentence');
ok(chRep.includes('acme/ds'), 'provenance rides above the report');
ok(!(!(await shown('#changes-apply-row'))), 'Changes grows its own Apply row');
const unchecked = await page.locator('#changes-result input[type=checkbox]:checked').count();
ok(unchecked === 0, 'a stale delivery leaves EVERY box unchecked (the silent-downgrade fix survives)');
// delivery-seq binding: the Build box must not borrow this delivery number
await page.click('#tab-build');
await page.fill('#gen-input', await page.evaluate(() => window.DSC.sampleBundleJson()));
await page.click('#gen-run');
await page.waitForTimeout(600);
const buildRep = await page.locator('#gen-result').innerHTML();
ok(!buildRep.includes('class="note"') && !buildRep.includes('Delivery #3'),
  'DELIVERY-SEQ BINDING: a paste into Build never borrows the Changes delivery ordering');

// --- 5. BROWNFIELD: a file this tool never made --------------------------
// The audit's finding, driven end to end: the plugin gated inventory, the
// empty state and Propose on a marker a hand-built file does not have.
const HAND_DUMP = {
  _provenance: { fileKey: 'TESTFILE', extractedAt: '2026-07-27', note: 'Node-tree dump (extract/figma/dump.plugin.js, dump v1.6) for design→contract proposal.', dumpVersion: '1.6' },
  _degradations: [], _variables: {},
  HandBuilt: {
    setName: 'HandBuilt', type: 'COMPONENT_SET', nodeId: '5:6', key: 'key-5:6',
    variants: [
      { name: 'Size=sm', type: 'COMPONENT', bbox: { width: 100, height: 100 }, children: [] },
      { name: 'Size=lg', type: 'COMPONENT', bbox: { width: 100, height: 100 }, children: [] },
    ],
  },
};
await page.evaluate((dump) => {
  window.__sim.markedSets = [];
  window.__sim.allSets = [
    { contractId: null, name: 'HandBuilt', nodeId: '5:6', key: 'key-5:6', type: 'COMPONENT_SET', specHash: null, version: null, variants: 2, props: ['Size'], drift: null, contractBacked: false, page: 'Page 1', variantAxes: { Size: ['sm', 'lg'] }, propKinds: { variant: 1, boolean: 0, text: 0, swap: 0 } },
    { contractId: null, name: 'Legacy Card', nodeId: '5:9', key: null, type: 'COMPONENT', specHash: null, version: null, variants: 1, props: [], drift: null, contractBacked: false, page: 'Page 2', variantAxes: {}, propKinds: { variant: 0, boolean: 0, text: 0, swap: 0 } },
  ];
  window.__sim.channel = null;
  window.__sim.channelKey = '';
  window.__sim.dump = dump;
  window.__simSave();
}, HAND_DUMP);
await page.reload();
await page.evaluate((dump) => { window.__sim.dump = dump; }, HAND_DUMP);
await page.waitForTimeout(400);

// the empty state tells the TRUTH about a file with components in it
ok(await page.locator('#panel-build').evaluate((e) => e.classList.contains('active')), 'a file with 0 contract-backed sets still opens on Build');
ok(await shown('#build-empty'), 'the empty card is up');
const headline = await page.locator('#build-empty-headline').textContent();
ok(headline === 'This file already has 2 component sets — none of them are under contract yet.',
  'BROWNFIELD EMPTY STATE: the card counts what is really there instead of "Nothing here is contract-backed yet." (got: ' + headline + ')');
ok(await shown('#build-brownfield-row'), 'the brownfield door appears');
ok(await page.locator('#build-scan').evaluate((e) => e.className === 'primary'), 'looking at the file is the panel primary, not building a sample');
ok(await page.locator('#gen-sample').evaluate((e) => e.className === 'secondary'), 'the sample library steps back to secondary for a file that has components');
ok((await page.locator('#diag-file').textContent()).includes('not under contract: 2'), 'Diagnostics counts the foreign half');

// the scan itself
await page.click('#build-scan');
await page.waitForTimeout(400);
ok(await page.locator('#panel-send').evaluate((e) => e.classList.contains('active')), 'the brownfield door lands in Send');
const scanHtml = await page.locator('#scan-result').innerHTML();
ok(scanHtml.includes('2 component sets — none contract-backed yet.'), 'the scan headline names both halves');
ok(scanHtml.includes('Not under contract') && scanHtml.includes('HandBuilt'), 'foreign sets are listed with a status word');
ok(scanHtml.includes('axes: Size (2)'), 'each row reports its variant axes');
ok(scanHtml.includes('0 boolean · 0 text · 0 swap'), 'each row reports its property counts');
ok(scanHtml.includes('cannot write to your file'), 'the scan states the read-only guarantee it now actually enforces');
ok(scanHtml.includes('>Copy JSON<') && scanHtml.includes('>Download JSON<'), 'the scan result carries BOTH a copy and a download affordance');
ok(!/style="(?!background)/.test(scanHtml), 'no inline style in the scan markup');
const scanHex = (scanHtml.match(/#[0-9a-fA-F]{3,8}/g) || []).filter((h) => !scanHtml.includes('background:' + h));
ok(scanHex.length === 0, 'no literal hex in the scan markup — found: ' + JSON.stringify(scanHex));
ok(await page.evaluate(() => window.__sim.readOnlyRuns.some((c) => c.indexOf('marker inventory') >= 0)),
  'the scan is dispatched as a readOnly engine-run (the flag code.js now enforces)');

// base-less propose, straight off a scan row
await page.click('.scan-propose');
await page.waitForTimeout(700);
const propHtml = await page.locator('#prop-result').innerHTML();
ok(await page.locator('#prop-result').evaluate((e) => e.classList.contains('ok')),
  'BASE-LESS PROPOSE: an empty base box produces a RESULT, not the "the diff needs both sides" refusal');
ok(propHtml.includes('Proposal from this canvas'), '…headlined as a proposal, not as a diff');
ok(propHtml.includes('No base contract — proposing'), '…and it says so in the first line');
ok(propHtml.includes('prop size (enum(sm|lg))'), '…describing the API the canvas drew');
ok(propHtml.includes('nearest-token suggestions come from'), '…naming the token corpus behind its suggestions');
ok(propHtml.includes('proposal READ FROM THE CANVAS'), '…with the base-less scope note, not the diff scope note');
ok(propHtml.includes('>Copy JSON<') && propHtml.includes('>Download JSON<'), 'the proposal carries copy AND download');
ok(!(await shown('#prop-pr-section')) === false, 'the PR door opens for a base-less proposal too');
ok((await page.locator('#pr-path').inputValue()).indexOf('contracts/') === 0, 'the PR path pre-fills from the PROPOSED id when there is no base');

// --- 5b. CLOSING THE LOOP (task #40): what code does this proposal make? --
// A hand-built set has no ds_contracts/contractId marker, so the marked
// inventory does not list it — the proposal is an INVERSION and the panel
// must say so before the designer sends anything.
ok(await shown('#prop-code-section'), 'a proposal opens the "What this becomes in code" section');
const codeHtml = await page.locator('#prop-code-result').innerHTML();
ok(codeHtml.includes('Target: React + CSS Modules (react)'), 'the code plan names the target in words and by flag value');
ok(codeHtml.includes('HandBuilt/HandBuilt.tsx') && codeHtml.includes('HandBuilt/HandBuilt.module.css') && codeHtml.includes('HandBuilt/index.ts'),
  'the code plan lists the exact files the CLI would write (got: ' + codeHtml + ')');
ok(codeHtml.includes('html, react-inline'), 'the other targets a repo can choose are named');
ok(codeHtml.includes('starting point, not a reproduction'),
  'HAND-BUILT ASYMMETRY: an unmarked set is headlined as an inversion, never as a round trip');
ok(codeHtml.includes('STARTING POINT, NOT A REPRODUCTION') && codeHtml.includes('INVERSION'),
  '…and the full sentence refuses to call the generated component a reproduction');
ok(!codeHtml.includes('byte for byte'), 'a hand-built proposal never claims byte-for-byte reproduction');
ok(codeHtml.includes('propose-pr') && codeHtml.includes('ONE pull request'),
  'the panel names the command that carries the contract AND the code in one PR');
ok(!/style="(?!background)/.test(codeHtml), 'no inline style in the code-plan markup');
const codeHex = (codeHtml.match(/#[0-9a-fA-F]{3,8}/g) || []).filter((h) => !codeHtml.includes('background:' + h));
ok(codeHex.length === 0, 'no literal hex in the code-plan markup — found: ' + JSON.stringify(codeHex));
ok(JSON.parse(await page.evaluate(() => {
  const a = document.querySelector('#prop-result .download');
  return JSON.stringify({ name: a && a.download });
})).name.endsWith('.proposal.json'),
  'the download is named .proposal.json — it is a CONTRACT-PROPOSAL envelope, and naming an envelope .contract.json was a trap');

// The OTHER half of the asymmetry: a set this tool generated carries a
// marker, so the SAME panel must promise the round trip.
await page.evaluate((dump) => {
  window.__sim.markedSets = [{ contractId: 'ds.badge', name: 'HandBuilt', nodeId: '5:6', key: 'key-5:6', specHash: 'h', props: [], version: '1.1.0', drift: 'in-sync', contractBacked: true, page: 'Page 1' }];
  window.__sim.allSets = null;
  window.__sim.dump = dump;
  window.__simSave();
}, HAND_DUMP);
await page.reload();
await page.evaluate((dump) => { window.__sim.dump = dump; }, HAND_DUMP);
await page.waitForTimeout(400);
await page.click('#tab-send');
await page.fill('#prop-set', 'HandBuilt');
await page.fill('#prop-base', '');
await page.click('#prop-run');
await page.waitForTimeout(800);
const genHtml = await page.locator('#prop-code-result').innerHTML();
ok(genHtml.includes('byte for byte') && genHtml.includes('true round trip'),
  'TOOL-GENERATED ASYMMETRY: a marked set IS promised as a round trip (got: ' + genHtml + ')');
ok(!genHtml.includes('STARTING POINT'), '…and the hand-built warning is gone for a marked set');

// the old refusal string is gone from the product
const uiText = await page.evaluate(() => document.documentElement.innerHTML);
ok(uiText.indexOf('Paste the contract this set was generated from into the base box') < 0,
  'the old refusal copy ("Paste the contract this set was generated from into the base box — the diff needs both sides") no longer exists anywhere in the UI');

console.log('\nconsole/page errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
if (errors.length) fails.push('console/page errors');
await browser.close();
console.log(fails.length ? '\nFAILED ' + fails.length + ':\n  ' + fails.join('\n  ') : '\nALL UI SMOKE ASSERTIONS GREEN');
process.exit(fails.length ? 1 : 0);
