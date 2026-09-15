import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { readCemDeclarations } from "../extract/adapters/cem.js";
import { semanticHash, type SemanticObservation } from "./semantics.js";
import {
  planSourceContract,
  type ContractPlanInput,
  type HashBoundJson,
} from "./contract-plan.js";

const sha = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const json = (value: unknown): HashBoundJson => {
  const utf8 = JSON.stringify(value, null, 2) + "\n";
  return { utf8, sha256: sha(utf8) };
};
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/contract-plan-button-recorded.json", import.meta.url),
    "utf8",
  ),
);
const payload = Buffer.from(fixture.payload, "base64");
assert.equal(sha(payload), fixture.payloadSha256);
const files: Record<
  string,
  { sha256: string; base64?: string; utf8?: string }
> = JSON.parse(gunzipSync(payload).toString("utf8"));
const bytes = (name: string) => {
  assert.ok(files[name], `Recorded file ${name} exists`);
  const result =
    files[name].utf8 === undefined
      ? Buffer.from(files[name].base64!, "base64")
      : Buffer.from(files[name].utf8!, "utf8");
  assert.equal(
    sha(result),
    files[name].sha256,
    `Raw recorded bytes preserved: ${name}`,
  );
  return result;
};
const raw = (name: string): HashBoundJson => ({
  utf8: bytes(name).toString("utf8"),
  sha256: files[name].sha256,
});
function recorded(): ContractPlanInput {
  const manifest = bytes("manifest.json");
  assert.equal(sha(manifest), fixture.manifestSha256);
  const read = readCemDeclarations(JSON.parse(manifest.toString("utf8")));
  assert.deepEqual(read.problems, []);
  const matches = read.declarations.filter(
    (declaration) => declaration.tagName === "al-button",
  );
  assert.equal(matches.length, 1);
  const declaration = matches[0];
  return {
    component: {
      modulePath: declaration.modulePath,
      className: declaration.className,
      tagName: declaration.tagName,
    },
    source: {
      revision: fixture.sourceRevision,
      manifestPath: fixture.manifestPath,
      manifestSha256: fixture.manifestSha256,
    },
    declaration,
    declarationProblems: read.problems,
    observations: fixture.selectedStories.map((story: string) => ({
      story,
      measurement: raw(`${story}/measurement.json`),
      sourceSemantics: raw(`${story}/source-semantics.json`),
      replaySemantics: raw(`${story}/replay-semantics.json`),
      sourceTree: raw(`${story}/source-tree.json`),
      replayTree: raw(`${story}/replay-tree.json`),
      sourcePng: bytes(`${story}/source.png`),
      replayPng: bytes(`${story}/replay.png`),
    })),
  };
}

/** Synthetic adversarial test copies only. Original fixture bytes are never
 * overwritten. Deliberately repair all content digests so tests exercise the
 * semantic boundary, not just a stale hash. This is not new capture evidence. */
function mutateObservation(
  row: ContractPlanInput["observations"][number],
  change: (observation: SemanticObservation) => void,
) {
  const source = JSON.parse(row.sourceSemantics.utf8);
  change(source.observation);
  source.observationSha256 = semanticHash(source.observation);
  row.sourceSemantics = json(source);
  row.replaySemantics = json(source.observation);
  const measurement = JSON.parse(row.measurement.utf8);
  measurement.semanticIntake.observation = source.observation;
  measurement.semanticIntake.observationSha256 = source.observationSha256;
  row.measurement = json(measurement);
}

test("actual byte-preserved saved Button evidence yields only 2/5 variant planes and preserves its retained declaration inventory", () => {
  const input = recorded();
  const before = JSON.stringify(input);
  const plan = planSourceContract(input);
  assert.equal(
    JSON.stringify(input),
    before,
    "pure reader never mutates evidence",
  );
  assert.equal(plan.status, "blocked");
  assert.equal(plan.acceptedContract, null);
  assert.deepEqual(plan.evidence, {
    observedStories: ["atoms-button--default", "atoms-button--secondary"],
    rejectedStories: [],
  });
  const variant = plan.enumDomains.find(
    (domain) => domain.property === "variant",
  )!;
  assert.equal(variant.observed, 2);
  assert.equal(variant.total, 5);
  assert.equal(variant.omission, true);
  assert.equal(Object.hasOwn(variant, "defaultDeclaration"), false);
  assert.deepEqual(
    variant.states.map(({ stories: _stories, ...state }) => state),
    [
      { kind: "omitted" },
      ...["secondary", "tertiary", "bare", "danger"].map((value) => ({
        kind: "value",
        value,
      })),
    ],
  );
  assert.deepEqual(
    variant.missing,
    ["tertiary", "bare", "danger"].map((value) => ({ kind: "value", value })),
  );
  const type = plan.enumDomains.find((domain) => domain.property === "type")!;
  assert.equal(
    type.states.find(
      (state) => state.kind === "value" && state.value === "submit",
    )!.stories.length,
    0,
    "native submit fallback does not invent a public type default or count an observed host value",
  );
  assert.deepEqual(
    plan.declaration,
    input.declaration,
    "preserve every retained declaration field rather than narrowing to easy renderings",
  );
  assert.ok(
    plan.findings.some(
      (finding) =>
        finding.code === "inherited-and-method-api-unqualified" &&
        finding.channel === "coverage",
    ),
    "retained CEM fields do not qualify inherited members, methods or the complete source API",
  );
  assert.equal(plan.declaration.properties.length, 15);
  assert.deepEqual(
    plan.slots.map((slot) => slot.name),
    ["", "before", "after"],
  );
  assert.ok(
    plan.findings.some(
      (finding) =>
        finding.code === "declared-slot-unobserved" && finding.slot === "after",
    ),
  );
  assert.ok(
    plan.findings.some(
      (finding) =>
        finding.code === "property-domain-unproven" &&
        finding.property === "slotNodes",
    ),
  );
  for (const property of input.declaration.properties)
    assert.ok(
      plan.findings.some(
        (finding) =>
          finding.code === "property-binding-unproven" &&
          finding.property === property.name,
      ),
    );
});

test("same Label string is not proof that API aria label owns editable consumer slot content", () => {
  const plan = planSourceContract(recorded());
  assert.deepEqual(plan.propertyStates[0].properties.label, {
    kind: "value",
    value: "Label",
  });
  assert.deepEqual(plan.slots[0].observations[0].assigned, [
    { kind: "text", text: "Label" },
  ]);
  assert.deepEqual(plan.slots[0].observations[0].fallback, []);
  assert.equal(plan.nativeStates[0].aria["aria-label"], "Label");
  assert.ok(
    plan.findings.some(
      (finding) =>
        finding.code === "slot-content-binding-unproven" && finding.slot === "",
    ),
  );
  assert.ok(
    plan.findings.some(
      (finding) =>
        finding.code === "attribute-binding-unproven" &&
        finding.property === "label",
    ),
  );
  assert.equal(plan.acceptedContract, null);
});

test("mutated raw hashes, embedded semantic hashes and PNG bytes cannot contribute coverage", () => {
  for (const field of [
    "measurement",
    "sourceSemantics",
    "replaySemantics",
    "sourceTree",
    "replayTree",
  ] as const) {
    const input = recorded();
    input.observations[0][field].utf8 += " ";
    const plan = planSourceContract(input);
    assert.deepEqual(plan.evidence.rejectedStories, ["atoms-button--default"]);
    assert.ok(
      plan.findings.some((finding) =>
        finding.code.startsWith("artifact-hash-mismatch:"),
      ),
    );
    assert.equal(
      plan.enumDomains.find((domain) => domain.property === "variant")!
        .observed,
      1,
    );
  }
  const input = recorded();
  const source = JSON.parse(input.observations[0].sourceSemantics.utf8);
  source.observationSha256 = "0".repeat(64);
  input.observations[0].sourceSemantics = json(source);
  assert.ok(
    planSourceContract(input).findings.some(
      (finding) => finding.code === "observation-hash-mismatch",
    ),
  );
  const imageInput = recorded();
  imageInput.observations[0].sourcePng[0] ^= 1;
  assert.ok(
    planSourceContract(imageInput).findings.some(
      (finding) => finding.code === "source-replay-image-mismatch",
    ),
  );
});

test("unknown public enum value refuses even when all observation hashes and status strings agree", () => {
  const input = recorded();
  mutateObservation(input.observations[0], (observation) => {
    observation.properties.variant = { kind: "value", value: "primary" };
  });
  const plan = planSourceContract(input);
  assert.deepEqual(plan.evidence.rejectedStories, ["atoms-button--default"]);
  assert.ok(
    plan.findings.some((finding) =>
      finding.code.includes("declared-property-type-mismatch:variant"),
    ),
  );
  assert.equal(
    plan.enumDomains
      .find((domain) => domain.property === "variant")!
      .states.some(
        (state) => state.kind === "value" && state.value === "primary",
      ),
    false,
  );
});

test("falsely valid readiness status, corrupt trees and mismatched replay are re-derived and rejected", () => {
  const source = recorded();
  const measurement = JSON.parse(source.observations[0].measurement.utf8);
  measurement.source.observation.fontsReady = false;
  assert.equal(measurement.source.status, "valid");
  source.observations[0].measurement = json(measurement);
  assert.ok(
    planSourceContract(source).findings.some((finding) =>
      finding.code.includes("source-readiness-invalid:fonts-not-ready"),
    ),
  );
  const treeInput = recorded();
  const tree = JSON.parse(treeInput.observations[0].sourceTree.utf8);
  tree.tree.syntheticCorruption = true;
  treeInput.observations[0].sourceTree = json(tree);
  assert.ok(
    planSourceContract(treeInput).findings.some(
      (finding) => finding.code === "source-replay-tree-mismatch",
    ),
  );
  const replayInput = recorded();
  const replay = JSON.parse(replayInput.observations[0].replaySemantics.utf8);
  replay.properties.label.value = "Different";
  replayInput.observations[0].replaySemantics = json(replay);
  assert.ok(
    planSourceContract(replayInput).findings.some(
      (finding) => finding.code === "semantic-replay-mismatch",
    ),
  );
});

test("malformed runtime payload and ambiguous story identity refuse without throwing or partial counting", () => {
  const malformed = recorded();
  const source = JSON.parse(malformed.observations[0].sourceSemantics.utf8);
  source.observation.nativeElements = null;
  malformed.observations[0].sourceSemantics = json(source);
  assert.ok(
    planSourceContract(malformed).findings.some(
      (finding) => finding.code === "artifact-shape-invalid:source-semantics",
    ),
  );
  const duplicate = recorded();
  duplicate.observations.push(duplicate.observations[0]);
  const plan = planSourceContract(duplicate);
  assert.deepEqual(plan.evidence.observedStories, ["atoms-button--secondary"]);
  assert.equal(
    plan.findings.filter(
      (finding) => finding.code === "story-identity-ambiguous",
    ).length,
    2,
  );
});

test("a recorded capture error cannot contribute coverage despite successful fields and matching hashes", () => {
  for (const error of ["capture-or-replay-failed", "", null]) {
    const input = recorded();
    const measurement = JSON.parse(input.observations[0].measurement.utf8);
    measurement.error = error;
    input.observations[0].measurement = json(measurement);

    const plan = planSourceContract(input);
    assert.deepEqual(plan.evidence.observedStories, ["atoms-button--secondary"]);
    assert.deepEqual(plan.evidence.rejectedStories, ["atoms-button--default"]);
    assert.ok(plan.findings.some((finding) => finding.code === "artifact-shape-invalid:measurement"));
    const variant = plan.enumDomains.find((domain) => domain.property === "variant")!;
    assert.equal(variant.total, 5, "refusal preserves the complete declared/omitted domain");
    assert.equal(variant.observed, 1);
    assert.ok(variant.missing.some((state) => state.kind === "omitted"));
    assert.ok(plan.propertyStates.every((row) => row.story !== "atoms-button--default"));
    assert.ok(plan.slots.every((slot) => slot.observations.every((row) => row.story !== "atoms-button--default")));
    assert.ok(plan.nativeStates.every((row) => row.story !== "atoms-button--default"));
  }
});

test("explicit recorded refusal and unobserved native properties cannot be erased by empty problem lists", () => {
  for (const field of [
    "measurement",
    "sourceSemantics",
    "sourceTree",
    "replayTree",
  ] as const) {
    const input = recorded();
    const record = JSON.parse(input.observations[0][field].utf8);
    if (field === "measurement") record.source.status = "invalid";
    else record.status = "refused";
    input.observations[0][field] = json(record);
    assert.deepEqual(planSourceContract(input).evidence.rejectedStories, [
      "atoms-button--default",
    ]);
  }
  const input = recorded();
  mutateObservation(input.observations[0], (observation) => {
    observation.nativeElements[0].properties.disabled = { kind: "unreadable" };
  });
  assert.ok(
    planSourceContract(input).findings.some(
      (finding) => finding.code === "native-property-unobserved",
    ),
  );
});

test("native disabled false remains distinct from aria-disabled true and from the source property", () => {
  const input = recorded();
  mutateObservation(input.observations[0], (observation) => {
    observation.properties.isAriaDisabled = { kind: "value", value: true };
    observation.nativeElements[0].attributes["aria-disabled"] = "true";
  });
  const plan = planSourceContract(input);
  assert.deepEqual(plan.nativeStates[0].native.disabled, {
    kind: "value",
    value: false,
  });
  assert.equal(plan.nativeStates[0].aria["aria-disabled"], "true");
  assert.deepEqual(plan.propertyStates[0].properties.isDisabled, {
    kind: "undefined",
  });
  assert.deepEqual(plan.propertyStates[0].properties.isAriaDisabled, {
    kind: "value",
    value: true,
  });
  for (const property of ["isDisabled", "isAriaDisabled"])
    assert.ok(
      plan.findings.some(
        (finding) =>
          finding.code === "attribute-binding-unproven" &&
          finding.property === property,
      ),
    );
  assert.ok(
    plan.findings.some(
      (finding) => finding.code === "interaction-contract-unproven",
    ),
  );
  assert.equal(plan.acceptedContract, null);
});

test("synthetically completing one enum axis still cannot accept bindings, behavior or cross-product coverage", () => {
  const input = recorded();
  for (const value of ["tertiary", "bare", "danger"]) {
    const row = structuredClone(input.observations[1]);
    row.story = `synthetic-not-captured-${value}`;
    const measured = JSON.parse(row.measurement.utf8);
    measured.story = row.story;
    row.measurement = json(measured);
    mutateObservation(row, (observation) => {
      observation.properties.variant = { kind: "value", value };
    });
    input.observations.push(row);
  }
  const plan = planSourceContract(input);
  assert.equal(
    plan.enumDomains.find((domain) => domain.property === "variant")!.observed,
    5,
  );
  assert.deepEqual(
    plan.enumDomains.find((domain) => domain.property === "variant")!.missing,
    [],
  );
  assert.equal(plan.status, "blocked");
  assert.equal(plan.acceptedContract, null);
  for (const code of [
    "property-binding-unproven",
    "slot-content-binding-unproven",
    "token-bindings-unproven",
    "interaction-contract-unproven",
    "cross-product-coverage-unproven",
  ])
    assert.ok(plan.findings.some((finding) => finding.code === code));
});

test("manifest/declaration identity and reader problems must corroborate captured records", () => {
  const manifest = recorded();
  manifest.source.manifestSha256 = "1".repeat(64);
  assert.ok(
    planSourceContract(manifest).findings.some(
      (finding) => finding.code === "manifest-identity-mismatch",
    ),
  );
  const altered = recorded();
  altered.declaration.properties.find(
    (property) => property.name === "variant",
  )!.default = "'secondary'";
  assert.ok(
    planSourceContract(altered).findings.some(
      (finding) => finding.code === "declaration-hash-mismatch",
    ),
  );
  const ambiguous = recorded();
  ambiguous.declarationProblems = [
    {
      code: "ambiguous-field",
      path: "modules[0]",
      message: "Multiple mappings",
    },
  ];
  assert.deepEqual(planSourceContract(ambiguous).evidence.observedStories, []);
  assert.ok(
    planSourceContract(ambiguous).findings.some(
      (finding) => finding.code === "declaration-evidence-invalid",
    ),
  );
});
