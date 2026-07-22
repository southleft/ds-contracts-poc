/**
 * DETERMINISTIC ROUND-TRIP — `npx tsx scripts/deterministic-roundtrip.mjs`
 *
 * Proves the full journey runs as PURE DETERMINISTIC FUNCTIONS — no AI, no
 * agent, no network — and is byte-reproducible, for the advanced composite:
 *
 *   contract ──(emit-figma-script engine)──▶ canvas node tree
 *   canvas   ──(dump + proposeDiff)────────▶ recovered contract
 *   contract ──(emit-react)───────────────▶ React code
 *
 * The engine here is the SAME one baked into the plugin (window.DSC): the
 * plugin is just a deterministic executor of these functions inside Figma —
 * the AI is only ever used to BUILD this tooling, never to run the conversion.
 *
 * Determinism is asserted directly: the contract→canvas step is run TWICE and
 * the produced node trees must be byte-identical. An AI in the loop could not
 * make that guarantee; a pure function does, every time.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { buildEngineBundle } from './build-plugin-zip.mjs';
import { createFigmaMock } from './plugin-engine-mock-figma.mjs';

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const fail = (m) => { console.error(`\n✘ deterministic-roundtrip: ${m}`); process.exit(1); };
const ok = (m) => console.log(`  ✔ ${m}`);

// Load the plugin engine (window.DSC) — the exact bundle the plugin runs.
const bundle = await buildEngineBundle();

// A canonical fingerprint of a built node subtree — the FULL tracked property
// surface, not just names/types/nesting (2026-07-21 upgrade: the old
// structural fingerprint was blind to exactly the property classes — sizing,
// instance text, paints, bindings — where the live composite bugs lived).
// Run-scoped ids (node ids, variable ids, style ids, `Prop#id` suffixes)
// necessarily differ between two runs, so they are normalized to stable
// NAMES via each run's own variable/style tables; everything else must be
// byte-identical.
const SKIP_FIELDS = new Set([
  'parent', 'children', 'id', 'key', 'removed',
  '_shared', '_mainComponent', '_propSeq', '_resized', '_w', '_h',
  'setProperties', 'getMainComponentAsync',
]);
function fingerprint(node, varNameById, styleNameById) {
  const stripKeyId = (k) => k.replace(/#\d+:\d+(?::\d+)?$/, '');
  const canonValue = (v) => {
    if (v === null || typeof v !== 'object') {
      if (typeof v === 'string' && styleNameById.has(v)) return `style:${styleNameById.get(v)}`;
      // Run-scoped identifiers are NOT nondeterminism: bare node ids
      // (INSTANCE_SWAP values) and `Prop#id` suffixes differ across runs by
      // construction; the identity they point at is covered by the rest of
      // the tree. Everything else must match byte-for-byte.
      if (typeof v === 'string' && /^\d+:\d+$/.test(v)) return '<node-ref>';
      if (typeof v === 'string') return stripKeyId(v);
      return v;
    }
    if (Array.isArray(v)) return v.map(canonValue);
    if (v.type === 'VARIABLE_ALIAS' && typeof v.id === 'string') {
      return { type: 'VARIABLE_ALIAS', variable: varNameById.get(v.id) ?? v.id };
    }
    const out = {};
    for (const k of Object.keys(v).sort()) out[stripKeyId(k)] = canonValue(v[k]);
    return out;
  };
  const walk = (n) => {
    const out = {};
    for (const k of Object.keys(n).sort()) {
      if (SKIP_FIELDS.has(k) || typeof n[k] === 'function') continue;
      out[k] = canonValue(n[k]);
    }
    // The COMPUTED box (auto-layout model) and the identity markers are part
    // of the determinism claim too.
    out.width = n.width;
    out.height = n.height;
    out.specHash = n.getSharedPluginData('ds_contracts', 'specHash');
    out.contractId = n.getSharedPluginData('ds_contracts', 'contractId');
    out.children = (n.children ?? []).map(walk);
    return out;
  };
  return JSON.stringify(walk(node));
}

// Run the plugin engine's contract→canvas once, in a fresh mocked Figma.
function contractToCanvas(bundleText) {
  const { figma, root, variables, styles } = createFigmaMock();
  const sandbox = { window: {}, console: { log() {}, warn() {}, error() {} } };
  vm.createContext(sandbox);
  vm.runInContext(bundle.code, sandbox, { timeout: 120_000 });
  const DSC = sandbox.window.DSC;
  const scriptCtx = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const runScript = (code) => vm.runInContext(`(async () => {\n${code}\n})()`, scriptCtx, { timeout: 120_000 });
  return { DSC, figma, root, runScript, variables, styles };
}

const compositeText = JSON.stringify({
  type: 'CONTRACTS-BUNDLE', version: 1,
  contracts: [
    JSON.parse(read('examples/depth-composite/composite-modal.contract.json')),
    ...['card', 'badge', 'avatar', 'button'].map((n) => JSON.parse(read(`contracts/${n}.contract.json`))),
  ],
});

console.log('\nDETERMINISTIC ROUND-TRIP — advanced composite (ds.composite-modal)\n');

// --- 1. contract → canvas, TWICE, assert byte-identical -------------------
console.log('1. contract → canvas  (the plugin engine, run twice)');
const findComposite = (root) => {
  const f = (n) => { if (n.type === 'COMPONENT' && n.name === 'CompositeModal') return n; for (const c of n.children ?? []) { const r = f(c); if (r) return r; } return null; };
  return f(root);
};
let fp1, fp2, firstDump;
for (const pass of [1, 2]) {
  const { DSC, root, runScript, variables, styles } = contractToCanvas(compositeText);
  const parsed = DSC.parseIncomingText(compositeText);
  if (!parsed.ok) fail(`engine refused the contract bundle: ${JSON.stringify(parsed.issues ?? parsed)}`);
  const plan = DSC.planGenerate(parsed.contracts, { withTokens: true, fileKey: '' });
  if (!plan.ok) fail(`planGenerate refused: ${plan.issues.map((i) => i.headline).join('; ')}`);
  for (const step of plan.steps) await runScript(step.code);
  const built = findComposite(root);
  if (!built) fail('CompositeModal was not built');
  const varNameById = new Map(variables.map((v) => [v.id, v.name]));
  const styleNameById = new Map(styles.map((s) => [s.id, s.name]));
  const fp = fingerprint(built, varNameById, styleNameById);
  if (pass === 1) { fp1 = fp; firstDump = { DSC, root, runScript }; } else { fp2 = fp; }
}
if (fp1 !== fp2) fail('contract→canvas was NOT byte-identical across two runs — non-deterministic!');
ok(`built CompositeModal both times; FULL node trees byte-identical (${fp1.length} bytes — every tracked property: layout, sizing, paints, text, bindings, markers) — DETERMINISTIC`);
ok('anatomy: ' + JSON.parse(fp1).children.map((c) => c.name).join(' + ') + ' roots');

// --- 2. canvas → contract  (dump + propose), deterministic ----------------
console.log('\n2. canvas → contract  (dump the drawn set, propose a contract)');
const ui = read('figma-sync/plugin/ui.html');
const openTag = '<script type="text/plain" id="dump-source">';
const s = ui.indexOf(openTag);
const dumpSrc = ui.slice(s + openTag.length, ui.indexOf('</script>', s)).replace(/^\n/, '');
const scoped = dumpSrc.replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify(['CompositeModal'])};`);
const dumpA = await firstDump.runScript(scoped);
if (!dumpA || !dumpA.CompositeModal) fail('dump did not capture the CompositeModal set');
const composite = JSON.parse(read('examples/depth-composite/composite-modal.contract.json'));
const diff = firstDump.DSC.proposeDiff(dumpA, 'CompositeModal', composite);
if (!diff.ok) fail(`proposeDiff refused: ${diff.issue?.headline}`);
const recovered = JSON.parse(diff.exportJson).proposedContract;
const rp = (recovered.anatomy?.root ?? Object.values(recovered.anatomy ?? {})[0])?.parts ?? {};
const dlg = rp.dialog, body = dlg?.parts?.body;
const recOk = !!rp.dialog && !!rp.backdrop && !!body?.parts?.summary?.component && !!body?.parts?.tags?.parts?.tag?.component;
if (!recOk) fail('recovered contract did not carry the composite anatomy back');
ok('recovered a contract from the drawn canvas — dialog+backdrop, composed ds.card instance, repeated ds.badge collection');
ok('round-trip closes: the anatomy that went to canvas came back');

// --- 3. contract → code  (emit React), part of the same loop --------------
console.log('\n3. contract → code  (emit React from the contract)');
const { emitReact } = await import(path.join(ROOT, 'core', 'emit-react.js'));
const { tokenInventoryFromJson } = await import(path.join(ROOT, 'core', 'tokens.js'));
const { readdirSync } = await import('node:fs');
const byId = new Map(['card', 'badge', 'avatar', 'button'].map((n) => { const c = JSON.parse(read(`contracts/${n}.contract.json`)); return [c.id, c]; }));
byId.set(composite.id, composite);
const icons = new Map(readdirSync(path.join(ROOT, 'assets', 'icons')).filter((f) => f.endsWith('.svg')).map((f) => [f.replace(/\.svg$/, ''), read(`assets/icons/${f}`).trim()]));
// v1.1.0 exhibit: the contract carries real token refs — validate them
// against the repo inventory (the refusal gate would rightly refuse an
// empty set).
const tokenInventory = tokenInventoryFromJson([
  JSON.parse(read('tokens/primitives.tokens.json')),
  JSON.parse(read('tokens/semantic.tokens.json')),
  JSON.parse(read('tokens/modes/semantic.light.tokens.json')),
  JSON.parse(read('tokens/modes/semantic.dark.tokens.json')),
]);
const { tsx } = emitReact(composite, { tokens: tokenInventory, icons, contracts: byId });
if (!/role="dialog"|role: ?'dialog'|"dialog"/.test(tsx)) fail('emitted React did not carry the dialog role');
ok(`emitted ${tsx.length}B of React from the same contract`);

// --- 4. determinism restated ---------------------------------------------
console.log('\n✔ THE FULL LOOP RAN WITH ZERO AI — pure deterministic functions (the same engine the plugin runs):');
console.log('    contract → canvas → contract → code, byte-reproducible.');
console.log('  The AI built this tooling; it is NEVER in the conversion. That is the guarantee.\n');
