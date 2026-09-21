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
 *     variables observed on node `opacity` or native `fontWeight`, which stay unitless
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
import { projectRootTextTemplateAliases, type TemplateSourceToken } from './figma-template-aliases.js';

export interface CapturedTokenEntry {
  /** Dot-form token path ("bg.brand.default") — what refs resolve through. */
  path: string;
  /** The variable's original slash-form name ("bg/brand/default"). */
  name: string;
  /** CSS-value spelling ('#0e61ba', '16px', '0.4'). */
  value: string;
  /** DTCG $type ('color' | 'dimension' | 'number'). */
  type: string;
  /** Verified original source alias; value remains its captured CSS literal. */
  reference?: string;
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
    node[segs[segs.length - 1]] = { $value: e.reference ?? e.value, $type: e.type };
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
  const rawVars = dump['_variables'] as Record<string, DumpVariable> | undefined;
  if (!rawVars || typeof rawVars !== 'object' || Array.isArray(rawVars) || Object.keys(rawVars).length === 0) {
    return null;
  }
  const vars = { ...rawVars }, sourceTokens: TemplateSourceToken[] = [], templateSkips: CapturedTokenSkip[] = [];
  for (const value of Object.values(dump)) if (isDumpSet(value)) {
    try {
      const projected = projectRootTextTemplateAliases(value);
      if (projected) {
        sourceTokens.push(...projected.tokens);
        for (const name of projected.syntheticNames) delete vars[name];
      }
    } catch (error) {
      templateSkips.push({ name: value.setName, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  // Variables bound to opacity or a captured native font weight stay unitless.
  const opacityVars = new Set<string>();
  const weightVars = new Set<string>(), dimensionVars = new Set<string>();
  const observedIdentities = new Map<string, Set<string>>();
  const walk = (n: DumpNode) => {
    for (const [id, c] of Object.entries(n.variableConsumers ?? {})) {
      if (!c || typeof c.name !== 'string') continue;
      const ids = observedIdentities.get(c.name) ?? new Set<string>(); ids.add(id); observedIdentities.set(c.name, ids);
    }
    if (n.bound?.opacity) opacityVars.add(n.bound.opacity);
    if (n.text?.fontWeightVar && n.text.fontWeight !== undefined) weightVars.add(n.text.fontWeightVar);
    for (const [field, name] of Object.entries(n.bound ?? {})) if (field !== 'opacity') dimensionVars.add(name);
    if (n.text?.fontSizeVar) dimensionVars.add(n.text.fontSizeVar);
    if (n.text?.lineHeightVar) dimensionVars.add(n.text.lineHeightVar);
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
  const skipped: CapturedTokenSkip[] = templateSkips;
  const claimedFolded = new Set<string>();
  for (const [name, cap] of Object.entries(vars)) {
    if (!cap || typeof cap !== 'object') continue;
    if (weightVars.has(name) && dimensionVars.has(name)) {
      skipped.push({ name, reason: 'native font weight and dimension share one variable — incompatible CSS units; not registered' });
      continue;
    }
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
      const unitless = opacityVars.has(name) || weightVars.has(name);
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

  // Carrier variables are implementation details. Selected source identities
  // contribute their original definitions; a collision refuses all claimants.
  const sourcePaths = new Map<string, TemplateSourceToken>(), conflicted = new Set<string>();
  for (const token of sourceTokens) {
    const existing = sourcePaths.get(token.path), global = entries.find(e => e.path === token.path);
    if ([...(observedIdentities.get(token.name) ?? [])].some(id => id !== token.id) ||
        existing && (existing.id !== token.id || existing.name !== token.name || existing.type !== token.type ||
        existing.value !== token.value || existing.reference !== token.reference) ||
        global && (global.name !== token.name || global.type !== token.type || global.value !== token.value ||
          global.modes && Object.values(global.modes).some(v => v !== token.value))) conflicted.add(token.path);
    sourcePaths.set(token.path, token);
  }
  for (const [path, token] of sourcePaths) {
    const index = entries.findIndex(e => e.path === path);
    if (index >= 0) entries.splice(index, 1);
    if (conflicted.has(path)) {
      skipped.push({ name: token.name, reason: 'original template source token has conflicting native identities or values; not registered' });
    } else {
      const { id: _id, ...entry } = token;
      entries.push(entry);
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

// ---------------------------------------------------------------------------
// FC-DUMP-PROPOSE-CAPTURED-VARIABLES-DROPPED — the CLI receipt
// ---------------------------------------------------------------------------

/** The receipt line Journey A prints when a dump carries no `_variables`
 *  channel at all (REST dumps, pre-v1.4 plugin dumps). Named, so a reader of
 *  the proposal folder can tell "the kit has no variables" from "the CLI
 *  threw them away" — which is what it did before this receipt existed. */
export const CAPTURED_VARIABLES_ABSENT_RECEIPT =
  'no captured variables: the dump carries no `_variables` channel (REST transport or a pre-v1.4 plugin dump) — the designer\'s variables are not in this folder; recapture with the plugin (dump v1.4+) to carry them';

/**
 * The receipt for a dump WITHOUT `_variables`, by cause (Phase 2 exam,
 * 2026-08-22). A REST dump stamps `_provenance.variables` with what the
 * variables endpoint answered or why it did not; the generic line above said
 * "REST transport … recapture with the plugin" for a kit whose only problem
 * was a token minted without `file_variables:read` — wrong route, wrong fix.
 * Falls back to the generic constant when the dump carries no stamp (plugin
 * dumps, hand-authored fixtures).
 */
export function capturedVariablesAbsentReceipt(dump: Record<string, unknown>): string {
  const prov = dump['_provenance'] as { variables?: unknown } | undefined;
  const v = prov?.variables as
    | { status: 'resolved'; count: number; collections: number; modeSource: string }
    | { status: 'unavailable'; cause: string; httpStatus?: number; message: string; fix: string | null }
    | undefined;
  if (!v || typeof v !== 'object') return CAPTURED_VARIABLES_ABSENT_RECEIPT;
  if (v.status === 'resolved') {
    return `no captured variables: the REST variables endpoint answered (${v.count} variable(s) in ${v.collections} collection(s)) but no binding on the mapped sets resolved through a variable carrying values — nothing to write to captured.dtcg.json (a names-only response resolves names and captures no values)`;
  }
  if (v.cause === 'scope') {
    return `no captured variables: the REST variables endpoint refused — the token lacks the \`file_variables:read\` scope (HTTP ${v.httpStatus ?? 403}; a token scope, NOT a plan limit). FIX: ${v.fix ?? 'regenerate the token with file_variables:read'} and re-run extract:figma:rest; until then every binding is a resolved literal and captured.dtcg.json is NOT written`;
  }
  if (v.cause === 'network') {
    return `no captured variables: the REST variables endpoint could not be reached (network) — ${v.message}; captured.dtcg.json is NOT written`;
  }
  if (v.cause === 'not-fetched') {
    return `no captured variables: the caller never fetched /v1/files/:key/variables/local — ${v.message}; captured.dtcg.json is NOT written`;
  }
  return `no captured variables: the REST variables endpoint refused with HTTP ${v.httpStatus ?? '?'} naming no missing scope (plan tier UNVERIFIED — docs/HANDOFF.md) — ${v.message}; captured.dtcg.json is NOT written`;
}

export interface CapturedTokensDocument {
  /** The DTCG document written as `captured.dtcg.json`: the consuming-mode
   *  tree (what the proposal's refs resolve against, loadable through
   *  `--tokens`), plus `$extensions["ds-contracts"].modes` — one DTCG tree
   *  per Figma MODE NAME carrying that mode's values (dump v1.6), and the
   *  named skips. */
  document: Record<string, unknown>;
  /** The human receipt for the proposal report — counts, modes, skips, and
   *  the alias limit named. */
  receipt: string;
  layer: CapturedTokenLayer;
}

/**
 * Build the `captured.dtcg.json` document + report receipt for a dump's
 * `_variables` channel. Returns null when the dump carries none — the caller
 * prints CAPTURED_VARIABLES_ABSENT_RECEIPT instead (never nothing).
 *
 * What this does NOT claim: the dump captures RESOLVED values per mode, not
 * the variable's alias graph (a variable aliasing another arrives as the
 * aliased value). The receipt names that limit, so "aliases preserved" is not
 * something a reader can mistake this file for.
 */
export function capturedTokensDocument(dump: Record<string, unknown>): CapturedTokensDocument | null {
  const layer = capturedTokensFromDump(dump);
  if (!layer) return null;
  const modeNames = Object.keys(layer.modes ?? {}).sort();
  const modes: Record<string, Record<string, unknown>> = {};
  for (const mode of modeNames) modes[mode] = layer.modes![mode].tree;
  const document: Record<string, unknown> = {
    ...layer.tree,
    $extensions: {
      'ds-contracts': {
        source: 'figma `_variables` (dump v1.4 values, v1.6 per-mode values) — resolved values, not the alias graph',
        captured: layer.count,
        ...(modeNames.length > 0 ? { modes } : {}),
        skipped: layer.skipped,
      },
    },
  };
  const skipNames = [...new Set(layer.skipped.map((s) => s.name))];
  const receipt =
    `${layer.count} captured variable(s) written to captured.dtcg.json as DTCG (the consuming mode's values; ` +
    (modeNames.length > 0
      ? `${modeNames.length} mode(s) — ${modeNames.join(', ')} — carried as one tree each under $extensions["ds-contracts"].modes)`
      : 'single-mode: no per-mode trees captured)') +
    `; ${layer.skipped.length} skipped by name` +
    (skipNames.length > 0 ? ` (${skipNames.map((n) => `"${n}"`).join(', ')} — see $extensions["ds-contracts"].skipped for each reason)` : '') +
    '. LIMIT: the dump carries RESOLVED values per mode, not the alias graph — a variable aliasing another lands as the aliased value; aliases are NOT preserved (named, dump v1.4/v1.6).';
  return { document, receipt, layer };
}
