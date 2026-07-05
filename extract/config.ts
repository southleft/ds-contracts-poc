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
    },
    from: '(built-in default — this repo\'s own library)',
  };
}

export const outDir = (config: ExtractConfig) => config.out ?? 'extract/out';
export const idPrefix = (config: ExtractConfig) => config.idPrefix ?? 'ds';
