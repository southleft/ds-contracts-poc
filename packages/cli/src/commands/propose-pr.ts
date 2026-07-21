/**
 * `ds-contracts propose-pr <file> --repo owner/name` — a contract change
 * becomes a reviewable PR (the designer-journey exit ramp: local edits →
 * proposed contract diff → pull request).
 *
 * Token discipline (the playground credential pattern): the fine-grained
 * GitHub token comes from --token or the DS_CONTRACTS_GITHUB_TOKEN /
 * GITHUB_TOKEN env vars, lives in one local variable for the duration of
 * the run, and is NEVER persisted, logged, or echoed. gh REST via fetch —
 * no gh binary, no SDK.
 *
 * <file> is a proposed contract document (*.contract.json) or a parity/
 * diagnose diff report (JSON). It is committed verbatim to
 * --path/<basename> on a fresh branch and opened as a PR against --base.
 *
 * --dry-run prints the exact REST steps (no token required, no network) —
 * the eval pins this plan output.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CliUsageError, flagString, parseFlags } from '../lib.js';

const API = 'https://api.github.com';

interface PrPlan {
  repo: string;
  base: string | null; // null → repo default branch, resolved live
  branch: string;
  destPath: string;
  title: string;
  body: string;
  contentBytes: number;
}

/**
 * Plain-words change summary for the PR body. If the payload looks like a
 * contract (has id/name/version), name it and surface its version + any
 * `changelog` line so a reviewer reads WHAT changed without opening the diff.
 * Falls back to nothing for non-contract diff reports.
 */
export function summarize(parsed: unknown): string {
  if (!parsed || typeof parsed !== 'object') return '';
  const c = parsed as Record<string, unknown>;
  const id = typeof c.id === 'string' ? c.id : undefined;
  const name = typeof c.name === 'string' ? c.name : undefined;
  const version = typeof c.version === 'string' ? c.version : undefined;
  const status = typeof c.status === 'string' ? c.status : undefined;
  const changelog = typeof c.changelog === 'string' ? c.changelog : undefined;
  if (!id && !name && !version) return '';
  const lines: string[] = ['**What changed**', ''];
  const head = [name ?? id, version ? `v${version}` : undefined, status ? `(${status})` : undefined]
    .filter(Boolean)
    .join(' ');
  if (head) lines.push(`- Contract: ${head}${id && name ? ` — \`${id}\`` : ''}`);
  if (changelog) lines.push(`- ${changelog}`);
  lines.push('', '');
  return lines.join('\n');
}

export function buildPlan(file: string, repo: string, opts: { base?: string; dir?: string; title?: string }): {
  plan: PrPlan;
  content: string;
} {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new CliUsageError(`--repo must be owner/name, got "${repo}"`);
  }
  let content: string;
  let parsed: unknown;
  try {
    content = readFileSync(file, 'utf8');
    parsed = JSON.parse(content);
  } catch (err) {
    throw new CliUsageError(`${file}: not readable JSON — ${String(err instanceof Error ? err.message : err)}`);
  }
  const basename = path.basename(file);
  const slug = basename.replace(/\.json$/, '').replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase();
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const destDir = (opts.dir ?? 'contracts').replace(/\/+$/, '');
  const plan: PrPlan = {
    repo,
    base: opts.base ?? null,
    branch: `ds-contracts/propose-${slug}-${stamp}`,
    destPath: `${destDir}/${basename}`,
    title: opts.title ?? `ds-contracts proposal: ${basename}`,
    body:
      `This PR was opened by \`ds-contracts propose-pr\`.\n\n` +
      `It carries a proposed contract change as a reviewable diff: \`${destDir}/${basename}\`.\n\n` +
      summarize(parsed) +
      `Review it like any code change — the contract is the single source of truth; ` +
      `merging it is the adoption decision. Nothing else in the repository is touched.`,
    contentBytes: Buffer.byteLength(content),
  };
  return { plan, content };
}

async function gh<T>(token: string, method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'ds-contracts-cli',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = ((await res.json().catch(() => ({}))) as { message?: string }).message ?? '';
    throw new Error(`GitHub ${method} ${url} → ${res.status}${detail ? ` (${detail})` : ''}`);
  }
  return (await res.json()) as T;
}

// GET that treats 404 as "absent" (null) rather than an error — used to look
// up whether the destination contract already exists on the branch.
async function ghMaybe<T>(token: string, url: string): Promise<T | null> {
  const res = await fetch(`${API}${url}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'ds-contracts-cli',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const detail = ((await res.json().catch(() => ({}))) as { message?: string }).message ?? '';
    throw new Error(`GitHub GET ${url} → ${res.status}${detail ? ` (${detail})` : ''}`);
  }
  return (await res.json()) as T;
}

/**
 * The PUT /contents body. A promotion usually UPDATES a contract that already
 * lives in the target repo, and GitHub's contents API refuses to overwrite an
 * existing blob unless its current `sha` is supplied — so include it whenever
 * the destination file already exists on the branch, and omit it for a create.
 * Pure + exported so the create/update shape is pinnable offline.
 */
export function contentsPutBody(
  plan: PrPlan,
  content: string,
  existingSha: string | null,
): { message: string; content: string; branch: string; sha?: string } {
  return {
    message: plan.title,
    content: Buffer.from(content).toString('base64'),
    branch: plan.branch,
    ...(existingSha ? { sha: existingSha } : {}),
  };
}

export async function proposePrCommand(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, {
    value: ['repo', 'token', 'base', 'path', 'title'],
    bool: ['dry-run'],
  });
  const file = parsed.positionals[0];
  if (!file) throw new CliUsageError('propose-pr needs a contract or diff JSON file');
  const repo = flagString(parsed, 'repo');
  if (!repo) throw new CliUsageError('propose-pr needs --repo owner/name');

  const { plan, content } = buildPlan(file, repo, {
    base: flagString(parsed, 'base'),
    dir: flagString(parsed, 'path'),
    title: flagString(parsed, 'title'),
  });

  if (parsed.flags.get('dry-run') === true) {
    console.log('DRY RUN — no network calls, no token required. The live run would:');
    console.log(`  1. GET  /repos/${plan.repo}${plan.base ? '' : '  (resolve the default branch)'}`);
    console.log(`  2. GET  /repos/${plan.repo}/git/ref/heads/${plan.base ?? '<default-branch>'}  (base sha)`);
    console.log(`  3. POST /repos/${plan.repo}/git/refs  { ref: "refs/heads/${plan.branch}" }`);
    console.log(`  4. PUT  /repos/${plan.repo}/contents/${plan.destPath}  (${plan.contentBytes} bytes, branch ${plan.branch})`);
    console.log(`  5. POST /repos/${plan.repo}/pulls  { title: ${JSON.stringify(plan.title)}, head: "${plan.branch}", base: "${plan.base ?? '<default-branch>'}" }`);
    console.log('  Token source at run time: --token, else DS_CONTRACTS_GITHUB_TOKEN, else GITHUB_TOKEN — never persisted.');
    return 0;
  }

  const token =
    flagString(parsed, 'token') ??
    process.env.DS_CONTRACTS_GITHUB_TOKEN ??
    process.env.GITHUB_TOKEN;
  if (!token) {
    throw new CliUsageError(
      'propose-pr needs a fine-grained GitHub token: --token, DS_CONTRACTS_GITHUB_TOKEN, or GITHUB_TOKEN (contents:write + pull-requests:write on the target repo). It is used in memory only — never stored.',
    );
  }

  const base =
    plan.base ?? (await gh<{ default_branch: string }>(token, 'GET', `/repos/${plan.repo}`)).default_branch;
  const ref = await gh<{ object: { sha: string } }>(token, 'GET', `/repos/${plan.repo}/git/ref/heads/${base}`);
  await gh(token, 'POST', `/repos/${plan.repo}/git/refs`, {
    ref: `refs/heads/${plan.branch}`,
    sha: ref.object.sha,
  });
  // Upsert: if the contract already exists at destPath on the new branch
  // (the common promotion case — the repo already carries this contract),
  // GitHub's contents API requires its current sha to replace it.
  const existing = await ghMaybe<{ sha: string }>(
    token,
    `/repos/${plan.repo}/contents/${plan.destPath}?ref=${encodeURIComponent(plan.branch)}`,
  );
  await gh(
    token,
    'PUT',
    `/repos/${plan.repo}/contents/${plan.destPath}`,
    contentsPutBody(plan, content, existing?.sha ?? null),
  );
  const pr = await gh<{ html_url: string; number: number }>(token, 'POST', `/repos/${plan.repo}/pulls`, {
    title: plan.title,
    head: plan.branch,
    base,
    body: plan.body,
  });
  console.log(`✔ Opened PR #${pr.number}: ${pr.html_url}`);
  return 0;
}
