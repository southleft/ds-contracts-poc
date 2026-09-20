import { partitionClosureRefusals, pickRequestedContract, type DumpClosure } from '../../../extract/figma/rest/closure.js';
import type { DumpProposalBatch, FigmaProposal } from './figma-import.js';
import type { CapturedTokenLayer } from './token-source.js';
import type { Receipts } from '../receipts.js';
import { recordImports, type WorkspaceSource } from './workspace.js';

/** Save the dependency-complete proposal batch before displaying its parent.
 * The workspace's atomic cap check must not evict a just-imported child. */
export function recordFigmaClosure(batch: DumpProposalBatch, closure: DumpClosure,
  receiptsFor: (proposal: FigmaProposal) => Receipts, captured: CapturedTokenLayer | null, source: WorkspaceSource = 'figma') {
  const { refused, closureChildren } = partitionClosureRefusals(batch.skipped, closure);
  if (refused.length) throw Error('figma-requested-set-refused: ' + refused.map(row => `${row.setName}: ${row.reason}`).join('; '));
  const requested = closure.requested[0];
  if (!requested) throw Error('figma-requested-set-missing');
  const selected = pickRequestedContract(batch.proposals.map((proposal, index) => ({ file: String(index), contract: proposal.contract })), requested.nodeId);
  if ('refusal' in selected) throw Error(selected.refusal);
  const proposal = batch.proposals[Number(selected.file)];
  const ordered = [proposal, ...batch.proposals.filter(row => row !== proposal)];
  const records = recordImports(ordered.map(row => {
    const receipts = receiptsFor(row);
    return {
      name: row.setName, contractId: String(row.contract.id ?? ''), source,
      contractText: JSON.stringify(row.contract, null, 2),
      receipts: closureChildren.length ? { ...receipts, groups: [...receipts.groups, {
        title: 'Child sets retained as provisional stubs', kind: 'note' as const,
        entries: closureChildren.map(child => ({ message: child.note })),
      }] } : receipts,
      ...(row.mintedTokens ? { mintedTokens: row.mintedTokens } : {}),
      ...(captured ? { capturedTokens: captured } : {}),
      ...(row.childStubs?.length ? { childStubs: row.childStubs } : {}),
    };
  }));
  return { proposal, recorded: records[0] };
}
