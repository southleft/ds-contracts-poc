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

export interface ReactRootTextPlane {
  snapshot: ReactPropertySnapshot;
  row: ReactPropertyObservation;
  rootPath: string;
  caller: unknown;
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
    if (!planNativeRootTextTemplate(component, { contractRevision: revisionOf(candidate), tokenRevision: revisionOf(tokens) }))
      return refuse('template-not-compiled');
    return { contract: candidate, admitted: true };
  } catch (error) {
    if (error instanceof Error && /^(FIGMA_|NATIVE_ROOT_TEXT_TEMPLATE_)/.test(error.message)) return refuse(error.message);
    throw error;
  }
}
