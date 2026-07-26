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
  window.__sim = Object.assign({ markedSets: [], applyLog: null, channel: null, drift: null, channelKey: '', uiState: null }, saved);
  window.__sim.sent = [];
  window.__simSave = () => localStorage.setItem('sim', JSON.stringify({
    markedSets: window.__sim.markedSets, applyLog: window.__sim.applyLog,
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
      if (code.indexOf('apply log') >= 0) post({ type: 'engine-result', id: msg.id, ok: true, result: { applyLog: window.__sim.applyLog } });
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

console.log('\nconsole/page errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
if (errors.length) fails.push('console/page errors');
await browser.close();
console.log(fails.length ? '\nFAILED ' + fails.length + ':\n  ' + fails.join('\n  ') : '\nALL UI SMOKE ASSERTIONS GREEN');
process.exit(fails.length ? 1 : 0);
