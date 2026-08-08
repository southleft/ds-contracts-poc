import * as z from 'zod';

export const PARITY_SNAPSHOT_VERSION = 1 as const;

const nonEmptyString = z.string().min(1);
const nullableString = z.string().min(1).nullable();
const stringLines = z.array(z.string());

const preferredValueSchema = z
  .object({
    type: nonEmptyString,
    key: nonEmptyString,
  })
  .passthrough();

const propertySchema = z
  .object({
    type: nonEmptyString,
    defaultValue: z.unknown(),
    variantOptions: z.array(z.string()).nullable(),
    preferredValues: z.array(preferredValueSchema).nullable().optional(),
  })
  .passthrough()
  .superRefine((property, ctx) => {
    if (!Object.prototype.hasOwnProperty.call(property, 'defaultValue')) {
      ctx.addIssue({
        code: 'custom',
        path: ['defaultValue'],
        message: 'property defaultValue must be present (null is allowed; omission is not)',
      });
    }
  });

const variantSchema = z
  .object({
    name: nonEmptyString,
    fingerprint: nullableString,
    snapshot: stringLines.nullable(),
    live: nullableString.optional(),
    liveSnapshot: stringLines.nullable().optional(),
    measurementError: nullableString.optional(),
  })
  .passthrough();

const currentVariantSchema = variantSchema.extend({
  live: nullableString,
  liveSnapshot: stringLines.nullable(),
  measurementError: nullableString,
});

const baseSetSchema = z
  .object({
    name: nonEmptyString,
    nodeId: nonEmptyString,
    key: z.string(),
    variantCount: z.number().int().nonnegative(),
    properties: z.record(z.string(), propertySchema),
    nestedInstances: z.array(z.string()).optional(),
    /** Native-slot transport (2026-08-08): SLOT property id → the content
     *  drawn inside that slot, with each instance child's component key. The
     *  differ compares it against the contract's `accepts` — Figma's
     *  preferredValues is a picker hint that refuses nothing, so an accepts
     *  violation can only be a FINDING. Optional: snapshots taken before the
     *  native-slot round carry none, and absence means NOT CAPTURED. */
    slotContent: z
      .record(
        z.string(),
        z.array(z.object({ variant: z.string(), name: z.string(), key: z.string().optional() }).passthrough()),
      )
      .optional(),
    variants: z.array(variantSchema).optional(),
    setFingerprint: nullableString.optional(),
    setSnapshot: stringLines.nullable().optional(),
    setLive: nullableString.optional(),
    setLiveSnapshot: stringLines.nullable().optional(),
    setMeasurementError: nullableString.optional(),
    contractId: nullableString.optional(),
  })
  .passthrough();

const setIntegrity = (
  set: { variantCount: number; variants?: Array<{ name: string }> },
  ctx: z.RefinementCtx,
): void => {
  if (!set.variants) return;
  if (set.variants.length !== set.variantCount) {
    ctx.addIssue({
      code: 'custom',
      path: ['variants'],
      message: `expected ${set.variantCount} variant row(s), received ${set.variants.length}`,
    });
  }
  const names = new Set(set.variants.map((variant) => variant.name));
  if (names.size !== set.variants.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['variants'],
      message: 'variant names must be unique within a set',
    });
  }
};

const legacySetSchema = baseSetSchema.superRefine(setIntegrity);

const currentSetSchema = baseSetSchema
  .extend({
    nestedInstances: z.array(z.string()),
    variants: z.array(currentVariantSchema),
    setFingerprint: nullableString,
    setSnapshot: stringLines.nullable(),
    setLive: nullableString,
    setLiveSnapshot: stringLines.nullable(),
    setMeasurementError: nullableString,
    contractId: nullableString,
  })
  .superRefine(setIntegrity);

const provenanceSchema = {
  fileName: nonEmptyString,
  fileKey: nullableString,
  extractedAt: z.number().int().nonnegative().finite(),
};

const legacyComponentsSchema = z
  .object({
    fileName: nonEmptyString.optional(),
    fileKey: nullableString.optional(),
    extractedAt: z.number().int().nonnegative().finite().optional(),
    sets: z.array(legacySetSchema),
  })
  .passthrough();

const currentComponentsSchema = z
  .object({
    snapshotVersion: z.literal(PARITY_SNAPSHOT_VERSION),
    ...provenanceSchema,
    sets: z.array(currentSetSchema),
  })
  .passthrough();

const tokenValueSchema = z.union([z.string(), z.number().finite(), z.boolean()]);

const legacyVariableSchema = z
  .object({
    name: nonEmptyString,
    type: z.enum(['BOOLEAN', 'COLOR', 'FLOAT', 'STRING']),
    scopes: z.array(z.string()).optional(),
    codeSyntax: z.string().nullable().optional(),
    values: z.record(z.string(), tokenValueSchema),
  })
  .passthrough();

const currentVariableSchema = legacyVariableSchema.extend({
  scopes: z.array(z.string()),
  codeSyntax: z.string().nullable(),
});

const collectionIntegrity = (
  collection: {
    modes?: string[];
    variables: Array<{ name: string; values: Record<string, string | number | boolean> }>;
  },
  ctx: z.RefinementCtx,
): void => {
  if (!collection.modes) return;
  const modes = new Set(collection.modes);
  if (modes.size !== collection.modes.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['modes'],
      message: 'mode names must be unique',
    });
  }
  const variableNames = new Set(collection.variables.map((variable) => variable.name));
  if (variableNames.size !== collection.variables.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['variables'],
      message: 'variable names must be unique within a collection',
    });
  }
  for (let variableIndex = 0; variableIndex < collection.variables.length; variableIndex += 1) {
    const variable = collection.variables[variableIndex];
    for (const mode of collection.modes) {
      if (!Object.prototype.hasOwnProperty.call(variable.values, mode)) {
        ctx.addIssue({
          code: 'custom',
          path: ['variables', variableIndex, 'values', mode],
          message: `missing value for declared mode "${mode}"`,
        });
      }
    }
    for (const mode of Object.keys(variable.values)) {
      if (!modes.has(mode)) {
        ctx.addIssue({
          code: 'custom',
          path: ['variables', variableIndex, 'values', mode],
          message: `value refers to undeclared mode "${mode}"`,
        });
      }
    }
    for (const [mode, value] of Object.entries(variable.values)) {
      if (typeof value === 'string' && (value.startsWith('{') || value.endsWith('}')) && !/^\{[^{}]+\}$/.test(value)) {
        ctx.addIssue({
          code: 'custom',
          path: ['variables', variableIndex, 'values', mode],
          message: 'variable aliases must use the complete "{variable/name}" form',
        });
      }
    }
  }
};

const legacyCollectionSchema = z
  .object({
    name: nonEmptyString,
    modes: z.array(nonEmptyString).optional(),
    variables: z.array(legacyVariableSchema),
  })
  .passthrough()
  .superRefine(collectionIntegrity);

const currentCollectionSchema = z
  .object({
    name: nonEmptyString,
    modes: z.array(nonEmptyString).min(1),
    variables: z.array(currentVariableSchema),
  })
  .passthrough()
  .superRefine(collectionIntegrity);

const legacyTokensSchema = z
  .object({
    fileName: nonEmptyString.optional(),
    fileKey: nullableString.optional(),
    extractedAt: z.number().int().nonnegative().finite().optional(),
    collections: z.array(legacyCollectionSchema),
  })
  .passthrough();

const currentTokensSchema = z
  .object({
    snapshotVersion: z.literal(PARITY_SNAPSHOT_VERSION),
    ...provenanceSchema,
    collections: z.array(currentCollectionSchema),
  })
  .passthrough();

export type FigmaComponentsSnapshot = z.infer<typeof legacyComponentsSchema> & {
  snapshotVersion: typeof PARITY_SNAPSHOT_VERSION;
};
export type FigmaTokensSnapshot = z.infer<typeof legacyTokensSchema> & {
  snapshotVersion: typeof PARITY_SNAPSHOT_VERSION;
};

export interface NormalizedSnapshot<T> {
  value: T;
  sourceVersion: 'legacy-unversioned' | typeof PARITY_SNAPSHOT_VERSION;
}

export class SnapshotInputError extends Error {
  readonly file: string;
  readonly fieldPath: string;

  constructor(file: string, fieldPath: string, detail: string) {
    super(`SNAPSHOT_INPUT_REFUSAL: ${file} at ${fieldPath}: ${detail}`);
    this.name = 'SnapshotInputError';
    this.file = file;
    this.fieldPath = fieldPath;
  }
}

const fieldPath = (path: PropertyKey[]): string =>
  path.reduce<string>(
    (out, segment) =>
      typeof segment === 'number'
        ? `${out}[${segment}]`
        : `${out}.${String(segment)}`,
    '$',
  );

const refusalFromZod = (file: string, error: z.ZodError): SnapshotInputError => {
  const issue = error.issues[0];
  return new SnapshotInputError(file, fieldPath(issue.path), issue.message);
};

function parseJson(text: string, file: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new SnapshotInputError(
      file,
      '$',
      `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function versionOf(input: unknown, file: string): number | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  if (!Object.prototype.hasOwnProperty.call(input, 'snapshotVersion')) return undefined;
  const version = (input as { snapshotVersion?: unknown }).snapshotVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    throw new SnapshotInputError(file, '$.snapshotVersion', 'expected an integer snapshot version');
  }
  if (version !== PARITY_SNAPSHOT_VERSION) {
    throw new SnapshotInputError(
      file,
      '$.snapshotVersion',
      version > PARITY_SNAPSHOT_VERSION
        ? `unsupported future snapshot version ${version}; this reader supports ${PARITY_SNAPSHOT_VERSION}`
        : `unsupported snapshot version ${version}; re-extract with the current parity/extract-figma.plugin.js`,
    );
  }
  return version;
}

function parseAndNormalize<TCurrent, TLegacy>(
  input: unknown,
  file: string,
  currentSchema: z.ZodType<TCurrent>,
  legacySchema: z.ZodType<TLegacy>,
): NormalizedSnapshot<TCurrent | (TLegacy & { snapshotVersion: typeof PARITY_SNAPSHOT_VERSION })> {
  const version = versionOf(input, file);
  if (version === PARITY_SNAPSHOT_VERSION) {
    const parsed = currentSchema.safeParse(input);
    if (!parsed.success) throw refusalFromZod(file, parsed.error);
    return { value: parsed.data, sourceVersion: PARITY_SNAPSHOT_VERSION };
  }
  const parsed = legacySchema.safeParse(input);
  if (!parsed.success) throw refusalFromZod(file, parsed.error);
  return {
    value: { ...parsed.data, snapshotVersion: PARITY_SNAPSHOT_VERSION },
    sourceVersion: 'legacy-unversioned',
  };
}

export function parseFigmaComponentsSnapshot(
  text: string,
  file = 'figma-components.json',
): NormalizedSnapshot<FigmaComponentsSnapshot> {
  return parseAndNormalize(
    parseJson(text, file),
    file,
    currentComponentsSchema,
    legacyComponentsSchema,
  ) as NormalizedSnapshot<FigmaComponentsSnapshot>;
}

export function parseFigmaTokensSnapshot(
  text: string,
  file = 'figma-tokens.json',
): NormalizedSnapshot<FigmaTokensSnapshot> {
  return parseAndNormalize(
    parseJson(text, file),
    file,
    currentTokensSchema,
    legacyTokensSchema,
  ) as NormalizedSnapshot<FigmaTokensSnapshot>;
}
