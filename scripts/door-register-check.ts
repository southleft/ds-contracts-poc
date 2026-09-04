/**
 * THE DOOR REGISTER GATE — `npm run door-register:check`
 *
 * A DOOR is any rule in this pipeline that decides a computed fact is NOT a
 * fact of this component (subtractive) or that a fact IS admitted (admitting).
 * Doors are the only judgement calls the conversion makes, and until this round
 * a large share of them made those calls SILENTLY: a bare `if`, a `continue`, a
 * `return undefined`, with no array, no counter and no line anywhere. The two
 * worst defects found on the corpus — shadcn's invisible Input border and
 * Polaris' inkless text — were both a door subtracting a real fact because a
 * library's global CSS violated the door's premise, and in both cases the
 * pipeline said nothing at all.
 *
 * This check holds the register to the code in five directions:
 *
 *   1. DISCOVERY — every `// @door <id>` marker in the source files the
 *      register covers must name a door the register carries. A new door added
 *      to the code without a register entry fails here, which is the whole
 *      point: a judgement call that is not written down is not reviewable.
 *   2. COMPLETENESS — every registered door must have its marker present, on
 *      the line the register records. A door that was deleted or moved without
 *      the register following fails here.
 *   3. RECEIPT PATHS — a door that CLAIMS to leave a receipt must have a
 *      receipt path in its own file: the literal `receipt.marker` string must
 *      appear there. A register that claims honesty it does not have is worse
 *      than one that admits silence.
 *   4. SHAPE — ids are lowercase-kebab and stage-prefixed, unique, sorted; the
 *      JSON is byte-stable (re-serializing produces the same bytes); the
 *      stage prefix agrees with the file; `kind` is one of the three values.
 *   5. RULE LINES — `ruleLine` must be the line the marker actually annotates,
 *      and `markerOutsideRule` must be true only where it really is.
 *
 * DIRECTION 5 EXISTS BECAUSE THOSE TWO FIELDS WERE 400 FALSE CLAIMS AND
 * NOTHING READ THEM (2026-08-26). 415 of 429 doors asserted `markerOutsideRule`
 * — "the rule lives inside a serialized in-page function" — when only 26 do.
 * `ruleLine` drifted a median of 32 lines from the real rule and landed on a
 * blank or comment-only line 176 times, because it recorded where each rule sat
 * BEFORE the `@door` markers were inserted: computed once, never re-derived.
 * `auditRegister()` read NEITHER field, which is the whole reason it survived —
 * an artifact nothing reads is an artifact nothing checks. So the fields are
 * now derived and enforced rather than asserted:
 *
 *   · THE LINE A MARKER ANNOTATES is the first line at or after it that is
 *     neither blank nor comment-only (`annotatedLine`). For an ordinary marker
 *     sitting directly above its rule that is exactly `line + 1`; prose between
 *     the marker and the rule, and other `@door` markers stacked on the same
 *     rule, are stepped over. `ruleLine` MUST equal it.
 *   · UNLESS `markerOutsideRule` is set. A rule that lives inside a template
 *     literal — a function serialized into the browser by `page.evaluate`, or
 *     the generated React harness entry module — cannot carry a marker of its
 *     own, so the marker sits on the nearest line outside the literal and
 *     `ruleLine` points at the real line INSIDE it. That claim is checked: the
 *     recorded line must lie strictly inside a multi-line template literal of
 *     that file, parsed from the source, not asserted in prose.
 *   · AND NO `ruleLine` MAY LAND ON A BLANK OR COMMENT-ONLY LINE, in either
 *     case. A line number pointing at whitespace is not a citation.
 *
 * `markerOutsideRule` is a STRING, and its presence is the boolean: a door that
 * carries it says why, and a door that does not carry it is an ordinary
 * adjacent marker. There is no third state.
 *
 * THE REMEDY IS A COMMAND, NOT A PROCEDURE. `--rederive` is the same derivation
 * run in write mode: it recomputes every line from the tree, rewrites the
 * register byte-stably, and regenerates the doc table's cells. There is one
 * derivation function, so the gate and the fix cannot drift apart — the check
 * IS "run the fix and compare". This matters because the lines are displaced by
 * ordinary work: PR #58 moved 167 `@door` markers and `--rederive` put all 168
 * affected lines back in one command. The alternative — a human reconstructing
 * the derivation by hand — is exactly how these numbers rotted the first time.
 *
 * The 26 `markerOutsideRule` doors are the one case the marker's position
 * cannot predict, so they carry `ruleText`: the trimmed source of the line they
 * cite. The gate checks the quote against the file (a citation that carries its
 * quote cannot silently point at the wrong line), and `--rederive` follows the
 * TEXT inside the door's literal rather than an offset. When that text is
 * missing or ambiguous the re-derivation REFUSES by name instead of picking —
 * `capture.slot-splice`'s anchor occurs twice inside its own literal, so this
 * is a real case and not a hypothetical.
 *
 * It also RE-MEASURES the subtraction census over the committed corpus and
 * refuses when the pinned numbers move — the honest size of the "missing ink"
 * surface is a number this repo has to keep re-earning, not a claim it made
 * once. See scripts/door-census.ts.
 *
 *   npx tsx scripts/door-register-check.ts
 *   npx tsx scripts/door-register-check.ts --self-test   # red cases
 *   npx tsx scripts/door-register-check.ts --rederive    # the remedy (writes)
 *
 * WHAT THIS CHECK MUST NOT DO: change which facts are dropped. Naming, not
 * carrying — the same discipline as core/code-only-facts-check.ts.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCensus, censusTable, type Census } from './door-census.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTER = path.join(REPO, 'spec/door-register.json');
const DOC = path.join(REPO, 'spec/DOOR-REGISTER.md');

export interface Door {
  id: string;
  stage: string;
  path: 'capture' | 'propose';
  file: string;
  line: number;
  /** The line the marker annotates — see `annotatedLine`. Required on every
   *  door: a door whose rule cannot be pointed at is not reviewable. */
  ruleLine: number;
  /** Present ONLY when the rule lives inside a template literal the marker
   *  cannot sit inside; the string says which literal and why. Its presence is
   *  the boolean — absence means "ordinary adjacent marker". */
  markerOutsideRule?: string;
  /** The trimmed source of `ruleLine`, carried ONLY by `markerOutsideRule`
   *  doors. Those are the only doors whose line cannot be re-derived from the
   *  marker's own position, so they are the only ones that need an anchor: the
   *  citation carries its quote, the gate checks the quote against the file,
   *  and `--rederive` relocates the line by searching for it. Ordinary doors
   *  need none — their line IS a function of the marker. */
  ruleText?: string;
  kind: 'subtractive' | 'admitting' | 'both';
  premise: string;
  effect: string;
  counterExample: string;
  receipt: { channel: string; marker?: string };
  closedIn?: string;
  closedNote?: string;
}
export interface Register {
  $comment: string;
  version: number;
  markerConvention: string;
  doors: Door[];
}

/** The stage prefix an id must carry, and the one file that stage lives in.
 *  A stage is a place a judgement call can be made; adding one is a decision,
 *  so the map is explicit rather than derived from whatever files exist. */
export const STAGE_FILES: Record<string, string> = {
  capture: 'extract/computed/capture.ts',
  anatomy: 'extract/computed/anatomy.ts',
  fuse: 'extract/computed/fuse.ts',
  mint: 'core/mint-tokens.ts',
  libcss: 'extract/computed/lib-css.ts',
  regate: 'extract/computed/regate.ts',
  gate: 'extract/computed/gate.ts',
  decisions: 'extract/computed/decisions.ts',
  resolve: 'extract/computed/resolve.ts',
  propose: 'core/propose-figma.ts',
};

const MARKER_RE = /^\s*\/\/ @door ([^\s]+)\s*$/;
const ID_RE = /^[a-z0-9]+\.[a-z0-9-]+$/;
const KINDS = new Set(['subtractive', 'admitting', 'both']);

const isBlankLine = (s: string) => s.trim() === '';
/** A line that carries no code: a `//` comment, or a line inside (or opening,
 *  or closing) a `/* … *​/` block. Deliberately textual — the same shape of
 *  test the marker sweep uses, so the two cannot disagree. */
const isCommentOnlyLine = (s: string) => /^\s*(\/\/|\/\*|\*)/.test(s);

/** THE LINE A `@door` MARKER ANNOTATES: the first line at or after the marker
 *  that is neither blank nor comment-only. For a marker sitting directly above
 *  its rule this is `markerLine + 1`; prose between the marker and the rule, and
 *  other `@door` markers stacked on the same rule, are stepped over. Returns
 *  `null` when the marker is trailed by nothing but blanks and comments to the
 *  end of the file — a marker that annotates nothing at all.
 *  `lines` is the file split on '\n'; `markerLine` is 1-based. */
export function annotatedLine(lines: string[], markerLine: number): number | null {
  let i = markerLine; // 0-based index of markerLine + 1
  while (i < lines.length && (isBlankLine(lines[i]) || isCommentOnlyLine(lines[i]))) i++;
  return i < lines.length ? i + 1 : null;
}

/** Every MULTI-LINE template literal in a TS source, as inclusive 1-based
 *  [firstLine, lastLine] spans — parsed, not regexed, because a backtick inside
 *  a string, a comment or a nested `${}` is exactly the case a regex gets
 *  wrong and this check exists to stop guesses. Memoized on the text, so the
 *  self-test's dozen audits of the same tree parse each file once. */
const TEMPLATE_SPANS = new Map<string, Array<[number, number]>>();
export function templateSpans(file: string, text: string): Array<[number, number]> {
  const key = `${file} ${text.length} ${text.slice(0, 256)}`;
  const memo = TEMPLATE_SPANS.get(key);
  if (memo) return memo;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const spans: Array<[number, number]> = [];
  const walk = (n: ts.Node): void => {
    if (ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) {
      const a = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      const b = sf.getLineAndCharacterOfPosition(n.getEnd()).line + 1;
      if (b > a) spans.push([a, b]);
    }
    n.forEachChild(walk);
  };
  walk(sf);
  TEMPLATE_SPANS.set(key, spans);
  return spans;
}
/** Strictly inside the literal's BODY — the opening and closing lines carry the
 *  declaration around it, not the serialized rule. */
const insideTemplate = (spans: Array<[number, number]>, line: number) => spans.some(([a, b]) => line > a && line < b);

/** THE PINNED CENSUS — re-measured 2026-08-25 by re-fusing all 116 committed
 *  components through this tree's engine (`npx tsx scripts/door-census.ts`).
 *
 *  `authored` is the honest size of the "missing ink" surface: the control-equal
 *  drops the LIBRARY'S OWN STYLESHEET declares on the element, where the
 *  control-element delta door's premise is provably false. A count moving in
 *  either direction is a human's decision — "fewer" is not automatically
 *  progress (see extract/figma/dagger-census.ts for why).
 *
 *  RE-MEASURED FOR THE UA BASELINE (fix/baseline-isolation). The register's
 *  first census was taken while `fuse.control-element-delta` subtracted against
 *  the IN-PAGE control — the probe that inherits every page-global rule the
 *  library ships. That door now subtracts against `uaControls`, and the census
 *  replay passes it (scripts/door-census.ts), so these numbers measure the
 *  engine that actually runs rather than the fallback path. What moved, and why
 *  each direction is real:
 *    · control-equal drops 250,736 -> 246,318. The 4,418 fewer are facts the
 *      library authored page-globally and the door was cancelling; they are now
 *      CARRIED, which is the whole point of the fix.
 *    · LIBRARY-AUTHORED drops 244 -> 133, and shadcn alone falls 103 -> 1: the
 *      invisible-Input surface this census was built to size is essentially
 *      closed. polaris 78 -> 69 is the inkless-text half.
 *    · antd RISES 19 -> 23. This is not noise and not a regression in the fix:
 *      a channel whose authored value happens to COINCIDE with the user agent's
 *      default differs from the in-page control (which carried antd's global)
 *      but equals the UA control, so it is dropped now and was carried before.
 *      Four such channels exist in antd; they are a real, newly visible hole,
 *      and they are counted rather than absorbed.
 *  astryx and mui stay at 0 authored: neither corpus carries var() evidence on a
 *  dropped channel, so neither can contribute to this split.
 *
 *  RE-MEASURED FOR THE PHASE-1 READER ROUND (docs/35 §3, 2026-08-31): four
 *  captures landed so the recipe fixture-drift gate has ledgers to read —
 *  mui/Textarea (TextField multiline, NEW), antd/Textarea (Input.TextArea,
 *  NEW), astryx/TextArea (NEW), and astryx/CheckboxInput RECAPTURED with the
 *  checked×disabled axes its first capture pinned away (value:false). What
 *  moved: antd 12→13 components (drops +340, authored 23→31 — the textarea's
 *  var()-carrying paddings/radius are real newly-counted authored drops,
 *  fallback +1), astryx 10→11 (drops +1,775: the CheckboxInput recapture
 *  sweeps 12 combos where the old capture swept 2, plus the new TextArea;
 *  fallback +2), mui 31→32 (drops +3,263, fallback +6 — the multiline
 *  TextField mounts six unnamed parts). No engine change — the same doors
 *  over a larger corpus. */
export const PINNED_CENSUS: Record<string, { components: number; drops: number; authored: number; fallback: number }> = {
  altitude: { components: 8, drops: 4734, authored: 6, fallback: 5 },
  antd: { components: 13, drops: 25388, authored: 31, fallback: 21 },
  astryx: { components: 11, drops: 25096, authored: 0, fallback: 18 },
  carbon: { components: 10, drops: 34729, authored: 12, fallback: 30 }, // 2026-09-02: Tabs re-captured at the archetype's shape (two tabs, no panel): 2,542 fewer control-equal drops, 2 fewer span-fallback parts,
  // 2026-09-02 — three rows re-pinned by hand, each move named (a moved count is
  // a human's decision, in either direction):
  //   · fluent 20,892 -> 20,886 (-6): the Avatar capture record was re-taken
  //     with --keep-originals (Chromium 149 in the sandbox, 151 before) so the
  //     proposed avatar@1 fixture could be scored against a real render; six
  //     control-equal drops on that one component moved with the browser build.
  //   · shadcn 12,244 -> 12,205 (-39): Avatar and Tooltip re-captured for the
  //     same reason; the Checkbox and Switch records moved in the same run.
  //   · mui 73,325 -> 72,991 (-334): PREDATES this session — the mui captures
  //     changed at 48e68f107 (2026-09-01, the content remints) and the census
  //     was not re-pinned then; no mui capture was re-recorded on 2026-09-02.
  //     Re-pinned to what the committed tree measures; the cause of the
  //     -334 is not established here and is named as such.
  fluent: { components: 12, drops: 23096, authored: 15, fallback: 21 },
  //   · mui 72,991 -> 73,001 (+10), later on 2026-09-02: Dialog and Menu were
  //     re-captured with --keep-originals so the portal screenshots carry the
  //     overlay rect sidecars the fidelity gate crops to (Chromium 149 in the
  //     sandbox); ten control-equal drops on those two components moved with
  //     the re-capture. Named, re-pinned to what the committed tree measures.
  //   · mui 73,001 -> 72,647 drops, span-fallback 99 -> 98, later again on
  //     2026-09-02: the Menu capture record was re-taken with TWO items (the
  //     person's step for menu@1 — the archetype draws two), one item fewer
  //     than before, so its control-equal drops and one span-fallback part
  //     went with it. Named, re-pinned to what the committed tree measures.
  //   · mui 72,647 -> 73,395 drops, span-fallback 98 -> 100, the last move of
  //     2026-09-02: the Dialog capture record was re-taken with DialogTitle +
  //     DialogContent (the person's step for dialog@1 — a title over a body)
  //     in place of DialogContent alone, two parts more per cell. Named,
  //     re-pinned to what the committed tree measures.
  //   · fluent 11 -> 12 components, 20,886 -> 23,096 drops, LIBRARY-AUTHORED
  //     13 -> 15, span-fallback 19 -> 21, on 2026-09-04: a TWELFTH fluent
  //     component was captured. MessageBar is the first capture whose config
  //     entry was DRAFTED from the contract seed rather than written by hand
  //     (extract/computed/draft-config.ts --write derived name, import,
  //     contract path and both axes; a person added the composition and the
  //     glyph viewBox). The counts move because a component was ADDED, not
  //     because a door changed its mind: the eleven prior fluent components
  //     are unchanged, and the +2,210 drops, +2 authored and +2 span-fallback
  //     parts are MessageBar's own. Named, re-pinned to what the committed
  //     tree measures.
  mui: { components: 32, drops: 73395, authored: 0, fallback: 100 },
  polaris: { components: 12, drops: 44659, authored: 69, fallback: 43 },
  shadcn: { components: 11, drops: 12205, authored: 1, fallback: 7 },
  tailwind: { components: 11, drops: 8087, authored: 9, fallback: 7 },
};

export interface Finding {
  ok: boolean;
  label: string;
}

/** Every check except the corpus census — pure over (register, file texts), so
 *  the self-test can feed it deliberately broken inputs. */
export function auditRegister(reg: Register, read: (file: string) => string | null): Finding[] {
  const out: Finding[] = [];
  const bad = (label: string) => out.push({ ok: false, label });
  const ok = (label: string) => out.push({ ok: true, label });

  // ---- 4. SHAPE ----
  const ids = reg.doors.map((d) => d.id);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dupes.length > 0) bad(`duplicate door id(s): ${[...new Set(dupes)].join(', ')}`);
  else ok(`${ids.length} door ids are unique`);

  const sorted = [...ids].sort();
  if (JSON.stringify(ids) !== JSON.stringify(sorted)) {
    const at = ids.findIndex((v, i) => v !== sorted[i]);
    bad(`the register is not sorted by id — first divergence at index ${at}: ${ids[at]} where ${sorted[at]} was expected`);
  } else ok('the register is sorted by id (byte-stable diffs)');

  const shapeBad = reg.doors.filter((d) => !ID_RE.test(d.id));
  if (shapeBad.length > 0) bad(`${shapeBad.length} id(s) are not lowercase-kebab with a stage prefix: ${shapeBad.slice(0, 4).map((d) => d.id).join(', ')}`);
  else ok('every id is lowercase-kebab with a stage prefix');

  const kindBad = reg.doors.filter((d) => !KINDS.has(d.kind));
  if (kindBad.length > 0) bad(`${kindBad.length} door(s) carry a kind outside subtractive/admitting/both`);
  else ok('every door is classified subtractive, admitting or both');

  const stageBad = reg.doors.filter((d) => STAGE_FILES[d.id.split('.')[0]] !== d.file);
  if (stageBad.length > 0) {
    bad(`${stageBad.length} door(s) name a file their stage prefix does not own: ${stageBad.slice(0, 4).map((d) => `${d.id} -> ${d.file}`).join('; ')}`);
  } else ok(`every id's stage prefix agrees with its file (${Object.keys(STAGE_FILES).length} stages)`);

  const proseBad = reg.doors.filter((d) => !d.premise || !d.effect || !d.counterExample);
  if (proseBad.length > 0) bad(`${proseBad.length} door(s) are missing a premise, an effect or a counter-example — a door with no stated premise cannot be reviewed`);
  else ok('every door states a premise, what it subtracts or admits, and a counter-example');

  // ---- 1 + 2. DISCOVERY and COMPLETENESS ----
  const registered = new Map(reg.doors.map((d) => [d.id, d]));
  const foundInCode = new Map<string, Array<{ file: string; line: number }>>();
  let unreadable = 0;
  for (const file of new Set(Object.values(STAGE_FILES))) {
    const text = read(file);
    if (text === null) { unreadable++; continue; }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = MARKER_RE.exec(lines[i]);
      if (!m) continue;
      if (!foundInCode.has(m[1])) foundInCode.set(m[1], []);
      foundInCode.get(m[1])!.push({ file, line: i + 1 });
    }
  }
  if (unreadable > 0) bad(`${unreadable} registered door file(s) could not be read — the discovery sweep is not a denominator`);

  const undeclared = [...foundInCode.keys()].filter((id) => !registered.has(id));
  if (undeclared.length > 0) {
    bad(`${undeclared.length} door marker(s) exist in code but NOT in spec/door-register.json: ${undeclared.slice(0, 6).join(', ')} — a judgement call that is not written down is not reviewable`);
  } else ok(`every one of the ${foundInCode.size} @door markers in code is registered`);

  const unmarked = reg.doors.filter((d) => !foundInCode.has(d.id));
  if (unmarked.length > 0) {
    bad(`${unmarked.length} registered door(s) have NO @door marker in code: ${unmarked.slice(0, 6).map((d) => d.id).join(', ')} — the register has drifted off the rule it describes`);
  } else ok(`every one of the ${reg.doors.length} registered doors is marked at its rule`);

  const misplaced = reg.doors.filter((d) => {
    const hits = foundInCode.get(d.id);
    if (!hits) return false;
    return !hits.some((h) => h.file === d.file && h.line === d.line);
  });
  if (misplaced.length > 0) {
    bad(`${misplaced.length} door(s) record a line the marker is not on: ${misplaced.slice(0, 5).map((d) => `${d.id} (register says ${d.file}:${d.line}, marker at ${foundInCode.get(d.id)!.map((h) => h.line).join('/')})`).join('; ')}`);
  } else ok('every registered line matches where its marker actually sits');

  // ---- 5. RULE LINES ----
  // Read the two fields nothing read. Every red below names the door, the line
  // it claims and the line the code actually puts there, because "some door is
  // wrong" is not a finding a reviewer can act on.
  const missingRule: string[] = [];
  const wrongRule: string[] = [];
  const notInTemplate: string[] = [];
  const onNothing: string[] = [];
  const noAnchor: string[] = [];
  const wrongAnchor: string[] = [];
  const strayAnchor: string[] = [];
  let outsideClaims = 0;
  let checkedRuleLines = 0;
  for (const d of reg.doors) {
    const text = read(d.file);
    if (text === null) continue; // already red above — the sweep is not a denominator
    const lines = text.split('\n');
    if (typeof d.ruleLine !== 'number' || !Number.isInteger(d.ruleLine) || d.ruleLine < 1 || d.ruleLine > lines.length) {
      missingRule.push(`${d.id} (${d.file}: ruleLine ${JSON.stringify(d.ruleLine)})`);
      continue;
    }
    checkedRuleLines++;
    const at = lines[d.ruleLine - 1];
    if (isBlankLine(at) || isCommentOnlyLine(at)) {
      onNothing.push(`${d.id} (${d.file}:${d.ruleLine} is ${isBlankLine(at) ? 'blank' : `a comment: ${at.trim().slice(0, 60)}`})`);
    }
    if (d.markerOutsideRule !== undefined) {
      outsideClaims++;
      if (!insideTemplate(templateSpans(d.file, text), d.ruleLine)) {
        notInTemplate.push(`${d.id} (${d.file}:${d.ruleLine} is not inside any multi-line template literal)`);
      }
      if (d.ruleText === undefined) {
        noAnchor.push(`${d.id} (${d.file}:${d.ruleLine})`);
      } else if (d.ruleText !== at.trim()) {
        wrongAnchor.push(`${d.id} (${d.file}:${d.ruleLine} reads \`${at.trim().slice(0, 60)}\`, the register quotes \`${d.ruleText.slice(0, 60)}\`)`);
      }
      continue;
    }
    if (d.ruleText !== undefined) {
      strayAnchor.push(`${d.id} (${d.file}:${d.ruleLine})`);
    }
    const derived = annotatedLine(lines, d.line);
    if (derived !== d.ruleLine) {
      wrongRule.push(`${d.id} (register says ${d.file}:${d.ruleLine}, the marker at :${d.line} annotates ${derived === null ? 'NOTHING — only blanks and comments follow it' : `:${derived}`})`);
    }
  }
  if (missingRule.length > 0) {
    bad(`${missingRule.length} door(s) carry no usable ruleLine: ${missingRule.slice(0, 5).join('; ')} — a door whose rule cannot be pointed at is not reviewable`);
  } else ok(`all ${reg.doors.length} doors carry a ruleLine inside their own file`);

  if (wrongRule.length > 0) {
    bad(`${wrongRule.length} door(s) record a ruleLine that is NOT the line their marker annotates: ${wrongRule.slice(0, 5).join('; ')} — this is the defect that put 400 false claims in this register: a line computed once and never re-derived. THE REMEDY IS ONE COMMAND: ${REDERIVE_HINT}`);
  } else ok(`every ordinary marker's ruleLine is the line it actually annotates (${checkedRuleLines - outsideClaims} doors)`);

  if (noAnchor.length > 0) {
    bad(`${noAnchor.length} door(s) claim markerOutsideRule but quote no ruleText: ${noAnchor.slice(0, 5).join('; ')} — a line inside a template literal cannot be re-derived from the marker, so it must carry the source it points at or it is unverifiable again`);
  } else if (wrongAnchor.length > 0) {
    bad(`${wrongAnchor.length} door(s) quote a ruleText the file does not have at that line: ${wrongAnchor.slice(0, 3).join('; ')} — the rule moved inside its literal. ${REDERIVE_HINT}`);
  } else if (outsideClaims > 0) ok(`every markerOutsideRule door quotes the source line it cites, and the file still reads exactly that`);

  if (strayAnchor.length > 0) {
    bad(`${strayAnchor.length} ordinary door(s) carry a ruleText: ${strayAnchor.slice(0, 5).join('; ')} — an ordinary marker's line is a FUNCTION of the marker, so a quote there is a second source of truth that can rot independently`);
  }

  if (notInTemplate.length > 0) {
    bad(`${notInTemplate.length} door(s) claim markerOutsideRule but their ruleLine is NOT inside a template literal: ${notInTemplate.slice(0, 5).join('; ')} — the claim is that the rule could not carry a marker of its own, and that is checkable`);
  } else if (outsideClaims === 0) {
    bad('ZERO doors claim markerOutsideRule — every known template-literal rule in this pipeline lost its claim, or the field stopped being read again');
  } else ok(`${outsideClaims} door(s) claim markerOutsideRule and every one lands strictly inside a real template literal`);

  if (onNothing.length > 0) {
    bad(`${onNothing.length} ruleLine(s) land on a blank or comment-only line: ${onNothing.slice(0, 5).join('; ')} — a line number pointing at whitespace is not a citation`);
  } else ok('no ruleLine lands on a blank or comment-only line');

  // ---- 3. RECEIPT PATHS ----
  const claimsReceipt = reg.doors.filter((d) => d.receipt.channel !== 'none');
  const noMarker = claimsReceipt.filter((d) => !d.receipt.marker);
  if (noMarker.length > 0) bad(`${noMarker.length} door(s) claim a receipt channel but name no receipt marker to prove it`);
  else ok(`${claimsReceipt.length} door(s) claiming a receipt name the literal that proves the path`);

  const brokenPath: string[] = [];
  for (const d of claimsReceipt) {
    if (!d.receipt.marker) continue;
    const text = read(d.file);
    if (text === null) continue;
    if (!text.includes(d.receipt.marker)) brokenPath.push(`${d.id} (claims \`${d.receipt.marker}\` in ${d.file})`);
  }
  if (brokenPath.length > 0) {
    bad(`${brokenPath.length} door(s) claim to receipt but no receipt path exists in their file: ${brokenPath.slice(0, 5).join('; ')} — a register that claims honesty it does not have is worse than one that admits silence`);
  } else ok('every claimed receipt path exists in the door\'s own file');

  const silent = reg.doors.filter((d) => d.receipt.channel === 'none');
  if (silent.length === 0) {
    bad('ZERO doors are recorded as silent — either every door now receipts (then say so deliberately) or the register stopped being honest about the ones that do not');
  } else ok(`${silent.length} of ${reg.doors.length} doors are recorded as still firing silently — named, not hidden`);

  return out;
}

// ---------------------------------------------------------------------------
// THE REMEDY. A gate that refuses without saying how to fix it leaves a human
// to reconstruct the derivation by hand — which is how these lines rotted the
// first time. `--rederive` IS the derivation the gate enforces, run in write
// mode over the same inputs, so the two cannot drift apart: there is one
// function, and the check is that function's output compared with the file.
// ---------------------------------------------------------------------------

export const REDERIVE_HINT = 'run `npm run door-register:rederive` (it re-derives every line from the tree and rewrites the doc table to match)';

export interface Rederivation {
  moves: Array<{ id: string; file: string; from: number; to: number }>;
  /** `line` corrections — the @door MARKER itself moved, not just its rule. */
  markerMoves: Array<{ id: string; file: string; from: number; to: number }>;
  /** Doors the derivation REFUSES to move rather than guess. */
  refusals: string[];
}

/** Re-derive `ruleLine` (and, for the outside doors, `ruleText`) for every door
 *  in place. Mutates `reg`. Two mechanisms, because the doors are two kinds:
 *
 *   · ORDINARY DOORS — the line is a pure function of the marker's position
 *     (`annotatedLine`), so it is recomputed unconditionally. This is the case
 *     that moves when an unrelated PR displaces marker lines, and it is total:
 *     429 doors re-derive with no judgement and no input beyond the tree.
 *   · markerOutsideRule DOORS — the line is inside a template literal, where
 *     nothing about the marker's position predicts it. The register carries the
 *     source line as `ruleText`, so the rule is followed by its TEXT: if the
 *     quoted line still reads the same, nothing moves; if it does not, the same
 *     text is searched for inside the template literal the marker sits above.
 *     Exactly one hit relocates. Zero or several REFUSE, by name — a rule whose
 *     anchor is ambiguous needs a human to re-read it, and a re-derivation that
 *     silently picks one of two candidates is the defect this file exists to
 *     stop. (`capture.slot-splice`'s anchor appears twice inside its own
 *     literal, so this is not a hypothetical.)
 *
 *  BEFORE EITHER, `line` ITSELF IS RE-DERIVED, and it has to be. Both
 *  mechanisms above read `d.line` as their origin — `annotatedLine(lines,
 *  d.line)` for an ordinary door, and "the template literal at or after
 *  `d.line`" for an outside one. So a merge that displaces the `// @door`
 *  markers themselves leaves every derivation computing the right answer to
 *  the wrong question: it lands a plausible `ruleLine`, writes it, and reports
 *  the move as a success. The gate catches the stale `line` separately, so
 *  nothing is silently green — but the remedy told you it had fixed the thing
 *  it had not fixed, which is the loop this command was written to end. The
 *  marker sweep is the gate's own (`MARKER_RE` over `STAGE_FILES`); exactly one
 *  hit in the door's own file relocates, and zero, several, or a hit in a
 *  DIFFERENT file all REFUSE — a door that changed file is a judgement call
 *  about what the door now means, not an offset. */
export function rederive(reg: Register, read: (file: string) => string | null): Rederivation {
  const moves: Rederivation['moves'] = [];
  const markerMoves: Rederivation['markerMoves'] = [];
  const refusals: string[] = [];

  // Where every @door marker ACTUALLY sits, by the gate's own regex over the
  // gate's own file list. `line` is re-derived from this before anything is
  // derived from `line`.
  const markers = new Map<string, Array<{ file: string; line: number }>>();
  for (const file of new Set(Object.values(STAGE_FILES))) {
    const text = read(file);
    if (text === null) continue;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = MARKER_RE.exec(lines[i]);
      if (!m) continue;
      if (!markers.has(m[1])) markers.set(m[1], []);
      markers.get(m[1])!.push({ file, line: i + 1 });
    }
  }

  const markerRefused = new Set<string>();
  for (const d of reg.doors) {
    const hits = markers.get(d.id) ?? [];
    if (hits.length === 0) {
      refusals.push(`${d.id}: no \`// @door ${d.id}\` marker exists anywhere in the registered files — the door was deleted or renamed, which is a decision, not a line number`);
      markerRefused.add(d.id);
      continue;
    }
    if (hits.length > 1) {
      refusals.push(`${d.id}: the marker occurs ${hits.length} times (${hits.map((h) => `${h.file}:${h.line}`).join(', ')}) — ambiguous; one id must mark one rule`);
      markerRefused.add(d.id);
      continue;
    }
    if (hits[0].file !== d.file) {
      refusals.push(`${d.id}: the marker has moved from ${d.file} to ${hits[0].file} — a door that changed file is a judgement call about what it now describes, not an offset to follow`);
      markerRefused.add(d.id);
      continue;
    }
    if (hits[0].line !== d.line) {
      markerMoves.push({ id: d.id, file: d.file, from: d.line, to: hits[0].line });
      d.line = hits[0].line;
    }
  }

  for (const d of reg.doors) {
    if (markerRefused.has(d.id)) continue; // its origin is unknown; deriving from it would be a guess
    const text = read(d.file);
    if (text === null) {
      refusals.push(`${d.id}: ${d.file} could not be read`);
      continue;
    }
    const lines = text.split('\n');
    const from = d.ruleLine;

    if (d.markerOutsideRule === undefined) {
      delete d.ruleText; // an ordinary door's line needs no anchor, and must not carry one
      const to = annotatedLine(lines, d.line);
      if (to === null) {
        refusals.push(`${d.id}: the marker at ${d.file}:${d.line} is followed by nothing but blanks and comments to end of file`);
        continue;
      }
      d.ruleLine = to;
      if (to !== from) moves.push({ id: d.id, file: d.file, from, to });
      continue;
    }

    // An outside door. Follow the quote, not the offset.
    if (d.ruleText === undefined) {
      refusals.push(`${d.id}: claims markerOutsideRule but quotes no ruleText, so its line inside the literal cannot be followed — re-read the rule and add the quote by hand`);
      continue;
    }
    if (lines[d.ruleLine - 1]?.trim() === d.ruleText) continue; // still exactly where it was
    const spans = templateSpans(d.file, text);
    const span = spans.filter(([a]) => a >= d.line).sort((x, y) => x[0] - y[0])[0];
    if (!span) {
      refusals.push(`${d.id}: no template literal opens at or after the marker at ${d.file}:${d.line}, so the claim itself is stale — re-read the rule`);
      continue;
    }
    const hits: number[] = [];
    for (let i = span[0]; i < span[1] - 1; i++) if (lines[i].trim() === d.ruleText) hits.push(i + 1);
    if (hits.length !== 1) {
      refusals.push(
        `${d.id}: the quoted rule \`${d.ruleText.slice(0, 60)}\` occurs ${hits.length} time(s) inside the literal at ${d.file}:${span[0]}-${span[1]} — ${hits.length === 0 ? 'the rule was edited or removed' : `ambiguous (${hits.join(', ')})`}; re-read it and set ruleLine by hand`,
      );
      continue;
    }
    d.ruleLine = hits[0];
    if (hits[0] !== from) moves.push({ id: d.id, file: d.file, from, to: hits[0] });
  }
  return { moves, markerMoves, refusals };
}

/** Rewrite the doc table's `line` / `(rule N)` cells from the register. The
 *  doc is a copy, and a copy regenerated by the same command that fixes the
 *  original is a copy that cannot be forgotten. */
export function rewriteDocLines(reg: Register, doc: string): { text: string; changed: number } {
  const byId = new Map(reg.doors.map((d) => [d.id, d]));
  let changed = 0;
  const out = doc.split('\n').map((line) => {
    const m = DOC_ROW_RE.exec(line);
    if (!m) return line;
    const d = byId.get(m[2]);
    if (!d) return line;
    const want = d.markerOutsideRule !== undefined ? `${d.line}<br/>*(rule ${d.ruleLine})*` : String(d.line);
    const got = m[3] + (m[4] ? `<br/>*(rule ${m[4]})*` : '');
    if (got === want) return line;
    changed++;
    return m[1] + want + m[5] + line.slice(m[0].length);
  });
  return { text: out.join('\n'), changed };
}

/** The prose half: spec/DOOR-REGISTER.md is the register's human face, and it
 *  reprints every door's line numbers in a table. Those cells were as stale as
 *  the register's own — 60 wrong `line`s and 415 `(rule N)`s copied from the
 *  field that was never re-derived — so they are checked here rather than
 *  trusted. Pure over (register, doc text) so the self-test can break it. */
export const DOC_ROW_RE = /^(\| `([a-z0-9.-]+)` \| )(\d+)(?:<br\/>\*\(rule (\d+)\)\*)?( \|)/;
export function auditDoc(reg: Register, doc: string): Finding[] {
  const out: Finding[] = [];
  const bad = (label: string) => out.push({ ok: false, label });
  const ok = (label: string) => out.push({ ok: true, label });

  const missing = reg.doors.filter((d) => !doc.includes(d.id));
  if (missing.length > 0) {
    bad(`${missing.length} registered door(s) are absent from spec/DOOR-REGISTER.md: ${missing.slice(0, 5).map((d) => d.id).join(', ')}`);
  } else ok(`all ${reg.doors.length} doors appear in spec/DOOR-REGISTER.md`);

  const claimed = /\*\*(\d+)\*\* doors/.exec(doc);
  if (!claimed) bad('spec/DOOR-REGISTER.md does not state a door count in the pinned form (**N** doors)');
  else if (Number(claimed[1]) !== reg.doors.length) bad(`spec/DOOR-REGISTER.md claims ${claimed[1]} doors; the register carries ${reg.doors.length}`);
  else ok(`the doc's stated count (${claimed[1]}) matches the register`);

  // A door may appear in more than one table (the stage tables, plus the
  // findings table that names the doors whose prose does not match their rule),
  // so DISTINCT doors covered is the denominator and every row is checked.
  const byId = new Map(reg.doors.map((d) => [d.id, d]));
  const drift: string[] = [];
  const covered = new Set<string>();
  let rows = 0;
  for (const line of doc.split('\n')) {
    const m = DOC_ROW_RE.exec(line);
    if (!m) continue;
    const d = byId.get(m[2]);
    if (!d) continue;
    rows++;
    covered.add(d.id);
    const want = d.markerOutsideRule !== undefined ? `${d.line}<br/>*(rule ${d.ruleLine})*` : String(d.line);
    const got = m[3] + (m[4] ? `<br/>*(rule ${m[4]})*` : '');
    if (got !== want) drift.push(`${d.id} (doc says ${got}, register says ${want})`);
  }
  if (covered.size !== reg.doors.length) {
    bad(`spec/DOOR-REGISTER.md tabulates ${covered.size} of ${reg.doors.length} registered doors — the table is not the register`);
  } else if (drift.length > 0) {
    bad(`${drift.length} doc table row(s) print a line the register does not: ${drift.slice(0, 5).join('; ')} — the doc is the face the register is read through, so a stale cell there is the same defect one level up. ${REDERIVE_HINT}`);
  } else ok(`all ${rows} doc table rows (over ${covered.size} doors) print the register's own line and ruleLine`);

  return out;
}

/** The census half — refuses when the measured subtraction table moves. */
export function auditCensus(c: Census): Finding[] {
  const out: Finding[] = [];
  const bad = (label: string) => out.push({ ok: false, label });
  const ok = (label: string) => out.push({ ok: true, label });

  // A config that has never been captured (held-out exam material, by design)
  // is a NAMED skip, not a failure: there is nothing to census, and saying so
  // out loud is the anti-silent property. A component that HAS captures and
  // still would not re-fuse is a real red — the census would not be a
  // denominator. Keep the two apart.
  const neverCaptured = c.skipped.filter((s) => s.includes('no committed captures'));
  const refuseFailures = c.skipped.filter((s) => !s.includes('no committed captures'));
  if (refuseFailures.length > 0) {
    bad(`${refuseFailures.length} component(s) failed to re-fuse — the census below is NOT a denominator:\n      ${refuseFailures.slice(0, 5).join('\n      ')}`);
  } else ok(`all ${c.components} committed components re-fused offline, 0 failed`);
  if (neverCaptured.length > 0) {
    ok(`${neverCaptured.length} config(s) never captured, named and excluded from the denominator:\n      ${neverCaptured.join('\n      ')}`);
  }
  if (c.components < 50) {
    bad(`only ${c.components} components re-fused — a check that passes because it measured almost nothing is the defect this repo keeps finding`);
  }

  const seen = new Set<string>();
  for (const l of c.libraries) {
    seen.add(l.library);
    const p = PINNED_CENSUS[l.library];
    if (!p) { bad(`library "${l.library}" has committed captures but no pinned census row — add it, or the totals are measured over the wrong population`); continue; }
    const moved: string[] = [];
    if (l.components !== p.components) moved.push(`components ${p.components} -> ${l.components}`);
    if (l.controlEqualDrops !== p.drops) moved.push(`control-equal drops ${p.drops} -> ${l.controlEqualDrops}`);
    if (l.controlEqualAuthored !== p.authored) moved.push(`LIBRARY-AUTHORED drops ${p.authored} -> ${l.controlEqualAuthored}`);
    if (l.controlFallbackParts !== p.fallback) moved.push(`span-fallback parts ${p.fallback} -> ${l.controlFallbackParts}`);
    if (moved.length > 0) bad(`${l.library}: ${moved.join(', ')} — a moved count is a human's decision, in either direction`);
  }
  for (const k of Object.keys(PINNED_CENSUS)) {
    if (!seen.has(k)) bad(`pinned library "${k}" produced no census row — its captures went missing`);
  }
  if (!out.some((f) => !f.ok)) ok(`the subtraction census matches the pinned table across ${c.libraries.length} libraries`);

  const totalAuthored = c.libraries.reduce((n, l) => n + l.controlEqualAuthored, 0);
  if (totalAuthored === 0) {
    bad('ZERO library-authored control-equal drops measured — either the split is broken or the corpus lost its var() evidence; the whole point of the census is that this number is not zero');
  } else {
    ok(`${totalAuthored} library-authored control-equal drops named — the measured size of the "missing ink" surface`);
  }
  return out;
}

/** Deliberately broken registers, so the gate is proved to be able to go red. */
function selfTest(): number {
  const real = JSON.parse(readFileSync(REGISTER, 'utf8')) as Register;
  const files = new Map<string, string>();
  for (const f of new Set(Object.values(STAGE_FILES))) files.set(f, readFileSync(path.join(REPO, f), 'utf8'));
  const read = (f: string) => files.get(f) ?? null;
  const clone = (): Register => JSON.parse(JSON.stringify(real)) as Register;

  const cases: Array<{ name: string; build: () => { reg: Register; read: (f: string) => string | null }; expect: RegExp }> = [
    {
      name: 'a door marker in code with no register entry is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors = reg.doors.filter((d) => d.id !== 'fuse.control-element-delta');
        return { reg, read };
      },
      expect: /exist in code but NOT in spec\/door-register\.json/,
    },
    {
      name: 'a registered door with no marker in code is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors.push({ ...reg.doors[0], id: 'fuse.a-door-that-is-not-in-the-code' });
        reg.doors.sort((a, b) => (a.id < b.id ? -1 : 1));
        return { reg, read };
      },
      expect: /have NO @door marker in code/,
    },
    {
      name: 'a door claiming a receipt whose receipt path does not exist is REFUSED',
      build: () => {
        const reg = clone();
        const d = reg.doors.find((x) => x.id === 'fuse.control-element-delta')!;
        d.receipt = { channel: 'styled-channel-receipts', marker: 'a-receipt-prefix-nothing-emits:' };
        return { reg, read };
      },
      expect: /claim to receipt but no receipt path exists/,
    },
    {
      name: 'a door claiming a receipt channel but naming no marker is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors.find((x) => x.id === 'fuse.control-element-delta')!.receipt = { channel: 'styled-channel-receipts' };
        return { reg, read };
      },
      expect: /name no receipt marker/,
    },
    {
      name: 'an unsorted register is REFUSED',
      build: () => {
        const reg = clone();
        [reg.doors[0], reg.doors[1]] = [reg.doors[1], reg.doors[0]];
        return { reg, read };
      },
      expect: /is not sorted by id/,
    },
    {
      name: 'a duplicate door id is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors.splice(1, 0, { ...reg.doors[0] });
        return { reg, read };
      },
      expect: /duplicate door id/,
    },
    {
      name: 'an id whose stage prefix does not own its file is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors.find((x) => x.id === 'fuse.control-element-delta')!.file = 'core/mint-tokens.ts';
        return { reg, read };
      },
      expect: /name a file their stage prefix does not own/,
    },
    {
      name: 'a register line that is not where the marker sits is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors.find((x) => x.id === 'fuse.control-element-delta')!.line = 1;
        return { reg, read };
      },
      expect: /record a line the marker is not on/,
    },
    {
      name: 'a door with no stated premise is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors.find((x) => x.id === 'fuse.control-element-delta')!.premise = '';
        return { reg, read };
      },
      expect: /missing a premise/,
    },
    {
      name: 'a register that claims every door receipts is REFUSED',
      build: () => {
        const reg = clone();
        for (const d of reg.doors) if (d.receipt.channel === 'none') d.receipt = { channel: 'notes', marker: 'ctx.notes.push' };
        return { reg, read };
      },
      expect: /ZERO doors are recorded as silent/,
    },
    {
      name: 'a ruleLine that is not the line its marker annotates is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors.find((x) => x.id === 'fuse.control-element-delta')!.ruleLine += 5;
        return { reg, read };
      },
      expect: /record a ruleLine that is NOT the line their marker annotates/,
    },
    {
      name: 'a door with no ruleLine at all is REFUSED',
      build: () => {
        const reg = clone();
        delete (reg.doors.find((x) => x.id === 'fuse.control-element-delta') as Partial<Door>).ruleLine;
        return { reg, read };
      },
      expect: /carry no usable ruleLine/,
    },
    {
      name: 'a markerOutsideRule claim whose ruleLine is not in a template literal is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors.find((x) => x.id === 'fuse.control-element-delta')!.markerOutsideRule =
          'a claim that the rule lives inside a serialized in-page function, which it does not';
        return { reg, read };
      },
      expect: /claim markerOutsideRule but their ruleLine is NOT inside a template literal/,
    },
    {
      name: 'a register in which NO door claims markerOutsideRule is REFUSED',
      build: () => {
        const reg = clone();
        for (const d of reg.doors) delete d.markerOutsideRule;
        return { reg, read };
      },
      expect: /ZERO doors claim markerOutsideRule/,
    },
    {
      name: 'a markerOutsideRule door that quotes no ruleText is REFUSED',
      build: () => {
        const reg = clone();
        delete reg.doors.find((x) => x.id === 'capture.slot-splice')!.ruleText;
        return { reg, read };
      },
      expect: /claim markerOutsideRule but quote no ruleText/,
    },
    {
      name: 'a markerOutsideRule door quoting a line the file does not have there is REFUSED',
      build: () => {
        const reg = clone();
        reg.doors.find((x) => x.id === 'capture.slot-splice')!.ruleText = 'if (theRuleMovedInsideItsLiteral) return;';
        return { reg, read };
      },
      expect: /quote a ruleText the file does not have at that line/,
    },
    {
      name: 'an ORDINARY door carrying a ruleText is REFUSED (a second source of truth rots on its own)',
      build: () => {
        const reg = clone();
        reg.doors.find((x) => x.id === 'fuse.control-element-delta')!.ruleText = 'anything at all';
        return { reg, read };
      },
      expect: /ordinary door\(s\) carry a ruleText/,
    },
    {
      name: 'a ruleLine landing on a COMMENT line is REFUSED',
      build: () => {
        // Inside SHADOW_HELPERS_JS, so the markerOutsideRule claim still holds
        // and this red is the comment test alone rather than a side effect.
        const reg = clone();
        reg.doors.find((x) => x.id === 'capture.slot-splice')!.ruleLine = 1015;
        return { reg, read };
      },
      expect: /land on a blank or comment-only line/,
    },
    {
      name: 'a ruleLine landing on a BLANK line is REFUSED',
      build: () => {
        const reg = clone();
        const d = reg.doors.find((x) => x.id === 'fuse.control-element-delta')!;
        const lines = files.get(d.file)!.split('\n');
        const blank = lines.findIndex((l, i) => i > d.line && l.trim() === '');
        d.ruleLine = blank + 1;
        return { reg, read };
      },
      expect: /land on a blank or comment-only line/,
    },
    {
      name: 'an unreadable door file is REFUSED (the sweep is not a denominator)',
      build: () => ({ reg: clone(), read: (f: string) => (f === 'extract/computed/fuse.ts' ? null : (files.get(f) ?? null)) }),
      expect: /could not be read/,
    },
  ];

  console.log('\nSELF-TEST — the gate is proved able to go red');
  let failures = 0;
  for (const c of cases) {
    const { reg, read: r } = c.build();
    const findings = auditRegister(reg, r);
    const reds = findings.filter((f) => !f.ok).map((f) => f.label);
    const hit = reds.some((l) => c.expect.test(l));
    console.log(`  ${hit ? '✔' : '✖'} ${c.name}`);
    if (!hit) {
      failures++;
      console.log(`      expected a red matching ${c.expect}; got: ${reds.length === 0 ? '(all green — the gate did NOT refuse)' : reds.slice(0, 3).join(' | ')}`);
    }
  }
  // THE REMEDY, PROVED. A gate that refuses and a command that repairs are only
  // one thing if the command actually produces what the gate accepts — so the
  // register is broken the way a landing PR breaks it (every line displaced),
  // repaired by `rederive`, and compared BYTE-FOR-BYTE with the committed file.
  {
    const scrambled = clone();
    for (const d of scrambled.doors) if (d.markerOutsideRule === undefined) d.ruleLine += 7;
    const { moves, refusals } = rederive(scrambled, read);
    const restored = JSON.stringify(scrambled) === JSON.stringify(real);
    const expected = real.doors.filter((d) => d.markerOutsideRule === undefined).length;
    const good = restored && refusals.length === 0 && moves.length === expected;
    console.log(`  ${good ? '✔' : '✖'} --rederive REPAIRS exactly what the gate refuses (${expected} displaced lines restored byte-for-byte)`);
    if (!good) {
      failures++;
      console.log(`      moved ${moves.length}/${expected}, refusals ${refusals.length}, byte-identical to the committed register: ${restored}`);
    }
  }
  {
    // THE HALF THAT WAS MISSING. Displace the @door MARKERS themselves — what a
    // merge does — and the remedy must correct `line` FIRST and still land the
    // register byte-for-byte. Before this, `line` was never re-derived: every
    // rule line was computed from a stale origin, written, and reported as a
    // successful move.
    const markersMoved = clone();
    for (const d of markersMoved.doors) d.line += 5;
    const { markerMoves, refusals } = rederive(markersMoved, read);
    const restored = JSON.stringify(markersMoved) === JSON.stringify(real);
    const good = restored && refusals.length === 0 && markerMoves.length === real.doors.length;
    console.log(`  ${good ? '\u2714' : '\u2716'} --rederive corrects a displaced @door MARKER line, not just the rule (${real.doors.length} markers restored byte-for-byte)`);
    if (!good) {
      failures++;
      console.log(`      markerMoves ${markerMoves.length}/${real.doors.length}, refusals ${refusals.length}, byte-identical: ${restored}`);
    }
  }
  {
    // …and REFUSES a marker it cannot find rather than deriving from a stale
    // origin. A deleted or renamed door is a decision, not an offset.
    const gone = clone();
    gone.doors.find((x) => x.id === 'fuse.control-element-delta')!.id = 'fuse.no-such-door-at-all';
    const { refusals } = rederive(gone, read);
    const hit = refusals.some((r) => /fuse\.no-such-door-at-all: no `\/\/ @door/.test(r));
    console.log(`  ${hit ? '\u2714' : '\u2716'} --rederive REFUSES a door whose marker is gone instead of deriving from a stale line`);
    if (!hit) {
      failures++;
      console.log(`      expected a named refusal; got: ${refusals.length === 0 ? '(none — it derived anyway)' : refusals.slice(0, 2).join(' | ')}`);
    }
  }
  {
    // …and REFUSES rather than guesses. `capture.slot-splice`'s anchor text
    // occurs twice inside its own template literal, so pointing it at the wrong
    // one must produce a named refusal, never a silent pick.
    const ambiguous = clone();
    const d = ambiguous.doors.find((x) => x.id === 'capture.slot-splice')!;
    d.ruleLine = d.ruleLine - 2; // no longer the quoted line, forcing a search
    const { refusals } = rederive(ambiguous, read);
    const hit = refusals.some((r) => /capture\.slot-splice: the quoted rule .* occurs 2 time\(s\)/.test(r));
    console.log(`  ${hit ? '✔' : '✖'} --rederive REFUSES an ambiguous anchor instead of picking one`);
    if (!hit) {
      failures++;
      console.log(`      expected a named refusal for capture.slot-splice; got: ${refusals.length === 0 ? '(none — it silently picked)' : refusals.join(' | ')}`);
    }
  }

  // The doc half, broken the same way: the table is a copy of the register and
  // a copy that is never compared is exactly how 415 stale cells got printed.
  const realDoc = readFileSync(DOC, 'utf8');
  const docCases: Array<{ name: string; doc: string; expect: RegExp }> = [
    {
      name: 'a doc table row printing a line the register does not is REFUSED',
      doc: realDoc.replace(/^(\| `fuse\.control-element-delta` \| )(\d+)/m, (_m, a: string, n: string) => a + (Number(n) + 7)),
      expect: /print a line the register does not/,
    },
    {
      name: 'a doc table row printing a stale *(rule N)* cell is REFUSED',
      doc: realDoc.replace(/^(\| `capture\.slot-splice` \| \d+)<br\/>\*\(rule \d+\)\*/m, '$1'),
      expect: /print a line the register does not/,
    },
    {
      name: 'a doc that lost a door row entirely is REFUSED',
      doc: realDoc.split('\n').filter((l) => !l.startsWith('| `fuse.control-element-delta` |')).join('\n'),
      expect: /tabulates \d+ of \d+ registered doors|are absent from spec\/DOOR-REGISTER\.md/,
    },
  ];
  for (const c of docCases) {
    const reds = auditDoc(real, c.doc).filter((f) => !f.ok).map((f) => f.label);
    const hit = reds.some((l) => c.expect.test(l));
    console.log(`  ${hit ? '✔' : '✖'} ${c.name}`);
    if (!hit) {
      failures++;
      console.log(`      expected a red matching ${c.expect}; got: ${reds.length === 0 ? '(all green — the gate did NOT refuse)' : reds.slice(0, 3).join(' | ')}`);
    }
  }

  // …and the honest register must be GREEN, or the red cases prove nothing.
  const clean = [...auditRegister(real, read), ...auditDoc(real, realDoc)].filter((f) => !f.ok);
  if (clean.length > 0) {
    failures++;
    console.log(`  ✖ the committed register itself is red, so the red cases above prove nothing:\n      ${clean.map((f) => f.label).join('\n      ')}`);
  } else console.log('  ✔ the committed register is green (so the red cases above are the gate, not noise)');
  return failures;
}

// ---------------------------------------------------------------------------

const selfTestOnly = process.argv.includes('--self-test');
let failures = 0;

console.log('THE DOOR REGISTER — spec/door-register.json vs the code it describes');

if (!existsSync(REGISTER)) {
  console.error(`  ✖ ${REGISTER} does not exist`);
  process.exit(1);
}
const raw = readFileSync(REGISTER, 'utf8');
const reg = JSON.parse(raw) as Register;
const readSource = (file: string): string | null => {
  const abs = path.join(REPO, file);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
};

// --rederive: the write half of the same derivation the gate reads.
if (process.argv.includes('--rederive')) {
  console.log('\n--rederive — re-deriving every line from the tree\n');
  const { moves, markerMoves, refusals } = rederive(reg, readSource);
  // The marker half FIRST, because everything below is derived from it. A run
  // that silently corrected 300 marker lines and reported only rule moves is
  // the report that hid the problem.
  if (markerMoves.length === 0) console.log('  (no @door marker moved — `line` already matches the tree)');
  else {
    const mByFile = new Map<string, number>();
    for (const m of markerMoves) mByFile.set(m.file, (mByFile.get(m.file) ?? 0) + 1);
    for (const [f, n] of [...mByFile].sort()) console.log(`  ${String(n).padStart(4)} @door MARKER line(s) corrected in ${f}`);
    const md = markerMoves.map((m) => Math.abs(m.to - m.from)).sort((a, b) => a - b);
    console.log(`  ${markerMoves.length} marker line(s) corrected; |delta| min ${md[0]}, median ${md[md.length >> 1]}, max ${md[md.length - 1]}`);
  }
  const byFile = new Map<string, number>();
  for (const m of moves) byFile.set(m.file, (byFile.get(m.file) ?? 0) + 1);
  for (const [f, n] of [...byFile].sort()) console.log(`  ${String(n).padStart(4)} door(s) moved in ${f}`);
  if (moves.length === 0) console.log('  (no ruleLine moved — the register already matches the tree)');
  else {
    const deltas = moves.map((m) => Math.abs(m.to - m.from)).sort((a, b) => a - b);
    console.log(`  ${moves.length} ruleLine(s) moved; |delta| min ${deltas[0]}, median ${deltas[deltas.length >> 1]}, max ${deltas[deltas.length - 1]}`);
  }
  writeFileSync(REGISTER, JSON.stringify(reg, null, 2) + '\n');
  console.log(`  ✔ ${path.relative(REPO, REGISTER)} rewritten (byte-stable, sorted)`);
  if (existsSync(DOC)) {
    const { text, changed } = rewriteDocLines(reg, readFileSync(DOC, 'utf8'));
    writeFileSync(DOC, text);
    console.log(`  ✔ ${path.relative(REPO, DOC)} table: ${changed} cell(s) rewritten from the register`);
  }
  if (refusals.length > 0) {
    console.error(`\n  ✖ ${refusals.length} door(s) were NOT re-derived — a line this command cannot follow mechanically is a line a human has to re-read, not one it may guess:`);
    for (const r of refusals) console.error(`      ${r}`);
    console.error('\n✖ door register: re-derivation incomplete; run npm run door-register:check for the full picture');
    process.exit(1);
  }
  console.log('\n✔ re-derived. Now run `npm run door-register:check` — it re-derives the same lines and compares.');
  process.exit(0);
}

console.log('\n1. the register is byte-stable');
{
  const round = JSON.stringify(reg, null, 2) + '\n';
  if (round !== raw) {
    console.log('  ✖ spec/door-register.json is not byte-stable — re-serializing produces different bytes (key order, indentation or trailing newline). A register whose diffs are noise does not get read.');
    failures++;
  } else console.log(`  ✔ ${raw.length.toLocaleString('en-US')} bytes round-trip exactly`);
}

console.log('\n2. the register and the code agree');
for (const f of auditRegister(reg, (file) => {
  const abs = path.join(REPO, file);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
})) {
  console.log(`  ${f.ok ? '✔' : '✖'} ${f.label}`);
  if (!f.ok) failures++;
}

console.log('\n3. the doc names the same doors as the register');
{
  if (!existsSync(DOC)) {
    console.log('  ✖ spec/DOOR-REGISTER.md does not exist');
    failures++;
  } else {
    for (const f of auditDoc(reg, readFileSync(DOC, 'utf8'))) {
      console.log(`  ${f.ok ? '✔' : '✖'} ${f.label}`);
      if (!f.ok) failures++;
    }
  }
}

console.log('\n4. the subtraction census, re-measured over the committed corpus');
{
  const c = runCensus();
  for (const f of auditCensus(c)) {
    console.log(`  ${f.ok ? '✔' : '✖'} ${f.label}`);
    if (!f.ok) failures++;
  }
  console.log('');
  for (const line of censusTable(c)) console.log(`    ${line}`);
}

if (selfTestOnly || process.env.DOOR_REGISTER_SELF_TEST === '1') failures += selfTest();

console.log('');
if (failures > 0) {
  console.error(`✖ door register: ${failures} failure(s)`);
  process.exit(1);
}
console.log(`✔ door register: ${reg.doors.length} doors named and premised, ${reg.doors.filter((d) => d.receipt.channel === 'none').length} still silent (named as such), every claimed receipt path present, census matches the pinned table.`);
