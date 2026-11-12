/**
 * THE REACT TO FIGMA RUNNER (reviewer message, 2026-11-11, sections 2 and 3). It writes the stories it is given into one
 * Figma file, one set at a time, reads each back by node id, checks it, and files the receipts scripts/reading.ts reads.
 *
 *   npx tsx scripts/react-to-figma-run.ts --run <new folder> --tag <letters, digits, hyphens> --file-key <key>
 *     --only <titles.json> --profile <profile.json> [--pilot]
 *
 * Then bring that file's Figma tab to the front and run scripts/react-to-figma-driver.js in it through the Desktop Bridge
 * (figma_execute). FIGMA_TOKEN comes from the environment (load it in a subshell; never print it). Every program starts
 * with the file guard and sets every DS_ flag; the driver records the DS_ keys before and after each call.
 *
 * Order: step 0, checks from files (folder, disk, plan, scripts, tokens), a read of the file (the tab in front, no unknown
 * DS_ key, no item carrying this tag, totals, Figma's fonts) and one REST read; step 1, archive every older page, sync
 * target, contract stamp, variable, collection and marked text style under this tag (renames only, never a delete); step
 * 2, zero counts; then per set: tokens, component (create-only), readback by id, capture and dump, REST settle, the check,
 * with the fault and retry rule; step 8, close and seal. A stop voids the attempt: stop.json names it, nothing resumes. --pilot
 * runs three sets: the first set, the first single component, and the one with the most variants.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statfsSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storyFontPreflight } from './font-preflight.js';

// The bridge plugin may fetch only localhost:9223-9232, and each figma-console-mcp instance takes the first free port there
// on ::1; 9232 is taken last. The runner holds it on both ::1 and 127.0.0.1, so nothing else can answer the driver.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), PORT = 9232;
const FLAGS = ['--run', '--tag', '--file-key', '--only', '--profile', '--pilot'], argv = process.argv.slice(2);
const flag = (n: string) => { const i = argv.indexOf(n); return i > -1 && !String(argv[i + 1] ?? '--').startsWith('--') ? argv[i + 1] : undefined; };
const [RUN, TAG, KEY, ONLY, PROFILE] = [flag('--run'), flag('--tag'), flag('--file-key'), flag('--only'), flag('--profile')];
if (argv.some((a) => a.startsWith('--') && !FLAGS.includes(a)) || !RUN || !TAG || !/^[A-Za-z0-9-]+$/.test(TAG) || !KEY || !/^[A-Za-z0-9]+$/.test(KEY) || !ONLY || !PROFILE) {
  console.error('usage: npx tsx scripts/react-to-figma-run.ts --run <new folder> --tag <letters, digits, hyphens> --file-key <key> --only <titles.json> --profile <profile.json> [--pilot]\n  An unknown flag is refused.');
  process.exit(2);
}
const OUT = path.resolve(RUN), MARK = ` · archived ${TAG}`, PRE = `archived-${TAG}`;
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex'), json = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const put = (f: string, v: unknown) => { mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(v, null, 1) + '\n'); };
const git = (...a: string[]) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const code = (m: unknown) => String(m ?? '').replace(/^Error:\s*/, '').split(':')[0]!.trim();
class Stop extends Error {}
const stop = (why: string): never => { throw new Stop(why); };
const refuse = (why: string): never => { console.error(`✖ refused before any write: ${why}`); process.exit(2); };

// Step 0, from files.
if (!OUT.startsWith(ROOT + path.sep)) refuse('the run folder must be inside this checkout');
if (existsSync(OUT) && readdirSync(OUT).length) refuse('the run folder is not empty');
const disk = statfsSync(ROOT); if (disk.bavail * disk.bsize < 50e9) refuse('less than 50 GB free');
const self = [fileURLToPath(import.meta.url), path.join(ROOT, 'scripts/react-to-figma-driver.js')];
const receipt: Record<string, any> = { tag: TAG, fileKey: KEY, pilot: argv.includes('--pilot'), before: { head: git('rev-parse', 'HEAD'), porcelain: git('status', '--porcelain') },
  runnerSha256: sha(Buffer.concat(self.map((f) => readFileSync(f)))), profileSha256: sha(readFileSync(PROFILE)), onlySha256: sha(readFileSync(ONLY)), calls: [], sets: {}, faults: [] };
const save = () => put(`${OUT}/receipt.json`, receipt);
mkdirSync(OUT, { recursive: true }); save();
const storybook = String(json(PROFILE).pins?.storybook ?? '').split(' ')[0]!;
const tsx = (name: string, args: string[]) => { const r = spawnSync('npx', ['tsx', ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }); writeFileSync(`${OUT}/${name}.log`, `${r.stdout}${r.stderr}`); return r.status; };
if (tsx('reader', ['scripts/storybook-reader.ts', '--storybook', storybook, '--out', `${OUT}/reader`, '--profile', PROFILE, '--only', ONLY]) !== 0) refuse('the reader did not finish');
receipt.contractsExit = tsx('contracts', ['scripts/storybook-contracts.ts', '--stories', `${OUT}/reader/stories.json`, '--out', `${OUT}/contracts`, '--storybook', storybook, '--file-key', KEY]);
if (!existsSync(`${OUT}/contracts/storybook-contracts.json`)) { save(); refuse(`the contract step wrote no report (exit ${receipt.contractsExit})`); }
const STORIES = `${OUT}/reader/stories.json`, stories = json(STORIES), report = json(`${OUT}/contracts/storybook-contracts.json`), only = new Set<string>(json(ONLY));
const script = (contract: string, part: 1 | 2) => `${OUT}/contracts/figma/${contract.slice(contract.indexOf('.') + 1)}.${part === 1 ? '1-variables' : '2-component'}.js`;
type Row = { title: string; contract: string; name: string; isSet: boolean; variants: number };
let rows: Row[] = (report.components as any[]).filter((c) => c.setName && c.contract && existsSync(script(c.contract, 2)))
  .map((c) => ({ title: c.subject, contract: c.contract, name: c.setName, isSet: !!c.isSet, variants: Number(c.variants) }));
if (receipt.pilot) {
  const big = [...rows].sort((a, b) => b.variants - a.variants), firstSet = rows.find((r) => r.isSet), firstOne = rows.find((r) => !r.isSet);
  rows = rows.filter((r) => r === firstSet || r === firstOne || r === big.find((b) => b !== firstSet && b !== firstOne));
}
const reserved = ['_provenance', '_variables', '_degradations', '_imageAssets', '_occurrences', '__proto__', 'constructor', 'prototype'];
const titles = new Map<string, any>((stories.components as any[]).map((c) => [c.title, c]));
if (!rows.length || new Set(rows.map((r) => r.name)).size !== rows.length || new Set(rows.map((r) => r.contract)).size !== rows.length) refuse('planned names and contract ids must be distinct');
receipt.offListRows = (report.components as any[]).filter((c) => !only.has(c.subject)).length;
if (receipt.offListRows) refuse(`${receipt.offListRows} row(s) are not on the --only list`);
const variables = new Map<string, string>(); let tokenEntries = 0;
for (const r of rows) {
  const comp = readFileSync(script(r.contract, 2), 'utf8'), tok = readFileSync(script(r.contract, 1), 'utf8');
  const C = JSON.parse(/^const COMPONENTS = (\[[\s\S]*?\n\]);$/m.exec(comp)?.[1] ?? 'null'), ids = new Set(comp.match(/"contractId": "[^"]+"/g) ?? []);
  if (r.contract.split('.').length !== 2 || r.contract.startsWith('archived-') || r.name.includes(' · archived ') || r.name === 'Slot' || /^\d+$/.test(r.name) || reserved.includes(r.name)
    || !titles.has(r.title) || titles.get(r.title).references.some((x: any) => x.png && !existsSync(`${OUT}/reader/references/${x.png}`)) || C?.length !== 1 || C[0].anchorKey != null
    || [...ids].some((s) => s !== `"contractId": "${r.contract}"`) || comp.includes('retireSlotUtility') || comp.includes("createVariableCollection('Imported (provisional)')")
    || !JSON.parse(/^const BRAND_MODES = (.*);$/m.exec(tok)?.[1] ?? '[]').length) refuse(`step 0c: planned row ${rows.indexOf(r)} fails a file check`);
  for (const v of JSON.parse(/^const PRIMITIVES = (.*);$/m.exec(tok)?.[1] ?? '[]') as any[]) {
    const fact = JSON.stringify([v.type, v.value, v.scopes, v.codeSyntax]); tokenEntries++;
    if (String(v.name).startsWith('archived-') || (variables.has(v.name) && variables.get(v.name) !== fact)) refuse('step 0d: a variable name repeats with another value, or starts with archived-');
    variables.set(v.name, fact);
  }
}
receipt.plan = { rows, sha256: sha(JSON.stringify(rows) + rows.map((r) => sha(readFileSync(script(r.contract, 1))) + sha(readFileSync(script(r.contract, 2)))).join('')), distinctVariables: variables.size, tokenEntries,
  noContract: (report.components as any[]).length - rows.length }; save();

// The programs. GUARD: the file key must be a string equal to the run's; every program returns figma.fileKey.
const GUARD = `if (typeof figma.fileKey !== 'string' || figma.fileKey !== ${JSON.stringify(KEY)}) throw new Error('GUARD: not the run file');\n`;
const program = (body: string) => `${GUARD}globalThis.DS_CREATE_ONLY = true; globalThis.DS_OVERWRITE_TOKENS = false; globalThis.DS_PRUNE_TOKENS = false;\n`
  + `const value = await (async () => {\n${body}\n})();\nreturn { fileKey: figma.fileKey, value };`;
const WALK = `await figma.loadAllPagesAsync();\nconst pages = figma.root.children, targets = [], variantsOf = [], sections = []; let walked = 0;
for (const p of pages) { walked++; for (const n of p.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT', 'SECTION'] }))
  (n.type === 'SECTION' ? sections : n.type === 'COMPONENT' && n.parent && n.parent.type === 'COMPONENT_SET' ? variantsOf : targets).push(n); }
const vars = await figma.variables.getLocalVariablesAsync(), cols = await figma.variables.getLocalVariableCollectionsAsync(), styles = await figma.getLocalTextStylesAsync();
const MARK = ${JSON.stringify(MARK)}, PRE = ${JSON.stringify(PRE)}, stamp = (n) => n.getSharedPluginData('ds_contracts', 'contractId');\n`;
const TOTALS = `${WALK}return { walked, pages: pages.length, firstPage: pages[0].id, rootName: figma.root.name, targets: targets.length, variantChildren: variantsOf.length, sections: sections.length,
  collections: cols.length, variables: vars.length, textStyles: styles.length, nodes: pages.reduce((a, p) => a + p.findAll(() => true).length, 0),
  tagged: pages.filter((p) => p.name.includes(MARK)).length + targets.filter((n) => n.name.includes(MARK) || stamp(n).startsWith(PRE + '.')).length + vars.filter((v) => v.name.startsWith(PRE)).length + cols.filter((c) => c.name.startsWith(PRE)).length,
  fonts: (await figma.listAvailableFontsAsync()).map((f) => ({ family: f.fontName.family, style: f.fontName.style })) };`;
const ARCHIVE = `${WALK}const changed = { targets: 0, stamps: 0, pages: 0, variables: 0, collections: 0, textStyles: 0 };
for (const n of targets) { if (!n.name.endsWith(MARK)) { n.name += MARK; changed.targets++; } if (stamp(n) && !stamp(n).startsWith(PRE + '.')) { n.setSharedPluginData('ds_contracts', 'contractId', PRE + '.' + stamp(n)); changed.stamps++; } }
for (const p of pages) if (!p.name.endsWith(MARK)) { p.name += MARK; changed.pages++; }
for (const v of vars) if (!v.name.startsWith(PRE + '/')) { v.name = PRE + '/' + v.name; changed.variables++; }
for (const c of cols) if (!c.name.startsWith(PRE + ' ')) { c.name = PRE + ' ' + c.name; changed.collections++; }
for (const s of styles) { const m = s.getSharedPluginData('ds_contracts', 'textStyleToken'); if (m && !m.startsWith(PRE + '.')) { s.name += MARK; s.setSharedPluginData('ds_contracts', 'textStyleToken', PRE + '.' + m); changed.textStyles++; } }
return { walked, pages: pages.length, changed };`;
const ZERO = `${WALK}const names = ${JSON.stringify(rows.map((r) => r.name))}, ids = ${JSON.stringify(rows.map((r) => r.contract))}, renamed = [];
for (const n of variantsOf) if (names.includes(n.name)) { n.name += MARK; renamed.push(n.id); }
return { walked, pages: pages.length, renamed, counts: { targets: targets.filter((n) => !n.name.endsWith(MARK)).length, stamps: targets.filter((n) => stamp(n) && !stamp(n).startsWith(PRE + '.')).length,
  pages: pages.filter((p) => !p.name.endsWith(MARK)).length, variables: vars.filter((v) => !v.name.startsWith(PRE + '/')).length, collections: cols.filter((c) => !c.name.startsWith(PRE + ' ')).length,
  textStyles: styles.filter((s) => { const m = s.getSharedPluginData('ds_contracts', 'textStyleToken'); return m && !m.startsWith(PRE + '.'); }).length,
  plannedIds: targets.filter((n) => ids.includes(stamp(n))).length, plannedNames: [...targets, ...variantsOf].filter((n) => names.includes(n.name)).length,
  slot: [...targets, ...variantsOf].filter((n) => n.type === 'COMPONENT' && n.name === 'Slot').length },
  old: { pages: pages.map((p) => p.id), targets: targets.map((n) => n.id), variables: vars.map((v) => v.id), collections: cols.map((c) => c.id) } };`;
const READBACK = (r: Row, id: string) => `${WALK}const node = await figma.getNodeByIdAsync(${JSON.stringify(id)}); let page = node; while (page && page.type !== 'PAGE') page = page.parent;
return { walked, pages: pages.length, carrying: targets.filter((n) => stamp(n) === ${JSON.stringify(r.contract)}).map((n) => n.id), named: targets.filter((n) => n.name === ${JSON.stringify(r.name)}).map((n) => n.id),
  namedAny: [...targets, ...variantsOf].filter((n) => n.name === ${JSON.stringify(r.name)}).length, nodeName: node && node.name, pageId: page && page.id };`;
const NEW = (known: Set<string>) => `${WALK}const known = new Set(${JSON.stringify([...known])}), fresh = (xs) => xs.map((x) => x.id).filter((id) => !known.has(id));
return { walked, pages: pages.length, fresh: { pages: fresh(pages), targets: fresh(targets), variables: fresh(vars), collections: fresh(cols) } };`;
const capture = readFileSync(path.join(ROOT, 'extract/figma/capture.plugin.js'), 'utf8'), dump = readFileSync(path.join(ROOT, 'extract/figma/dump.plugin.js'), 'utf8');
if (capture.split("const CAPTURE_SET = '';").length !== 2 || dump.split('const TARGET_SETS = [];').length !== 2 || !dump.includes('const INCLUDE_DEPENDENCIES = false;')) refuse('capture or dump changed shape');

// The REST settle (step 7a): two reads of the dump's variant ids, at least 8 s apart, with the same version and documents.
async function settle(ids: string[], text: string[]): Promise<{ version?: string; fault?: string }> {
  const read = async (): Promise<any> => {
    for (;;) {
      const r = await fetch(`https://api.figma.com/v1/files/${KEY}/nodes?ids=${ids.join(',')}`, { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN ?? '' } });
      if (r.status === 429) { const wait = Number(r.headers.get('retry-after') ?? 60); receipt.faults.push({ fault: 'rest-rate-limited', retryAfter: wait, tier: r.headers.get('x-figma-plan-tier'), type: r.headers.get('x-figma-rate-limit-type') }); if (wait > 300) stop('rest-rate-limited'); await sleep(wait * 1000); continue; }
      if (r.status === 403 || r.status === 404) stop(`rest-${r.status}`);
      return r.status === 200 ? r.json() : undefined;
    }
  };
  const docs = (b: any) => b && ids.every((id) => b.nodes?.[id]?.document) ? sha(JSON.stringify(ids.map((id) => b.nodes[id].document))) : undefined;
  for (const t0 = Date.now(); Date.now() - t0 < 120_000;) {
    const a = await read(); await sleep(8000); const b = await read(), h = docs(b), seen = JSON.stringify(b ?? '');
    if (h && a?.version === b.version && docs(a) === h && text.every((id) => seen.includes(`"id":"${id}"`))) return { version: b.version };
  }
  return { fault: 'rest-not-settled' };
}
// The check (step 7b, 7c): a run fault is never a score; every other reason is the check's verdict, filed as it stands.
function check(r: Row, dir: string, sets: Record<string, any>, version: string | undefined) {
  const out = `${dir}/check`, args = ['scripts/react-to-figma-check.ts', '--stories', STORIES, '--component', r.title, '--dump', `${dir}/dump.json`, '--set', r.name, '--capture', `${dir}/capture.json`, '--out', out];
  const exit = spawnSync('npx', ['tsx', ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).status, f = `${out}/react-to-figma.json`;
  if (!existsSync(f) || exit === 2) return { fault: `check-exit-${exit}` };
  const rec = json(f), reasons = [...(rec.problems ?? []), ...(rec.variants ?? []).flatMap((v: any) => v.reasons ?? [])].map(String);
  if (rec.set !== r.name || rec.inputs?.dump !== sha(readFileSync(`${dir}/dump.json`)) || rec.inputs?.capture !== sha(readFileSync(`${dir}/capture.json`)) || rec.inputs?.stories !== sha(readFileSync(STORIES))) return { fault: 'check-receipt-not-this-set' };
  const content = existsSync(`${out}/figma-content.json`) ? json(`${out}/figma-content.json`) : undefined;
  if (content && content.version !== version) return { fault: 'content-version-not-settled' };
  const fault = reasons.find((x) => x.startsWith('figma-images-unavailable') || x.startsWith('content-check-unavailable:') || x.startsWith('set-missing:'));
  const v = rec.verdicts, n = (rec.variants ?? []).length;
  sets.pending = v.pass + v.fail + v.unverified + v['font-blocked'] === n && n >= 1 ? 0 : n;
  sets.content = content && { version: content.version, responseSha256: content.responseSha256 };
  sets.variants = n; const filed = { file: path.relative(OUT, f), verdicts: Object.fromEntries((rec.variants ?? []).map((x: any) => [x.key, x.verdict])) };
  return fault ? { ...filed, fault: code(fault), imageMissing: reasons.filter((x) => x.includes('figma-image-missing:')) } : filed;
}

// The attempt: a generator the driver feeds, one program at a time. Each yield serves one program and returns its result.
type Result = { id: string; value?: any; error?: string; ms: number; timerChainMs: number; dsBefore: [string, string][]; dsAfter: [string, string][] };
async function* attempt(): AsyncGenerator<{ id: string; program: string }, void, Result> {
  const call = async function* (id: string, body: string): AsyncGenerator<{ id: string; program: string }, Result, Result> {
    const r: Result = yield { id, program: program(body) };
    const unknown = [...r.dsBefore, ...r.dsAfter].filter(([k]) => !['DS_CREATE_ONLY', 'DS_OVERWRITE_TOKENS', 'DS_PRUNE_TOKENS'].includes(k));
    receipt.calls.push({ id, ms: r.ms, timerChainMs: r.timerChainMs, dsBefore: r.dsBefore, dsAfter: r.dsAfter, ...(r.error ? { error: code(r.error) } : {}) }); save();
    if (r.error?.startsWith('GUARD') || (!r.error && r.value?.fileKey !== KEY)) stop(`guard:${id}`);
    if (unknown.length) stop(`unknown-ds-key:${unknown[0]![0]}`);
    if (!r.error && typeof r.value?.value?.walked === 'number' && r.value.value.walked !== r.value.value.pages) stop(`pages-not-walked:${id}`);
    return r;
  };
  const first = yield* call('totals:start', TOTALS);
  if (first.timerChainMs > 1000) stop('figma-tab-not-in-front'); if (first.error) stop('totals-failed');
  const { fonts, ...start } = first.value.value; receipt.totalsStart = start;
  if (start.tagged !== 0) stop('tag-already-used');
  if (!String(start.rootName).includes('Scratch')) stop('file-not-scratch');   // step 1 renames everything in the file: only a Scratch file
  receipt.fontsMissingInFigma = storyFontPreflight(rows.map((r) => titles.get(r.title)), fonts).missing.map((f) => `${f.family} ${f.weight} ${f.style} (${f.variants.length})`);
  const probe = await fetch(`https://api.figma.com/v1/files/${KEY}/nodes?ids=${start.firstPage}&depth=1`, { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN ?? '' } });
  receipt.restPreflight = probe.status; if (probe.status !== 200 || !(await probe.json()).nodes?.[start.firstPage]?.document) stop(`rest-preflight-${probe.status}`);
  let zero: any;
  for (let i = 1; ; i++) {
    const a = yield* call(`archive:${i}`, ARCHIVE); if (a.error) stop('archive-failed'); receipt[`archive${i}`] = a.value.value.changed;
    zero = (yield* call(`zero:${i}`, ZERO)).value?.value;
    if (zero && Object.values(zero.counts).every((n) => n === 0)) break;
    if (i === 5) stop('archive-not-complete');
  }
  const old = new Set<string>(Object.values(zero.old).flat() as string[]), seen = new Set<string>(old);
  receipt.zero = { counts: zero.counts, renamedVariantChildren: zero.renamed, old: Object.fromEntries(Object.entries(zero.old).map(([k, v]) => [k, (v as string[]).length])) };
  put(`${OUT}/old-ids.json`, zero.old);
  let collections: string[] | undefined; const checks: Record<string, any> = {}, sums = { created: 0, total: 0 };
  for (const e of report.components as any[]) if (!rows.some((r) => r.title === e.subject) && !receipt.pilot) checks[e.subject] = { refused: code(e.refusals?.[0] ?? 'contract-not-written') };
  for (const r of rows) {
    const dir = `${OUT}/sets/${r.contract}`, sets: Record<string, any> = (receipt.sets[r.title] = {});
    const t = yield* call(`tokens:${r.contract}`, readFileSync(script(r.contract, 1), 'utf8')), tv = t.value?.value;
    if (t.error || !tv) stop(`tokens-threw-or-no-value:${r.contract}`);
    tv.leftovers = tv.leftovers?.length ?? 0; put(`${dir}/tokens.json`, tv);
    const same = (tv.variableDrift ?? []).filter((e: any) => JSON.stringify(e.applied) === JSON.stringify(e.bundle));
    if (same.length) receipt.driftSameValue = { count: same.length, canvas: same[0].canvas, bundle: same[0].bundle };
    if (tv.variableDrift?.length || tv.driftOverwritten !== false || tv.pruned !== 0) stop(`tokens-drift-or-prune:${r.contract}`);
    const ids = [tv.primitives?.collectionId, tv.brand?.collectionId, tv.semantic?.collectionId];
    if (ids.some((id) => old.has(id)) || (collections && JSON.stringify(ids) !== JSON.stringify(collections))) stop(`tokens-collections:${r.contract}`);
    collections ??= ids; sums.created += tv.primitives.created; sums.total += tv.primitives.total;
    const c = yield* call(`component:${r.contract}`, readFileSync(script(r.contract, 2), 'utf8'));
    if (c.error && (/^(Error: )?WRONG FILE: expected/.test(c.error) || /refusing (ambiguous|contradictory) identity/.test(c.error))) stop(`identity:${r.contract}`);
    if (!c.dsAfter.some(([k, v]) => k === 'DS_CREATE_ONLY' && v === 'true')) stop('create-only-not-set');
    const cv = c.value?.value, res = cv?.results?.[0];
    if (!c.error && (cv?.results?.length !== 1 || JSON.stringify(cv.createdNodeIds) !== JSON.stringify([res?.nodeId]) || res.skipped || res.createOnly || !res.nodeId || seen.has(res.nodeId))) stop(`component-result:${r.contract}`);
    const fresh = (yield* call(`fresh:${r.contract}`, NEW(seen))).value?.value?.fresh ?? {};   // what this set added: never an old id or an earlier set's
    sets.fresh = Object.fromEntries(Object.entries(fresh).map(([k, v]) => [k, (v as string[]).length])); for (const id of Object.values(fresh).flat() as string[]) seen.add(id);
    if (c.error) { checks[r.title] = { failed: /loadFontAsync|authored-text-appearance-scalar-font-unavailable/.test(c.error) ? 'font-unavailable-throw' : code(c.error) }; continue; }
    put(`${dir}/component.json`, { ...cv, results: [{ ...res, degradations: (res.degradations ?? []).map((d: any) => d.code ?? code(d)) }] });
    sets.nodeId = res.nodeId; sets.fontMissing = (res.degradations ?? []).filter((d: any) => d.code === 'FC-FONT-STYLE-UNRESOLVED').length;
    const rb = (yield* call(`readback:${r.contract}`, READBACK(r, res.nodeId))).value?.value;
    if (!rb || JSON.stringify(rb.carrying) !== JSON.stringify([res.nodeId]) || JSON.stringify(rb.named) !== JSON.stringify([res.nodeId]) || rb.namedAny !== 1 || rb.nodeName !== r.name || old.has(rb.pageId)) stop(`readback:${r.contract}`);
    const folders: Record<string, any>[] = [];
    for (let k = 0; k < 3; k++) {
      if (k) await sleep(60_000);
      const at = `${dir}/try-${k}`; let cap: Result | undefined, moved = 0;
      for (let m = 0; m < 3; m++) {
        const got = cap = yield* call(`capture:${r.contract}:${k}`, capture.replace("const CAPTURE_SET = '';", `const CAPTURE_SET = ${JSON.stringify(r.name)};`));
        const vs = got.value?.value?.variants ?? [], same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
        moved = vs.filter((v: any) => !same(v.after?.layout, v.box?.bounds) || (v.paint && !same(v.after?.render, v.paint.bounds))).length; if (!moved) break;
      }
      const d = yield* call(`dump:${r.contract}:${k}`, dump.replace('const TARGET_SETS = [];', `const TARGET_SETS = [${JSON.stringify(r.name)}];`));
      const cv2 = cap!.value?.value, dv = d.value?.value, mismatch = cap!.error ? code(cap!.error) : d.error ? code(d.error)
        : cv2?.fileKey !== KEY || dv?._provenance?.fileKey !== KEY || JSON.stringify(dv?._provenance?.sets) !== JSON.stringify([r.name]) || cv2?.nodeId !== res.nodeId
          || dv?.[r.name]?.nodeId !== res.nodeId || dv?.[r.name]?.contractId !== r.contract ? 'step-6-mismatch' : undefined;
      let outcome: Record<string, any>;
      if (mismatch) outcome = { fault: mismatch };
      else {
        put(`${at}/capture.json`, cv2); put(`${at}/dump.json`, dv);
        const vids = (dv[r.name].variants as any[]).map((v) => v.nodeId), text: string[] = [], walk = (n: any) => { if (n?.type === 'TEXT' && n.nodeId) text.push(n.nodeId); for (const ch of n?.children ?? []) walk(ch); };
        (dv[r.name].variants as any[]).forEach(walk);
        const settled = await settle(vids, text);
        outcome = settled.fault ? settled : check(r, at, sets, settled.version);
      }
      folders.push({ ...outcome, ...(moved ? { captureMoved: moved } : {}) }); sets.tries = folders;
      if (!outcome.fault) break;
      receipt.faults.push({ set: r.title, try: k, fault: outcome.fault }); save();
      const thrice = k === 2 && (folders[0]!.imageMissing ?? []).some((x: string) => folders.every((f) => f.imageMissing?.includes(x)));   // the same variant all three times
      if (k === 2 && !thrice) stop(`run-fault:${r.contract}:${outcome.fault}`);
    }
    const clean = folders.filter((f) => f.verdicts && !f.fault);
    if (clean.length > 1 && clean.some((f) => JSON.stringify(f.verdicts) !== JSON.stringify(clean[0]!.verdicts))) sets.retryVerdictsDiffer = true;
    checks[r.title] = { check: folders[folders.length - 1]!.file };
  }
  const end = yield* call('totals:end', TOTALS); const { fonts: _f, ...endTotals } = end.value?.value ?? {}; receipt.totalsEnd = endTotals;
  put(`${OUT}/checks.json`, checks);
  // Step 8: close. Equalities; a difference is reported, never repaired by a write to the file.
  const filed = Object.keys(checks).sort(), readerTitles = (stories.components as any[]).map((c) => c.title).sort();
  receipt.close = { checkedPlusFailed: rows.filter((r) => checks[r.title]?.check || checks[r.title]?.failed).length === rows.length,
    titlesEqual: receipt.pilot || JSON.stringify(filed) === JSON.stringify(readerTitles), primitivesCreated: sums.created === variables.size, primitivesTotal: sums.total === tokenEntries,
    slowest: Object.fromEntries(['tokens', 'component'].map((k) => [k, Math.max(0, ...receipt.calls.filter((x: any) => x.id.startsWith(k)).map((x: any) => x.ms))])),
    over120s: receipt.calls.filter((x: any) => x.ms > 120_000).map((x: any) => x.id),
    variantCountDiffers: rows.filter((r) => receipt.sets[r.title]?.variants !== undefined && receipt.sets[r.title].variants !== titles.get(r.title).matrix?.variants).map((r) => r.title) };
}

// The server: one session, one program in flight, the next program only after the last result.
const gen = attempt(); let session: string | undefined, pending: Promise<IteratorResult<{ id: string; program: string }, void>> | undefined, served: any, done: any;
const finish = (why?: string) => {
  done = why ? { done: true, stop: why } : { done: true }; receipt.after = { head: git('rev-parse', 'HEAD'), porcelain: git('status', '--porcelain') };
  if (why) put(`${OUT}/stop.json`, { stop: why }); save();
  const files = spawnSync('find', [OUT, '-type', 'f'], { encoding: 'utf8' }).stdout.trim().split('\n').sort().filter((f) => !f.endsWith('SEAL.sha256'));
  writeFileSync(`${OUT}/SEAL.sha256`, files.map((f) => `${sha(readFileSync(f))}  ${path.relative(OUT, f)}`).join('\n') + '\n');
  console.log(why ? `✖ STOP: ${why}. The attempt is void; nothing is retried.` : '✔ closed and sealed: receipt.json, checks.json, SEAL.sha256');
  setTimeout(() => process.exit(why ? 1 : 0), 2000);
};
const advance = (r?: Result) => { pending = gen.next(r as Result); pending.then((it) => { served = it.done ? undefined : it.value; if (it.done) finish(); }, (e) => finish(e instanceof Stop ? e.message : `runner-error:${code(e?.message)}`)); };
const serve = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => {
  const send = (v: unknown) => { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(v)); };
  const u = new URL(req.url ?? '/', 'http://127.0.0.1'), mine = !!session && u.searchParams.get('session') === session;
  if (u.pathname === '/claim') { if (session) return send({ refused: 'a driver already holds this run' }); session = sha(String(Date.now() + Math.random())).slice(0, 16); advance(); return send({ session }); }
  if (!mine) return send({ refused: 'not this run\'s driver' });
  if (u.pathname === '/next') { if (done) return send(done); if (!served || served.sent) return send({ wait: true }); served.sent = true; return send({ id: served.id, program: served.program }); }
  if (u.pathname === '/result' && req.method === 'POST') {
    const chunks: Buffer[] = []; req.on('data', (d) => chunks.push(d));
    req.on('end', () => { const r = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Result; if (!served || r.id !== served.id) return send({ refused: 'not the program in flight' }); served = undefined; advance(r); send({ ok: true }); });
    return;
  }
  send({ refused: 'no route' });
};
let up = 0;
for (const host of ['127.0.0.1', '::1']) createServer(serve).on('error', (e: NodeJS.ErrnoException) => refuse(`port ${PORT} on ${host}: ${e.code}; another local server holds it`))
  .listen(PORT, host, () => { if (++up === 2) console.log(`plan: ${rows.length} set(s), tag ${TAG}. Bring the file's Figma tab to the front and run scripts/react-to-figma-driver.js there through the Desktop Bridge.`); });
process.on('SIGINT', () => finish('interrupted'));   // a driver that died mid-program cannot be shown to have ended: void
