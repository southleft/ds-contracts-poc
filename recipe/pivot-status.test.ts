import assert from "node:assert/strict";
import test from "node:test";

import {
  INPUT_LIVE_V3_PROTOCOL_PATH,
  INPUT_LIVE_V3_PROTOCOL_SHA256,
  PIVOT_STATUS_PATH,
  validateInputLiveV4PendingStatus,
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

test("v3 stays exhausted while the historical v4 preparation index remains immutable", () => {
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

test("historical v4 preparation index cannot claim capture, signoff, or criteria changes", () => {
  const index = readRepositoryJson<Record<string, any>>(
    "recipe/evidence/input-field-live-pivot-v4/index.json",
  );
  assert.deepEqual(
    validateInputLiveV4PendingStatus(
      index,
      "6c0c4d772280af24b9387193a5b7723ebfff73eff9e66a89eec9d22ebd4f258b",
    ),
    [],
  );
  for (const mutate of [
    (value: Record<string, any>) => {
      value.authorization.authorized = true;
    },
    (value: Record<string, any>) => {
      value.liveExecutionOccurred = true;
    },
    (value: Record<string, any>) => {
      value.protocolCriteriaAltered = true;
    },
    (value: Record<string, any>) => {
      value.humanSignoff = "passed";
    },
  ]) {
    const value = structuredClone(index);
    mutate(value);
    assert.ok(
      validateInputLiveV4PendingStatus(
        value,
        "6c0c4d772280af24b9387193a5b7723ebfff73eff9e66a89eec9d22ebd4f258b",
      ).length > 0,
    );
  }
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
    (value) => {
      value.status.input.liveV6.authorizationHistoryValid = false;
    },
    (value) => {
      value.status.input.liveV7.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV7.authorizationCanBeAddedWithoutAntecedentRebuild = false;
    },
    (value) => {
      value.status.input.liveV7.security.tokenValuesForbidden = false;
    },
    (value) => {
      value.status.input.liveV8.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV8.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV8.figmaCaptures = 128;
    },
    (value) => {
      value.status.input.liveV8.transportFacts.honorSignedTimeoutRequired = false;
    },
    (value) => {
      value.status.input.liveV9.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV9.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV9.attemptsExecuted = 0;
    },
    (value) => {
      value.status.input.liveV9.restartAsV9Attempt3WithoutCarriedV3VerifierForbidden = false;
    },
    (value) => {
      value.status.input.liveV10.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV10.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV10.liveHostDoesNotImportSceneReadbackTs = false;
    },
    (value) => {
      value.status.input.liveV10.restartAsV10Attempt2WithoutAxisOrderTeachingForbidden = false;
    },
    (value) => {
      value.status.input.liveV10.restartAsV10Attempt3WithoutCarriedFirstSegmentRoleForbidden = false;
    },
    (value) => {
      value.status.input.liveV11.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV11.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV11.taughtFirstSegmentRoleRecovery = false;
    },
    (value) => {
      value.status.input.liveV11.restartAsV11Attempt2WithoutContentFillFixForbidden = false;
    },
    (value) => {
      value.status.input.liveV12.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV12.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV12.taughtPostSettleContentFillRestore = false;
    },
    (value) => {
      value.status.input.liveV12.restartAsV12Attempt2WithoutPostWriterFillRestoreForbidden = false;
    },
    (value) => {
      value.status.input.liveV13.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV13.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV13.taughtPostWriterContentFillRestore = false;
    },
    (value) => {
      value.status.input.liveV13.v12WriterBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV13.remoteRequests = 132;
    },
    (value) => {
      value.status.input.liveV13.restartAsV13Attempt2WithoutHashedRestoreChangeForbidden =
        false;
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
