/**
 * checkbox@1 Figma writer.
 *
 * Inherits the hardened calendar/table writer shape: exact file identity,
 * signed-page refuse, owned variable collections, font provenance + named
 * fallback walk (no Inter), set name carries the compile label, hug text
 * records intrinsic size before a 0-width parent can collapse it, layout
 * then children then sizing.
 *
 * Checkbox has no instances and no nested sets. One component set per
 * source: Checked × Disabled (6 variants). The check glyph is a VECTOR
 * from the named package path (Astryx stroke, MUI even-odd icon, AntD
 * pre-rotated L check). The dash is a real child for indeterminate.
 *
 * No live write happens here. Executing the program requires a separate
 * PREPARE / AUTHORIZE / attempt lineage.
 */
import type { ComponentSetNode, IRNode, VariableBinding } from "./figma-ir.js";
import { figmaWriterRuntime } from "./figma-writer-runtime.js";
import type { RecipeEnvelope } from "./envelope.js";
import { canonicalJson } from "./normalize.js";
import { CHECKBOX_CHECKED, CHECKBOX_DISABLED } from "./recipes/checkbox.js";
import {
  buildFigmaVariableNameMap,
  sanitizeFigmaVariableName,
} from "./interpret.js";

export const CHECKBOX_FIGMA_NAMESPACE = "ds.contracts.checkbox.recipe.v1";
export const CHECKBOX_FIGMA_WRITER_VERSION = 3;
export const CHECKBOX_FIGMA_RUN_SUFFIX = "checkbox-v7";
/** v6 stay (shadcn bare cell (label-less) as the fifth source, proposed from the capture) is preserved as evidence and never written again. */
export const FORBIDDEN_CHECKBOX_V6_PAGE_ID = "212:82228";
/** v5 stay (proposed Chakra fixture joins the set) is preserved as evidence and never written again. */
export const FORBIDDEN_CHECKBOX_V5_PAGE_ID = "212:81535";
/** v4 stay (shared-runtime proof) is preserved as evidence and never written again. */
export const FORBIDDEN_CHECKBOX_V4_PAGE_ID = "199:78556";
export const FORBIDDEN_CHECKBOX_V1_PAGE_ID = "183:74742";
export const FORBIDDEN_CHECKBOX_V2_PAGE_ID = "196:76370";

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

export const CHECKBOX_FIGMA_VARIANTS_PER_SOURCE =
  CHECKBOX_CHECKED.length * CHECKBOX_DISABLED.length;

export interface CheckboxVariablePlan {
  identity: string;
  name: string;
  type: "COLOR" | "FLOAT";
  value: string | number;
}

export interface CheckboxFigmaWriterInput {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelope: RecipeEnvelope;
}

export interface CheckboxFigmaSourcePlan {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelopeHash: string;
  sourceId: string;
  sourceName: string;
  checkboxAxes: Record<string, string[]>;
  checkboxSet: ComponentSetNode;
  variables: CheckboxVariablePlan[];
  comparedIrFacts: number;
}

export interface CheckboxFigmaWriter {
  pageName: string;
  target: "scratch" | "plugin";
  runIdentity: string;
  namespace: string;
  sourcePlans: CheckboxFigmaSourcePlan[];
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
        `checkbox live writer: ${binding.field} is not a colour fallback`,
      );
    return "COLOR";
  }
  if (binding.type === "FLOAT") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(
        `checkbox live writer: ${binding.field} is not a numeric fallback`,
      );
    return "FLOAT";
  }
  throw new TypeError(
    `checkbox live writer: unsupported binding type ${binding.type}`,
  );
};

const requireSet = (root: IRNode, role: string): ComponentSetNode => {
  if (root.kind === "component-set" && root.role === role) return root;
  throw new TypeError(`checkbox live writer: required ${role} set`);
};

const axisValues = (set: ComponentSetNode, name: string): string[] => {
  const axis = set.variantAxes.find((candidate) => candidate.name === name);
  if (!axis) throw new TypeError(`checkbox live writer: missing ${name} axis`);
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
  input: CheckboxFigmaWriterInput,
): CheckboxFigmaSourcePlan => {
  if (
    input.envelope.recipe.id !== "checkbox" ||
    input.envelope.recipe.version !== 1
  )
    throw new TypeError("checkbox live writer requires checkbox@1");
  if (input.envelope.archetype !== "checkbox / radio")
    throw new TypeError("checkbox live writer requires the checkbox archetype");

  const checkboxSet = requireSet(input.envelope.ir, "checkbox/set");
  const checkboxAxes = {
    Checked: axisValues(checkboxSet, "Checked"),
    Disabled: axisValues(checkboxSet, "Disabled"),
  };
  if (canonicalJson(checkboxAxes.Checked) !== canonicalJson([...CHECKBOX_CHECKED]))
    throw new TypeError("checkbox live writer: incomplete Checked axis");
  if (
    canonicalJson(checkboxAxes.Disabled) !== canonicalJson([...CHECKBOX_DISABLED])
  )
    throw new TypeError("checkbox live writer: incomplete Disabled axis");
  if (checkboxSet.children.length !== CHECKBOX_FIGMA_VARIANTS_PER_SOURCE)
    throw new TypeError("checkbox live writer: incomplete variant matrix");

  const registry = new Map<string, CheckboxVariablePlan>();
  walk(checkboxSet, (node) => {
    if (node.kind === "instance")
      throw new TypeError(
        `checkbox live writer: unexpected instance ${node.componentRef}`,
      );
    for (const binding of node.bindings ?? []) {
      const value = atPath(node, binding.field);
      const type = variableType(binding, value);
      const key = `${type}:${binding.variable}`;
      const previous = registry.get(key);
      if (previous && canonicalJson(previous.value) !== canonicalJson(value))
        throw new TypeError(
          `checkbox live writer: conflicting fallback for ${binding.variable}`,
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
    throw new TypeError("checkbox live writer: zero planned variables");

  return {
    adapterIdentity: input.adapterIdentity,
    displayName: input.displayName,
    recipeHash: input.recipeHash,
    envelopeHash: input.envelope.integrity.canonicalHash,
    sourceId: input.envelope.id,
    sourceName: input.envelope.name,
    checkboxAxes,
    checkboxSet,
    variables: [...registry.values()].sort((left, right) =>
      `${left.type}:${left.identity}`.localeCompare(
        `${right.type}:${right.identity}`,
        "en",
      ),
    ),
    comparedIrFacts: countComparedFacts(input.envelope.ir),
  };
};

export function validateCheckboxFigmaSourcePlans(
  plans: readonly CheckboxFigmaSourcePlan[],
): string[] {
  const failures: string[] = [];
  if (plans.length === 0) failures.push("checkbox live writer: no sources");
  const identities = new Set(plans.map((plan) => plan.adapterIdentity));
  if (identities.size !== plans.length)
    failures.push("checkbox live writer: duplicate adapter identity");
  for (const plan of plans) {
    if (plan.variables.length === 0)
      failures.push(`${plan.adapterIdentity}: variables denominator is zero`);
    if (plan.comparedIrFacts <= 0)
      failures.push(
        `${plan.adapterIdentity}: compared facts denominator is zero`,
      );
    if (plan.checkboxSet.children.length !== CHECKBOX_FIGMA_VARIANTS_PER_SOURCE)
      failures.push(
        `${plan.adapterIdentity}: expected ${CHECKBOX_FIGMA_VARIANTS_PER_SOURCE} variants`,
      );
  }
  return failures;
}

const WRITER_RUNTIME_SPEC = {
  "collectionLabel": "Recipe Checkbox",
  "mint": {
    "kind": "set",
    "field": "checkboxSet"
  },
  "forbiddenPages": [
    { "id": "212:82228", "marker": "CHECKBOX-V6-PAGE" },
    { "id": "212:81535", "marker": "CHECKBOX-V5-PAGE" },
    { "id": "199:78556", "marker": "CHECKBOX-V4-PAGE" },
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
      "marker": "CHECKBOX-V1-PAGE"
    },
    {
      "id": "196:76370",
      "marker": "CHECKBOX-V2-PAGE"
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
    }
  ]
} as const;

const writerRuntime = (
  namespace: string,
  version: number,
  target: "scratch" | "plugin" = "scratch",
): string =>
  figmaWriterRuntime({
    archetype: "checkbox",
    prefix: "CHECKBOX",
    namespace,
    writerVersion: version,
    target,
    collectionLabel: WRITER_RUNTIME_SPEC.collectionLabel,
    mint: { kind: WRITER_RUNTIME_SPEC.mint.kind, field: WRITER_RUNTIME_SPEC.mint.field },
    forbiddenPages: [...WRITER_RUNTIME_SPEC.forbiddenPages],
    forbiddenIdentities: [...WRITER_RUNTIME_SPEC.forbiddenIdentities],
  });

export function emitCheckboxFigmaWriter(
  inputs: readonly CheckboxFigmaWriterInput[],
  options?: { runIdentity?: string; target?: "scratch" | "plugin" },
): CheckboxFigmaWriter {
  const sourcePlans = inputs.map(planSource);
  const failures = validateCheckboxFigmaSourcePlans(sourcePlans);
  if (failures.length > 0) throw new TypeError(failures.join("; "));

  const runIdentity =
    options?.runIdentity ??
    sourcePlans.map((source) => source.recipeHash.slice(0, 8)).join("-") +
      `-${CHECKBOX_FIGMA_RUN_SUFFIX}`;
  const namespace: string = CHECKBOX_FIGMA_NAMESPACE;
  const identity: string = runIdentity;
  if (
    namespace === FORBIDDEN_INPUT_NAMESPACE ||
    namespace === FORBIDDEN_COMBOBOX_NAMESPACE ||
    namespace === FORBIDDEN_TABLE_NAMESPACE ||
    identity === FORBIDDEN_INPUT_RUN_IDENTITY
  )
    throw new TypeError(
      "checkbox writer must not reuse Input, Combobox, or Table identity",
    );

  const pageName = `Recipe Pivot / Checkbox / ${runIdentity}`;
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
      checkboxSet: source.checkboxSet,
    })),
  };

  const target = options?.target ?? "scratch";
  const runtime = writerRuntime(
    CHECKBOX_FIGMA_NAMESPACE,
    CHECKBOX_FIGMA_WRITER_VERSION,
    target,
  );

  if (target === "scratch") {

  if (
    runtime.includes("CHECKBOX-WRITER-SET-NAME-CARRIES-COMPILE-LABEL") === false
  )
    throw new TypeError(
      "checkbox writer must carry the compile label into the set name (Table live v25 class)",
    );
  if (
    runtime.includes(
      'set.name=setIr.role+" :: "+(setIr.label||source.sourceName)',
    ) === false
  )
    throw new TypeError(
      "checkbox writer set name must prefer the compile label",
    );
  if (
    runtime.includes(
      "CHECKBOX-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE",
    ) === false
  )
    throw new TypeError(
      "checkbox writer must keep hug-text intrinsic size before a 0-width parent can collapse it",
    );
  if (runtime.includes("CHECKBOX-FONT-PROVENANCE-TAMPER") === false)
    throw new TypeError(
      "checkbox writer must refuse font provenance tampering",
    );
    if (
    runtime.includes("CHECKBOX-MUST-NOT-WRITE-INPUT-PAGE") === false ||
    runtime.includes("CHECKBOX-MUST-NOT-WRITE-COMBOBOX-PAGE") === false ||
    runtime.includes("CHECKBOX-MUST-NOT-WRITE-COMBOBOX-V42-PAGE") === false ||
    runtime.includes("CHECKBOX-MUST-NOT-WRITE-BUTTON-PAGE") === false ||
    runtime.includes("CHECKBOX-MUST-NOT-WRITE-TABLE-PAGE") === false ||
    runtime.includes("CHECKBOX-MUST-NOT-WRITE-CALENDAR-PAGE") === false ||
    runtime.includes("CHECKBOX-MUST-NOT-WRITE-CHECKBOX-V1-PAGE") === false ||
    runtime.includes("CHECKBOX-MUST-NOT-WRITE-CHECKBOX-V2-PAGE") === false
  )
    throw new TypeError(
      "checkbox writer must refuse signed Input, Combobox, Button, Table, Calendar, and old Checkbox pages",
    );
  if (runtime.includes("CHECKBOX-WRITER-VECTOR-PATH") === false)
    throw new TypeError(
      "checkbox writer must emit createVector for named package glyphs",
    );

  }

  const code = `const PLAN=${JSON.stringify(plan)};\n${runtime}`;
  return {
    pageName,
    runIdentity,
    target,
    namespace: CHECKBOX_FIGMA_NAMESPACE,
    sourcePlans,
    code,
  };
}
