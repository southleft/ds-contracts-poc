import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { revisionOf } from "../core/contract-provenance.js";
import { semanticHash } from "./semantics.js";
import {
  deriveButtonCandidateSemantics,
  type ButtonCandidateSemanticInput,
} from "./button-candidate-semantics.js";

const source = JSON.parse(
  readFileSync(
    new URL(
      "../extract/fixtures/lit-template/altitude-button.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const recorded = JSON.parse(
  readFileSync(
    new URL(
      "./fixtures/lit-render-match/altitude-button.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
function fixture(): ButtonCandidateSemanticInput {
  const cases = recorded.records.map((record: any) => ({
    id: record.story,
    story: record.story,
    sourceEligible: true,
    problems: [],
    semantics: JSON.parse(record.semantics.json),
    boundTopology: JSON.parse(record.measurement.json).bound,
  }));
  const declaration = structuredClone(cases[0].semantics.declaration);
  // Data-only synthetic trusted-host envelope around the byte-preserved source
  // fixture. This is not a newly verified runtime bundle or browser run.
  const properties = declaration.properties.map((p: any) => ({
    name: p.name,
    typeText: p.typeText,
    writable: p.name !== "slotNodes",
  }));
  properties.push({
    name: "styleModifier",
    typeText: "string",
    writable: true,
  });
  const api = {
    module: { path: "original.js", exportName: "ALButton" },
    declaration: { path: "original.d.ts", exportName: "ALButton" },
    properties,
    writableProperties: properties
      .filter((p: any) => p.writable)
      .map((p: any) => p.name),
    slots: declaration.slots.map((s: any) => ({ name: s.name })),
    peerRuntime: {
      name: "react" as const,
      major: 19 as const,
      mounting: "direct-custom-element" as const,
    },
  };
  return {
    source: structuredClone(source),
    sourceRevision: "0639eccd15bfedc4fa9713d9545a64cef2c0f0a5",
    sourceProgramSha256: semanticHash({ synthetic: "source graph envelope" }),
    declaration,
    declarationProblems: [],
    runtime: {
      artifactRevision: revisionOf({ synthetic: "runtime envelope" }),
      interfaceRevision: revisionOf(api),
      registrationTag: "candidate-original-button",
      interface: api,
      stylesheets: [],
    },
    expectedCaseIds: cases.map((c: any) => c.id),
    cases,
  };
}

test("actual source derives four public variants plus omission, exact slots and full retained API", () => {
  const input = fixture(),
    result = deriveButtonCandidateSemantics(input);
  assert.equal(
    result.status,
    "semantic-candidate",
    JSON.stringify(result.findings),
  );
  assert.equal(result.acceptedContract, null);
  assert.deepEqual(result.variant?.values, [
    "secondary",
    "tertiary",
    "bare",
    "danger",
  ]);
  assert.equal(result.variant?.omission, true);
  assert.equal(result.projectedProps.length, 1);
  assert.equal(result.projectedProps[0].name, "variant");
  assert.equal(result.projectedProps[0].default, undefined);
  assert.equal(result.projectedProps[0].bindings.figma.unsetValue, "(unset)");
  assert.deepEqual(
    result.slots.map((s) => [s.sourceName, s.contractName]),
    [
      ["", "children"],
      ["before", "before"],
      ["after", "after"],
    ],
  );
  assert.equal(result.runtime?.properties.filter((p) => p.writable).length, 15);
  assert.equal(
    result.runtime?.properties.find((p) => p.name === "isPressed")?.typeText,
    "boolean | 'mixed'",
  );
  assert.equal(
    result.runtime?.properties.find((p) => p.name === "slotNodes")?.writable,
    false,
  );
  assert.deepEqual(result.coverage.variants.missing, [
    { kind: "value", value: "tertiary" },
    { kind: "value", value: "bare" },
    { kind: "value", value: "danger" },
  ]);
  assert.equal(
    result.coverage.branches.find((b) => b.tag === "a")?.caseIds.length,
    0,
  );
  assert.equal(
    result.coverage.branches.find((b) => b.tag === "button")?.caseIds.length,
    3,
  );
  assert.equal(result.coverage.cases.expected, 3);
  assert.equal(result.coverage.cases.matched, 3);
  assert.equal(
    JSON.stringify(result).includes("original.d.ts"),
    false,
    "no loader paths in public semantic output",
  );
});

test("equal accessible label and visible consumer text never become a text prop/default", () => {
  const result = deriveButtonCandidateSemantics(fixture());
  const label = result.runtimeOnlyBindings.filter(
    (b) => b.sourceProperty === "label",
  );
  assert.equal(label.length, 2);
  assert.ok(
    label.every(
      (b) => b.channel === "attribute" && b.targetAttribute === "aria-label",
    ),
  );
  assert.equal(
    result.projectedProps.some(
      (p) => p.name === "label" || p.name === "children" || p.name === "href",
    ),
    false,
  );
  const content = result.slots.find((s) => s.sourceName === "")!;
  assert.equal(content.observations.length, 3);
  assert.equal(content.observations[0].assigned[0], "host/0");
  assert.ok(
    content.sourceNodes.every((n) => n.sourceNodeId.startsWith("element:")),
  );
  assert.equal("defaultContent" in content, false);
  assert.equal("text" in content, false);
  assert.equal("sourceProperty" in content, false);
  assert.ok(result.limitations.some((l) => l.includes("slotNotEmpty")));
});

test("refused or absent case is preserved and cannot improve the denominator", () => {
  const input = fixture();
  input.cases[1].sourceEligible = false;
  input.cases[1].problems = ["original-source-refused"];
  input.expectedCaseIds.push("atoms-button--default-disabled");
  const result = deriveButtonCandidateSemantics(input);
  assert.equal(result.cases.length, 4);
  assert.equal(result.coverage.cases.expected, 4);
  assert.equal(result.coverage.cases.matched, 2);
  assert.equal(
    result.cases.find((c) => c.id === input.cases[1].id)?.status,
    "refused",
  );
  assert.deepEqual(
    result.cases.find((c) => c.id === "atoms-button--default-disabled")
      ?.problems,
    ["candidate-case-missing"],
  );
  assert.ok(
    result.coverage.variants.missing.some(
      (s) => s.kind === "value" && s.value === "secondary",
    ),
  );
});

test("tampered source, declarations, runtime types and slot identities fail closed", () => {
  const changes: Array<(input: ButtonCandidateSemanticInput) => void> = [
    (i) => {
      i.source.source += "\n// changed";
    },
    (i) => {
      i.declaration.properties.find((p) => p.name === "variant")!.typeText =
        "'default' | 'secondary'";
    },
    (i) => {
      i.declaration.properties.find((p) => p.name === "variant")!.default =
        "'secondary'";
    },
    (i) => {
      i.runtime.interface.properties.find(
        (p) => p.name === "isPressed",
      )!.typeText = "boolean";
      i.runtime.interfaceRevision = revisionOf(i.runtime.interface);
    },
    (i) => {
      i.runtime.interface.writableProperties =
        i.runtime.interface.writableProperties.filter((n) => n !== "href");
      i.runtime.interfaceRevision = revisionOf(i.runtime.interface);
    },
    (i) => {
      i.declaration.slots.push({ name: "" });
    },
    (i) => {
      i.declaration.slots[1].name = "leading";
    },
    (i) => {
      i.declarationProblems.push({
        code: "invalid-string",
        path: "manifest",
        message: "malformed",
      });
    },
    (i) => {
      i.cases.push(structuredClone(i.cases[0]));
    },
  ];
  for (const change of changes) {
    const input = fixture();
    change(input);
    const result = deriveButtonCandidateSemantics(input);
    assert.equal(result.status, "refused", JSON.stringify(result));
    assert.equal(result.acceptedContract, null);
    assert.equal(result.projectedProps.length, 0);
    assert.equal(
      result.cases.length,
      input.expectedCaseIds.length,
      "source failure still preserves the planned case manifest",
    );
    assert.ok(result.cases.every((row) => row.status === "refused"));
  }
});

test("unknown observed enum, declaration mismatch and altered topology do not count as matched", () => {
  for (const change of [
    (i: ButtonCandidateSemanticInput) => {
      i.cases[0].semantics!.observation.properties.variant = {
        kind: "value",
        value: "default",
      };
    },
    (i: ButtonCandidateSemanticInput) => {
      i.cases[0].semantics!.declaration.tagName = "other-button";
    },
    (i: ButtonCandidateSemanticInput) => {
      i.cases[0].boundTopology!.topology!.observation!.slots[0].name = "before";
    },
  ]) {
    const input = fixture();
    change(input);
    const result = deriveButtonCandidateSemantics(input);
    assert.equal(result.cases[0].status, "refused");
    assert.equal(result.coverage.cases.matched, 2);
  }
});

test("source-span correspondence never claims an observed dynamic binding", () => {
  const input = fixture();
  const semantics = input.cases[0].semantics!;
  // Deliberately contradictory, rehashed synthetic observation: the label
  // property no longer matches its native aria-label. Topology is unchanged.
  semantics.observation.properties.label = {
    kind: "value",
    value: "Unrelated property value",
  };
  semantics.observationSha256 = semanticHash(semantics.observation);
  input.cases[0].boundTopology!.semanticObservationSha256 =
    semantics.observationSha256;
  const result = deriveButtonCandidateSemantics(input);
  assert.equal(
    result.cases[0].status,
    "structure-matched",
    "this reader only rederives structural correspondence, not dynamic behavior",
  );
  const binding = result.runtimeOnlyBindings.find(
    (b) => b.sourceProperty === "label" && b.tag === "button",
  )!;
  assert.equal(
    "observedCaseIds" in binding,
    false,
    "a source span cannot be relabeled as an observed property-to-attribute dependency",
  );
  assert.ok(binding.structurallyMatchedCaseIds.includes(input.cases[0].id));
  assert.equal(binding.dependencyStatus, "unproven");
  assert.equal(result.acceptedContract, null);
});

test("malformed early evidence preserves the fixed planned cases as named refusals", () => {
  const changes: Array<(input: ButtonCandidateSemanticInput) => void> = [
    (input) => {
      input.source = undefined as never;
    },
    (input) => {
      input.declaration = null as never;
    },
    (input) => {
      input.cases = null as never;
    },
    (input) => {
      input.cases[1] = null as never;
    },
  ];
  for (const change of changes) {
    const input = fixture();
    const ids = [...input.expectedCaseIds];
    change(input);
    const result = deriveButtonCandidateSemantics(input);
    assert.equal(result.status, "refused");
    assert.equal(result.acceptedContract, null);
    assert.deepEqual(
      result.cases.map((row) => row.id),
      ids,
    );
    assert.ok(
      result.cases.every(
        (row) => row.status === "refused" && row.problems.length,
      ),
    );
    assert.deepEqual(result.coverage.cases, {
      expected: ids.length,
      matched: 0,
      refused: ids.length,
    });
  }
});

test("a truthy nonboolean source-eligibility marker cannot qualify a case", () => {
  const input = fixture();
  input.cases[0].sourceEligible = "false" as never;
  const result = deriveButtonCandidateSemantics(input);
  assert.equal(result.cases[0].status, "refused");
  assert.equal(result.coverage.cases.expected, 3);
  assert.equal(result.coverage.cases.matched, 2);
});
