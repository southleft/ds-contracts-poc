import { readFileSync } from "node:fs";
import {
  EXACT_PROJECTION_REFUSAL_CODES,
  type ExactDumpSet,
  type ExactProjectionRefusalCode,
  type ExactVariantRow,
  validateExactVariantProjection,
} from "./exact-projection.js";

const failures: string[] = [];
let checks = 0;
const grammar = JSON.parse(
  readFileSync(new URL("../../accuracy/grammar.json", import.meta.url), "utf8"),
) as { variantRecoveryRefusals?: string[] };

const check = (label: string, condition: boolean): void => {
  checks += 1;
  if (!condition) failures.push(label);
  console.log(`  ${condition ? "✔" : "✖"} ${label}`);
};

const rows = (
  properties: Record<string, readonly string[]>,
): ExactVariantRow[] => {
  const entries = Object.entries(properties);
  let tuples: Record<string, string>[] = [{}];
  for (const [name, options] of entries) {
    tuples = tuples.flatMap((tuple) =>
      options.map((option) => ({ ...tuple, [name]: option })),
    );
  }
  return tuples.map((variantProperties) => ({ variantProperties }));
};

const exactSet = (): ExactDumpSet => ({
  setName: "Button",
  type: "COMPONENT_SET",
  propertyDefinitions: {
    Size: {
      type: "VARIANT",
      defaultValue: "Sm",
      variantOptions: ["Sm", "Lg"],
    },
    Tone: {
      type: "VARIANT",
      defaultValue: "Neutral",
      variantOptions: ["Neutral", "Danger"],
    },
    "Label#17:4": {
      type: "TEXT",
      defaultValue: "Continue",
    },
  },
  variants: rows({
    Size: ["Sm", "Lg"],
    Tone: ["Neutral", "Danger"],
  }),
});

const codes = (
  set: ExactDumpSet,
  returned?: readonly ExactVariantRow[],
): ExactProjectionRefusalCode[] => {
  const result = validateExactVariantProjection(set, returned);
  return result.status === "refused"
    ? result.refusals.map((refusal) => refusal.code)
    : [];
};

const hasCode = (
  set: ExactDumpSet,
  code: ExactProjectionRefusalCode,
  returned?: readonly ExactVariantRow[],
): boolean => codes(set, returned).includes(code);

console.log("Exact variant projection validator");

console.log("\n1. Legacy and exact success");
const legacy = validateExactVariantProjection({
  setName: "Legacy",
  variants: [{ name: "Size=Sm" }, { name: "Size=Lg" }],
});
check(
  "a dump with no structured evidence is legacy-unverified",
  legacy.status === "legacy-unverified",
);
const definitionsOnly: ExactDumpSet = {
  setName: "DefinitionsOnly",
  type: "COMPONENT_SET",
  propertyDefinitions: {
    Size: {
      type: "VARIANT",
      defaultValue: "Sm",
      variantOptions: ["Sm", "Lg"],
    },
  },
  variants: [{ name: "Size=Sm" }, { name: "Size=Lg" }],
};
check(
  "set-level definitions without row tuples are legacy-unverified (never invented)",
  validateExactVariantProjection(definitionsOnly).status ===
    "legacy-unverified",
);

const exact = validateExactVariantProjection(exactSet());
check(
  "a complete source matrix is source-matrix-verified, not projection-exact",
  exact.status === "source-matrix-verified",
);
check(
  "verified metadata reports the exact 4-row cardinality",
  exact.status === "source-matrix-verified" &&
    exact.expectedCount === 4 &&
    exact.observedCount === 4,
);
check(
  "the tuple-set digest is a full lowercase SHA-256",
  exact.status === "source-matrix-verified" &&
    /^[a-f0-9]{64}$/.test(exact.tupleSetHash),
);

const reordered = exactSet();
reordered.propertyDefinitions = {
  Tone: {
    type: "VARIANT",
    defaultValue: "Neutral",
    variantOptions: ["Danger", "Neutral"],
  },
  Size: {
    type: "VARIANT",
    defaultValue: "Sm",
    variantOptions: ["Lg", "Sm"],
  },
};
reordered.variants = [...reordered.variants].reverse().map((row) => ({
  variantProperties: Object.fromEntries(
    Object.entries(row.variantProperties ?? {}).reverse(),
  ),
}));
const reorderedResult = validateExactVariantProjection(reordered);
check(
  "definition, option, row, and tuple-key ordering do not change the hash",
  exact.status === "source-matrix-verified" &&
    reorderedResult.status === "source-matrix-verified" &&
    reorderedResult.tupleSetHash === exact.tupleSetHash,
);

const standalone: ExactDumpSet = {
  setName: "Logo",
  type: "COMPONENT",
  variants: [{}],
};
const standaloneSource = validateExactVariantProjection(standalone);
check(
  "a standalone COMPONENT is the exact one-row, zero-axis source matrix",
  standaloneSource.status === "source-matrix-verified" &&
    standaloneSource.expectedCount === 1 &&
    standaloneSource.observedCount === 1 &&
    JSON.stringify(standaloneSource.tuples) === JSON.stringify(["[]"]),
);
check(
  "a returned standalone COMPONENT row upgrades source proof to returned exactness",
  validateExactVariantProjection(standalone, [{}]).status === "verified-exact",
);
const standaloneExtra: ExactDumpSet = {
  ...standalone,
  variants: [{}, {}],
};
check(
  "multiple standalone COMPONENT rows refuse the zero-axis Cartesian matrix",
  hasCode(standaloneExtra, "EXACT_TUPLE_DUPLICATE") ||
    hasCode(standaloneExtra, "EXACT_MATRIX_RAGGED"),
);

console.log("\n2. Definition falsification");
const partialEvidence = exactSet();
delete partialEvidence.propertyDefinitions;
check(
  "tuple evidence without definitions refuses EXACT_DEFINITIONS_MISSING",
  hasCode(partialEvidence, "EXACT_DEFINITIONS_MISSING"),
);

for (const [label, definition] of [
  ["missing variantOptions", { type: "VARIANT", defaultValue: "Sm" }],
  [
    "empty variantOptions",
    { type: "VARIANT", defaultValue: "Sm", variantOptions: [] },
  ],
  [
    "non-string option",
    { type: "VARIANT", defaultValue: "Sm", variantOptions: ["Sm", 1] },
  ],
  ["missing defaultValue", { type: "VARIANT", variantOptions: ["Sm", "Lg"] }],
  [
    "default outside options",
    { type: "VARIANT", defaultValue: "Md", variantOptions: ["Sm", "Lg"] },
  ],
  [
    "duplicate options",
    { type: "VARIANT", defaultValue: "Sm", variantOptions: ["Sm", "Sm"] },
  ],
] as const) {
  const set = exactSet();
  set.propertyDefinitions = { Size: definition };
  check(
    `${label} refuses EXACT_DEFINITION_CONTRADICTORY`,
    hasCode(set, "EXACT_DEFINITION_CONTRADICTORY"),
  );
}

const noVariantDefinition = exactSet();
noVariantDefinition.propertyDefinitions = {
  "Label#17:4": { type: "TEXT", defaultValue: "Continue" },
};
check(
  "definitions with no VARIANT authority refuse EXACT_DEFINITIONS_MISSING",
  hasCode(noVariantDefinition, "EXACT_DEFINITIONS_MISSING"),
);

const propertyCollision = exactSet();
propertyCollision.propertyDefinitions = {
  "Show Actions": {
    type: "VARIANT",
    defaultValue: "No",
    variantOptions: ["No", "Yes"],
  },
  "show-actions": {
    type: "VARIANT",
    defaultValue: "Off",
    variantOptions: ["Off", "On"],
  },
};
check(
  "distinct source properties that share a contract name refuse EXACT_PROPERTY_CANONICAL_COLLISION",
  hasCode(propertyCollision, "EXACT_PROPERTY_CANONICAL_COLLISION"),
);

const valueCollision = exactSet();
valueCollision.propertyDefinitions = {
  Weight: {
    type: "VARIANT",
    defaultValue: "Semi Bold",
    variantOptions: ["Semi Bold", "semi-bold"],
  },
};
check(
  "distinct source values that share an enum spelling refuse EXACT_VALUE_CANONICAL_COLLISION",
  hasCode(valueCollision, "EXACT_VALUE_CANONICAL_COLLISION"),
);

console.log("\n3. Tuple falsification");
const missingTuple = exactSet();
missingTuple.variants[0] = {};
check(
  "a row without variantProperties refuses EXACT_TUPLE_MISSING",
  hasCode(missingTuple, "EXACT_TUPLE_MISSING"),
);

const incompleteTuple = exactSet();
incompleteTuple.variants[0] = { variantProperties: { Size: "Sm" } };
check(
  "an incomplete tuple refuses EXACT_TUPLE_INCOMPLETE",
  hasCode(incompleteTuple, "EXACT_TUPLE_INCOMPLETE"),
);

const unknownProperty = exactSet();
unknownProperty.variants[0] = {
  variantProperties: { Size: "Sm", Tone: "Neutral", State: "Rest" },
};
check(
  "an undeclared verbatim tuple key refuses EXACT_TUPLE_UNKNOWN_PROPERTY",
  hasCode(unknownProperty, "EXACT_TUPLE_UNKNOWN_PROPERTY"),
);

const invalidValue = exactSet();
invalidValue.variants[0] = {
  variantProperties: { Size: "Md", Tone: "Neutral" },
};
check(
  "a value outside variantOptions refuses EXACT_TUPLE_INVALID_VALUE",
  hasCode(invalidValue, "EXACT_TUPLE_INVALID_VALUE"),
);

const duplicateTuple = exactSet();
duplicateTuple.variants[3] = structuredClone(duplicateTuple.variants[0]);
check(
  "a repeated canonical tuple refuses EXACT_TUPLE_DUPLICATE",
  hasCode(duplicateTuple, "EXACT_TUPLE_DUPLICATE"),
);

console.log("\n4. Ragged Cartesian matrix");
const positions = ["0", "1", "2", "3"];
const sliderRows = rows({
  Left: positions,
  Right: positions,
  Filled: ["No", "Yes"],
  Focused: ["No", "Yes"],
}).filter((row) => {
  const tuple = row.variantProperties!;
  return Number(tuple.Left) <= Number(tuple.Right);
});
const slider: ExactDumpSet = {
  setName: "Slider",
  type: "COMPONENT_SET",
  propertyDefinitions: {
    Left: { type: "VARIANT", defaultValue: "0", variantOptions: positions },
    Right: { type: "VARIANT", defaultValue: "0", variantOptions: positions },
    Filled: {
      type: "VARIANT",
      defaultValue: "No",
      variantOptions: ["No", "Yes"],
    },
    Focused: {
      type: "VARIANT",
      defaultValue: "No",
      variantOptions: ["No", "Yes"],
    },
  },
  variants: sliderRows,
};
const sliderResult = validateExactVariantProjection(slider);
check(
  "the constrained Slider fixture contains exactly 40 observed rows",
  sliderRows.length === 40,
);
check(
  "the 40/64 Slider matrix refuses EXACT_MATRIX_RAGGED",
  sliderResult.status === "refused" &&
    sliderResult.code === "EXACT_MATRIX_RAGGED" &&
    sliderResult.refusals[0].expected === 64 &&
    sliderResult.refusals[0].actual === 40,
);

console.log("\n5. Returned projection falsification");
const source = exactSet();
const returnedExact = structuredClone(source.variants);
check(
  "an ordering-changed return preserves exactness",
  validateExactVariantProjection(source, returnedExact.reverse()).status ===
    "verified-exact",
);

const returnedMissing = structuredClone(source.variants).slice(1);
const missingCodes = codes(source, returnedMissing);
check(
  "a missing return row refuses EXACT_ROWS_MISSING",
  missingCodes.includes("EXACT_ROWS_MISSING"),
);
check(
  "a missing return row also refuses EXACT_PROJECTION_COUNT_MISMATCH",
  missingCodes.includes("EXACT_PROJECTION_COUNT_MISMATCH"),
);

const returnedExtra = structuredClone(source.variants);
returnedExtra[0] = { variantProperties: { Size: "Md", Tone: "Neutral" } };
const extraCodes = codes(source, returnedExtra);
check(
  "an out-of-domain return tuple keeps the value-specific refusal",
  extraCodes.includes("EXACT_TUPLE_INVALID_VALUE"),
);
check(
  "an out-of-source return tuple refuses EXACT_ROWS_EXTRA",
  extraCodes.includes("EXACT_ROWS_EXTRA"),
);
check(
  "replacing a row reports the source tuple as EXACT_ROWS_MISSING",
  extraCodes.includes("EXACT_ROWS_MISSING"),
);

const exercised = new Set<ExactProjectionRefusalCode>();
for (const scenario of [
  codes(partialEvidence),
  codes(noVariantDefinition),
  codes(propertyCollision),
  codes(valueCollision),
  ...[
    { type: "VARIANT", defaultValue: "Sm" },
    { type: "VARIANT", defaultValue: "Sm", variantOptions: [] },
  ].map((definition) => {
    const set = exactSet();
    set.propertyDefinitions = { Size: definition };
    return codes(set);
  }),
  codes(missingTuple),
  codes(incompleteTuple),
  codes(unknownProperty),
  codes(invalidValue),
  codes(duplicateTuple),
  codes(slider),
  missingCodes,
  extraCodes,
]) {
  scenario.forEach((code) => exercised.add(code));
}
check(
  "the falsification suite exercises every stable refusal code",
  EXACT_PROJECTION_REFUSAL_CODES.every((code) => exercised.has(code)),
);
check(
  "the authoritative grammar publishes the exact stable refusal vocabulary",
  JSON.stringify(grammar.variantRecoveryRefusals) ===
    JSON.stringify(EXACT_PROJECTION_REFUSAL_CODES),
);

if (failures.length > 0) {
  console.error(`\n${failures.length}/${checks} checks failed:`);
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`\n${checks}/${checks} checks passed.`);
}
