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
import { proposeBatchFromDump, proposeFromFigmaDump } from '../../../core/index.js';
import { contractIdByName } from './data.js';
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
  return proposeBatchFromDump(dump, {
    corpus: activeTokens().corpus,
    contractIdByName,
    fileKey: dump._provenance?.fileKey ?? null,
    mintUnbound: true,
  });
}
