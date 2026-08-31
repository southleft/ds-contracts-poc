import { createHash } from "node:crypto";

import {
  emitInputFieldFigmaWriterV2,
  type InputFieldFigmaWriterV2,
} from "./input-field-figma-writer-v2.js";
import type { InputFieldFigmaWriterInput } from "./input-field-figma-writer.js";
import { canonicalJson } from "./normalize.js";
import type { InputLiveV4WriterOwnership } from "./input-field-live-v4-journal.js";

export const INPUT_LIVE_V4_WRITER_VERSION = "input-live-v4-writer-v1";
export const INPUT_LIVE_V4_TARGET = Object.freeze({
  fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
  fileName: "Scratch Project",
  editorType: "figma",
});
export const INPUT_LIVE_V4_NAMESPACE = "ds.contracts.input.recipe.v4";

export interface InputLiveV4WriterDraft {
  version: typeof INPUT_LIVE_V4_WRITER_VERSION;
  target: typeof INPUT_LIVE_V4_TARGET;
  pageName: string;
  runIdentity: string;
  portableRuntimeRequired: true;
  strictTransportRequired: true;
  sourceLibraryBranches: false;
  sourcePlans: InputFieldFigmaWriterV2["sourcePlans"];
  code: string;
  codeSha256: string;
}

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export function buildInputLiveV4WriterDraft(
  inputs: readonly InputFieldFigmaWriterInput[],
): InputLiveV4WriterDraft {
  const writer = emitInputFieldFigmaWriterV2(inputs);
  if (inputs.length !== 2 || writer.sourcePlans.some((plan) => plan.cells.length !== 128))
    throw new TypeError("v4 writer requires two independent 128-cell sources");
  return {
    version: INPUT_LIVE_V4_WRITER_VERSION,
    target: INPUT_LIVE_V4_TARGET,
    pageName: writer.pageName.replace(/input-v2$/, "input-v4"),
    runIdentity: writer.runIdentity.replace(/input-v2$/, "input-v4"),
    portableRuntimeRequired: true,
    strictTransportRequired: true,
    sourceLibraryBranches: false,
    sourcePlans: writer.sourcePlans,
    code: writer.code,
    codeSha256: sha256(writer.code),
  };
}

export function assertInputLiveV4WriterResult(
  value: unknown,
): asserts value is InputLiveV4WriterOwnership {
  if (value === null || typeof value !== "object")
    throw new TypeError("v4 writer returned no ownership result");
  const result = value as InputLiveV4WriterOwnership;
  const allIds = [
    result.pageId,
    ...(result.setIds ?? []),
    ...(result.sectionIds ?? []),
    ...(result.collectionIds ?? []),
    ...(result.createdNodeIds ?? []),
  ];
  if (
    allIds.some((id) => typeof id !== "string" || id.length === 0) ||
    new Set(result.setIds).size !== 2 ||
    result.counts?.sources !== 2 ||
    result.counts?.variants !== 256 ||
    result.counts?.collections !== result.collectionIds.length ||
    result.counts?.nodes !== result.createdNodeIds.length ||
    result.createdNodeIds.length === 0
  )
    throw new TypeError("v4 writer result has invalid IDs or zero counts");
}

export function hashInputLiveV4WriterResult(
  value: InputLiveV4WriterOwnership,
): string {
  assertInputLiveV4WriterResult(value);
  return sha256(canonicalJson(value));
}
