import { canonicalInputFieldRecipeInstance } from "../fixtures/input-field.js";
import { canonicalJson } from "../normalize.js";
import {
  INPUT_FIELD_RECIPE_REF,
  normalizeInputFieldRecipeInstance,
  type InputFieldRecipeInstance,
} from "../recipes/input-field.js";
import {
  requireExactRecipeSelection,
  type RecipeSelection,
} from "../recipe.js";

interface LegacyProp {
  name: string;
  type: string | { enum: string[] };
  default?: unknown;
}

interface LegacyInputFieldShape {
  id: string;
  name: string;
  archetype: string;
  props: LegacyProp[];
  states?: string[];
}

export interface ReviewedInputFieldSourceFact {
  fact: { path: string; channel: string };
  category: "geometry" | "typography" | "fill" | "state" | "semantics";
  source:
    | { kind: "contract"; pointer: string; expected: unknown }
    | { kind: "review"; evidence: string };
  landing: string;
}

export interface InputFieldBenchmarkBoundary {
  packageName: string;
  version: string;
  exportName: string;
  importPath: string;
  wrapper: string;
  setupSeconds: number;
  sizeMap: Record<"small" | "medium", string>;
  stateMap: Record<
    "default" | "focus-visible" | "error" | "disabled",
    Record<string, unknown>
  >;
  contentMap: Record<"placeholder" | "value", Record<string, unknown>>;
  adornmentMap: Record<
    "leading" | "trailing",
    { propPath: string; fixture: string }
  >;
  requiredMap: Record<string, unknown>;
  unsupportedCells: readonly string[];
  captureCommand: string;
}

export interface ReviewedInputFieldAdapterConfig {
  sourcePath: string;
  generatedAt: string;
  selection: RecipeSelection;
  parameters: InputFieldRecipeInstance["tokens"];
  structure: InputFieldRecipeInstance["structure"];
  size: {
    sourceProp: string;
    sourceValues: Record<"small" | "medium", string>;
    default: "small" | "medium";
  };
  content: {
    label: string;
    placeholder: string;
    value: string;
    helper: string;
    error: string;
  };
  slots: {
    leadingComponentRef: string;
    trailingComponentRef: string;
    leadingPayload: InputFieldRecipeInstance["slots"]["leading"]["payload"];
    trailingPayload: InputFieldRecipeInstance["slots"]["trailing"]["payload"];
  };
  sourceFacts: readonly ReviewedInputFieldSourceFact[];
  manualMappings: readonly string[];
  benchmark: InputFieldBenchmarkBoundary;
}

export interface InputFieldAcquisitionReport {
  factsSelected: number;
  byCategory: Record<ReviewedInputFieldSourceFact["category"], number>;
  byField: Record<string, number>;
  parameterFields: number;
  mappingCount: number;
  setupSeconds: number;
  unsupportedCells: number;
  failures: string[];
}

const asLegacyInputField = (input: unknown): LegacyInputFieldShape => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError(
      "reviewed input-field adapter: source must be an object",
    );
  }
  const source = input as Partial<LegacyInputFieldShape>;
  if (
    typeof source.id !== "string" ||
    typeof source.name !== "string" ||
    source.archetype !== "input / field" ||
    !Array.isArray(source.props)
  ) {
    throw new TypeError(
      "reviewed input-field adapter: source must explicitly declare the input / field archetype",
    );
  }
  return source as LegacyInputFieldShape;
};

const enumValues = (
  source: LegacyInputFieldShape,
  propName: string,
): string[] => {
  const prop = source.props.find((candidate) => candidate.name === propName);
  if (
    !prop ||
    typeof prop.type !== "object" ||
    !Array.isArray(prop.type.enum)
  ) {
    throw new TypeError(
      `reviewed input-field adapter: configured enum prop ${propName} is absent`,
    );
  }
  return prop.type.enum;
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

const parameterLeafLandings = (
  value: unknown,
  prefix: string,
  out = new Set<string>(),
): Set<string> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    out.add(prefix);
    return out;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.variable === "string" &&
    (typeof record.fallback === "number" || typeof record.fallback === "string")
  ) {
    out.add(prefix);
    return out;
  }
  for (const [key, child] of Object.entries(record)) {
    parameterLeafLandings(child, `${prefix}.${key}`, out);
  }
  return out;
};

const expectedCategoryForLanding = (
  landing: string,
): ReviewedInputFieldSourceFact["category"] => {
  if (landing.includes(".states.")) return "state";
  if (
    landing.includes("Font") ||
    landing.includes("LineHeight") ||
    landing.includes(".typography.")
  ) {
    return "typography";
  }
  if (
    landing.includes("background") ||
    landing.includes("border") ||
    landing.includes("Text") ||
    landing.includes("Indicator") ||
    landing.includes("effects")
  ) {
    return "fill";
  }
  return landing.startsWith("semantic.") ? "semantics" : "geometry";
};

export function auditReviewedInputFieldAcquisition(
  sourceInput: unknown,
  config: ReviewedInputFieldAdapterConfig,
  instance: InputFieldRecipeInstance,
): InputFieldAcquisitionReport {
  const source = asLegacyInputField(sourceInput);
  const failures: string[] = [];
  const byCategory = {
    geometry: 0,
    typography: 0,
    fill: 0,
    state: 0,
    semantics: 0,
  };
  const seen = new Set<string>();
  const byField: Record<string, number> = {};
  for (const selected of config.sourceFacts) {
    const id = `${selected.fact.path}#${selected.fact.channel}`;
    if (seen.has(id)) failures.push(`${id}: duplicate selected source fact`);
    seen.add(id);
    byCategory[selected.category] += 1;
    byField[selected.landing] = (byField[selected.landing] ?? 0) + 1;
    if (
      selected.fact.channel.startsWith("reviewed-") &&
      (selected.landing.startsWith("tokens.") ||
        selected.landing.startsWith("structure.")) &&
      selected.category !== expectedCategoryForLanding(selected.landing)
    ) {
      failures.push(
        `${id}: category ${selected.category} mislabels ${selected.landing}; expected ${expectedCategoryForLanding(selected.landing)}`,
      );
    }
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
    } else if (selected.source.evidence.trim().length === 0) {
      failures.push(`${id}: reviewed source fact has no evidence`);
    }
    if (atLanding(instance, selected.landing) === undefined) {
      failures.push(`${id}: parameter landing ${selected.landing} is absent`);
    }
  }
  const requiredParameterFields = new Set([
    ...parameterLeafLandings(config.parameters, "tokens"),
    ...parameterLeafLandings(config.structure, "structure"),
    ...parameterLeafLandings(
      {
        leading: { payload: config.slots.leadingPayload },
        trailing: { payload: config.slots.trailingPayload },
      },
      "slots",
    ),
  ]);
  for (const landing of requiredParameterFields) {
    if (!byField[landing]) {
      failures.push(`${landing}: explicit source parameter accounting is zero`);
    }
  }
  if (config.sourceFacts.length === 0) failures.push("factsSelected is zero");
  for (const [category, count] of Object.entries(byCategory)) {
    if (count === 0) {
      failures.push(`${category}: selected source fact denominator is zero`);
    }
  }
  if (config.manualMappings.length === 0) {
    failures.push("manual mapping denominator is zero");
  }
  if (config.selection.manualCost.value < config.manualMappings.length) {
    failures.push(
      `manual cost ${config.selection.manualCost.value} under-prices ${config.manualMappings.length} mappings`,
    );
  }
  if (
    !Number.isFinite(config.benchmark.setupSeconds) ||
    config.benchmark.setupSeconds <= 0
  ) {
    failures.push("benchmark setup cost must be positive");
  }
  if (config.benchmark.unsupportedCells.length === 0) {
    failures.push(
      "benchmark unsupported-cell record is empty; the reviewed boundary must name exclusions",
    );
  }
  return {
    factsSelected: config.sourceFacts.length,
    byCategory,
    byField,
    parameterFields: requiredParameterFields.size,
    mappingCount: config.manualMappings.length,
    setupSeconds: config.benchmark.setupSeconds,
    unsupportedCells: config.benchmark.unsupportedCells.length,
    failures,
  };
}

/**
 * Population is explicit and priced. The source identity is data in the
 * reviewed config; neither this adapter nor the recipe selects from names.
 */
export function adaptReviewedInputField(
  sourceInput: unknown,
  config: ReviewedInputFieldAdapterConfig,
): InputFieldRecipeInstance {
  const source = asLegacyInputField(sourceInput);
  requireExactRecipeSelection(config.selection, INPUT_FIELD_RECIPE_REF);
  const sourceSizes = enumValues(source, config.size.sourceProp);
  for (const value of Object.values(config.size.sourceValues)) {
    if (!sourceSizes.includes(value)) {
      throw new TypeError(
        `reviewed input-field adapter: ${config.size.sourceProp} does not contain configured value ${value}`,
      );
    }
  }
  const instance = structuredClone(
    canonicalInputFieldRecipeInstance,
  ) as InputFieldRecipeInstance;
  instance.identity = {
    id: `${source.id}.recipe-input-field`,
    name: `${source.name} / input-field@1 offline fixture`,
  };
  instance.axes.size.default = config.size.default;
  instance.content.label.default = config.content.label;
  instance.content.placeholder.default = config.content.placeholder;
  instance.content.value.default = config.content.value;
  instance.content.helper.default = config.content.helper;
  instance.content.error.default = config.content.error;
  instance.slots.leading.componentRef = config.slots.leadingComponentRef;
  instance.slots.trailing.componentRef = config.slots.trailingComponentRef;
  instance.slots.leading.payload = structuredClone(config.slots.leadingPayload);
  instance.slots.trailing.payload = structuredClone(
    config.slots.trailingPayload,
  );
  instance.tokens = structuredClone(config.parameters);
  instance.structure = structuredClone(config.structure);
  const parameterFacts = config.sourceFacts.map((selected) => ({
    path: selected.fact.path,
    channel: `parameter:${selected.landing}`,
  }));
  instance.inputFacts = [...instance.inputFacts, ...parameterFacts];
  instance.accounting.carried = [
    ...instance.accounting.carried,
    ...parameterFacts,
  ];
  instance.provenance = {
    source: config.sourcePath,
    tool: "input-field@1",
    generatedAt: config.generatedAt,
    selection: config.selection,
  };
  const normalized = normalizeInputFieldRecipeInstance(instance);
  const audit = auditReviewedInputFieldAcquisition(source, config, normalized);
  if (audit.failures.length > 0) {
    throw new TypeError(
      `reviewed input-field adapter: acquisition accounting failed: ${audit.failures.join("; ")}`,
    );
  }
  return normalized;
}
