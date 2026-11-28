import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { hash } from "../src/roundtrip/surface.mjs";
import { capture } from "../src/roundtrip/capture.mjs";
import { fixture as sourceFixture } from "./roundtrip-fixture.mjs";

test("a later build failure retains the hash of earlier generated output", async (t) => {
  const f = sourceFixture(t),
    dir = f.policy.root;
  for (const file of ["story.tsx", "style.css", "font.woff2"]) f.save(file, "test input");
  f.save("generated.css", "before");
  const P = {
    version: 1,
    system: { id: "test" },
    component: { id: "parent", export: "Comp" },
    source: "source.tsx",
    story: "story.tsx",
    stylesheet: "style.css",
    appearance: { variants: [{ key: "default" }] },
    tokens: {},
    dependencies: {},
    instances: {},
    figma: {},
    capture: {
      font: { family: "Test", file: "font.woff2" },
      generated: ["generated.css"],
      build: [
        { command: process.execPath, args: ["-e", "require('node:fs').writeFileSync('generated.css','built')"] },
        { command: process.execPath, args: ["-e", "process.exit(1)"] },
      ],
    },
  };
  const observed = [];
  await assert.rejects(
    capture(P, dir, join(dir, "capture"), {}, { onGenerated: (file, sha256) => observed.push({ file, sha256 }) }),
    /Command failed/,
  );
  assert.deepEqual(observed, [{ file: join(dir, "generated.css"), sha256: hash("built") }]);
});
