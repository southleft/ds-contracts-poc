import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dashboardRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(dashboardRoot, '..');

// ---------------------------------------------------------------------------
// Dev-only control API.
//
// Exposes two endpoints on the dev server ONLY (configureServer never runs in
// `vite build` output). Both execute a strict whitelist of repo scripts via
// execFile (argument vector, no shell) — request bodies are never interpolated
// into a command line.
// ---------------------------------------------------------------------------

const RUN_TIMEOUT_MS = 5 * 60 * 1000;
const OUTPUT_LIMIT = 20_000;
const JUDGE_SOURCE_LIMIT = 200_000;

/** The ONLY commands the /api/run endpoint will execute. */
const RUN_TASKS: Record<string, string[]> = {
  parity: ['tsx', 'parity/diff.ts'],
  catalog: ['tsx', 'scripts/generate-catalog.ts'],
  eval: ['tsx', 'evals/run.ts'],
};

interface ExecResult {
  exitCode: number;
  output: string;
}

function execWhitelisted(args: string[]): Promise<ExecResult> {
  return new Promise((resolvePromise) => {
    execFile(
      'npx',
      args,
      { cwd: repoRoot, timeout: RUN_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const exitCode =
          error === null ? 0 : typeof error.code === 'number' ? error.code : 1;
        const combined = `${stdout ?? ''}${stderr ? `\n${stderr}` : ''}`.trim();
        const output =
          combined.length > OUTPUT_LIMIT
            ? `${combined.slice(0, OUTPUT_LIMIT)}\n… [truncated at ${OUTPUT_LIMIT} chars]`
            : combined;
        resolvePromise({ exitCode, output });
      },
    );
  });
}

function readJsonBody(req: IncomingMessage, limit = 1_000_000): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('request body is not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function handleRun(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await readJsonBody(req)) as { task?: unknown };
  const task = typeof body.task === 'string' ? body.task : '';
  const args = RUN_TASKS[task];
  if (!args) {
    sendJson(res, 400, {
      error: `unknown task — expected one of: ${Object.keys(RUN_TASKS).join(', ')}`,
    });
    return;
  }
  const { exitCode, output } = await execWhitelisted(args);
  sendJson(res, 200, { task, exitCode, output });
}

async function handleJudge(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await readJsonBody(req)) as { source?: unknown };
  const source = typeof body.source === 'string' ? body.source : '';
  if (source.trim().length === 0) {
    sendJson(res, 400, { error: 'body must include a non-empty "source" string' });
    return;
  }
  if (source.length > JUDGE_SOURCE_LIMIT) {
    sendJson(res, 400, { error: `source exceeds ${JUDGE_SOURCE_LIMIT} chars` });
    return;
  }

  const stamp = randomUUID();
  const tmpTsx = join(tmpdir(), `contract-hub-judge-${stamp}.tsx`);
  const tmpJson = join(tmpdir(), `contract-hub-judge-${stamp}.json`);
  try {
    await writeFile(tmpTsx, source, 'utf8');
    // Judge exits 1 when the screen is non-adherent — that is a valid result,
    // not a failure; the report JSON is still written.
    const { exitCode, output } = await execWhitelisted([
      'tsx',
      'parity/judge.ts',
      tmpTsx,
      '--json',
      tmpJson,
    ]);
    let report: unknown = null;
    try {
      report = JSON.parse(await readFile(tmpJson, 'utf8'));
    } catch {
      sendJson(res, 500, { error: 'judge produced no report', exitCode, output });
      return;
    }
    sendJson(res, 200, { exitCode, output, report });
  } finally {
    await Promise.allSettled([unlink(tmpTsx), unlink(tmpJson)]);
  }
}

function devApiPlugin(): Plugin {
  return {
    name: 'contract-hub-dev-api',
    apply: 'serve',
    configureServer(server) {
      const route = (
        path: string,
        handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
      ) => {
        server.middlewares.use(path, (req, res) => {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'POST only' });
            return;
          }
          handler(req, res).catch((error: unknown) => {
            sendJson(res, 500, {
              error: error instanceof Error ? error.message : 'internal error',
            });
          });
        });
      };
      route('/api/run', handleRun);
      route('/api/judge', handleJudge);
    },
  };
}

export default defineConfig({
  root: dashboardRoot,
  plugins: [react(), tailwindcss(), devApiPlugin()],
  server: {
    port: 5180,
    fs: {
      // The dashboard imports artifacts from outside its own root
      // (../src, ../catalog, ../contracts, ../parity, ../evals, ../tokens).
      allow: [repoRoot],
    },
  },
  build: {
    outDir: 'dist',
  },
});
