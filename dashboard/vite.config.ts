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

/* ------------------------------------------------- contract + context API */

const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const bumpMinor = (v: string) => {
  const [major, minor] = v.split('.').map(Number);
  return `${major}.${(minor ?? 0) + 1}.0`;
};

/** Regeneration pipeline after a contract/context change (order matters). */
async function regenerate(
  includeComponents: boolean,
): Promise<Array<{ step: string; exitCode: number; output: string }>> {
  const steps: Array<[string, string[]]> = includeComponents
    ? [
        ['generate components', ['tsx', 'scripts/generate-components.ts']],
        ['emit catalog', ['tsx', 'scripts/generate-catalog.ts']],
        ['emit figma-sync scripts', ['tsx', 'scripts/generate-figma.ts']],
        ['parity check', ['tsx', 'parity/diff.ts']],
      ]
    : [['emit catalog', ['tsx', 'scripts/generate-catalog.ts']]];
  const results: Array<{ step: string; exitCode: number; output: string }> = [];
  for (const [step, args] of steps) {
    const { exitCode, output } = await execWhitelisted(args);
    results.push({ step, exitCode, output: output.slice(0, 4000) });
    // parity may exit 1 (drift is a valid result); generators must succeed
    if (exitCode !== 0 && step !== 'parity check') break;
  }
  return results;
}

async function handleAddProp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await readJsonBody(req)) as {
    contractId?: unknown;
    name?: unknown;
    kind?: unknown;
    values?: unknown;
    default?: unknown;
    description?: unknown;
  };
  const contractId = typeof body.contractId === 'string' ? body.contractId : '';
  const name = typeof body.name === 'string' ? body.name : '';
  const kind = body.kind === 'enum' || body.kind === 'boolean' ? body.kind : null;
  if (!/^ds\.[a-z][a-z0-9-]*$/.test(contractId)) {
    sendJson(res, 400, { error: 'invalid contractId' });
    return;
  }
  if (!/^[a-z][a-zA-Z0-9]{1,30}$/.test(name)) {
    sendJson(res, 400, { error: 'prop name must be camelCase (e.g. "elevated")' });
    return;
  }
  if (!kind) {
    sendJson(res, 400, { error: 'kind must be "enum" or "boolean"' });
    return;
  }
  let values: string[] = [];
  if (kind === 'enum') {
    values = Array.isArray(body.values)
      ? body.values.filter((v): v is string => typeof v === 'string')
      : [];
    if (values.length < 2 || values.length > 8 || !values.every((v) => /^[a-z][a-z0-9-]{0,20}$/.test(v))) {
      sendJson(res, 400, { error: 'enum needs 2–8 kebab-case values' });
      return;
    }
  }
  const defaultValue =
    kind === 'enum'
      ? typeof body.default === 'string' && values.includes(body.default)
        ? body.default
        : values[0]
      : body.default === true;
  const description = typeof body.description === 'string' ? body.description.slice(0, 200) : undefined;

  const file = join(repoRoot, 'contracts', `${contractId.replace(/^ds\./, '')}.contract.json`);
  let original: string;
  try {
    original = await readFile(file, 'utf8');
  } catch {
    sendJson(res, 404, { error: `no contract file for ${contractId}` });
    return;
  }
  const contract = JSON.parse(original) as {
    version: string;
    props: Array<{ name: string; type: unknown }>;
  };
  if (contract.props.some((p) => p.name === name)) {
    sendJson(res, 409, { error: `prop "${name}" already exists on ${contractId}` });
    return;
  }

  const prop = {
    name,
    ...(description ? { description } : {}),
    type: kind === 'enum' ? { enum: values } : 'boolean',
    default: defaultValue,
    bindings: {
      figma:
        kind === 'enum'
          ? {
              kind: 'VARIANT',
              property: pascal(name),
              values: Object.fromEntries(values.map((v) => [v, pascal(v)])),
            }
          : { kind: 'BOOLEAN', property: pascal(name) },
      code: { prop: name },
    },
  };
  // insert before the text/children prop so children stays last, per convention
  const textIndex = contract.props.findIndex((p) => p.type === 'text');
  contract.props.splice(textIndex === -1 ? contract.props.length : textIndex, 0, prop);
  const newVersion = bumpMinor(contract.version);
  contract.version = newVersion;

  await writeFile(file, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
  const steps = await regenerate(true);
  const failed = steps.find((s) => s.exitCode !== 0 && s.step !== 'parity check');
  if (failed) {
    // Roll back — an invalid state is refused, never left half-applied.
    await writeFile(file, original, 'utf8');
    await regenerate(true);
    sendJson(res, 422, {
      error: `generation failed at "${failed.step}" — contract rolled back`,
      steps,
    });
    return;
  }
  sendJson(res, 200, { ok: true, contractId, version: newVersion, steps });
}

async function handleSaveRules(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await readJsonBody(req)) as { rules?: unknown };
  const rules = Array.isArray(body.rules) ? body.rules : null;
  if (!rules || rules.length === 0 || rules.length > 30) {
    sendJson(res, 400, { error: 'rules must be a non-empty array (max 30)' });
    return;
  }
  const clean = rules.map((r) => {
    const rule = r as Record<string, unknown>;
    const id = typeof rule.id === 'string' ? rule.id : '';
    const statement = typeof rule.statement === 'string' ? rule.statement.trim() : '';
    const enforcement =
      rule.enforcement === 'judge' || rule.enforcement === 'agent' ? rule.enforcement : null;
    if (!/^[a-z][a-z0-9-]{1,50}$/.test(id) || statement.length === 0 || statement.length > 400 || !enforcement) {
      throw new Error(`invalid rule "${id || '(missing id)'}"`);
    }
    const forbidden = Array.isArray(rule.forbiddenRawElements)
      ? rule.forbiddenRawElements.filter(
          (e): e is string => typeof e === 'string' && /^[a-z]{1,12}$/.test(e),
        )
      : undefined;
    return {
      id,
      statement,
      enforcement,
      ...(forbidden && forbidden.length > 0 ? { forbiddenRawElements: forbidden } : {}),
    };
  });
  const rulesFile = join(repoRoot, 'context', 'rules.json');
  const existing = JSON.parse(await readFile(rulesFile, 'utf8')) as { description?: string };
  await writeFile(
    rulesFile,
    `${JSON.stringify({ description: existing.description, rules: clean }, null, 2)}\n`,
    'utf8',
  );
  const steps = await regenerate(false);
  sendJson(res, 200, { ok: true, count: clean.length, steps });
}

async function handleSaveMemory(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await readJsonBody(req)) as { content?: unknown };
  const content = typeof body.content === 'string' ? body.content : '';
  if (content.length > 20_000) {
    sendJson(res, 400, { error: 'memory exceeds 20k chars' });
    return;
  }
  await writeFile(
    join(repoRoot, 'context', 'memory.md'),
    content.endsWith('\n') ? content : `${content}\n`,
    'utf8',
  );
  const steps = await regenerate(false);
  sendJson(res, 200, { ok: true, steps });
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
      route('/api/contract/add-prop', handleAddProp);
      route('/api/context/rules', handleSaveRules);
      route('/api/context/memory', handleSaveMemory);
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
