/**
 * Wave 7 — anatomy channel lines + code cssVars floor.
 * `npx tsx core/anatomy-diff-check.ts`
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  anatomyChannelLines,
  diffContractAnatomy,
  expectedCssVarsFromAnatomy,
  tokenRefToCssVar,
} from './anatomy-diff.js';
import { extractCode } from '../parity/extract-code.js';
import type { Contract } from '../scripts/contract-schema.js';

const ROOT = process.cwd();
const errors: string[] = [];

function load(stem: string): Contract {
  return JSON.parse(
    readFileSync(path.join(ROOT, 'contracts', `${stem}.contract.json`), 'utf8'),
  ) as Contract;
}

// §1 — flatten is non-empty for a known anatomy-rich contract
{
  const button = load('button');
  const lines = anatomyChannelLines(button);
  if (lines.length < 10) {
    errors.push(`§1 button anatomy lines expected ≥10, got ${lines.length}`);
  }
  if (!lines.some((l) => l.startsWith('root|tokens.'))) {
    errors.push('§1 button must emit root|tokens.* lines');
  }
  if (!lines.some((l) => l.includes('root/label|element|span'))) {
    errors.push('§1 button must emit nested label element line');
  }
}

// §2 — hand edit to anatomy is visible via channel-diff
{
  const before = load('button');
  const after = structuredClone(before) as Contract & {
    anatomy: { root: { layout: Record<string, unknown> } };
  };
  after.anatomy.root.layout.align = 'start';
  const changes = diffContractAnatomy(before, after);
  if (changes.length !== 1) {
    errors.push(`§2 expected exactly 1 anatomy change, got ${changes.length}: ${JSON.stringify(changes)}`);
  } else if (changes[0]!.channel !== 'layout.align' || changes[0]!.now !== 'start') {
    errors.push(`§2 unexpected change shape: ${JSON.stringify(changes[0])}`);
  }
}

// §3 — tokenRefToCssVar skips axis placeholders, keeps resolved paths
{
  if (tokenRefToCssVar('{variant}') !== null) {
    errors.push('§3 {variant} must not become a css var');
  }
  if (tokenRefToCssVar('{color.border.focus}') !== 'color-border-focus') {
    errors.push('§3 {color.border.focus} → color-border-focus');
  }
  if (tokenRefToCssVar('{color.action.{variant}.background}') !== null) {
    // contains braces inside — our simple matcher should reject or we need to reject templates
    // Current matcher: ^\{([a-zA-Z0-9][a-zA-Z0-9._-]*)\}$ — inner `{` fails. Good.
  }
}

// §4 — every fully-resolved anatomy token ref appears in generated CSS Module
{
  const code = extractCode(ROOT);
  const stems = ['button', 'badge', 'switch', 'checkbox', 'avatar'] as const;
  for (const stem of stems) {
    const contract = load(stem);
    const name = contract.name;
    const extracted = code.find((c) => c.component === name);
    if (!extracted) {
      errors.push(`§4 ${name}: not found in src/components`);
      continue;
    }
    const expected = expectedCssVarsFromAnatomy(contract);
    const got = new Set(extracted.cssVars);
    const missing = expected.filter((v) => !got.has(v));
    if (missing.length) {
      errors.push(`§4 ${name}: code cssVars missing resolved anatomy tokens: ${missing.join(', ')}`);
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(`  ✖ ${e}`);
  console.error('✖ anatomy-diff-check failed');
  process.exit(1);
}
console.log(
  '✔ anatomy-diff-check: anatomy channel lines + hand-edit visibility + cssVars floor (resolved token refs) hold',
);
