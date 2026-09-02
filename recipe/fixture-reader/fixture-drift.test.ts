/**
 * FIXTURE DRIFT GATE — `npm run recipe:fixture-drift:check` (docs/35 Phase 1–2).
 *
 * For every reader subject (13 archetypes × astryx/mui/antd), every
 * numeric/color/typography fact in the reviewed fixture tables must EQUAL the
 * capture-ledger value or carry a NAMED receipt.
 *
 * FAIL CLOSED. Byte-freshness of out/* is `--check` on build-reader-artifacts.ts.
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
const results = Object.values(all).flat();

test("every fixture fact equals the ledger or carries a named receipt (fail closed)", () => {
  const verdict = judge(results, ledger);
  assert.deepEqual(verdict.unread, [], `unreadable mappings:\n${verdict.unread.join("\n")}`);
  assert.deepEqual(verdict.badCause, [], verdict.badCause.join("\n"));
  assert.deepEqual(verdict.unexplained, [], `UNEXPLAINED DRIFT:\n${verdict.unexplained.join("\n")}`);
  assert.deepEqual(verdict.stale, [], `STALE reviewed-drift rows:\n${verdict.stale.join("\n")}`);
});

test("the thirteen archetypes cover astryx/mui/antd (39 reviewed subjects) plus the proposed chakra and shadcn checkboxes and the proposed MUI, shadcn and Chakra switches and the five proposed avatars three proposed tooltips, four proposed chips, two proposed links, two proposed tabs and the Chakra held-outs and the radio/textarea/alert/badge/menu proposals (77) with a non-zero denominator", () => {
  assert.equal(results.length, 77);
  const proposed = results.filter((r) => r.library === "chakra" || r.library === "chakra-field");
  assert.equal(proposed.length, 11, "eleven Chakra subjects, all proposed (checkbox, switch, avatar, chip, link, tooltip, radio, textarea, textarea-field, alert, menu)");
  assert.equal(proposed[0]!.rows.filter((x) => x.verdict === "drift").length, 0, "a proposal reads back with zero drift by construction");
  for (const r of results) {
    assert.ok(r.rows.length >= 11, `${r.archetype}/${r.library}: only ${r.rows.length} facts`);
    const receipts = r.rows.filter((x) => x.verdict === "receipt");
    for (const row of receipts) {
      assert.ok(row.receipt && row.receipt.length > 20, `${r.library} ${row.path}: receipt too thin to review`);
      assert.ok(row.evidence && row.evidence.length > 5, `${r.library} ${row.path}: receipt has no evidence`);
    }
  }
});

test("FALSIFICATION: a planted fixture perturbation is an UNEXPLAINED drift, not a silent pass", () => {
  const subject = results.find((r) => r.archetype === "checkbox" && r.library === "antd")!;
  const planted: SubjectResult = structuredClone(subject);
  const row = planted.rows.find((x) => x.path === "box.radius")!;
  assert.equal(row.verdict, "match", "precondition: box.radius currently matches");
  row.verdict = "drift";
  row.fixtureValue = 5;
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
    cause: "antd-indeterminate-dash-lowering",
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
  const muiCb = results.find((r) => r.archetype === "checkbox" && r.library === "mui")!;
  const tick = muiCb.rows.find((x) => x.path === "check.path")!;
  assert.equal(tick.verdict, "match");
  assert.ok(tick.ledgerKeys!.length > 0);
  const antdCb = results.find((r) => r.archetype === "checkbox" && r.library === "antd")!;
  for (const p of ["check.width", "check.height"]) {
    assert.equal(antdCb.rows.find((x) => x.path === p)!.verdict, "match", p);
  }
  const dash = antdCb.rows.find((x) => x.path === "dash.height")!;
  assert.equal(dash.verdict, "drift");
  assert.ok(ledger.rows.some((r) => r.subject === "checkbox/antd" && r.path === "dash.height"));
  const muiTa = results.find((r) => r.archetype === "textarea" && r.library === "mui")!;
  const ink = muiTa.rows.find((x) => x.path === "states.empty.enabled.value")!;
  assert.equal(ink.verdict, "match");
  assert.match(ink.formula!, /rest.*hides|hides the placeholder/i);
  for (const p of ["labelFloatingOffsetY", "floatingLabelFontSize"]) {
    assert.equal(muiTa.rows.find((x) => x.path === p)!.verdict, "match", p);
  }
});

test("Astryx is verified against the mount its fixtures describe — never silent adoption of #262626", () => {
  // This guarded the RIGHT property through the WRONG mechanism. It asserted
  // that >=34 Astryx rows carried a `capture-theme-unavailable` excuse, which
  // made an excuse mandatory: the more Astryx facts went unverified, the more
  // firmly the test passed. The excuse itself was correct — astryx.json mounts
  // <Theme theme={neutralTheme}> (the library's README quick start) while
  // recipe/fixtures/library-*.ts transcribe un-themed @astryxdesign/core
  // defaults, so every Astryx fact was being compared against a different mount
  // of the same library and none could ever match.
  //
  // astryx-core.json captures the core-only surface. All 56 rows became
  // mechanical matches (reader: 477/57 -> 531/1). The property worth protecting
  // is unchanged and is now asserted directly: the fixtures still carry the
  // branded surface, and no blanket theme excuse has crept back.
  const themeExcuses = ledger.rows.filter(
    (r) => r.cause === "capture-theme-unavailable",
  );
  assert.equal(
    themeExcuses.length,
    0,
    "a theme excuse is back — capture the mount the fixture describes instead",
  );

  // Astryx subjects must read the core-only ledgers, not the themed ones.
  const astryx = results.filter((r) => r.library === "astryx" && r.ledgerFile);
  assert.ok(astryx.length > 0, "expected Astryx subjects with ledgers");
  for (const r of astryx) {
    assert.match(
      r.ledgerFile!,
      /out\/astryx-core\//,
      `${r.archetype}/astryx reads ${r.ledgerFile} — Astryx fixtures describe the un-themed core surface`,
    );
  }

  // And the branded accent is still the reviewed truth, not neutralTheme grey.
  const branded = results.filter((r) => r.library === "astryx");
  const hexes = branded.flatMap((r) =>
    r.rows
      .map((x) => String(x.fixtureValue))
      .filter((v) => /^#[0-9a-f]{6,8}$/i.test(v)),
  );
  assert.ok(hexes.length > 0, "expected Astryx colour facts");
  assert.equal(
    hexes.some((h) => /^#262626/i.test(h)),
    false,
    "neutralTheme grey #262626 has been adopted into an Astryx fixture",
  );
  assert.ok(
    hexes.some((h) => /^#0064e0/i.test(h)),
    "Astryx fixtures should still carry the branded #0064E0",
  );
});
