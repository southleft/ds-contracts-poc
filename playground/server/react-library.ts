/** Local-only installable React downloads. Browser inputs are data, never paths or programs. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateComponents } from '../../scripts/generate-components.js';
import { packageReactLibrary } from '../../scripts/package-react-library.js';
import { MAX_BYTES, parseLibraryRequest } from './react-library-input.js';
import { readPreparedReactLibrary, retainPreparedReactLibrary } from './react-library-artifact.js';
export { parseLibraryRequest } from './react-library-input.js';


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
      let result: ReturnType<typeof readPreparedReactLibrary>;
      try { result = readPreparedReactLibrary(repoRoot, download[1]); }
      catch (error) {
        const message = error instanceof Error ? error.message : 'react-library-artifact-unavailable';
        json(res, message === 'react-library-artifact-not-found' ? 404 : 409, message); return;
      }
      res.setHeader('Content-Type', 'application/gzip'); res.setHeader('Content-Disposition', `attachment; filename="${result.receipt.filename}"`);
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Artifact-Sha256', result.receipt.tarballSha256);
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
      const artifact = retainPreparedReactLibrary(repoRoot, input, result);
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ filename: result.filename, name: result.name, sha256: result.tarballSha256, artifactId: artifact.id, downloadUrl: `/api/react-library/download/${artifact.id}` }));
    } catch (error) { json(res, 422, error instanceof Error ? error.message : 'React library generation failed.'); }
    finally { busy = false; }
  };
}
