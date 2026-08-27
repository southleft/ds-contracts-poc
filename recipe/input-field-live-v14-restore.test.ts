import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INPUT_LIVE_V14_RESTORE_CONTENT_ROLES,
  INPUT_LIVE_V14_RESTORE_PARENT_ROLES,
  INPUT_LIVE_V14_TWO_PASS_FILL_MARKER,
  V12_WRITER_PAYLOAD_SHA256,
  V12_WRITER_PROGRAM_SHA256,
  V13_RESTORE_BLUEPRINT_SHA256,
  V13_RESTORE_SOURCE_SHA256,
  buildInputLiveV14RestoreProgram,
  validateInputLiveV14RestorePayload,
} from "./input-field-live-v14-restore.js";

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

const writer = {
  pageId: "1:1",
  runIdentity: "input-live-v5",
  setIds: ["2:1", "2:2"] as [string, string],
};

test("v14 restore fills parents first, then content, without accepting FIXED", () => {
  const program = buildInputLiveV14RestoreProgram(writer);
  assert.match(program, new RegExp(INPUT_LIVE_V14_TWO_PASS_FILL_MARKER));
  assert.match(program, /layoutSizingHorizontal="FILL"/);
  assert.match(program, /textAutoResize="HEIGHT"/);
  assert.match(program, /layoutGrow=1/);
  assert.match(program, /hidden=node.visible===false/);
  assert.match(program, /INPUT-V14-RESTORE-COUNT/);
  assert.match(program, /INPUT-V14-RESTORE-NOT-FILL/);
  assert.equal(program.includes("combineAsVariants"), false);
  assert.equal(program.includes('after==="FIXED"'), false);
  assert.match(program, /entry\.after!=="FILL"/);
  for (const role of INPUT_LIVE_V14_RESTORE_CONTENT_ROLES)
    assert.match(program, new RegExp(role.replaceAll("/", "\\/")));
  for (const role of INPUT_LIVE_V14_RESTORE_PARENT_ROLES)
    assert.match(program, new RegExp(role.replaceAll("/", "\\/")));
  const parentAssign = program.indexOf("for(const frame of parents)");
  const textAssign = program.indexOf("for(const entry of texts)");
  assert.ok(parentAssign >= 0 && textAssign > parentAssign);
});

test("v14 restore payload requires 256 filled content texts", () => {
  const accepted = validateInputLiveV14RestorePayload(
    {
      pageId: "1:1",
      setIds: ["2:2", "2:1"],
      restoredCount: 256,
      fixedBefore: 24,
      hiddenRevealedForFill: 24,
      contentFillAfter: true,
      marker: INPUT_LIVE_V14_TWO_PASS_FILL_MARKER,
    },
    writer,
  );
  assert.equal(accepted.fixedBefore, 24);
  assert.equal(accepted.hiddenRevealedForFill, 24);
  assert.throws(
    () =>
      validateInputLiveV14RestorePayload(
        { ...accepted, restoredCount: 232, fixedBefore: 24 },
        writer,
      ),
    /re-assert content FILL/,
  );
  assert.throws(
    () =>
      validateInputLiveV14RestorePayload(
        { ...accepted, contentFillAfter: false },
        writer,
      ),
    /re-assert content FILL/,
  );
});

test("v12 writer and v13 restore bytes stay frozen", () => {
  const program = readFileSync(
    "recipe/evidence/input-field-live-pivot-v12/programs/writer.txt",
  );
  const payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v12/programs/writer-payload.js",
  );
  const v13Restore = readFileSync("recipe/input-field-live-v13-restore.ts");
  const v13Blueprint = readFileSync(
    "recipe/evidence/input-field-live-pivot-v13/programs/restore-blueprint.js",
  );
  assert.equal(sha256(program), V12_WRITER_PROGRAM_SHA256);
  assert.equal(sha256(payload), V12_WRITER_PAYLOAD_SHA256);
  assert.equal(sha256(v13Restore), V13_RESTORE_SOURCE_SHA256);
  assert.equal(sha256(v13Blueprint), V13_RESTORE_BLUEPRINT_SHA256);
});
