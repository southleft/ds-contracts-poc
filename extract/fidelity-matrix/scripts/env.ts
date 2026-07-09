/**
 * Node-side secrets. FIGMA_TOKEN is read from the main checkout's .env.local
 * (worktrees do not carry gitignored files) or the process env — NEVER
 * printed, never written into any fixture.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ENV_CANDIDATES = [
  path.resolve(process.cwd(), '.env.local'),
  '/Users/tjpitre/Sites/ds-contracts-poc/.env.local',
];

export function figmaToken(): string {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN;
  for (const p of ENV_CANDIDATES) {
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/^FIGMA_TOKEN\s*=\s*"?([^"\n]+)"?\s*$/m);
    if (m) return m[1].trim();
  }
  throw new Error('FIGMA_TOKEN not found (env or .env.local)');
}
