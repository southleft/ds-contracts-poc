import type { DumpNode, DumpSet } from "../extract/figma/types.js";
import { tokenCorpusFromJson } from "./token-corpus.js";
import {
  ExactProjectionError,
  proposeFromDump,
  TEXT_STYLE_IDENTITY_REFUSED,
  TextStyleIdentityError,
  type ExactProposalRefusalCode,
} from "./propose-figma.js";

const failures: string[] = [];
let checks = 0;
const check = (label: string, condition: boolean): void => {
  checks += 1;
  if (!condition) failures.push(label);
  console.log(`  ${condition ? "✔" : "✖"} ${label}`);
};

const corpus = tokenCorpusFromJson({
  primitives: {},
  semantic: {},
  light: {},
  brandDefault: {},
});
const baseOpts = {
  corpus,
  contractIdByName: new Map<string, string>(),
  fileKey: null,
};

const variant = (
  name: string,
  variantProperties?: Record<string, string>,
): DumpNode => ({
  name,
  type: "COMPONENT",
  ...(variantProperties ? { variantProperties } : {}),
});

const exactSet = (): DumpSet => ({
  setName: "Sample",
  type: "COMPONENT_SET",
  propertyDefinitions: {
    Size: {
      type: "VARIANT",
      defaultValue: "Sm",
      variantOptions: ["Sm", "Lg"],
    },
  },
  variants: [
    variant("Size=Sm", { Size: "Sm" }),
    variant("Size=Lg", { Size: "Lg" }),
  ],
});

const refusalCode = (
  run: () => unknown,
): ExactProposalRefusalCode | undefined => {
  try {
    run();
    return undefined;
  } catch (error) {
    if (!(error instanceof ExactProjectionError)) throw error;
    return error.code;
  }
};

console.log("Exact proposal projection");

console.log("\n1. Legacy evidence");
const legacy: DumpSet = {
  setName: "Legacy",
  type: "COMPONENT_SET",
  variants: [variant("Size=Sm"), variant("Size=Lg")],
};
check(
  "exact mode refuses legacy input before proposal",
  refusalCode(() => proposeFromDump(legacy, baseOpts)) ===
    "EXACT_DEFINITIONS_MISSING",
);
const reviewableLegacy = proposeFromDump(legacy, {
  ...baseOpts,
  projectionMode: "reviewable-inversion",
});
check(
  "explicit reviewable inversion preserves legacy name-based proposal",
  reviewableLegacy.projection.status === "legacy-unverified" &&
    (reviewableLegacy.contract.props as unknown[]).length === 1,
);

console.log("\n2. Structured refusals");
const ragged: DumpSet = {
  setName: "Ragged",
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
  },
  variants: [
    variant("Size=Sm, Tone=Neutral", { Size: "Sm", Tone: "Neutral" }),
    variant("Size=Sm, Tone=Danger", { Size: "Sm", Tone: "Danger" }),
    variant("Size=Lg, Tone=Neutral", { Size: "Lg", Tone: "Neutral" }),
  ],
};
for (const projectionMode of ["exact", "reviewable-inversion"] as const) {
  check(
    `${projectionMode} refuses a structured ragged matrix`,
    refusalCode(() =>
      proposeFromDump(ragged, { ...baseOpts, projectionMode }),
    ) === "EXACT_MATRIX_RAGGED",
  );
}

const collision: DumpSet = {
  setName: "Collision",
  type: "COMPONENT_SET",
  propertyDefinitions: {
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
  },
  variants: [
    variant("Show Actions=No, show-actions=Off", {
      "Show Actions": "No",
      "show-actions": "Off",
    }),
  ],
};
check(
  "canonical property collision refuses with its stable validator code",
  refusalCode(() => proposeFromDump(collision, baseOpts)) ===
    "EXACT_PROPERTY_CANONICAL_COLLISION",
);

console.log("\n3. Semantic ambiguity");
const states: DumpSet = {
  setName: "Control",
  type: "COMPONENT_SET",
  propertyDefinitions: {
    State: {
      type: "VARIANT",
      defaultValue: "Default",
      variantOptions: ["Default", "Hover"],
    },
  },
  variants: [
    variant("State=Default", { State: "Default" }),
    variant("State=Hover", { State: "Hover" }),
  ],
};
check(
  "exact mode refuses interaction-state semantic promotion",
  refusalCode(() => proposeFromDump(states, baseOpts)) ===
    "EXACT_SEMANTIC_PROJECTION_AMBIGUOUS",
);

console.log("\n4. Verified exact success");
const exact = proposeFromDump(exactSet(), baseOpts);
check(
  "structured proposal verifies returned Figma VARIANT rows exactly",
  exact.projection.status === "verified-exact" &&
    exact.projection.expectedCount === 2 &&
    exact.projection.observedCount === 2,
);
const reviewableStructured = proposeFromDump(exactSet(), {
  ...baseOpts,
  projectionMode: "reviewable-inversion",
});
check(
  "reviewable structured success projects verified-exact (not source-matrix-verified)",
  reviewableStructured.projection.status === "verified-exact",
);

console.log("\n5. Text-style identity hard-refuse (exact)");
const textVariant = (
  name: string,
  size: string,
  styleName: string,
  fontSize = 14,
): DumpNode => ({
  name,
  type: "COMPONENT",
  variantProperties: { Size: size },
  children: [
    {
      name: "label",
      type: "TEXT",
      text: {
        characters: "Hi",
        fontSize,
        fontStyle: "Medium",
        style: styleName,
      },
    },
  ],
});
const conflictingNames: DumpSet = {
  setName: "Label",
  type: "COMPONENT_SET",
  propertyDefinitions: {
    Size: {
      type: "VARIANT",
      defaultValue: "Sm",
      variantOptions: ["Sm", "Lg"],
    },
  },
  variants: [
    textVariant("Size=Sm", "Sm", "Text sm/Medium"),
    textVariant("Size=Lg", "Lg", "Text lg/Medium"),
  ],
};
const conflictingCode = (() => {
  try {
    proposeFromDump(conflictingNames, baseOpts);
    return undefined;
  } catch (error) {
    if (error instanceof TextStyleIdentityError) return error.code;
    throw error;
  }
})();
check(
  "exact refuses uniform size/weight when style names differ",
  conflictingCode === TEXT_STYLE_IDENTITY_REFUSED,
);
const reviewableConflict = proposeFromDump(conflictingNames, {
  ...baseOpts,
  projectionMode: "reviewable-inversion",
});
check(
  "reviewable notes text-style-identity-refused and continues (no styleNames[0] pick)",
  reviewableConflict.notes.some((n) =>
    n.includes(TEXT_STYLE_IDENTITY_REFUSED),
  ) && !reviewableConflict.notes.some((n) => n.includes("— using ")),
);

const namedMintOff: DumpSet = {
  setName: "Caption",
  type: "COMPONENT_SET",
  propertyDefinitions: {
    Size: {
      type: "VARIANT",
      defaultValue: "Sm",
      variantOptions: ["Sm", "Lg"],
    },
  },
  variants: [
    textVariant("Size=Sm", "Sm", "Text sm/Medium", 12),
    textVariant("Size=Lg", "Lg", "Text sm/Medium", 16),
  ],
};
const mintOffCode = (() => {
  try {
    proposeFromDump(namedMintOff, baseOpts);
    return undefined;
  } catch (error) {
    if (error instanceof TextStyleIdentityError) return error.code;
    throw error;
  }
})();
check(
  "exact refuses named styles when minting is off",
  mintOffCode === TEXT_STYLE_IDENTITY_REFUSED,
);
const reviewableMintOff = proposeFromDump(namedMintOff, {
  ...baseOpts,
  projectionMode: "reviewable-inversion",
});
check(
  "reviewable mint-off path names text-style-identity-refused without succeeding silently",
  reviewableMintOff.notes.some((n) => n.includes(TEXT_STYLE_IDENTITY_REFUSED)),
);

if (failures.length > 0) {
  console.error(`\n${failures.length}/${checks} exact proposal checks failed:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`\n${checks} exact proposal checks passed.`);
}
