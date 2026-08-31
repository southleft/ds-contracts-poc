import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildInputLiveV17WriterProgram,
  INPUT_LIVE_V17_SET_HUG_ASSIGNMENT,
} from "./input-field-figma-writer-v17.js";
import {
  buildInputLiveV18WriterProgram,
  INPUT_LIVE_V18_FIRST_SEGMENT_BIND,
} from "./input-field-figma-writer-v18.js";
import {
  buildInputLiveV19WriterPayload,
  buildInputLiveV19WriterProgram,
  INPUT_LIVE_V19_HIDDEN_FILL_OCCUPANCY,
  INPUT_LIVE_V19_STALE_VISIBLE_OPACITY,
  V16_WRITER_PAYLOAD_SHA256,
  V16_WRITER_PROGRAM_SHA256,
  V17_WRITER_PAYLOAD_SHA256,
  V17_WRITER_PROGRAM_SHA256,
  V17_WRITER_SOURCE_SHA256,
  V18_WRITER_PAYLOAD_SHA256,
  V18_WRITER_PROGRAM_SHA256,
  V18_WRITER_SOURCE_SHA256,
  V19_WRITER_PAYLOAD_SHA256,
  V19_WRITER_PROGRAM_SHA256,
} from "./input-field-figma-writer-v19.js";

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

test("hashed v16, v17, and v18 writer bytes stay frozen", () => {
  const v16Program = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/writer.txt",
  );
  const v16Payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/writer-payload.js",
  );
  const v17Source = readFileSync("recipe/input-field-figma-writer-v17.ts");
  const v18Source = readFileSync("recipe/input-field-figma-writer-v18.ts");
  const v17Built = buildInputLiveV17WriterProgram(v16Payload.toString("utf8"));
  const v18Built = buildInputLiveV18WriterProgram(v16Payload.toString("utf8"));
  assert.equal(sha256(v16Program), V16_WRITER_PROGRAM_SHA256);
  assert.equal(sha256(v16Payload), V16_WRITER_PAYLOAD_SHA256);
  assert.equal(sha256(v17Source), V17_WRITER_SOURCE_SHA256);
  assert.equal(sha256(v17Built.program), V17_WRITER_PROGRAM_SHA256);
  assert.equal(sha256(v17Built.payload), V17_WRITER_PAYLOAD_SHA256);
  assert.equal(sha256(v18Source), V18_WRITER_SOURCE_SHA256);
  assert.equal(sha256(v18Built.program), V18_WRITER_PROGRAM_SHA256);
  assert.equal(sha256(v18Built.payload), V18_WRITER_PAYLOAD_SHA256);
  assert.equal(v16Payload.includes(INPUT_LIVE_V17_SET_HUG_ASSIGNMENT), false);
  assert.match(
    v16Payload.toString("utf8"),
    new RegExp(
      INPUT_LIVE_V19_STALE_VISIBLE_OPACITY.replaceAll(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      ),
    ),
  );
});

test("v19 writer keeps hidden FILL content occupying the main axis", () => {
  const payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/writer-payload.js",
    "utf8",
  );
  const patched = buildInputLiveV19WriterPayload(payload);
  const hug = patched.indexOf(INPUT_LIVE_V17_SET_HUG_ASSIGNMENT);
  const bind = patched.indexOf(INPUT_LIVE_V18_FIRST_SEGMENT_BIND);
  const occupancy = patched.indexOf(INPUT_LIVE_V19_HIDDEN_FILL_OCCUPANCY);
  const stale = patched.indexOf(INPUT_LIVE_V19_STALE_VISIBLE_OPACITY);
  assert.ok(occupancy >= 0 && hug > occupancy && bind > hug);
  assert.equal(stale, -1);
  assert.match(patched, /INPUT-WRITER-HIDDEN-FILL-OCCUPANCY/);
  assert.match(patched, /hiddenFillContent\?0:/);
  assert.match(patched, /node\.visible=hiddenFillContent\|\|ir\.visible!==false/);
  assert.equal(patched.includes("createFrame()"), true);
  assert.equal(patched.includes("spacer"), false);
  assert.equal(patched.includes("labelInset"), false);
  assert.equal(patched.includes("primaryAxisAlignItems=\"MAX\""), false);
  assert.equal(patched.includes("31656"), false);
  assert.equal(patched.includes("33050"), false);
  assert.equal(INPUT_LIVE_V19_HIDDEN_FILL_OCCUPANCY.includes("157"), false);
  assert.throws(
    () => buildInputLiveV19WriterPayload(patched),
    /already preserves hidden FILL occupancy|missing unique visible\/opacity assign/,
  );
});

test("v19 program is a new transport wrap of the occupancy payload", () => {
  const payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/writer-payload.js",
  );
  const built = buildInputLiveV19WriterProgram(payload.toString("utf8"));
  assert.notEqual(sha256(built.payload), V16_WRITER_PAYLOAD_SHA256);
  assert.notEqual(sha256(built.program), V16_WRITER_PROGRAM_SHA256);
  assert.notEqual(sha256(built.payload), V17_WRITER_PAYLOAD_SHA256);
  assert.notEqual(sha256(built.program), V17_WRITER_PROGRAM_SHA256);
  assert.notEqual(sha256(built.payload), V18_WRITER_PAYLOAD_SHA256);
  assert.notEqual(sha256(built.program), V18_WRITER_PROGRAM_SHA256);
  assert.match(
    built.payload.toString("utf8"),
    /INPUT-WRITER-HIDDEN-FILL-OCCUPANCY/,
  );
  assert.equal(sha256(built.payload), V19_WRITER_PAYLOAD_SHA256);
  assert.equal(sha256(built.program), V19_WRITER_PROGRAM_SHA256);
  assert.match(
    built.program.toString("utf8"),
    /ds-contracts\/figma-writer-utf8-base64\/v1/,
  );
});
