import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { ExtractConfig } from './types.js';

/** Load extract.config.json (arg > ./extract.config.json > built-in default
 *  pointing at this repo's own library — so `npm run extract:code` works on
 *  a fresh clone with zero setup, and doubles as the living example). */
export function loadConfig(argPath?: string): { config: ExtractConfig; from: string } {
  const candidate = argPath ?? 'extract.config.json';
  if (existsSync(candidate)) {
    const config = JSON.parse(readFileSync(candidate, 'utf8')) as ExtractConfig;
    if (!config.code?.adapter) {
      throw new Error(`${candidate}: "code.adapter" is required ("react-tsx" or "cem")`);
    }
    return { config, from: path.resolve(candidate) };
  }
  if (argPath) throw new Error(`Config not found: ${argPath}`);
  return {
    config: {
      code: { adapter: 'react-tsx', root: 'src/components' },
      design: { source: 'parity-snapshot' },
      idPrefix: 'ds',
      out: 'extract/out',
      // The referee (`npm run diagnose`) judges the ADOPTED contracts — the
      // ones this repo's canvas and code were generated from. It used to fall
      // back to `<out>/contracts`, the code-extraction PROPOSALS, whose Figma
      // spellings (`Sm`/`Is Disabled`) are the proposer's defaults and were
      // never adopted; refereeing those against a canvas built from
      // `contracts/` reported 23 false "design BEHIND/MISMATCH" findings on
      // an in-sync file (docs/23 §D.32). `extract:code` still writes its
      // proposals to `<out>/contracts`; a brownfield config that wants the
      // proposals refereed sets diagnose.contracts explicitly, as the pilots do.
      diagnose: { contracts: 'contracts' },
    },
    from: '(built-in default — this repo\'s own library)',
  };
}

export const outDir = (config: ExtractConfig) => config.out ?? 'extract/out';
export const idPrefix = (config: ExtractConfig) => config.idPrefix ?? 'ds';
