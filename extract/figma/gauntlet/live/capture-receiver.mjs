// PHASE-1 capture receiver — a tiny localhost HTTP sink the Desktop Bridge
// plugin's sandbox can POST dump chunks to (manifest allows http://localhost:9226).
//
// Why: figma_execute tool responses have return-size limits and everything they
// return transits the agent's context. Streaming each chunk straight from the
// plugin sandbox to disk keeps the capture bankable and the context small —
// the tool response carries only a byte count.
//
// Usage: node extract/figma/gauntlet/live/capture-receiver.mjs <outDir> [port]
//   POST /chunk?name=<fileStem>   body saved verbatim to <outDir>/<fileStem>.json
//   GET  /list                    JSON manifest of received files (name, bytes)
//
// Capture-session tooling only — the offline gauntlet never needs this.
import { createServer } from 'node:http';
import { writeFileSync, readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2];
const port = Number(process.argv[3] ?? 9226);
if (!outDir) {
  console.error('usage: node capture-receiver.mjs <outDir> [port]');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === 'POST' && url.pathname === '/chunk') {
    const name = (url.searchParams.get('name') ?? 'unnamed').replace(/[^A-Za-z0-9._-]/g, '_');
    const parts = [];
    req.on('data', (d) => parts.push(d));
    req.on('end', () => {
      const body = Buffer.concat(parts);
      const file = path.join(outDir, `${name}.json`);
      writeFileSync(file, body);
      console.log(`received ${name} (${body.length} bytes)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, name, bytes: body.length }));
    });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/file') {
    // Serve a banked file back to the plugin sandbox (e.g. the dump engine
    // source — sent once to disk, fetched per chunk call instead of riding
    // every figma_execute payload).
    const name = (url.searchParams.get('name') ?? '').replace(/[^A-Za-z0-9._-]/g, '_');
    try {
      const data = readFileSync(path.join(outDir, name));
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('no such file');
    }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/list') {
    const files = readdirSync(outDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ name: f, bytes: statSync(path.join(outDir, f)).size }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(files));
    return;
  }
  res.writeHead(404);
  res.end('not found');
});
server.listen(port, '127.0.0.1', () => console.log(`capture receiver on http://localhost:${port} → ${outDir}`));
