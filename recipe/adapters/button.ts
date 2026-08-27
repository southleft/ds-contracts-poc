import { canonicalButtonRecipeInstance } from "../fixtures/button.js";
import {
  BUTTON_RECIPE_REF,
  normalizeButtonRecipeInstance,
  type ButtonRecipeInstance,
} from "../recipes/button.js";
import { canonicalJson } from "../normalize.js";
import {
  requireExactRecipeSelection,
  type RecipeSelection,
} from "../recipe.js";

interface LegacyProp {
  name: string;
  type: "text" | { enum: string[] };
  default?: string;
}

interface LegacyButtonShape {
  id: string;
  name: string;
  archetype: string;
  semantics?: { element?: string };
  props: LegacyProp[];
  states?: string[];
}

export interface ReviewedButtonAdapterConfig {
  sourcePath: string;
  generatedAt: string;
  selection: RecipeSelection;
  parameters: ButtonRecipeInstance["tokens"];
  variant: {
    sourceProp: string;
    primarySource: string | null;
    secondarySource: string | null;
    default: "primary" | "secondary";
  };
  size:
    | {
        sourceProp: string;
        sourceValues: Record<"small" | "medium" | "large", string>;
        default: "small" | "medium" | "large";
      }
    | {
        sourceProp: null;
        sourceValues: null;
        default: "small" | "medium" | "large";
      };
  labelProp: string;
  stateMap: Record<
    "hover" | "pressed" | "focus-visible" | "disabled",
    string | null
  >;
  sourceFacts: readonly ReviewedButtonSourceFact[];
  manualMappings: readonly string[];
}

export interface ReviewedButtonSourceFact {
  fact: { path: string; channel: string };
  category: "geometry" | "typography" | "fill" | "state";
  source:
    | { kind: "contract"; pointer: string; expected: unknown }
    | { kind: "measurement"; evidence: string };
  disposition: "parameter" | "extension" | "refusal";
  landing: string;
}

export interface ButtonAcquisitionReport {
  factsSelected: number;
  parameterFacts: number;
  extensionFacts: number;
  refusals: number;
  byCategory: Record<ReviewedButtonSourceFact["category"], number>;
  failures: string[];
}

const asLegacyButton = (input: unknown): LegacyButtonShape => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("reviewed button adapter: source must be an object");
  }
  const source = input as Partial<LegacyButtonShape>;
  if (
    typeof source.id !== "string" ||
    typeof source.name !== "string" ||
    source.archetype !== "button" ||
    source.semantics?.element !== "button" ||
    !Array.isArray(source.props)
  ) {
    throw new TypeError(
      "reviewed button adapter: source must explicitly declare a semantic button archetype",
    );
  }
  return source as LegacyButtonShape;
};

const enumValues = (source: LegacyButtonShape, propName: string): string[] => {
  const prop = source.props.find((candidate) => candidate.name === propName);
  if (
    !prop ||
    typeof prop.type !== "object" ||
    !Array.isArray(prop.type.enum)
  ) {
    throw new TypeError(
      `reviewed button adapter: configured enum prop ${propName} is absent`,
    );
  }
  return prop.type.enum;
};

const textDefault = (source: LegacyButtonShape, propName: string): string => {
  const prop = source.props.find((candidate) => candidate.name === propName);
  if (!prop || prop.type !== "text" || typeof prop.default !== "string") {
    throw new TypeError(
      `reviewed button adapter: configured text prop ${propName} has no default`,
    );
  }
  return prop.default;
};

const atPointer = (value: unknown, pointer: string): unknown => {
  if (!pointer.startsWith("/")) return undefined;
  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce<unknown>((current, part) => {
      if (
        current === null ||
        typeof current !== "object" ||
        !(part in current)
      ) {
        return undefined;
      }
      return (current as Record<string, unknown>)[part];
    }, value);
};

const atLanding = (value: unknown, landing: string): unknown =>
  landing.split(".").reduce<unknown>((current, part) => {
    if (current === null || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, value);

export function auditReviewedButtonAcquisition(
  sourceInput: unknown,
  config: ReviewedButtonAdapterConfig,
  instance: ButtonRecipeInstance,
): ButtonAcquisitionReport {
  const source = asLegacyButton(sourceInput);
  const failures: string[] = [];
  const seen = new Set<string>();
  const byCategory = {
    geometry: 0,
    typography: 0,
    fill: 0,
    state: 0,
  };
  for (const selected of config.sourceFacts) {
    const id = `${selected.fact.path}#${selected.fact.channel}`;
    if (seen.has(id)) failures.push(`${id}: duplicate selected source fact`);
    seen.add(id);
    byCategory[selected.category] += 1;
    if (selected.source.kind === "contract") {
      const actual = atPointer(source, selected.source.pointer);
      if (actual === undefined) {
        failures.push(
          `${id}: source pointer ${selected.source.pointer} is absent`,
        );
      } else if (
        canonicalJson(actual) !== canonicalJson(selected.source.expected)
      ) {
        failures.push(
          `${id}: source pointer ${selected.source.pointer} changed value`,
        );
      }
    } else if (selected.source.evidence.length === 0) {
      failures.push(`${id}: measured literal has no evidence receipt`);
    }
    if (selected.disposition === "parameter") {
      const landed = atLanding(instance, selected.landing);
      if (landed === undefined) {
        failures.push(`${id}: parameter landing ${selected.landing} is absent`);
      }
      if (
        selected.source.kind === "measurement" &&
        (landed === null ||
          typeof landed !== "object" ||
          (landed as { kind?: string }).kind !== "literal")
      ) {
        failures.push(
          `${id}: measured source fact must land through an explicit literal receipt`,
        );
      }
    } else if (selected.disposition === "extension") {
      if (
        !instance.extensions.some(
          (extension) => extension.id === selected.landing,
        )
      ) {
        failures.push(`${id}: extension landing ${selected.landing} is absent`);
      }
    } else if (
      !instance.receipts.some(
        (receipt) => receipt.evidence === selected.landing,
      )
    ) {
      failures.push(
        `${id}: named refusal landing ${selected.landing} is absent`,
      );
    }
  }
  if (config.sourceFacts.length === 0) failures.push("factsSelected is zero");
  for (const [category, count] of Object.entries(byCategory)) {
    if (count === 0)
      failures.push(`${category}: selected source fact denominator is zero`);
  }
  return {
    factsSelected: config.sourceFacts.length,
    parameterFacts: config.sourceFacts.filter(
      (fact) => fact.disposition === "parameter",
    ).length,
    extensionFacts: config.sourceFacts.filter(
      (fact) => fact.disposition === "extension",
    ).length,
    refusals: config.sourceFacts.filter(
      (fact) => fact.disposition === "refusal",
    ).length,
    byCategory,
    failures,
  };
}

/**
 * Acquisition is deliberately a priced, reviewed adapter. It validates the
 * configured source facts but never selects a recipe from source names.
 */
export function adaptReviewedButton(
  sourceInput: unknown,
  config: ReviewedButtonAdapterConfig,
): ButtonRecipeInstance {
  const source = asLegacyButton(sourceInput);
  requireExactRecipeSelection(config.selection, BUTTON_RECIPE_REF);
  if (config.manualMappings.length === 0) {
    throw new TypeError(
      "reviewed button adapter: manualMappings must price at least one reviewed decision",
    );
  }
  if (config.selection.manualCost.value < config.manualMappings.length) {
    throw new TypeError(
      `reviewed button adapter: manual cost ${config.selection.manualCost.value} under-prices ${config.manualMappings.length} mappings`,
    );
  }

  const variantProp = source.props.find(
    (candidate) => candidate.name === config.variant.sourceProp,
  );
  const variants = enumValues(source, config.variant.sourceProp);
  for (const value of [
    config.variant.primarySource,
    config.variant.secondarySource,
  ]) {
    if (value === null) {
      if (variantProp?.default !== undefined) {
        throw new TypeError(
          `reviewed button adapter: ${config.variant.sourceProp} cannot map absence while the source declares default ${variantProp.default}`,
        );
      }
      continue;
    }
    if (!variants.includes(value)) {
      throw new TypeError(
        `reviewed button adapter: ${config.variant.sourceProp} does not contain configured value ${value}`,
      );
    }
  }

  if (config.size.sourceProp !== null) {
    const sizes = enumValues(source, config.size.sourceProp);
    for (const value of Object.values(config.size.sourceValues)) {
      if (!sizes.includes(value)) {
        throw new TypeError(
          `reviewed button adapter: ${config.size.sourceProp} does not contain configured value ${value}`,
        );
      }
    }
  }

  const sourceStates = new Set(source.states ?? []);
  for (const [target, sourceState] of Object.entries(config.stateMap)) {
    if (sourceState !== null && !sourceStates.has(sourceState)) {
      throw new TypeError(
        `reviewed button adapter: state ${target} maps to absent source state ${sourceState}`,
      );
    }
  }

  const instance = structuredClone(
    canonicalButtonRecipeInstance,
  ) as ButtonRecipeInstance;
  instance.identity = {
    id: `${source.id}.recipe-button`,
    name: `${source.name} / button@1 proof`,
  };
  instance.axes.variant.default = config.variant.default;
  instance.axes.size.default = config.size.default;
  instance.label.default = textDefault(source, config.labelProp);
  instance.tokens = structuredClone(config.parameters);
  const selectedFacts = config.sourceFacts.map((selected) => ({
    path: selected.fact.path,
    channel:
      selected.disposition === "parameter"
        ? `parameter:${selected.landing}`
        : `${selected.disposition}:${selected.landing}`,
  }));
  instance.inputFacts = [...instance.inputFacts, ...selectedFacts];
  instance.accounting.carried = [
    ...instance.accounting.carried,
    ...config.sourceFacts
      .filter((selected) => selected.disposition === "parameter")
      .map((selected) => ({
        path: selected.fact.path,
        channel: `parameter:${selected.landing}`,
      })),
  ];
  instance.provenance = {
    source: config.sourcePath,
    tool: "button@1",
    generatedAt: config.generatedAt,
    selection: config.selection,
  };
  const normalized = normalizeButtonRecipeInstance(instance);
  const audit = auditReviewedButtonAcquisition(source, config, normalized);
  if (audit.failures.length > 0) {
    throw new TypeError(
      `reviewed button adapter: acquisition accounting failed: ${audit.failures.join("; ")}`,
    );
  }
  return normalized;
}
