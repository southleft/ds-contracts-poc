import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { adaptReviewedButton } from "./adapters/button.js";
import {
  altitudeButtonAdapterConfig,
  fluentButtonAdapterConfig,
} from "./fixtures/library-buttons.js";
import { emitButtonFigmaWriter } from "./interpret.js";
import {
  BUTTON_V5_WRITER_CLASSES,
  MEASURED_HOST_FACTS,
  assertMeasuredHostEvidencePins,
} from "./measured-host-ledger.js";
import { hashRecipeInstance } from "./recipe.js";
import { buttonRecipe, compileButtonRecipe } from "./recipes/button.js";
import {
  createMeasuredHostSandbox,
  findMeasuredFocusRingGapPair,
  paintedTopEffect,
  replayButtonV5AttemptPayloads,
  scanWriterSource,
} from "./writer-preflight.js";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8"));

const emitCurrentButtonWriter = () =>
  emitButtonFigmaWriter(
    [
      {
        adapterIdentity: "altitude-button-reviewed-v2",
        displayName: "Altitude",
        contract: "examples/altitude/contracts/button.contract.json",
        config: altitudeButtonAdapterConfig,
      },
      {
        adapterIdentity: "fluent-button-reviewed-v2",
        displayName: "Fluent",
        contract: "examples/fluent/contracts/button.contract.json",
        config: fluentButtonAdapterConfig,
      },
    ].map((source) => {
      const instance = adaptReviewedButton(
        readJson(source.contract),
        source.config,
      );
      return {
        adapterIdentity: source.adapterIdentity,
        displayName: source.displayName,
        recipeHash: hashRecipeInstance(buttonRecipe, instance),
        envelope: compileButtonRecipe(instance),
      };
    }),
  );

test("measured-host ledger pins every fact to committed evidence", () => {
  assert.equal(MEASURED_HOST_FACTS.length, 4);
  assert.deepEqual(assertMeasuredHostEvidencePins(), []);
});

test("replay of Button v5 attempt-1 payload catches all three writer classes", () => {
  const report = replayButtonV5AttemptPayloads();
  assert.equal(report.artifactVersion, "writer-preflight-v1");
  assert.equal(report.evidencePinFailures.length, 0);
  assert.equal(report.catchesButtonV5WriterClasses, true);
  for (const classId of BUTTON_V5_WRITER_CLASSES) {
    assert.ok(
      report.buttonV5Attempt1.classIds.includes(classId),
      `attempt-1 must catch ${classId}`,
    );
  }
});

test("current committed Button v5 writer and emitButtonFigmaWriter are clean of the three classes", () => {
  const report = replayButtonV5AttemptPayloads();
  assert.equal(report.currentWriterClean, true);
  const emitted = scanWriterSource(
    emitCurrentButtonWriter().code,
    "emitButtonFigmaWriter",
  );
  for (const classId of BUTTON_V5_WRITER_CLASSES) {
    assert.equal(
      emitted.classIds.includes(classId),
      false,
      `current emit must not carry ${classId}: ${emitted.findings
        .filter((finding) => finding.classId === classId)
        .map((finding) => finding.message)
        .join("; ")}`,
    );
  }
});

test("sandbox: TextEncoder throws the measured Button v5 attempt-1 error", () => {
  const sandbox = createMeasuredHostSandbox();
  assert.throws(
    () => sandbox.run("new TextEncoder()"),
    { name: "TypeError", message: /TextEncoder is not a constructor/ },
  );
});

test("sandbox: setBoundVariableForEffect resets shadow geometry", () => {
  const sandbox = createMeasuredHostSandbox();
  const bound = sandbox.run(`figma.variables.setBoundVariableForEffect(
    { type: "DROP_SHADOW", spread: 4, radius: 0, offset: { x: 0, y: 0 } },
    "color",
    { id: "VariableID:sandbox" }
  )`) as { spread: number; radius: number; offset: { x: number; y: number } };
  assert.equal(bound.spread, 0);
  assert.equal(bound.radius, 0);
  assert.deepEqual(bound.offset, { x: 0, y: 0 });
});

test("sandbox: later effect entries paint on top", () => {
  const sandbox = createMeasuredHostSandbox();
  sandbox.run(
    `assignEffects([{ spread: 2, color: "#ffffffff" }, { spread: 4, color: "#4375ffff" }])`,
  );
  const top = paintedTopEffect(sandbox.paintedEffects);
  assert.equal(top?.spread, 4);
  assert.equal(top?.color, "#4375ffff");
});

test("sandbox: unknown API surface is refused rather than guessed", () => {
  const sandbox = createMeasuredHostSandbox();
  assert.throws(
    () => sandbox.run("figma.createAutoLayout()"),
    /MEASURED-HOST-UNKNOWN-API:figma.createAutoLayout/,
  );
  assert.deepEqual(sandbox.unknownApiCalls, ["figma.createAutoLayout"]);
});

test("sandbox: instance TEXT setProperties refuses an unloaded font", () => {
  const sandbox = createMeasuredHostSandbox();
  assert.throws(
    () => sandbox.run(`instance.setProperties({ Label: "26" })`),
    /Unable to update this text property because the component uses a font that isn't available/,
  );
  sandbox.run(`figma.loadFontAsync({ family: "SF Pro", style: "Regular" })`);
  sandbox.run(`instance.setProperties({ Label: "26" })`);
});

test("each Button v5 class is independently detectable", () => {
  const textEncoderOnly = scanWriterSource(
    `const sanitize = (value) => [...new TextEncoder().encode(value)];`,
    "plant-textencoder",
  );
  assert.ok(
    textEncoderOnly.classIds.includes("plugin-sandbox-no-textencoder"),
  );

  const bindWithoutRestore = scanWriterSource(
    `function bind(base, variable) {
      return figma.variables.setBoundVariableForEffect(base, "color", variable);
    }`,
    "plant-bind-no-restore",
  );
  assert.ok(
    bindWithoutRestore.classIds.includes(
      "setBoundVariableForEffect-resets-shadow-geometry",
    ),
  );

  const gapFirst = scanWriterSource(
    `const PLAN=${JSON.stringify({
      sources: [
        {
          adapterIdentity: "altitude-button-reviewed-v2",
          appearance: {
            "primary/focus-visible": {
              effects: [
                { kind: "drop-shadow", spread: 2, color: "#ffffffff" },
                {
                  kind: "drop-shadow",
                  spread: 4,
                  color: "#4375ffff",
                  variable:
                    "imported.button.root.outline-color-state-focus-visible",
                },
              ],
            },
          },
        },
      ],
    })};`,
    "plant-gap-first",
  );
  assert.ok(gapFirst.classIds.includes("later-effect-entries-paint-on-top"));

  const ringFirst = findMeasuredFocusRingGapPair([
    {
      kind: "drop-shadow",
      spread: 4,
      color: "#4375ffff",
      variable: "imported.button.root.outline-color-state-focus-visible",
    },
    { kind: "drop-shadow", spread: 2, color: "#ffffffff" },
  ]);
  assert.ok(ringFirst);
  assert.ok(ringFirst.ring < ringFirst.gap);
});

test("unknown Plugin API calls are refused by typings, not guessed", () => {
  const scan = scanWriterSource(
    `figma.createPage(); figma.createAutoLayout();`,
    "plant-unknown-api",
  );
  assert.ok(scan.classIds.includes("unknown-api-surface"));
  assert.ok(
    scan.findings.some((finding) =>
      finding.message.includes("createAutoLayout"),
    ),
  );
  assert.equal(
    scan.findings.some((finding) => finding.message.includes("createPage")),
    false,
  );
});
