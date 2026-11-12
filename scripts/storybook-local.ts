/**
 * A library's own Storybook as the reader's input (notes/v1-product-plan.md, B1): built with the library's own
 * Storybook binary, then served as static files on a fixed local port, so the pinned reader (through Docker's host
 * gateway, storybook-reader.ts) and the contract step read the library itself, not a public URL. A built Storybook is a
 * fixed set of files: its sha256 goes in the receipt, and the fixed port keeps the URL in stories.json the same run to run.
 *
 *   npx tsx scripts/storybook-local.ts --dir <library> --out <new folder>   build, then serve until Ctrl-C
 *
 * Refused by name before anything is built: storybook-dir-missing, storybook-missing (no .storybook/ config, or no
 * storybook binary in the library's or a parent's node_modules), storybook-renderer-not-react (the reader reads React's
 * own tree); after the build: storybook-build-failed (with the log), storybook-index-missing (no index.json: Storybook 6
 * and older). A port another server holds is storybook-port-busy. Nothing here measures or scores anything.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STORYBOOK_PORT = 6116;
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.map': 'application/json', '.txt': 'text/plain', '.mp4': 'video/mp4' };

/** What the library has, or the named refusal: its .storybook/ config, its storybook binary (here or hoisted), a React renderer. */
export function localStorybookPreflight(dir: string): { dir: string; bin: string } {
  const root = path.resolve(dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw Error(`storybook-dir-missing: ${root}`);
  const config = path.join(root, '.storybook');
  if (!existsSync(config) || !readdirSync(config).some((f) => /^main\.[cm]?[jt]s$/.test(f))) throw Error(`storybook-missing: no .storybook/main.* in ${root}`);
  let bin: string | undefined;
  for (let at = root; !bin; at = path.dirname(at)) {
    const candidate = path.join(at, 'node_modules', '.bin', 'storybook');
    if (existsSync(candidate)) bin = candidate; else if (path.dirname(at) === at) break;
  }
  if (!bin) throw Error(`storybook-missing: no storybook binary in ${root}/node_modules/.bin or a parent's (install the library's dependencies first)`);
  const pkg = path.join(root, 'package.json'), manifest = existsSync(pkg) ? JSON.parse(readFileSync(pkg, 'utf8')) : {};
  const deps = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  if (!deps.some((d) => /^@storybook\/(react|nextjs)/.test(d)))
    throw Error(`storybook-renderer-not-react: ${pkg} names no @storybook/react* or @storybook/nextjs* framework (${deps.filter((d) => d.startsWith('@storybook/')).join(', ') || 'no @storybook/ package'})`);
  return { dir: root, bin };
}

/** sha256 over every built file, by sorted relative path and bytes. */
export function treeSha256(dir: string): string {
  const hash = createHash('sha256'), walk = (rel: string): void => {
    for (const e of readdirSync(path.join(dir, rel), { withFileTypes: true }).map((d) => d.name).sort()) {
      const child = rel ? `${rel}/${e}` : e;
      if (statSync(path.join(dir, child)).isDirectory()) walk(child); else hash.update(`${child}\0`).update(readFileSync(path.join(dir, child))).update('\0');
    }
  };
  walk('');
  return hash.digest('hex');
}

/** Build the library's Storybook into <out> (which must not exist), with its own binary; the log goes beside it. */
export function buildLocalStorybook(dir: string, out: string): { static: string; sha256: string; log: string } {
  const { dir: root, bin } = localStorybookPreflight(dir), target = path.resolve(out), log = `${target}.build.log`;
  if (existsSync(target)) throw Error(`storybook-out-exists: ${target}`);
  const r = spawnSync(bin, ['build', '--output-dir', target, '--quiet'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28,
    env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: '1' } });
  writeFileSync(log, `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? String(r.error) : ''}`);
  if (r.status !== 0) throw Error(`storybook-build-failed: exit ${r.status} (log ${log})`);
  if (!existsSync(path.join(target, 'index.json'))) throw Error(`storybook-index-missing: ${target} has no index.json (Storybook 7 or later writes it)`);
  return { static: target, sha256: treeSha256(target), log };
}

/** The hosts the pinned container reaches: 127.0.0.1 (Docker Desktop's host.docker.internal), and on Linux the docker0
 *  bridge address that host-gateway names. Never every interface. */
export function serveHosts(): string[] {
  const bridge = process.platform === 'linux' ? networkInterfaces().docker0?.find((a) => a.family === 'IPv4')?.address : undefined;
  return ['127.0.0.1', ...(bridge ? [bridge] : [])];
}

/** Serve a built Storybook's files on <port> at each host; a path outside the folder or a missing file is a 404. */
export async function serveStorybook(staticDir: string, port = STORYBOOK_PORT): Promise<{ url: string; close: () => void }> {
  const root = path.resolve(staticDir), servers: Server[] = [];
  const handle = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => {
    let file = path.join(root, decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname));
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(root + path.sep) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  };
  try {
    for (const host of serveHosts()) await new Promise<void>((resolve, reject) => {
      const s = createServer(handle).once('error', (e: NodeJS.ErrnoException) => reject(Error(`storybook-port-busy: ${host}:${port} (${e.code})`)));
      s.listen(port, host, () => { servers.push(s); resolve(); });
    });
  } catch (e) { for (const s of servers) s.close(); throw e; }
  return { url: `http://localhost:${port}/`, close: () => { for (const s of servers) s.close(); } };
}

/** The same server in a child process, for a caller whose spawnSync would block its own event loop (the runner). */
export function serveInChild(staticDir: string): Promise<{ url: string; stop: () => void }> {
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), '--serve', path.resolve(staticDir)], { stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    child.stdout.on('data', (d) => { const m = /^serving (\S+)/m.exec(String(d)); if (m) resolve({ url: m[1]!, stop: () => child.kill() }); });
    child.on('exit', (c) => reject(Error(err.trim().replace(/^✖ /, '') || `storybook-serve-exited: ${c}`)));
  });
}

if (process.argv[1] && /storybook-local\.ts$/.test(process.argv[1])) {
  const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] && !argv[i + 1]!.startsWith('--') ? argv[i + 1] : undefined; };
  const fail = (e: unknown) => { console.error('✖ ' + (e instanceof Error ? e.message : String(e))); process.exit(1); };
  if (flag('--serve') && argv.length === 2) serveStorybook(flag('--serve')!).then((s) => console.log(`serving ${s.url}`), fail);
  else if (flag('--dir') && flag('--out') && argv.length === 4) {
    try {
      const built = buildLocalStorybook(flag('--dir')!, flag('--out')!);
      console.log(`built ${built.static} (sha256 ${built.sha256.slice(0, 12)}; log ${built.log})`);
      serveStorybook(built.static).then((s) => console.log(`serving ${s.url} until Ctrl-C; pass it to storybook-reader.ts and storybook-contracts.ts as --storybook`), fail);
    } catch (e) { fail(e); }
  } else { console.error('usage: npx tsx scripts/storybook-local.ts --dir <library> --out <new folder>  (an unknown flag is refused)'); process.exit(2); }
}
