/**
 * COMPUTED-CAPTURE FLOOR — decision re-application (Round 4).
 *
 * decisions.json entries are HUMAN-ACKED computed-wins resolutions
 * (extract/computed/resolve.ts, explicit `--apply` only). Round 4 re-fuses
 * every component (anatomy promotion), which regenerates the enriched
 * contract — the acked decisions must ride along or the gate re-scores the
 * very contradictions a human already resolved (Banner's tone map painting
 * the whole card was exactly this).
 *
 * This module re-applies committed decisions onto a freshly fused enriched
 * contract by (part, channel, scope, to) — the recorded resolution shape —
 * with resolve.ts's exact semantics:
 *   · scope 'base': the channel rebinds at the part's base tokens AND every
 *     per-value override of the channel is stripped (base scope is only
 *     reached when every combo contradicts — the overrides are contradicted
 *     by definition; leaving them would beat the resolved base in the
 *     cascade).
 *   · scope 'axis:prop=v1|v2': the channel rebinds per named value via a
 *     tokensByProp entry (reusing the same-prop entry when one exists).
 *
 * A decision naming a part the promoted anatomy no longer has is a NAMED
 * skip (never silent) — the caller quotes skips in the ledger.
 *
 * APPLY-TIME VALUE CHECK (repair round — the polaris Badge finding). Matching
 * is by (part, channel, scope): `ids` are provenance, never a selector. That
 * is deliberate — combo-key vocabularies drift between rounds, so keying off
 * ids would refuse legitimate ledgers (MEASURED: 6 of the 9 polaris ledgers
 * carry ids from an older enumeration and are perfectly valid). But it also
 * means a ledger belonging to a DIFFERENT library applies silently if it
 * happens to name the same part+channel, and one did: the pre-namespacing
 * astryx Badge run left its ledger in the un-namespaced polaris root, where
 * its `{spacing-0}` / `{font-size-sm}` targets — astryx's un-prefixed
 * spelling, absent from Polaris's `{p.*}` inventory — overwrote the Polaris
 * Badge's real bindings and rendered as EMPTY custom properties (97.327 →
 * 95.159, 2 unresolved refs).
 *
 * So: when the caller supplies the library's token inventory, a decision
 * whose `to` is a token ref the inventory does not contain is a NAMED SKIP.
 * A legitimate decision resolves by construction — it was recorded against
 * this library's own tree — so the check cannot mis-fire on real rows; it
 * only refuses to write a ref that provably cannot render. The inventory is
 * OPTIONAL so existing callers keep working, and its absence is not a
 * silent pass: the caller that gates a number passes it.
 *
 * APPLY-TIME **VALUE** CHECK (RC6 — the stale token alias). Existence is not
 * agreement. `{color-accent}` existed on every run while the astryx DS moved
 * it from `#0064e0` to `#262626`, and this ledger kept re-anchoring Badge's
 * five SEMANTIC variants onto it: the contract, the CSS module, the Figma
 * script and the census render all repainted charcoal-on-charcoal, with no
 * receipt anywhere. The nine PALETTE variants, which bind measured
 * `{imported.badge.…}` literals, stayed pixel-exact — which is exactly the
 * shape the blind grader recorded.
 *
 * The referee is THIS RUN'S MEASUREMENT (`measured.ts`, read from the same
 * committed `captured-truth.json` the enriched contract is fused from), never
 * the ledger's own `observed` field: that string ages with the capture, and
 * refereeing against it refuses three CORRECT rows (astryx Card/Slider/Switch
 * `root.color` record `rgba(0, 0, 0, 1)` where today's capture measures
 * `rgba(23, 23, 23, 1)` — which is precisely what `{color-on-light}` holds).
 *
 * The rule, and it only ever REFUSES:
 *   · the decision's target resolves through the SAME trees the gate renders
 *     with (`gate.ts gateInventory().resolveValue` — one function, every
 *     caller), and is compared by CSS VALUE equality, never string equality
 *     (`decisionValueEq`: colours through the mint's own `kindOf`, dimensions
 *     normalized, unitless zero). No tolerance, no ΔE slack.
 *   · sites are the (part, channel) measurements in the combos the scope
 *     names, at the DEFAULT interaction.
 *   · target disagrees with EVERY site → NAMED SKIP; the fused measured
 *     binding stands and the message quotes both values.
 *   · target agrees with at least one site → APPLIED (a channel may legally
 *     vary inside an axis scope; refusing there would delete a real binding).
 *   · NO site at all → APPLIED and reported as `unverified` BY NAME. The run
 *     measured nothing there, so nothing can be concluded — and silence is
 *     printed rather than passed.
 */
import { tokensByPropEntries, walkAnatomy, type Contract, type Part } from '../../scripts/contract-schema.js';
import { canonColorValue, normalizeValue, type Combo } from './lib.js';
import type { MeasuredTruth } from './measured.js';

export interface AckedDecision {
  ids: string[];
  part: string;
  channel: string;
  scope: string; // 'base' | `axis:${prop}=${v1}|${v2}…`
  from: string;
  to: string;
  observed: string;
  expected: string;
  cause: string;
  ack: string;
}

/** CSS VALUE equality — the referee's comparison, and the ONLY one it makes.
 *  `#0074E2`, `rgba(0, 116, 226, 1)` and `oklch(…)` are one colour; `0` and
 *  `0px` are one length. Everything else compares as a whitespace-collapsed
 *  lowercase string. No tolerance is defined here on purpose: a near-miss
 *  between a token and a measurement is a finding, not a rounding error. */
export function decisionValueEq(a: string, b: string): boolean {
  return canonDecisionValue(a) === canonDecisionValue(b);
}

const trimNum = (n: number): string => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4))));

/** ROOT FONT SIZE. A token tree writes `0.75rem`; a computed style is always
 *  absolute (`12px`). `rem` is the ROOT element's font-size, and the capture
 *  stage restyles no `:root` — so the CSS initial 16px applies. That is not
 *  an assumption taken on faith: the committed corpus checks it four ways in
 *  two libraries, independently — astryx `{font-size-base}` 0.875rem measures
 *  14px, `{font-size-sm}` 0.75rem measures 12px, Polaris `{p.font-size-325}`
 *  0.8125rem measures 13px and `{p.font-line-height-500}` 1.25rem measures
 *  20px. `em` is deliberately NOT converted: it is relative to the element's
 *  own font-size, which this referee does not know, and guessing would either
 *  invent agreement or invent a refusal. An `em`-valued target therefore
 *  compares as a string and, if it disagrees, is refused BY NAME with both
 *  spellings quoted — the honest outcome for a value we cannot resolve. */
const ROOT_FONT_PX = 16;

function canonDecisionValue(v: string): string {
  const t = normalizeValue(String(v).trim());
  const colour = canonColorValue(t);
  if (colour) return colour;
  const low = t.toLowerCase();
  // THE REFEREE MUST BE ABLE TO READ ITS OWN SPELLING BACK.
  // `gateInventory().resolveValue` hands the target over ALREADY canonicalized
  // by `canonColorValue`, whose output is exactly eight lowercase hex digits —
  // RGB plus an explicit alpha byte (lib.ts:593-605). `canonColorValue` itself
  // only accepts `#`-prefixed hex or a CSS colour function, so that bare form
  // fell through to the unitless-number branch below: a fully transparent
  // colour resolves to `00000000`, `Number('00000000') === 0`, and the target
  // canonicalized as the LENGTH `0px` while the measured `rgba(0, 0, 0, 0)`
  // canonicalized as the COLOUR `00000000`. They never matched, so a decision
  // pointing at exactly the colour this run measured was refused BY NAME as a
  // STALE ALIAS — a false refusal that deletes a CORRECT binding, in the very
  // guard this class added. Measured live before the fix on polaris Button
  // (`{p.color-bg-surface-transparent}` vs 72 transparent `root.background-
  // color` sites).
  // It is recognised HERE and not inside `canonColorValue` because only this
  // side knows the provenance: widening the general colour predicate would let
  // a bare 8-digit NUMBER be read as a colour everywhere it is asked. The form
  // is unambiguous for integers either way — `trimNum(10000000)` is the same
  // eight characters — so the only behaviour that moves is the leading-zero
  // colour spelling no token ever carries as a number.
  if (/^[0-9a-f]{8}$/.test(low)) return low;
  const len = /^(-?\d*\.?\d+)(px|rem)$/.exec(low);
  if (len) return `${trimNum(Number(len[1]) * (len[2] === 'rem' ? ROOT_FONT_PX : 1))}px`;
  // Unitless zero is the same length as 0px (`{spacing-0}` is spelled `0` in
  // some trees and `0px` in others). A unitless NON-zero is left alone —
  // font-weight 500 and line-height 1.5 are not lengths.
  if (/^-?\d*\.?\d+$/.test(low)) return Number(low) === 0 ? '0px' : trimNum(Number(low));
  return low.replace(/\s+/g, ' ');
}

/** The apply-time value referee: this run's measurement plus the resolver the
 *  gate itself renders with. Optional — a caller with no capture in hand (the
 *  cross-library pin in evals) still gets the existence check. */
export interface DecisionReferee {
  /** `{path}` → literal, through the SAME trees the gate renders with
   *  (gate.ts `gateInventory().resolveValue`). */
  resolveValue: (refOrLiteral: string) => string;
  /** THIS RUN's computed values, by (part, channel, combo). */
  measured: MeasuredTruth;
  /** The enumerated combos, with their axis values — the scope→sites map. */
  combos: ReadonlyArray<{ key: string; axisValues: Record<string, string> }>;
}

/** Combo keys a decision scope names. `base` is every enumerated combo (the
 *  scope is only reached when the channel resolves the same everywhere);
 *  `axis:prop=v1|v2` is the combos whose `prop` sits at one of those values. */
function combosInScope(referee: DecisionReferee, scope: string): string[] {
  if (scope === 'base') return referee.combos.map((c) => c.key);
  const m = /^axis:([\w-]+)=(.+)$/.exec(scope);
  if (!m) return [];
  const [, prop, valueList] = m;
  const values = new Set(valueList.split('|'));
  return referee.combos.filter((c) => values.has(c.axisValues[prop])).map((c) => c.key);
}

/** The combos a referee may score against: state-prop planes are STATES, not
 *  bases (fuse.ts `isEnabled`), and a decision scope never names one. Shared
 *  so the harness, the offline re-fuse and the corpus gate cannot disagree
 *  about the denominator. */
export function refereeCombos(combos: ReadonlyArray<Combo>): Array<{ key: string; axisValues: Record<string, string> }> {
  return combos
    .filter((c) => Object.values(c.stateFlags).every((f) => !f))
    .map((c) => ({ key: c.key, axisValues: c.axisValues }));
}

export function applyDecisions(
  contract: Contract,
  decisions: AckedDecision[],
  /** Flat token-path inventory for THIS library (tokenInventoryFromJson over
   *  cfg.tokens.dtcg + the minted tree). When given, a decision whose `to`
   *  ref is absent from it is refused BY NAME — see the header. */
  inventory?: Set<string>,
  /** Value referee — see the header. Absent = existence check only, and the
   *  caller is told so: every row lands in `unverified`. */
  referee?: DecisionReferee,
): { applied: string[]; skipped: string[]; unverified: string[] } {
  const applied: string[] = [];
  const skipped: string[] = [];
  const unverified: string[] = [];
  const partByName = new Map(walkAnatomy(contract).map((w) => [w.name, w.part] as const));
  for (const d of decisions) {
    const target: Part | undefined = partByName.get(d.part);
    if (!target) {
      skipped.push(`${d.part}.${d.channel} [${d.scope}] → ${d.to}: part not in the promoted anatomy — NAMED skip`);
      continue;
    }
    // Phase B: a decision target may be a LITERAL CSS value (v14 literals
    // channel — resolve.ts routing, mirrored here so re-application is
    // faithful). Token refs stay brace-wrapped.
    const isTokenRef = /^\{[a-z0-9.-]+\}$/i.test(d.to);
    // Apply-time value check (header): never write a ref that cannot render.
    if (isTokenRef && inventory && !inventory.has(d.to.slice(1, -1))) {
      skipped.push(
        `${d.part}.${d.channel} [${d.scope}] → ${d.to}: target token is NOT in this library's inventory — NAMED skip (an acked resolution that cannot resolve would render as an EMPTY custom property; a ledger recorded against a different library is the known cause)`,
      );
      continue;
    }
    // APPLY-TIME VALUE CHECK (header). Existence is not agreement: the target
    // must still hold what this run MEASURED at the sites the scope names.
    if (isTokenRef && referee) {
      const target = referee.resolveValue(d.to);
      const combos = combosInScope(referee, d.scope);
      const sites = referee.measured.at(d.part, d.channel, combos);
      if (sites.length === 0) {
        unverified.push(
          `${d.part}.${d.channel} [${d.scope}] → ${d.to} (= ${target}): APPLIED UNVERIFIED — this run measured no computed value at that site (${combos.length} combo(s) in scope), so nothing can referee the target. Not a pass: re-review with \`extract/computed/resolve.ts --apply\` if the binding matters.`,
        );
      } else {
        const agreeing = sites.filter((st) => decisionValueEq(target, st.value));
        if (agreeing.length === 0) {
          const seen = [...new Set(sites.map((st) => st.value))];
          skipped.push(
            `${d.part}.${d.channel} [${d.scope}] → ${d.to}: STALE ALIAS — the target resolves to ${target} but this run MEASURED ${seen.join(' / ')} at ${sites.length} site(s) (${[...new Set(sites.map((st) => st.combo))].join(', ')}) — NAMED skip; the fused measured binding stands. The acked resolution was recorded against an older value of ${d.to} (ledger observed: ${d.observed}); re-review with \`extract/computed/resolve.ts --apply\`.`,
          );
          continue;
        }
        if (agreeing.length < sites.length) {
          unverified.push(
            `${d.part}.${d.channel} [${d.scope}] → ${d.to} (= ${target}): APPLIED — agrees with ${agreeing.length} of ${sites.length} measured site(s); the channel varies inside the scope, so the disagreeing site(s) are NOT proof the alias is stale.`,
          );
        }
      }
    }
    if (d.scope === 'base') {
      if (isTokenRef) {
        target.tokens ??= {};
        target.tokens[d.channel] = d.to;
        if (target.literals) delete (target.literals as Record<string, unknown>)[d.channel];
      } else {
        target.literals ??= {};
        (target.literals as Record<string, unknown>)[d.channel] = d.to;
        if (target.tokens) delete (target.tokens as Record<string, unknown>)[d.channel];
      }
      for (const field of ['tokensByProp', 'literalsByProp'] as const) {
        const raw = target[field] as
          | Array<{ prop: string; map: Record<string, Record<string, unknown>> }>
          | { prop: string; map: Record<string, Record<string, unknown>> }
          | undefined;
        if (!raw) continue;
        const list = Array.isArray(raw) ? raw : [raw];
        for (const e of list) {
          for (const [value, m] of Object.entries(e.map)) {
            delete m[d.channel];
            if (Object.keys(m).length === 0) delete e.map[value];
          }
        }
        const kept = list.filter((e) => Object.keys(e.map).length > 0);
        if (kept.length === 0) delete target[field];
        else (target as Record<string, unknown>)[field] = Array.isArray(raw) ? kept : kept[0];
      }
      applied.push(`${d.part}.${d.channel} [base] → ${d.to}`);
      continue;
    }
    const m = /^axis:([\w-]+)=(.+)$/.exec(d.scope);
    if (!m) {
      skipped.push(`${d.part}.${d.channel}: unrecognized scope "${d.scope}" — NAMED skip`);
      continue;
    }
    const [, prop, valueList] = m;
    const values = valueList.split('|');
    if (isTokenRef) {
      const entries = tokensByPropEntries(target).map((e) => structuredClone(e));
      let entry = entries.find((e) => e.prop === prop && Object.values(e.map).some((mm) => d.channel in mm));
      if (!entry) entry = entries.find((e) => e.prop === prop && entries.filter((x) => x.prop === prop).length === 1);
      if (!entry) {
        entry = { prop, map: {} };
        entries.push(entry);
      }
      for (const v of values) (entry.map[v] ??= {})[d.channel] = d.to;
      target.tokensByProp = entries as never;
    } else {
      const rawL = target.literalsByProp as Array<{ prop: string; map: Record<string, Record<string, unknown>> }> | undefined;
      const entriesL = rawL ? structuredClone(rawL) : [];
      let entryL = entriesL.find((e) => e.prop === prop);
      if (!entryL) {
        entryL = { prop, map: {} };
        entriesL.push(entryL);
      }
      for (const v of values) (entryL.map[v] ??= {})[d.channel] = d.to;
      target.literalsByProp = entriesL as never;
    }
    applied.push(`${d.part}.${d.channel} [${d.scope}] → ${d.to}`);
  }
  return { applied, skipped, unverified };
}
