/**
 * SCHEMA 17 CODEMOD — the v16 → v17 contract-document migration.
 *
 * v16 carried four tool-specific fields outside the `bindings.<surface>`
 * namespace that props already used. v17 moves them (a pure rename — nothing
 * is loosened, nothing is tightened, no value changes):
 *
 *   figmaRepresentation        → bindings.figma.representation
 *   figmaStatePreviews         → bindings.figma.statePreviews
 *   anchors.figma              → bindings.figma.anchors
 *   anchors.code               → bindings.code.anchors
 *   <part>.slot.figmaProperty  → <part>.slot.bindings.figma.property
 *
 * This module is the ONE implementation of that rule. It operates on parsed
 * JSON (any value — a contract, a bundle that embeds contracts, a receipt
 * that embeds a proposal) and rewrites IN PLACE IN KEY ORDER: `bindings`
 * takes the position `anchors` held (or, when there is no `anchors`, the
 * position of the first legacy key), and a slot's `bindings` takes the
 * position `figmaProperty` held. Byte-stability of everything else is the
 * caller's job (the CLI `migrate` verb re-serialises with the file's own
 * indentation and refuses any file it cannot round-trip byte-for-byte).
 *
 * The schema REFUSES the old spellings by name (LEGACY_V16 in
 * contract-schema.ts) — it never migrates silently at parse time, because a
 * document that validates only after an unrecorded rewrite is a document
 * whose committed bytes lie.
 */

export interface MigrationResult {
  /** The migrated value (a new object graph; the input is not mutated). */
  doc: unknown;
  /** One line per rewrite, as `<json-path>: <old> → <new>`; empty iff the
   *  document carried no v16 spelling. */
  rewrites: string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** An `anchors` value in the v16 shape: `{ figma?: {...}, code?: {...} }`. */
const isLegacyAnchors = (v: unknown): v is Record<string, unknown> =>
  isRecord(v) && (isRecord(v.figma) || isRecord(v.code)) && Object.keys(v).every((k) => k === 'figma' || k === 'code');

/** The legacy keys are recognised by VALUE TYPE as well as by name, so a
 *  JSON Schema's `properties` bag (where `figmaRepresentation` is a schema
 *  descriptor object, not a string) is never mistaken for a contract — the
 *  emitted contract.schema.json carries the v16 names as refusal tombstones
 *  and must pass `migrate --check` untouched. */
const hasLegacyRepresentation = (o: Record<string, unknown>): boolean => typeof o.figmaRepresentation === 'string';
const hasLegacyStatePreviews = (o: Record<string, unknown>): boolean => typeof o.figmaStatePreviews === 'boolean';
const hasLegacyAnchors = (o: Record<string, unknown>): boolean => 'anchors' in o && isLegacyAnchors(o.anchors);
const hasLegacyContractKeys = (o: Record<string, unknown>): boolean =>
  hasLegacyRepresentation(o) || hasLegacyStatePreviews(o) || hasLegacyAnchors(o);

/** A slot object in the v16 shape: the value of a `slot` key, or any object
 *  carrying both `name` and a string `figmaProperty`. */
const isLegacySlot = (o: Record<string, unknown>, parentKey: string | null): boolean =>
  typeof o.figmaProperty === 'string' && (parentKey === 'slot' || typeof o.name === 'string');

function migrateContractLevel(o: Record<string, unknown>, at: string, rewrites: string[]): Record<string, unknown> {
  const figma: Record<string, unknown> = {};
  const code: Record<string, unknown> = {};
  if (hasLegacyRepresentation(o)) {
    figma.representation = o.figmaRepresentation;
    rewrites.push(`${at}figmaRepresentation → ${at}bindings.figma.representation`);
  }
  if (hasLegacyStatePreviews(o)) {
    figma.statePreviews = o.figmaStatePreviews;
    rewrites.push(`${at}figmaStatePreviews → ${at}bindings.figma.statePreviews`);
  }
  const anchors = hasLegacyAnchors(o) ? (o.anchors as Record<string, unknown>) : null;
  if (anchors) {
    if ('figma' in anchors) {
      figma.anchors = anchors.figma;
      rewrites.push(`${at}anchors.figma → ${at}bindings.figma.anchors`);
    }
    if ('code' in anchors) {
      code.anchors = anchors.code;
      rewrites.push(`${at}anchors.code → ${at}bindings.code.anchors`);
    }
  }
  // Merge over an existing `bindings` (a partially migrated document) —
  // the legacy spelling never overwrites a value already spelled the new way.
  const existing = isRecord(o.bindings) ? o.bindings : {};
  const existingFigma = isRecord(existing.figma) ? existing.figma : {};
  const existingCode = isRecord(existing.code) ? existing.code : {};
  const bindings: Record<string, unknown> = { ...existing };
  if (Object.keys(figma).length > 0 || 'figma' in existing) bindings.figma = { ...figma, ...existingFigma };
  if (Object.keys(code).length > 0 || 'code' in existing) bindings.code = { ...code, ...existingCode };

  const out: Record<string, unknown> = {};
  let placed = false;
  const place = () => {
    if (placed) return;
    out.bindings = bindings;
    placed = true;
  };
  for (const [k, v] of Object.entries(o)) {
    if (k === 'anchors' && anchors) {
      place();
      continue;
    }
    if ((k === 'figmaRepresentation' && hasLegacyRepresentation(o)) || (k === 'figmaStatePreviews' && hasLegacyStatePreviews(o))) {
      if (!anchors && !('bindings' in o)) place();
      continue;
    }
    if (k === 'bindings') {
      place();
      continue;
    }
    out[k] = v;
  }
  place();
  return out;
}

function migrateSlot(o: Record<string, unknown>, at: string, rewrites: string[]): Record<string, unknown> {
  const existing = isRecord(o.bindings) ? o.bindings : {};
  const existingFigma = isRecord(existing.figma) ? existing.figma : {};
  const bindings = { ...existing, figma: { property: o.figmaProperty, ...existingFigma } };
  rewrites.push(`${at}figmaProperty → ${at}bindings.figma.property`);
  const out: Record<string, unknown> = {};
  let placed = false;
  for (const [k, v] of Object.entries(o)) {
    if (k === 'figmaProperty' || k === 'bindings') {
      if (!placed) {
        out.bindings = bindings;
        placed = true;
      }
      continue;
    }
    out[k] = v;
  }
  return out;
}

function walk(v: unknown, at: string, parentKey: string | null, rewrites: string[]): unknown {
  if (Array.isArray(v)) return v.map((x, i) => walk(x, `${at}[${i}].`, null, rewrites));
  if (!isRecord(v)) return v;
  let o: Record<string, unknown> = v;
  if (hasLegacyContractKeys(o)) o = migrateContractLevel(o, at, rewrites);
  if (isLegacySlot(o, parentKey)) o = migrateSlot(o, at, rewrites);
  const out: Record<string, unknown> = {};
  for (const [k, child] of Object.entries(o)) out[k] = walk(child, `${at}${k}.`, k, rewrites);
  return out;
}

/** Migrate one parsed JSON document (or any JSON value embedding contract
 *  documents) from the v16 spellings to v17. Pure: returns a new graph. */
export function migrateDocumentToV17(doc: unknown): MigrationResult {
  const rewrites: string[] = [];
  const out = walk(doc, '', null, rewrites);
  return { doc: rewrites.length > 0 ? out : doc, rewrites };
}

/** Fast textual pre-check: can this JSON text carry a v16 spelling at all?
 *  A `false` lets a directory walk skip the parse. */
export const mayCarryV16Spelling = (text: string): boolean =>
  /"(figmaRepresentation|figmaStatePreviews|figmaProperty|anchors)"\s*:/.test(text);
