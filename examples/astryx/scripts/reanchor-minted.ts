/**
 * ASTRYX MINTED-LITERAL RE-ANCHORING — the VALUE-IDENTITY JOIN + HUMAN LEDGER.
 *
 *   npx tsx examples/astryx/scripts/reanchor-minted.ts --propose [--anchor <dtcg>]
 *   npx tsx examples/astryx/scripts/reanchor-minted.ts --apply "<id>[,<id>…]"
 *
 * WHY THIS EXISTS (the named defect it attacks): `examples/astryx/DOCS-THEME.md`
 * measured that 111 of 222 astryx color-channel token refs ride MINTED
 * LITERALS, so an alternate theme re-skins only half the surface. Root cause:
 * StyleX compiles token NAMES away (the atomic class carries a literal hex),
 * so astryx has NO source-bindings.json by construction and MUI's
 * evidence-driven source-alias pass (examples/mui/scripts/promote-floor.mjs)
 * CANNOT run here. There is no recorded fact saying which token a literal came
 * from. All that survives is the VALUE.
 *
 * So this pass does the only honest thing a value join can do: it RANKS and
 * PRESENTS, it never auto-resolves. `--propose` writes a review queue;
 * `--apply` lands only rows a human explicitly acked in a committed
 * `tokens/reanchor-decisions.json` (the `extract/computed/resolve.ts --apply`
 * discipline, verbatim: there is no --all).
 *
 * ── TRAP 1 · THE ANCHOR PLANE ───────────────────────────────────────────────
 * The join MUST run against the NEUTRAL wrap (`tokens/astryx.dtcg.json`).
 * Joining against the docs plane (`tokens/astryx-docs.dtcg.json`) would
 * value-match the UNCHANGED pass-throughs and, worse, would let the neutral
 * blue `#0064e0` "cleanly" join a docs token whose docs value is `#15110C` —
 * preserving theme-neutral forever, a silent no-op dressed as the fix. The
 * anchor is fingerprinted BY VALUE (ANCHOR_PROBES below) and a non-neutral
 * anchor is REFUSED BY NAME.
 *
 * ── TRAP 2 · DARK MODE ──────────────────────────────────────────────────────
 * Re-anchoring is NOT a pixel no-op. A minted literal is MODE-FROZEN (the same
 * hex in Light and Dark); a semantic token VARIES (`{color-accent}` is
 * #0064E0 light / #2694FE dark). So every alias is also a DARK REPAIR — and
 * for many value groups the ONLY thing that decides between candidates is
 * which dark behaviour is correct. That is the decision input, so every
 * proposal row carries a per-candidate `darkDelta`, and every applied row's
 * ledger entry acknowledges the dark change deliberately.
 *
 * ── WHAT LANDS AUTOMATICALLY ────────────────────────────────────────────────
 * Nothing, from this script's point of view. `--apply` is the only writer and
 * it reads a committed decisions file. The 9 rows the orchestrator authored
 * are marked `"auto-clean: single candidate, exact name affinity,
 * orchestrator-applied"` — 1 leaf : 1 candidate : perfect name affinity is the
 * only auto-alias the house precedent supports. REVERT ANY OF THEM by deleting
 * its row from tokens/reanchor-decisions.json and re-running promote-floor.ts.
 *
 * Deterministic by construction: sorted keys, sorted candidates, stable ids;
 * two `--propose` runs are byte-identical.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const REPO = path.join(EX, '..', '..');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DtcgLeaf {
  $value: unknown;
  $type?: string;
}
type DtcgFlat = Record<string, DtcgLeaf>;
type DtcgTree = Record<string, unknown>;

/** One leaf of the minted tree, with the ref evidence attached. */
interface MintedLeaf {
  /** dot path, e.g. imported.badge.root.row-rule-color.blue */
  leaf: string;
  value: string;
  /** the CSS channel the leaf binds (null = the path spells no known channel) */
  channel: string | null;
  /** the state suffix stripped off the channel, if any */
  state: string | null;
  /** part path between the component and the channel */
  part: string;
  /** trailing segments after the channel = the axis values it is conditioned on */
  axisValues: string[];
  /** axis-expanded contract refs: "<contract>:<raw ref>" */
  usedBy: string[];
  /** SIBLING-CHANNEL FACTS — base tokens the SAME contract binds to OTHER
   *  channels of the SAME part+variant object that carries this leaf's ref.
   *  Not a heuristic: it is a committed binding sitting next to the literal. */
  siblingTokens: string[];
  /** set when the leaf has ALREADY been re-anchored (its $value is "{token}").
   *  Such leaves stay in the join — a landed row must remain visible in the
   *  queue, and --apply must stay idempotent. */
  aliasedTo: string | null;
}

interface RankedCandidate {
  token: string;
  score: number;
  /** the named affinity rules that fired — greppable, never a black box */
  rules: string[];
  darkDelta: {
    light: string;
    dark: string;
    modeVarying: boolean;
    /** plain-language: what applying THIS candidate does to the dark plane */
    effect: string;
  };
}

type Disposition = 'clean' | 'ambiguous' | 'no-match' | 'excluded' | 'applied' | 'decided-literal';

interface ProposalRow {
  id: string;
  disposition: Disposition;
  /** set only on excluded rows — the greppable exclusion reason code */
  exclusion?: 'card-border-degraded-capture' | 'unreferenced-leaf' | 'non-scalar-gradient';
  value: string;
  /** normalized r,g,b,a tuple — the join key */
  tuple: string;
  leaves: string[];
  /** per-leaf parse + ref evidence — a row can span several channel classes,
   *  and a reviewer may legitimately split it (a decision may name a SUBSET of
   *  these leaves; see applyDecisions).
   *  `decidedLiteral` carries the REVIEWED REFUSAL for a leaf a human looked
   *  at and deliberately kept literal — the difference between "decided" and
   *  "still pending" must be visible in the artifact, not just in a head. */
  leafDetail: Array<{ leaf: string; component: string; part: string; channel: string | null; state: string | null; axisValues: string[]; refs: number; aliasedTo?: string | null; decidedLiteral?: string }>;
  /** the distinct channel classes present — the split signal, stated up front */
  channelClasses: string[];
  /** axis-expanded contract refs across all leaves in this row */
  refs: number;
  usedBy: string[];
  candidates: RankedCandidate[];
  /** the light-plane proof: candidate value === leaf literal, re-checked here */
  lightProof: string;
  evidence: string[];
}

interface Decision {
  ids: string[];
  leaves: string[];
  value: string;
  candidates: string[];
  to: string;
  usedBy: string[];
  rationale: string;
  darkDelta: string;
  cause: string;
  ack: string;
}

/** THE OTHER HALF OF A REVIEW. A row is only resolved when every live leaf is
 *  either aliased or DELIBERATELY kept literal — and the second half needs a
 *  receipt too, or "reviewed and refused" is indistinguishable from "nobody
 *  looked yet". A literal decision writes NOTHING to the minted tree; it only
 *  moves the leaf out of the pending queue and prints its named reason. */
interface LiteralDecision {
  ids: string[];
  leaves: string[];
  value: string;
  /** the candidates the reviewer weighed and declined — a refusal that cannot
   *  name what it declined is not a receipt */
  consideredCandidates: string[];
  reason: string;
  cause: string;
  ack: string;
}

// ---------------------------------------------------------------------------
// Value normalization — COPIED VERBATIM from examples/mui/scripts/
// promote-floor.mjs:50-68 (one join semantics across the two examples; if this
// ever drifts from MUI's the two rounds stop being comparable).
// ---------------------------------------------------------------------------

const tuple = (v: string): string | null => {
  if (typeof v !== 'string') return null;
  let s = v.trim();
  const h3 = /^#([0-9a-f]{3,4})$/i.exec(s);
  if (h3) s = '#' + [...h3[1]].map((c) => c + c).join('');
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${m[2] ? Math.round((parseInt(m[2], 16) / 255) * 10000) / 10000 : 1}`;
  }
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(s);
  if (m) return `${m[1]},${m[2]},${m[3]},${Number(m[4] ?? 1)}`;
  return null;
};
const valueEq = (a: unknown, b: unknown): boolean => {
  if (String(a) === String(b)) return true;
  const ta = tuple(String(a));
  return ta !== null && ta === tuple(String(b));
};

function fail(msg: string): never {
  console.error(`REFUSED: ${msg}`);
  process.exit(1);
}

const readJson = <T,>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

// ---------------------------------------------------------------------------
// TRAP 1 — the anchor-plane guard
// ---------------------------------------------------------------------------

/** The theme-neutral fingerprint. These four names are exactly the ones the
 *  docs theme MOVES (DOCS-THEME.md "the theme delta"), so a docs-plane (or any
 *  re-themed) anchor cannot pass. Value probes, not a filename check: renaming
 *  a file must not be able to smuggle a foreign plane past the gate. */
const ANCHOR_PROBES: Record<string, string> = {
  'color-accent': '#0064E0',
  'color-text-primary': '#0A1317',
  'color-background-body': '#F1F4F7',
  'color-icon-accent': '#0064E0',
};

function assertNeutralAnchor(base: DtcgFlat, anchorPath: string): void {
  const wrong: string[] = [];
  for (const [name, expected] of Object.entries(ANCHOR_PROBES)) {
    const got = base[name]?.$value;
    if (got === undefined) wrong.push(`${name}: MISSING (expected ${expected})`);
    else if (!valueEq(got, expected)) wrong.push(`${name}: ${String(got)} (expected the theme-neutral ${expected})`);
  }
  if (wrong.length > 0) {
    fail(
      `anchor plane is NOT theme-neutral — ${path.relative(REPO, anchorPath)}\n` +
        wrong.map((w) => `  - ${w}`).join('\n') +
        `\n  The join MUST run against tokens/astryx.dtcg.json. Joining a re-themed plane\n` +
        `  value-matches the UNCHANGED pass-throughs and would let the neutral blue join a\n` +
        `  token whose themed value is something else — freezing theme-neutral forever\n` +
        `  behind a "clean" alias. That is a silent no-op dressed as the fix.`,
    );
  }
}

// ---------------------------------------------------------------------------
// DTCG helpers
// ---------------------------------------------------------------------------

/** Resolve a base-plane alias chain to a literal. Returns undefined for a
 *  dangling or cyclic ref (never a guess). */
function resolveBase(base: DtcgFlat, name: string, seen = new Set<string>()): string | undefined {
  const t = base[name];
  if (!t) return undefined;
  const v = String(t.$value);
  const m = /^\{(.+)\}$/.exec(v);
  if (!m) return v;
  if (seen.has(m[1])) return undefined;
  seen.add(m[1]);
  return resolveBase(base, m[1], seen);
}

/** The dark-plane value of a base token: the mode override if the token is
 *  mode-varying, else its (alias-resolved) base value. */
function resolveDark(base: DtcgFlat, dark: DtcgFlat, name: string): string | undefined {
  const override = dark[name];
  if (override !== undefined) {
    const v = String(override.$value);
    const m = /^\{(.+)\}$/.exec(v);
    return m ? (resolveDark(base, dark, m[1]) ?? resolveBase(base, m[1])) : v;
  }
  return resolveBase(base, name);
}

function flattenTree(tree: DtcgTree): Array<{ path: string; leaf: DtcgLeaf }> {
  const out: Array<{ path: string; leaf: DtcgLeaf }> = [];
  const walk = (node: DtcgTree, prefix: string[]): void => {
    for (const k of Object.keys(node).sort()) {
      const v = node[k];
      if (v && typeof v === 'object' && '$value' in (v as object)) out.push({ path: [...prefix, k].join('.'), leaf: v as DtcgLeaf });
      else if (v && typeof v === 'object') walk(v as DtcgTree, [...prefix, k]);
    }
  };
  walk(tree, []);
  return out;
}

function leafAt(tree: DtcgTree, dotPath: string): DtcgLeaf | undefined {
  let node: unknown = tree;
  for (const seg of dotPath.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[seg];
  }
  return node && typeof node === 'object' && '$value' in (node as object) ? (node as DtcgLeaf) : undefined;
}

// ---------------------------------------------------------------------------
// Contract refs — axis-expanded (the promote-floor.mjs resolution-guard rule)
// ---------------------------------------------------------------------------

interface RefEvidence {
  /** "<contract>:{<raw, un-expanded ref>}" */
  users: string[];
  /** base tokens bound to OTHER channels of the same part+variant object */
  siblings: string[];
}

function contractRefs(contractsDir: string): Map<string, RefEvidence> {
  const byLeaf = new Map<string, RefEvidence>();
  const cell = (leaf: string): RefEvidence => {
    if (!byLeaf.has(leaf)) byLeaf.set(leaf, { users: [], siblings: [] });
    return byLeaf.get(leaf)!;
  };
  const add = (leaf: string, user: string, siblings: string[]): void => {
    const e = cell(leaf);
    e.users.push(user);
    for (const s of siblings) if (!e.siblings.includes(s)) e.siblings.push(s);
  };
  const addSiblings = (leaf: string, siblings: string[]): void => {
    const e = cell(leaf);
    for (const s of siblings) if (!e.siblings.includes(s)) e.siblings.push(s);
  };
  for (const f of readdirSync(contractsDir).sort()) {
    if (!f.endsWith('.contract.json')) continue;
    const name = f.replace('.contract.json', '');
    const contract = readJson<{ props?: Array<{ name: string; type?: { enum?: string[] } }> }>(path.join(contractsDir, f));
    const enums: Record<string, string[]> = {};
    for (const pr of contract.props ?? []) if (pr.type?.enum) enums[pr.name] = pr.type.enum;
    const expand = (ref: string): string[] => {
      let refs = [ref];
      for (const [prop, vals] of Object.entries(enums)) {
        if (!ref.includes(`{${prop}}`)) continue;
        refs = refs.flatMap((r) => vals.map((v) => r.replaceAll(`{${prop}}`, v)));
      }
      return refs;
    };
    // Walk the contract as a TREE (not a regex over the serialized text) so the
    // PART + PROP + VARIANT a channel map belongs to is visible.
    //
    // The vocabulary splits one variant's channels across TWO sibling lists on
    // the same part — `tokensByProp` (semantic refs) and `literalsByProp`
    // (the minted refs). Badge's tone=blue is:
    //   tokensByProp  [{prop:"variant", map:{ blue:{ color:"{color-text-blue}" }}}]
    //   literalsByProp[{prop:"variant", map:{ blue:{ "row-rule-color":"{imported.…blue}" }}}]
    // So the sibling of the literal is found by keying on (part, prop, variant)
    // ACROSS both lists — not by object identity.
    const byCell = new Map<string, { base: string[]; imported: Array<{ raw: string }> }>();
    const walk = (node: unknown, keyPath: string[]): void => {
      if (Array.isArray(node)) { node.forEach((v, i) => walk(v, [...keyPath, String(i)])); return; }
      if (!node || typeof node !== 'object') return;
      const obj = node as Record<string, unknown>;
      if (typeof obj.prop === 'string' && obj.map && typeof obj.map === 'object') {
        // partPath = the owning part: drop the array index and the container key
        const partPath = keyPath.slice(0, -2).join('/');
        for (const [variant, channels] of Object.entries(obj.map as Record<string, unknown>)) {
          if (!channels || typeof channels !== 'object') continue;
          const cellKey = `${partPath}|${obj.prop}|${variant}`;
          if (!byCell.has(cellKey)) byCell.set(cellKey, { base: [], imported: [] });
          const cell = byCell.get(cellKey)!;
          for (const v of Object.values(channels as Record<string, unknown>)) {
            if (typeof v !== 'string') continue;
            if (/^\{imported\./.test(v)) cell.imported.push({ raw: v.slice(1, -1) });
            else if (/^\{[a-z][a-z0-9-]*\}$/.test(v)) { const t = v.slice(1, -1); if (!cell.base.includes(t)) cell.base.push(t); }
          }
        }
      }
      for (const [k, v] of Object.entries(obj)) walk(v, [...keyPath, k]);
    };
    walk(contract, []);
    // REF COUNT stays exactly the promote-floor.mjs resolution-guard semantics:
    // one count per TEXTUAL {imported.*} occurrence, axis-expanded. (This is the
    // number DOCS-THEME.md's 111/222 was measured with — changing it here would
    // silently move a published finding.)
    for (const m of JSON.stringify(contract).matchAll(/"\{(imported\.[^"]+)\}"/g)) {
      for (const r of expand(m[1])) add(r, `${name}:{${m[1]}}`, []);
    }
    // SIBLING FACTS are indexed independently of the count.
    for (const cell of byCell.values()) {
      for (const { raw } of cell.imported) for (const r of expand(raw)) addSiblings(r, cell.base);
    }
  }
  return byLeaf;
}

// ---------------------------------------------------------------------------
// Leaf-path parsing: imported.<comp>.<part…>.<channel>[.axisVal…]
// ---------------------------------------------------------------------------

const stripState = (s: string): { channel: string; state: string | null } => {
  const m = /^(.*)-state-([a-z-]+)$/.exec(s);
  return m ? { channel: m[1], state: m[2] } : { channel: s, state: null };
};
const isChannelSeg = (s: string): boolean => {
  const { channel } = stripState(s);
  return channel === 'color' || channel.endsWith('-color') || channel === 'fill' || channel.startsWith('background-');
};

function parseLeafPath(leafPath: string): Pick<MintedLeaf, 'channel' | 'state' | 'part' | 'axisValues'> {
  const segs = leafPath.split('.');
  for (let i = segs.length - 1; i >= 2; i--) {
    if (!isChannelSeg(segs[i])) continue;
    const { channel, state } = stripState(segs[i]);
    return { channel, state, part: segs.slice(2, i).join('.') || 'root', axisValues: segs.slice(i + 1) };
  }
  // e.g. imported.shared.color-0064e0 — a VALUE-NAMED shared leaf; the path
  // spells no channel, so no channel rule may fire (named, not guessed).
  return { channel: null, state: null, part: segs.slice(2, segs.length - 1).join('.') || 'root', axisValues: [] };
}

// ---------------------------------------------------------------------------
// Name affinity — RANK AND PRESENT, NEVER AUTO-RESOLVE
// ---------------------------------------------------------------------------

/** The five channel-class rules, exactly as scoped. Anything else fires NO
 *  channel rule and says so — inventing a sixth rule would be guessing. */
function channelRule(l: MintedLeaf): { prefixes: string[]; rule: string } | null {
  if (l.channel === null) return null;
  if (l.channel === 'background-color' || l.channel === 'background-image') {
    return { prefixes: ['color-background-', 'color-accent'], rule: 'channel:background-color→color-background-*/color-accent' };
  }
  if (l.channel === 'color') return { prefixes: ['color-text-'], rule: 'channel:color→color-text-*' };
  if (/^border-(top|right|bottom|left)-color$/.test(l.channel) || l.channel === 'border-color') {
    return { prefixes: ['color-border-'], rule: 'channel:border-*-color→color-border-*' };
  }
  if (l.part.split('.').some((p) => p.includes('icon')) || l.channel === 'fill') {
    return { prefixes: ['color-icon-'], rule: 'channel:icon part→color-icon-*' };
  }
  return null;
}

function rankCandidates(
  leaves: MintedLeaf[],
  candidateTokens: string[],
  base: DtcgFlat,
  dark: DtcgFlat,
  literal: string,
): RankedCandidate[] {
  const ranked = candidateTokens.map((token) => {
    let score = 0;
    const rules: string[] = [];
    // R1 — channel class, scored PER LEAF (a row can span several channels;
    // scoring only when they all agree would throw away a real signal on a
    // mixed row). The fraction is named so a reviewer sees how much of the row
    // the rule actually covers.
    const perLeaf = leaves.map((l) => channelRule(l));
    const hits = leaves.filter((l, i) => perLeaf[i] !== null && perLeaf[i]!.prefixes.some((p) => token.startsWith(p)));
    if (hits.length > 0) {
      const ruleNames = [...new Set(hits.map((_, i) => perLeaf[leaves.indexOf(hits[i])]!.rule))].sort();
      score += 3;
      rules.push(`+3 ${ruleNames.join(' / ')} (${hits.length}/${leaves.length} leaf/leaves)`);
    } else if (perLeaf.every((r) => r === null)) {
      const chans = [...new Set(leaves.map((l) => l.channel ?? '(value-named shared leaf)'))].sort();
      rules.push(`+0 no channel rule: ${chans.join(', ')} matches none of the five named channel classes (background-color, color, border-*-color, icon parts, fill)`);
    } else {
      rules.push('+0 the row\'s channel class(es) do not point at this token family');
    }
    // R2 — axis-value affinity: an axis value the leaf is conditioned on
    // matching the candidate's trailing name segment (blue → *-blue).
    const axisVals = [...new Set(leaves.flatMap((l) => [...l.axisValues, ...(l.state ? [l.state] : [])]))].sort();
    const tail = token.split('-').pop() ?? '';
    const hit = axisVals.filter((v) => v === tail);
    if (hit.length > 0) {
      score += 2;
      rules.push(`+2 axis:${hit.join('|')}→*-${tail}`);
    }
    // R4 — SIBLING-CHANNEL FACT (the strongest signal, and the only one that is
    // not a heuristic): the contract already binds ANOTHER channel of the same
    // part+variant object to this candidate. Example: badge tone=blue binds
    // `color` → {color-text-blue} in the same channel map where
    // `row-rule-color` is the minted literal #042f97 — and CSS row-rule-color
    // computes from currentColor, i.e. from `color`. That is a committed
    // binding sitting next to the literal, not a name guess.
    const sibLeaves = leaves.filter((l) => l.siblingTokens.includes(token));
    if (sibLeaves.length > 0) {
      score += 4;
      rules.push(`+4 sibling-channel fact: ${sibLeaves.length}/${leaves.length} leaf/leaves sit in a contract channel map that already binds {${token}}`);
    }
    // R3 — part-name affinity (weakest signal; a tie-break, never a decider).
    const partHit = [...new Set(leaves.flatMap((l) => l.part.split('.')))].filter((p) => p !== 'root' && token.includes(p));
    if (partHit.length > 0) {
      score += 1;
      rules.push(`+1 part:${partHit.sort().join('|')}`);
    }
    if (rules.length === 0) rules.push('+0 no affinity rule fired');
    const light = resolveBase(base, token) ?? '(unresolvable)';
    const darkV = resolveDark(base, dark, token) ?? '(unresolvable)';
    const modeVarying = !valueEq(light, darkV);
    return {
      token,
      score,
      rules,
      darkDelta: {
        light,
        dark: darkV,
        modeVarying,
        effect: modeVarying
          ? `DARK REPAIR — the leaf is frozen at ${literal} in BOTH modes today; aliasing to {${token}} makes it ${light} light / ${darkV} dark. This is a deliberate pixel change in dark mode.`
          : `mode-safe — {${token}} is ${light} in both modes, identical to the frozen literal ${literal}; aliasing changes NO pixel in either mode (semantics only).`,
      },
    };
  });
  // deterministic: score desc, then name asc
  return ranked.sort((a, b) => b.score - a.score || a.token.localeCompare(b.token));
}

// ---------------------------------------------------------------------------
// Exclusions — every one greppable BY NAME
// ---------------------------------------------------------------------------

/** THE POISONED SET — decided by EVIDENCE IN THE TREE, not by a path denylist.
 *
 *  A `imported.card.root.border-<side>-color.<variant>` leaf is poisoned when
 *  its OWN sibling `border-<side>-width.<variant>` is 0px: a color channel on a
 *  zero-width border paints nothing, so its literal is an unobservable
 *  by-product of the capture, not a design fact. That is true of 12 of card's
 *  13 variants; `default` (1px, #ccd3db) is a REAL border and stays in the
 *  review queue where it belongs.
 *
 *  The corroborating evidence for WHY those 12 read #000000: the card capture
 *  ran DEGRADED. `extract/computed/out/astryx/card/LEDGER.md` records
 *  root.font-family observed `Times` (an unstyled document) and root.color
 *  observed `rgba(0, 0, 0, 1)` where the contract expects
 *  `rgba(10, 19, 23, 1)`. The black is CSS `currentColor` resolving against an
 *  unstyled root — an UNTRIAGED CAPTURE DEFECT. The value joins {color-on-light}
 *  1:1 and would read as "clean", which is exactly the trap: aliasing it would
 *  LAUNDER a capture defect into a semantic binding that looks deliberate
 *  forever. The fix is to re-capture card. */
const CARD_BORDER_LEAF = /^imported\.card\.root\.border-(top|right|bottom|left)-color\.(.+)$/;

function isZeroWidthCardBorder(leafPath: string, minted: DtcgTree): boolean {
  const m = CARD_BORDER_LEAF.exec(leafPath);
  if (!m) return false;
  const width = leafAt(minted, `imported.card.root.border-${m[1]}-width.${m[2]}`);
  return width !== undefined && /^0(px)?$/.test(String(width.$value).trim());
}

// ---------------------------------------------------------------------------
// The join
// ---------------------------------------------------------------------------

const hexKey = (t: string): string => {
  const [r, g, b, a] = t.split(',').map(Number);
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return h(r) + h(g) + h(b) + (a === 1 ? '' : h(Math.round(a * 255)));
};

export interface JoinInput {
  base: DtcgFlat;
  dark: DtcgFlat;
  minted: DtcgTree;
  refs: Map<string, RefEvidence>;
  /** leaf path → the acked LITERAL decision that covers it (see
   *  LiteralDecision). Absent = the leaf is still pending review. */
  literals?: Map<string, LiteralDecision>;
}

export function computeRows(input: JoinInput): ProposalRow[] {
  const { base, dark, minted, refs } = input;
  const literals = input.literals ?? new Map<string, LiteralDecision>();

  // the anchor inventory: every base token whose $type is color, alias-resolved
  const baseColors = new Map<string, string>();
  for (const name of Object.keys(base).sort()) {
    if (base[name]?.$type !== 'color') continue;
    const rv = resolveBase(base, name);
    if (rv === undefined) continue;
    baseColors.set(name, rv);
  }

  const all = flattenTree(minted);
  const rows: ProposalRow[] = [];

  // --- gradients: match NO scalar color token, excluded by name -------------
  const gradients = all.filter((x) => x.leaf.$type === 'gradient');
  if (gradients.length > 0) {
    const leaves = gradients.map((g) => g.path).sort();
    rows.push({
      id: 'RA-X-gradient',
      disposition: 'excluded',
      exclusion: 'non-scalar-gradient',
      value: String(gradients[0].leaf.$value),
      tuple: '(non-scalar)',
      leaves,
      leafDetail: leaves.map((l) => ({ leaf: l, component: l.split('.')[1] ?? '', ...parseLeafPath(l), refs: refs.get(l)?.users.length ?? 0 })),
      channelClasses: [...new Set(leaves.map((l) => parseLeafPath(l).channel ?? '(none)'))].sort(),
      refs: leaves.reduce((a, l) => a + (refs.get(l)?.users.length ?? 0), 0),
      usedBy: leaves.flatMap((l) => refs.get(l)?.users ?? []).sort(),
      candidates: [],
      lightProof: 'n/a — a gradient is not a scalar color; the DTCG base has no gradient token to join against.',
      evidence: [
        'EXCLUDED non-scalar-gradient: the value is a linear-gradient() string. The join key is a normalized r,g,b,a tuple, which a gradient has none of.',
        'A gradient can only be re-anchored once the base wrap carries gradient tokens. Named, not silently dropped.',
      ],
    });
  }

  // --- color leaves grouped by normalized value ----------------------------
  const colorLeaves = all.filter((x) => x.leaf.$type === 'color');
  const groups = new Map<string, MintedLeaf[]>();
  for (const { path: leafPath, leaf } of colorLeaves) {
    const raw = String(leaf.$value);
    // An ALREADY-APPLIED leaf joins on the value its alias RESOLVES to, so the
    // row keeps its id and stays in the queue as `applied` instead of silently
    // vanishing once it lands.
    const am = /^\{(.+)\}$/.exec(raw);
    const aliasedTo = am ? am[1] : null;
    const v = aliasedTo ? (resolveBase(base, aliasedTo) ?? raw) : raw;
    const t = tuple(v);
    if (t === null) continue; // unparseable colors are handled below
    const parsed = parseLeafPath(leafPath);
    const ev = refs.get(leafPath);
    const entry: MintedLeaf = { leaf: leafPath, value: v, aliasedTo, usedBy: (ev?.users ?? []).slice().sort(), siblingTokens: (ev?.siblings ?? []).slice().sort(), ...parsed };
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t)!.push(entry);
  }
  const unparseable = colorLeaves.filter((x) => {
    const m = /^\{(.+)\}$/.exec(String(x.leaf.$value));
    return tuple(m ? (resolveBase(base, m[1]) ?? String(x.leaf.$value)) : String(x.leaf.$value)) === null;
  });
  if (unparseable.length > 0) {
    rows.push({
      id: 'RA-X-unparseable',
      disposition: 'excluded',
      exclusion: 'non-scalar-gradient',
      value: String(unparseable[0].leaf.$value),
      tuple: '(unparseable)',
      leaves: unparseable.map((u) => u.path).sort(),
      leafDetail: unparseable
        .map((u) => u.path)
        .sort()
        .map((l) => ({ leaf: l, component: l.split('.')[1] ?? '', ...parseLeafPath(l), refs: refs.get(l)?.users.length ?? 0 })),
      channelClasses: [...new Set(unparseable.map((u) => parseLeafPath(u.path).channel ?? '(none)'))].sort(),
      refs: 0,
      usedBy: [],
      candidates: [],
      lightProof: 'n/a — the literal does not normalize to an r,g,b,a tuple.',
      evidence: ['EXCLUDED: color literal outside the hex/rgb(a) grammar the join normalizes. Named rather than coerced.'],
    });
  }

  const mkRow = (
    id: string,
    disposition: Disposition,
    exclusion: ProposalRow['exclusion'] | undefined,
    ls: MintedLeaf[],
    t: string,
    candidates: RankedCandidate[],
    lightProof: string,
    evidence: string[],
  ): ProposalRow => ({
    id,
    disposition,
    ...(exclusion ? { exclusion } : {}),
    value: ls[0].value,
    tuple: t,
    leaves: ls.map((l) => l.leaf).sort(),
    leafDetail: ls
      .slice()
      .sort((a, b) => a.leaf.localeCompare(b.leaf))
      .map((l) => ({
        leaf: l.leaf,
        component: l.leaf.split('.')[1] ?? '',
        part: l.part,
        channel: l.channel,
        state: l.state,
        axisValues: l.axisValues,
        refs: l.usedBy.length,
        aliasedTo: l.aliasedTo,
        ...(l.aliasedTo === null && literals.has(l.leaf) ? { decidedLiteral: literals.get(l.leaf)!.reason } : {}),
      })),
    channelClasses: [...new Set(ls.map((l) => l.channel ?? '(none — value-named shared leaf)'))].sort(),
    refs: ls.reduce((a, l) => a + l.usedBy.length, 0),
    usedBy: ls.flatMap((l) => l.usedBy).sort(),
    candidates,
    lightProof,
    evidence,
  });

  for (const t of [...groups.keys()].sort()) {
    const ls = groups.get(t)!;
    const key = hexKey(t);
    const candidateTokens = [...baseColors.entries()].filter(([, v]) => tuple(v) === t).map(([n]) => n).sort();

    const poisoned = ls.filter((l) => isZeroWidthCardBorder(l.leaf, minted));
    const rest = ls.filter((l) => !isZeroWidthCardBorder(l.leaf, minted));
    const unreferenced = rest.filter((l) => l.usedBy.length === 0);
    const live = rest.filter((l) => l.usedBy.length > 0);

    if (poisoned.length > 0) {
      rows.push(
        mkRow(
          `RA-X-cardborder-${key}`,
          'excluded',
          'card-border-degraded-capture',
          poisoned,
          t,
          [],
          `would join 1:1 to {${candidateTokens.join(', ')}} — which is exactly why it is refused: a clean-looking join over a defective observation.`,
          [
            'EXCLUDED card-border-degraded-capture (BY NAME, not by score).',
            `Evidence 1 — the border is not drawn: each of these ${poisoned.length} leaves has its OWN sibling border-<side>-width at 0px (checked per leaf, not assumed). A color channel on a zero-width border paints nothing. card's \`default\` variant, whose border IS 1px, is deliberately NOT here — it is #ccd3db and sits in the review queue.`,
            'Evidence 2 — the capture ran DEGRADED: extract/computed/out/astryx/card/LEDGER.md records root.font-family observed `Times` (an unstyled document) and root.color observed `rgba(0, 0, 0, 1)` against the contract-expected `rgba(10, 19, 23, 1)`.',
            'Conclusion: the black is CSS `currentColor` resolving against an unstyled root — an UNTRIAGED CAPTURE DEFECT, not design intent. Aliasing it would LAUNDER the defect into a semantic binding that looks deliberate forever. The fix is to re-capture card, not to re-anchor its borders.',
          ],
        ),
      );
    }
    if (unreferenced.length > 0) {
      rows.push(
        mkRow(
          `RA-X-unref-${key}`,
          'excluded',
          'unreferenced-leaf',
          unreferenced,
          t,
          [],
          `n/a — nothing binds these leaves, so no rendered pixel can be proven either way.`,
          [
            'EXCLUDED unreferenced-leaf: ZERO axis-expanded {imported.*} refs from any of the 13 contracts reach these leaves.',
            'Re-anchoring an unbound leaf changes no pixel and no semantics a consumer can observe — it only adds an unverifiable claim to the tree. Receipted here so the choice is visible, not silent.',
            `Candidates the value WOULD have matched: ${candidateTokens.length > 0 ? candidateTokens.join(', ') : '(none)'}.`,
          ],
        ),
      );
    }
    if (live.length === 0) continue;

    const ranked = rankCandidates(live, candidateTokens, base, dark, live[0].value);
    if (candidateTokens.length === 0) {
      rows.push(
        mkRow(`RA-nomatch-${key}`, 'no-match', undefined, live, t, [], 'n/a — no base color token carries this value.', [
          'NO MATCH: the literal equals no color token in the neutral anchor. There is nothing to re-anchor onto; the leaf stays literal by construction.',
        ]),
      );
      continue;
    }
    const keptLiteral = live.filter((l) => l.aliasedTo === null && literals.has(l.leaf));
    const pending = live.filter((l) => l.aliasedTo === null && !literals.has(l.leaf));
    const landed = [...new Set(live.filter((l) => l.aliasedTo !== null).map((l) => l.aliasedTo as string))].sort();
    const disposition: Disposition =
      pending.length > 0 ? (candidateTokens.length === 1 ? 'clean' : 'ambiguous') : landed.length > 0 ? 'applied' : 'decided-literal';
    const literalLines = keptLiteral.map(
      (l) => `DECIDED LITERAL — \`${l.leaf}\` (${l.usedBy.length} ref(s)): ${literals.get(l.leaf)!.reason}`,
    );
    const evidence =
      disposition === 'applied'
        ? [
            keptLiteral.length === 0
              ? `APPLIED: all ${live.length} live leaf/leaves in this group already alias {${landed.join('}, {')}} — landed from tokens/reanchor-decisions.json.`
              : `RESOLVED: ${live.length - keptLiteral.length} of ${live.length} live leaves alias {${landed.join('}, {')}} (landed from tokens/reanchor-decisions.json); the remaining ${keptLiteral.length} were REVIEWED AND KEPT LITERAL — receipts below. Nothing in this row is pending.`,
            ...literalLines,
            'The row stays in the queue on purpose: a landed decision must remain visible and re-runnable. `--apply` on this id is an idempotent no-op that re-verifies the ledger against the current DTCG.',
            'TO REVERT: delete the row from tokens/reanchor-decisions.json and re-run `npx tsx examples/astryx/scripts/promote-floor.ts` (the minted tree is regenerated from the computed-floor capture, so the literal comes back).',
          ]
        : disposition === 'decided-literal'
        ? [
            `DECIDED LITERAL: every one of this group's ${live.length} live leaf/leaves was reviewed and deliberately kept literal — an acked refusal in tokens/reanchor-decisions.json ("literals"), NOT an unreviewed pending row.`,
            ...literalLines,
            'A literal decision writes nothing to the minted tree; it is a receipt. TO RE-OPEN: delete the row from the "literals" array and re-run --propose.',
          ]
        : disposition === 'clean'
        ? [
            `CLEAN: exactly ONE base color token carries ${live[0].value}, and ${live.length} minted leaf/leaves carry it.`,
            `Affinity: ${ranked[0].rules.join('; ')} (score ${ranked[0].score}).`,
            live.some((l) => l.siblingTokens.includes(ranked[0].token))
              ? `CORROBORATED BY A COMMITTED BINDING, not by name-shape alone: the contract already binds another channel of the same part+variant to {${ranked[0].token}} (${[...new Set(live.flatMap((l) => l.usedBy.map((u) => u.split(':')[0])))].sort().join(', ')}).`
              : 'No sibling-channel binding corroborates this row — the value join and the name are the whole case. Weigh accordingly.',
            ranked[0].darkDelta.effect,
          ]
        : [
            `AMBIGUOUS: ${candidateTokens.length} base tokens share ${live[0].value}. The value join CANNOT decide between them and this script will NOT try — ranking is presentation, not resolution.`,
            'StyleX compiled the source token name away, so no recorded fact says which one the literal came from.',
            'THE DECIDING QUESTION IS USUALLY DARK MODE: the candidates below diverge in the dark plane. Pick the one whose dark behaviour is correct for this channel, then add a row to tokens/reanchor-decisions.json.',
            [...new Set(live.map((l) => l.channel ?? '(none)'))].length > 1
              ? `SPLIT SIGNAL: these leaves span ${[...new Set(live.map((l) => l.channel ?? '(none)'))].sort().join(', ')} — different channel classes can legitimately want DIFFERENT targets. A decision row may name a SUBSET of this row's leaves; write one row per target.`
              : `All leaves share one channel class (${live[0].channel ?? 'none — value-named shared leaf'}), so one target can cover the row.`,
            ...(literalLines.length > 0
              ? [`PARTIALLY DECIDED: ${keptLiteral.length} of this row's leaves are already acked as DECIDED LITERAL; ${pending.length} remain pending.`, ...literalLines]
              : []),
          ];
    rows.push(
      mkRow(
        `RA-${key}`,
        disposition,
        undefined,
        live,
        t,
        ranked,
        `every candidate's NEUTRAL light value tuple-equals the leaf literal ${live[0].value} (${t}) — re-verified at apply time against the then-current DTCG.`,
        evidence,
      ),
    );
  }

  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export function loadPlanes(anchorPath: string): { base: DtcgFlat; dark: DtcgFlat; minted: DtcgTree; refs: Map<string, RefEvidence> } {
  if (!existsSync(anchorPath)) fail(`anchor DTCG not found: ${anchorPath}`);
  const base = readJson<DtcgFlat>(anchorPath);
  assertNeutralAnchor(base, anchorPath);
  const dark = readJson<DtcgFlat>(path.join(EX, 'tokens', 'modes', 'astryx.dark.dtcg.json'));
  const minted = readJson<DtcgTree>(path.join(EX, 'tokens', 'astryx-minted.dtcg.json'));
  const refs = contractRefs(path.join(EX, 'contracts'));
  return { base, dark, minted, refs };
}

// ---------------------------------------------------------------------------
// --propose
// ---------------------------------------------------------------------------

function proposalsMarkdown(rows: ProposalRow[], anchorRel: string): string {
  const n = (d: Disposition) => rows.filter((r) => r.disposition === d);
  const refsOf = (d: Disposition) => n(d).reduce((a, r) => a + r.refs, 0);
  const L: string[] = [];
  L.push('# Astryx minted-literal re-anchoring — PROPOSALS (review queue)');
  L.push('');
  L.push('Generated by `npx tsx examples/astryx/scripts/reanchor-minted.ts --propose`.');
  L.push('**This file applies nothing.** It REPORTS the state of the ledger. Landing a row');
  L.push('means adding it to `tokens/reanchor-decisions.json` and running `--apply <id>`;');
  L.push('deciding to KEEP a leaf literal means adding a row to that file\'s `literals` array.');
  L.push('A row is only RESOLVED when every live leaf it holds is one or the other —');
  L.push('`ambiguous` and `clean` rows are the ones still waiting on a human.');
  L.push('');
  L.push(`- **Anchor plane**: \`${anchorRel}\` — THEME-NEUTRAL, value-fingerprinted (${Object.entries(ANCHOR_PROBES).map(([k, v]) => `${k}=${v}`).join(', ')}). A re-themed anchor is refused by name.`);
  L.push(`- **Join**: normalized r,g,b,a tuple equality (\`tuple()\`/\`valueEq()\` copied verbatim from \`examples/mui/scripts/promote-floor.mjs\`), minted color leaf × alias-resolved base color token.`);
  L.push('- **Ranking is presentation.** A row with more than one candidate is NEVER auto-resolved; StyleX compiled the source name away, so no fact decides it.');
  L.push('- **Every alias is a dark-mode change.** Minted literals are mode-frozen; semantic tokens vary. Each candidate carries its `darkDelta`.');
  L.push('');
  L.push('## Ledger');
  L.push('');
  L.push('| disposition | rows | leaves | axis-expanded refs |');
  L.push('|---|---|---|---|');
  for (const d of ['applied', 'decided-literal', 'clean', 'ambiguous', 'no-match', 'excluded'] as Disposition[]) {
    L.push(`| ${d} | ${n(d).length} | ${n(d).reduce((a, r) => a + r.leaves.length, 0)} | ${refsOf(d)} |`);
  }
  L.push('');
  for (const d of ['applied', 'decided-literal', 'clean', 'ambiguous', 'no-match', 'excluded'] as Disposition[]) {
    const set = n(d);
    if (set.length === 0) continue;
    L.push(`## ${d.toUpperCase()} — ${set.length} row(s), ${set.reduce((a, r) => a + r.refs, 0)} ref(s)`);
    L.push('');
    for (const r of set) {
      L.push(`### \`${r.id}\` — \`${r.value}\`${r.exclusion ? ` · EXCLUDED \`${r.exclusion}\`` : ''}`);
      L.push('');
      L.push(`- **leaves** (${r.leaves.length}): ${r.leaves.length <= 6 ? r.leaves.map((l) => `\`${l}\``).join(', ') : r.leaves.slice(0, 4).map((l) => `\`${l}\``).join(', ') + `, … (+${r.leaves.length - 4} more, see reanchor-proposals.json)`}`);
      L.push(`- **used by** (${r.refs} axis-expanded ref(s)): ${r.refs === 0 ? '_nothing_' : [...new Set(r.usedBy.map((u) => u.split(':')[0]))].sort().join(', ')}`);
      L.push(`- **channel classes**: ${r.channelClasses.map((c) => `\`${c}\``).join(', ')}`);
      const kept = r.leafDetail.filter((d) => d.decidedLiteral !== undefined);
      if (kept.length > 0) {
        L.push(`- **decided literal** (${kept.length} leaf/leaves, ${kept.reduce((a, d) => a + d.refs, 0)} ref(s)): reviewed and deliberately NOT re-anchored — ${kept.map((d) => `\`${d.leaf}\``).join(', ')}`);
      }
      L.push(`- **light-plane proof**: ${r.lightProof}`);
      if (r.candidates.length > 0) {
        L.push('');
        L.push('| rank | candidate | score | affinity rules | light | dark | dark effect |');
        L.push('|---|---|---|---|---|---|---|');
        r.candidates.forEach((c, i) => {
          L.push(
            `| ${i + 1} | \`${c.token}\` | ${c.score} | ${c.rules.join('<br>')} | \`${c.darkDelta.light}\` | \`${c.darkDelta.dark}\` | ${c.darkDelta.modeVarying ? '**dark repair**' : 'mode-safe'} |`,
          );
        });
      }
      L.push('');
      for (const e of r.evidence) L.push(`> ${e}`);
      L.push('');
    }
  }
  return L.join('\n') + '\n';
}

/** MINTED.md — the promotion receipt, same three-number shape as MUI's
 *  (`examples/mui/tokens/MINTED.md`, emitted by promote-floor.mjs): N aliased,
 *  N literal, N named refusals. Astryx had none before this round because it
 *  had no alias pass to receipt. */
function mintedMarkdown(rows: ProposalRow[], minted: DtcgTree): string {
  const all = flattenTree(minted);
  const isAlias = (v: unknown) => /^\{.+\}$/.test(String(v));
  const aliased = all.filter((x) => isAlias(x.leaf.$value));
  const byType = (t: string) => all.filter((x) => x.leaf.$type === t).length;
  const excluded = rows.filter((r) => r.disposition === 'excluded');
  const ambiguous = rows.filter((r) => r.disposition === 'ambiguous');
  const L: string[] = [];
  L.push('# Astryx minted tokens — re-anchoring receipt');
  L.push('');
  L.push('Generated by `npx tsx examples/astryx/scripts/reanchor-minted.ts --propose`.');
  L.push('The MUI counterpart is `examples/mui/tokens/MINTED.md`; the numbers mean the same thing.');
  L.push('');
  L.push(`- **${aliased.length} leaves re-anchored** to Astryx's own semantic tokens (value-verified twice: at \`--apply\`, and again by the byte-gate that re-emits the neutral figma scripts)`);
  L.push(`- **${all.length - aliased.length} leaves kept literal** (${all.length} total: ${byType('color')} color, ${byType('dimension')} dimension, ${byType('number')} number, ${byType('gradient')} gradient)`);
  L.push(`- **${excluded.length} named refusals** covering ${excluded.reduce((a, r) => a + r.leaves.length, 0)} leaves / ${excluded.reduce((a, r) => a + r.refs, 0)} axis-expanded refs`);
  const literalRows = loadLiteralDecisions();
  const keptLeaves = rows.flatMap((r) => r.leafDetail.filter((d) => d.decidedLiteral !== undefined));
  L.push(`- **${keptLeaves.length} leaves REVIEWED AND KEPT LITERAL** (${keptLeaves.reduce((a, d) => a + d.refs, 0)} axis-expanded refs, ${literalRows.length} acked receipt row(s)) — a refusal with a named reason, not a pending row`);
  L.push(
    ambiguous.length === 0
      ? '- **0 rows awaiting human review** — the queue is RESOLVED: every live leaf is either re-anchored or decided-literal with a receipt.'
      : `- **${ambiguous.length} rows / ${ambiguous.reduce((a, r) => a + r.refs, 0)} refs AWAITING HUMAN REVIEW** — see \`reanchor-proposals.md\`. Not refused, not decided: a value join cannot pick between equal-valued tokens and this project does not guess.`,
  );
  L.push('');
  L.push('## Why astryx cannot run MUI\'s pass');
  L.push('');
  L.push('MUI ships Emotion runtime styles whose emitted rules NAME the token each');
  L.push('channel binds (`var(--mui-palette-primary-main)`), so `promote-floor.mjs` aliases');
  L.push('on RECORDED EVIDENCE. StyleX compiles the token name away — the atomic class');
  L.push('carries a literal hex — so astryx has **no `source-bindings.json` by');
  L.push('construction**. All that survives is the VALUE, so this example runs a value');
  L.push('join that RANKS and PRESENTS and never auto-resolves.');
  L.push('');
  L.push('## Re-anchored leaves');
  L.push('');
  L.push('| leaf | → token | ledger row |');
  L.push('|---|---|---|');
  const decisions = loadDecisions();
  for (const { path: p, leaf } of aliased) {
    const d = decisions.find((x) => x.leaves.includes(p));
    L.push(`| \`${p}\` | \`${String(leaf.$value)}\` | ${d ? d.ids.map((i) => `\`${i}\``).join(', ') : '**UNLEDGERED — investigate**'} |`);
  }
  L.push('');
  if (keptLeaves.length > 0) {
    L.push('## Reviewed and kept literal (decided, not pending)');
    L.push('');
    L.push('These leaves were looked at leaf-by-leaf and DELIBERATELY left as literals:');
    L.push('the evidence on disk does not grade a semantic target, and a plausible-looking');
    L.push('alias with no evidence behind it is the failure this whole round exists to avoid.');
    L.push('');
    L.push('| leaf | refs | reason | ledger row |');
    L.push('|---|---|---|---|');
    for (const d of keptLeaves.slice().sort((a, b) => a.leaf.localeCompare(b.leaf))) {
      const row = literalRows.find((x) => x.leaves.includes(d.leaf));
      L.push(`| \`${d.leaf}\` | ${d.refs} | ${d.decidedLiteral} | ${row ? row.ids.map((i) => `\`${i}\``).join(', ') : '**UNLEDGERED — investigate**'} |`);
    }
    L.push('');
  }
  L.push('## Named refusals');
  L.push('');
  for (const r of excluded) {
    L.push(`- **\`${r.id}\`** (\`${r.exclusion}\`) — ${r.leaves.length} leaf/leaves, ${r.refs} ref(s), value \`${r.value}\`:`);
    for (const e of r.evidence) L.push(`  - ${e}`);
  }
  L.push('');
  return L.join('\n') + '\n';
}

function propose(anchorPath: string): void {
  const { base, dark, minted, refs } = loadPlanes(anchorPath);
  const literalRows = loadLiteralDecisions();
  const literals = literalIndex(literalRows, minted);
  const rows = computeRows({ base, dark, minted, refs, literals });
  const anchorRel = path.relative(REPO, anchorPath);
  const payload = {
    _marker:
      'ASTRYX MINTED RE-ANCHORING PROPOSALS — a REVIEW QUEUE, not a decision. Rows land only via tokens/reanchor-decisions.json + reanchor-minted.ts --apply. Ambiguous rows are TJ\'s to decide; ranking never resolves them.',
    anchor: anchorRel,
    anchorProbes: ANCHOR_PROBES,
    generatedBy: 'examples/astryx/scripts/reanchor-minted.ts --propose',
    summary: {
      applied: rows.filter((r) => r.disposition === 'applied').reduce((a, r) => a + r.refs, 0),
      clean: rows.filter((r) => r.disposition === 'clean').reduce((a, r) => a + r.refs, 0),
      ambiguous: rows.filter((r) => r.disposition === 'ambiguous').reduce((a, r) => a + r.refs, 0),
      noMatch: rows.filter((r) => r.disposition === 'no-match').reduce((a, r) => a + r.refs, 0),
      excluded: rows.filter((r) => r.disposition === 'excluded').reduce((a, r) => a + r.refs, 0),
      decidedLiteral: rows.filter((r) => r.disposition === 'decided-literal').reduce((a, r) => a + r.refs, 0),
      rows: rows.length,
      // The reviewed-and-kept-literal leaves, counted ACROSS dispositions: a
      // resolved row can hold both aliases and receipts, so this number does
      // not live in any single disposition bucket.
      literalReceipts: {
        rows: literalRows.length,
        leaves: literals.size,
        refs: rows.reduce((a, r) => a + r.leafDetail.filter((d) => d.decidedLiteral !== undefined).reduce((x, d) => x + d.refs, 0), 0),
      },
    },
    rows,
  };
  writeFileSync(path.join(EX, 'tokens', 'reanchor-proposals.json'), JSON.stringify(payload, null, 2) + '\n');
  writeFileSync(path.join(EX, 'tokens', 'reanchor-proposals.md'), proposalsMarkdown(rows, anchorRel));
  writeFileSync(path.join(EX, 'tokens', 'MINTED.md'), mintedMarkdown(rows, minted));
  const s = payload.summary;
  console.log(
    `✔ proposals → examples/astryx/tokens/reanchor-proposals.{json,md} — ${rows.length} rows; ` +
      `refs: ${s.applied} APPLIED (ledger), ${s.clean} clean-unapplied, ${s.ambiguous} ambiguous (REVIEW QUEUE — not decided), ${s.noMatch} no-match, ${s.excluded} excluded by name, ` +
      `${s.literalReceipts.refs} DECIDED LITERAL (${s.literalReceipts.leaves} leaf/leaves, reviewed and kept literal with receipts)`,
  );
}

// ---------------------------------------------------------------------------
// --apply  (the resolve.ts discipline: committed ledger + explicit ids)
// ---------------------------------------------------------------------------

export const DECISIONS_PATH = path.join(EX, 'tokens', 'reanchor-decisions.json');
export const REQUIRED_ACK = 'explicit CLI --apply';
export const REQUIRED_LITERAL_ACK = 'decided-literal';

/** The acked LITERAL refusals, keyed by leaf. Same file, sibling array
 *  `literals` — one ledger, two outcomes. Each row is VALUE-RE-CHECKED against
 *  the live tree (below) so a receipt cannot go stale silently. */
export function loadLiteralDecisions(): LiteralDecision[] {
  if (!existsSync(DECISIONS_PATH)) return [];
  const raw = readJson<unknown>(DECISIONS_PATH);
  const rows = Array.isArray(raw) ? [] : ((raw as { literals?: unknown }).literals ?? []);
  if (!Array.isArray(rows)) fail(`${path.relative(REPO, DECISIONS_PATH)}: "literals" must be an array of literal-decision rows.`);
  return rows as LiteralDecision[];
}

/** leaf → its acked literal decision, with every guard a written alias gets:
 *  right ack, the leaf exists, the leaf is NOT already aliased, and its
 *  CURRENT value still equals the value the refusal was acked against. */
export function literalIndex(rows: LiteralDecision[], minted: DtcgTree): Map<string, LiteralDecision> {
  const index = new Map<string, LiteralDecision>();
  for (const d of rows) {
    if (d.ack !== REQUIRED_LITERAL_ACK) {
      fail(`literal decision ${d.ids.join(',')} carries ack ${JSON.stringify(d.ack)} — only ${JSON.stringify(REQUIRED_LITERAL_ACK)} receipts a kept literal.`);
    }
    if (!d.reason || d.reason.length < 40) fail(`literal decision ${d.ids.join(',')}: a kept literal needs a NAMED reason, not a placeholder.`);
    for (const leafPath of d.leaves) {
      const leaf = leafAt(minted, leafPath);
      if (!leaf) fail(`literal decision ${d.ids.join(',')}: leaf ${leafPath} is not in the minted tree.`);
      const v = String(leaf.$value);
      if (/^\{.+\}$/.test(v)) fail(`literal decision ${d.ids.join(',')}: leaf ${leafPath} is ALIASED to ${v} — a leaf cannot be both re-anchored and decided-literal.`);
      if (!valueEq(v, d.value)) {
        fail(`STALE LITERAL RECEIPT — ${d.ids.join(',')}: leaf ${leafPath} is ${v}, but the refusal was acked against ${d.value}. Re-run --propose and re-review.`);
      }
      if (index.has(leafPath)) fail(`literal decision ${d.ids.join(',')}: leaf ${leafPath} is covered twice.`);
      index.set(leafPath, d);
    }
  }
  return index;
}

export function loadDecisions(): Decision[] {
  if (!existsSync(DECISIONS_PATH)) return [];
  const raw = readJson<unknown>(DECISIONS_PATH);
  // Either a bare array (the resolve.ts decisions.json shape) or a
  // self-documenting wrapper { _marker, decisions: [...] } — the ledger is a
  // file a human edits, so it carries its own instructions.
  const rows = Array.isArray(raw) ? raw : (raw as { decisions?: unknown }).decisions;
  if (!Array.isArray(rows)) {
    fail(`${path.relative(REPO, DECISIONS_PATH)} must be a JSON array of decision rows, or { "_marker": …, "decisions": [ … ] }`);
  }
  return rows as Decision[];
}

/** The shared writer. Rewrites `$value` → "{token}" for every acked row.
 *  IDEMPOTENT: a leaf already carrying the acked alias is verified and left
 *  alone, so re-running (and promote-floor.ts's re-merge + re-apply) is
 *  byte-stable. Every refusal names the leaf. */
export function applyDecisions(
  minted: DtcgTree,
  decisions: Decision[],
  base: DtcgFlat,
  ids: string[] | null,
): { applied: number, alreadyApplied: number, touched: string[] } {
  // PER-LEAF GRAIN: one proposal row may carry SEVERAL decisions, because one
  // value group legitimately splits by leaf (badge tone rules and button
  // variants share #ffffff but answer to different roles). So an id selects
  // EVERY ledger row that names it — `find` would have silently landed only
  // the first and left the rest of the row pending while reporting success.
  const chosen = ids === null ? decisions : ids.flatMap((id) => {
    const ds = decisions.filter((x) => x.ids.includes(id));
    if (ds.length === 0) {
      fail(
        `id "${id}" is NOT in ${path.relative(REPO, DECISIONS_PATH)} — un-acked ids never land.\n` +
          `  Re-anchoring is explicit-ack only (the extract/computed/resolve.ts rule): add a row with\n` +
          `  "ack": ${JSON.stringify(REQUIRED_ACK)} and a named rationale + darkDelta, then re-run.`,
      );
    }
    return ds;
  });
  let applied = 0;
  let alreadyApplied = 0;
  const touched: string[] = [];
  for (const d of [...new Set(chosen)]) {
    if (d.ack !== REQUIRED_ACK) {
      fail(`decision ${d.ids.join(',')} carries ack ${JSON.stringify(d.ack)} — only ${JSON.stringify(REQUIRED_ACK)} lands.`);
    }
    if (!d.to || !/^[a-z0-9-]+$/i.test(d.to)) fail(`decision ${d.ids.join(',')}: "to" must be a bare base token name, got ${JSON.stringify(d.to)}`);
    if (!d.candidates.includes(d.to)) {
      fail(`decision ${d.ids.join(',')}: "to" = ${d.to} is not one of the row's candidates [${d.candidates.join(', ')}] — a target the join never offered is a guess.`);
    }
    // STALE-LEDGER GUARD: the token's CURRENT neutral value must still equal
    // the literal the ledger was written against. A drifted DTCG must refuse,
    // never re-point a live binding at a value nobody reviewed.
    const cur = resolveBase(base, d.to);
    if (cur === undefined) fail(`decision ${d.ids.join(',')}: {${d.to}} does not resolve in the neutral DTCG base.`);
    if (!valueEq(cur, d.value)) {
      fail(
        `STALE LEDGER — decision ${d.ids.join(',')} was acked against ${d.value}, but {${d.to}} is now ${cur}.\n` +
          `  The DTCG drifted under the ledger. Re-run --propose and re-review; do not re-point a live binding at an unreviewed value.`,
      );
    }
    for (const leafPath of d.leaves) {
      const leaf = leafAt(minted, leafPath);
      if (!leaf) fail(`decision ${d.ids.join(',')}: leaf ${leafPath} is not in the minted tree.`);
      const v = String(leaf.$value);
      if (v === `{${d.to}}`) { alreadyApplied++; continue; }
      if (/^\{.+\}$/.test(v)) fail(`decision ${d.ids.join(',')}: leaf ${leafPath} already aliases ${v}, not {${d.to}} — refusing to re-point an existing alias.`);
      if (!valueEq(v, d.value)) {
        fail(`decision ${d.ids.join(',')}: leaf ${leafPath} is ${v}, but the ledger was acked against ${d.value} — the minted tree drifted.`);
      }
      leaf.$value = `{${d.to}}`;
      applied++;
      touched.push(leafPath);
    }
  }
  return { applied, alreadyApplied, touched: touched.sort() };
}

/** Ported from examples/mui/scripts/promote-floor.mjs:260-303 — every alias in
 *  the tree resolves in the base DTCG, and every contract {imported.*} ref
 *  (axis-expanded) still resolves in the tree. A set that cannot resolve is
 *  not a promotion. */
export function resolutionGuard(minted: DtcgTree, base: DtcgFlat, refs: Map<string, RefEvidence>): void {
  const leafSet = new Set(flattenTree(minted).map((x) => x.path));
  const dangling: string[] = [];
  for (const [ref, ev] of refs) if (!leafSet.has(ref)) dangling.push(`{${ref}} (from ${ev.users.join(', ')})`);
  const badAliases: string[] = [];
  for (const { path: p, leaf } of flattenTree(minted)) {
    const m = /^\{(.+)\}$/.exec(String(leaf.$value));
    if (m && resolveBase(base, m[1]) === undefined) badAliases.push(`${p} -> ${String(leaf.$value)}`);
  }
  if (dangling.length > 0 || badAliases.length > 0) {
    fail(
      'resolution guard:\n' +
        dangling.slice(0, 20).map((d) => `  dangling: ${d}`).join('\n') +
        (dangling.length && badAliases.length ? '\n' : '') +
        badAliases.slice(0, 20).map((b) => `  bad alias: ${b}`).join('\n'),
    );
  }
}

/** THE BYTE-GATE. Aliasing must not move a NEUTRAL pixel — so re-emit the
 *  neutral-plane component scripts off the NEW minted tree and demand byte
 *  identity against the committed ones.
 *
 *  SCOPE, stated honestly (investigated, not assumed — see MINTED.md):
 *  the 13 per-component scripts bind minted tokens BY NAME, so an alias is
 *  invisible to them and they must be byte-identical. `00-tokens.figma.js` is
 *  the one script that carries VALUES, and it legitimately moves: 9 rows go
 *  COLOR → Figma-native ALIAS, which is exactly the dark repair. It is gated
 *  separately (light-plane value identity) by its own builder, not here. */
export function byteGate(mintedPath: string): { checked: number } {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'astryx-bytegate-'));
  try {
    const tsx = path.join(REPO, 'node_modules', '.bin', 'tsx');
    if (!existsSync(tsx)) fail('byte-gate needs node_modules/.bin/tsx to re-emit the neutral figma scripts');
    execFileSync(
      tsx,
      [
        path.join(REPO, 'packages', 'cli', 'src', 'cli.ts'),
        'figma',
        path.join(EX, 'contracts'),
        '--out',
        tmp,
        '--tokens',
        `${path.join(EX, 'tokens', 'astryx.dtcg.json')},${mintedPath}`,
        // Wave B.3 gave banner/text-input real icon parts whose SVGs live in
        // the example's own assets dir; without --icons the emit refuses on
        // "asset does not exist" and the byte-gate can never run.
        '--icons',
        path.join(EX, 'assets', 'icons'),
      ],
      { cwd: REPO, stdio: 'pipe' },
    );
    const moved: string[] = [];
    let checked = 0;
    for (const f of readdirSync(tmp).sort()) {
      if (!f.endsWith('.figma.js')) continue;
      const committed = path.join(EX, 'figma', f);
      if (!existsSync(committed)) { moved.push(`${f}: no committed counterpart`); continue; }
      checked++;
      if (readFileSync(path.join(tmp, f)).equals(readFileSync(committed))) continue;
      moved.push(`${f}: BYTES MOVED`);
    }
    if (moved.length > 0) {
      fail(
        'BYTE-GATE — a neutral-plane component script moved under re-anchoring:\n' +
          moved.map((m) => `  - ${m}`).join('\n') +
          '\n  These scripts bind minted tokens BY NAME; an alias must be invisible to them.\n' +
          '  A moved byte is a REFUSAL TO INVESTIGATE, not a diff to accept.',
      );
    }
    return { checked };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function apply(idsArg: string): void {
  const anchorPath = path.join(EX, 'tokens', 'astryx.dtcg.json');
  const { base, dark, minted, refs } = loadPlanes(anchorPath);
  const ids = idsArg.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) fail('--apply needs at least one row id — there is no --all.');

  // literalIndex() is a GUARD, not decoration: it re-checks every kept-literal
  // receipt against the live tree, so --apply refuses on a stale receipt for
  // the same reason it refuses on a stale alias ledger.
  const literals = literalIndex(loadLiteralDecisions(), minted);
  const rows = computeRows({ base, dark, minted, refs, literals });
  const decisions = loadDecisions();

  // ORDER MATTERS. An id with NO ledger row is checked against the live join
  // first, so an EXCLUDED row gets its own named refusal instead of the generic
  // un-acked one. An id WITH a ledger row goes to applyDecisions first, so a
  // drifted DTCG reports STALE LEDGER — the specific cause — rather than
  // "not a row in the current join" (which is what drift looks like from the
  // outside once the row id, keyed on the value, moves with the value).
  for (const id of ids) {
    if (decisions.some((d) => d.ids.includes(id))) continue;
    const row = rows.find((r) => r.id === id);
    if (row?.disposition === 'excluded') fail(`id "${id}" is an EXCLUDED row (${row.exclusion}) — exclusions are receipts, never targets.`);
  }

  const res = applyDecisions(minted, decisions, base, ids);

  // the live join must still agree with the ledger
  for (const id of ids) {
    const row = rows.find((r) => r.id === id);
    if (!row) fail(`id "${id}" is not a row in the current join — re-run --propose.`);
    // The ledger may deliberately name a SUBSET of a row's leaves (splitting a
    // mixed-channel row into per-target decisions). What it may NOT do is name
    // a leaf the live row does not contain — that means the tree drifted.
    for (const d of decisions.filter((x) => x.ids.includes(id))) {
      const stray = d.leaves.filter((l) => !row.leaves.includes(l));
      if (stray.length > 0) {
        fail(
          `id "${id}": the ledger names leaf/leaves the live row does not contain — the minted tree drifted:\n` +
            stray.map((s) => `  - ${s}`).join('\n') +
            '\n  Re-run --propose and re-review.',
        );
      }
    }
  }
  resolutionGuard(minted, base, refs);

  // GATE BEFORE WRITE: the candidate tree is staged to a temp file and the
  // byte-gate runs against THAT. A refusal must leave the committed tree
  // exactly as it was — a gate that fires after the write is a report, not a
  // gate.
  const mintedPath = path.join(EX, 'tokens', 'astryx-minted.dtcg.json');
  const text = JSON.stringify(minted, null, 2) + '\n';
  const stage = mkdtempSync(path.join(os.tmpdir(), 'astryx-reanchor-'));
  const staged = path.join(stage, 'astryx-minted.dtcg.json');
  let gate: { checked: number };
  try {
    writeFileSync(staged, text);
    gate = byteGate(staged);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  writeFileSync(mintedPath, text);

  console.log(
    `✔ re-anchored ${res.applied} leaf/leaves (${res.alreadyApplied} already aliased — idempotent) → examples/astryx/tokens/astryx-minted.dtcg.json`,
  );
  for (const t of res.touched) console.log(`    ${t}`);
  console.log(`✔ resolution guard: every alias resolves in the neutral base; every contract {imported.*} ref (axis-expanded) still resolves`);
  console.log(`✔ byte-gate: ${gate.checked} neutral-plane component script(s) re-emitted BYTE-IDENTICAL to the committed ones`);
}

// ---------------------------------------------------------------------------
// CLI (only when invoked directly — promote-floor.ts imports the helpers)
// ---------------------------------------------------------------------------

function main(): void {
  const argv = process.argv.slice(2);
  const arg = (n: string): string | null => {
    const i = argv.indexOf(`--${n}`);
    return i > -1 ? (argv[i + 1] ?? null) : null;
  };
  const anchor = arg('anchor');
  const anchorPath = anchor ? path.resolve(REPO, anchor) : path.join(EX, 'tokens', 'astryx.dtcg.json');
  if (argv.includes('--propose')) return propose(anchorPath);
  const applyArg = arg('apply');
  if (applyArg !== null) {
    if (anchor) fail('--apply always joins the NEUTRAL anchor; --anchor is a --propose-only knob.');
    return apply(applyArg);
  }
  fail('need --propose [--anchor <dtcg>] or --apply "<id>[,<id>…]"');
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invoked === fileURLToPath(import.meta.url)) main();

export { ANCHOR_PROBES, tuple, valueEq, resolveBase, resolveDark, flattenTree, contractRefs };
export type { Decision, ProposalRow };
