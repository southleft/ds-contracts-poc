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
    (value) => {
      value.status.input.liveV25.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV25.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV25.taughtSurfaceBindingCompileOrder = false;
    },
    (value) => {
      value.status.input.liveV25.v24SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV25.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV25.restartAsV25Attempt2WithoutContentPlaceholderBindingsFieldForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV26.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV26.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV26.taughtContentBindingCompileOrder = false;
    },
    (value) => {
      value.status.input.liveV26.v25SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV26.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV26.restartAsV26Attempt2WithoutContentPlaceholderHeightModeForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV27.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV27.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV27.taughtContentHiddenFixedHeightAsHug = false;
    },
    (value) => {
      value.status.input.liveV27.v26SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV27.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV27.restartAsV27Attempt2WithoutContentPlaceholderLetterSpacingForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV28.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV28.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV28.taughtContentLetterSpacingOmitted = false;
    },
    (value) => {
      value.status.input.liveV28.v27SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV28.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV28.restartAsV28Attempt2WithoutContentPlaceholderTextCaseForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV29.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV29.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV29.taughtContentTextCaseOmitted = false;
    },
    (value) => {
      value.status.input.liveV29.v28SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV29.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV29.restartAsV29Attempt2WithoutContentPlaceholderTextDecorationForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV30.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV30.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV30.taughtContentTextDecorationOmitted = false;
    },
    (value) => {
      value.status.input.liveV30.v29SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV30.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV30.restartAsV30Attempt2WithoutContentRowClipsContentForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV31.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV31.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV31.taughtContentRowClipsContentOmitted = false;
    },
    (value) => {
      value.status.input.liveV31.v30SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV31.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV31.restartAsV31Attempt2WithoutContentRowCornerRadiusForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV32.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV32.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV32.taughtContentRowCornerRadiusOmitted = false;
    },
    (value) => {
      value.status.input.liveV32.v31SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV32.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV32.restartAsV32Attempt2WithoutContentRowEffectsForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV33.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV33.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV33.taughtContentRowEffectsOmitted = false;
    },
    (value) => {
      value.status.input.liveV33.v32SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV33.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV33.restartAsV33Attempt2WithoutContentRowStrokesForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV34.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV34.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV34.taughtContentRowStrokesOmitted = false;
    },
    (value) => {
      value.status.input.liveV34.v33SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV34.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV34.restartAsV34Attempt2WithoutLabelBindingFieldForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV35.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV35.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV35.taughtLabelBindingExtrasDropped = false;
    },
    (value) => {
      value.status.input.liveV35.v34SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV35.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV35.restartAsV35Attempt2WithoutLabelLetterSpacingForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV36.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV36.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV36.taughtLabelLetterSpacingOmitted = false;
    },
    (value) => {
      value.status.input.liveV36.v35SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV36.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV36.restartAsV36Attempt2WithoutLabelTextCaseForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV37.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV37.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV37.taughtLabelTextCaseOmitted = false;
    },
    (value) => {
      value.status.input.liveV37.v36SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV37.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV37.restartAsV37Attempt2WithoutLabelTextDecorationForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV38.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV38.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV38.taughtLabelTextDecorationOmitted = false;
    },
    (value) => {
      value.status.input.liveV38.v37SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV38.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV38.restartAsV38Attempt2WithoutLabelRowClipsContentForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV39.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV39.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV39.taughtLabelRowClipsContentOmitted = false;
    },
    (value) => {
      value.status.input.liveV39.v38SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV39.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV39.restartAsV39Attempt2WithoutLabelRowCornerRadiusForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV40.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV40.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV40.taughtLabelRowCornerRadiusOmitted = false;
    },
    (value) => {
      value.status.input.liveV40.v39SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV40.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV40.restartAsV40Attempt2WithoutLabelRowEffectsForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV41.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV41.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV41.taughtLabelRowEffectsOmitted = false;
    },
    (value) => {
      value.status.input.liveV41.v40SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV41.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV41.restartAsV41Attempt2WithoutLabelRowStrokesForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV42.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV42.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV42.taughtLabelRowStrokesOmitted = false;
    },
    (value) => {
      value.status.input.liveV42.v41SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV42.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV42.restartAsV42Attempt2WithoutSurfaceStrokeDashPatternForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV43.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV43.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV43.taughtSurfaceStrokeDashPatternOmitted = false;
    },
    (value) => {
      value.status.input.liveV43.v42SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV43.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV43.restartAsV43Attempt2WithoutMessageHelperBindingOrderForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV44.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV44.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV44.taughtMessageBindingCompileOrder = false;
    },
    (value) => {
      value.status.input.liveV44.v43SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV44.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV44.restartAsV44Attempt2WithoutMessageLetterSpacingOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV45.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV45.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV45.taughtMessageLetterSpacingOmitted = false;
    },
    (value) => {
      value.status.input.liveV45.v44SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV45.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV45.restartAsV45Attempt2WithoutMessageTextCaseOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV46.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV46.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV46.taughtMessageTextCaseOmitted = false;
    },
    (value) => {
      value.status.input.liveV46.v45SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV46.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV46.restartAsV46Attempt2WithoutMessageTextDecorationOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV47.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV47.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV47.taughtMessageTextDecorationOmitted = false;
    },
    (value) => {
      value.status.input.liveV47.v46SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV47.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV47.restartAsV47Attempt2WithoutMessageContainerClipsContentOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV48.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV48.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV48.taughtMessageContainerClipsContentOmitted =
        false;
    },
    (value) => {
      value.status.input.liveV48.v47SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV48.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV48.restartAsV48Attempt2WithoutMessageContainerCornerRadiusOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV49.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV49.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV49.taughtMessageContainerCornerRadiusOmitted =
        false;
    },
    (value) => {
      value.status.input.liveV49.v48SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV49.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV49.restartAsV49Attempt2WithoutMessageContainerEffectsOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV50.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV50.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV50.taughtMessageContainerEffectsOmitted = false;
    },
    (value) => {
      value.status.input.liveV50.v49SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV50.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV50.restartAsV50Attempt2WithoutMessageContainerStrokesOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV51.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV51.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV51.taughtMessageContainerStrokesOmitted = false;
    },
    (value) => {
      value.status.input.liveV51.v50SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV51.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV51.restartAsV51Attempt2WithoutVariantCornerRadiusOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV52.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV52.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV52.taughtVariantCornerRadiusOmitted = false;
    },
    (value) => {
      value.status.input.liveV52.v51SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV52.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV52.restartAsV52Attempt2WithoutVariantEffectsOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV53.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV53.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV53.taughtVariantEffectsOmitted = false;
    },
    (value) => {
      value.status.input.liveV53.v52SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV53.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV53.restartAsV53Attempt2WithoutVariantStrokesOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV54.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV54.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV54.taughtVariantStrokesOmitted = false;
    },
    (value) => {
      value.status.input.liveV54.v53SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV54.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV54.restartAsV54Attempt2WithoutLeadingSlotBindingCompileOrderForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV55.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV55.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV55.taughtLeadingSlotBindingCompileOrder = false;
    },
    (value) => {
      value.status.input.liveV55.v54SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV55.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV55.restartAsV55Attempt2WithoutTrailingSlotBindingCompileOrderForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV56.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV56.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV56.taughtTrailingSlotBindingCompileOrder = false;
    },
    (value) => {
      value.status.input.liveV56.v55SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV56.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV56.restartAsV56Attempt2WithoutRequiredIndicatorBindingCompileOrderForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV57.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV57.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV57.taughtRequiredIndicatorBindingCompileOrder =
        false;
    },
    (value) => {
      value.status.input.liveV57.v56SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV57.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV57.restartAsV57Attempt2WithoutRequiredIndicatorLetterSpacingOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV58.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV58.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV58.taughtRequiredIndicatorLetterSpacingOmitted =
        false;
    },
    (value) => {
      value.status.input.liveV58.v57SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV58.v16ExtractBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV58.restartAsV58Attempt2WithoutRequiredIndicatorTextCaseOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV59.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV59.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV59.taughtRequiredIndicatorTextCaseOmitted = false;
    },
    (value) => {
      value.status.input.liveV59.v58SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV59.restartAsV59Attempt2WithoutRequiredIndicatorTextDecorationOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV60.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV60.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV60.taughtRequiredIndicatorTextDecorationOmitted =
        false;
    },
    (value) => {
      value.status.input.liveV60.v59SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV60.restartAsV60Attempt2WithoutSetCornerRadiusOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV61.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV61.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV61.taughtSetCornerRadiusOmitted = false;
    },
    (value) => {
      value.status.input.liveV61.v60SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV61.restartAsV61Attempt2WithoutSetEffectsOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV62.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV62.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV62.taughtSetEffectsOmitted = false;
    },
    (value) => {
      value.status.input.liveV62.v61SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV62.restartAsV62Attempt2WithoutSetFillsOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV63.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV63.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV63.taughtSetFillsOmitted = false;
    },
    (value) => {
      value.status.input.liveV63.v62SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV63.restartAsV63Attempt2WithoutSetLayoutModeRewriteForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV64.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV64.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV64.taughtSetLayoutModeHorizontal = false;
    },
    (value) => {
      value.status.input.liveV64.v63SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV64.restartAsV64Attempt2WithoutSetPaddingRewriteForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV65.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV65.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV65.taughtSetLayoutPadding32 = false;
    },
    (value) => {
      value.status.input.liveV65.v64SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV65.restartAsV65Attempt2WithoutWriterSetHugForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV66.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV66.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV66.taughtSetLayoutSizingHorizontalHug = false;
    },
    (value) => {
      value.status.input.liveV66.v65SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV66.v16WriterBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV66.restartAsV66Attempt2WithoutSetStrokesOmitForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV67.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV67.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV67.taughtSetStrokesOmitted = false;
    },
    (value) => {
      value.status.input.liveV67.v66SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV67.v16WriterBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV67.restartAsV67Attempt2WithoutLabelRowBindingOrderForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV68.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV68.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV68.taughtLabelRowBindingCompileOrder = false;
    },
    (value) => {
      value.status.input.liveV68.v67SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV68.v16WriterBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV68.restartAsV68Attempt2WithoutPolarSurfaceBindingOrderForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV69.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV69.overallInputSuccess = true;
    },
    (value) => {
      value.status.input.liveV69.taughtSurfaceBindingItemSpacingCompileOrder =
        false;
    },
    (value) => {
      value.status.input.liveV69.v68SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV69.v16WriterBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV69.restartAsV69Attempt2WithoutAccountingFactValueDiagnosisForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV70.taughtFontProvenanceNameKeyOrder = false;
    },
    (value) => {
      value.status.input.liveV70.v69SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV70.v16WriterBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV70.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV70.inventPolarPixelOrSpreadValuesForbidden = false;
    },
    (value) => {
      value.status.input.liveV71.taughtInstancePayloadFillKind = false;
    },
    (value) => {
      value.status.input.liveV71.v70SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV71.v16WriterBytesUnchanged = false;
    },
    (value) => {
      value.status.input.liveV71.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV71.inventPolarPixelOrSpreadValuesForbidden = false;
    },
    (value) => {
      value.status.input.liveV71.v72SizeAxisOrderOnlyOnBothLibraries = false;
    },
    (value) => {
      value.status.input.liveV72.taughtVariantAxisSizeOrder = false;
    },
    (value) => {
      value.status.input.liveV72.v71SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV72.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV72.inventPolarPixelOrSpreadValuesForbidden = false;
    },
    (value) => {
      value.status.input.liveV72.doNotOpenV73ForPolarWidthOrSpreadValues = false;
    },
    (value) => {
      value.status.input.liveV72.remainingPolarIntrinsicSizeWidthValueDrift =
        false;
    },
    (value) => {
      value.status.input.liveV72.polarWidthAndSpreadNamedRequiredFacts = false;
    },
    (value) => {
      value.status.input.liveV72.v73ClassificationRequiredCompareDropForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV72.v73NotOpened = false;
    },
    (value) => {
      value.status.input.liveV73.taughtUnnamedSourcePxCarriedNotRequiredEquals =
        false;
    },
    (value) => {
      value.status.input.liveV73.v72SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV73.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV73.accountingSilentZeroBoth = false;
    },
    (value) => {
      value.status.input.liveV73.mintStayed = true;
    },
    (value) => {
      value.status.input.liveV73.restartAsV73Attempt2WithoutProbeDiagnosisForbidden =
        false;
    },
    (value) => {
      value.status.input.liveV73.inventPolarPixelOrSpreadValuesForbidden = false;
    },
    (value) => {
      value.status.input.liveV74.taughtProbeFirstSegmentRole = false;
    },
    (value) => {
      value.status.input.liveV74.v73SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV74.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV74.taughtUnnamedSourcePxCarriedNotRequiredEquals =
        false;
    },
    (value) => {
      value.status.input.liveV74.inventPolarPixelOrSpreadValuesForbidden = false;
    },
    (value) => {
      value.status.input.liveV74.mintStayed = true;
    },
    (value) => {
      value.status.input.liveV75.taughtProbePolarReflowAgainstContentText =
        false;
    },
    (value) => {
      value.status.input.liveV75.v74SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV75.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV75.taughtProbeFirstSegmentRole = false;
    },
    (value) => {
      value.status.input.liveV75.inventPolarPixelOrSpreadValuesForbidden = false;
    },
    (value) => {
      value.status.input.liveV75.mintStayed = true;
    },
    (value) => {
      value.status.input.liveV75.taughtProbePolarReflowAgainstContentTextHeld =
        false;
    },
    (value) => {
      value.status.input.liveV75.muiContentFillNewlyFalseAfterSplit = false;
    },
    (value) => {
      value.status.input.liveV76.taughtWriterFirstSegmentBind = false;
    },
    (value) => {
      value.status.input.liveV76.v75SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV76.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV76.v18WriterMinted = false;
    },
    (value) => {
      value.status.input.liveV76.inventPolarPixelOrSpreadValuesForbidden = false;
    },
    (value) => {
      value.status.input.liveV76.mintStayed = true;
    },
    (value) => {
      value.status.input.liveV76.taughtWriterFirstSegmentBindHeld = false;
    },
    (value) => {
      value.status.input.liveV76.muiContentFillStillFalseAfterHiddenDefaultSample =
        false;
    },
    (value) => {
      value.status.input.liveV77.taughtProbeRevealThenMeasureHiddenContentFill =
        false;
    },
    (value) => {
      value.status.input.liveV77.v76SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV77.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV77.v18WriterProgramUnchanged = false;
    },
    (value) => {
      value.status.input.liveV77.inventPolarPixelOrSpreadValuesForbidden = false;
    },
    (value) => {
      value.status.input.liveV77.mintStayed = true;
    },
    (value) => {
      value.status.input.liveV77.taughtProbeRevealThenMeasureHiddenContentFillHeld =
        false;
    },
    (value) => {
      value.status.input.liveV77.contentFillPassedBoth = false;
    },
    (value) => {
      value.status.input.liveV77.muiClip104AndOverlap12Remain = false;
    },
    (value) => {
      value.status.input.liveV78.taughtProbeExcludeOverlayLabelAabb = false;
    },
    (value) => {
      value.status.input.liveV78.v77SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV78.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV78.v18WriterProgramUnchanged = false;
    },
    (value) => {
      value.status.input.liveV78.inventOverlapZeroForbidden = false;
    },
    (value) => {
      value.status.input.liveV78.mintStayed = true;
    },
    (value) => {
      value.status.input.liveV78.taughtProbeExcludeOverlayLabelAabbHeld = false;
    },
    (value) => {
      value.status.input.liveV78.contentFillPassedBoth = false;
    },
    (value) => {
      value.status.input.liveV78.muiClipClearedOverlap12Remain = false;
    },
    (value) => {
      value.status.input.liveV79.taughtWriterHiddenFillOccupancy = false;
    },
    (value) => {
      value.status.input.liveV79.v78SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV79.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV79.v18WriterProgramUnchanged = false;
    },
    (value) => {
      value.status.input.liveV79.v19WriterMinted = false;
    },
    (value) => {
      value.status.input.liveV79.inventOverlapZeroForbidden = false;
    },
    (value) => {
      value.status.input.liveV79.mintStayed = true;
    },
    (value) => {
      value.status.input.liveV79.taughtWriterHiddenFillOccupancyHeld = false;
    },
    (value) => {
      value.status.input.liveV79.recipeCollapseRefusedOpacity = false;
    },
    (value) => {
      value.status.input.liveV79.probeIssued = true;
    },
    (value) => {
      value.status.input.liveV80.taughtContentOpacityOmitted = false;
    },
    (value) => {
      value.status.input.liveV80.v79SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV80.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV80.v19WriterMinted = false;
    },
    (value) => {
      value.status.input.liveV80.inventOverlapZeroForbidden = false;
    },
    (value) => {
      value.status.input.liveV80.liveExecutionOccurred = false;
    },
    (value) => {
      value.status.input.liveV80.mintStayed = true;
    },
    (value) => {
      value.status.input.liveV80.taughtContentOpacityOmittedHeld = false;
    },
    (value) => {
      value.status.input.liveV80.recipeCollapseRefusedVisible = false;
    },
    (value) => {
      value.status.input.liveV80.probeIssued = true;
    },
    (value) => {
      value.status.input.liveV81.taughtCompileCarryLiveVisible = false;
    },
    (value) => {
      value.status.input.liveV81.inventHostVisibleFalseForbidden = false;
    },
    (value) => {
      value.status.input.liveV81.v80SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV81.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV81.v19WriterMinted = false;
    },
    (value) => {
      value.status.input.liveV81.inventOverlapZeroForbidden = false;
    },
    (value) => {
      value.status.input.liveV81.liveExecutionOccurred = false;
    },
    (value) => {
      value.status.input.liveV81.taughtContentOpacityOmitted = false;
    },
    (value) => {
      value.status.input.liveV81.taughtCompileCarryLiveVisibleHeld = false;
    },
    (value) => {
      value.status.input.liveV81.accountingRefusedOpacity = false;
    },
    (value) => {
      value.status.input.liveV81.probeIssued = true;
    },
    (value) => {
      value.status.input.liveV81.mintStayed = true;
    },
    (value) => {
      value.status.input.liveV82.taughtCompileCarryLiveOpacity = false;
    },
    (value) => {
      value.status.input.liveV82.inventOpacityVariableForbidden = false;
    },
    (value) => {
      value.status.input.liveV82.v81SceneReadbackUnchanged = false;
    },
    (value) => {
      value.status.input.liveV82.authorizationPresent = false;
    },
    (value) => {
      value.status.input.liveV82.v19WriterMinted = false;
    },
    (value) => {
      value.status.input.liveV82.inventOverlapZeroForbidden = false;
    },
    (value) => {
      value.status.input.liveV82.liveExecutionOccurred = false;
    },
    (value) => {
      value.status.input.liveV82.taughtContentOpacityOmitted = false;
    },
    (value) => {
      value.status.input.liveV82.inventCompileTextOpacityForbidden = false;
    },
    (value) => {
      value.status.input.liveV82.taughtCompileCarryLiveOpacityHeld = false;
    },
    (value) => {
      value.status.input.liveV82.independentRootAccountingPassed = false;
    },
    (value) => {
      value.status.input.liveV82.recipeCollapseRefusedFixedPoint = false;
    },
    (value) => {
      value.status.input.liveV82.probeIssued = true;
    },
    (value) => {
      value.status.input.liveV82.mintStayed = true;
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
