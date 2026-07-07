/**
 * Local script server for the Sync Runner plugin (figma-sync/plugin/).
 *   npm run figma:serve
 * Serves figma-sync/ with CORS, a runner manifest (tokens → batches →
 * arrange), and accepts the runner's POST result at /runner-result
 * (written to figma-sync/.runner-result.json for the agent/CI to read).
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'figma-sync');
const PORT = 8765;

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();
  if (req.method === 'POST' && req.url === '/runner-result') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      writeFileSync(path.join(DIR, '.runner-result.json'), body);
      console.log('runner result received:', body.slice(0, 200));
      res.end('ok');
    });
    return;
  }
  if (req.url === '/runner-manifest.json') {
    const batches = readdirSync(DIR).filter((f) => /^batch-\d+\.js$/.test(f)).sort();
    const scripts = ['01-tokens.js', ...batches];
    if (existsSync(path.join(DIR, 'arrange.js'))) scripts.push('arrange.js');
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ scripts }));
  }
  const file = path.join(DIR, (req.url ?? '/').replace(/^\//, ''));
  if (!file.startsWith(DIR) || !existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
  res.end(readFileSync(file));
}).listen(PORT, '127.0.0.1', () => console.log(`figma-sync served at http://127.0.0.1:${PORT} (runner manifest + result sink)`));
