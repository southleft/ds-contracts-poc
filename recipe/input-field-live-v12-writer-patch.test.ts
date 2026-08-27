import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createWriterTransportArtifact,
  decodeWriterTransportEnvelope,
} from "./writer-transport.js";
import {
  INPUT_LIVE_V12_POST_SETTLE_FILL_MARKER,
  patchInputLiveV12WriterPayload,
  V11_WRITER_PAYLOAD_SHA256,
  V11_WRITER_PROGRAM_SHA256,
} from "./input-field-live-v12-writer-patch.js";

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

test("v11 hashed writer bytes stay frozen", () => {
  const program = readFileSync(
    "recipe/evidence/input-field-live-pivot-v11/programs/writer.txt",
  );
  const payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v11/programs/writer-payload.js",
  );
  assert.equal(sha256(program), V11_WRITER_PROGRAM_SHA256);
  assert.equal(sha256(payload), V11_WRITER_PAYLOAD_SHA256);
  assert.equal(payload.includes(INPUT_LIVE_V12_POST_SETTLE_FILL_MARKER), false);
});

test("v12 writer patch re-asserts content fill after the component set settles", () => {
  const payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v11/programs/writer-payload.js",
    "utf8",
  );
  const patched = patchInputLiveV12WriterPayload(payload);
  assert.match(patched, /INPUT-TEXT-FILL-AFTER-SETTLE/);
  assert.match(patched, /descendant\.name\.split\(" :: ",1\)\[0\]/);
  assert.match(patched, /textAutoResize="HEIGHT"/);
  assert.ok(
    patched.indexOf(INPUT_LIVE_V12_POST_SETTLE_FILL_MARKER) <
      patched.indexOf("set.x=80;set.y=128;"),
  );
  assert.throws(() => patchInputLiveV12WriterPayload(patched), /already carries/);
});

test("wrapping the patched payload uses the same transport helper as prior writers", () => {
  const payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v11/programs/writer-payload.js",
  );
  const artifact = createWriterTransportArtifact(payload);
  const decoded = decodeWriterTransportEnvelope(artifact.envelope);
  assert.equal(sha256(decoded), V11_WRITER_PAYLOAD_SHA256);
});
