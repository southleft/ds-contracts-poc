/**
 * CAPTURED TOKENS — the designer's REAL variables as an import-scoped token
 * layer (dump v1.4 `_variables`).
 *
 * The plugin transport resolves bound variable NAMES on any Figma plan, so a
 * proposal binds real refs ({bg.brand.default}, {spacing.200}) — but a
 * playground whose referee knows only the repo token corpus refused every
 * one of them ("does not exist in tokens/") and the designer's tokens had
 * nowhere to register (owner field case: the CBDS Button-Brand Primary
 * bridge send, 9 refusals). Dump v1.4 carries each variable's RESOLVED value
 * for the consuming mode alongside the name; this module turns that channel
 * into a DTCG tree + CSS-value entries the playground registers as an
 * ADDITIONAL token source (the mintedLayer pattern in
 * playground/src/engine/token-source.ts), so the referee resolves the real
 * names and the preview renders the designer's values.
 *
 * Rules (bounded, named, never guessed):
 *   · COLOR → { $value: '#rrggbb[aa]', $type: 'color' }
 *   · FLOAT → '<n>px' / $type dimension — Figma lengths are px — EXCEPT
 *     variables the dump shows bound to node `opacity`, which stay unitless
 *     ('<n>' / $type number)
 *   · STRING / BOOLEAN → no CSS custom-property projection; SKIPPED by name
 *   · a name outside the token-ref grammar ([a-z0-9.-] after slash→dot) is
 *     SKIPPED by name (the U+2024 field case — rename the variable)
 *   · a name that is a group prefix of another captured name is SKIPPED by
 *     name (a leaf cannot sit on a group path in a DTCG tree)
 *   · layering is the CALLER's rule: repo tokens win on name collision —
 *     the playground prunes shadowed paths at registration and receipts them
 *
 * Pure module (no node:* imports) — part of the browser-importable core.
 */
import { isDumpSet, type DumpNode, type DumpVariable } from '../extract/figma/types.js';

export interface CapturedTokenEntry {
  /** Dot-form token path ("bg.brand.default") — what refs resolve through. */
  path: string;
  /** The variable's original slash-form name ("bg/brand/default"). */
  name: string;
  /** CSS-value spelling ('#0e61ba', '16px', '0.4'). */
  value: string;
  /** DTCG $type ('color' | 'dimension' | 'number'). */
  type: string;
  /** Per-mode CSS-value spellings, keyed by MODE NAME (dump v1.6) — present
   *  only when the variable's collection is multi-mode and the mode value
   *  spells with the entry's own type rule. The §3 channel: a promoted theme
   *  axis resolves per mode through these. */
  modes?: Record<string, string>;
}

export interface CapturedTokenSkip {
  name: string;
  reason: string;
}

export interface CapturedTokenLayer {
  /** DTCG tree of the registrable entries (leaf shape { $value, $type }). */
  tree: Record<string, unknown>;
  /** Number of registrable entries (= entries.length). */
  count: number;
  entries: CapturedTokenEntry[];
  /** Per-mode DTCG trees (dump v1.6) — the repo's own token vocabulary shape
   *  (tokens/modes/semantic.<mode>.tokens.json: a tree per mode carrying the
   *  entries that HAVE a value for that mode). Absent when no captured
   *  variable is multi-mode. The §3 promotion receipt: "bindings resolve per
   *  mode through the variable collection" resolves HERE. */
  modes?: Record<string, { tree: Record<string, unknown>; count: number }>;
  /** Variables the layer could NOT register — named, never silent. */
  skipped: CapturedTokenSkip[];
}

/** U+2024 ONE DOT LEADER — the Eventz field case: variables named
 *  "spacing/1․5" whose middle character LOOKS like a dot but is not one, so
 *  the dot-form path fell outside the token-ref grammar ([a-z0-9.-]) and 16
 *  bindings refused by name. */
export const ONE_DOT_LEADER = '․';

/** THE token-path fold for a Figma variable name — one rule, shared by the
 *  captured-token layer (registration) and core/propose-figma.ts dotPath
 *  (binding refs), so a folded name resolves end to end:
 *    · '/' → '.'  (grouping, unchanged)
 *    · U+2024 ONE DOT LEADER → '-'  (dump v1.16): '-' rather than '.' because
 *      the designer's "1․5" is ONE path segment, and a real dot would split
 *      it into two ("spacing.1.5"), changing the tree's depth.
 *  The fold is a RENAME relative to the canvas variable — callers receipt it
 *  (propose notes; the collision rule below refuses a folded name whose
 *  target path another variable already owns). */
export function foldVariablePath(name: string): { path: string; folded: boolean } {
  const dotted = name.split('/').join('.');
  if (!dotted.includes(ONE_DOT_LEADER)) return { path: dotted, folded: false };
  return { path: dotted.split(ONE_DOT_LEADER).join('-'), folded: true };
}

/** Nested DTCG tree from flat entries (the mint-tokens tree shape). */
function treeFromEntries(entries: CapturedTokenEntry[]): Record<string, unknown> {
  const tree: Record<string, unknown> = {};
  for (const e of entries) {
    const segs = e.path.split('.');
    let node = tree;
    for (const seg of segs.slice(0, -1)) node = (node[seg] ??= {}) as Record<string, unknown>;
    node[segs[segs.length - 1]] = { $value: e.value, $type: e.type };
  }
  return tree;
}

/**
 * Build the captured-token layer from a dump's `_variables` channel (dump
 * v1.4). Returns null when the dump carries no variables — REST dumps and
 * pre-v1.4 plugin dumps land here and the minted `imported.*` route stays
 * the degraded fallback, exactly as before.
 */
export function capturedTokensFromDump(dump: Record<string, unknown>): CapturedTokenLayer | null {
  const vars = dump['_variables'] as Record<string, DumpVariable> | undefined;
  if (!vars || typeof vars !== 'object' || Array.isArray(vars) || Object.keys(vars).length === 0) {
    return null;
  }

  // Variables bound to node `opacity` anywhere in the dump stay unitless.
  const opacityVars = new Set<string>();
  const walk = (n: DumpNode) => {
    if (n.bound?.opacity) opacityVars.add(n.bound.opacity);
    for (const c of n.children ?? []) walk(c);
  };
  for (const value of Object.values(dump)) {
    if (isDumpSet(value)) for (const variant of value.variants) walk(variant);
  }

  // Fold pass (dump v1.16): a folded path landing on a path another variable
  // already owns is a COLLISION — the folded entry refuses by name (the
  // original occupant keeps the path; a silent merge would resolve one
  // variable's refs to the other's value).
  const unfoldedPaths = new Set(
    Object.keys(vars).map((name) => foldVariablePath(name)).filter((f) => !f.folded).map((f) => f.path),
  );
  const entries: CapturedTokenEntry[] = [];
  const skipped: CapturedTokenSkip[] = [];
  const claimedFolded = new Set<string>();
  for (const [name, cap] of Object.entries(vars)) {
    if (!cap || typeof cap !== 'object') continue;
    const { path, folded } = foldVariablePath(name);
    if (folded && (unfoldedPaths.has(path) || claimedFolded.has(path))) {
      skipped.push({
        name,
        reason: `U+2024 fold target "${path}" collides with another captured variable — not registrable; rename the variable or map it manually`,
      });
      continue;
    }
    if (folded) claimedFolded.add(path);
    if (!/^[a-z0-9.-]+$/i.test(path)) {
      skipped.push({
        name,
        reason:
          'name contains characters outside the token-ref grammar ([a-z0-9.-]) — not registrable; rename the variable or map it manually',
      });
      continue;
    }
    // Per-mode values (dump v1.6): spelled with the SAME typing rule as the
    // consuming-mode value; a mode value whose JS type contradicts the
    // variable's resolvedType is skipped by name (never a silent coercion).
    const modesOf = (spell: (v: string | number | boolean) => string | null): Record<string, string> | undefined => {
      if (!cap.modes || typeof cap.modes !== 'object') return undefined;
      const out: Record<string, string> = {};
      for (const [mode, raw] of Object.entries(cap.modes)) {
        const spelled = spell(raw);
        if (spelled === null) {
          skipped.push({
            name,
            reason: `mode "${mode}" value ${JSON.stringify(raw)} does not spell as resolved type ${String(cap.type)} — mode value not registered`,
          });
          continue;
        }
        out[mode] = spelled;
      }
      return Object.keys(out).length > 0 ? out : undefined;
    };
    if (cap.type === 'COLOR' && typeof cap.value === 'string') {
      const modes = modesOf((v) => (typeof v === 'string' ? v : null));
      entries.push({ path, name, value: cap.value, type: 'color', ...(modes ? { modes } : {}) });
    } else if (cap.type === 'FLOAT' && typeof cap.value === 'number') {
      const unitless = opacityVars.has(name);
      const modes = modesOf((v) => (typeof v === 'number' ? (unitless ? String(v) : `${v}px`) : null));
      entries.push(
        unitless
          ? { path, name, value: String(cap.value), type: 'number', ...(modes ? { modes } : {}) }
          : { path, name, value: `${cap.value}px`, type: 'dimension', ...(modes ? { modes } : {}) },
      );
    } else {
      skipped.push({
        name,
        reason: `resolved type ${String(cap.type)} has no CSS custom-property projection — not registered`,
      });
    }
  }

  // A leaf cannot sit on another leaf's group path.
  const paths = new Set(entries.map((e) => e.path));
  const registrable = entries.filter((e) => {
    const isPrefix = [...paths].some((other) => other !== e.path && other.startsWith(`${e.path}.`));
    if (isPrefix) {
      skipped.push({
        name: e.name,
        reason: 'the name is a group prefix of another captured variable — a leaf cannot sit on a group path; not registered',
      });
    }
    return !isPrefix;
  });

  // Per-mode trees (dump v1.6) — the repo tokens/modes/*.tokens.json shape:
  // one tree per mode NAME, carrying the registrable entries that have a
  // value for that mode (the entry's base type; only the $value differs).
  const modeNames = [...new Set(registrable.flatMap((e) => Object.keys(e.modes ?? {})))];
  const modes: Record<string, { tree: Record<string, unknown>; count: number }> = {};
  for (const mode of modeNames) {
    const modeEntries = registrable
      .filter((e) => e.modes?.[mode] !== undefined)
      .map((e) => ({ ...e, value: e.modes![mode] }));
    modes[mode] = { tree: treeFromEntries(modeEntries), count: modeEntries.length };
  }

  return {
    tree: treeFromEntries(registrable),
    count: registrable.length,
    entries: registrable,
    ...(modeNames.length > 0 ? { modes } : {}),
    skipped,
  };
}
