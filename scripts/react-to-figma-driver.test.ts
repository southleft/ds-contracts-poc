/** The plugin's "React to Figma runner" (figma-sync/plugin/code.js, runReactToFigma) against a stand-in runner that
 *  serves the real scripts/react-to-figma-driver.js at /driver: the plugin runs those bytes, the driver claims the one
 *  session, runs each served program with the plugin's figma and posts each result, and the plugin reports the end. The
 *  port is a free one, written over the driver's 9232 in both copies, so a real runner on 9232 is never touched. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

const code = readFileSync(new URL('../figma-sync/plugin/code.js', import.meta.url), 'utf8');
const driver = readFileSync(new URL('./react-to-figma-driver.js', import.meta.url), 'utf8');
const lift = (from: string, to: string) => { const s = code.indexOf(from), e = code.indexOf(to, s); assert.ok(s >= 0 && e > s, from); return code.slice(s, e); };

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const sha256Hex = new Function(`${lift('function sha256Hex(str) {', '\n}\n')}\n}\nreturn sha256Hex;`)() as (s: string) => string;

test('the plugin pins the driver it runs: its sha256 is the driver file\'s, and its own hash function agrees with Node\'s', () => {
  const pinned = /const R2F_DRIVER_SHA256 = '([0-9a-f]{64})';/.exec(code)?.[1];
  assert.equal(pinned, sha(driver), 'figma-sync/plugin/code.js R2F_DRIVER_SHA256 must be the sha256 of scripts/react-to-figma-driver.js');
  assert.equal(sha256Hex(driver), sha(driver));
  assert.equal(sha256Hex('é — ✓ 𝄞'), sha('é — ✓ 𝄞'));
});

type Plan = { claim: unknown; steps: unknown[]; tamper?: boolean };
async function run(plan: Plan) {
  const results: unknown[] = [], steps = [...plan.steps];
  const server = createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://127.0.0.1'), send = (v: unknown) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(v)); };
    if (u.pathname === '/driver') return send({ driver: plan.tamper ? served + '\nfigma.root.name = "taken";' : served });
    if (u.pathname === '/claim') return send(plan.claim);
    if (u.pathname === '/next') return send(steps.shift() ?? { done: true });
    const chunks: Buffer[] = []; req.on('data', (d) => chunks.push(d)); req.on('end', () => { results.push(JSON.parse(Buffer.concat(chunks).toString('utf8'))); send({ ok: true }); });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`, served = driver.replace('http://localhost:9232', base);
  const posted: Array<{ type: string; ok?: boolean; summary?: string; line?: string }> = [];
  (globalThis as Record<string, unknown>).figma = { root: { name: 'Scratch Contracts' }, fileKey: 'KEY1', notify: () => {} };
  // The port is rewritten in the served driver, so the pin under test is that copy's hash; the real pin is checked above.
  const body = `${lift('function sha256Hex(str) {', '\n}\n')}\n}\n${lift('function runScript(code, opts) {', '\n// Put the node on screen')}\n${lift("const R2F_BASE = 'http://localhost:9232';", '\n// DRIFT ROUND')}`
    .replace("'http://localhost:9232'", JSON.stringify(base)).replace(/const R2F_DRIVER_SHA256 = '[0-9a-f]{64}';/, `const R2F_DRIVER_SHA256 = '${sha(served)}';`);
  try {
    await (new Function('post', `${body}\nreturn runReactToFigma;`)((m: (typeof posted)[number]) => posted.push(m)) as () => Promise<void>)();
  } finally { server.close(); delete (globalThis as Record<string, unknown>).figma; }
  return { posted, results };
}

test('the plugin runs the driver the runner serves: it claims, runs each program in the open file, posts each result, and reports the close', async () => {
  const { posted, results } = await run({ claim: { session: 's1' }, steps: [{ wait: true }, { id: 'tokens:A', program: 'return { fileKey: figma.fileKey, value: 41 + 1 };' }, { done: true }] });
  assert.equal(results.length, 1);
  const r = results[0] as { id: string; value: unknown; ms: number; timerChainMs: number; dsBefore: unknown[]; dsAfter: unknown[] };
  assert.equal(r.id, 'tokens:A');
  assert.deepEqual(r.value, { fileKey: 'KEY1', value: 42 });
  assert.ok(Number.isFinite(r.ms) && Number.isFinite(r.timerChainMs) && Array.isArray(r.dsBefore) && Array.isArray(r.dsAfter));
  assert.match(posted[0]!.line!, /^Connected to the runner; running its programs in "Scratch Contracts" \(KEY1\)/);
  assert.deepEqual(posted.at(-1), { type: 'r2f-done', ok: true, summary: 'React to Figma: the runner closed and sealed the run.' });
});

test('a refused claim and a runner stop are reported by name; a thrown program is posted as its error, never as a value', async () => {
  assert.deepEqual((await run({ claim: { refused: 'a driver already holds this run' }, steps: [] })).posted.at(-1),
    { type: 'r2f-done', ok: false, summary: 'React to Figma: the runner refused: a driver already holds this run' });
  const { posted, results } = await run({ claim: { session: 's1' }, steps: [{ id: 'component:A', program: "throw new Error('WRONG FILE: expected KEY2');" }, { done: true, stop: 'wrong-file' }] });
  assert.equal((results[0] as { error: string }).error, 'WRONG FILE: expected KEY2');
  assert.equal('value' in (results[0] as object), false);
  assert.deepEqual(posted.at(-1), { type: 'r2f-done', ok: false, summary: 'React to Figma: the runner stopped: wrong-file (see its stop.json)' });
});

test('a driver whose bytes differ from the pin is refused by name and never run: no claim, no program, the file untouched', async () => {
  const { posted, results } = await run({ claim: { session: 's1' }, steps: [{ id: 'tokens:A', program: 'return 1;' }], tamper: true });
  assert.equal(results.length, 0);
  assert.equal(posted.length, 1);
  assert.match(posted[0]!.summary!, /^r2f-driver-hash-mismatch: the driver on port 9232 has sha256 [0-9a-f]{12}…, not this plugin's pinned [0-9a-f]{12}… — nothing was run\./);
});

test('the installed CLI\'s close carries its own summary, and the plugin shows it as it stands', async () => {
  assert.deepEqual((await run({ claim: { session: 's1' }, steps: [{ done: true, ok: false, summary: '1 of 2 set(s) written; each failure is named in the terminal' }] })).posted.at(-1),
    { type: 'r2f-done', ok: false, summary: 'React to Figma: 1 of 2 set(s) written; each failure is named in the terminal' });
});

test('with no runner serving, the plugin says so by name and runs nothing', async () => {
  const posted: Array<{ type: string; ok?: boolean; summary?: string }> = [];
  const server = createServer(); await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port; server.close();
  const body = lift("const R2F_BASE = 'http://localhost:9232';", '\n// DRIFT ROUND').replace("'http://localhost:9232'", JSON.stringify(`http://127.0.0.1:${port}`));
  await (new Function('post', 'figma', `${body}\nreturn runReactToFigma;`)((m: (typeof posted)[number]) => posted.push(m), {}) as () => Promise<void>)();
  assert.equal(posted.length, 1);
  assert.match(posted[0]!.summary!, /^React to Figma: .* — is scripts\/react-to-figma-run\.ts serving on port 9232\?$/);
});
