import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileHash } from "../src/roundtrip/files.mjs";
import { runRoundtrip } from "../src/roundtrip/index.mjs";
import { sessionFixture } from "./roundtrip-fixture.mjs";

for (const action of ["accept", "apply", "refresh"]) {
  test(`${action} refuses changed binary inputs before capture or writeback`, async (t) => {
    const f = sessionFixture(t),
      file = join(f.dir, "font.woff2");
    writeFileSync(file, Buffer.from([0, 255, 0, 65]));
    f.state.inputs = [{ file, sha256: fileHash(file) }];
    f.state.stage = { accept: "awaiting-figma", apply: "reviewed", refresh: "ready" }[action];
    f.save("session.json", f.state);
    f.save("snapshot.json", f.before);
    const before = { state: f.read("session.json"), tokens: f.read("tokens.json") };
    writeFileSync(file, Buffer.from([0, 254, 0, 65]));
    await assert.rejects(
      runRoundtrip(
        [action, "--session", f.dir, "--digest", f.plan.digest, "--snapshot", join(f.dir, "snapshot.json")],
        { reader: {}, captureSource: () => assert.fail("capture must not run"), log: () => {} },
      ),
      /(?:input|source) changed/,
    );
    assert.equal(f.read("session.json"), before.state);
    assert.equal(f.read("tokens.json"), before.tokens);
  });
}
