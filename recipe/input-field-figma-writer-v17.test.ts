import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildInputLiveV17WriterPayload,
  buildInputLiveV17WriterProgram,
  INPUT_LIVE_V17_SET_HUG_ASSIGNMENT,
  V16_WRITER_PAYLOAD_SHA256,
  V16_WRITER_PROGRAM_SHA256,
} from "./input-field-figma-writer-v17.js";

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

test("hashed v16 writer program and payload stay frozen", () => {
  const program = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/writer.txt",
  );
  const payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/writer-payload.js",
  );
  assert.equal(sha256(program), V16_WRITER_PROGRAM_SHA256);
  assert.equal(sha256(payload), V16_WRITER_PAYLOAD_SHA256);
  assert.equal(payload.includes(INPUT_LIVE_V17_SET_HUG_ASSIGNMENT), false);
  assert.equal(program.includes(INPUT_LIVE_V17_SET_HUG_ASSIGNMENT), false);
});

test("v17 writer assigns set layoutSizingHorizontal HUG after combineAsVariants", () => {
  const payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/writer-payload.js",
    "utf8",
  );
  const patched = buildInputLiveV17WriterPayload(payload);
  const combine = patched.indexOf("const set=figma.combineAsVariants");
  const hug = patched.indexOf(INPUT_LIVE_V17_SET_HUG_ASSIGNMENT);
  const description = patched.indexOf(
    'set.description="recipe-role:input-field/set";',
  );
  assert.ok(combine >= 0 && hug > combine && description > hug);
  assert.match(patched, /set\.layoutMode="HORIZONTAL"/);
  assert.equal(patched.includes("set.layoutSizingHorizontal=\"FIXED\""), false);
  assert.equal(patched.includes("31656"), false);
  assert.equal(patched.includes("33050"), false);
  assert.throws(
    () => buildInputLiveV17WriterPayload(patched),
    /already assigns set layoutSizingHorizontal HUG/,
  );
});

test("v17 program is a new transport wrap of the HUG payload", () => {
  const payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/writer-payload.js",
  );
  const built = buildInputLiveV17WriterProgram(payload.toString("utf8"));
  assert.notEqual(sha256(built.payload), V16_WRITER_PAYLOAD_SHA256);
  assert.notEqual(sha256(built.program), V16_WRITER_PROGRAM_SHA256);
  assert.match(built.payload.toString("utf8"), /set\.layoutSizingHorizontal="HUG"/);
  assert.match(
    built.program.toString("utf8"),
    /ds-contracts\/figma-writer-utf8-base64\/v1/,
  );
});
