/**
 * COMPUTED-CAPTURE FLOOR — Round 4: DOM-ANATOMY PROMOTION.
 *
 * The decisive fix for the one-to-one round: computed-only DOM elements —
 * captured by the floor but never carried — become REAL contract parts.
 *
 *   · UNION ALIGNMENT — captures are aligned into ONE union tree by
 *     hierarchical signature matching (tag + class stems, nth occurrence
 *     among same-signature siblings within the SAME parent), replacing the
 *     path-equality alignment that could only see the base combo's tree.
 *     Structure-creating optional props (Banner onDismiss → dismiss button)
 *     add union parts that the base combo never renders.
 *   · PART PROMOTION — every union element becomes a Part in the enriched
 *     contract at its captured nesting position. The static layer wins NAMES
 *     and semantics (§4.5): a static part with no captured name-match is
 *     re-joined by element/content evidence before anything is invented.
 *   · SVG CONTENT AS ASSETS — an element subtree rooted at <svg> is carried
 *     as a committed icon asset reconstructed from captured computed truth
 *     (the CSS `d` property carries every path's geometry; fill/fill-rule
 *     ride along). Markup varying over ONE axis lands as per-value icon
 *     parts gated by visibleWhen — existing vocabulary, no new schema.
 *     The viewBox is reconstructed from the svg's computed size and checked
 *     against the path data's coordinate extent — a NAMED reconstruction.
 *   · PRESENCE FACTS — a part present in only some combos carries
 *     visibleWhen (single boolean-true factor) and/or stylesWhen
 *     display:none entries (per-axis complement factors) when its presence
 *     set factors as a product of per-axis sets; anything else refuses BY
 *     NAME (never a silently always-drawn phantom).
 *
 * Pure module (no fs, no browser): run.ts writes the asset files.
 */
import type { Contract, Part } from '../../scripts/contract-schema.js';
import { walkAnatomy } from '../../scripts/contract-schema.js';
import { PRESENCE_ON, PRESENCE_OFF, type ComponentConfig, type PropSpace } from './capture.js';
import { signature, stems, type Capture, type CapturedNode, type Combo, type FlatEl } from './lib.js';

// ---------------------------------------------------------------------------
// Union alignment
// ---------------------------------------------------------------------------
export interface UnionNode {
  id: number;
  sig: string;
  /** Representative captured element (base capture when present there). */
  rep: CapturedNode;
  /** Representative path (in the capture that introduced the node). */
  repPath: string;
  /** Capture key that introduced the node ('' = the base capture). */
  repKey: string;
  inBase: boolean;
  parent: UnionNode | null;
  children: UnionNode[];
  partName: string;
}

export interface UnionResult {
  /** DFS order over the final union tree. */
  entries: UnionNode[];
  /** capture key → aligned FlatEl per union entry (null = absent). */
  alignedByKey: Map<string, (FlatEl | null)[]>;
  receipts: string[];
}

export function buildUnion(
  captures: Capture[],
  base: Capture,
  classPrefix: string,
): UnionResult {
  const receipts: string[] = [];
  let nextId = 0;
  const mk = (node: CapturedNode, path: string, parent: UnionNode | null, inBase: boolean, repKey: string): UnionNode => ({
    id: nextId++,
    sig: signature(node, classPrefix),
    rep: node,
    repPath: path,
    repKey,
    inBase,
    parent,
    children: [],
    partName: '',
  });

  // Seed from the base capture.
  const root = mk(base.root, '', null, true, '');
  const seed = (u: UnionNode, node: CapturedNode, path: string) => {
    let i = 0;
    for (const c of node.nodes) {
      if (c.t !== 'el') continue;
      const childPath = path === '' ? String(i) : `${path}.${i}`;
      const uc = mk(c.el, childPath, u, true, '');
      u.children.push(uc);
      seed(uc, c.el, childPath);
      i++;
    }
  };
  seed(root, base.root, '');

  // Align every capture (base included, for a uniform aligned map).
  const rawAligned = new Map<string, Map<number, FlatEl>>();
  for (const cap of captures) {
    const key = `${cap.combo}__${cap.interaction}`;
    const out = new Map<number, FlatEl>();
    const align = (u: UnionNode, node: CapturedNode, path: string) => {
      const sig = signature(node, classPrefix);
      if (sig !== u.sig && u.parent === null) {
        receipts.push(`root-signature-varies: ${key}: ${u.sig} → ${sig} (element-varies receipt; root always aligns)`);
      }
      out.set(u.id, { path, sig, partName: '', node });
      // group current union children by sig (snapshot BEFORE inserts)
      const bySig = new Map<string, UnionNode[]>();
      for (const uc of u.children) (bySig.get(uc.sig) ?? bySig.set(uc.sig, []).get(uc.sig)!).push(uc);
      const used = new Map<string, number>();
      let lastIdx = -1;
      let i = 0;
      for (const c of node.nodes) {
        if (c.t !== 'el') continue;
        const childPath = path === '' ? String(i) : `${path}.${i}`;
        i++;
        const csig = signature(c.el, classPrefix);
        const n = used.get(csig) ?? 0;
        used.set(csig, n + 1);
        const list = bySig.get(csig);
        if (list && n < list.length) {
          const uc = list[n];
          lastIdx = u.children.indexOf(uc);
          align(uc, c.el, childPath);
        } else {
          // new union node — inserted right after the previously matched
          // sibling (or at the END when nothing matched yet: base-tree order
          // stays stable, so base elements keep first claim on names).
          const uc = mk(c.el, childPath, u, false, key);
          const at = lastIdx === -1 ? u.children.length : lastIdx + 1;
          u.children.splice(at, 0, uc);
          lastIdx = u.children.indexOf(uc);
          receipts.push(`union-part-added: ${key} @${childPath} (${csig})`);
          align(uc, c.el, childPath);
        }
      }
    };
    align(root, cap.root, '');
    rawAligned.set(key, out);
  }

  // Final DFS order + aligned arrays.
  const entries: UnionNode[] = [];
  const dfs = (u: UnionNode) => {
    entries.push(u);
    for (const c of u.children) dfs(c);
  };
  dfs(root);
  const alignedByKey = new Map<string, (FlatEl | null)[]>();
  for (const [key, m] of rawAligned) {
    alignedByKey.set(key, entries.map((e) => m.get(e.id) ?? null));
  }
  return { entries, alignedByKey, receipts: [...new Set(receipts)] };
}

// ---------------------------------------------------------------------------
// Part naming over the union (extends lib.namePart to union entries) +
// static re-join (the static layer wins NAMES — §4.5)
// ---------------------------------------------------------------------------
export function nameUnion(
  entries: UnionNode[],
  componentName: string,
  classPrefix: string,
): void {
  const seen = new Map<string, number>();
  for (const e of entries) {
    let name: string;
    if (e.parent === null) name = 'root';
    else if (e.rep.tag === 'svg') name = 'icon';
    else if (e.rep.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0)) name = 'label';
    else {
      const stem = stems(e.rep.classes, classPrefix)[0];
      // fallback names are CSS-class-safe (they become real part class names
      // in the promoted contract — dots would break every selector)
      name = stem
        ? stem.replace(new RegExp(`^${componentName}__?`), '').toLowerCase() || 'root'
        : `part-${e.repPath.replace(/\./g, '-')}`;
    }
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    e.partName = n > 0 ? `${name}-${n + 1}` : name;
  }
}

/** Re-join static-only parts to unmatched union entries by element/content
 *  evidence: the static part's element tag must equal the captured tag, and
 *  when the static part binds text content, the captured text must equal the
 *  bound prop's mounted sample. A unique match RENAMES the union entry to
 *  the static (human-reviewed) name. */
export function rejoinStaticParts(
  entries: UnionNode[],
  contract: Contract,
  comp: ComponentConfig,
  receipts: string[],
): void {
  const walked = walkAnatomy(contract);
  const staticByName = new Map(walked.map((w) => [w.name, w.part] as const));
  const captured = new Set(entries.map((e) => e.partName));
  const textOf = (n: CapturedNode): string =>
    n.nodes.filter((c) => c.t === 'text').map((c) => (c as { v: string }).v).join('').trim();
  const sampleFor = (propName: string): string | undefined => {
    const prop = contract.props.find((p) => p.name === propName);
    if (!prop) return undefined;
    if (prop.bindings.code.prop === 'children') return comp.sampleText;
    const fixed = comp.fixedProps?.[propName];
    return typeof fixed === 'string' ? fixed : typeof prop.default === 'string' ? prop.default : undefined;
  };
  for (const [name, part] of staticByName) {
    if (captured.has(name)) continue;
    const el = part.element ?? (part.content || part.text !== undefined ? 'span' : 'div');
    const wantText = part.content ? sampleFor(part.content.prop) : part.text;
    const candidates = entries.filter((e) => {
      if (e.parent === null || staticByName.has(e.partName)) return false;
      if (e.rep.tag !== el) return false;
      if (wantText !== undefined) return textOf(e.rep) === wantText;
      return false; // element-only evidence is too weak to claim a reviewed name
    });
    const pick = candidates.length === 1 ? candidates[0]
      : candidates.filter((c) => c.inBase).length === 1 ? candidates.filter((c) => c.inBase)[0]
      : null;
    if (pick) {
      receipts.push(`static-rejoin: captured "${pick.partName}" renamed to reviewed static part "${name}" (element ${el}${wantText !== undefined ? ` + content "${wantText}"` : ''}${candidates.length > 1 ? '; base-capture candidate preferred' : ''})`);
      pick.partName = name;
      captured.add(name);
    }
  }
}

// ---------------------------------------------------------------------------
// Presence factorization
// ---------------------------------------------------------------------------
export interface PresenceFact {
  /** visibleWhen on a boolean-true presence factor (≤1). */
  visibleWhen?: { prop: string };
  /** stylesWhen display:none entries for complement factors. */
  hiddenWhen: Array<{ prop: string; equals?: string }>;
  /** Defaultless-axis strategy: the part is HIDDEN AT BASE (declared
   *  display:none) and SHOWN per set value — the only spelling for
   *  "present iff the defaultless prop is set" (the unset pseudo-value is
   *  not a contract enum value, so hiddenWhen cannot name it). */
  shownWhen: Array<{ prop: string; equals: string }>;
  receipts: string[];
}

/** Factor a presence set over the enabled default-interaction combos.
 *  Returns null when presence does not factor as a product of per-axis sets
 *  (the part must then refuse promotion by name). `presenceProps` maps axis
 *  prop → true when the axis is a presence axis (off/on ↔ boolean false/
 *  true on the contract side). */
export function factorPresence(
  presentCombos: Combo[],
  allCombos: Combo[],
  axes: PropSpace['axes'],
  presenceProps: Set<string>,
  stateProps: string[],
  partName: string,
  /** Contract prop names — a factor can only spell conditions on real props
   *  (Button declares the disabled STATE with no disabled prop). */
  contractProps?: Set<string>,
): PresenceFact | null {
  const receipts: string[] = [];
  if (presentCombos.length === allCombos.length) return { hiddenWhen: [], shownWhen: [], receipts };
  if (presentCombos.length === 0) return null;
  const presentKeys = new Set(presentCombos.map((c) => c.key));
  // per-axis observed value sets among present combos (state props are axes
  // too — value 'true'/'false')
  const axisNames = [...axes.map((a) => a.prop), ...stateProps];
  const valueOf = (c: Combo, ax: string): string =>
    ax in c.axisValues ? c.axisValues[ax] : String(c.stateFlags[ax]);
  const valuesFor = (ax: string): string[] => {
    const a = axes.find((x) => x.prop === ax);
    return a ? a.values : ['false', 'true'];
  };
  const sets = new Map<string, Set<string>>();
  for (const ax of axisNames) sets.set(ax, new Set(presentCombos.map((c) => valueOf(c, ax))));
  // product check: every combo whose per-axis values are all in the sets
  // must be present, and vice versa (vice versa holds by construction).
  for (const c of allCombos) {
    const inProduct = axisNames.every((ax) => sets.get(ax)!.has(valueOf(c, ax)));
    if (inProduct !== presentKeys.has(c.key)) {
      return null; // not a product — refuse upstream by name
    }
  }
  const fact: PresenceFact = { hiddenWhen: [], shownWhen: [], receipts };
  for (const ax of axisNames) {
    const va = sets.get(ax)!;
    const all = valuesFor(ax);
    if (va.size === all.length) continue; // axis does not constrain presence
    const spec = axes.find((x) => x.prop === ax);
    if (spec?.unset !== undefined && !presenceProps.has(ax) && !va.has(spec.unset)) {
      // defaultless enum axis, present only when SET: base-hidden strategy —
      // the unset pseudo-value is not a contract enum value, so the
      // complement has no hiddenWhen spelling. Show per set value instead.
      for (const v of all) {
        if (v === spec.unset || !va.has(v)) continue;
        fact.shownWhen.push({ prop: ax, equals: v });
      }
      continue;
    }
    if (presenceProps.has(ax)) {
      if (va.size === 1 && va.has(PRESENCE_ON)) {
        if (fact.visibleWhen) {
          // two boolean-true factors — visibleWhen carries one; the second
          // has no complement spelling (stylesWhen booleans are truthy-only)
          receipts.push(`presence-second-boolean-factor: ${partName} also requires ${ax}=on — carried via visibleWhen on ${fact.visibleWhen.prop} only; residue named`);
          return null;
        }
        fact.visibleWhen = { prop: ax };
      } else if (va.size === 1 && va.has(PRESENCE_OFF)) {
        // present only when the boolean is OFF → hidden when ON (truthy)
        fact.hiddenWhen.push({ prop: ax });
      }
    } else if (stateProps.includes(ax)) {
      if (va.size === 1 && va.has('false')) {
        if (contractProps && !contractProps.has(ax)) {
          // the contract declares the STATE with no prop (Button disabled) —
          // there is no stylesWhen spelling; DROP the factor (the part
          // renders in the state plane too), receipted.
          receipts.push(`state-axis-presence-dropped: ${partName} absent under ${ax} but the contract has no "${ax}" prop — factor dropped, part renders in that plane (named residue)`);
        } else {
          fact.hiddenWhen.push({ prop: ax });
        }
      } else return null; // present only when disabled — no spelling
    } else {
      // enum axis: hide on each complement value (the unset pseudo-value is
      // handled by the base-hidden branch above and never lands here)
      for (const v of all) {
        if (v === spec?.unset) continue;
        if (!va.has(v)) fact.hiddenWhen.push({ prop: ax, equals: v });
      }
    }
  }
  return fact;
}

// ---------------------------------------------------------------------------
// SVG reconstruction from captured computed truth
// ---------------------------------------------------------------------------
const pxNum = (v: string | undefined): number | null => {
  if (!v) return null;
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v);
  return m ? Number(m[1]) : null;
};

/** Reconstruct inline SVG markup for one captured <svg> subtree. Returns
 *  null with a receipt when a child is not a <path> (bounded v1 grammar). */
export function reconstructSvg(
  svgEl: CapturedNode,
  receipts: string[],
  label: string,
): { markup: string; size: number } | null {
  const w = pxNum(svgEl.style['width']);
  const h = pxNum(svgEl.style['height']);
  if (w === null || h === null || w <= 0 || h <= 0) {
    receipts.push(`svg-size-unreadable: ${label} — computed width/height not px; asset refused`);
    return null;
  }
  const paths: string[] = [];
  let maxCoord = 0;
  const walkPaths = (n: CapturedNode): boolean => {
    for (const c of n.nodes) {
      if (c.t !== 'el') continue;
      const el = c.el;
      if (el.tag === 'path') {
        const dRaw = el.style['d'] ?? '';
        const m = /^path\("(.*)"\)$/.exec(dRaw);
        if (!m) {
          receipts.push(`svg-path-d-unreadable: ${label} — computed d "${dRaw.slice(0, 40)}"; asset refused`);
          return false;
        }
        const d = m[1];
        for (const num of d.match(/-?\d+(?:\.\d+)?/g) ?? []) {
          maxCoord = Math.max(maxCoord, Math.abs(Number(num)));
        }
        const fill = el.style['fill'] ?? '';
        const fillRule = el.style['fill-rule'];
        const opacity = el.style['opacity'];
        // STROKE channels (round 4 fix: Polaris's checkmark is a STROKED
        // path — fill-only reconstruction rendered it invisible). Computed
        // px lengths convert to user units 1:1 (viewBox == computed size).
        const stroke = el.style['stroke'];
        const strokeAttrs: string[] = [];
        if (stroke && stroke !== 'none') {
          strokeAttrs.push(` stroke="${stroke}"`);
          const sw = el.style['stroke-width'];
          const swNum = /^(-?\d+(?:\.\d+)?)px$/.exec(sw ?? '');
          if (swNum && Number(swNum[1]) !== 1) strokeAttrs.push(` stroke-width="${swNum[1]}"`);
          for (const [ch, attr] of [
            ['stroke-linecap', 'stroke-linecap'],
            ['stroke-linejoin', 'stroke-linejoin'],
          ] as const) {
            const v = el.style[ch];
            if (v && v !== 'butt' && v !== 'miter') strokeAttrs.push(` ${attr}="${v}"`);
          }
          for (const ch of ['stroke-dasharray', 'stroke-dashoffset'] as const) {
            const v = el.style[ch];
            if (v && v !== 'none' && v !== '0px') strokeAttrs.push(` ${ch}="${v.replace(/px/g, '')}"`);
          }
        }
        paths.push(
          `<path d="${d}"` +
            (fill ? ` fill="${fill}"` : '') +
            (fillRule === 'evenodd' ? ' fill-rule="evenodd"' : '') +
            (opacity && opacity !== '1' ? ` opacity="${opacity}"` : '') +
            strokeAttrs.join('') +
            '/>',
        );
      } else if (el.tag === 'g') {
        if (!walkPaths(el)) return false;
      } else {
        receipts.push(`svg-child-outside-grammar: ${label} — <${el.tag}> (v1 carries path/g only); asset refused`);
        return false;
      }
    }
    return true;
  };
  if (!walkPaths(svgEl)) return null;
  if (paths.length === 0) {
    receipts.push(`svg-empty: ${label} — no path children; asset refused`);
    return null;
  }
  // viewBox reconstruction (NAMED): the viewBox attribute is not a computed
  // style — reconstructed as 0 0 W H from the svg's computed size, sanity-
  // checked against the path data's coordinate extent (a glyph drawn in a
  // larger user space than its box would silently crop).
  let vb = Math.round(Math.max(w, h));
  if (maxCoord > vb * 1.02) {
    const bumped = Math.ceil(maxCoord);
    receipts.push(`svg-viewbox-bumped: ${label} — computed size ${vb} < path extent ${maxCoord}; viewBox reconstructed as 0 0 ${bumped} ${bumped} (named reconstruction)`);
    vb = bumped;
  } else {
    receipts.push(`svg-viewbox-reconstructed: ${label} — 0 0 ${vb} ${vb} from computed size ${w}×${h} (path extent ${maxCoord.toFixed(1)}; viewBox is not a computed style — named reconstruction)`);
  }
  return {
    markup: `<svg viewBox="0 0 ${vb} ${vb}" xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>`,
    size: Math.round(Math.max(w, h)),
  };
}

// ---------------------------------------------------------------------------
// Anatomy promotion
// ---------------------------------------------------------------------------
export interface PromotionResult {
  /** Static contract clone with computed-only parts PROMOTED at their
   *  captured nesting positions (and presence boolean props added). */
  contract: Contract;
  /** New icon assets: asset name → svg markup (run.ts writes the files). */
  assets: Map<string, string>;
  /** Union indices whose channels are CONSUMED by svg assets (the svg
   *  element and its descendants) — excluded from styled-channel minting. */
  consumed: Set<number>;
  /** partName → union index for every promoted or matched part. */
  partIndex: Map<string, number>;
  receipts: string[];
  /** Parts refused promotion, with named reasons. */
  refusals: string[];
}

const isEnabledCombo = (c: Combo): boolean => Object.values(c.stateFlags).every((f) => !f);

/** Whether a union entry is an svg subtree root whose parent is a
 *  single-purpose icon wrapper (span with only this svg child). */
function svgTarget(e: UnionNode): { host: UnionNode; svg: UnionNode } | null {
  if (e.rep.tag !== 'svg') return null;
  const parent = e.parent;
  if (
    parent &&
    parent.children.length === 1 &&
    parent.children[0] === e &&
    !parent.rep.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0)
  ) {
    return { host: parent, svg: e };
  }
  return e.parent ? { host: e, svg: e } : null;
}

export function promoteAnatomy(
  space: PropSpace,
  comp: ComponentConfig,
  union: UnionResult,
  componentKebab: string,
): PromotionResult {
  const receipts: string[] = [];
  const refusals: string[] = [];
  const assets = new Map<string, string>();
  const consumed = new Set<number>();
  const contract = structuredClone(space.contract) as Contract;
  const entries = union.entries;
  const idxOf = new Map(entries.map((e, i) => [e.id, i] as const));
  const staticByName = new Map(walkAnatomy(contract).map((w) => [w.name, w.part] as const));
  const enabled = space.enumeration.combos.filter(isEnabledCombo);
  const presenceProps = new Set(space.presence.keys());
  const stateProps = space.stateProps.map((s) => s.prop);

  // 1. presence boolean props (structure-creating optional props) join the
  //    contract's prop list.
  for (const pp of space.presence.values()) {
    if (contract.props.some((p) => p.name === pp.prop)) continue;
    contract.props.push({
      name: pp.prop,
      description: `Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's \`${pp.libraryProp}\` (${JSON.stringify(pp.value).slice(0, 60)}); the created subtree is carried as parts gated on this prop.`,
      type: 'boolean',
      default: false,
      bindings: {
        figma: { kind: 'BOOLEAN', property: `Show ${pp.prop.charAt(0).toUpperCase()}${pp.prop.slice(1)}` },
        code: { prop: pp.prop },
      },
    } as Contract['props'][number]);
    receipts.push(`presence-prop-added: ${pp.prop} (boolean, default false; library prop ${pp.libraryProp})`);
  }

  // 2. presence facts per union entry (over enabled default-state captures).
  const presentBy = new Map<number, Combo[]>();
  for (const combo of enabled) {
    const els = union.alignedByKey.get(`${combo.key}__default`);
    if (!els) continue;
    entries.forEach((e, i) => {
      if (els[i]) (presentBy.get(i) ?? presentBy.set(i, []).get(i)!).push(combo);
    });
  }

  // 3. svg targets: map host union index → per-combo markup.
  interface SvgPlan {
    hostIdx: number;
    /** value-keyed markup: axis prop + per-value assets, or single asset. */
    perValue: Array<{ value?: string; prop?: string; asset: string; size: number }>;
  }
  const svgPlans = new Map<number, SvgPlan>(); // host idx → plan
  const svgHostOf = new Map<number, number>(); // svg idx → host idx
  for (const e of entries) {
    const t = svgTarget(e);
    if (!t) continue;
    const hostIdx = idxOf.get(t.host.id)!;
    const svgIdx = idxOf.get(t.svg.id)!;
    if (svgPlans.has(hostIdx)) continue;
    svgHostOf.set(svgIdx, hostIdx);
    // per-combo markup over combos where the svg is present
    const markups = new Map<string, { markup: string; size: number }>(); // comboKey → markup
    for (const combo of presentBy.get(svgIdx) ?? []) {
      const els = union.alignedByKey.get(`${combo.key}__default`)!;
      const el = els[svgIdx];
      if (!el) continue;
      const r = reconstructSvg(el.node, receipts, `${comp.name}.${t.host.partName}@${combo.key}`);
      if (r) markups.set(combo.key, { markup: r.markup, size: r.size });
    }
    if (markups.size === 0) continue;
    // correlate: uniform | single-axis | refuse
    const distinct = new Map<string, string[]>(); // markup → combo keys
    for (const [k, m] of markups) (distinct.get(m.markup) ?? distinct.set(m.markup, []).get(m.markup)!).push(k);
    const kebabValue = (v: string) => v.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    if (distinct.size === 1) {
      const name = `${componentKebab}-${kebabValue(t.host.partName)}`;
      assets.set(name, [...markups.values()][0].markup);
      svgPlans.set(hostIdx, { hostIdx, perValue: [{ asset: name, size: [...markups.values()][0].size }] });
    } else {
      // single-axis explanation: find an axis whose value partitions markup
      const comboByKey = new Map(enabled.map((c) => [c.key, c] as const));
      const axis = space.axes.find((ax) => {
        const byValue = new Map<string, Set<string>>();
        for (const [k, m] of markups) {
          const v = comboByKey.get(k)!.axisValues[ax.prop];
          (byValue.get(v) ?? byValue.set(v, new Set()).get(v)!).add(m.markup);
        }
        return [...byValue.values()].every((s) => s.size === 1);
      });
      if (!axis) {
        refusals.push(`svg-content-multi-axis: ${comp.name}.${t.host.partName} — markup varies over more than one axis; asset refused (part still promoted as a box)`);
        continue;
      }
      const perValue: SvgPlan['perValue'] = [];
      const seenValues = new Set<string>();
      for (const [k, m] of markups) {
        const v = comboByKey.get(k)!.axisValues[axis.prop];
        if (seenValues.has(v)) continue;
        seenValues.add(v);
        const name = `${componentKebab}-${kebabValue(t.host.partName)}-${kebabValue(v)}`;
        assets.set(name, m.markup);
        perValue.push({ value: v, prop: axis.prop, asset: name, size: m.size });
      }
      svgPlans.set(hostIdx, { hostIdx, perValue });
    }
    // consume the svg subtree (svg element + descendants)
    const consume = (u: UnionNode) => {
      consumed.add(idxOf.get(u.id)!);
      for (const c of u.children) consume(c);
    };
    consume(t.svg);
  }

  // 4. build the promoted anatomy tree in union order.
  const rootEntry = entries[0];
  const rootPart = contract.anatomy['root'];
  if (!rootPart) throw new Error(`${comp.name}: contract has no root anatomy part`);
  const partIndex = new Map<string, number>();

  const textOf = (n: CapturedNode): string =>
    n.nodes.filter((c) => c.t === 'text').map((c) => (c as { v: string }).v).join('').trim();
  const samplesByProp = new Map<string, string>();
  for (const p of contract.props) {
    if (p.type !== 'text') continue;
    if (p.bindings.code.prop === 'children') samplesByProp.set(p.name, comp.sampleText);
    else {
      const fixed = comp.fixedProps?.[p.name];
      if (typeof fixed === 'string') samplesByProp.set(p.name, fixed);
    }
  }

  /** Build a Part for a union entry (recursing into children). Returns null
   *  when the entry (and subtree) refuses promotion. */
  const buildPart = (e: UnionNode): Part | null => {
    const i = idxOf.get(e.id)!;
    if (consumed.has(i) && !svgPlans.has(i)) return null; // svg internals
    const existing = staticByName.get(e.partName);
    const part: Part = existing ? structuredClone(existing) : {};
    if (existing) delete part.parts; // children re-derived from the captured tree
    else {
      // element: captured tag (span/div default conventions preserved)
      const hasText = e.rep.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0);
      if (e.rep.tag !== 'div' && !(hasText && e.rep.tag === 'span')) part.element = e.rep.tag;
      // text/content binding
      if (hasText) {
        const txt = textOf(e.rep);
        const boundProp = [...samplesByProp.entries()].find(([, v]) => v === txt)?.[0];
        if (boundProp) part.content = { prop: boundProp };
        else {
          part.text = txt;
          receipts.push(`literal-text-carried: ${e.partName} = "${txt.slice(0, 40)}" (no text prop sample matches — the mounted value is carried verbatim)`);
        }
      }
      part.description = `Promoted from the computed floor (round 4): rendered anatomy ${e.sig} — this element exists in the real component's DOM; the static layer had no part for it.`;
    }

    // Visually-hidden (sr-only) fact: the real component clips these parts
    // out of the visual (clip-path inset(50%) / 1px clip box). The promoted
    // part carries declared display:none — visually identical; the a11y
    // surface of the GENERATED component is contract-owned (semantics/role),
    // NAMED as a downgrade receipt.
    const srOnly = (() => {
      const st = e.rep.style;
      if ((st['clip-path'] ?? '').startsWith('inset(50%')) return true;
      if (st['overflow'] === 'hidden' && st['width'] === '1px' && st['height'] === '1px') return true;
      return false;
    })();
    if (srOnly) {
      part.declared = { ...part.declared, display: 'none' };
      receipts.push(`sr-only-carried-as-hidden: ${e.partName} is visually hidden in the real component (clip-path/1px box) — promoted with declared display:none (visual parity exact; AT semantics ride the contract's own semantics — NAMED downgrade)`);
      return part; // no children/facts needed beyond the hidden box
    }

    // Absolute-position fact: a promoted part whose computed position is
    // uniformly absolute is an overlay (Thumbnail's img fills its card) —
    // carried via the declared registry (round 4 grammar); its inset
    // channels mint like any other px channel.
    {
      const positions = new Set<string>();
      for (const combo of presentBy.get(i) ?? []) {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        if (el) positions.add(el.node.style['position']);
      }
      if (positions.size === 1 && [...positions][0] === 'absolute') {
        part.declared = { ...part.declared, position: 'absolute' };
      }
    }

    // img parts: the capture reads no attributes — src/alt are wired by
    // prop-name heuristic (source/src → src, alt/accessibilityLabel → alt),
    // receipted; without a src the promoted img is an empty broken box.
    if (e.rep.tag === 'img') {
      const findProp = (...names: string[]) => contract.props.find((pr) => pr.type === 'text' && names.includes(pr.name))?.name;
      const srcProp = findProp('source', 'src');
      const altProp = findProp('alt', 'accessibilityLabel');
      const attrs: Record<string, string> = {};
      if (srcProp) attrs['src'] = `{${srcProp}}`;
      if (altProp) attrs['alt'] = `{${altProp}}`;
      if (Object.keys(attrs).length > 0) {
        part.attrs = { ...attrs, ...part.attrs };
        receipts.push(`img-attrs-wired: ${e.partName} src/alt bound by prop-name heuristic (${Object.entries(attrs).map(([a, v]) => `${a}=${v}`).join(', ')}) — the capture reads no attributes (named)`);
      }
    }

    // Display fact: every promoted part carries its computed display
    // EXPLICITLY — the emitters default structural parts to flex, but the
    // real tree mixes block/inline containers, and a wrong container display
    // cascades (flex-item blockification turned Banner's body span into a
    // block and let a block Box render as a flex row). flex/inline-flex ride
    // Part.layout (the schema's own vocabulary; enrichLayout adds
    // direction/align/justify); other uniform keywords ride Part.declared.
    {
      const displays = new Set<string>();
      for (const combo of presentBy.get(i) ?? []) {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        if (el) displays.add(el.node.style['display']);
      }
      if (displays.size === 1) {
        const d = [...displays][0];
        if (d === 'flex' || d === 'inline-flex') {
          part.layout = { display: d as 'flex' | 'inline-flex', ...part.layout };
        } else if (/^(inline|inline-block|block|contents|none)$/.test(d)) {
          part.declared = { display: d, ...part.declared };
        } else {
          receipts.push(`display-outside-vocabulary: ${e.partName} = "${d}" — carried by neither layout nor the declared registry (named residue)`);
        }
      } else if (displays.size > 1) {
        receipts.push(`display-varies: ${e.partName} = {${[...displays].sort().join(', ')}} across combos — no per-axis display spelling (named residue)`);
      }
    }

    // Aspect fact (geometry evidence): computed width == height in EVERY
    // enabled combo (>0, ≥2 distinct sizes or a sized axis) — the real
    // component keeps the square via pseudo-element padding hacks (Avatar's
    // ::after) that anatomy cannot carry; the RATIO is the carried fact.
    {
      const px = (v: string | undefined): number | null => {
        const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v ?? '');
        return m ? Number(m[1]) : null;
      };
      let square = false;
      const sizes = new Set<number>();
      for (const combo of presentBy.get(i) ?? []) {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        if (!el) { square = false; break; }
        const w = px(el.node.style['width']);
        const h = px(el.node.style['height']);
        if (w === null || h === null || w <= 0 || Math.abs(w - h) > 0.6) { square = false; break; }
        sizes.add(Math.round(w));
        square = true;
      }
      // require ≥2 observed sizes: a single square observation could be
      // coincidence; a size axis driving both dimensions is the evidence.
      if (square && sizes.size >= 2) {
        part.declared = { ...part.declared, 'aspect-ratio': '1 / 1' };
        receipts.push(`aspect-carried: ${e.partName} computed width == height in every enabled combo (${[...sizes].sort((a, b) => a - b).join('/')}px) → declared aspect-ratio 1 / 1 (geometry evidence; the real square rides a pseudo-element padding hack)`);
      }
    }

    // Full-width fact (geometry evidence): a part inside a ROW flex parent
    // whose computed width equals the parent's content width in EVERY
    // enabled combo spans the row — carried as layout.grow (flex: 1 1 auto),
    // the schema's own spelling. Without it, promoted containers hug and
    // justify: space-between has no room to justify (the Banner dismiss ×
    // rendered next to the title instead of at the ribbon's right edge).
    if (e.parent) {
      const pi = idxOf.get(e.parent.id)!;
      const px = (v: string | undefined): number | null => {
        const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v ?? '');
        return m ? Number(m[1]) : null;
      };
      let fullWidth = false;
      for (const combo of presentBy.get(i) ?? []) {
        const els = union.alignedByKey.get(`${combo.key}__default`)!;
        const self = els[i];
        const parent = els[pi];
        if (!self || !parent) { fullWidth = false; break; }
        const ps = parent.node.style;
        if (ps['display'] !== 'flex' && ps['display'] !== 'inline-flex') { fullWidth = false; break; }
        const dir = ps['flex-direction'] ?? 'row';
        if (dir !== 'row') { fullWidth = false; break; }
        const w = px(self.node.style['width']);
        const pw = px(ps['width']);
        const padL = px(ps['padding-left']) ?? 0;
        const padR = px(ps['padding-right']) ?? 0;
        if (w === null || pw === null) { fullWidth = false; break; }
        if (Math.abs(w - (pw - padL - padR)) > 0.6) { fullWidth = false; break; }
        fullWidth = true;
      }
      if (fullWidth) {
        part.layout = { ...part.layout, grow: true };
        receipts.push(`full-width-carried: ${e.partName} spans its row parent's content width in every enabled combo → layout.grow (geometry evidence)`);
      }
    }

    // presence facts
    const present = presentBy.get(i) ?? [];
    if (present.length < enabled.length) {
      const fact = factorPresence(present, enabled, space.axes, presenceProps, stateProps, e.partName, new Set(contract.props.map((p) => p.name)));
      if (!fact) {
        refusals.push(`part-presence-uncorrelated: ${e.partName} present in ${present.length}/${enabled.length} enabled combos and the presence set does not factor per-axis — part NOT promoted (named refusal; a phantom always-drawn part would be worse)`);
        return null;
      }
      if (fact.visibleWhen) part.visibleWhen = { prop: fact.visibleWhen.prop };
      if (fact.shownWhen.length > 0) {
        // base-hidden: declared display none; each SET value restores the
        // part's own uniform display (captured; flex default for containers)
        const restore =
          part.layout?.display ??
          (part.declared?.['display'] && part.declared['display'] !== 'none' ? part.declared['display'] : undefined) ??
          (Object.keys(e.children).length > 0 ? 'flex' : 'inline');
        part.declared = { ...part.declared, display: 'none' };
        part.stylesWhen = [
          ...(part.stylesWhen ?? []),
          ...fact.shownWhen.map((sw) => ({ prop: sw.prop, equals: sw.equals, styles: { display: String(restore) } })),
        ];
      }
      if (fact.hiddenWhen.length > 0) {
        part.stylesWhen = [
          ...(part.stylesWhen ?? []),
          ...fact.hiddenWhen.map((hw) => ({ prop: hw.prop, ...(hw.equals !== undefined ? { equals: hw.equals } : {}), styles: { display: 'none' } })),
        ];
      }
      receipts.push(...fact.receipts);
      receipts.push(
        `presence-carried: ${e.partName} (${present.length}/${enabled.length} combos) → ${part.visibleWhen ? `visibleWhen ${part.visibleWhen.prop}` : ''}${fact.shownWhen.length ? ` base-hidden, shown-when ${fact.shownWhen.map((h) => `${h.prop}=${h.equals}`).join(', ')}` : ''}${fact.hiddenWhen.length ? ` hidden-when ${fact.hiddenWhen.map((h) => h.equals ? `${h.prop}=${h.equals}` : h.prop).join(', ')}` : ''}`,
      );
    }

    // svg host → icon part(s)
    const plan = svgPlans.get(i);
    if (plan) {
      if (e.rep.tag === 'svg') delete part.element; // icon parts render their own <svg> from the asset
      if (plan.perValue.length === 1 && plan.perValue[0].value === undefined) {
        part.icon = { asset: plan.perValue[0].asset, size: plan.perValue[0].size };
        // the host element wraps the glyph; its own element stays
        return part;
      }
      // per-value icon parts nested under the host box part (names prefixed
      // by the host part — part names are contract-global). A glyph keyed by
      // the UNSET pseudo-value of a defaultless axis is the DEFAULT glyph:
      // visible unless a set value applies (stylesWhen display:none per set
      // value — the pseudo-value is not a contract enum value).
      part.parts = {};
      for (const pv of plan.perValue) {
        const axisSpec = space.axes.find((ax) => ax.prop === pv.prop);
        const isUnsetValue = axisSpec?.unset !== undefined && pv.value === axisSpec.unset;
        const child: Part = {
          icon: { asset: pv.asset, size: pv.size },
          ...(isUnsetValue
            ? {
                stylesWhen: axisSpec!.values
                  .filter((v) => v !== axisSpec!.unset)
                  .map((v) => ({ prop: pv.prop!, equals: v, styles: { display: 'none' } })),
              }
            : { visibleWhen: { prop: pv.prop!, equals: pv.value } }),
          description: `Per-value svg content promoted from the computed floor: the glyph drawn when ${pv.prop}=${isUnsetValue ? `unset (default)` : pv.value}.`,
        };
        part.parts[`${e.partName}-${pv.value!.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`] = child;
      }
      return part;
    }

    // children
    const childParts: Record<string, Part> = {};
    for (const c of e.children) {
      const cp = buildPart(c);
      if (cp) childParts[c.partName] = cp;
    }
    if (Object.keys(childParts).length > 0) part.parts = childParts;
    return part;
  };

  // root: keep the reviewed root part's facts, replace its children with the
  // captured nesting; unmatched static parts are re-attached afterwards.
  const newRoot = structuredClone(rootPart);
  delete newRoot.parts;
  const rootChildren: Record<string, Part> = {};
  for (const c of rootEntry.children) {
    const cp = buildPart(c);
    if (cp) rootChildren[c.partName] = cp;
  }
  if (Object.keys(rootChildren).length > 0) newRoot.parts = rootChildren;

  // static parts that neither matched nor re-joined: kept OUT (they never
  // rendered in any captured combo — drawing them would be phantom ink), a
  // named receipt each. Their reviewed facts are recoverable from the static
  // contract in git.
  const promotedNames = new Set<string>();
  const collectNames = (p: Part, name: string) => {
    promotedNames.add(name);
    for (const [n, c] of Object.entries(p.parts ?? {})) collectNames(c, n);
  };
  collectNames(newRoot, 'root');
  for (const [name] of staticByName) {
    if (!promotedNames.has(name)) {
      refusals.push(`static-part-unrendered: reviewed static part "${name}" has no rendered counterpart in ANY captured combo — dropped from the promoted anatomy (named; usually a conditional the sweep never triggered)`);
    }
  }

  contract.anatomy = { root: newRoot };
  entries.forEach((e, i) => {
    if (promotedNames.has(e.partName)) partIndex.set(e.partName, i);
  });

  return { contract, assets, consumed, partIndex, receipts, refusals };
}
