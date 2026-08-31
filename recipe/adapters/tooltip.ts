import { canonicalTooltipRecipeInstance } from "../fixtures/tooltip.js";
import { canonicalJson } from "../normalize.js";
import {
  TOOLTIP_RECIPE_REF,
  normalizeTooltipRecipeInstance,
  type TooltipRecipeInstance,
} from "../recipes/tooltip.js";
import {
  requireExactRecipeSelection,
  type RecipeSelection,
} from "../recipe.js";

export type TooltipFactCategory =
  | "anatomy"
  | "geometry"
  | "typography"
  | "fill"
  | "state"
  | "refusal";

export interface ReviewedTooltipSource {
  packageName: string;
  version: string;
  exportName: string;
  framework: "react";
  sourceRoot: string;
  anatomy: {
    root: string;
    control: string;
    label: string;
  };
  api: Record<string, unknown>;
  styleSources: string[];
  fontSources: string[];
}

export interface ReviewedTooltipSourceFact {
  occurrenceId: string;
  category: TooltipFactCategory;
  source:
    | { kind: "pointer"; pointer: string; expected: unknown }
    | { kind: "review"; evidence: string };
  disposition: "ir" | "refusal";
  target: string;
  receiptReason?: "lowered" | "no-figma-primitive" | "refused-by-recipe";
}

export interface TooltipBenchmarkBoundary {
  packageName: string;
  version: string;
  exportName: string;
  importPath: string;
  wrapper: string;
  setupSeconds: number;
  sourceHarness: string;
  sourceMatrixCells: number;
  unsupportedCells: string[];
  captureCommand: string;
  renderedReferences: false;
  graded: false;
}

export interface ReviewedTooltipAdapterConfig {
  sourcePath: string;
  generatedAt: string;
  selection: RecipeSelection;
  identity: { id: string; name: string };
  content: TooltipRecipeInstance["content"];
  tokens: TooltipRecipeInstance["tokens"];
  axes?: TooltipRecipeInstance["axes"];
  sourceFacts: ReviewedTooltipSourceFact[];
  manualMappings: string[];
  receipts: TooltipRecipeInstance["receipts"];
  benchmark: TooltipBenchmarkBoundary;
}

export interface TooltipAcquisitionReport {
  occurrences: number;
  ir: number;
  refusals: number;
  byCategory: Record<TooltipFactCategory, number>;
  setupSeconds: number;
  mappingCount: number;
  failures: string[];
}

const atPointer = (value: unknown, pointer: string): unknown => {
  if (!pointer.startsWith("/")) return undefined;
  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce<unknown>((current, part) => {
      if (current === null || typeof current !== "object" || !(part in current))
        return undefined;
      return (current as Record<string, unknown>)[part];
    }, value);
};

const atLanding = (value: unknown, landing: string): unknown =>
  landing.split(".").reduce<unknown>((current, part) => {
    if (current === null || typeof current !== "object" || !(part in current))
      return undefined;
    return (current as Record<string, unknown>)[part];
  }, value);

const expectedCategory = (target: string): TooltipFactCategory => {
  if (
    target.startsWith("tokens.typography") ||
    target.includes("decoration") ||
    target.includes("lineHeightUnit")
  )
    return "typography";
  if (target.endsWith("strokeAlign"))
    return "anatomy";
  if (target.includes("boxOpacity")) return "state";
  if (
    target.includes("boxFill") ||
    target.includes("boxBorder") ||
    target.endsWith(".label") ||
    target.includes("boxFill") ||
    target.includes("boxBorder") ||
    target.includes("rest")
  )
    return "fill";
  if (target.startsWith("tokens.")) return "geometry";
  if (target.startsWith("receipts.")) return "refusal";
  return "anatomy";
};

const leafLandings = (
  value: unknown,
  path: string,
  out = new Set<string>(),
): Set<string> => {
  if (value === null || typeof value !== "object") {
    out.add(path);
    return out;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.variable === "string" &&
    (typeof record.fallback === "string" || typeof record.fallback === "number")
  ) {
    out.add(path);
    return out;
  }
  for (const [key, child] of Object.entries(record))
    leafLandings(child, `${path}.${key}`, out);
  return out;
};

export function auditReviewedTooltipAcquisition(
  source: ReviewedTooltipSource,
  config: ReviewedTooltipAdapterConfig,
  instance: TooltipRecipeInstance,
): TooltipAcquisitionReport {
  const failures: string[] = [];
  const byCategory: Record<TooltipFactCategory, number> = {
    anatomy: 0,
    geometry: 0,
    typography: 0,
    fill: 0,
    state: 0,
    refusal: 0,
  };
  const occurrenceIds = new Set<string>();
  const targets = new Set<string>();
  for (const fact of config.sourceFacts) {
    if (occurrenceIds.has(fact.occurrenceId))
      failures.push(`${fact.occurrenceId}: duplicate occurrence id`);
    occurrenceIds.add(fact.occurrenceId);
    const collapseKey = `${fact.disposition}:${fact.target}`;
    if (targets.has(collapseKey))
      failures.push(
        `${fact.occurrenceId}: duplicate collapse onto ${fact.target}`,
      );
    targets.add(collapseKey);
    byCategory[fact.category] += 1;
    if (fact.source.kind === "pointer") {
      const actual = atPointer(source, fact.source.pointer);
      if (actual === undefined)
        failures.push(
          `${fact.occurrenceId}: source pointer ${fact.source.pointer} is absent`,
        );
      else if (canonicalJson(actual) !== canonicalJson(fact.source.expected))
        failures.push(`${fact.occurrenceId}: source pointer changed value`);
    } else if (!fact.source.evidence.trim())
      failures.push(`${fact.occurrenceId}: reviewed evidence is empty`);
    if (
      fact.disposition === "ir" &&
      atLanding(instance, fact.target) === undefined
    )
      failures.push(`${fact.occurrenceId}: IR landing ${fact.target} is absent`);
    if (fact.disposition === "refusal" && !fact.target.trim())
      failures.push(`${fact.occurrenceId}: named refusal is absent`);
    const expected = expectedCategory(
      fact.disposition === "refusal" ? `receipts.${fact.target}` : fact.target,
    );
    if (
      fact.source.kind === "review" &&
      fact.category !== expected &&
      !(fact.category === "anatomy" && fact.disposition === "ir") &&
      !(fact.category === "refusal" && fact.disposition === "refusal")
    )
      failures.push(
        `${fact.occurrenceId}: category ${fact.category} mislabels ${fact.target}; expected ${expected}`,
      );
  }
  const selectedTargets = new Set(
    config.sourceFacts
      .filter((fact) => fact.disposition === "ir")
      .map((fact) => fact.target),
  );
  for (const landing of leafLandings(config.tokens, "tokens"))
    if (!selectedTargets.has(landing))
      failures.push(`${landing}: selected source occurrence is missing`);
  if (config.sourceFacts.length === 0) failures.push("zero source occurrences");
  if (config.manualMappings.length < config.sourceFacts.length)
    failures.push("manual mapping count under-prices selected facts");
  if (config.selection.manualCost.value < config.manualMappings.length)
    failures.push("reviewed setup cost under-prices manual mappings");
  if (config.benchmark.setupSeconds <= 0)
    failures.push("source setup cost must be positive");
  if (config.benchmark.sourceMatrixCells <= 0)
    failures.push("source proof matrix must be nonzero");
  if (config.benchmark.unsupportedCells.length === 0)
    failures.push("unsupported source cells must be named");
  for (const category of [
    "anatomy",
    "geometry",
    "typography",
    "fill",
    "state",
    "refusal",
  ] as const)
    if (byCategory[category] === 0)
      failures.push(`${category}: selected source denominator is zero`);
  return {
    occurrences: config.sourceFacts.length,
    ir: config.sourceFacts.filter((fact) => fact.disposition === "ir").length,
    refusals: config.sourceFacts.filter(
      (fact) => fact.disposition === "refusal",
    ).length,
    byCategory,
    setupSeconds: config.benchmark.setupSeconds,
    mappingCount: config.manualMappings.length,
    failures,
  };
}

export function adaptReviewedTooltip(
  source: ReviewedTooltipSource,
  config: ReviewedTooltipAdapterConfig,
): TooltipRecipeInstance {
  requireExactRecipeSelection(config.selection, TOOLTIP_RECIPE_REF);
  if (
    source.packageName !== config.benchmark.packageName ||
    source.version !== config.benchmark.version ||
    source.exportName !== config.benchmark.exportName
  )
    throw new TypeError(
      "reviewed tooltip adapter: source identity does not match explicit config",
    );
  const instance = structuredClone(
    canonicalTooltipRecipeInstance,
  ) as TooltipRecipeInstance;
  instance.identity = structuredClone(config.identity);
  instance.content = structuredClone(config.content);
  instance.tokens = structuredClone(config.tokens);
  if (config.axes) instance.axes = structuredClone(config.axes);
  instance.provenance = {
    source: config.sourcePath,
    tool: "tooltip@1",
    generatedAt: config.generatedAt,
    selection: config.selection,
  };
  instance.inputFacts = [];
  instance.accounting = { carried: [] };
  instance.receipts = [];
  for (const selected of config.sourceFacts) {
    const fact = {
      path: `occurrence:${selected.occurrenceId}`,
      channel:
        selected.disposition === "ir"
          ? `parameter:${selected.target}`
          : `refusal:${selected.target}`,
    };
    instance.inputFacts.push(fact);
    if (selected.disposition === "ir") instance.accounting.carried.push(fact);
    else {
      instance.receipts.push({
        fact,
        value:
          selected.source.kind === "pointer"
            ? JSON.stringify(selected.source.expected)
            : selected.source.evidence,
        reason: selected.receiptReason ?? "refused-by-recipe",
        evidence: selected.target,
      });
    }
  }
  const normalized = normalizeTooltipRecipeInstance(instance);
  const report = auditReviewedTooltipAcquisition(source, config, normalized);
  if (report.failures.length > 0)
    throw new TypeError(
      `reviewed tooltip adapter: ${report.failures.join("; ")}`,
    );
  return normalized;
}
