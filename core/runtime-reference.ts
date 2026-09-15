/**
 * Pure runtime-identity preservation before design adoption. The caller owns
 * the trusted canonical base and its journal revision; canvas metadata supplies
 * only an untrusted equality claim, never authority to fetch or execute a module.
 *
 * This does NOT qualify geometry, property mappings, supported design edits or
 * runtime behavior. Callers must prove those independently, then stamp adoption
 * provenance. No new artifact may be introduced through this boundary.
 */
import { ContractSchema, type Contract } from "../scripts/contract-schema.js";
import {
  assertContractProvenance,
  canonicalRevisionOf,
  revisionOf,
} from "./contract-provenance.js";

export interface CanvasRuntimeReferenceMarker {
  version: 1;
  artifactRevision: string;
  interfaceRevision: string;
  bindingRevision: string;
  baseRevision: string;
}

export interface PreserveRuntimeReferenceInput {
  /** Canonical, host-owned input, NOT a base supplied by the canvas. */
  base: Contract | null;
  /** From the same trusted host journal; null only when there is no base. */
  expectedBaseRevision: string | null;
  marker: unknown;
  proposed: Contract;
}

export type RuntimeReferenceRefusalCode =
  | "RUNTIME_REFERENCE_BASE_INVALID"
  | "RUNTIME_REFERENCE_JOURNAL_MISMATCH"
  | "RUNTIME_REFERENCE_PROPOSED_INVALID"
  | "RUNTIME_REFERENCE_CONTRACT_ID_MISMATCH"
  | "RUNTIME_REFERENCE_MARKER_REQUIRED"
  | "RUNTIME_REFERENCE_MARKER_UNEXPECTED"
  | "RUNTIME_REFERENCE_MARKER_INVALID"
  | "RUNTIME_REFERENCE_MARKER_MISMATCH"
  | "RUNTIME_REFERENCE_BINDING_CHANGED"
  | "RUNTIME_REFERENCE_BINDING_UNTRUSTED";

export class RuntimeReferenceError extends Error {
  constructor(
    readonly code: RuntimeReferenceRefusalCode,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = "RuntimeReferenceError";
  }
}

function refuse(code: RuntimeReferenceRefusalCode, detail: string): never {
  throw new RuntimeReferenceError(code, detail);
}

const REVISION = /^sha256:[0-9a-f]{64}$/;
const MARKER_KEYS = [
  "version",
  "artifactRevision",
  "interfaceRevision",
  "bindingRevision",
  "baseRevision",
] as const;

/** Exact data-only JSON shape. Even an accessor cannot run during inspection. */
function readMarker(raw: unknown): CanvasRuntimeReferenceMarker {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    refuse("RUNTIME_REFERENCE_MARKER_INVALID", "expected the version-1 marker");
  const proto = Object.getPrototypeOf(raw);
  if (proto !== Object.prototype && proto !== null)
    refuse(
      "RUNTIME_REFERENCE_MARKER_INVALID",
      "marker must be plain JSON data",
    );
  const keys = Reflect.ownKeys(raw);
  if (
    keys.length !== MARKER_KEYS.length ||
    keys.some(
      (key) => !MARKER_KEYS.includes(key as (typeof MARKER_KEYS)[number]),
    )
  )
    refuse(
      "RUNTIME_REFERENCE_MARKER_INVALID",
      "marker fields must match version 1 exactly",
    );
  const values: Record<string, unknown> = {};
  for (const key of MARKER_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable)
      refuse(
        "RUNTIME_REFERENCE_MARKER_INVALID",
        "marker fields must be plain JSON values",
      );
    values[key] = descriptor.value;
  }
  if (
    values.version !== 1 ||
    MARKER_KEYS.slice(1).some(
      (key) =>
        typeof values[key] !== "string" ||
        !REVISION.test(values[key] as string),
    )
  )
    refuse(
      "RUNTIME_REFERENCE_MARKER_INVALID",
      "unsupported version or malformed revision",
    );
  return values as unknown as CanvasRuntimeReferenceMarker;
}

/**
 * Returns a detached clone. For a retained-runtime base, incoming provenance is
 * removed: restoring code identity changes the proposal's canonical bytes, and
 * only the subsequent host adoption step may stamp their lineage.
 *
 * A runtime-less proposal remains runtime-less and otherwise keeps the existing
 * native-generation path. This guard does not authorize any returned proposal.
 */
export function preserveRuntimeReference(
  input: PreserveRuntimeReferenceInput,
): Contract {
  const baseResult =
    input.base === null ? null : ContractSchema.safeParse(input.base);
  if (baseResult && !baseResult.success)
    refuse(
      "RUNTIME_REFERENCE_BASE_INVALID",
      "canonical base does not satisfy the contract schema",
    );
  // Validate without silently accepting parser defaults as journalled bytes.
  const base = input.base;
  if (base) {
    try {
      assertContractProvenance(base);
    } catch {
      refuse(
        "RUNTIME_REFERENCE_BASE_INVALID",
        "canonical base provenance is inconsistent",
      );
    }
    if (
      typeof input.expectedBaseRevision !== "string" ||
      !REVISION.test(input.expectedBaseRevision) ||
      canonicalRevisionOf(base) !== input.expectedBaseRevision
    )
      refuse(
        "RUNTIME_REFERENCE_JOURNAL_MISMATCH",
        "base differs from the trusted journal revision",
      );
  } else if (input.expectedBaseRevision !== null) {
    refuse(
      "RUNTIME_REFERENCE_JOURNAL_MISMATCH",
      "a journal revision requires its canonical base",
    );
  }
  if (!ContractSchema.safeParse(input.proposed).success)
    refuse(
      "RUNTIME_REFERENCE_PROPOSED_INVALID",
      "proposal does not satisfy the contract schema",
    );
  if (base && input.proposed.id !== base.id)
    refuse(
      "RUNTIME_REFERENCE_CONTRACT_ID_MISMATCH",
      "proposal belongs to a different contract",
    );

  const runtime = base?.bindings.code.runtime;
  const proposedRuntime = input.proposed.bindings.code.runtime;
  const hasMarker = input.marker !== undefined && input.marker !== null;
  if (!runtime) {
    if (proposedRuntime !== undefined)
      refuse(
        "RUNTIME_REFERENCE_BINDING_UNTRUSTED",
        "canvas cannot introduce an original runtime binding",
      );
    if (hasMarker)
      refuse(
        "RUNTIME_REFERENCE_MARKER_UNEXPECTED",
        "canvas marker has no trusted runtime-bound base",
      );
    return structuredClone(input.proposed);
  }
  if (!hasMarker)
    refuse(
      "RUNTIME_REFERENCE_MARKER_REQUIRED",
      "runtime-bound canvas adoption requires its exact identity claim",
    );
  const marker = readMarker(input.marker);
  const expected: CanvasRuntimeReferenceMarker = {
    version: 1,
    artifactRevision: runtime.artifactRevision,
    interfaceRevision: runtime.interfaceRevision,
    bindingRevision: runtime.bindingRevision,
    baseRevision: input.expectedBaseRevision!,
  };
  if (revisionOf(marker) !== revisionOf(expected))
    refuse(
      "RUNTIME_REFERENCE_MARKER_MISMATCH",
      "canvas claim differs from the trusted runtime and base",
    );
  if (
    proposedRuntime !== undefined &&
    revisionOf(proposedRuntime) !== revisionOf(runtime)
  )
    refuse(
      "RUNTIME_REFERENCE_BINDING_CHANGED",
      "proposal attempts to replace the trusted runtime binding",
    );

  const result = structuredClone(input.proposed);
  result.bindings.code.runtime = structuredClone(runtime);
  result.bindings.code.anchors = structuredClone(base!.bindings.code.anchors);
  delete result.provenance;
  return result;
}
