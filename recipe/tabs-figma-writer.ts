/**
 * tabs@1 Figma writer.
 *
 * Inherits the hardened calendar/table writer shape: exact file identity,
 * signed-page refuse, owned variable collections, font provenance + named
 * fallback walk (no Inter), set name carries the compile label, hug text
 * records intrinsic size before a 0-width parent can collapse it, layout
 * then children then sizing.
 *
 * Tabs is a two-item rail with a selected-child indicator. One named default cell per source.
 * Astryx compiles TabList. Overlay ink-bar offsets are receipted.
 *
 * No live write happens here. Executing the program requires a separate
 * PREPARE / AUTHORIZE / attempt lineage.
 */
import type { ComponentNode, IRNode, VariableBinding } from "./figma-ir.js";
import { figmaWriterRuntime } from "./figma-writer-runtime.js";
import type { RecipeEnvelope } from "./envelope.js";
import { canonicalJson } from "./normalize.js";
import { TABS_DEFAULT } from "./recipes/tabs.js";
import {
  buildFigmaVariableNameMap,
  sanitizeFigmaVariableName,
} from "./interpret.js";

export const TABS_FIGMA_NAMESPACE = "ds.contracts.tabs.recipe.v1";
export const TABS_FIGMA_WRITER_VERSION = 1;
export const TABS_FIGMA_RUN_SUFFIX = "tabs-v7";
/** v6 stay (shared-runtime proof) is preserved as evidence and never written again. */
export const FORBIDDEN_TABS_V6_PAGE_ID = "211:80360";
/** v5 (2026-09-01) stays as evidence: absolute indicator landed, label still top-aligned; never written again. */
export const FORBIDDEN_TABS_V5_PAGE_ID = "211:80294";
/** v4 (2026-09-01) stays as evidence of the flow-child indicator; never written again. */
export const FORBIDDEN_TABS_V4_PAGE_ID = "211:80209";
/** v3 (2026-09-01) stays as evidence of the clipping container; never written again. */
export const FORBIDDEN_TABS_V3_PAGE_ID = "210:80102";
/** v2 (2026-09-01) stays as evidence of the writer omission it exposed; never written again. */
export const FORBIDDEN_TABS_V2_PAGE_ID = "209:79990";
/** The v1 stay is preserved as evidence (superseded by the 2026-09-01 capture-content remint) and never written again. */
export const FORBIDDEN_TABS_V1_PAGE_ID = "183:76193";

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
export const FORBIDDEN_ALERT_NAMESPACE = "ds.contracts.alert.recipe.v1";
export const FORBIDDEN_ALERT_PAGE_ID = "183:75801";
export const FORBIDDEN_CHIP_NAMESPACE = "ds.contracts.chip.recipe.v1";
export const FORBIDDEN_CHIP_PAGE_ID = "183:75976";
export const FORBIDDEN_BADGE_NAMESPACE = "ds.contracts.badge.recipe.v1";
export const FORBIDDEN_BADGE_PAGE_ID = "183:76022";
export const FORBIDDEN_AVATAR_NAMESPACE = "ds.contracts.avatar.recipe.v1";
export const FORBIDDEN_AVATAR_PAGE_ID = "183:76063";
export const FORBIDDEN_LINK_NAMESPACE = "ds.contracts.link.recipe.v1";
export const FORBIDDEN_LINK_PAGE_ID = "183:76109";
export const FORBIDDEN_TOOLTIP_NAMESPACE = "ds.contracts.tooltip.recipe.v1";
export const FORBIDDEN_TOOLTIP_PAGE_ID = "183:76151";

export const TABS_FIGMA_VARIANTS_PER_SOURCE = TABS_DEFAULT.length;

export interface TabsVariablePlan {
  identity: string;
  name: string;
  type: "COLOR" | "FLOAT";
  value: string | number;
}

export interface TabsFigmaWriterInput {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelope: RecipeEnvelope;
}

export interface TabsFigmaSourcePlan {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelopeHash: string;
  sourceId: string;
  sourceName: string;
  chipAxes: Record<string, string[]>;
  chip: ComponentNode;
  variables: TabsVariablePlan[];
  comparedIrFacts: number;
}

export interface TabsFigmaWriter {
  pageName: string;
  runIdentity: string;
  namespace: string;
  sourcePlans: TabsFigmaSourcePlan[];
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
        `tabs live writer: ${binding.field} is not a colour fallback`,
      );
    return "COLOR";
  }
  if (binding.type === "FLOAT") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(
        `tabs live writer: ${binding.field} is not a numeric fallback`,
      );
    return "FLOAT";
  }
  throw new TypeError(
    `tabs live writer: unsupported binding type ${binding.type}`,
  );
};

const requireDefault = (root: IRNode): ComponentNode => {
  if (root.kind === "component" && root.role === "tabs/variant/default")
    return root;
  throw new TypeError(
    "tabs live writer: required one named default component, not a Color/Size/Closable set",
  );
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
  input: TabsFigmaWriterInput,
): TabsFigmaSourcePlan => {
  if (
    input.envelope.recipe.id !== "tabs" ||
    input.envelope.recipe.version !== 1
  )
    throw new TypeError("tabs live writer requires tabs@1");
  if (input.envelope.archetype !== "tabs")
    throw new TypeError("tabs live writer requires the tabs archetype");

  const chip = requireDefault(input.envelope.ir);
  const chipAxes = {
    Default: [...TABS_DEFAULT],
  };
  if (chip.variantProperties.Default !== "true")
    throw new TypeError("tabs live writer: default cell must be Default=true");

  const registry = new Map<string, TabsVariablePlan>();
  walk(chip, (node) => {
    if (node.kind === "instance")
      throw new TypeError(
        `tabs live writer: unexpected instance ${node.componentRef}`,
      );
    for (const binding of node.bindings ?? []) {
      const value = atPath(node, binding.field);
      const type = variableType(binding, value);
      const key = `${type}:${binding.variable}`;
      const previous = registry.get(key);
      if (previous && canonicalJson(previous.value) !== canonicalJson(value))
        throw new TypeError(
          `tabs live writer: conflicting fallback for ${binding.variable}`,
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
    throw new TypeError("tabs live writer: zero planned variables");

  return {
    adapterIdentity: input.adapterIdentity,
    displayName: input.displayName,
    recipeHash: input.recipeHash,
    envelopeHash: input.envelope.integrity.canonicalHash,
    sourceId: input.envelope.id,
    sourceName: input.envelope.name,
    chipAxes,
    chip,
    variables: [...registry.values()].sort((left, right) =>
      `${left.type}:${left.identity}`.localeCompare(
        `${right.type}:${right.identity}`,
        "en",
      ),
    ),
    comparedIrFacts: countComparedFacts(input.envelope.ir),
  };
};

export function validateTabsFigmaSourcePlans(
  plans: readonly TabsFigmaSourcePlan[],
): string[] {
  const failures: string[] = [];
  if (plans.length === 0) failures.push("tabs live writer: no sources");
  const identities = new Set(plans.map((plan) => plan.adapterIdentity));
  if (identities.size !== plans.length)
    failures.push("tabs live writer: duplicate adapter identity");
  for (const plan of plans) {
    if (plan.variables.length === 0)
      failures.push(`${plan.adapterIdentity}: variables denominator is zero`);
    if (plan.comparedIrFacts <= 0)
      failures.push(
        `${plan.adapterIdentity}: compared facts denominator is zero`,
      );
    if (plan.chip.kind !== "component" || plan.chip.role !== "tabs/variant/default")
      failures.push(
        `${plan.adapterIdentity}: expected one named default tabs component`,
      );
  }
  return failures;
}

const WRITER_RUNTIME_SPEC = {
  "collectionLabel": "Recipe Tabs",
  "mint": {
    "kind": "component",
    "field": "chip"
  },
  "forbiddenPages": [
    { "id": "211:80360", "marker": "TABS-V6-PAGE" },
    {
      "id": "115:295378",
      "marker": "INPUT-PAGE"
    },
    {
      "id": "211:80294",
      "marker": "TABS-V5-PAGE"
    },
    {
      "id": "211:80209",
      "marker": "TABS-V4-PAGE"
    },
    {
      "id": "210:80102",
      "marker": "TABS-V3-PAGE"
    },
    {
      "id": "209:79990",
      "marker": "TABS-V2-PAGE"
    },
    {
      "id": "183:76193",
      "marker": "TABS-V1-PAGE"
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
    },
    {
      "id": "183:75801",
      "marker": "ALERT-PAGE"
    },
    {
      "id": "183:75976",
      "marker": "CHIP-PAGE"
    },
    {
      "id": "183:76022",
      "marker": "BADGE-PAGE"
    },
    {
      "id": "183:76063",
      "marker": "AVATAR-PAGE"
    },
    {
      "id": "183:76109",
      "marker": "LINK-PAGE"
    },
    {
      "id": "183:76151",
      "marker": "TOOLTIP-PAGE"
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
    },
    {
      "marker": "ALERT-IDENTITY-REUSE",
      "namespace": "ds.contracts.alert.recipe.v1"
    },
    {
      "marker": "CHIP-IDENTITY-REUSE",
      "namespace": "ds.contracts.chip.recipe.v1"
    },
    {
      "marker": "BADGE-IDENTITY-REUSE",
      "namespace": "ds.contracts.badge.recipe.v1"
    },
    {
      "marker": "AVATAR-IDENTITY-REUSE",
      "namespace": "ds.contracts.avatar.recipe.v1"
    },
    {
      "marker": "LINK-IDENTITY-REUSE",
      "namespace": "ds.contracts.link.recipe.v1"
    },
    {
      "marker": "TOOLTIP-IDENTITY-REUSE",
      "namespace": "ds.contracts.tooltip.recipe.v1"
    }
  ]
} as const;

const writerRuntime = (namespace: string, version: number): string =>
  figmaWriterRuntime({
    archetype: "tabs",
    prefix: "TABS",
    namespace,
    writerVersion: version,
    target: "scratch",
    collectionLabel: WRITER_RUNTIME_SPEC.collectionLabel,
    mint: { kind: WRITER_RUNTIME_SPEC.mint.kind, field: WRITER_RUNTIME_SPEC.mint.field },
    forbiddenPages: [...WRITER_RUNTIME_SPEC.forbiddenPages],
    forbiddenIdentities: [...WRITER_RUNTIME_SPEC.forbiddenIdentities],
  });

export function emitTabsFigmaWriter(
  inputs: readonly TabsFigmaWriterInput[],
  options?: { runIdentity?: string },
): TabsFigmaWriter {
  const sourcePlans = inputs.map(planSource);
  const failures = validateTabsFigmaSourcePlans(sourcePlans);
  if (failures.length > 0) throw new TypeError(failures.join("; "));

  const runIdentity =
    options?.runIdentity ??
    sourcePlans.map((source) => source.recipeHash.slice(0, 8)).join("-") +
      `-${TABS_FIGMA_RUN_SUFFIX}`;
  const namespace: string = TABS_FIGMA_NAMESPACE;
  const identity: string = runIdentity;
  if (
    namespace === FORBIDDEN_INPUT_NAMESPACE ||
    namespace === FORBIDDEN_COMBOBOX_NAMESPACE ||
    namespace === FORBIDDEN_TABLE_NAMESPACE ||
    namespace === FORBIDDEN_CHECKBOX_NAMESPACE ||
    namespace === FORBIDDEN_RADIO_NAMESPACE ||
    namespace === FORBIDDEN_SWITCH_NAMESPACE ||
    namespace === FORBIDDEN_TEXTAREA_NAMESPACE ||
    namespace === FORBIDDEN_ALERT_NAMESPACE ||
    namespace === FORBIDDEN_CHIP_NAMESPACE ||
    namespace === FORBIDDEN_BADGE_NAMESPACE ||
    namespace === FORBIDDEN_AVATAR_NAMESPACE ||
    namespace === FORBIDDEN_LINK_NAMESPACE ||
    namespace === FORBIDDEN_TOOLTIP_NAMESPACE ||
    identity === FORBIDDEN_INPUT_RUN_IDENTITY
  )
    throw new TypeError(
      "tabs writer must not reuse Input, Combobox, Table, Checkbox, Radio, Switch, Textarea, Alert, Chip, Badge, Avatar, Link, or Tooltip identity",
    );

  const pageName = `Recipe Pivot / Tabs / ${runIdentity}`;
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
      chip: source.chip,
    })),
  };

  const runtime = writerRuntime(
    TABS_FIGMA_NAMESPACE,
    TABS_FIGMA_WRITER_VERSION,
  );

  if (
    runtime.includes("TABS-WRITER-COMPONENT-NAME-CARRIES-COMPILE-LABEL") ===
    false
  )
    throw new TypeError(
      "tabs writer must carry the compile label into the component name",
    );
  if (
    runtime.includes(
      'component.name=ir.role+" :: "+(ir.label||source.sourceName)',
    ) === false
  )
    throw new TypeError(
      "tabs writer component name must prefer the compile label",
    );
  if (
    runtime.includes(
      "TABS-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE",
    ) === false
  )
    throw new TypeError(
      "tabs writer must keep hug-text intrinsic size before a 0-width parent can collapse it",
    );
  if (runtime.includes("TABS-FONT-PROVENANCE-TAMPER") === false)
    throw new TypeError(
      "tabs writer must refuse font provenance tampering",
    );
  if (
    runtime.includes("TABS-MUST-NOT-WRITE-INPUT-PAGE") === false ||
    runtime.includes("TABS-MUST-NOT-WRITE-COMBOBOX-PAGE") === false ||
    runtime.includes("TABS-MUST-NOT-WRITE-COMBOBOX-V42-PAGE") === false ||
    runtime.includes("TABS-MUST-NOT-WRITE-BUTTON-PAGE") === false ||
    runtime.includes("TABS-MUST-NOT-WRITE-TABLE-PAGE") === false ||
    runtime.includes("TABS-MUST-NOT-WRITE-CALENDAR-PAGE") === false ||
    runtime.includes("TABS-MUST-NOT-WRITE-CHECKBOX-PAGE") === false ||
    runtime.includes("TABS-MUST-NOT-WRITE-RADIO-PAGE") === false ||
    runtime.includes("TABS-MUST-NOT-WRITE-SWITCH-PAGE") === false ||
    runtime.includes("TABS-MUST-NOT-WRITE-TEXTAREA-PAGE") === false ||
    runtime.includes("TABS-MUST-NOT-WRITE-ALERT-PAGE") === false ||
    runtime.includes("TABS-MUST-NOT-WRITE-TOOLTIP-PAGE") === false
  )
    throw new TypeError(
      "tabs writer must refuse signed Input, Combobox, Button, Table, Calendar, Checkbox, Radio, Switch, Textarea, and Alert pages",
    );

  const code = `const PLAN=${JSON.stringify(plan)};\n${runtime}`;
  return {
    pageName,
    runIdentity,
    namespace: TABS_FIGMA_NAMESPACE,
    sourcePlans,
    code,
  };
}
