/**
 * Aggregate headless visual-truth scorecards into a worst-first REPORT.md.
 *
 *   node scripts/visual-truth-report.mjs
 *
 * Reads parity/receipts/console-loop/visual-truth/<lane>/<stem>.json (written
 * by visual-truth-run.mjs), writes …/visual-truth/REPORT.md. Deterministic:
 * ordering is worst-first by the scorecards' own numbers; the only
 * provenance line is generatedFrom (a combined sha256 over the input cards).
 * No token, no network.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scorecardPasses, loadRatchet } from "./console-loop-scorecard-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VT = path.join(ROOT, "parity/receipts/console-loop/visual-truth");
const LANE_ORDER = ["first-party", "mui", "tailwind", "altitude", "astryx", "carbon", "polaris"];

if (!existsSync(VT)) {
  console.error("✖ no visual-truth scorecards yet — run visual-truth:run first");
  process.exit(1);
}

const cards = [];
const inputLines = [];
for (const lane of readdirSync(VT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()) {
  const dir = path.join(VT, lane);
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".json")) continue;
    const p = path.join(dir, f);
    const raw = readFileSync(p);
    inputLines.push(`${lane}/${f} ${createHash("sha256").update(raw).digest("hex")}`);
    try {
      cards.push({ lane, stem: f.slice(0, -5), sc: JSON.parse(raw.toString("utf8")) });
    } catch {
      cards.push({ lane, stem: f.slice(0, -5), sc: null });
    }
  }
}
if (cards.length === 0) {
  console.error("✖ visual-truth dir exists but holds no scorecards");
  process.exit(1);
}

const generatedFrom = createHash("sha256")
  .update(inputLines.sort().join("\n"))
  .digest("hex");

const aaOf = (c) => {
  const v = c.sc?.metrics?.pctAAMasked;
  return typeof v === "number" ? v : null;
};
const fmtAA = (c) => (aaOf(c) === null ? "—" : `${aaOf(c).toFixed(2)}%`);
const statusOf = (c) => {
  if (!c.sc) return "unparseable";
  if (c.sc.status === "skip") return `skip (${c.sc.skipReason ?? "?"})`;
  if (c.sc.status === "error") return "error";
  return scorecardPasses(c.sc) ? "pass" : "fail";
};

// Worst-first: fails by AA desc (composition-only fails and errors treated as
// worst), then passes by AA desc, then skips grouped by reason.
const rank = (c) => {
  const s = statusOf(c);
  if (s === "fail" || s === "error" || s === "unparseable") return 0;
  if (s === "pass") return 1;
  return 2;
};
const sorted = [...cards].sort((x, y) => {
  const r = rank(x) - rank(y);
  if (r !== 0) return r;
  if (rank(x) === 0 || rank(x) === 1) {
    const ax = aaOf(x) ?? Number.MAX_VALUE;
    const ay = aaOf(y) ?? Number.MAX_VALUE;
    if (ay !== ax) return ay - ax;
  }
  return `${x.lane}/${x.stem}`.localeCompare(`${y.lane}/${y.stem}`);
});

const lines = [];
lines.push("# Visual-truth — headless canvas-vs-code scorecard report");
lines.push("");
lines.push(
  "Source: `rest-images-api` (Figma REST renders at scale 1 — like-for-like with the bridge lane's scale-1 cell exports; no desktop app, no plugin bridge), scored under the one bar (`pctAAMasked <= 5` AND `compositionOk`) with the developed-score normalization policy. Written by `scripts/visual-truth-report.mjs`; regenerate with `npm run visual-truth:report`.",
);
lines.push("");
lines.push(`generatedFrom: sha256:${generatedFrom} (${cards.length} scorecards)`);
lines.push("");

// Summary
const tally = { pass: 0, fail: 0, skip: 0, error: 0, unparseable: 0 };
for (const c of cards) {
  const s = statusOf(c);
  tally[s.startsWith("skip") ? "skip" : s] += 1;
}
lines.push("## Summary");
lines.push("");
lines.push(
  `**${tally.pass} pass / ${tally.fail} fail / ${tally.skip} skip / ${tally.error + tally.unparseable} error** across ${cards.length} stems.`,
);
lines.push("");

// Per-lane vs ratchet floors
const { data: ratchet } = loadRatchet(ROOT);
lines.push("## Per-lane pass counts vs RATCHET floors");
lines.push("");
lines.push("| lane | scored | headless pass | ratchet floor | meets floor |");
lines.push("|---|---:|---:|---:|---|");
const lanesPresent = [...new Set(cards.map((c) => c.lane))];
const laneList = LANE_ORDER.filter((l) => lanesPresent.includes(l)).concat(
  lanesPresent.filter((l) => !LANE_ORDER.includes(l)).sort(),
);
for (const lane of laneList) {
  const laneCards = cards.filter((c) => c.lane === lane);
  const scoredCards = laneCards.filter((c) => ["pass", "fail", "error", "unparseable"].includes(statusOf(c)));
  const passed = laneCards.filter((c) => statusOf(c) === "pass").length;
  const floor = ratchet?.floors?.[lane];
  const meets =
    typeof floor !== "number"
      ? "no floor"
      : scoredCards.length === 0
        ? "not scored (all skips)"
        : passed >= floor
          ? "yes"
          : "**NO**";
  lines.push(`| ${lane} | ${scoredCards.length}/${laneCards.length} | ${passed} | ${typeof floor === "number" ? floor : "—"} | ${meets} |`);
}
lines.push("");

// Worst-first table
lines.push("## Worst-first");
lines.push("");
lines.push("| lane | stem | pctAAMasked | compositionOk | status |");
lines.push("|---|---|---:|---|---|");
for (const c of sorted) {
  const comp = c.sc?.compositionOk === undefined ? "—" : String(c.sc.compositionOk);
  lines.push(`| ${c.lane} | ${c.stem} | ${fmtAA(c)} | ${comp} | ${statusOf(c)} |`);
}
lines.push("");

// Skip inventory
const skips = cards.filter((c) => c.sc?.status === "skip");
if (skips.length > 0) {
  lines.push("## Skip inventory");
  lines.push("");
  const byReason = new Map();
  for (const c of skips) {
    const r = c.sc.skipReason ?? "?";
    if (!byReason.has(r)) byReason.set(r, []);
    byReason.get(r).push(`${c.lane}/${c.stem}`);
  }
  for (const [reason, ks] of [...byReason.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`- **${reason}** (${ks.length}): ${ks.sort().join(", ")}`);
  }
  lines.push("");
}

const outPath = path.join(VT, "REPORT.md");
const rendered = `${lines.join("\n")}\n`;

// `--check` — THE REPORT MUST NOT OUTLIVE ITS OWN NUMBERS.
//
// Every figure in REPORT.md is READ from a scorecard: the worst-first table
// prints `sc.metrics.pctAAMasked` verbatim. Nothing re-derived it, and nothing
// compared it to the cards, so it silently rotted — and not in the harmless
// direction. The committed table called `carbon/tag` the worst thing on the
// board at 92.44%, while `visual-truth/carbon/tag.json` reads 2.85%, which is
// INSIDE the 5% bar; `mui/button` was published at 88.31% against a card
// reading 16.92%. Wrong in both directions at once, so a reader could neither
// trust the ranking nor the pass/fail column, and the `generatedFrom:` sha was
// provenance for bytes that no longer existed on disk.
//
// `visual-truth:check` could not have caught this: it verifies the scorecards'
// PNG sha pins and the ratchet floor, and never opens REPORT.md. So the check
// belongs here, in the shape `build-capability-report.mjs --check` already
// uses — render in memory, byte-compare, refuse by name. An aggregator whose
// output is a RANKING is exactly the kind that must be gated on its bytes.
if (process.argv.includes("--check")) {
  const committed = existsSync(outPath) ? readFileSync(outPath, "utf8") : null;
  if (committed === null) {
    console.error(`✖ visual-truth:report --check: ${path.relative(ROOT, outPath)} does not exist — it is a committed artifact; run \`npm run visual-truth:report\``);
    process.exit(1);
  }
  if (committed !== rendered) {
    console.error(
      `✖ STALE: ${path.relative(ROOT, outPath)} does not match a re-render from the committed scorecards.\n` +
        `Every number in it is READ from a scorecard; one of those cards moved (or the report was never re-run).\n` +
        `Rebuild it and commit:  npm run visual-truth:report`,
    );
    process.exit(1);
  }
  console.log(`✔ visual-truth:report --check: ${path.relative(ROOT, outPath)} re-renders byte-identically from ${cards.length} committed scorecard(s)`);
  process.exit(0);
}

writeFileSync(outPath, rendered);
console.log(`visual-truth:report → ${path.relative(ROOT, outPath)} (${cards.length} scorecards)`);
