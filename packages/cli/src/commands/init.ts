/**
 * `ds-contracts init` — writes ds-contracts.config.json in the cwd.
 *
 * The file IS the ExtractConfig shape (extract/types.ts) the whole
 * extraction/diagnose pipeline reads, plus a `generate` section for the
 * code-generation defaults. One config, every verb.
 */
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CliUsageError, parseFlags } from '../lib.js';

export const CONFIG_FILENAME = 'ds-contracts.config.json';

const TEMPLATE = {
  $comment:
    'ds-contracts configuration. `code`/`design`/`tokens`/`idPrefix`/`out`/`diagnose` are the ExtractConfig shape (extract + diff verbs); `generate` holds code-generation defaults. Every path is relative to this file.',
  code: {
    adapter: 'react-tsx',
    root: 'src/components',
  },
  design: {
    source: 'design-dump.json',
  },
  tokens: ['tokens/tokens.json'],
  idPrefix: 'ds',
  out: 'ds-contracts/out',
  generate: {
    target: 'react',
    out: 'src/generated',
    tokens: ['tokens/tokens.json'],
    icons: 'assets/icons',
    stories: false,
  },
} as const;

export function initCommand(argv: string[]): number {
  const parsed = parseFlags(argv, { bool: ['force'] });
  if (parsed.positionals.length > 0) {
    throw new CliUsageError('init takes no positional arguments (flags: --force)');
  }
  const target = path.resolve(CONFIG_FILENAME);
  if (existsSync(target) && parsed.flags.get('force') !== true) {
    throw new CliUsageError(`${CONFIG_FILENAME} already exists here — pass --force to overwrite`);
  }
  writeFileSync(target, JSON.stringify(TEMPLATE, null, 2) + '\n');
  console.log(`✔ Wrote ${CONFIG_FILENAME}`);
  console.log('  Edit code.root / code.adapter (react-tsx | cem) and tokens to match your library,');
  console.log('  then: ds-contracts extract');
  return 0;
}
