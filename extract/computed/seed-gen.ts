/**
 * SEED GENERATOR — `npm run seed:gen -- <config.json>`
 *
 * THE SCALE WALL (docs/23 §6b) is that onboarding a design system costs one
 * HAND-AUTHORED seed contract per component: the prop space, its enum values,
 * and a Figma VARIANT display name for every value. Carbon's ten seeds are 654
 * lines. Carbon ships 122 components. Polaris and MUI are larger still. That
 * linear human cost — not the engine, which has already run 1,618 sets in one
 * census — is what keeps every code-side number in this repo a SLICE number
 * and tiers L/XL unreachable.
 *
 * This reads the library's OWN shipped type declarations and proposes the prop
 * space, so the human REVIEWS instead of authors.
 *
 * WHY THIS IS NOT THE THING docs/21 FORBIDS. That rule — "the prop space,
 * never re-derived from the library" — is about CAPTURE: a prop space inferred
 * at capture time makes the captured output depend on library internals rather
 * than a declared contract, and silently admits props that are not
 * design-relevant. That rule stands. This generator runs BEFORE capture and
 * writes a file a human edits and commits; the capture still reads only the
 * committed seed. Generated-then-reviewed and inferred-at-capture are
 * different objects, and only the second one breaks determinism.
 *
 * IT IS MEASURED AGAINST GROUND TRUTH, not asserted: ten Carbon components
 * already have hand-authored seeds, so `--verify` regenerates those and reports
 * exactly where the proposal agrees with the human and where it does not. A
 * generator whose agreement is unmeasured would just move the guessing.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const VERIFY = process.argv.includes('--verify');
const WRITE = process.argv.includes('--write');
const configArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!configArg) {
  console.error('usage: tsx extract/computed/seed-gen.ts <extract/computed/configs/<lib>.json> [--verify] [--write]');
  process.exit(1);
}
const config = JSON.parse(readFileSync(path.join(ROOT, configArg), 'utf8')) as {
  library: { package: string; sandbox?: string };
  components: Array<{ name: string; importName?: string; contract?: string; axes?: string[] }>;
};

// ---------------------------------------------------------------------------
// The type index — every `type X = 'a' | 'b'` and `declare const X: {...}` in
// the package's shipped .d.ts files. Carbon spells enums BOTH ways (ButtonKind
// is a union alias; Tag's SIZES is a const map read as `keyof typeof SIZES`),
// so a generator that understood only one would silently miss half the axes.
// ---------------------------------------------------------------------------

const SANDBOX = path.join(ROOT, path.dirname(configArg).replace(/extract\/computed\/configs$/, ''), '');
const pkgRoots = [
  path.join(ROOT, 'examples', 'carbon', '.carbon-sandbox', 'node_modules', config.library.package),
  path.join(ROOT, 'node_modules', config.library.package),
].filter((p) => existsSync(p));
if (pkgRoots.length === 0) {
  console.error(`REFUSED: no installed copy of ${config.library.package} found — the sandbox is git-ignored; install it first.`);
  process.exit(1);
}
const PKG = pkgRoots[0];

const dts: string[] = [];
const walk = (dir: string): void => {
  for (const e of readdirSync(dir)) {
    const full = path.join(dir, e);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) { if (e !== 'node_modules') walk(full); }
    else if (e.endsWith('.d.ts')) dts.push(full);
  }
};
walk(PKG);

/** alias name → literal union values */
const unions = new Map<string, string[]>();
/** const-map name → its keys */
const constKeys = new Map<string, string[]>();

const LITERALS = /'([^']+)'(?:\s*\|\s*'([^']+)')+/;
for (const f of dts) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/(?:export\s+)?(?:declare\s+)?type\s+(\w+)\s*=\s*([^;]+);/g)) {
    const [, name, body] = m;
    if (!LITERALS.test(body)) continue;
    const values = [...body.matchAll(/'([^']+)'/g)].map((x) => x[1]);
    if (values.length >= 2) unions.set(name, [...new Set(values)]);
  }
  for (const m of text.matchAll(/(?:export\s+)?declare\s+const\s+(\w+):\s*(?:readonly\s*)?\[([^\]]*)\]/g)) {
    const [, name, body] = m;
    const values = [...body.matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
    if (values.length >= 2) unions.set(name, [...new Set(values)]);
  }
  for (const m of text.matchAll(/(?:export\s+)?declare\s+const\s+(\w+):\s*\{([^}]*)\}/g)) {
    const [, name, body] = m;
    const keys = [...body.matchAll(/^\s*'?([\w-]+)'?\??:/gm)].map((x) => x[1]);
    if (keys.length >= 2) constKeys.set(name, [...new Set(keys)]);
  }
}

/** A prop's declared type → its enum values, or null when it is not an enum. */
function resolve(typeExpr: string): string[] | null {
  const t = typeExpr.trim().replace(/;$/, '');
  const direct = [...t.matchAll(/'([^']+)'/g)].map((x) => x[1]);
  if (direct.length >= 2) return [...new Set(direct)];
  const keyof = /^keyof\s+typeof\s+(\w+)$/.exec(t);
  if (keyof && constKeys.has(keyof[1])) return constKeys.get(keyof[1])!;
  const arrIdx = /^\(?typeof\s+(\w+)\)?\[number\]$/.exec(t);
  if (arrIdx && unions.has(arrIdx[1])) return unions.get(arrIdx[1])!;
  // A CONDITIONAL type (Carbon's Button.kind is
  // `… extends true ? IconButtonKind : ButtonKind`) has no single answer, so
  // the proposal is the UNION of every branch it can resolve — a reviewer
  // narrows it. Widening is the safe direction: an extra value is visible in
  // review, a missing one is silently never captured.
  if (t.includes('?') && t.includes(':')) {
    const branches = [...t.matchAll(/\b([A-Z]\w+)\b/g)].map((x) => x[1]).filter((n) => unions.has(n) || constKeys.has(n));
    if (branches.length > 0) {
      const merged = [...new Set(branches.flatMap((n) => unions.get(n) ?? constKeys.get(n) ?? []))];
      if (merged.length >= 2) return merged;
    }
  }
  const alias = /^(\w+)$/.exec(t);
  if (alias) {
    if (unions.has(alias[1])) return unions.get(alias[1])!;
    if (constKeys.has(alias[1])) return constKeys.get(alias[1])!;
  }
  return null;
}

/** The component's own .d.ts, by convention `<Name>/<Name>.d.ts`. */
const declFor = (name: string): string | undefined => {
  const own =
    dts.find((f) => f.endsWith(`${path.sep}${name}${path.sep}${name}.d.ts`)) ??
    dts.find((f) => f.endsWith(`${path.sep}${name}.d.ts`));
  if (own) return own;
  // Carbon declares InlineNotification's props inside Notification.d.ts, so a
  // same-name lookup misses an entire component. Fall back to whichever file
  // declares its props interface.
  const re = new RegExp(`interface\\s+${name}(Base)?Props\\b`);
  return dts.find((f) => re.test(readFileSync(f, 'utf8')));
};

/** Title Case for a Figma VARIANT display name ('cool-gray' → 'Cool Gray'). */
const display = (v: string): string =>
  v.split(/[-_\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

interface Proposed { name: string; values: string[] }

function propsOf(componentName: string): Proposed[] {
  const decl = declFor(componentName);
  if (!decl) return [];
  const text = readFileSync(decl, 'utf8');
  const out: Proposed[] = [];
  // `  name?: <type>;` inside any interface in the component's declaration.
  for (const m of text.matchAll(/^\s{2,}(\w+)\?\?*:\s*([^;\n]+);/gm)) {
    const [, prop, typeExpr] = m;
    if (['className', 'children', 'id', 'ref', 'key', 'style'].includes(prop)) continue;
    const values = resolve(typeExpr);
    if (values && values.length >= 2) out.push({ name: prop, values });
  }
  return out.filter((p, i, a) => a.findIndex((x) => x.name === p.name) === i);
}

// ---------------------------------------------------------------------------
// Verify against the hand-authored seeds — the only honest quality claim
// ---------------------------------------------------------------------------

if (VERIFY) {
  let exact = 0, partial = 0, missed = 0;
  const lines: string[] = [];
  for (const c of config.components) {
    if (!c.contract) continue;
    const seed = JSON.parse(readFileSync(path.join(ROOT, c.contract), 'utf8')) as {
      props?: Array<{ name: string; type?: { enum?: string[] } }>;
    };
    const human = new Map(
      (seed.props ?? []).filter((p) => p.type?.enum).map((p) => [p.name, p.type!.enum!]),
    );
    const gen = new Map(propsOf(c.importName ?? c.name).map((p) => [p.name, p.values]));
    for (const [prop, want] of human) {
      const got = gen.get(prop);
      if (!got) { missed++; lines.push(`  ✖ ${c.name}.${prop} — NOT proposed (human: ${want.join('|')})`); continue; }
      const same = want.length === got.length && want.every((v) => got.includes(v));
      if (same) { exact++; lines.push(`  ✔ ${c.name}.${prop} — ${got.length} values, EXACT match`); }
      else {
        partial++;
        const extra = got.filter((v) => !want.includes(v));
        const absent = want.filter((v) => !got.includes(v));
        lines.push(`  ~ ${c.name}.${prop} — differs${extra.length ? `; proposed-only: ${extra.join('|')}` : ''}${absent.length ? `; human-only: ${absent.join('|')}` : ''}`);
      }
    }
  }
  console.log(lines.join('\n'));
  const total = exact + partial + missed;
  console.log(`\nAGREEMENT vs hand-authored seeds: ${exact}/${total} enum axes reproduced EXACTLY, ${partial} differ, ${missed} not proposed.`);
  console.log(
    'An axis the generator MISSES is one a reviewer must still author by hand; one it gets EXACTLY is authoring the human never has to do again. Both numbers are the honest cost model.',
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Emit proposed seeds — PROPOSED, and the file says so
// ---------------------------------------------------------------------------

const outDir = path.join(ROOT, 'examples', 'carbon', 'contracts-seed-proposed');
if (WRITE) mkdirSync(outDir, { recursive: true });
let written = 0;
for (const c of config.components) {
  const props = propsOf(c.importName ?? c.name);
  if (props.length === 0) continue;
  const seed = {
    $proposed: `GENERATED from ${config.library.package}'s shipped .d.ts by extract/computed/seed-gen.ts — REVIEW before use. The prop space a capture reads must be a committed, human-reviewed file (docs/21 step 4); this is a starting point for that review, never an input to capture.`,
    id: `carbon.${c.name.toLowerCase()}`,
    name: c.name,
    semantics: { element: 'div' },
    props: props.map((p) => ({
      name: p.name,
      type: { enum: p.values },
      bindings: {
        figma: { kind: 'VARIANT', property: display(p.name), values: Object.fromEntries(p.values.map((v) => [v, display(v)])) },
        code: { prop: p.name },
      },
    })),
  };
  if (WRITE) writeFileSync(path.join(outDir, `${c.name.toLowerCase()}.contract.json`), `${JSON.stringify(seed, null, 2)}\n`);
  written++;
  console.log(`  ${c.name}: ${props.length} enum axis/axes — ${props.map((p) => `${p.name}(${p.values.length})`).join(', ')}`);
}
console.log(`\n${written} seed(s) ${WRITE ? `written to ${path.relative(ROOT, outDir)}` : 'proposed (dry run — pass --write)'}.`);
console.log(`Type index: ${unions.size} union alias(es) + ${constKeys.size} const map(s) across ${dts.length} .d.ts files.`);
