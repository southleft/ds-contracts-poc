#!/usr/bin/env node
/**
 * CANVAS-DRIFT PROBE — is the live cell the product of THIS lane's own
 * committed emit script?
 *
 *   node scripts/console-loop-canvas-drift-probe.mjs <lane> [stem ...] [--json]
 *
 * WHY THIS EXISTS
 * ---------------
 * The lane already owns two instruments that ask about the PAIR:
 *
 *   console-loop-capture-framing-check.mjs  is the committed SHOT the live CELL?
 *   console-loop-reference-audit.mjs        is the REFERENCE the right picture?
 *
 * Neither can ask the question that sits UNDERNEATH both of them: is the live
 * cell what `examples/<lane>/figma/<stem>.figma.js` would build today? A cell
 * generated from an older revision of the script is a perfectly self-consistent
 * pair — right file, right node id, right variant name, committed shot matches
 * the cell exactly — and every downstream number is then measuring a canvas
 * nobody would ship, against a reference nobody disputes. C1 passes. C2 passes.
 * The scorecard is honest. The stem is still wrong.
 *
 * carbon/button is the case that forced this probe. Its receipt attributed
 * pctAAMasked 39.82 to "the harness stage width vs the contract's hug"
 * (FC-ABS-SIZE / FC-WIDTH-TOKEN). The contract does not hug symmetrically at
 * all: Carbon's `.cds--btn` carries 15px left and 63px right padding, both are
 * in examples/carbon/contracts/button.contract.json, both are compiled into
 * examples/carbon/figma/button.figma.js as variable bindings, and neither is on
 * the live node — which sits at a symmetric 16/16 with NO padding binding.
 * 15 + 45 + 63 = 123px against the library's 124px. The residual was never a
 * width-token doctrine conflict; it was a canvas that predates the binding.
 *
 * WHAT IT COMPARES
 * ----------------
 * EXPECTED comes from the committed emit script, parsed offline: the
 * `const COMPONENTS = [...]` payload is JSON, so the pinned cell's `spec` is
 * read directly — no Figma needed, no re-emit needed.
 * OBSERVED comes from a snapshot minted off the Desktop Bridge and committed at
 * parity/receipts/console-loop/<lane>/canvas-drift/LIVE-SNAPSHOT.json. Live
 * facts are NEVER back-derived from the committed PNGs (the same discipline
 * framing.json's C1 keeps) — without a snapshot the probe reports
 * SNAPSHOT-PENDING rather than guessing.
 *
 * Three findings per stem:
 *
 *   BINDING-DRIFT   a field the spec binds that the live node does not bind at
 *                   all (or binds to a different variable name). The canvas
 *                   cannot be this script's output.
 *   VALUE-DRIFT     bound, same name, but the live resolved value differs from
 *                   the token file the script was emitted against.
 *   COLLECTION-DRIFT the binding landed in a collection that is not this lane's
 *                   own. `imported/*` names are not namespaced per library, so
 *                   a multi-library file carries collisions; the emitted runtime
 *                   guards this (FC-THEME-ISO) but a canvas built before the
 *                   guard keeps the wrong variable forever.
 *
 * REPORTING INSTRUMENT, NOT A GATE. It writes nothing and never fails CI —
 * exit 0 always, exactly like console-loop-reference-audit.mjs. Only
 * console-loop-developed-score.mjs may move a pass claim.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CL = path.join(ROOT, "parity/receipts/console-loop");

const asJson = process.argv.includes("--json");
const argv = process.argv.slice(2).filter((a) => a !== "--json");
const lane = argv[0];
if (!lane) {
  console.error(
    "usage: console-loop-canvas-drift-probe.mjs <lane> [stem ...] [--json]",
  );
  process.exit(2);
}
const onlyStems = argv.slice(1);

const laneDir = path.join(CL, lane);
/** CONSOLE_LOOP_DRIFT_SNAPSHOT lets a red-half test point the probe at a
 *  fixture snapshot. It exists so the probe can be proven to READ the snapshot
 *  rather than hardcode this lane's answer — never to relax the real check. */
const snapPath =
  process.env.CONSOLE_LOOP_DRIFT_SNAPSHOT ??
  path.join(laneDir, "canvas-drift/LIVE-SNAPSHOT.json");
const framingPath = path.join(laneDir, "framing.json");

if (!existsSync(framingPath)) {
  console.error(`✖ ${lane}: no framing.json — nothing pins the cells to compare`);
  process.exit(2);
}
const framing = JSON.parse(readFileSync(framingPath, "utf8"));

/** The emitted script's `const COMPONENTS = [...]` payload is plain JSON. */
function readComponents(scriptPath) {
  const src = readFileSync(scriptPath, "utf8");
  const marker = "const COMPONENTS = ";
  const i = src.indexOf(marker);
  if (i < 0) return null;
  const j = src.indexOf("\n];", i);
  if (j < 0) return null;
  try {
    return JSON.parse(src.slice(i + marker.length, j + 2));
  } catch {
    return null;
  }
}

/** stem → examples/<lane>/figma/<file>.figma.js (the emitted names are
 *  kebab-case; the contract basenames are not, so try both spellings). */
function scriptFor(stem) {
  const dir = path.join(ROOT, "examples", lane, "figma");
  for (const cand of [stem, stem.replace(/-/g, "")]) {
    const p = path.join(dir, `${cand}.figma.js`);
    if (existsSync(p)) return p;
  }
  return null;
}

/** The variant whose name the framing pin records. The emitted base variant is
 *  spelled WITHOUT the State axis ("Kind=Primary, Size=Xs"); the canvas cell
 *  gains ", State=Default" when the contract compiles state previews. Match on
 *  the state-stripped name, and fall back to the sole variant for a
 *  standalone component. */
function pickVariant(component, cellName) {
  const variants = component.variants ?? [];
  const strip = (s) =>
    String(s)
      .split(",")
      .map((p) => p.trim())
      .filter((p) => !/^State=/i.test(p))
      .join(", ");
  const want = strip(cellName);
  const hit = variants.find((v) => strip(v.name) === want);
  if (hit) return hit;
  const stateHit = (component.stateVariants ?? []).find(
    (v) => String(v.name) === String(cellName),
  );
  if (stateHit) return stateHit;
  if (variants.length === 1) return variants[0];
  return null;
}

const laneCollection = {
  carbon: "Carbon",
  altitude: "Altitude",
  astryx: "Astryx",
  tailwind: "Tailwind",
  polaris: "Polaris",
  mui: "MUI",
}[lane];

const snapshot = existsSync(snapPath)
  ? JSON.parse(readFileSync(snapPath, "utf8"))
  : null;

const stems = Object.keys(framing.stems ?? {})
  .filter((s) => !onlyStems.length || onlyStems.includes(s))
  .sort();

const results = [];
for (const stem of stems) {
  const pin = framing.stems[stem];
  const row = { stem, cellNodeId: pin.cellNodeId, cellName: pin.cellName, findings: [], notes: [] };

  /** A lane whose C1 is unasserted (framing.json records no cellNodeId/cellName
   *  — MUI, where the bridge never reached the file) has nothing to compare:
   *  the probe needs the LIVE cell identity, and inventing one from the shot is
   *  exactly the move C1 exists to forbid. */
  if (!pin.cellNodeId || !pin.cellName) {
    row.status = "CELL-PENDING";
    row.note =
      "framing.json records no live cellNodeId/cellName for this stem (C1 unasserted) — there is no pinned cell to compare the emit script against";
    results.push(row);
    continue;
  }

  const scriptPath = scriptFor(stem);
  if (!scriptPath) {
    row.status = "NO-SCRIPT";
    row.note = `no examples/${lane}/figma/${stem}.figma.js — this stem has no committed emit script to compare against`;
    results.push(row);
    continue;
  }
  row.script = path.relative(ROOT, scriptPath);
  const components = readComponents(scriptPath);
  const component = components && components[0];
  if (!component) {
    row.status = "UNPARSEABLE-SCRIPT";
    results.push(row);
    continue;
  }
  const variant = pickVariant(component, pin.cellName);
  if (!variant) {
    row.status = "NO-MATCHING-VARIANT";
    row.note = `framing pin names cell "${pin.cellName}" but the script emits no variant with that name (state-stripped)`;
    results.push(row);
    continue;
  }
  const spec = variant.spec ?? {};
  row.variant = variant.name;
  row.expected = {
    bindings: Object.keys(spec.bindings ?? {}).sort(),
    fixedWidth: spec.fixedWidth?.px ?? null,
    fixedHeight: spec.fixedHeight?.px ?? null,
  };

  const observed = snapshot?.stems?.[stem];
  if (!observed) {
    row.status = "SNAPSHOT-PENDING";
    row.note = snapshot
      ? `no entry for ${stem} in ${path.relative(ROOT, snapPath)}`
      : `no ${path.relative(ROOT, snapPath)} — live cell facts must be minted off the bridge, never back-derived from the committed PNG`;
    results.push(row);
    continue;
  }
  if (observed.cellNodeId && observed.cellNodeId !== pin.cellNodeId) {
    row.findings.push(
      `SNAPSHOT-MISMATCH: snapshot records ${observed.cellNodeId} but framing.json pins ${pin.cellNodeId}`,
    );
  }

  const liveBound = observed.bound ?? {};
  for (const [field, wantVar] of Object.entries(spec.bindings ?? {})) {
    const wantName = String(wantVar).replace(/^\//, "");
    const got = liveBound[field];
    if (!got) {
      row.findings.push(
        `BINDING-DRIFT: spec binds ${field} -> ${wantName}; the live cell binds ${field} to NOTHING (literal ${observed[shortField(field)] ?? "?"})`,
      );
      continue;
    }
    if (got.name && got.name !== wantName) {
      row.findings.push(
        `BINDING-DRIFT: spec binds ${field} -> ${wantName}; the live cell binds ${field} -> ${got.name}`,
      );
    }
    if (laneCollection && got.coll && got.coll !== laneCollection) {
      row.findings.push(
        `COLLECTION-DRIFT: ${field} -> ${got.name} resolved in collection "${got.coll}", not "${laneCollection}"` +
          (got.carbonValue !== undefined
            ? ` (live ${got.val} vs this lane's ${got.carbonValue})`
            : ""),
      );
    }
  }
  for (const [key, got] of Object.entries(observed.descendantBound ?? {})) {
    if (laneCollection && got.coll && got.coll !== laneCollection) {
      row.findings.push(
        `COLLECTION-DRIFT: ${key} -> ${got.name} resolved in collection "${got.coll}", not "${laneCollection}"`,
      );
    }
  }
  if (spec.fixedWidth && Math.abs(spec.fixedWidth.px - observed.w) > 0.5) {
    row.findings.push(
      `VALUE-DRIFT: spec fixes width at ${spec.fixedWidth.px} (${spec.fixedWidth.varName}); the live cell is ${observed.w}`,
    );
  }
  if (spec.fixedHeight && Math.abs(spec.fixedHeight.px - observed.h) > 0.5) {
    row.findings.push(
      `VALUE-DRIFT: spec fixes height at ${spec.fixedHeight.px} (${spec.fixedHeight.varName}); the live cell is ${observed.h}`,
    );
  }

  /** FONT SUBSTRATE is NOT drift against the script. A text node drawing Inter
   *  when the contract declared no font-family means the emitter was faithful
   *  and the CHANNEL never reached the contract — a different owner and a
   *  different fix from a canvas that predates its own script. It is reported
   *  as a NOTE so it can never inflate the drift count, and it is separated
   *  from the case where the spec DOES declare a family and the load still
   *  fell back (that one is the emitter's problem, so it is a finding). */
  const fonts = observed.fonts ?? [];
  const inter = fonts.filter((f) => f.family === "Inter");
  const declares = specDeclaresFontFamily(spec);
  if (inter.length && declares) {
    row.findings.push(
      `FC-FONT-STYLE-UNRESOLVED: ${inter.length} text node(s) fell back to Inter although the spec declares fontFamily — the family or its style spelling is unavailable in this file`,
    );
  } else if (inter.length) {
    row.notes.push(
      `FC-FONT-SUBSTRATE: ${inter.length} text node(s) draw Inter because the contract declares NO font-family; the library reference draws the library's own face. The emitter is faithful — the channel never reached the contract.`,
    );
  } else if (observed.fontsNote) {
    row.notes.push(`font substrate not asserted — ${observed.fontsNote}`);
  }

  row.status = row.findings.length ? "DRIFT" : "in-sync";
  results.push(row);
}

function shortField(field) {
  return (
    { paddingLeft: "pl", paddingRight: "pr", paddingTop: "pt", paddingBottom: "pb", itemSpacing: "gap" }[
      field
    ] ?? field
  );
}

function specDeclaresFontFamily(spec) {
  let found = false;
  const walk = (x) => {
    if (found || !x || typeof x !== "object") return;
    if (Array.isArray(x)) return x.forEach(walk);
    if (x.fontFamily) { found = true; return; }
    for (const k of Object.keys(x)) walk(x[k]);
  };
  walk(spec);
  return found;
}

if (asJson) {
  console.log(JSON.stringify({ lane, snapshot: snapshot ? path.relative(ROOT, snapPath) : null, results }, null, 2));
} else {
  for (const r of results) {
    console.log(`\n── ${lane}/${r.stem}  [${r.status}]`);
    console.log(`   cell      ${r.cellNodeId} "${r.cellName}"`);
    if (r.script) console.log(`   script    ${r.script}${r.variant ? ` · variant "${r.variant}"` : ""}`);
    if (r.note) console.log(`   note      ${r.note}`);
    for (const f of r.findings) console.log(`   ${f}`);
    for (const n of r.notes ?? []) console.log(`   (note) ${n}`);
  }
  const drift = results.filter((r) => r.status === "DRIFT").length;
  const sync = results.filter((r) => r.status === "in-sync").length;
  const pending = results.filter((r) => r.status === "SNAPSHOT-PENDING").length;
  const cellPending = results.filter((r) => r.status === "CELL-PENDING").length;
  const noted = results.filter((r) => (r.notes ?? []).length).length;
  console.log(
    `\n✔ console-loop:canvas-drift ${lane} — ${results.length} stem(s): ${sync} in-sync with their own emit script, ${drift} drifted, ${pending} snapshot-pending, ${cellPending} cell-pending; ${noted} carry a non-drift note (reporting only; never fails CI)`,
  );
}
