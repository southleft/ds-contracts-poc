/**
 * The diagnostic loop — three-way parity check.
 *
 * Diffs each live surface against the CONTRACT (never side-to-side):
 *   code   ⟷ contract   (React source parsed by parity/extract-code.ts)
 *   figma  ⟷ contract   (snapshots in parity/snapshots/, refreshed by running
 *                        parity/extract-figma.plugin.js in the Figma file)
 *   figma-canvas ⟷ canvas + contract
 *                       (per-VARIANT v6 fingerprints — see parity/variant-drift.ts.
 *                        This is the surface Phase 1's exit criterion names:
 *                        a hand-made change to a part's layout inside ONE
 *                        variant. The property-definition sweep below cannot
 *                        see it — variant axes, booleans and instance swaps
 *                        are all unchanged by dragging a padding handle.)
 *   figma variables ⟷ tokens/ (the token half of the contract)
 *
 * Classification:
 *   *-ahead   — the surface has something the contract doesn't → PROPOSE a
 *               contract/token patch (the promotion flow; a human reviews it)
 *   *-behind  — the contract has something the surface doesn't → REGENERATE
 *               that surface (npm run generate / figma-sync scripts)
 *   mismatch  — both define it, values disagree → contract is canonical;
 *               adopt (patch contract) or enforce (regenerate surface)
 *
 * Exit code 1 when drift exists (CI-able). Full report at parity/report.json.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ContractSchema,
  STATE_PREVIEW_DEFAULT,
  STATE_PREVIEW_PROPERTY,
  componentRefsOf,
  slotFigmaProperty,
  slotVisibilityProperty,
  slotsOf,
  statePreviewLabel,
  type Contract,
  type Prop,
} from '../scripts/contract-schema.js';
import { extractCode, type CodeExtract } from './extract-code.js';
import { expectedCssVarsFromAnatomy } from '../core/anatomy-diff.js';
import {
  compileVariantFingerprints,
  compareSetVariants,
  notExtractedFinding,
  type CompiledSet,
  type FigmaVariantRow,
  type SnapshotChange,
} from './variant-drift.js';
import {
  SnapshotInputError,
  parseFigmaComponentsSnapshot,
  parseFigmaTokensSnapshot,
} from './snapshot-schema.js';

const ROOT = process.cwd();

/** SNAPSHOT SOURCE + REPORT DESTINATION are overridable so a GATE can drive
 *  this exact differ over committed fixtures without touching
 *  parity/snapshots/ or rewriting parity/report.json (which would dirty the
 *  checkout on every run — the reason `npm run parity` is excluded from every
 *  lane). Both are PRINTED when set: a knob that silently changes what the
 *  differ compared is the shape of a false receipt. */
const SNAPSHOT_DIR_OVERRIDE = process.env.PARITY_SNAPSHOT_DIR ?? null;
const REPORT_PATH = process.env.PARITY_REPORT ?? path.join(ROOT, 'parity', 'report.json');
const snapshotPath = (file: string) => {
  if (SNAPSHOT_DIR_OVERRIDE) {
    const candidate = path.resolve(ROOT, SNAPSHOT_DIR_OVERRIDE, file);
    if (existsSync(candidate)) return candidate;
  }
  return path.join(ROOT, 'parity', 'snapshots', file);
};
if (SNAPSHOT_DIR_OVERRIDE) {
  console.warn(`⚠ PARITY_SNAPSHOT_DIR=${SNAPSHOT_DIR_OVERRIDE} — snapshots resolved from there first, falling back to parity/snapshots/.`);
}
if (process.env.PARITY_REPORT) console.warn(`⚠ PARITY_REPORT=${REPORT_PATH}`);

interface Finding {
  surface: 'code' | 'figma' | 'figma-canvas' | 'figma-tokens';
  classification: 'ahead' | 'behind' | 'mismatch';
  subject: string;
  detail: string;
  proposedPatch?: unknown;
  remedy: string;
  /** figma-canvas only: the paired snapshot line changes behind the verdict. */
  lines?: SnapshotChange[];
  /** figma-canvas only: the machine-readable drift kind. */
  driftKind?: string;
}

const findings: Finding[] = [];
const add = (f: Finding) => findings.push(f);

/** Pending first sync (v7): a contract whose design anchors are still null
 *  has never been generated on the canvas — the missing set is EXPECTED
 *  mid-workflow state (add contract → run figma-sync → anchors written back
 *  → re-extract snapshots), not drift between surfaces that were once in
 *  sync. Reported in its own section, excluded from the exit code — the
 *  moment anchors exist, a missing set is a hard BEHIND again. */
const pending: Array<{ subject: string; detail: string; remedy: string }> = [];

/** UNMEASURED (v8): a surface the differ could not look at, as distinct from
 *  a surface it looked at and found clean. Today that is exactly one thing —
 *  a Figma snapshot taken before parity/extract-figma.plugin.js read the
 *  canvas fingerprint back, so per-variant drift was never compared. Excluded
 *  from the exit code (it is not drift, and its remedy is a human running the
 *  plugin, not a regeneration) but it BLOCKS the "✔ Parity clean" banner:
 *  saying "clean" over a surface nobody looked at is the false receipt this
 *  bucket exists to prevent. */
const unmeasured: Array<{ subject: string; detail: string; remedy: string; driftKind: string }> = [];

const isEnum = (p: Prop): p is Prop & { type: { enum: string[] } } =>
  typeof p.type === 'object' && 'enum' in p.type;
const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// Load inputs
// ---------------------------------------------------------------------------

const contracts: Contract[] = readdirSync(path.join(ROOT, 'contracts'))
  .filter((f) => f.endsWith('.contract.json'))
  .map((f) => ContractSchema.parse(JSON.parse(readFileSync(path.join(ROOT, 'contracts', f), 'utf8'))));

const code: CodeExtract[] = extractCode(ROOT);

interface FigmaPropertyDef {
  type: string;
  defaultValue: unknown;
  variantOptions: string[] | null;
  preferredValues?: Array<{ type: string; key: string }> | null;
}
interface FigmaSet {
  name: string;
  nodeId: string;
  key: string;
  variantCount: number;
  properties: Record<string, FigmaPropertyDef>;
  nestedInstances?: string[];
  /** v4 transport (parity/extract-figma.plugin.js): the per-variant v6 stamp
   *  read back off the canvas plus a same-session recompute. ABSENT on every
   *  snapshot taken before that version — absence is reported as NOT
   *  EXTRACTED, never as "no drift". */
  variants?: FigmaVariantRow[];
  /** v5 trust transport: component-set metadata stamp + same-session read. */
  setFingerprint?: string | null;
  setSnapshot?: string[] | null;
  setLive?: string | null;
  setLiveSnapshot?: string[] | null;
  setMeasurementError?: string | null;
  /** v4 transport: `ds_contracts/contractId` off the set, when marked. */
  contractId?: string | null;
}
const loadSnapshot = <T>(
  file: string,
  parse: (text: string, file: string) => { value: T; sourceVersion: 'legacy-unversioned' | 1 },
): T => {
  const source = snapshotPath(file);
  try {
    const parsed = parse(readFileSync(source, 'utf8'), source);
    if (parsed.sourceVersion === 'legacy-unversioned') {
      console.warn(`⚠ ${source}: normalized legacy unversioned snapshot to snapshotVersion 1`);
    }
    return parsed.value;
  } catch (error) {
    const refusal =
      error instanceof SnapshotInputError
        ? error.message
        : `SNAPSHOT_INPUT_REFUSAL: ${source} at $: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`✖ ${refusal}`);
    process.exit(2);
  }
};

const figmaComponents: { sets: FigmaSet[]; fileKey?: string | null; extractedAt?: number } =
  loadSnapshot('figma-components.json', parseFigmaComponentsSnapshot);
interface FigmaVariable {
  name: string;
  type: string;
  values: Record<string, unknown>;
}
const figmaTokens: {
  collections: Array<{ name: string; variables: FigmaVariable[] }>;
  fileKey?: string | null;
  extractedAt?: number;
} = loadSnapshot('figma-tokens.json', parseFigmaTokensSnapshot);

// ---------------------------------------------------------------------------
// 0 · snapshot provenance — are these snapshots from the right file, recently?
// ---------------------------------------------------------------------------
// Snapshots that carry `fileKey` are verified against the contracts' anchor
// file key; snapshots that carry `extractedAt` (epoch ms, stamped by
// parity/extract-figma.plugin.js) are checked for staleness. Snapshots
// WITHOUT these fields get a console warning, not a finding — older
// snapshots stay usable (backward compatible).

const MAX_SNAPSHOT_AGE_DAYS = Number(process.env.MAX_SNAPSHOT_AGE_DAYS ?? 14);
const anchorFileKey = contracts[0]?.anchors.figma.fileKey ?? null;
const provenanceWarnings: string[] = [];

for (const [label, snap] of [
  ['figma-components.json', figmaComponents],
  ['figma-tokens.json', figmaTokens],
] as const) {
  if (typeof snap.fileKey === 'string' && snap.fileKey) {
    if (anchorFileKey && snap.fileKey !== anchorFileKey) {
      add({
        surface: 'figma',
        classification: 'mismatch',
        subject: 'snapshot-provenance',
        detail: `${label} was extracted from file ${snap.fileKey} but the contracts anchor file ${anchorFileKey} — the snapshot describes a different Figma file`,
        remedy: 'Re-run parity/extract-figma.plugin.js in the anchored file and save fresh snapshots',
      });
    }
  } else {
    provenanceWarnings.push(`${label} lacks fileKey`);
  }
  if (typeof snap.extractedAt === 'number' && Number.isFinite(snap.extractedAt)) {
    const ageDays = (Date.now() - snap.extractedAt) / 86_400_000;
    if (ageDays > MAX_SNAPSHOT_AGE_DAYS) {
      add({
        surface: 'figma',
        classification: 'mismatch',
        subject: 'snapshot-stale',
        detail: `${label} is ${ageDays.toFixed(1)} days old (max ${MAX_SNAPSHOT_AGE_DAYS}, override via MAX_SNAPSHOT_AGE_DAYS) — the Figma file has likely moved on`,
        remedy: 'Re-run parity/extract-figma.plugin.js and save fresh snapshots',
      });
    }
  } else {
    provenanceWarnings.push(`${label} lacks extractedAt`);
  }
}
if (provenanceWarnings.length > 0) {
  console.warn(`⚠ snapshot provenance unverifiable: ${provenanceWarnings.join('; ')} — re-extract with the current parity/extract-figma.plugin.js to enable identity + staleness checks.`);
}

// ---------------------------------------------------------------------------
// 1 · code ⟷ contract
// ---------------------------------------------------------------------------

for (const contract of contracts) {
  const extracted = code.find((c) => c.component === contract.name);
  if (!extracted) {
    add({
      surface: 'code',
      classification: 'behind',
      subject: contract.name,
      detail: 'Component missing from src/components',
      remedy: 'npm run generate',
    });
    continue;
  }

  const contractCodeProps = contract.props.filter((p) => p.type !== 'text');

  // Named text props (title) and named slots (actions) must exist in code —
  // presence-only checks (their TS types are string / ReactNode).
  for (const expected of [
    ...contract.props
      .filter((p) => p.type === 'text' && p.bindings.code.prop !== 'children')
      .map((p) => ({ name: p.bindings.code.prop, kind: 'text prop' })),
    ...slotsOf(contract)
      .filter((s) => s.slot.name !== 'children')
      .map((s) => ({ name: s.slot.name, kind: 'slot prop' })),
    // v6: declared events are contract API — a missing callback is code BEHIND.
    ...(contract.events ?? []).map((e) => ({ name: e.bindings.code.prop, kind: 'event callback' })),
  ]) {
    if (!extracted.props.some((cp) => cp.name === expected.name)) {
      add({
        surface: 'code',
        classification: 'behind',
        subject: `${contract.name}.${expected.name}`,
        detail: `Contract ${expected.kind} "${expected.name}" missing from ${contract.name}Props`,
        remedy: 'npm run generate',
      });
    }
  }

  for (const p of contractCodeProps) {
    const codeName = p.bindings.code.prop;
    const found = extracted.props.find((cp) => cp.name === codeName);
    if (!found) {
      add({
        surface: 'code',
        classification: 'behind',
        subject: `${contract.name}.${codeName}`,
        detail: `Contract prop "${p.name}" missing from ${contract.name}Props`,
        remedy: 'npm run generate',
      });
      continue;
    }
    if (isEnum(p)) {
      const want = p.type.enum.join('|');
      const got = (found.values ?? []).join('|');
      if (want !== got) {
        add({
          surface: 'code',
          classification: 'mismatch',
          subject: `${contract.name}.${codeName}`,
          detail: `Enum values differ — contract: [${want}], code: [${got}]`,
          remedy: 'Adopt into contract (promotion) or npm run generate to enforce',
        });
      }
    }
    // Kind drift: a prop whose TYPE changed in code (enum→string,
    // boolean→enum) previously passed as long as the name existed.
    const expectedKind = isEnum(p) ? 'enum' : p.type === 'boolean' ? 'boolean' : null;
    if (expectedKind && found.kind !== expectedKind && found.kind !== 'other') {
      add({
        surface: 'code',
        classification: 'mismatch',
        subject: `${contract.name}.${codeName} (type)`,
        detail: `Prop type differs — contract: ${expectedKind}, code: ${found.kind}`,
        remedy: 'Adopt into contract (promotion) or npm run generate to enforce',
      });
    }
    // Default drift including ONE-SIDED deletion: a default removed from
    // code is drift (the generated classname silently loses its styling),
    // not a pass. Event-toggled props are exempt — their default lives in
    // the uncontrolled useState, which extraction cannot see.
    const isToggled = (contract.events ?? []).some((e) => e.toggles?.prop === p.name);
    if (!isToggled && String(p.default ?? '') !== String(found.default ?? '')) {
      add({
        surface: 'code',
        classification: 'mismatch',
        subject: `${contract.name}.${codeName} (default)`,
        detail: `Default differs — contract: ${JSON.stringify(p.default)}, code: ${JSON.stringify(found.default)}`,
        remedy: 'Adopt into contract (promotion) or npm run generate to enforce',
      });
    }
  }

  const contractPropNames = new Set([
    ...contractCodeProps.map((p) => p.bindings.code.prop),
    ...contract.props.filter((p) => p.type === 'text').map((p) => p.bindings.code.prop),
    ...slotsOf(contract).map((s) => s.slot.name),
    ...(contract.events ?? []).map((e) => e.bindings.code.prop),
  ]);
  for (const cp of extracted.props) {
    if (contractPropNames.has(cp.name)) continue;
    // Code declares a prop the contract doesn't know — code is AHEAD.
    const patch: Record<string, unknown> = {
      name: cp.name,
      type: cp.kind === 'enum' ? { enum: cp.values } : cp.kind,
      ...(cp.default !== undefined ? { default: cp.default } : {}),
      bindings: {
        figma: {
          kind: cp.kind === 'enum' ? 'VARIANT' : cp.kind === 'boolean' ? 'BOOLEAN' : 'TEXT',
          property: pascal(cp.name),
          ...(cp.kind === 'enum'
            ? { values: Object.fromEntries((cp.values ?? []).map((v) => [v, pascal(v)])) }
            : {}),
        },
        code: { prop: cp.name },
      },
    };
    add({
      surface: 'code',
      classification: 'ahead',
      subject: `${contract.name}.${cp.name}`,
      detail: `Code declares prop "${cp.name}" (${cp.kind}) that the contract does not define`,
      proposedPatch: patch,
      remedy: `Review + append to contracts/${contract.id.replace(/^[^.]+\./, '')}.contract.json props[], bump version, then npm run build && npm run figma:plan`,
    });
  }

  // Wave 7 — anatomy token floor on the code surface: every fully-resolved
  // `{a.b.c}` binding in contract anatomy must appear as `--a-b-c` in the
  // component CSS Module. Axis templates (`{color.action.{variant}.…}`) are
  // skipped; extras from axis expansion are allowed (code AHEAD is not
  // raised for them — generation invents the product by design).
  {
    const expected = expectedCssVarsFromAnatomy(contract);
    if (expected.length > 0) {
      const got = new Set(extracted.cssVars);
      for (const v of expected) {
        if (got.has(v)) continue;
        add({
          surface: 'code',
          classification: 'behind',
          subject: `${contract.name}.css(--${v})`,
          detail: `Contract anatomy binds {${v.split('-').join('.')}} but ${contract.name}.module.css does not reference var(--${v})`,
          remedy: 'npm run generate',
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2 · figma ⟷ contract
// ---------------------------------------------------------------------------

const normalizeFigmaProps = (set: FigmaSet) => {
  const map = new Map<string, FigmaPropertyDef>();
  for (const [key, def] of Object.entries(set.properties)) {
    map.set(key.split('#')[0], def);
  }
  return map;
};

for (const contract of contracts) {
  if (contract.figmaRepresentation === 'native') continue; // no Figma component expected
  const anchorKey = contract.anchors.figma.componentSetKey;
  const set =
    figmaComponents.sets.find((s) => anchorKey && s.key === anchorKey) ??
    figmaComponents.sets.find((s) => s.name === contract.name);
  if (!set) {
    if (!anchorKey && !contract.anchors.figma.nodeId) {
      pending.push({
        subject: contract.name,
        detail: 'No design anchor yet — the contract has never been synced to Figma (pending first generation, not drift)',
        remedy: 'Run its figma-sync script, write back anchors (npm run anchors:writeback), re-extract snapshots',
      });
      continue;
    }
    add({
      surface: 'figma',
      classification: 'behind',
      subject: contract.name,
      detail: 'Component set missing from Figma file',
      remedy: 'Run figma-sync scripts (npm run figma:plan, execute in Figma)',
    });
    continue;
  }

  const figmaProps = normalizeFigmaProps(set);
  const expectedNames = new Set<string>();

  for (const p of contract.props) {
    // kind NONE (v7 arrayOf): code-only by declared fidelity limit — the
    // canvas is not expected to host the prop, so it is skipped, not BEHIND.
    if (p.bindings.figma.kind === 'NONE') continue;
    const propertyName = p.bindings.figma.property!;
    expectedNames.add(propertyName);
    const def = figmaProps.get(propertyName);
    if (!def) {
      add({
        surface: 'figma',
        classification: 'behind',
        subject: `${contract.name}.${propertyName}`,
        detail: `Contract prop "${p.name}" has no ${p.bindings.figma.kind} property on the Figma set`,
        remedy: 'Add the property to the existing set via a scripted edit — sync scripts are currently CREATE-only and skip existing components (see docs/internal/figma-sync.md)',
      });
      continue;
    }
    // Property KIND must match the binding (a designer converting a
    // boolean to a variant axis previously passed as "present").
    if (def.type !== p.bindings.figma.kind) {
      add({
        surface: 'figma',
        classification: 'mismatch',
        subject: `${contract.name}.${propertyName} (kind)`,
        detail: `Property kind differs — contract: ${p.bindings.figma.kind}, figma: ${def.type}`,
        remedy: 'Adopt into contract (promotion) or rebuild the property',
      });
    }
    // BOOLEAN/TEXT defaults were presence-only (red-team finding): flipping
    // every boolean default on the canvas passed "parity clean".
    if (!isEnum(p) && p.default !== undefined && def.defaultValue !== undefined) {
      const want = p.type === 'boolean' ? Boolean(p.default) : String(p.default);
      const got = p.type === 'boolean' ? Boolean(def.defaultValue) : String(def.defaultValue);
      if (want !== got) {
        add({
          surface: 'figma',
          classification: 'mismatch',
          subject: `${contract.name}.${propertyName} (default)`,
          detail: `Default differs — contract: ${JSON.stringify(want)}, figma: ${JSON.stringify(got)}`,
          remedy: 'Adopt into contract (promotion) or reset the property default',
        });
      }
    }
    if (isEnum(p)) {
      const want = p.type.enum.map((v) => p.bindings.figma.values?.[v] ?? v);
      const got = def.variantOptions ?? [];
      // Order-insensitive: the canvas presents the default variant first;
      // option ORDER is presentation, not contract API.
      if ([...want].sort().join('|') !== [...got].sort().join('|')) {
        add({
          surface: 'figma',
          classification: 'mismatch',
          subject: `${contract.name}.${propertyName}`,
          detail: `Variant options differ — contract: [${want.join(', ')}], figma: [${got.join(', ')}]`,
          remedy: 'Adopt into contract (promotion) or re-sync the set',
        });
      }
      const wantDefault =
        p.default !== undefined
          ? (p.bindings.figma.values?.[String(p.default)] ?? String(p.default))
          : undefined;
      if (wantDefault !== undefined && def.defaultValue !== wantDefault) {
        add({
          surface: 'figma',
          classification: 'mismatch',
          subject: `${contract.name}.${propertyName} (default)`,
          detail: `Default variant differs — contract: ${wantDefault}, figma: ${String(def.defaultValue)} (Figma's default = first variant in the set)`,
          remedy: 'Reorder the set so the contract-default variant is first',
        });
      }
    }
  }

  // State previews (figmaStatePreviews): a DECLARED canvas-only surface.
  // When the contract opts in, the set must carry the State variant axis
  // with exactly Default + the declared states — the axis is contract API,
  // not drift. (The converse — a State axis with NO opt-in — is handled in
  // the ahead sweep below: that's the kit-rot detection story.)
  if (contract.figmaStatePreviews && contract.states.length > 0) {
    expectedNames.add(STATE_PREVIEW_PROPERTY);
    const def = figmaProps.get(STATE_PREVIEW_PROPERTY);
    const want = [STATE_PREVIEW_DEFAULT, ...contract.states.map(statePreviewLabel)];
    if (!def) {
      add({
        surface: 'figma',
        classification: 'behind',
        subject: `${contract.name}.${STATE_PREVIEW_PROPERTY}`,
        detail: `Contract opts into state previews (figmaStatePreviews) but the Figma set has no ${STATE_PREVIEW_PROPERTY} variant axis`,
        remedy: 'Re-run the component sync script (amend adds the State preview axis and renames base variants with State=Default)',
      });
    } else {
      if (def.type !== 'VARIANT') {
        add({
          surface: 'figma',
          classification: 'mismatch',
          subject: `${contract.name}.${STATE_PREVIEW_PROPERTY} (kind)`,
          detail: `State preview axis must be a VARIANT property, figma has ${def.type}`,
          remedy: 'Re-run the component sync script',
        });
      }
      const got = def.variantOptions ?? [];
      if ([...want].sort().join('|') !== [...got].sort().join('|')) {
        add({
          surface: 'figma',
          classification: 'mismatch',
          subject: `${contract.name}.${STATE_PREVIEW_PROPERTY}`,
          detail: `State preview values differ — contract: [${want.join(', ')}], figma: [${got.join(', ')}]`,
          remedy: 'Adopt into the contract states (promotion) or re-sync the set',
        });
      }
      if (def.defaultValue !== undefined && def.defaultValue !== STATE_PREVIEW_DEFAULT) {
        add({
          surface: 'figma',
          classification: 'mismatch',
          subject: `${contract.name}.${STATE_PREVIEW_PROPERTY} (default)`,
          detail: `Default state variant must be ${STATE_PREVIEW_DEFAULT}, figma: ${String(def.defaultValue)} (Figma's default = first variant in the set)`,
          remedy: 'Reorder the set so the all-defaults State=Default variant is first',
        });
      }
    }
  }

  // Slots: INSTANCE_SWAP property per slot; optional slots additionally get a
  // "Show X" BOOLEAN. `accepts` must round-trip as preferredValues whose keys
  // are the accepted contracts' componentSetKey anchors.
  const byIdAll = new Map(contracts.map((c) => [c.id, c]));
  for (const { slot, part } of slotsOf(contract)) {
    const propertyName = slotFigmaProperty(slot);
    // Multi-child slot (defaultContent > 1): inexpressible as INSTANCE_SWAP —
    // no property expected; instead the content components must exist as
    // nested instances. (Native SLOT property is the migration target.)
    if ((slot.defaultContent?.length ?? 0) > 1) {
      for (const id of new Set(slot.defaultContent!.map((i) => i.id))) {
        const dep = byIdAll.get(id)!;
        if (!(set.nestedInstances ?? []).includes(dep.name)) {
          add({
            surface: 'figma',
            classification: 'behind',
            subject: `${contract.name}.${dep.name}`,
            detail: `Multi-child slot "${slot.name}" declares ${id} default content but no ${dep.name} instance exists inside the Figma component`,
            remedy: 'Re-run the component sync script',
          });
        }
      }
      continue;
    }
    expectedNames.add(propertyName);
    const def = figmaProps.get(propertyName);
    if (!def) {
      add({
        surface: 'figma',
        classification: 'behind',
        subject: `${contract.name}.${propertyName}`,
        detail: `Contract slot "${slot.name}" has no INSTANCE_SWAP property on the Figma component`,
        remedy: 'Re-run the component sync script',
      });
    } else if (slot.accepts && slot.accepts.length > 0) {
      const expectedKeys = slot.accepts
        .map((id) => byIdAll.get(id)?.anchors.figma.componentSetKey)
        .filter((k): k is string => Boolean(k))
        .sort();
      const gotKeys = (def.preferredValues ?? []).map((p) => p.key).sort();
      if (expectedKeys.length > 0 && expectedKeys.join('|') !== gotKeys.join('|')) {
        add({
          surface: 'figma',
          classification: 'mismatch',
          subject: `${contract.name}.${propertyName} (accepts)`,
          detail: `Slot accepts [${slot.accepts.join(', ')}] but Figma preferredValues keys differ`,
          remedy: 'Adopt into contract (promotion) or re-sync preferredValues',
        });
      }
    }
    if (part.optional) {
      const visibilityName = slotVisibilityProperty(slot);
      expectedNames.add(visibilityName);
      if (!figmaProps.get(visibilityName)) {
        add({
          surface: 'figma',
          classification: 'behind',
          subject: `${contract.name}.${visibilityName}`,
          detail: `Optional slot "${slot.name}" has no visibility BOOLEAN on the Figma component`,
          remedy: 'Re-run the component sync script',
        });
      }
    }
  }

  // Nested component refs: the composing instance must exist in Figma.
  for (const { ref } of componentRefsOf(contract)) {
    const dep = byIdAll.get(ref.id)!;
    if (!(set.nestedInstances ?? []).includes(dep.name)) {
      add({
        surface: 'figma',
        classification: 'behind',
        subject: `${contract.name}.${dep.name}`,
        detail: `Contract composes ${ref.id} but no ${dep.name} instance exists inside the Figma component`,
        remedy: 'Re-run the component sync script',
      });
    }
  }

  for (const [name, def] of figmaProps) {
    if (expectedNames.has(name)) continue;
    // A hand-built State variant axis WITHOUT the contract opt-in is the
    // kit-rot pattern state previews exist to replace: someone manually
    // built "State=Hover" variants because Figma can't run pseudo-classes,
    // and those rot. Propose adoption (the one-field opt-in regenerates
    // them from the contract's state token overrides), never a bogus prop.
    if (name === STATE_PREVIEW_PROPERTY && def.type === 'VARIANT' && !contract.figmaStatePreviews) {
      add({
        surface: 'figma',
        classification: 'ahead',
        subject: `${contract.name}.${STATE_PREVIEW_PROPERTY}`,
        detail: `Figma set carries a hand-built ${STATE_PREVIEW_PROPERTY} variant axis [${(def.variantOptions ?? []).join(', ')}] the contract does not declare — hand-maintained state previews rot; the contract can own them`,
        ...(contract.states.length > 0 ? { proposedPatch: { figmaStatePreviews: true } } : {}),
        remedy:
          contract.states.length > 0
            ? `Adopt: set "figmaStatePreviews": true in contracts/${contract.id.replace(/^[^.]+\./, '')}.contract.json (bump minor), npm run figma:plan, re-sync — or retire the hand-built axis`
            : 'Declare interaction states + root token overrides in the contract (then opt into figmaStatePreviews), or retire the hand-built axis',
      });
      continue;
    }
    add({
      surface: 'figma',
      classification: 'ahead',
      subject: `${contract.name}.${name}`,
      detail: `Figma set declares ${def.type} property "${name}" the contract does not define`,
      proposedPatch: {
        name: name.toLowerCase(),
        type: def.type === 'BOOLEAN' ? 'boolean' : def.type === 'TEXT' ? 'text' : { enum: def.variantOptions },
        bindings: { figma: { kind: def.type, property: name }, code: { prop: name.toLowerCase() } },
      },
      remedy: `Review + append to the contract props[], bump version, then npm run build`,
    });
  }
}

// ---------------------------------------------------------------------------
// 2.5 · figma CANVAS ⟷ canvas stamp + contract — THE PHASE 1 EXIT CRITERION
// ---------------------------------------------------------------------------
// Section 2 above compares property DEFINITIONS. A designer who drags a
// padding handle inside one variant moves none of them, which is why the
// four-way part-layout edit this section exists for used to project to a
// byte-identical snapshot entry under "✔ Parity clean".
//
// The rules, in full, live in parity/variant-drift.ts. The two that matter
// here: `live` ≠ `fingerprint` is a HAND EDIT (both computed by the same
// source in the same Figma session, so no cross-environment noise), and a set
// with no `variants` array at all is reported as NOT EXTRACTED — an
// unmeasured surface — never as agreement.

const canvasSets = figmaComponents.sets;
const withVariants = canvasSets.filter((s) => Array.isArray(s.variants));
const withoutVariants = canvasSets.filter((s) => !Array.isArray(s.variants));

// ABSENCE IS A NAMED GAP, AND IT IS NOT DRIFT.
//
// It goes in its own bucket — the same shape `pending` uses — for a reason
// worth stating: the exit code of this script answers "is there drift between
// the surfaces?", and "the differ cannot SEE this surface" is a different
// question with a different remedy (a human running the plugin in Figma, not
// a regeneration). Counting it as drift would make `npm run parity` red for a
// wall-clock reason on every checkout, which is the exact shape that already
// got this script excluded from every CI lane.
//
// What it must NEVER do is disappear into the "✔ Parity clean" banner. So the
// banner below refuses the word "clean" while this bucket is non-empty, the
// summary carries the count, and report.json carries the whole finding.
const gap = notExtractedFinding(withoutVariants.map((s) => s.name), canvasSets.length);
if (gap) unmeasured.push({ subject: gap.subject, detail: gap.detail, remedy: gap.remedy, driftKind: gap.kind });

if (withVariants.length > 0) {
  // THE COMPILE IS OPTIONAL AND THE HAND-EDIT COMPARISON IS NOT.
  //
  // `live` vs `fingerprint` — the exit criterion — needs no contract at all;
  // both numbers arrive on the wire. The contract axis needs the engine
  // bundle, which esbuilds from figma-sync/plugin/engine/entry.ts. Two
  // callers run this differ in a partial scratch copy that carries
  // contracts/tokens/scripts/core/parity/src/packages and NOT figma-sync
  // (site/src/how-replays.ts:135 and evals/run.ts), so the bundle throws
  // there. Exiting would take the whole differ — including the hand-edit
  // comparison it does not need — down with it.
  //
  // So a failed compile becomes a NAMED unmeasured surface and the rest of
  // the section runs. What it must not become is a silent skip: without the
  // bucket entry, an unbuildable engine would read as "the contract agrees
  // with every variant".
  let compiled: Map<string, CompiledSet> | null = null;
  try {
    compiled = await compileVariantFingerprints(path.join(ROOT, 'contracts'));
  } catch (e) {
    unmeasured.push({
      subject: 'canvas-variant-contract-compile',
      detail: `the offline contract compile could not run, so canvas stamps were NOT compared against the contracts (the hand-edit comparison below is unaffected — it needs no compile): ${(e as Error).message}`,
      remedy: 'Run this differ from a full checkout (the engine bundle esbuilds from figma-sync/plugin/engine/entry.ts)',
      driftKind: 'compile-unavailable',
    });
  }
  const compiledById = new Map<string, CompiledSet>();
  for (const cs of compiled?.values() ?? []) if (cs.contractId) compiledById.set(cs.contractId, cs);

  for (const set of withVariants) {
    const match = (set.contractId ? compiledById.get(set.contractId) : undefined) ?? compiled?.get(set.name);
    for (const f of compareSetVariants({
      setName: set.name,
      variants: set.variants,
      compiled: match,
      setFingerprint: set.setFingerprint,
      setSnapshot: set.setSnapshot,
      setLive: set.setLive,
      setLiveSnapshot: set.setLiveSnapshot,
      setMeasurementError: set.setMeasurementError,
    })) {
      // Mock-compiled vs live-Figma equality has not yet earned a
      // compatibility receipt. Keep that axis visible but non-blocking;
      // stamped-vs-live edits and failed live measurements remain findings.
      if (f.blocking === false) {
        unmeasured.push({
          subject: f.subject,
          detail: f.detail,
          remedy: f.remedy,
          driftKind: 'contract-divergent-informational',
        });
        continue;
      }
      add({
        surface: 'figma-canvas',
        // A hand edit is the canvas holding a fact the contract does not —
        // AHEAD, the promotion direction. Everything else is a mismatch the
        // contract is canonical over.
        classification: f.kind === 'canvas-edited' ? 'ahead' : 'mismatch',
        subject: f.subject,
        detail: f.detail,
        remedy: f.remedy,
        driftKind: f.kind,
        ...(f.lines && f.lines.length > 0 ? { lines: f.lines } : {}),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 3 · figma variables ⟷ tokens/
// ---------------------------------------------------------------------------

type TokenLeaf = { value: unknown };
function flatten(tree: Record<string, unknown>, prefix: string[] = [], out = new Map<string, unknown>()) {
  for (const [key, value] of Object.entries(tree)) {
    if (key.startsWith('$')) continue;
    if (value && typeof value === 'object') {
      if ('$value' in value) out.set([...prefix, key].join('/'), (value as TokenLeaf & { $value: unknown }).$value);
      else flatten(value as Record<string, unknown>, [...prefix, key], out);
    }
  }
  return out;
}
const readTokens = (p: string) => flatten(JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')));

const primitives = readTokens('tokens/primitives.tokens.json');
const semantic = readTokens('tokens/semantic.tokens.json');
const light = readTokens('tokens/modes/semantic.light.tokens.json');
const dark = readTokens('tokens/modes/semantic.dark.tokens.json');

/** Normalize a token value for comparison against the Figma snapshot. */
function norm(v: unknown): string {
  if (typeof v === 'string') {
    const alias = v.match(/^\{([^}]+)\}$/);
    if (alias) return `{${alias[1].split('.').join('/')}}`; // dot → slash paths
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
    const px = v.match(/^(-?[\d.]+)px$/);
    if (px) return px[1];
    return v;
  }
  return String(v);
}

const figmaVarsByCollection = new Map<string, Map<string, FigmaVariable>>();
for (const col of figmaTokens.collections) {
  figmaVarsByCollection.set(col.name, new Map(col.variables.map((v) => [v.name, v])));
}

function checkTokens(
  collection: string,
  expected: Array<{ path: string; perMode: Record<string, unknown> }>,
) {
  const figmaVars = figmaVarsByCollection.get(collection) ?? new Map<string, FigmaVariable>();
  const expectedPaths = new Set<string>();
  for (const { path: tokenPath, perMode } of expected) {
    expectedPaths.add(tokenPath);
    const v = figmaVars.get(tokenPath);
    if (!v) {
      add({
        surface: 'figma-tokens',
        classification: 'behind',
        subject: `${collection}/${tokenPath}`,
        detail: 'Token exists in tokens/ but has no Figma variable',
        remedy: 'Re-run figma-sync token script (or figma_import_tokens ≥1.34 with creation support)',
      });
      continue;
    }
    for (const [mode, want] of Object.entries(perMode)) {
      const got = v.values[mode];
      if (norm(want) !== norm(got)) {
        add({
          surface: 'figma-tokens',
          classification: 'mismatch',
          subject: `${collection}/${tokenPath} [${mode}]`,
          detail: `tokens/ says ${norm(want)}, Figma says ${norm(got)}`,
          proposedPatch: { tokenPath: tokenPath.split('/').join('.'), mode, adoptFigmaValue: got },
          remedy: 'Adopt into tokens/ (promotion) then npm run tokens — or push tokens/ to Figma via figma_import_tokens',
        });
      }
    }
  }
  for (const name of figmaVars.keys()) {
    if (!expectedPaths.has(name)) {
      add({
        surface: 'figma-tokens',
        classification: 'ahead',
        subject: `${collection}/${name}`,
        detail: 'Figma variable has no counterpart in tokens/',
        remedy: 'Review + add to tokens/ (promotion) or delete the variable',
      });
    }
  }
}

checkTokens(
  'Primitives',
  [...primitives].map(([p, v]) => ({ path: p, perMode: { Value: v } })),
);
// Brand collection: one mode per tokens/modes/brand.*.tokens.json file.
const brandFiles = readdirSync(path.join(ROOT, 'tokens', 'modes'))
  .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
  .sort();
const brandModeMaps = brandFiles.map((f) => ({
  mode: f.replace(/^brand\.|\.tokens\.json$/g, '').replace(/^./, (c) => c.toUpperCase()),
  tokens: readTokens(`tokens/modes/${f}`),
}));
if (brandModeMaps.length > 0) {
  const first = brandModeMaps[0].tokens;
  checkTokens(
    'Brand',
    [...first.keys()].map((p) => ({
      path: p,
      perMode: Object.fromEntries(brandModeMaps.map(({ mode, tokens }) => [mode, tokens.get(p)])),
    })),
  );
}
checkTokens('Semantic', [
  ...[...semantic].map(([p, v]) => ({ path: p, perMode: { Light: v, Dark: v } })),
  ...[...light].map(([p, v]) => ({ path: p, perMode: { Light: v, Dark: dark.get(p) } })),
]);

// ---------------------------------------------------------------------------
// Report — triage before firehose.
//
// Baseline: parity/baseline.json (optional) is an array of finding keys
// ("surface|classification|subject"). Baselined findings are ACKNOWLEDGED —
// reported in their own section, excluded from the exit code — so a team can
// ratchet down known drift without the check going permanently red.
// ---------------------------------------------------------------------------

const findingKey = (f: Finding) => `${f.surface}|${f.classification}|${f.subject}`;

let baseline = new Set<string>();
const baselinePath = path.join(ROOT, 'parity', 'baseline.json');
try {
  const parsed = JSON.parse(readFileSync(baselinePath, 'utf8'));
  if (Array.isArray(parsed) && parsed.every((k) => typeof k === 'string')) {
    baseline = new Set(parsed);
  } else {
    console.warn('⚠ parity/baseline.json exists but is not an array of "surface|classification|subject" strings — ignored.');
  }
} catch {
  /* no baseline — every finding counts */
}

const acknowledged = findings.filter((f) => baseline.has(findingKey(f)));
const active = findings.filter((f) => !baseline.has(findingKey(f)));

// Summary: counts by surface × classification (active findings only —
// acknowledged drift is counted separately).
const bySurface: Record<string, Record<string, number>> = {};
for (const f of active) {
  bySurface[f.surface] ??= {};
  bySurface[f.surface][f.classification] = (bySurface[f.surface][f.classification] ?? 0) + 1;
}
const summary = {
  total: active.length,
  acknowledged: acknowledged.length,
  pending: pending.length,
  unmeasured: unmeasured.length,
  bySurface,
};

writeFileSync(
  REPORT_PATH,
  JSON.stringify(
    { summary, findings: active, acknowledged, pending, unmeasured, checkedContracts: contracts.map((c) => `${c.id}@${c.version}`) },
    null,
    2,
  ) + '\n',
);

const printFinding = (f: Finding) => {
  console.log(`  [${f.surface} ${f.classification.toUpperCase()}] ${f.subject}`);
  console.log(`    ${f.detail}`);
  // The snapshot line diff, one line per changed channel — the thing that
  // makes "canvas-edited" actionable rather than an accusation.
  for (const c of f.lines ?? []) console.log(`      ${c.what}: ${c.was} → ${c.now}`);
  if (f.proposedPatch) console.log(`    proposed patch: ${JSON.stringify(f.proposedPatch)}`);
  console.log(`    → ${f.remedy}\n`);
};

const printPending = () => {
  if (pending.length === 0) return;
  console.log(`  — pending first sync (no design anchor yet; does not fail the check) —\n`);
  for (const p of pending) {
    console.log(`  [figma PENDING] ${p.subject}`);
    console.log(`    ${p.detail}`);
    console.log(`    → ${p.remedy}\n`);
  }
};

/** The unmeasured section. Printed BEFORE the verdict on purpose: a reader
 *  who stops at the first line must not stop at a word that overstates what
 *  was compared. */
const printUnmeasured = () => {
  if (unmeasured.length === 0) return;
  console.log(`  — NOT MEASURED (the differ could not look at this surface; does not fail the check) —\n`);
  for (const u of unmeasured) {
    console.log(`  [${u.driftKind.toUpperCase()}] ${u.subject}`);
    console.log(`    ${u.detail}`);
    console.log(`    → ${u.remedy}\n`);
  }
};

if (active.length === 0 && acknowledged.length === 0) {
  // "Clean" is a claim about what was COMPARED. While anything sits in the
  // unmeasured bucket, this line says what it did and did not look at.
  if (unmeasured.length > 0) {
    console.log(
      `⚠ No drift on the surfaces the differ could compare — but ${unmeasured.length} surface(s) were NOT MEASURED, so this is not a clean bill of health:`,
    );
    printUnmeasured();
  } else {
    console.log(`✔ Parity clean — code, Figma, and tokens all match the contract.${pending.length > 0 ? ` (${pending.length} contract(s) pending first sync.)` : ''}`);
  }
  printPending();
  process.exit(0);
}

// Summary header first: surface × classification counts.
if (active.length > 0) {
  console.log(`✖ ${active.length} drift finding(s)${acknowledged.length > 0 ? ` (+${acknowledged.length} acknowledged in parity/baseline.json)` : ''}:`);
} else {
  console.log(`✔ No new drift — ${acknowledged.length} acknowledged finding(s) remain in parity/baseline.json.`);
}
for (const [surface, byClass] of Object.entries(bySurface)) {
  const parts = Object.entries(byClass).map(([c, n]) => `${c}: ${n}`);
  console.log(`    ${surface} — ${parts.join(', ')}`);
}
console.log('');

// First-run softener: when the staleness gate is the ONLY thing firing, say
// so — a fresh clone always trips it (the committed snapshots age past
// MAX_SNAPSHOT_AGE_DAYS by design, so an untouched snapshot can never report
// green forever), and a first-time tester must be able to tell "the gate is
// working" from "the components drifted" without reading the README first.
// The note prints ONLY when every active finding is snapshot-stale; one real
// drift finding in the mix and it stays silent.
if (active.length > 0 && active.every((f) => f.subject === 'snapshot-stale')) {
  console.log(
    `  ℹ Every finding above is \`snapshot-stale\` — expected on a fresh clone (see README §Working in this repository).\n` +
    `    The design-side inputs are committed Figma snapshots, and the differ refuses to trust one older than\n` +
    `    ${MAX_SNAPSHOT_AGE_DAYS} days by design — that is the staleness gate working, not drift in the components.\n` +
    `    The contract↔code and contract↔token checks DID run and found nothing. To re-verify the canvas half,\n` +
    `    re-run parity/extract-figma.plugin.js in the anchored Figma file, or override MAX_SNAPSHOT_AGE_DAYS.\n`,
  );
}

const MAX_CONSOLE_FINDINGS = 50;
for (const f of active.slice(0, MAX_CONSOLE_FINDINGS)) printFinding(f);
if (active.length > MAX_CONSOLE_FINDINGS) {
  console.log(`  …and ${active.length - MAX_CONSOLE_FINDINGS} more (see parity/report.json)\n`);
}

if (acknowledged.length > 0) {
  console.log(`  — acknowledged (baselined, does not fail the check) —\n`);
  for (const f of acknowledged.slice(0, MAX_CONSOLE_FINDINGS)) printFinding(f);
  if (acknowledged.length > MAX_CONSOLE_FINDINGS) {
    console.log(`  …and ${acknowledged.length - MAX_CONSOLE_FINDINGS} more acknowledged (see parity/report.json)\n`);
  }
}
printUnmeasured();
printPending();

process.exit(active.length > 0 ? 1 : 0);
