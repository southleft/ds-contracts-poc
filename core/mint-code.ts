/**
 * PROVISIONAL TOKEN MINTING FOR CODE IMPORTS — the CSS-side twin of
 * core/mint-tokens.ts (which serves degraded Figma imports).
 *
 * A wild stylesheet speaks two dialects the token referee cannot bind:
 *
 *   RAW LITERALS   `padding: 8px 16px`, `background: #0e61ba` — values with
 *                  no var() at all. Today these are RawValueFindings (report
 *                  entries) and the binding is dropped.
 *
 *   FOREIGN VARS   `background: var(--cbds-bg-brand-default)` — custom
 *                  properties from ANOTHER system's stylesheet. The token
 *                  index has no such path, so extraction refuses by name and
 *                  the binding is dropped.
 *
 * Minting keeps those styles alive at literal fidelity: every resolvable
 * value becomes a leaf in a provisional `imported.*` DTCG tree (the SAME
 * namespace/naming/dedupe conventions as mint-tokens.ts — mechanical names,
 * semantics NEVER guessed) and the proposal binds to it. Foreign vars are
 * resolved against the `:root { --x: … }` declarations found across the
 * fetched CSS set (chains followed, `var(--x, fallback)` honored); a var
 * with NO reachable declaration cannot be valued honestly — it lands on the
 * CARRIED-VERBATIM list, named, never guessed.
 *
 *   NAMING     `imported.<component>.<part>.<css-property>` for base rules;
 *              `imported.<component>.<part>.<state>.<css-property>` for
 *              state rules (hover / active / focus-visible / disabled).
 *
 *   DEDUPE     an identical literal at ≥ MINT_SHARE_THRESHOLD uniform usage
 *              sites collapses into ONE `imported.shared.*` leaf.
 *
 *   VARIANTS   a property whose value differs behind enum-modifier classes
 *              (`.btn--danger { background: … }`) mints a leaf per axis
 *              value — `imported.<component>.<part>.<css-property>.<value>`
 *              — and binds the substituted ref `{…​.{<axisProp>}}`. Axis
 *              values the classes do not cover fill from the base rule (the
 *              cascade's own default); still-missing coverage or values
 *              conditioned on MORE than one axis mint nothing, by name.
 *
 *   KINDS      colors ($type color), dimensions px/rem/em/%… ($type
 *              dimension), bare numbers ($type fontWeight for font-weight,
 *              else number). Anything else (font stacks, keywords, shadows)
 *              is not a mintable value — refused by name.
 *
 * Pure module (no node:* imports) — part of the browser-importable core.
 * Receipts: core/mint-code-check.ts (`npm run mint:code:check`).
 */
import { MINT_NAMESPACE, MINT_SHARE_THRESHOLD, type MintAxis, type MintedEntry } from './mint-tokens.js';

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** One CSS declaration site the extractor could see but not bind — the input
 *  unit. `raw` is the value exactly as written (a literal or a var() form). */
export interface CodeMintFinding {
  /** Provenance selector ('.cbds-c-button--danger:hover'). */
  selector: string;
  /** Canonical extracted part name ('root', 'iconLeft', …). */
  part: string;
  /** Contract token key ('background-color', 'padding-inline', …). */
  cssProperty: string;
  /** Contract state ('hover' | 'active' | 'focus-visible' | 'disabled'); absent = base. */
  state?: string;
  /** The enum-modifier class guarding the rule; absent = base rule. */
  axis?: { prop: string; value: string };
  /** The declaration's value as written. */
  raw: string;
}

/** A var() the fetched CSS set cannot value — carried verbatim, never guessed. */
export interface CarriedVerbatimVar {
  selector: string;
  part: string;
  cssProperty: string;
  state?: string;
  axis?: { prop: string; value: string };
  /** The unresolvable expression as written ('var(--cbds-bg-brand-default)'). */
  expression: string;
  /** Why it could not be valued. */
  reason: string;
}

/** One binding decision per (part, state, cssProperty) group. */
export interface CodeMintBinding {
  part: string;
  cssProperty: string;
  state?: string;
  /** Leaf ref or axis-substituted ref; null when nothing could be minted. */
  ref: string | null;
  reason?: string;
}

export interface CodeMintResult {
  /** The provisional DTCG tree (rooted at `imported`). */
  tree: Record<string, unknown>;
  count: number;
  entries: MintedEntry[];
  bindings: CodeMintBinding[];
  carriedVerbatim: CarriedVerbatimVar[];
}

// ---------------------------------------------------------------------------
// :root custom-property harvesting (the fetched CSS set's own vocabulary)
// ---------------------------------------------------------------------------

/**
 * Every `--name: value` declaration inside `:root` / `html` / `body` blocks
 * across the given CSS texts, later texts and later declarations winning
 * (the cascade). Comments are stripped; nested blocks inside :root (unusual)
 * are skipped conservatively. Media-conditioned overrides are ignored — the
 * base :root value is the honest single answer.
 */
/** Remove conditional at-rule blocks (@media/@supports/@container) wholesale —
 *  a media-scoped `:root` override is a CONDITION, and the base value is the
 *  honest single answer for a modeless preview. */
function stripConditionalAtRules(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const m = src.slice(i).match(/@(media|supports|container)[^{;]*\{/);
    if (!m || m.index === undefined) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, i + m.index);
    i += m.index + m[0].length;
    let depth = 1;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
  }
  return out;
}

export function collectRootCustomProps(cssTexts: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const cssText of cssTexts) {
    const src = stripConditionalAtRules(cssText.replace(/\/\*[\s\S]*?\*\//g, ''));
    // Match `:root { … }` (also `html`, `body`, and comma groups of them) at
    // any nesting depth by scanning for the selector then the balanced block.
    const re = /(^|[}{;\s])(:root|html|body)(\s*,\s*(?::root|html|body))*\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      let depth = 1;
      let i = re.lastIndex;
      let buf = '';
      for (; i < src.length && depth > 0; i++) {
        const ch = src[i];
        if (ch === '{') {
          depth++;
          buf = ''; // a nested block header — drop it
        } else if (ch === '}') {
          depth--;
          buf = '';
        } else if (ch === ';') {
          const colon = buf.indexOf(':');
          if (colon !== -1) {
            const prop = buf.slice(0, colon).trim();
            const value = buf.slice(colon + 1).trim().replace(/\s+/g, ' ');
            if (prop.startsWith('--') && value.length > 0) out.set(prop.slice(2), value);
          }
          buf = '';
        } else {
          buf += ch;
        }
      }
      // trailing declaration without a semicolon
      const colon = buf.indexOf(':');
      if (colon !== -1) {
        const prop = buf.slice(0, colon).trim();
        const value = buf.slice(colon + 1).trim().replace(/\s+/g, ' ');
        if (prop.startsWith('--') && value.length > 0) out.set(prop.slice(2), value);
      }
      re.lastIndex = i;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Value resolution — var() chains against the harvested custom properties
// ---------------------------------------------------------------------------

/** `var(--x)` / `var(--x, fallback)` with a balanced fallback → parts. */
function parseVarExpression(value: string): { name: string; fallback?: string } | null {
  const m = value.match(/^var\(\s*--([A-Za-z0-9_-]+)\s*(?:,([\s\S]*))?\)$/);
  if (!m) return null;
  if (m[2] === undefined) return { name: m[1] };
  const fallback = m[2].trim();
  // The regex is greedy to the LAST ')': verify the fallback is balanced so
  // `var(--a), var(--b)` (a list, not one var) never parses as one.
  let depth = 0;
  for (const ch of fallback) {
    if (ch === '(') depth++;
    else if (ch === ')' && --depth < 0) return null;
  }
  return depth === 0 ? { name: m[1], fallback } : null;
}

type Resolved =
  | { ok: true; value: string }
  | { ok: false; reason: string };

/** Follow a raw CSS value to a concrete literal: literals pass through,
 *  var() chains resolve against the custom-prop map (fallbacks honored). */
function resolveValue(raw: string, customProps: Map<string, string>, depth = 0): Resolved {
  if (depth > 8) return { ok: false, reason: 'custom-property chain deeper than 8 hops — not followed' };
  const varExpr = parseVarExpression(raw.trim());
  if (!varExpr) return { ok: true, value: raw.trim() };
  const declared = customProps.get(varExpr.name);
  if (declared !== undefined) return resolveValue(declared, customProps, depth + 1);
  if (varExpr.fallback !== undefined) return resolveValue(varExpr.fallback, customProps, depth + 1);
  return {
    ok: false,
    reason: `no :root declaration for --${varExpr.name} in the fetched CSS set and no fallback`,
  };
}

// ---------------------------------------------------------------------------
// Kind classification + mechanical spellings (mint-tokens conventions)
// ---------------------------------------------------------------------------

type ValueKind = 'color' | 'dimension' | 'number';

const COLOR_FN_RE = /^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/i;
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const DIMENSION_RE = /^-?\d*\.?\d+(px|rem|em|%|vw|vh|ch|ex|pt)$/;
const NUMBER_RE = /^-?\d*\.?\d+$/;

/** Classify + normalize a resolved literal. Null = not a mintable value. */
function classifyValue(value: string): { kind: ValueKind; formatted: string } | null {
  const v = value.trim();
  if (HEX_RE.test(v)) return { kind: 'color', formatted: v.toLowerCase() };
  if (COLOR_FN_RE.test(v) || /^(transparent|currentcolor)$/i.test(v)) {
    return { kind: 'color', formatted: v.toLowerCase() };
  }
  if (DIMENSION_RE.test(v)) return { kind: 'dimension', formatted: v };
  if (NUMBER_RE.test(v)) return { kind: 'number', formatted: v };
  return null;
}

const dtcgType = (kind: ValueKind, cssProperty: string): string =>
  kind === 'number' ? (cssProperty === 'font-weight' ? 'fontWeight' : 'number') : kind;

/** One token-path segment: lowercase, [a-z0-9-] only, never empty. */
const sanitizeSegment = (s: string): string => {
  const seg = s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return seg.length > 0 ? seg : 'part';
};

/** Shared-leaf name for a deduped literal — mint-tokens' spelling extended
 *  to the CSS value space: color-0e61ba / size-8 (px implied, as the Figma
 *  path spells it) / size-0-5rem / num-600. */
function sharedName(kind: ValueKind, formatted: string): string {
  if (kind === 'color') return `color-${sanitizeSegment(formatted.replace(/^#/, ''))}`;
  if (kind === 'dimension') {
    const px = formatted.match(/^(-?\d*\.?\d+)px$/);
    const body = px ? px[1] : formatted;
    return `size-${sanitizeSegment(body.replace(/^-/, 'neg-'))}`;
  }
  return `num-${sanitizeSegment(formatted.replace(/^-/, 'neg-'))}`;
}

// ---------------------------------------------------------------------------
// mintFromCss
// ---------------------------------------------------------------------------

interface GroupOccurrence {
  finding: CodeMintFinding;
  kind: ValueKind;
  formatted: string;
}

interface Group {
  part: string;
  cssProperty: string;
  state?: string;
  /** Set when any occurrence resolved to a non-mintable value — the whole
   *  group is refused by name (never half-minted). */
  unmintable?: string;
  /** Base-rule value (no axis class); the LAST base declaration wins (cascade). */
  base?: GroupOccurrence;
  /** axis prop → (axis value → occurrence), last declaration winning. */
  byAxis: Map<string, Map<string, GroupOccurrence>>;
  /** First selector seen — provenance for refusal notes. */
  selector: string;
}

/**
 * Mint provisional tokens for a component's unbindable CSS values.
 *
 * `findings` come from the CSS-module extractor (raw literals + foreign
 * var()s, each with its part/state/axis context); `axes` are the component's
 * enum props (substituted refs expand over EVERY value, so per-variant mints
 * must cover them all); `customProps` is the harvested `:root` vocabulary
 * (collectRootCustomProps over the whole fetched CSS set).
 */
export function mintFromCss(
  component: string,
  findings: CodeMintFinding[],
  axes: MintAxis[],
  customProps: Map<string, string>,
): CodeMintResult {
  const comp = sanitizeSegment(component);
  const carriedVerbatim: CarriedVerbatimVar[] = [];
  const axisByProp = new Map(axes.map((a) => [a.propName, a]));

  // ---- resolve + group by (part, state, cssProperty) ----------------------
  const groups = new Map<string, Group>();
  const groupOrder: string[] = [];
  for (const finding of findings) {
    const resolved = resolveValue(finding.raw, customProps);
    if (!resolved.ok) {
      carriedVerbatim.push({
        selector: finding.selector,
        part: finding.part,
        cssProperty: finding.cssProperty,
        ...(finding.state ? { state: finding.state } : {}),
        ...(finding.axis ? { axis: finding.axis } : {}),
        expression: finding.raw.trim(),
        reason: resolved.reason,
      });
      continue;
    }
    const classified = classifyValue(resolved.value);
    const key = [finding.part, finding.state ?? '', finding.cssProperty].join(' ');
    if (!groups.has(key)) {
      groups.set(key, {
        part: finding.part,
        cssProperty: finding.cssProperty,
        ...(finding.state ? { state: finding.state } : {}),
        byAxis: new Map(),
        selector: finding.selector,
      });
      groupOrder.push(key);
    }
    const group = groups.get(key)!;
    if (!classified) {
      // Not a mintable value (font stack, keyword, shadow, …) — refuse the
      // whole group by name: a half-minted axis set would fabricate coverage.
      group.unmintable = `\`${finding.selector} { ${finding.cssProperty}: ${finding.raw} }\` resolves to "${resolved.value}" — not a color, dimension, or number; not mintable`;
      continue;
    }
    const occurrence: GroupOccurrence = { finding, kind: classified.kind, formatted: classified.formatted };
    if (finding.axis) {
      const perAxis = group.byAxis.get(finding.axis.prop) ?? new Map<string, GroupOccurrence>();
      perAxis.set(finding.axis.value, occurrence); // last declaration wins
      group.byAxis.set(finding.axis.prop, perAxis);
    } else {
      group.base = occurrence; // last declaration wins
    }
  }

  // ---- classify groups: uniform / per-variant / refused --------------------
  type Decision =
    | { kind: 'uniform'; group: Group; occ: GroupOccurrence }
    | { kind: 'variant'; group: Group; axis: MintAxis; byValue: Map<string, GroupOccurrence> }
    | { kind: 'none'; group: Group; reason: string };

  const decisions: Decision[] = groupOrder.map((key) => {
    const group = groups.get(key)!;
    if (group.unmintable) return { kind: 'none', group, reason: group.unmintable };
    const axisProps = [...group.byAxis.keys()];
    if (axisProps.length === 0) {
      return group.base
        ? { kind: 'uniform', group, occ: group.base }
        : { kind: 'none', group, reason: 'no resolvable occurrence — nothing minted' };
    }
    if (axisProps.length > 1) {
      return {
        kind: 'none',
        group,
        reason: `values conditioned on more than one enum axis (${axisProps.join(', ')}) — a single substituted ref cannot express that; nothing minted`,
      };
    }
    const axis = axisByProp.get(axisProps[0]);
    if (!axis) {
      return {
        kind: 'none',
        group,
        reason: `modifier classes reference "${axisProps[0]}" which is not a declared enum axis — nothing minted`,
      };
    }
    const byValue = new Map(group.byAxis.get(axis.propName)!);
    // Values the classes do not cover fill from the base rule — the cascade's
    // own default. Still-missing coverage is a named refusal (a substituted
    // ref expands over EVERY enum value; partial coverage would dangle).
    for (const v of axis.values) {
      if (!byValue.has(v) && group.base) byValue.set(v, group.base);
    }
    const missing = axis.values.filter((v) => !byValue.has(v));
    if (missing.length > 0) {
      return {
        kind: 'none',
        group,
        reason: `"${axis.propName}" classes cover ${axis.values.length - missing.length}/${axis.values.length} values (missing ${missing.join(', ')}) and no base rule fills the gap — nothing minted`,
      };
    }
    const values = [...byValue.values()];
    if (values.every((o) => o.formatted === values[0].formatted && o.kind === values[0].kind)) {
      return { kind: 'uniform', group, occ: values[0] };
    }
    return { kind: 'variant', group, axis, byValue };
  });

  // ---- dedupe census over uniform sites ------------------------------------
  const siteCount = new Map<string, number>();
  for (const d of decisions) {
    if (d.kind !== 'uniform') continue;
    const key = `${d.occ.kind}|${d.occ.formatted}`;
    siteCount.set(key, (siteCount.get(key) ?? 0) + 1);
  }

  // ---- leaf ledger (mint-tokens' claim semantics) ---------------------------
  const leaves = new Map<string, MintedEntry & { type: string }>();
  const hasDescendants = (path: string) => [...leaves.keys()].some((k) => k.startsWith(`${path}.`));
  const claim = (wantedPath: string, occ: GroupOccurrence, usageSite: string): string => {
    for (let n = 1; ; n++) {
      const path = n === 1 ? wantedPath : `${wantedPath}-${n}`;
      const existing = leaves.get(path);
      if (!existing) {
        if (hasDescendants(path)) continue;
        leaves.set(path, {
          ref: `{${path}}`,
          value: occ.formatted,
          usageSites: [usageSite],
          type: dtcgType(occ.kind, occ.finding.cssProperty),
        });
        return path;
      }
      if (existing.value === occ.formatted) {
        if (!existing.usageSites.includes(usageSite)) existing.usageSites.push(usageSite);
        return path;
      }
    }
  };

  const siteOf = (group: Group) =>
    `${group.part}${group.state ? ` :${group.state}` : ''} ${group.cssProperty}`;

  const bindings: CodeMintBinding[] = decisions.map((d) => {
    const { group } = d;
    const bindingBase = {
      part: group.part,
      cssProperty: group.cssProperty,
      ...(group.state ? { state: group.state } : {}),
    };
    if (d.kind === 'none') return { ...bindingBase, ref: null, reason: d.reason };
    const pathBase = [
      MINT_NAMESPACE,
      comp,
      sanitizeSegment(group.part),
      ...(group.state ? [sanitizeSegment(group.state)] : []),
      group.cssProperty,
    ].join('.');
    const site = siteOf(group);
    if (d.kind === 'uniform') {
      const censusKey = `${d.occ.kind}|${d.occ.formatted}`;
      const wanted =
        (siteCount.get(censusKey) ?? 0) >= MINT_SHARE_THRESHOLD
          ? `${MINT_NAMESPACE}.shared.${sharedName(d.occ.kind, d.occ.formatted)}`
          : pathBase;
      const path = claim(wanted, d.occ, site);
      return { ...bindingBase, ref: `{${path}}` };
    }
    // Per-variant: probe group suffixes as a unit so the substituted ref stays
    // a real tree prefix for EVERY axis value (mint-tokens' discipline).
    for (let n = 1; ; n++) {
      const groupBase = n === 1 ? pathBase : `${pathBase}-${n}`;
      const compatible =
        !leaves.has(groupBase) &&
        [...d.byValue.entries()].every(([axisValue, occ]) => {
          const existing = leaves.get(`${groupBase}.${axisValue}`);
          if (existing !== undefined) return existing.value === occ.formatted;
          return !hasDescendants(`${groupBase}.${axisValue}`);
        });
      if (!compatible) continue;
      for (const [axisValue, occ] of d.byValue) {
        claim(`${groupBase}.${axisValue}`, occ, `${site} (${d.axis.propName}=${axisValue})`);
      }
      return { ...bindingBase, ref: `{${groupBase}.{${d.axis.propName}}}` };
    }
  });

  // ---- leaves → nested DTCG tree -------------------------------------------
  const tree: Record<string, unknown> = {};
  for (const [path, entry] of leaves) {
    const segs = path.split('.');
    let node = tree;
    for (const seg of segs.slice(0, -1)) {
      node = (node[seg] ??= {}) as Record<string, unknown>;
    }
    node[segs[segs.length - 1]] = { $value: entry.value, $type: entry.type };
  }

  return {
    tree,
    count: leaves.size,
    entries: [...leaves.values()].map(({ ref, value, usageSites }) => ({ ref, value, usageSites })),
    bindings,
    carriedVerbatim,
  };
}
