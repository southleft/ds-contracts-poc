import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileHash } from "../src/roundtrip/files.mjs";
import { hash } from "../src/roundtrip/surface.mjs";
import { checkGuards } from "../src/roundtrip/plan.mjs";
import { fixture } from "./roundtrip-fixture.mjs";

test("source fingerprints distinguish binary bytes that decode to identical text", (t) => {
  const f = fixture(t),
    file = join(f.policy.root, "font.woff2");
  writeFileSync(file, Buffer.from([0, 255, 0, 65]));
  const text = f.read("font.woff2"),
    sha256 = fileHash(file);
  const policy = { ...f.policy, guards: ["font.woff2"] },
    guards = [{ file: "font.woff2", sha256 }];
  checkGuards(policy, guards);
  writeFileSync(file, Buffer.from([0, 254, 0, 65]));
  assert.equal(f.read("font.woff2"), text);
  assert.notEqual(fileHash(file), sha256);
  assert.throws(() => checkGuards(policy, guards), /source-revision-conflict: font.woff2/);
  assert.equal(fileHash(join(f.policy.root, "source.tsx")), hash(f.read("source.tsx")));
});
