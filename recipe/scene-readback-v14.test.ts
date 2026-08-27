import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { sceneToNormalizedIr as sceneToNormalizedIrV8 } from "./scene-readback.js";
import { sceneToNormalizedIr as sceneToNormalizedIrV10 } from "./scene-readback-v10.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime-v14.js";
import {
  SCENE_READBACK_V12_TAUGHT_FILL_KINDS,
  scenePaintToIr,
  sceneToNormalizedIr,
  type SceneNodeSnapshot,
} from "./scene-readback-v14.js";
import type { IRNode } from "./figma-ir.js";

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

const V8_INDEX = JSON.parse(
  readFileSync(
    "recipe/evidence/input-field-live-pivot-v8/antecedent-index.json",
    "utf8",
  ),
) as {
  artifacts: Record<string, { bytes: number; sha256: string }>;
};

const instanceScene = (
  fills: SceneNodeSnapshot["instancePayload"] extends infer Payload
    ? Payload extends { fills?: infer Fills }
      ? Fills
      : never
    : never,
): SceneNodeSnapshot => ({
  ownershipKey: "adornment",
  type: "INSTANCE",
  name: "leading",
  width: 16,
  height: 16,
  visible: true,
  opacity: 1,
  componentRef: "test.currency",
  componentProperties: { Side: "leading" },
  instancePayload: {
    text: ["$"],
    assets: [],
    content: { kind: "text", text: "$" },
    typography: {
      fontFamily: "Inter",
      fontStyle: "Regular",
      fontSize: 14,
      lineHeight: { unit: "px", value: 20 },
    },
    fills,
    opacity: 1,
    intrinsicSize: { width: 8, height: 20 },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    alignment: { horizontal: "center", vertical: "center" },
    accessibility: { relation: "none", decorative: true },
    source: "live-v9-fixture",
  },
  boundVariables: [],
  children: [],
});

const instancePayloadFills = (scene: SceneNodeSnapshot) => {
  const ir = sceneToNormalizedIr(scene);
  assert.equal(ir.kind, "instance");
  const instance = ir as Extract<IRNode, { kind: "instance" }>;
  assert.ok(instance.payload);
  return instance.payload.fills;
};

test("v9 teaches the live fill kinds that v8 host IR refused", () => {
  assert.deepEqual(
    [...SCENE_READBACK_V12_TAUGHT_FILL_KINDS],
    ["VARIABLE_ALIAS", "boundVariablesOnly"],
  );
});

test("v9 maps VARIABLE_ALIAS payload fills into carried IR", () => {
  const fills = instancePayloadFills(
    instanceScene([
      { kind: "VARIABLE_ALIAS", id: "VariableID:1:2" },
      { type: "VARIABLE_ALIAS", id: "VariableID:3:4" },
    ]),
  );
  assert.deepEqual(fills, [
    {
      kind: "variable-alias",
      variable: "VariableID:1:2",
      resolvedType: "COLOR",
    },
    {
      kind: "variable-alias",
      variable: "VariableID:3:4",
      resolvedType: "COLOR",
    },
  ]);
});

test("v9 maps bound-variable-only payload fills into carried IR", () => {
  const fills = instancePayloadFills(
    instanceScene([
      {
        type: "boundVariablesOnly",
        boundVariables: {
          color: { type: "VARIABLE_ALIAS", id: "VariableID:5:6" },
        },
      },
      {
        boundVariables: {
          color: { type: "VARIABLE_ALIAS", id: "VariableID:7:8" },
        },
      } as never,
    ]),
  );
  assert.deepEqual(fills, [
    { kind: "bound-variable", fields: ["color"] },
    { kind: "bound-variable", fields: ["color"] },
  ]);
});

test("v9 still converts ordinary scene paints and does not invent colors", () => {
  assert.deepEqual(scenePaintToIr({ type: "SOLID", color: "#111111ff" }), {
    kind: "solid",
    color: "#111111ff",
  });
  assert.throws(
    () => scenePaintToIr({ type: "SOLID" }),
    /scene solid paint has no color/,
  );
});

test("hashed v8 scene-readback still refuses the live fill kinds", () => {
  const scene = instanceScene([
    { kind: "VARIABLE_ALIAS", id: "VariableID:1:2" },
  ]);
  assert.throws(
    () => sceneToNormalizedIrV8(scene),
    /kind|discriminator|Invalid/i,
  );
  assert.throws(
    () =>
      sceneToNormalizedIrV8(
        instanceScene([
          {
            type: "boundVariablesOnly",
            boundVariables: {
              color: { type: "VARIABLE_ALIAS", id: "VariableID:5:6" },
            },
          },
        ]),
      ),
    /kind|discriminator|Invalid/i,
  );
});

test("v8 hashed scene-readback bytes stay frozen", () => {
  for (const artifactPath of [
    "recipe/scene-readback.ts",
    "recipe/scene-readback-runtime.ts",
  ] as const) {
    const pinned = V8_INDEX.artifacts[artifactPath];
    assert.ok(pinned, `v8 index missing ${artifactPath}`);
    const bytes = readFileSync(artifactPath);
    assert.equal(bytes.byteLength, pinned.bytes);
    assert.equal(sha256(bytes), pinned.sha256);
  }
});

test("v10 extract runtime serializes the taught live fill kinds", () => {
  const runtime = buildFigmaSceneReadbackRuntime(
    "ds.contracts.input.recipe.v5",
  );
  assert.match(runtime, /VARIABLE_ALIAS/);
  assert.match(runtime, /boundVariablesOnly/);
  assert.doesNotMatch(
    readFileSync("recipe/scene-readback-runtime.ts", "utf8"),
    /boundVariablesOnly/,
  );
});

test("v10 live host path does not import hashed scene-readback.ts", () => {
  const verifier = readFileSync(
    "recipe/input-field-live-v14-verifier.ts",
    "utf8",
  );
  const contract = readFileSync(
    "recipe/input-field-live-v14-contract.ts",
    "utf8",
  );
  const carried = readFileSync(
    "recipe/input-field-live-v3-verifier-v14.ts",
    "utf8",
  );
  assert.match(verifier, /input-field-live-v3-verifier-v14/);
  assert.doesNotMatch(verifier, /from "\.\/input-field-live-v3-verifier\.js"/);
  assert.doesNotMatch(verifier, /from "\.\/scene-readback\.js"/);
  assert.match(contract, /input-field-live-v3-verifier-v14/);
  assert.doesNotMatch(contract, /from "\.\/input-field-live-v3-verifier\.js"/);
  assert.doesNotMatch(contract, /from "\.\/scene-readback\.js"/);
  assert.match(carried, /from "\.\/scene-readback-v14\.js"/);
  assert.doesNotMatch(carried, /from "\.\/scene-readback\.js"/);
});

test("v11 recovers text role and label when the name carries font-provenance=", () => {
  const helperName =
    "input-field/message/helper :: font-provenance=%7B%22requestedFamily%22%3A%22Roboto%22%7D";
  const scene: SceneNodeSnapshot = {
    ownershipKey: "message",
    type: "TEXT",
    name: helperName,
    width: 120,
    height: 16,
    visible: true,
    opacity: 1,
    characters: "Enter a valid amount",
    fontName: { family: "Roboto", style: "Regular" },
    fontSize: 12,
    lineHeight: { unit: "PIXELS", value: 16 },
    boundVariables: [],
    children: [],
  };
  const v11 = sceneToNormalizedIr(scene);
  assert.equal(v11.kind, "text");
  assert.equal(v11.role, "input-field/message/helper");
  assert.equal(v11.label, "input-field/message/helper");
  const v10 = sceneToNormalizedIrV10(scene);
  assert.equal(v10.kind, "text");
  assert.equal(v10.role, undefined);
  assert.notEqual(v10.label, "input-field/message/helper");
});

test("v11 still reads role :: label :: font-provenance= and ignores variant names", () => {
  const labeled = sceneToNormalizedIr({
    ownershipKey: "label",
    type: "TEXT",
    name: "input-field/label :: Field label :: font-provenance=%7B%7D",
    width: 80,
    height: 16,
    visible: true,
    opacity: 1,
    characters: "Email",
    fontName: { family: "Roboto", style: "Regular" },
    fontSize: 12,
    lineHeight: { unit: "PIXELS", value: 16 },
    boundVariables: [],
    children: [],
  });
  assert.equal(labeled.kind, "text");
  assert.equal(labeled.role, "input-field/label");
  assert.equal(labeled.label, "Field label");
  const variant = sceneToNormalizedIr({
    ownershipKey: "root/children/0",
    type: "COMPONENT",
    name: "Size=medium, State=default",
    width: 320,
    height: 72,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    variantProperties: { Size: "medium", State: "default" },
    boundVariables: [],
    children: [],
  });
  assert.equal(variant.kind, "component");
  assert.equal(variant.role, undefined);
});

test("v11 hashed scene-readback, carried verifier, and writer bytes stay frozen", () => {
  const v11Index = JSON.parse(
    readFileSync(
      "recipe/evidence/input-field-live-pivot-v11/antecedent-index.json",
      "utf8",
    ),
  ) as {
    artifacts: Record<string, { bytes: number; sha256: string }>;
  };
  for (const artifactPath of [
    "recipe/scene-readback-v11.ts",
    "recipe/scene-readback-runtime-v11.ts",
    "recipe/input-field-live-v3-verifier-v11.ts",
    "recipe/input-field-live-v11-verifier.ts",
    "recipe/evidence/input-field-live-pivot-v11/programs/writer.txt",
    "recipe/evidence/input-field-live-pivot-v11/programs/writer-payload.js",
  ] as const) {
    const pinned = v11Index.artifacts[artifactPath];
    assert.ok(pinned, `v11 index missing ${artifactPath}`);
    const bytes = readFileSync(artifactPath);
    assert.equal(bytes.byteLength, pinned.bytes);
    assert.equal(sha256(bytes), pinned.sha256);
  }
});

test("v10 hashed scene-readback and carried verifier bytes stay frozen", () => {
  const v10Index = JSON.parse(
    readFileSync(
      "recipe/evidence/input-field-live-pivot-v10/antecedent-index.json",
      "utf8",
    ),
  ) as {
    artifacts: Record<string, { bytes: number; sha256: string }>;
  };
  for (const artifactPath of [
    "recipe/scene-readback-v10.ts",
    "recipe/scene-readback-runtime-v10.ts",
    "recipe/input-field-live-v3-verifier-v10.ts",
    "recipe/input-field-live-v10-verifier.ts",
  ] as const) {
    const pinned = v10Index.artifacts[artifactPath];
    assert.ok(pinned, `v10 index missing ${artifactPath}`);
    const bytes = readFileSync(artifactPath);
    assert.equal(bytes.byteLength, pinned.bytes);
    assert.equal(sha256(bytes), pinned.sha256);
  }
});

test("v9 hashed scene-readback and v3 verifier bytes stay frozen", () => {
  const v9Index = JSON.parse(
    readFileSync(
      "recipe/evidence/input-field-live-pivot-v9/antecedent-index.json",
      "utf8",
    ),
  ) as {
    artifacts: Record<string, { bytes: number; sha256: string }>;
  };
  for (const artifactPath of [
    "recipe/scene-readback-v9.ts",
    "recipe/scene-readback-runtime-v9.ts",
    "recipe/input-field-live-v3-verifier.ts",
    "recipe/input-field-live-v9-verifier.ts",
  ] as const) {
    const pinned = v9Index.artifacts[artifactPath];
    assert.ok(pinned, `v9 index missing ${artifactPath}`);
    const bytes = readFileSync(artifactPath);
    assert.equal(bytes.byteLength, pinned.bytes);
    assert.equal(sha256(bytes), pinned.sha256);
  }
});
