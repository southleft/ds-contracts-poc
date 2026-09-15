/** Shared synthetic compiler fixture; never evidence of source fidelity. */
import { ContractSchema, walkAnatomy } from "../scripts/contract-schema.js";
import { revisionOf } from "./contract-provenance.js";
import { createFigmaEngine } from "./emit-figma-script.js";
import {
  runtimeProjectionRevision,
  type RuntimeArtifactForEmission,
} from "./runtime-emission.js";
import type {
  NativeSourceCandidateProjection,
  NativeSourcePartIdentity,
  NativeSourceProjectionContext,
  NativeSourceUnqualifiedBinding,
} from "./native-source-projection.js";
import type { TokenTreeInput } from "./tokens.js";

/** Synthetic host registry for compiler boundary tests only. Its source and
 * evidence hashes are data fixtures, not native or original-runtime proof. */
export function nativeSourceCompilerFixture() {
  const tokens: TokenTreeInput = {
    primitives: {
      surface: { $type: "color", $value: "#123456" },
      space: { $type: "dimension", $value: "8px" },
    },
    semantic: {},
    light: {},
    dark: {},
    brands: { default: {} },
  };
  const contract = ContractSchema.parse({
    id: "check.source-native",
    name: "SourceNativeCandidate",
    version: "0.1.0",
    status: "draft",
    description: "Unaccepted compiler inspection fixture",
    semantics: { element: "button" },
    states: [],
    props: [
      {
        name: "variant",
        type: { enum: ["secondary"] },
        bindings: {
          code: { prop: "variant" },
          figma: {
            kind: "VARIANT",
            property: "Variant",
            unsetValue: "(unset)",
          },
        },
      },
    ],
    anatomy: {
      root: {
        layout: { display: "flex", direction: "row-reverse" },
        tokens: { "background-color": "{surface}", gap: "{space}" },
        parts: {
          before: {
            element: "span",
            layout: { display: "flex" },
            parts: {
              beforeContent: { slot: { name: "before" } },
            },
          },
          body: {
            element: "span",
            layout: { display: "flex" },
            parts: {
              bodyContent: { slot: { name: "children" } },
            },
          },
          after: {
            element: "span",
            layout: { display: "flex" },
            parts: {
              afterContent: { slot: { name: "after" } },
            },
          },
        },
      },
    },
    bindings: {
      code: {
        anchors: { importPath: "original/button.js", export: "OriginalButton" },
      },
      figma: { anchors: { fileKey: null, componentSetKey: null } },
    },
  });
  const iface: RuntimeArtifactForEmission["interface"] = {
    module: { path: "button.js", exportName: "OriginalButton" },
    declaration: { path: "button.d.ts", exportName: "OriginalButton" },
    writableProperties: ["variant"],
    properties: [{ name: "variant", typeText: "'secondary'", writable: true }],
    slots: [{ name: "before" }, { name: "" }, { name: "after" }],
    peerRuntime: {
      name: "react",
      major: 19,
      mounting: "direct-custom-element",
    },
  };
  const artifact: RuntimeArtifactForEmission = {
    artifactRevision: revisionOf({ fixture: "retained-original-runtime" }),
    interfaceRevision: revisionOf(iface),
    registrationTag: "original-button-fixture",
    interface: iface,
    stylesheets: [],
  };
  const binding: NativeSourceUnqualifiedBinding = {
    version: 0,
    kind: "unqualified-source-visual-seed",
    artifactRevision: artifact.artifactRevision,
    interfaceRevision: artifact.interfaceRevision,
    projectionRevision: revisionOf({ fixture: "source-projection" }),
    seedRevision: revisionOf({ fixture: "source-seed" }),
    contractRevision: runtimeProjectionRevision(contract),
    tokenRevision: revisionOf(tokens.primitives),
    properties: [{ contractProp: "variant", sourceProperty: "variant" }],
    slots: [
      { contractSlot: "before", sourceSlot: "before" },
      { contractSlot: "children", sourceSlot: "" },
      { contractSlot: "after", sourceSlot: "after" },
    ],
  };
  contract.bindings.code.runtime = {
    version: 1,
    kind: "custom-element",
    artifactRevision: artifact.artifactRevision,
    interfaceRevision: artifact.interfaceRevision,
    bindingRevision: revisionOf(binding),
  };
  const parts: NativeSourcePartIdentity[] = walkAnatomy(contract).map(
    ({ path, part }, index) => ({
      partPath: path,
      templateId: "template:0:200",
      sourceNodeId: `element:${index * 10}`,
      sourceSpan: {
        start: index * 10,
        end: index * 10 + 5,
        line: index + 1,
        column: 1,
      },
      kind: path.length === 1 ? "root" : part.slot ? "slot" : "wrapper",
      tag: path.length === 1 ? "button" : part.slot ? "slot" : "span",
      ...(part.slot
        ? {
            contractSlotName: part.slot.name,
            sourceSlotName: part.slot.name === "children" ? "" : part.slot.name,
          }
        : {}),
      ...(path.length === 2 && path[1] !== "body"
        ? { emptyMainVisible: false as const }
        : {}),
    }),
  );
  const projection: NativeSourceCandidateProjection = {
    version: 1,
    purpose: "source-candidate-inspection",
    acceptedContract: null,
    nativeQualification: "unqualified",
    contractId: contract.id,
    contractRevision: revisionOf(contract),
    binding,
    source: {
      revision: "a".repeat(40),
      modulePath: "components/button.ts",
      className: "OriginalButton",
      sourceSha256: "b".repeat(64),
      programSha256: "c".repeat(64),
    },
    evidence: {
      reportRevision: revisionOf({ report: 3 }),
      semanticsRevision: revisionOf({ semantics: 1 }),
      visualRevision: revisionOf({ visual: 1 }),
      tokenProjectionRevision: revisionOf({ tokens: 1 }),
      wrapperProjectionRevision: revisionOf({ wrappers: 1 }),
    },
    context: { mode: "dark", brand: "default" },
    parts,
    cases: [undefined, "secondary"].map((value, index) => ({
      id: `source-case-${index}`,
      status: "observed",
      problems: [],
      properties: {
        variant:
          value === undefined ? { kind: "omitted" } : { kind: "value", value },
      },
      projectionRevision: revisionOf({ projection: index }),
      samplesRevision: revisionOf({ samples: index }),
      sourceTreeSha256: "d".repeat(64),
      topologyObservationSha256: "e".repeat(64),
      wrappers: parts
        .filter((p) => p.emptyMainVisible === false)
        .map((p) => ({ partPath: p.partPath, visible: index === 1 })),
    })),
  };
  projection.cases.push({
    id: "source-case-refused",
    status: "refused",
    problems: ["source-case-unqualified"],
  });
  const candidates = new Map<
    string,
    { projection: NativeSourceCandidateProjection; revision: string }
  >();
  const context: NativeSourceProjectionContext = {
    artifacts: new Map([[artifact.artifactRevision, artifact]]),
    candidates,
  };
  const reseal = () => {
    binding.contractRevision = runtimeProjectionRevision(contract);
    binding.tokenRevision = revisionOf(tokens.primitives);
    contract.bindings.code.runtime!.bindingRevision = revisionOf(binding);
    projection.contractRevision = revisionOf(contract);
    candidates.clear();
    candidates.set(contract.bindings.code.runtime!.bindingRevision, {
      projection,
      revision: revisionOf(projection),
    });
  };
  reseal();
  const engine = () =>
    createFigmaEngine({
      tokens,
      icons: new Map(),
      mode: "dark",
      brand: "default",
      nativeSourceCandidate: context,
    });
  const compile = () =>
    engine().compileComponentData(contract, new Map([[contract.id, contract]]));
  return {
    contract,
    tokens,
    artifact,
    binding,
    projection,
    context,
    candidates,
    reseal,
    engine,
    compile,
  };
}
