/**
 * link@1 Figma writer.
 *
 * Inherits the hardened calendar/table writer shape: exact file identity,
 * signed-page refuse, owned variable collections, font provenance + named
 * fallback walk (no Inter), set name carries the compile label, hug text
 * records intrinsic size before a 0-width parent can collapse it, layout
 * then children then sizing.
 *
 * Link is inline text decoration. One named default cell per source.
 * Underline-at-rest is not an axis. AntD compiles Typography.Link.
 *
 * No live write happens here. Executing the program requires a separate
 * PREPARE / AUTHORIZE / attempt lineage.
 */
import type { ComponentNode, IRNode, VariableBinding } from "./figma-ir.js";
import { figmaWriterRuntime } from "./figma-writer-runtime.js";
import type { RecipeEnvelope } from "./envelope.js";
import { canonicalJson } from "./normalize.js";
import { LINK_DEFAULT } from "./recipes/link.js";
import {
  buildFigmaVariableNameMap,
  sanitizeFigmaVariableName,
} from "./interpret.js";

export const LINK_FIGMA_NAMESPACE = "ds.contracts.link.recipe.v1";
export const LINK_FIGMA_WRITER_VERSION = 1;
export const LINK_FIGMA_RUN_SUFFIX = "link-v2";

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

export const LINK_FIGMA_VARIANTS_PER_SOURCE = LINK_DEFAULT.length;

export interface LinkVariablePlan {
  identity: string;
  name: string;
  type: "COLOR" | "FLOAT";
  value: string | number;
}

export interface LinkFigmaWriterInput {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelope: RecipeEnvelope;
}

export interface LinkFigmaSourcePlan {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelopeHash: string;
  sourceId: string;
  sourceName: string;
  chipAxes: Record<string, string[]>;
  chip: ComponentNode;
  variables: LinkVariablePlan[];
  comparedIrFacts: number;
}

export interface LinkFigmaWriter {
  pageName: string;
  runIdentity: string;
  namespace: string;
  sourcePlans: LinkFigmaSourcePlan[];
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
        `link live writer: ${binding.field} is not a colour fallback`,
      );
    return "COLOR";
  }
  if (binding.type === "FLOAT") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(
        `link live writer: ${binding.field} is not a numeric fallback`,
      );
    return "FLOAT";
  }
  throw new TypeError(
    `link live writer: unsupported binding type ${binding.type}`,
  );
};

const requireDefault = (root: IRNode): ComponentNode => {
  if (root.kind === "component" && root.role === "link/variant/default")
    return root;
  throw new TypeError(
    "link live writer: required one named default component, not a Color/Size/Closable set",
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
  input: LinkFigmaWriterInput,
): LinkFigmaSourcePlan => {
  if (
    input.envelope.recipe.id !== "link" ||
    input.envelope.recipe.version !== 1
  )
    throw new TypeError("link live writer requires link@1");
  if (input.envelope.archetype !== "none")
    throw new TypeError("link live writer requires the none archetype");

  const chip = requireDefault(input.envelope.ir);
  const chipAxes = {
    Default: [...LINK_DEFAULT],
  };
  if (chip.variantProperties.Default !== "true")
    throw new TypeError("link live writer: default cell must be Default=true");

  const registry = new Map<string, LinkVariablePlan>();
  walk(chip, (node) => {
    if (node.kind === "instance")
      throw new TypeError(
        `link live writer: unexpected instance ${node.componentRef}`,
      );
    for (const binding of node.bindings ?? []) {
      const value = atPath(node, binding.field);
      const type = variableType(binding, value);
      const key = `${type}:${binding.variable}`;
      const previous = registry.get(key);
      if (previous && canonicalJson(previous.value) !== canonicalJson(value))
        throw new TypeError(
          `link live writer: conflicting fallback for ${binding.variable}`,
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
    throw new TypeError("link live writer: zero planned variables");

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

export function validateLinkFigmaSourcePlans(
  plans: readonly LinkFigmaSourcePlan[],
): string[] {
  const failures: string[] = [];
  if (plans.length === 0) failures.push("link live writer: no sources");
  const identities = new Set(plans.map((plan) => plan.adapterIdentity));
  if (identities.size !== plans.length)
    failures.push("link live writer: duplicate adapter identity");
  for (const plan of plans) {
    if (plan.variables.length === 0)
      failures.push(`${plan.adapterIdentity}: variables denominator is zero`);
    if (plan.comparedIrFacts <= 0)
      failures.push(
        `${plan.adapterIdentity}: compared facts denominator is zero`,
      );
    if (plan.chip.kind !== "component" || plan.chip.role !== "link/variant/default")
      failures.push(
        `${plan.adapterIdentity}: expected one named default link component`,
      );
  }
  return failures;
}

const WRITER_RUNTIME_SPEC = {
  "collectionLabel": "Recipe Link",
  "mint": {
    "kind": "component",
    "field": "chip"
  },
  "forbiddenPages": [
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
    }
  ]
} as const;

const writerRuntime = (namespace: string, version: number): string =>
  figmaWriterRuntime({
    archetype: "link",
    prefix: "LINK",
    namespace,
    writerVersion: version,
    target: "scratch",
    collectionLabel: WRITER_RUNTIME_SPEC.collectionLabel,
    mint: { kind: WRITER_RUNTIME_SPEC.mint.kind, field: WRITER_RUNTIME_SPEC.mint.field },
    forbiddenPages: [...WRITER_RUNTIME_SPEC.forbiddenPages],
    forbiddenIdentities: [...WRITER_RUNTIME_SPEC.forbiddenIdentities],
  });

export function emitLinkFigmaWriter(
  inputs: readonly LinkFigmaWriterInput[],
  options?: { runIdentity?: string },
): LinkFigmaWriter {
  const sourcePlans = inputs.map(planSource);
  const failures = validateLinkFigmaSourcePlans(sourcePlans);
  if (failures.length > 0) throw new TypeError(failures.join("; "));

  const runIdentity =
    options?.runIdentity ??
    sourcePlans.map((source) => source.recipeHash.slice(0, 8)).join("-") +
      `-${LINK_FIGMA_RUN_SUFFIX}`;
  const namespace: string = LINK_FIGMA_NAMESPACE;
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
    identity === FORBIDDEN_INPUT_RUN_IDENTITY
  )
    throw new TypeError(
      "link writer must not reuse Input, Combobox, Table, Checkbox, Radio, Switch, Textarea, Alert, Chip, Badge, or Avatar identity",
    );

  const pageName = `Recipe Pivot / Link / ${runIdentity}`;
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
    LINK_FIGMA_NAMESPACE,
    LINK_FIGMA_WRITER_VERSION,
  );

  if (
    runtime.includes("LINK-WRITER-COMPONENT-NAME-CARRIES-COMPILE-LABEL") ===
    false
  )
    throw new TypeError(
      "link writer must carry the compile label into the component name",
    );
  if (
    runtime.includes(
      'component.name=ir.role+" :: "+(ir.label||source.sourceName)',
    ) === false
  )
    throw new TypeError(
      "link writer component name must prefer the compile label",
    );
  if (
    runtime.includes(
      "LINK-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE",
    ) === false
  )
    throw new TypeError(
      "link writer must keep hug-text intrinsic size before a 0-width parent can collapse it",
    );
  if (runtime.includes("LINK-FONT-PROVENANCE-TAMPER") === false)
    throw new TypeError(
      "link writer must refuse font provenance tampering",
    );
  if (
    runtime.includes("LINK-MUST-NOT-WRITE-INPUT-PAGE") === false ||
    runtime.includes("LINK-MUST-NOT-WRITE-COMBOBOX-PAGE") === false ||
    runtime.includes("LINK-MUST-NOT-WRITE-COMBOBOX-V42-PAGE") === false ||
    runtime.includes("LINK-MUST-NOT-WRITE-BUTTON-PAGE") === false ||
    runtime.includes("LINK-MUST-NOT-WRITE-TABLE-PAGE") === false ||
    runtime.includes("LINK-MUST-NOT-WRITE-CALENDAR-PAGE") === false ||
    runtime.includes("LINK-MUST-NOT-WRITE-CHECKBOX-PAGE") === false ||
    runtime.includes("LINK-MUST-NOT-WRITE-RADIO-PAGE") === false ||
    runtime.includes("LINK-MUST-NOT-WRITE-SWITCH-PAGE") === false ||
    runtime.includes("LINK-MUST-NOT-WRITE-TEXTAREA-PAGE") === false ||
    runtime.includes("LINK-MUST-NOT-WRITE-ALERT-PAGE") === false
  )
    throw new TypeError(
      "link writer must refuse signed Input, Combobox, Button, Table, Calendar, Checkbox, Radio, Switch, Textarea, and Alert pages",
    );

  const code = `const PLAN=${JSON.stringify(plan)};\n${runtime}`;
  return {
    pageName,
    runIdentity,
    namespace: LINK_FIGMA_NAMESPACE,
    sourcePlans,
    code,
  };
}
