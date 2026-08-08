import { revisionOf } from "./contract-provenance.js";
import { camel, canonicalPropName } from "./figma-names.js";

export const EXACT_PROJECTION_REFUSAL_CODES = [
  "EXACT_DEFINITIONS_MISSING",
  "EXACT_DEFINITION_CONTRADICTORY",
  "EXACT_PROPERTY_CANONICAL_COLLISION",
  "EXACT_VALUE_CANONICAL_COLLISION",
  "EXACT_TUPLE_MISSING",
  "EXACT_TUPLE_INCOMPLETE",
  "EXACT_TUPLE_UNKNOWN_PROPERTY",
  "EXACT_TUPLE_INVALID_VALUE",
  "EXACT_TUPLE_DUPLICATE",
  "EXACT_MATRIX_RAGGED",
  "EXACT_ROWS_MISSING",
  "EXACT_ROWS_EXTRA",
  "EXACT_PROJECTION_COUNT_MISMATCH",
] as const;

export type ExactProjectionRefusalCode =
  (typeof EXACT_PROJECTION_REFUSAL_CODES)[number];

export interface ExactPropertyDefinition {
  type: string;
  defaultValue?: unknown;
  variantOptions?: readonly unknown[];
}

export interface ExactVariantRow {
  name?: string;
  variantProperties?: Record<string, unknown> | null;
}

export interface ExactDumpSet {
  setName?: string;
  type?: string;
  propertyDefinitions?: Record<
    string,
    ExactPropertyDefinition | unknown
  > | null;
  variants: ExactVariantRow[];
}

export type ExactProjectionRows =
  readonly ExactVariantRow[] | { variants: readonly ExactVariantRow[] };

export interface ExactProjectionRefusal {
  code: ExactProjectionRefusalCode;
  message: string;
  tuples?: readonly string[];
  expected?: number;
  actual?: number;
}

export interface LegacyUnverifiedExactProjection {
  status: "legacy-unverified";
  reason: "structured-exact-evidence-absent";
}

interface ExactProjectionEvidence {
  propertyNames: readonly string[];
  expectedCount: number;
  observedCount: number;
  tupleSetHash: string;
  tuples: readonly string[];
}

export interface SourceMatrixVerifiedExactProjection extends ExactProjectionEvidence {
  status: "source-matrix-verified";
}

export interface VerifiedExactProjection extends ExactProjectionEvidence {
  status: "verified-exact";
}

export interface RefusedExactProjection {
  status: "refused";
  code: ExactProjectionRefusalCode;
  refusals: readonly ExactProjectionRefusal[];
}

export type ExactProjectionResult =
  | LegacyUnverifiedExactProjection
  | SourceMatrixVerifiedExactProjection
  | VerifiedExactProjection
  | RefusedExactProjection;

interface Axis {
  name: string;
  options: readonly string[];
}

const refusalOrder = new Map(
  EXACT_PROJECTION_REFUSAL_CODES.map((code, index) => [code, index]),
);

const own = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const canonicalTuple = (
  propertyNames: readonly string[],
  tuple: Record<string, string>,
): string => JSON.stringify(propertyNames.map((name) => [name, tuple[name]]));

const tupleHash = (tuples: readonly string[]): string =>
  revisionOf([...tuples].sort()).slice("sha256:".length);

const cartesianTuples = (axes: readonly Axis[]): string[] => {
  let rows: Record<string, string>[] = [{}];
  for (const axis of axes) {
    rows = rows.flatMap((row) =>
      axis.options.map((option) => ({ ...row, [axis.name]: option })),
    );
  }
  return rows
    .map((row) =>
      canonicalTuple(
        axes.map((axis) => axis.name),
        row,
      ),
    )
    .sort();
};

const definitionRefusal = (message: string): ExactProjectionRefusal => ({
  code: "EXACT_DEFINITION_CONTRADICTORY",
  message,
});

const canonicalCollisions = (
  values: readonly string[],
  canonicalize: (value: string) => string,
): string[][] => {
  const byCanonical = new Map<string, string[]>();
  for (const value of values) {
    const canonical = canonicalize(value);
    const sources = byCanonical.get(canonical) ?? [];
    sources.push(value);
    byCanonical.set(canonical, sources);
  }
  return [...byCanonical.entries()]
    .filter(([, sources]) => new Set(sources).size > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, sources]) => [...new Set(sources)].sort());
};

const readAxes = (
  definitions: Record<string, ExactPropertyDefinition | unknown>,
): { axes: Axis[]; refusals: ExactProjectionRefusal[] } => {
  const axes: Axis[] = [];
  const refusals: ExactProjectionRefusal[] = [];
  const variantNames = Object.keys(definitions)
    .filter(
      (name) =>
        isRecord(definitions[name]) && definitions[name].type === "VARIANT",
    )
    .sort();

  for (const sources of canonicalCollisions(variantNames, canonicalPropName)) {
    refusals.push({
      code: "EXACT_PROPERTY_CANONICAL_COLLISION",
      message: `Variant properties ${sources
        .map((source) => JSON.stringify(source))
        .join(
          ", ",
        )} canonicalize to ${JSON.stringify(canonicalPropName(sources[0]))}.`,
      tuples: sources,
    });
  }

  for (const name of Object.keys(definitions).sort()) {
    const raw = definitions[name];
    if (!isRecord(raw) || typeof raw.type !== "string") {
      refusals.push(
        definitionRefusal(
          `Property definition ${JSON.stringify(name)} requires a string type.`,
        ),
      );
      continue;
    }
    if (raw.type !== "VARIANT") continue;

    const options = raw.variantOptions;
    const defaultValue = raw.defaultValue;
    if (
      !Array.isArray(options) ||
      options.length === 0 ||
      options.some((option) => typeof option !== "string") ||
      typeof defaultValue !== "string"
    ) {
      refusals.push(
        definitionRefusal(
          `Variant definition ${JSON.stringify(name)} requires a string defaultValue and non-empty string variantOptions.`,
        ),
      );
      continue;
    }

    const stringOptions = options as string[];
    if (new Set(stringOptions).size !== stringOptions.length) {
      refusals.push(
        definitionRefusal(
          `Variant definition ${JSON.stringify(name)} contains duplicate options.`,
        ),
      );
      continue;
    }
    if (!stringOptions.includes(defaultValue)) {
      refusals.push(
        definitionRefusal(
          `Variant definition ${JSON.stringify(name)} has a defaultValue outside variantOptions.`,
        ),
      );
      continue;
    }

    for (const sources of canonicalCollisions(stringOptions, camel)) {
      refusals.push({
        code: "EXACT_VALUE_CANONICAL_COLLISION",
        message: `Variant property ${JSON.stringify(name)} values ${sources
          .map((source) => JSON.stringify(source))
          .join(", ")} canonicalize to ${JSON.stringify(camel(sources[0]))}.`,
        tuples: sources,
      });
    }
    axes.push({ name, options: [...stringOptions].sort() });
  }

  return { axes, refusals };
};

interface CheckedRows {
  tuples: string[];
  refusals: ExactProjectionRefusal[];
}

const checkRows = (
  rows: readonly ExactVariantRow[],
  axes: readonly Axis[],
  label: "source" | "returned",
  allowEmptyTuple: boolean,
): CheckedRows => {
  const propertyNames = axes.map((axis) => axis.name);
  const allowed = new Map(
    axes.map((axis) => [axis.name, new Set(axis.options)]),
  );
  const tuples: string[] = [];
  const refusals: ExactProjectionRefusal[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const candidate = isRecord(row) ? row.variantProperties : undefined;
    const properties =
      allowEmptyTuple && candidate === undefined ? {} : candidate;
    if (!isRecord(properties)) {
      refusals.push({
        code: "EXACT_TUPLE_MISSING",
        message: `${label} row ${index} has no structured variantProperties tuple.`,
      });
      return;
    }

    const keys = Object.keys(properties);
    const missing = propertyNames.filter((name) => !own(properties, name));
    const unknown = keys.filter((name) => !allowed.has(name)).sort();
    const invalid = propertyNames
      .filter(
        (name) =>
          own(properties, name) &&
          !allowed.get(name)?.has(properties[name] as string),
      )
      .sort();

    if (missing.length > 0) {
      refusals.push({
        code: "EXACT_TUPLE_INCOMPLETE",
        message: `${label} row ${index} is missing properties: ${missing.map((name) => JSON.stringify(name)).join(", ")}.`,
      });
    }
    if (unknown.length > 0) {
      refusals.push({
        code: "EXACT_TUPLE_UNKNOWN_PROPERTY",
        message: `${label} row ${index} has unknown properties: ${unknown.map((name) => JSON.stringify(name)).join(", ")}.`,
      });
    }
    if (invalid.length > 0) {
      refusals.push({
        code: "EXACT_TUPLE_INVALID_VALUE",
        message: `${label} row ${index} has invalid values for: ${invalid.map((name) => JSON.stringify(name)).join(", ")}.`,
      });
    }
    if (missing.length > 0 || unknown.length > 0) return;

    const tuple = canonicalTuple(
      propertyNames,
      properties as Record<string, string>,
    );
    if (seen.has(tuple)) {
      refusals.push({
        code: "EXACT_TUPLE_DUPLICATE",
        message: `${label} row ${index} duplicates tuple ${tuple}.`,
        tuples: [tuple],
      });
      return;
    }
    seen.add(tuple);
    tuples.push(tuple);
  });

  return { tuples: tuples.sort(), refusals };
};

const orderedRefusals = (
  refusals: readonly ExactProjectionRefusal[],
): ExactProjectionRefusal[] =>
  [...refusals].sort(
    (a, b) =>
      (refusalOrder.get(a.code) ?? Number.MAX_SAFE_INTEGER) -
        (refusalOrder.get(b.code) ?? Number.MAX_SAFE_INTEGER) ||
      a.message.localeCompare(b.message),
  );

const refused = (
  refusals: readonly ExactProjectionRefusal[],
): RefusedExactProjection => {
  const ordered = orderedRefusals(refusals);
  return { status: "refused", code: ordered[0].code, refusals: ordered };
};

const rowsFrom = (
  projection: ExactProjectionRows,
): readonly ExactVariantRow[] =>
  Array.isArray(projection)
    ? projection
    : (projection as { variants: readonly ExactVariantRow[] }).variants;

/**
 * Proves that a structured component-set dump is a complete Cartesian matrix,
 * and optionally proves that returned projection rows preserve that tuple set.
 * A standalone COMPONENT is the zero-axis Cartesian product: exactly one row.
 * Legacy dumps are never inferred from variant names.
 */
export function validateExactVariantProjection(
  set: ExactDumpSet,
  returned?: ExactProjectionRows,
): ExactProjectionResult {
  const standalone = set.type === "COMPONENT";
  const definitionsPresent = own(set, "propertyDefinitions");
  const tupleEvidencePresent = set.variants.some(
    (row) => isRecord(row) && own(row, "variantProperties"),
  );

  // No per-row tuples means there is no structured matrix proof — including
  // REST/MCP fixtures that carried set-level propertyDefinitions before
  // dump v1.14 populated variantProperties. Exact mode still fails closed
  // on legacy-unverified; reviewable-inversion may fall back to names.
  // Never invent tuples from presentation names.
  if (!standalone && !tupleEvidencePresent) {
    return {
      status: "legacy-unverified",
      reason: "structured-exact-evidence-absent",
    };
  }

  let definitions: Record<string, ExactPropertyDefinition | unknown>;
  if (standalone && !definitionsPresent) {
    definitions = {};
  } else if (!isRecord(set.propertyDefinitions)) {
    return refused([
      {
        code: "EXACT_DEFINITIONS_MISSING",
        message:
          "Structured tuple evidence requires a propertyDefinitions record.",
      },
    ]);
  } else {
    definitions = set.propertyDefinitions;
  }

  const { axes, refusals: definitionRefusals } = readAxes(definitions);
  if (definitionRefusals.length > 0) return refused(definitionRefusals);
  const standaloneWithoutAxes = standalone && axes.length === 0;
  if (axes.length === 0 && !standaloneWithoutAxes) {
    return refused([
      {
        code: "EXACT_DEFINITIONS_MISSING",
        message: "propertyDefinitions contains no VARIANT definitions.",
      },
    ]);
  }

  const expectedTuples = cartesianTuples(axes);
  const expectedSet = new Set(expectedTuples);
  const source = checkRows(set.variants, axes, "source", standaloneWithoutAxes);
  if (source.refusals.length > 0) return refused(source.refusals);

  const sourceSet = new Set(source.tuples);
  const sourceMissing = expectedTuples.filter((tuple) => !sourceSet.has(tuple));
  const sourceExtra = source.tuples.filter((tuple) => !expectedSet.has(tuple));
  if (
    sourceMissing.length > 0 ||
    sourceExtra.length > 0 ||
    source.tuples.length !== expectedTuples.length
  ) {
    return refused([
      {
        code: "EXACT_MATRIX_RAGGED",
        message: `Source matrix has ${source.tuples.length} rows; Cartesian definitions require ${expectedTuples.length}.`,
        tuples: [...sourceMissing, ...sourceExtra].sort(),
        expected: expectedTuples.length,
        actual: source.tuples.length,
      },
    ]);
  }

  if (returned !== undefined) {
    const returnedRows = rowsFrom(returned);
    const checked = checkRows(
      returnedRows,
      axes,
      "returned",
      standaloneWithoutAxes,
    );
    const returnedSet = new Set(checked.tuples);
    const missing = source.tuples.filter((tuple) => !returnedSet.has(tuple));
    const extra = checked.tuples.filter((tuple) => !sourceSet.has(tuple));
    const roundTripRefusals: ExactProjectionRefusal[] = [...checked.refusals];
    if (missing.length > 0) {
      roundTripRefusals.push({
        code: "EXACT_ROWS_MISSING",
        message: `Returned projection is missing ${missing.length} source tuple(s).`,
        tuples: missing,
      });
    }
    if (extra.length > 0) {
      roundTripRefusals.push({
        code: "EXACT_ROWS_EXTRA",
        message: `Returned projection contains ${extra.length} tuple(s) absent from the source.`,
        tuples: extra,
      });
    }
    if (returnedRows.length !== source.tuples.length) {
      roundTripRefusals.push({
        code: "EXACT_PROJECTION_COUNT_MISMATCH",
        message: `Returned projection has ${returnedRows.length} rows; source has ${source.tuples.length}.`,
        expected: source.tuples.length,
        actual: returnedRows.length,
      });
    }
    if (roundTripRefusals.length > 0) return refused(roundTripRefusals);
  }

  return {
    status:
      returned === undefined ? "source-matrix-verified" : "verified-exact",
    propertyNames: axes.map((axis) => axis.name),
    expectedCount: expectedTuples.length,
    observedCount: source.tuples.length,
    tupleSetHash: tupleHash(source.tuples),
    tuples: source.tuples,
  };
}

export const validateExactProjection = validateExactVariantProjection;
