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
      value.status.input.liveV13.restartAsV13Attempt2WithoutHashedRestoreChangeForbidden = false;
    },
    (value) => {
      value.status.input.liveV14.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV14.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV14.taughtTwoPassParentThenContentFillRestore = false;
    },
    (value) => {
      value.status.input.liveV14.v13RestoreBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV14.restartAsV14Attempt2WithoutHashedRestoreChangeForbidden = false;
    },
    (value) => {
      value.status.input.liveV15.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV15.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV15.taughtMeasureFillWhileVisible = false;
    },
    (value) => {
      value.status.input.liveV15.v14RestoreBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV15.restartAsV15Attempt2WithoutPersistedFillAfterHideForbidden = false;
    },
    (value) => {
      value.status.input.liveV16.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV16.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV16.taughtExtractMeasureHiddenContentFillWhileVisible = false;
    },
    (value) => {
      value.status.input.liveV16.v15RestoreBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV16.restartAsV16Attempt2WithoutLeadingSlotSolidPaintForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV17.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV17.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV17.taughtLeadingSlotSolidPaintFromPayloadOrChild =
        false;
    },
    (value) => {
      value.status.input.liveV17.v16RestoreBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV17.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV17.restartAsV17Attempt2WithoutLeadingSlotColorBindingForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV18.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV18.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV18.taughtLeadingSlotColorBindingFromChild = false;
    },
    (value) => {
      value.status.input.liveV18.v17SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV18.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV18.restartAsV18Attempt2WithoutSurfaceStrokeWeightForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV19.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV19.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV19.taughtUniformPerSideStrokeWeightAsStrokes0Weight =
        false;
    },
    (value) => {
      value.status.input.liveV19.v18SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV19.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV19.restartAsV19Attempt2WithoutVariantLayoutWidthForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV20.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV20.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV20.taughtVariantLayoutWidthFromWidthValue = false;
    },
    (value) => {
      value.status.input.liveV20.v19SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV20.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV20.restartAsV20Attempt2WithoutSurfaceLayoutHeightForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV21.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV21.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV21.taughtSurfaceLayoutHeightFromHeightValue =
        false;
    },
    (value) => {
      value.status.input.liveV21.v20SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV21.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV21.restartAsV21Attempt2WithoutVariantBindingsLengthForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV22.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV22.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV22.taughtLayoutBindingAliasWithoutSourceField =
        false;
    },
    (value) => {
      value.status.input.liveV22.v21SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV22.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV22.restartAsV22Attempt2WithoutVariantBindingsFieldForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV23.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV23.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV23.taughtLayoutBindingAliasCompileIndex = false;
    },
    (value) => {
      value.status.input.liveV23.v22SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV23.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV23.restartAsV23Attempt2WithoutSurfaceBindingsLengthForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV24.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV24.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV24.taughtSurfaceBindingExtrasDropped = false;
    },
    (value) => {
      value.status.input.liveV24.v23SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV24.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV24.restartAsV24Attempt2WithoutSurfaceBindingsFieldForbidden =
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
