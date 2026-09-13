/**
 * F1 calendar — the two person steps around the mint, made reproducible.
 *
 *   tsx recipe/fixture-reader/f1-mint.ts --emit
 *     Proposes the calendar@1 instance mechanically from the committed
 *     day-picker ledger (the same call `recipe:f1-held-out:check` pins),
 *     compiles it, and emits the calendar Figma writer for it into
 *     recipe/evidence/f1-held-out-v1/writer.js (+ writer.meta.json with the
 *     recipe/envelope hashes and the page it will mint). Nothing is
 *     hand-authored; the 2026-09-05 mint did exactly this in a scratch script
 *     that was never committed, which is why this file exists.
 *
 *     Mint it (Scratch only, the writer refuses any other file):
 *       node scripts/run-figma-writer.mjs --writer recipe/evidence/f1-held-out-v1/writer.js \
 *         --output private/f1-calendar-<n>.raw.json --from-page "Page 1" --wait-ms 300000
 *
 *   tsx recipe/fixture-reader/f1-mint.ts --score <canvas.png> [--recorded-at YYYY-MM-DD]
 *     Scores an exported PNG of ONE variant (the default State) against the
 *     committed real render with the fidelity scorer (no crops, same as the
 *     2026-09-05 score) and writes score/{canvas.png,scorecard.json,diff.png}.
 *     `npm run recipe:f1:check` then re-derives the number from those bytes.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { emitCalendarFigmaWriter } from "../calendar-figma-writer.js";
import { scoreFidelity } from "../fidelity-score.js";
import { hashRecipeInstance } from "../recipe.js";
import { calendarRecipe, compileCalendarRecipe } from "../recipes/calendar.js";
import { assertNoPolarPropose, proposeCalendarInstanceFromLedger } from "./propose-calendar-instance.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EVIDENCE = path.join(REPO, "recipe", "evidence", "f1-held-out-v1");
const LEDGER = "extract/computed/out/day-picker/calendar/captured-truth.json";
const REFERENCE = "extract/computed/out/day-picker/calendar/orig-shots/label.1__default.png";
const ADAPTER = { adapterIdentity: "day-picker-calendar-f1-v1", displayName: "react-day-picker Calendar (F1 held-out)" } as const;

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : null;
};

function emit(): void {
  const propose = proposeCalendarInstanceFromLedger(REPO, LEDGER);
  assertNoPolarPropose(propose);
  if (!propose.instanceParse.success) throw new Error(`F1 instance does not parse: ${propose.instanceParse.issues.join("; ")}`);
  const instance = propose.instance;
  const envelope = compileCalendarRecipe(instance);
  const recipeHash = hashRecipeInstance(calendarRecipe, instance);
  const writer = emitCalendarFigmaWriter([{ ...ADAPTER, recipeHash, envelope }]);
  mkdirSync(EVIDENCE, { recursive: true });
  writeFileSync(path.join(EVIDENCE, "writer.js"), writer.code);
  const meta = {
    _marker: "Emitted by recipe/fixture-reader/f1-mint.ts --emit from the committed ledger; re-emit after any calendar@1 or propose change. The writer refuses every file but Scratch.",
    ...ADAPTER,
    recipeHash,
    envelopeHash: envelope.integrity.canonicalHash,
    pageName: writer.pageName,
    runIdentity: writer.runIdentity,
    header: instance.header ?? null,
    weekdayPadding: instance.tokens.weekdayPadding?.fallback ?? null,
    carriedFacts: envelope.accounting.carried.length,
    receipts: envelope.receipts.length,
  };
  writeFileSync(path.join(EVIDENCE, "writer.meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`writer → ${path.relative(REPO, path.join(EVIDENCE, "writer.js"))}  page "${writer.pageName}"  recipe ${recipeHash.slice(0, 8)}  envelope ${envelope.integrity.canonicalHash.slice(0, 8)}  header ${JSON.stringify(meta.header)}  weekdayPadding ${String(meta.weekdayPadding)}`);
}

function score(canvasPath: string, recordedAt: string): void {
  const scoreDir = path.join(EVIDENCE, "score");
  mkdirSync(scoreDir, { recursive: true });
  const canvas = path.join(scoreDir, "canvas.png");
  copyFileSync(path.resolve(canvasPath), canvas);
  const card = scoreFidelity(canvas, path.join(REPO, REFERENCE), "calendar/day-picker", path.join(scoreDir, "diff.png"));
  const out = {
    ...card,
    recordedAt,
    canvas: { path: path.relative(REPO, canvas), sha256: card.canvas.sha256 },
    reference: { path: REFERENCE, sha256: card.reference.sha256 },
    diff: path.relative(REPO, path.join(scoreDir, "diff.png")),
  };
  writeFileSync(path.join(scoreDir, "scorecard.json"), `${JSON.stringify(out, null, 1)}\n`);
  const agree = card.thresholdSweep.some((r) => r.agree);
  console.log(`${card.status.toUpperCase()} ${card.metrics.pctAAMasked.toFixed(3)}%  canvas ink ${card.metrics.canvasPx}  real ink ${card.metrics.realPx}  threshold sweep agrees: ${String(agree)}  → ${path.relative(REPO, scoreDir)}/`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes("--emit")) emit();
  else if (arg("score")) score(arg("score")!, arg("recorded-at") ?? new Date().toISOString().slice(0, 10));
  else throw new Error("usage: --emit | --score <canvas.png> [--recorded-at YYYY-MM-DD]");
}
