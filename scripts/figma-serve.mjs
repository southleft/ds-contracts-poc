/**
 * Local script server for the Sync Runner plugin (figma-sync/plugin/).
 *   npm run figma:serve
 * Serves figma-sync/ with CORS, a runner manifest (tokens → batches →
 * arrange), and accepts the runner's POST result at /runner-result
 * (written to figma-sync/.runner-result.json for the agent/CI to read).
 *
 * INTEGRITY: the manifest carries a SHA-256 per script (`integrity` array;
 * the plain `scripts` name array is kept for back-compat). The plugin hashes
 * every fetched script and refuses to execute on mismatch, so a process that
 * swaps script bytes between manifest fetch and script fetch is caught.
 * Hashes are computed at startup (logged) and re-computed per manifest
 * request so the manifest always describes the bytes currently on disk.
 *
 * TOKEN (opt-in): a same-attacker process could serve BOTH manifest and
 * scripts on 8765. Run `TOKEN=1 npm run figma:serve` to require a random
 * shared token (printed at startup) as ?token= on every request — the plugin
 * reads it from figma.clientStorage ('ds_contracts_runner_token'; see the
 * plugin header for the one-line console snippet). Default off so existing
 * flows keep working.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'figma-sync');
const PORT = Number(process.env.PORT ?? 8765); // plugin default is 8765

const TOKEN_REQUIRED = process.env.TOKEN === '1';
const TOKEN = TOKEN_REQUIRED ? randomBytes(16).toString('hex') : null;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Manifest scripts in run order: tokens → batches → arrange. */
function manifestScriptNames() {
  const batches = readdirSync(DIR).filter((f) => /^batch-\d+\.js$/.test(f)).sort();
  const scripts = ['01-tokens.js', ...batches];
  if (existsSync(path.join(DIR, 'arrange.js'))) scripts.push('arrange.js');
  return scripts;
}

function buildManifest() {
  const scripts = manifestScriptNames();
  const integrity = scripts.map((name) => ({
    name,
    sha256: sha256(readFileSync(path.join(DIR, name))),
  }));
  // `scripts` (plain names) kept for back-compat with older runners.
  return { scripts, integrity };
}

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  if (TOKEN_REQUIRED && url.searchParams.get('token') !== TOKEN) {
    res.statusCode = 403;
    return res.end('forbidden: missing/invalid ?token= (see the TOKEN printed by figma:serve at startup)');
  }
  if (req.method === 'POST' && url.pathname === '/runner-result') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      writeFileSync(path.join(DIR, '.runner-result.json'), body);
      console.log('runner result received:', body.slice(0, 200));
      res.end('ok');
    });
    return;
  }
  if (url.pathname === '/runner-manifest.json') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(buildManifest()));
  }
  const file = path.join(DIR, url.pathname.replace(/^\//, ''));
  if (!file.startsWith(DIR + path.sep) || !existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
  res.end(readFileSync(file));
}).listen(PORT, '127.0.0.1', () => {
  console.log(`figma-sync served at http://127.0.0.1:${PORT} (runner manifest + result sink)`);
  try {
    for (const { name, sha256: hash } of buildManifest().integrity) {
      console.log(`  ${hash}  ${name}`);
    }
  } catch (e) {
    console.warn('  (could not hash manifest scripts at startup:', String(e && e.message ? e.message : e) + ')');
  }
  if (TOKEN_REQUIRED) {
    console.log(`TOKEN required on every request: ?token=${TOKEN}`);
    console.log(`  In the Figma plugin console, run once:`);
    console.log(`  await figma.clientStorage.setAsync('ds_contracts_runner_token', '${TOKEN}')`);
  }
});
