/** Local-only installable React downloads. Browser inputs are data, never paths or programs. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ContractSchema, contractDependencyEdges, type Contract } from '../../scripts/contract-schema.js';
import { generateComponents } from '../../scripts/generate-components.js';
import { packageReactLibrary } from '../../scripts/package-react-library.js';
import type { TokenTreeInput } from '../../core/tokens.js';

const MAX_BYTES = 5 * 1024 * 1024;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function assertData(value: unknown, depth = 0): void {
  if (depth > 64) throw Error('react-library-data-too-deep');
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('react-library-unsafe-data-key');
    assertData(child, depth + 1);
  }
}
export function parseLibraryRequest(value: unknown): { root: Contract; contracts: Contract[]; tokens: TokenTreeInput; icons: Array<[string, string]> } {
  assertData(value);
  if (!record(value) || Object.keys(value).some(k => !['rootId', 'contracts', 'tokens', 'icons'].includes(k))) throw Error('react-library-invalid-request');
  if (!Array.isArray(value.contracts) || value.contracts.length < 1 || value.contracts.length > 30) throw Error('react-library-family-limit: expected 1–30 components');
  const contracts = value.contracts.map(c => {
    const parsed = ContractSchema.safeParse(c);
    if (!parsed.success) throw Error('react-library-contract-invalid: ' + parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
    return parsed.data;
  });
  const ids = new Set<string>(), names = new Set<string>();
  for (const c of contracts) {
    // These names become folder names and ESM exports, never arbitrary paths.
    if (!/^[A-Z][A-Za-z0-9]*$/.test(c.name)) throw Error('react-library-invalid-component-name');
    if (ids.has(c.id) || names.has(c.name.toLowerCase())) throw Error('react-library-duplicate-component');
    ids.add(c.id); names.add(c.name.toLowerCase());
  }
  const root = contracts.find(c => c.id === value.rootId);
  if (!root) throw Error('react-library-root-missing');
  const byId = new Map(contracts.map(c => [c.id, c])), reached = new Set<string>();
  const visit = (c: Contract) => {
    if (reached.has(c.id)) return;
    reached.add(c.id);
    for (const edge of contractDependencyEdges(c)) {
      const child = byId.get(edge.id);
      if (!child) throw Error(`react-library-dependency-missing: ${edge.id}`);
      visit(child);
    }
  };
  visit(root);
  if (reached.size !== contracts.length) throw Error('react-library-unrelated-components');
  const tokens = value.tokens;
  if (!record(tokens) || Object.keys(tokens).some(k => !['primitives', 'semantic', 'light', 'dark', 'brands'].includes(k)) || !['primitives', 'semantic', 'light', 'dark', 'brands'].every(k => record(tokens[k]))) throw Error('react-library-invalid-tokens');
  if (Object.entries(tokens.brands as Record<string, unknown>).some(([key, tree]) => !/^[a-z0-9][a-z0-9-]*$/.test(key) || !record(tree))) throw Error('react-library-invalid-brand');
  if (!Array.isArray(value.icons) || value.icons.length > 1000) throw Error('react-library-invalid-icons');
  const iconNames = new Set<string>();
  const icons = value.icons.map(row => {
    if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(row[0]) || typeof row[1] !== 'string' || row[1].length > 200_000 || iconNames.has(row[0])) throw Error('react-library-invalid-icon');
    iconNames.add(row[0]); return row as [string, string];
  });
  return { root, contracts, tokens: tokens as unknown as TokenTreeInput, icons };
}

export async function buildReactLibrary(repoRoot: string, input: ReturnType<typeof parseLibraryRequest>) {
  const parent = path.join(repoRoot, 'private', 'react-library-downloads');
  mkdirSync(parent, { recursive: true });
  const work = mkdtempSync(path.join(parent, 'library-'));
  const inputs = path.join(work, 'inputs'), generated = path.join(work, 'generated'), iconsDir = path.join(inputs, 'icons');
  mkdirSync(iconsDir, { recursive: true });
  const contractFiles = input.contracts.map((contract, index) => {
    const file = path.join(inputs, `${index}.contract.json`); writeFileSync(file, JSON.stringify(contract, null, 2), { flag: 'wx' }); return file;
  });
  const tokenFiles: string[] = [];
  const token = (slot: string, tree: Record<string, unknown>) => {
    const file = path.join(inputs, `${slot}.tokens.json`); writeFileSync(file, JSON.stringify(tree), { flag: 'wx' }); tokenFiles.push(`${slot}=${file}`);
  };
  for (const slot of ['primitives', 'semantic', 'light', 'dark'] as const) token(slot, input.tokens[slot]);
  for (const [brand, tree] of Object.entries(input.tokens.brands)) token(`brand.${brand}`, tree);
  for (const [name, svg] of input.icons) writeFileSync(path.join(iconsDir, `${name}.svg`), svg, { flag: 'wx' });
  const result = await generateComponents({ contractFiles, tokenFiles, iconsDir, outDir: generated, stories: false, regenerateHint: 'Export this family again from the local Contract Playground.' });
  if (result.refused.length || result.generated.length !== input.contracts.length) throw Error('react-library-generation-refused: ' + result.refused.flatMap(r => r.violations).join('; '));
  if (result.tokensCss.danglingAliases.length) throw Error('react-library-token-alias-missing: ' + result.tokensCss.danglingAliases.join(', '));
  const library = await packageReactLibrary(generated, input.root.name, work, repoRoot);
  writeFileSync(path.join(work, 'receipt.json'), JSON.stringify({ rootId: input.root.id, contracts: input.contracts.map(c => ({ id: c.id, name: c.name })), generated: result.generated, requiredFacts: result.requiredFacts, tarballSha256: library.tarballSha256 }, null, 2), { flag: 'wx' });
  return { ...library, bytes: readFileSync(library.tarball), filename: path.basename(library.tarball) };
}

export function createReactLibraryService(repoRoot: string, build = buildReactLibrary) {
  let busy = false;
  const downloads = new Map<string, Awaited<ReturnType<typeof buildReactLibrary>>>();
  const json = (res: ServerResponse, status: number, error: string) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify({ error })); };
  return async (req: IncomingMessage, res: ServerResponse) => {
    let host: URL;
    try {
      host = new URL(`http://${req.headers.host}`);
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') || !['localhost', '127.0.0.1', '[::1]'].includes(host.hostname) || host.username || host.password) throw Error();
    } catch { json(res, 403, 'Local access only.'); return; }
    if ((req.headers.origin && req.headers.origin !== host.origin) || req.headers['sec-fetch-site'] === 'cross-site') { json(res, 403, 'Same-origin access required.'); return; }
    const route = (req.url ?? '').split('?')[0];
    const download = /^\/api\/react-library\/download\/([a-f0-9-]+)$/.exec(route);
    if (req.method === 'GET' && download) {
      const result = downloads.get(download[1]);
      if (!result) { json(res, 404, 'Download expired. Prepare the React library again.'); return; }
      res.setHeader('Content-Type', 'application/gzip'); res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Artifact-Sha256', result.tarballSha256);
      res.end(result.bytes); return;
    }
    if (route !== '/api/react-library') { json(res, 404, 'Unknown React library route.'); return; }
    if (req.method !== 'POST') { json(res, 405, 'Use POST.'); return; }
    if (!req.headers['content-type']?.startsWith('application/json')) { json(res, 415, 'Send JSON.'); return; }
    if (Number(req.headers['content-length']) > MAX_BYTES) { json(res, 413, 'React library request exceeds 5 MB.'); return; }
    if (busy) { json(res, 409, 'A React library is already being prepared.'); return; }
    busy = true;
    try {
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > MAX_BYTES) { json(res, 413, 'React library request exceeds 5 MB.'); return; } chunks.push(Buffer.from(chunk)); }
      let input: ReturnType<typeof parseLibraryRequest>;
      try { input = parseLibraryRequest(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (error) { json(res, 400, error instanceof Error ? error.message : 'Invalid React library input.'); return; }
      const result = await build(repoRoot, input);
      const id = randomUUID(); downloads.set(id, result);
      if (downloads.size > 10) downloads.delete(downloads.keys().next().value!);
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ filename: result.filename, name: result.name, sha256: result.tarballSha256, downloadUrl: `/api/react-library/download/${id}` }));
    } catch (error) { json(res, 422, error instanceof Error ? error.message : 'React library generation failed.'); }
    finally { busy = false; }
  };
}
