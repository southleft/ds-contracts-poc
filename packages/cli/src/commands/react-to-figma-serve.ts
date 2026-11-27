/**
 * `react-to-figma --write`: the programs the contract step wrote, served to the repository plugin's "React to Figma
 * runner" on port 9232 with the runner's own protocol (/driver, /claim, /next, /result), so the plugin runs the same
 * pinned driver (scripts/react-to-figma-driver.js) it runs for the repository's runner. Each set is its tokens program,
 * then its component program; every program refuses any file but the one named (the runner's GUARD) and writes
 * create-only, so a set already written is skipped, never replaced. Nothing in the file is archived or renamed. One
 * line per set: written, with the nodes it created, or the program's error by name.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export const R2F_PORT = 9232;
export interface ServedSet { name: string; tokens: string; component: string }
export type SetOutcome = { name: string; written: true; nodes: number } | { name: string; written: false; error: string };

/** The runner's wrapper (scripts/react-to-figma-run.ts `program`): the file guard, the create-only flags, the return. */
export const wrap = (fileKey: string, body: string) => `if (typeof figma.fileKey !== 'string' || figma.fileKey !== ${JSON.stringify(fileKey)}) throw new Error('GUARD: not the run file');\n`
  + `globalThis.DS_CREATE_ONLY = true; globalThis.DS_OVERWRITE_TOKENS = false; globalThis.DS_PRUNE_TOKENS = false;\n`
  + `const value = await (async () => {\n${body}\n})();\nreturn { fileKey: figma.fileKey, value };`;

/** Serve every set's two programs, one at a time, to the one driver that claims the run; resolve with each set's outcome
 *  once the driver has posted the last result. A failed tokens program skips its set's component program. */
export function servePrograms(sets: readonly ServedSet[], fileKey: string, driver: string, opts: { port?: number; log?: (l: string) => void } = {}): Promise<SetOutcome[]> {
  const log = opts.log ?? ((l: string) => console.log(l)), port = opts.port ?? R2F_PORT;
  const queue = sets.flatMap((s) => [{ id: `tokens:${s.name}`, set: s, program: wrap(fileKey, s.tokens) }, { id: `component:${s.name}`, set: s, program: wrap(fileKey, s.component) }]);
  const outcomes = new Map<string, SetOutcome>();
  let session: string | undefined, inFlight: (typeof queue)[number] | undefined, finished = false;
  return new Promise((resolve, reject) => {
    const servers: ReturnType<typeof createServer>[] = [];
    const close = () => { for (const s of servers) s.close(); };
    const handle = (req: IncomingMessage, res: ServerResponse) => {
      const send = (v: unknown) => { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(v)); };
      const u = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (u.pathname === '/driver') return send({ driver });
      if (u.pathname === '/claim') { if (session) return send({ refused: 'a driver already holds this run' }); session = Math.random().toString(16).slice(2); log('  the plugin connected; writing…'); return send({ session }); }
      if (!session || u.searchParams.get('session') !== session) return send({ refused: 'not this run\'s driver' });
      if (u.pathname === '/next') {
        if (inFlight) return send({ wait: true });
        while (queue[0] && outcomes.get(queue[0].set.name)?.written === false) queue.shift();   // its tokens program failed
        if (!queue.length) {
          const all = sets.map((s) => outcomes.get(s.name)!), written = all.filter((o) => o.written).length;
          finished = true; close();
          send({ done: true, ok: written === all.length, summary: `${written} of ${all.length} set(s) written${written < all.length ? '; each failure is named in the terminal' : ''}` });
          return resolve(all);
        }
        inFlight = queue.shift()!;
        return send({ id: inFlight.id, program: inFlight.program });
      }
      if (u.pathname === '/result' && req.method === 'POST') {
        const chunks: Buffer[] = []; req.on('data', (d) => chunks.push(d));
        req.on('end', () => {
          const r = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { id: string; error?: string; value?: { value?: { createdNodeIds?: unknown[] } }; timerChainMs?: number };
          if (!inFlight || r.id !== inFlight.id) return send({ refused: 'not the program in flight' });
          const { set } = inFlight; inFlight = undefined;
          if (r.timerChainMs && r.timerChainMs > 1000) log('  ⚠ the Figma tab looks hidden (timers are slow); keep the file in front');
          if (r.error) { outcomes.set(set.name, { name: set.name, written: false, error: r.error }); log(`  ✖ ${set.name}: ${r.error}`); }
          else if (r.id.startsWith('component:')) { const nodes = r.value?.value?.createdNodeIds?.length ?? 0; outcomes.set(set.name, { name: set.name, written: true, nodes }); log(`  ✔ ${set.name}: written (${nodes} node(s))`); }
          send({ ok: true });
        });
        return;
      }
      send({ refused: 'no route' });
    };
    let up = 0;
    for (const host of ['127.0.0.1', '::1']) {
      const s = createServer(handle).once('error', (e: NodeJS.ErrnoException) => { if (!finished) { close(); reject(Error(`react-to-figma-port-busy: ${host}:${port} (${e.code}); another runner holds it`)); } });
      servers.push(s);
      s.listen(port, host, () => { if (++up === 2) log(`serving ${sets.length} set(s) on localhost:${port}. In Figma, open the file, then in the ds-contracts plugin press "React to Figma runner" → "Connect and run".`); });
    }
  });
}
