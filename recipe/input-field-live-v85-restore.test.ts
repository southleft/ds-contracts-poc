import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import {
  INPUT_LIVE_V85_MEASURE_VISIBLE_FILL_MARKER,
  INPUT_LIVE_V85_RESTORE_CONTENT_ROLES,
  INPUT_LIVE_V85_RESTORE_PARENT_ROLES,
  V12_WRITER_PAYLOAD_SHA256,
  V12_WRITER_PROGRAM_SHA256,
  V18_WRITER_PAYLOAD_SHA256,
  V18_WRITER_PROGRAM_SHA256,
  V19_WRITER_PAYLOAD_SHA256,
  V19_WRITER_PROGRAM_SHA256,
  V76_SCENE_READBACK_SHA256,
  V77_SCENE_READBACK_SHA256,
  V78_SCENE_READBACK_SHA256,
  V79_SCENE_READBACK_SHA256,
  V80_SCENE_READBACK_SHA256,
  V81_SCENE_READBACK_SHA256,
  V82_SCENE_READBACK_SHA256,
  V83_SCENE_READBACK_SHA256,
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
  buildInputLiveV85RestoreProgram,
  validateInputLiveV85RestorePayload,
} from "./input-field-live-v85-restore.js";

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

const writer = {
  pageId: "1:1",
  runIdentity: "input-live-v5",
  setIds: ["2:1", "2:2"] as [string, string],
};

test("v85 probe reveals hidden content FILL before measuring, then restores visibility", () => {
  const program = readFileSync(
    "recipe/input-field-live-v85-contract.ts",
    "utf8",
  );
  const probe = program.slice(
    program.indexOf("export function buildInputLiveV85ProbeProgram"),
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
  const program = buildInputLiveV85RestoreProgram(writer);
  assert.match(program, new RegExp(INPUT_LIVE_V85_MEASURE_VISIBLE_FILL_MARKER));
  assert.match(program, /layoutSizingHorizontal="FILL"/);
  assert.match(program, /textAutoResize="HEIGHT"/);
  assert.match(program, /hidden=node.visible===false/);
  assert.match(program, /INPUT-V81-RESTORE-COUNT/);
  assert.match(program, /INPUT-V81-RESTORE-NOT-FILL/);
  assert.equal(program.includes("combineAsVariants"), false);
  assert.equal(program.includes('after==="FIXED"'), false);
  assert.match(program, /entry\.after!=="FILL"/);
  const measure = program.indexOf("restored.push");
  const hide = program.lastIndexOf("if(hidden)node.visible=false");
  assert.ok(measure >= 0 && hide > measure);
  for (const role of INPUT_LIVE_V85_RESTORE_CONTENT_ROLES)
    assert.match(program, new RegExp(role.replaceAll("/", "\\/")));
  for (const role of INPUT_LIVE_V85_RESTORE_PARENT_ROLES)
    assert.match(program, new RegExp(role.replaceAll("/", "\\/")));
});

test("v16 restore payload requires 256 filled content texts", () => {
  const accepted = validateInputLiveV85RestorePayload(
    {
      pageId: "1:1",
      setIds: ["2:2", "2:1"],
      restoredCount: 256,
      fixedBefore: 24,
      hiddenRevealedForFill: 24,
      retriedForFill: 0,
      contentFillAfter: true,
      marker: INPUT_LIVE_V85_MEASURE_VISIBLE_FILL_MARKER,
    },
    writer,
  );
  assert.equal(accepted.hiddenRevealedForFill, 24);
  assert.throws(
    () =>
      validateInputLiveV85RestorePayload(
        { ...accepted, restoredCount: 232 },
        writer,
      ),
    /re-assert content FILL/,
  );
  assert.throws(
    () =>
      validateInputLiveV85RestorePayload(
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
    "recipe/evidence/input-field-live-pivot-v85/programs/writer.txt",
  );
  const v76Payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v85/programs/writer-payload.js",
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

test("v85 probe excludes overlay-label AABB from visibleAreaLoss; overlap excludes opacity-0 occupancy", () => {
  const program = readFileSync(
    "recipe/input-field-live-v85-contract.ts",
    "utf8",
  );
  const probe = program.slice(
    program.indexOf("export function buildInputLiveV85ProbeProgram"),
  );
  assert.match(probe, /INPUT-PROBE-EXCLUDE-OVERLAY-LABEL-AABB/);
  assert.match(
    probe,
    /overlayLabelRow=all\.find\(node=>role\(node\)==="input-field\/label-row"&&node\.layoutPositioning==="ABSOLUTE"\)/,
  );
  assert.match(
    probe,
    /clipSemantic=semantic\.filter\(node=>!\(overlayLabelRow&&\(role\(node\)==="input-field\/label"\|\|role\(node\)==="input-field\/required-indicator"\)\)\)/,
  );
  assert.match(
    probe,
    /visibleAreaLoss:Math\.max\(0,\.\.\.clipSemantic\.map\(node=>visibleLoss\(box\(node\),componentBox\)\)\)/,
  );
  assert.match(probe, /INPUT-PROBE-EXCLUDE-OPACITY-ZERO-OCCUPANCY-OVERLAP/);
  assert.match(
    probe,
    /occupancySpacer=node=>node\.opacity===0&&\(role\(node\)==="input-field\/content\/placeholder"\|\|role\(node\)==="input-field\/content\/value"\)/,
  );
  assert.match(
    probe,
    /overlapSemantic=semantic\.filter\(node=>!occupancySpacer\(node\)\)/,
  );
  assert.match(
    probe,
    /for\(let i=0;i<overlapSemantic\.length;i\+\+\)for\(let j=i\+1;j<overlapSemantic\.length;j\+\+\)maximumOverlap/,
  );
  assert.equal(
    probe.includes(
      "for(let i=0;i<semantic.length;i++)for(let j=i+1;j<semantic.length;j++)maximumOverlap",
    ),
    false,
  );
  assert.match(probe, /overlapPixels:maximumOverlap/);
  assert.equal(
    probe.includes(
      "visibleAreaLoss:Math.max(0,...semantic.map(node=>visibleLoss(box(node),componentBox)))",
    ),
    false,
  );
  assert.match(probe, /INPUT-PROBE-MEASURE-HIDDEN-CONTENT-FILL/);
});

test("v19 writer preserves hidden FILL occupancy; hashed v16/v17/v18 stay frozen", () => {
  const v85Payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v85/programs/writer-payload.js",
    "utf8",
  );
  const v75Payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v75/programs/writer-payload.js",
  );
  const v78Payload = readFileSync(
    "recipe/evidence/input-field-live-pivot-v78/programs/writer-payload.js",
  );
  assert.match(
    v85Payload,
    /const head=descendant\.name\.split\(" :: ",1\)\[0\]/,
  );
  assert.match(v85Payload, /INPUT-WRITER-HIDDEN-FILL-OCCUPANCY/);
  assert.equal(
    v85Payload.includes(
      'const role=(descendant.name.includes("/")&&!descendant.name.includes("=")?descendant.name.split(" :: ",1)[0]:"");',
    ),
    false,
  );
  assert.equal(
    v85Payload.includes(
      "node.visible=ir.visible!==false;node.opacity=ir.opacity===undefined?1:ir.opacity;",
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
  assert.equal(sha256(v78Payload), V18_WRITER_PAYLOAD_SHA256);
  assert.equal(
    sha256(
      readFileSync(
        "recipe/evidence/input-field-live-pivot-v78/programs/writer.txt",
      ),
    ),
    V18_WRITER_PROGRAM_SHA256,
  );
  assert.equal(sha256(v85Payload), V19_WRITER_PAYLOAD_SHA256);
  assert.equal(
    sha256(
      readFileSync(
        "recipe/evidence/input-field-live-pivot-v85/programs/writer.txt",
      ),
    ),
    V19_WRITER_PROGRAM_SHA256,
  );
  assert.equal(
    sha256(readFileSync("recipe/scene-readback-v76.ts")),
    V76_SCENE_READBACK_SHA256,
  );
  assert.equal(
    sha256(readFileSync("recipe/scene-readback-v77.ts")),
    V77_SCENE_READBACK_SHA256,
  );
  assert.equal(
    sha256(readFileSync("recipe/scene-readback-v78.ts")),
    V78_SCENE_READBACK_SHA256,
  );
  assert.equal(
    sha256(readFileSync("recipe/scene-readback-v79.ts")),
    V79_SCENE_READBACK_SHA256,
  );
  assert.equal(
    sha256(readFileSync("recipe/scene-readback-v80.ts")),
    V80_SCENE_READBACK_SHA256,
  );
  assert.equal(
    sha256(readFileSync("recipe/scene-readback-v81.ts")),
    V81_SCENE_READBACK_SHA256,
  );
  assert.equal(
    sha256(readFileSync("recipe/scene-readback-v82.ts")),
    V82_SCENE_READBACK_SHA256,
  );
  assert.equal(
    sha256(readFileSync("recipe/scene-readback-v83.ts")),
    V83_SCENE_READBACK_SHA256,
  );
});

test("v85 expected-plan carries live occupancy opacity 0; Polar stays V82", () => {
  const mui = JSON.parse(
    gunzipSync(
      readFileSync(
        "recipe/evidence/input-field-live-pivot-v85/expected-scene-plan-mui.json.gz",
      ),
    ).toString("utf8"),
  ) as {
    facts: Array<{
      channel?: string;
      value?: unknown;
      nodeOwnershipKey?: string;
    }>;
  };
  const v80Mui = JSON.parse(
    gunzipSync(
      readFileSync(
        "recipe/evidence/input-field-live-pivot-v80/expected-scene-plan-mui.json.gz",
      ),
    ).toString("utf8"),
  ) as {
    facts: Array<{
      channel?: string;
      value?: unknown;
      nodeOwnershipKey?: string;
    }>;
  };
  const occupancyKeys = new Set(
    v80Mui.facts
      .filter((fact) => fact.channel === "visible" && fact.value === false)
      .map((fact) => fact.nodeOwnershipKey),
  );
  assert.equal(occupancyKeys.size, 24);
  const occupancyOpacity = mui.facts.filter(
    (fact) =>
      fact.channel === "opacity" && occupancyKeys.has(fact.nodeOwnershipKey),
  );
  assert.equal(occupancyOpacity.length, 24);
  assert.equal(occupancyOpacity.every((fact) => fact.value === 0), true);
  assert.equal(
    mui.facts.filter(
      (fact) =>
        fact.channel === "opacity" &&
        fact.value === 1 &&
        occupancyKeys.has(fact.nodeOwnershipKey),
    ).length,
    0,
  );
  assert.equal(
    sha256(
      readFileSync(
        "recipe/evidence/input-field-live-pivot-v85/expected-scene-plan-polaris.json.gz",
      ),
    ),
    sha256(
      readFileSync(
        "recipe/evidence/input-field-live-pivot-v82/expected-scene-plan-polaris.json.gz",
      ),
    ),
  );
});
