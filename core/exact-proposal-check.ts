import type { DumpNode, DumpSet } from "../extract/figma/types.js";
import { tokenCorpusFromJson } from "./token-corpus.js";
import {
  ExactProjectionError,
  proposeBatchFromDump,
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

console.log("\n6. Declared sparse State-preview (FC-PROPOSE-SPARSE-STATE)");
const sparseRow = (
  tone: string,
  state: string,
  extras: Partial<DumpNode> = {},
): DumpNode => ({
  name: `Tone=${tone}, State=${state}`,
  type: "COMPONENT",
  variantProperties: { Tone: tone, State: state },
  ...extras,
});
const sparsePreview: DumpSet = {
  setName: "Control",
  type: "COMPONENT_SET",
  semantics: { element: "button" },
  propNames: { Tone: "tone" },
  statePreviewAxis: {
    axis: "State",
    default: "Default",
    states: ["Disabled", "Hover"],
    primary: "Tone",
    pinned: {},
  },
  propertyDefinitions: {
    Tone: {
      type: "VARIANT",
      defaultValue: "A",
      variantOptions: ["A", "B"],
    },
    State: {
      type: "VARIANT",
      defaultValue: "Default",
      variantOptions: ["Default", "Disabled", "Hover"],
    },
  },
  variants: [
    sparseRow("A", "Default"),
    sparseRow("B", "Default"),
    sparseRow("A", "Disabled", { opacity: 0.5 }),
    sparseRow("B", "Disabled", { opacity: 0.5 }),
    sparseRow("A", "Hover"),
    sparseRow("B", "Hover"),
  ],
};
// Hover cells identical to Default recover NO hover state, so a re-emit of
// the proposal draws 4 rows against the set's 6. Exact mode must name those
// two cells, never report verified-exact 6/6 (FC-PROPOSE-SPARSE-STATE).
const sparseRefusal = (() => {
  try {
    proposeFromDump(sparsePreview, { ...baseOpts, mintUnbound: true });
    return undefined;
  } catch (error) {
    if (!(error instanceof ExactProjectionError)) throw error;
    return error;
  }
})();
const sparseMissing =
  sparseRefusal?.projection.status === "refused"
    ? sparseRefusal.projection.refusals.find(
        (r) => r.code === "EXACT_ROWS_MISSING",
      )
    : undefined;
check(
  "exact refuses a sparse State matrix whose Hover cells recovered nothing, naming the 2 Hover cells (EXACT_ROWS_MISSING), never verified-exact over a 4-row re-emit",
  sparseRefusal?.code === "EXACT_ROWS_MISSING" &&
    (sparseMissing?.tuples ?? []).length === 2 &&
    (sparseMissing?.tuples ?? []).every((t) => t.includes("Hover")),
);
const sparseExact = proposeFromDump(sparsePreview, {
  ...baseOpts,
  mintUnbound: true,
  projectionMode: "reviewable-inversion",
});
const sparseProps = Array.isArray(sparseExact.contract.props)
  ? (sparseExact.contract.props as Array<{ name?: string }>)
  : [];
check(
  "the sparse proposal recovers the API axis and does not invent State as a prop",
  sparseProps.some((p) => p.name === "tone") &&
    !sparseProps.some((p) => p.name === "state"),
);
check(
  "the sparse proposal does not invent disabled as a BOOLEAN prop (FC-DUMP-PROPOSE-DISABLED-INVENTED)",
  !sparseProps.some((p) => p.name === "disabled"),
);
const sparseDisabled = (
  sparseExact.contract as {
    anatomy?: { root?: { states?: { disabled?: { opacity?: unknown } } } };
  }
).anatomy?.root?.states?.disabled;
check(
  "the sparse proposal still recovers the disabled STATE block from State=Disabled",
  sparseDisabled !== undefined &&
    (typeof sparseDisabled.opacity === "number" ||
      typeof sparseDisabled.opacity === "string"),
);

console.log(
  "\n7. Size-varying stamped fontSizeVar (FC-DUMP-PROPOSE-TYPE-UNPINNED)",
);
const sizedText = (size: string, px: number): DumpNode => ({
  name: `Size=${size}`,
  type: "COMPONENT",
  variantProperties: { Size: size },
  children: [
    {
      name: "label",
      type: "TEXT",
      text: {
        characters: "Hi",
        fontSize: px,
        fontStyle: "Medium",
        fontSizeVar: `imported/button/root/font-size/${size.toLowerCase()}`,
        fontWeightVar: "imported/button/root/font-weight",
        lineHeightVar: `imported/button/root/line-height/${size.toLowerCase()}`,
      },
    },
  ],
});
const sizedType: DumpSet = {
  setName: "Button (flowbite.button)",
  type: "COMPONENT_SET",
  propertyDefinitions: {
    Size: {
      type: "VARIANT",
      defaultValue: "Sm",
      variantOptions: ["Sm", "Lg"],
    },
  },
  variants: [sizedText("Sm", 12), sizedText("Lg", 16)],
};
const sizedExact = proposeFromDump(sizedType, {
  ...baseOpts,
  mintUnbound: true,
});
const sizedJson = JSON.stringify(sizedExact.contract);
check(
  "size-varying fontSizeVar recovers the canvas substituted ref, not a dump-slug mint",
  sizedExact.projection.status === "verified-exact" &&
    sizedJson.includes("{imported.button.root.font-size.{size}}") &&
    sizedJson.includes("{imported.button.root.line-height.{size}}") &&
    sizedJson.includes("{imported.button.root.font-weight}") &&
    !sizedJson.includes("imported.button-flowbite-button"),
);

console.log("\n8. Hoisted label state ink (FC-DUMP-PROPOSE-STATE-TEXT)");
const inkRow = (color: string, state: string, fillVar: string): DumpNode => ({
  name: `Color=${color}, State=${state}`,
  type: "COMPONENT",
  variantProperties: { Color: color, State: state },
  children: [
    {
      name: "label",
      type: "TEXT",
      text: { characters: "Hi", fontSize: 14, fontStyle: "Medium" },
      fill: { var: fillVar },
    },
  ],
});
const hoistedInk: DumpSet = {
  setName: "Button (flowbite.button)",
  type: "COMPONENT_SET",
  semantics: { element: "button" },
  propNames: { Color: "color" },
  statePreviewAxis: {
    axis: "State",
    default: "Default",
    states: ["Hover"],
    primary: "Color",
    pinned: {},
  },
  propertyDefinitions: {
    Color: {
      type: "VARIANT",
      defaultValue: "Default",
      variantOptions: ["Default", "Red"],
    },
    State: {
      type: "VARIANT",
      defaultValue: "Default",
      variantOptions: ["Default", "Hover"],
    },
  },
  variants: [
    inkRow("Default", "Default", "imported/button/root/color/default"),
    inkRow("Red", "Default", "imported/button/root/color/red"),
    inkRow(
      "Default",
      "Hover",
      "imported/button/root/color-state-hover/default",
    ),
    inkRow("Red", "Hover", "imported/button/root/color-state-hover/red"),
  ],
};
const hoistedInkExact = proposeFromDump(hoistedInk, {
  ...baseOpts,
  mintUnbound: true,
});
const hoistedInkJson = JSON.stringify(hoistedInkExact.contract);
check(
  "hoisted children label hover ink recovers the canvas substituted ref, not a named drop",
  hoistedInkExact.projection.status === "verified-exact" &&
    hoistedInkJson.includes(
      "{imported.button.root.color-state-hover.{color}}",
    ) &&
    !hoistedInkExact.notes.some((n) =>
      n.includes("no anatomy part maps to this drawn child"),
    ),
);

console.log(
  "\n9. Per-side stroke weights (FC-DUMP-PROPOSE-STROKE-WEIGHT-SIDES)",
);
const widthRow = (color: string): DumpNode => ({
  name: `Color=${color}`,
  type: "COMPONENT",
  variantProperties: { Color: color },
  strokeAlign: "INSIDE",
  stroke: {
    var: `imported/button/root/border-top-color/${color.toLowerCase()}`,
  },
  bound: {
    strokeTopWeight: `imported/button/root/border-top-width/${color.toLowerCase()}`,
    strokeRightWeight: `imported/button/root/border-right-width/${color.toLowerCase()}`,
    strokeBottomWeight: `imported/button/root/border-bottom-width/${color.toLowerCase()}`,
    strokeLeftWeight: `imported/button/root/border-left-width/${color.toLowerCase()}`,
  },
});
const sideWeights: DumpSet = {
  setName: "Button (flowbite.button)",
  type: "COMPONENT_SET",
  propertyDefinitions: {
    Color: {
      type: "VARIANT",
      defaultValue: "Default",
      variantOptions: ["Default", "Red"],
    },
  },
  variants: [widthRow("Default"), widthRow("Red")],
};
const sideWeightsExact = proposeFromDump(sideWeights, {
  ...baseOpts,
  mintUnbound: true,
});
const sideWeightsJson = JSON.stringify(sideWeightsExact.contract);
check(
  "per-side stroke weight binds recover longhand border-*-width, not a named drop",
  sideWeightsExact.projection.status === "verified-exact" &&
    sideWeightsJson.includes(
      "{imported.button.root.border-top-width.{color}}",
    ) &&
    sideWeightsJson.includes(
      "{imported.button.root.border-left-width.{color}}",
    ) &&
    !sideWeightsExact.notes.some((n) =>
      n.includes("not representable, review"),
    ),
);

console.log("\n10. Focus OUTSIDE stroke (FC-DUMP-PROPOSE-FOCUS-OUTLINE)");
const focusRow = (color: string, state: string): DumpNode => ({
  name: `Color=${color}, State=${state}`,
  type: "COMPONENT",
  variantProperties: { Color: color, State: state },
  strokeAlign: state === "Focus Visible" ? "OUTSIDE" : "INSIDE",
  stroke: {
    var:
      state === "Focus Visible"
        ? "imported/button/root/outline-color-state-focus-visible"
        : `imported/button/root/border-top-color/${color.toLowerCase()}`,
  },
  bound:
    state === "Focus Visible"
      ? {
          strokeTopWeight:
            "imported/button/root/outline-width-state-focus-visible",
          strokeRightWeight:
            "imported/button/root/outline-width-state-focus-visible",
          strokeBottomWeight:
            "imported/button/root/outline-width-state-focus-visible",
          strokeLeftWeight:
            "imported/button/root/outline-width-state-focus-visible",
        }
      : {
          strokeTopWeight: `imported/button/root/border-top-width/${color.toLowerCase()}`,
          strokeRightWeight: `imported/button/root/border-right-width/${color.toLowerCase()}`,
          strokeBottomWeight: `imported/button/root/border-bottom-width/${color.toLowerCase()}`,
          strokeLeftWeight: `imported/button/root/border-left-width/${color.toLowerCase()}`,
        },
});
const focusOutline: DumpSet = {
  setName: "Button (flowbite.button)",
  type: "COMPONENT_SET",
  semantics: { element: "button" },
  propNames: { Color: "color" },
  statePreviewAxis: {
    axis: "State",
    default: "Default",
    states: ["Focus Visible"],
    primary: "Color",
    pinned: {},
  },
  propertyDefinitions: {
    Color: {
      type: "VARIANT",
      defaultValue: "Default",
      variantOptions: ["Default", "Red"],
    },
    State: {
      type: "VARIANT",
      defaultValue: "Default",
      variantOptions: ["Default", "Focus Visible"],
    },
  },
  variants: [
    focusRow("Default", "Default"),
    focusRow("Red", "Default"),
    focusRow("Default", "Focus Visible"),
    focusRow("Red", "Focus Visible"),
  ],
};
const focusOutlineExact = proposeFromDump(focusOutline, {
  ...baseOpts,
  mintUnbound: true,
});
const focusStates = (
  focusOutlineExact.contract as {
    anatomy?: { root?: { states?: Record<string, Record<string, string>> } };
  }
).anatomy?.root?.states?.["focus-visible"];
check(
  "focus-visible OUTSIDE stroke recovers outline-color and outline-width, not border-color",
  focusOutlineExact.projection.status === "verified-exact" &&
    focusStates?.["outline-color"] ===
      "{imported.button.root.outline-color-state-focus-visible}" &&
    focusStates?.["outline-width"] ===
      "{imported.button.root.outline-width-state-focus-visible}" &&
    focusStates?.["border-color"] === undefined,
);

console.log("\n11. Nested ELLIPSE thumb (FC-DUMP-PROPOSE-THUMB-SHAPE)");
const thumbRow = (checked: "Unchecked" | "Checked"): DumpNode => ({
  name: `Checked=${checked}`,
  type: "COMPONENT",
  variantProperties: { Checked: checked },
  children: [
    {
      name: "part-0",
      type: "FRAME",
      children: [
        {
          name: "part-0-after",
          type: "ELLIPSE",
          shape: {
            kind: "ellipse",
            width: 20,
            height: 20,
            x: checked === "Checked" ? 22 : 2,
            y: 2,
            right: checked === "Checked" ? 2 : 22,
            bottom: 2,
            constraints: {
              horizontal: checked === "Checked" ? "RIGHT" : "LEFT",
              vertical: "TOP",
            },
          },
        },
      ],
    },
  ],
});
const thumbShape: DumpSet = {
  setName: "ToggleSwitch",
  type: "COMPONENT_SET",
  semantics: { element: "button", role: "switch" },
  propNames: { Checked: "checked" },
  propertyDefinitions: {
    Checked: {
      type: "VARIANT",
      defaultValue: "Unchecked",
      variantOptions: ["Unchecked", "Checked"],
    },
  },
  variants: [thumbRow("Unchecked"), thumbRow("Checked")],
};
const thumbShapeExact = proposeFromDump(thumbShape, {
  ...baseOpts,
  mintUnbound: true,
});
const thumbAfter = (
  thumbShapeExact.contract as {
    anatomy?: {
      root?: {
        parts?: {
          "part-0"?: {
            parts?: {
              "part-0-after"?: {
                shape?: { kind?: string };
                stylesWhen?: Array<{
                  prop?: string;
                  equals?: string;
                  styles?: Record<string, string>;
                }>;
              };
            };
          };
        };
      };
    };
  }
).anatomy?.root?.parts?.["part-0"]?.parts?.["part-0-after"];
const thumbWhen = thumbAfter?.stylesWhen ?? [];
check(
  "ELLIPSE child with dump v1.3 shape recovers ellipse + checked left/right, not an empty part",
  thumbShapeExact.projection.status === "verified-exact" &&
    thumbAfter?.shape?.kind === "ellipse" &&
    thumbWhen.some(
      (row) =>
        row.prop === "checked" &&
        row.equals === "unchecked" &&
        row.styles?.left === "2px",
    ) &&
    thumbWhen.some(
      (row) =>
        row.prop === "checked" &&
        row.equals === "checked" &&
        row.styles?.right === "2px",
    ),
);

console.log("\n12. Size-varying ellipse (FC-DUMP-PROPOSE-SHAPE-SIZE-AXIS)");
const sizedThumb = (
  sizing: "Sm" | "Md" | "Lg",
  checked: "Unchecked" | "Checked",
): DumpNode => {
  const dim = sizing === "Sm" ? 16 : sizing === "Lg" ? 24 : 20;
  const parent = sizing === "Sm" ? 36 : sizing === "Lg" ? 52 : 44;
  return {
    name: `Sizing=${sizing}, Checked=${checked}`,
    type: "COMPONENT",
    variantProperties: { Sizing: sizing, Checked: checked },
    children: [
      {
        name: "part-0",
        type: "FRAME",
        children: [
          {
            name: "part-0-after",
            type: "ELLIPSE",
            shape: {
              kind: "ellipse",
              width: dim,
              height: dim,
              x: checked === "Checked" ? parent - dim - 2 : 2,
              y: 2,
              right: checked === "Checked" ? 2 : parent - dim - 2,
              bottom: 2,
              constraints: {
                horizontal: checked === "Checked" ? "RIGHT" : "LEFT",
                vertical: "TOP",
              },
            },
          },
        ],
      },
    ],
  };
};
const sizedThumbSet: DumpSet = {
  setName: "ToggleSwitch",
  type: "COMPONENT_SET",
  semantics: { element: "button", role: "switch" },
  propNames: { Sizing: "sizing", Checked: "checked" },
  propertyDefinitions: {
    Sizing: {
      type: "VARIANT",
      defaultValue: "Md",
      variantOptions: ["Sm", "Md", "Lg"],
    },
    Checked: {
      type: "VARIANT",
      defaultValue: "Unchecked",
      variantOptions: ["Unchecked", "Checked"],
    },
  },
  variants: [
    sizedThumb("Sm", "Unchecked"),
    sizedThumb("Sm", "Checked"),
    sizedThumb("Md", "Unchecked"),
    sizedThumb("Md", "Checked"),
    sizedThumb("Lg", "Unchecked"),
    sizedThumb("Lg", "Checked"),
  ],
};
const sizedThumbExact = proposeFromDump(sizedThumbSet, {
  ...baseOpts,
  mintUnbound: true,
});
const sizedAfter = (
  sizedThumbExact.contract as {
    anatomy?: {
      root?: {
        parts?: {
          "part-0"?: {
            parts?: {
              "part-0-after"?: {
                literalsByProp?: Array<{
                  prop?: string;
                  map?: Record<string, Record<string, string>>;
                }>;
              };
            };
          };
        };
      };
    };
  }
).anatomy?.root?.parts?.["part-0"]?.parts?.["part-0-after"];
const sizeMap = sizedAfter?.literalsByProp?.find(
  (e) => e.prop === "sizing",
)?.map;
check(
  "size-varying ellipse recovers literalsByProp on sizing, not first-variant freeze",
  sizedThumbExact.projection.status === "verified-exact" &&
    sizeMap?.sm?.width === "16px" &&
    sizeMap?.sm?.height === "16px" &&
    sizeMap?.md?.width === "20px" &&
    sizeMap?.lg?.width === "24px" &&
    sizeMap?.lg?.height === "24px" &&
    !sizedThumbExact.notes.some((n) => n.includes("the first variant's")),
);

console.log("\n13. State-only DROP_SHADOW (FC-DUMP-PROPOSE-STATE-SHADOW)");
const shadowStack = (hex: string): NonNullable<DumpNode["effects"]> => [
  {
    type: "DROP_SHADOW",
    color: { hex: "000000", alpha: 0 },
    offset: { x: 0, y: 0 },
    radius: 0,
  },
  {
    type: "DROP_SHADOW",
    color: { hex, alpha: 1 },
    offset: { x: 0, y: 0 },
    radius: 0,
    spread: 4,
  },
];
const shadowRow = (color: string, state: string, hex: string): DumpNode => ({
  name: `Color=${color}, State=${state}`,
  type: "COMPONENT",
  variantProperties: { Color: color, State: state },
  fill: { var: `imported/button/root/background-color/${color.toLowerCase()}` },
  ...(state === "Active" ? { effects: shadowStack(hex) } : {}),
});
const stateShadow: DumpSet = {
  setName: "Button (flowbite.button)",
  type: "COMPONENT_SET",
  semantics: { element: "button" },
  propNames: { Color: "color" },
  statePreviewAxis: {
    axis: "State",
    default: "Default",
    states: ["Active"],
    primary: "Color",
    pinned: {},
  },
  propertyDefinitions: {
    Color: {
      type: "VARIANT",
      defaultValue: "Default",
      variantOptions: ["Default", "Red"],
    },
    State: {
      type: "VARIANT",
      defaultValue: "Default",
      variantOptions: ["Default", "Active"],
    },
  },
  variants: [
    shadowRow("Default", "Default", "a4cafe"),
    shadowRow("Red", "Default", "f8b4b4"),
    shadowRow("Default", "Active", "a4cafe"),
    shadowRow("Red", "Active", "f8b4b4"),
  ],
};
const stateShadowExact = proposeFromDump(stateShadow, {
  ...baseOpts,
  mintUnbound: true,
});
const activeShadow = (
  stateShadowExact.contract as {
    anatomy?: { root?: { states?: Record<string, Record<string, string>> } };
  }
).anatomy?.root?.states?.active;
check(
  "state-only DROP_SHADOW recovers states.active.box-shadow, not a named drop",
  stateShadowExact.projection.status === "verified-exact" &&
    typeof activeShadow?.["box-shadow"] === "string" &&
    activeShadow["box-shadow"].includes("box-shadow") &&
    !stateShadowExact.notes.some((n) =>
      n.includes("only DROP_SHADOW layers present in every variant"),
    ),
);

console.log("\n14. Shape-part unbound paint (FC-DUMP-PROPOSE-SHAPE-PAINT)");
const paintedThumb = (checked: "Unchecked" | "Checked"): DumpNode => ({
  name: `Checked=${checked}`,
  type: "COMPONENT",
  variantProperties: { Checked: checked },
  children: [
    {
      name: "part-0",
      type: "FRAME",
      children: [
        {
          name: "part-0-after",
          type: "ELLIPSE",
          fill: { hex: "ffffff" },
          stroke: { hex: "d1d5db" },
          strokeWeight: 1,
          shape: {
            kind: "ellipse",
            width: 20,
            height: 20,
            x: checked === "Checked" ? 22 : 2,
            y: 2,
            right: checked === "Checked" ? 2 : 22,
            bottom: 2,
            constraints: {
              horizontal: checked === "Checked" ? "RIGHT" : "LEFT",
              vertical: "TOP",
            },
          },
        },
      ],
    },
  ],
});
const paintedThumbSet: DumpSet = {
  setName: "ToggleSwitch",
  type: "COMPONENT_SET",
  semantics: { element: "button", role: "switch" },
  propNames: { Checked: "checked" },
  propertyDefinitions: {
    Checked: {
      type: "VARIANT",
      defaultValue: "Unchecked",
      variantOptions: ["Unchecked", "Checked"],
    },
  },
  variants: [paintedThumb("Unchecked"), paintedThumb("Checked")],
};
const paintedThumbExact = proposeFromDump(paintedThumbSet, {
  ...baseOpts,
  mintUnbound: true,
});
const paintedAfter = (
  paintedThumbExact.contract as {
    anatomy?: {
      root?: {
        parts?: {
          "part-0"?: {
            parts?: {
              "part-0-after"?: {
                literals?: Record<string, string>;
                tokens?: Record<string, string>;
              };
            };
          };
        };
      };
    };
  }
).anatomy?.root?.parts?.["part-0"]?.parts?.["part-0-after"];
check(
  "unbound ellipse fill/stroke recover as shape literals, not a dump-slug mint",
  paintedThumbExact.projection.status === "verified-exact" &&
    paintedAfter?.literals?.["background-color"] === "#ffffff" &&
    paintedAfter?.literals?.["border-color"] === "#d1d5db" &&
    paintedAfter?.literals?.["border-width"] === "1px" &&
    paintedAfter?.tokens?.["background-color"] === undefined &&
    !JSON.stringify(paintedThumbExact.contract).includes("flowbite-") &&
    !JSON.stringify(paintedThumbExact.contract).includes("part-0-part-0-after"),
);

console.log("\n15. Shape-part paint axis (FC-DUMP-PROPOSE-SHAPE-PAINT-AXIS)");
const axisThumb = (checked: "Unchecked" | "Checked"): DumpNode => ({
  ...paintedThumb(checked),
  children: [
    {
      name: "part-0",
      type: "FRAME",
      children: [
        {
          ...((paintedThumb(checked).children?.[0] as DumpNode)
            .children?.[0] as DumpNode),
          stroke:
            checked === "Checked"
              ? { hex: "000000", alpha: 0 }
              : { hex: "d1d5db" },
        },
      ],
    },
  ],
});
const axisThumbSet: DumpSet = {
  ...paintedThumbSet,
  variants: [axisThumb("Unchecked"), axisThumb("Checked")],
};
const axisThumbExact = proposeFromDump(axisThumbSet, {
  ...baseOpts,
  mintUnbound: true,
});
const axisAfter = (
  axisThumbExact.contract as {
    anatomy?: {
      root?: {
        parts?: {
          "part-0"?: {
            parts?: {
              "part-0-after"?: {
                literals?: Record<string, string>;
                literalsByProp?: Array<{
                  prop?: string;
                  map?: Record<string, Record<string, string>>;
                }>;
                tokens?: Record<string, string>;
              };
            };
          };
        };
      };
    };
  }
).anatomy?.root?.parts?.["part-0"]?.parts?.["part-0-after"];
const axisChecked = axisAfter?.literalsByProp?.find(
  (e) => e.prop === "checked",
)?.map;
check(
  "checked-axis dump-alpha stroke recovers literalsByProp, not a dump-slug mint or first-variant freeze",
  axisThumbExact.projection.status === "verified-exact" &&
    axisAfter?.literals?.["background-color"] === "#ffffff" &&
    axisAfter?.literals?.["border-width"] === "1px" &&
    axisChecked?.unchecked?.["border-color"] === "#d1d5db" &&
    axisChecked?.checked?.["border-color"] === "#00000000" &&
    axisAfter?.tokens?.["border-color"] === undefined,
);

console.log(
  "\n16. All-variant DROP_SHADOW stack (FC-DUMP-PROPOSE-CARD-SHADOW)",
);
const ghost = {
  type: "DROP_SHADOW" as const,
  color: { hex: "000000", alpha: 0 },
  offset: { x: 0, y: 0 },
  radius: 0,
};
const cardShadowSet: DumpSet = {
  setName: "Card",
  type: "COMPONENT",
  semantics: { element: "div" },
  propNames: { Content: "children" },
  propertyDefinitions: {
    Content: { type: "TEXT", defaultValue: "Card content" },
  },
  variants: [
    {
      name: "Card",
      type: "COMPONENT",
      fill: { hex: "ffffff" },
      children: [
        {
          name: "label",
          type: "TEXT",
          text: {
            characters: "Card content",
            fontSize: 16,
            fontStyle: "Regular",
          },
          propRefs: { characters: "Content" },
        },
      ],
      effects: [
        ghost,
        ghost,
        ghost,
        ghost,
        {
          type: "DROP_SHADOW",
          color: { hex: "000000", alpha: 0.1 },
          offset: { x: 0, y: 4 },
          radius: 6,
          spread: -1,
        },
        {
          type: "DROP_SHADOW",
          color: { hex: "000000", alpha: 0.1 },
          offset: { x: 0, y: 2 },
          radius: 4,
          spread: -2,
        },
      ],
    },
  ],
};
const cardShadowExact = proposeFromDump(cardShadowSet, {
  ...baseOpts,
  mintUnbound: true,
});
const cardShadowTokens = (
  cardShadowExact.contract as {
    anatomy?: { root?: { tokens?: Record<string, string> } };
  }
).anatomy?.root?.tokens;
check(
  "single-variant DROP_SHADOW stack recovers tokens.box-shadow, not a named drop",
  cardShadowExact.projection.status === "verified-exact" &&
    typeof cardShadowTokens?.["box-shadow"] === "string" &&
    cardShadowTokens["box-shadow"].includes("box-shadow") &&
    !cardShadowExact.notes.some((n) =>
      n.includes("only DROP_SHADOW layers present in every variant"),
    ),
);

console.log("\n17. Nested VECTOR fill (FC-DUMP-PROPOSE-ALERT-NESTED-PAINT)");
const paintedVector = (color: "Info" | "Failure"): DumpNode => ({
  name: `Color=${color}`,
  type: "COMPONENT",
  variantProperties: { Color: color },
  children: [
    {
      name: "part-0",
      type: "FRAME",
      children: [
        {
          name: "alert-icon",
          type: "FRAME",
          hidden: true,
          propRefs: { visible: "Icon" },
          children: [
            {
              name: `alert-icon-${color.toLowerCase()}`,
              type: "FRAME",
              children: [
                {
                  name: "Vector",
                  type: "VECTOR",
                  fill: {
                    var: `imported/alert/label/color/${color.toLowerCase()}`,
                  },
                },
              ],
            },
          ],
        },
        {
          name: "dismiss",
          type: "FRAME",
          hidden: true,
          propRefs: { visible: "Dismissable" },
          bound: {
            topLeftRadius: "imported/shared/size-8",
            topRightRadius: "imported/shared/size-8",
            bottomLeftRadius: "imported/shared/size-8",
            bottomRightRadius: "imported/shared/size-8",
          },
          fill: {
            var: `imported/alert/root/background-color/${color.toLowerCase()}`,
          },
        },
      ],
    },
  ],
});
const vectorPaintSet: DumpSet = {
  setName: "Alert",
  type: "COMPONENT_SET",
  semantics: { element: "div" },
  propNames: { Color: "color", Icon: "icon", Dismissable: "dismissable" },
  propertyDefinitions: {
    Color: {
      type: "VARIANT",
      defaultValue: "Info",
      variantOptions: ["Info", "Failure"],
    },
    Icon: { type: "BOOLEAN", defaultValue: false },
    Dismissable: { type: "BOOLEAN", defaultValue: false },
  },
  variants: [paintedVector("Info"), paintedVector("Failure")],
};
const vectorPaintExact = proposeFromDump(vectorPaintSet, {
  ...baseOpts,
  mintUnbound: true,
});
const vectorAlert = (
  vectorPaintExact.contract as {
    anatomy?: {
      root?: {
        parts?: {
          "part-0"?: {
            parts?: {
              dismiss?: { tokens?: Record<string, string> };
              "alert-icon"?: {
                parts?: Record<
                  string,
                  {
                    parts?: Record<string, { tokens?: Record<string, string> }>;
                  }
                >;
              };
            };
          };
        };
      };
    };
  }
).anatomy?.root?.parts?.["part-0"]?.parts;
const vectorColors = Object.values(vectorAlert?.["alert-icon"]?.parts ?? {})
  .flatMap((icon) => Object.values(icon.parts ?? {}))
  .map((vec) => vec.tokens?.["background-color"]);
check(
  "hidden VECTOR fill.var + dismiss bind recover canvas names, not a paint drop",
  vectorPaintExact.projection.status === "verified-exact" &&
    vectorAlert?.dismiss?.tokens?.["background-color"] ===
      "{imported.alert.root.background-color.{color}}" &&
    vectorAlert?.dismiss?.tokens?.["border-radius"] ===
      "{imported.shared.size-8}" &&
    vectorColors.some((ref) => ref?.includes("imported.alert.label.color")),
);

console.log("\n18. Every dump-stamped name (FC-DUMP-PROPOSE-STAMP-GATE)");
const stampGateSet: DumpSet = {
  setName: "Kbd",
  type: "COMPONENT",
  semantics: { element: "span" },
  propertyDefinitions: {
    Content: { type: "TEXT", defaultValue: "Ctrl" },
  },
  variants: [
    {
      name: "Kbd",
      type: "COMPONENT",
      bound: {
        paddingLeft: "imported/shared/size-8",
        paddingRight: "imported/shared/size-8",
      },
      fill: { var: "imported/kbd/root/background-color" },
      stroke: { var: "imported/shared/color-e5e7eb" },
      children: [
        {
          name: "label",
          type: "TEXT",
          text: {
            characters: "Ctrl",
            fontSize: 12,
            fontStyle: "Semi Bold",
            fontSizeVar: "imported/kbd/root/font-size",
            fontWeightVar: "imported/kbd/root/font-weight",
            lineHeightVar: "imported/kbd/root/line-height",
          },
          fill: { var: "imported/kbd/root/color" },
        },
      ],
    },
  ],
};
const stampGateExact = proposeFromDump(stampGateSet, {
  ...baseOpts,
  mintUnbound: true,
});
const stampGateJson = JSON.stringify(stampGateExact.contract);
check(
  "unlisted dump stamps (kbd color / weight / line-height) recover canvas names, not a remint",
  stampGateExact.projection.status === "verified-exact" &&
    stampGateJson.includes("{imported.kbd.root.color}") &&
    stampGateJson.includes("{imported.kbd.root.font-weight}") &&
    stampGateJson.includes("{imported.kbd.root.line-height}") &&
    !stampGateJson.includes("kbd-kbd"),
);

console.log("\n19. Dump degradations (FC-DUMP-PROPOSE-DEGRADATIONS-DROPPED)");
const degradationDump = {
  _degradations: [
    {
      code: "vector-geometry-unsupported",
      nodePath: "Alert:Color=Info/part-0/Vector",
      message: "VECTOR geometry (arbitrary paths) is not captured",
    },
  ],
  Alert: {
    setName: "Alert",
    type: "COMPONENT_SET",
    semantics: { element: "div" },
    propertyDefinitions: {
      Color: {
        type: "VARIANT",
        defaultValue: "Info",
        variantOptions: ["Info"],
      },
    },
    variants: [
      {
        name: "Color=Info",
        type: "COMPONENT",
        variantProperties: { Color: "Info" },
      },
    ],
  },
};
const degradationBatch = proposeBatchFromDump(degradationDump, baseOpts);
check(
  "batch dump _degradations attach to the named set's notes, not a silent drop",
  degradationBatch.proposals.length === 1 &&
    degradationBatch.proposals[0]!.notes.some((n) =>
      n.includes(
        "dump vector-geometry-unsupported: Alert:Color=Info/part-0/Vector",
      ),
    ),
);

console.log("\n20. Unbound TEXT fill (FC-DUMP-PROPOSE-TEXT-PAINT)");
const unboundTextPaintSet: DumpSet = {
  setName: "Card",
  type: "COMPONENT",
  semantics: { element: "div" },
  propertyDefinitions: {
    Content: { type: "TEXT", defaultValue: "Card content" },
  },
  variants: [
    {
      name: "Card",
      type: "COMPONENT",
      children: [
        {
          name: "label",
          type: "FRAME",
          children: [
            {
              name: "label-text",
              type: "TEXT",
              fill: { hex: "000000" },
              text: {
                characters: "Card content",
                fontSize: 16,
                fontStyle: "Regular",
              },
              propRefs: { characters: "Content" },
            },
          ],
        },
      ],
    },
  ],
};
const unboundTextPaintExact = proposeFromDump(unboundTextPaintSet, {
  ...baseOpts,
  mintUnbound: true,
});
const unboundLabelText = (
  unboundTextPaintExact.contract as {
    anatomy?: {
      root?: {
        parts?: {
          label?: {
            parts?: {
              "label-text"?: {
                literals?: Record<string, string>;
                tokens?: Record<string, string>;
              };
            };
          };
        };
      };
    };
  }
).anatomy?.root?.parts?.label?.parts?.["label-text"];
check(
  "unbound TEXT fill recovers as a color literal, not a dump-slug mint",
  unboundTextPaintExact.projection.status === "verified-exact" &&
    unboundLabelText?.literals?.color === "#000000" &&
    unboundLabelText?.tokens?.color === undefined &&
    !JSON.stringify(unboundTextPaintExact.contract).includes(
      "imported.card.label.color",
    ) &&
    !JSON.stringify(unboundTextPaintExact.contract).includes(
      "label-text.color",
    ),
);

console.log("\n21. Stamped contract id (FC-DUMP-PROPOSE-CONTRACT-ID-DROPPED)");
const stampedIdSet: DumpSet = {
  setName: "Alert (flowbite.alert)",
  type: "COMPONENT_SET",
  contractId: "flowbite.alert",
  semantics: { element: "div" },
  propertyDefinitions: {
    Color: {
      type: "VARIANT",
      defaultValue: "Info",
      variantOptions: ["Info"],
    },
  },
  variants: [
    {
      name: "Color=Info",
      type: "COMPONENT",
      variantProperties: { Color: "Info" },
    },
  ],
};
const stampedIdExact = proposeFromDump(stampedIdSet, baseOpts);
const unstampedIdExact = proposeFromDump(
  { ...stampedIdSet, contractId: undefined },
  baseOpts,
);
const badIdExact = proposeFromDump(
  { ...stampedIdSet, contractId: "Not A Legal Id" },
  baseOpts,
);
check(
  "stamped contractId recovers the canvas id, not a name-derived ds.* slug",
  stampedIdExact.projection.status === "verified-exact" &&
    (stampedIdExact.contract as { id?: string }).id === "flowbite.alert" &&
    stampedIdExact.notes.some((n) => n.includes("ds_contracts/contractId")),
);
check(
  "stamped parenthetical set name recovers Alert, not AlertFlowbiteAlert (FC-DUMP-PROPOSE-NAME-PARENTHETICAL)",
  (stampedIdExact.contract as { name?: string }).name === "Alert",
);
check(
  "unstamped set still slugs the drawn name (foreign / pre-v1.26 dump)",
  (unstampedIdExact.contract as { id?: string }).id ===
    "ds.alert-flowbite-alert",
);
check(
  "unstamped parenthetical set name still PascalCases the whole drawn name",
  (unstampedIdExact.contract as { name?: string }).name ===
    "AlertFlowbiteAlert",
);
check(
  "malformed contractId stamp is ignored, never asserted",
  (badIdExact.contract as { id?: string }).id === "ds.alert-flowbite-alert" &&
    badIdExact.notes.some((n) => n.includes("not a legal contract id")),
);

console.log("\n22. Prototype reactions named (FC-DUMP-REACTIONS-SILENT)");
const reactionDump = {
  _degradations: [
    {
      code: "prototype-reactions-unsupported",
      nodePath: "Button:Color=Default, Size=Md, State=Default",
      message:
        "prototype reaction(s) ON_HOVER→CHANGE_TO; ON_PRESS→CHANGE_TO — dump names CHANGE_TO state-preview wiring; State axis + statePreviewAxis recover the matrix; dump does not invent onClick",
    },
  ],
  Button: {
    setName: "Button",
    type: "COMPONENT_SET",
    semantics: { element: "button" },
    propertyDefinitions: {
      Color: {
        type: "VARIANT",
        defaultValue: "Default",
        variantOptions: ["Default"],
      },
    },
    variants: [
      {
        name: "Color=Default",
        type: "COMPONENT",
        variantProperties: { Color: "Default" },
      },
    ],
  },
};
const reactionBatch = proposeBatchFromDump(reactionDump, baseOpts);
check(
  "dump prototype-reactions-unsupported reaches proposal notes, not a silent drop",
  reactionBatch.proposals.length === 1 &&
    reactionBatch.proposals[0]!.notes.some((n) =>
      n.includes(
        "dump prototype-reactions-unsupported: Button:Color=Default, Size=Md, State=Default",
      ),
    ),
);
check(
  "named CHANGE_TO wiring does not invent onClick",
  !("events" in (reactionBatch.proposals[0]!.contract as object)) ||
    (reactionBatch.proposals[0]!.contract as { events?: unknown }).events ===
      undefined,
);

console.log("\n23. Stamped specHash (FC-DUMP-SPECHASH-DROPPED)");
const stampedHashSet: DumpSet = {
  ...stampedIdSet,
  specHash: "148732658",
};
const stampedHashExact = proposeFromDump(stampedHashSet, baseOpts);
const unstampedHashExact = proposeFromDump(
  { ...stampedIdSet, specHash: undefined },
  baseOpts,
);
const badHashExact = proposeFromDump(
  { ...stampedIdSet, specHash: "not-a-hash" },
  baseOpts,
);
check(
  "stamped specHash reaches proposal notes, not a silent drop",
  stampedHashExact.projection.status === "verified-exact" &&
    stampedHashExact.notes.some(
      (n) => n.includes("ds_contracts/specHash") && n.includes("148732658"),
    ),
);
check(
  "unstamped set invents no specHash note (foreign / pre-v1.28 dump)",
  !unstampedHashExact.notes.some((n) => n.includes("ds_contracts/specHash")),
);
check(
  "malformed specHash stamp is ignored, never asserted",
  !badHashExact.notes.some((n) => n.includes("ds_contracts/specHash")),
);

console.log("\n24. Stamped version (FC-DUMP-PROPOSE-VERSION-INVENTED)");
const stampedVersionSet: DumpSet = {
  ...stampedIdSet,
  version: "0.2.0",
};
const stampedVersionExact = proposeFromDump(stampedVersionSet, baseOpts);
const unstampedVersionExact = proposeFromDump(
  { ...stampedIdSet, version: undefined },
  baseOpts,
);
const badVersionExact = proposeFromDump(
  { ...stampedIdSet, version: "not-a-version" },
  baseOpts,
);
check(
  "stamped version recovers the authored version, not invented 0.1.0",
  stampedVersionExact.projection.status === "verified-exact" &&
    (stampedVersionExact.contract as { version?: string }).version ===
      "0.2.0" &&
    stampedVersionExact.notes.some(
      (n) => n.includes("ds_contracts/version") && n.includes("0.2.0"),
    ),
);
check(
  "unstamped set still invents 0.1.0 (foreign / pre-v1.29 dump)",
  (unstampedVersionExact.contract as { version?: string }).version ===
    "0.1.0" &&
    !unstampedVersionExact.notes.some((n) =>
      n.includes("ds_contracts/version"),
    ),
);
check(
  "malformed version stamp is ignored, never asserted",
  (badVersionExact.contract as { version?: string }).version === "0.1.0" &&
    !badVersionExact.notes.some((n) => n.includes("ds_contracts/version")),
);

console.log("\n25. Figma-default min/max 0 (FC-DUMP-MINMAX-ZERO-INVENTED)");
const zeroMinSet: DumpSet = {
  ...exactSet(),
  setName: "ZeroMin",
  variants: [
    { ...variant("Size=Sm", { Size: "Sm" }), minWidth: 0, minHeight: 0 },
    { ...variant("Size=Lg", { Size: "Lg" }), minWidth: 0, minHeight: 0 },
  ],
};
const tapMinSet: DumpSet = {
  ...exactSet(),
  setName: "TapMin",
  variants: [
    { ...variant("Size=Sm", { Size: "Sm" }), minWidth: 44 },
    { ...variant("Size=Lg", { Size: "Lg" }), minWidth: 44 },
  ],
};
const zeroMinExact = proposeFromDump(zeroMinSet, {
  ...baseOpts,
  mintUnbound: true,
});
const tapMinExact = proposeFromDump(tapMinSet, {
  ...baseOpts,
  mintUnbound: true,
});
const zeroMinJson = JSON.stringify(zeroMinExact.contract);
const tapMinJson = JSON.stringify(tapMinExact.contract);
check(
  "literal minWidth 0 does not mint a tap-target token",
  zeroMinExact.projection.status === "verified-exact" &&
    !zeroMinJson.includes("min-width") &&
    !zeroMinExact.notes.some((n) => n.includes("minWidth")),
);
check(
  "literal minWidth 44 still mints the drawn tap-target",
  tapMinExact.projection.status === "verified-exact" &&
    (tapMinJson.includes("min-width") ||
      tapMinExact.notes.some((n) => n.includes("minWidth"))),
);

console.log(
  "\n26. Preview Disabled is not a BOOLEAN (FC-DUMP-PROPOSE-DISABLED-INVENTED)",
);
const foreignDisabled: DumpSet = {
  setName: "ForeignDisabled",
  type: "COMPONENT_SET",
  propertyDefinitions: {
    State: {
      type: "VARIANT",
      defaultValue: "Default",
      variantOptions: ["Default", "Disabled"],
    },
  },
  variants: [
    variant("State=Default", { State: "Default" }),
    { ...variant("State=Disabled", { State: "Disabled" }), opacity: 0.5 },
  ],
};
const foreignDisabledReviewable = proposeFromDump(foreignDisabled, {
  ...baseOpts,
  projectionMode: "reviewable-inversion",
  mintUnbound: true,
});
const foreignDisabledProps = Array.isArray(
  foreignDisabledReviewable.contract.props,
)
  ? (foreignDisabledReviewable.contract.props as Array<{
      name?: string;
      bindings?: { figma?: { kind?: string; property?: string } };
    }>)
  : [];
check(
  "unstamped foreign State=Disabled still promotes a disabled BOOLEAN (Path A table)",
  foreignDisabledProps.some(
    (p) => p.name === "disabled" && p.bindings?.figma?.kind === "BOOLEAN",
  ),
);

console.log(
  "\n27. Stamped Disabled opacity recovers the authored token (FC-DUMP-PROPOSE-DISABLED-OPACITY-MINTED)",
);
const opacityCorpus = tokenCorpusFromJson({
  primitives: {
    imported: {
      button: {
        root: {
          "opacity-state-disabled": { $value: 0.5, $type: "number" },
        },
      },
    },
  },
  semantic: {},
  light: {},
  brandDefault: {},
});
const stampedDisabledOpacity = proposeFromDump(
  {
    setName: "Button (flowbite.button)",
    type: "COMPONENT_SET",
    contractId: "flowbite.button",
    semantics: { element: "button" },
    propNames: { Color: "color" },
    statePreviewAxis: {
      axis: "State",
      default: "Default",
      states: ["Disabled"],
      primary: "Color",
      pinned: {},
    },
    propertyDefinitions: {
      Color: {
        type: "VARIANT",
        defaultValue: "Default",
        variantOptions: ["Default", "Red"],
      },
      State: {
        type: "VARIANT",
        defaultValue: "Default",
        variantOptions: ["Default", "Disabled"],
      },
    },
    variants: [
      {
        name: "Color=Default, State=Default",
        type: "COMPONENT",
        variantProperties: { Color: "Default", State: "Default" },
      },
      {
        name: "Color=Red, State=Default",
        type: "COMPONENT",
        variantProperties: { Color: "Red", State: "Default" },
      },
      {
        name: "Color=Default, State=Disabled",
        type: "COMPONENT",
        variantProperties: { Color: "Default", State: "Disabled" },
        opacity: 0.5,
      },
      {
        name: "Color=Red, State=Disabled",
        type: "COMPONENT",
        variantProperties: { Color: "Red", State: "Disabled" },
        opacity: 0.5,
      },
    ],
  },
  {
    ...baseOpts,
    corpus: opacityCorpus,
    mintUnbound: true,
    contractsById: new Map([
      [
        "flowbite.button",
        {
          id: "flowbite.button",
          props: [
            { name: "color", bindings: { figma: { property: "Color" } } },
          ],
          anatomy: {
            root: {
              states: {
                disabled: {
                  opacity: "{imported.button.root.opacity-state-disabled}",
                },
              },
            },
          },
        },
      ],
    ]),
  },
);
const stampedDisabledOpacityStates = (
  stampedDisabledOpacity.contract as {
    anatomy?: { root?: { states?: { disabled?: { opacity?: unknown } } } };
  }
).anatomy?.root?.states?.disabled;
check(
  "stamped State=Disabled opacity 0.5 recovers the authored token, not a dump-slug mint",
  stampedDisabledOpacity.projection.status === "verified-exact" &&
    stampedDisabledOpacityStates?.opacity ===
      "{imported.button.root.opacity-state-disabled}" &&
    !JSON.stringify(stampedDisabledOpacity.contract).includes(
      "imported.button-flowbite-button.state-disabled.opacity",
    ) &&
    stampedDisabledOpacity.notes.some((n) =>
      n.includes("FC-DUMP-PROPOSE-DISABLED-OPACITY-MINTED"),
    ),
);

console.log(
  "\n28. Stamped padding literals recover (FC-DUMP-PROPOSE-PADDING-LITERAL-MINTED)",
);
const paddedFrame = (
  name: string,
  padding: [number, number, number, number],
): DumpNode => ({
  name,
  type: "FRAME",
  layout: {
    mode: "HORIZONTAL",
    primary: "MIN",
    counter: "MIN",
    spacing: 0,
    padding,
    primarySizing: "AUTO",
    counterSizing: "AUTO",
  },
  // A childless unbound frame is a spacer and skips token inversion.
  children: [
    {
      name: "mark",
      type: "TEXT",
      text: { characters: "x", fontSize: 14, fontStyle: "Medium" },
    },
  ],
});
const paddedAlertVariant = (color: "Info" | "Failure"): DumpNode => ({
  name: `Color=${color}`,
  type: "COMPONENT",
  variantProperties: { Color: color },
  children: [
    {
      name: "part-0",
      type: "FRAME",
      children: [
        paddedFrame("alert-icon", [0, 12, 0, 0]),
        paddedFrame("dismiss", [6, 6, 6, 6]),
      ],
    },
  ],
});
const paddedAlertSet: DumpSet = {
  setName: "Alert (flowbite.alert)",
  type: "COMPONENT_SET",
  contractId: "flowbite.alert",
  semantics: { element: "div" },
  propNames: { Color: "color" },
  propertyDefinitions: {
    Color: {
      type: "VARIANT",
      defaultValue: "Info",
      variantOptions: ["Info", "Failure"],
    },
  },
  variants: [paddedAlertVariant("Info"), paddedAlertVariant("Failure")],
};
const paddedAlertAuthored = {
  id: "flowbite.alert",
  props: [{ name: "color", bindings: { figma: { property: "Color" } } }],
  anatomy: {
    root: {
      parts: {
        "part-0": {
          parts: {
            "alert-icon": { literals: { "padding-right": "12px" } },
            dismiss: {
              literals: {
                "padding-top": "6px",
                "padding-right": "6px",
                "padding-bottom": "6px",
                "padding-left": "6px",
              },
            },
          },
        },
      },
    },
  },
};
const stampedPaddedAlert = proposeFromDump(paddedAlertSet, {
  ...baseOpts,
  mintUnbound: true,
  contractsById: new Map([["flowbite.alert", paddedAlertAuthored]]),
});
const unstampedPaddedAlert = proposeFromDump(paddedAlertSet, {
  ...baseOpts,
  mintUnbound: true,
});
const stampedPaddedParts = (
  stampedPaddedAlert.contract as {
    anatomy?: {
      root?: {
        parts?: {
          "part-0"?: {
            parts?: {
              "alert-icon"?: { literals?: Record<string, string> };
              dismiss?: { literals?: Record<string, string> };
            };
          };
        };
      };
    };
  }
).anatomy?.root?.parts?.["part-0"]?.parts;
check(
  "stamped Alert icon/dismiss padding recovers authored literals, not dump-slug mints",
  stampedPaddedAlert.projection.status === "verified-exact" &&
    stampedPaddedParts?.["alert-icon"]?.literals?.["padding-right"] ===
      "12px" &&
    stampedPaddedParts?.dismiss?.literals?.["padding-left"] === "6px" &&
    stampedPaddedParts?.dismiss?.literals?.["padding-right"] === "6px" &&
    !JSON.stringify(stampedPaddedAlert.contract).includes(
      "imported.alert-flowbite-alert.part-0-alert-icon.padding-right",
    ) &&
    !JSON.stringify(stampedPaddedAlert.contract).includes(
      "imported.alert-flowbite-alert.part-0-dismiss.padding",
    ) &&
    stampedPaddedAlert.notes.some((n) =>
      n.includes("FC-DUMP-PROPOSE-PADDING-LITERAL-MINTED"),
    ),
);
check(
  "unstamped Alert padding still mints dump-slugs (Path A)",
  JSON.stringify(unstampedPaddedAlert.contract).includes(
    "imported.alert-flowbite-alert.part-0-alert-icon.padding-right",
  ) ||
    JSON.stringify(unstampedPaddedAlert.contract).includes(
      "imported.alert-flowbite-alert.part-0-dismiss",
    ),
);

console.log(
  "\n29. Stamped DROP_SHADOW recovers the authored token (FC-DUMP-PROPOSE-SHADOW-MINTED)",
);
const cardShadowCorpus = tokenCorpusFromJson({
  primitives: {
    imported: {
      card: {
        root: {
          "box-shadow": {
            $value:
              "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px",
            $type: "shadow",
          },
        },
      },
      button: {
        root: {
          "box-shadow-state-active": {
            default: {
              $value:
                "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(164, 202, 254, 1) 0px 0px 0px 4px",
              $type: "shadow",
            },
            red: {
              $value:
                "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(248, 180, 180, 1) 0px 0px 0px 4px",
              $type: "shadow",
            },
          },
        },
      },
    },
  },
  semantic: {},
  light: {},
  brandDefault: {},
});
const stampedCardShadow = proposeFromDump(
  {
    ...cardShadowSet,
    setName: "Card (flowbite.card)",
    contractId: "flowbite.card",
  },
  {
    ...baseOpts,
    corpus: cardShadowCorpus,
    mintUnbound: true,
    contractsById: new Map([
      [
        "flowbite.card",
        {
          id: "flowbite.card",
          props: [
            { name: "children", bindings: { figma: { property: "Content" } } },
          ],
          anatomy: {
            root: {
              tokens: { "box-shadow": "{imported.card.root.box-shadow}" },
            },
          },
        },
      ],
    ]),
  },
);
const stampedCardShadowTokens = (
  stampedCardShadow.contract as {
    anatomy?: { root?: { tokens?: Record<string, string> } };
  }
).anatomy?.root?.tokens;
check(
  "stamped Card DROP_SHADOW recovers the authored token, not a dump-slug mint",
  stampedCardShadow.projection.status === "verified-exact" &&
    stampedCardShadowTokens?.["box-shadow"] ===
      "{imported.card.root.box-shadow}" &&
    !JSON.stringify(stampedCardShadow.contract).includes(
      "imported.card-flowbite-card.root.box-shadow",
    ) &&
    stampedCardShadow.notes.some((n) =>
      n.includes("FC-DUMP-PROPOSE-SHADOW-MINTED"),
    ),
);
const stampedStateShadow = proposeFromDump(
  { ...stateShadow, contractId: "flowbite.button" },
  {
    ...baseOpts,
    corpus: cardShadowCorpus,
    mintUnbound: true,
    contractsById: new Map([
      [
        "flowbite.button",
        {
          id: "flowbite.button",
          props: [
            { name: "color", bindings: { figma: { property: "Color" } } },
          ],
          anatomy: {
            root: {
              states: {
                active: {
                  "box-shadow":
                    "{imported.button.root.box-shadow-state-active.{color}}",
                },
              },
            },
          },
        },
      ],
    ]),
  },
);
const stampedActiveShadow = (
  stampedStateShadow.contract as {
    anatomy?: { root?: { states?: { active?: { "box-shadow"?: string } } } };
  }
).anatomy?.root?.states?.active;
check(
  "stamped Button Active DROP_SHADOW recovers the authored substituted token, not a dump-slug mint",
  stampedStateShadow.projection.status === "verified-exact" &&
    stampedActiveShadow?.["box-shadow"] ===
      "{imported.button.root.box-shadow-state-active.{color}}" &&
    !JSON.stringify(stampedStateShadow.contract).includes(
      "imported.button-flowbite-button.state-active.box-shadow",
    ) &&
    stampedStateShadow.notes.some((n) =>
      n.includes("FC-DUMP-PROPOSE-SHADOW-MINTED"),
    ),
);

console.log(
  "\n30. Child-part state-only channels (FC-DUMP-PROPOSE-PART-STATE-CHANNELS)",
);
// A Badge-shaped set under State promotion. The merged `icon` part is built
// from DEFAULT-state variants only, so invertNodeEffects never sees the
// Hover-only DROP_SHADOW and the child state loop used to carry fill/stroke
// and nothing else: the icon proposed with ZERO notes, status verified-exact.
// Every child channel the loop drops must carry or NAME — never silent.
const partStateRow = (color: string, state: string): DumpNode => {
  const hover = state === "Hover";
  return {
    name: `Color=${color}, State=${state}`,
    type: "COMPONENT",
    variantProperties: { Color: color, State: state },
    fill: {
      var: `imported/badge/root/background-color/${hover ? "hover/" : ""}${color.toLowerCase()}`,
    },
    children: [
      {
        name: "icon",
        type: "FRAME",
        fill: { hex: "111111" },
        ...(hover ? { effects: shadowStack("0e9f6e") } : {}),
        children: [
          {
            name: "glyph",
            type: "TEXT",
            text: { characters: "i", fontSize: 10, fontStyle: "Regular" },
            fill: { hex: hover ? "ffffff" : "222222" },
          },
        ],
      },
      {
        name: "box",
        type: "FRAME",
        fill: { hex: "333333" },
        stroke: { hex: "444444" },
        strokeWeight: hover ? 2 : 1,
        cornerRadius: hover ? 8 : 4,
        opacity: hover ? 0.8 : 1,
      },
      {
        name: "caption",
        type: "TEXT",
        text: {
          characters: "Badge",
          fontSize: hover ? 14 : 12,
          fontStyle: "Medium",
        },
        fill: { hex: "555555" },
        ...(hover ? { effects: shadowStack("000000") } : {}),
      },
    ],
  };
};
const partStateSet: DumpSet = {
  setName: "Badge (flowbite.badge)",
  type: "COMPONENT_SET",
  semantics: { element: "span" },
  propNames: { Color: "color" },
  statePreviewAxis: {
    axis: "State",
    default: "Default",
    states: ["Hover"],
    primary: "Color",
    pinned: {},
  },
  propertyDefinitions: {
    Color: {
      type: "VARIANT",
      defaultValue: "Default",
      variantOptions: ["Default", "Red"],
    },
    State: {
      type: "VARIANT",
      defaultValue: "Default",
      variantOptions: ["Default", "Hover"],
    },
  },
  variants: [
    partStateRow("Default", "Default"),
    partStateRow("Red", "Default"),
    partStateRow("Default", "Hover"),
    partStateRow("Red", "Hover"),
  ],
};
const partStateExact = proposeFromDump(partStateSet, {
  ...baseOpts,
  mintUnbound: true,
});
type StatePart = {
  states?: Record<string, Record<string, string>>;
  parts?: Record<string, StatePart>;
};
const partStateParts =
  (partStateExact.contract as { anatomy?: { root?: StatePart } }).anatomy?.root
    ?.parts ?? {};
const partNamed = (
  parts: Record<string, StatePart>,
  key: string,
): StatePart | undefined => {
  for (const [k, v] of Object.entries(parts)) {
    if (k === key) return v;
    const deeper = partNamed(v.parts ?? {}, key);
    if (deeper) return deeper;
  }
  return undefined;
};
const iconHover = partNamed(partStateParts, "icon")?.states?.hover;
const boxHover = partNamed(partStateParts, "box")?.states?.hover;
const glyphHover = partNamed(partStateParts, "glyph")?.states?.hover;
const partStateNotes = partStateExact.notes;
const namesChild = (child: string, channel: RegExp): boolean =>
  partStateNotes.some(
    (n) =>
      n.includes(`/${child}`) && n.includes('state "hover"') && channel.test(n),
  );
check(
  "child-part Hover-only DROP_SHADOW carries as the part's states.hover.box-shadow (was silent, verified-exact)",
  partStateExact.projection.status === "verified-exact" &&
    typeof iconHover?.["box-shadow"] === "string" &&
    iconHover["box-shadow"].includes("box-shadow") &&
    partStateNotes.some(
      (n) =>
        n.includes("/icon") &&
        n.includes("box-shadow") &&
        n.includes('"hover"'),
    ),
);
check(
  "child-part Hover stroke weight / corner radius / opacity carry as states.hover border-width / border-radius / opacity",
  typeof boxHover?.["border-width"] === "string" &&
    boxHover["border-width"].includes("border-width") &&
    typeof boxHover?.["border-radius"] === "string" &&
    boxHover["border-radius"].includes("border-radius") &&
    typeof boxHover?.["opacity"] === "string" &&
    boxHover["opacity"].includes("opacity"),
);
check(
  "TEXT child Hover-only effects and font-size change are NAMED per part+state+channel (no text-shadow / text-state vocabulary)",
  namesChild("caption", /effect/i) &&
    namesChild("caption", /fontSize|font-size/),
);
check(
  "depth-2 child (icon/glyph) Hover ink carries as the nested part's states.hover.color or is NAMED — never silent",
  (typeof glyphHover?.["color"] === "string" &&
    glyphHover["color"].includes("color")) ||
    namesChild("glyph", /fill|color/),
);

console.log(
  "\n31. Positioned-child holder (FC-DUMP-PROPOSE-THUMB-HOLDER-RELATIVE)",
);
// The ELLIPSE thumb's placement rides stylesWhen { position: absolute, left/
// right } on part-0-after. declareRelativeIfPositionedChildren read only
// declared.position, so the DIRECT holder (part-0, the 44px track) never
// became the positioning context and emit-react's root fallback anchored
// `right: 2px` to the 100px root: the recovered ToggleSwitch drew its thumb
// OUTSIDE the track. The holder must own position: relative, not the root.
const thumbHolder = (
  thumbShapeExact.contract as {
    anatomy?: {
      root?: {
        declared?: Record<string, string>;
        parts?: { "part-0"?: { declared?: Record<string, string> } };
      };
    };
  }
).anatomy?.root;
check(
  "holder of a stylesWhen position:absolute child declares position: relative (the track, not the root)",
  thumbHolder?.parts?.["part-0"]?.declared?.position === "relative" &&
    thumbHolder?.declared?.position === undefined &&
    thumbWhen.some((row) => row.styles?.position === "absolute"),
);

if (failures.length > 0) {
  console.error(`\n${failures.length}/${checks} exact proposal checks failed:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`\n${checks} exact proposal checks passed.`);
}
