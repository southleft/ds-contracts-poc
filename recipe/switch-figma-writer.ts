/**
 * switch@1 Figma writer.
 *
 * Inherits the hardened calendar/table writer shape: exact file identity,
 * signed-page refuse, owned variable collections, font provenance + named
 * fallback walk (no Inter), set name carries the compile label, hug text
 * records intrinsic size before a 0-width parent can collapse it, layout
 * then children then sizing.
 *
 * Switch is a standalone control + label row. One component set per
 * source: Checked × Disabled (4 variants). Thumb is a filled circle
 * inside the track. MUI sibling overlay and baked track opacity are receipted.
 *
 * No live write happens here. Executing the program requires a separate
 * PREPARE / AUTHORIZE / attempt lineage.
 */
import type { ComponentSetNode, IRNode, VariableBinding } from "./figma-ir.js";
import { figmaWriterRuntime } from "./figma-writer-runtime.js";
import type { RecipeEnvelope } from "./envelope.js";
import { canonicalJson } from "./normalize.js";
import { SWITCH_DISABLED, SWITCH_CHECKED } from "./recipes/switch.js";
import {
  buildFigmaVariableNameMap,
  sanitizeFigmaVariableName,
} from "./interpret.js";

export const SWITCH_FIGMA_NAMESPACE = "ds.contracts.switch.recipe.v1";
export const SWITCH_FIGMA_WRITER_VERSION = 2;
export const SWITCH_FIGMA_RUN_SUFFIX = "switch-v12";
/** v11 stay (Chakra thumb: CSS scale 0.8 lowered (size, inset, shadow)) is preserved as evidence and never written again. */
export const FORBIDDEN_SWITCH_V11_PAGE_ID = "218:88545";
/** v10 stay (Chakra Switch, captured today from a config entry authored as the person's step, proposed with no --set as the sixth source) is preserved as evidence and never written again. */
export const FORBIDDEN_SWITCH_V10_PAGE_ID = "218:88332";
/** v9 stay (proposed MUI (bare) and shadcn (bare, oklch, calc travel, border-inset thumb) as fourth and fifth sources) is preserved as evidence and never written again. */
export const FORBIDDEN_SWITCH_V9_PAGE_ID = "218:88119";
/** v8 stay (proposed MUI (bare, from its capture) and shadcn (bare, oklch, calc travel) as fourth and fifth sources) is preserved as evidence and never written again. */
export const FORBIDDEN_SWITCH_V8_PAGE_ID = "218:87064";
/** v7 stay (runtime: a shadowed frame clips unless the IR says otherwise (measured against Chromium)) is preserved as evidence and never written again. */
export const FORBIDDEN_SWITCH_V7_PAGE_ID = "218:85571";
/** v6 stay (runtime: a lowered shadow shows behind its node only when the node is opaque) is preserved as evidence and never written again. */
export const FORBIDDEN_SWITCH_V6_PAGE_ID = "218:84089";
/** v5 stay (runtime: CSS shadows never show behind their node; frames clip only when the IR says so) is preserved as evidence and never written again. */
export const FORBIDDEN_SWITCH_V5_PAGE_ID = "214:82669";
/** v4 stay (AntD handle shadow carried (was recorded none)) is preserved as evidence and never written again. */
export const FORBIDDEN_SWITCH_V4_PAGE_ID = "211:80480";
/** v3 stay (shared-runtime proof) is preserved as evidence and never written again. */
export const FORBIDDEN_SWITCH_V3_PAGE_ID = "199:78941";
export const FORBIDDEN_SWITCH_V1_PAGE_ID = "183:75302";

export const FORBIDDEN_INPUT_NAMESPACE = "ds.contracts.input.recipe.v5";
export const FORBIDDEN_INPUT_RUN_IDENTITY = "4a074b24-e8503dd5-input-v5";
export const FORBIDDEN_INPUT_PAGE_ID = "115:295378";
export const FORBIDDEN_COMBOBOX_NAMESPACE = "ds.contracts.combobox.recipe.v1";
export const FORBIDDEN_COMBOBOX_V41_PAGE_ID = "163:35981";
export const FORBIDDEN_COMBOBOX_V42_PAGE_ID = "183:70641";
export const FORBIDDEN_BUTTON_PAGE_ID = "183:69150";
export const FORBIDDEN_PRESERVED_BUTTON_PAGE_ID = "85:6781";
export const FORBIDDEN_TABLE_NAMESPACE = "ds.contracts.table.recipe.v1";
export const FORBIDDEN_TABLE_PAGE_ID = "173:48924";
export const FORBIDDEN_CALENDAR_PAGE_ID = "181:64873";
export const FORBIDDEN_CHECKBOX_NAMESPACE = "ds.contracts.checkbox.recipe.v1";
export const FORBIDDEN_CHECKBOX_PAGE_ID = "183:74742";
export const FORBIDDEN_RADIO_NAMESPACE = "ds.contracts.radio.recipe.v1";
export const FORBIDDEN_RADIO_PAGE_ID = "183:75031";

export const SWITCH_FIGMA_VARIANTS_PER_SOURCE =
  SWITCH_CHECKED.length * SWITCH_DISABLED.length;

export interface SwitchVariablePlan {
  identity: string;
  name: string;
  type: "COLOR" | "FLOAT";
  value: string | number;
}

export interface SwitchFigmaWriterInput {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelope: RecipeEnvelope;
}

export interface SwitchFigmaSourcePlan {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelopeHash: string;
  sourceId: string;
  sourceName: string;
  switchAxes: Record<string, string[]>;
  switchSet: ComponentSetNode;
  variables: SwitchVariablePlan[];
  comparedIrFacts: number;
}

export interface SwitchFigmaWriter {
  pageName: string;
  target: "scratch" | "plugin";
  runIdentity: string;
  namespace: string;
  sourcePlans: SwitchFigmaSourcePlan[];
  code: string;
}

const walk = (node: IRNode, visit: (candidate: IRNode) => void): void => {
  visit(node);
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  )
    for (const child of node.children) walk(child, visit);
};

const atPath = (value: unknown, field: string): unknown =>
  field.split(".").reduce<unknown>((current, part) => {
    if (current === null || typeof current !== "object") return undefined;
    const key = /^\d+$/.test(part) ? Number(part) : part;
    return (current as Record<string | number, unknown>)[key];
  }, value);

const variableType = (
  binding: VariableBinding,
  value: unknown,
): "COLOR" | "FLOAT" => {
  if (binding.type === "COLOR") {
    if (typeof value !== "string")
      throw new TypeError(
        `switch live writer: ${binding.field} is not a colour fallback`,
      );
    return "COLOR";
  }
  if (binding.type === "FLOAT") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(
        `switch live writer: ${binding.field} is not a numeric fallback`,
      );
    return "FLOAT";
  }
  throw new TypeError(
    `switch live writer: unsupported binding type ${binding.type}`,
  );
};

const requireSet = (root: IRNode, role: string): ComponentSetNode => {
  if (root.kind === "component-set" && root.role === role) return root;
  throw new TypeError(`switch live writer: required ${role} set`);
};

const axisValues = (set: ComponentSetNode, name: string): string[] => {
  const axis = set.variantAxes.find((candidate) => candidate.name === name);
  if (!axis) throw new TypeError(`switch live writer: missing ${name} axis`);
  return [...axis.values];
};

const countComparedFacts = (node: IRNode): number => {
  let total = 0;
  walk(node, (candidate) => {
    total += 1;
    total += (candidate.bindings ?? []).length;
  });
  return total;
};

const planSource = (
  input: SwitchFigmaWriterInput,
): SwitchFigmaSourcePlan => {
  if (
    input.envelope.recipe.id !== "switch" ||
    input.envelope.recipe.version !== 1
  )
    throw new TypeError("switch live writer requires switch@1");
  if (input.envelope.archetype !== "toggle / switch")
    throw new TypeError("switch live writer requires the toggle / switch archetype");

  const switchSet = requireSet(input.envelope.ir, "switch/set");
  const switchAxes = {
    Checked: axisValues(switchSet, "Checked"),
    Disabled: axisValues(switchSet, "Disabled"),
  };
  if (canonicalJson(switchAxes.Checked) !== canonicalJson([...SWITCH_CHECKED]))
    throw new TypeError("switch live writer: incomplete Checked axis");
  if (
    canonicalJson(switchAxes.Disabled) !== canonicalJson([...SWITCH_DISABLED])
  )
    throw new TypeError("switch live writer: incomplete Disabled axis");
  if (switchSet.children.length !== SWITCH_FIGMA_VARIANTS_PER_SOURCE)
    throw new TypeError("switch live writer: incomplete variant matrix");

  const registry = new Map<string, SwitchVariablePlan>();
  walk(switchSet, (node) => {
    if (node.kind === "instance")
      throw new TypeError(
        `switch live writer: unexpected instance ${node.componentRef}`,
      );
    for (const binding of node.bindings ?? []) {
      const value = atPath(node, binding.field);
      const type = variableType(binding, value);
      const key = `${type}:${binding.variable}`;
      const previous = registry.get(key);
      if (previous && canonicalJson(previous.value) !== canonicalJson(value))
        throw new TypeError(
          `switch live writer: conflicting fallback for ${binding.variable}`,
        );
      registry.set(key, {
        identity: binding.variable,
        name: sanitizeFigmaVariableName(binding.variable, type),
        type,
        value: value as string | number,
      });
    }
  });

  buildFigmaVariableNameMap(
    [...registry.values()].map(({ identity, type }) => ({
      tokenIdentity: identity,
      type,
    })),
  );
  if (registry.size === 0)
    throw new TypeError("switch live writer: zero planned variables");

  return {
    adapterIdentity: input.adapterIdentity,
    displayName: input.displayName,
    recipeHash: input.recipeHash,
    envelopeHash: input.envelope.integrity.canonicalHash,
    sourceId: input.envelope.id,
    sourceName: input.envelope.name,
    switchAxes,
    switchSet,
    variables: [...registry.values()].sort((left, right) =>
      `${left.type}:${left.identity}`.localeCompare(
        `${right.type}:${right.identity}`,
        "en",
      ),
    ),
    comparedIrFacts: countComparedFacts(input.envelope.ir),
  };
};

export function validateSwitchFigmaSourcePlans(
  plans: readonly SwitchFigmaSourcePlan[],
): string[] {
  const failures: string[] = [];
  if (plans.length === 0) failures.push("switch live writer: no sources");
  const identities = new Set(plans.map((plan) => plan.adapterIdentity));
  if (identities.size !== plans.length)
    failures.push("switch live writer: duplicate adapter identity");
  for (const plan of plans) {
    if (plan.variables.length === 0)
      failures.push(`${plan.adapterIdentity}: variables denominator is zero`);
    if (plan.comparedIrFacts <= 0)
      failures.push(
        `${plan.adapterIdentity}: compared facts denominator is zero`,
      );
    if (plan.switchSet.children.length !== SWITCH_FIGMA_VARIANTS_PER_SOURCE)
      failures.push(
        `${plan.adapterIdentity}: expected ${SWITCH_FIGMA_VARIANTS_PER_SOURCE} variants`,
      );
  }
  return failures;
}

const WRITER_RUNTIME_SPEC = {
  "collectionLabel": "Recipe Switch",
  "mint": {
    "kind": "set",
    "field": "switchSet"
  },
  "forbiddenPages": [
    { "id": "218:88545", "marker": "SWITCH-V11-PAGE" },
    { "id": "218:88332", "marker": "SWITCH-V10-PAGE" },
    { "id": "218:88119", "marker": "SWITCH-V9-PAGE" },
    { "id": "218:87064", "marker": "SWITCH-V8-PAGE" },
    { "id": "218:85571", "marker": "SWITCH-V7-PAGE" },
    { "id": "218:84089", "marker": "SWITCH-V6-PAGE" },
    { "id": "214:82669", "marker": "SWITCH-V5-PAGE" },
    { "id": "211:80480", "marker": "SWITCH-V4-PAGE" },
    { "id": "199:78941", "marker": "SWITCH-V3-PAGE" },
    {
      "id": "115:295378",
      "marker": "INPUT-PAGE"
    },
    {
      "id": "163:35981",
      "marker": "COMBOBOX-PAGE"
    },
    {
      "id": "183:70641",
      "marker": "COMBOBOX-V42-PAGE"
    },
    {
      "id": "183:69150",
      "marker": "BUTTON-PAGE"
    },
    {
      "id": "85:6781",
      "marker": "PRESERVED-BUTTON-PAGE"
    },
    {
      "id": "173:48924",
      "marker": "TABLE-PAGE"
    },
    {
      "id": "181:64873",
      "marker": "CALENDAR-PAGE"
    },
    {
      "id": "183:74742",
      "marker": "CHECKBOX-PAGE"
    },
    {
      "id": "183:75031",
      "marker": "RADIO-PAGE"
    },
    {
      "id": "183:75302",
      "marker": "SWITCH-V1-PAGE"
    }
  ],
  "forbiddenIdentities": [
    {
      "marker": "INPUT-IDENTITY-REUSE",
      "namespace": "ds.contracts.input.recipe.v5",
      "runIdentity": "4a074b24-e8503dd5-input-v5"
    },
    {
      "marker": "COMBOBOX-IDENTITY-REUSE",
      "namespace": "ds.contracts.combobox.recipe.v1",
      "runIdentity": "70c24cbd-d27f2e85-combobox-v1"
    },
    {
      "marker": "TABLE-IDENTITY-REUSE",
      "namespace": "ds.contracts.table.recipe.v1"
    },
    {
      "marker": "CALENDAR-IDENTITY-REUSE",
      "namespace": "ds.contracts.calendar.recipe.v1"
    },
    {
      "marker": "CHECKBOX-IDENTITY-REUSE",
      "namespace": "ds.contracts.checkbox.recipe.v1"
    },
    {
      "marker": "RADIO-IDENTITY-REUSE",
      "namespace": "ds.contracts.radio.recipe.v1"
    }
  ]
} as const;

const writerRuntime = (
  namespace: string,
  version: number,
  target: "scratch" | "plugin" = "scratch",
): string =>
  figmaWriterRuntime({
    archetype: "switch",
    prefix: "SWITCH",
    namespace,
    writerVersion: version,
    target,
    collectionLabel: WRITER_RUNTIME_SPEC.collectionLabel,
    mint: { kind: WRITER_RUNTIME_SPEC.mint.kind, field: WRITER_RUNTIME_SPEC.mint.field },
    forbiddenPages: [...WRITER_RUNTIME_SPEC.forbiddenPages],
    forbiddenIdentities: [...WRITER_RUNTIME_SPEC.forbiddenIdentities],
  });

export function emitSwitchFigmaWriter(
  inputs: readonly SwitchFigmaWriterInput[],
  options?: { runIdentity?: string; target?: "scratch" | "plugin" },
): SwitchFigmaWriter {
  const sourcePlans = inputs.map(planSource);
  const failures = validateSwitchFigmaSourcePlans(sourcePlans);
  if (failures.length > 0) throw new TypeError(failures.join("; "));

  const runIdentity =
    options?.runIdentity ??
    sourcePlans.map((source) => source.recipeHash.slice(0, 8)).join("-") +
      `-${SWITCH_FIGMA_RUN_SUFFIX}`;
  const namespace: string = SWITCH_FIGMA_NAMESPACE;
  const identity: string = runIdentity;
  if (
    namespace === FORBIDDEN_INPUT_NAMESPACE ||
    namespace === FORBIDDEN_COMBOBOX_NAMESPACE ||
    namespace === FORBIDDEN_TABLE_NAMESPACE ||
    namespace === FORBIDDEN_CHECKBOX_NAMESPACE ||
    namespace === FORBIDDEN_RADIO_NAMESPACE ||
    identity === FORBIDDEN_INPUT_RUN_IDENTITY
  )
    throw new TypeError(
      "switch writer must not reuse Input, Combobox, Table, Checkbox, or Radio identity",
    );

  const pageName = `Recipe Pivot / Switch / ${runIdentity}`;
  const plan = {
    pageName,
    runIdentity,
    sources: sourcePlans.map((source) => ({
      adapterIdentity: source.adapterIdentity,
      displayName: source.displayName,
      sourceName: source.sourceName,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelopeHash,
      variables: source.variables,
      comparedIrFacts: source.comparedIrFacts,
      switchSet: source.switchSet,
    })),
  };

  const target = options?.target ?? "scratch";
  const runtime = writerRuntime(
    SWITCH_FIGMA_NAMESPACE,
    SWITCH_FIGMA_WRITER_VERSION,
    target,
  );

  if (target === "scratch") {

  if (
    runtime.includes("SWITCH-WRITER-SET-NAME-CARRIES-COMPILE-LABEL") === false
  )
    throw new TypeError(
      "switch writer must carry the compile label into the set name (Table live v25 class)",
    );
  if (
    runtime.includes(
      'set.name=setIr.role+" :: "+(setIr.label||source.sourceName)',
    ) === false
  )
    throw new TypeError(
      "switch writer set name must prefer the compile label",
    );
  if (
    runtime.includes(
      "SWITCH-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE",
    ) === false
  )
    throw new TypeError(
      "switch writer must keep hug-text intrinsic size before a 0-width parent can collapse it",
    );
  if (runtime.includes("SWITCH-FONT-PROVENANCE-TAMPER") === false)
    throw new TypeError(
      "switch writer must refuse font provenance tampering",
    );
  if (
    runtime.includes("SWITCH-MUST-NOT-WRITE-INPUT-PAGE") === false ||
    runtime.includes("SWITCH-MUST-NOT-WRITE-COMBOBOX-PAGE") === false ||
    runtime.includes("SWITCH-MUST-NOT-WRITE-COMBOBOX-V42-PAGE") === false ||
    runtime.includes("SWITCH-MUST-NOT-WRITE-BUTTON-PAGE") === false ||
    runtime.includes("SWITCH-MUST-NOT-WRITE-TABLE-PAGE") === false ||
    runtime.includes("SWITCH-MUST-NOT-WRITE-CALENDAR-PAGE") === false ||
    runtime.includes("SWITCH-MUST-NOT-WRITE-CHECKBOX-PAGE") === false ||
    runtime.includes("SWITCH-MUST-NOT-WRITE-RADIO-PAGE") === false ||
    runtime.includes("SWITCH-MUST-NOT-WRITE-SWITCH-V1-PAGE") === false
  )
    throw new TypeError(
      "switch writer must refuse signed Input, Combobox, Button, Table, Calendar, Checkbox, and Radio pages",
    );

  }

  const code = `const PLAN=${JSON.stringify(plan)};\n${runtime}`;
  return {
    pageName,
    runIdentity,
    target,
    namespace: SWITCH_FIGMA_NAMESPACE,
    sourcePlans,
    code,
  };
}
