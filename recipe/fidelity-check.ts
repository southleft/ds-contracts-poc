/**
 * The fidelity gate — does every minted subject still look like its library?
 *
 * OFFLINE by construction. It scores committed canvas shots against committed
 * real-package renders, so it runs in CI with no Figma access and a score is
 * reproducible from the repo alone. Re-exporting the shots is a separate,
 * read-only step (`scripts/export-figma-node.mjs`, driven by
 * `npm run recipe:fidelity:capture`).
 *
 * Subjects live in recipe/fidelity-manifest.json. Adding one is a manifest
 * entry plus a committed shot; there is no per-subject code.
 *
 * A subject may declare `expectFringe`, which does NOT excuse a failure. It
 * says: this subject is expected to fail the AA bar purely because Chromium
 * renders anti-aliasing fringe that Figma does not, and the threshold sweep must
 * PROVE that by showing the two ink boxes converge as the cutoff tightens. If
 * they ever stop converging, the subject fails like any other. An excuse that
 * carries its own falsification is a receipt; one that does not is a hole.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { FIDELITY_BAR, scoreFidelity, type FidelityScorecard } from "./fidelity-score.js";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MANIFEST = path.join(REPO, "recipe/fidelity-manifest.json");
const OUT = path.join(REPO, "recipe/evidence/fidelity-v1/SCORECARD.json");

interface Subject {
  label: string;
  page: string;
  set: string;
  variant: string;
  child?: string;
  shot: string;
  reference: string;
  referenceControlOnly?: boolean;
  canvasControlOnly?: boolean;
  canvasBox?: [number, number, number, number];
  expectFringe?: boolean;
}

export interface FidelityRun {
  artifactVersion: "recipe-fidelity-run-v1";
  bar: typeof FIDELITY_BAR;
  subjects: number;
  passed: number;
  failed: number;
  fringeExcused: number;
  rows: Array<{
    label: string;
    status: "pass" | "fail" | "fringe";
    pctAAMasked: number;
    canvasPx: string;
    realPx: string;
    convergesAt: number | null;
  }>;
}

export function runFidelity(): { run: FidelityRun; cards: FidelityScorecard[] } {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { subjects: Subject[] };
  const cards: FidelityScorecard[] = [];
  const rows: FidelityRun["rows"] = [];

  for (const s of manifest.subjects) {
    for (const p of [s.shot, s.reference]) {
      if (!existsSync(path.join(REPO, p))) {
        throw new Error(`${s.label}: missing ${p} — run npm run recipe:fidelity:capture`);
      }
    }
    const card = scoreFidelity(
      path.join(REPO, s.shot),
      path.join(REPO, s.reference),
      s.label,
      path.join(REPO, "recipe/evidence/fidelity-v1", `${s.label.replace("/", "-")}.diff.png`),
      s.referenceControlOnly === true,
      s.canvasControlOnly === true,
      s.canvasBox ?? null,
    );
    cards.push(card);

    const converged = card.thresholdSweep.find((r) => r.agree) ?? null;
    const pct = card.metrics.pctAAMasked ?? card.metrics.pctAAUnmasked;
    let status: "pass" | "fail" | "fringe" = card.status;
    if (card.status === "fail" && s.expectFringe) {
      // The excuse only holds if the sweep proves it.
      status = converged ? "fringe" : "fail";
    }
    rows.push({
      label: s.label,
      status,
      pctAAMasked: Math.round(pct * 100) / 100,
      canvasPx: card.metrics.canvasPx,
      realPx: card.metrics.realPx,
      convergesAt: converged ? converged.threshold : null,
    });
  }

  const run: FidelityRun = {
    artifactVersion: "recipe-fidelity-run-v1",
    bar: FIDELITY_BAR,
    subjects: rows.length,
    passed: rows.filter((r) => r.status === "pass").length,
    failed: rows.filter((r) => r.status === "fail").length,
    fringeExcused: rows.filter((r) => r.status === "fringe").length,
    rows,
  };
  return { run, cards };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const { run } = runFidelity();
  writeFileSync(OUT, `${JSON.stringify(run, null, 2)}\n`);
  for (const r of run.rows) {
    const tail =
      r.status === "fringe"
        ? ` — AA fringe only, ink boxes agree at threshold ${r.convergesAt}`
        : "";
    console.log(
      `${r.status.toUpperCase().padEnd(6)} ${r.label.padEnd(20)} ${String(r.pctAAMasked).padStart(6)}%  canvas ${r.canvasPx.padEnd(8)} real ${r.realPx}${tail}`,
    );
  }
  console.log(
    `\n${run.passed} pass · ${run.fringeExcused} fringe · ${run.failed} fail  (bar ${FIDELITY_BAR.pctAAMaskedMax}% AA)`,
  );
  if (run.failed > 0) {
    console.error(`\n✖ recipe:fidelity:check — ${run.failed} subject(s) do not look like their library`);
    process.exit(1);
  }
  console.log("✔ recipe:fidelity:check");
}
