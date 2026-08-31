import { canonicalJson } from "./normalize.js";

export const FIGMA_PROPERTY_NORMALIZER_VERSION =
  "figma-property-normalizer-v1" as const;

export type CanonicalVariableType = "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";

export interface LocalVariableRecord {
  id: string;
  name: string;
  resolvedType: CanonicalVariableType;
  collectionId: string;
  collectionName: string;
  remote: false;
}

export interface CanonicalVariableIdentity {
  collectionName: string;
  name: string;
  resolvedType: CanonicalVariableType;
}

export interface CanonicalFigmaBinding {
  field: string;
  variable: CanonicalVariableIdentity;
}

export type CanonicalFigmaUnit =
  | { unit: "auto" }
  | { unit: "percent"; value: number }
  | { unit: "px"; value: number };

export const SERIALIZED_FIGMA_MIXED = Object.freeze({
  $figma: "MIXED",
} as const);

type Alias = { type: "VARIABLE_ALIAS"; id: string };
type RawBindings = Readonly<Record<string, unknown>>;

export interface FigmaBindingNormalizationInput {
  nodeBoundVariables?: RawBindings;
  fills?: readonly { boundVariables?: RawBindings }[];
  strokes?: readonly { boundVariables?: RawBindings }[];
  effects?: readonly { boundVariables?: RawBindings }[];
  variableTable: readonly LocalVariableRecord[];
}

const COLOR_FIELDS =
  /^(?:fills\.\d+\.color|strokes\.\d+\.paint\.color|effects\.\d+\.color)$/;
const FLOAT_FIELDS =
  /^(?:width\.value|height\.value|layout\.(?:itemSpacing|minWidth|minHeight|width\.value|height\.value|padding\.(?:top|right|bottom|left))|cornerRadius\.(?:topLeft|topRight|bottomRight|bottomLeft)|strokes\.\d+\.weight|effects\.\d+\.(?:radius|spread)|type\.(?:fontSize|lineHeight\.value|letterSpacing\.value))$/;
const STRING_FIELDS = /^(?:characters|type\.(?:fontFamily|fontStyle))$/;
const BOOLEAN_FIELDS = /^(?:clipsContent|visible)$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isMixed = (value: unknown): boolean =>
  isRecord(value) &&
  Object.keys(value).length === 1 &&
  value.$figma === "MIXED";

const alias = (value: unknown, path: string): Alias => {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(",") !== "id,type" ||
    value.type !== "VARIABLE_ALIAS" ||
    typeof value.id !== "string" ||
    value.id.length === 0
  ) {
    throw new TypeError(`${path}: unknown binding shape`);
  }
  return { type: "VARIABLE_ALIAS", id: value.id };
};

const variableIndex = (
  table: readonly LocalVariableRecord[],
): ReadonlyMap<string, LocalVariableRecord> => {
  const byId = new Map<string, LocalVariableRecord>();
  const identities = new Set<string>();
  const supportedTypes = new Set<CanonicalVariableType>([
    "COLOR",
    "FLOAT",
    "STRING",
    "BOOLEAN",
  ]);
  for (const variable of table) {
    if (
      variable.remote !== false ||
      !variable.id ||
      !variable.name ||
      !variable.collectionId ||
      !variable.collectionName ||
      !supportedTypes.has(variable.resolvedType)
    ) {
      throw new TypeError("variable table: incomplete or non-local variable");
    }
    if (byId.has(variable.id))
      throw new TypeError(`variable table: duplicate id ${variable.id}`);
    const identity = canonicalJson({
      collectionName: variable.collectionName,
      name: variable.name,
      resolvedType: variable.resolvedType,
    });
    if (identities.has(identity))
      throw new TypeError(`variable table: duplicate identity ${identity}`);
    identities.add(identity);
    byId.set(variable.id, variable);
  }
  return byId;
};

const expectedType = (field: string): CanonicalVariableType | undefined => {
  if (COLOR_FIELDS.test(field)) return "COLOR";
  if (FLOAT_FIELDS.test(field)) return "FLOAT";
  if (STRING_FIELDS.test(field)) return "STRING";
  if (BOOLEAN_FIELDS.test(field)) return "BOOLEAN";
  return undefined;
};

const canonicalNodeField = (field: string): string => {
  const indexed = field.match(/^(fills|strokes|effects)\.(\d+)$/);
  if (indexed) {
    const [, channel, index] = indexed;
    if (channel === "fills") return `fills.${index}.color`;
    if (channel === "strokes") return `strokes.${index}.paint.color`;
    return `effects.${index}.color`;
  }
  return (
    {
      paddingTop: "layout.padding.top",
      paddingRight: "layout.padding.right",
      paddingBottom: "layout.padding.bottom",
      paddingLeft: "layout.padding.left",
      itemSpacing: "layout.itemSpacing",
      minWidth: "layout.minWidth",
      minHeight: "layout.minHeight",
      topLeftRadius: "cornerRadius.topLeft",
      topRightRadius: "cornerRadius.topRight",
      bottomRightRadius: "cornerRadius.bottomRight",
      bottomLeftRadius: "cornerRadius.bottomLeft",
      strokeWeight: "strokes.0.weight",
      fontSize: "type.fontSize",
      lineHeight: "type.lineHeight.value",
      letterSpacing: "type.letterSpacing.value",
      width: "width.value",
      height: "height.value",
    } as Record<string, string>
  )[field] ?? field;
};

const canonicalArrayField = (field: string, index: number): string => {
  if (field === "fills") return `fills.${index}.color`;
  if (field === "strokes") return `strokes.${index}.paint.color`;
  if (field === "effects") return `effects.${index}.color`;
  if (field === "textRangeFills")
    throw new TypeError(
      "boundVariables.textRangeFills: partial mixed ranges are unsupported",
    );
  if (index !== 0)
    throw new TypeError(
      `boundVariables.${field}: partial mixed ranges are unsupported`,
    );
  return canonicalNodeField(field);
};

export function normalizeFigmaBindings(
  input: FigmaBindingNormalizationInput,
): CanonicalFigmaBinding[] {
  const variables = variableIndex(input.variableTable);
  const normalized = new Map<
    string,
    {
      binding: CanonicalFigmaBinding;
      aliasId: string;
      source: "node" | "paint";
    }
  >();

  const add = (
    field: string,
    rawAlias: unknown,
    path: string,
    source: "node" | "paint",
  ): void => {
    if (rawAlias === undefined || rawAlias === null) return;
    if (isMixed(rawAlias))
      throw new TypeError(`${path}: MIXED binding is unsupported`);
    const parsed = alias(rawAlias, path);
    const variable = variables.get(parsed.id);
    if (!variable) throw new TypeError(`${path}: stale variable id ${parsed.id}`);
    const compatible = expectedType(field);
    if (!compatible) throw new TypeError(`${path}: unsupported field ${field}`);
    if (variable.resolvedType !== compatible) {
      throw new TypeError(
        `${path}: ${field} requires ${compatible}, received ${variable.resolvedType}`,
      );
    }
    const existing = normalized.get(field);
    if (existing) {
      // Figma exposes a paint color binding both in node.boundVariables.fills[n]
      // and paint.boundVariables.color. That exact cross-surface mirror is one
      // binding; conflicting IDs or repeats on one surface are ambiguous.
      if (existing.aliasId === parsed.id && existing.source !== source) return;
      throw new TypeError(`${path}: duplicate alias for ${field}`);
    }
    normalized.set(field, {
      aliasId: parsed.id,
      source,
      binding: {
        field,
        variable: {
          collectionName: variable.collectionName,
          name: variable.name,
          resolvedType: variable.resolvedType,
        },
      },
    });
  };

  for (const [field, value] of Object.entries(
    input.nodeBoundVariables ?? {},
  ).sort(([left], [right]) => left.localeCompare(right))) {
    const path = `boundVariables.${field}`;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      if (Object.keys(value).length !== value.length)
        throw new TypeError(`${path}: sparse alias array`);
      value.forEach((entry, index) =>
        add(
          canonicalArrayField(field, index),
          entry,
          `${path}[${index}]`,
          "node",
        ),
      );
    } else {
      add(canonicalNodeField(field), value, path, "node");
    }
  }

  const addPaintBindings = (
    channel: "fills" | "strokes" | "effects",
    values: readonly { boundVariables?: RawBindings }[] | undefined,
  ): void => {
    values?.forEach((value, index) => {
      for (const [field, rawAlias] of Object.entries(
        value.boundVariables ?? {},
      )) {
        const canonical =
          channel === "strokes"
            ? `strokes.${index}.paint.${field}`
            : `${channel}.${index}.${field}`;
        add(
          canonical,
          rawAlias,
          `${channel}[${index}].boundVariables.${field}`,
          "paint",
        );
      }
    });
  };
  addPaintBindings("fills", input.fills);
  addPaintBindings("strokes", input.strokes);
  addPaintBindings("effects", input.effects);

  return [...normalized.values()].map(({ binding }) => binding).sort((left, right) =>
    (left.field + "\0" + canonicalJson(left.variable)).localeCompare(
      right.field + "\0" + canonicalJson(right.variable),
    ),
  );
}

export function normalizeFigmaUnit(
  field: string,
  value: unknown,
  options: {
    allowAuto: boolean;
    allowPercent: boolean;
    allowPixels: boolean;
  },
): CanonicalFigmaUnit | undefined {
  if (value === undefined || value === null) return undefined;
  if (isMixed(value)) throw new TypeError(`${field}: MIXED value unsupported`);
  if (!isRecord(value)) throw new TypeError(`${field}: expected unit object`);
  const keys = Object.keys(value).sort();
  if (typeof value.unit !== "string")
    throw new TypeError(`${field}: missing unit`);
  if (value.unit === "AUTO") {
    if (!options.allowAuto || keys.join(",") !== "unit")
      throw new TypeError(`${field}: invalid AUTO unit object`);
    return { unit: "auto" };
  }
  if (
    (value.unit !== "PIXELS" && value.unit !== "PERCENT") ||
    keys.join(",") !== "unit,value" ||
    typeof value.value !== "number" ||
    !Number.isFinite(value.value)
  ) {
    throw new TypeError(`${field}: unknown unit object`);
  }
  if (value.unit === "PIXELS") {
    if (!options.allowPixels)
      throw new TypeError(`${field}: PIXELS unit unsupported`);
    return { unit: "px", value: Object.is(value.value, -0) ? 0 : value.value };
  }
  if (!options.allowPercent)
    throw new TypeError(`${field}: PERCENT unit unsupported`);
  return { unit: "percent", value: Object.is(value.value, -0) ? 0 : value.value };
}
