/** Additional declared-family evidence. The historical V1 fixture remains unchanged. */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  QUALIFICATION,
  REPO,
  SOURCE_HARNESS,
  assertScorerPins,
  buildScorecard,
  ratchetProblems,
  verifyBytes,
  type KnownFile,
  type Scorecard,
} from "./react-native-fidelity-check.js";
import type { DeclaredManifest } from "./react-native-declared-record.js";

export const DECLARED_EVIDENCE = "recipe/evidence/react-native-declared-family";
// A reviewed denominator; the manifest cannot drop an unsuccessful member.
export const DECLARED_COVERAGE = {
  "family-switch": { measured: 9, notMeasured: 0 },
  "family-alert": { measured: 1, notMeasured: 0 },
  "family-badge": { measured: 1, notMeasured: 0 },
};
export function renderDeclaredReport(
  manifest: DeclaredManifest,
  scorecard: Scorecard,
): string {
  const out = [
    "# Declared React family → native Figma",
    "",
    "Generated from committed, authenticated source/native pairs. Measured, not graded; acceptedContract remains null. Regenerate with `npm run react:native:declared:check -- --write-derived`.",
    "",
    "The unchanged 5% fidelity bar uses the existing historical ink-trim score. Aligned scores require recorded origins and integer translation; a refusal stays visible. Glyph masking is diagnostic. No threshold or scorer has changed.",
    "",
    "The scorer has a known low-contrast blind spot: a white Switch thumb on a light track can move without raising its tolerant pixel score. These numbers alone do not qualify thumb placement or interaction. The live application and native geometry require separate inspection.",
    "",
    "| cohort | variant | verdict | historical % | exact % | aligned % or refusal | glyph-masked % | typography |",
    "| --- | --- | --- | ---: | ---: | --- | --- | --- |",
  ];
  for (const row of scorecard.rows)
    out.push(
      `| ${row.cohort} | ${row.variant} | ${row.verdict} | ${row.historical.pct.toFixed(3)} | ${row.historical.exactPct.toFixed(3)} | ${row.aligned.pct === null ? row.aligned.refused : row.aligned.pct.toFixed(3)} | ${row.glyphMasked.textOnlyCell ? "text-only" : (row.glyphMasked.pct?.toFixed(3) ?? "unavailable")} | ${row.typography} |`,
    );
  for (const cohort of manifest.cohorts)
    out.push(
      "",
      `## ${cohort.id}`,
      "",
      cohort.description,
      "",
      `Source reference: \`${cohort.source.referenceId}\`. Native operation: \`${cohort.native.operationId}\`. Read event: \`${cohort.native.journalEvent}\` (\`${cohort.native.journalEventSha256}\`).`,
      "",
      "The recorder verifies the complete journal hash chain, correlated read-only result, unchanged plan revision, sealed source inventory and exact source/native pairing before writing any output. The check recomputes scores from the committed image bytes; it does not contact Figma or claim current canvas state.",
    );
  return `${out.join("\n")}\n`;
}
export function checkDeclaredEvidence(
  dir: string,
  writeDerived = false,
): Scorecard {
  const manifest = JSON.parse(
    readFileSync(path.join(dir, "manifest.json"), "utf8"),
  ) as DeclaredManifest;
  const known = JSON.parse(
    readFileSync(path.join(dir, "KNOWN-FAILURES.json"), "utf8"),
  ) as KnownFile;
  if (
    manifest.artifactVersion !== "react-native-declared-fidelity-v1" ||
    manifest.qualification !== QUALIFICATION ||
    manifest.acceptedContract !== null ||
    JSON.stringify(manifest.harness) !== JSON.stringify(SOURCE_HARNESS)
  )
    throw new Error("declared-manifest-invalid");
  if (
    new Set(manifest.cohorts.map((c) => c.id)).size !== manifest.cohorts.length
  )
    throw new Error("duplicate-cohort");
  assertScorerPins();
  verifyBytes(dir, manifest, DECLARED_COVERAGE);
  const scorecard = buildScorecard(dir, manifest, known),
    report = renderDeclaredReport(manifest, scorecard);
  const scoreBytes = `${JSON.stringify(scorecard, null, 2)}\n`;
  if (writeDerived) {
    writeFileSync(path.join(dir, "SCORECARD.json"), scoreBytes);
    writeFileSync(path.join(dir, "REPORT.md"), report);
  }
  if (
    readFileSync(path.join(dir, "SCORECARD.json"), "utf8") !== scoreBytes ||
    readFileSync(path.join(dir, "REPORT.md"), "utf8") !== report
  )
    throw new Error("declared-derived-stale");
  const problems = ratchetProblems(scorecard, known);
  if (problems.length)
    throw new Error(`declared-fidelity-red:\n${problems.join("\n")}`);
  return scorecard;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const scorecard = checkDeclaredEvidence(
      path.join(REPO, DECLARED_EVIDENCE),
      process.argv.includes("--write-derived"),
    );
    console.log(
      `Declared family: ${scorecard.rows.length} pairs recomputed; measured, not graded.`,
    );
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
