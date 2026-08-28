import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildInputLiveV17WriterProgram,
  INPUT_LIVE_V17_SET_HUG_ASSIGNMENT,
} from "./input-field-figma-writer-v17.js";
import {
  buildInputLiveV18WriterPayload,
  buildInputLiveV18WriterProgram,
  INPUT_LIVE_V18_FIRST_SEGMENT_BIND,
  INPUT_LIVE_V18_STALE_FULL_NAME_BIND,
  V16_WRITER_PAYLOAD_SHA256,
  V16_WRITER_PROGRAM_SHA256,
  V17_WRITER_PAYLOAD_SHA256,
  V17_WRITER_PROGRAM_SHA256,
  V17_WRITER_SOURCE_SHA256,
} from "./input-field-figma-writer-v18.js";

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

test("hashed v16 and v17 writer bytes stay frozen", () => {
  const v16Program = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/writer.txt",
  );
  const v16Payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/writer-payload.js",
  );
  const v17Source = readFileSync("recipe/input-field-figma-writer-v17.ts");
  const v17Built = buildInputLiveV17WriterProgram(v16Payload.toString("utf8"));
  assert.equal(sha256(v16Program), V16_WRITER_PROGRAM_SHA256);
  assert.equal(sha256(v16Payload), V16_WRITER_PAYLOAD_SHA256);
  assert.equal(sha256(v17Source), V17_WRITER_SOURCE_SHA256);
  assert.equal(sha256(v17Built.program), V17_WRITER_PROGRAM_SHA256);
  assert.equal(sha256(v17Built.payload), V17_WRITER_PAYLOAD_SHA256);
  assert.equal(v16Payload.includes(INPUT_LIVE_V17_SET_HUG_ASSIGNMENT), false);
  assert.match(
    v16Payload.toString("utf8"),
    new RegExp(
      INPUT_LIVE_V18_STALE_FULL_NAME_BIND.replaceAll(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      ),
    ),
  );
});

test("v18 writer binds TEXT by first-segment role after v17 HUG", () => {
  const payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/writer-payload.js",
    "utf8",
  );
  const patched = buildInputLiveV18WriterPayload(payload);
  const hug = patched.indexOf(INPUT_LIVE_V17_SET_HUG_ASSIGNMENT);
  const bind = patched.indexOf(INPUT_LIVE_V18_FIRST_SEGMENT_BIND);
  const stale = patched.indexOf(INPUT_LIVE_V18_STALE_FULL_NAME_BIND);
  assert.ok(hug >= 0 && bind > hug);
  assert.equal(stale, -1);
  assert.match(patched, /set\.layoutMode="HORIZONTAL"/);
  assert.equal(patched.includes('set.layoutSizingHorizontal="FIXED"'), false);
  assert.equal(patched.includes("31656"), false);
  assert.equal(patched.includes("33050"), false);
  assert.throws(
    () => buildInputLiveV18WriterPayload(patched),
    /already binds by first-segment role|missing unique stale full-name bind/,
  );
});

test("v18 program is a new transport wrap of the first-segment bind payload", () => {
  const payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/writer-payload.js",
  );
  const built = buildInputLiveV18WriterProgram(payload.toString("utf8"));
  assert.notEqual(sha256(built.payload), V16_WRITER_PAYLOAD_SHA256);
  assert.notEqual(sha256(built.program), V16_WRITER_PROGRAM_SHA256);
  assert.notEqual(sha256(built.payload), V17_WRITER_PAYLOAD_SHA256);
  assert.notEqual(sha256(built.program), V17_WRITER_PROGRAM_SHA256);
  assert.match(
    built.payload.toString("utf8"),
    /set\.layoutSizingHorizontal="HUG"/,
  );
  assert.match(
    built.payload.toString("utf8"),
    /const head=descendant\.name\.split\(" :: ",1\)\[0\]/,
  );
  assert.match(
    built.program.toString("utf8"),
    /ds-contracts\/figma-writer-utf8-base64\/v1/,
  );
});
