import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, revisionOf } from "./contract-provenance.js";
import {
  createFigmaEngine,
  type ComponentData,
  type NodeSpec,
} from "./emit-figma-script.js";

import { nativeSourceCompilerFixture as fixture } from "./native-source-test-fixture.js";

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
