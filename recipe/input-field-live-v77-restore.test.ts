import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INPUT_LIVE_V77_MEASURE_VISIBLE_FILL_MARKER,
  INPUT_LIVE_V77_RESTORE_CONTENT_ROLES,
  INPUT_LIVE_V77_RESTORE_PARENT_ROLES,
  V12_WRITER_PAYLOAD_SHA256,
  V12_WRITER_PROGRAM_SHA256,
  V18_WRITER_PAYLOAD_SHA256,
  V18_WRITER_PROGRAM_SHA256,
  V76_SCENE_READBACK_SHA256,
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
  V20_SCENE_READBACK_SHA256,
  V21_SCENE_READBACK_SHA256,
  buildInputLiveV77RestoreProgram,
  validateInputLiveV77RestorePayload,
} from "./input-field-live-v77-restore.js";

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

const writer = {
  pageId: "1:1",
  runIdentity: "input-live-v5",
  setIds: ["2:1", "2:2"] as [string, string],
};

test("v77 probe reveals hidden content FILL before measuring, then restores visibility", () => {
  const program = readFileSync(
    "recipe/input-field-live-v77-contract.ts",
    "utf8",
  );
  const probe = program.slice(
    program.indexOf("export function buildInputLiveV77ProbeProgram"),
  );
  assert.match(probe, /reflowTarget=contentRow\|\|contentText/);
  assert.match(probe, /INPUT-PROBE-MEASURE-HIDDEN-CONTENT-FILL/);
  assert.match(probe, /measureContentFill/);
  assert.match(probe, /hidden=node\.visible===false/);
  assert.match(probe, /if\(hidden\)\{void "INPUT-PROBE-MEASURE-HIDDEN-CONTENT-FILL";node\.visible=true;\}/);
  assert.match(probe, /const fill=node\.layoutSizingHorizontal==="FILL"/);
  assert.match(probe, /if\(hidden\)node\.visible=false/);
  assert.match(probe, /contentFillPassed=!!measureContentFill\(contentText\)/);
  assert.match(probe, /contentFillPassed:!!contentFillPassed/);
  assert.equal(probe.includes("contentFillPassed:!!reflowPassed"), false);
  assert.equal(probe.includes("content&&content.width>contentWidth"), false);
  assert.equal(probe.includes('layoutSizingHorizontal="FILL"'), false);
  assert.equal(probe.includes('layoutSizingHorizontal="FIXED"'), false);
  const reveal = probe.indexOf('node.visible=true');
  const measure = probe.indexOf('layoutSizingHorizontal==="FILL"');
  const hide = probe.indexOf("if(hidden)node.visible=false");
  assert.ok(reveal >= 0 && measure > reveal && hide > measure);
});

test("v16 restore still measures FILL while visible, then restores visibility", () => {
  const program = buildInputLiveV77RestoreProgram(writer);
  assert.match(program, new RegExp(INPUT_LIVE_V77_MEASURE_VISIBLE_FILL_MARKER));
  assert.match(program, /layoutSizingHorizontal="FILL"/);
  assert.match(program, /textAutoResize="HEIGHT"/);
  assert.match(program, /hidden=node.visible===false/);
  assert.match(program, /INPUT-V77-RESTORE-COUNT/);
  assert.match(program, /INPUT-V77-RESTORE-NOT-FILL/);
  assert.equal(program.includes("combineAsVariants"), false);
  assert.equal(program.includes('after==="FIXED"'), false);
  assert.match(program, /entry\.after!=="FILL"/);
  const measure = program.indexOf("restored.push");
  const hide = program.lastIndexOf("if(hidden)node.visible=false");
  assert.ok(measure >= 0 && hide > measure);
  for (const role of INPUT_LIVE_V77_RESTORE_CONTENT_ROLES)
    assert.match(program, new RegExp(role.replaceAll("/", "\\/")));
  for (const role of INPUT_LIVE_V77_RESTORE_PARENT_ROLES)
    assert.match(program, new RegExp(role.replaceAll("/", "\\/")));
});

test("v16 restore payload requires 256 filled content texts", () => {
  const accepted = validateInputLiveV77RestorePayload(
    {
      pageId: "1:1",
      setIds: ["2:2", "2:1"],
      restoredCount: 256,
      fixedBefore: 24,
      hiddenRevealedForFill: 24,
      retriedForFill: 0,
      contentFillAfter: true,
      marker: INPUT_LIVE_V77_MEASURE_VISIBLE_FILL_MARKER,
    },
    writer,
  );
  assert.equal(accepted.hiddenRevealedForFill, 24);
  assert.throws(
    () =>
      validateInputLiveV77RestorePayload(
        { ...accepted, restoredCount: 232 },
        writer,
      ),
    /re-assert content FILL/,
  );
  assert.throws(
    () =>
      validateInputLiveV77RestorePayload(
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
  assert.equal(
    sha256(readFileSync("recipe/scene-readback-v20.ts")),
    V20_SCENE_READBACK_SHA256,
  );
  assert.equal(
    sha256(readFileSync("recipe/scene-readback-v21.ts")),
    V21_SCENE_READBACK_SHA256,
  );
});

test("v16 writer bytes stay frozen and v17 writer assigns set HUG", () => {
  const v16Program = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/writer.txt",
  );
  const v16Payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v16/programs/writer-payload.js",
  );
  const v76Program = readFileSync(
    "recipe/evidence/input-field-live-pivot-v77/programs/writer.txt",
  );
  const v76Payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v77/programs/writer-payload.js",
  );
  assert.equal(sha256(v16Program), V12_WRITER_PROGRAM_SHA256);
  assert.equal(sha256(v16Payload), V12_WRITER_PAYLOAD_SHA256);
  assert.notEqual(sha256(v76Program), V12_WRITER_PROGRAM_SHA256);
  assert.notEqual(sha256(v76Payload), V12_WRITER_PAYLOAD_SHA256);
  assert.match(v76Payload.toString("utf8"), /set\.layoutSizingHorizontal="HUG"/);
  assert.equal(v16Payload.includes('set.layoutSizingHorizontal="HUG"'), false);
  assert.equal(
    sha256(readFileSync("recipe/scene-readback-v65.ts")),
    "f6e1e83f01816e34d3272747ee8b4e71a7572f359db8be5fe5bd49cd786dd992",
  );
});

test("v18 writer binds TEXT by first-segment role; hashed v17 stays frozen", () => {
  const v76Payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v77/programs/writer-payload.js",
    "utf8",
  );
  const v75Payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v75/programs/writer-payload.js",
  );
  assert.match(
    v76Payload,
    /const head=descendant\.name\.split\(" :: ",1\)\[0\]/,
  );
  assert.equal(
    v76Payload.includes(
      'const role=(descendant.name.includes("/")&&!descendant.name.includes("=")?descendant.name.split(" :: ",1)[0]:"");',
    ),
    false,
  );
  assert.equal(
    sha256(v75Payload),
    "f5e1294a09074cf4dfe7509e4a27531a288d8ffb93828664b2b9e92fe7137ce9",
  );
  assert.equal(
    sha256(readFileSync("recipe/evidence/input-field-live-pivot-v75/programs/writer.txt")),
    "05a0654618f46df22152870410362bbd44339f767139013ff219bb717488c2e2",
  );
  assert.equal(sha256(v76Payload), V18_WRITER_PAYLOAD_SHA256);
  assert.equal(
    sha256(
      readFileSync(
        "recipe/evidence/input-field-live-pivot-v77/programs/writer.txt",
      ),
    ),
    V18_WRITER_PROGRAM_SHA256,
  );
  assert.equal(
    sha256(readFileSync("recipe/scene-readback-v76.ts")),
    V76_SCENE_READBACK_SHA256,
  );
});
