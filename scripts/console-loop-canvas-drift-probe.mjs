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
 * COMMITTED INPUTS ONLY (2026-08-22). The first-party lane's own scripts live
 * under parity/receipts/console-loop/emitted/, a gitignored rebuild target, and
 * the receipts name wave numbers that `npm run console-loop:emit` no longer
 * produces — so for 13 stems the EXPECTED side existed on one machine and not
 * on a clean clone (18 in-sync locally, 5 on CI; the eval was red from
 * 2026-08-13). The probe now NEVER reads that directory: for any receipt whose
 * script is under it, the distilled spec comes from the committed
 * canvas-drift/EMIT-SPECS.json (minted once by
 * scripts/console-loop-canvas-drift-mint-specs.mjs on the machine that has
 * the files, sha256-stamped). A stem with no entry reports
 * SPEC-RECEIPT-PENDING by name rather than falling back to whatever happens to
 * be on disk. Every row names what it read in `specSource`, and the eval
 * asserts none of it is the gitignored directory.
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
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EMITTED_DIR, collectionsCreatedBy, distillScript, sha256 } from "./console-loop-emit-spec.mjs";

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

const laneDir = lane === "first-party" ? CL : path.join(CL, lane);
/** CONSOLE_LOOP_DRIFT_SNAPSHOT lets a red-half test point the probe at a
 *  fixture snapshot. It exists so the probe can be proven to READ the snapshot
 *  rather than hardcode this lane's answer — never to relax the real check. */
const snapPath =
  process.env.CONSOLE_LOOP_DRIFT_SNAPSHOT ??
  path.join(laneDir, "canvas-drift/LIVE-SNAPSHOT.json");
const framingPath = path.join(laneDir, "framing.json");

/** WHERE THE LIVE CELL IS PINNED.
 *
 *  Foreign lanes pin the cell in `<lane>/framing.json` (the C1 pin). The
 *  FIRST-PARTY lane has no framing.json at all — but it is NOT unpinned: its
 *  headless cards under `visual-truth/first-party/<stem>.json` record the same
 *  two facts, `cellNodeId` and `cellName`, alongside the fileKey and
 *  fileVersion they were read at. Reading them is not inventing a pin; it is
 *  using the one the lane already keeps. Stems whose card records no cell
 *  (the five LAYOUT compositions, which have no headless card at all) still
 *  come through as CELL-PENDING, which is the honest answer for them. */
function loadPins() {
  /** framing.json pins, when the lane keeps one. For FOREIGN lanes this is the
   *  whole answer and the behaviour is unchanged. */
  const fromFraming = existsSync(framingPath)
    ? JSON.parse(readFileSync(framingPath, "utf8")).stems ?? {}
    : null;
  // FIRST-PARTY MERGES RATHER THAN REPLACES (2026-08-12). The lane gained a
  // framing.json covering the five COMPOSITION stems, and returning it alone
  // would have SHRUNK this probe from 54 enumerated stems to 5 — trading the
  // lane's breadth for one stronger pin. The two sources answer different
  // questions and both are real: framing.json carries a bridge-minted cell for
  // the stems it covers, the headless cards carry one for every stem that has
  // a card. So framing.json OVERLAYS the card-derived set, per stem, and the
  // probe keeps reporting on everything it reported on before.
  if (fromFraming && lane !== "first-party") return fromFraming;
  const vt = path.join(CL, "visual-truth", lane);
  if (!existsSync(vt)) return fromFraming;
  const stems = {};
  for (const f of readdirSync(vt).filter((x) => x.endsWith(".json"))) {
    const card = JSON.parse(readFileSync(path.join(vt, f), "utf8"));
    stems[f.replace(/\.json$/, "")] = {
      cellNodeId: card.cellNodeId ?? null,
      cellName: card.cellName ?? null,
      pinnedBy: `visual-truth/${lane}/${f}`,
      fileKey: card.fileKey ?? null,
    };
  }
  /** The five LAYOUT compositions have no headless card, so no cellNodeId —
   *  but they are also the one shape where there is nothing to CHOOSE. Their
   *  receipts record `variants: undefined`, i.e. the script built ONE
   *  standalone COMPONENT and not a set, and `generate.nodeId` is that single
   *  node. Verified live: 7:1658 / 7:1639 / 7:1674 / 7:1632 / 7:1625 are all
   *  type COMPONENT whose children are SLOTs, with no sibling variants. Taking
   *  the sole generated node is therefore not the forbidden move of inventing
   *  a cell from a shot — there is exactly one candidate and the lane's own
   *  receipt names it. A receipt that DOES record a variant count is left
   *  alone: picking one variant out of a set without a pin is exactly what C1
   *  exists to forbid. */
  const comps = path.join(CL, "components");
  if (existsSync(comps)) {
    for (const f of readdirSync(comps).filter((x) => x.endsWith(".json"))) {
      const stem = f.replace(/\.json$/, "");
      if (stems[stem]?.cellNodeId) continue;
      const receipt = JSON.parse(readFileSync(path.join(comps, f), "utf8"));
      const emitted = receipt.generate?.result?.results?.[0];
      if (!receipt.generate?.nodeId || emitted?.variants !== undefined) continue;
      stems[stem] = {
        cellNodeId: receipt.generate.nodeId,
        cellName: emitted?.name ?? stem,
        pinnedBy: `components/${f} (sole generated node — the script emits one standalone COMPONENT, not a set)`,
        fileKey: receipt.fileKey ?? null,
      };
    }
  }
  // The bridge-minted pin wins per stem where it exists.
  if (fromFraming) {
    for (const [stem, pin] of Object.entries(fromFraming)) {
      stems[stem] = { ...stems[stem], ...pin, pinnedBy: `framing.json (bridge-minted C1 pin)` };
    }
  }
  return stems;
}
const pins = loadPins();
if (!pins) {
  console.error(
    `✖ ${lane}: no framing.json and no visual-truth cards — nothing pins the cells to compare`,
  );
  process.exit(2);
}
const framing = { stems: pins };

/** THE COMMITTED SPEC RECEIPT for the first-party lane — the distilled facts of
 *  the gitignored emit scripts (see header). Read lazily, once. */
const specsPath = path.join(laneDir, "canvas-drift/EMIT-SPECS.json");
const specsRel = path.relative(ROOT, specsPath);
const specs =
  lane === "first-party" && existsSync(specsPath)
    ? JSON.parse(readFileSync(specsPath, "utf8"))
    : null;

/** stem → the distilled EXPECTED side, and WHERE it was read from.
 *
 *  Foreign lanes keep one committed script per stem at
 *  `examples/<lane>/figma/<file>.figma.js` (the emitted names are kebab-case;
 *  the contract basenames are not, so try both spellings); it is read and
 *  distilled on the fly. The FIRST-PARTY lane does not: its scripts are
 *  numbered by wave under the gitignored `parity/receipts/console-loop/emitted/`
 *  (and `figma-sync/NN-<stem>.js` for the compositions, which ARE tracked), and
 *  the numbering is not derivable from the stem — so the path is read from the
 *  stem's OWN receipt, `components/<stem>.json`.script, the record of the
 *  script that actually built the cell. A tracked path is read directly; a
 *  path under the gitignored directory is NEVER read from disk — its distilled
 *  spec comes from the committed EMIT-SPECS.json or the stem is
 *  SPEC-RECEIPT-PENDING by name.
 *
 *  Returns { script, specSource, distilled, notes } or { status, note }. */
function expectedFor(stem) {
  const fromFile = (abs, script) => {
    const src = readFileSync(abs, "utf8");
    const distilled = distillScript(src);
    if (!distilled) return { status: "UNPARSEABLE-SCRIPT", script };
    return { script, specSource: script, distilled, notes: [] };
  };
  if (lane === "first-party") {
    const receipt = path.join(CL, "components", `${stem}.json`);
    if (!existsSync(receipt)) {
      return { status: "NO-SCRIPT", note: `no components/${stem}.json receipt names the script that built this cell` };
    }
    const rel = JSON.parse(readFileSync(receipt, "utf8")).script;
    if (!rel) {
      return { status: "NO-SCRIPT", note: `components/${stem}.json records no \`script\` — nothing names the emit script that built this cell` };
    }
    if (!rel.startsWith(EMITTED_DIR)) {
      const p = path.join(ROOT, rel);
      if (!existsSync(p)) return { status: "NO-SCRIPT", note: `components/${stem}.json names ${rel}, which is not in the tree` };
      return fromFile(p, rel);
    }
    // The gitignored rebuild target: committed receipt or refuse by name.
    if (!specs) {
      return {
        status: "SPEC-RECEIPT-PENDING",
        script: rel,
        note: `${rel} is gitignored and ${specsRel} is absent — mint it with \`node scripts/console-loop-canvas-drift-mint-specs.mjs\` on the machine that has the scripts; the probe does not read the gitignored directory`,
      };
    }
    const entry = specs.stems?.[stem];
    if (!entry) {
      return {
        status: "SPEC-RECEIPT-PENDING",
        script: rel,
        note: `${specsRel} carries no entry for ${stem} (receipt names ${rel}) — re-mint with \`node scripts/console-loop-canvas-drift-mint-specs.mjs\``,
      };
    }
    if (entry.script !== rel) {
      return {
        status: "SPEC-RECEIPT-PENDING",
        script: rel,
        note: `${specsRel} was minted from ${entry.script} but components/${stem}.json now names ${rel} — re-mint`,
      };
    }
    if (entry.unparseable || !entry.variants) return { status: "UNPARSEABLE-SCRIPT", script: rel };
    const notes = [];
    /** A local copy is NOT an input, but when one exists it can be told apart
     *  from the receipt: a differing sha256 means the machine re-emitted past
     *  the receipt (or kept an older leftover). Named, never counted. */
    const local = path.join(ROOT, rel);
    if (existsSync(local)) {
      const localSha = sha256(readFileSync(local, "utf8"));
      if (localSha !== entry.sha256) {
        notes.push(
          `local ${rel} (sha256 ${localSha.slice(0, 12)}) differs from the one ${specsRel} was minted from (${String(entry.sha256).slice(0, 12)}); the probe read the receipt — run the mint tool with --check`,
        );
      }
    }
    return {
      script: rel,
      specSource: specsRel,
      distilled: { collections: entry.collections ?? [], variants: entry.variants, stateVariants: entry.stateVariants ?? [] },
      notes,
    };
  }
  const dir = path.join(ROOT, "examples", lane, "figma");
  for (const cand of [stem, stem.replace(/-/g, "")]) {
    const p = path.join(dir, `${cand}.figma.js`);
    if (existsSync(p)) return fromFile(p, path.relative(ROOT, p));
  }
  return { status: "NO-SCRIPT", note: `no examples/${lane}/figma/${stem}.figma.js — this stem has no committed emit script to compare against` };
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

/** WHICH COLLECTIONS DOES THIS LANE OWN?
 *
 *  This used to be a hardcoded lane -> collection-name map, and for one lane the
 *  map was simply false: there is NO "Polaris" collection on the Testing file
 *  and the polaris scripts never create one. `examples/polaris/figma/00-tokens.figma.js`
 *  creates Primitives / Brand / Semantic, and every per-component polaris script
 *  creates 'Imported (provisional)' and mints its degraded-import tokens there.
 *  Under the old map all 12 polaris stems reported COLLECTION-DRIFT on every
 *  binding — a finding produced entirely by the instrument's own premise.
 *
 *  So the owned set is now READ FROM THE LANE'S OWN COMMITTED SCRIPTS: a lane
 *  owns exactly the collections its emit scripts create. Nothing is asserted
 *  that the scripts do not say. carbon/astryx/altitude/tailwind are unchanged by
 *  this (each creates one collection, named for the lane), so the carbon round's
 *  two findings stand byte-for-byte — including checkbox's five bindings in
 *  'Imported (provisional)', which carbon's scripts never create and which is
 *  therefore still drift. */
/** The lane's tokens-script collections. First-party's 01-tokens.js is under
 *  the gitignored directory, so they come from the committed EMIT-SPECS.json
 *  (`tokens.collections`) — never from disk. */
let laneTokenCollections = null;
function ownedCollections(scriptCollections) {
  if (!laneTokenCollections) {
    if (lane === "first-party") {
      laneTokenCollections = specs?.tokens?.collections ?? [];
    } else {
      const t = path.join(ROOT, "examples", lane, "figma", "00-tokens.figma.js");
      laneTokenCollections = existsSync(t) ? collectionsCreatedBy(readFileSync(t, "utf8")) : [];
    }
  }
  const owned = new Set(laneTokenCollections);
  for (const c of scriptCollections) owned.add(c);
  return owned;
}

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

  const expected = expectedFor(stem);
  if (expected.status) {
    row.status = expected.status;
    if (expected.script) row.script = expected.script;
    if (expected.note) row.note = expected.note;
    results.push(row);
    continue;
  }
  row.script = expected.script;
  row.specSource = expected.specSource;
  row.notes.push(...expected.notes);
  const component = expected.distilled;
  const variant = pickVariant(component, pin.cellName);
  if (!variant) {
    row.status = "NO-MATCHING-VARIANT";
    row.note = `framing pin names cell "${pin.cellName}" but the script emits no variant with that name (state-stripped)`;
    results.push(row);
    continue;
  }
  const spec = variant;
  const owned = ownedCollections(component.collections ?? []);
  row.variant = variant.name;
  row.ownedCollections = [...owned].sort();
  if (!owned.size) {
    row.notes.push(
      `this lane's scripts create no variable collection, so no COLLECTION-DRIFT can be asserted for ${stem}`,
    );
  }
  /** FIGMA LOWERS THE UNIFORM STROKE WEIGHT, so the probe must lower it too.
   *
   *  The wave-numbered first-party scripts bind the single `strokeWeight`
   *  field; the modern emitter binds the four per-side fields. Comparing the
   *  names literally made `first-party/card` read BINDING-DRIFT on a canvas
   *  that is in fact exactly what its script builds. MEASURED, not assumed: a
   *  self-cleaning live probe on BMjUA2ue5CaZXU4kufxL0z
   *  (createFrame -> setBoundVariable('strokeWeight', border-width/100) ->
   *  read back -> remove()) returned boundVariables
   *  ["strokeTopWeight","strokeBottomWeight","strokeLeftWeight","strokeRightWeight"]
   *  with no exception: Figma never stores `strokeWeight` as a key at all.
   *  `strokeWeight` is the ONLY such field in any committed spec — a sweep of
   *  every lane's scripts finds paddings, radii, min/max and the four per-side
   *  weights spelled out, and nothing else uniform. */
  const specBindings = { ...(spec.bindings ?? {}) };
  if (specBindings.strokeWeight) {
    const w = specBindings.strokeWeight;
    delete specBindings.strokeWeight;
    for (const side of [
      "strokeTopWeight",
      "strokeBottomWeight",
      "strokeLeftWeight",
      "strokeRightWeight",
    ]) {
      specBindings[side] ??= w;
    }
    row.notes.push(
      "spec binds the uniform strokeWeight; Figma stores it as the four per-side weights, so it is compared side-by-side",
    );
  }
  row.expected = {
    bindings: Object.keys(specBindings).sort(),
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
  for (const [field, wantVar] of Object.entries(specBindings)) {
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
    if (owned.size && got.coll && !owned.has(got.coll)) {
      row.findings.push(
        `COLLECTION-DRIFT: ${field} -> ${got.name} resolved in collection "${got.coll}", which this lane's scripts do not create (${[...owned].join(", ")})` +
          (got.carbonValue !== undefined
            ? ` (live ${got.val} vs this lane's ${got.carbonValue})`
            : ""),
      );
    }
  }
  for (const [key, got] of Object.entries(observed.descendantBound ?? {})) {
    if (owned.size && got.coll && !owned.has(got.coll)) {
      row.findings.push(
        `COLLECTION-DRIFT: ${key} -> ${got.name} resolved in collection "${got.coll}", which this lane's scripts do not create (${[...owned].join(", ")})`,
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
  /** WHAT COUNTS AS A FALLBACK IS THE FAMILY THE SPEC ASKED FOR, not the
   *  string "Inter". The old test was `any Inter node && the spec declares a
   *  family anywhere` — which fired on every first-party stem, whose contracts
   *  declare fontFamily "Inter" and whose canvas correctly draws Inter. Ten
   *  false findings on a lane where the emitter did exactly its job. It also
   *  MISSED the opposite case: a spec declaring one family and the canvas
   *  drawing some third face that is not Inter. Compare the drawn family to
   *  the declared set instead — narrower where it was wrong, wider where it
   *  was blind. */
  const fonts = observed.fonts ?? [];
  const declaredFamilies = new Set(spec.fontFamilies ?? []);
  const inter = fonts.filter((f) => f.family === "Inter");
  const declares = declaredFamilies.size > 0;
  const substituted = declares
    ? fonts.filter((f) => !declaredFamilies.has(String(f.family)))
    : [];
  if (substituted.length) {
    const drawn = [...new Set(substituted.map((f) => f.family))].join(", ");
    row.findings.push(
      `FC-FONT-STYLE-UNRESOLVED: ${substituted.length} text node(s) draw ${drawn} although the spec declares ${[...declaredFamilies].join(", ")} — the family or its style spelling is unavailable in this file`,
    );
  } else if (declares) {
    row.notes.push(
      `font substrate matches the spec — ${fonts.length} text node(s) draw ${[...declaredFamilies].join(", ")} as declared`,
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

if (asJson) {
  console.log(
    JSON.stringify(
      {
        lane,
        snapshot: snapshot ? path.relative(ROOT, snapPath) : null,
        specReceipt: specs ? specsRel : null,
        results,
      },
      null,
      2,
    ),
  );
} else {
  for (const r of results) {
    console.log(`\n── ${lane}/${r.stem}  [${r.status}]`);
    console.log(`   cell      ${r.cellNodeId} "${r.cellName}"`);
    if (r.script) console.log(`   script    ${r.script}${r.variant ? ` · variant "${r.variant}"` : ""}`);
    if (r.specSource && r.specSource !== r.script) console.log(`   spec from ${r.specSource}`);
    if (r.note) console.log(`   note      ${r.note}`);
    for (const f of r.findings) console.log(`   ${f}`);
    for (const n of r.notes ?? []) console.log(`   (note) ${n}`);
  }
  const drift = results.filter((r) => r.status === "DRIFT").length;
  const sync = results.filter((r) => r.status === "in-sync").length;
  const pending = results.filter((r) => r.status === "SNAPSHOT-PENDING").length;
  const cellPending = results.filter((r) => r.status === "CELL-PENDING").length;
  const specPending = results.filter((r) => r.status === "SPEC-RECEIPT-PENDING").length;
  const noted = results.filter((r) => (r.notes ?? []).length).length;
  console.log(
    `\n✔ console-loop:canvas-drift ${lane} — ${results.length} stem(s): ${sync} in-sync with their own emit script, ${drift} drifted, ${pending} snapshot-pending, ${cellPending} cell-pending, ${specPending} spec-receipt-pending; ${noted} carry a non-drift note (reporting only; never fails CI)`,
  );
}
