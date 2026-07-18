/**
 * Build-time numbers. Everything here is COMPUTED from the repository at
 * build time — the site never hard-codes a count that can drift. Numbers
 * that require running an instrument (census, visual parity) are parsed
 * from that instrument's committed report, with the source named.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

export interface SiteStats {
  contracts: number;
  tokens: number;
  evalsPassed: number;
  evalsTotal: number;
  emitters: number;
  censusSets: number | undefined;
  censusClean: number | undefined;
}

export async function computeStats(): Promise<SiteStats> {
  const contracts = readdirSync(path.join(ROOT, 'contracts')).filter((f) =>
    f.endsWith('.contract.json'),
  ).length;

  // Distinct DTCG token paths across the whole token source (primitives,
  // semantic aliases, brand + light/dark mode files).
  const tokenFiles = [
    'tokens/primitives.tokens.json',
    'tokens/semantic.tokens.json',
    ...readdirSync(path.join(ROOT, 'tokens/modes')).map((f) => `tokens/modes/${f}`),
  ].filter((f) => f.endsWith('.tokens.json'));
  const tokenPaths = new Set<string>();
  const walk = (o: Record<string, unknown>, pre: string[]): void => {
    for (const [k, v] of Object.entries(o)) {
      if (k.startsWith('$')) continue;
      if (v && typeof v === 'object') {
        if ('$value' in (v as object)) tokenPaths.add([...pre, k].join('.'));
        else walk(v as Record<string, unknown>, [...pre, k]);
      }
    }
  };
  for (const f of tokenFiles) {
    walk(JSON.parse(readFileSync(path.join(ROOT, f), 'utf8')) as Record<string, unknown>, []);
  }

  // The eval scoreboard, as last committed (evals/results.json is written by
  // `npm run eval`, which runs the real pipeline in a scratch copy).
  const evalResults = JSON.parse(
    readFileSync(path.join(ROOT, 'evals/results.json'), 'utf8'),
  ) as { passed: number; total: number };

  // The emitter registry — count the real one, don't transcribe it.
  const { emitters } = await import('../../core/emitter.js');

  // Census headline, parsed from the committed instrument report.
  let censusSets: number | undefined;
  let censusClean: number | undefined;
  try {
    const census = readFileSync(path.join(ROOT, 'extract/figma/gauntlet/CENSUS.md'), 'utf8');
    const m = census.match(/\*\*whole kit\*\*\s*\|\s*(\d+)\s*\|\s*(\d+)/);
    if (m) {
      censusClean = Number(m[1]);
      censusSets = Number(m[1]) + Number(m[2]);
    }
  } catch {
    /* instrument report absent — the stat is simply omitted */
  }

  return {
    contracts,
    tokens: tokenPaths.size,
    evalsPassed: evalResults.passed,
    evalsTotal: evalResults.total,
    emitters: emitters.length,
    censusSets,
    censusClean,
  };
}
