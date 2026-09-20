/** Re-derive citation locations only; changed or ambiguous rule text refuses. */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type LocatedRule = { id: string; file: string; line?: number; ruleLine: number; ruleText: string };
export function deriveLoweringLines<T extends { rules: LocatedRule[] }>(register: T, read: (file: string) => string): T {
  const next = structuredClone(register);
  for (const rule of next.rules) {
    const lines = read(rule.file).split('\n');
    if (rule.line !== undefined) {
      const markers = lines.flatMap((text, i) => text.trim() === `// @lower ${rule.id}` ? [i] : []);
      if (markers.length !== 1) throw Error(`lowering-marker-not-unique:${rule.id}`);
      if (lines[markers[0] + 1]?.trim() !== rule.ruleText) throw Error(`lowering-rule-text-changed:${rule.id}`);
      rule.line = markers[0] + 1;
      rule.ruleLine = rule.line + 1;
    } else if (lines[rule.ruleLine - 1]?.trim() !== rule.ruleText) {
      const sites = lines.flatMap((text, i) => text.trim() === rule.ruleText ? [i + 1] : []);
      if (sites.length !== 1) throw Error(`lowering-rule-site-not-unique:${rule.id}`);
      rule.ruleLine = sites[0];
    }
  }
  return next;
}


/** Refresh every cited row, including a stale document beside a current register. */
export function deriveLoweringDocument(text: string, rules: LocatedRule[]): string {
  return text.split('\n').map(line => {
    const rule = rules.find(r => line.startsWith(`| \`${r.id}\` |`));
    if (!rule) return line;
    const cells = line.split('|');
    cells[3] = ` \`${path.basename(rule.file)}:${rule.ruleLine}\` `;
    return cells.join('|');
  }).join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.slice(2).join(' ') !== '--write') throw Error('Usage: tsx scripts/lowering-lines.ts --write');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const file = path.join(root, 'spec/lowering.json');
  const prior = JSON.parse(readFileSync(file, 'utf8'));
  const next = deriveLoweringLines(prior, (name) => readFileSync(path.join(root, name), 'utf8'));
  const moved = next.rules.filter((rule: LocatedRule, i: number) => rule.line !== prior.rules[i].line || rule.ruleLine !== prior.rules[i].ruleLine);
  const doc = path.join(root, 'spec/LOWERING.md');
  const text = deriveLoweringDocument(readFileSync(doc, 'utf8'), next.rules);
  // Derive everything before either write; no rule prose or acceptance changes.
  writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
  writeFileSync(doc, text);
  console.log(`Re-derived ${moved.length} lowering citation(s); rule text unchanged.`);
}
