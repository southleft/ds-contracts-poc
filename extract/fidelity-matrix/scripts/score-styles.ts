/**
 * Step 2 — STYLES scorer.
 *
 * For every dump variant, key style facts (background, color, padding,
 * radius, border) are read off the captured nodes — the dump's RESOLVED
 * values are the truth — and each fact is looked up in the proposed
 * contract's anatomy:
 *
 *   BOUND(token)   the fact rides a repo token (non-minted binding)
 *   MINTED(value)  the fact rides a minted imported.* token — value checked
 *   MISSING        the anatomy carries no binding for a fact the dump shows
 *
 * Every BOUND/MINTED cell is value-checked against the dump: `valueOk:false`
 * means the binding exists but resolves to the WRONG value for that variant.
 *
 * The code subject (cbds-button-code) has no dump; its truth is the traced
 * Button.module.css resolved through the traced token CSS (:root custom
 * properties), sampled across the variant and size axes at default state.
 *
 *   npx tsx extract/fidelity-matrix/scripts/score-styles.ts
 *
 * Writes out/<id>/styles-score.json per subject.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadRepoData, MATRIX, readJson } from './lib.js';
import { SUBJECTS } from './subjects.js';

const data = loadRepoData();

// ---------------------------------------------------------------------------
// shapes

interface DumpPaint {
  hex?: string;
  /** dump v1.1: effective paint opacity, omitted when 1. */
  alpha?: number;
}

interface DumpNode {
  name: string;
  type: string;
  hidden?: boolean;
  layout?: { padding?: number[]; [k: string]: unknown };
  cornerRadius?: number;
  fill?: DumpPaint;
  stroke?: DumpPaint;
  strokeWeight?: number;
  text?: Record<string, unknown>;
  children?: DumpNode[];
}

interface Fact {
  part: string; // '/'-joined anatomy-side path, 'root' for the variant root
  fact: string;
  truth: string;
}

interface Cell extends Fact {
  variant: string;
  verdict: 'BOUND' | 'MINTED' | 'MISSING';
  token?: string;
  resolved?: string;
  valueOk?: boolean;
}

// ---------------------------------------------------------------------------
// value normalization

/** Colors compare on the FULL rgba: 6-digit hex is opaque (append ff) so a
 *  5%-black truth (#0000020d, dump v1.1 alpha) can never "agree" with an
 *  opaque binding — the exact bug class punch-1 fixes must be scoreable. */
const normColor = (v: string): string => {
  const s = v.trim().toLowerCase().replace(/^#/, '');
  if (s === 'transparent') return 'transparent';
  if (/^[0-9a-f]{6}$/.test(s)) return `${s}ff`;
  if (/^[0-9a-f]{8}$/.test(s)) return s;
  return v.trim().toLowerCase();
};

/** lengths to px numbers; "0.5rem" → 8, "8px 16px" → [8,16]. */
const normLengths = (v: string): string =>
  v
    .trim()
    .split(/\s+/)
    .map((t) => {
      const m = t.match(/^(-?[\d.]+)(px|rem)?$/);
      if (!m) return t.toLowerCase();
      return String(parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1));
    })
    .join(' ');

const valuesAgree = (fact: string, a: string, b: string): boolean =>
  fact.includes('color') ? normColor(a) === normColor(b) : normLengths(a) === normLengths(b);

// ---------------------------------------------------------------------------
// truth extraction (figma)

/** Paint → the truth's CSS spelling: 8-digit hex when alpha < 1 (dump v1.1),
 *  the same spelling core/propose-figma.ts paintCssHex mints. */
const paintTruth = (p: DumpPaint): string => {
  if (p.alpha === undefined || p.alpha >= 1) return `#${p.hex}`;
  return `#${p.hex}${Math.round(Math.max(0, Math.min(1, p.alpha)) * 255).toString(16).padStart(2, '0')}`;
};

/** facts on one captured node — resolved values, straight from the dump. */
function nodeFacts(n: DumpNode): [string, string][] {
  const out: [string, string][] = [];
  if (n.fill?.hex) out.push([n.type === 'TEXT' ? 'color' : 'background-color', paintTruth(n.fill)]);
  if (typeof n.cornerRadius === 'number' && n.cornerRadius > 0) out.push(['border-radius', `${n.cornerRadius}px`]);
  if (n.stroke?.hex) {
    out.push(['border-color', paintTruth(n.stroke)]);
    if (typeof n.strokeWeight === 'number') out.push(['border-width', `${n.strokeWeight}px`]);
  }
  const p = n.layout?.padding;
  if (Array.isArray(p) && p.some((x) => x !== 0)) {
    const [t, r, b, l] = p;
    // an absent binding for an all-zero axis is correct, not MISSING
    if (t !== 0 || b !== 0) out.push(['padding-block', t === b ? `${t}px` : `${t}px ${b}px`]);
    if (r !== 0 || l !== 0) out.push(['padding-inline', r === l ? `${r}px` : `${r}px ${l}px`]);
  }
  return out;
}

function variantFacts(root: DumpNode): Fact[] {
  const facts: Fact[] = [];
  const walk = (n: DumpNode, at: string[]): void => {
    if (n.hidden) return; // not rendered — no style truth to hold anyone to
    if (n.type === 'INSTANCE') return; // internals live in the child component (dump v1 boundary)
    for (const [fact, truth] of nodeFacts(n)) facts.push({ part: at.join('/') || 'root', fact, truth });
    for (const c of n.children ?? []) walk(c, [...at, c.name]);
  };
  walk(root, []);
  return facts;
}

// ---------------------------------------------------------------------------
// contract-side lookup

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

interface AnatomyPart {
  tokens?: Record<string, string>;
  parts?: Record<string, AnatomyPart>;
}

/** dump path → anatomy part, tolerating name canonicalization (Arrow Wrapper
 *  → arrowWrapper, Tooltip text → tooltipText, duplicate Icon → icon2). */
function findPart(rootPart: AnatomyPart, dumpPath: string): AnatomyPart | undefined {
  if (dumpPath === 'root') return rootPart;
  let cur: AnatomyPart | undefined = rootPart;
  for (const seg of dumpPath.split('/')) {
    if (!cur?.parts) return undefined;
    const keys: string[] = Object.keys(cur.parts);
    const key: string | undefined = keys.find((k) => norm(k) === norm(seg)) ?? keys.find((k) => norm(k).replace(/\d+$/, '') === norm(seg));
    if (!key) return undefined;
    cur = cur.parts[key];
  }
  return cur;
}

/** {imported.x.{variant}.{state}} + {variant:'primary'} → {imported.x.primary.default} */
const substitute = (ref: string, propValues: Record<string, string>): string =>
  ref.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (whole, name: string) => (name in propValues ? propValues[name] : whole));

/** resolve a repo (non-minted) token ref through the loaded trees. */
function resolveRepoToken(ref: string, seen = new Set<string>()): string | undefined {
  const pathSegs = ref.replace(/^\{|\}$/g, '').split('.');
  if (seen.has(ref)) return undefined;
  seen.add(ref);
  for (const tree of [data.tokens.semantic, data.tokens.light, data.tokens.primitives, data.tokens.dark]) {
    let cur: unknown = tree;
    for (const seg of pathSegs) {
      if (cur === null || typeof cur !== 'object' || !(seg in (cur as Record<string, unknown>))) {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[seg];
    }
    const v = (cur as { $value?: unknown } | undefined)?.$value;
    if (typeof v === 'string') return v.startsWith('{') ? resolveRepoToken(v, seen) : v;
    if (typeof v === 'number') return String(v);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// scoring core (shared by figma + code subjects)

/** Promoted-state context for one truth variant: the contract state whose
 *  root overrides apply, and the base truths (matching default-state variant)
 *  for part-level cells the state vocabulary cannot carry. */
interface StateContext {
  state: string;
  /** root.states[state] overrides — overlay over root tokens. */
  overrides: Record<string, string>;
  /** (part§fact) → truth in the matching default-state variant. */
  baseTruth: Map<string, string>;
}

function scoreFacts(
  id: string,
  variantName: string,
  facts: Fact[],
  propValues: Record<string, string>,
  anatomyRoot: AnatomyPart,
  mintedByRef: Map<string, string>,
  stateCtx?: StateContext,
): Cell[] {
  return facts.map((f) => {
    const part = findPart(anatomyRoot, f.part);
    let ref = part?.tokens?.[f.fact];
    if (f.part === 'root' && stateCtx?.overrides[f.fact]) ref = stateCtx.overrides[f.fact];
    if (!part && stateCtx?.state === 'focus-visible') {
      // A child drawn only in the focus state (the focus ring) inverts to the
      // root's focus-visible OUTLINE pair — score its stroke facts there.
      const remap: Record<string, string> = { 'border-color': 'outline-color', 'border-width': 'outline-width' };
      const outlineRef = remap[f.fact] ? stateCtx.overrides[remap[f.fact]] : undefined;
      if (outlineRef) ref = outlineRef;
    }
    if (!ref) return { ...f, variant: variantName, verdict: 'MISSING' };
    const concrete = substitute(ref, propValues);
    const minted = mintedByRef.get(concrete);
    const resolved = minted ?? resolveRepoToken(concrete);
    const valueOk = resolved !== undefined && valuesAgree(f.fact, resolved, f.truth);
    if (!valueOk && stateCtx && f.part !== 'root') {
      // Part-level state overrides are OUTSIDE the contract vocabulary
      // (STYLE-FIDELITY B7 — the proposal names each one). When the truth
      // genuinely changed with the state (≠ the matching default variant's
      // truth), the contract carries NO binding for this (part, fact, state)
      // cell — MISSING (named), never a silent wrong value. A truth that
      // MATCHES the base and still disagrees stays a real mismatch.
      const base = stateCtx.baseTruth.get(`${f.part}§${f.fact}`);
      if (base !== undefined && !valuesAgree(f.fact, base, f.truth)) {
        return { ...f, variant: variantName, verdict: 'MISSING' };
      }
    }
    return {
      ...f,
      variant: variantName,
      verdict: minted !== undefined ? 'MINTED' : 'BOUND',
      token: concrete,
      ...(resolved !== undefined ? { resolved } : {}),
      valueOk,
    };
  });
}

function contractContext(id: string) {
  const contract = readJson(path.join(MATRIX, 'out', id, 'contract.json')) as {
    props: { name: string; bindings?: { figma?: { property?: string; values?: Record<string, string> } } }[];
    anatomy: { root: AnatomyPart & { states?: Record<string, Record<string, string>> } };
    states?: string[];
  };
  const proposal = readJson(path.join(MATRIX, 'out', id, 'proposal.json')) as {
    minted: { entries: { ref: string; value: string }[] } | null;
  };
  const mintedByRef = new Map<string, string>((proposal.minted?.entries ?? []).map((e) => [e.ref, e.value]));
  // figma variant value → contract value, per property
  const inverse = new Map<string, Map<string, string>>();
  for (const p of contract.props) {
    const fig = p.bindings?.figma;
    if (!fig?.property) continue;
    const m = new Map<string, string>();
    for (const [contractV, figmaV] of Object.entries(fig.values ?? {})) m.set(figmaV, contractV);
    inverse.set(fig.property, m);
  }
  const propValuesFor = (variantName: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const pair of variantName.split(',').map((s) => s.trim())) {
      const [figProp, figVal] = pair.split('=').map((s) => s.trim());
      if (!figProp || figVal === undefined) continue;
      const propDef = contract.props.find((p) => p.bindings?.figma?.property === figProp);
      if (!propDef) continue;
      out[propDef.name] = inverse.get(figProp)?.get(figVal) ?? figVal;
    }
    return out;
  };
  return { contract, mintedByRef, propValuesFor };
}

// ---------------------------------------------------------------------------
// code-subject truth: traced CSS module resolved through traced token CSS

function cssTruth(id: string): { variants: { name: string; propValues: Record<string, string>; facts: Fact[] }[] } {
  const trace = readJson(path.join(MATRIX, 'fixtures', id, 'trace.json')) as {
    files: { css?: string }[];
    extraCss: string[];
  };
  const css = trace.files.map((f) => f.css ?? '').join('\n');
  const vars = new Map<string, string>();
  for (const m of trace.extraCss.join('\n').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(m[1], m[2].trim());
  const resolveVar = (v: string, depth = 0): string =>
    depth > 8
      ? v
      : v.replace(/var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g, (_, name: string, fallback?: string) =>
          resolveVar(vars.get(name) ?? fallback ?? name, depth + 1),
        );
  // class → declarations
  const rules = new Map<string, Record<string, string>>();
  for (const m of css.matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
    const decls = rules.get(m[1]) ?? {};
    for (const d of m[2].matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) decls[d[1]] = resolveVar(d[2].trim());
    rules.set(m[1], decls);
  }
  const compose = (variant: string, size: string): Record<string, string> => ({
    ...rules.get('cbds-c-button'),
    ...(variant !== 'primary' ? rules.get(`cbds-c-button--${variant}`) : {}),
    ...(size !== 'medium' ? rules.get(`cbds-c-button--${size}`) : {}),
  });
  const factsOf = (decls: Record<string, string>): Fact[] => {
    const out: Fact[] = [];
    const put = (fact: string, v: string | undefined) => {
      if (v !== undefined && v !== 'none' && !v.includes('var(')) out.push({ part: 'root', fact, truth: v });
    };
    put('background-color', decls['background-color'] ?? decls['background']);
    put('color', decls['color']);
    put('border-radius', decls['border-radius']);
    const pad = decls['padding'];
    if (pad !== undefined) {
      const parts = pad.split(/\s+/);
      const [t, r, b, l] = [parts[0], parts[1] ?? parts[0], parts[2] ?? parts[0], parts[3] ?? parts[1] ?? parts[0]];
      put('padding-block', t === b ? t : `${t} ${b}`);
      put('padding-inline', r === l ? r : `${r} ${l}`);
    } else {
      put('padding-block', decls['padding-block']);
      put('padding-inline', decls['padding-inline']);
    }
    const border = decls['border'];
    if (border !== undefined && border !== 'none') {
      const bw = border.match(/[\d.]+(px|rem)/)?.[0];
      const bc = border.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|\btransparent\b/)?.[0];
      put('border-width', bw);
      put('border-color', bc);
    } else {
      put('border-width', decls['border-width']);
      put('border-color', decls['border-color']);
    }
    return out;
  };
  const variants: { name: string; propValues: Record<string, string>; facts: Fact[] }[] = [];
  for (const variant of ['primary', 'surface', 'danger', 'ghost']) {
    variants.push({ name: `variant=${variant}, size=medium`, propValues: { variant, size: 'medium' }, facts: factsOf(compose(variant, 'medium')) });
  }
  for (const size of ['small', 'large']) {
    variants.push({ name: `variant=primary, size=${size}`, propValues: { variant: 'primary', size }, facts: factsOf(compose('primary', size)) });
  }
  return { variants };
}

// ---------------------------------------------------------------------------
// group + report

interface GroupedRow {
  part: string;
  fact: string;
  verdict: string;
  token?: string;
  truth: string;
  resolved?: string;
  valueOk?: boolean;
  variants: string[];
}

function groupCells(cells: Cell[]): GroupedRow[] {
  const groups = new Map<string, GroupedRow>();
  for (const c of cells) {
    const key = [c.part, c.fact, c.verdict, c.token ?? '', c.truth, c.resolved ?? ''].join('§');
    const g = groups.get(key);
    if (g) g.variants.push(c.variant);
    else {
      groups.set(key, {
        part: c.part,
        fact: c.fact,
        verdict: c.verdict,
        ...(c.token !== undefined ? { token: c.token } : {}),
        truth: c.truth,
        ...(c.resolved !== undefined ? { resolved: c.resolved } : {}),
        ...(c.valueOk !== undefined ? { valueOk: c.valueOk } : {}),
        variants: [c.variant],
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.part.localeCompare(b.part) || a.fact.localeCompare(b.fact));
}

for (const s of SUBJECTS) {
  const { contract, mintedByRef, propValuesFor } = contractContext(s.id);
  const cells: Cell[] = [];
  if (s.kind === 'figma') {
    const dump = readJson(path.join(MATRIX, 'fixtures', s.id, 'dump.json')) as Record<string, unknown>;
    const set = Object.entries(dump).find(([k]) => k !== '_provenance')?.[1] as { variants: DumpNode[] };
    // Promoted interaction-state axis (mirrors core/propose-figma.ts): an
    // axis pair whose property is bound by NO contract prop and whose value
    // maps into the state vocabulary selects the root.states overlay.
    const STATE_MAP: Record<string, string> = {
      hover: 'hover', active: 'active', pressed: 'active',
      focus: 'focus-visible', 'focus-visible': 'focus-visible', disabled: 'disabled',
    };
    const boundProperties = new Set(contract.props.map((p) => p.bindings?.figma?.property).filter(Boolean));
    const promotedStateOf = (variantName: string): { state: string; baseName: string } | null => {
      if ((contract.states?.length ?? 0) === 0 && !contract.anatomy.root.states) return null;
      const pairs = variantName.split(',').map((x) => x.trim()).filter(Boolean);
      for (const pair of pairs) {
        const [prop, val] = pair.split('=').map((x) => x.trim());
        if (!prop || val === undefined || boundProperties.has(prop)) continue;
        const mapped = STATE_MAP[val.toLowerCase().replace(/[\s_]+/g, '-')];
        if (val.toLowerCase() === 'default') {
          return null; // the base itself
        }
        if (mapped) {
          const baseName = pairs.map((x) => (x === pair ? `${prop}=default` : x)).join(', ');
          return { state: mapped, baseName };
        }
      }
      return null;
    };
    const truthByVariant = new Map<string, Map<string, string>>(
      set.variants.map((v) => [v.name, new Map(variantFacts(v).map((f) => [`${f.part}§${f.fact}`, f.truth]))]),
    );
    for (const v of set.variants) {
      const promoted = promotedStateOf(v.name);
      const stateCtx: StateContext | undefined = promoted
        ? {
            state: promoted.state,
            overrides: contract.anatomy.root.states?.[promoted.state] ?? {},
            baseTruth: truthByVariant.get(promoted.baseName) ?? new Map(),
          }
        : undefined;
      cells.push(...scoreFacts(s.id, v.name, variantFacts(v), propValuesFor(v.name), contract.anatomy.root, mintedByRef, stateCtx));
    }
  } else {
    for (const v of cssTruth(s.id).variants) {
      cells.push(...scoreFacts(s.id, v.name, v.facts, v.propValues, contract.anatomy.root, mintedByRef));
    }
  }

  const tally = { BOUND: 0, MINTED: 0, MISSING: 0, mismatched: 0 };
  for (const c of cells) {
    tally[c.verdict] += 1;
    if (c.verdict !== 'MISSING' && c.valueOk === false) tally.mismatched += 1;
  }
  const rows = groupCells(cells);
  writeFileSync(
    path.join(MATRIX, 'out', s.id, 'styles-score.json'),
    JSON.stringify(
      {
        subject: s.label,
        truthSource: s.kind === 'figma' ? 'dump.json resolved node values, per variant' : 'traced Button.module.css resolved through traced :root token CSS',
        factCells: cells.length,
        tally,
        rows,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`\n── ${s.label} — ${cells.length} fact-cells: ${tally.BOUND} BOUND, ${tally.MINTED} MINTED, ${tally.MISSING} MISSING; ${tally.mismatched} value mismatches`);
  for (const r of rows) {
    const v = r.variants.length;
    const flag = r.verdict === 'MISSING' ? '✗' : r.valueOk === false ? '≠' : '✓';
    console.log(
      `  ${flag} ${r.part} · ${r.fact} [${v} variant${v > 1 ? 's' : ''}] ${r.verdict}${r.token ? ` ${r.token}` : ''} truth=${r.truth}${
        r.resolved !== undefined && r.valueOk === false ? ` resolved=${r.resolved}` : ''
      }`,
    );
  }
}
