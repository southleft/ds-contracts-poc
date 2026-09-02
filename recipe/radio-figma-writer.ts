/**
 * radio@1 Figma writer.
 *
 * Inherits the hardened calendar/table writer shape: exact file identity,
 * signed-page refuse, owned variable collections, font provenance + named
 * fallback walk (no Inter), set name carries the compile label, hug text
 * records intrinsic size before a 0-width parent can collapse it, layout
 * then children then sizing.
 *
 * Radio is list-shaped. One component set per source: Selected × Disabled
 * (4 variants). Astryx is RadioList + RadioListItem. The MUI SVG disc
 * and AntD ::after scale are receipted; the painted child is a circle.
 *
 * No live write happens here. Executing the program requires a separate
 * PREPARE / AUTHORIZE / attempt lineage.
 */
import type { ComponentSetNode, IRNode, VariableBinding } from "./figma-ir.js";
import { figmaWriterRuntime } from "./figma-writer-runtime.js";
import type { RecipeEnvelope } from "./envelope.js";
import { canonicalJson } from "./normalize.js";
import { RADIO_DISABLED, RADIO_SELECTED } from "./recipes/radio.js";
import {
  buildFigmaVariableNameMap,
  sanitizeFigmaVariableName,
} from "./interpret.js";

export const RADIO_FIGMA_NAMESPACE = "ds.contracts.radio.recipe.v1";
export const RADIO_FIGMA_WRITER_VERSION = 2;
export const RADIO_FIGMA_RUN_SUFFIX = "radio-v8";
/** v7 stay (runtime: font style names compared without case or spacing (SemiBold ≡ Semibold)) is preserved as evidence and never written again. */
export const FORBIDDEN_RADIO_V7_PAGE_ID = "218:87203";
/** v6 stay (runtime: a shadowed frame clips unless the IR says otherwise (measured against Chromium)) is preserved as evidence and never written again. */
export const FORBIDDEN_RADIO_V6_PAGE_ID = "218:85710";
/** v5 stay (runtime: a lowered shadow shows behind its node only when the node is opaque) is preserved as evidence and never written again. */
export const FORBIDDEN_RADIO_V5_PAGE_ID = "218:84228";
/** v4 stay (runtime: CSS shadows never show behind their node; frames clip only when the IR says so) is preserved as evidence and never written again. */
export const FORBIDDEN_RADIO_V4_PAGE_ID = "212:80619";
/** v3 stay (shared-runtime proof) is preserved as evidence and never written again. */
export const FORBIDDEN_RADIO_V3_PAGE_ID = "200:79301";
export const FORBIDDEN_RADIO_V1_PAGE_ID = "183:75031";

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

export const RADIO_FIGMA_VARIANTS_PER_SOURCE =
  RADIO_SELECTED.length * RADIO_DISABLED.length;

export interface RadioVariablePlan {
  identity: string;
  name: string;
  type: "COLOR" | "FLOAT";
  value: string | number;
}

export interface RadioFigmaWriterInput {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelope: RecipeEnvelope;
}

export interface RadioFigmaSourcePlan {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelopeHash: string;
  sourceId: string;
  sourceName: string;
  radioAxes: Record<string, string[]>;
  radioSet: ComponentSetNode;
  variables: RadioVariablePlan[];
  comparedIrFacts: number;
}

export interface RadioFigmaWriter {
  pageName: string;
  target: "scratch" | "plugin";
  runIdentity: string;
  namespace: string;
  sourcePlans: RadioFigmaSourcePlan[];
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
        `radio live writer: ${binding.field} is not a colour fallback`,
      );
    return "COLOR";
  }
  if (binding.type === "FLOAT") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(
        `radio live writer: ${binding.field} is not a numeric fallback`,
      );
    return "FLOAT";
  }
  throw new TypeError(
    `radio live writer: unsupported binding type ${binding.type}`,
  );
};

const requireSet = (root: IRNode, role: string): ComponentSetNode => {
  if (root.kind === "component-set" && root.role === role) return root;
  throw new TypeError(`radio live writer: required ${role} set`);
};

const axisValues = (set: ComponentSetNode, name: string): string[] => {
  const axis = set.variantAxes.find((candidate) => candidate.name === name);
  if (!axis) throw new TypeError(`radio live writer: missing ${name} axis`);
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
  input: RadioFigmaWriterInput,
): RadioFigmaSourcePlan => {
  if (
    input.envelope.recipe.id !== "radio" ||
    input.envelope.recipe.version !== 1
  )
    throw new TypeError("radio live writer requires radio@1");
  if (input.envelope.archetype !== "checkbox / radio")
    throw new TypeError("radio live writer requires the checkbox / radio archetype");

  const radioSet = requireSet(input.envelope.ir, "radio/set");
  const radioAxes = {
    Selected: axisValues(radioSet, "Selected"),
    Disabled: axisValues(radioSet, "Disabled"),
  };
  if (canonicalJson(radioAxes.Selected) !== canonicalJson([...RADIO_SELECTED]))
    throw new TypeError("radio live writer: incomplete Selected axis");
  if (
    canonicalJson(radioAxes.Disabled) !== canonicalJson([...RADIO_DISABLED])
  )
    throw new TypeError("radio live writer: incomplete Disabled axis");
  if (radioSet.children.length !== RADIO_FIGMA_VARIANTS_PER_SOURCE)
    throw new TypeError("radio live writer: incomplete variant matrix");

  const registry = new Map<string, RadioVariablePlan>();
  walk(radioSet, (node) => {
    if (node.kind === "instance")
      throw new TypeError(
        `radio live writer: unexpected instance ${node.componentRef}`,
      );
    for (const binding of node.bindings ?? []) {
      const value = atPath(node, binding.field);
      const type = variableType(binding, value);
      const key = `${type}:${binding.variable}`;
      const previous = registry.get(key);
      if (previous && canonicalJson(previous.value) !== canonicalJson(value))
        throw new TypeError(
          `radio live writer: conflicting fallback for ${binding.variable}`,
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
    throw new TypeError("radio live writer: zero planned variables");

  return {
    adapterIdentity: input.adapterIdentity,
    displayName: input.displayName,
    recipeHash: input.recipeHash,
    envelopeHash: input.envelope.integrity.canonicalHash,
    sourceId: input.envelope.id,
    sourceName: input.envelope.name,
    radioAxes,
    radioSet,
    variables: [...registry.values()].sort((left, right) =>
      `${left.type}:${left.identity}`.localeCompare(
        `${right.type}:${right.identity}`,
        "en",
      ),
    ),
    comparedIrFacts: countComparedFacts(input.envelope.ir),
  };
};

export function validateRadioFigmaSourcePlans(
  plans: readonly RadioFigmaSourcePlan[],
): string[] {
  const failures: string[] = [];
  if (plans.length === 0) failures.push("radio live writer: no sources");
  const identities = new Set(plans.map((plan) => plan.adapterIdentity));
  if (identities.size !== plans.length)
    failures.push("radio live writer: duplicate adapter identity");
  for (const plan of plans) {
    if (plan.variables.length === 0)
      failures.push(`${plan.adapterIdentity}: variables denominator is zero`);
    if (plan.comparedIrFacts <= 0)
      failures.push(
        `${plan.adapterIdentity}: compared facts denominator is zero`,
      );
    if (plan.radioSet.children.length !== RADIO_FIGMA_VARIANTS_PER_SOURCE)
      failures.push(
        `${plan.adapterIdentity}: expected ${RADIO_FIGMA_VARIANTS_PER_SOURCE} variants`,
      );
  }
  return failures;
}

const WRITER_RUNTIME_SPEC = {
  "collectionLabel": "Recipe Radio",
  "mint": {
    "kind": "set",
    "field": "radioSet"
  },
  "forbiddenPages": [
    { "id": "218:87203", "marker": "RADIO-V7-PAGE" },
    { "id": "218:85710", "marker": "RADIO-V6-PAGE" },
    { "id": "218:84228", "marker": "RADIO-V5-PAGE" },
    { "id": "212:80619", "marker": "RADIO-V4-PAGE" },
    { "id": "200:79301", "marker": "RADIO-V3-PAGE" },
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
      "marker": "RADIO-V1-PAGE"
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
    }
  ]
} as const;

const writerRuntime = (
  namespace: string,
  version: number,
  target: "scratch" | "plugin" = "scratch",
): string =>
  figmaWriterRuntime({
    archetype: "radio",
    prefix: "RADIO",
    namespace,
    writerVersion: version,
    target,
    collectionLabel: WRITER_RUNTIME_SPEC.collectionLabel,
    mint: { kind: WRITER_RUNTIME_SPEC.mint.kind, field: WRITER_RUNTIME_SPEC.mint.field },
    forbiddenPages: [...WRITER_RUNTIME_SPEC.forbiddenPages],
    forbiddenIdentities: [...WRITER_RUNTIME_SPEC.forbiddenIdentities],
  });

export function emitRadioFigmaWriter(
  inputs: readonly RadioFigmaWriterInput[],
  options?: { runIdentity?: string; target?: "scratch" | "plugin" },
): RadioFigmaWriter {
  const sourcePlans = inputs.map(planSource);
  const failures = validateRadioFigmaSourcePlans(sourcePlans);
  if (failures.length > 0) throw new TypeError(failures.join("; "));

  const runIdentity =
    options?.runIdentity ??
    sourcePlans.map((source) => source.recipeHash.slice(0, 8)).join("-") +
      `-${RADIO_FIGMA_RUN_SUFFIX}`;
  const namespace: string = RADIO_FIGMA_NAMESPACE;
  const identity: string = runIdentity;
  if (
    namespace === FORBIDDEN_INPUT_NAMESPACE ||
    namespace === FORBIDDEN_COMBOBOX_NAMESPACE ||
    namespace === FORBIDDEN_TABLE_NAMESPACE ||
    namespace === FORBIDDEN_CHECKBOX_NAMESPACE ||
    identity === FORBIDDEN_INPUT_RUN_IDENTITY
  )
    throw new TypeError(
      "radio writer must not reuse Input, Combobox, Table, or Checkbox identity",
    );

  const pageName = `Recipe Pivot / Radio / ${runIdentity}`;
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
      radioSet: source.radioSet,
    })),
  };

  const target = options?.target ?? "scratch";
  const runtime = writerRuntime(
    RADIO_FIGMA_NAMESPACE,
    RADIO_FIGMA_WRITER_VERSION,
    target,
  );

  if (target === "scratch") {

  if (
    runtime.includes("RADIO-WRITER-SET-NAME-CARRIES-COMPILE-LABEL") === false
  )
    throw new TypeError(
      "radio writer must carry the compile label into the set name (Table live v25 class)",
    );
  if (
    runtime.includes(
      'set.name=setIr.role+" :: "+(setIr.label||source.sourceName)',
    ) === false
  )
    throw new TypeError(
      "radio writer set name must prefer the compile label",
    );
  if (
    runtime.includes(
      "RADIO-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE",
    ) === false
  )
    throw new TypeError(
      "radio writer must keep hug-text intrinsic size before a 0-width parent can collapse it",
    );
  if (runtime.includes("RADIO-FONT-PROVENANCE-TAMPER") === false)
    throw new TypeError(
      "radio writer must refuse font provenance tampering",
    );
  if (
    runtime.includes("RADIO-MUST-NOT-WRITE-INPUT-PAGE") === false ||
    runtime.includes("RADIO-MUST-NOT-WRITE-COMBOBOX-PAGE") === false ||
    runtime.includes("RADIO-MUST-NOT-WRITE-COMBOBOX-V42-PAGE") === false ||
    runtime.includes("RADIO-MUST-NOT-WRITE-BUTTON-PAGE") === false ||
    runtime.includes("RADIO-MUST-NOT-WRITE-TABLE-PAGE") === false ||
    runtime.includes("RADIO-MUST-NOT-WRITE-CALENDAR-PAGE") === false ||
    runtime.includes("RADIO-MUST-NOT-WRITE-CHECKBOX-PAGE") === false ||
    runtime.includes("RADIO-MUST-NOT-WRITE-RADIO-V1-PAGE") === false
  )
    throw new TypeError(
      "radio writer must refuse signed Input, Combobox, Button, Table, Calendar, Checkbox, and old Radio pages",
    );

  }

  const code = `const PLAN=${JSON.stringify(plan)};\n${runtime}`;
  return {
    pageName,
    runIdentity,
    target,
    namespace: RADIO_FIGMA_NAMESPACE,
    sourcePlans,
    code,
  };
}
