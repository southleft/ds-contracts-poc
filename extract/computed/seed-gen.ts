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
 * IT IS MEASURED AGAINST GROUND TRUTH, not asserted: Carbon and MUI both have
 * hand-authored seeds, so `--verify` regenerates those and reports exactly
 * where the proposal agrees with the human and where it does not. A generator
 * whose agreement is unmeasured would just move the guessing.
 *
 * AND IT IS MEASURED ON MORE THAN ONE LIBRARY, because one proved nothing.
 * Tuned on Carbon it scored 11/14 there and **0 of 20** on MUI — a hack fitted
 * to one library's type conventions, which a single-library number would have
 * reported as success. It now reads 11/14 and 15/20 with zero DIFFER on both.
 * Any figure here from a single library should be treated as unvalidated.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { validateContract } from '@ds-contracts/schema';

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

/**
 * Find the installed package for WHATEVER library the config names. The first
 * version of this hardcoded Carbon's sandbox path, which meant the tool could
 * only ever be run against the library it was written for — and a generator
 * measured on exactly one library is indistinguishable from a hack fitted to
 * that library's type conventions.
 */
const sandboxes = readdirSync(path.join(ROOT, 'examples'))
  .flatMap((ex) => {
    const dir = path.join(ROOT, 'examples', ex);
    try {
      return readdirSync(dir)
        .filter((d) => d.startsWith('.') && d.endsWith('-sandbox'))
        .map((d) => path.join(dir, d, 'node_modules', config.library.package));
    } catch { return []; }
  });
const pkgRoots = [...sandboxes, path.join(ROOT, 'node_modules', config.library.package)].filter((p) => existsSync(p));
if (pkgRoots.length === 0) {
  console.error(`REFUSED: no installed copy of ${config.library.package} found — the sandboxes are git-ignored; install it first.`);
  process.exit(1);
}
const PKG = pkgRoots[0];
/** `@carbon/react` → `carbon`, `@mui/material` → `mui`, `polaris` → `polaris`. */
const LIB = config.library.package.replace(/^@/, '').split('/')[0];

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

/**
 * A DESIGN SYSTEM IS OFTEN SPLIT ACROSS SIBLING PACKAGES, and the type index
 * has to follow it there. MUI declares `Dialog.maxWidth` as `Breakpoint`, and
 * `Breakpoint` lives in `@mui/system` — a different package from
 * `@mui/material`. Walking only the named package left that alias unresolvable
 * and the axis silently unproposed. Index the whole npm scope.
 */
const scope = /^@[^/]+/.exec(config.library.package)?.[0];
const indexedPkgs = [path.relative(ROOT, PKG)];
if (scope) {
  const scopeDir = path.join(PKG, '..');
  for (const sib of readdirSync(scopeDir)) {
    const full = path.join(scopeDir, sib);
    if (full === PKG) continue;
    // `@mui/icons-material` alone ships ~10k declarations and contributes no
    // component enum; skipping it is a stated exclusion, not a silent cap.
    if (/icons?/.test(sib)) { indexedPkgs.push(`${scope}/${sib} (SKIPPED — icon package)`); continue; }
    try { if (statSync(full).isDirectory()) { walk(full); indexedPkgs.push(path.relative(ROOT, full)); } } catch { /* not a package */ }
  }
}

/** alias name → literal union values */
const unions = new Map<string, string[]>();
/** const-map name → its keys */
const constKeys = new Map<string, string[]>();
/**
 * alias name → its RAW body, for aliases that do not spell literals themselves.
 * Carbon never writes `type ButtonKind = 'primary' | …`; it writes a const array
 * and then `type ButtonKind = (typeof ButtonKinds)[number]`. Indexing only the
 * aliases that contain quotes made every such axis invisible — the values were
 * two lines above the alias, fully readable, and simply never looked at.
 */
const aliasBody = new Map<string, string>();
/** `InterfaceName.propName` → its declared type, for indexed access. */
const ifaceProps = new Map<string, string>();

const LITERALS = /'([^']+)'(?:\s*\|\s*'([^']+)')+/;
for (const f of dts) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/(?:export\s+)?(?:declare\s+)?type\s+(\w+)\s*=\s*([^;]+);/g)) {
    const [, name, body] = m;
    if (!aliasBody.has(name)) aliasBody.set(name, body.trim());
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
  // INTERFACE MEMBERS, for indexed access. MUI writes
  // `checked?: SwitchBaseProps['checked']`, and without this the resolver
  // cannot see that it lands on a `boolean` — so the miss got filed as a
  // resolver gap when it is really a human modelling decision. A classifier
  // that misreads WHY it failed overstates its own ceiling.
  let current: string | null = null;
  for (const line of text.split('\n')) {
    const open = /^\s*(?:export\s+)?(?:declare\s+)?interface\s+(\w+)/.exec(line);
    if (open) { current = open[1]; continue; }
    if (/^\}/.test(line)) { current = null; continue; }
    if (!current) continue;
    const prop = /^\s{2,}(\w+)\??:\s*([^;\n]+);/.exec(line);
    if (prop) ifaceProps.set(`${current}.${prop[1]}`, prop[2].trim());
  }
}

/**
 * Split a type expression on its TOP-LEVEL `|` only. A naive split tears
 * `Extract<A | B, C>` in half and resolves neither side.
 */
function splitUnion(t: string): string[] {
  const parts: string[] = [];
  let depth = 0, quote = '', start = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === '<' || c === '(' || c === '[' || c === '{') depth++;
    else if (c === '>' || c === ')' || c === ']' || c === '}') depth--;
    else if (c === '|' && depth === 0) { parts.push(t.slice(start, i)); start = i + 1; }
  }
  parts.push(t.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** The two arguments of a single generic, split on its top-level comma. */
function genericArgs(inner: string): string[] {
  let depth = 0, start = 0;
  const out: string[] = [];
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '<' || c === '(' || c === '[' || c === '{') depth++;
    else if (c === '>' || c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) { out.push(inner.slice(start, i)); start = i + 1; }
  }
  out.push(inner.slice(start));
  return out.map((s) => s.trim());
}

/**
 * Strip a paren that wraps the WHOLE expression. A greedy `^\(.*\)$` turns
 * `(A) | (B)` into `A) | (B`, so the depth must actually return to zero only
 * at the final character.
 */
function stripWrappingParens(t: string): string {
  let s = t.trim();
  while (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0, wraps = true;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') { depth--; if (depth === 0 && i < s.length - 1) { wraps = false; break; } }
    }
    if (!wraps || depth !== 0) return s;
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * A prop's declared type → its enum values, or null when it is not an enum.
 *
 * `seen` breaks alias cycles; without it a self-referential declaration in some
 * future library would hang the generator rather than decline the axis.
 */
function resolve(typeExpr: string, seen: Set<string> = new Set()): string[] | null {
  let t = stripWrappingParens(typeExpr.trim().replace(/;$/, ''));

  // A TRAILING `| undefined` IS NOT PART OF THE ENUM. MUI writes
  // `'secondary' | 'primary' | 'inherit' | undefined`; my own tightening —
  // "decline unless EVERY arm is a literal" — then refused a plain three-value
  // union. Strip the nullish arms once, here, instead of at each arm site.
  const live = splitUnion(t).filter((a) => !/^(undefined|null|never)$/.test(a));
  if (live.length === 0) return null;
  if (live.length < splitUnion(t).length) t = live.length === 1 ? stripWrappingParens(live[0]) : live.join(' | ');

  // `OverridableStringUnion<'a' | 'b', XPropsColorOverrides>` is MUI's idiom
  // for nearly every enum it ships, and the reason a Carbon-tuned resolver
  // scored 0/20 against it. The second parameter is an open augmentation
  // interface a consumer may extend; the enum the LIBRARY ships is the first.
  const overridable = /^Overridable(?:StringUnion|Component)<([\s\S]+)>$/.exec(t);
  if (overridable) return resolve(genericArgs(overridable[1])[0], seen);

  // Indexed access — `SwitchBaseProps['checked']`.
  const indexed = /^(\w+)\[\s*'([^']+)'\s*\]$/.exec(t);
  if (indexed) {
    const key = `${indexed[1]}.${indexed[2]}`;
    const body = ifaceProps.get(key);
    if (body === undefined || seen.has(key)) return null;
    return resolve(body, new Set([...seen, key]));
  }

  // A BOOLEAN SENTINEL IS NOT AN ENUM MEMBER. MUI's `Breakpoint | false` uses
  // `false` to mean "no maximum width" — an escape hatch, not a design
  // variant, and "False" is not a Figma VARIANT value anyone wants. Strip
  // `true`/`false` arms only when something else in the union survives.
  // HEURISTIC, and labelled as one: the evidence is a single human decision
  // (Dialog.maxWidth, where the human kept exactly the five breakpoints).
  const nonSentinel = splitUnion(t).filter((a) => !/^(true|false)$/.test(a));
  if (nonSentinel.length >= 1 && nonSentinel.length < splitUnion(t).length) {
    return resolve(nonSentinel.length === 1 ? nonSentinel[0] : nonSentinel.join(' | '), seen);
  }

  // Extract<A, B> / Exclude<A, B> — explicit, because the LOOSE literal scan
  // below gets Extract right by luck and Exclude exactly backwards: it would
  // return the values being REMOVED as though they were the enum.
  const setOp = /^(Extract|Exclude|NonNullable)<([\s\S]+)>$/.exec(t);
  if (setOp) {
    const [, op, inner] = setOp;
    const args = genericArgs(inner);
    const base = resolve(args[0], seen);
    if (!base) return null;
    if (op === 'NonNullable') return base.length >= 2 ? base : null;
    const other = args[1] !== undefined ? resolve(args[1], seen) : null;
    if (!other) return null;
    const out = op === 'Extract' ? base.filter((v) => other.includes(v)) : base.filter((v) => !other.includes(v));
    return out.length >= 2 ? out : null;
  }

  // A CONDITIONAL type (Carbon's Button.kind is
  // `… extends true ? IconButtonKind : ButtonKind`) has no single answer, so
  // the proposal is the UNION of every branch it can resolve — a reviewer
  // narrows it. Widening is the safe direction: an extra value is visible in
  // review, a missing one is silently never captured.
  const cond = /\bextends\b[\s\S]+\?[\s\S]+:/.test(t);
  if (cond) {
    const branches = [...t.matchAll(/\b([A-Z]\w+)\b/g)]
      .map((x) => x[1])
      .filter((n) => !seen.has(n) && (unions.has(n) || constKeys.has(n) || aliasBody.has(n)));
    // Recurse with `seen` UNCHANGED — the alias arm below is what marks a name
    // visited. Adding it here instead made every branch refuse itself on entry.
    const merged = [...new Set(branches.flatMap((n) => resolve(n, seen) ?? []))];
    if (merged.length >= 2) return merged;
    return null;
  }

  // A union of ALIASES (`type X = A | B`) — resolve every arm or decline the
  // whole thing; a partly-resolved union is a silently truncated enum.
  const arms = splitUnion(t);
  if (arms.length >= 2 && arms.some((a) => /^[A-Z]\w*$/.test(a))) {
    const resolved = arms.map((a) => (/^(null|undefined)$/.test(a) ? [] : resolve(a, seen)));
    if (resolved.every((r) => r !== null)) {
      const merged = [...new Set(resolved.flat() as string[])];
      if (merged.length >= 2) return merged;
    }
    return null;
  }

  const direct = [...t.matchAll(/'([^']+)'/g)].map((x) => x[1]);
  if (direct.length >= 2 && arms.every((a) => /^'[^']*'$/.test(a))) return [...new Set(direct)];

  const keyof = /^keyof\s+typeof\s+(\w+)$/.exec(t);
  if (keyof && constKeys.has(keyof[1])) return constKeys.get(keyof[1])!;

  const arrIdx = /^\(?typeof\s+(\w+)\)?\[number\]$/.exec(t);
  if (arrIdx && unions.has(arrIdx[1])) return unions.get(arrIdx[1])!;

  const alias = /^(\w+)$/.exec(t);
  if (alias) {
    const name = alias[1];
    if (unions.has(name)) return unions.get(name)!;
    if (constKeys.has(name)) return constKeys.get(name)!;
    // THE MECHANICAL UNLOCK: follow an alias whose body spells no literals of
    // its own. `ButtonKind` → `(typeof ButtonKinds)[number]` → the const array.
    const body = aliasBody.get(name);
    if (body !== undefined && !seen.has(name)) return resolve(body, new Set([...seen, name]));
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

/**
 * The full seed ENVELOPE, not just the props. My first pass emitted `id`,
 * `name`, `semantics` and `props` and stopped — which agreed with the human on
 * every value and would not have parsed, because a contract also carries
 * `$schema`, `version`, `status`, `anatomy`, `anchors` and `states`. Agreement
 * on values and a file the pipeline can read are two different claims.
 *
 * `anatomy` is deliberately `{ root: {} }`: parts are PROMOTED from captured
 * DOM truth (docs/21), never guessed from a type declaration. `states` is empty
 * for the same reason. This tool proposes the enum half of a seed and says so.
 */
function buildSeed(name: string, props: Proposed[]): Record<string, unknown> {
  return {
    $schema: './contract.schema.json',
    id: `${LIB}.${name.toLowerCase()}`,
    name,
    version: '0.1.0',
    status: 'draft',
    description:
      `PROPOSED seed — generated from ${config.library.package}'s shipped .d.ts by extract/computed/seed-gen.ts. ` +
      'REVIEW BEFORE USE: the enum axes below are read from the library\'s type declarations, which is not the same as the axes a designer wants on the canvas. ' +
      'Prune what does not belong, and add any axis a human models out of booleans — the generator is silent there ON PURPOSE (see `--verify`). ' +
      'Anatomy is left empty because parts are promoted from captured DOM truth, never inferred from types (docs/21 step 4).',
    semantics: { element: 'div' },
    anatomy: { root: {} },
    anchors: {
      figma: { fileKey: null, componentSetKey: null },
      code: { importPath: config.library.package, export: name },
    },
    states: [],
    props: props.map((p) => ({
      name: p.name,
      type: { enum: p.values },
      bindings: {
        figma: {
          kind: 'VARIANT',
          property: display(p.name),
          values: Object.fromEntries(p.values.map((v) => [v, display(v)])),
        },
        code: { prop: p.name },
      },
    })),
  };
}

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

/**
 * For a MISSED axis, the library's own declared type for that prop name — the
 * difference between a resolver gap and a modelling decision.
 *
 * A miss is MECHANICAL when the library declares something enum-shaped and the
 * resolver could not read it; that is a bug with an address. A miss is
 * JUDGMENT when the library declares a `boolean`, or declares no prop by that
 * name at all, and a human chose to model it as a variant axis anyway
 * (Carbon's `lowContrast?: boolean` became a `contrast: high|low` axis —
 * renamed AND polarity-inverted). No amount of resolver work reaches those,
 * and a generator that produced them would be inventing the design space.
 */
function declaredType(componentName: string, prop: string): string | null {
  const decl = declFor(componentName);
  if (!decl) return null;
  const text = readFileSync(decl, 'utf8');
  const m = new RegExp(`^\\s{2,}${prop}\\?\\??:\\s*([^;\\n]+);`, 'm').exec(text);
  return m ? m[1].trim() : null;
}

/**
 * Is a missed axis a modelling decision rather than a resolver gap?
 *
 * This has to see THROUGH the declaration's surface form or it overstates the
 * ceiling. MUI declares `expanded?: boolean | undefined` and
 * `checked?: SwitchBaseProps['checked']`; both land on `boolean`, both were
 * filed as resolver gaps by a bare `/^boolean$/` test, and both are really a
 * human naming two states. Follow indexed access and strip nullish first.
 */
function landsOnBoolean(decl: string, depth = 0): boolean {
  if (depth > 4) return false;
  const live = splitUnion(decl).filter((a) => !/^(undefined|null)$/.test(a));
  if (live.length !== 1) return false;
  const one = stripWrappingParens(live[0]);
  if (/^boolean$/.test(one)) return true;
  const indexed = /^(\w+)\[\s*'([^']+)'\s*\]$/.exec(one);
  if (indexed) {
    const body = ifaceProps.get(`${indexed[1]}.${indexed[2]}`);
    return body !== undefined && landsOnBoolean(body, depth + 1);
  }
  const body = aliasBody.get(one);
  return body !== undefined && landsOnBoolean(body, depth + 1);
}

if (VERIFY) {
  let exact = 0, partial = 0, missed = 0, judgment = 0;
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
      if (!got) {
        missed++;
        const decl = declaredType(c.importName ?? c.name, prop);
        const isJudgment = decl === null || landsOnBoolean(decl);
        if (isJudgment) judgment++;
        const why = isJudgment
          ? decl === null
            ? 'JUDGMENT — the library declares NO prop by this name; a human modelled the axis'
            : `JUDGMENT — the library declares \`${decl}\`, which lands on a boolean; a human named the states`
          : `MECHANICAL — the library declares \`${decl}\` and the resolver could not read it`;
        lines.push(`  ✖ ${c.name}.${prop} — NOT proposed (human: ${want.join('|')}) — ${why}`);
        continue;
      }
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
  // THE OTHER HALF OF AGREEMENT, and the one it is easy not to ask. The loop
  // above walks the HUMAN's axes and asks whether the generator found them.
  // It never asks the reverse: how many axes does the generator propose that
  // the human, holding the same declarations, deliberately LEFT OUT? Those are
  // not wrong — `align` really is a 20-value union in Carbon's types — but
  // every one is review the human still pays, and a "0 differ" headline that
  // omits them overstates the tool.
  let surplus = 0;
  const surplusLines: string[] = [];
  for (const c of config.components) {
    if (!c.contract) continue;
    const seed = JSON.parse(readFileSync(path.join(ROOT, c.contract), 'utf8')) as {
      props?: Array<{ name: string }>;
    };
    const humanProps = new Set((seed.props ?? []).map((p) => p.name));
    for (const p of propsOf(c.importName ?? c.name)) {
      if (humanProps.has(p.name)) continue;
      surplus++;
      surplusLines.push(`  + ${c.name}.${p.name} (${p.values.length} values) — proposed, human omitted`);
    }
  }
  if (surplusLines.length > 0) console.log(`\nPROPOSED BUT NOT IN THE HUMAN SEED:\n${surplusLines.join('\n')}`);

  const mechanical = missed - judgment;
  console.log(`\nAGREEMENT vs hand-authored seeds: ${exact}/${total} enum axes reproduced EXACTLY, ${partial} differ, ${missed} not proposed.`);
  console.log(
    `Of the ${missed} not proposed, ${judgment} are JUDGMENT (unreachable by construction) and ${mechanical} are MECHANICAL resolver gaps.`,
  );
  console.log(
    `The honest ceiling is therefore ${exact + mechanical}/${total}, not ${total}/${total}: part of a seed is design modelling — Carbon declares \`lowContrast?: boolean\` and a human turned it into a \`contrast: high|low\` axis, renamed and polarity-inverted. A generator that produced THAT would be inventing the design space, not reading it.`,
  );
  console.log(
    `${partial === 0 ? 'ZERO axes DIFFER' : `${partial} axes DIFFER`} — the load-bearing number. A proposal a reviewer must fact-check is worth less than no proposal at all; silence where it cannot resolve is what makes the output reviewable.`,
  );
  console.log(
    `THE REVIEW IS NOT FREE: ${surplus} further axes are proposed that the human seed omits. They are read correctly from the declarations and are still work — the reviewer PRUNES ${surplus} and AUTHORS ${judgment}, instead of authoring all ${exact + surplus + judgment}.`,
  );

  // THE PRUNE RATE, measured rather than estimated. These ten seeds record what
  // a human actually DID with each proposable axis — kept it or left it out —
  // so the ratio is observed behaviour, not my guess about what a reviewer
  // would want. The sample is ten components; it is quoted with that
  // denominator attached and should not be reported without it.
  const proposed = exact + surplus;
  const n = config.components.filter((c) => c.contract).length;
  console.log(
    proposed === 0
      ? `\nPRUNE RATE: UNDEFINED — the generator proposed NOTHING for these ${n} components, so there is no rate to report. That is a resolver failure, not a 0% prune.`
      : `\nPRUNE RATE (n=${n} components, the only ones with a human decision on record): of ${proposed} axes proposed, a human KEPT ${exact} and DROPPED ${surplus} — ${Math.round((surplus / proposed) * 100)}%. Authoring still required: ${judgment} axes over ${n} components, ${(judgment / n).toFixed(1)} per component.`,
  );
  process.exit(partial === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
// `--all` — the SCALE figure. The config names ten components; the package
// ships 122. Agreement on ten says the generator is trustworthy; only a sweep
// of all 122 says whether it moves the intake cost enough to matter.
// ---------------------------------------------------------------------------

if (process.argv.includes('--all')) {
  // WHERE a package keeps its components is a per-library fact, and a list of
  // known layouts is a list that is always one library out of date: Carbon
  // uses `es/components`, MUI the package root, Polaris
  // `build/esm/components`, flowbite-react `dist/components`. DISCOVER it
  // instead — the components directory is the one with the most children
  // following the `<Name>/<Name>.d.ts` convention.
  const byParent = new Map<string, number>();
  for (const f of dts) {
    const base = path.basename(f, '.d.ts');
    const own = path.dirname(f);
    if (path.basename(own) !== base) continue;
    const parent = path.dirname(own);
    byParent.set(parent, (byParent.get(parent) ?? 0) + 1);
  }
  const best = [...byParent.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] < 3) {
    console.error(
      `REFUSED: no component directory found under ${path.relative(ROOT, PKG)} — no directory holds 3+ declarations following the <Name>/<Name>.d.ts convention. ` +
        'A sweep that reported 0 here would look identical to a library with no components, so it refuses instead. ' +
        'A library that ships no per-component type declarations (web components, for instance) is genuinely out of scope for this tool.',
    );
    process.exit(1);
  }
  const dir = best[0];
  console.log(`Sweeping ${path.relative(ROOT, dir)} (${best[1]} component declarations)\n`);
  const names = readdirSync(dir).filter((n) => {
    try { return /^[A-Z]/.test(n) && statSync(path.join(dir, n)).isDirectory(); } catch { return false; }
  }).sort();
  let withAxes = 0, axes = 0, noDecl = 0, noAxes = 0;
  const rows: string[] = [];
  const rejected: string[] = [];
  for (const name of names) {
    if (!declFor(name)) { noDecl++; continue; }
    const props = propsOf(name);
    if (props.length === 0) { noAxes++; continue; }
    withAxes++;
    axes += props.length;
    // Every proposal in the sweep goes through the real referee too. Nine
    // hand-picked components passing says little; 61 arbitrary ones, with
    // props Carbon calls `dir`, `default`, `min` and `max`, is the test.
    const verdict = validateContract(buildSeed(name, props));
    if (!verdict.ok) rejected.push(`  ${name}: ${verdict.errors.join('; ')}`);
    rows.push(`  ${verdict.ok ? '✔' : '✖'} ${name.padEnd(26)} ${props.map((p) => `${p.name}(${p.values.length})`).join(', ')}`);
  }
  console.log(rows.join('\n'));
  if (rejected.length > 0) console.log(`\n${rejected.length} of ${withAxes} proposal(s) FAIL the contract referee:\n${rejected.join('\n')}`);
  else if (withAxes > 0) console.log(`\nAll ${withAxes} proposals pass validateContract — the same referee the pipeline runs.`);
  // "All 0 proposals pass" is a vacuous truth that READS LIKE SUCCESS. A sweep
  // that finds nothing across a whole library is the loudest result this tool
  // can produce and must not be reported in the same voice as a clean pass.
  else {
    console.log(
      `\n✖ ZERO axes read across ${names.length} components — the resolver does not understand this library's declaration idiom at all.\n` +
        '  This is a REFUSAL, not a clean sweep. Known unsupported idioms:\n' +
        '   - flowbite-react: props live in a type alias over `PolymorphicComponentPropWithRef`, and each "enum" is an INTERFACE carrying `[key: string]: string` — the types say any string is valid, so proposing a closed enum would assert something the library explicitly denies.\n' +
        '   - Lit web components (altitude): props are class `accessor` fields, not interface members; there is no props interface to read.\n' +
        '  Add the idiom or leave the library to hand-authoring — but do not read this as coverage.',
    );
  }
  console.log(`\nSWEEP of ${names.length} shipped components:`);
  console.log(`  ${withAxes} have at least one enum axis the generator can read — ${axes} axes total, proposed rather than authored.`);
  console.log(`  ${noAxes} declare no readable enum axis (many genuinely have none — a Layer or a Grid has no variant plane).`);
  console.log(`  ${noDecl} have no locatable props declaration; those are UNTOUCHED by this tool and still cost a full hand-author.`);
  console.log(
    `\nWhat this does NOT buy: the axes above are the ENUM half of a seed. Every component still needs its parts, its semantics, and — per the ${'`'}--verify${'`'} run — any axis a human models from booleans. The claim is a shorter review, not an eliminated one.`,
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Emit proposed seeds — PROPOSED, and the file says so
// ---------------------------------------------------------------------------

const outDir = path.join(ROOT, 'examples', LIB, 'contracts-seed-proposed');
if (WRITE) mkdirSync(outDir, { recursive: true });
let written = 0;
const invalid: string[] = [];
for (const c of config.components) {
  const props = propsOf(c.importName ?? c.name);
  if (props.length === 0) continue;
  const seed = buildSeed(c.name, props);
  // A PROPOSAL THAT DOES NOT PARSE IS WORTH NOTHING. Agreement with the human
  // says the VALUES are right; only the referee says the FILE is usable. This
  // runs the same validateContract the pipeline runs, on every proposal,
  // whether or not anything is written.
  const verdict = validateContract(seed);
  if (!verdict.ok) invalid.push(`  ${c.name}: ${verdict.errors.join('; ')}`);
  if (WRITE) writeFileSync(path.join(outDir, `${c.name.toLowerCase()}.contract.json`), `${JSON.stringify(seed, null, 2)}\n`);
  written++;
  console.log(`  ${verdict.ok ? '✔' : '✖'} ${c.name}: ${props.length} enum axis/axes — ${props.map((p) => `${p.name}(${p.values.length})`).join(', ')}`);
}
console.log(`\n${written} seed(s) ${WRITE ? `written to ${path.relative(ROOT, outDir)}` : 'proposed (dry run — pass --write)'}.`);
if (invalid.length > 0) {
  console.error(`\n✘ ${invalid.length} of ${written} proposal(s) FAIL the contract referee — a seed that agrees with the human and does not parse is worth nothing:\n${invalid.join('\n')}`);
  process.exit(1);
}
console.log(`✔ all ${written} pass validateContract — the same referee the pipeline runs.`);
console.log(`Type index: ${unions.size} union alias(es) + ${constKeys.size} const map(s) across ${dts.length} .d.ts files.`);
