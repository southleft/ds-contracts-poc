/** Source identity and compiler correspondence, never name/paint matching. */
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { verifyNativeContractReadback, type NativeContractObservationInput, type NativeSourceReadback } from '../core/native-source-observation.js';
import type { NativeContractComparisonReference } from '../core/native-contract-comparison.js';
import type { Contract } from '../scripts/contract-schema.js';
import { normalizeValue, type CapturedNode } from '../extract/computed/lib.js';
import { linkReactSourceAnatomy } from './react-source-anatomy.js';
import { reactComparisonVariant } from './react-comparison-plan.js';
import { reactRootStyleExclusion } from './react-root-visual.js';
import type { ReactOwnership } from './react-ownership.js';
import type { ReactSourceProgram } from './react-source-program.js';
import type { ObservedContentDraft } from './observed-content.js';

export interface ReactCompositionMain {
  source: ReactOwnership['components'][number]['source'];
  contract: Contract;
  heldProps: Record<string, unknown>;
  /** Independently authenticated source observations for each emitted variant. */
  styles: Record<string, Array<Record<string, string>>>;
  input: NativeContractObservationInput;
  receipt: NativeSourceReadback;
}
export interface ReactCompositionReview {
  version: 1;
  status: 'ready' | 'incomplete';
  acceptedContract: null;
  denominator: number;
  matched: number;
  rows: Array<{ instanceId: string; exportName: string; module: string; sourcePaths: string[];
    status: 'matched' | 'unresolved'; problems: string[]; operationId?: string; variantName?: string;
    canPrepareMain?: boolean; preparationProblem?: string }>;
  problems: string[];
  inputRevision: string;
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const rootStyle = (style: Record<string, string>) => Object.fromEntries(Object.entries(style)
  .filter(([channel]) => !reactRootStyleExclusion(channel)).map(([key, value]) => [key, normalizeValue(value)]));

/** Host authenticates archives and the native journals before calling. Keeping
 * candidate inputs separate makes missing/ambiguous identity a visible refusal. */
export function matchReactComposition(program: ReactSourceProgram, ownership: ReactOwnership, tree: CapturedNode,
  content: ObservedContentDraft, mains: ReactCompositionMain[]) {
  const anatomy = linkReactSourceAnatomy(program, ownership, tree);
  const roots = anatomy.instances.filter(i => i.roots.some(r => r.path === ''));
  const children = anatomy.instances.filter(i => !roots.includes(i));
  const review: ReactCompositionReview = { version: 1, status: 'incomplete', acceptedContract: null,
    denominator: ownership.components.filter(c => !c.roots.includes('')).length, matched: 0, rows: [], problems: [...anatomy.problems],
    inputRevision: revisionOf({ program, ownership, tree, content, mains }) };
  const references: NativeContractComparisonReference[] = [];
  if (anatomy.status !== 'linked' || roots.length !== 1 || !content.sourcePaths ||
      content.status !== 'compiled-comparison-draft' || content.problems.length || content.treeRevision !== revisionOf(tree)) {
    review.problems.push('react-composition-source-correspondence-unavailable');
    review.rows = ownership.components.filter(c => !c.roots.includes('')).map(c => ({ instanceId: c.id,
      exportName: c.source.exportName, module: c.source.module, sourcePaths: [...c.roots], status: 'unresolved',
      problems: ['react-composition-source-correspondence-unavailable'] }));
    return { review, references };
  }
  for (const child of children) {
    const row: ReactCompositionReview['rows'][number] = { instanceId: child.instanceId, exportName: child.source.exportName,
      module: child.source.module, sourcePaths: child.roots.map(r => r.path), status: 'unresolved', problems: [] };
    review.rows.push(row);
    try {
      if (child.content !== 'caller-slot' || child.roots.length !== 1 || child.roots[0].correspondence === 'runtime-dependent')
        throw Error('react-composition-runtime-or-multiple-root-unqualified');
      const paths = content.sourcePaths.filter(p => p.sourcePath === child.roots[0].path && p.type === 'frame');
      if (paths.length !== 1 || !paths[0].specPath.length) throw Error('react-composition-compiler-path-unavailable');
      const candidates = mains.filter(m => same(m.source, child.source));
      if (candidates.length !== 1) throw Error(candidates.length ? 'react-composition-main-ambiguous' : 'react-composition-main-not-verified');
      const main = candidates[0], observed = ownership.components.find(c => c.id === child.instanceId)!;
      if (verifyNativeContractReadback(main.input, main.receipt).status !== 'supported-structure-observed')
        throw Error('react-composition-main-readback-invalid');
      const variantName = reactComparisonVariant(main.contract, observed.props);
      const axes = new Set(main.contract.props.map(p => p.bindings.code.prop));
      const held = (props: Record<string, unknown>) => Object.fromEntries(Object.entries(props).filter(([key]) => key !== 'children' && !axes.has(key)));
      if (!same(held(main.heldProps), held(observed.props))) throw Error('react-composition-held-inputs-differ');
      const styles = main.styles[variantName];
      if (!styles?.length || styles.some(style => !same(rootStyle(style), rootStyle(child.roots[0].observation.style))))
        throw Error('react-composition-observed-root-context-differs');
      const variants = main.input.component.variants.filter(v => v.name === variantName);
      if (variants.length !== 1) throw Error('react-composition-variant-unavailable');
      const slots: number[][] = [];
      const walk = (node: typeof variants[number]['spec'], path: number[]) => {
        if (node.type === 'slot' && node.rootSlotContent) slots.push(path);
        node.children?.forEach((node, i) => walk(node, [...path, i]));
      }; walk(variants[0].spec, []);
      if (slots.length !== 1) throw Error('react-composition-root-slot-unavailable');
      references.push({ specPath: paths[0].specPath, parent: main.input, receipt: main.receipt, variantName, slotSpecPath: slots[0] });
      row.status = 'matched'; row.operationId = main.input.operation.id; row.variantName = variantName; review.matched++;
    } catch (error) { row.problems.push(error instanceof Error ? error.message : String(error)); }
  }
  if (review.matched === review.denominator && !review.problems.length) review.status = 'ready';
  return { review, references };
}
