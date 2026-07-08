/**
 * Client-side consequence engine for the Code Editor Simulator.
 *
 * Everything here is DETERMINISTIC and derived from the same rules the real
 * pipeline uses:
 *   - validation: the actual Zod ContractSchema from scripts/contract-schema.ts
 *     (imported, not copied — refusals carry the schema's own names)
 *   - variant naming + ordering: mirrors compileComponentData in
 *     scripts/generate-figma.ts (enum props in declaration order, each axis's
 *     default value first, cartesian product with axis 0 slowest, so the
 *     first combo is the all-defaults variant)
 *   - amend plan: mirrors amendSet's match-by-name semantics (expected vs
 *     existing → ADDED / REBUILT / EXTRA-reported, plus added properties and
 *     edited defaults; destructive changes are reported, never deleted)
 *   - version advice: docs/02-contract-spec.md versioning policy (added
 *     optional prop = minor; removed/renamed prop or value = major)
 *
 * DIVERGENCE (honest): amendSet reconciles against the LIVE Figma set's
 * children; here the "existing" side is the variant set the ORIGINAL contract
 * compiles to — i.e. the plan assumes the canvas is currently in parity.
 */
import {
  ContractSchema,
  slotsOf,
  slotFigmaProperty,
  slotVisibilityProperty,
  type Contract,
  type Prop,
} from '../../../scripts/contract-schema';

export { ContractSchema };
export type { Contract, Prop };

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface RefusalIssue {
  /** Dot path into the contract document, e.g. "props.0.bindings.figma.kind". */
  path: string;
  /** The schema's own message — refusal by name, verbatim. */
  message: string;
}

export type ParseOutcome =
  | { kind: 'syntax'; message: string }
  | { kind: 'refused'; issues: RefusalIssue[] }
  | { kind: 'valid'; contract: Contract };

/** Parse editor text → JSON → ContractSchema. Never throws. */
export function parseContract(text: string): ParseOutcome {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return { kind: 'syntax', message: error instanceof Error ? error.message : 'invalid JSON' };
  }
  const result = ContractSchema.safeParse(json);
  if (!result.success) {
    return {
      kind: 'refused',
      issues: result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || '(root)',
        message: issue.message,
      })),
    };
  }
  return { kind: 'valid', contract: result.data };
}

// ---------------------------------------------------------------------------
// API diff (props added / removed / retyped, enum values, defaults)
// ---------------------------------------------------------------------------

export type Severity = 'major' | 'minor' | 'patch';

export interface ApiChange {
  severity: Severity;
  /** Canonical prop name (or section name for non-prop changes). */
  subject: string;
  detail: string;
}

const isEnum = (p: Prop): p is Prop & { type: { enum: string[] } } =>
  typeof p.type === 'object' && 'enum' in p.type;

const isArrayOf = (p: Prop): boolean => typeof p.type === 'object' && 'arrayOf' in p.type;

function typeLabel(p: Prop): string {
  if (isEnum(p)) return `enum(${p.type.enum.join(' | ')})`;
  if (isArrayOf(p)) {
    const fields = Object.entries((p.type as { arrayOf: Record<string, string> }).arrayOf);
    return `arrayOf({ ${fields.map(([k, v]) => `${k}: ${v}`).join('; ')} })`;
  }
  return String(p.type);
}

/** Type identity ignoring enum membership (member changes diff separately). */
function typeKind(p: Prop): string {
  if (isEnum(p)) return 'enum';
  if (isArrayOf(p)) return typeLabel(p); // field changes ARE a retype
  return String(p.type);
}

const show = (v: unknown): string => (typeof v === 'string' ? `"${v}"` : String(v));

export function diffApi(original: Contract, edited: Contract): ApiChange[] {
  const changes: ApiChange[] = [];
  const before = new Map(original.props.map((p) => [p.name, p]));
  const after = new Map(edited.props.map((p) => [p.name, p]));

  for (const [name, p] of after) {
    if (!before.has(name)) {
      const requiredNoDefault = p.required === true && p.default === undefined;
      changes.push({
        severity: requiredNoDefault ? 'major' : 'minor',
        subject: name,
        detail: `prop added — ${typeLabel(p)}${
          requiredNoDefault
            ? ' (required, no default: every existing consumer breaks)'
            : p.default !== undefined
              ? ` (default ${show(p.default)})`
              : ' (optional)'
        }`,
      });
    }
  }
  for (const [name, p] of before) {
    if (!after.has(name)) {
      changes.push({ severity: 'major', subject: name, detail: `prop removed — was ${typeLabel(p)}` });
    }
  }
  for (const [name, prev] of before) {
    const next = after.get(name);
    if (!next) continue;

    if (typeKind(prev) !== typeKind(next)) {
      changes.push({
        severity: 'major',
        subject: name,
        detail: `prop retyped — ${typeLabel(prev)} → ${typeLabel(next)}`,
      });
    } else if (isEnum(prev) && isEnum(next)) {
      for (const v of next.type.enum) {
        if (!prev.type.enum.includes(v)) {
          changes.push({ severity: 'minor', subject: name, detail: `enum value added — "${v}"` });
        }
      }
      for (const v of prev.type.enum) {
        if (!next.type.enum.includes(v)) {
          changes.push({ severity: 'major', subject: name, detail: `enum value removed — "${v}"` });
        }
      }
    }

    if (prev.default !== next.default) {
      changes.push({
        severity: 'patch',
        subject: name,
        detail: `default changed — ${show(prev.default)} → ${show(next.default)} (both surfaces re-render their resting state)`,
      });
    }
    if ((prev.required === true) !== (next.required === true)) {
      changes.push({
        severity: next.required === true ? 'major' : 'minor',
        subject: name,
        detail: next.required === true ? 'became required — existing call sites break' : 'became optional',
      });
    }
    if (prev.bindings.code.prop !== next.bindings.code.prop) {
      changes.push({
        severity: 'major',
        subject: name,
        detail: `code binding renamed — ${prev.bindings.code.prop} → ${next.bindings.code.prop}`,
      });
    }
  }

  // Non-prop governed sections: any change bumps version (policy), reported
  // at patch level here since the API surface is unchanged.
  const sections: Array<[string, unknown, unknown]> = [
    ['states', original.states, edited.states],
    ['anatomy', original.anatomy, edited.anatomy],
    ['a11y', original.a11y, edited.a11y],
    ['semantics', original.semantics, edited.semantics],
  ];
  for (const [section, prev, next] of sections) {
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      changes.push({
        severity: 'patch',
        subject: section,
        detail: `${section} changed — both surfaces regenerate from the new tree`,
      });
    }
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Canvas amend plan — mirrors amendSet's match-variants-by-name semantics
// ---------------------------------------------------------------------------

/** Safety cap on the enumerated cartesian product (the editor is live). */
const COMBO_CAP = 2048;

export interface VariantSetShape {
  /** Ordered variant names; index 0 is the all-defaults combo. */
  names: string[];
  isSet: boolean;
  capped: boolean;
}

/**
 * The variant set a contract compiles to. Mirrors compileComponentData in
 * scripts/generate-figma.ts: every enum prop is an axis in declaration
 * order, each axis's default value first, cartesian product enumerated with
 * axis 0 slowest — so names[0] is the all-defaults combo (Figma's default
 * variant is positional).
 */
export function variantSetOf(contract: Contract): VariantSetShape {
  const axes = contract.props.filter(isEnum).map((p) => {
    const values = [...p.type.enum];
    const i = p.default !== undefined ? values.indexOf(String(p.default)) : -1;
    if (i > 0) {
      values.splice(i, 1);
      values.unshift(String(p.default));
    }
    return { prop: p, values };
  });

  let combos: string[][] = [[]];
  let capped = false;
  for (const axis of axes) {
    const next: string[][] = [];
    for (const combo of combos) {
      for (const value of axis.values) {
        next.push([
          ...combo,
          `${axis.prop.bindings.figma.property}=${axis.prop.bindings.figma.values?.[value] ?? value}`,
        ]);
        if (next.length > COMBO_CAP) {
          capped = true;
          break;
        }
      }
      if (capped) break;
    }
    combos = next;
    if (capped) break;
  }
  const names = combos.map((parts) => parts.join(', ') || contract.name);
  return { names, isSet: names.length > 1, capped };
}

export interface AmendPlan {
  kind: 'native' | 'standalone' | 'unchanged' | 'amend';
  note?: string;
  /** Expected variants not on the existing set → created and appended. */
  addedVariants: string[];
  /** Name-matched variants → interiors rebuilt from spec, identity kept. */
  rebuiltVariants: string[];
  /** Existing variants no expected combo names → REPORTED, never deleted. */
  extraVariants: string[];
  /** BOOLEAN/TEXT component properties added to the set. */
  addedProps: string[];
  /** Same-name properties whose default value is edited in place. */
  editedDefaults: string[];
  /** Props with figma kind NONE — every design-side consumer skips them. */
  skippedProps: string[];
  /** Removed BOOLEAN/TEXT properties — amend never deletes; humans retire. */
  strandedProps: string[];
  /** The all-defaults combo (moved to position 0 = Figma's default). */
  defaultVariant: string;
  totalExpected: number;
  capped: boolean;
}

/**
 * Figma component properties a contract declares: BOOLEAN/TEXT value props,
 * plus slot INSTANCE_SWAP properties (single-child slots only — >1
 * defaultContent item is a multi-child slot rendered directly, no swap
 * property) and the "Show X" visibility BOOLEAN for optional slot parts —
 * the same property set amendSet reconciles.
 */
function figmaValueProps(contract: Contract): Map<string, { kind: string; def: unknown }> {
  const out = new Map<string, { kind: string; def: unknown }>();
  for (const p of contract.props) {
    const b = p.bindings.figma;
    if ((b.kind === 'BOOLEAN' || b.kind === 'TEXT') && b.property) {
      out.set(b.property, { kind: b.kind, def: p.default });
    }
  }
  for (const walked of slotsOf(contract)) {
    if ((walked.slot.defaultContent?.length ?? 0) > 1) continue; // multi-child: no swap property
    out.set(slotFigmaProperty(walked.slot), { kind: 'INSTANCE_SWAP', def: undefined });
    if (walked.part.optional) {
      out.set(slotVisibilityProperty(walked.slot), { kind: 'BOOLEAN', def: true });
    }
  }
  return out;
}

export function planAmend(original: Contract, edited: Contract): AmendPlan {
  const empty: Omit<AmendPlan, 'kind'> = {
    addedVariants: [],
    rebuiltVariants: [],
    extraVariants: [],
    addedProps: [],
    editedDefaults: [],
    skippedProps: edited.props.filter((p) => p.bindings.figma.kind === 'NONE').map((p) => p.name),
    strandedProps: [],
    defaultVariant: '',
    totalExpected: 0,
    capped: false,
  };

  if ((edited.figmaRepresentation ?? 'component') === 'native') {
    return {
      kind: 'native',
      ...empty,
      note: 'native representation — this concept IS a canvas capability (auto-layout); no component set exists to amend. The code surface still regenerates.',
    };
  }

  const existing = variantSetOf(original);
  const expected = variantSetOf(edited);
  empty.defaultVariant = expected.names[0] ?? '';
  empty.totalExpected = expected.names.length;
  empty.capped = existing.capped || expected.capped;

  if (JSON.stringify(original) === JSON.stringify(edited)) {
    return { kind: 'unchanged', ...empty, note: 'spec hash unchanged — the sync skips this set entirely.' };
  }
  if (!expected.isSet || !existing.isSet) {
    return {
      kind: 'standalone',
      ...empty,
      note: 'standalone component (no enum axes) — amend supports variant sets in v1; the sync reports and skips.',
    };
  }

  const existingNames = new Set(existing.names);
  const expectedNames = new Set(expected.names);
  const plan: AmendPlan = { kind: 'amend', ...empty };
  for (const name of expected.names) {
    (existingNames.has(name) ? plan.rebuiltVariants : plan.addedVariants).push(name);
  }
  for (const name of existing.names) {
    if (!expectedNames.has(name)) plan.extraVariants.push(name);
  }

  const beforeProps = figmaValueProps(original);
  const afterProps = figmaValueProps(edited);
  for (const [property, def] of afterProps) {
    const prev = beforeProps.get(property);
    if (!prev) plan.addedProps.push(property);
    else if (prev.kind === def.kind && prev.def !== def.def) plan.editedDefaults.push(property);
  }
  for (const property of beforeProps.keys()) {
    if (!afterProps.has(property)) plan.strandedProps.push(property);
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Version advice — docs/02-contract-spec.md policy
// ---------------------------------------------------------------------------

export interface VersionAdvice {
  bump: Severity | 'none';
  from: string;
  suggested: string;
  /** How the edited document's own version field compares to the advice. */
  editedVersion: string;
  editedVersionOk: boolean;
  reasons: string[];
}

function bumpVersion(version: string, bump: Severity): string {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function adviseVersion(
  original: Contract,
  edited: Contract,
  changes: ApiChange[],
): VersionAdvice {
  const rank: Record<Severity, number> = { patch: 0, minor: 1, major: 2 };
  let bump: Severity | 'none' = 'none';
  for (const c of changes) {
    if (bump === 'none' || rank[c.severity] > rank[bump]) bump = c.severity;
  }
  const suggested = bump === 'none' ? original.version : bumpVersion(original.version, bump);
  const reasons = changes
    .filter((c) => bump !== 'none' && c.severity === bump)
    .map((c) => `${c.subject}: ${c.detail}`);
  return {
    bump,
    from: original.version,
    suggested,
    editedVersion: edited.version,
    editedVersionOk: edited.version === suggested,
    reasons,
  };
}

// ---------------------------------------------------------------------------
// Preview helpers
// ---------------------------------------------------------------------------

/** Default prop values for the live sample, keyed by CODE prop name. */
export function defaultProps(contract: Contract): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of contract.props) {
    if (p.default === undefined || isArrayOf(p)) continue;
    if (p.bindings.code.prop === 'children') continue;
    out[p.bindings.code.prop] = p.default;
  }
  return out;
}

/** The children text prop's default, if the contract binds one. */
export function childrenDefault(contract: Contract): string | undefined {
  const children = contract.props.find(
    (p) => p.type === 'text' && p.bindings.code.prop === 'children',
  );
  return typeof children?.default === 'string' ? children.default : undefined;
}

/** First enum prop — the preview gallery's axis. */
export function previewAxis(
  contract: Contract,
): { name: string; codeProp: string; values: string[] } | undefined {
  const p = contract.props.find(isEnum);
  return p ? { name: p.name, codeProp: p.bindings.code.prop, values: p.type.enum } : undefined;
}
