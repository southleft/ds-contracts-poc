/**
 * Astryx extraction census — `npx tsx examples/astryx/scripts/census.ts [outDir]`
 *
 * The gauntlet's 25-category census (ENTERPRISE-GAUNTLET §1) mapped to
 * Astryx's real inventory, computed over a `npm run extract:code` output
 * directory (default `examples/astryx/out`). Same construction as the
 * gauntlet and the second-system assessment:
 *
 *   facts-carried = (contract props + contract events)
 *                 / (extracted props minus platform props)
 *
 * with the platform-prop exclusion list applied uniformly (the propose-side
 * RESERVED set). Judgment calls are the ASSESSMENT's, kept for
 * before/after comparability: menu→MoreMenu, select→Typeahead, tag→Token,
 * accordion→CollapsibleGroup; stepper does not ship (counted out of
 * "attempted", never as a failure).
 *
 * Prints the per-component markdown table + summary JSON to stdout.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] ?? 'examples/astryx/out';
const RESERVED = new Set(['children', 'className', 'style', 'ref', 'key', 'id']);

/** category → Astryx component (null = the system does not ship one). */
const CENSUS: Record<string, string | null> = {
  button: 'Button',
  checkbox: 'CheckboxInput',
  switch: 'Switch',
  badge: 'Badge',
  tooltip: 'Tooltip',
  dialog: 'Dialog',
  menu: 'MoreMenu',
  tabs: 'TabList',
  accordion: 'CollapsibleGroup',
  table: 'Table',
  'text-field': 'TextInput',
  'select/combobox': 'Typeahead',
  toast: 'Toast',
  pagination: 'Pagination',
  breadcrumb: 'Breadcrumbs',
  avatar: 'Avatar',
  card: 'Card',
  popover: 'Popover',
  progress: 'ProgressBar',
  slider: 'Slider',
  'tag/chip': 'Token',
  banner: 'Banner',
  skeleton: 'Skeleton',
  stepper: null,
  link: 'Link',
};

interface ExtractedLite {
  name: string;
  props: { name: string }[];
}

const kebab = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const extraction = JSON.parse(readFileSync(path.join(OUT, 'code-extraction.json'), 'utf8')) as ExtractedLite[];
const byName = new Map(extraction.map((c) => [c.name, c]));
const proposalsMd = readFileSync(path.join(OUT, 'proposals.md'), 'utf8');

interface Row {
  category: string;
  component: string;
  status: 'proposed' | 'hollow' | 'named-skip' | 'absent';
  carried?: number;
  denom?: number;
}

const rows: Row[] = [];
for (const [category, component] of Object.entries(CENSUS)) {
  if (component === null) {
    rows.push({ category, component: '—', status: 'absent' });
    continue;
  }
  const ex = byName.get(component);
  if (!ex) {
    const namedSkip = new RegExp(`^- \\*\\*${component}\\*\\* `, 'm').test(proposalsMd);
    if (!namedSkip) throw new Error(`${component}: neither extracted nor NAMED-skipped — silent loss, refuse to census`);
    rows.push({ category, component, status: 'named-skip' });
    continue;
  }
  const contractPath = path.join(OUT, 'contracts', `${kebab(component)}.contract.json`);
  if (!existsSync(contractPath)) throw new Error(`${component}: extracted but no proposal at ${contractPath}`);
  const contract = JSON.parse(readFileSync(contractPath, 'utf8')) as {
    props: unknown[];
    events?: unknown[];
  };
  const denom = ex.props.filter((p) => !RESERVED.has(p.name)).length;
  const carried = contract.props.length + (contract.events?.length ?? 0);
  rows.push({
    category,
    component,
    status: carried === 0 ? 'hollow' : 'proposed',
    carried,
    denom,
  });
}

const ratios = rows
  .filter((r) => r.status === 'proposed' || r.status === 'hollow')
  .map((r) => (r.denom! > 0 ? r.carried! / r.denom! : 0));
const sorted = [...ratios].sort((a, b) => a - b);
const median =
  sorted.length % 2 === 1
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

const pct = (x: number) => `${Math.round(x * 100)}%`;
console.log('| category | component | status | facts carried |');
console.log('|---|---|---|---|');
for (const r of rows) {
  const facts =
    r.status === 'proposed' || r.status === 'hollow'
      ? `${r.carried}/${r.denom} (${r.denom! > 0 ? pct(r.carried! / r.denom!) : 'n/a'})`
      : '—';
  console.log(`| ${r.category} | ${r.component} | ${r.status} | ${facts} |`);
}
const attempted = rows.filter((r) => r.status !== 'absent').length;
const proposed = rows.filter((r) => r.status === 'proposed' || r.status === 'hollow').length;
const hollow = rows.filter((r) => r.status === 'hollow').length;
const skips = rows.filter((r) => r.status === 'named-skip').map((r) => r.component);
console.log('');
console.log(
  JSON.stringify(
    {
      attempted,
      proposed,
      hollow,
      namedSkips: skips,
      medianFactsCarried: pct(median),
    },
    null,
    2,
  ),
);
