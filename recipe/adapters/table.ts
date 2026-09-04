import { canonicalTableRecipeInstance } from "../fixtures/table.js";
import { canonicalJson } from "../normalize.js";
import {
  TABLE_RECIPE_REF,
  normalizeTableRecipeInstance,
  type TableRecipeInstance,
} from "../recipes/table.js";
import {
  requireExactRecipeSelection,
  type RecipeSelection,
} from "../recipe.js";

export type TableFactCategory =
  | "anatomy"
  | "geometry"
  | "typography"
  | "fill"
  | "state"
  | "api"
  | "semantics"
  | "refusal";

export interface ReviewedTableSource {
  packageName: string;
  version: string;
  exportName: string;
  framework: "react";
  sourceRoot: string;
  anatomy: {
    root: string;
    header: string;
    body: string;
    row: string;
    headerCell: string;
    bodyCell: string;
    columnAxis: string;
  };
  api: Record<string, unknown>;
  styleSources: string[];
  fontSources: string[];
}

export interface ReviewedTableSourceFact {
  occurrenceId: string;
  category: TableFactCategory;
  source:
    | { kind: "pointer"; pointer: string; expected: unknown }
    | { kind: "review"; evidence: string };
  disposition: "ir" | "extension" | "refusal";
  target: string;
}

export interface TableBenchmarkBoundary {
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

export interface ReviewedTableAdapterConfig {
  sourcePath: string;
  generatedAt: string;
  selection: RecipeSelection;
  identity: { id: string; name: string };
  content: TableRecipeInstance["content"];
  tokens: TableRecipeInstance["tokens"];
  sourceFacts: ReviewedTableSourceFact[];
  manualMappings: string[];
  benchmark: TableBenchmarkBoundary;
}

export interface TableAcquisitionReport {
  occurrences: number;
  ir: number;
  extensions: number;
  refusals: number;
  byCategory: Record<TableFactCategory, number>;
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

const expectedCategory = (target: string): TableFactCategory => {
  if (target.startsWith("tokens.typography")) return "typography";
  if (target.startsWith("tokens.rowStates")) return "state";
  // cellRuleSides.* are WIDTHS: the fill test below matches "cellRule" as a
  // prefix, so classify the sides first (they pair with cellRuleWidth).
  if (target.includes("cellRuleSides")) return "geometry";
  if (
    target.includes("background") ||
    target.includes("surface") ||
    target.includes("text") ||
    target.includes("Border") ||
    target.includes("cellRule")
  )
    return "fill";
  if (target.startsWith("tokens.")) return "geometry";
  if (target.startsWith("extensions.")) return "api";
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

export function auditReviewedTableAcquisition(
  source: ReviewedTableSource,
  config: ReviewedTableAdapterConfig,
  instance: TableRecipeInstance,
): TableAcquisitionReport {
  const failures: string[] = [];
  const byCategory: Record<TableFactCategory, number> = {
    anatomy: 0,
    geometry: 0,
    typography: 0,
    fill: 0,
    state: 0,
    api: 0,
    semantics: 0,
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
      failures.push(
        `${fact.occurrenceId}: IR landing ${fact.target} is absent`,
      );
    if (
      fact.disposition === "extension" &&
      !instance.extensions.some((extension) => extension.id === fact.target)
    )
      failures.push(
        `${fact.occurrenceId}: extension landing ${fact.target} is absent`,
      );
    if (fact.disposition === "refusal" && !fact.target.trim())
      failures.push(`${fact.occurrenceId}: named refusal is absent`);
    const expected = expectedCategory(
      fact.disposition === "extension"
        ? `extensions.${fact.target}`
        : fact.disposition === "refusal"
          ? `receipts.${fact.target}`
          : fact.target,
    );
    if (
      fact.source.kind === "review" &&
      fact.category !== expected &&
      !(fact.category === "semantics" && fact.disposition === "extension") &&
      !(fact.category === "anatomy" && fact.disposition === "ir")
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
    "api",
    "semantics",
    "refusal",
  ] as const)
    if (byCategory[category] === 0)
      failures.push(`${category}: selected source denominator is zero`);
  return {
    occurrences: config.sourceFacts.length,
    ir: config.sourceFacts.filter((fact) => fact.disposition === "ir").length,
    extensions: config.sourceFacts.filter(
      (fact) => fact.disposition === "extension",
    ).length,
    refusals: config.sourceFacts.filter(
      (fact) => fact.disposition === "refusal",
    ).length,
    byCategory,
    setupSeconds: config.benchmark.setupSeconds,
    mappingCount: config.manualMappings.length,
    failures,
  };
}

export function adaptReviewedTable(
  source: ReviewedTableSource,
  config: ReviewedTableAdapterConfig,
): TableRecipeInstance {
  requireExactRecipeSelection(config.selection, TABLE_RECIPE_REF);
  if (
    source.packageName !== config.benchmark.packageName ||
    source.version !== config.benchmark.version ||
    source.exportName !== config.benchmark.exportName
  )
    throw new TypeError(
      "reviewed table adapter: source identity does not match explicit config",
    );
  const instance = structuredClone(
    canonicalTableRecipeInstance,
  ) as TableRecipeInstance;
  instance.identity = structuredClone(config.identity);
  instance.content = structuredClone(config.content);
  instance.tokens = structuredClone(config.tokens);
  instance.provenance = {
    source: config.sourcePath,
    tool: "table@1",
    generatedAt: config.generatedAt,
    selection: config.selection,
  };
  for (const selected of config.sourceFacts) {
    const fact = {
      path: `occurrence:${selected.occurrenceId}`,
      channel:
        selected.disposition === "ir"
          ? `parameter:${selected.target}`
          : selected.disposition === "extension"
            ? `extension:${selected.target}`
            : `refusal:${selected.target}`,
    };
    instance.inputFacts.push(fact);
    if (selected.disposition === "ir") instance.accounting.carried.push(fact);
    else if (selected.disposition === "extension") {
      const extension = instance.extensions.find(
        (candidate) => candidate.id === selected.target,
      );
      if (!extension)
        throw new TypeError(
          `reviewed table adapter: missing extension ${selected.target}`,
        );
      extension.absorbs.push(fact);
    } else {
      instance.receipts.push({
        fact,
        value:
          selected.source.kind === "pointer"
            ? JSON.stringify(selected.source.expected)
            : selected.source.evidence,
        reason: "refused-by-recipe",
        evidence: selected.target,
      });
    }
  }
  const normalized = normalizeTableRecipeInstance(instance);
  const report = auditReviewedTableAcquisition(source, config, normalized);
  if (report.failures.length > 0)
    throw new TypeError(
      `reviewed table adapter: ${report.failures.join("; ")}`,
    );
  return normalized;
}
