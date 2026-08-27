import assert from "node:assert/strict";
import test from "node:test";

import {
  validateButtonResizeProbe,
  type ButtonResizeProbe,
} from "./button-usability.js";

const validProbe = (): ButtonResizeProbe => ({
  sourceIntent: "HUG",
  before: {
    width: 96,
    label: {
      characters: "Button",
      fontFamily: "SF Pro",
      fontStyle: "Semibold",
      fontSize: 14,
      fillAlpha: 1,
      visible: true,
      width: 45,
      height: 20,
      x: 25.5,
      horizontalAlignment: "CENTER",
    },
  },
  grown: {
    width: 160,
    label: {
      characters: "Button",
      fontFamily: "SF Pro",
      fontStyle: "Semibold",
      fontSize: 14,
      fillAlpha: 1,
      visible: true,
      width: 45,
      height: 20,
      x: 57.5,
      horizontalAlignment: "CENTER",
    },
  },
  restored: {
    width: 96,
    label: {
      characters: "Button",
      fontFamily: "SF Pro",
      fontStyle: "Semibold",
      fontSize: 14,
      fillAlpha: 1,
      visible: true,
      width: 45,
      height: 20,
      x: 25.5,
      horizontalAlignment: "CENTER",
    },
  },
  restorationBeforeSha256: "a".repeat(64),
  restorationAfterSha256: "a".repeat(64),
});

test("responsive Button resize probe accepts growth, recentering, and restoration", () => {
  assert.deepEqual(validateButtonResizeProbe(validProbe()), []);
});

test("responsive Button resize probe rejects planted geometry and label defects", () => {
  for (const [name, mutate, expected] of [
    [
      "HUG snap-back",
      (probe: ButtonResizeProbe) => (probe.grown.width = probe.before.width),
      /snapped back/,
    ],
    [
      "frozen label",
      (probe: ButtonResizeProbe) => {
        probe.grown.label.x = probe.before.label.x;
      },
      /stayed frozen/,
    ],
    [
      "invisible label",
      (probe: ButtonResizeProbe) => (probe.grown.label.fillAlpha = 0),
      /invisible/,
    ],
    [
      "empty label",
      (probe: ButtonResizeProbe) => (probe.grown.label.characters = " "),
      /empty/,
    ],
    [
      "incorrect alignment",
      (probe: ButtonResizeProbe) =>
        (probe.grown.label.horizontalAlignment = "MIN"),
      /alignment must be CENTER/,
    ],
    [
      "non-restored sizing",
      (probe: ButtonResizeProbe) =>
        (probe.restorationAfterSha256 = "b".repeat(64)),
      /restoration is not exact/,
    ],
  ] as const) {
    const probe = validProbe();
    mutate(probe);
    assert.match(validateButtonResizeProbe(probe).join("\n"), expected, name);
  }
});
