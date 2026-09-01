/**
 * alert@1 Figma writer.
 *
 * Inherits the hardened calendar/table writer shape: exact file identity,
 * signed-page refuse, owned variable collections, font provenance + named
 * fallback walk (no Inter), set name carries the compile label, hug text
 * records intrinsic size before a 0-width parent can collapse it, layout
 * then children then sizing.
 *
 * Alert is an in-page banner. One component set per source: Status
 * (4 variants). Do not invent a shared Status default. AlertDialog waits.
 *
 * No live write happens here. Executing the program requires a separate
 * PREPARE / AUTHORIZE / attempt lineage.
 */
import type { ComponentSetNode, IRNode, VariableBinding } from "./figma-ir.js";
import { figmaWriterRuntime } from "./figma-writer-runtime.js";
import type { RecipeEnvelope } from "./envelope.js";
import { canonicalJson } from "./normalize.js";
import { ALERT_STATUS } from "./recipes/alert.js";
import {
  buildFigmaVariableNameMap,
  sanitizeFigmaVariableName,
} from "./interpret.js";

export const ALERT_FIGMA_NAMESPACE = "ds.contracts.alert.recipe.v1";
export const ALERT_FIGMA_WRITER_VERSION = 1;
export const ALERT_FIGMA_RUN_SUFFIX = "alert-v4";
/** v3 stay (shared-runtime proof) is preserved as evidence and never written again. */
export const FORBIDDEN_ALERT_V3_PAGE_ID = "209:79728";
/** The v2 stay (glyphs carried, ring lost to an open subpath, AntD 38 tall) is preserved as evidence and never written again. */
export const FORBIDDEN_ALERT_V2_PAGE_ID = "208:79595";
/** The v1 stay (filled-disc icons, measured 2026-09-01) is preserved as evidence and never written again. */
export const FORBIDDEN_ALERT_V1_PAGE_ID = "183:75801";

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
export const FORBIDDEN_SWITCH_NAMESPACE = "ds.contracts.switch.recipe.v1";
export const FORBIDDEN_SWITCH_PAGE_ID = "183:75302";
export const FORBIDDEN_TEXTAREA_NAMESPACE = "ds.contracts.textarea.recipe.v1";
export const FORBIDDEN_TEXTAREA_PAGE_ID = "183:75495";

export const ALERT_FIGMA_VARIANTS_PER_SOURCE = ALERT_STATUS.length;

export interface AlertVariablePlan {
  identity: string;
  name: string;
  type: "COLOR" | "FLOAT";
  value: string | number;
}

export interface AlertFigmaWriterInput {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelope: RecipeEnvelope;
}

export interface AlertFigmaSourcePlan {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelopeHash: string;
  sourceId: string;
  sourceName: string;
  alertAxes: Record<string, string[]>;
  alertSet: ComponentSetNode;
  variables: AlertVariablePlan[];
  comparedIrFacts: number;
}

export interface AlertFigmaWriter {
  pageName: string;
  runIdentity: string;
  namespace: string;
  sourcePlans: AlertFigmaSourcePlan[];
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
        `alert live writer: ${binding.field} is not a colour fallback`,
      );
    return "COLOR";
  }
  if (binding.type === "FLOAT") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(
        `alert live writer: ${binding.field} is not a numeric fallback`,
      );
    return "FLOAT";
  }
  throw new TypeError(
    `alert live writer: unsupported binding type ${binding.type}`,
  );
};

const requireSet = (root: IRNode, role: string): ComponentSetNode => {
  if (root.kind === "component-set" && root.role === role) return root;
  throw new TypeError(`alert live writer: required ${role} set`);
};

const axisValues = (set: ComponentSetNode, name: string): string[] => {
  const axis = set.variantAxes.find((candidate) => candidate.name === name);
  if (!axis) throw new TypeError(`alert live writer: missing ${name} axis`);
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
  input: AlertFigmaWriterInput,
): AlertFigmaSourcePlan => {
  if (
    input.envelope.recipe.id !== "alert" ||
    input.envelope.recipe.version !== 1
  )
    throw new TypeError("alert live writer requires alert@1");
  if (input.envelope.archetype !== "banner / alert / toast")
    throw new TypeError("alert live writer requires the banner / alert / toast archetype");

  const alertSet = requireSet(input.envelope.ir, "alert/set");
  const alertAxes = {
    Status: axisValues(alertSet, "Status"),
  };
  if (canonicalJson(alertAxes.Status) !== canonicalJson([...ALERT_STATUS]))
    throw new TypeError("alert live writer: incomplete Status axis");
  if (alertSet.children.length !== ALERT_FIGMA_VARIANTS_PER_SOURCE)
    throw new TypeError("alert live writer: incomplete variant matrix");

  const registry = new Map<string, AlertVariablePlan>();
  walk(alertSet, (node) => {
    if (node.kind === "instance")
      throw new TypeError(
        `alert live writer: unexpected instance ${node.componentRef}`,
      );
    for (const binding of node.bindings ?? []) {
      const value = atPath(node, binding.field);
      const type = variableType(binding, value);
      const key = `${type}:${binding.variable}`;
      const previous = registry.get(key);
      if (previous && canonicalJson(previous.value) !== canonicalJson(value))
        throw new TypeError(
          `alert live writer: conflicting fallback for ${binding.variable}`,
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
    throw new TypeError("alert live writer: zero planned variables");

  return {
    adapterIdentity: input.adapterIdentity,
    displayName: input.displayName,
    recipeHash: input.recipeHash,
    envelopeHash: input.envelope.integrity.canonicalHash,
    sourceId: input.envelope.id,
    sourceName: input.envelope.name,
    alertAxes,
    alertSet,
    variables: [...registry.values()].sort((left, right) =>
      `${left.type}:${left.identity}`.localeCompare(
        `${right.type}:${right.identity}`,
        "en",
      ),
    ),
    comparedIrFacts: countComparedFacts(input.envelope.ir),
  };
};

export function validateAlertFigmaSourcePlans(
  plans: readonly AlertFigmaSourcePlan[],
): string[] {
  const failures: string[] = [];
  if (plans.length === 0) failures.push("alert live writer: no sources");
  const identities = new Set(plans.map((plan) => plan.adapterIdentity));
  if (identities.size !== plans.length)
    failures.push("alert live writer: duplicate adapter identity");
  for (const plan of plans) {
    if (plan.variables.length === 0)
      failures.push(`${plan.adapterIdentity}: variables denominator is zero`);
    if (plan.comparedIrFacts <= 0)
      failures.push(
        `${plan.adapterIdentity}: compared facts denominator is zero`,
      );
    if (plan.alertSet.children.length !== ALERT_FIGMA_VARIANTS_PER_SOURCE)
      failures.push(
        `${plan.adapterIdentity}: expected ${ALERT_FIGMA_VARIANTS_PER_SOURCE} variants`,
      );
  }
  return failures;
}

const WRITER_RUNTIME_SPEC = {
  "collectionLabel": "Recipe Alert",
  "mint": {
    "kind": "set",
    "field": "alertSet"
  },
  "forbiddenPages": [
    { "id": "209:79728", "marker": "ALERT-V3-PAGE" },
    {
      "id": "115:295378",
      "marker": "INPUT-PAGE"
    },
    {
      "id": "183:75801",
      "marker": "ALERT-V1-PAGE"
    },
    {
      "id": "208:79595",
      "marker": "ALERT-V2-PAGE"
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
      "marker": "SWITCH-PAGE"
    },
    {
      "id": "183:75495",
      "marker": "TEXTAREA-PAGE"
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
    },
    {
      "marker": "SWITCH-IDENTITY-REUSE",
      "namespace": "ds.contracts.switch.recipe.v1"
    },
    {
      "marker": "TEXTAREA-IDENTITY-REUSE",
      "namespace": "ds.contracts.textarea.recipe.v1"
    }
  ]
} as const;

const writerRuntime = (namespace: string, version: number): string =>
  figmaWriterRuntime({
    archetype: "alert",
    prefix: "ALERT",
    namespace,
    writerVersion: version,
    target: "scratch",
    collectionLabel: WRITER_RUNTIME_SPEC.collectionLabel,
    mint: { kind: WRITER_RUNTIME_SPEC.mint.kind, field: WRITER_RUNTIME_SPEC.mint.field },
    forbiddenPages: [...WRITER_RUNTIME_SPEC.forbiddenPages],
    forbiddenIdentities: [...WRITER_RUNTIME_SPEC.forbiddenIdentities],
  });

export function emitAlertFigmaWriter(
  inputs: readonly AlertFigmaWriterInput[],
  options?: { runIdentity?: string },
): AlertFigmaWriter {
  const sourcePlans = inputs.map(planSource);
  const failures = validateAlertFigmaSourcePlans(sourcePlans);
  if (failures.length > 0) throw new TypeError(failures.join("; "));

  const runIdentity =
    options?.runIdentity ??
    sourcePlans.map((source) => source.recipeHash.slice(0, 8)).join("-") +
      `-${ALERT_FIGMA_RUN_SUFFIX}`;
  const namespace: string = ALERT_FIGMA_NAMESPACE;
  const identity: string = runIdentity;
  if (
    namespace === FORBIDDEN_INPUT_NAMESPACE ||
    namespace === FORBIDDEN_COMBOBOX_NAMESPACE ||
    namespace === FORBIDDEN_TABLE_NAMESPACE ||
    namespace === FORBIDDEN_CHECKBOX_NAMESPACE ||
    namespace === FORBIDDEN_RADIO_NAMESPACE ||
    namespace === FORBIDDEN_SWITCH_NAMESPACE ||
    namespace === FORBIDDEN_TEXTAREA_NAMESPACE ||
    identity === FORBIDDEN_INPUT_RUN_IDENTITY
  )
    throw new TypeError(
      "alert writer must not reuse Input, Combobox, Table, Checkbox, Radio, Switch, or Textarea identity",
    );

  const pageName = `Recipe Pivot / Alert / ${runIdentity}`;
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
      alertSet: source.alertSet,
    })),
  };

  const runtime = writerRuntime(
    ALERT_FIGMA_NAMESPACE,
    ALERT_FIGMA_WRITER_VERSION,
  );

  if (
    runtime.includes("ALERT-WRITER-SET-NAME-CARRIES-COMPILE-LABEL") === false
  )
    throw new TypeError(
      "alert writer must carry the compile label into the set name (Table live v25 class)",
    );
  if (
    runtime.includes(
      'set.name=setIr.role+" :: "+(setIr.label||source.sourceName)',
    ) === false
  )
    throw new TypeError(
      "alert writer set name must prefer the compile label",
    );
  if (
    runtime.includes(
      "ALERT-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE",
    ) === false
  )
    throw new TypeError(
      "alert writer must keep hug-text intrinsic size before a 0-width parent can collapse it",
    );
  if (runtime.includes("ALERT-FONT-PROVENANCE-TAMPER") === false)
    throw new TypeError(
      "alert writer must refuse font provenance tampering",
    );
  if (
    runtime.includes("ALERT-MUST-NOT-WRITE-INPUT-PAGE") === false ||
    runtime.includes("ALERT-MUST-NOT-WRITE-COMBOBOX-PAGE") === false ||
    runtime.includes("ALERT-MUST-NOT-WRITE-COMBOBOX-V42-PAGE") === false ||
    runtime.includes("ALERT-MUST-NOT-WRITE-BUTTON-PAGE") === false ||
    runtime.includes("ALERT-MUST-NOT-WRITE-TABLE-PAGE") === false ||
    runtime.includes("ALERT-MUST-NOT-WRITE-CALENDAR-PAGE") === false ||
    runtime.includes("ALERT-MUST-NOT-WRITE-CHECKBOX-PAGE") === false ||
    runtime.includes("ALERT-MUST-NOT-WRITE-RADIO-PAGE") === false ||
    runtime.includes("ALERT-MUST-NOT-WRITE-SWITCH-PAGE") === false ||
    runtime.includes("ALERT-MUST-NOT-WRITE-TEXTAREA-PAGE") === false
  )
    throw new TypeError(
      "alert writer must refuse signed Input, Combobox, Button, Table, Calendar, Checkbox, Radio, Switch, and Textarea pages",
    );

  const code = `const PLAN=${JSON.stringify(plan)};\n${runtime}`;
  return {
    pageName,
    runIdentity,
    namespace: ALERT_FIGMA_NAMESPACE,
    sourcePlans,
    code,
  };
}
