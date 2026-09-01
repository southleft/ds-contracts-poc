/**
 * FIXTURE READER — artifact builder (docs/35 Phase 1).
 *
 *   npx tsx recipe/fixture-reader/build-reader-artifacts.ts           # write
 *   npx tsx recipe/fixture-reader/build-reader-artifacts.ts --check   # byte-freshness
 *
 * Reads the committed capture ledgers + the committed fixture tables, runs
 * the mapping tables, and writes:
 *
 *   recipe/fixture-reader/out/checkbox.reader.json   per-leaf verdict rows
 *   recipe/fixture-reader/out/textarea.reader.json
 *   recipe/fixture-reader/out/checkbox.proposed-tables.json  proposed reviewed
 *   recipe/fixture-reader/out/textarea.proposed-tables.json  tables + provenance
 *   recipe/fixture-reader/out/DRIFT-REPORT.md        the human review sheet
 *
 * The proposal is REVIEW INPUT, never a silent overwrite: nothing here
 * touches recipe/fixtures/*. Byte-deterministic (no timestamps); `--check`
 * regenerates in memory and refuses on any byte difference, the same
 * freshness pattern as the build-*-live-proof scripts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Ledger } from "./ledger.js";
import { runMappings, tokenLeaves, isReceipt, type FactMapping, type ReaderRow } from "./reader.js";
import {
  muiCheckboxMappings,
  antdCheckboxMappings,
  astryxCheckboxMappings,
  muiCheckPathEqual,
  astryxCheckPathEqual,
  MUI_CHECKBOX_LEDGER,
  ANTD_CHECKBOX_LEDGER,
  ASTRYX_CHECKBOX_LEDGER,
} from "./mappings-checkbox.js";
import {
  muiTextareaMappings,
  antdTextareaMappings,
  astryxTextareaMappings,
  MUI_TEXTAREA_LEDGER,
  ANTD_TEXTAREA_LEDGER,
  ASTRYX_TEXTAREA_LEDGER,
} from "./mappings-textarea.js";
import {
  astryxCheckboxAdapterConfig,
  muiCheckboxAdapterConfig,
  antdCheckboxAdapterConfig,
} from "../fixtures/library-checkboxes.js";
import {
  astryxTextareaAdapterConfig,
  muiTextareaAdapterConfig,
  antdTextareaAdapterConfig,
} from "../fixtures/library-textareas.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(REPO, "recipe", "fixture-reader", "out");
const CHECK = process.argv.includes("--check");

interface Typo {
  requestedFamily: string;
  requestedStyle: string;
}

interface Subject {
  archetype: "checkbox" | "textarea";
  library: "astryx" | "mui" | "antd";
  source: { packageName: string; version: string; exportName: string };
  ledgerFile: string;
  tokens: Record<string, unknown>;
  mappings: FactMapping[];
  /** extra (non-{variable,fallback}) facts appended to the leaves map */
  extras: Map<string, number | string>;
  /** custom equality for facts whose spelling differs mechanically (paths) */
  customEqual?: Record<string, (fixture: string, captured: string) => boolean>;
}

function checkboxExtras(tokens: Record<string, unknown>): Map<string, number | string> {
  const t = tokens as {
    rowAlign: string;
    check: { path: string };
    typography: { label: Typo };
  };
  return new Map<string, number | string>([
    ["rowAlign", t.rowAlign],
    ["check.path", t.check.path],
    ["typography.label.family", t.typography.label.requestedFamily],
    ["typography.label.style", t.typography.label.requestedStyle],
  ]);
}

function textareaExtras(tokens: Record<string, unknown>): Map<string, number | string> {
  const t = tokens as { typography: { label: Typo; value: Typo } };
  return new Map<string, number | string>([
    ["typography.label.family", t.typography.label.requestedFamily],
    ["typography.label.style", t.typography.label.requestedStyle],
    ["typography.value.family", t.typography.value.requestedFamily],
    ["typography.value.style", t.typography.value.requestedStyle],
  ]);
}

const src = (c: { benchmark: { packageName: string; version: string; exportName: string } }) => ({
  packageName: c.benchmark.packageName,
  version: c.benchmark.version,
  exportName: c.benchmark.exportName,
});

const SUBJECTS: Subject[] = [
  {
    archetype: "checkbox",
    library: "astryx",
    source: src(astryxCheckboxAdapterConfig),
    ledgerFile: ASTRYX_CHECKBOX_LEDGER,
    tokens: astryxCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: astryxCheckboxMappings,
    extras: checkboxExtras(astryxCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>),
    customEqual: { "check.path": astryxCheckPathEqual },
  },
  {
    archetype: "checkbox",
    library: "mui",
    source: src(muiCheckboxAdapterConfig),
    ledgerFile: MUI_CHECKBOX_LEDGER,
    tokens: muiCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiCheckboxMappings,
    extras: checkboxExtras(muiCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>),
    customEqual: { "check.path": muiCheckPathEqual },
  },
  {
    archetype: "checkbox",
    library: "antd",
    source: src(antdCheckboxAdapterConfig),
    ledgerFile: ANTD_CHECKBOX_LEDGER,
    tokens: antdCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdCheckboxMappings,
    extras: checkboxExtras(antdCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>),
  },
  {
    archetype: "textarea",
    library: "astryx",
    source: src(astryxTextareaAdapterConfig),
    ledgerFile: ASTRYX_TEXTAREA_LEDGER,
    tokens: astryxTextareaAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: astryxTextareaMappings,
    extras: textareaExtras(astryxTextareaAdapterConfig.tokens as unknown as Record<string, unknown>),
  },
  {
    archetype: "textarea",
    library: "mui",
    source: src(muiTextareaAdapterConfig),
    ledgerFile: MUI_TEXTAREA_LEDGER,
    tokens: muiTextareaAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiTextareaMappings,
    extras: textareaExtras(muiTextareaAdapterConfig.tokens as unknown as Record<string, unknown>),
  },
  {
    archetype: "textarea",
    library: "antd",
    source: src(antdTextareaAdapterConfig),
    ledgerFile: ANTD_TEXTAREA_LEDGER,
    tokens: antdTextareaAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdTextareaMappings,
    extras: textareaExtras(antdTextareaAdapterConfig.tokens as unknown as Record<string, unknown>),
  },
];

export interface SubjectResult {
  archetype: string;
  library: string;
  source: { packageName: string; version: string; exportName: string };
  ledgerFile: string;
  rows: ReaderRow[];
  counts: { match: number; drift: number; receipt: number; unread: number };
}

export function runSubject(s: Subject): SubjectResult {
  const ledger = new Ledger(REPO, s.ledgerFile);
  const leaves = tokenLeaves(s.tokens);
  for (const [k, v] of s.extras) leaves.set(k, v);
  const rows = runMappings(ledger, leaves, s.mappings);
  // custom mechanical equality (path coordinate spaces)
  for (const row of rows) {
    const eq = s.customEqual?.[row.path];
    if (eq && row.verdict === "drift" && typeof row.fixtureValue === "string" && typeof row.capturedValue === "string") {
      if (eq(row.fixtureValue, row.capturedValue)) {
        row.verdict = "match";
        row.proposedValue = row.fixtureValue;
      }
    }
  }
  const counts = { match: 0, drift: 0, receipt: 0, unread: 0 };
  for (const r of rows) counts[r.verdict]++;
  return {
    archetype: s.archetype,
    library: s.library,
    source: s.source,
    ledgerFile: s.ledgerFile,
    rows,
    counts,
  };
}

export function buildAll(): { checkbox: SubjectResult[]; textarea: SubjectResult[] } {
  const results = SUBJECTS.map(runSubject);
  return {
    checkbox: results.filter((r) => r.archetype === "checkbox"),
    textarea: results.filter((r) => r.archetype === "textarea"),
  };
}

function proposedTables(results: SubjectResult[]): unknown {
  return results.map((r) => ({
    library: r.library,
    archetype: r.archetype,
    source: r.source,
    ledger: r.ledgerFile,
    note:
      "PROPOSED reviewed table — review input for a Phase-2 fixture update + remint. Every `proposed` value is either the fixture value (verdict match/receipt, carried) or the CAPTURED value (verdict drift). Nothing overwrites recipe/fixtures/* without review.",
    values: Object.fromEntries(
      r.rows.map((row) => [
        row.path,
        {
          fixture: row.fixtureValue,
          proposed: row.proposedValue,
          verdict: row.verdict,
          ...(row.capturedValue !== undefined ? { captured: row.capturedValue } : {}),
          provenance: row.ledgerKeys
            ? row.ledgerKeys.join(" ; ") + (row.formula ? ` — ${row.formula}` : "")
            : `RECEIPT: ${row.receipt} [${row.evidence}]`,
          ...(row.tolerance ? { tolerance: row.tolerance, toleranceReason: row.toleranceReason } : {}),
        },
      ]),
    ),
  }));
}

function driftReport(all: { checkbox: SubjectResult[]; textarea: SubjectResult[] }): string {
  const L: string[] = [];
  L.push("# Fixture drift report — the reader vs the reviewed tables");
  L.push("");
  L.push(
    "> Generated by `recipe/fixture-reader/build-reader-artifacts.ts` from the committed capture ledgers (`extract/computed/out/**/captured-truth.json` — Chromium computed style of the real npm packages) against the committed fixture tables (`recipe/fixtures/library-checkboxes.ts` / `library-textareas.ts`). No Figma writes. `overallSuccess` stays false. Product v1 remains INCOMPLETE.",
  );
  L.push(">");
  L.push(
    "> **drift** rows propose the CAPTURED value; adoption + remint is Phase 2 (docs/35 §4) and stays a reviewed act. Drift rows are carried by name in `recipe/fixture-reader/reviewed-drift.json`; an UN-carried drift fails `recipe:fixture-drift:check` closed.",
  );
  L.push("");
  for (const [name, results] of [
    ["Checkbox", all.checkbox],
    ["Textarea", all.textarea],
  ] as const) {
    L.push(`## ${name}`);
    L.push("");
    for (const r of results) {
      L.push(
        `### ${r.library} — ${r.source.packageName}@${r.source.version}#${r.source.exportName}`,
      );
      L.push("");
      L.push(
        `ledger \`${r.ledgerFile}\` · ${r.rows.length} facts: **${r.counts.match} match**, **${r.counts.drift} drift**, ${r.counts.receipt} named receipts, ${r.counts.unread} unread`,
      );
      L.push("");
      const drifts = r.rows.filter((x) => x.verdict === "drift" || x.verdict === "unread");
      if (drifts.length === 0) {
        L.push("No drift — every mapped fact equals the ledger value.");
      } else {
        L.push("| fact | fixture | captured | ledger key |");
        L.push("|---|---|---|---|");
        for (const d of drifts) {
          L.push(
            `| \`${d.path}\` | \`${String(d.fixtureValue)}\` | \`${String(d.capturedValue ?? `UNREAD: ${d.error}`)}\` | ${d.ledgerKeys?.map((k) => `\`${k}\``).join("<br>") ?? ""} |`,
          );
        }
      }
      L.push("");
    }
  }
  L.push("## Receipts (facts the ledger cannot express)");
  L.push("");
  for (const results of [all.checkbox, all.textarea]) {
    for (const r of results) {
      for (const row of r.rows.filter((x) => x.verdict === "receipt")) {
        L.push(`- **${r.archetype}/${r.library}** \`${row.path}\` = \`${String(row.fixtureValue)}\` — ${row.receipt} _[${row.evidence}]_`);
      }
    }
  }
  L.push("");
  return L.join("\n");
}

function stringify(v: unknown): string {
  return JSON.stringify(v, null, 2) + "\n";
}

function main(): void {
  const all = buildAll();
  const files: Record<string, string> = {
    "checkbox.reader.json": stringify(all.checkbox),
    "textarea.reader.json": stringify(all.textarea),
    "checkbox.proposed-tables.json": stringify(proposedTables(all.checkbox)),
    "textarea.proposed-tables.json": stringify(proposedTables(all.textarea)),
    "DRIFT-REPORT.md": driftReport(all),
  };
  if (CHECK) {
    const stale: string[] = [];
    for (const [name, contents] of Object.entries(files)) {
      const p = path.join(OUT, name);
      if (!existsSync(p) || readFileSync(p, "utf8") !== contents) stale.push(name);
    }
    if (stale.length > 0) {
      console.error(
        `✗ recipe/fixture-reader/out is STALE: ${stale.join(", ")} — regenerate with \`npx tsx recipe/fixture-reader/build-reader-artifacts.ts\``,
      );
      process.exit(1);
    }
    console.log(`✔ recipe/fixture-reader/out is byte-fresh (${Object.keys(files).length} files)`);
    return;
  }
  mkdirSync(OUT, { recursive: true });
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(path.join(OUT, name), contents);
  }
  const totals = { match: 0, drift: 0, receipt: 0, unread: 0 };
  for (const r of [...all.checkbox, ...all.textarea]) {
    totals.match += r.counts.match;
    totals.drift += r.counts.drift;
    totals.receipt += r.counts.receipt;
    totals.unread += r.counts.unread;
    console.log(
      `${r.archetype}/${r.library}: ${r.counts.match} match · ${r.counts.drift} drift · ${r.counts.receipt} receipts · ${r.counts.unread} unread`,
    );
  }
  console.log(
    `TOTAL: ${totals.match} match · ${totals.drift} drift · ${totals.receipt} receipts · ${totals.unread} unread → recipe/fixture-reader/out/`,
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
