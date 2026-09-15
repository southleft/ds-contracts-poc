import assert from "node:assert/strict";
import test from "node:test";
import { ContractSchema, walkAnatomy } from "../scripts/contract-schema.js";
import { canonicalJson, revisionOf } from "./contract-provenance.js";
import {
  createFigmaEngine,
  type ComponentData,
  type NodeSpec,
} from "./emit-figma-script.js";
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
function fixture() {
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
const allNodes = (root: NodeSpec): NodeSpec[] => [
  root,
  ...(root.children ?? []).flatMap(allNodes),
];

test("host-qualified compile preserves retained runtime/API and pairs every original part across reordered variants", () => {
  const f = fixture(),
    before = canonicalJson({
      contract: f.contract,
      projection: f.projection,
      tokens: f.tokens,
    });
  const data = f.compile();
  assert.deepEqual(data.nativeSourceCandidate, {
    revision: revisionOf(f.projection),
    purpose: "source-candidate-inspection",
    acceptedContract: null,
  });
  assert.equal(data.variants.length, 2);
  assert.equal(data.variants[0].name, "Variant=(unset)");
  assert.deepEqual(data.boolProps, []);
  assert.deepEqual(data.textProps, []);
  assert.equal(data.stateVariants, undefined);
  for (const variant of data.variants) {
    const nodes = allNodes(variant.spec);
    assert.equal(nodes.length, f.projection.parts.length);
    assert.deepEqual(
      nodes
        .map((node) => canonicalJson(node.nativeSourcePart!.partPath))
        .sort(),
      f.projection.parts.map((part) => canonicalJson(part.partPath)).sort(),
    );
    assert.deepEqual(
      variant.spec.children!.map((node) => node.nativeSourcePart!.partPath[1]),
      ["after", "body", "before"],
    );
    const slots = nodes.filter((node) => node.type === "slot");
    assert.equal(slots.length, 3);
    assert.deepEqual(
      slots.map((node) => node.nativeSourcePart!.contractSlotName).sort(),
      ["after", "before", "children"],
    );
    assert.ok(
      slots.every(
        (node) =>
          !node.children?.length &&
          !node.slotDefault?.length &&
          !node.slotOptional,
      ),
    );
    const hidden = nodes.filter((node) => node.nativeSourceVisible === false);
    assert.deepEqual(
      hidden.map((node) => node.nativeSourcePart!.partPath[1]).sort(),
      ["after", "before"],
    );
    assert.ok(
      hidden.every(
        (node) => node.type === "frame" && node.visibleProp === undefined,
      ),
    );
    assert.ok(
      nodes.every(
        (node) =>
          node.nativeSourcePart !==
          f.projection.parts.find(
            (part) =>
              canonicalJson(part.partPath) ===
              canonicalJson(node.nativeSourcePart!.partPath),
          ),
      ),
    );
  }
  assert.equal(
    canonicalJson({
      contract: f.contract,
      projection: f.projection,
      tokens: f.tokens,
    }),
    before,
  );
  assert.equal(f.binding.version, 0);
  assert.deepEqual(f.contract.props[0].type, { enum: ["secondary"] });
  assert.equal(Object.hasOwn(f.contract.props[0], "default"), false);
  assert.equal(
    f.contract.bindings.code.runtime!.bindingRevision,
    revisionOf(f.binding),
  );
  assert.deepEqual(f.compile(), data);
});

test("missing, stale or altered host registry data cannot admit a candidate", async (t) => {
  for (const mutation of [
    "context",
    "contract",
    "tokens",
    "projection",
    "binding",
    "artifact",
    "mode",
    "coverage",
    "part",
  ] as const)
    await t.test(mutation, () => {
      const f = fixture();
      if (mutation === "context") f.candidates.clear();
      if (mutation === "contract")
        f.contract.anatomy.root.literals = { "padding-inline": "9px" };
      if (mutation === "tokens")
        (f.tokens.primitives.surface as { $value: string }).$value = "#abcdef";
      if (mutation === "projection") f.projection.parts[0].sourceSpan.start++;
      if (mutation === "binding") {
        f.binding.version = 1 as never;
        f.reseal();
      }
      if (mutation === "artifact") f.artifact.interface.writableProperties = [];
      if (mutation === "coverage") {
        f.projection.cases.splice(1, 1);
        f.reseal();
      }
      if (mutation === "part") {
        f.projection.parts[1].partPath = ["root", "unknown"];
        f.reseal();
      }
      if (mutation === "mode") {
        const engine = createFigmaEngine({
          tokens: f.tokens,
          icons: new Map(),
          mode: "light",
          nativeSourceCandidate: f.context,
        });
        assert.throws(
          () => engine.compileComponentData(f.contract, new Map()),
          /NATIVE_SOURCE_CANDIDATE_TOKEN_CONTEXT_CHANGED/,
        );
      } else assert.throws(f.compile, /NATIVE_SOURCE_CANDIDATE_/);
    });
});

test("exact compiler pairing refuses a source part filtered from a variant even after legitimate context resealing", () => {
  const f = fixture();
  f.contract.anatomy.root.parts!.before.declared = { display: "none" };
  f.reseal();
  assert.throws(
    f.compile,
    /NATIVE_SOURCE_CANDIDATE_(?:PART_COVERAGE_INVALID|PART_LOWERING_UNSUPPORTED)/,
  );
});

test("default recursive retained-runtime refusal remains for direct and composed contracts", () => {
  const f = fixture();
  const ordinary = createFigmaEngine({
    tokens: f.tokens,
    icons: new Map(),
    mode: "dark",
  });
  assert.throws(
    () => ordinary.compileComponentData(f.contract, new Map()),
    /RUNTIME-EMISSION-TARGET-UNSUPPORTED/,
  );
  assert.throws(
    () =>
      ordinary.buildComponentScript(
        f.contract,
        new Map([[f.contract.id, f.contract]]),
      ),
    /RUNTIME-EMISSION-TARGET-UNSUPPORTED/,
  );
  const parent = structuredClone(f.contract);
  delete parent.bindings.code.runtime;
  parent.id = "check.source-parent";
  parent.anatomy.root.parts = {
    retained: { component: { id: f.contract.id } },
  };
  assert.throws(
    () =>
      f
        .engine()
        .compileComponentData(parent, new Map([[f.contract.id, f.contract]])),
    /RUNTIME-EMISSION-TARGET-UNSUPPORTED/,
  );
});

test("all candidate component and batch writes remain refused, including copied and marker-stripped data", () => {
  const f = fixture(),
    engine = f.engine(),
    data = engine.compileComponentData(f.contract, new Map());
  assert.throws(
    () =>
      engine.buildComponentScript(
        f.contract,
        new Map([[f.contract.id, f.contract]]),
      ),
    /NATIVE_SOURCE_CANDIDATE_WRITE_CONTEXT_REQUIRED/,
  );
  for (const candidate of [
    data,
    structuredClone(data),
    { ...data, nativeSourceCandidate: null } as unknown as ComponentData,
  ]) {
    assert.throws(
      () => engine.buildBatchScript([candidate], null),
      /NATIVE_SOURCE_CANDIDATE_WRITE_CONTEXT_REQUIRED/,
    );
  }
  const stripped = structuredClone(data);
  delete stripped.nativeSourceCandidate;
  assert.throws(
    () => engine.buildBatchScript([stripped], null),
    /NATIVE_SOURCE_CANDIDATE_WRITE_CONTEXT_REQUIRED/,
  );
  for (const node of stripped.variants.flatMap((variant) =>
    allNodes(variant.spec),
  )) {
    delete node.nativeSourcePart;
    delete node.nativeSourceVisible;
  }
  assert.throws(
    () => engine.buildBatchScript([stripped], null),
    /FIGMA_COMPONENT_DATA_UNVERIFIED/,
  );
  const other = createFigmaEngine({ tokens: f.tokens, icons: new Map() });
  assert.throws(
    () => other.buildBatchScript([stripped], null),
    /FIGMA_COMPONENT_DATA_UNVERIFIED/,
  );
  delete data.nativeSourceCandidate;
  for (const node of data.variants.flatMap((variant) =>
    allNodes(variant.spec),
  )) {
    delete node.nativeSourcePart;
    delete node.nativeSourceVisible;
  }
  assert.throws(
    () => engine.buildBatchScript([data], null),
    /NATIVE_SOURCE_CANDIDATE_WRITE_CONTEXT_REQUIRED/,
  );
});

test("normal compiled batches still work; copied, foreign-engine or mutated batches require guarded recompilation", () => {
  const f = fixture();
  delete f.contract.bindings.code.runtime;
  f.contract.id = "check.ordinary-native";
  f.contract.name = "OrdinaryNativeFixture";
  const engine = f.engine(),
    other = f.engine();
  const data = engine.compileComponentData(f.contract, new Map());
  assert.equal(data.nativeSourceCandidate, undefined);
  assert.ok(
    data.variants.every((v) =>
      allNodes(v.spec).every(
        (node) =>
          node.nativeSourcePart === undefined &&
          node.nativeSourceVisible === undefined,
      ),
    ),
  );
  const script = engine.buildBatchScript([data], null);
  assert.match(script, /const COMPONENTS =/);
  assert.equal(script.includes("nativeSourceCandidate"), false);
  assert.equal(script.includes("nativeSourcePart"), false);
  assert.throws(
    () => engine.buildBatchScript([structuredClone(data)], null),
    /FIGMA_COMPONENT_DATA_UNVERIFIED/,
  );
  assert.throws(
    () => other.buildBatchScript([data], null),
    /FIGMA_COMPONENT_DATA_UNVERIFIED/,
  );
  data.variants[0].spec.nativeSourceVisible = false;
  assert.throws(
    () => engine.buildBatchScript([data], null),
    /NATIVE_SOURCE_CANDIDATE_WRITE_CONTEXT_REQUIRED/,
  );
  delete data.variants[0].spec.nativeSourceVisible;
  data.setName = "Changed after compile";
  assert.throws(
    () => engine.buildBatchScript([data], null),
    /FIGMA_COMPONENT_DATA_UNVERIFIED/,
  );
});
