/**
 * Figma URL import — the launch-gate path. `importFromUrl` is the SAME
 * function the CLI runs (extract/figma/rest/fetch.ts, browser-pure by
 * construction): figma.com URL + token → dump v1 + MapReport, variables
 * endpoint 403 degrading BY NAME, never silently.
 *
 * The demo mode serves the committed REST fixtures through the client's
 * injectable fetch — the code path from URL-parse to proposal is byte-for-
 * byte the live path; only the transport is swapped. That is deliberate:
 * what CI referees (roundtrip-rest) is what the demo shows.
 */
import { importFromUrl } from '../../../extract/figma/rest/fetch.js';
import { dumpCapturesHidden, proposeBatchFromDump, proposeFromFigmaDump } from '../../../core/index.js';

// Captured tokens (dump v1.4 `_variables`) — the designer's real variables,
// built by the SAME core function the receipts referee.
export { capturedTokensFromDump } from '../../../core/index.js';
import { contractIdByKey, contractIdByName, contractsById } from './data.js';
import { sessionRegistry } from './session-registry.js';
import { activeTokens } from './token-source.js';

export type FigmaImportResult = Awaited<ReturnType<typeof importFromUrl>>;
export type FigmaProposal = ReturnType<typeof proposeFromFigmaDump> & { setName: string };

/** The fixture canvas: the repo's own Badge set, REST-shaped (fixtures/badge.rest.json). */
export const DEMO_URL =
  'https://www.figma.com/design/8nim1d0IPnehMxA7B7SYxC/DS-Contracts-POC?node-id=101-1';

export function importFigmaUrl(url: string, token: string): Promise<FigmaImportResult> {
  return importFromUrl(url, token);
}

/** Demo import: same importFromUrl, fixture-backed fetch. `degraded` answers
 *  the variables endpoint with the 403 a non-Enterprise plan returns. */
export async function importFigmaDemo(opts: { degraded: boolean }): Promise<FigmaImportResult> {
  const [nodes, variables] = await Promise.all([
    import('../../../extract/figma/rest/fixtures/badge.rest.json'),
    import('../../../extract/figma/rest/fixtures/variables.rest.json'),
  ]);
  const respond = (status: number, body: unknown) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  const fetchImpl = (url: string) => {
    if (url.includes('/variables/local')) {
      return opts.degraded
        ? respond(403, { status: 403, err: 'Incompatible plan for this endpoint' })
        : respond(200, variables.default);
    }
    if (url.includes('/nodes?ids=')) return respond(200, nodes.default);
    return respond(404, { err: 'not served by the demo fixture' });
  };
  return importFromUrl(DEMO_URL, 'demo-fixture-token', { fetchImpl });
}

export type DumpProposalBatch = ReturnType<typeof proposeBatchFromDump>;

/** Every component set in a dump (imported, pasted, or bridge-delivered) → a
 *  proposed contract + its receipts, with PER-SET ISOLATION (owner field
 *  case: a real UI-kit dump carries template/private-helper sets whose
 *  proposal can refuse) — one set failing must not kill the batch, and raw
 *  validator JSON never leaves the engine as a headline. The isolation loop
 *  itself is core (proposeBatchFromDump — the code CI's receipts referee);
 *  this wrapper only supplies the playground's live corpus and options. */
export function proposalsFromDump(dump: FigmaImportResult['dump']): DumpProposalBatch {
  // The ACTIVE corpus — nearest-token suggestions and hex→token matching
  // come from the user's pasted tree when one is applied. mintUnbound:
  // values whose variable names are unrecoverable (the non-Enterprise
  // 403) become provisional `imported.*` tokens the proposal binds — the
  // degraded import stays styled at literal fidelity (core/mint-tokens.ts).
  // SESSION LINKING (dump v1.5): the scope is repo contracts PLUS every
  // contract already imported this session (workspace) — a composite
  // imported after its children LINKS to them (componentSetKey first, name
  // fallback; a name match whose keys contradict is refused by name).
  const session = sessionRegistry();
  return proposeBatchFromDump(dump, {
    corpus: activeTokens().corpus,
    contractIdByName: new Map([...contractIdByName, ...session.idByName]),
    contractIdByKey: new Map([...contractIdByKey, ...session.idByKey]),
    // Session stubs at LOWEST precedence (repo, then real session contracts
    // win the id) — visible so the class-③ cross-population id-collision
    // guard can read a stub claim's key evidence.
    contractsById: new Map([...session.stubs, ...contractsById, ...session.contracts]),
    // Ids claimed by THIS workspace's imports (contracts AND stubs; never
    // the repo): a proposal whose name-derived id lands on one of these
    // with a CONTRADICTING componentSetKey takes a deterministic suffix —
    // the RadioButton / "Radio button" false-cycle fix (live-gauntlet ③).
    // Same-key landings keep the base id: the re-import/heal path.
    sessionClaimedIds: new Set([...session.stubs.keys(), ...session.contracts.keys()]),
    fileKey: dump._provenance?.fileKey ?? null,
    mintUnbound: true,
    // Visible-in-default-variant boolean defaults are evidence only when the
    // dump's producer captures `hidden` (dump v1.1+ provenance).
    hiddenCaptured: dumpCapturesHidden(dump._provenance),
  });
}
