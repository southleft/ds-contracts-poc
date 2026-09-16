/** State-machine fixture only. Its small synthetic plan is NOT a qualified
 * source projection; production always uses prepareVerifiedNativeOperation. */
import vm from "node:vm";
import { revisionOf } from "../core/contract-provenance.js";
import {
  prepareNativeTokenContext,
  type NativeTokenContextInput,
} from "../core/native-token-context.js";
import { createFigmaMock } from "../scripts/plugin-engine-mock-figma.mjs";
import {
  SOURCE_NATIVE_FILE_KEY,
  type NativeOperationCommand,
  type NativeOperationJobsOptions,
  type NativeOperationPreparation,
  type NativeOperationResult,
} from "./native-operation-jobs.js";

export const nativeFixtureRequest = {
  version: 1 as const,
  baseline: {
    id: "00000000-0000-4000-8000-000000000001",
    sha256: "a".repeat(64),
  },
};
export function nativeFixturePreparation(operation: {
  id: string;
  fileKey: string;
}): NativeOperationPreparation {
  const tokens = {
    ink: { $type: "color", $value: "#4375ff" },
    alias: { $type: "color", $value: "{ink}" },
    radius: { $type: "dimension", $value: "8px" },
  };
  const tokenInput: NativeTokenContextInput = {
    fileKey: operation.fileKey,
    scopeId: `source-${operation.id}`,
    source: {
      revision: "fixture-source",
      sourceProgramSha256: "b".repeat(64),
      tokensSha256: "c".repeat(64),
    },
    tokenPaths: ["alias", "radius"],
    modes: [
      {
        sourceMode: "dark",
        brand: "default",
        nativeModeName: "Dark",
        tokens,
        tokenTreeRevision: revisionOf(tokens),
      },
    ],
  };
  const plan = {
    version: 1,
    purpose: "source-candidate-inspection",
    acceptedContract: null,
    nativeQualification: "unqualified",
    operation,
    tokenInput,
    tokenPreparation: prepareNativeTokenContext(tokenInput),
    component: { variants: [{}] },
    samples: {
      cases: [
        { id: "observed", status: "lowered" },
        { id: "refused", status: "refused" },
      ],
    },
    limitations: ["synthetic-journal-fixture-only"],
  };
  return {
    visual: {
      id: "00000000-0000-4000-8000-000000000002",
      reportSha256: "d".repeat(64),
    },
    preparation: {
      id: "00000000-0000-4000-8000-000000000003",
      reportSha256: "e".repeat(64),
    },
    plan: {
      plan,
      revision: revisionOf(plan),
    } as unknown as NativeOperationPreparation["plan"],
  };
}
export const nativeFixturePrepare: NativeOperationJobsOptions["prepare"] = (
  _request,
  operation,
) => nativeFixturePreparation(operation);

/** Execute the actual generated token writer/readback in the existing native
 * API mock. Supplement immutable identity fields that mock does not model. */
export function nativeFixtureHost() {
  const h = createFigmaMock({ modeLimit: 1 });
  const figma = h.figma as any,
    variables = h.variables as any[],
    collections = h.collections as any[];
  figma.fileKey = SOURCE_NATIVE_FILE_KEY;
  const collection = figma.variables.createVariableCollection.bind(
    figma.variables,
  );
  figma.variables.createVariableCollection = (name: string) => {
    const c = collection(name);
    Object.defineProperties(c, {
      key: { value: `key-${c.id}` },
      remote: { value: false },
      defaultModeId: { get: () => c.modes[0].modeId },
      variableIds: {
        get: () =>
          variables
            .filter((v) => v.variableCollectionId === c.id)
            .map((v) => v.id),
      },
    });
    return c;
  };
  const variable = figma.variables.createVariable.bind(figma.variables);
  figma.variables.createVariable = (...args: any[]) => {
    const v = variable(...args);
    Object.defineProperties(v, {
      key: { value: `key-${v.id}` },
      remote: { value: false },
    });
    return v;
  };
  const run = async (
    command: NativeOperationCommand,
  ): Promise<NativeOperationResult> => {
    const result = await vm.runInNewContext(
      `(async () => {\n${command.script}\n})()`,
      { figma },
      { timeout: 5000 },
    );
    return JSON.parse(
      JSON.stringify({
        version: 1,
        operationId: command.operationId,
        phase: command.phase,
        attemptId: command.attemptId,
        nonce: command.nonce,
        fileKey: command.fileKey,
        planRevision: command.planRevision,
        scriptSha256: command.scriptSha256,
        result,
      }),
    );
  };
  return { figma, variables, collections, run };
}
