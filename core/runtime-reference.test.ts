import assert from "node:assert/strict";
import test from "node:test";
import { ContractSchema, type Contract } from "../scripts/contract-schema.js";
import type { DumpSet } from "../extract/figma/types.js";
import { proposeFromDump } from "./propose-figma.js";
import { tokenCorpusFromJson } from "./token-corpus.js";
import {
  canonicalRevisionOf,
  markAwaitingCodeAdoption,
  revisionOf,
} from "./contract-provenance.js";
import {
  preserveRuntimeReference,
  RuntimeReferenceError,
  type PreserveRuntimeReferenceInput,
  type RuntimeReferenceRefusalCode,
} from "./runtime-reference.js";

const runtime = {
  version: 1 as const,
  kind: "custom-element" as const,
  // Policy fixtures only, not claims about any actual executable artifact.
  artifactRevision: revisionOf("unit fixture artifact"),
  interfaceRevision: revisionOf("unit fixture interface"),
  bindingRevision: revisionOf("unit fixture binding"),
};

function inverted(): Contract {
  const dump: DumpSet = {
    setName: "IdentityProbe",
    type: "COMPONENT_SET",
    propertyDefinitions: {
      Tone: {
        type: "VARIANT",
        defaultValue: "Primary",
        variantOptions: ["Primary", "Secondary"],
      },
    },
    variants: ["Primary", "Secondary"].map((tone) => ({
      name: `Tone=${tone}`,
      type: "COMPONENT" as const,
      variantProperties: { Tone: tone },
      layout: {
        mode: "HORIZONTAL" as const,
        primary: "CENTER" as const,
        counter: "CENTER" as const,
        padding: [0, 0, 0, 0] as [number, number, number, number],
        primarySizing: "AUTO" as const,
        counterSizing: "AUTO" as const,
      },
      fill: { var: tone === "Primary" ? "paint/a" : "paint/b" },
    })),
  };
  const result = proposeFromDump(dump, {
    corpus: tokenCorpusFromJson({
      primitives: {
        paint: {
          a: { $type: "color", $value: "#ffffff" },
          b: { $type: "color", $value: "#000000" },
        },
      },
      semantic: {},
      light: {},
      brandDefault: {},
    }),
    contractIdByName: new Map([["IdentityProbe", "probe.identity"]]),
    fileKey: "unit-fixture-file",
    projectionMode: "exact",
  });
  return ContractSchema.parse(result.contract);
}

function fixture(): PreserveRuntimeReferenceInput {
  const proposed = inverted();
  const base = structuredClone(proposed);
  base.description = "Original canonical description";
  base.bindings.code.anchors = {
    importPath: "@owner/components/button",
    export: "OriginalButton",
  };
  base.bindings.code.runtime = structuredClone(runtime);
  base.provenance = {
    version: 1,
    canonicalRevision: canonicalRevisionOf(base),
    source: {
      kind: "code",
      adapter: "unit-policy-fixture",
      revision: revisionOf("source"),
    },
  };
  const expectedBaseRevision = canonicalRevisionOf(base);
  return {
    base,
    expectedBaseRevision,
    proposed,
    marker: { ...runtimeMarker(), baseRevision: expectedBaseRevision },
  };
}

function runtimeMarker() {
  const { kind: _kind, ...marker } = runtime;
  return marker;
}

function refuses(
  input: PreserveRuntimeReferenceInput,
  code: RuntimeReferenceRefusalCode,
) {
  assert.throws(
    () => preserveRuntimeReference(input),
    (error: unknown) =>
      error instanceof RuntimeReferenceError && error.code === code,
    code,
  );
}

test("actual canvas inversion retains the original runtime and code anchors through the guard", () => {
  const input = fixture();
  assert.deepEqual(input.proposed.bindings.code.anchors, {
    importPath: "src/components/IdentityProbe",
    export: "IdentityProbe",
  });
  assert.equal(input.proposed.bindings.code.runtime, undefined);
  // The actual inverter still loses this identity. A caller that skips the
  // marker/journal guard must now refuse at adoption, not stamp that loss.
  assert.throws(
    () => markAwaitingCodeAdoption(input.base!, input.proposed),
    /RUNTIME-ADOPTION-BINDING-LOST/,
  );
  // No Figma mutation/capture or geometry/behavior qualification is claimed.
  const guarded = preserveRuntimeReference(input);
  assert.deepEqual(guarded.bindings.code, input.base!.bindings.code);
  assert.equal(guarded.description, input.proposed.description);
  assert.deepEqual(guarded.anatomy, input.proposed.anatomy);
  assert.deepEqual(guarded.bindings.figma, input.proposed.bindings.figma);
  assert.equal(guarded.provenance, undefined);
  const adopted = markAwaitingCodeAdoption(input.base!, guarded) as Contract;
  assert.deepEqual(adopted.bindings.code, input.base!.bindings.code);
  assert.equal(
    adopted.provenance!.canonicalRevision,
    canonicalRevisionOf(adopted),
  );
  assert.equal(
    adopted.provenance!.awaitingCodeAdoption!.sourceRevision,
    input.base!.provenance!.source.revision,
  );
});

test("adoption itself refuses changed runtime references without repairing them", () => {
  for (const field of [
    "artifactRevision",
    "interfaceRevision",
    "bindingRevision",
  ] as const) {
    const input = fixture();
    const proposed = structuredClone(input.base!);
    proposed.bindings.code.runtime![field] = revisionOf("replacement");
    const original = structuredClone(proposed);
    assert.throws(
      () => markAwaitingCodeAdoption(input.base!, proposed),
      /RUNTIME-ADOPTION-BINDING-CHANGED/,
    );
    assert.deepEqual(proposed, original);
  }
});

test("adoption itself refuses changed or missing code anchors on a retained runtime", () => {
  for (const key of ["importPath", "export"] as const) {
    const input = fixture();
    const proposed = structuredClone(input.base!);
    proposed.bindings.code.anchors[key] = "different";
    assert.throws(
      () => markAwaitingCodeAdoption(input.base!, proposed),
      /RUNTIME-ADOPTION-ANCHORS-CHANGED/,
    );
  }
  const input = fixture();
  const proposed = structuredClone(input.base!);
  Reflect.deleteProperty(proposed.bindings.code, "anchors");
  assert.throws(
    () => markAwaitingCodeAdoption(input.base!, proposed),
    /RUNTIME-ADOPTION-ANCHORS-CHANGED/,
  );
});

test("adoption cannot introduce a runtime into a runtime-less canonical base", () => {
  const input = fixture();
  const base = structuredClone(input.base!);
  delete base.bindings.code.runtime;
  base.provenance!.canonicalRevision = canonicalRevisionOf(base);
  const proposed = structuredClone(base);
  proposed.bindings.code.runtime = structuredClone(runtime);
  assert.throws(
    () => markAwaitingCodeAdoption(base, proposed),
    /RUNTIME-ADOPTION-BINDING-INTRODUCED/,
  );
});

test("runtime-less generic provenance contracts keep their existing adoption behavior", () => {
  const base = {
    id: "legacy.generic",
    description: "Original generic document",
    provenance: {
      version: 1 as const,
      canonicalRevision: "",
      source: {
        kind: "code" as const,
        adapter: "legacy",
        revision: revisionOf("legacy source"),
      },
    },
  };
  base.provenance.canonicalRevision = canonicalRevisionOf(base);
  const proposed = { id: base.id, description: "Design update" };
  const adopted = markAwaitingCodeAdoption(base, proposed);
  assert.equal(adopted.description, "Design update");
  assert.equal(
    adopted.provenance!.canonicalRevision,
    canonicalRevisionOf(adopted),
  );
  assert.equal(
    adopted.provenance!.awaitingCodeAdoption!.sourceRevision,
    base.provenance.source.revision,
  );
  assert.equal(Object.hasOwn(proposed, "provenance"), false);
});

test("equal incoming runtime is preserved; detached output never mutates either input", () => {
  const input = fixture();
  input.proposed.bindings.code.runtime = structuredClone(runtime);
  input.proposed.provenance = structuredClone(input.base!.provenance);
  const original = structuredClone(input);
  const output = preserveRuntimeReference(input);
  assert.deepEqual(input, original);
  assert.notEqual(output, input.proposed);
  assert.notEqual(
    output.bindings.code.runtime,
    input.base!.bindings.code.runtime,
  );
  assert.notEqual(
    output.bindings.code.anchors,
    input.base!.bindings.code.anchors,
  );
  output.bindings.code.anchors.export = "ChangedOutput";
  (output.anatomy.root.tokens ??= {}).color = "{paint.a}";
  assert.deepEqual(input, original);
  assert.equal(
    output.provenance,
    undefined,
    "incoming provenance cannot attest restored bytes",
  );
});

test("runtime-bound bases require a marker, including when the proposal retains the binding", () => {
  for (const marker of [undefined, null]) {
    const input = fixture();
    input.marker = marker;
    input.proposed.bindings.code.runtime = structuredClone(runtime);
    refuses(input, "RUNTIME_REFERENCE_MARKER_REQUIRED");
  }
});

test("every runtime and base marker revision must match the trusted journal and binding", () => {
  for (const field of [
    "artifactRevision",
    "interfaceRevision",
    "bindingRevision",
    "baseRevision",
  ]) {
    const input = fixture();
    input.marker = {
      ...(input.marker as object),
      [field]: revisionOf("altered"),
    };
    refuses(input, "RUNTIME_REFERENCE_MARKER_MISMATCH");
  }
});

test("unsupported marker shapes and executable-looking extra fields are refused", () => {
  const marker = fixture().marker as Record<string, unknown>;
  const missing = { ...marker };
  delete missing.bindingRevision;
  const malformed = [
    [],
    "marker",
    false,
    0,
    {},
    missing,
    { ...marker, version: 2 },
    { ...marker, module: "https://untrusted.invalid/component.js" },
    { ...marker, artifactRevision: "not-a-sha256" },
    { ...marker, interfaceRevision: `sha256:${"A".repeat(64)}` },
    { ...marker, bindingRevision: null },
    { ...marker, [Symbol("extra")]: true },
    Object.create(marker),
  ];
  for (const value of malformed) {
    const input = fixture();
    input.marker = value;
    refuses(input, "RUNTIME_REFERENCE_MARKER_INVALID");
  }
  let reads = 0;
  const accessor = { ...marker };
  Object.defineProperty(accessor, "artifactRevision", {
    enumerable: true,
    get: () => {
      reads++;
      return runtime.artifactRevision;
    },
  });
  refuses(
    { ...fixture(), marker: accessor },
    "RUNTIME_REFERENCE_MARKER_INVALID",
  );
  assert.equal(reads, 0);
});

test("a correct marker cannot authorize a changed proposed runtime binding", () => {
  for (const field of [
    "artifactRevision",
    "interfaceRevision",
    "bindingRevision",
  ] as const) {
    const input = fixture();
    input.proposed.bindings.code.runtime = {
      ...runtime,
      [field]: revisionOf("replacement"),
    };
    refuses(input, "RUNTIME_REFERENCE_BINDING_CHANGED");
  }
});

test("trusted journal and canonical base must agree, including non-runtime changes", () => {
  for (const expectedBaseRevision of [null, "bad", revisionOf("stale base")]) {
    refuses(
      { ...fixture(), expectedBaseRevision },
      "RUNTIME_REFERENCE_JOURNAL_MISMATCH",
    );
  }
  const changed = fixture();
  delete changed.base!.provenance;
  changed.base!.version = "3.0.0";
  refuses(changed, "RUNTIME_REFERENCE_JOURNAL_MISMATCH");
  const badProvenance = fixture();
  badProvenance.base!.description += " tampered";
  refuses(badProvenance, "RUNTIME_REFERENCE_BASE_INVALID");
  const falseSourceLineage = fixture();
  falseSourceLineage.base!.provenance!.source.revision = "bad";
  refuses(falseSourceLineage, "RUNTIME_REFERENCE_BASE_INVALID");
});

test("a matching self-asserted marker cannot replace the independent journal revision", () => {
  const input = fixture();
  delete input.base!.provenance;
  input.base!.bindings.code.runtime!.artifactRevision = revisionOf(
    "different base artifact",
  );
  input.marker = {
    ...(input.marker as object),
    artifactRevision: input.base!.bindings.code.runtime!.artifactRevision,
    baseRevision: canonicalRevisionOf(input.base!),
  };
  refuses(input, "RUNTIME_REFERENCE_JOURNAL_MISMATCH");
});

test("proposal identity and malformed schema bindings refuse before preservation", () => {
  const input = fixture();
  input.proposed.id = "probe.other";
  refuses(input, "RUNTIME_REFERENCE_CONTRACT_ID_MISMATCH");
  const invalid = fixture();
  invalid.proposed.bindings.code.runtime = {
    ...runtime,
    module: "./evil.js",
  } as never;
  refuses(invalid, "RUNTIME_REFERENCE_PROPOSED_INVALID");
  const invalidBase = fixture();
  invalidBase.base!.bindings.code.runtime = {
    ...runtime,
    kind: "unknown",
  } as never;
  refuses(invalidBase, "RUNTIME_REFERENCE_BASE_INVALID");
});

test("design-led no-base and native-runtime-free bases cannot gain a runtime from canvas", () => {
  for (const withBase of [false, true]) {
    const proposed = inverted();
    const base = withBase ? structuredClone(proposed) : null;
    const input: PreserveRuntimeReferenceInput = {
      proposed,
      base,
      expectedBaseRevision: base ? canonicalRevisionOf(base) : null,
      marker: undefined,
    };
    const output = preserveRuntimeReference(input);
    assert.deepEqual(output, proposed);
    assert.notEqual(output, proposed);
    for (const marker of [fixture().marker, "unsupported-marker"]) {
      refuses({ ...input, marker }, "RUNTIME_REFERENCE_MARKER_UNEXPECTED");
    }
    proposed.bindings.code.runtime = structuredClone(runtime);
    refuses(input, "RUNTIME_REFERENCE_BINDING_UNTRUSTED");
    refuses(
      { ...input, marker: fixture().marker },
      "RUNTIME_REFERENCE_BINDING_UNTRUSTED",
    );
  }
  refuses({ ...fixture(), base: null }, "RUNTIME_REFERENCE_JOURNAL_MISMATCH");
});

test("host journal can bind a pre-provenance canonical base without inventing source provenance", () => {
  const input = fixture();
  delete input.base!.provenance;
  // Provenance is excluded from canonicalRevisionOf; the trusted journal still
  // binds every runtime/anchor/design byte. No code-adoption stamp is invented.
  const output = preserveRuntimeReference(input);
  assert.deepEqual(output.bindings.code, input.base!.bindings.code);
  assert.equal(output.provenance, undefined);
});
