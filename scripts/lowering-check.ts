/**
 * THE LOWERING REGISTER GATE — `npm run lowering:check`
 *
 * A DOOR decides whether a computed fact is admitted or dropped. A LOWERING
 * decides something else entirely: given that a fact IS carried, WHAT SHAPE
 * does it take on the other surface? `margin` between two stacked siblings has
 * no Figma twin, so something has to choose — parent `itemSpacing`, parent
 * padding, a synthetic wrapper node, or a named refusal. Those choices are the
 * conversion. Until this register they were made in code and written down
 * nowhere.
 *
 * The structural fact that forced this file into existence:
 *
 *   `core/emit-figma-script.ts` is 8,230 lines and carries ZERO `// @door`
 *   markers, and `STAGE_FILES` in scripts/door-register-check.ts has no `emit`
 *   entry. The 429-door register covers CAPTURE and the INVERSE. Every FORWARD
 *   structure decision — the margin box, auto-layout inference, the slot birth
 *   box, the state plane, set placement — was unregistered and ungated. That is
 *   why a forward failure could never be cited to a line.
 *
 * So this is not a second door register. It is the register the FORWARD
 * direction never got, and `emit` is the stage it adds.
 *
 * The gate holds the register to the code in eleven directions:
 *
 *   1.  BYTE-STABLE — re-serializing spec/lowering.json produces the same bytes
 *   2.  SHAPE — ids lowercase-kebab and stage-prefixed, unique, sorted; the
 *       stage prefix agrees with the `stage` field AND with the file that stage
 *       owns; status/family are in vocabulary; no rule is missing its prose
 *   3.  CANONICAL — a rule with no `canonical` (the fixed-point form the two
 *       directions must agree on) is REFUSED. This is the direction that stops
 *       the register becoming a list of behaviours instead of a specification.
 *   4.  FIXED POINT — for an `implemented` rule that has an inverse, the CSS the
 *       inverse emits must BE the canonical form. A rule may declare
 *       `inverse.asymmetric: true`, but then it must name in `lost` what the
 *       asymmetry costs. A rule that silently changes spelling on the way back
 *       and claims symmetry is red.
 *   5.  DISCOVERY — every `// @lower <id>` marker in the covered files names a
 *       registered rule. A lowering decision added to the code with no entry
 *       fails here, which is the whole point.
 *   6.  COMPLETENESS — every `implemented` rule's marker is present, on the line
 *       the register records; every `proposed`/`wall` rule has NO marker (there
 *       is nothing implemented to mark) and records no marker line.
 *   7.  SITE PRESENT — every rule, INCLUDING `proposed` and `wall`, cites the
 *       exact line the current behaviour lives at, and the register records that
 *       line's source text. When the line moves, the text no longer matches and
 *       the gate refuses. A `proposed` rule that cannot site-cite is an opinion,
 *       not a rule, and it does not get in.
 *   8.  MARKER PLACEMENT — much of the emit runtime is a serialized in-page
 *       template literal, so its deciding rules cannot carry a comment marker.
 *       The door register handles this with `markerOutsideRule` — and applies
 *       that boilerplate to all 27 `propose.*` layout doors, where it is FALSE:
 *       those markers sit on ordinary lines. This gate does not repeat that
 *       error. It VERIFIES the claim: a rule claiming `markerOutsideRule` must
 *       have a `ruleLine` genuinely inside a template literal, and a rule whose
 *       `ruleLine` IS inside one must make the claim.
 *   9.  CROSS-REF — every `doors[]` id exists in spec/door-register.json, every
 *       `cases[]` id exists in conformance/MANIFEST.json. The three registers
 *       have to agree or none of them is a denominator.
 *   10. ROUND TRIP, RE-DERIVED — a rule's `roundTrip` verdict is re-derived from
 *       the committed conformance/CANVAS-BASELINE.json rather than believed. A
 *       rule whose cases are absent from the baseline MUST say `untested`, and
 *       `untested` is a first-class verdict: `margin` has exactly ONE case in
 *       the 94-case kit and it already fails. Pretending otherwise would be the
 *       self-attestation this tree keeps re-learning not to do.
 *   11. RECEIPT PATHS + DOC — a rule claiming a receipt names the literal that
 *       proves the path in its own file; every id appears in spec/LOWERING.md
 *       and the doc's pinned count matches.
 *
 *   npx tsx scripts/lowering-check.ts
 *   npx tsx scripts/lowering-check.ts --self-test   # planted reds
 *
 * WHAT THIS CHECK MUST NOT DO: change what the engine lowers. Naming, not
 * carrying — the same discipline as scripts/door-register-check.ts. Every
 * `proposed` rule in the register is a decision the owner still has to take.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTER = path.join(REPO, 'spec/lowering.json');
const DOC = path.join(REPO, 'spec/LOWERING.md');
const DOORS = path.join(REPO, 'spec/door-register.json');
const MANIFEST = path.join(REPO, 'conformance/MANIFEST.json');
const BASELINE = path.join(REPO, 'conformance/CANVAS-BASELINE.json');

export interface Inverse {
  file: string;
  ruleLine: number;
  emits: string;
  asymmetric?: boolean;
  note?: string;
}
export interface Rule {
  id: string;
  family: string;
  stage: string;
  status: 'implemented' | 'proposed' | 'wall';
  file: string;
  /** the `// @lower <id>` marker line — `implemented` rules only */
  line?: number;
  /** the DECIDING line: the `if`, the ternary, the assignment that chooses */
  ruleLine: number;
  /** that line's source text, trimmed — so a moved rule is detectable even
   *  where no marker can be planted */
  ruleText: string;
  /** why the marker cannot sit at the rule (a serialized in-page template
   *  literal). VERIFIED by this gate, not taken on trust. */
  markerOutsideRule?: string;
  css: { construct: string; context: string };
  figma: { construct: string; note?: string };
  inverse: Inverse | 'none';
  lost: string[];
  canonical: string;
  receipt: { channel: string; marker?: string };
  roundTrip: 'round-tripped' | 'named' | 'silent' | 'refused' | 'untested';
  cases: string[];
  doors: string[];
  why: string;
}
export interface LoweringRegister {
  $comment: string;
  version: number;
  markerConvention: string;
  rules: Rule[];
}

/** The stage prefix an id must carry, and the one file that stage lives in.
 *  A stage is a place a lowering decision can be made; adding one is a
 *  decision, so the map is explicit rather than derived from whatever files
 *  happen to exist.
 *
 *  `emit` is the entry the door register does not have. It is the whole reason
 *  this file exists: `core/emit-figma-script.ts` carries no `@door` marker on
 *  any of its 8,230 lines, so `// @lower` is the first machine-checked
 *  annotation the forward lowering has ever had. */
export const LOWER_STAGE_FILES: Record<string, string> = {
  anatomy: 'extract/computed/anatomy.ts',
  css: 'packages/core/src/css.ts',
  emit: 'core/emit-figma-script.ts',
  fuse: 'extract/computed/fuse.ts',
  propose: 'core/propose-figma.ts',
  schema: 'packages/schema/src/contract-schema.ts',
};

const MARKER_RE = /^\s*\/\/ @lower ([^\s]+)\s*$/;
const ID_RE = /^[a-z0-9]+\.[a-z0-9-]+$/;
const STATUSES = new Set(['implemented', 'proposed', 'wall']);
const ROUND_TRIPS = new Set(['round-tripped', 'named', 'silent', 'refused', 'untested']);
/** One family per (construct, context) group. `grid` is half the layout kit on
 *  its own, so it gets its own family rather than being folded into `size`. */
const FAMILIES = new Set([
  'align',
  'axis',
  'display',
  'gap',
  'grid',
  'margin',
  'order',
  'overlap',
  'padding',
  'placement',
  'position',
  'repeat',
  'size',
  'slot',
  'state',
  'svg',
  'wrap',
]);

export interface Finding {
  ok: boolean;
  label: string;
}

/**
 * Which lines of a TypeScript source sit inside the TEXT of a template
 * literal — i.e. lines where a `// @lower` comment would be emitted as
 * generated plugin-runtime text rather than read as a comment.
 *
 * Code inside a `${ }` interpolation is ORDINARY code and is NOT counted: a
 * marker can legitimately live there. The scanner tracks line comments, block
 * comments, both quote styles, regex literals (via the standard
 * previous-significant-token heuristic) and `${}` nesting, because a stray
 * backtick inside any of those would otherwise desync the whole file.
 */
export function templateTextLines(text: string): Set<number> {
  const out = new Set<number>();
  // stack of 'template' frames; we are in template TEXT when the top frame is
  // a template and we are not inside its interpolation.
  let line = 1;
  let i = 0;
  const n = text.length;
  let inLineComment = false;
  let inBlockComment = false;
  let quote: "'" | '"' | null = null;
  // Each entry: depth of `{` seen since entering an interpolation. A template
  // frame with `interp === null` means we are in its text.
  const tmpl: Array<{ interp: number | null }> = [];
  let prevSig = '';
  const inTemplateText = () => tmpl.length > 0 && tmpl[tmpl.length - 1].interp === null;

  // a `/` starts a regex when the previous significant character cannot end an
  // expression. Conservative and standard.
  const regexAllowedAfter = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', 'return', 'typeof', 'case', 'in', 'of']);

  const markLine = () => {
    if (inTemplateText()) out.add(line);
  };
  markLine();

  while (i < n) {
    const c = text[i];
    const c2 = text[i + 1];
    if (c === '\n') {
      line++;
      inLineComment = false;
      i++;
      markLine();
      continue;
    }
    if (inLineComment) {
      i++;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && c2 === '/') {
        inBlockComment = false;
        i += 2;
      } else i++;
      continue;
    }
    if (quote) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (inTemplateText()) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '$' && c2 === '{') {
        tmpl[tmpl.length - 1].interp = 0;
        i += 2;
        continue;
      }
      if (c === '`') {
        tmpl.pop();
        i++;
        continue;
      }
      i++;
      continue;
    }
    // ---- ordinary code ----
    if (c === '/' && c2 === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (c === '/' && c2 === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (c === '/' && regexAllowedAfter.has(prevSig)) {
      // consume a regex literal
      i++;
      let cls = false;
      while (i < n) {
        const r = text[i];
        if (r === '\\') {
          i += 2;
          continue;
        }
        if (r === '\n') break; // unterminated — bail, treat as division
        if (r === '[') cls = true;
        else if (r === ']') cls = false;
        else if (r === '/' && !cls) {
          i++;
          break;
        }
        i++;
      }
      prevSig = 'x';
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      i++;
      prevSig = 'x';
      continue;
    }
    if (c === '`') {
      tmpl.push({ interp: null });
      i++;
      prevSig = '';
      continue;
    }
    if (c === '{' && tmpl.length > 0 && tmpl[tmpl.length - 1].interp !== null) {
      tmpl[tmpl.length - 1].interp!++;
    } else if (c === '}' && tmpl.length > 0 && tmpl[tmpl.length - 1].interp !== null) {
      if (tmpl[tmpl.length - 1].interp === 0) {
        tmpl[tmpl.length - 1].interp = null; // back into template text
        i++;
        prevSig = 'x';
        continue;
      }
      tmpl[tmpl.length - 1].interp!--;
    }
    if (!/\s/.test(c)) {
      // keep word tokens whole enough for the regex heuristic
      if (/[A-Za-z_$]/.test(c)) {
        let j = i;
        while (j < n && /[A-Za-z0-9_$]/.test(text[j])) j++;
        prevSig = text.slice(i, j);
        i = j;
        continue;
      }
      prevSig = c;
    }
    i++;
  }
  return out;
}

/** Every check except the doc and the corpus cross-references — pure over
 *  (register, file texts), so the self-test can feed it broken inputs. */
export function auditRules(
  reg: LoweringRegister,
  read: (file: string) => string | null,
  doorIds: Set<string>,
  caseIds: Set<string>,
  baseline: Record<string, { classification: string }>,
): Finding[] {
  const out: Finding[] = [];
  const bad = (label: string) => out.push({ ok: false, label });
  const ok = (label: string) => out.push({ ok: true, label });

  // ---- 2. SHAPE ----
  const ids = reg.rules.map((r) => r.id);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dupes.length > 0) bad(`duplicate rule id(s): ${[...new Set(dupes)].join(', ')}`);
  else ok(`${ids.length} rule ids are unique`);

  const sorted = [...ids].sort();
  if (JSON.stringify(ids) !== JSON.stringify(sorted)) {
    const at = ids.findIndex((v, i) => v !== sorted[i]);
    bad(`the register is not sorted by id — first divergence at index ${at}: ${ids[at]} where ${sorted[at]} was expected`);
  } else ok('the register is sorted by id (byte-stable diffs)');

  const idBad = reg.rules.filter((r) => !ID_RE.test(r.id));
  if (idBad.length > 0) bad(`${idBad.length} id(s) are not lowercase-kebab with a stage prefix: ${idBad.slice(0, 4).map((r) => r.id).join(', ')}`);
  else ok('every id is lowercase-kebab with a stage prefix');

  const stageBad = reg.rules.filter((r) => r.id.split('.')[0] !== r.stage || LOWER_STAGE_FILES[r.stage] !== r.file);
  if (stageBad.length > 0) {
    bad(`${stageBad.length} rule(s) name a stage or file their id prefix does not own: ${stageBad.slice(0, 4).map((r) => `${r.id} -> ${r.stage}/${r.file}`).join('; ')}`);
  } else ok(`every id's stage prefix agrees with its stage and file (${Object.keys(LOWER_STAGE_FILES).length} stages, including \`emit\` — the stage the door register does not have)`);

  const statusBad = reg.rules.filter((r) => !STATUSES.has(r.status));
  if (statusBad.length > 0) bad(`${statusBad.length} rule(s) carry a status outside implemented/proposed/wall`);
  else ok('every rule is classified implemented, proposed or wall');

  const famBad = reg.rules.filter((r) => !FAMILIES.has(r.family));
  if (famBad.length > 0) bad(`${famBad.length} rule(s) carry a family outside the vocabulary: ${famBad.slice(0, 4).map((r) => `${r.id} -> ${r.family}`).join('; ')}`);
  else ok(`every rule names one of the ${FAMILIES.size} families`);

  const proseBad = reg.rules.filter((r) => !r.css?.construct || !r.css?.context || !r.figma?.construct || !r.why || !r.ruleText);
  if (proseBad.length > 0) {
    bad(`${proseBad.length} rule(s) are missing a construct, a context predicate, a produced Figma construct, a defence or the cited line's text — a lowering with no stated context cannot be reviewed: ${proseBad.slice(0, 4).map((r) => r.id).join(', ')}`);
  } else ok('every rule states the CSS construct, the context it fires in, what Figma construct it produces, and why');

  // ---- 3. CANONICAL ----
  const noCanon = reg.rules.filter((r) => !r.canonical || r.canonical.trim() === '');
  if (noCanon.length > 0) {
    bad(`${noCanon.length} rule(s) declare no canonical form: ${noCanon.slice(0, 5).map((r) => r.id).join(', ')} — a lowering with no fixed-point form is a behaviour, not a specification`);
  } else ok(`all ${reg.rules.length} rules declare a canonical form (the shape both directions must converge on)`);

  // ---- 4. FIXED POINT ----
  const broken: string[] = [];
  let symmetric = 0;
  let declaredAsym = 0;
  for (const r of reg.rules) {
    if (r.status !== 'implemented' || r.inverse === 'none') continue;
    const inv = r.inverse;
    if (inv.emits === r.canonical) {
      symmetric++;
      continue;
    }
    if (inv.asymmetric === true && r.lost.length > 0) {
      declaredAsym++;
      continue;
    }
    broken.push(`${r.id} (forward -> \`${r.figma.construct}\`, inverse emits \`${inv.emits}\`, canonical is \`${r.canonical}\`${inv.asymmetric ? ' — declared asymmetric but names no loss' : ' — claims symmetry'})`);
  }
  if (broken.length > 0) {
    bad(`${broken.length} implemented rule(s) do NOT return their canonical form through the inverse: ${broken.slice(0, 4).join('; ')} — a rule that changes spelling on the way back and calls itself symmetric is how a round trip grows structure every pass`);
  } else {
    ok(`every implemented rule with an inverse returns its canonical form (${symmetric} symmetric, ${declaredAsym} declared asymmetric with the loss named)`);
  }

  // ---- 5 + 6. DISCOVERY and COMPLETENESS ----
  const registered = new Map(reg.rules.map((r) => [r.id, r]));
  const foundInCode = new Map<string, Array<{ file: string; line: number }>>();
  const texts = new Map<string, string>();
  let unreadable = 0;
  for (const file of new Set(Object.values(LOWER_STAGE_FILES))) {
    const text = read(file);
    if (text === null) {
      unreadable++;
      continue;
    }
    texts.set(file, text);
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = MARKER_RE.exec(lines[i]);
      if (!m) continue;
      if (!foundInCode.has(m[1])) foundInCode.set(m[1], []);
      foundInCode.get(m[1])!.push({ file, line: i + 1 });
    }
  }
  if (unreadable > 0) bad(`${unreadable} covered lowering file(s) could not be read — the discovery sweep is not a denominator`);

  const undeclared = [...foundInCode.keys()].filter((id) => !registered.has(id));
  if (undeclared.length > 0) {
    bad(`${undeclared.length} @lower marker(s) exist in code but NOT in spec/lowering.json: ${undeclared.slice(0, 6).join(', ')} — a lowering decision that is not written down is not reviewable`);
  } else ok(`every one of the ${foundInCode.size} @lower markers in code is registered`);

  const impl = reg.rules.filter((r) => r.status === 'implemented');
  const unmarked = impl.filter((r) => !foundInCode.has(r.id));
  if (unmarked.length > 0) {
    bad(`${unmarked.length} implemented rule(s) have NO @lower marker in code: ${unmarked.slice(0, 6).map((r) => r.id).join(', ')} — the register has drifted off the rule it describes`);
  } else ok(`every one of the ${impl.length} implemented rules is marked at (or above) its rule`);

  const noLine = impl.filter((r) => typeof r.line !== 'number');
  if (noLine.length > 0) bad(`${noLine.length} implemented rule(s) record no marker line: ${noLine.slice(0, 4).map((r) => r.id).join(', ')}`);
  else ok('every implemented rule records the line its marker sits on');

  const misplaced = impl.filter((r) => {
    const hits = foundInCode.get(r.id);
    if (!hits) return false;
    return !hits.some((h) => h.file === r.file && h.line === r.line);
  });
  if (misplaced.length > 0) {
    bad(`${misplaced.length} rule(s) record a line the marker is not on: ${misplaced.slice(0, 5).map((r) => `${r.id} (register says ${r.file}:${r.line}, marker at ${foundInCode.get(r.id)!.map((h) => h.line).join('/')})`).join('; ')}`);
  } else ok('every recorded marker line matches where its marker actually sits');

  const unbuilt = reg.rules.filter((r) => r.status !== 'implemented');
  const ghostMarked = unbuilt.filter((r) => foundInCode.has(r.id) || typeof r.line === 'number');
  if (ghostMarked.length > 0) {
    bad(`${ghostMarked.length} proposed/wall rule(s) carry a marker or a marker line: ${ghostMarked.slice(0, 4).map((r) => r.id).join(', ')} — a rule nothing implements has nothing to mark, and marking it would let the register claim behaviour the engine does not have`);
  } else ok(`all ${unbuilt.length} proposed/wall rules are unmarked (nothing implemented, nothing claimed)`);

  // ---- 7. SITE PRESENT (implemented AND proposed AND wall) ----
  const movedSite: string[] = [];
  const missingSite: string[] = [];
  for (const r of reg.rules) {
    const text = texts.get(r.file);
    if (text === undefined) continue;
    const lines = text.split('\n');
    if (r.ruleLine < 1 || r.ruleLine > lines.length) {
      missingSite.push(`${r.id} (${r.file}:${r.ruleLine}, file has ${lines.length} lines)`);
      continue;
    }
    if (lines[r.ruleLine - 1].trim() !== r.ruleText) {
      movedSite.push(`${r.id} (${r.file}:${r.ruleLine} reads \`${lines[r.ruleLine - 1].trim().slice(0, 60)}\`, register recorded \`${r.ruleText.slice(0, 60)}\`)`);
    }
  }
  if (missingSite.length > 0) bad(`${missingSite.length} rule(s) cite a line that does not exist: ${missingSite.slice(0, 4).join('; ')}`);
  else ok('every cited rule line exists in its file');
  if (movedSite.length > 0) {
    bad(`${movedSite.length} rule(s) cite a line whose source text has changed: ${movedSite.slice(0, 3).join('; ')} — the rule moved and the register did not follow`);
  } else ok(`every one of the ${reg.rules.length} cited rule lines still reads exactly as the register recorded it`);

  // ---- 8. MARKER PLACEMENT, VERIFIED ----
  //  The door register stamps `markerOutsideRule` on all 27 `propose.*` layout
  //  doors, claiming their rules live inside a serialized in-page function.
  //  That is false for core/propose-figma.ts — its markers sit on ordinary
  //  lines. This gate refuses both halves of that error.
  const tmplLines = new Map<string, Set<number>>();
  for (const [file, text] of texts) tmplLines.set(file, templateTextLines(text));
  const falseClaim: string[] = [];
  const missingClaim: string[] = [];
  const markerInText: string[] = [];
  for (const r of reg.rules) {
    const t = tmplLines.get(r.file);
    if (!t) continue;
    const ruleInText = t.has(r.ruleLine);
    if (r.markerOutsideRule && !ruleInText) {
      falseClaim.push(`${r.id} (${r.file}:${r.ruleLine} is ordinary code, not template text)`);
    }
    if (!r.markerOutsideRule && ruleInText) {
      missingClaim.push(`${r.id} (${r.file}:${r.ruleLine} IS inside a template literal)`);
    }
    if (typeof r.line === 'number' && t.has(r.line)) {
      markerInText.push(`${r.id} (marker at ${r.file}:${r.line} would be emitted as generated runtime text)`);
    }
  }
  if (falseClaim.length > 0) {
    bad(`${falseClaim.length} rule(s) claim markerOutsideRule but their rule is NOT inside a template literal: ${falseClaim.slice(0, 4).join('; ')} — this is the exact data error spec/door-register.json carries on all 27 propose.* layout doors, and it is refused here`);
  } else ok('every markerOutsideRule claim is true — the rule really is inside a serialized in-page template literal');
  if (missingClaim.length > 0) {
    bad(`${missingClaim.length} rule(s) sit inside a template literal but make no markerOutsideRule claim: ${missingClaim.slice(0, 4).join('; ')}`);
  } else ok('every rule inside a template literal says so');
  if (markerInText.length > 0) {
    bad(`${markerInText.length} marker(s) are planted inside template TEXT: ${markerInText.slice(0, 4).join('; ')} — a marker there is generated plugin-runtime text, not a comment`);
  } else ok('no marker is planted inside generated runtime text');

  // ---- 9. CROSS-REF ----
  const ghostDoors: string[] = [];
  for (const r of reg.rules) for (const d of r.doors) if (!doorIds.has(d)) ghostDoors.push(`${r.id} -> ${d}`);
  if (ghostDoors.length > 0) bad(`${ghostDoors.length} door cross-reference(s) name a door spec/door-register.json does not carry: ${ghostDoors.slice(0, 5).join('; ')}`);
  else ok(`every door cross-reference resolves against the ${doorIds.size}-door register`);

  const ghostCases: string[] = [];
  for (const r of reg.rules) for (const c of r.cases) if (!caseIds.has(c)) ghostCases.push(`${r.id} -> ${c}`);
  if (ghostCases.length > 0) bad(`${ghostCases.length} conformance cross-reference(s) name a case conformance/MANIFEST.json does not carry: ${ghostCases.slice(0, 5).join('; ')}`);
  else ok(`every conformance cross-reference resolves against the ${caseIds.size}-case kit`);

  // ---- 10. ROUND TRIP, RE-DERIVED FROM THE COMMITTED BASELINE ----
  const RANK: Record<string, number> = { 'ROUND-TRIPPED': 0, NAMED: 1, 'REFUSED-BY-NAME': 2, SILENT: 3, DRIFTED: 3, HARMFUL: 3 };
  const OF: Record<string, Rule['roundTrip']> = {
    'ROUND-TRIPPED': 'round-tripped',
    NAMED: 'named',
    'REFUSED-BY-NAME': 'refused',
    SILENT: 'silent',
    DRIFTED: 'silent',
    HARMFUL: 'silent',
  };
  const rtBad: string[] = [];
  const tallies: Record<string, number> = {};
  for (const r of reg.rules) {
    const measured = r.cases.map((c) => baseline[c]?.classification).filter((x): x is string => typeof x === 'string');
    // the WORST verdict across the rule's cases is the rule's verdict: a rule
    // one of whose cases goes silent has not round-tripped.
    let derived: Rule['roundTrip'] = 'untested';
    if (measured.length > 0) {
      const worst = measured.reduce((a, b) => ((RANK[b] ?? 3) > (RANK[a] ?? 3) ? b : a));
      derived = OF[worst] ?? 'untested';
    }
    tallies[derived] = (tallies[derived] ?? 0) + 1;
    if (!ROUND_TRIPS.has(r.roundTrip)) rtBad.push(`${r.id} carries a roundTrip verdict outside the vocabulary (${r.roundTrip})`);
    else if (r.roundTrip !== derived) rtBad.push(`${r.id} claims \`${r.roundTrip}\`; the committed canvas baseline measures \`${derived}\` over ${measured.length === 0 ? 'no case at all' : r.cases.join(', ')}`);
  }
  if (rtBad.length > 0) {
    bad(`${rtBad.length} rule(s) claim a round-trip verdict the committed conformance/CANVAS-BASELINE.json does not support: ${rtBad.slice(0, 4).join('; ')} — a verdict this register reports must be re-derivable, never self-attested`);
  } else {
    ok(`every round-trip verdict re-derives from the committed canvas baseline (${Object.entries(tallies).sort().map(([k, v]) => `${v} ${k}`).join(', ')})`);
  }
  const untested = reg.rules.filter((r) => r.roundTrip === 'untested');
  if (untested.length === 0) {
    bad('ZERO rules are recorded untested — the 94-case kit carries exactly ONE margin case and it already fails, so a register claiming every rule is exercised has stopped being honest about its own coverage');
  } else {
    ok(`${untested.length} of ${reg.rules.length} rules are UNTESTED by the conformance kit — named, not papered over`);
  }

  // ---- 11. RECEIPT PATHS ----
  const claimsReceipt = reg.rules.filter((r) => r.receipt.channel !== 'none');
  const noMarker = claimsReceipt.filter((r) => !r.receipt.marker);
  if (noMarker.length > 0) bad(`${noMarker.length} rule(s) claim a receipt channel but name no receipt marker to prove it`);
  else ok(`${claimsReceipt.length} rule(s) claiming a receipt name the literal that proves the path`);

  const brokenPath: string[] = [];
  for (const r of claimsReceipt) {
    if (!r.receipt.marker) continue;
    const text = texts.get(r.file);
    if (text === undefined) continue;
    if (!text.includes(r.receipt.marker)) brokenPath.push(`${r.id} (claims \`${r.receipt.marker}\` in ${r.file})`);
  }
  if (brokenPath.length > 0) {
    bad(`${brokenPath.length} rule(s) claim to receipt but no receipt path exists in their file: ${brokenPath.slice(0, 5).join('; ')} — a register that claims honesty it does not have is worse than one that admits silence`);
  } else ok("every claimed receipt path exists in the rule's own file");

  const silent = reg.rules.filter((r) => r.receipt.channel === 'none');
  if (silent.length === 0) {
    bad('ZERO lowerings are recorded as silent — either every lowering now receipts (then say so deliberately) or the register stopped being honest about the ones that do not');
  } else ok(`${silent.length} of ${reg.rules.length} lowerings fire with no receipt at all — named, not hidden`);

  return out;
}

// ---------------------------------------------------------------------------

const readRepo = (file: string): string | null => {
  const abs = path.join(REPO, file);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
};

function loadDoorIds(): Set<string> {
  if (!existsSync(DOORS)) return new Set();
  const d = JSON.parse(readFileSync(DOORS, 'utf8')) as { doors: Array<{ id: string }> };
  return new Set(d.doors.map((x) => x.id));
}
function loadCaseIds(): Set<string> {
  if (!existsSync(MANIFEST)) return new Set();
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8')) as { cases: Array<{ id: string }> };
  return new Set(m.cases.map((c) => c.id));
}
function loadBaseline(): Record<string, { classification: string }> {
  if (!existsSync(BASELINE)) return {};
  const b = JSON.parse(readFileSync(BASELINE, 'utf8')) as { cases: Record<string, { classification: string }> };
  return b.cases;
}

/** Deliberately broken registers, so the gate is proved able to go red. */
function selfTest(): number {
  const real = JSON.parse(readFileSync(REGISTER, 'utf8')) as LoweringRegister;
  const doorIds = loadDoorIds();
  const caseIds = loadCaseIds();
  const baseline = loadBaseline();
  const files = new Map<string, string>();
  for (const f of new Set(Object.values(LOWER_STAGE_FILES))) files.set(f, readFileSync(path.join(REPO, f), 'utf8'));
  const read = (f: string) => files.get(f) ?? null;
  const clone = (): LoweringRegister => JSON.parse(JSON.stringify(real)) as LoweringRegister;
  const anImpl = (reg: LoweringRegister) => reg.rules.find((r) => r.status === 'implemented')!;
  const anImplWithInverse = (reg: LoweringRegister) => reg.rules.find((r) => r.status === 'implemented' && r.inverse !== 'none')!;

  const cases: Array<{ name: string; build: () => { reg: LoweringRegister; read: (f: string) => string | null }; expect: RegExp }> = [
    {
      name: 'a @lower marker in code with no register entry is REFUSED',
      build: () => {
        const reg = clone();
        const victim = anImpl(reg).id;
        reg.rules = reg.rules.filter((r) => r.id !== victim);
        return { reg, read };
      },
      expect: /exist in code but NOT in spec\/lowering\.json/,
    },
    {
      name: 'an implemented rule with no marker in code is REFUSED',
      build: () => {
        const reg = clone();
        reg.rules.push({ ...anImpl(reg), id: 'emit.a-lowering-that-is-not-in-the-code' });
        reg.rules.sort((a, b) => (a.id < b.id ? -1 : 1));
        return { reg, read };
      },
      expect: /have NO @lower marker in code/,
    },
    {
      name: 'a register line that is not where the marker sits is REFUSED',
      build: () => {
        const reg = clone();
        anImpl(reg).line = 1;
        return { reg, read };
      },
      expect: /record a line the marker is not on/,
    },
    {
      name: 'a rule whose cited rule line has MOVED (text no longer matches) is REFUSED',
      build: () => {
        const reg = clone();
        reg.rules[0].ruleText = 'a line that this file has never contained';
        return { reg, read };
      },
      expect: /cite a line whose source text has changed/,
    },
    {
      name: 'a rule citing a line past the end of its file is REFUSED',
      build: () => {
        const reg = clone();
        reg.rules[0].ruleLine = 999999;
        return { reg, read };
      },
      expect: /cite a line that does not exist/,
    },
    {
      name: 'a rule with NO canonical form is REFUSED',
      build: () => {
        const reg = clone();
        reg.rules[0].canonical = '';
        return { reg, read };
      },
      expect: /declare no canonical form/,
    },
    {
      name: 'an implemented rule whose inverse does not return the canonical form is REFUSED',
      build: () => {
        const reg = clone();
        const r = anImplWithInverse(reg);
        r.inverse = { ...(r.inverse as Inverse), emits: 'something that is not the canonical form', asymmetric: false };
        return { reg, read };
      },
      expect: /do NOT return their canonical form through the inverse/,
    },
    {
      name: 'a rule declaring asymmetry but naming no loss is REFUSED',
      build: () => {
        const reg = clone();
        const r = anImplWithInverse(reg);
        r.inverse = { ...(r.inverse as Inverse), emits: 'a different spelling', asymmetric: true };
        r.lost = [];
        return { reg, read };
      },
      expect: /do NOT return their canonical form through the inverse/,
    },
    {
      name: 'a FALSE markerOutsideRule claim is REFUSED (the defect spec/door-register.json ships)',
      build: () => {
        const reg = clone();
        const r = reg.rules.find((x) => !x.markerOutsideRule)!;
        r.markerOutsideRule = 'the rule lives inside a serialized in-page function';
        return { reg, read };
      },
      expect: /claim markerOutsideRule but their rule is NOT inside a template literal/,
    },
    {
      name: 'a rule inside a template literal that does NOT claim markerOutsideRule is REFUSED',
      build: () => {
        const reg = clone();
        const r = reg.rules.find((x) => x.markerOutsideRule)!;
        delete r.markerOutsideRule;
        return { reg, read };
      },
      expect: /sit inside a template literal but make no markerOutsideRule claim/,
    },
    {
      name: 'a proposed rule that carries a marker line is REFUSED',
      build: () => {
        const reg = clone();
        reg.rules.find((r) => r.status !== 'implemented')!.line = 10;
        return { reg, read };
      },
      expect: /carry a marker or a marker line/,
    },
    {
      name: 'a round-trip verdict the committed canvas baseline does not support is REFUSED',
      build: () => {
        const reg = clone();
        reg.rules.find((r) => r.roundTrip === 'untested')!.roundTrip = 'round-tripped';
        return { reg, read };
      },
      expect: /claim a round-trip verdict the committed conformance\/CANVAS-BASELINE\.json does not support/,
    },
    {
      name: 'a register in which NOTHING is untested is REFUSED',
      build: () => {
        const reg = clone();
        for (const r of reg.rules) if (r.roundTrip === 'untested') r.cases = [];
        // …and silence the re-derivation red so only the honesty red can fire
        for (const r of reg.rules) r.roundTrip = r.cases.length === 0 ? 'round-tripped' : r.roundTrip;
        return { reg, read };
      },
      expect: /ZERO rules are recorded untested/,
    },
    {
      name: 'a ghost door cross-reference is REFUSED',
      build: () => {
        const reg = clone();
        reg.rules[0].doors = ['fuse.a-door-that-does-not-exist'];
        return { reg, read };
      },
      expect: /name a door spec\/door-register\.json does not carry/,
    },
    {
      name: 'a ghost conformance cross-reference is REFUSED',
      build: () => {
        const reg = clone();
        reg.rules[0].cases = ['a-conformance-case-that-does-not-exist'];
        return { reg, read };
      },
      expect: /name a case conformance\/MANIFEST\.json does not carry/,
    },
    {
      name: 'a rule claiming a receipt whose receipt path does not exist is REFUSED',
      build: () => {
        const reg = clone();
        reg.rules[0].receipt = { channel: 'emit-facts', marker: 'a-receipt-prefix-nothing-emits:' };
        return { reg, read };
      },
      expect: /claim to receipt but no receipt path exists/,
    },
    {
      name: 'a rule claiming a receipt channel but naming no marker is REFUSED',
      build: () => {
        const reg = clone();
        reg.rules[0].receipt = { channel: 'emit-facts' };
        return { reg, read };
      },
      expect: /name no receipt marker/,
    },
    {
      name: 'a register that claims every lowering receipts is REFUSED',
      build: () => {
        const reg = clone();
        for (const r of reg.rules) if (r.receipt.channel === 'none') r.receipt = { channel: 'emit-facts', marker: 'facts.push' };
        return { reg, read };
      },
      expect: /ZERO lowerings are recorded as silent/,
    },
    {
      name: 'an unsorted register is REFUSED',
      build: () => {
        const reg = clone();
        [reg.rules[0], reg.rules[1]] = [reg.rules[1], reg.rules[0]];
        return { reg, read };
      },
      expect: /is not sorted by id/,
    },
    {
      name: 'a duplicate rule id is REFUSED',
      build: () => {
        const reg = clone();
        reg.rules.splice(1, 0, { ...reg.rules[0] });
        return { reg, read };
      },
      expect: /duplicate rule id/,
    },
    {
      name: 'an id whose stage prefix does not own its file is REFUSED',
      build: () => {
        const reg = clone();
        reg.rules[0].file = 'extract/computed/fuse.ts';
        return { reg, read };
      },
      expect: /name a stage or file their id prefix does not own/,
    },
    {
      name: 'a rule with no stated context predicate is REFUSED',
      build: () => {
        const reg = clone();
        reg.rules[0].css.context = '';
        return { reg, read };
      },
      expect: /missing a construct, a context predicate/,
    },
    {
      name: 'a rule outside the family vocabulary is REFUSED',
      build: () => {
        const reg = clone();
        reg.rules[0].family = 'vibes';
        return { reg, read };
      },
      expect: /carry a family outside the vocabulary/,
    },
    {
      name: 'an unreadable covered file is REFUSED (the sweep is not a denominator)',
      build: () => ({ reg: clone(), read: (f: string) => (f === 'core/emit-figma-script.ts' ? null : (files.get(f) ?? null)) }),
      expect: /could not be read/,
    },
  ];

  console.log('\nSELF-TEST — the gate is proved able to go red');
  let failures = 0;
  for (const c of cases) {
    const { reg, read: r } = c.build();
    const findings = auditRules(reg, r, doorIds, caseIds, baseline);
    const reds = findings.filter((f) => !f.ok).map((f) => f.label);
    const hit = reds.some((l) => c.expect.test(l));
    console.log(`  ${hit ? '✔' : '✖'} ${c.name}`);
    if (!hit) {
      failures++;
      console.log(`      expected a red matching ${c.expect}; got: ${reds.length === 0 ? '(all green — the gate did NOT refuse)' : reds.slice(0, 3).join(' | ')}`);
    }
  }
  const clean = auditRules(real, read, doorIds, caseIds, baseline).filter((f) => !f.ok);
  if (clean.length > 0) {
    failures++;
    console.log(`  ✖ the committed register itself is red, so the red cases above prove nothing:\n      ${clean.map((f) => f.label).join('\n      ')}`);
  } else console.log('  ✔ the committed register is green (so the red cases above are the gate, not noise)');
  return failures;
}

// ---------------------------------------------------------------------------

function main(): void {
const selfTestOnly = process.argv.includes('--self-test');
let failures = 0;

console.log('THE LOWERING REGISTER — spec/lowering.json vs the code it describes');

if (!existsSync(REGISTER)) {
  console.error(`  ✖ ${REGISTER} does not exist`);
  process.exit(1);
}
const raw = readFileSync(REGISTER, 'utf8');
const reg = JSON.parse(raw) as LoweringRegister;

console.log('\n1. the register is byte-stable');
{
  const round = JSON.stringify(reg, null, 2) + '\n';
  if (round !== raw) {
    console.log('  ✖ spec/lowering.json is not byte-stable — re-serializing produces different bytes (key order, indentation or trailing newline). A register whose diffs are noise does not get read.');
    failures++;
  } else console.log(`  ✔ ${raw.length.toLocaleString('en-US')} bytes round-trip exactly`);
}

console.log('\n2. the register and the code agree');
for (const f of auditRules(reg, readRepo, loadDoorIds(), loadCaseIds(), loadBaseline())) {
  console.log(`  ${f.ok ? '✔' : '✖'} ${f.label}`);
  if (!f.ok) failures++;
}

console.log('\n3. the doc names the same rules as the register');
{
  if (!existsSync(DOC)) {
    console.log('  ✖ spec/LOWERING.md does not exist');
    failures++;
  } else {
    const doc = readFileSync(DOC, 'utf8');
    const missing = reg.rules.filter((r) => !doc.includes(r.id));
    if (missing.length > 0) {
      console.log(`  ✖ ${missing.length} registered rule(s) are absent from spec/LOWERING.md: ${missing.slice(0, 5).map((r) => r.id).join(', ')}`);
      failures++;
    } else console.log(`  ✔ all ${reg.rules.length} rules appear in spec/LOWERING.md`);
    const claimed = /\*\*(\d+)\*\* lowering rules/.exec(doc);
    if (!claimed) {
      console.log('  ✖ spec/LOWERING.md does not state a rule count in the pinned form (**N** lowering rules)');
      failures++;
    } else if (Number(claimed[1]) !== reg.rules.length) {
      console.log(`  ✖ spec/LOWERING.md claims ${claimed[1]} lowering rules; the register carries ${reg.rules.length}`);
      failures++;
    } else console.log(`  ✔ the doc's stated count (${claimed[1]}) matches the register`);
  }
}

console.log('\n4. what the register says, by family and status');
{
  const fam = new Map<string, Record<string, number>>();
  for (const r of reg.rules) {
    if (!fam.has(r.family)) fam.set(r.family, {});
    const row = fam.get(r.family)!;
    row[r.status] = (row[r.status] ?? 0) + 1;
  }
  const w = Math.max(...[...fam.keys()].map((k) => k.length));
  console.log(`    ${'family'.padEnd(w)}  implemented  proposed  wall`);
  for (const k of [...fam.keys()].sort()) {
    const row = fam.get(k)!;
    console.log(`    ${k.padEnd(w)}  ${String(row.implemented ?? 0).padStart(11)}  ${String(row.proposed ?? 0).padStart(8)}  ${String(row.wall ?? 0).padStart(4)}`);
  }
  const byStage = new Map<string, number>();
  for (const r of reg.rules) byStage.set(r.stage, (byStage.get(r.stage) ?? 0) + 1);
  console.log(`\n    by stage: ${[...byStage.entries()].sort().map(([k, v]) => `${k} ${v}`).join(', ')}`);
}

if (selfTestOnly || process.env.LOWERING_SELF_TEST === '1') failures += selfTest();

console.log('');
if (failures > 0) {
  console.error(`✖ lowering register: ${failures} failure(s)`);
  process.exit(1);
}
console.log(
  `✔ lowering register: ${reg.rules.length} lowering rules named, contexted and given a canonical form; ` +
    `${reg.rules.filter((r) => r.status === 'implemented').length} implemented and marked at their site, ` +
    `${reg.rules.filter((r) => r.status === 'proposed').length} proposed, ` +
    `${reg.rules.filter((r) => r.status === 'wall').length} named walls; ` +
    `${reg.rules.filter((r) => r.receipt.channel === 'none').length} still silent, ` +
    `${reg.rules.filter((r) => r.roundTrip === 'untested').length} untested by the conformance kit.`,
);
}

// Run only when invoked directly, so the pure halves above (auditRules,
// templateTextLines) can be imported by a test without the gate firing.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
