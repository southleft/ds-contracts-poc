/** Pure, candidate-only native token planning and readback checks.
 *
 * The existing token-set compiler owns value conversion. This module neither
 * writes variables nor chooses a collection by name. A host must authenticate
 * the source inputs and obtain expected native IDs independently of readback.
 */
import { canonicalJson, revisionOf } from "./contract-provenance.js";
import { compileTokenSetRows, type TokenSetRow } from "./token-set.js";
import { aliasTarget, flattenTokens } from "./tokens.js";

type NativeType = "COLOR" | "FLOAT" | "STRING";
export type NativeTokenValue =
  | number
  | string
  | { r: number; g: number; b: number; a: number }
  | { type: "VARIABLE_ALIAS"; id: string };
type PlannedValue =
  | Exclude<NativeTokenValue, { type: "VARIABLE_ALIAS"; id: string }>
  | { type: "TOKEN_ALIAS"; targetPath: string; targetName: string };

export interface NativeTokenModeSelection {
  /** A host-derived native variant projection; never a source theme/brand. */
  planRevision: string;
  modeKey: string;
}

export interface NativeTokenContextInput {
  /** Explicit opt-in to create all planned native modes. Does not authorize
   * updates, inferred source modes, component bindings or application dispatch. */
  writeProtocol?: 'explicit-modes-v1';
  fileKey: string;
  /** Host-owned operation scope, never a library collection's display name. */
  scopeId: string;
  source: {
    revision: string;
    sourceProgramSha256: string;
    /** The hash of the token trees at ALLOCATION time, stamped into ownership
     * metadata. After a carried value update (`allocatedValues`) it still names
     * the allocation and no longer describes the current trees; each mode's
     * `tokenTreeRevision` does. */
    tokensSha256: string;
  };
  /** Exact requested paths. Alias dependencies are added, never same-value peers. */
  tokenPaths: string[];
  /** Only demonstrated source modes. A nativeSelection distinguishes physical
   * variant modes of the same source context without inventing source themes. */
  modes: {
    sourceMode: string;
    brand: string;
    nativeModeName: string;
    nativeSelection?: NativeTokenModeSelection;
    tokens: Record<string, unknown>;
    tokenTreeRevision: string;
  }[];
  /** Present only after a verified value update. The trees carry the CURRENT
   * values; these are the raw `$value`s the same leaves held when the collection
   * was allocated. Ownership stamps on the collection and on every owned node
   * name the allocation revision, so it is re-derived by restoring these leaves,
   * never taken from a caller. A requested `number` leaf may differ. Pixel
   * dimensions require the explicit protocol below. Template history also
   * carries fontWeight and color leaves. Neither side may become an alias. */
  allocatedValues?: {
    sourceMode: string;
    brand: string;
    tokenPath: string;
    value: unknown;
  }[];
  /** Value-history support only, not write authority. Absent on historical
   * inputs. A new bounded geometry writer must separately prove consumers. */
  allocatedValueProtocol?: "px-dimension-v1" | "template-values-v1";
  /** Original allocation input for a verified additive allocation. This is
   * evidence, not permission to discover or create IDs. It has no history of
   * its own; restoring later values must reproduce this base plus number leaves. */
  allocationBase?: NativeTokenContextInput;
}
export interface NativeTokenPreparation {
  writeProtocol?: 'explicit-modes-v1';
  version: 1;
  status: "prepared-candidate";
  acceptedContract: null;
  nativeQualification: "unqualified";
  /** Recorded Plugin API colors use IEEE-754 float32 channels. Numeric/string
   * variables and alias IDs have no inferred precision allowance. */
  valueComparison: "exact-or-float32-color-v1";
  fileKey: string;
  scopeId: string;
  collectionName: string;
  source: NativeTokenContextInput["source"];
  requestedTokenPaths: string[];
  dependencyTokenPaths: string[];
  modes: {
    sourceMode: string;
    brand: string;
    nativeModeName: string;
    nativeSelection?: NativeTokenModeSelection;
    tokenTreeRevision: string;
    /** The shared compiler's rows, with alias dependencies ordered first. */
    rows: TokenSetRow[];
  }[];
  variables: {
    tokenPath: string;
    name: string;
    resolvedType: NativeType;
    values: { sourceMode: string; brand: string; nativeSelection?: NativeTokenModeSelection; value: PlannedValue }[];
  }[];
  /** The ALLOCATION revision: what ownership metadata was stamped with. With
   * `allocatedValues` it is NOT a hash of this body's current values: two value
   * states of one allocation share it. Compare values, never this, for content. */
  revision: string;
}

/** IDs come from a host-pinned prior identity or the actual create calls, not
 * from searching readback by a variable/collection name. Newly allocated IDs
 * must be retained before independent readback is requested. */
export interface NativeTokenIdentity {
  origin: "created" | "existing";
  preparationRevision: string;
  fileKey: string;
  collection: { id: string; key: string; name: string };
  modes: { sourceMode: string; brand: string; modeId: string; name: string; nativeSelection?: NativeTokenModeSelection }[];
  variables: { tokenPath: string; id: string; key: string }[];
  /** Independently verified, append-only collection allocation ledger. */
  extensions?: NativeTokenExtensionIdentity[];
}
export interface NativeTokenExtensionIdentity {
  revision: string;
  variables: { tokenPath: string; id: string; key: string }[];
}
export interface NativeTokenContextReceipt {
  fileKey: string;
  collection: {
    id: string;
    key: string;
    name: string;
    remote: boolean;
    /** Read from this exact collection's ownership metadata by the host. */
    ownership: {
      scopeId: string;
      preparationRevision: string;
      source: NativeTokenContextInput["source"];
    };
    defaultModeId: string;
    modes: { modeId: string; name: string }[];
    extensions?: NativeTokenExtensionIdentity[];
  };
  variables: {
    id: string;
    key: string;
    name: string;
    variableCollectionId: string;
    resolvedType: string;
    remote: boolean;
    valuesByMode: Record<string, NativeTokenValue>;
  }[];
}
export interface NativeTokenContextVerification {
  version: 1;
  status: "native-token-context-observed" | "refused";
  acceptedContract: null;
  nativeQualification: "unqualified";
  preparationRevision?: string;
  identity?: NativeTokenIdentity;
  problems: string[];
}

const pathPattern = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/;
const hashPattern = /^[0-9a-f]{64}$/;
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function fail(code: string): never {
  throw new Error(`native-token-context-${code}`);
}
function nonempty(value: unknown): value is string {
  return (
    typeof value === "string" && value.trim() === value && value.length > 0
  );
}
function unique(values: string[], code: string): void {
  if (
    values.some((v) => !nonempty(v)) ||
    new Set(values).size !== values.length
  )
    fail(code);
}
function assertTree(tree: unknown): asserts tree is Record<string, unknown> {
  if (!tree || typeof tree !== "object" || Array.isArray(tree))
    fail("tree-shape");
  // flattenTokens deliberately normalizes dot paths. Refuse an ambiguous tree
  // with both a flat `a.b` and a nested `a/b`, before that normalization loses it.
  const paths = new Set<string>();
  const walk = (node: Record<string, unknown>, prefix: string[]) => {
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("$")) continue;
      if (!pathPattern.test(key)) fail("token-path");
      if (!value || typeof value !== "object" || Array.isArray(value))
        fail("tree-shape");
      const next = [...prefix, key],
        entry = value as Record<string, unknown>;
      if (Object.hasOwn(entry, "$value")) {
        const path = next.join(".");
        if (paths.has(path)) fail("token-path-ambiguous");
        paths.add(path);
      } else walk(entry, next);
    }
  };
  walk(tree as Record<string, unknown>, []);
}
function checkCompiledValue(value: unknown, type: NativeType): void {
  if (type === "FLOAT" && typeof value === "number" && Number.isFinite(value))
    return;
  if (type === "STRING" && typeof value === "string") return;
  if (
    type === "COLOR" &&
    value &&
    typeof value === "object" &&
    same(Object.keys(value).sort(), ["a", "b", "g", "r"]) &&
    Object.values(value).every(
      (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1,
    )
  )
    return;
  fail("compiled-value-unsupported");
}

/** Deterministic candidate collection label. The name is a collision warning,
 * never permission to adopt a collection; only exact IDs plus ownership qualify. */
export function nativeTokenCollectionName(scopeId: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(scopeId)) fail("scope-id");
  return `DS candidate tokens / ${scopeId}`;
}

/** Compile a finite selection without creating an additional token writer.
 * Throws a stable named refusal for unsupported/ambiguous input. All source
 * trees are pinned in full even when only a subset is needed by this candidate. */
export function prepareNativeTokenContext(
  input: NativeTokenContextInput,
): NativeTokenPreparation {
  if (input?.writeProtocol !== undefined && input.writeProtocol !== 'explicit-modes-v1') fail('write-protocol');
  if (input?.writeProtocol !== undefined && input.allocatedValues !== undefined) fail('explicit-modes-value-update-unqualified');
  if (input?.allocatedValueProtocol !== undefined && !["px-dimension-v1", "template-values-v1"].includes(input.allocatedValueProtocol))
    fail("allocated-value-protocol");
  if (input?.allocatedValueProtocol !== undefined && input.allocatedValues === undefined)
    fail("allocated-value-protocol-empty");
  const body = prepareBody(input);
  if (input.allocatedValues === undefined) {
    const revision = input.allocationBase === undefined ? revisionOf(body) :
      verifyAllocationExtension(input, body);
    return clone({ ...body, revision });
  }
  // A value succession. Re-derive the allocation by restoring the recorded
  // leaves; everything except a non-alias scalar value must be identical.
  const allocation = prepareNativeTokenContext(restoreAllocatedValues(input));
  const shape = (p: Omit<NativeTokenPreparation, "revision">) => ({
    ...p,
    modes: p.modes.map((m) => ({ ...m, tokenTreeRevision: null, rows: null })),
    variables: p.variables.map((v) => ({
      ...v,
      values: v.values.map((row) =>
        row.value && typeof row.value === "object" && "type" in row.value
          ? row
          : { ...row, value: null },
      ),
    })),
  });
  const { revision: allocationRevision, ...allocationBody } = allocation;
  if (!same(shape(body), shape(allocationBody))) fail("allocated-value-structure");
  // Historical successions remain FLOAT-only. The explicit template protocol
  // may carry COLOR too; shape equality above retains each variable's type.
  for (const row of input.allocatedValues)
    for (const prepared of [body, allocationBody])
      if (!(input.allocatedValueProtocol === 'template-values-v1' ? ['FLOAT', 'COLOR'] : ['FLOAT'])
          .includes(prepared.variables.find((v) => v.tokenPath === row.tokenPath)?.resolvedType ?? ''))
        fail("allocated-value-type");
  return clone({ ...body, revision: allocationRevision });
}

/** The single writer of a token leaf's `$value`, addressed the way
 * flattenTokens names it. Exactly one leaf must answer to the path; a tree
 * that passed assertTree always has one, so anything else is refused here. */
export function setNativeTokenLeafValue(
  tree: Record<string, unknown>,
  tokenPath: string,
  value: unknown,
): void {
  let written = 0;
  const walk = (node: Record<string, unknown>, prefix: string[]) => {
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith("$") || !child || typeof child !== "object" || Array.isArray(child)) continue;
      const entry = child as Record<string, unknown>, next = [...prefix, key];
      if (Object.hasOwn(entry, "$value")) {
        if (next.join(".") === tokenPath) { entry.$value = value; written++; }
      } else walk(entry, next);
    }
  };
  walk(tree, []);
  if (written !== 1) fail("token-path-ambiguous");
}

function restoreAllocatedValues(
  input: NativeTokenContextInput,
): NativeTokenContextInput {
  const rows = input.allocatedValues;
  if (!Array.isArray(rows) || !rows.length) fail("allocated-value-invalid");
  const key = (r: { sourceMode: string; brand: string; tokenPath: string }) =>
    JSON.stringify([r.sourceMode, r.brand, r.tokenPath]);
  if (rows!.some((r) => !r || !nonempty(r.sourceMode) || !nonempty(r.brand) ||
      !nonempty(r.tokenPath) || !pathPattern.test(r.tokenPath) || r.value === undefined))
    fail("allocated-value-invalid");
  unique(rows!.map(key), "allocated-value-ambiguous");
  // One canonical order, so the same succession always has the same bytes.
  if (!same(rows!.map(key), rows!.map(key).sort())) fail("allocated-value-order");
  const restored = clone({ ...input, allocatedValues: undefined });
  delete restored.allocatedValues;
  delete restored.allocatedValueProtocol;
  let dimensionValues = 0;
  const templateValues = input.allocatedValueProtocol === 'template-values-v1';
  const requested = new Set(templateValues ? prepareBody(input).variables.map(v => v.tokenPath) : input.tokenPaths);
  const literalPixels = (value: unknown): boolean => typeof value === "string" &&
    /^-?(?:\d+(?:\.\d+)?|\.\d+)px$/.test(value) && Number.isFinite(Number(value.slice(0, -2)));
  for (const row of rows!) {
    const mode = restored.modes?.find(
      (m) => m.sourceMode === row.sourceMode && m.brand === row.brand,
    );
    if (!mode) fail("allocated-value-mode");
    assertTree(mode!.tokens);
    const current = flattenTokens(mode!.tokens).get(row.tokenPath);
    if (!current) fail("allocated-value-path");
    // Historical inputs remain number-only. A dimension succession is a new
    // explicit protocol, restricted to literal px on both sides: no relative
    // unit conversion, structured value, alias or inferred type.
    if (!requested.has(row.tokenPath)) fail("allocated-value-unrequested");
    if (templateValues && !['number', 'dimension', 'fontWeight', 'color'].includes(current!.type ?? ''))
      fail('allocated-value-type');
    if (current!.type !== "number" && !(templateValues && ['fontWeight', 'color'].includes(current!.type ?? ''))) {
      if (current!.type !== "dimension" || !["px-dimension-v1", "template-values-v1"].includes(input.allocatedValueProtocol ?? ''))
        fail("allocated-value-type");
      if (!literalPixels(current!.value) || !literalPixels(row.value)) fail("allocated-value-pixels");
      dimensionValues++;
    }
    if (aliasTarget(current!.value) !== null || aliasTarget(row.value) !== null)
      fail("allocated-value-alias");
    // A recorded value equal to the current one is not a succession.
    if (same(current!.value, row.value)) fail("allocated-value-redundant");
    setNativeTokenLeafValue(mode!.tokens, row.tokenPath, clone(row.value));
  }
  if (input.allocatedValueProtocol === 'px-dimension-v1' && !dimensionValues) fail("allocated-value-protocol-empty");
  for (const mode of restored.modes) mode.tokenTreeRevision = revisionOf(mode.tokens);
  return restored;
}

/** Preserve the allocation-time input even after value or allocation updates.
 * A caller still needs an independently verified native identity and receipt. */
export function nativeTokenAllocationBase(input: NativeTokenContextInput): NativeTokenContextInput {
  prepareNativeTokenContext(input);
  if (input.allocationBase) return clone(input.allocationBase);
  return input.allocatedValues ? restoreAllocatedValues(input) : clone(input);
}

function verifyAllocationExtension(input: NativeTokenContextInput,
  body: Omit<NativeTokenPreparation, 'revision'>): string {
  const base = input.allocationBase!;
  if (!base || base.allocationBase !== undefined || base.allocatedValues !== undefined ||
      base.allocatedValueProtocol !== undefined || base.writeProtocol !== undefined || input.writeProtocol !== undefined)
    fail('allocation-base-invalid');
  const original = prepareNativeTokenContext(base);
  const header = (i: NativeTokenContextInput) => ({fileKey:i.fileKey,scopeId:i.scopeId,source:i.source,
    modes:i.modes.map(({tokens: _tokens,tokenTreeRevision: _revision,...mode})=>mode)});
  if (!same(header(base),header(input))) fail('allocation-base-context');
  const added = input.tokenPaths.filter(p=>!base.tokenPaths.includes(p)).sort();
  if (!added.length || base.tokenPaths.some(p=>!input.tokenPaths.includes(p))) fail('allocation-base-paths');
  // Check the actual trees, including unrequested leaves and metadata. Flattening
  // alone would lose a changed group/type or accept a newly hidden sibling.
  const inspect = (old: Record<string,unknown> | undefined, current: Record<string,unknown>, prefix:string[]) => {
    if (old && Object.hasOwn(old,'$value')) {
      if (!same(old,current)) fail('allocation-base-leaf-changed');
      return;
    }
    if (!old && Object.hasOwn(current,'$value')) {
      if (!added.includes(prefix.join('.')) || Object.keys(current).some(k=>!['$type','$value'].includes(k)) ||
          (current.$type !== undefined && current.$type !== 'number')) fail('allocation-added-leaf');
      return;
    }
    for (const [key,value] of Object.entries(old ?? {})) {
      if (!Object.hasOwn(current,key)) fail('allocation-base-tree-changed');
      if (key.startsWith('$') && !same(value,current[key])) fail('allocation-base-tree-changed');
    }
    for (const [key,value] of Object.entries(current)) {
      if (key.startsWith('$')) {
        if (!old && !(key==='$type' && value==='number')) fail('allocation-added-metadata');
        if (old && !Object.hasOwn(old,key)) fail('allocation-base-tree-changed');
      } else {
        if (!value || typeof value!=='object' || Array.isArray(value)) fail('allocation-added-tree');
        inspect(old?.[key] as Record<string,unknown>|undefined,value as Record<string,unknown>,[...prefix,key]);
      }
    }
    if (!old && !Object.keys(current).some(k=>!k.startsWith('$'))) fail('allocation-added-empty');
  };
  input.modes.forEach((mode,i)=>inspect(base.modes[i].tokens,mode.tokens,[]));
  for (const path of added) {
    if (base.modes.some(m=>flattenTokens(m.tokens).has(path))) fail('allocation-added-existing-path');
    if (input.modes.some(m=>{
      const leaf=flattenTokens(m.tokens).get(path);
      return !leaf || leaf.type!=='number' || aliasTarget(leaf.value)!==null;
    })) fail('allocation-added-type');
    const variable=body.variables.find(v=>v.tokenPath===path);
    if (!variable || variable.resolvedType!=='FLOAT' || variable.values.some(v=>typeof v.value!=='number' || !Number.isFinite(v.value)))
      fail('allocation-added-type');
  }
  if (original.variables.some(v=>!same(v,body.variables.find(n=>n.tokenPath===v.tokenPath))) ||
      body.variables.length!==original.variables.length+added.length ||
      !same(original.dependencyTokenPaths,body.dependencyTokenPaths)) fail('allocation-base-variables');
  return original.revision;
}

/** Recover the original allocation input by rederiving and validating history.
 * This returns evidence only; no identity is discovered and no write is granted. */
export function restoreNativeTokenAllocationInput(input: NativeTokenContextInput): NativeTokenContextInput {
  prepareNativeTokenContext(input);
  return input.allocatedValues === undefined ? clone(input) : restoreAllocatedValues(input);
}

function prepareBody(
  input: NativeTokenContextInput,
): Omit<NativeTokenPreparation, "revision"> {
  if (!input || !nonempty(input.fileKey)) fail("file-key");
  const collectionName = nativeTokenCollectionName(input.scopeId);
  if (
    !input.source ||
    !nonempty(input.source.revision) ||
    !hashPattern.test(input.source.sourceProgramSha256) ||
    !hashPattern.test(input.source.tokensSha256)
  )
    fail("source-identity");
  if (
    !Array.isArray(input.tokenPaths) ||
    !input.tokenPaths.length ||
    input.tokenPaths.some((p) => !pathPattern.test(p))
  )
    fail("token-path");
  unique(input.tokenPaths, "token-path-ambiguous");
  if (!Array.isArray(input.modes) || !input.modes.length) fail("modes-missing");
  unique(
    input.modes.map((m) => m.nativeModeName),
    "mode-name-ambiguous",
  );
  const selections = input.modes.map(m => m.nativeSelection);
  if (selections.some(s => s !== undefined)) {
    if (input.writeProtocol !== 'explicit-modes-v1' || selections.some(s => !s ||
        Object.keys(s).sort().join('|') !== 'modeKey|planRevision' ||
        !/^sha256:[a-f0-9]{64}$/.test(s.planRevision) || !/^sha256:[a-f0-9]{64}$/.test(s.modeKey)) ||
        new Set(selections.map(s => s!.planRevision)).size !== 1 ||
        new Set(input.modes.map(m => JSON.stringify([m.sourceMode, m.brand]))).size !== 1)
      fail('native-mode-selection');
  }
  unique(
    input.modes.map((m) => JSON.stringify([m.sourceMode, m.brand, m.nativeSelection?.modeKey])),
    "source-mode-ambiguous",
  );
  const requestedTokenPaths = [...input.tokenPaths].sort();
  const selected = new Set(requestedTokenPaths);
  const tables = input.modes.map((mode) => {
    if (!nonempty(mode.sourceMode) || !nonempty(mode.brand))
      fail("source-mode");
    assertTree(mode.tokens);
    if (mode.tokenTreeRevision !== revisionOf(mode.tokens))
      fail("token-tree-revision");
    return flattenTokens(mode.tokens);
  });
  // Union the exact alias closure across the explicit modes. All resulting
  // variables must have evidence in every mode; no default-mode fallback.
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const table of tables)
      for (const path of selected) {
        const entry = table.get(path);
        if (!entry) fail("token-missing");
        const target = aliasTarget(entry.value);
        if (target !== null) {
          if (!pathPattern.test(target)) fail("alias-path");
          if (!selected.has(target)) {
            selected.add(target);
            expanded = true;
          }
        }
      }
  }
  const paths = [...selected].sort();
  const modes = input.modes.map((mode, index) => {
    const table = tables[index];
    const base: Record<string, unknown> = Object.create(null);
    const minted: Record<string, unknown> = Object.create(null);
    for (const path of paths) {
      const entry = table.get(path)!;
      if (!entry.type) fail("token-type-missing");
      const leaf = { $type: entry.type, $value: entry.value };
      if (aliasTarget(entry.value) !== null)
        minted[path.replaceAll(".", "/")] = leaf;
      else base[path] = leaf;
    }
    const compiled = compileTokenSetRows({
      name: collectionName,
      base,
      minted,
    });
    if (
      compiled.unparsedColors.length ||
      compiled.unparsedDimensions.length ||
      compiled.unsupportedValues.length ||
      compiled.orphanModes.length
    )
      fail("token-compilation-refused");
    unique(
      compiled.rows.map((row) => row.name),
      "variable-name-ambiguous",
    );
    const byName = new Map(compiled.rows.map((row) => [row.name, row]));
    const ordered: TokenSetRow[] = [],
      visited = new Set<string>(),
      active = new Set<string>();
    const visit = (path: string): void => {
      if (visited.has(path)) return;
      if (active.has(path)) fail("alias-cycle");
      active.add(path);
      const target = aliasTarget(table.get(path)!.value);
      if (target !== null) {
        if (table.get(path)!.type !== table.get(target)!.type)
          fail("alias-type-mismatch");
        visit(target);
      }
      const row = byName.get(path.replaceAll(".", "/"));
      if (!row) fail("token-compilation-missing");
      if (row.type !== "ALIAS") checkCompiledValue(row.light, row.type);
      ordered.push(row);
      active.delete(path);
      visited.add(path);
    };
    paths.forEach(visit);
    return {
      sourceMode: mode.sourceMode,
      brand: mode.brand,
      nativeModeName: mode.nativeModeName,
      ...(mode.nativeSelection ? { nativeSelection: clone(mode.nativeSelection) } : {}),
      tokenTreeRevision: mode.tokenTreeRevision,
      rows: ordered,
    };
  });
  // Every variable resolves against the same completed rows for each mode.
  // Build those indexes once per preparation; they never outlive this call.
  const rowsByMode = modes.map(mode => new Map(mode.rows.map(row => [row.name, row])));
  const variables = paths.map((tokenPath) => {
    const name = tokenPath.replaceAll(".", "/");
    let resolvedType: NativeType | undefined;
    const values = modes.map((mode, modeIndex) => {
      const byName = rowsByMode[modeIndex];
      const row = byName.get(name)!;
      let resolved = row;
      while (resolved.type === "ALIAS") resolved = byName.get(resolved.target)!;
      if (resolvedType && resolvedType !== resolved.type)
        fail("mode-type-mismatch");
      resolvedType = resolved.type;
      const value: PlannedValue =
        row.type === "ALIAS"
          ? {
              type: "TOKEN_ALIAS",
              targetPath: row.target.replaceAll("/", "."),
              targetName: row.target,
            }
          : row.light;
      return { sourceMode: mode.sourceMode, brand: mode.brand, ...(mode.nativeSelection ? { nativeSelection: clone(mode.nativeSelection) } : {}), value };
    });
    return { tokenPath, name, resolvedType: resolvedType!, values };
  });
  const body: Omit<NativeTokenPreparation, "revision"> = {
    version: 1,
    status: "prepared-candidate",
    acceptedContract: null,
    nativeQualification: "unqualified",
    valueComparison: "exact-or-float32-color-v1",
    ...(input.writeProtocol ? { writeProtocol: input.writeProtocol } : {}),
    fileKey: input.fileKey,
    scopeId: input.scopeId,
    collectionName,
    source: clone(input.source),
    requestedTokenPaths,
    dependencyTokenPaths: paths.filter(
      (path) => !requestedTokenPaths.includes(path),
    ),
    modes,
    variables,
  };
  return body;
}

/** Re-derive values, then compare exact ID/key/collection/mode and alias target
 * identity. Equal-valued aliases and name-only matches never authorize reuse.
 * This does not authorize writes or qualify the component/native projection. */
export function verifyNativeTokenContextReceipt(args: {
  input: NativeTokenContextInput;
  expectedIdentity: NativeTokenIdentity;
  receipt: NativeTokenContextReceipt;
}): NativeTokenContextVerification {
  const out: NativeTokenContextVerification = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    nativeQualification: "unqualified",
    problems: [],
  };
  try {
    const prep = prepareNativeTokenContext(args.input),
      expected = args.expectedIdentity,
      receipt = args.receipt;
    out.preparationRevision = prep.revision;
    if (
      !expected ||
      !["created", "existing"].includes(expected.origin) ||
      expected.preparationRevision !== prep.revision
    )
      fail("preparation-identity");
    if (expected.fileKey !== prep.fileKey || receipt.fileKey !== prep.fileKey)
      fail("file-identity");
    if (
      !expected.collection ||
      !nonempty(expected.collection.id) ||
      !nonempty(expected.collection.key) ||
      expected.collection.name !== prep.collectionName
    )
      fail("collection-identity");
    const collection = receipt.collection;
    if (
      !collection ||
      collection.remote !== false ||
      !same(
        { id: collection.id, key: collection.key, name: collection.name },
        expected.collection,
      )
    )
      fail("collection-identity");
    if (
      !same(collection.ownership, {
        scopeId: prep.scopeId,
        preparationRevision: prep.revision,
        source: prep.source,
      })
    )
      fail("collection-ownership");
    if (args.input.allocationBase) {
      if (!Array.isArray(expected.extensions) || !expected.extensions.length || !same(expected.extensions,collection.extensions))
        fail('allocation-ledger');
      const basePaths=new Set(prepareNativeTokenContext(args.input.allocationBase).variables.map(v=>v.tokenPath));
      const additions=expected.extensions.flatMap(e=>{
        if (!/^sha256:[0-9a-f]{64}$/.test(e.revision) || !Array.isArray(e.variables) || !e.variables.length)
          fail('allocation-ledger');
        return e.variables;
      });
      unique(expected.extensions.map(e=>e.revision),'allocation-ledger');
      unique(additions.map(v=>v.tokenPath),'allocation-ledger');
      if (!same([...additions].sort((a,b)=>a.tokenPath.localeCompare(b.tokenPath)),
        expected.variables.filter(v=>!basePaths.has(v.tokenPath)).sort((a,b)=>a.tokenPath.localeCompare(b.tokenPath)))) fail('allocation-ledger');
    } else if (expected.extensions!==undefined || collection.extensions!==undefined) fail('allocation-ledger-unexpected');
    if (
      !Array.isArray(expected.modes) ||
      expected.modes.length !== prep.modes.length ||
      !Array.isArray(collection.modes)
    )
      fail("mode-identity");
    unique(
      expected.modes.map((m) => m.modeId),
      "mode-identity",
    );
    for (let i = 0; i < prep.modes.length; i++) {
      const mode = prep.modes[i],
        native = expected.modes[i];
      if (
        native.sourceMode !== mode.sourceMode ||
        native.brand !== mode.brand ||
        native.name !== mode.nativeModeName || !same(native.nativeSelection ?? null, mode.nativeSelection ?? null)
      )
        fail("mode-mapping");
    }
    const sortedModes = (modes: { modeId: string; name: string }[]) =>
      [...modes].sort((a, b) => a.modeId.localeCompare(b.modeId));
    if (
      collection.defaultModeId !== expected.modes[0].modeId ||
      !same(
        sortedModes(collection.modes),
        sortedModes(
          expected.modes.map(({ modeId, name }) => ({ modeId, name })),
        ),
      )
    )
      fail("mode-identity");
    if (
      !Array.isArray(expected.variables) ||
      expected.variables.length !== prep.variables.length ||
      !Array.isArray(receipt.variables) ||
      receipt.variables.length !== prep.variables.length
    )
      fail("variable-identity");
    unique(
      expected.variables.map((v) => v.tokenPath),
      "variable-identity",
    );
    unique(
      expected.variables.map((v) => v.id),
      "variable-identity",
    );
    unique(
      expected.variables.map((v) => v.key),
      "variable-identity",
    );
    unique(
      receipt.variables.map((v) => v.id),
      "variable-identity",
    );
    unique(
      receipt.variables.map((v) => v.key),
      "variable-identity",
    );
    const identities = new Map(expected.variables.map((v) => [v.tokenPath, v]));
    const observed = new Map(receipt.variables.map((v) => [v.id, v]));
    for (const variable of prep.variables) {
      const identity = identities.get(variable.tokenPath),
        actual = identity && observed.get(identity.id);
      if (
        !identity ||
        !actual ||
        actual.key !== identity.key ||
        actual.name !== variable.name ||
        actual.variableCollectionId !== expected.collection.id ||
        actual.remote !== false ||
        actual.resolvedType !== variable.resolvedType
      )
        fail("variable-identity");
      const valuesByMode = Object.fromEntries(
        variable.values.map(({ value }, index) => {
          const nativeValue =
            value && typeof value === "object" && "type" in value
              ? {
                  type: "VARIABLE_ALIAS",
                  id: identities.get(value.targetPath)?.id,
                }
              : value;
          if (
            nativeValue &&
            typeof nativeValue === "object" &&
            "type" in nativeValue &&
            !nativeValue.id
          )
            fail("alias-identity");
          return [expected.modes[index].modeId, nativeValue];
        }),
      );
      if (
        !actual.valuesByMode ||
        !same(
          Object.keys(actual.valuesByMode).sort(),
          Object.keys(valuesByMode).sort(),
        )
      )
        fail("variable-value");
      for (const [modeId, expectedValue] of Object.entries(valuesByMode)) {
        const actualValue = actual.valuesByMode[modeId];
        if (same(actualValue, expectedValue)) continue;
        // The native readback fixture stores 67/255 as 0.26274511218070984.
        // Accept only that exact float32 representation of the compiled color,
        // not a numeric tolerance, rounded decimals, or an equal-valued alias.
        if (
          expectedValue &&
          typeof expectedValue === "object" &&
          "r" in expectedValue &&
          same(actualValue, {
            r: Math.fround(expectedValue.r),
            g: Math.fround(expectedValue.g),
            b: Math.fround(expectedValue.b),
            a: Math.fround(expectedValue.a),
          })
        )
          continue;
        // Number variables are float32 too: a planned 18.3906 was read back
        // from Figma as 18.390600204467773 (live, 2026-09-18). Every earlier
        // number was float32-exact (integers, 0.5). The same policy applies:
        // exactly that representation, never a tolerance.
        if (
          typeof expectedValue === "number" &&
          typeof actualValue === "number" &&
          actualValue === Math.fround(expectedValue)
        )
          continue;
        fail("variable-value");
      }
    }
    out.status = "native-token-context-observed";
    out.identity = clone(expected);
  } catch (error) {
    out.problems = [
      error instanceof Error &&
      /^native-token-context-[a-z-]+$/.test(error.message)
        ? error.message
        : "native-token-context-invalid-input",
    ];
  }
  return out;
}
