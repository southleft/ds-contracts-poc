import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INPUT_LIVE_V20_MEASURE_VISIBLE_FILL_MARKER,
  INPUT_LIVE_V20_RESTORE_CONTENT_ROLES,
  INPUT_LIVE_V20_RESTORE_PARENT_ROLES,
  V12_WRITER_PAYLOAD_SHA256,
  V12_WRITER_PROGRAM_SHA256,
  V15_EXTRACT_BLUEPRINT_SHA256,
  V15_RESTORE_BLUEPRINT_SHA256,
  V15_RESTORE_SOURCE_SHA256,
  V15_RUNTIME_SOURCE_SHA256,
  V16_EXTRACT_BLUEPRINT_SHA256,
  V16_RESTORE_BLUEPRINT_SHA256,
  V16_RESTORE_SOURCE_SHA256,
  V16_RUNTIME_SOURCE_SHA256,
  V17_SCENE_READBACK_SHA256,
  V18_EXTRACT_BLUEPRINT_SHA256,
  V18_RESTORE_BLUEPRINT_SHA256,
  V18_RESTORE_SOURCE_SHA256,
  V18_SCENE_READBACK_SHA256,
  V19_SCENE_READBACK_SHA256,
  buildInputLiveV20RestoreProgram,
  validateInputLiveV20RestorePayload,
} from "./input-field-live-v20-restore.js";

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

const writer = {
  pageId: "1:1",
  runIdentity: "input-live-v5",
  setIds: ["2:1", "2:2"] as [string, string],
};

test("v16 restore still measures FILL while visible, then restores visibility", () => {
  const program = buildInputLiveV20RestoreProgram(writer);
  assert.match(program, new RegExp(INPUT_LIVE_V20_MEASURE_VISIBLE_FILL_MARKER));
  assert.match(program, /layoutSizingHorizontal="FILL"/);
  assert.match(program, /textAutoResize="HEIGHT"/);
  assert.match(program, /hidden=node.visible===false/);
  assert.match(program, /INPUT-V20-RESTORE-COUNT/);
  assert.match(program, /INPUT-V20-RESTORE-NOT-FILL/);
  assert.equal(program.includes("combineAsVariants"), false);
  assert.equal(program.includes('after==="FIXED"'), false);
  assert.match(program, /entry\.after!=="FILL"/);
  const measure = program.indexOf("restored.push");
  const hide = program.lastIndexOf("if(hidden)node.visible=false");
  assert.ok(measure >= 0 && hide > measure);
  for (const role of INPUT_LIVE_V20_RESTORE_CONTENT_ROLES)
    assert.match(program, new RegExp(role.replaceAll("/", "\\/")));
  for (const role of INPUT_LIVE_V20_RESTORE_PARENT_ROLES)
    assert.match(program, new RegExp(role.replaceAll("/", "\\/")));
});

test("v16 restore payload requires 256 filled content texts", () => {
  const accepted = validateInputLiveV20RestorePayload(
    {
      pageId: "1:1",
      setIds: ["2:2", "2:1"],
      restoredCount: 256,
      fixedBefore: 24,
      hiddenRevealedForFill: 24,
      retriedForFill: 0,
      contentFillAfter: true,
      marker: INPUT_LIVE_V20_MEASURE_VISIBLE_FILL_MARKER,
    },
    writer,
  );
  assert.equal(accepted.hiddenRevealedForFill, 24);
  assert.throws(
    () =>
      validateInputLiveV20RestorePayload(
        { ...accepted, restoredCount: 232 },
        writer,
      ),
    /re-assert content FILL/,
  );
  assert.throws(
    () =>
      validateInputLiveV20RestorePayload(
        { ...accepted, contentFillAfter: false },
        writer,
      ),
    /re-assert content FILL/,
  );
});

test("v12 writer and v15/v16 restore, runtime, and extract bytes stay frozen", () => {
  const program = readFileSync(
    "recipe/evidence/input-field-live-pivot-v12/programs/writer.txt",
  );
  const payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v12/programs/writer-payload.js",
  );
  const v15Restore = readFileSync("recipe/input-field-live-v15-restore.ts");
  const v15Blueprint = readFileSync(
    "recipe/evidence/input-field-live-pivot-v15/programs/restore-blueprint.js",
  );
  const v15Runtime = readFileSync("recipe/scene-readback-runtime-v15.ts");
  const v15Extract = readFileSync(
    "recipe/evidence/input-field-live-pivot-v15/programs/extract-blueprint.js",
  );
  const v16Restore = readFileSync("recipe/input-field-live-v16-restore.ts");
  const v16Blueprint = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/restore-blueprint.js",
  );
  const v16Runtime = readFileSync("recipe/scene-readback-runtime-v16.ts");
  const v16Extract = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/extract-blueprint.js",
  );
  assert.equal(sha256(program), V12_WRITER_PROGRAM_SHA256);
  assert.equal(sha256(payload), V12_WRITER_PAYLOAD_SHA256);
  assert.equal(sha256(v15Restore), V15_RESTORE_SOURCE_SHA256);
  assert.equal(sha256(v15Blueprint), V15_RESTORE_BLUEPRINT_SHA256);
  assert.equal(sha256(v15Runtime), V15_RUNTIME_SOURCE_SHA256);
  assert.equal(sha256(v15Extract), V15_EXTRACT_BLUEPRINT_SHA256);
  assert.equal(sha256(v16Restore), V16_RESTORE_SOURCE_SHA256);
  assert.equal(sha256(v16Blueprint), V16_RESTORE_BLUEPRINT_SHA256);
  assert.equal(sha256(v16Runtime), V16_RUNTIME_SOURCE_SHA256);
  assert.equal(sha256(v16Extract), V16_EXTRACT_BLUEPRINT_SHA256);
  assert.equal(
    sha256(readFileSync("recipe/scene-readback-v17.ts")),
    V17_SCENE_READBACK_SHA256,
  );
  assert.equal(
    sha256(readFileSync("recipe/input-field-live-v18-restore.ts")),
    V18_RESTORE_SOURCE_SHA256,
  );
  assert.equal(
    sha256(
      readFileSync(
        "recipe/evidence/input-field-live-pivot-v18/programs/restore-blueprint.js",
      ),
    ),
    V18_RESTORE_BLUEPRINT_SHA256,
  );
  assert.equal(
    sha256(
      readFileSync(
        "recipe/evidence/input-field-live-pivot-v18/programs/extract-blueprint.js",
      ),
    ),
    V18_EXTRACT_BLUEPRINT_SHA256,
  );
  assert.equal(
    sha256(readFileSync("recipe/scene-readback-v18.ts")),
    V18_SCENE_READBACK_SHA256,
  );
  assert.equal(
    sha256(readFileSync("recipe/scene-readback-v19.ts")),
    V19_SCENE_READBACK_SHA256,
  );
});
