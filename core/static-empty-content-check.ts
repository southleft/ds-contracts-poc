/**
 * Static HTML must not invent visible content for geometry-only components.
 *
 * Run with:
 *   npx tsx core/static-empty-content-check.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { kebab } from '../extract/types.js';
import { emitHtml } from './emit-html.js';
import { tokenInventoryFromJson } from './tokens.js';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (relativePath: string) =>
  JSON.parse(readFileSync(path.join(ROOT, relativePath), 'utf8'));

const contracts = new Map<string, Contract>(
  readdirSync(path.join(ROOT, 'contracts'))
    .filter((file) => file.endsWith('.contract.json'))
    .map((file) => ContractSchema.parse(read(path.join('contracts', file))))
    .map((contract) => [contract.id, contract]),
);
const icons = new Map<string, string>(
  readdirSync(path.join(ROOT, 'assets', 'icons'))
    .filter((file) => file.endsWith('.svg'))
    .map((file) => [
      file.replace(/\.svg$/, ''),
      readFileSync(path.join(ROOT, 'assets', 'icons', file), 'utf8').trim(),
    ]),
);
const tokens = tokenInventoryFromJson([
  read('tokens/primitives.tokens.json'),
  read('tokens/semantic.tokens.json'),
  read('tokens/modes/semantic.light.tokens.json'),
  read('tokens/modes/semantic.dark.tokens.json'),
]);

const failures: string[] = [];
const check = (condition: boolean, message: string) => {
  console.log(`  ${condition ? '✔' : '✖'} ${message}`);
  if (!condition) failures.push(message);
};
const emitted = (id: string) =>
  emitHtml(contracts.get(id)!, { contracts, icons, tokens }).html;

/** Visible text inside every emitted component root, excluding markup/comments. */
const rootText = (contract: Contract, html: string): string[] => {
  const className = kebab(contract.name);
  const roots = [
    ...html.matchAll(
      new RegExp(
        `<([a-z][\\w-]*)\\b[^>]*class="${className}(?:\\s|--|")[^"]*"[^>]*>([\\s\\S]*?)<\\/\\1>`,
        'g',
      ),
    ),
  ];
  return roots.map((match) =>
    match[2]
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
};

for (const id of ['ds.status-dot', 'ds.inline', 'ds.stack']) {
  const contract = contracts.get(id)!;
  const html = emitted(id);
  const values = rootText(contract, html);
  check(values.length > 0, `${contract.name}: emitted showcase roots were found`);
  check(
    values.every((value) => value === ''),
    `${contract.name}: every showcase root has no invented visible text`,
  );
  check(
    !values.includes(contract.name),
    `${contract.name}: contract.name is never used as visible fallback content`,
  );
}

const statusHtml = emitted('ds.status-dot');
check(
  /<span class="status-dot(?:\s[^"]*)?" aria-label="Status" role="img">/.test(statusHtml),
  'StatusDot: required accessible label remains an aria attribute',
);

const button = contracts.get('ds.button')!;
const buttonHtml = emitted(button.id);
check(
  buttonHtml.includes('<span class="button__label">Button</span>'),
  'Button control: declared children text default remains visible',
);
check(
  rootText(button, buttonHtml).some((value) => value === 'Button'),
  'Button control: visible root text is preserved',
);

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} static empty-content invariant failure(s).`);
  process.exit(1);
}

console.log(
  '\n✔ static HTML keeps geometry-only roots empty, keeps aria-only text nonvisual, and preserves declared children text.',
);
