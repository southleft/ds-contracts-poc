import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import os from "node:os";
import { PNG } from "pngjs";
import { scoreFidelity } from "./fidelity-score.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const dir = path.join(
  root,
  "recipe/evidence/canvas-to-code-visual-v1/altitude-badge",
);
const recorded = JSON.parse(
  readFileSync(path.join(dir, "measurement.json"), "utf8"),
);
const hash = (p: string) =>
  createHash("sha256").update(readFileSync(p)).digest("hex");
function verify(receipt: typeof recorded) {
  const facts = path.join(root, receipt.sourceFacts.path);
  assert.equal(
    receipt.sourceFacts.path,
    "recipe/evidence/canvas-to-code-held-out-v2/altitude-badge/canvas-facts.json.gz",
  );
  assert.deepEqual(
    receipt.emitted,
    JSON.parse(
      readFileSync(path.join(path.dirname(facts), "receipt.json"), "utf8"),
    ).emitted,
    "complete current emitted artifact set",
  );
  assert.equal(hash(facts), receipt.sourceFacts.sha256, "source facts hash");
  const scene = JSON.parse(gunzipSync(readFileSync(facts)).toString()).scene;
  assert.equal(receipt.rows.length, scene.children.length, "variant coverage");
  for (const emitted of receipt.emitted) {
    assert.equal(
      hash(path.join(path.dirname(facts), emitted.path)),
      emitted.sha256,
      "generated source changed; fresh screenshots required",
    );
  }
  const source = path.join(dir, receipt.figma.image);
  const png = PNG.sync.read(readFileSync(source));
  assert.deepEqual(
    [png.width, png.height],
    [scene.width, scene.height],
    "source export dimensions",
  );
  const temp = mkdtempSync(path.join(os.tmpdir(), "ds-c2c-visual-"));
  try {
    return receipt.rows.map((row: (typeof receipt.rows)[number], i: number) => {
      const node = scene.children[i];
      assert.equal(row.variant, node.name, "variant identity");
      assert.deepEqual(
        row.sourceBox,
        [node.x, node.y, node.width, node.height],
        "observed crop",
      );
      assert.equal(hash(source), row.figmaSetSha, "Figma image hash");
      const generated = path.join(dir, row.generatedImage);
      assert.equal(hash(generated), row.generatedSha, "generated image hash");
      assert.equal(
        hash(path.join(dir, row.repeatImage)),
        row.generatedSha,
        "double-render identity",
      );
      const measured = scoreFidelity(
        generated,
        source,
        `canvas-to-code/altitude-badge/${node.name}`,
        path.join(temp, `${i}.png`),
        false,
        false,
        null,
        { referenceBox: row.sourceBox },
      );
      assert.deepEqual(measured.metrics, row.metrics, "pixel metrics");
      assert.equal(measured.status, row.status);
      assert.equal(measured.status, "pass", "measured visual ratchet");
      return measured.metrics.pctAAMasked;
    });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
test("designer Badge screenshots reproduce the measured visual threshold on all variants", () => {
  const scores = verify(recorded);
  console.log(
    JSON.stringify({
      variants: scores.length,
      scores,
      max: Math.max(...scores),
    }),
  );
});
test("planted pixel score, source crop, missing variant, and image changes are refused", () => {
  const score = structuredClone(recorded);
  score.rows[0].metrics.pctAAMasked = 0;
  assert.throws(() => verify(score), /pixel metrics/);
  const crop = structuredClone(recorded);
  crop.rows[0].sourceBox[0] += 1;
  assert.throws(() => verify(crop), /observed crop/);
  const missing = structuredClone(recorded);
  missing.rows.pop();
  assert.throws(() => verify(missing), /variant coverage/);
  const image = structuredClone(recorded);
  image.rows[0].generatedSha = "tampered";
  assert.throws(() => verify(image), /generated image hash/);
});
