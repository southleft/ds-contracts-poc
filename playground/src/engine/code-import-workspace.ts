import type { ProposeCodeResult } from '../../../core/propose-code.js';
import type { Receipts } from '../receipts.js';
import { recordImports, type RecordImportResult } from './workspace.js';

/** Preserve the complete readable source family, including each component's
 * own tokens. These are source proposals, never fabricated child stubs. */
export function recordCodeProposals(result: ProposeCodeResult, receipts: Receipts): RecordImportResult[] {
  return recordImports(result.proposals.map(({ name, proposal }) => ({
    name,
    contractId: String(proposal.contract.id ?? ''),
    source: 'code',
    contractText: JSON.stringify(proposal.contract, null, 2),
    receipts,
    ...(proposal.mintedTokens ? { mintedTokens: proposal.mintedTokens } : {}),
  })));
}
