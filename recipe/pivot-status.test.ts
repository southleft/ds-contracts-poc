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

test("v3 remains exhausted and v4 remains an unauthorized draft", () => {
  const value = fixtures();
  assert.deepEqual(
    validatePivotStatus(
      value.status,
      value.protocol,
      value.index,
      [
        "capture-authorization.json",
        "cleanup-attempt-1.json",
        "cleanup-attempt-2.json",
        "cleanup-attempt-3.json",
        "conformance-report.json",
        "expected-scene-plan-mui.json.gz",
        "expected-scene-plan-polaris.json.gz",
        "index.json",
        "live-attempt-1.json",
        "live-attempt-2.json",
        "live-attempt-3.json",
        "protocol.json",
        "transport-envelope.json",
        "writer-plan.json",
        "writer-wrapper.txt",
        "writer.js",
        "screenshots",
      ],
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
        [
          "capture-authorization.json",
          "cleanup-attempt-1.json",
          "cleanup-attempt-2.json",
          "cleanup-attempt-3.json",
          "conformance-report.json",
          "expected-scene-plan-mui.json.gz",
          "expected-scene-plan-polaris.json.gz",
          "index.json",
          "live-attempt-1.json",
          "live-attempt-2.json",
          "live-attempt-3.json",
          "protocol.json",
          "transport-envelope.json",
          "writer-plan.json",
          "writer-wrapper.txt",
          "writer.js",
          "screenshots",
        ],
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
