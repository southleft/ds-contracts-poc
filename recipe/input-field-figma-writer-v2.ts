import {
  lowerInputFieldFigmaWriter,
  validateInputFieldFigmaSourcePlans,
  type InputFieldFigmaSourcePlan,
  type InputFieldFigmaWriterInput,
} from "./input-field-figma-writer.js";

export const INPUT_FIELD_FIGMA_V2_NAMESPACE = "ds.contracts.input.recipe.v2";
export const INPUT_FIELD_FIGMA_V2_WRITER_VERSION = 2;

export interface InputFieldFigmaWriterV2 {
  pageName: string;
  runIdentity: string;
  sourcePlans: InputFieldFigmaSourcePlan[];
  code: string;
}

export interface InputFieldLiveMockV2 {
  reflow: {
    beforeRoot: number;
    afterRoot: number;
    beforeSurface: number;
    afterSurface: number;
    beforeContent: number;
    afterContent: number;
  };
  overlay: {
    declared: boolean;
    absolute: boolean;
    clipsContent: boolean;
    offsetMatches: boolean;
    descendantsInsideOverlay: boolean;
    notchClearance: number;
  };
  text: {
    width: number;
    height: number;
    expectedFontFamily: string;
    resolvedFontFamily: string;
  };
  restoration: { beforeSha256: string; afterSha256: string };
}

export function validateInputFieldLiveMockV2(
  mock: InputFieldLiveMockV2,
): string[] {
  const failures: string[] = [];
  const rootDelta = mock.reflow.afterRoot - mock.reflow.beforeRoot;
  const surfaceDelta = mock.reflow.afterSurface - mock.reflow.beforeSurface;
  const contentDelta = mock.reflow.afterContent - mock.reflow.beforeContent;
  if (
    rootDelta <= 0 ||
    surfaceDelta !== rootDelta ||
    contentDelta !== rootDelta
  ) {
    failures.push("content fill did not respond exactly to root resize");
  }
  if (
    !mock.overlay.declared ||
    !mock.overlay.absolute ||
    mock.overlay.clipsContent ||
    !mock.overlay.offsetMatches ||
    !mock.overlay.descendantsInsideOverlay
  ) {
    failures.push("floating label is outside its declared overlay bounds");
  }
  if (mock.overlay.notchClearance < 0) {
    failures.push("notch clips or overlaps floating label ink");
  }
  if (mock.text.width <= 0 || mock.text.height <= 0) {
    failures.push("text has zero live geometry");
  }
  if (mock.text.resolvedFontFamily !== mock.text.expectedFontFamily) {
    failures.push("resolved font metrics differ from adapter declaration");
  }
  if (mock.restoration.beforeSha256 !== mock.restoration.afterSha256) {
    failures.push("probe failed exact restoration");
  }
  return failures;
}

/**
 * V2 consumes the same source-neutral recipe IR through a typed lowering
 * program. It never parses or patches generated JavaScript.
 */
export function emitInputFieldFigmaWriterV2(
  inputs: readonly InputFieldFigmaWriterInput[],
  options: {
    namespace?: string;
    runSuffix?: "input-v2" | "input-v5";
  } = {},
): InputFieldFigmaWriterV2 {
  const base = lowerInputFieldFigmaWriter(inputs, {
    version: 2,
    namespace: options.namespace ?? INPUT_FIELD_FIGMA_V2_NAMESPACE,
    runSuffix: options.runSuffix ?? "input-v2",
    overlayPositioning: true,
    restoreFillAfterComponentProperties: true,
    sceneReadbackInstrumentation: true,
  });
  const failures = validateInputFieldFigmaSourcePlans(base.sourcePlans);
  if (failures.length > 0) throw new TypeError(failures.join("; "));
  if (
    !base.code.includes("INPUT-OVERLAY-DECLARATION-INCOMPLETE") ||
    !base.code.includes("INPUT-TEXT-ZERO-WIDTH-AFTER-PROPERTY") ||
    !base.code.includes("INPUT-FONT-METRICS-DRIFT") ||
    !base.code.includes('descendant.layoutSizingHorizontal="FILL"') ||
    !base.code.includes("readSceneDerivedTree")
  ) {
    throw new TypeError("input-field v2 typed lowering is incomplete");
  }
  return {
    pageName: base.pageName,
    runIdentity: base.runIdentity,
    sourcePlans: base.sourcePlans,
    code: base.code,
  };
}
