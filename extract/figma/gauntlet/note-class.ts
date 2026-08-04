/**
 * THE CARRIAGE-GAP STEM — one class per RULE that fired, never one per place
 * it fired.
 *
 * A propose NOTE is the receipt for a fact the engine READ and did not carry.
 * The census groups notes into classes and the intake (gauntlet/intake.ts)
 * counts the DISTINCT classes each new system introduces; that count is the
 * convergence metric. So the normaliser is not cosmetic: if it mints a class
 * per note, the metric measures kit size and can never trend to zero, and the
 * carriage-gap surface — the one place a human sees what the engine could not
 * carry — becomes unreadable.
 *
 * MEASURED at 8a5c455 over the three intake systems (8,199 notes): the
 * previous normaliser produced **1,068 classes, 660 of them singletons
 * (61.8%)**. 851 of those classes (and 602 of the 660 singletons) still
 * contained a `:root` node path, because the old rule took the text after the
 * FIRST `': '` in the note. That works for `"<where>: <rule>"`, and breaks for
 * every note whose first `': '` is a payload label rather than a location —
 * `MINTED {…} = 24px — … ; bound at: A:root gap, A:root padding-inline` split
 * at `bound at: ` and made the LIST OF BOUND PATHS the class name. Two thirds
 * of a taxonomy being singletons is not a taxonomy; it is a list.
 *
 * The rule here is positional, not colon-counting:
 *
 *   1. NODE PATHS → `…`, wherever they appear. A path is `<set>:root[/…]`, and
 *      it runs to the next clause boundary (`:`, `;`, quote, backtick). The
 *      set name is passed in, so the head of `UNBOUND <path> fill = #ffffff`
 *      is redacted even though no `': '` separates it from the rule.
 *   2. The RULE CLAUSE is what precedes the first em-dash (` — `); everything
 *      after it is the explanation, and every member enumeration the engine
 *      appends (`; bound at: …`, `nearest tokens by value: …`) lives there.
 *   3. Variable content inside the clause — quoted spellings, backticked
 *      identifiers, `{token.refs}`, `[bracketed lists]`, parentheticals, dotted
 *      ids, numbers, hex colours, and anything after a ` = ` — is redacted to a
 *      marker. A colour and a length are two VALUES of one rule, not two rules,
 *      so `#2563eb` and `24px` both become `N`.
 *   4. Repetition of an identical marker (`… vs … vs …`, `N/N`, `"…", "…"`) is
 *      a member count, not a rule, and collapses to one marker. So does the
 *      list a `(s)` enumeration introduces (`value(s) filled, error are
 *      outside …` — the engine's own spelling for "here come the instances").
 *   5. When the rule clause is a bare INSTANCE STATEMENT — two words or fewer
 *      once redacted, like `MINTED {…} = …` — the rule is in the NEXT clause
 *      and it is appended. Without that, all 2,049 mint receipts read as one
 *      class and the three genuinely different mint MODES (a resolved value, a
 *      stub's observed geometry, a sizing mode that is not a measure) were
 *      merged while the same mode split by value type. That is the over-merge
 *      failure, and it was in the corpus.
 *
 * What is deliberately NOT kept: the CSS channel (`gap`, `color`) and the part
 * path. `border-radius not representable` and `gap not representable` are the
 * same vocabulary gap reported on two channels, and the rule text names the
 * channel where it matters.
 *
 * What IS kept: the note's KIND label when it has one (`prop \`…\`:`,
 * `slot \`…\`:`, `contract name:`, `variant axis "…":`). Those are a small,
 * stable vocabulary and they separate genuinely different rules — an illegal
 * identifier on a PROP is not the same finding as one on a SLOT.
 *
 * MEASURED after: **158 classes, 27 singletons (17.1%)** over the same 8,199
 * notes, and every surviving singleton is a one-off ENGINE behaviour that
 * genuinely fired once (square arc caps, negative itemSpacing, a self-claimed
 * stub box) — not one bucket per part.
 * Falsified by extract/figma/gauntlet/note-class-check.ts.
 *
 * Deterministic and pure: regex only, no clock, no I/O, no iteration order.
 */

/** Longest head that may be a KIND label rather than a rule. */
const LABEL_MAX = 40;
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A node path runs from `<set>:root` to the next clause boundary. Commas stay
 *  INSIDE it on purpose: part names contain them ("Lorem ipsum dolor sit amet,
 *  consectetur …"), and a comma-separated list of paths collapses to one
 *  marker anyway. */
const PATH_TAIL = String.raw`[^;:"'\x60]*`;
const ownPath = (setName: string): RegExp => new RegExp(`${esc(setName)}:root${PATH_TAIL}`, 'g');
/** The set name alone at the head — `Atoms/Button: 4 state-axis variant(s) …`. */
const ownHead = (setName: string): RegExp => new RegExp(`^${esc(setName)}(?=[:,;\\s])`);
/** Fallback for a path this set did not name (a stub's, a nested set's). */
const ANY_PATH = new RegExp(String.raw`(?<=^|[,;] |: )[^,;:"'\x60]*:root${PATH_TAIL}`, 'g');

/** `…/Text input fill = #ffffff` — the path ends at the ` = `; the value does
 *  not, and the value is what the rule is about. */
const pathOnly = (m: string): string => {
  const eq = m.indexOf(' = ');
  return eq >= 0 ? `…${m.slice(eq)}` : '…';
};

/** `(s)` is this engine's spelling for "an enumeration of instances follows".
 *  `value(s) filled, error are outside the vocabulary` — the values are variant
 *  names, the rule is the vocabulary miss. */
const ENUM_LIST = /\b(\w+)\(s\) [^—]{0,80}?(?= are | is )/g;

/** Nested parentheticals, innermost first; then any unpaired bracket left by a
 *  `(s)` that closed early inside one. */
const parens = (s: string): string => {
  let prev = '';
  let out = s;
  while (prev !== out) {
    prev = out;
    out = out.replace(/\([^()]*\)/g, '');
  }
  return out.replace(/[()]/g, '');
};

const redact = (s: string): string =>
  parens(s.replace(ENUM_LIST, '$1(s) …'))
    .replace(/\{[^{}]*\}/g, '{…}')
    .replace(/"[^"]*"/g, '"…"')
    .replace(/`[^`]*`/g, '`…`')
    .replace(/\[[^\][]*\]/g, '[…]')
    .replace(/#[0-9a-f]{3,8}\b/gi, 'N')
    .replace(/\b[a-z-]+\.[a-z0-9.-]+\b/gi, '…')
    .replace(/\b\d+(\.\d+)?(px|%|rad|deg)?\b/g, 'N');

const ITEM = String.raw`(?:"…"|\x60…\x60|\{…\}|\[…\]|…|N)`;
const SEP = String.raw`(?:, | vs | and | \| |; |\/| )`;
const RUN = new RegExp(`(${ITEM})(?:${SEP}\\1)+`, 'g');

/** `… vs … vs …` and `N/N` are how many members the rule found, not which
 *  rule it is. */
const collapse = (s: string): string => {
  let prev = '';
  let out = s;
  while (prev !== out) {
    prev = out;
    out = out.replace(RUN, '$1');
  }
  return out;
};

const norm = (s: string): string => collapse(redact(s)).replace(/\s+/g, ' ').trim();

/** Long enough that no two distinct rules in the corpus share a prefix (at 70
 *  the cap itself merged 4 of them; at 90, 120 and 200 the class set is
 *  identical, so the cap has stopped doing taxonomy work). */
const CAP = 90;

/** A clause this short states an instance, not a rule — `MINTED {…} = …`. */
const INSTANCE_WORDS = 2;
const words = (s: string): number => (s.match(/[A-Za-z]{2,}/g) ?? []).length;

/**
 * The class of a propose note: the RULE that fired, with every instance-level
 * fact (paths, values, counts, variant names) redacted into its members.
 *
 * @param note    the note text, verbatim from the proposal
 * @param setName the set the note belongs to — its name heads most notes, and
 *                without it a leading path that carries no `': '` (the UNBOUND
 *                family) cannot be told from the rule
 */
export function noteClassOf(note: string, setName?: string): string {
  let text = note;
  if (setName !== undefined) text = text.replace(ownPath(setName), pathOnly).replace(ownHead(setName), '…');
  text = text.replace(ANY_PATH, pathOnly);
  const clauses = text.split(' — ');
  const head = clauses[0]
    .replace(/^…(?::|,)? ?/, '')
    .trim()
    .replace(/ = .*$/, ' = …');
  const colon = head.indexOf(': ');
  const cls =
    colon < 0 || colon > LABEL_MAX
      ? norm(head)
      : `${norm(head.slice(0, colon))}: ${norm(head.slice(colon + 2))}`.replace(/^: /, '');
  // Only up to the first `; ` of the borrowed clause: a semicolon is this
  // engine's separator between a rule and its aside ("…; review", "…; nearest
  // tokens by value: {…}"), and an aside carries instances.
  const why = clauses.length > 1 ? norm(clauses[1]).split('; ')[0] : '';
  const full = why.length > 0 && words(cls) <= INSTANCE_WORDS ? `${cls} — ${why}` : cls;
  return full.slice(0, CAP);
}
