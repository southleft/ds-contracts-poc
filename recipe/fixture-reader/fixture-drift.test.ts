/**
 * FIXTURE DRIFT GATE — `npm run recipe:fixture-drift:check` (docs/35 Phase 1).
 *
 * For Checkbox and Textarea, every numeric/color/typography fact in the
 * reviewed fixture tables (recipe/fixtures/library-checkboxes.ts /
 * library-textareas.ts) must EQUAL the capture-ledger value (Chromium
 * computed style of the real npm package, extract/computed/out/**) or carry
 * a NAMED receipt:
 *
 *   · mapping receipts — facts the ledger cannot express (no part mounted,
 *     SVG viewBox, reviewed pairings) live in the mapping tables;
 *   · reviewed drift — facts the ledger DOES express and the table differs
 *     on live in recipe/fixture-reader/reviewed-drift.json with exact values
 *     and a resolvable cause.
 *
 * FAIL CLOSED: an unexplained drift, an unreadable mapping, an uncovered
 * fixture leaf (enforced inside runMappings), a stale reviewed-drift row
 * (the drift healed or its values moved) and an unresolvable cause are all
 * red. The falsification halves plant each of those and expect the refusal.
 *
 * Byte-freshness of the committed artifacts (out/*.json, DRIFT-REPORT.md) is
 * the `--check` half of build-reader-artifacts.ts, which the npm script runs
 * before this file.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll, type SubjectResult } from "./build-reader-artifacts.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

interface LedgerRow {
  subject: string;
  path: string;
  fixture: number | string;
  captured: number | string;
  cause: string;
}
interface DriftLedger {
  _marker: string;
  reviewedAt: string;
  causes: Record<string, string>;
  rows: LedgerRow[];
}

const ledger = JSON.parse(
  readFileSync(path.join(HERE, "reviewed-drift.json"), "utf8"),
) as DriftLedger;

/** The gate's verdict, shared by the live test and the falsification halves. */
function judge(
  results: SubjectResult[],
  drift: DriftLedger,
): { unexplained: string[]; stale: string[]; unread: string[]; badCause: string[] } {
  const unexplained: string[] = [];
  const stale: string[] = [];
  const unread: string[] = [];
  const badCause: string[] = [];
  const liveDrift = new Map<string, { fixture: unknown; captured: unknown }>();
  for (const r of results) {
    for (const row of r.rows) {
      if (row.verdict === "unread") {
        unread.push(`${r.archetype}/${r.library} ${row.path}: ${row.error}`);
      }
      if (row.verdict === "drift") {
        liveDrift.set(`${r.archetype}/${r.library}|${row.path}`, {
          fixture: row.fixtureValue,
          captured: row.capturedValue,
        });
      }
    }
  }
  const carried = new Set<string>();
  for (const row of drift.rows) {
    const key = `${row.subject}|${row.path}`;
    carried.add(key);
    if (!(row.cause in drift.causes)) {
      badCause.push(`${key}: cause "${row.cause}" is not in the ledger's causes`);
    }
    const live = liveDrift.get(key);
    if (!live) {
      stale.push(`${key}: carried as drift but the live run shows no drift (healed or renamed — re-review the ledger row)`);
      continue;
    }
    if (live.fixture !== row.fixture || live.captured !== row.captured) {
      stale.push(
        `${key}: carried values (${String(row.fixture)} → ${String(row.captured)}) moved (live ${String(live.fixture)} → ${String(live.captured)})`,
      );
    }
  }
  for (const [key, v] of liveDrift) {
    if (!carried.has(key)) {
      unexplained.push(`${key}: fixture ${String(v.fixture)} vs captured ${String(v.captured)} — UNEXPLAINED drift`);
    }
  }
  return { unexplained, stale, unread, badCause };
}

const all = buildAll();
const results = [...all.checkbox, ...all.textarea];

test("every fixture fact equals the ledger or carries a named receipt (fail closed)", () => {
  const verdict = judge(results, ledger);
  assert.deepEqual(verdict.unread, [], `unreadable mappings:\n${verdict.unread.join("\n")}`);
  assert.deepEqual(verdict.badCause, [], verdict.badCause.join("\n"));
  assert.deepEqual(verdict.unexplained, [], `UNEXPLAINED DRIFT (add nothing silently — either the table is wrong, the mapping is wrong, or the drift is real and must be reviewed into reviewed-drift.json):\n${verdict.unexplained.join("\n")}`);
  assert.deepEqual(verdict.stale, [], `STALE reviewed-drift rows:\n${verdict.stale.join("\n")}`);
});

test("the six subjects cover checkbox and textarea across astryx/mui/antd with a non-zero denominator", () => {
  assert.equal(results.length, 6);
  for (const r of results) {
    assert.ok(r.rows.length >= 39, `${r.archetype}/${r.library}: only ${r.rows.length} facts`);
    const receipts = r.rows.filter((x) => x.verdict === "receipt");
    for (const row of receipts) {
      assert.ok(row.receipt && row.receipt.length > 20, `${r.library} ${row.path}: receipt too thin to review`);
      assert.ok(row.evidence && row.evidence.length > 5, `${r.library} ${row.path}: receipt has no evidence`);
    }
  }
});

test("FALSIFICATION: a planted fixture perturbation is an UNEXPLAINED drift, not a silent pass", () => {
  // Clone one subject's rows and flip a matched fact to a wrong value the way
  // a bad transcription would; the judge must name it.
  const subject = results.find((r) => r.archetype === "checkbox" && r.library === "antd")!;
  const planted: SubjectResult = structuredClone(subject);
  const row = planted.rows.find((x) => x.path === "box.radius")!;
  assert.equal(row.verdict, "match", "precondition: box.radius currently matches");
  row.verdict = "drift";
  row.fixtureValue = 5; // the invented value
  const verdict = judge([planted], ledger);
  assert.equal(verdict.unexplained.length, 1);
  assert.match(verdict.unexplained[0], /checkbox\/antd\|box\.radius/);
});

test("FALSIFICATION: a reviewed-drift row whose drift healed is STALE, not silently carried", () => {
  const plantedLedger: DriftLedger = structuredClone(ledger);
  plantedLedger.rows.push({
    subject: "checkbox/mui",
    path: "box.size",
    fixture: 24,
    captured: 25,
    cause: "astryx-theme-mount",
  });
  const verdict = judge(results, plantedLedger);
  assert.equal(verdict.stale.length, 1);
  assert.match(verdict.stale[0], /checkbox\/mui\|box\.size/);
});

test("FALSIFICATION: a reviewed-drift row with an unregistered cause refuses", () => {
  const plantedLedger: DriftLedger = structuredClone(ledger);
  plantedLedger.rows = [{ ...plantedLedger.rows[0], cause: "no-such-cause" }];
  const verdict = judge(results, plantedLedger);
  assert.equal(verdict.badCause.length, 1);
});

test("the reader catches the owner-caught miss classes mechanically (the five-misses check, checkbox/textarea half)", () => {
  // 1 · MUI even-odd tick: check.path is MAPPED (structural path equality),
  //     not a receipt — a missing/mangled glyph can never pass silently again.
  const muiCb = results.find((r) => r.archetype === "checkbox" && r.library === "mui")!;
  const tick = muiCb.rows.find((x) => x.path === "check.path")!;
  assert.equal(tick.verdict, "match");
  assert.ok(tick.ledgerKeys!.length > 0);
  // 2 · AntD baked check: the rotated L geometry is DERIVED from the ledger
  //     (legs minus stroke over √2), so an un-baked `>` would drift.
  const antdCb = results.find((r) => r.archetype === "checkbox" && r.library === "antd")!;
  for (const p of ["check.width", "check.height"]) {
    assert.equal(antdCb.rows.find((x) => x.path === p)!.verdict, "match", p);
  }
  // 3 · AntD dash: the 8×2-vs-8×8 lowering is VISIBLE drift carried by name,
  //     never a silent respelling.
  const dash = antdCb.rows.find((x) => x.path === "dash.height")!;
  assert.equal(dash.verdict, "drift");
  assert.ok(ledger.rows.some((r) => r.subject === "checkbox/antd" && r.path === "dash.height"));
  // 4 · MUI rest-empty placeholder: the empty.enabled ink derives from the
  //     FOCUS plane because rest hides it — the formula names the teaching.
  const muiTa = results.find((r) => r.archetype === "textarea" && r.library === "mui")!;
  const ink = muiTa.rows.find((x) => x.path === "states.empty.enabled.value")!;
  assert.equal(ink.verdict, "match");
  assert.match(ink.formula!, /rest.*hides|hides the placeholder/i);
  // 5 · MUI Content=focus shrink: the floating plane (offset −9, size ×0.75)
  //     is read from the value-combo label transform.
  for (const p of ["labelFloatingOffsetY", "floatingLabelFontSize"]) {
    assert.equal(muiTa.rows.find((x) => x.path === p)!.verdict, "match", p);
  }
});
