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

/** Visually-hidden (sr-only) style signature: clip-path inset(50%) or the
 *  1px clip box. Part of the UNION signature — a toned Badge renders an
 *  sr-only announcement span with the same tag+stems as the visible label,
 *  and occurrence matching would otherwise swap their identities. */
export const isSrOnlyStyle = (st: Record<string, string>): boolean =>
  (st['clip-path'] ?? '').startsWith('inset(50%') ||
  (st['overflow'] === 'hidden' && st['width'] === '1px' && st['height'] === '1px');

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
  const sigOf = (node: CapturedNode): string =>
    `${signature(node, classPrefix)}${isSrOnlyStyle(node.style) ? '|sr-only' : ''}`;
  const mk = (node: CapturedNode, path: string, parent: UnionNode | null, inBase: boolean, repKey: string): UnionNode => ({
    id: nextId++,
    sig: sigOf(node),
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
      const sig = sigOf(node);
      if (sig !== u.sig && u.parent === null) {
        receipts.push(`root-signature-varies: ${key}: ${u.sig} → ${sig} (element-varies receipt; root always aligns)`);
      }
      out.set(u.id, { path, sig, partName: '', node });
      // TWO-PASS document-order merge: first match capture children to union
      // children by (signature, nth occurrence); then walk in capture order,
      // inserting NEW union nodes at the cursor — BEFORE the next matched
      // sibling — so union order follows document order (the Badge pip sits
      // LEFT of the label) while existing union nodes never reorder.
      const bySig = new Map<string, UnionNode[]>();
      for (const uc of u.children) (bySig.get(uc.sig) ?? bySig.set(uc.sig, []).get(uc.sig)!).push(uc);
      const used = new Map<string, number>();
      const pairs: Array<{ el: CapturedNode; path: string; match: UnionNode | null; sig: string }> = [];
      let i = 0;
      for (const c of node.nodes) {
        if (c.t !== 'el') continue;
        const childPath = path === '' ? String(i) : `${path}.${i}`;
        i++;
        const csig = sigOf(c.el);
        const n = used.get(csig) ?? 0;
        used.set(csig, n + 1);
        const list = bySig.get(csig);
        pairs.push({ el: c.el, path: childPath, match: list && n < list.length ? list[n] : null, sig: csig });
      }
      let cursor = 0;
      for (const pr of pairs) {
        if (pr.match) {
          const at = u.children.indexOf(pr.match);
          if (at >= cursor) cursor = at + 1;
          else receipts.push(`union-order-drift: ${key} @${pr.path} (${pr.sig}) matched behind the cursor — document order varies across captures (named)`);
          align(pr.match, pr.el, pr.path);
        } else {
          const uc = mk(pr.el, pr.path, u, false, key);
          u.children.splice(cursor, 0, uc);
          cursor++;
          receipts.push(`union-part-added: ${key} @${pr.path} (${pr.sig})`);
          align(uc, pr.el, pr.path);
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
  // BASE-capture entries claim names first (DFS order), then off-base
  // entries — an off-base subtree inserted before a base element (linked
  // Tag's inner text) must never steal the base element's name.
  const ordered = [...entries.filter((e) => e.inBase), ...entries.filter((e) => !e.inBase)];
  for (const e of ordered) {
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

/** Round 5c — COMPLEMENT-OF-PRODUCT presence (the Tag default-label class).
 *  A default subtree that an ALTERNATIVE subtree replaces (Tag's label moves
 *  inside the link when `linked` is set and `clickable` is not) has a
 *  presence set that is the COMPLEMENT of a product — the product test
 *  refuses it, and round 5a showed that refusal blanks the whole component.
 *  When the ABSENCE set factors as a product of per-axis sets, the part is
 *  spellable as an ORDERED stylesWhen cascade: hide entries on ONE trigger
 *  axis's absence values, then RESTORE entries on every other constraining
 *  axis's complement values — later rules win at equal specificity, so
 *  hidden(c) = trigger-matches(c) ∧ ¬restore-matches(c) = the absence
 *  product, exactly. The chain is VERIFIED against every captured combo
 *  before it is carried; anything unverifiable refuses by name.
 *
 *  Domain note: this runs over ALL default-interaction combos (state planes
 *  included — a disabled Tag renders the plain label even when linked), so
 *  the disabled restore is part of the carried truth. */
export interface ComplementFact {
  hide: Array<{ prop: string; equals?: string }>;
  restore: Array<{ prop: string; equals?: string }>;
  receipts: string[];
}

export function factorComplement(
  presentKeys: Set<string>,
  allCombos: Combo[],
  axes: PropSpace['axes'],
  presenceProps: Set<string>,
  stateProps: string[],
  partName: string,
  contractProps: Set<string>,
): ComplementFact | null {
  const absent = allCombos.filter((c) => !presentKeys.has(c.key));
  if (absent.length === 0 || absent.length === allCombos.length) return null;
  const axisNames = [...axes.map((a) => a.prop), ...stateProps];
  const valueOf = (c: Combo, ax: string): string =>
    ax in c.axisValues ? c.axisValues[ax] : String(c.stateFlags[ax]);
  const valuesFor = (ax: string): string[] => {
    const a = axes.find((x) => x.prop === ax);
    return a ? a.values : ['false', 'true'];
  };
  const sets = new Map(axisNames.map((ax) => [ax, new Set(absent.map((c) => valueOf(c, ax)))] as const));
  const absentKeys = new Set(absent.map((c) => c.key));
  for (const c of allCombos) {
    const inProduct = axisNames.every((ax) => sets.get(ax)!.has(valueOf(c, ax)));
    if (inProduct !== absentKeys.has(c.key)) return null; // absence is not a product either
  }
  const constraining = axisNames.filter((ax) => sets.get(ax)!.size < valuesFor(ax).length);
  if (constraining.length === 0) return null;
  /** stylesWhen conditions selecting exactly `values` of axis `ax`, or null
   *  when the vocabulary has no spelling (truthy-only booleans; the unset
   *  pseudo-value is not a contract enum value; a state axis needs a real
   *  contract prop). */
  const spell = (ax: string, values: string[]): Array<{ prop: string; equals?: string }> | null => {
    if (values.length === 0) return null;
    if (presenceProps.has(ax)) {
      return values.length === 1 && values[0] === PRESENCE_ON ? [{ prop: ax }] : null;
    }
    if (stateProps.includes(ax)) {
      return values.length === 1 && values[0] === 'true' && contractProps.has(ax) ? [{ prop: ax }] : null;
    }
    const spec = axes.find((x) => x.prop === ax);
    if (!spec || !contractProps.has(ax)) return null;
    if (values.some((v) => v === spec.unset)) return null; // unset pseudo-value has no condition spelling
    return values.map((v) => ({ prop: ax, equals: v }));
  };
  const matches = (cond: { prop: string; equals?: string }, c: Combo): boolean => {
    const v = valueOf(c, cond.prop);
    if (cond.equals !== undefined) return v === cond.equals;
    return presenceProps.has(cond.prop) ? v === PRESENCE_ON : v === 'true';
  };
  for (const trigger of constraining) {
    const hide = spell(trigger, [...sets.get(trigger)!]);
    if (!hide) continue;
    const restore: Array<{ prop: string; equals?: string }> = [];
    let ok = true;
    for (const other of constraining) {
      if (other === trigger) continue;
      const complement = valuesFor(other).filter((v) => !sets.get(other)!.has(v));
      const r = spell(other, complement);
      if (!r) { ok = false; break; }
      restore.push(...r);
    }
    if (!ok) continue;
    // VERIFY the cascade against every captured combo before carrying it.
    const verified = allCombos.every((c) => {
      const hidden = hide.some((h) => matches(h, c)) && !restore.some((r) => matches(r, c));
      return hidden === absentKeys.has(c.key);
    });
    if (!verified) continue;
    const fmt = (e: { prop: string; equals?: string }) => (e.equals !== undefined ? `${e.prop}=${e.equals}` : e.prop);
    return {
      hide,
      restore,
      receipts: [
        `presence-complement-carried: ${partName} absent in ${absent.length}/${allCombos.length} default-interaction combos — absence factors as a product; carried as ORDERED stylesWhen (hide on ${hide.map(fmt).join(', ')}${restore.length ? `; cascade-restored on ${restore.map(fmt).join(', ')}` : ''}) — verified against every captured combo (round 5c complement-of-product spelling)`,
      ],
    };
  }
  return null;
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
 *  null with a receipt when a child is not a <path> (bounded v1 grammar).
 *  Round 5c: the result also carries the reconstructed viewBox number, the
 *  path-coordinate extent, and whether the viewBox was BUMPED past the
 *  computed size — the authored-viewBox unification pass (promoteAnatomy)
 *  needs all three to recognize one authored glyph captured at many sizes. */
export function reconstructSvg(
  svgEl: CapturedNode,
  receipts: string[],
  label: string,
  /** Round 5c: prefer the currentColor spelling for fills equal to the
   *  inherited color — set ONLY when the fill==color identity holds in
   *  EVERY captured combo of this svg (a per-svg decision; a per-combo one
   *  splits one authored asset into per-variant markups — the Button icon
   *  regression this flag exists to prevent). */
  preferCurrentColor = false,
): { markup: string; size: number; vb: number; extent: number; bumped: boolean } | null {
  // A path fill equal to the svg's inherited `color` is CSS currentColor in
  // spirit — emitting it AS currentColor separates glyph SHAPE from color
  // (the Badge pip: shape = f(progress), color = f(tone); a baked fill made
  // the markup two-axis and refused the asset).
  const inheritedColor = svgEl.style['color'];
  const inheritedFill = svgEl.style['fill'];
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
        const fillRaw = el.style['fill'] ?? '';
        // fill equal to the svg's own computed fill is INHERITED (no
        // attribute — the host part's minted fill channel cascades in CSS);
        // fill equal to the inherited color is currentColor; else baked.
        // Round 5c: when the fill==color identity holds across EVERY combo
        // (preferCurrentColor — Spinner's `svg { fill: currentcolor }`), the
        // glyph rides the color chain on every surface. Otherwise the round-4
        // precedence stands: fill equal to the svg's own fill is INHERITED
        // (host fill channel cascades); fill equal to the color is
        // currentColor (Badge pip).
        const fill = preferCurrentColor && fillRaw && inheritedColor && fillRaw === inheritedColor
          ? 'currentColor'
          : fillRaw && inheritedFill && fillRaw === inheritedFill
            ? ''
            : fillRaw && inheritedColor && fillRaw === inheritedColor
              ? 'currentColor'
              : fillRaw;
        const fillRule = el.style['fill-rule'];
        const opacity = el.style['opacity'];
        // STROKE channels (round 4 fix: Polaris's checkmark is a STROKED
        // path — fill-only reconstruction rendered it invisible). Computed
        // px lengths convert to user units 1:1 (viewBox == computed size).
        const strokeRaw = el.style['stroke'];
        const stroke = strokeRaw && inheritedColor && strokeRaw === inheritedColor ? 'currentColor' : strokeRaw;
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
          // Round 5d (owner finding: the check glyph drew as SEGMENTED
          // CAPSULES, not a continuous check): dash channels are
          // pathLength-RELATIVE, and `pathLength` is an ATTRIBUTE — not a
          // computed style (the viewBox class). Polaris normalizes the
          // check path to pathLength=1 and drives stroke-dashoffset as a
          // draw-on animation; the computed 2px dasharray is the ANIMATION
          // VEHICLE, not resting geometry. Re-basing that pattern onto the
          // real ~14-user-unit path drew 2px capsules with joints. The
          // resting truth of a settled draw-on stroke is the CONTINUOUS
          // stroke — dash channels are dropped with a named receipt
          // (visibility still rides the captured opacity channel).
          const dash = el.style['stroke-dasharray'];
          const dashOffset = el.style['stroke-dashoffset'];
          if ((dash && dash !== 'none') || (dashOffset && dashOffset !== '0px')) {
            receipts.push(
              `svg-dash-channels-dropped: ${label} — stroke-dasharray ${dash || 'none'} / stroke-dashoffset ${dashOffset || '0px'} are pathLength-relative and pathLength is not a computed style (draw-on animation idiom); continuous stroke carried (named reconstruction)`,
            );
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
  let bumped = false;
  if (maxCoord > vb * 1.02) {
    const bumpedVb = Math.ceil(maxCoord);
    receipts.push(`svg-viewbox-bumped: ${label} — computed size ${vb} < path extent ${maxCoord}; viewBox reconstructed as 0 0 ${bumpedVb} ${bumpedVb} (named reconstruction)`);
    vb = bumpedVb;
    bumped = true;
  } else {
    receipts.push(`svg-viewbox-reconstructed: ${label} — 0 0 ${vb} ${vb} from computed size ${w}×${h} (path extent ${maxCoord.toFixed(1)}; viewBox is not a computed style — named reconstruction)`);
  }
  return {
    markup: `<svg viewBox="0 0 ${vb} ${vb}" xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>`,
    size: Math.round(Math.max(w, h)),
    vb,
    extent: maxCoord,
    bumped,
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
  // Round 5f — OPTIONAL-ADORNMENT (defaultless structure-gating enum): any
  // defaultless enum axis that gates a part PRESENT-ONLY-WHEN-SET (a
  // factorPresence base-hidden `shownWhen` fact — the adornment is ABSENT at
  // unset and appears per SET value: Badge `progress` → the status pip) is
  // collected here. After the anatomy is built, each such axis materializes
  // its UNSET pseudo-value into the contract enum AS THE DEFAULT, so the emit
  // enumerates a PLAIN (adornment-absent) variant and the base-hidden part
  // renders nothing there. This extends the S2 unset-axis machinery from
  // STYLING to STRUCTURE (the round's spine). Booleans are NOT touched —
  // presence booleans already default OFF and expose a toggle; a defaultless
  // enum that only drives STYLING (Badge `tone`) is NOT collected (it gates
  // no part), so its unset stays the S2 styling base plane, not a variant.
  const structureGatingUnsetAxes = new Set<string>();

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
  // Round 5c: presence over ALL default-interaction combos (state planes
  // included) — the complement-of-product spelling needs the full domain
  // (a disabled Tag renders the plain label even when linked).
  const allDefaultCombos = space.enumeration.combos.filter((c) => union.alignedByKey.has(`${c.key}__default`));
  const presentAllBy = new Map<number, Set<string>>();
  for (const combo of allDefaultCombos) {
    const els = union.alignedByKey.get(`${combo.key}__default`)!;
    entries.forEach((e, i) => {
      if (els[i]) (presentAllBy.get(i) ?? presentAllBy.set(i, new Set()).get(i)!).add(combo.key);
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
    // Round 5c: the currentColor preference is a PER-SVG decision — the
    // fill==color identity must hold in EVERY present combo (see
    // reconstructSvg's preferCurrentColor doc).
    let identityEverywhere = true;
    for (const combo of presentBy.get(svgIdx) ?? []) {
      const el = union.alignedByKey.get(`${combo.key}__default`)![svgIdx];
      if (!el) continue;
      const st = el.node.style;
      if (!st['fill'] || !st['color'] || st['fill'] !== st['color']) { identityEverywhere = false; break; }
    }
    const markups = new Map<string, { markup: string; size: number; vb: number; extent: number; bumped: boolean }>(); // comboKey → markup
    for (const combo of presentBy.get(svgIdx) ?? []) {
      const els = union.alignedByKey.get(`${combo.key}__default`)!;
      const el = els[svgIdx];
      if (!el) continue;
      const r = reconstructSvg(el.node, receipts, `${comp.name}.${t.host.partName}@${combo.key}`, identityEverywhere);
      if (r) markups.set(combo.key, r);
    }
    if (markups.size === 0) continue;
    // Round 5c — AUTHORED-VIEWBOX unification: one authored glyph captured
    // at several sizes carries IDENTICAL path data; the reconstruction can
    // only see the authored user space at the size whose computed box bounds
    // the path extent (Avatar Xl: 40 ≥ 38.6 — exact on the canvas gate).
    // Smaller captures were BUMPED to ceil(extent) — a guess the package
    // contradicts. Group by path data; when a group has an UNBUMPED member
    // whose viewBox bounds every member's extent, bumped members adopt that
    // authored space (receipted; per-size stroke widths stay captured truth).
    {
      const dOf = (m: string) => (m.match(/ d="[^"]*"/g) ?? []).join('|');
      const byPath = new Map<string, Array<{ key: string; r: { markup: string; size: number; vb: number; extent: number; bumped: boolean } }>>();
      for (const [k, r] of markups) {
        const sig = dOf(r.markup);
        (byPath.get(sig) ?? byPath.set(sig, []).get(sig)!).push({ key: k, r });
      }
      for (const group of byPath.values()) {
        if (group.length < 2) continue;
        const anchors = group.filter((g) => !g.r.bumped);
        if (anchors.length === 0) continue;
        const cand = Math.max(...anchors.map((g) => g.r.vb));
        for (const g of group) {
          if (!g.r.bumped || g.r.vb === cand) continue;
          if (cand < g.r.extent) continue; // the authored space must bound the paths
          receipts.push(
            `svg-viewbox-unified: ${comp.name}.${t.host.partName}@${g.key} — bumped 0 0 ${g.r.vb} ${g.r.vb} adopts the sibling capture's authored space 0 0 ${cand} ${cand} (identical path data drawn where the computed box bounds the extent — the package's own viewBox; round 5c)`,
          );
          g.r.markup = g.r.markup.replace(/viewBox="0 0 [\d.]+ [\d.]+"/, `viewBox="0 0 ${cand} ${cand}"`);
          g.r.vb = cand;
        }
      }
    }
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
    // consume the svg subtree. When the svg IS the host (no dedicated
    // wrapper), its OWN channels stay mintable — the per-tone fill cascades
    // to attribute-less paths in CSS; only descendants are consumed.
    const consume = (u: UnionNode) => {
      consumed.add(idxOf.get(u.id)!);
      for (const c of u.children) consume(c);
    };
    if (t.host === t.svg) {
      for (const c of t.svg.children) consume(c);
    } else {
      consume(t.svg);
    }
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

  /** Apply a compiled svg plan onto a HOST part: single asset → Part.icon;
   *  per-value assets → per-value icon child parts. Round 5c: extracted so
   *  the ROOT can host a plan too (Spinner's glyph is the root's only child
   *  — buildPart never runs on the root, and the plan silently dropped). */
  const applySvgPlan = (part: Part, e: UnionNode, plan: SvgPlan): void => {
    if (e.rep.tag === 'svg') delete part.element; // icon parts render their own <svg> from the asset
    if (plan.perValue.length === 1 && plan.perValue[0].value === undefined) {
      part.icon = { asset: plan.perValue[0].asset, size: plan.perValue[0].size };
      // the host element wraps the glyph; its own element stays
      return;
    }
    // per-value icon parts nested under the host box part (names prefixed
    // by the host part — part names are contract-global). A glyph keyed by
    // the UNSET pseudo-value of a defaultless axis is the DEFAULT glyph:
    // visible unless a set value applies (stylesWhen display:none per set
    // value — the pseudo-value is not a contract enum value).
    part.parts = { ...part.parts };
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
  };

  /** Round 5c — S5 first real slice: DRAWN pseudo-element DECOR BOXES
   *  promote as shape parts (the RadioButton ::before selected dot). The
   *  floor's read includes ::before/::after; until now every finding was
   *  extension residue. Bounded v1 grammar, everything else refuses by name:
   *    · content must be the empty string (a decor box, never text ink);
   *    · the box must be DRAWN: opaque-ish background (alpha > 0), opacity
   *      > 0.05, positive px box, position:absolute, and any transform a
   *      pure translate at scale ≈ 1 (a scale-0/opacity-0 pseudo is the
   *      component's own hidden state — that combo counts as NOT drawn);
   *    · geometry + fill must be UNIFORM across every drawn enabled combo
   *      (translate folds into top/left, receipted);
   *    · visibility must factor per-axis (factorPresence), and placement
   *      needs an enum condition to ride stylesWhen — the v9 shape grammar
   *      the canvas already compiles (position/top/left per combo).
   */
  /** When the host part is a SHAPE LEAF (curated backdrop), the decor cannot
   *  nest inside it (shape parts refuse children) — it BUBBLES to the host's
   *  parent, offsets folded with the host's border widths, guarded by a
   *  geometry assertion: the parent's content box must equal the host's
   *  border box (else named refusal). */
  const pseudoDecorParts = (e: UnionNode, i: number, hostIsShapeLeaf: boolean): Array<[string, Part]> => {
    const out: Array<[string, Part]> = [];
    const px = (v: string | undefined): number | null => {
      const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v ?? '');
      return m ? Number(m[1]) : null;
    };
    const alphaOf = (v: string | undefined): number => {
      const m = /^rgba\(\d+, \d+, \d+, ([\d.]+)\)$/.exec(v ?? '');
      return m ? Number(m[1]) : 0;
    };
    for (const pe of ['::before', '::after'] as const) {
      // Domain: ALL default-interaction combos where the host renders (state
      // planes included — a disabled checked Radio keeps its dot; an
      // enabled-only domain would fabricate a hidden-when-disabled fact).
      const domain = allDefaultCombos.filter((combo) => union.alignedByKey.get(`${combo.key}__default`)![i]);
      const drawnRows: Array<{ combo: Combo; st: Record<string, string> }> = [];
      for (const combo of domain) {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        const st = el?.node.pseudo[pe];
        if (!st) continue;
        if (st['content'] !== '""') continue; // text-bearing pseudo: named residue (extension findings)
        const w = px(st['width']);
        const h = px(st['height']);
        const opacity = Number(st['opacity'] ?? '1');
        const alpha = alphaOf(st['background-color']);
        const t = st['transform'] ?? 'none';
        const mtx = /^matrix\((-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\)$/.exec(t);
        const scaleOk = t === 'none' || (mtx !== null && Number(mtx[2]) === 0 && Number(mtx[3]) === 0 && Math.abs(Number(mtx[1]) - 1) < 0.01 && Math.abs(Number(mtx[4]) - 1) < 0.01);
        const drawn = alpha > 0 && opacity > 0.05 && w !== null && h !== null && w > 0 && h > 0 && st['position'] === 'absolute';
        if (!drawn) continue; // hidden state of the pseudo — not drawn in this combo
        if (!scaleOk) {
          refusals.push(`pseudo-decor-outside-grammar: ${e.partName}${pe} drawn with a non-identity scale transform (${t}) — the bounded v1 decor grammar carries translate-only; named refusal`);
          drawnRows.length = 0;
          break;
        }
        drawnRows.push({ combo, st });
      }
      if (drawnRows.length === 0) continue;
      // uniform geometry + fill over the drawn combos (translate folded)
      // Bubbled decor: offsets are parent-relative — fold the HOST's border
      // widths in (absolute children position against the PADDING box) and
      // assert the parent's content box equals the host's border box.
      if (hostIsShapeLeaf) {
        let geometryOk = e.parent !== null;
        for (const { combo } of drawnRows) {
          const els = union.alignedByKey.get(`${combo.key}__default`)!;
          const host = els[i];
          const parent = e.parent ? els[idxOf.get(e.parent.id)!] : null;
          if (!host || !parent) { geometryOk = false; break; }
          const hs = host.node.style;
          const pst = parent.node.style;
          const num = (v: string | undefined) => px(v) ?? 0;
          const parentContentW = num(pst['width']) - num(pst['padding-left']) - num(pst['padding-right']) - num(pst['border-left-width']) - num(pst['border-right-width']);
          const parentContentH = num(pst['height']) - num(pst['padding-top']) - num(pst['padding-bottom']) - num(pst['border-top-width']) - num(pst['border-bottom-width']);
          if (
            Math.abs(parentContentW - num(hs['width'])) > 0.6 ||
            Math.abs(parentContentH - num(hs['height'])) > 0.6 ||
            num(hs['margin-top']) !== 0 || num(hs['margin-left']) !== 0
          ) { geometryOk = false; break; }
        }
        if (!geometryOk) {
          refusals.push(`pseudo-decor-bubble-geometry: ${e.partName}${pe} — the host is a shape leaf (cannot nest children) and the parent's content box does not equal the host's border box; decor NOT promoted (named refusal, v1 bounded)`);
          continue;
        }
      }
      const fold = (row: { combo: Combo; st: Record<string, string> }) => {
        const t = row.st['transform'] ?? 'none';
        const mtx = /^matrix\((-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\)$/.exec(t);
        const tx = mtx ? Number(mtx[5]) : 0;
        const ty = mtx ? Number(mtx[6]) : 0;
        // Bubbled: absolute children position against the host's PADDING box
        // — the host's border widths join the parent-relative offsets.
        const hostSt = hostIsShapeLeaf ? union.alignedByKey.get(`${row.combo.key}__default`)![i]!.node.style : null;
        const bT = hostSt ? (px(hostSt['border-top-width']) ?? 0) : 0;
        const bL = hostSt ? (px(hostSt['border-left-width']) ?? 0) : 0;
        return {
          w: px(row.st['width'])!,
          h: px(row.st['height'])!,
          top: (px(row.st['top']) ?? 0) + ty + bT,
          left: (px(row.st['left']) ?? 0) + tx + bL,
          bg: row.st['background-color'],
          radius: px(row.st['border-top-left-radius']) ?? 0,
        };
      };
      const folded = drawnRows.map(fold);
      const uniq = new Set(folded.map((f) => JSON.stringify(f)));
      if (uniq.size !== 1) {
        refusals.push(`pseudo-decor-nonuniform: ${e.partName}${pe} drawn geometry/fill varies across the drawn combos (${[...uniq].join(' vs ')}) — the bounded v1 decor grammar carries one box; named refusal`);
        continue;
      }
      const f = folded[0];
      // presence over the enabled domain: drawn combos only
      const fact = factorPresence(
        drawnRows.map((r) => r.combo),
        domain,
        space.axes,
        presenceProps,
        stateProps,
        `${e.partName}${pe}`,
        new Set(contract.props.map((p) => p.name)),
      );
      if (!fact) {
        refusals.push(`pseudo-decor-presence-uncorrelated: ${e.partName}${pe} drawn in ${drawnRows.length}/${domain.length} default-interaction combos and the drawn set does not factor per-axis — decor NOT promoted (named refusal)`);
        continue;
      }
      if (fact.shownWhen.length > 0) {
        refusals.push(`pseudo-decor-unset-axis-gate: ${e.partName}${pe} is gated by a defaultless axis (base-hidden spelling) — outside the bounded v1 decor grammar; named refusal`);
        continue;
      }
      // placement rides stylesWhen (the v9 shape grammar) — it needs enum
      // conditions to hang on; the shown values of the constraining enum
      // axis provide them. Drawn-everywhere boxes have no condition slot.
      const placementConds: Array<{ prop: string; equals: string }> = [];
      const hiddenEnum = fact.hiddenWhen.filter((hw) => hw.equals !== undefined);
      if (hiddenEnum.length > 0) {
        const ax = space.axes.find((a) => a.prop === hiddenEnum[0].prop)!;
        const hiddenVals = new Set(hiddenEnum.filter((hw) => hw.prop === ax.prop).map((hw) => hw.equals!));
        for (const v of ax.values) {
          if (v === ax.unset || hiddenVals.has(v)) continue;
          placementConds.push({ prop: ax.prop, equals: v });
        }
      }
      if (placementConds.length === 0) {
        refusals.push(`pseudo-decor-unconditional-placement: ${e.partName}${pe} is drawn without an enum-axis gate — stylesWhen placement (the v9 shape grammar) has no condition to ride; decor NOT promoted (named refusal, v1 bounded)`);
        continue;
      }
      const partName = `${e.partName}-${pe.slice(2)}`;
      const kind: 'ellipse' | 'rect' = f.radius >= Math.min(f.w, f.h) / 2 - 0.5 ? 'ellipse' : 'rect';
      const decor: Part = {
        shape: { kind, width: f.w, height: f.h },
        literals: { 'background-color': f.bg },
        ...(fact.visibleWhen ? { visibleWhen: { prop: fact.visibleWhen.prop } } : {}),
        stylesWhen: [
          ...fact.hiddenWhen.map((hw) => ({ prop: hw.prop, ...(hw.equals !== undefined ? { equals: hw.equals } : {}), styles: { display: 'none' } })),
          ...placementConds.map((pc) => ({ prop: pc.prop, equals: pc.equals, styles: { position: 'absolute', top: `${f.top}px`, left: `${f.left}px` } })),
        ],
        description: `Drawn ${pe} pseudo-element decor promoted from the computed floor (round 5c, S5 v1): a ${f.w}×${f.h} ${kind} at ${f.left},${f.top} inside ${e.partName}, fill ${f.bg} — background+box+radius only, no content text; translate folded into top/left (receipted).`,
      };
      receipts.push(
        `pseudo-decor-carried: ${e.partName}${pe} → shape part "${partName}" (${kind} ${f.w}×${f.h} at ${f.left},${f.top}, fill ${f.bg}; drawn in ${drawnRows.length}/${domain.length} default-interaction combos${fact.hiddenWhen.length ? `, hidden-when ${fact.hiddenWhen.map((hw) => (hw.equals ? `${hw.prop}=${hw.equals}` : hw.prop)).join(', ')}` : ''}; translate${hostIsShapeLeaf ? ' + host border' : ''} folded into top/left${hostIsShapeLeaf ? '; BUBBLED to the host parent (shape leaves cannot nest children; parent content box == host border box, asserted)' : ''} — round 5c S5)`,
      );
      out.push([partName, decor]);
    }
    return out;
  };

  /** Build a Part for a union entry (recursing into children). Returns null
   *  when the entry (and subtree) refuses promotion. */
  const buildPart = (e: UnionNode): Part | null => {
    const i = idxOf.get(e.id)!;
    if (consumed.has(i) && !svgPlans.has(i)) return null; // svg internals
    const existing = staticByName.get(e.partName);
    const part: Part = existing ? structuredClone(existing) : {};
    if (existing) delete part.parts; // children re-derived from the captured tree
    // Round 5c — SHAPE GEOMETRY RECARRIED: a reviewed static shape (curated
    // decor geometry, round 2) whose numbers contradict the captured
    // computed box retires its numbers — geometry channels are excluded from
    // fusion (environment-dependent in general), but a decor box UNIFORM
    // across every enabled combo is measured truth the curation got wrong
    // (Checkbox/Radio backdrop: curated 20×20 vs the package's 18×18). The
    // curated KIND (rect/ellipse) stays the reviewed call.
    if (part.shape && (part.shape.kind === 'rect' || part.shape.kind === 'ellipse')) {
      const px = (v: string | undefined): number | null => {
        const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v ?? '');
        return m ? Number(m[1]) : null;
      };
      const ws = new Set<number>();
      const hs = new Set<number>();
      let readable = true;
      for (const combo of presentBy.get(i) ?? []) {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        if (!el) continue;
        const w = px(el.node.style['width']);
        const h = px(el.node.style['height']);
        if (w === null || h === null || w <= 0 || h <= 0) { readable = false; break; }
        ws.add(Math.round(w * 100) / 100);
        hs.add(Math.round(h * 100) / 100);
      }
      if (readable && ws.size === 1 && hs.size === 1) {
        const [w] = ws;
        const [h] = hs;
        if (w !== part.shape.width || h !== part.shape.height) {
          receipts.push(
            `shape-geometry-recarried: ${e.partName} — reviewed shape ${part.shape.width}×${part.shape.height} contradicts the captured computed box ${w}×${h} (uniform across every enabled combo); computed truth wins geometry, the curated numbers retire (round 5c; kind "${part.shape.kind}" stays the reviewed call)`,
          );
          part.shape = { ...part.shape, width: w, height: h };
        }
      }
    }
    if (!existing) {
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
    const srOnly = isSrOnlyStyle(e.rep.style);
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
      const contractPropNames = new Set(contract.props.map((p) => p.name));
      const fact = factorPresence(present, enabled, space.axes, presenceProps, stateProps, e.partName, contractPropNames);
      if (!fact) {
        // Round 5c: complement-of-product fallback — a default subtree an
        // alternative replaces (Tag's label under `linked`) is spellable as
        // an ordered hide→restore stylesWhen cascade, verified per combo.
        const comp5c = factorComplement(
          presentAllBy.get(i) ?? new Set(),
          allDefaultCombos,
          space.axes,
          presenceProps,
          stateProps,
          e.partName,
          contractPropNames,
        );
        if (comp5c) {
          const restore =
            part.layout?.display ??
            (part.declared?.['display'] && part.declared['display'] !== 'none' ? part.declared['display'] : undefined) ??
            (e.children.length > 0 ? 'flex' : 'inline');
          part.stylesWhen = [
            ...(part.stylesWhen ?? []),
            ...comp5c.hide.map((h) => ({ prop: h.prop, ...(h.equals !== undefined ? { equals: h.equals } : {}), styles: { display: 'none' } })),
            ...comp5c.restore.map((r) => ({ prop: r.prop, ...(r.equals !== undefined ? { equals: r.equals } : {}), styles: { display: String(restore) } })),
          ];
          receipts.push(...comp5c.receipts);
        } else {
          refusals.push(`part-presence-uncorrelated: ${e.partName} present in ${present.length}/${enabled.length} enabled combos and the presence set does not factor per-axis (nor does its ABSENCE — the round-5c complement spelling was tried) — part NOT promoted (named refusal; a phantom always-drawn part would be worse)`);
          return null;
        }
      } else {
        if (fact.visibleWhen) part.visibleWhen = { prop: fact.visibleWhen.prop };
        if (fact.shownWhen.length > 0) {
          // Round 5f: this part is ABSENT at unset and appears per SET value —
          // its gating axis is a defaultless STRUCTURE-creating enum. Record
          // it so the unset value materializes into the enum as the default
          // (the plain, adornment-absent variant).
          for (const sw of fact.shownWhen) structureGatingUnsetAxes.add(sw.prop);
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
    }

    // svg host → icon part(s)
    const plan = svgPlans.get(i);
    if (plan) {
      applySvgPlan(part, e, plan);
      return part;
    }

    // children
    const childParts: Record<string, Part> = {};
    for (const c of e.children) {
      const cp = buildPart(c);
      if (cp) childParts[c.partName] = cp;
      // Round 5c — S5 bubbling: a shape-leaf child's drawn pseudo decor
      // cannot nest inside it — it joins THIS part's children instead.
      if (cp?.shape) {
        for (const [decorName, decor] of pseudoDecorParts(c, idxOf.get(c.id)!, true)) childParts[decorName] = decor;
      }
    }
    // Round 5c — S5: drawn pseudo-element decor boxes join as child parts.
    if (!part.shape) {
      for (const [decorName, decor] of pseudoDecorParts(e, i, false)) childParts[decorName] = decor;
    }
    if (Object.keys(childParts).length > 0) part.parts = childParts;
    return part;
  };

  // root: keep the reviewed root part's facts, replace its children with the
  // captured nesting; unmatched static parts are re-attached afterwards.
  const newRoot = structuredClone(rootPart);
  delete newRoot.parts;
  // Root display fact: computed truth wins the display channel (the static
  // extraction's layout.display is a source-reading guess; TextField's root
  // is a block in the browser, and a flex guess put the label beside the
  // field) — override is RECEIPTED, never silent.
  {
    const displays = new Set<string>();
    for (const combo of enabled) {
      const el = union.alignedByKey.get(`${combo.key}__default`)?.[0];
      if (el) displays.add(el.node.style['display']);
    }
    if (displays.size === 1) {
      const d = [...displays][0];
      if (d === 'flex' || d === 'inline-flex') {
        if (newRoot.layout?.display !== d) {
          receipts.push(`root-display-carried: ${d}${newRoot.layout?.display ? ` (overrides reviewed "${newRoot.layout.display}" — computed truth wins display, receipted)` : ''}`);
        }
        newRoot.layout = { ...newRoot.layout, display: d };
      } else if (/^(inline|inline-block|block|contents)$/.test(d)) {
        if (newRoot.layout?.display) {
          receipts.push(`root-display-carried: ${d} via declared (overrides reviewed layout.display "${newRoot.layout.display}" — computed truth wins display, receipted)`);
          delete newRoot.layout.display;
          if (Object.keys(newRoot.layout).length === 0) delete newRoot.layout;
        }
        newRoot.declared = { display: d, ...newRoot.declared };
      }
    }
  }
  const rootChildren: Record<string, Part> = {};
  for (const c of rootEntry.children) {
    const cp = buildPart(c);
    if (cp) rootChildren[c.partName] = cp;
  }
  // Round 5c — S5 on the root itself (drawn root pseudo decor) + bubbling
  // for the root's own shape-leaf children.
  for (const c of rootEntry.children) {
    if (rootChildren[c.partName]?.shape) {
      for (const [decorName, decor] of pseudoDecorParts(c, idxOf.get(c.id)!, true)) rootChildren[decorName] = decor;
    }
  }
  for (const [decorName, decor] of pseudoDecorParts(rootEntry, idxOf.get(rootEntry.id)!, false)) rootChildren[decorName] = decor;
  if (Object.keys(rootChildren).length > 0) newRoot.parts = rootChildren;
  // Round 5c — ROOT-HOSTED svg plan: buildPart never runs on the root, so a
  // plan whose host IS the root (Spinner: the glyph is the root's only
  // child) was silently dropped — the assets existed, the contract carried
  // no glyph. Apply it here exactly as buildPart applies it to nested hosts.
  {
    const rootPlan = svgPlans.get(idxOf.get(rootEntry.id)!);
    if (rootPlan) {
      newRoot.parts = rootChildren; // per-value children merge into the same map
      applySvgPlan(newRoot, rootEntry, rootPlan);
      receipts.push(
        `root-svg-plan-carried: ${comp.name} root hosts ${rootPlan.perValue.length === 1 && rootPlan.perValue[0].value === undefined ? `icon asset ${rootPlan.perValue[0].asset}` : `${rootPlan.perValue.length} per-value glyph part(s) (${rootPlan.perValue.map((pv) => pv.asset).join(', ')})`} — round 5c root-hosted svg plan (the round-5a named promotion drop)`,
      );
    }
  }

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

  // Round 5f — materialize the UNSET pseudo-value of every defaultless
  // structure-gating enum into the contract enum AS THE DEFAULT. Only axes
  // whose gated part actually survived promotion count (a part refused
  // upstream leaves no plain variant to enumerate). This is the ONE place the
  // API surface gains the unset value; downstream (emit variants, gate
  // deriveCells, real-page mount) all read the enum uniformly, and the
  // gate/real-page omit the unset value on mount exactly as the capture's own
  // comboProps does (prop absent === adornment absent).
  const survivingGateProps = new Set<string>();
  const collectGates = (p: Part) => {
    if (p.declared?.['display'] === 'none') {
      for (const sw of p.stylesWhen ?? []) {
        if (sw.equals !== undefined && sw.styles['display'] !== undefined && sw.styles['display'] !== 'none') {
          survivingGateProps.add(sw.prop);
        }
      }
    }
    for (const c of Object.values(p.parts ?? {})) collectGates(c);
  };
  collectGates(newRoot);
  for (const axProp of structureGatingUnsetAxes) {
    if (!survivingGateProps.has(axProp)) continue;
    const ax = space.axes.find((a) => a.prop === axProp);
    if (!ax || ax.unset === undefined) continue;
    const prop = contract.props.find((p) => p.name === axProp);
    if (!prop || typeof prop.type !== 'object' || !('enum' in prop.type)) continue;
    if (prop.type.enum.includes(ax.unset) || prop.default !== undefined) continue;
    prop.type.enum = [ax.unset, ...prop.type.enum];
    (prop as { default?: unknown }).default = ax.unset;
    receipts.push(
      `optional-adornment-unset-materialized: ${axProp} — defaultless enum gates a present-only-when-set part; unset value "${ax.unset}" added to the enum as the DEFAULT so a PLAIN (adornment-absent) variant is enumerated and the base-hidden part renders nothing there (round 5f — S2 unset extended from styling to STRUCTURE)`,
    );
  }

  return { contract, assets, consumed, partIndex, receipts, refusals };
}
