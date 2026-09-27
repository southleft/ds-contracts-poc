/**
 * The playground's Figma dump → React library request, without a browser.
 *
 * This is the engine half of the Playground page's JSON-dump import
 * (Playground.tsx: proposalsFromDump → capturedTokensFromDump → dumpClosure →
 * recordFigmaClosure → applyProposal) followed by "Prepare React library"
 * (validateContractText → linkedImportScope → reactLibraryFamily →
 * applyLinkedScope). It calls the SAME engine functions in the SAME order on a
 * fresh session, so the request it returns is the request the app would POST
 * to /api/react-library for the same dump. It sets no UI state and invents no
 * default the page does not use; anything the page would refuse, it refuses
 * by the page's own reason.
 */
import { dumpClosure } from '../../../extract/figma/rest/closure.js';
import { icons } from './data.js';
import { recordFigmaClosure } from './figma-import-workspace.js';
import { capturedTokensFromDump, proposalsFromDump, type FigmaImportResult, type FigmaProposal } from './figma-import.js';
import { applyLinkedScope, linkedImportScope } from './linked-scope.js';
import { reactLibraryFamily } from './react-library.js';
import { sessionRegistry } from './session-registry.js';
import { setChildStubs } from './stub-contracts.js';
import { activeTokens, setCapturedTokens, setMintedTokens } from './token-source.js';
import { validateContractText } from './validate.js';
import { recordImport } from './workspace.js';

export interface HeadlessLibraryRequest {
  rootId: string;
  contracts: unknown[];
  tokens: unknown;
  icons: Array<[string, string]>;
}

export interface HeadlessImportResult {
  request: HeadlessLibraryRequest;
  /** The set the page would display (the closure's requested set, else the first proposal). */
  setName: string;
  proposed: string[];
  skipped: Array<{ setName: string; reason: string }>;
  notes: string[];
}

export function figmaDumpToLibraryRequest(dump: FigmaImportResult['dump']): HeadlessImportResult {
  const batch = proposalsFromDump(dump);
  if (batch.proposals.length === 0) {
    throw Error(batch.skipped.length > 0
      ? `figma-to-react-nothing-proposed: none of the ${batch.skipped.length} component set(s) could be proposed — `
        + batch.skipped.map(s => `${s.setName}: ${s.reason}`).join('; ')
      : 'figma-to-react-no-component-set: no component set found in the dump');
  }
  const receipts = () => ({ source: 'Figma JSON import', groups: [] });
  const captured = capturedTokensFromDump(dump as Record<string, unknown>);
  const closure = dumpClosure(dump);
  const family = closure ? recordFigmaClosure(batch, closure, receipts, captured, 'json') : undefined;
  const proposal: FigmaProposal = family?.proposal ?? batch.proposals[0];

  // applyProposal, engine half: the minted and captured layers register before
  // validation, then child stubs, then the workspace record.
  setMintedTokens(proposal.mintedTokens && proposal.mintedTokens.count > 0 ? proposal.mintedTokens : null);
  setCapturedTokens(captured);
  setChildStubs(proposal.childStubs ?? null);
  const contractText = JSON.stringify(proposal.contract, null, 2);
  if (!family?.recorded) {
    recordImport({
      name: proposal.setName,
      contractId: String((proposal.contract as { id?: unknown }).id ?? ''),
      source: 'json',
      contractText,
      receipts: receipts(),
      ...(proposal.mintedTokens && proposal.mintedTokens.count > 0 ? { mintedTokens: proposal.mintedTokens } : {}),
      ...(captured && captured.count > 0 ? { capturedTokens: captured } : {}),
      ...(proposal.childStubs && proposal.childStubs.length > 0 ? { childStubs: proposal.childStubs } : {}),
    });
  }

  // "Prepare React library": only a valid contract can be packaged.
  const validation = validateContractText(contractText);
  if (validation.status !== 'valid') {
    const detail = 'issues' in validation ? JSON.stringify((validation as { issues?: unknown }).issues).slice(0, 2000) : validation.status;
    throw Error(`figma-to-react-contract-not-valid: ${validation.status}: ${detail}`);
  }
  const tokenSource = activeTokens();
  const scope = linkedImportScope(validation.contract, validation.contracts, sessionRegistry().layersByContractId, tokenSource.inventory);
  return {
    request: {
      rootId: validation.contract.id,
      contracts: reactLibraryFamily(validation.contract, validation.contracts),
      tokens: applyLinkedScope(tokenSource.tree, scope),
      icons: [...icons],
    },
    setName: proposal.setName,
    proposed: batch.proposals.map(p => p.setName),
    skipped: batch.skipped.map(s => ({ setName: s.setName, reason: s.reason })),
    notes: (proposal.notes ?? []).map(String),
  };
}
