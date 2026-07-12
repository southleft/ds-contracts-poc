/**
 * Node-side secrets. FIGMA_TOKEN is read from the process env or a .env.local
 * — the cwd's, or (when running from a git worktree, which does not carry
 * gitignored files) the main checkout's, located via git itself. NEVER
 * printed, never written into any fixture.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function envCandidates(): string[] {
  const candidates = [path.resolve(process.cwd(), '.env.local')];
  try {
    // In a worktree, --git-common-dir points at the MAIN checkout's .git.
    const common = execSync('git rev-parse --path-format=absolute --git-common-dir', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (common) candidates.push(path.join(path.dirname(common), '.env.local'));
  } catch {
    // not a git checkout — env var or cwd .env.local only
  }
  return candidates;
}

export function figmaToken(): string {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN;
  for (const p of envCandidates()) {
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/^FIGMA_TOKEN\s*=\s*"?([^"\n]+)"?\s*$/m);
    if (m) return m[1].trim();
  }
  throw new Error('FIGMA_TOKEN not found (env or .env.local)');
}
