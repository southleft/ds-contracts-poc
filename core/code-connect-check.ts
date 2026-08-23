/**
 * CODE CONNECT — receipts for `--target code-connect` / `code-connect-html`
 * (`npm run code-connect:check`, a `maintain` member and a fast-lane gate).
 *
 * Over the first-party contracts/ and the Flowbite eight
 * (examples/tailwind/contracts), this asserts — by name, not by count:
 *
 *   1. every contract with complete anchors (fileKey + nodeId) emits EXACTLY
 *      one file at code-connect/<Name>.figma.tsx, and every contract without
 *      them is REFUSED naming the contract and the missing field — the two
 *      sets partition the corpus (a refusal for an anchored contract, or a
 *      file for an anchorless one, is red);
 *   2. every emitted file is syntactically valid TSX (TypeScript's own
 *      parser, zero diagnostics) and its `figma.connect(<Name>, <url>, {…})`
 *      AST carries: the URL built from THIS contract's anchors; for every
 *      VARIANT enum prop a `figma.enum('<Property>', {…})` whose keys are
 *      the display names (`bindings.figma.values[v] ?? v`) and whose values
 *      are the canonical enum values, in contract order; every BOOLEAN prop a
 *      `figma.boolean('<Property>')`; every TEXT text prop a
 *      `figma.string('<Property>')`; every slot a `figma.slot('<Property>')`
 *      (the generator writes NATIVE slot properties — see DESIGN.md for why
 *      not figma.children/figma.instance); `children` rendered as the JSX
 *      child, every other mapping as an attribute; and every event, number
 *      prop and kind-NONE prop NAMED in the header as not mapped;
 *   3. the Flowbite eight as committed carry their live demo-file identity
 *      (bindings.figma.anchors = { fileKey 59mLQlOMiD5w5za6SUcoO5, nodeId,
 *      componentSetKey }, written 2026-08-23 — docs/23 §D.30), so all eight
 *      EMIT with the URL built from those anchors; the same eight with the
 *      fileKey stripped (the pre-anchor committed shape) all refuse by name;
 *      and given a FIXTURE anchor (named as such, never written anywhere) all
 *      eight emit and the same AST assertions hold — Color's display names
 *      (Info/Failure/…), Icon/Dismissable booleans, Content → children,
 *      ToggleSwitch's events named;
 *   4. byte-determinism: the pure emitter twice, and the CLI
 *      (`generate … --target code-connect`) into two directories, hash
 *      equal; the CLI refuses an anchorless contract by name with exit 1;
 *   5. the anchor accessor reads ONLY `bindings.figma.anchors` (schema 17);
 *      the v16 `anchors.figma` spelling is ignored and an absent block is
 *      refused by name;
 *   6. the HTML flavour: valid TS, tag equal to the web-components emitter's
 *      own tagOf() (so the side-effect import names the element the WC
 *      target writes), booleans as `?attr=`, attributes kebab-cased;
 *   7. `@figma/code-connect` is NOT in the lockfile, so its `parse` cannot
 *      run offline — this check says so by name and validates the AST with
 *      TypeScript instead; if the package IS resolvable, `figma connect
 *      parse` runs over the React output and must exit 0.
 *
 * Node script (spawns the CLI, writes to a temp dir) over pure functions.
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { ContractSchema, slotFigmaProperty, slotsOf, type Contract } from '../scripts/contract-schema.js';
import { tagOf } from '../packages/emitter-web-components/src/emit-wc.js';
import { emitterByName } from './emitter.js';
import {
  codeConnectEmitter,
  codeConnectHtmlEmitter,
  codeConnectTagOf,
  emitCodeConnectReact,
  figmaAnchorsOf,
} from './emit-code-connect.js';

const ROOT = process.cwd();
const failures: string[] = [];
const check = (label: string, condition: boolean): void => {
  if (!condition) failures.push(label);
  console.log(`  ${condition ? '✔' : '✖'} ${label}`);
};
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const loadDir = (dir: string): Contract[] =>
  readdirSync(path.join(ROOT, dir))
    .filter((f) => f.endsWith('.contract.json'))
    .sort()
    .map((f) => ContractSchema.parse(JSON.parse(readFileSync(path.join(ROOT, dir, f), 'utf8'))));

const firstParty = loadDir('contracts');
const flowbite = loadDir('examples/tailwind/contracts');
check('corpus: first-party contracts/ loaded (≥ 50)', firstParty.length >= 50);
check('corpus: the Flowbite eight loaded', flowbite.length === 8);

// ---------------------------------------------------------------------------
// AST reader — what the emitted file SAYS, read back through TypeScript.
// ---------------------------------------------------------------------------

interface ReadMapping {
  codeProp: string;
  helper: string;
  figmaProperty: string;
  enumPairs?: Array<[string, string | boolean]>;
}
interface ReadConnect {
  diagnostics: string[];
  component: string | null;
  url: string | null;
  props: ReadMapping[];
  jsxAttributes: string[];
  jsxChildren: string[];
  header: string;
}

const propName = (n: ts.PropertyName): string =>
  ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) ? n.text : n.getText();

function readConnect(text: string, fileName: string): ReadConnect {
  const tsx = fileName.endsWith('.tsx');
  const transpiled = ts.transpileModule(text, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  const diagnostics = (transpiled.diagnostics ?? []).map((d) =>
    typeof d.messageText === 'string' ? d.messageText : d.messageText.messageText,
  );
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: ReadConnect = {
    diagnostics,
    component: null,
    url: null,
    props: [],
    jsxAttributes: [],
    jsxChildren: [],
    header: text.startsWith('/**') ? text.slice(0, text.indexOf('*/') + 2) : '',
  };
  const readHelper = (init: ts.Expression): ReadMapping | null => {
    if (!ts.isCallExpression(init) || !ts.isPropertyAccessExpression(init.expression)) return null;
    if (init.expression.expression.getText() !== 'figma') return null;
    const helper = init.expression.name.text;
    const first = init.arguments[0];
    const figmaProperty = first && ts.isStringLiteral(first) ? first.text : '';
    const m: ReadMapping = { codeProp: '', helper, figmaProperty };
    const second = init.arguments[1];
    if (helper === 'enum' && second && ts.isObjectLiteralExpression(second)) {
      m.enumPairs = second.properties.flatMap((p) => {
        if (!ts.isPropertyAssignment(p)) return [];
        const v = p.initializer;
        const value =
          ts.isStringLiteral(v) ? v.text
          : v.kind === ts.SyntaxKind.TrueKeyword ? true
          : v.kind === ts.SyntaxKind.FalseKeyword ? false
          : v.getText();
        return [[propName(p.name), value] as [string, string | boolean]];
      });
    }
    return m;
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.getText() === 'figma.connect'
    ) {
      const args = node.arguments;
      const urlArg = tsx ? args[1] : args[0];
      const optArg = tsx ? args[2] : args[1];
      if (tsx && args[0] && ts.isIdentifier(args[0])) out.component = args[0].text;
      if (urlArg && ts.isStringLiteral(urlArg)) out.url = urlArg.text;
      if (optArg && ts.isObjectLiteralExpression(optArg)) {
        for (const p of optArg.properties) {
          if (!ts.isPropertyAssignment(p)) continue;
          if (propName(p.name) === 'props' && ts.isObjectLiteralExpression(p.initializer)) {
            for (const pp of p.initializer.properties) {
              if (!ts.isPropertyAssignment(pp)) continue;
              const m = readHelper(pp.initializer);
              if (m) out.props.push({ ...m, codeProp: propName(pp.name) });
            }
          }
          if (propName(p.name) === 'example' && ts.isArrowFunction(p.initializer)) {
            const walk = (n: ts.Node): void => {
              if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
                for (const a of n.attributes.properties) {
                  if (ts.isJsxAttribute(a)) out.jsxAttributes.push(propName(a.name as ts.PropertyName));
                }
              }
              if (ts.isJsxExpression(n) && n.expression && ts.isPropertyAccessExpression(n.expression)) {
                if (ts.isJsxElement(n.parent)) out.jsxChildren.push(n.expression.name.text);
              }
              ts.forEachChild(n, walk);
            };
            walk(p.initializer.body);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

// ---------------------------------------------------------------------------
// Expected mapping, derived from the contract INDEPENDENTLY of the emitter.
// ---------------------------------------------------------------------------

function assertReactFile(c: Contract, text: string, label: string): void {
  const read = readConnect(text, `${c.name}.figma.tsx`);
  const a = figmaAnchorsOf(c)!;
  const problems: string[] = [];
  if (read.diagnostics.length > 0) problems.push(`TS diagnostics: ${read.diagnostics.join('; ')}`);
  if (read.component !== c.name) problems.push(`figma.connect(${read.component}) — expected ${c.name}`);
  const url = `https://www.figma.com/design/${a.fileKey}?node-id=${a.nodeId}`;
  if (read.url !== url) problems.push(`url ${read.url} — expected ${url}`);
  if (!text.includes(`import { ${c.name} } from '../${c.name}';`)) problems.push('missing generated-component import');
  const byKey = new Map(read.props.map((m) => [m.codeProp, m]));
  const expectedKeys: string[] = [];
  for (const p of c.props) {
    const fig = p.bindings.figma;
    const code = p.bindings.code.prop;
    const m = byKey.get(code);
    const isEnum = typeof p.type === 'object' && 'enum' in p.type;
    if (fig.kind === 'VARIANT' && isEnum) {
      expectedKeys.push(code);
      const want = (p.type as { enum: string[] }).enum.map((v) => [fig.values?.[v] ?? v, v] as [string, string]);
      if (!m || m.helper !== 'enum' || m.figmaProperty !== fig.property) problems.push(`enum prop ${p.name}: expected figma.enum('${fig.property}')`);
      else if (JSON.stringify(m.enumPairs) !== JSON.stringify(want)) problems.push(`enum prop ${p.name}: pairs ${JSON.stringify(m.enumPairs)} ≠ ${JSON.stringify(want)}`);
    } else if (fig.kind === 'VARIANT' && p.type === 'boolean') {
      expectedKeys.push(code);
      const want = [[fig.values?.false ?? 'false', false], [fig.values?.true ?? 'true', true]];
      if (!m || m.helper !== 'enum' || JSON.stringify(m.enumPairs) !== JSON.stringify(want)) problems.push(`variant-bool ${p.name}: expected figma.enum('${fig.property}', ${JSON.stringify(want)})`);
    } else if (fig.kind === 'BOOLEAN') {
      expectedKeys.push(code);
      if (!m || m.helper !== 'boolean' || m.figmaProperty !== fig.property) problems.push(`boolean prop ${p.name}: expected figma.boolean('${fig.property}')`);
    } else if (fig.kind === 'TEXT' && p.type !== 'number') {
      expectedKeys.push(code);
      if (!m || m.helper !== 'string' || m.figmaProperty !== fig.property) problems.push(`text prop ${p.name}: expected figma.string('${fig.property}')`);
    } else if (fig.kind === 'INSTANCE_SWAP') {
      expectedKeys.push(code);
      if (!m || m.helper !== 'instance' || m.figmaProperty !== fig.property) problems.push(`instance prop ${p.name}: expected figma.instance('${fig.property}')`);
    } else {
      // number-as-TEXT, kind NONE — must be NAMED in the header, never mapped.
      if (m) problems.push(`prop ${p.name} (${fig.kind}) must not be mapped`);
      if (!read.header.includes(`prop "${p.name}"`)) problems.push(`prop ${p.name} (${fig.kind}) not named in the header as unmapped`);
    }
  }
  for (const { slot } of slotsOf(c)) {
    expectedKeys.push(slot.name);
    const m = byKey.get(slot.name);
    const want = slotFigmaProperty(slot);
    if (!m || m.helper !== 'slot' || m.figmaProperty !== want) problems.push(`slot ${slot.name}: expected figma.slot('${want}')`);
  }
  const extra = [...byKey.keys()].filter((k) => !expectedKeys.includes(k));
  if (extra.length > 0) problems.push(`unexpected props mapped: ${extra.join(', ')}`);
  for (const k of expectedKeys) {
    if (k === 'children') {
      if (!read.jsxChildren.includes('children')) problems.push('children not rendered as the JSX child');
    } else if (!read.jsxAttributes.includes(k)) problems.push(`${k} not rendered as a JSX attribute`);
  }
  for (const e of c.events ?? []) {
    if (!read.header.includes(`event "${e.name}" → ${e.bindings.code.prop}`)) problems.push(`event ${e.name} not named in the header`);
  }
  if (c.bindings.figma.statePreviews && !read.header.includes('variant axis "State"')) problems.push('bindings.figma.statePreviews not named in the header');
  check(`${label}: ${c.id} → code-connect/${c.name}.figma.tsx maps every fact or names it${problems.length ? ` — ${problems.join('; ')}` : ''}`, problems.length === 0);
}

const hasAnchors = (c: Contract): boolean => {
  const a = figmaAnchorsOf(c);
  return Boolean(a && a.fileKey && a.nodeId);
};

// ---------------------------------------------------------------------------
// 1 + 2. First-party: partition by anchors; emit or refuse by name.
// ---------------------------------------------------------------------------

console.log('\nFirst-party contracts/ — React flavour');
const emitter = emitterByName.get('code-connect');
check('registry: "code-connect" is registered through @ds-contracts/core registerEmitter (same object as the module export)', emitter === codeConnectEmitter);
check('registry: "code-connect-html" is registered', emitterByName.get('code-connect-html') === codeConnectHtmlEmitter);
const ctx = { tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: {} }, icons: new Map<string, string>(), contracts: new Map(firstParty.map((c) => [c.id, c])) };
const anchored = firstParty.filter(hasAnchors);
const anchorless = firstParty.filter((c) => !hasAnchors(c));
check(`partition: ${anchored.length} anchored + ${anchorless.length} anchorless = ${firstParty.length} (both sets non-empty)`, anchored.length + anchorless.length === firstParty.length && anchored.length > 0 && anchorless.length > 0);
const emitted = new Map<string, string>();
for (const c of anchored) {
  let files: { path: string; contents: string }[] = [];
  let err = '';
  try {
    files = codeConnectEmitter.emit(c, ctx);
  } catch (e) {
    err = String(e instanceof Error ? e.message : e);
  }
  const ok = !err && files.length === 1 && files[0]!.path === `code-connect/${c.name}.figma.tsx`;
  if (!ok) check(`${c.id}: exactly one file at code-connect/${c.name}.figma.tsx${err ? ` — ${err}` : ''}`, false);
  else {
    emitted.set(c.id, files[0]!.contents);
    assertReactFile(c, files[0]!.contents, 'first-party');
  }
}
for (const c of anchorless) {
  let msg = '';
  try {
    codeConnectEmitter.emit(c, ctx);
  } catch (e) {
    msg = String(e instanceof Error ? e.message : e);
  }
  const a = figmaAnchorsOf(c);
  const field = !a?.fileKey ? 'bindings.figma.anchors.fileKey' : 'bindings.figma.anchors.nodeId';
  check(`${c.id}: anchorless → REFUSED naming the contract and ${field}`, msg.startsWith(`${c.id}: code-connect refused`) && msg.includes(field) && msg.includes('never invented'));
}

// ---------------------------------------------------------------------------
// 3. The Flowbite eight: emit as committed (live anchors, docs/23 §D.30);
//    refuse with the fileKey stripped; map under a FIXTURE anchor.
// ---------------------------------------------------------------------------

console.log('\nFlowbite eight (examples/tailwind/contracts)');
const DEMO_FILE_KEY = '59mLQlOMiD5w5za6SUcoO5';
for (const c of flowbite) {
  const a = figmaAnchorsOf(c);
  check(`${c.id}: as committed carries the live demo anchor (fileKey ${DEMO_FILE_KEY} + nodeId + componentSetKey)`, a?.fileKey === DEMO_FILE_KEY && typeof a.nodeId === 'string' && /^\d+:\d+$/.test(a.nodeId) && typeof a.componentSetKey === 'string' && a.componentSetKey.length > 0);
  let files: { path: string; contents: string }[] = [];
  let err = '';
  try {
    files = codeConnectEmitter.emit(c, ctx);
  } catch (e) {
    err = String(e instanceof Error ? e.message : e);
  }
  const ok = !err && files.length === 1 && files[0]!.path === `code-connect/${c.name}.figma.tsx`;
  check(`${c.id}: as committed → one file code-connect/${c.name}.figma.tsx with the URL built from the live anchors${err ? ` — ${err}` : ''}`, ok && files[0]!.contents.includes(`https://www.figma.com/design/${DEMO_FILE_KEY}?node-id=${a?.nodeId}`));
  if (ok) assertReactFile(c, files[0]!.contents, 'flowbite (committed)');
  // The pre-anchor committed shape (fileKey null) must still refuse by name —
  // the anchor is the ONLY thing that lets a Code Connect file be written.
  const stripped: Contract = { ...c, bindings: { ...c.bindings, figma: { ...c.bindings.figma, anchors: { ...(a ?? { nodeId: null, componentSetKey: null }), fileKey: null } } } } as Contract;
  let msg = '';
  try {
    codeConnectEmitter.emit(stripped, ctx);
  } catch (e) {
    msg = String(e instanceof Error ? e.message : e);
  }
  check(`${c.id}: fileKey stripped → REFUSED by name`, msg.startsWith(`${c.id}: code-connect refused`) && msg.includes('bindings.figma.anchors.fileKey'));
}
// FIXTURE anchors — exist only in this process so the mapping over the
// eight's props can be asserted; nothing is written back, and the key is
// spelled so it can never be mistaken for a real file.
const withFixture = (c: Contract, i: number): Contract => ({
  ...c,
  bindings: {
    ...c.bindings,
    figma: { ...c.bindings.figma, anchors: { fileKey: 'FIXTURE-NOT-A-FIGMA-FILE', componentSetKey: null, nodeId: `0:${i + 1}` } },
  },
});
const fixtured = flowbite.map(withFixture);
for (const c of fixtured) {
  const files = codeConnectEmitter.emit(c, ctx);
  check(`${c.id}: fixture anchor → one file code-connect/${c.name}.figma.tsx`, files.length === 1 && files[0]!.path === `code-connect/${c.name}.figma.tsx`);
  assertReactFile(c, files[0]!.contents, 'flowbite');
}
{
  const btn = fixtured.find((c) => c.id === 'flowbite.button')!;
  const text = emitCodeConnectReact(btn);
  check(
    'flowbite.button: Color display names spelled as keys (Default/Alternative/Dark/Green/Red → canonical values) and Content → JSX children',
    /figma\.enum\('Color', \{\n\s+Default: 'default',\n\s+Alternative: 'alternative',\n\s+Dark: 'dark',\n\s+Green: 'green',\n\s+Red: 'red',\n\s+\}\)/.test(text) && text.includes('>{props.children}</Button>'),
  );
  const alert = fixtured.find((c) => c.id === 'flowbite.alert')!;
  const at = emitCodeConnectReact(alert);
  check('flowbite.alert: Icon + Dismissable as figma.boolean, event "dismiss" named as unmapped', at.includes("icon: figma.boolean('Icon')") && at.includes("dismissable: figma.boolean('Dismissable')") && at.includes('event "dismiss" → onDismiss'));
  const toggle = fixtured.find((c) => c.id === 'flowbite.toggleswitch')!;
  const tt = emitCodeConnectReact(toggle);
  check('flowbite.toggleswitch: Checked axis as figma.enum (Unchecked/Checked), Label as figma.string, event "toggle" named', /figma\.enum\('Checked', \{\n\s+Unchecked: 'unchecked',\n\s+Checked: 'checked',\n\s+\}\)/.test(tt) && tt.includes("label: figma.string('Label')") && tt.includes('event "toggle" → onToggle'));
}

// ---------------------------------------------------------------------------
// 4. Byte-determinism — pure emitter twice; CLI into two dirs; CLI refusal.
// ---------------------------------------------------------------------------

console.log('\nDeterminism + the CLI door');
check('pure emitter: a second emit over every anchored contract is byte-equal to the first', anchored.every((c) => codeConnectEmitter.emit(c, ctx)[0]!.contents === emitted.get(c.id)));
const tsx = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const cli = (args: string[]) => spawnSync(tsx, ['packages/cli/src/cli.ts', ...args], { cwd: ROOT, encoding: 'utf8' });
const tree = (dir: string): string =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => `${path.relative(dir, path.join(d.parentPath ?? (d as unknown as { path: string }).path, d.name))}:${sha(readFileSync(path.join(d.parentPath ?? (d as unknown as { path: string }).path, d.name), 'utf8'))}`)
    .sort()
    .join('\n');
const tmp = mkdtempSync(path.join(tmpdir(), 'code-connect-check-'));
try {
  // Leaf contracts (no composition refs): a composed contract needs its
  // children in the same run, which is generate's rule, not this target's.
  const subjects = ['contracts/button.contract.json', 'contracts/badge.contract.json'];
  const runs = ['a', 'b'].map((n) => {
    const out = path.join(tmp, n);
    const r = cli(['generate', ...subjects, '--out', out, '--target', 'code-connect', '--tokens', 'tokens', '--icons', 'assets/icons']);
    return { r, out };
  });
  check(`CLI: generate --target code-connect exits 0 for ${subjects.length} anchored contracts${runs[0]!.r.status !== 0 ? ` — ${runs[0]!.r.stderr}` : ''}`, runs.every(({ r }) => r.status === 0));
  const files = runs[0]!.r.status === 0 ? readdirSync(path.join(runs[0]!.out, 'code-connect')).sort() : [];
  check(`CLI: wrote code-connect/<Name>.figma.tsx beside the out dir (${files.join(', ')})`, files.length === subjects.length && files.every((f) => f.endsWith('.figma.tsx')));
  check('CLI: two runs into two directories hash equal (byte-deterministic)', runs[0]!.r.status === 0 && tree(runs[0]!.out) === tree(runs[1]!.out));
  const refused = cli(['generate', 'contracts/bento-grid.contract.json', '--out', path.join(tmp, 'r'), '--target', 'code-connect', '--tokens', 'tokens']);
  check('CLI: an anchorless contract (ds.bento-grid) refuses by name with exit 1', refused.status === 1 && refused.stderr.includes('ds.bento-grid') && refused.stderr.includes('bindings.figma.anchors.fileKey'));

  // 7. The first-party validator, if it is installed; else say so by name.
  let ccBin: string | null = null;
  try {
    const req = createRequire(path.join(ROOT, 'package.json'));
    const pkg = req.resolve('@figma/code-connect/package.json');
    ccBin = path.join(path.dirname(pkg), 'bin', 'figma');
  } catch {
    ccBin = null;
  }
  if (ccBin) {
    const parsed = spawnSync(process.execPath, [ccBin, 'connect', 'parse', '--dir', runs[0]!.out, '--skip-update-check'], { cwd: ROOT, encoding: 'utf8' });
    check(`@figma/code-connect parse over the React output exits 0${parsed.status !== 0 ? ` — ${parsed.stderr || parsed.stdout}` : ''}`, parsed.status === 0);
  } else {
    console.log('  – @figma/code-connect is not in package-lock.json (not installable offline): its `parse` did not run; the AST shape was validated with TypeScript above instead');
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// 5. The anchor accessor reads the schema-17 spelling only.
// ---------------------------------------------------------------------------

console.log('\nAnchor spelling');
{
  const btn = firstParty.find((c) => c.id === 'ds.button')!;
  const v17 = emitCodeConnectReact(btn);
  check('ds.button spelled `bindings.figma.anchors` (schema 17) emits', v17.length > 0 && figmaAnchorsOf(btn)?.fileKey === btn.bindings.figma.anchors.fileKey);
  // The v16 spelling is refused by the validator; the accessor must not read
  // it either — a contract carrying ONLY `anchors.figma` is anchorless here.
  const { bindings, ...rest } = btn;
  const v16only = {
    ...rest,
    anchors: { figma: bindings.figma.anchors, code: bindings.code.anchors },
    bindings: { ...bindings, figma: { ...bindings.figma, anchors: undefined } },
  } as unknown as Contract;
  check('v16 `anchors.figma` alone is NOT read — accessor returns null', figmaAnchorsOf(v16only) === null);
  let msg = '';
  try { emitCodeConnectReact(v16only); } catch (e) { msg = String(e instanceof Error ? e.message : e); }
  check('absent `bindings.figma.anchors` → refused naming the v17 field', msg.startsWith('ds.button: code-connect refused') && msg.includes('bindings.figma.anchors'));
}

// ---------------------------------------------------------------------------
// 6. The HTML flavour for the web-components target.
// ---------------------------------------------------------------------------

console.log('\nHTML flavour (code-connect-html)');
check('tag rule: codeConnectTagOf equals the web-components emitter tagOf for every contract', [...firstParty, ...flowbite].every((c) => codeConnectTagOf(c) === tagOf(c)));
for (const c of [...anchored, ...fixtured]) {
  const [file] = codeConnectHtmlEmitter.emit(c, ctx);
  const read = readConnect(file!.contents, `${tagOf(c)}.figma.ts`);
  const a = figmaAnchorsOf(c)!;
  const problems: string[] = [];
  if (read.diagnostics.length > 0) problems.push(`TS diagnostics: ${read.diagnostics.join('; ')}`);
  if (file!.path !== `code-connect/${tagOf(c)}.figma.ts`) problems.push(`path ${file!.path}`);
  if (read.url !== `https://www.figma.com/design/${a.fileKey}?node-id=${a.nodeId}`) problems.push('url');
  if (!file!.contents.includes(`import '../${tagOf(c)}'`)) problems.push('side-effect import of the custom element');
  if (!file!.contents.includes(`html\`<${tagOf(c)}`)) problems.push('template does not open the custom element');
  const reactRead = readConnect(emitted.get(c.id) ?? emitCodeConnectReact(c), `${c.name}.figma.tsx`);
  if (JSON.stringify(read.props) !== JSON.stringify(reactRead.props)) problems.push('props block differs from the React flavour');
  for (const p of c.props) {
    if (p.bindings.figma.kind === 'BOOLEAN' && !file!.contents.includes(`?${p.bindings.code.prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}=\${props.${p.bindings.code.prop}}`)) problems.push(`boolean ${p.name} not bound as ?attr=`);
  }
  check(`${c.id}: ${tagOf(c)}.figma.ts valid TS, same props as React, element import + template${problems.length ? ` — ${problems.join('; ')}` : ''}`, problems.length === 0);
}

if (failures.length > 0) {
  console.error(`\n✖ code-connect:check — ${failures.length} failure(s):\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`\n✔ code-connect:check — ${anchored.length} first-party + 8 Flowbite contracts mapped (React + HTML), the eight as committed map through their live demo anchors (docs/23 §D.30), ${anchorless.length} anchorless first-party + the eight with fileKey stripped refused by name, byte-deterministic`);
