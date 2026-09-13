import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";

import { deriveCanvasFacts, sha256OfBytes } from "./canvas-facts.js";
import { bridgeCanvasFactsToDump } from "./canvas-facts-to-dump.js";
import {
  HELD_OUT_V2_FILES,
  HELD_OUT_V2_ROOT,
  HELD_OUT_V2_SUBJECTS,
  HELD_OUT_V2_VERSION,
} from "./canvas-to-code-held-out-v2-manifest.js";
import type {
  HeldOutV2Index,
  HeldOutV2ObserveMeta,
  HeldOutV2Receipt,
} from "./canvas-to-code-held-out-v2.js";
import {
  assertReadOnlyProgram,
  buildHeldOutObserveProgram,
} from "./held-out-observe-program.js";
import type { SceneNodeSnapshot } from "./scene-readback.js";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const read = (rel: string): string => readFileSync(path.resolve(REPO, rel), "utf8");
const json = <T>(rel: string): T => JSON.parse(read(rel)) as T;
const SCRATCH_FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";

test("every manifest file is a foreign, read-only file — never Scratch", () => {
  for (const file of HELD_OUT_V2_FILES) {
    assert.notEqual(file.fileKey, SCRATCH_FILE_KEY, "Scratch is this repo's own canvas");
    assert.equal(file.role, "read-only");
    assert.match(file.authoredBy, /never wrote|no reference/i);
  }
  for (const subject of HELD_OUT_V2_SUBJECTS) {
    assert.ok(HELD_OUT_V2_FILES.some((f) => f.fileKey === subject.fileKey));
    assert.equal(subject.provenance, "designer-drawn, never minted by this repo");
  }
});

test("the observe program is read-only by construction and refuses unknown node types by name", () => {
  const subject = HELD_OUT_V2_SUBJECTS[0]!;
  const program = buildHeldOutObserveProgram(subject);
  assert.doesNotThrow(() => assertReadOnlyProgram(program));
  assert.ok(program.includes(JSON.stringify(subject.fileKey)));
  assert.ok(program.includes("UNSUPPORTED-SCENE-NODE-TYPE"));
  assert.ok(program.includes("writes:0"));
  assert.throws(
    () => assertReadOnlyProgram(`${program}\nconst r=figma.createRectangle();`),
    /not read-only/,
  );
  assert.throws(() => assertReadOnlyProgram("node.remove()"), /not read-only/);
  assert.throws(() => assertReadOnlyProgram("set.name = 'x'"), /not read-only/);
});

test("index covers every manifest subject; each receipt is accounting-clean or refused by name", () => {
  const index = json<HeldOutV2Index>(`${HELD_OUT_V2_ROOT}/index.json`);
  assert.equal(index.artifactVersion, HELD_OUT_V2_VERSION);
  assert.equal(index.answersV1Blocker, "substrate-is-our-own-mint");
  assert.deepEqual(
    index.subjects.map((s) => s.slug).sort(),
    HELD_OUT_V2_SUBJECTS.map((s) => s.slug).sort(),
  );
  for (const subject of HELD_OUT_V2_SUBJECTS) {
    const dir = `${HELD_OUT_V2_ROOT}/${subject.slug}`;
    const receipt = json<HeldOutV2Receipt>(`${dir}/receipt.json`);
    assert.equal(receipt.subject.fileKey, subject.fileKey);
    if (receipt.outcome === "refused-by-name" && receipt.refusal?.stage === "observe") {
      // Refused before any observe existed (set not on canvas, or two observes
      // disagreed): the receipt names why; there is no meta to pin.
      assert.ok(receipt.refusal.message.length > 0);
      assert.ok(!existsSync(path.resolve(REPO, dir, "observe.json.gz")) || existsSync(path.resolve(REPO, dir, "observe-refusal.json")));
      assert.ok(!existsSync(path.resolve(REPO, dir, "generated")));
      assert.equal(receipt.overallSuccess, false);
      continue;
    }
    const meta = json<HeldOutV2ObserveMeta>(`${dir}/observe-meta.json`);
    assert.equal(receipt.subject.setNodeId, subject.setNodeId);
    assert.equal(receipt.subject.liveReads, 0);
    assert.equal(receipt.subject.figmaWrites, 0);
    assert.equal(receipt.humanGrade, "pending");
    assert.equal(receipt.gradeInvented, false);
    assert.equal(receipt.overallSuccess, false);
    assert.equal(receipt.productV1, "incomplete");
    // provenance pins
    assert.equal(receipt.subject.fileVersion, meta.fileVersion);
    assert.equal(meta.doubleObserve.identical, true);
    assert.ok(meta.doubleObserve.runs.length >= 2);
    assert.equal(meta.figmaWrites, 0);
    const bytes = readFileSync(path.resolve(REPO, dir, "observe.json.gz"));
    assert.equal(sha256OfBytes(bytes), receipt.subject.observeSha256);
    assert.equal(meta.observeSha256, receipt.subject.observeSha256);
    assert.equal(meta.programSha256, sha256OfBytes(buildHeldOutObserveProgram(subject)));
    const blockerIds = receipt.namedBlockers.map((b) => b.id);
    assert.ok(!blockerIds.includes("substrate-is-our-own-mint"), "the v1 blocker is answered, not carried");
    assert.ok(blockerIds.includes("no-human-grade"));

    if (receipt.outcome === "refused-by-name") {
      assert.ok(receipt.refusal?.stage, "refusal names its stage");
      assert.ok(receipt.refusal?.message, "refusal names its message");
      assert.ok(!existsSync(path.resolve(REPO, dir, "generated")), "a refused subject carries no generated code");
      continue;
    }
    assert.equal(receipt.outcome, "accounting-zero-silent");
    assert.ok(receipt.bridge && receipt.render && receipt.emitted && receipt.proposal);
    assert.equal(receipt.bridge.silent, 0);
    assert.equal(receipt.render.silent, 0);
    assert.equal(receipt.render.unexplainedDeltas, 0);
    assert.equal(receipt.render.cellsMounted, receipt.subject.variants, "every variant mounts");
    // ledger sum identity: every fact lands exactly once
    assert.equal(
      receipt.bridge.named + receipt.bridge.carried + receipt.bridge.receipted + receipt.bridge.silent,
      receipt.bridge.facts,
    );
    assert.equal(
      receipt.render.matched + receipt.render.namedDeltas + receipt.render.carried + receipt.render.receipted + receipt.render.silent,
      receipt.render.facts,
    );
    for (const file of receipt.emitted) {
      const committed = readFileSync(path.resolve(REPO, dir, file.path));
      assert.equal(sha256OfBytes(committed), file.sha256, `${file.path} is the emitted bytes`);
    }
    const render = JSON.parse(gunzipSync(readFileSync(path.resolve(REPO, dir, "render-ledger.json.gz"))).toString("utf8")) as {
      ledger: Array<{ disposition: string; explainedBy?: string }>;
    };
    for (const row of render.ledger)
      if (row.disposition === "named-delta")
        assert.ok(row.explainedBy, "every named delta is explained");
  }
});

// ---------------------------------------------------------------------------
// The two engine rules a designer's file exposed, pinned on synthetic scenes.
// ---------------------------------------------------------------------------

const textNode = (bindings: SceneNodeSnapshot["boundVariables"]): SceneNodeSnapshot => ({
  ownershipKey: "pending",
  type: "TEXT",
  name: "Label",
  width: 40,
  height: 20,
  visible: true,
  opacity: 1,
  layoutSizingHorizontal: "HUG",
  layoutSizingVertical: "HUG",
  characters: "Badge",
  fontName: { family: "Public Sans", style: "SemiBold" },
  fontSize: 12,
  lineHeight: { unit: "PIXELS", value: 20 },
  fills: [{ type: "SOLID", color: "#ff6d76ff" }],
  boundVariables: bindings,
  children: [],
});

const variant = (name: string, absolute: boolean, child: SceneNodeSnapshot): SceneNodeSnapshot => ({
  ownershipKey: "pending",
  type: "COMPONENT",
  name,
  width: 57,
  height: 20,
  visible: true,
  opacity: 1,
  layoutMode: "HORIZONTAL",
  layoutSizingHorizontal: "HUG",
  layoutSizingVertical: "HUG",
  primaryAxisAlignItems: "CENTER",
  counterAxisAlignItems: "CENTER",
  itemSpacing: 4,
  paddingTop: 0,
  paddingRight: 8,
  paddingBottom: 0,
  paddingLeft: 8,
  layoutPositioning: absolute ? "ABSOLUTE" : "AUTO",
  ...(absolute ? { x: 24, y: 92, constraints: { horizontal: "MIN", vertical: "MIN" } } : {}),
  fills: [{ type: "SOLID", color: "#38191cff" }],
  boundVariables: [],
  variantProperties: Object.fromEntries(name.split(",").map((p) => p.trim().split("="))) as Record<string, string>,
  children: [child],
});

const set = (absoluteRoot: boolean, children: SceneNodeSnapshot[]): SceneNodeSnapshot => ({
  ownershipKey: "pending",
  type: "COMPONENT_SET",
  name: "Badge",
  width: 161,
  height: 340,
  visible: true,
  opacity: 1,
  layoutMode: "NONE",
  layoutSizingHorizontal: "FIXED",
  layoutSizingVertical: "FIXED",
  layoutPositioning: absoluteRoot ? "ABSOLUTE" : "AUTO",
  ...(absoluteRoot ? { x: 59, y: 25, constraints: { horizontal: "MIN", vertical: "MIN" } } : {}),
  clipsContent: true,
  fills: [],
  boundVariables: [],
  variantGroupProperties: { Variant: { values: ["Danger", "Neutral"] } },
  children,
});

test("a fontStyle binding (a designer's font-weight variable) is spelled as type.fontStyle, not thrown", () => {
  const scene = set(false, [
    variant("Variant=Danger", false, textNode([
      { field: "fontStyle.0", variableName: "typography/font-weight/semibold", resolvedType: "STRING" },
    ])),
  ]);
  const doc = deriveCanvasFacts(scene, { observePath: "synthetic", observeSha256: "0" });
  assert.equal(doc.normalizations.filter((n) => n.kind === "binding-field-unspelled-receipted").length, 0);
  assert.ok(doc.tokenIdentities.some((t) => t.variableName === "typography/font-weight/semibold"));
});

test("a binding the IR cannot spell is receipted by name and dropped, never thrown", () => {
  const scene = set(false, [
    variant("Variant=Danger", false, textNode([
      { field: "textCase", variableName: "typography/case/upper", resolvedType: "STRING" },
    ])),
  ]);
  const doc = deriveCanvasFacts(scene, { observePath: "synthetic", observeSha256: "0" });
  const receipts = doc.normalizations.filter((n) => n.kind === "binding-field-unspelled-receipted");
  assert.equal(receipts.length, 1);
  assert.match(receipts[0]!.detail, /textCase=typography\/case\/upper \(STRING\)/);
});

test("a set parked absolutely inside a prop-sheet frame bridges with its placement receipted as sheet chrome", () => {
  const scene = set(true, [variant("Variant=Danger", false, textNode([]))]);
  const doc = deriveCanvasFacts(scene, { observePath: "synthetic", observeSha256: "0" });
  const facts = doc.facts.filter((f) => f.nodeOwnershipKey === "root" && /^layout\.(offset|constraints)$/.test(f.channel));
  assert.equal(facts.length, 2, "the projection emits offset + constraints for an ABSOLUTE root");
  const bridge = bridgeCanvasFactsToDump(doc);
  assert.equal(bridge.counts.silent, 0);
  const rows = bridge.ledger.filter((r) => r.nodeOwnershipKey === "root" && /^layout\.(offset|constraints)$/.test(r.channel));
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.disposition, "receipted");
    assert.match(String(row.landing), /prop-sheet|sheet chrome|not a component fact/i);
  }
});

test("an ABSOLUTE child is bridged with offset + constraints receipted, never silent", () => {
  const scene = set(false, [variant("Variant=Danger", true, textNode([]))]);
  const doc = deriveCanvasFacts(scene, { observePath: "synthetic", observeSha256: "0" });
  const bridge = bridgeCanvasFactsToDump(doc);
  assert.equal(bridge.counts.silent, 0);
  const rows = bridge.ledger.filter((r) => r.nodeOwnershipKey === "root/children/0" && /^layout\.(offset|constraints|positioning)$/.test(r.channel));
  assert.equal(rows.length, 3);
  for (const row of rows) assert.equal(row.disposition, "receipted");
});
