import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INPUT_LIVE_V15_MEASURE_VISIBLE_FILL_MARKER,
  INPUT_LIVE_V15_RESTORE_CONTENT_ROLES,
  INPUT_LIVE_V15_RESTORE_PARENT_ROLES,
  V12_WRITER_PAYLOAD_SHA256,
  V12_WRITER_PROGRAM_SHA256,
  V14_RESTORE_BLUEPRINT_SHA256,
  V14_RESTORE_SOURCE_SHA256,
  buildInputLiveV15RestoreProgram,
  validateInputLiveV15RestorePayload,
} from "./input-field-live-v15-restore.js";

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

const writer = {
  pageId: "1:1",
  runIdentity: "input-live-v5",
  setIds: ["2:1", "2:2"] as [string, string],
};

test("v15 restore measures FILL while visible, then restores visibility", () => {
  const program = buildInputLiveV15RestoreProgram(writer);
  assert.match(program, new RegExp(INPUT_LIVE_V15_MEASURE_VISIBLE_FILL_MARKER));
  assert.match(program, /layoutSizingHorizontal="FILL"/);
  assert.match(program, /textAutoResize="HEIGHT"/);
  assert.match(program, /hidden=node.visible===false/);
  assert.match(program, /INPUT-V15-RESTORE-COUNT/);
  assert.match(program, /INPUT-V15-RESTORE-NOT-FILL/);
  assert.equal(program.includes("combineAsVariants"), false);
  assert.equal(program.includes('after==="FIXED"'), false);
  assert.match(program, /entry\.after!=="FILL"/);
  const measure = program.indexOf("restored.push");
  const hide = program.lastIndexOf("if(hidden)node.visible=false");
  assert.ok(measure >= 0 && hide > measure);
  for (const role of INPUT_LIVE_V15_RESTORE_CONTENT_ROLES)
    assert.match(program, new RegExp(role.replaceAll("/", "\\/")));
  for (const role of INPUT_LIVE_V15_RESTORE_PARENT_ROLES)
    assert.match(program, new RegExp(role.replaceAll("/", "\\/")));
});

test("v15 restore payload requires 256 filled content texts", () => {
  const accepted = validateInputLiveV15RestorePayload(
    {
      pageId: "1:1",
      setIds: ["2:2", "2:1"],
      restoredCount: 256,
      fixedBefore: 24,
      hiddenRevealedForFill: 24,
      retriedForFill: 0,
      contentFillAfter: true,
      marker: INPUT_LIVE_V15_MEASURE_VISIBLE_FILL_MARKER,
    },
    writer,
  );
  assert.equal(accepted.hiddenRevealedForFill, 24);
  assert.throws(
    () =>
      validateInputLiveV15RestorePayload(
        { ...accepted, restoredCount: 232 },
        writer,
      ),
    /re-assert content FILL/,
  );
  assert.throws(
    () =>
      validateInputLiveV15RestorePayload(
        { ...accepted, contentFillAfter: false },
        writer,
      ),
    /re-assert content FILL/,
  );
});

test("v12 writer and v14 restore bytes stay frozen", () => {
  const program = readFileSync(
    "recipe/evidence/input-field-live-pivot-v12/programs/writer.txt",
  );
  const payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v12/programs/writer-payload.js",
  );
  const v14Restore = readFileSync("recipe/input-field-live-v14-restore.ts");
  const v14Blueprint = readFileSync(
    "recipe/evidence/input-field-live-pivot-v14/programs/restore-blueprint.js",
  );
  assert.equal(sha256(program), V12_WRITER_PROGRAM_SHA256);
  assert.equal(sha256(payload), V12_WRITER_PAYLOAD_SHA256);
  assert.equal(sha256(v14Restore), V14_RESTORE_SOURCE_SHA256);
  assert.equal(sha256(v14Blueprint), V14_RESTORE_BLUEPRINT_SHA256);
});
