/**
 * DESIGN → CONTRACT — the PURE core of extract/figma/propose.ts.
 *
 * proposeFromDump inverts a node-tree dump of a drawn component set into a
 * full proposed contract (API + anatomy + token bindings). All inversion
 * rules live here, moved verbatim from the extractor; the CLI shell
 * (extract/figma/propose.ts) owns file IO and re-exports this module, so
 * the round-trip receipt (extract/figma/roundtrip.ts) referees the same
 * code a browser playground imports. No node:* imports.
 *
 * See the original module doc in extract/figma/propose.ts for the complete
 * inversion-rule catalogue (LAYOUT / TOKENS / ENUM SUBST / TEXT / PROPS /
 * SLOTS / INSTANCES / STATES).
 *
 * MINTING (opt-in, `mintUnbound: true`): when an import cannot resolve
 * variable names (the variables endpoint is Enterprise-only) every bound
 * fact degrades to a resolved literal and the classic pass only REPORTS it.
 * With minting on, those same observations become bindings to provisional
 * `imported.*` tokens (core/mint-tokens.ts) returned on the result as
 * `mintedTokens` — styles survive at literal fidelity, names stay mechanical
 * and reviewable, semantics are never guessed.
 */
import { ContractSchema, pascal } from '../scripts/contract-schema.js';
import { kebab } from '../extract/types.js';
import type { DumpNode, DumpSet } from '../extract/figma/types.js';
import type { TokenCorpus } from './token-corpus.js';
import { mintTokens, type MintAxis, type MintObservation, type MintedEntry } from './mint-tokens.js';

// ---------------------------------------------------------------------------
// Shared spellings
// ---------------------------------------------------------------------------

/** Inverse of extract/types.ts titleCase: "Show Actions" → "showActions". */
export const camel = (s: string): string =>
  s
    .trim()
    .split(/[\s_-]+/)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');

const dotPath = (slashName: string) => slashName.split('/').join('.');
const ref = (slashName: string) => `{${dotPath(slashName)}}`;

/** Canonical prop-name spelling for a Figma property name. A property that is
 *  ALREADY a legal camelCase identifier is kept verbatim — foreign kits ship
 *  "hasEndIcon" / "isDisabled", and camel() (which lowercases whole words)
 *  would mangle them into spellings nobody owns ("hasendicon"). Everything
 *  else ("Show Actions", "Variant", "Label") goes through camel() as before.
 *  Characters outside a legal identifier are STRIPPED first — foreign kits
 *  ship emoji-prefixed properties ("✏️text", "↪️icon-left"; field case:
 *  CBDS Button) and the honest move is to sanitize AT PROPOSAL, keeping the
 *  original spelling as the design binding (bindings.figma.property), not to
 *  refuse at emit. The "#id" suffix non-variant properties carry is never
 *  part of the name. */
export const canonicalPropName = (property: string): string => {
  const bare = property.split('#')[0].trim();
  if (/^[a-z][A-Za-z0-9]*$/.test(bare)) return bare;
  return camel(bare.replace(/[^A-Za-z0-9 _-]+/g, ' ').trim());
};

/** True when canonicalPropName had to strip characters — the note trigger. */
export const propNameSanitized = (property: string): boolean =>
  /[^A-Za-z0-9 _-]/.test(property.split('#')[0].trim());

/** Contract name for a drawn set: PascalCase over the alphanumeric words.
 *  "Button-Brand Primary" → "ButtonBrandPrimary", "Button group" →
 *  "ButtonGroup" — the emitters make the name an exported component and its
 *  file names, so an unsanitized set name is a guaranteed emit refusal. The
 *  canvas set keeps its own name; identity anchors are componentSetKey/nodeId. */
export const pascalComponentName = (setName: string): string =>
  setName
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

/** The slice of a child contract canonicalization needs — kept minimal so the
 * playground can pass its bundled contracts without importing the zod types. */
export interface MinimalChildContract {
  id: string;
  props: Array<{ name: string; bindings: { figma: { property?: string; values?: Record<string, string> } } }>;
}

// ---------------------------------------------------------------------------
// Variant axes
// ---------------------------------------------------------------------------

interface Axis {
  property: string;
  propName: string;
  /** Figma option values, first = the set's default (the generator emits the
   *  all-defaults combo first and Figma's default variant is positional). */
  values: string[];
}

const axisValuesOf = (variantName: string): Record<string, string> => {
  if (!variantName.includes('=')) return {};
  const out: Record<string, string> = {};
  for (const pair of variantName.split(',')) {
    const [k, v] = pair.split('=').map((s) => s.trim());
    if (k && v !== undefined) out[k] = v;
  }
  return out;
};

function parseAxes(variantNames: string[]): Axis[] {
  const axes: Axis[] = [];
  for (const name of variantNames) {
    for (const [property, value] of Object.entries(axisValuesOf(name))) {
      let axis = axes.find((a) => a.property === property);
      if (!axis) {
        axis = { property, propName: canonicalPropName(property), values: [] };
        axes.push(axis);
      }
      if (!axis.values.includes(value)) axis.values.push(value);
    }
  }
  return axes;
}

/** Mirror of extract/reconcile.ts isBoolAxis: only a literal true/false axis
 *  is a boolean modeled the canvas way. Off/On, Yes/No etc. stay enums. */
const isBoolAxis = (options: string[]): boolean => {
  const set = new Set(options.map((o) => o.trim().toLowerCase()));
  return set.size === 2 && set.has('true') && set.has('false');
};

// ---------------------------------------------------------------------------
// Cross-variant merge
// ---------------------------------------------------------------------------

interface Occ {
  variant: string;
  node: DumpNode;
}

interface Merged {
  name: string;
  type: string;
  occ: Occ[];
  children: Merged[];
}

/** Order-preserving union of per-variant child-name sequences: Off's
 *  [thumb, spacerEnd] and On's [spacerStart, thumb] merge to
 *  [spacerStart, thumb, spacerEnd]. */
export function mergeOrders(sequences: string[][]): string[] {
  const result: string[] = [];
  for (const seq of sequences) {
    let insertAt = 0;
    for (const name of seq) {
      const idx = result.indexOf(name);
      if (idx >= 0) {
        insertAt = idx + 1;
        continue;
      }
      result.splice(insertAt, 0, name);
      insertAt++;
    }
  }
  return result;
}

/** Sibling merge keys: same-named siblings get ordinal-tagged keys, so a
 *  start icon and an end icon both drawn as "Icon" merge as TWO children —
 *  merging by bare name would silently collapse them into one (field case:
 *  Eventz Button, whose startIcon/endIcon instances share the name "Icon"). */
const siblingKeys = (children: DumpNode[]): string[] => {
  const counts = new Map<string, number>();
  return children.map((c) => {
    const n = counts.get(c.name) ?? 0;
    counts.set(c.name, n + 1);
    return n === 0 ? c.name : `${c.name}\u0000${n}`;
  });
};

function mergeOcc(name: string, occ: Occ[], notes: string[], where: string): Merged {
  const types = [...new Set(occ.map((o) => o.node.type))];
  if (types.length > 1) {
    notes.push(`${where}: node type differs across variants (${types.join(', ')}) — using ${types[0]}`);
  }
  const sequences = occ.map((o) => siblingKeys(o.node.children ?? []));
  const order = mergeOrders(sequences);
  const nameCount = new Map<string, number>();
  for (const key of order) {
    const childName = key.split('\u0000')[0];
    nameCount.set(childName, (nameCount.get(childName) ?? 0) + 1);
  }
  const children = order.map((childKey) => {
    const [childName, ordStr] = childKey.split('\u0000');
    const ord = ordStr ? Number(ordStr) : 0;
    const childOcc: Occ[] = [];
    for (const o of occ) {
      const child = (o.node.children ?? []).filter((c) => c.name === childName)[ord];
      if (child) childOcc.push({ variant: o.variant, node: child });
    }
    // Duplicated sibling names need distinct merged names (they become note
    // paths and part keys): a swap-bound duplicate takes its INSTANCE_SWAP
    // property name ("Icon" → "startIcon"); anything else takes an ordinal.
    let display = childName;
    if ((nameCount.get(childName) ?? 0) > 1) {
      const swap = [...new Set(childOcc.map((o) => o.node.propRefs?.mainComponent).filter((v) => v !== undefined))];
      display = swap.length === 1 ? swap[0]! : ord === 0 ? childName : `${childName} ${ord + 1}`;
    }
    return mergeOcc(display, childOcc, notes, `${where}/${display}`);
  });
  return { name, type: types[0], occ, children };
}

// ---------------------------------------------------------------------------
// Token-ref unification (literal / enum-substituted / drift)
// ---------------------------------------------------------------------------

type Unified =
  | { kind: 'none' }
  | { kind: 'ref'; ref: string }
  | { kind: 'drift'; detail: string };

function unifyRefs(
  obs: Array<{ variant: string; path?: string }>,
  axes: Axis[],
): Unified {
  const defined = obs.filter((o): o is { variant: string; path: string } => o.path !== undefined);
  if (defined.length === 0) return { kind: 'none' };
  // A variable name must survive as a legal token ref. Foreign vocabularies
  // hold surprises — Eventz ships a variable named "spacing/0․5" whose middle
  // character is U+2024 ONE DOT LEADER, not a dot — and an illegal ref must be
  // refused by name here, not crash schema validation downstream.
  const illegal = defined.find((o) => !/^[a-z0-9.-]+$/i.test(o.path));
  if (illegal) {
    return {
      kind: 'drift',
      detail: `variable name "${illegal.path.split('.').join('/')}" contains characters outside the token-ref grammar ([a-z0-9.-]) — binding not proposed; rename the variable or map it manually`,
    };
  }
  if (defined.length !== obs.length) {
    return {
      kind: 'drift',
      detail: `bound in ${defined.length}/${obs.length} variants (${defined.map((o) => o.variant).join(', ')}) — inconsistent, not proposed`,
    };
  }
  const distinct = [...new Set(defined.map((o) => o.path))];
  if (distinct.length === 1) return { kind: 'ref', ref: `{${distinct[0]}}` };

  const segs = defined.map((o) => o.path.split('.'));
  const len = segs[0].length;
  if (segs.some((s) => s.length !== len)) {
    return { kind: 'drift', detail: `token paths differ in depth: ${distinct.join(' vs ')}` };
  }
  const diffIdx: number[] = [];
  for (let i = 0; i < len; i++) {
    if (new Set(segs.map((s) => s[i])).size > 1) diffIdx.push(i);
  }
  if (diffIdx.length === 1) {
    const i = diffIdx[0];
    for (const axis of axes) {
      const fits = defined.every((o, k) => {
        const value = axisValuesOf(o.variant)[axis.property];
        return value !== undefined && segs[k][i] === camel(value);
      });
      if (fits) {
        const parts = [...segs[0]];
        parts[i] = `{${axis.propName}}`;
        return { kind: 'ref', ref: `{${parts.join('.')}}` };
      }
    }
  }
  return {
    kind: 'drift',
    detail: `bindings differ across variants without correlating to any variant axis: ${distinct.join(' vs ')}`,
  };
}

// ---------------------------------------------------------------------------
// Proposal state
// ---------------------------------------------------------------------------

export interface UnboundValue {
  nodePath: string;
  property: string;
  value: string | number;
  suggestions: string[];
}

export interface FigmaProposalResult {
  contract: Record<string, unknown>;
  notes: string[];
  unbound: UnboundValue[];
  /** Present only when proposeFromDump ran with `mintUnbound: true` and at
   *  least one leaf was minted: the provisional DTCG tree the proposal's
   *  minted refs resolve through (register it as an ADDITIONAL token source —
   *  tokenInventoryFromJson accepts multiple trees), plus one entry per leaf.
   *  Every name is machine-derived and provisional — see core/mint-tokens.ts. */
  mintedTokens?: { tree: Record<string, unknown>; count: number; entries: MintedEntry[] };
  /** Auto-proposed STUB contracts for nested instances whose child contract
   *  is not in scope (field case: CBDS Button's ds.icon). Each parses against
   *  the contract schema; its API is the observed applied values ONLY and its
   *  anatomy is empty (dump v1 stops at instance boundaries — nothing about
   *  the child is guessed). Register them alongside the proposal so the
   *  emitters resolve the refs; replace each by importing the real child set. */
  childStubs?: Array<Record<string, unknown>>;
}

/** Minting capture (mintUnbound: true) — the observations the classic
 *  unbound pass would otherwise only REPORT, kept with per-variant values and
 *  a live reference to the tokens record they would have bound, so the
 *  post-build mint pass can turn them into bindings. */
interface MintCapture {
  /** Non-boolean enum axes, canonical spellings (substitution is enum-only). */
  axes: MintAxis[];
  axisValuesByVariant: Map<string, Record<string, string>>;
  observations: Array<MintObservation & { target: Record<string, string>; source?: string }>;
  /** Classic-unbound source keys (`nodePath|property`) NOT fully covered by
   *  observations (asymmetric padding, mixed var/raw paints) — their unbound
   *  entries survive minting. */
  partialSources: Set<string>;
  /** tokens records and their holders, so a record whose FIRST key arrives
   *  via minting still lands on the part. */
  attach: Array<{ holder: Record<string, unknown>; tokens: Record<string, string> }>;
}

interface Ctx {
  setName: string;
  axes: Axis[];
  totalVariants: string[];
  corpus: TokenCorpus;
  contractIdByName: Map<string, string>;
  contractsById?: Map<string, MinimalChildContract>;
  prefix: string;
  notes: string[];
  unbound: UnboundValue[];
  textProps: Array<{ name: string; property: string; default: string }>;
  boolProps: Array<{ name: string; property: string; default?: boolean }>;
  /** Slot parts in tree order, for the default-slot ("children") judgment. */
  slots: Array<{ part: Record<string, unknown>; property: string; optional: boolean }>;
  /** Variant names whose base instance was flattened into the variant root —
   *  a child absent ONLY there is a fidelity limit, not drift. */
  flattenedVariants: Set<string>;
  /** Nested instances whose child contract is not in scope, keyed by the
   *  stub contract id they will claim — turned into childStubs post-build. */
  stubs: Map<string, StubCapture>;
  mint?: MintCapture;
}

/** Captured evidence for one auto-proposed child contract stub. */
interface StubCapture {
  id: string;
  instanceOf: string;
  /** Every occurrence's applied componentProperties, across variants. */
  applied: Array<Record<string, string | boolean>>;
}

const first = <T>(occ: Occ[], pick: (n: DumpNode) => T | undefined): T | undefined => {
  for (const o of occ) {
    const v = pick(o.node);
    if (v !== undefined) return v;
  }
  return undefined;
};

function reportUnbound(ctx: Ctx, nodePath: string, property: string, value: string | number) {
  ctx.unbound.push({
    nodePath,
    property,
    value,
    suggestions: ctx.corpus.suggestFor(value).slice(0, 5),
  });
}

// ---------------------------------------------------------------------------
// Mint capture (mintUnbound) — record what the unbound pass observed
// ---------------------------------------------------------------------------

/** "Tooltip:root/body/label" → "body/label"; the root itself → "". */
const partPathOf = (where: string): string => {
  const i = where.indexOf(':root');
  return i >= 0 ? where.slice(i + ':root'.length).replace(/^\//, '') : '';
};

function mintObservation(
  ctx: Ctx,
  target: Record<string, string>,
  where: string,
  cssProperty: string,
  kind: 'color' | 'px',
  occ: Array<{ variant: string; value: string | number }>,
  source?: string,
) {
  if (!ctx.mint) return;
  ctx.mint.observations.push({
    nodePath: where,
    part: partPathOf(where),
    cssProperty,
    kind,
    occurrences: occ.map((o) => ({
      variant: o.variant,
      axisValues: ctx.mint!.axisValuesByVariant.get(o.variant) ?? {},
      value: o.value,
    })),
    target,
    source,
  });
}

const numOccurrences = (m: Merged, valueOf: (n: DumpNode) => number | undefined) =>
  m.occ.map((o) => ({ variant: o.variant, value: valueOf(o.node) ?? 0 }));

// ---------------------------------------------------------------------------
// Bindings → tokens
// ---------------------------------------------------------------------------

function unifyField(m: Merged, field: string, ctx: Ctx, where: string): string | undefined {
  const u = unifyRefs(
    m.occ.map((o) => ({ variant: o.variant, path: o.node.bound?.[field] ? dotPath(o.node.bound[field]) : undefined })),
    ctx.axes,
  );
  if (u.kind === 'ref') return u.ref;
  if (u.kind === 'drift') ctx.notes.push(`${where} ${field}: ${u.detail}`);
  return undefined;
}

/** Canvas paint → CSS color literal: '#rrggbb', or 8-digit '#rrggbbaa' when
 *  the paint carries alpha (dump v1.1). 8-digit hex is the ONE spelling that
 *  is simultaneously a legal DTCG color $value, a CSS color everywhere the
 *  pipeline speaks CSS (custom properties, inline styles, canvas fillStyle),
 *  and mechanically invertible to Figma's RGBA — rgba() would satisfy only
 *  the CSS surfaces and break the minted tree's DTCG typing. */
export const paintCssHex = (p: { hex?: string; alpha?: number }): string => {
  if (p.alpha === undefined || p.alpha >= 1) return `#${p.hex}`;
  const byte = Math.round(Math.max(0, Math.min(1, p.alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${p.hex}${byte}`;
};

function unifyPaint(
  m: Merged,
  pick: (n: DumpNode) => { var?: string; hex?: string; alpha?: number } | undefined,
  ctx: Ctx,
  where: string,
  paintName: string,
  mint?: { cssProperty: string; target: Record<string, string> },
): string | undefined {
  const paints = m.occ.map((o) => ({ variant: o.variant, paint: pick(o.node) }));
  if (paints.every((p) => p.paint === undefined)) return undefined;
  const raw = paints.find((p) => p.paint?.hex !== undefined);
  if (raw) {
    reportUnbound(ctx, where, paintName, paintCssHex(raw.paint!));
    if (ctx.mint && mint) {
      // Mintable only when EVERY variant resolved to a raw hex — a paint
      // missing in some variants, or half-bound, stays a report entry.
      if (paints.every((p) => p.paint?.hex !== undefined)) {
        mintObservation(
          ctx, mint.target, where, mint.cssProperty, 'color',
          paints.map((p) => ({ variant: p.variant, value: paintCssHex(p.paint!) })),
          `${where}|${paintName}`,
        );
      } else {
        ctx.mint.partialSources.add(`${where}|${paintName}`);
      }
    }
    return undefined;
  }
  const u = unifyRefs(
    paints.map((p) => ({ variant: p.variant, path: p.paint?.var ? dotPath(p.paint.var) : undefined })),
    ctx.axes,
  );
  if (u.kind === 'ref') {
    // A BOUND paint whose alpha < 1: the token ref carries the color, not
    // the paint's opacity — no place in the contract vocabulary for it, so
    // the loss is NAMED (dump v1.1 captures it; the ref stays proposed).
    const alphaBound = paints.find((p) => p.paint?.var !== undefined && (p.paint.alpha ?? 1) < 1);
    if (alphaBound) {
      ctx.notes.push(
        `${where} ${paintName}: paint opacity ${alphaBound.paint!.alpha} rides the bound variable "${alphaBound.paint!.var}" — alpha is not representable on a token ref; binding proposed at full opacity, review`,
      );
    }
    return u.ref;
  }
  if (u.kind === 'drift') ctx.notes.push(`${where} ${paintName}: ${u.detail}`);
  return undefined;
}

/** Invert a node's variable bindings + paints into contract token refs. */
function invertNodeTokens(m: Merged, isRoot: boolean, ctx: Ctx, where: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const fields = new Set<string>();
  for (const o of m.occ) for (const f of Object.keys(o.node.bound ?? {})) fields.add(f);
  const f = (name: string) => (fields.has(name) ? unifyField(m, name, ctx, where) : undefined);

  const bg = unifyPaint(m, (n) => (n.type === 'TEXT' ? undefined : n.fill), ctx, where, 'fill', {
    cssProperty: 'background-color',
    target: tokens,
  });
  if (bg) tokens['background-color'] = bg;
  const strokeRef = unifyPaint(m, (n) => n.stroke, ctx, where, 'stroke', {
    cssProperty: 'border-color',
    target: tokens,
  });
  if (strokeRef) tokens['border-color'] = strokeRef;

  // Paired fields → the contract's coarser vocabulary.
  const pair = (a?: string, b?: string) => (a !== undefined && a === b ? a : undefined);
  const inline = pair(f('paddingLeft'), f('paddingRight'));
  if (inline) tokens['padding-inline'] = inline;
  else if (fields.has('paddingLeft') || fields.has('paddingRight')) {
    ctx.notes.push(`${where}: left/right padding bindings differ — padding-inline not representable, review`);
  }
  const block = pair(f('paddingTop'), f('paddingBottom'));
  if (block) tokens['padding-block'] = block;
  else if (fields.has('paddingTop') || fields.has('paddingBottom')) {
    ctx.notes.push(`${where}: top/bottom padding bindings differ — padding-block not representable, review`);
  }
  const radii = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'];
  if (radii.some((r) => fields.has(r))) {
    const rs = radii.map((r) => f(r));
    if (rs[0] !== undefined && rs.every((r) => r === rs[0])) tokens['border-radius'] = rs[0];
    else ctx.notes.push(`${where}: corner radii bindings are not uniform — border-radius not representable, review`);
  }
  const weights = ['strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight'];
  if (weights.some((w) => fields.has(w)) || fields.has('strokeWeight')) {
    const w = fields.has('strokeWeight')
      ? f('strokeWeight')
      : (() => {
          const ws = weights.map((x) => f(x));
          return ws[0] !== undefined && ws.every((x) => x === ws[0]) ? ws[0] : undefined;
        })();
    if (w) tokens['border-width'] = w;
    else ctx.notes.push(`${where}: stroke weight bindings are not uniform — border-width not representable, review`);
  }
  const gap = f('itemSpacing');
  if (gap) tokens.gap = gap;
  const width = f('width');
  if (width) tokens[isRoot ? 'max-width' : 'width'] = width;
  const height = f('height');
  if (height) tokens.height = height;
  const minWidth = f('minWidth');
  if (minWidth) tokens['min-width'] = minWidth;
  const opacity = f('opacity');
  if (opacity) tokens.opacity = opacity;

  // Unbound literals on a non-utility node: named, suggested, never invented.
  // With minting on, each report is ALSO captured with its per-variant values
  // (the classic report reads the default variant only).
  const n0 = m.occ[0].node;
  const l = n0.layout;
  if (l && l.spacing !== 0 && !fields.has('itemSpacing') && (n0.children?.length ?? 0) > 1) {
    reportUnbound(ctx, where, 'itemSpacing', l.spacing);
    mintObservation(ctx, tokens, where, 'gap', 'px', numOccurrences(m, (n) => n.layout?.spacing), `${where}|itemSpacing`);
  }
  if (l && l.padding.some((p) => p !== 0) && !fields.has('paddingLeft') && !fields.has('paddingTop')) {
    reportUnbound(ctx, where, 'padding', l.padding.join(' '));
    mintPadding(ctx, tokens, m, where);
  }
  if (n0.cornerRadius !== undefined && !radii.some((r) => fields.has(r))) {
    reportUnbound(ctx, where, 'cornerRadius', n0.cornerRadius);
    mintObservation(ctx, tokens, where, 'border-radius', 'px', numOccurrences(m, (n) => n.cornerRadius), `${where}|cornerRadius`);
  }
  if (n0.strokeWeight !== undefined && n0.stroke && !weights.some((w) => fields.has(w)) && !fields.has('strokeWeight')) {
    reportUnbound(ctx, where, 'strokeWeight', n0.strokeWeight);
    mintObservation(ctx, tokens, where, 'border-width', 'px', numOccurrences(m, (n) => n.strokeWeight), `${where}|strokeWeight`);
  }
  return tokens;
}

/** The contract's padding vocabulary is symmetric (padding-inline/-block):
 *  each symmetric pair mints its own observation; an asymmetric pair mints
 *  nothing (named, the classic unbound entry survives), and an all-zero pair
 *  needs no token at all. */
function mintPadding(ctx: Ctx, target: Record<string, string>, m: Merged, where: string) {
  if (!ctx.mint) return;
  const source = `${where}|padding`;
  const pairs = [
    { cssProperty: 'padding-inline', a: 3, b: 1, label: 'left/right' }, // padding: [top, right, bottom, left]
    { cssProperty: 'padding-block', a: 0, b: 2, label: 'top/bottom' },
  ] as const;
  for (const { cssProperty, a, b, label } of pairs) {
    const pad = (n: DumpNode): readonly number[] => n.layout?.padding ?? [0, 0, 0, 0];
    if (!m.occ.every((o) => pad(o.node)[a] === pad(o.node)[b])) {
      ctx.mint.partialSources.add(source);
      ctx.notes.push(`${where}: ${label} padding literals differ — ${cssProperty} is not representable, not minted; review`);
      continue;
    }
    if (m.occ.every((o) => pad(o.node)[a] === 0)) continue; // zero padding needs no token
    mintObservation(ctx, target, where, cssProperty, 'px', numOccurrences(m, (n) => pad(n)[a]), source);
  }
}

// ---------------------------------------------------------------------------
// Text → typography tokens
// ---------------------------------------------------------------------------

function invertTextTokens(m: Merged, ctx: Ctx, where: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const color = unifyPaint(
    m,
    (n) => (n.text?.fillVar ? { var: n.text.fillVar } : n.fill),
    ctx,
    where,
    'text fill',
    { cssProperty: 'color', target: tokens },
  );
  if (color) tokens.color = color;

  const t = first(m.occ, (n) => n.text);
  if (!t) return tokens;
  const styleNames = [...new Set(m.occ.map((o) => o.node.text?.style).filter((s) => s !== undefined))];
  if (styleNames.length > 1) {
    ctx.notes.push(`${where}: text style differs across variants (${styleNames.join(', ')}) — using ${styleNames[0]}`);
  }
  let style = styleNames[0] ? ctx.corpus.textStyleByName.get(styleNames[0]) : undefined;
  if (styleNames[0] && !style) {
    ctx.notes.push(`${where}: rides text style "${styleNames[0]}" which is not a token-derived style — typography not proposed`);
  }
  if (!style) {
    // Style-less text: adopt a derived style's identity only on a UNIQUE
    // (fontSize, fontStyle) definition match — anything else is reported.
    const hits = ctx.corpus.textStyles.filter(
      (s) => s.fontSize === t.fontSize && s.fontStyle === (t.fontStyle ?? 'Medium'),
    );
    if (hits.length === 1) style = hits[0];
    else if (styleNames.length === 0) {
      ctx.notes.push(
        `${where}: typography (${t.fontSize}px ${t.fontStyle}) matches ${hits.length} derived text styles — font tokens not proposed, review`,
      );
    }
  }
  if (style) {
    tokens['font-size'] = `{${style.tokenPath}}`;
    // Medium is the runtimes' text default: a weight token resolving to it is
    // canvas-indistinguishable from no weight token (declared fidelity limit).
    if (style.weightPath && style.fontStyle !== 'Medium') {
      tokens['font-weight'] = `{${style.weightPath}}`;
    }
    if ((t.fontStyle ?? 'Medium') !== style.fontStyle) {
      ctx.notes.push(`${where}: node weight "${t.fontStyle}" overrides style "${style.name}" — override not token-recoverable, review`);
    }
  } else if (ctx.mint && t.fontSize > 0) {
    // No token-derived style identity — mint the literal size (font-family
    // and weight stay unproposed; weight inversion is style-identity work).
    mintObservation(ctx, tokens, where, 'font-size', 'px', numOccurrences(m, (n) => n.text?.fontSize));
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Layout inversion
// ---------------------------------------------------------------------------

const JUSTIFY_INV: Record<string, string | undefined> = {
  MIN: undefined,
  CENTER: 'center',
  MAX: 'end',
  SPACE_BETWEEN: 'space-between',
};
const ALIGN_INV: Record<string, string | undefined> = {
  MIN: undefined,
  CENTER: 'center',
  MAX: 'end',
};

/** align:stretch evidence — the exact artifact the generator leaves: a column
 *  parent whose eligible children (FRAME/TEXT, no bound width; instances are
 *  excluded from the generator's stretch path) ALL carry fill-width. */
function stretchEvidence(m: Merged): boolean {
  const l = m.occ[0].node.layout;
  if (!l || l.mode !== 'VERTICAL') return false;
  const eligible = m.children.filter((c) => {
    const n = c.occ[0].node;
    return (n.type === 'FRAME' || n.type === 'TEXT') && !n.bound?.width;
  });
  if (eligible.length === 0) return false;
  return eligible.every((c) => c.occ.every((o) => o.node.fillWidth === true));
}

function invertLayout(
  m: Merged,
  isRoot: boolean,
  parentMode: 'HORIZONTAL' | 'VERTICAL' | null,
  ctx: Ctx,
  where: string,
): Record<string, unknown> | undefined {
  const layouts = m.occ.map((o) => o.node.layout).filter((l) => l !== undefined);
  const l = layouts[0];
  if (l) {
    const differs = layouts.some((x) => x!.mode !== l.mode || x!.primary !== l.primary || x!.counter !== l.counter);
    if (differs) ctx.notes.push(`${where}: auto-layout differs across variants — using the default variant's`);
  }
  const grow =
    parentMode === 'HORIZONTAL' && m.occ.every((o) => o.node.fillWidth === true) ? true : undefined;
  if (!l) return grow ? { grow } : undefined;

  const hasChildren = m.children.length > 0;
  const out: Record<string, unknown> = {};
  const direction = l.mode === 'VERTICAL' ? 'column' : 'row';
  const justify = JUSTIFY_INV[l.primary];
  const align = ALIGN_INV[l.counter] ?? (stretchEvidence(m) ? 'stretch' : undefined);
  if (isRoot) {
    // The generator's root default is row/center/center — a root drawn
    // exactly there proposes no layout block.
    if (direction === 'row' && justify === 'center' && align === 'center' && !grow) return undefined;
    out.display = 'flex';
  }
  if (hasChildren || direction === 'column') out.direction = direction;
  if (justify && hasChildren) out.justify = justify;
  if (align && hasChildren) out.align = align;
  if (grow) out.grow = grow;
  return Object.keys(out).length > 0 ? out : undefined;
}

// ---------------------------------------------------------------------------
// Presence → visibleWhen
// ---------------------------------------------------------------------------

function visibilityFromPresence(m: Merged, ctx: Ctx, where: string): Record<string, unknown> | undefined {
  if (m.occ.length === ctx.totalVariants.length) return undefined;
  const present = new Set(m.occ.map((o) => o.variant));
  for (const axis of ctx.axes) {
    for (const value of axis.values) {
      const matches = ctx.totalVariants.every((v) => {
        const is = axisValuesOf(v)[axis.property] === value;
        return is === present.has(v);
      });
      if (matches) return { prop: axis.propName, equals: camel(value) };
    }
  }
  // Absences fully explained by base-instance-flattened variants are a
  // declared fidelity limit (the base component's internals are not captured
  // in those variants), not structural drift — named, but not alarmed.
  if (ctx.totalVariants.every((v) => present.has(v) || ctx.flattenedVariants.has(v))) {
    ctx.notes.push(
      `${where}: absent only in base-instance-flattened variant(s), where the base component's internals are not captured — kept unconditional`,
    );
    return undefined;
  }
  ctx.notes.push(
    `${where}: present in ${m.occ.length}/${ctx.totalVariants.length} variants without correlating to any axis value — kept unconditional, review`,
  );
  return undefined;
}

// ---------------------------------------------------------------------------
// Part construction
// ---------------------------------------------------------------------------

/** The contract id this proposal will claim for itself. */
const selfContractId = (ctx: Ctx): string => `${ctx.prefix}.${kebab(ctx.setName)}`;

/** True when a nested instance resolves to the set's own contract — either
 *  through the contract index (name → id lands on the proposal's own id) or
 *  by the name-match fallback the id would be derived from. */
function isSelfInstance(instanceOf: string, ctx: Ctx): boolean {
  const resolved = ctx.contractIdByName.get(instanceOf) ?? `${ctx.prefix}.${kebab(instanceOf)}`;
  return resolved === selfContractId(ctx) || kebab(instanceOf) === kebab(ctx.setName);
}

const isSpacer = (m: Merged): boolean =>
  m.type === 'FRAME' &&
  m.children.length === 0 &&
  m.occ.every((o) => !o.node.fill && !o.node.stroke && !o.node.bound && !o.node.text);

/** The generator wraps styled static text in a row/center/center frame with
 *  zero spacing/padding (empty text → the frame alone). Recognize the wrap
 *  and elide its layout — the part is a styled leaf. */
const isWrapArtifact = (m: Merged): boolean => {
  const n = m.occ[0].node;
  const l = n.layout;
  return (
    m.type === 'FRAME' &&
    m.children.length === 0 &&
    l !== undefined &&
    l.mode === 'HORIZONTAL' &&
    l.primary === 'CENTER' &&
    l.counter === 'CENTER' &&
    l.spacing === 0 &&
    l.padding.every((p) => p === 0) &&
    (n.fill !== undefined || n.bound !== undefined)
  );
};

/** Anatomy part key for a merged child: identifier-safe (the React emitter
 *  writes `styles.<key>` and `<div className={styles.<key>}>`, so a drawn
 *  name like "Focus ring" must not leak into the key) and unique among
 *  siblings. A name that is already a legal identifier keeps its spelling. */
function partKey(name: string, taken: Set<string>): string {
  const base = /^[A-Za-z][A-Za-z0-9]*$/.test(name) ? name : camel(name) || 'part';
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}${n}`;
  taken.add(key);
  return key;
}

/** Attach a part's tokens record — and remember it when minting, so a record
 *  whose FIRST binding arrives from the mint pass still lands on the part. */
function attachTokens(ctx: Ctx, holder: Record<string, unknown>, tokens: Record<string, string>) {
  ctx.mint?.attach.push({ holder, tokens });
  if (Object.keys(tokens).length > 0) holder.tokens = tokens;
}

function registerTextProp(ctx: Ctx, property: string, characters: string, name = canonicalPropName(property)) {
  if (ctx.textProps.some((p) => p.property === property)) return;
  ctx.textProps.push({ name, property, default: characters });
}

function unifiedPropRef(m: Merged, kind: string, ctx: Ctx, where: string): string | undefined {
  const values = [...new Set(m.occ.map((o) => o.node.propRefs?.[kind]).filter((v) => v !== undefined))];
  if (values.length > 1) {
    ctx.notes.push(`${where}: ${kind} property reference differs across variants (${values.join(', ')}) — using ${values[0]}`);
  }
  return values[0];
}

function buildPart(
  m: Merged,
  parentMode: 'HORIZONTAL' | 'VERTICAL' | null,
  ctx: Ctx,
  where: string,
): Record<string, unknown> | null {
  const part: Record<string, unknown> = {};
  const visibleWhen = visibilityFromPresence(m, ctx, where);

  if (m.type === 'TEXT') {
    const tokens = invertTextTokens(m, ctx, where);
    const property = unifiedPropRef(m, 'characters', ctx, where);
    const characters = first(m.occ, (n) => n.text?.characters) ?? '';
    if (property) {
      registerTextProp(ctx, property, characters);
      // The SAME canonical spelling registerTextProp names the prop with —
      // camel() alone would leak illegal characters ("✏️text") into the
      // content binding and break the prop↔content pairing.
      part.content = { prop: canonicalPropName(property) };
    } else {
      part.text = characters;
    }
    attachTokens(ctx, part, tokens);
    if (visibleWhen) part.visibleWhen = visibleWhen;
    return part;
  }

  if (m.type === 'INSTANCE') {
    const swapProperty = unifiedPropRef(m, 'mainComponent', ctx, where);
    if (swapProperty) {
      // A swap-bound instance outside a dedicated wrapper: still a slot part,
      // just without wrapper geometry (not the generator's shape — note it).
      ctx.notes.push(`${where}: INSTANCE_SWAP-bound instance without a dedicated wrapper frame — slot proposed without layout, review`);
      part.slot = { name: canonicalPropName(swapProperty) };
      const instanceOf = first(m.occ, (n) => n.instanceOf);
      if (instanceOf && instanceOf !== 'Slot') {
        ctx.notes.push(
          `${where}: slot "${swapProperty}" holds a "${instanceOf}" instance as design-time content — defaultContent not proposed (dump v1 does not carry its configuration), review`,
        );
      }
      // Same visibility conventions as the wrapper-frame slot path: the
      // "Show <Property>" convention marks the slot optional; any other
      // BOOLEAN visibility binding becomes a real boolean prop driving the
      // part (field case: Eventz Button icons, visible → hasStartIcon /
      // hasEndIcon). Either way the slot is conditional content, so it is
      // never judged the DEFAULT slot.
      const visibleRef = unifiedPropRef(m, 'visible', ctx, where);
      const optional = visibleRef === `Show ${swapProperty}`;
      if (optional) part.optional = true;
      else if (visibleRef) applyVisibleBinding(part, visibleRef, ctx, where, m);
      ctx.slots.push({ part, property: swapProperty, optional: optional || visibleRef !== undefined });
      if (visibleWhen && !part.visibleWhen) part.visibleWhen = visibleWhen;
      return part;
    }
    const instanceOf = first(m.occ, (n) => n.instanceOf) ?? m.name;
    if (isSelfInstance(instanceOf, ctx)) {
      // SELF-REFERENCE GUARD (field case: Eventz DS Button, node 2313-42).
      // A nested instance that resolves to the set's own contract id must
      // NEVER become a component ref — the generator refuses a contract that
      // sets its own (unknown) props, and a contract cannot contain itself.
      // Reaching here means the per-variant base-instance flattening did not
      // absorb it (no componentProperties captured, or the variant carried
      // more than one self-instance), so the part ships without a component
      // ref and the skip is NAMED.
      const applied = first(m.occ, (n) => n.componentProperties);
      const propNames = applied ? Object.keys(applied).map((k) => k.split('#')[0]) : [];
      const reason = applied
        ? 'flattening heuristic not met — the variant carries more than one instance of the set itself'
        : 'componentProperties not captured — dump v1 stops at instances';
      ctx.notes.push(
        `${where}: nested instance of the set's own base component "${instanceOf}" — no component ref proposed (a contract cannot reference itself); props ${
          propNames.length > 0 ? propNames.join(', ') : '(unknown)'
        } not extracted (${reason})`,
      );
      if (visibleWhen) part.visibleWhen = visibleWhen;
      return part;
    }
    const id = ctx.contractIdByName.get(instanceOf);
    if (!id) {
      // AUTO-PROPOSED CHILD STUB (field case: CBDS Button → ds.icon). A
      // component ref to a contract nobody has is a guaranteed emit refusal
      // ("no contract in scope") — so the proposal ships a STUB child
      // contract alongside itself (childStubs), built from the observed
      // applied values ONLY. Nothing about the child's real API or anatomy
      // is guessed; the stub names its own provisionality.
      const stubId = `${ctx.prefix}.${kebab(instanceOf)}`;
      const capture = ctx.stubs.get(stubId) ?? { id: stubId, instanceOf, applied: [] };
      for (const o of m.occ) {
        if (o.node.componentProperties) capture.applied.push(o.node.componentProperties);
      }
      ctx.stubs.set(stubId, capture);
      ctx.notes.push(
        `${where}: nested instance of "${instanceOf}" has no known contract — component ref proposed as "${stubId}" with a STUB child contract auto-proposed alongside (childStubs; API from observed applied values only, anatomy not captured — import the real child set to replace it)`,
      );
    }
    const component: Record<string, unknown> = { id: id ?? `${ctx.prefix}.${kebab(instanceOf)}` };
    const applied = first(m.occ, (n) => n.componentProperties);
    if (applied) {
      component.props = canonicalizeInstanceProps(instanceOf, applied, ctx, where);
    } else {
      ctx.notes.push(
        `${where}: fixed prop values of the nested "${instanceOf}" instance are not captured in dump v1 — declared fidelity limit, author them if the instance is configured`,
      );
    }
    // The instance's own geometry/paints belong to the child contract — elided.
    part.component = component;
    // A visibility binding on a component-ref part is a boolean prop +
    // visibleWhen, exactly like slot/swap/frame parts (field case: CBDS icon
    // toggles ↪️icon-left / ↪️icon-right — captured by the dump, previously
    // dropped here).
    const visibleRef = unifiedPropRef(m, 'visible', ctx, where);
    if (visibleRef) applyVisibleBinding(part, visibleRef, ctx, where, m);
    if (visibleWhen && !part.visibleWhen) part.visibleWhen = visibleWhen;
    return part;
  }

  // FRAME (or COMPONENT root)
  if (isSpacer(m)) {
    const layout = invertLayout(m, false, parentMode, ctx, where);
    if (layout) part.layout = layout;
    if (visibleWhen) part.visibleWhen = visibleWhen;
    return part;
  }

  const tokens = invertNodeTokens(m, false, ctx, where);

  // Slot wrapper: a frame whose sole child is a swap-bound instance.
  const soleChild = m.children.length === 1 ? m.children[0] : undefined;
  const soleSwap = soleChild?.type === 'INSTANCE' ? unifiedPropRef(soleChild, 'mainComponent', ctx, `${where}/${soleChild.name}`) : undefined;
  if (soleChild && soleSwap) {
    const layout = invertLayout(m, false, parentMode, ctx, where);
    if (layout) part.layout = layout;
    attachTokens(ctx, part, tokens);
    const slot: Record<string, unknown> = { name: canonicalPropName(soleSwap) };
    const instanceOf = first(soleChild.occ, (n) => n.instanceOf);
    if (instanceOf && instanceOf !== 'Slot') {
      ctx.notes.push(
        `${where}: slot "${soleSwap}" holds a "${instanceOf}" instance as design-time content — defaultContent not proposed (dump v1 does not carry its configuration), review`,
      );
    } else {
      ctx.notes.push(`${where}: Slot-utility instance styling is the utility's own — elided`);
    }
    ctx.notes.push(
      `${where}: slot "${soleSwap}" accepts (INSTANCE_SWAP preferredValues) is not captured in dump v1 — author \`accepts\` manually`,
    );
    const visibleRef = unifiedPropRef(m, 'visible', ctx, where);
    const optional = visibleRef === `Show ${soleSwap}`;
    if (optional) part.optional = true;
    else if (visibleRef) applyVisibleBinding(part, visibleRef, ctx, where, m);
    part.slot = slot;
    ctx.slots.push({ part, property: soleSwap, optional });
    if (visibleWhen) part.visibleWhen = visibleWhen;
    return part;
  }

  if (isWrapArtifact(m)) {
    attachTokens(ctx, part, tokens);
    if (visibleWhen) part.visibleWhen = visibleWhen;
    return part;
  }

  const layout = invertLayout(m, false, parentMode, ctx, where);
  if (layout) part.layout = layout;
  attachTokens(ctx, part, tokens);
  const visibleRef = unifiedPropRef(m, 'visible', ctx, where);
  if (visibleRef) applyVisibleBinding(part, visibleRef, ctx, where, m);
  const mode = m.occ[0].node.layout?.mode ?? null;
  const parts: Record<string, unknown> = {};
  const taken = new Set<string>();
  for (const child of m.children) {
    const built = buildPart(child, mode, ctx, `${where}/${child.name}`);
    if (built) parts[partKey(child.name, taken)] = built;
  }
  if (Object.keys(parts).length > 0) part.parts = parts;
  if (visibleWhen) part.visibleWhen = visibleWhen;
  return part;
}

/** A visibility binding that is not a slot's "Show <Property>" convention:
 *  a real BOOLEAN prop drives the part. Default recovery (dump v1.1) uses
 *  POSITIVE evidence only: the node hidden in the DEFAULT (first) variant
 *  recovers `false`; absence of the `hidden` field is ambiguous (visible, or
 *  a pre-v1.1 dump) and recovers nothing — the base-instance promotion pass
 *  may still hand a default over later. */
function applyVisibleBinding(part: Record<string, unknown>, property: string, ctx: Ctx, where: string, m?: Merged) {
  const name = canonicalPropName(property);
  if (!ctx.boolProps.some((b) => b.property === property)) {
    const hiddenInDefault =
      m?.occ.find((o) => o.variant === ctx.totalVariants[0])?.node.hidden === true;
    ctx.boolProps.push({ name, property, ...(hiddenInDefault ? { default: false } : {}) });
    ctx.notes.push(
      hiddenInDefault
        ? `${where}: visibility bound to BOOLEAN "${property}" — proposed as prop \`${name}\` (default false: the node is hidden in the default variant, dump v1.1)`
        : `${where}: visibility bound to BOOLEAN "${property}" — proposed as prop \`${name}\` (default not recoverable from dump v1, review)`,
    );
  }
  part.visibleWhen = { prop: name };
}

function canonicalizeInstanceProps(
  instanceOf: string,
  applied: Record<string, string | boolean>,
  ctx: Ctx,
  where: string,
): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  const childId = ctx.contractIdByName.get(instanceOf);
  const child = childId ? ctx.contractsById?.get(childId) : undefined;
  let mapped = 0;
  for (const [property, value] of Object.entries(applied)) {
    // Preferred: canonicalize through the child contract's own bindings —
    // the figma property name and value spelling map back to the canonical
    // prop name and enum value (Size/"Small" → size/"sm"), never by guessing.
    const childProp = child?.props.find((p) => p.bindings.figma.property === property.split('#')[0]);
    if (childProp && typeof value === 'string') {
      const values = (childProp.bindings.figma as { values?: Record<string, string> }).values;
      const canonical = values ? Object.entries(values).find(([, spelled]) => spelled === value)?.[0] : undefined;
      if (canonical !== undefined) {
        out[childProp.name] = canonical;
        mapped++;
        continue;
      }
    }
    if (childProp && typeof value === 'string' && !(childProp.bindings.figma as { values?: unknown }).values) {
      // TEXT props have no values map — the string passes through verbatim.
      out[childProp.name] = value;
      mapped++;
      continue;
    }
    if (childProp && typeof value === 'boolean') {
      out[childProp.name] = value;
      mapped++;
      continue;
    }
    // Fallback without the child contract in scope: canonical spelling.
    out[canonicalPropName(property)] = typeof value === 'string' ? camel(value) : value;
  }
  if (child && mapped === Object.keys(applied).length) {
    ctx.notes.push(`${where}: fixed props of "${instanceOf}" canonicalized through ${child.id}'s bindings`);
  } else {
    ctx.notes.push(`${where}: fixed props of "${instanceOf}" canonicalized by spelling (dump v1.1)${child ? ' — some values missing from ' + child.id + "'s bindings, verify" : " — verify against the child contract's bindings"}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Base-instance flattening (field case: Eventz DS Button, node 2313-42)
// ---------------------------------------------------------------------------

/** One flattened variant's captured base-instance facts. */
interface BaseInstanceCapture {
  variant: string;
  instanceOf: string;
  properties: Record<string, string | boolean>;
}

/** PER-VARIANT flattening, pre-merge: a variant whose children include ONE
 *  instance of the set's own shared base component ("Button" wrapping a
 *  "Button" instance — with or without siblings such as a focus ring) is a
 *  wrapper artifact. The INSTANCE is the styled node: its layout and paints
 *  replace the wrapper's, its captured componentProperties are captured for
 *  promotion, and the instance node dissolves in place (dump v1 does not
 *  recurse into instances, so it contributes no children). Confidence
 *  requires the instance NOT be swap-bound (that is a slot) and
 *  componentProperties be captured (dump v1.1) — anything less falls back to
 *  the NAMED self-reference skip in buildPart. Mutates the (caller-cloned)
 *  variant nodes. */
function flattenBaseInstances(variants: DumpNode[], ctx: Ctx): BaseInstanceCapture[] {
  const captures: BaseInstanceCapture[] = [];
  for (const variant of variants) {
    const kids = variant.children ?? [];
    const selfKids = kids
      .map((node, index) => ({ node, index }))
      .filter(
        ({ node }) =>
          node.type === 'INSTANCE' &&
          !node.propRefs?.mainComponent &&
          isSelfInstance(node.instanceOf ?? node.name, ctx) &&
          node.componentProperties !== undefined,
      );
    if (selfKids.length !== 1) {
      // Zero: nothing to flatten. More than one: ambiguous — buildPart's
      // self-reference guard names the skip per instance.
      continue;
    }
    const { node: inst, index } = selfKids[0];
    // The instance's own styling speaks for the variant; wrapper fields
    // survive only where the instance carries nothing.
    if (inst.layout) variant.layout = inst.layout;
    if (inst.cornerRadius !== undefined) variant.cornerRadius = inst.cornerRadius;
    if (inst.fill) variant.fill = inst.fill;
    if (inst.stroke) {
      variant.stroke = inst.stroke;
      if (inst.strokeWeight !== undefined) variant.strokeWeight = inst.strokeWeight;
    }
    if (inst.bound) variant.bound = { ...(variant.bound ?? {}), ...inst.bound };
    if (inst.fillWidth !== undefined) variant.fillWidth = inst.fillWidth;
    variant.children = [...kids.slice(0, index), ...(inst.children ?? []), ...kids.slice(index + 1)];
    captures.push({
      variant: variant.name,
      instanceOf: inst.instanceOf ?? inst.name,
      properties: inst.componentProperties!,
    });
    ctx.flattenedVariants.add(variant.name);
  }
  if (captures.length > 0) {
    const instanceOf = captures[0].instanceOf;
    ctx.notes.push(
      `${ctx.setName}:root: ${captures.length}/${ctx.totalVariants.length} variant(s) wrap an instance of the set's own base component "${instanceOf}" — flattened: the instance's styling and captured componentProperties speak for those variants (no self-referencing component ref; base component internals not captured — dump v1 stops at instances; anatomy reflects the wrapper)`,
    );
  }
  return captures;
}

/** PROMOTE the flattened base instance's captured componentProperties to the
 *  CONTRACT'S props: booleans become boolean props bound to the base's
 *  property names (or hand an observed default to a boolean the anatomy
 *  already discovered through a visibility binding), TEXT properties (the
 *  "#id"-suffixed string keys) become text props. Runs AFTER the anatomy is
 *  built so discovery through drawn structure wins and promotion only fills
 *  the gaps. */
function promoteBaseInstanceCaptures(captures: BaseInstanceCapture[], ctx: Ctx) {
  if (captures.length === 0) return;
  const instanceOf = captures[0].instanceOf;
  const keys: string[] = [];
  for (const c of captures) {
    for (const key of Object.keys(c.properties)) if (!keys.includes(key)) keys.push(key);
  }
  for (const key of keys) {
    const property = key.split('#')[0];
    const name = canonicalPropName(property);
    const values = captures.map((c) => c.properties[key]).filter((v) => v !== undefined);
    const value = values[0];
    const distinct = [...new Set(values.map((v) => String(v)))];
    if (ctx.axes.some((a) => a.property === property || a.propName === name)) {
      // The wrapper's own axis: the pinned value names the base state the
      // flattened variant(s) delegate to — API stays the set's axes.
      ctx.notes.push(
        `base instance "${instanceOf}": property "${property}" is one of the set's own variant axes (pinned to ${distinct.join(', ')} in the flattened variant(s)) — not promoted`,
      );
      continue;
    }
    if (distinct.length > 1) {
      ctx.notes.push(
        `base instance "${instanceOf}": property "${property}" varies across the flattened variants (${distinct.join(', ')}) — default taken from the first`,
      );
    }
    if (typeof value === 'boolean') {
      const existing = ctx.boolProps.find((b) => b.property === property);
      if (existing) {
        if (existing.default === undefined) {
          existing.default = value;
          ctx.notes.push(
            `prop \`${existing.name}\`: default ${value} adopted from the base instance "${instanceOf}" (BOOLEAN property "${property}")`,
          );
        }
        continue;
      }
      ctx.boolProps.push({ name, property, default: value });
      ctx.notes.push(
        `prop \`${name}\`: promoted from the base instance "${instanceOf}" (BOOLEAN property "${property}", default ${value})`,
      );
    } else if (key.includes('#')) {
      // Non-variant properties carry "#id" suffixes — a suffixed string key
      // is a TEXT property with certainty.
      if (ctx.textProps.some((t) => t.property === property)) continue;
      registerTextProp(ctx, property, value, name);
      ctx.notes.push(
        `prop \`${name}\`: promoted from the base instance "${instanceOf}" (TEXT property "${property}", default "${value}")`,
      );
    } else if (ctx.textProps.some((t) => t.property === property)) {
      // Already a text prop discovered through a bound text node — the
      // capture confirms it, nothing to add.
      continue;
    } else {
      ctx.notes.push(
        `base instance "${instanceOf}": string property "${property}" = "${value}" not promoted — without a "#id" suffix it is indistinguishable from the base component's own VARIANT property; model it as an axis on the set if it belongs in the API`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Child contract stubs (field case: CBDS Button → ds.icon)
// ---------------------------------------------------------------------------

/** One auto-proposed STUB contract for a nested instance whose child contract
 *  is not in scope. Mechanical and provisional by construction: props are the
 *  OBSERVED applied values only (a "#id"-suffixed key is a TEXT property with
 *  certainty — promoteBaseInstanceCaptures' rule; a bare string key is
 *  VARIANT/TEXT-ambiguous at an instance boundary and is modeled as an enum
 *  over the distinct observed spellings), the anatomy is an empty root (dump
 *  v1 stops at instances — the child's structure is simply not captured), and
 *  the description says so. The stub exists so the parent's component ref can
 *  EMIT instead of refusing; importing the real child set replaces it. */
function buildChildStub(capture: StubCapture, ctx: Ctx, fileKey: string | null): Record<string, unknown> {
  const observed = new Map<string, { suffixed: boolean; values: Array<string | boolean> }>();
  for (const applied of capture.applied) {
    for (const [key, value] of Object.entries(applied)) {
      const property = key.split('#')[0];
      const entry = observed.get(property) ?? { suffixed: key.includes('#'), values: [] };
      entry.values.push(value);
      observed.set(property, entry);
    }
  }
  const props: Array<Record<string, unknown>> = [];
  for (const [property, { suffixed, values }] of observed) {
    const name = canonicalPropName(property);
    const v0 = values[0];
    if (typeof v0 === 'boolean') {
      props.push({
        name,
        type: 'boolean',
        default: v0,
        bindings: { figma: { kind: 'BOOLEAN', property }, code: { prop: name } },
      });
    } else if (suffixed) {
      props.push({
        name,
        type: 'text',
        default: v0,
        bindings: { figma: { kind: 'TEXT', property }, code: { prop: name } },
      });
    } else {
      // Distinct observed spellings, deduped by canonical value — the same
      // canonicalization the parent's component.props go through.
      const byCanonical = new Map<string, string>();
      for (const v of values) {
        if (typeof v === 'string' && !byCanonical.has(camel(v))) byCanonical.set(camel(v), v);
      }
      props.push({
        name,
        type: { enum: [...byCanonical.keys()] },
        default: camel(String(v0)),
        bindings: {
          figma: { kind: 'VARIANT', property, values: Object.fromEntries(byCanonical) },
          code: { prop: name },
        },
      });
    }
  }
  const name = pascalComponentName(capture.instanceOf);
  return {
    $schema: './contract.schema.json',
    id: capture.id,
    name,
    version: '0.1.0',
    status: 'draft',
    description: `STUB contract auto-proposed for the nested "${capture.instanceOf}" instances of ${ctx.setName} — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries). Import the child set to replace this stub.`,
    semantics: { element: 'span' },
    props,
    states: [],
    anatomy: { root: {} },
    anchors: {
      figma: { fileKey, componentSetKey: null },
      code: { importPath: `src/components/${name}`, export: name },
    },
  };
}

// ---------------------------------------------------------------------------
// Whole-set proposal
// ---------------------------------------------------------------------------

export function proposeFromDump(
  set: DumpSet,
  opts: {
    corpus: TokenCorpus;
    contractIdByName: Map<string, string>;
    contractsById?: Map<string, MinimalChildContract>;
    prefix?: string;
    fileKey?: string | null;
    /** Mint provisional tokens (core/mint-tokens.ts) from the unbound-value
     *  observations and BIND the proposal to them, instead of dropping every
     *  degraded style. Default false — the classic report-only behavior. */
    mintUnbound?: boolean;
  },
): FigmaProposalResult {
  const prefix = opts.prefix ?? 'ds';
  const variantNames = set.variants.map((v) => v.name);
  const axes = parseAxes(variantNames);
  const enumAxes = axes.filter((a) => !isBoolAxis(a.values));
  const ctx: Ctx = {
    setName: set.setName,
    axes,
    totalVariants: variantNames,
    corpus: opts.corpus,
    contractIdByName: opts.contractIdByName,
    contractsById: opts.contractsById,
    prefix,
    notes: [],
    unbound: [],
    textProps: [],
    boolProps: [],
    slots: [],
    flattenedVariants: new Set(),
    stubs: new Map(),
    mint: opts.mintUnbound
      ? {
          axes: enumAxes.map((a) => ({ propName: a.propName, values: a.values.map(camel) })),
          axisValuesByVariant: new Map(
            variantNames.map((v) => {
              const record: Record<string, string> = {};
              for (const [property, value] of Object.entries(axisValuesOf(v))) {
                const axis = enumAxes.find((a) => a.property === property);
                if (axis) record[axis.propName] = camel(value);
              }
              return [v, record];
            }),
          ),
          observations: [],
          partialSources: new Set(),
          attach: [],
        }
      : undefined,
  };

  // Base-instance flattening runs PRE-merge, per variant, on a private clone
  // (a caller's dump is never mutated): each variant wrapping an instance of
  // the set's own base component dissolves the instance in place — its
  // styling speaks for the variant, its captured componentProperties are
  // promoted after the anatomy is built.
  const variants = JSON.parse(JSON.stringify(set.variants)) as DumpNode[];
  const captures = flattenBaseInstances(variants, ctx);

  const merged = mergeOcc(
    'root',
    variants.map((v) => ({ variant: v.name, node: v })),
    ctx.notes,
    `${set.setName}:root`,
  );
  const where = `${set.setName}:root`;

  const root: Record<string, unknown> = {};
  const rootLayout = invertLayout(merged, true, null, ctx, where);
  if (rootLayout) root.layout = rootLayout;
  const rootTokens = invertNodeTokens(merged, true, ctx, where);

  // Generator artifact: a root whose only child is the auto-injected `label`
  // text node (contracts with a `children` text prop and no parts). The node
  // is not a part — its text tokens hoist to the root.
  const only = merged.children.length === 1 ? merged.children[0] : undefined;
  const autoLabel =
    only && only.type === 'TEXT' && only.name === 'label' && unifiedPropRef(only, 'characters', ctx, `${where}/label`);
  if (only && autoLabel) {
    const textTokens = invertTextTokens(only, ctx, `${where}/label`);
    Object.assign(rootTokens, textTokens);
    // The label's tokens hoisted — retarget its captured mint observations
    // to the record that actually ships (rootTokens).
    if (ctx.mint) {
      for (const o of ctx.mint.observations) if (o.target === textTokens) o.target = rootTokens;
    }
    registerTextProp(ctx, autoLabel, first(only.occ, (n) => n.text?.characters) ?? '', 'children');
    ctx.notes.push(
      `${where}/label: sole root text node named "label" is the generator's auto-injected children label — hoisted to root tokens, bound prop proposed as \`children\``,
    );
  } else {
    const mode = merged.occ[0].node.layout?.mode ?? null;
    const parts: Record<string, unknown> = {};
    const taken = new Set<string>();
    for (const child of merged.children) {
      const built = buildPart(child, mode, ctx, `${where}/${child.name}`);
      if (built) parts[partKey(child.name, taken)] = built;
    }
    if (Object.keys(parts).length > 0) root.parts = parts;
  }
  attachTokens(ctx, root, rootTokens);

  // Promotion from the flattened base instance(s) — after the anatomy, so
  // structure discovered from drawn nodes wins and promotion fills the gaps.
  promoteBaseInstanceCaptures(captures, ctx);

  // Default-slot judgment: the first non-optional slot in tree order is the
  // component's main content — name `children` (the code-side default slot).
  const defaultSlot = ctx.slots.find((s) => !s.optional);
  for (const s of ctx.slots) {
    const name = s === defaultSlot ? 'children' : canonicalPropName(s.property);
    const slot = s.part.slot as Record<string, unknown>;
    slot.name = name;
    if (pascal(name) !== s.property) slot.figmaProperty = s.property;
    if (propNameSanitized(s.property)) {
      ctx.notes.push(
        `slot \`${name}\`: Figma property "${s.property}" contains characters outside a legal identifier — name sanitized at proposal; the original spelling stays the design binding (slot.figmaProperty)`,
      );
    }
    if (s === defaultSlot) {
      ctx.notes.push(
        `slot "${s.property}": first non-optional slot in tree order — judged the DEFAULT slot (name \`children\`); rename if it is not the main content`,
      );
    }
  }

  // Props: variant axes first (in axis order), then text props in tree
  // discovery order, then visibility booleans — mirroring the API a contract
  // author would write and extract/propose.ts conventions.
  const props: Array<Record<string, unknown>> = [];
  for (const axis of axes) {
    if (isBoolAxis(axis.values)) {
      props.push({
        name: axis.propName,
        type: 'boolean',
        default: camel(axis.values[0]) === 'true',
        bindings: {
          figma: {
            kind: 'VARIANT',
            property: axis.property,
            values: Object.fromEntries(axis.values.map((v) => [camel(v), v])),
          },
          code: { prop: axis.propName },
        },
      });
      ctx.notes.push(
        `prop \`${axis.propName}\`: true/false variant axis proposed as a boolean (extract/reconcile.ts bool⇄axis rule)`,
      );
      continue;
    }
    props.push({
      name: axis.propName,
      type: { enum: axis.values.map(camel) },
      default: camel(axis.values[0]),
      bindings: {
        figma: {
          kind: 'VARIANT',
          property: axis.property,
          values: Object.fromEntries(axis.values.map((v) => [camel(v), v])),
        },
        code: { prop: axis.propName },
      },
    });
    if (axis.values.length === 2) {
      ctx.notes.push(
        `prop \`${axis.propName}\`: two-value axis [${axis.values.join(', ')}] kept as an ENUM (both states render truthfully on both surfaces); a code boolean is a compatible code-side binding — see extract/reconcile.ts bool⇄axis treatment`,
      );
    }
  }
  for (const t of ctx.textProps) {
    props.push({
      name: t.name,
      type: 'text',
      default: t.default,
      bindings: {
        figma: { kind: 'TEXT', property: t.property },
        code: { prop: t.name },
      },
    });
  }
  for (const b of ctx.boolProps) {
    props.push({
      name: b.name,
      type: 'boolean',
      // Promoted base-instance booleans carry the observed default; visibility
      // booleans have none (not recoverable from dump v1 — noted at discovery).
      ...(b.default !== undefined ? { default: b.default } : {}),
      bindings: {
        figma: { kind: 'BOOLEAN', property: b.property },
        code: { prop: b.name },
      },
    });
  }

  // Identifier sanitization at PROPOSAL, not refusal at emit: the component
  // name must be PascalCase (it becomes the export and its file names) and
  // every prop/slot name a legal identifier. Original spellings survive in
  // the figma bindings; every sanitization is a named note.
  const componentName = pascalComponentName(set.setName);
  if (componentName !== set.setName) {
    ctx.notes.push(
      `contract name: drawn set name "${set.setName}" is not a PascalCase component name — proposed as "${componentName}" (the canvas set keeps its own name; the componentSetKey/nodeId anchors carry identity)`,
    );
  }
  for (const p of props) {
    const property = (p.bindings as { figma?: { property?: string } }).figma?.property;
    if (property && propNameSanitized(property)) {
      ctx.notes.push(
        `prop \`${String(p.name)}\`: Figma property "${property}" contains characters outside a legal identifier — name sanitized at proposal; the original spelling stays the design binding (bindings.figma.property)`,
      );
    }
  }

  const contract: Record<string, unknown> = {
    $schema: './contract.schema.json',
    id: `${prefix}.${kebab(set.setName)}`,
    name: componentName,
    version: '0.1.0',
    status: 'draft',
    description: `PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics, a11y, events, and slot accepts are not canvas-recoverable; review before adoption.`,
    semantics: { element: 'div' },
    props,
    states: [],
    anatomy: { root },
    anchors: {
      figma: {
        fileKey: opts.fileKey ?? null,
        componentSetKey: set.key ?? null,
        ...(set.nodeId ? { nodeId: set.nodeId } : {}),
      },
      code: { importPath: `src/components/${componentName}`, export: componentName },
    },
  };

  // Mint pass (mintUnbound): every captured observation becomes a binding to
  // a provisional `imported.*` leaf where the values allow it — the proposal
  // keeps its styling at literal fidelity instead of shipping naked. Runs
  // BEFORE schema validation so a bad minted ref is refused, not returned.
  let mintedTokens: FigmaProposalResult['mintedTokens'];
  if (ctx.mint && ctx.mint.observations.length > 0) {
    const observations = ctx.mint.observations;
    const minted = mintTokens(kebab(set.setName), observations, ctx.mint.axes);
    const bySource = new Map<string, { total: number; bound: number }>();
    minted.bindings.forEach((binding, i) => {
      const obs = observations[i];
      if (binding.ref) obs.target[obs.cssProperty] = binding.ref;
      else if (binding.reason) ctx.notes.push(`${obs.nodePath} ${obs.cssProperty}: ${binding.reason}`);
      if (obs.source) {
        const s = bySource.get(obs.source) ?? { total: 0, bound: 0 };
        s.total++;
        if (binding.ref) s.bound++;
        bySource.set(obs.source, s);
      }
    });
    // Token records whose first binding arrived from the mint pass.
    for (const { holder, tokens } of ctx.mint.attach) {
      if (Object.keys(tokens).length > 0 && holder.tokens === undefined) holder.tokens = tokens;
    }
    // A fully minted usage site is bound now — no longer an UNBOUND entry.
    const partial = ctx.mint.partialSources;
    ctx.unbound = ctx.unbound.filter((u) => {
      const s = bySource.get(`${u.nodePath}|${u.property}`);
      return !(s && s.bound === s.total && !partial.has(`${u.nodePath}|${u.property}`));
    });
    for (const e of minted.entries) {
      ctx.notes.push(
        `MINTED ${e.ref} = ${e.value} — machine-named from a resolved value — rename against your real tokens (provisional); bound at: ${e.usageSites.join(', ')}`,
      );
    }
    mintedTokens = { tree: minted.tree, count: minted.count, entries: minted.entries };
  }

  // Auto-proposed child stubs (see buildChildStub) — each must parse too.
  const childStubs = [...ctx.stubs.values()].map((capture) =>
    buildChildStub(capture, ctx, opts.fileKey ?? null),
  );

  // Refuse to emit an unusable proposal.
  ContractSchema.parse(contract);
  for (const stub of childStubs) ContractSchema.parse(stub);
  ctx.notes.unshift(`semantics.element defaulted to "div" — element/role/ARIA are not drawn on the canvas; set the real host element`);
  for (const u of ctx.unbound) {
    ctx.notes.push(
      `UNBOUND ${u.nodePath} ${u.property} = ${u.value} — no token invented; nearest tokens by value: ${
        u.suggestions.length > 0 ? u.suggestions.map((s) => `{${s}}`).join(', ') : '(none found)'
      }`,
    );
  }
  return {
    contract,
    notes: ctx.notes,
    unbound: ctx.unbound,
    ...(mintedTokens ? { mintedTokens } : {}),
    ...(childStubs.length > 0 ? { childStubs } : {}),
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export function figmaProposalsReport(
  results: Array<{ setName: string; proposal: FigmaProposalResult }>,
): string {
  const lines = [
    '# Proposed contracts — design-side extraction report',
    '',
    `${results.length} component set(s) extracted from the canvas dump. Every proposal parses against the contract schema. A proposal is a STARTING POINT: unbound values are NAMED below (never silently tokenized), and each note is a review line item.`,
    '',
  ];
  for (const { setName, proposal } of results) {
    const c = proposal.contract as { props: unknown[] };
    lines.push(`## ${setName}`, '', `- proposed: ${c.props.length} props`);
    for (const n of proposal.notes) lines.push(`- ${n}`);
    lines.push('');
  }
  return lines.join('\n');
}
