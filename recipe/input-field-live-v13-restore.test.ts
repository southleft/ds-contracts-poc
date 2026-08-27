import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INPUT_LIVE_V13_POST_WRITER_FILL_MARKER,
  INPUT_LIVE_V13_RESTORE_CONTENT_ROLES,
  V12_WRITER_PAYLOAD_SHA256,
  V12_WRITER_PROGRAM_SHA256,
  buildInputLiveV13RestoreProgram,
  validateInputLiveV13RestorePayload,
} from "./input-field-live-v13-restore.js";

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

const writer = {
  pageId: "1:1",
  runIdentity: "input-live-v5",
  setIds: ["2:1", "2:2"] as [string, string],
};

test("v13 restore program re-asserts content FILL after the writer returns", () => {
  const program = buildInputLiveV13RestoreProgram(writer);
  assert.match(program, new RegExp(INPUT_LIVE_V13_POST_WRITER_FILL_MARKER));
  assert.match(program, /layoutSizingHorizontal="FILL"/);
  assert.match(program, /textAutoResize="HEIGHT"/);
  assert.match(program, /INPUT-V13-RESTORE-COUNT/);
  for (const role of INPUT_LIVE_V13_RESTORE_CONTENT_ROLES)
    assert.match(program, new RegExp(role.replaceAll("/", "\\/")));
  assert.equal(
    program.includes("combineAsVariants"),
    false,
    "post-writer restore must not run inside the writer",
  );
});

test("v13 restore payload requires 256 filled content texts", () => {
  const accepted = validateInputLiveV13RestorePayload(
    {
      pageId: "1:1",
      setIds: ["2:2", "2:1"],
      restoredCount: 256,
      fixedBefore: 24,
      contentFillAfter: true,
      marker: INPUT_LIVE_V13_POST_WRITER_FILL_MARKER,
    },
    writer,
  );
  assert.equal(accepted.fixedBefore, 24);
  assert.throws(
    () =>
      validateInputLiveV13RestorePayload(
        { ...accepted, restoredCount: 232, fixedBefore: 24 },
        writer,
      ),
    /re-assert content FILL/,
  );
  assert.throws(
    () =>
      validateInputLiveV13RestorePayload(
        { ...accepted, contentFillAfter: false },
        writer,
      ),
    /re-assert content FILL/,
  );
});

test("v12 hashed writer bytes stay frozen", () => {
  const program = readFileSync(
    "recipe/evidence/input-field-live-pivot-v12/programs/writer.txt",
  );
  const payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v12/programs/writer-payload.js",
  );
  assert.equal(sha256(program), V12_WRITER_PROGRAM_SHA256);
  assert.equal(sha256(payload), V12_WRITER_PAYLOAD_SHA256);
});
