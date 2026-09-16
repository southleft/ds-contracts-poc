/** A source-owned nested root at its observed inputs, not a fabricated matrix. */
import { revisionOf } from '../core/contract-provenance.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import { projectReactRootVisual, type ReactRootVisual } from './react-root-visual.js';
import type { ReactSourceProgram } from './react-source-program.js';
import type { ReactOwnership } from './react-ownership.js';
import type { CapturedNode } from '../extract/computed/lib.js';
import type { ReactStyleOrigin } from './react-style-origin.js';
import type { ReactChildContext } from './react-child-context.js';

export interface ReactChildRoot {
  version: 1;
  qualification: 'observed-child-root-draft';
  acceptedContract: null;
  inputRevision: string;
  instanceId: string;
  draft: ReactRootVisual['roots'][number];
  heldProps: Record<string, unknown>;
  problems: string[];
}
export function deriveReactChildRoot(program: ReactSourceProgram, ownership: ReactOwnership,
  tree: CapturedNode, styleOrigin: ReactStyleOrigin, instanceId: string, context?: ReactChildContext): ReactChildRoot {
  const instance = ownership.components.find(c => c.id === instanceId);
  if (!instance?.parent || instance.roots.length !== 1 || instance.roots[0] === '')
    throw Error('react-child-root-nested-source-required');
  const projection = projectReactRootVisual(program, ownership, tree, styleOrigin, new Set([instanceId]), context);
  const draft = projection.roots.find(r => r.instanceId === instanceId);
  if (projection.problems.length || !draft || draft.status !== 'native-compiled' || draft.problems.length || !draft.contract || !draft.tokens)
    throw Error('react-child-root-projection-unavailable:' + (draft?.problems.join(',') ?? projection.problems.join(',')));
  draft.contract.name = draft.source.exportName;
  draft.contract.description = `Observed ${draft.source.exportName} root at the captured caller inputs; other inputs and behavior remain unqualified.`;
  // A single observed child bypasses the property-matrix sizing assembly.
  // Carry the same authenticated fixed-size facts into this projection; never
  // promote an automatic or caller-overridden measured box into a declaration.
  for (const size of draft.sourceSizing ?? []) if (size.status === 'fixed') {
    if (!size.value || !/^\d+(?:\.\d+)?px$/.test(size.value)) throw Error('react-child-fixed-size-unqualified');
    draft.contract.anatomy.root.literals = { ...draft.contract.anatomy.root.literals, [size.channel]: size.value };
  }
  draft.native = createFigmaEngine({ tokens: { primitives: draft.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
    icons: new Map() }).compileComponentData(draft.contract, new Map([[draft.contract.id, draft.contract]]));
  return { version: 1, qualification: 'observed-child-root-draft', acceptedContract: null,
    inputRevision: revisionOf({ projection: projection.inputRevision, instanceId }), instanceId,
    draft, heldProps: structuredClone(instance.props), problems: [] };
}
