/**
 * THE CURATED-FACT GUARD — a re-promotion may ADD, it may RESHAPE, it may not
 * quietly DELETE.
 *
 * WHY THIS EXISTS, with the exact numbers. On 2026-08-26 six polaris promote
 * divergences "stopped happening", and that was reported up the chain — by me —
 * as the engine getting better. It was the opposite. The divergences vanished
 * because the CURATED FACTS had been deleted, so each contract had come to
 * equal the promoter's bare output:
 *
 *     avatar.initials        "TP"      -> null
 *     avatar.withInitials    true      -> false
 *     progress-bar.progress    40      -> 0
 *     text-field.placeholder "Example" -> null
 *     thumbnail              lost two border-radius bindings
 *
 * An Avatar with no initials and a ProgressBar at 0% is a visible product
 * regression that every gate in the tree called an improvement. The re-promote
 * wave re-runs this derivation across the whole corpus, so it cannot be run as
 * promote-and-accept.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO, both learned the same day:
 *
 *   · IT DOES NOT DIFF BYTES. `shadcn-minted.dtcg.json` carries the key
 *     "color-e5e5e5" TWICE in the same object — a duplicate JSON key every
 *     parser silently collapses. Bytes said "a leaf went missing"; parsed leaf
 *     sets said 379 = 379. A byte-diffing guard cries wolf, and a guard that
 *     cries wolf is one the next round learns to wave through.
 *
 *   · IT DOES NOT COMPARE SHAPES OR COUNTS. Every one of the five losses above
 *     is a VALUE at a path that still exists. A guard counting parts, leaves or
 *     keys catches none of them.
 *
 * So it walks PARSED values and compares FIELD BY FIELD.
 *
 * THE COMPARISON IT IS FOR, and the one it is NOT. Committed contract vs the
 * output of re-promoting THAT SAME TREE. Point it across schema versions and a
 * field the newer schema added will read as `dropped` — verified: comparing
 * main's polaris avatar against the pre-loss `bf77a403` correctly flags
 * `props[2].default "TP" -> undefined` and `props[6].default true -> false`,
 * and also flags `archetype`, which is not a loss at all, only a field that
 * did not exist yet. Same-tree is the contract; anything else needs a human.
 *
 * The interesting class is `defaulted`: `withInitials true -> false` and
 * `progress 40 -> 0` are not absences. The promoter produced a well-formed
 * contract carrying the type's zero value. That reads as data, not as damage,
 * which is exactly why it survived review.
 */

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isEmpty = (v) =>
  v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (isObj(v) && Object.keys(v).length === 0);
/** The zero value a bare re-derivation lands on when a curated fact is gone. */
const isZero = (v) => v === false || v === 0 || v === '' || v === null;

/**
 * Classify what `produced` lost relative to `committed`.
 * @returns {{losses: Array<{path:string,kind:string,was:unknown,now:unknown}>,
 *            changes: Array<{path:string,was:unknown,now:unknown}>,
 *            additions: string[]}}
 */
export function curatedFactLosses(committed, produced, basePath = '') {
  const losses = [];
  const changes = [];
  const additions = [];

  const walk = (a, b, p) => {
    if (isObj(a)) {
      if (!isObj(b)) {
        losses.push({ path: p, kind: b === undefined ? 'dropped' : 'nulled', was: a, now: b });
        return;
      }
      for (const k of Object.keys(a)) walk(a[k], b[k], p ? `${p}.${k}` : k);
      for (const k of Object.keys(b)) if (!(k in a)) additions.push(p ? `${p}.${k}` : k);
      return;
    }
    if (Array.isArray(a)) {
      if (!Array.isArray(b)) {
        losses.push({ path: p, kind: b === undefined ? 'dropped' : 'nulled', was: a, now: b });
        return;
      }
      if (a.length > 0 && b.length === 0) {
        losses.push({ path: p, kind: 'emptied', was: a, now: b });
        return;
      }
      for (let i = 0; i < a.length; i++) walk(a[i], b[i], `${p}[${i}]`);
      return;
    }
    // scalar
    if (b === undefined) {
      losses.push({ path: p, kind: 'dropped', was: a, now: b });
      return;
    }
    if (a === b) return;
    if (a !== null && b === null) {
      losses.push({ path: p, kind: 'nulled', was: a, now: b });
      return;
    }
    if (!isEmpty(a) && isEmpty(b)) {
      losses.push({ path: p, kind: 'emptied', was: a, now: b });
      return;
    }
    // The subtle one: a curated value replaced by the type's zero value.
    if (!isZero(a) && isZero(b)) {
      losses.push({ path: p, kind: 'defaulted', was: a, now: b });
      return;
    }
    changes.push({ path: p, was: a, now: b });
  };

  walk(committed, produced, basePath);
  return { losses, changes, additions };
}

/** One line per loss, in the shape a reviewer can act on. */
export function formatLosses(losses) {
  return losses.map(
    (l) => `  ${l.kind.toUpperCase().padEnd(9)} ${l.path}: ${JSON.stringify(l.was)} -> ${JSON.stringify(l.now)}`,
  );
}
