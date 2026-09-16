/** Synthetic writer fixture; never live native evidence. */
import assert from "node:assert/strict";
import vm from "node:vm";
import { revisionOf } from "./contract-provenance.js";
import { nativeSourceCompilerFixture } from "./native-source-test-fixture.js";
import {
  emitNativeTokenContextScript,
  emitNativeTokenContextReadbackScript,
} from "./token-set.js";
import {
  verifyNativeTokenContextReceipt,
  type NativeTokenContextInput,
} from "./native-token-context.js";
import { nativeFixtureHost } from "../source-reference/native-operation-test-fixture.js";
import { type NativeSourceWriteContext } from "./native-source-write.js";

export const operation = {
  id: "10000000-0000-4000-8000-000000000001",
  fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
};
export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
export async function comparisonFixture() {
  const f = await fixture();
  const p = f.source.projection;
  const slot = p.parts.find((part) => part.contractSlotName === "children")!;
  const before = p.parts.find((part) => part.contractSlotName === "before")!;
  const slotRecord = (part: typeof slot, specs: any[]) => ({
    identity: {
      templateId: part.templateId,
      sourceNodeId: part.sourceNodeId,
      sourceSpan: part.sourceSpan,
    },
    sourceName: part.sourceSlotName!,
    status: "lowered" as const,
    sampleIds: ["sample-1"],
    sampleRevision: revisionOf({ source: "synthetic content" }),
    specRevision: revisionOf(specs),
    specs,
    problems: [],
  });
  const text = {
    type: "frame",
    name: "sample",
    layout: { mode: "HORIZONTAL", primary: "CENTER", counter: "MIN" },
    lits: { width: 40.5625, height: 24 },
    children: [
      {
        type: "text",
        name: "text",
        characters: "Label",
        fontFamily: "IBM Plex Sans",
        fontStyle: "Semi Bold",
        fontSize: 16,
        lineHeight: { unit: "PIXELS", value: 24 },
        textFillLit: { r: 0.1, g: 0.2, b: 0.3 },
        textAlignH: "CENTER",
      },
    ],
  };
  const samples = {
    version: 1 as const,
    status: "comparison-samples-lowered" as const,
    acceptedContract: null,
    qualification: "comparison-instance-samples-only" as const,
    nativeQualification: "unqualified" as const,
    visualRevision: p.evidence.visualRevision,
    source: {
      revision: p.source.revision,
      sourceSha256: p.source.sourceSha256,
      sourceProgramSha256: p.source.programSha256,
      semanticsRevision: p.evidence.semanticsRevision,
    },
    problems: [],
    cases: p.cases.map((c, i) =>
      c.status === "refused"
        ? {
            id: c.id,
            status: "refused" as const,
            problems: [...c.problems],
            slots: [],
          }
        : {
            id: c.id,
            status: "lowered" as const,
            problems: [],
            sourceTreeSha256: c.sourceTreeSha256,
            topologyObservationSha256: c.topologyObservationSha256,
            slots: [
              slotRecord(slot, [clone(text)]),
              ...(i === 1
                ? [
                    slotRecord(before, [
                      {
                        type: "svg",
                        name: "source icon",
                        iconSize: 24,
                        svg: '<svg viewBox="0 0 20 20"><path d="M0 0H20V20H0Z" fill="#123456"/></svg>',
                      },
                    ]),
                  ]
                : []),
            ],
          },
    ),
  };
  f.context.comparisons = { samples, revision: revisionOf(samples) };
  const repin = () => {
    f.context.comparisons!.revision = revisionOf(samples);
  };
  return { ...f, samples, repin };
}
export async function fixture(paths = ["surface", "space"]) {
  const source = nativeSourceCompilerFixture();
  const host = nativeFixtureHost(),
    { figma } = host;
  const modeCalls: string[] = [];
  // Explicit modes are not represented in the shared mock yet. This shim
  // records exactly what the real API receives; it does not prove layout.
  const prototype = Object.getPrototypeOf(figma.currentPage);
  prototype.setExplicitVariableModeForCollection = function (
    collection: any,
    modeId: string,
  ) {
    assert.equal(collection, host.collections[0]);
    assert.equal(modeId, collection.modes[0].modeId);
    this.explicitVariableModes = { [collection.id]: modeId };
    modeCalls.push(this.id);
  };
  const run = async (script: string) =>
    clone(
      await vm.runInNewContext(
        `(async () => {\n${script}\n})()`,
        { figma, console },
        { timeout: 5000 },
      ),
    );
  const input: NativeTokenContextInput = {
    ...operation,
    scopeId: `source-${operation.id}`,
    source: {
      revision: source.projection.source.revision,
      sourceProgramSha256: source.projection.source.programSha256,
      tokensSha256: "f".repeat(64),
    },
    tokenPaths: paths,
    modes: [
      {
        sourceMode: "dark",
        brand: "default",
        nativeModeName: "Dark",
        tokens: source.tokens.primitives,
        tokenTreeRevision: revisionOf(source.tokens.primitives),
      },
    ],
  };
  const creation = await run(emitNativeTokenContextScript(input).script);
  assert.equal(creation.status, "created-candidate");
  const observed = await run(
    emitNativeTokenContextReadbackScript(input, creation.creationIdentity),
  );
  assert.equal(observed.status, "readback-collected");
  const context: NativeSourceWriteContext = {
    operation,
    tokens: {
      input,
      identity: creation.creationIdentity,
      receipt: observed.receipt,
    },
  };
  assert.equal(
    verifyNativeTokenContextReceipt({
      input,
      expectedIdentity: context.tokens.identity,
      receipt: context.tokens.receipt,
    }).status,
    "native-token-context-observed",
  );
  const emit = () =>
    source
      .engine()
      .buildNativeSourceComponentScript(
        source.contract,
        new Map([[source.contract.id, source.contract]]),
        context,
      );
  return { ...host, source, modeCalls, context, emit, run };
}
