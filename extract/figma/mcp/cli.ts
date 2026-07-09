/**
 * CLI for the desktop-MCP import path (client.ts owns the MCP transport,
 * import.ts the join + mapping; this file owns argv/env/fs — the only
 * node-bound layer) — URL in, dump v1 + proposed contract(s) out.
 *
 *   npm run extract:figma:mcp -- <figma-node-url> [--token <token>] [--target Name]
 *                                [--out dir] [--server url] [--fixture path]
 *
 * Prereqs, and the friendly errors when they're missing:
 *   · Figma desktop app running with the Dev Mode MCP server enabled
 *     (Figma menu → Preferences → Enable local MCP Server) — connection
 *     refused explains exactly that;
 *   · the target file open as the ACTIVE tab (the server takes bare node ids,
 *     no file key — verified live) — a node miss explains exactly that;
 *   · a REST token (--token or FIGMA_TOKEN) for the node-tree structure. Any
 *     plan works: the Enterprise-only variables endpoint is exactly what the
 *     MCP join replaces.
 *
 * The proposer runs with `mintUnbound: true`: anything the join could not
 * resolve BY NAME (ambiguities are receipts, never guesses) still ships at
 * literal fidelity as a provisional `imported.*` token. `--fixture` records
 * the REST + MCP responses for offline replay (receipt.ts, eval candidate).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { kebab } from '../../types.js';
import { isDumpSet } from '../types.js';
import { loadTokenCorpus } from '../tokens.js';
import { figmaProposalsReport, loadContracts, proposeFromDump, type FigmaProposalResult } from '../propose.js';
import { connectMcp, MCP_DEFAULT_URL } from './client.js';
import { importFromUrlViaMcp, McpToolError } from './import.js';

function usage(): never {
  console.error(
    'Usage: npm run extract:figma:mcp -- <figma-node-url> [--token <token>] [--target Name] [--out dir] [--server url] [--fixture path]\n' +
      '  Token: --token or the FIGMA_TOKEN env var (any plan — no Enterprise gating on this path).',
  );
  process.exit(2);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const readFlag = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const token = readFlag('--token') ?? process.env.FIGMA_TOKEN;
  const target = readFlag('--target');
  const outDir = readFlag('--out') ?? path.join('extract', 'out', 'figma', 'mcp');
  const serverUrl = readFlag('--server') ?? MCP_DEFAULT_URL;
  const fixturePath = readFlag('--fixture');
  const url = args[0];
  if (!url || !token) usage();

  let mcp;
  try {
    mcp = await connectMcp(serverUrl);
  } catch (e) {
    if (e instanceof TypeError || /fetch failed|ECONNREFUSED|ConnectionRefused/i.test(String(e))) {
      console.error(
        `Cannot reach the Figma Dev Mode MCP server at ${serverUrl}.\n` +
          'Enable it in the Figma DESKTOP app: Figma menu → Preferences → Enable local MCP Server (Dev Mode), then retry.',
      );
      process.exit(1);
    }
    throw e;
  }

  let result;
  try {
    result = await importFromUrlViaMcp(url, token, mcp, target ? { target } : {});
  } catch (e) {
    if (e instanceof McpToolError && /No node could be found/i.test(e.message)) {
      console.error(
        `${e.message}\n` +
          `The Dev Mode MCP server only answers for the document in the desktop app's ACTIVE tab — ` +
          `open ${url} in the Figma desktop app (not the browser), keep that tab focused, and retry.`,
      );
      process.exit(1);
    }
    throw e;
  }
  const { dump, report, augment, fixture } = result;

  const root = process.cwd();
  mkdirSync(path.resolve(root, outDir), { recursive: true });
  const dumpPath = path.resolve(root, outDir, 'mcp-dump.json');
  writeFileSync(dumpPath, JSON.stringify(dump, null, 2) + '\n');
  console.log(`✔ ${report.sets.length} set(s) [${report.sets.join(', ')}] → ${path.relative(root, dumpPath)}`);

  // The join receipt: names recovered, and everything honestly left unbound.
  for (const r of augment.resolved) {
    console.error(`resolved [${r.via}] ${r.variableId} → "${r.name}" (${r.occurrences} occurrence(s))`);
  }
  for (const u of augment.unresolved) {
    const at = u.occurrences.map((o) => `${o.nodePath} ${o.field}`).join(', ');
    console.error(
      `unresolved ${u.variableId}${at ? ` at ${at}` : ''}: ${u.reason}` +
        (u.candidates.length > 0 ? ` — candidates by name: ${u.candidates.join(', ')}` : ''),
    );
  }
  console.error(`get_variable_defs calls: ${augment.defsCalls}`);
  for (const n of report.notes) console.error(`note: ${n}`);
  for (const d of report.degradations) {
    console.error(`degraded [${d.code}] ${d.nodePath}${d.field ? ` ${d.field}` : ''}: ${d.message}`);
  }
  if (report.sets.length === 0) process.exit(1);

  // Propose, minting whatever stayed unresolved — refusals keep their receipts,
  // styles keep their literal fidelity.
  const corpus = loadTokenCorpus(root);
  const loaded = loadContracts(path.resolve(root, 'contracts'));
  const results: Array<{ setName: string; proposal: FigmaProposalResult }> = [];
  for (const [name, value] of Object.entries(dump)) {
    if (name === '_provenance' || !isDumpSet(value)) continue;
    const proposal = proposeFromDump(value, {
      corpus,
      contractIdByName: loaded.byName,
      contractsById: loaded.byId,
      fileKey: fixture.fileKey,
      mintUnbound: true,
    });
    results.push({ setName: name, proposal });
    const file = path.resolve(root, outDir, `${kebab(name)}.contract.proposed.json`);
    writeFileSync(file, JSON.stringify(proposal.contract, null, 2) + '\n');
    console.log(
      `✔ ${name} → ${path.relative(root, file)} (${proposal.notes.length} notes, ${proposal.unbound.length} unbound, ${proposal.mintedTokens?.count ?? 0} minted)`,
    );
  }
  const reportPath = path.resolve(root, outDir, 'figma-proposals.md');
  writeFileSync(reportPath, figmaProposalsReport(results) + '\n');
  console.log(`✔ report → ${path.relative(root, reportPath)}`);

  if (fixturePath) {
    const resolved = path.resolve(root, fixturePath);
    mkdirSync(path.dirname(resolved), { recursive: true });
    writeFileSync(resolved, JSON.stringify(fixture, null, 2) + '\n');
    console.log(`✔ fixture → ${path.relative(root, resolved)}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
