/** Admission from complete, host-authenticated property observations. The
 * marker declares reusable empty typography; caller text never becomes a main
 * default. Native allocation and visual qualification are separate steps. */
import type { Contract } from '../scripts/contract-schema.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import { planNativeRootTextTemplate } from '../core/native-root-text-template-plan.js';
import { revisionOf } from '../core/contract-provenance.js';
import { evidenceSha } from './react-validation-evidence.js';
import { reactPropertyPaintedRoot } from './react-property-fonts.js';
import type { ReactPropertySnapshot } from './react-root-variants.js';
import type { ReactPropertyObservation } from './react-property-effects.js';
import { reactComparisonVariant } from './react-comparison-plan.js';

export interface ReactRootTextPlane {
  snapshot: ReactPropertySnapshot;
  row: ReactPropertyObservation;
  rootPath: string;
  caller: unknown;
  /** Actual source props select the same compiled variant used by comparison. */
  actualProps?: Record<string,unknown>;
}

export function prepareReactRootTextTemplate(contract: Contract, tokens: Record<string, unknown>, planes: ReactRootTextPlane[]): {
  contract: Contract; admitted: boolean; limitation?: string;
} {
  // Historical archives keep their original compilation even if they already
  // contain font evidence. Version two is a new producer boundary, not proof.
  if (planes.every(p => p.row.propertyCaptureVersion === undefined && p.snapshot.propertyCaptureVersion === undefined))
    return { contract, admitted: false };
  if (!planes.length || planes.some(p => p.row.propertyCaptureVersion !== 2 || p.snapshot.propertyCaptureVersion !== 2))
    throw Error('react-root-text-template-capture-version-mixed');
  const roots = planes.map(({ snapshot, row, rootPath }) => {
    if (!snapshot.bounds || !row.boundsSha256 || snapshot.boundsSha256 !== row.boundsSha256 ||
        evidenceSha(JSON.stringify(snapshot.bounds)) !== row.boundsSha256 ||
        ![snapshot.bounds.x, snapshot.bounds.y, snapshot.bounds.width, snapshot.bounds.height].every(Number.isFinite) ||
        snapshot.bounds.width <= 0 || snapshot.bounds.height <= 0)
      throw Error('react-root-text-template-bounds-unverified');
    // The surrounding assembler already verifies source identity, props, raw
    // tree/image hashes, restoration and complete property coverage.
    return reactPropertyPaintedRoot(snapshot, row, rootPath);
  });
  const refuse = (why: string) => ({ contract, admitted: false, limitation: `root-text-template-unqualified:${why}` });
  if (planes.some(p => !p.snapshot.fonts || !p.row.fontsSha256)) return refuse('painted-font-evidence-required');
  for (const [i, root] of roots.entries()) {
    const caller = planes[i].caller;
    if ((typeof caller !== 'string' && typeof caller !== 'number') || !String(caller).trim() ||
        root.nodes.length !== 1 || root.nodes[0].t !== 'text' || root.nodes[0].v !== String(caller) || Object.keys(root.pseudo).length)
      return refuse('direct-caller-text-required');
  }
  const candidate = structuredClone(contract), slot = candidate.anatomy.root.slot;
  if (!slot || slot.name !== 'children') return refuse('root-children-slot-required');
  slot.bindings = { ...slot.bindings, figma: { ...slot.bindings?.figma, textTemplate: true } };
  try {
    const engine = createFigmaEngine({ tokens: { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
    const component = engine.compileComponentData(candidate, new Map([[candidate.id, candidate]]));
    const plan = planNativeRootTextTemplate(component, { contractRevision: revisionOf(candidate), tokenRevision: revisionOf(tokens) });
    if (!plan) return refuse('template-not-compiled');
    const covered = new Set<string>();
    for (const [index, root] of roots.entries()) {
      const props = planes[index].actualProps;
      if (!props && component.variants.length !== 1) return refuse('source-variant-required');
      const name = props ? reactComparisonVariant(candidate, props) : component.variants[0].name;
      const variants = component.variants.filter(v => v.name === name);
      const selected = plan.variants.find(v => v.name === name);
      const mode = plan.modes.find(m => m.key === selected?.modeKey);
      const raw = root.style['letter-spacing'];
      const tracking = raw === 'normal' ? 0 : typeof raw === 'string' && /^-?(?:\d+(?:\.\d+)?|\.\d+)px$/.test(raw)
        ? Number(raw.slice(0, -2)) : NaN;
      if (!Number.isFinite(tracking) || variants.length !== 1 || !mode ||
          variants[0].spec.children?.[0]?.children?.[0]?.letterSpacing !== tracking ||
          (selected?.letterSpacing ?? plan.typography.letterSpacing) !== tracking)
        return refuse('source-tracking-differs');
      covered.add(name);
    }
    if (covered.size !== component.variants.length) return refuse('source-variant-coverage-required');
    return { contract: candidate, admitted: true };
  } catch (error) {
    if (error instanceof Error && /^(FIGMA_|NATIVE_ROOT_TEXT_TEMPLATE_)/.test(error.message)) return refuse(error.message);
    throw error;
  }
}
