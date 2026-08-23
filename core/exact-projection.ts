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
  /** The emitter's DECLARED sparse state-preview shape, stamped on the set and
   *  carried by the dump. Absent → the matrix is held to the full Cartesian.
   *  See StatePreviewAxisDescriptor. */
  statePreviewAxis?: unknown;
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

/** THE SPARSE STATE-PREVIEW AXIS — why a full Cartesian is the WRONG expectation
 *  for a set this repo's own emitter produced.
 *
 *  `bindings.figma.statePreviews` sets carry a `State` axis that is NOT a contract prop:
 *  it is a Figma-surface projection of the contract's `states`. The emitter
 *  (core/emit-figma-script.ts, the `stateVariants` loop) draws
 *
 *      Cartesian(real axes) × {State=Default}                       the base grid
 *    ∪ { primary=v, every other axis pinned to its FIRST value, State=s }
 *
 * — one preview row per state per PRIMARY-axis value, because a state override
 *  only ever substitutes one enum prop (statePreviewSubstProps is validated at
 *  ≤1). Badge draws 12 + 2×6 = 24 where the Cartesian is 6×2×3 = 36; Button
 *  draws 25 + 4×5 = 45 where the Cartesian is 125.
 *
 *  So the matrix is sparse BY CONSTRUCTION, and demanding a Cartesian made the
 *  emitter and the inverter disagree about sets the emitter itself had just
 *  drawn — Path A refused Badge and Button outright.
 *
 *  This does NOT relax EXACT_MATRIX_RAGGED. The expectation becomes DECLARED
 *  rather than assumed: the emitter stamps the descriptor below onto the set,
 *  the dump carries it, and the matrix must still equal the derived set
 *  EXACTLY — no missing row, no extra row. A set with no descriptor is still
 *  held to the full Cartesian, and a descriptor that does not agree with the
 *  axes it names is IGNORED (falling back to the Cartesian, which then refuses)
 *  rather than trusted — a marker must never be able to invent a matrix. */
export interface StatePreviewAxisDescriptor {
  /** Figma property name of the preview axis (always "State" today). */
  axis: string;
  /** The value every base-grid row carries ("Default"). */
  default: string;
  /** The non-default preview values, i.e. the contract's states. */
  states: readonly string[];
  /** Figma property name of the axis preview rows multiply, or null when the
   *  state overrides are variant-independent and previews attach to one cell. */
  primary: string | null;
  /** Every OTHER real axis, pinned to the value the emitter held it at. This
   *  is carried explicitly and never re-derived: the emitter pins each axis to
   *  its CONTRACT-DECLARED first value, while readAxes sorts options
   *  alphabetically, so `options[0]` is a different value in general (Badge's
   *  Size declares [Xs, Sm] and sorts to [Sm, Xs]). Guessing it here would
   *  silently expect the wrong 12 rows. */
  pinned: Readonly<Record<string, string>>;
}

const readStatePreviewAxis = (
  value: unknown,
): StatePreviewAxisDescriptor | null => {
  if (!isRecord(value)) return null;
  const axis = value.axis;
  const dflt = value.default;
  const states = value.states;
  const primary = value.primary ?? null;
  if (typeof axis !== "string" || axis.length === 0) return null;
  if (typeof dflt !== "string" || dflt.length === 0) return null;
  if (!Array.isArray(states) || states.length === 0) return null;
  if (!states.every((s) => typeof s === "string" && s.length > 0)) return null;
  if (primary !== null && typeof primary !== "string") return null;
  const pinned = value.pinned ?? {};
  if (!isRecord(pinned)) return null;
  if (!Object.values(pinned).every((v) => typeof v === "string")) return null;
  return {
    axis,
    default: dflt,
    states: states as readonly string[],
    primary: primary as string | null,
    pinned: pinned as Record<string, string>,
  };
};

/** Expected tuples for a DECLARED sparse state-preview matrix, or null when the
 *  descriptor does not agree with the axes actually present (ignored, never
 *  trusted). */
const statePreviewTuples = (
  axes: readonly Axis[],
  d: StatePreviewAxisDescriptor,
): string[] | null => {
  const names = axes.map((a) => a.name);
  const stateAxis = axes.find((a) => a.name === d.axis);
  if (!stateAxis) return null;
  const rest = axes.filter((a) => a.name !== d.axis);
  // Every value the descriptor names must really be an option on that axis,
  // and the axis must carry exactly default + the declared states.
  const declared = [d.default, ...d.states];
  if (stateAxis.options.length !== declared.length) return null;
  if (!declared.every((v) => stateAxis.options.includes(v))) return null;
  if (new Set(declared).size !== declared.length) return null;
  const primaryAxis =
    d.primary === null ? null : rest.find((a) => a.name === d.primary);
  if (d.primary !== null && !primaryAxis) return null;
  // `pinned` must name EXACTLY the non-primary real axes, each at a value that
  // axis really offers. Anything else and the descriptor does not describe this
  // set — ignore it rather than expect a matrix nobody drew.
  const pinnable = rest
    .filter((a) => !primaryAxis || a.name !== primaryAxis.name)
    .map((a) => a.name)
    .sort();
  const pinnedKeys = Object.keys(d.pinned).sort();
  if (pinnedKeys.length !== pinnable.length) return null;
  if (!pinnedKeys.every((k, i) => k === pinnable[i])) return null;
  for (const [name, value] of Object.entries(d.pinned)) {
    const axis = rest.find((a) => a.name === name);
    if (!axis || !axis.options.includes(value)) return null;
  }

  const out: string[] = [];
  // 1. the base grid — the full Cartesian of the real axes at State=default
  let base: Record<string, string>[] = [{}];
  for (const axis of rest) {
    base = base.flatMap((row) =>
      axis.options.map((option) => ({ ...row, [axis.name]: option })),
    );
  }
  for (const row of base) {
    out.push(canonicalTuple(names, { ...row, [d.axis]: d.default }));
  }
  // 2. the preview rows — primary varies, every other real axis pinned FIRST
  const primaryValues = primaryAxis ? primaryAxis.options : [null];
  for (const state of d.states) {
    for (const value of primaryValues) {
      const row: Record<string, string> = { [d.axis]: state };
      for (const axis of rest) {
        row[axis.name] =
          primaryAxis && axis.name === primaryAxis.name
            ? (value as string)
            : d.pinned[axis.name]!;
      }
      out.push(canonicalTuple(names, row));
    }
  }
  // A descriptor that produces duplicate rows is self-contradictory: ignore it.
  if (new Set(out).size !== out.length) return null;
  return out.sort();
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

  // A DECLARED sparse matrix (bindings.figma.statePreviews) is validated against the
  // shape the emitter says it drew; everything else against the full Cartesian.
  // An unreadable or disagreeing descriptor falls through to the Cartesian —
  // fail-closed, so a marker can never widen what counts as exact.
  const declaredSparse = readStatePreviewAxis(set.statePreviewAxis);
  const expectedTuples =
    (declaredSparse && statePreviewTuples(axes, declaredSparse)) ??
    cartesianTuples(axes);
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
