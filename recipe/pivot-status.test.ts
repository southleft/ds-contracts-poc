import assert from "node:assert/strict";
import test from "node:test";

import {
  INPUT_LIVE_V3_PROTOCOL_PATH,
  INPUT_LIVE_V3_PROTOCOL_SHA256,
  PIVOT_STATUS_PATH,
  validatePivotStatus,
} from "./pivot-status.js";
import { readRepositoryJson } from "./evidence-path.js";

const fixtures = () => ({
  status: readRepositoryJson<Record<string, any>>(PIVOT_STATUS_PATH),
  protocol: readRepositoryJson<Record<string, any>>(
    INPUT_LIVE_V3_PROTOCOL_PATH,
  ),
  index: readRepositoryJson<Record<string, any>>(
    "recipe/evidence/input-field-live-pivot-v3/index.json",
  ),
});

test("committed v3 criterion remains false with capture authorization separated", () => {
  const value = fixtures();
  assert.deepEqual(
    validatePivotStatus(
      value.status,
      value.protocol,
      value.index,
      ["capture-authorization.json", "index.json", "protocol.json"],
      INPUT_LIVE_V3_PROTOCOL_SHA256,
    ),
    [],
  );
});

test("status gate rejects chronology, success, capture, hash, and criterion lies", () => {
  const plants: Array<(value: ReturnType<typeof fixtures>) => void> = [
    (value) => {
      value.status.chronology.externallyVerifiable = false;
    },
    (value) => {
      value.status.button.overallSuccess = true;
    },
    (value) => {
      value.status.input.liveV2.result = "passed";
    },
    (value) => {
      value.protocol.chronology.captureAuthorized = true;
    },
    (value) => {
      value.protocol.visualRelativeProgression.exactPixelDifference =
        "acceptance";
    },
    (value) => {
      value.index.result = {};
    },
  ];
  for (const plant of plants) {
    const value = fixtures();
    plant(value);
    assert.ok(
      validatePivotStatus(
        value.status,
        value.protocol,
        value.index,
        ["capture-authorization.json", "index.json", "protocol.json"],
        INPUT_LIVE_V3_PROTOCOL_SHA256,
      ).length > 0,
    );
  }
  const value = fixtures();
  assert.ok(
    validatePivotStatus(
      value.status,
      value.protocol,
      value.index,
      [
        "capture-authorization.json",
        "index.json",
        "protocol.json",
        "capture.png",
      ],
      "0".repeat(64),
    ).length >= 2,
  );
});
