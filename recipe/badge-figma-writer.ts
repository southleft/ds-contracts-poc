/**
 * badge@1 Figma writer.
 *
 * Inherits the hardened calendar/table writer shape: exact file identity,
 * signed-page refuse, owned variable collections, font provenance + named
 * fallback walk (no Inter), set name carries the compile label, hug text
 * records intrinsic size before a 0-width parent can collapse it, layout
 * then children then sizing.
 *
 * Badge is an anchored overlay. MUI+AntD only. Astryx overlay is a named
 * refusal. Color, dot, status, and Ribbon are not axes. Do not invent
 * an Astryx pip.
 *
 * No live write happens here. Executing the program requires a separate
 * PREPARE / AUTHORIZE / attempt lineage.
 */
import type { ComponentNode, IRNode, VariableBinding } from "./figma-ir.js";
import { figmaWriterRuntime } from "./figma-writer-runtime.js";
import type { RecipeEnvelope } from "./envelope.js";
import { canonicalJson } from "./normalize.js";
import { BADGE_DEFAULT } from "./recipes/badge.js";
import {
  buildFigmaVariableNameMap,
  sanitizeFigmaVariableName,
} from "./interpret.js";

export const BADGE_FIGMA_NAMESPACE = "ds.contracts.badge.recipe.v1";
export const BADGE_FIGMA_WRITER_VERSION = 2;
export const BADGE_FIGMA_RUN_SUFFIX = "badge-v11";
/** v10 stay (badge@1 proposer: MUI (its default cell) and AntD from their own captures) is preserved as evidence and never written again. */
export const FORBIDDEN_BADGE_V10_PAGE_ID = "218:90239";
/** v9 stay (runtime: font style names compared without case or spacing (SemiBold ≡ Semibold)) is preserved as evidence and never written again. */
export const FORBIDDEN_BADGE_V9_PAGE_ID = "218:87649";
/** v8 stay (runtime: a shadowed frame clips unless the IR says otherwise (measured against Chromium)) is preserved as evidence and never written again. */
export const FORBIDDEN_BADGE_V8_PAGE_ID = "218:86156";
/** v7 stay (runtime: a lowered shadow shows behind its node only when the node is opaque) is preserved as evidence and never written again. */
export const FORBIDDEN_BADGE_V7_PAGE_ID = "218:84674";
/** v6 stay (runtime: CSS shadows never show behind their node; frames clip only when the IR says so) is preserved as evidence and never written again. */
export const FORBIDDEN_BADGE_V6_PAGE_ID = "212:81065";
/** v5 stay (shared-runtime proof) is preserved as evidence and never written again. */
export const FORBIDDEN_BADGE_V5_PAGE_ID = "211:80168";
/** v4 (2026-09-01) stays as evidence of the clipping container; never written again. */
export const FORBIDDEN_BADGE_V4_PAGE_ID = "210:80061";
/** v3 (2026-09-01) stays as evidence of the writer omission it exposed; never written again. */
export const FORBIDDEN_BADGE_V3_PAGE_ID = "209:79949";
/** The v2 stay is preserved as evidence (superseded by the 2026-09-01 capture-content remint) and never written again. */
export const FORBIDDEN_BADGE_V2_PAGE_ID = "198:77177";
export const FORBIDDEN_BADGE_V1_PAGE_ID = "183:76022";

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

export const BADGE_FIGMA_VARIANTS_PER_SOURCE = BADGE_DEFAULT.length;

export interface ChipVariablePlan {
  identity: string;
  name: string;
  type: "COLOR" | "FLOAT";
  value: string | number;
}

export interface BadgeFigmaWriterInput {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelope: RecipeEnvelope;
}

export interface BadgeFigmaSourcePlan {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelopeHash: string;
  sourceId: string;
  sourceName: string;
  badgeAxes: Record<string, string[]>;
  badge: ComponentNode;
  variables: ChipVariablePlan[];
  comparedIrFacts: number;
}

export interface BadgeFigmaWriter {
  pageName: string;
  target: "scratch" | "plugin";
  runIdentity: string;
  namespace: string;
  sourcePlans: BadgeFigmaSourcePlan[];
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
        `badge live writer: ${binding.field} is not a colour fallback`,
      );
    return "COLOR";
  }
  if (binding.type === "FLOAT") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(
        `badge live writer: ${binding.field} is not a numeric fallback`,
      );
    return "FLOAT";
  }
  throw new TypeError(
    `badge live writer: unsupported binding type ${binding.type}`,
  );
};

const requireDefault = (root: IRNode): ComponentNode => {
  if (root.kind === "component" && root.role === "badge/variant/default")
    return root;
  throw new TypeError(
    "badge live writer: required one named default component, not a Color/Size/Closable set",
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
  input: BadgeFigmaWriterInput,
): BadgeFigmaSourcePlan => {
  if (
    input.envelope.recipe.id !== "badge" ||
    input.envelope.recipe.version !== 1
  )
    throw new TypeError("badge live writer requires badge@1");
  if (input.envelope.archetype !== "badge / tag / chip")
    throw new TypeError("badge live writer requires the badge / tag / chip archetype");

  const chip = requireDefault(input.envelope.ir);
  const badgeAxes = {
    Default: [...BADGE_DEFAULT],
  };
  if (chip.variantProperties.Default !== "true")
    throw new TypeError("badge live writer: default cell must be Default=true");

  const registry = new Map<string, ChipVariablePlan>();
  walk(chip, (node) => {
    if (node.kind === "instance")
      throw new TypeError(
        `badge live writer: unexpected instance ${node.componentRef}`,
      );
    for (const binding of node.bindings ?? []) {
      const value = atPath(node, binding.field);
      const type = variableType(binding, value);
      const key = `${type}:${binding.variable}`;
      const previous = registry.get(key);
      if (previous && canonicalJson(previous.value) !== canonicalJson(value))
        throw new TypeError(
          `badge live writer: conflicting fallback for ${binding.variable}`,
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
    throw new TypeError("badge live writer: zero planned variables");

  return {
    adapterIdentity: input.adapterIdentity,
    displayName: input.displayName,
    recipeHash: input.recipeHash,
    envelopeHash: input.envelope.integrity.canonicalHash,
    sourceId: input.envelope.id,
    sourceName: input.envelope.name,
    badgeAxes,
    badge: chip,
    variables: [...registry.values()].sort((left, right) =>
      `${left.type}:${left.identity}`.localeCompare(
        `${right.type}:${right.identity}`,
        "en",
      ),
    ),
    comparedIrFacts: countComparedFacts(input.envelope.ir),
  };
};

export function validateBadgeFigmaSourcePlans(
  plans: readonly BadgeFigmaSourcePlan[],
): string[] {
  const failures: string[] = [];
  if (plans.length === 0) failures.push("badge live writer: no sources");
  const identities = new Set(plans.map((plan) => plan.adapterIdentity));
  if (identities.size !== plans.length)
    failures.push("badge live writer: duplicate adapter identity");
  for (const plan of plans) {
    if (plan.variables.length === 0)
      failures.push(`${plan.adapterIdentity}: variables denominator is zero`);
    if (plan.comparedIrFacts <= 0)
      failures.push(
        `${plan.adapterIdentity}: compared facts denominator is zero`,
      );
    if (plan.badge.kind !== "component" || plan.badge.role !== "badge/variant/default")
      failures.push(
        `${plan.adapterIdentity}: expected one named default chip component`,
      );
  }
  return failures;
}

const WRITER_RUNTIME_SPEC = {
  "collectionLabel": "Recipe Badge",
  "mint": {
    "kind": "component",
    "field": "badge"
  },
  "forbiddenPages": [
    { "id": "218:90239", "marker": "BADGE-V10-PAGE" },
    { "id": "218:87649", "marker": "BADGE-V9-PAGE" },
    { "id": "218:86156", "marker": "BADGE-V8-PAGE" },
    { "id": "218:84674", "marker": "BADGE-V7-PAGE" },
    { "id": "212:81065", "marker": "BADGE-V6-PAGE" },
    { "id": "211:80168", "marker": "BADGE-V5-PAGE" },
    {
      "id": "115:295378",
      "marker": "INPUT-PAGE"
    },
    {
      "id": "210:80061",
      "marker": "BADGE-V4-PAGE"
    },
    {
      "id": "209:79949",
      "marker": "BADGE-V3-PAGE"
    },
    {
      "id": "198:77177",
      "marker": "BADGE-V2-PAGE"
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
      "marker": "BADGE-V1-PAGE"
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
    }
  ]
} as const;

const writerRuntime = (
  namespace: string,
  version: number,
  target: "scratch" | "plugin" = "scratch",
): string =>
  figmaWriterRuntime({
    archetype: "badge",
    prefix: "BADGE",
    namespace,
    writerVersion: version,
    target,
    collectionLabel: WRITER_RUNTIME_SPEC.collectionLabel,
    mint: { kind: WRITER_RUNTIME_SPEC.mint.kind, field: WRITER_RUNTIME_SPEC.mint.field },
    forbiddenPages: [...WRITER_RUNTIME_SPEC.forbiddenPages],
    forbiddenIdentities: [...WRITER_RUNTIME_SPEC.forbiddenIdentities],
  });

export function emitBadgeFigmaWriter(
  inputs: readonly BadgeFigmaWriterInput[],
  options?: { runIdentity?: string; target?: "scratch" | "plugin" },
): BadgeFigmaWriter {
  const sourcePlans = inputs.map(planSource);
  const failures = validateBadgeFigmaSourcePlans(sourcePlans);
  if (failures.length > 0) throw new TypeError(failures.join("; "));

  const runIdentity =
    options?.runIdentity ??
    sourcePlans.map((source) => source.recipeHash.slice(0, 8)).join("-") +
      `-${BADGE_FIGMA_RUN_SUFFIX}`;
  const namespace: string = BADGE_FIGMA_NAMESPACE;
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
    identity === FORBIDDEN_INPUT_RUN_IDENTITY
  )
    throw new TypeError(
      "chip writer must not reuse Input, Combobox, Table, Checkbox, Radio, Switch, Textarea, or Alert identity",
    );

  const pageName = `Recipe Pivot / Badge / ${runIdentity}`;
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
      badge: source.badge,
    })),
  };

  const target = options?.target ?? "scratch";
  const runtime = writerRuntime(
    BADGE_FIGMA_NAMESPACE,
    BADGE_FIGMA_WRITER_VERSION,
    target,
  );

  if (target === "scratch") {

  if (
    runtime.includes("BADGE-WRITER-COMPONENT-NAME-CARRIES-COMPILE-LABEL") ===
    false
  )
    throw new TypeError(
      "chip writer must carry the compile label into the component name",
    );
  if (
    runtime.includes(
      'component.name=ir.role+" :: "+(ir.label||source.sourceName)',
    ) === false
  )
    throw new TypeError(
      "chip writer component name must prefer the compile label",
    );
  if (
    runtime.includes(
      "BADGE-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE",
    ) === false
  )
    throw new TypeError(
      "chip writer must keep hug-text intrinsic size before a 0-width parent can collapse it",
    );
  if (runtime.includes("BADGE-FONT-PROVENANCE-TAMPER") === false)
    throw new TypeError(
      "chip writer must refuse font provenance tampering",
    );
  if (
    runtime.includes("BADGE-MUST-NOT-WRITE-INPUT-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-COMBOBOX-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-COMBOBOX-V42-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-BUTTON-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-TABLE-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-CALENDAR-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-CHECKBOX-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-RADIO-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-SWITCH-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-TEXTAREA-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-ALERT-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-CHIP-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-BADGE-V1-PAGE") === false
  )
    throw new TypeError(
      "chip writer must refuse signed Input, Combobox, Button, Table, Calendar, Checkbox, Radio, Switch, Textarea, Alert, and Chip pages",
    );

  }

  const code = `const PLAN=${JSON.stringify(plan)};\n${runtime}`;
  return {
    pageName,
    runIdentity,
    target,
    namespace: BADGE_FIGMA_NAMESPACE,
    sourcePlans,
    code,
  };
}
