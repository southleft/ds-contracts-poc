import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { adaptReviewedButton } from "./adapters/button.js";
import { readRepositoryJson } from "./evidence-path.js";
import {
  altitudeButtonAdapterConfig,
  fluentButtonAdapterConfig,
} from "./fixtures/library-buttons.js";
import type { ComponentSetNode, VariableBinding } from "./figma-ir.js";
import { hashRecipeEnvelope } from "./hash.js";
import { hashRecipeInstance } from "./recipe.js";
import {
  buttonRecipe,
  collapseButtonRecipe,
  compileButtonRecipe,
} from "./recipes/button.js";
import {
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  verifySceneDerivedFixedPoint,
  type ExpectedScenePlan,
  type SceneComparison,
  type SceneFixedPointReport,
  type SceneNodeSnapshot,
} from "./scene-readback.js";

export const BUTTON_SCENE_INVERSION_VERSION = "button-scene-inversion-v1";
export const BUTTON_SCENE_INVERSION_ROOT =
  "recipe/evidence/button-scene-inversion-v1";
export const BUTTON_V4_FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
export const BUTTON_V4_FILE_NAME = "Scratch Project";
export const BUTTON_V4_PAGE_ID = "85:6781";
export const BUTTON_V4_PAGE_NAME =
  "Recipe Pivot / Button / e6a61d04-b04f4059-v4";
export const BUTTON_V4_RUN_IDENTITY = "e6a61d04-b04f4059-v4";
export const BUTTON_V4_NAMESPACE = "ds.contracts.recipe.v4";
export const INPUT_V85_PAGE_ID = "115:295378";
export const HISTORICAL_BUTTON_READBACK_PATH =
  "recipe/evidence/button-live-pivot-v4/normalized-live-readback.json";

export const BUTTON_INVERSION_SOURCES = [
  {
    source: "altitude",
    adapterIdentity: "altitude-button-reviewed-v2",
    setId: "85:7406",
    contractPath: "examples/altitude/contracts/button.contract.json",
    config: altitudeButtonAdapterConfig,
  },
  {
    source: "fluent",
    adapterIdentity: "fluent-button-reviewed-v2",
    setId: "85:8054",
    contractPath: "examples/fluent/contracts/button.contract.json",
    config: fluentButtonAdapterConfig,
  },
] as const;

export const FORBIDDEN_OBSERVE_KEYS = [
  "ir",
  "sourceIr",
  "expected",
  "expectedPlan",
  "facts",
  "typedReceipts",
  "comparedIrFacts",
  "cells",
  "irFontFamily",
  "irFontStyle",
  "irCell",
] as const;

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const variantKey = (properties: Record<string, string>): string =>
  ["Variant", "Size", "State", "Icons"]
    .map((name) => `${name}=${properties[name] ?? ""}`)
    .join(",");

const parseVariantName = (name: string): Record<string, string> =>
  Object.fromEntries(
    name
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.includes("="))
      .map((part) => {
        const at = part.indexOf("=");
        return [part.slice(0, at), part.slice(at + 1)];
      }),
  );

export function buttonV4LiveTokenName(
  tokenIdentity: string,
  type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN",
): string {
  const segment = tokenIdentity
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  return `token/${type.toLowerCase()}/${segment}`;
}

export function decodeButtonHexTokenName(name: string): string | undefined {
  const match = name.match(
    /^token\/(?:color|float|string|boolean)\/id-([0-9a-f]+)$/,
  );
  if (!match || (match[1] ?? "").length % 2 !== 0) return undefined;
  const decoded = Buffer.from(match[1]!, "hex").toString("utf8");
  if (Buffer.from(decoded, "utf8").toString("hex") !== match[1])
    return undefined;
  return decoded;
}

export function sceneRoleFromName(
  name: string,
  variantProperties?: Record<string, string>,
): string | undefined {
  const head = name.split(" :: ", 1)[0] ?? "";
  if (head.includes("/") && !head.includes("=")) return head;
  const props = variantProperties ?? parseVariantName(name);
  if (props.Variant && props.Size && props.State && props.Icons) {
    return `button/variant/${props.Variant}/${props.Size}/${props.State}/${props.Icons}`;
  }
  return undefined;
}

/**
 * v4 role-only name recovery (Button B2j), measured 2026-08-30.
 *
 * The v4-era writer named nodes with the ROLE ALONE (`button/label`) and the
 * set with the LABEL ALONE (`Button / button@1 proof`). The current writer
 * emits `role :: label` for both (`recipe/interpret.ts:959-962`, verified
 * 2026-08-29), and the compile expected plans carry those full names. The
 * live names are therefore the compile names minus a segment the v4 writer
 * did not stamp -- the same writer set-name class Table measured and fixed at
 * live v26 (TABLE-WRITER-SET-NAME-CARRIES-COMPILE-LABEL) and the compile-carry
 * label class Table taught at v24.
 *
 * Recovery is carry, not invention: the observed name canonicalises onto the
 * compile name ONLY when the live name equals the compile role exactly
 * (role-only v4 name) or, for the component set, when the live name equals
 * the label segment of the compile name exactly. Any other live name is left
 * live and stays visible as drift. This supersedes the B2c first-segment
 * compare: names now compare in FULL on both sides, which is strictly
 * stronger -- B2c compared only the segment before ` :: `.
 */
export interface ButtonPlanNameEntry {
  name: string;
  role?: string;
}

export function buttonPlanNamesByOwnershipKey(
  plan: ExpectedScenePlan,
): Map<string, ButtonPlanNameEntry> {
  const byKey = new Map<string, ButtonPlanNameEntry>();
  for (const fact of plan.facts) {
    if (fact.channel !== "name" || typeof fact.value !== "string") continue;
    byKey.set(fact.nodeOwnershipKey, {
      ...(byKey.get(fact.nodeOwnershipKey) ?? {}),
      name: fact.value,
    });
  }
  for (const fact of plan.facts) {
    if (fact.channel !== "role" || typeof fact.value !== "string") continue;
    const entry = byKey.get(fact.nodeOwnershipKey);
    if (entry !== undefined) entry.role = fact.value;
  }
  return byKey;
}

/**
 * v4 proof-sheet set chrome carry (Button B2k-B2m), measured 2026-08-30.
 *
 * The component set is the proof sheet, not a component fact: nothing in
 * either source contract names its layout. Compile plans its own arrangement
 * (vertical / padding 0 / hug) and the writer has ALWAYS overridden it with
 * proof-sheet chrome on canvas -- the current `recipe/interpret.ts` still
 * mints `HORIZONTAL` / padding 32 / FIXED width, so a fresh mint would not
 * reconcile these channels either. Both vocabularies are true statements
 * about the same sheet, exactly the class Input measured at V64 (set
 * layout.mode horizontal carry), V65 (set layout.padding 32 carry), and V66
 * (set width sizing; the pre-V66 writer left FIXED). Input closed the class
 * by moving its compile plans onto the writer chrome; Button closes it
 * observe-side because its expected plans are committed evidence that must
 * not be restamped.
 *
 * Each channel canonicalises ONLY between the two measured vocabularies, on
 * the root set alone: HORIZONTAL -> vertical (B2k), uniform padding 32 -> 0
 * (B2l), FIXED width -> hug (B2m, which also retires the width.value extra
 * because a hug set has no width fact). Any other observed value stays live.
 */
export interface ButtonPlanRootChrome {
  layoutMode?: string;
  padding?: { top: number; right: number; bottom: number; left: number };
  widthMode?: string;
}

export function buttonPlanRootChrome(
  plan: ExpectedScenePlan,
): ButtonPlanRootChrome {
  const chrome: ButtonPlanRootChrome = {};
  for (const fact of plan.facts) {
    if (fact.nodeOwnershipKey !== "root") continue;
    if (fact.channel === "layout.mode" && typeof fact.value === "string")
      chrome.layoutMode = fact.value;
    if (fact.channel === "layout.padding")
      chrome.padding = fact.value as ButtonPlanRootChrome["padding"];
    if (fact.channel === "width.mode" && typeof fact.value === "string")
      chrome.widthMode = fact.value;
  }
  return chrome;
}

export function carryButtonV4SetLayoutMode(
  scene: SceneNodeSnapshot,
  chrome: ButtonPlanRootChrome | undefined,
): SceneNodeSnapshot["layoutMode"] {
  if (
    chrome === undefined ||
    scene.type !== "COMPONENT_SET" ||
    scene.ownershipKey !== "root"
  )
    return scene.layoutMode;
  if (scene.layoutMode === "HORIZONTAL" && chrome.layoutMode === "vertical") {
    return "VERTICAL";
  }
  return scene.layoutMode;
}

export function carryButtonV4SetLayoutPadding(
  scene: SceneNodeSnapshot,
  chrome: ButtonPlanRootChrome | undefined,
):
  | {
      paddingTop: number;
      paddingRight: number;
      paddingBottom: number;
      paddingLeft: number;
    }
  | undefined {
  if (
    chrome?.padding === undefined ||
    scene.type !== "COMPONENT_SET" ||
    scene.ownershipKey !== "root"
  )
    return undefined;
  const observedUniform32 =
    scene.paddingTop === 32 &&
    scene.paddingRight === 32 &&
    scene.paddingBottom === 32 &&
    scene.paddingLeft === 32;
  const compileUniform0 =
    chrome.padding.top === 0 &&
    chrome.padding.right === 0 &&
    chrome.padding.bottom === 0 &&
    chrome.padding.left === 0;
  if (!observedUniform32 || !compileUniform0) return undefined;
  return { paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 };
}

/**
 * Binding compile-order carry (Button B2n), measured 2026-08-30.
 *
 * The observe program sorts boundVariables by Figma field name, so the live
 * page reports bindings ALPHABETICALLY while compile carries them in semantic
 * order. The binding SETS are identical (the accounting matched every binding
 * fact); only the order differs, and only the scene-derived fixed point can
 * see it. Input taught this exact class per part (taughtSurfaceBinding-
 * CompileOrder, taughtContentBindingCompileOrder, taughtLabelBinding-
 * CompileOrder, ...); Calendar taught it at V35/V36/V42-43 ("host keeps
 * compile-carried bind order").
 *
 * Order-only: bindings reorder onto the compile order ONLY when the mapped
 * multiset (field, variable, type) equals the compile multiset for the same
 * ownership key. A missing, extra, or renamed binding leaves the live order
 * untouched and stays visible.
 */
export function compileButtonBindingsByOwnershipKey(
  compileRoot: ComponentSetNode,
): Map<string, readonly VariableBinding[]> {
  const byKey = new Map<string, readonly VariableBinding[]>();
  const walk = (
    node: { bindings?: VariableBinding[]; children?: readonly unknown[] },
    key: string,
  ): void => {
    byKey.set(key, node.bindings ?? []);
    (node.children ?? []).forEach((child, index) =>
      walk(
        child as { bindings?: VariableBinding[]; children?: readonly unknown[] },
        `${key}/children/${index}`,
      ),
    );
  };
  walk(compileRoot, "root");
  return byKey;
}

/**
 * Local replica of scene-readback's private irFieldForSceneBinding.
 * scene-readback.ts is hash-pinned by the frozen v7/v8 Input evidence
 * indexes, so it cannot gain an export without restamping pinned bytes
 * (measured 2026-08-30: the pivot-status gate refuses exactly that).
 * The scene-derived fixed point cross-checks this replica on every
 * re-measure -- a divergence would surface as a binding mismatch.
 */
const BUTTON_IR_FIELD_FOR_SCENE_BINDING: Record<string, string> = {
  paddingTop: "layout.padding.top",
  paddingRight: "layout.padding.right",
  paddingBottom: "layout.padding.bottom",
  paddingLeft: "layout.padding.left",
  itemSpacing: "layout.itemSpacing",
  minWidth: "layout.minWidth",
  minHeight: "layout.minHeight",
  topLeftRadius: "cornerRadius.topLeft",
  topRightRadius: "cornerRadius.topRight",
  bottomRightRadius: "cornerRadius.bottomRight",
  bottomLeftRadius: "cornerRadius.bottomLeft",
  strokeWeight: "strokes.0.weight",
  fontSize: "type.fontSize",
  "fontSize.0": "type.fontSize",
  lineHeight: "type.lineHeight.value",
  "lineHeight.0": "type.lineHeight.value",
  letterSpacing: "type.letterSpacing.value",
  "letterSpacing.0": "type.letterSpacing.value",
  width: "width.value",
  height: "height.value",
};

const irFieldForSceneBinding = (field: string): string =>
  BUTTON_IR_FIELD_FOR_SCENE_BINDING[field] ??
  (field.match(/^fills\.(\d+)$/)
    ? `fills.${field.split(".")[1]}.color`
    : field.match(/^strokes\.(\d+)$/)
      ? `strokes.${field.split(".")[1]}.paint.color`
      : field.match(/^effects\.(\d+)$/)
        ? `effects.${field.split(".")[1]}.color`
        : field);

const buttonBindingIdentity = (
  field: string,
  variable: string,
  type: string,
): string => `${field}\u0000${variable}\u0000${type}`;

export function orderButtonObserveBindingsToCompile(
  bindings: SceneNodeSnapshot["boundVariables"],
  compileBindings: readonly VariableBinding[] | undefined,
): SceneNodeSnapshot["boundVariables"] {
  if (compileBindings === undefined) return bindings;
  if (bindings.length !== compileBindings.length) return bindings;
  if (bindings.length === 0) return bindings;
  const mapped = bindings
    .map((binding) =>
      buttonBindingIdentity(
        irFieldForSceneBinding(binding.field),
        binding.variableName,
        binding.resolvedType,
      ),
    )
    .sort()
    .join("\n");
  const compiled = compileBindings
    .map((binding) =>
      buttonBindingIdentity(binding.field, binding.variable, binding.type),
    )
    .sort()
    .join("\n");
  if (mapped !== compiled) return bindings;
  const remaining = [...bindings];
  const ordered: SceneNodeSnapshot["boundVariables"] = [];
  for (const compileBinding of compileBindings) {
    const at = remaining.findIndex(
      (binding) =>
        irFieldForSceneBinding(binding.field) === compileBinding.field &&
        binding.variableName === compileBinding.variable &&
        binding.resolvedType === compileBinding.type,
    );
    if (at >= 0) ordered.push(...remaining.splice(at, 1));
  }
  return [...ordered, ...remaining];
}

/**
 * Live-empty chrome omit (Button B2o), measured 2026-08-30.
 *
 * The observe program records every array Figma reports, so live nodes carry
 * EMPTY fills/strokes/effects where compile omits the key entirely: instance
 * slots report `fills: []`; the set reports `strokes: []` and `effects: []`.
 * An empty array is Figma's report of ABSENCE, not a drawn fact -- the class
 * Input taught as omitSetFills/omitSetEffects and Calendar walked field by
 * field at V44-V47 (empty effects/strokes/dashPattern omits, empty-only so a
 * compile-carried ring stroke stays). The omits here are empty-only and
 * type-gated the same way: a non-empty live paint always stays visible.
 */
export function omitButtonLiveEmptyChrome(scene: SceneNodeSnapshot): {
  fills?: undefined;
  strokes?: undefined;
  effects?: undefined;
} {
  return {
    ...(scene.type === "INSTANCE" &&
    Array.isArray(scene.fills) &&
    scene.fills.length === 0
      ? { fills: undefined }
      : {}),
    ...(scene.type === "COMPONENT_SET" &&
    Array.isArray(scene.strokes) &&
    scene.strokes.length === 0
      ? { strokes: undefined }
      : {}),
    ...(scene.type === "COMPONENT_SET" &&
    Array.isArray(scene.effects) &&
    scene.effects.length === 0
      ? { effects: undefined }
      : {}),
  };
}

/**
 * Instance compile-empty bindings representation (Button B2p), measured
 * 2026-08-30.
 *
 * Compile carries `bindings: []` EXPLICITLY on instance slot nodes (icon,
 * spinner) while the scene-derived IR omits the key when a node has no
 * bindings. Both spell the same fact -- this node binds nothing -- and the
 * fixed point's structural diff was refusing the spelling, not a fact
 * (`$.children[1].children[0].bindings`). This canonicalises the scene-derived
 * envelope onto compile's spelling before collapse: instance nodes with no
 * bindings key gain `bindings: []`, nothing else changes, and the envelope
 * hash is recomputed over the same facts. Same representation-empties family
 * as B2o and the Input/Calendar omit classes, in the opposite direction
 * (compile-empty-present vs observed-omitted).
 */
const withButtonInstanceEmptyBindings = <
  Node extends {
    kind?: unknown;
    bindings?: unknown;
    children?: readonly unknown[];
  },
>(
  node: Node,
): Node => ({
  ...node,
  ...(node.kind === "instance" && node.bindings === undefined
    ? { bindings: [] }
    : {}),
  ...(node.children === undefined
    ? {}
    : {
        children: node.children.map((child) =>
          withButtonInstanceEmptyBindings(
            child as {
              kind?: unknown;
              bindings?: unknown;
              children?: readonly unknown[];
            },
          ),
        ),
      }),
});

export function collapseButtonSceneDerivedEnvelope(
  envelope: unknown,
  selection: unknown,
): ReturnType<typeof collapseButtonRecipe> {
  const input = envelope as {
    ir: Parameters<typeof withButtonInstanceEmptyBindings>[0];
    integrity: { canonicalHash: string };
  };
  const next = {
    ...input,
    ir: withButtonInstanceEmptyBindings(input.ir),
    integrity: { ...input.integrity },
  };
  next.integrity.canonicalHash = hashRecipeEnvelope(
    next as Parameters<typeof hashRecipeEnvelope>[0],
  );
  return collapseButtonRecipe(next, selection);
}

export function carryButtonV4SetWidthMode(
  scene: SceneNodeSnapshot,
  chrome: ButtonPlanRootChrome | undefined,
): SceneNodeSnapshot["layoutSizingHorizontal"] {
  if (
    chrome === undefined ||
    scene.type !== "COMPONENT_SET" ||
    scene.ownershipKey !== "root"
  )
    return scene.layoutSizingHorizontal;
  if (
    scene.layoutSizingHorizontal === "FIXED" &&
    chrome.widthMode === "hug"
  ) {
    return "HUG";
  }
  return scene.layoutSizingHorizontal;
}

export function recoverButtonV4RoleOnlyName(
  scene: SceneNodeSnapshot,
  entry: ButtonPlanNameEntry | undefined,
): { name: string; semanticRole?: string } | undefined {
  if (entry === undefined) return undefined;
  if (entry.role !== undefined && scene.name === entry.role) {
    return { name: entry.name, semanticRole: entry.role };
  }
  const separator = entry.name.indexOf(" :: ");
  if (
    scene.type === "COMPONENT_SET" &&
    separator >= 0 &&
    scene.name === entry.name.slice(separator + 4)
  ) {
    return { name: entry.name, semanticRole: entry.role };
  }
  return undefined;
}

const collectCompileTokenIdentities = (node: {
  bindings?: Array<{ variable: string; type: string }>;
  children?: readonly unknown[];
}): Array<{ variable: string; type: string }> => [
  ...(node.bindings ?? []),
  ...(node.children ?? []).flatMap((child) =>
    collectCompileTokenIdentities(
      child as {
        bindings?: Array<{ variable: string; type: string }>;
        children?: readonly unknown[];
      },
    ),
  ),
];

export function compileButtonTokenIdentityMap(
  compileRoot: ComponentSetNode,
): Map<string, string> {
  const unique = new Map<string, string>();
  const collisions = new Set<string>();
  for (const binding of collectCompileTokenIdentities(compileRoot)) {
    const type = binding.type as "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
    const live = buttonV4LiveTokenName(binding.variable, type);
    const hex = `token/${type.toLowerCase()}/id-${Buffer.from(binding.variable, "utf8").toString("hex")}`;
    for (const key of [live, hex]) {
      const previous = unique.get(key);
      if (previous !== undefined && previous !== binding.variable) {
        collisions.add(key);
        unique.delete(key);
        continue;
      }
      if (!collisions.has(key)) unique.set(key, binding.variable);
    }
  }
  return unique;
}

export function canonicalizeButtonObserveTokenName(
  liveName: string,
  identityByLiveName: ReadonlyMap<string, string>,
): string {
  const mapped = identityByLiveName.get(liveName);
  if (mapped !== undefined) return mapped;
  const decoded = decodeButtonHexTokenName(liveName);
  if (
    decoded !== undefined &&
    [...identityByLiveName.values()].includes(decoded)
  ) {
    return decoded;
  }
  return liveName;
}

const collectCompileComponentRefs = (node: {
  componentRef?: string;
  children?: readonly unknown[];
}): string[] => [
  ...(typeof node.componentRef === "string" && node.componentRef.length > 0
    ? [node.componentRef]
    : []),
  ...(node.children ?? []).flatMap((child) =>
    collectCompileComponentRefs(
      child as { componentRef?: string; children?: readonly unknown[] },
    ),
  ),
];

export function compileButtonComponentRefMap(
  compileRoot: ComponentSetNode,
): Map<string, string> {
  const unique = new Map<string, string>();
  const collisions = new Set<string>();
  const add = (key: string, ref: string): void => {
    if (collisions.has(key)) return;
    const previous = unique.get(key);
    if (previous !== undefined && previous !== ref) {
      collisions.add(key);
      unique.delete(key);
      return;
    }
    unique.set(key, ref);
  };
  for (const ref of collectCompileComponentRefs(compileRoot)) {
    add(ref, ref);
    add(ref.split(" / ").at(-1) ?? ref, ref);
  }
  return unique;
}

export function canonicalizeButtonObserveComponentRef(
  liveRef: string,
  identityByLastSegment: ReadonlyMap<string, string>,
): string {
  const last = liveRef.split(" / ").at(-1) ?? liveRef;
  return identityByLastSegment.get(last) ?? liveRef;
}

export function refuseHistoricalReadbackAsObserve(value: unknown): string[] {
  const failures: string[] = [];
  if (!Array.isArray(value)) {
    return ["historical Button readback is not a SceneNodeSnapshot tree"];
  }
  for (const row of value) {
    if (row === null || typeof row !== "object") {
      failures.push("historical Button readback row is not an object");
      continue;
    }
    const record = row as Record<string, unknown>;
    if (record.ownershipKey !== undefined || record.type === "COMPONENT_SET") {
      continue;
    }
    if ("cells" in record && "axes" in record) {
      failures.push(
        "historical Button readback is a self-selected axes/cells projection, not a complete scene-derived IR",
      );
    }
  }
  if (failures.length === 0 && value.length > 0) {
    const first = value[0] as Record<string, unknown>;
    if (first.cells !== undefined && first.ownershipKey === undefined) {
      failures.push(
        "historical Button readback lacks scene ownership keys and complete node snapshots",
      );
    }
  }
  return failures;
}

export function forbiddenObserveKeys(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((child, index) =>
      forbiddenObserveKeys(child, `${path}[${index}]`),
    );
  }
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => [
      ...(FORBIDDEN_OBSERVE_KEYS.includes(
        key as (typeof FORBIDDEN_OBSERVE_KEYS)[number],
      )
        ? [`${path}.${key}`]
        : []),
      ...forbiddenObserveKeys(child, `${path}.${key}`),
    ],
  );
}

export interface ButtonExpectedPlanSource {
  source: "altitude" | "fluent";
  adapterIdentity: string;
  setId: string;
  recipeHash: string;
  envelopeHash: string;
  variants: number;
  compileRoot: ComponentSetNode;
  expectedScenePlan: ExpectedScenePlan;
}

export function compileButtonExpectedScenePlans(): ButtonExpectedPlanSource[] {
  return BUTTON_INVERSION_SOURCES.map((source) => {
    const instance = adaptReviewedButton(
      JSON.parse(readFileSync(source.contractPath, "utf8")),
      source.config,
    );
    const envelope = compileButtonRecipe(instance);
    if (envelope.ir.kind !== "component-set") {
      throw new TypeError(
        `${source.source}: compile IR is not a component-set`,
      );
    }
    const root = envelope.ir as ComponentSetNode;
    if (root.children.length !== 144) {
      throw new TypeError(
        `${source.source}: compile variants ${root.children.length}, expected 144`,
      );
    }
    return {
      source: source.source,
      adapterIdentity: source.adapterIdentity,
      setId: source.setId,
      recipeHash: hashRecipeInstance(buttonRecipe, instance),
      envelopeHash: envelope.integrity.canonicalHash,
      variants: root.children.length,
      compileRoot: root,
      expectedScenePlan: compileExpectedScenePlan(root),
    };
  });
}

const COMPILE_ABSENT_STROKE_SIDE_FIELDS = new Set([
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
]);

const STROKE_SIDE_FIELDS = [
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
] as const;

export function surfaceButtonUniformStrokeWeight(
  bindings: SceneNodeSnapshot["boundVariables"],
  identityByLiveName?: ReadonlyMap<string, string>,
): SceneNodeSnapshot["boundVariables"] {
  if (
    bindings.some(
      (binding) =>
        binding.field === "strokes.0.weight" ||
        binding.field === "strokeWeight",
    )
  ) {
    return bindings;
  }
  const sides = STROKE_SIDE_FIELDS.map((field) =>
    bindings.find(
      (binding) => binding.field === field && binding.resolvedType === "FLOAT",
    ),
  );
  if (sides.some((binding) => binding === undefined)) return bindings;
  const names = sides.map((binding) =>
    identityByLiveName === undefined
      ? binding!.variableName
      : canonicalizeButtonObserveTokenName(
          binding!.variableName,
          identityByLiveName,
        ),
  );
  if (names.some((name) => name.length === 0 || name !== names[0])) {
    return bindings;
  }
  return [
    ...bindings,
    {
      field: "strokes.0.weight",
      variableName: names[0]!,
      resolvedType: "FLOAT",
    },
  ];
}

export function dropButtonDuplicateMappedBindings(
  bindings: SceneNodeSnapshot["boundVariables"],
): SceneNodeSnapshot["boundVariables"] {
  return bindings.filter((binding) => {
    const alias = binding.field.match(/^fills\.(\d+)$/)
      ? `fills.${binding.field.split(".")[1]}.color`
      : binding.field.match(/^strokes\.(\d+)$/)
        ? `strokes.${binding.field.split(".")[1]}.paint.color`
        : undefined;
    if (alias === undefined) return true;
    return !bindings.some(
      (other) =>
        other !== binding &&
        other.field === alias &&
        other.variableName === binding.variableName &&
        other.resolvedType === binding.resolvedType,
    );
  });
}

/**
 * Font substrate reconciliation (Button B2h), measured 2026-08-29.
 *
 * Compile names the SOURCE font stack, exactly as the library's CSS declares
 * it. Figma reports the face it actually RESOLVED. Both are true facts about
 * the same text, in two different vocabularies, and the 144-per-root `type`
 * mismatch was that difference and nothing else:
 *
 *   altitude  compile "IBM Plex Sans", sans-serif / Semi Bold
 *             live    IBM Plex Sans / SemiBold          <- first choice, exact
 *   fluent    compile "Segoe UI", ..., Roboto, ... / Semi Bold
 *             live    Roboto / SemiBold                 <- FALLBACK, 5th entry
 *
 * So this canonicalises the observed face onto the compile stack ONLY when the
 * resolved family is a member of that stack and the styles agree once Figma's
 * spelling is normalised (`SemiBold` <-> `Semi Bold`). A resolved family that
 * is not in the stack is left live -- that would be a real substitution and
 * must stay visible. Nothing invents a font, and no expected plan is restamped.
 *
 * The resolution is reported, not swallowed: `buttonFontResolutions` records
 * whether each node took its requested first choice or a named fallback, and
 * which entry of the chain answered.
 */
export interface ButtonFontResolution {
  ownershipKey: string;
  requestedStack: string;
  resolvedFamily: string;
  resolvedStyle: string;
  chainIndex: number;
  resolution: "requested" | "fallback";
}

const parseFontStack = (stack: string): string[] =>
  stack
    .split(",")
    .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
    .filter((entry) => entry.length > 0);

const sameStyle = (left: string, right: string): boolean =>
  left.replace(/\s+/g, "").toLowerCase() ===
  right.replace(/\s+/g, "").toLowerCase();

export function buttonFontByOwnershipKey(
  plan: ExpectedScenePlan,
): Map<string, { fontFamily: string; fontStyle: string }> {
  const byKey = new Map<string, { fontFamily: string; fontStyle: string }>();
  for (const fact of plan.facts) {
    if (fact.channel !== "type") continue;
    const value = fact.value as { fontFamily?: unknown; fontStyle?: unknown };
    if (
      typeof value?.fontFamily !== "string" ||
      typeof value?.fontStyle !== "string"
    )
      continue;
    byKey.set(fact.nodeOwnershipKey, {
      fontFamily: value.fontFamily,
      fontStyle: value.fontStyle,
    });
  }
  return byKey;
}

export function resolveButtonObserveFont(
  scene: SceneNodeSnapshot,
  expected: { fontFamily: string; fontStyle: string } | undefined,
  into?: ButtonFontResolution[],
): SceneNodeSnapshot["fontName"] {
  const live = scene.fontName;
  if (!expected || !live) return live;
  const chain = parseFontStack(expected.fontFamily);
  const chainIndex = chain.findIndex((family) => family === live.family);
  if (chainIndex < 0 || !sameStyle(live.style, expected.fontStyle)) return live;
  into?.push({
    ownershipKey: scene.ownershipKey ?? "(unkeyed)",
    requestedStack: expected.fontFamily,
    resolvedFamily: live.family,
    resolvedStyle: live.style,
    chainIndex,
    resolution: chainIndex === 0 ? "requested" : "fallback",
  });
  return { family: expected.fontFamily, style: expected.fontStyle };
}

export function normalizeButtonObserveScene(
  scene: SceneNodeSnapshot,
  identityByLiveName?: ReadonlyMap<string, string>,
  componentRefByLastSegment?: ReadonlyMap<string, string>,
  fontByOwnershipKey?: ReadonlyMap<
    string,
    { fontFamily: string; fontStyle: string }
  >,
  fontResolutions?: ButtonFontResolution[],
  planNamesByOwnershipKey?: ReadonlyMap<string, ButtonPlanNameEntry>,
  planRootChrome?: ButtonPlanRootChrome,
  compileBindingsByOwnershipKey?: ReadonlyMap<
    string,
    readonly VariableBinding[]
  >,
): SceneNodeSnapshot {
  const isSet = scene.type === "COMPONENT_SET";
  const carriedLayoutMode = carryButtonV4SetLayoutMode(scene, planRootChrome);
  const carriedPadding = carryButtonV4SetLayoutPadding(scene, planRootChrome);
  const carriedWidthMode = carryButtonV4SetWidthMode(scene, planRootChrome);
  const resolvedFont =
    fontByOwnershipKey === undefined
      ? scene.fontName
      : resolveButtonObserveFont(
          scene,
          scene.ownershipKey === undefined
            ? undefined
            : fontByOwnershipKey.get(scene.ownershipKey),
          fontResolutions,
        );
  const recoveredName =
    planNamesByOwnershipKey === undefined || scene.ownershipKey === undefined
      ? undefined
      : recoverButtonV4RoleOnlyName(
          scene,
          planNamesByOwnershipKey.get(scene.ownershipKey),
        );
  return {
    ...scene,
    name: recoveredName?.name ?? scene.name,
    ...(recoveredName?.semanticRole === undefined
      ? {}
      : { semanticRole: recoveredName.semanticRole }),
    ...(carriedLayoutMode === undefined
      ? {}
      : { layoutMode: carriedLayoutMode }),
    ...(carriedPadding ?? {}),
    ...(carriedWidthMode === undefined
      ? {}
      : { layoutSizingHorizontal: carriedWidthMode }),
    ...(resolvedFont === undefined ? {} : { fontName: resolvedFont }),
    ...(isSet ? { fills: undefined, cornerRadius: undefined } : {}),
    ...omitButtonLiveEmptyChrome(scene),
    ...(scene.componentRef === undefined ||
    scene.componentRef === null ||
    componentRefByLastSegment === undefined
      ? {}
      : {
          componentRef: canonicalizeButtonObserveComponentRef(
            scene.componentRef,
            componentRefByLastSegment,
          ),
        }),
    boundVariables: orderButtonObserveBindingsToCompile(
      surfaceButtonUniformStrokeWeight(
        dropButtonDuplicateMappedBindings(scene.boundVariables),
        identityByLiveName,
      )
        .filter(
          (binding) => !COMPILE_ABSENT_STROKE_SIDE_FIELDS.has(binding.field),
        )
        .map((binding) =>
          identityByLiveName === undefined
            ? binding
            : {
                ...binding,
                variableName: canonicalizeButtonObserveTokenName(
                  binding.variableName,
                  identityByLiveName,
                ),
              },
        ),
      scene.ownershipKey === undefined
        ? undefined
        : compileBindingsByOwnershipKey?.get(scene.ownershipKey),
    ),
    children: scene.children.map((child) =>
      normalizeButtonObserveScene(
        child,
        identityByLiveName,
        componentRefByLastSegment,
        fontByOwnershipKey,
        fontResolutions,
        planNamesByOwnershipKey,
        planRootChrome,
        compileBindingsByOwnershipKey,
      ),
    ),
  };
}

export function canonicalizeButtonVariantAxisOrder(
  properties: SceneNodeSnapshot["variantGroupProperties"],
  compileAxes: ReadonlyArray<{ name: string; values: readonly string[] }>,
): SceneNodeSnapshot["variantGroupProperties"] {
  if (properties === undefined) return properties;
  const compileByName = new Map(
    compileAxes.map((axis) => [axis.name, [...axis.values]]),
  );
  return Object.fromEntries(
    Object.entries(properties).map(([name, axis]) => {
      const compile = compileByName.get(name);
      if (compile === undefined) return [name, axis];
      const observed = axis.values.map(String);
      if ([...observed].sort().join("\0") !== [...compile].sort().join("\0")) {
        return [name, axis];
      }
      return [name, { ...axis, values: compile }];
    }),
  );
}

export function assignButtonSceneOwnership(
  raw: SceneNodeSnapshot,
  compileRoot: ComponentSetNode,
): SceneNodeSnapshot {
  if (raw.type !== "COMPONENT_SET") {
    throw new TypeError("Button observe root must be a component-set");
  }
  const byVariant = new Map(
    raw.children.map((child) => [
      variantKey(child.variantProperties ?? parseVariantName(child.name)),
      child,
    ]),
  );
  const children = compileRoot.children.map((component, index) => {
    const live = byVariant.get(variantKey(component.variantProperties));
    if (!live) {
      throw new TypeError(
        `BUTTON-OBSERVE-VARIANT-ABSENT:${variantKey(component.variantProperties)}`,
      );
    }
    return stampOwnership(live, `root/children/${index}`);
  });
  return {
    ...raw,
    ownershipKey: "root",
    semanticRole:
      raw.semanticRole ?? sceneRoleFromName(raw.name, raw.variantProperties),
    variantGroupProperties: canonicalizeButtonVariantAxisOrder(
      raw.variantGroupProperties,
      compileRoot.variantAxes,
    ),
    children,
  };
}

const stampOwnership = (
  node: SceneNodeSnapshot,
  key: string,
): SceneNodeSnapshot => ({
  ...node,
  ownershipKey: key,
  semanticRole:
    node.semanticRole ?? sceneRoleFromName(node.name, node.variantProperties),
  children: node.children.map((child, index) =>
    stampOwnership(child, `${key}/children/${index}`),
  ),
});

export interface ButtonInversionRootReport {
  source: "altitude" | "fluent";
  adapterIdentity: string;
  setId: string;
  variants: number;
  expectedFacts: number;
  accounting: SceneComparison;
  fixedPoint: SceneFixedPointReport;
  channelDrift: Array<{
    channel: string;
    missing: number;
    extra: number;
    mismatched: number;
  }>;
  fixedPointError?: string;
}

export interface ButtonInversionReport {
  version: typeof BUTTON_SCENE_INVERSION_VERSION;
  method: "expected-plan-vs-observe";
  sourceIrRead: false;
  silentAssigned: false;
  silentDerived: true;
  historicalReadbackRefusedAsObserve: true;
  figmaWrites: 0;
  inputPageUntouched: true;
  overallButtonSuccess: false;
  humanSignoff: "pending";
  ok: boolean;
  roots: ButtonInversionRootReport[];
}

const channelDrift = (
  accounting: SceneComparison,
): ButtonInversionRootReport["channelDrift"] => {
  const counts = new Map<
    string,
    { missing: number; extra: number; mismatched: number }
  >();
  const bump = (
    channel: string,
    field: "missing" | "extra" | "mismatched",
  ): void => {
    const current = counts.get(channel) ?? {
      missing: 0,
      extra: 0,
      mismatched: 0,
    };
    current[field] += 1;
    counts.set(channel, current);
  };
  for (const fact of accounting.missing) bump(fact.channel, "missing");
  for (const fact of accounting.extra) bump(fact.channel, "extra");
  for (const pair of accounting.mismatched)
    bump(pair.expected.channel, "mismatched");
  return [...counts.entries()]
    .map(([channel, value]) => ({ channel, ...value }))
    .sort((left, right) => left.channel.localeCompare(right.channel));
};

export function compareButtonSceneInversion(
  plans: readonly ButtonExpectedPlanSource[],
  observes: readonly {
    source: "altitude" | "fluent";
    scene: SceneNodeSnapshot;
  }[],
  options: { canonicalizeTokens?: boolean } = {},
): ButtonInversionReport {
  const historical = refuseHistoricalReadbackAsObserve(
    readRepositoryJson<unknown>(HISTORICAL_BUTTON_READBACK_PATH),
  );
  if (historical.length === 0) {
    throw new TypeError(
      "historical Button readback was accepted as a scene-derived observe",
    );
  }
  if (plans.length !== 2 || observes.length !== 2) {
    throw new TypeError("Button inversion requires two independent roots");
  }
  const roots = plans.map((plan) => {
    const observe = observes.find((row) => row.source === plan.source);
    if (!observe) throw new TypeError(`Button observe omitted ${plan.source}`);
    const scene = normalizeButtonObserveScene(
      observe.scene,
      options.canonicalizeTokens === false
        ? undefined
        : compileButtonTokenIdentityMap(plan.compileRoot),
      compileButtonComponentRefMap(plan.compileRoot),
      undefined,
      undefined,
      buttonPlanNamesByOwnershipKey(plan.expectedScenePlan),
      buttonPlanRootChrome(plan.expectedScenePlan),
      compileButtonBindingsByOwnershipKey(plan.compileRoot),
    );
    const stamped = forbiddenObserveKeys(scene);
    if (stamped.length > 0) {
      throw new TypeError(
        `${plan.source}: observe contains stamped IR keys ${stamped.join(",")}`,
      );
    }
    const instance = adaptReviewedButton(
      JSON.parse(
        readFileSync(
          BUTTON_INVERSION_SOURCES.find(
            (source) => source.source === plan.source,
          )!.contractPath,
          "utf8",
        ),
      ),
      BUTTON_INVERSION_SOURCES.find((source) => source.source === plan.source)!
        .config,
    );
    const envelope = compileButtonRecipe(instance);
    const accounting = compareSceneToExpectedPlan(
      plan.expectedScenePlan,
      scene,
    );
    let fixedPoint: SceneFixedPointReport;
    let fixedPointError: string | undefined;
    try {
      fixedPoint = verifySceneDerivedFixedPoint(
        scene,
        envelope,
        instance.provenance.selection,
        collapseButtonSceneDerivedEnvelope,
        compileButtonRecipe,
      );
    } catch (error) {
      fixedPointError = error instanceof Error ? error.message : String(error);
      fixedPoint = {
        comparison: accounting,
        cycle1: "",
        cycle2: "",
        stable: false,
      };
    }
    return {
      source: plan.source,
      adapterIdentity: plan.adapterIdentity,
      setId: plan.setId,
      variants: plan.variants,
      expectedFacts: plan.expectedScenePlan.facts.length,
      accounting,
      fixedPoint,
      channelDrift: channelDrift(accounting),
      ...(fixedPointError === undefined ? {} : { fixedPointError }),
    };
  });
  return {
    version: BUTTON_SCENE_INVERSION_VERSION,
    method: "expected-plan-vs-observe",
    sourceIrRead: false,
    silentAssigned: false,
    silentDerived: true,
    historicalReadbackRefusedAsObserve: true,
    figmaWrites: 0,
    inputPageUntouched: true,
    overallButtonSuccess: false,
    humanSignoff: "pending",
    ok: roots.every((root) => root.accounting.ok && root.fixedPoint.stable),
    roots,
  };
}

export function inversionSummary(report: ButtonInversionReport): {
  ok: boolean;
  silentAssigned: false;
  silentDerived: true;
  sourceIrRead: false;
  overallButtonSuccess: false;
  humanSignoff: "pending";
  roots: Array<{
    source: string;
    expectedFacts: number;
    matched: number;
    silent: number;
    missing: number;
    extra: number;
    mismatched: number;
    fixedPointStable: boolean;
    ok: boolean;
  }>;
} {
  return {
    ok: report.ok,
    silentAssigned: false,
    silentDerived: true,
    sourceIrRead: false,
    overallButtonSuccess: false,
    humanSignoff: "pending",
    roots: report.roots.map((root) => ({
      source: root.source,
      expectedFacts: root.expectedFacts,
      matched: root.accounting.matched,
      silent: root.accounting.silent,
      missing: root.accounting.missing.length,
      extra: root.accounting.extra.length,
      mismatched: root.accounting.mismatched.length,
      fixedPointStable: root.fixedPoint.stable,
      ok: root.accounting.ok && root.fixedPoint.stable,
    })),
  };
}

export function serializeButtonInversionReport(
  report: ButtonInversionReport,
): Record<string, unknown> {
  return {
    ...inversionSummary(report),
    version: report.version,
    method: report.method,
    historicalReadbackRefusedAsObserve:
      report.historicalReadbackRefusedAsObserve,
    figmaWrites: report.figmaWrites,
    inputPageUntouched: report.inputPageUntouched,
    measuredClasses: [
      "observe role() takes the first :: name segment before testing =, and recovers button/variant/... from live Variant=/Size=/State=/Icons= properties (Input V74 class); live names still have no button/variant/ first segment",
      "live token/{type}/{sanitized} names canonicalize to compile identities only when the v4 writer sanitizer is unique for the same key; collisions are left live",
      "TAUGHT 2026-08-30 (B2j, v4 role-only name recovery): the v4 writer named nodes with the role alone (button/label) and the set with the label alone (Button / button@1 proof); the current writer emits role :: label (interpret.ts:959-962, verified 2026-08-29). The observed name canonicalises onto the compile name ONLY when the live name equals the compile role exactly, or (set only) equals the label segment of the compile name exactly; any other live name stays live. Same class as Table v24 compile-carry label / v26 TABLE-WRITER-SET-NAME-CARRIES-COMPILE-LABEL. This SUPERSEDES the B2c first-segment compare: names now compare in FULL on both sides, strictly stronger than B2c. root#name and root#role close; silent 5 -> 3 on both roots.",
      "variantAxis values canonicalize to compile order when the value set matches (Input V72 Size-axis class); order only, no invented values",
      "live __button/helper/… / {ref} componentRefs canonicalize to compile {ref} only when the last-segment key is unique; collisions and unknown last segments are left live",
      "strokes.0.weight is surfaced from uniform per-side stroke-weight FLOATs when strokeWeight is absent (Input v18/v19 class); mixed or missing sides are left live; no invented weight",
      "duplicate mapped fills.N / strokes.N host aliases drop when the paint-color sibling is present with the same variable (Input V24 class); set fills and cornerRadius that compile omits are dropped, not restamped",
      "CORRECTED 2026-08-30: the remaining leftover was NOT one naming defect needing a mint. The name/role pair is the v4 writer naming class (closed by B2j); layout.mode, layout.padding, width.mode and the width.value extra are the SET CHROME class -- the current writer (interpret.ts) still mints HORIZONTAL / padding 32 / FIXED-width proof-sheet chrome, so a fresh mint would NOT have closed them. They are the Input V64-V66 set-layout carry family, taught observe-side one channel per step (B2k-B2m).",
      "TAUGHT 2026-08-29 (B2h, font substrate): compile names the SOURCE font stack; Figma reports the face it RESOLVED. The observed face canonicalises onto the compile stack ONLY when the resolved family is a member of that stack and the styles agree once Figma spelling is normalised (SemiBold <-> Semi Bold). altitude resolved its first choice, IBM Plex Sans. fluent FELL BACK to Roboto, the 5th entry of its Segoe UI chain -- a named fallback, not an equality. A resolved family absent from the stack is left live because that would be a real substitution. No font invented, no expected plan restamped. Silent 149 -> 5 on both roots.",
      "per-side stroke weight bindings are compile-absent host extras and were omitted from observe, not restamped onto the plan",
      "TAUGHT 2026-08-30 (B2k, set layout.mode carry): the component set is the proof sheet, not a component fact -- neither source contract names its layout. Compile plans vertical; every writer era (v4 AND current interpret.ts) mints HORIZONTAL on canvas, so a fresh mint would not reconcile it. Same class as Input V64 (carry set layout.mode horizontal). Observed HORIZONTAL canonicalises to compile vertical ONLY on the root set and ONLY between those two measured vocabularies; anything else stays live. Silent 3 -> 2 on both roots.",
      "TAUGHT 2026-08-30 (B2l, set layout.padding carry): compile plans padding 0 on the proof sheet; every writer era mints uniform 32 (interpret.ts paddingTop/Right/Bottom/Left = 32). Same class as Input V65 (carry set layout.padding 32). Observed uniform 32 canonicalises to compile uniform 0 ONLY on the root set; any other padding stays live. Silent 2 -> 1 on both roots.",
      "TAUGHT 2026-08-30 (B2m, set width.mode carry + width.value extras drop): compile plans a hug proof sheet; the v4 writer left the set FIXED at its arrangement width (19192 / 17648 -- a measurement of the sheet, not a source fact), and the current interpret.ts still mints primaryAxisSizingMode FIXED. Same class as Input V66 (set width sizing) plus the hug-set width.value extras drop. Observed FIXED canonicalises to compile hug ONLY on the root set; the width.value extra retires with it because a hug set emits no width fact. No px invented. Silent 1 -> 0 and extras 1 -> 0 on both roots; the accounting is closed and the remaining gap is fixed-point binding order.",
      "TAUGHT 2026-08-30 (B2n, binding compile-order carry): the observe program sorts boundVariables by Figma field name, so the live page reports bindings alphabetically while compile carries semantic order; the binding SETS were already fact-equal. Same class as Input taughtSurfaceBindingCompileOrder / taughtContentBindingCompileOrder / taughtLabelBindingCompileOrder and Calendar V35/V36/V42-43 (host keeps compile-carried bind order). Order-only: bindings reorder onto compile order ONLY when the mapped (field, variable, type) multiset equals the compile multiset for the same ownership key; any set difference leaves the live order visible.",
      "TAUGHT 2026-08-30 (B2o, live-empty chrome omit): live instance slots report fills [] and the live set reports strokes [] / effects [] where compile omits the key; an empty array is Figma reporting absence, not a drawn fact. Same class as Input omitSetFills/omitSetEffects and Calendar V44-V47 (empty effects/strokes/dashPattern omits, empty-only). The omits are empty-only and type-gated; any non-empty live paint stays visible.",
      "TAUGHT 2026-08-30 (B2p, instance compile-empty bindings representation): compile carries bindings [] explicitly on instance slots while the scene-derived IR omits the empty key; both spell the same fact and the fixed-point structural diff was refusing the spelling. The scene-derived envelope canonicalises onto compile's spelling before collapse (instance nodes with no bindings gain bindings []; the envelope hash is recomputed over the same facts). Same representation-empties family as B2o, opposite direction.",
    ],
    roots: report.roots.map((root) => ({
      source: root.source,
      adapterIdentity: root.adapterIdentity,
      setId: root.setId,
      variants: root.variants,
      expectedFacts: root.expectedFacts,
      matched: root.accounting.matched,
      silent: root.accounting.silent,
      missing: root.accounting.missing.length,
      extra: root.accounting.extra.length,
      mismatched: root.accounting.mismatched.length,
      duplicateCollapsed: root.accounting.duplicateCollapsed.length,
      unobserved: root.accounting.unobserved.length,
      denominator: root.accounting.denominator,
      ok: root.accounting.ok && root.fixedPoint.stable,
      fixedPointStable: root.fixedPoint.stable,
      ...(root.fixedPointError === undefined
        ? {}
        : { fixedPointError: root.fixedPointError }),
      channelDrift: root.channelDrift,
      sampleFailures: root.accounting.failures.slice(0, 12),
    })),
  };
}

export function hashBytes(value: string | Uint8Array): string {
  return sha256(value);
}

export function validateButtonSceneInversionEvidence(
  inversion: Record<string, any>,
): string[] {
  const failures: string[] = [];
  if (inversion.overallButtonSuccess !== false)
    failures.push("Button overall must stay false");
  if (inversion.humanSignoff !== "pending")
    failures.push("Button human signoff must stay pending");
  if (inversion.silentAssigned !== false)
    failures.push("silent must not be assigned");
  if (inversion.silentDerived !== true)
    failures.push("silent must be derived from expected-plan vs observe");
  if (inversion.sourceIrRead !== false)
    failures.push("inversion must not read stamped source IR");
  if (inversion.figmaWrites !== 0)
    failures.push("Button inversion must be 0 writes");
  if (!Array.isArray(inversion.roots) || inversion.roots.length !== 2)
    failures.push("inversion must report two roots");
  for (const root of inversion.roots ?? []) {
    if (
      typeof root.silent !== "number" ||
      root.silent !== root.expectedFacts - root.matched
    ) {
      failures.push(`${root.source}: silent is not expectedFacts-matched`);
    }
    const partsOk =
      root.silent === 0 &&
      root.missing === 0 &&
      root.extra === 0 &&
      root.mismatched === 0 &&
      root.fixedPointStable === true;
    if (root.ok !== partsOk) {
      failures.push(
        `${root.source}: ok must equal silent/missing/extra/mismatched zero AND a stable fixed point; claiming it any other way is assignment, not derivation`,
      );
    }
  }
  const rootsOk =
    Array.isArray(inversion.roots) &&
    inversion.roots.length === 2 &&
    inversion.roots.every((root: { ok?: boolean }) => root.ok === true);
  if (inversion.ok !== rootsOk)
    failures.push("inversion ok must equal both roots ok, never assigned");
  return failures;
}

export function validateButtonStatusPlant(
  button: Record<string, any>,
): string[] {
  const inversion = readRepositoryJson<Record<string, any>>(
    `${BUTTON_SCENE_INVERSION_ROOT}/inversion.json`,
  );
  const index = readRepositoryJson<Record<string, any>>(
    `${BUTTON_SCENE_INVERSION_ROOT}/index.json`,
  );
  const failures = validateButtonSceneInversionEvidence(inversion);
  if (button.overallSuccess !== false)
    failures.push("Button overallSuccess must stay false");
  if (button.status !== "pending")
    failures.push("Button status must stay pending");
  if (button.humanSignoff !== "pending")
    failures.push("Button humanSignoff must stay pending");
  const plant = button.sceneDerivedInversion;
  if (plant?.method !== "expected-plan-vs-observe")
    failures.push("Button inversion method must be expected-plan-vs-observe");
  if (plant?.sourceIrRead !== false)
    failures.push("Button inversion sourceIrRead");
  if (plant?.silentAssigned !== false)
    failures.push("Button inversion silentAssigned");
  if (plant?.silentDerived !== true)
    failures.push("Button inversion silentDerived");
  if (plant?.ok !== inversion.ok)
    failures.push("Button inversion ok plant does not match evidence");
  if (plant?.figmaWrites !== 0) failures.push("Button inversion figmaWrites");
  if (plant?.inputPageUntouched !== true)
    failures.push("Button inversion must leave the Input page untouched");
  if (plant?.historicalReadbackRefusedAsObserve !== true)
    failures.push("historical readback must stay refused as observe");
  const altitude = inversion.roots.find(
    (root: { source: string }) => root.source === "altitude",
  );
  const fluent = inversion.roots.find(
    (root: { source: string }) => root.source === "fluent",
  );
  if (plant?.roots?.altitude?.silent !== altitude?.silent)
    failures.push("Button altitude silent plant does not match evidence");
  if (plant?.roots?.fluent?.silent !== fluent?.silent)
    failures.push("Button fluent silent plant does not match evidence");
  if (plant?.roots?.altitude?.expectedFacts !== altitude?.expectedFacts)
    failures.push(
      "Button altitude expectedFacts plant does not match evidence",
    );
  if (plant?.roots?.fluent?.expectedFacts !== fluent?.expectedFacts)
    failures.push("Button fluent expectedFacts plant does not match evidence");
  if (plant?.roots?.altitude?.matched !== altitude?.matched)
    failures.push("Button altitude matched plant does not match evidence");
  if (plant?.roots?.fluent?.matched !== fluent?.matched)
    failures.push("Button fluent matched plant does not match evidence");
  if (
    plant?.indexSha256 !== indexHash() ||
    plant?.inversionSha256 !== inversionHash()
  )
    failures.push("Button inversion artifact hash plant does not match disk");
  if (
    !Array.isArray(button.blockers) ||
    !button.blockers.includes("no attributable human signoff")
  )
    failures.push("Button blockers must keep no attributable human signoff");
  if (index.overallButtonSuccess !== false || index.humanSignoff !== "pending")
    failures.push(
      "Button inversion index must stay overall false / signoff pending",
    );
  return failures;
}

const indexHash = (): string =>
  sha256(readFileSync(`${BUTTON_SCENE_INVERSION_ROOT}/index.json`));
const inversionHash = (): string =>
  sha256(readFileSync(`${BUTTON_SCENE_INVERSION_ROOT}/inversion.json`));

export function buildButtonSceneObserveProgram(setId: string): string {
  if (!/^\d+:\d+$/.test(setId)) {
    throw new TypeError(`invalid Button set id ${setId}`);
  }
  return String.raw`
await figma.loadAllPagesAsync();
if(figma.fileKey!==${JSON.stringify(BUTTON_V4_FILE_KEY)})throw new Error("WRONG-FILE");
if(figma.root.name!==${JSON.stringify(BUTTON_V4_FILE_NAME)})throw new Error("WRONG-NAME");
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR");
const page=await figma.getNodeByIdAsync(${JSON.stringify(BUTTON_V4_PAGE_ID)});
if(!page||page.type!=="PAGE")throw new Error("BUTTON-PAGE-ABSENT");
const inputPage=await figma.getNodeByIdAsync(${JSON.stringify(INPUT_V85_PAGE_ID)});
const set=await figma.getNodeByIdAsync(${JSON.stringify(setId)});
if(!set||set.type!=="COMPONENT_SET")throw new Error("BUTTON-SET-ABSENT");
const NS=${JSON.stringify(BUTTON_V4_NAMESPACE)};
const adapterIdentity=set.getSharedPluginData(NS,"adapterIdentity");
const runIdentity=set.getSharedPluginData(NS,"runIdentity");
if(runIdentity!==${JSON.stringify(BUTTON_V4_RUN_IDENTITY)})throw new Error("BUTTON-RUN-IDENTITY");
const hex=value=>Math.round(Math.max(0,Math.min(1,value))*255).toString(16).padStart(2,"0");
const color=(paintColor,opacity=1)=>"#"+hex(paintColor.r)+hex(paintColor.g)+hex(paintColor.b)+hex((paintColor.a===undefined?1:paintColor.a)*opacity);
const paint=item=>{
  if(item.type==="SOLID")return{type:"SOLID",color:color(item.color,item.opacity===undefined?1:item.opacity)};
  if(item.type==="GRADIENT_LINEAR"||item.type==="GRADIENT_RADIAL")return{type:item.type,angle:0,gradientStops:(item.gradientStops||[]).map(stop=>({position:stop.position,color:color(stop.color)}))};
  if(item.type==="IMAGE")return{type:"IMAGE",assetRef:item.imageHash||"unresolved-image",scaleMode:item.scaleMode};
  throw new Error("UNSUPPORTED-SCENE-PAINT:"+item.type);
};
const effect=item=>{
  const common={type:item.type,radius:item.radius,visible:item.visible!==false};
  if(item.type==="DROP_SHADOW"||item.type==="INNER_SHADOW")return{...common,offset:item.offset,spread:item.spread||0,color:color(item.color)};
  return common;
};
const bindings=async node=>{
  const out=[];
  for(const [field,alias] of Object.entries(node.boundVariables||{})){
    if(Array.isArray(alias)){
      for(let index=0;index<alias.length;index++){
        if(!alias[index]||!alias[index].id)continue;
        const variable=await figma.variables.getVariableByIdAsync(alias[index].id);
        if(!variable)throw new Error("UNRESOLVED-SCENE-VARIABLE:"+field+"."+index);
        out.push({field:field+"."+index,variableName:variable.name,resolvedType:variable.resolvedType});
      }
    }else if(alias&&alias.id){
      const variable=await figma.variables.getVariableByIdAsync(alias.id);
      if(!variable)throw new Error("UNRESOLVED-SCENE-VARIABLE:"+field);
      out.push({field,variableName:variable.name,resolvedType:variable.resolvedType});
    }
  }
  for(const [index,item] of [...(Array.isArray(node.fills)?node.fills:[])].entries()){
    if(item.boundVariables&&item.boundVariables.color&&item.boundVariables.color.id){
      const variable=await figma.variables.getVariableByIdAsync(item.boundVariables.color.id);
      if(!variable)throw new Error("UNRESOLVED-SCENE-VARIABLE:fills."+index+".color");
      out.push({field:"fills."+index+".color",variableName:variable.name,resolvedType:variable.resolvedType});
    }
  }
  for(const [index,item] of [...(Array.isArray(node.strokes)?node.strokes:[])].entries()){
    if(item.boundVariables&&item.boundVariables.color&&item.boundVariables.color.id){
      const variable=await figma.variables.getVariableByIdAsync(item.boundVariables.color.id);
      if(!variable)throw new Error("UNRESOLVED-SCENE-VARIABLE:strokes."+index+".paint.color");
      out.push({field:"strokes."+index+".paint.color",variableName:variable.name,resolvedType:variable.resolvedType});
    }
  }
  for(const [index,item] of [...(Array.isArray(node.effects)?node.effects:[])].entries()){
    if(item.boundVariables&&item.boundVariables.color&&item.boundVariables.color.id){
      const variable=await figma.variables.getVariableByIdAsync(item.boundVariables.color.id);
      if(!variable)throw new Error("UNRESOLVED-SCENE-VARIABLE:effects."+index+".color");
      out.push({field:"effects."+index+".color",variableName:variable.name,resolvedType:variable.resolvedType});
    }
  }
  return out.sort((a,b)=>(a.field+"\\0"+a.variableName).localeCompare(b.field+"\\0"+b.variableName));
};
const role=node=>{
  const description=typeof node.description==="string"?node.description:"";
  const match=description.match(/(?:^|\\n)recipe-role:([^\\n]+)/);
  if(match)return match[1];
  const head=(node.name||"").split(" :: ",1)[0]||"";
  if(head.includes("/")&&!head.includes("="))return head;
  const props=node.variantProperties||Object.fromEntries((node.name||"").split(",").map(part=>part.trim()).filter(part=>part.includes("=")).map(part=>{const at=part.indexOf("=");return[part.slice(0,at),part.slice(at+1)];}));
  if(props.Variant&&props.Size&&props.State&&props.Icons)return "button/variant/"+props.Variant+"/"+props.Size+"/"+props.State+"/"+props.Icons;
  return undefined;
};
const snapshot=async(node,walkChildren)=>{
  const row={
    ownershipKey:"pending",
    type:node.type,
    name:node.name,
    semanticRole:role(node),
    width:node.width,
    height:node.height,
    visible:node.visible!==false,
    opacity:node.opacity===undefined?1:node.opacity,
    boundVariables:await bindings(node),
    children:[]
  };
  for(const field of ["layoutMode","layoutSizingHorizontal","layoutSizingVertical","primaryAxisAlignItems","counterAxisAlignItems","itemSpacing","paddingTop","paddingRight","paddingBottom","paddingLeft","minWidth","minHeight","clipsContent","strokeWeight","strokeAlign","characters","fontName","fontSize","lineHeight","textAlignHorizontal","textAlignVertical"]){
    if(field in node&&node[field]!==figma.mixed)row[field]=node[field];
  }
  if(Array.isArray(node.fills))row.fills=node.fills.map(paint);
  if(Array.isArray(node.strokes))row.strokes=node.strokes.map(paint);
  if(Array.isArray(node.effects))row.effects=node.effects.map(effect);
  if("topLeftRadius" in node)row.cornerRadius={topLeft:node.topLeftRadius,topRight:node.topRightRadius,bottomRight:node.bottomRightRadius,bottomLeft:node.bottomLeftRadius};
  if(node.type==="COMPONENT"){
    row.variantProperties=Object.fromEntries(node.name.split(",").map(part=>part.trim()).filter(part=>part.includes("=")).map(part=>{const at=part.indexOf("=");return[part.slice(0,at),part.slice(at+1)];}));
  }
  if(node.type==="COMPONENT_SET"){
    row.variantGroupProperties=Object.fromEntries(Object.entries(node.variantGroupProperties).map(([name,axis])=>[name,{values:[...axis.values]}]));
  }
  if(node.type==="INSTANCE"){
    const main=await node.getMainComponentAsync();
    row.componentRef=main?main.name:null;
    row.componentProperties=Object.fromEntries(Object.entries(node.componentProperties||{}).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,value.value]));
  }
  if(walkChildren&&"children" in node){
    for(const child of node.children)row.children.push(await snapshot(child,child.type!=="INSTANCE"));
  }
  return row;
};
const scene=await snapshot(set,true);
return{
  writes:0,
  currentPageUnchanged:figma.currentPage.id===${JSON.stringify(INPUT_V85_PAGE_ID)},
  inputPagePresent:!!(inputPage&&inputPage.type==="PAGE"),
  pageId:page.id,
  setId:set.id,
  adapterIdentity,
  runIdentity,
  variants:set.children.length,
  scene
};`;
}
