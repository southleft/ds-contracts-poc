/**
 * COMPUTED-CAPTURE FLOOR — contradiction-resolution workflow (item 3).
 *
 *   npm run extract:computed:resolve -- --dir extract/computed/out/button \
 *     --apply "<item-id>[,<item-id>…]" [--to "{token.ref}"] [--config <file>]
 *
 * HUMAN-ACK SEMANTICS, no silent auto-resolution: every resolution names its
 * queue items explicitly (`--apply` takes exact item ids from
 * review-queue.json; there is no --all). Applying computed-wins for an item
 * group:
 *
 *   1. groups the named items by (part, channel, observed value),
 *   2. determines the driving axis (the single enum axis whose value set
 *      cleanly partitions contradicting from confirming combos — no single
 *      axis → REFUSED by name; a ≥2-axis contradiction needs schema-level
 *      review, not a CLI patch),
 *   3. rebinds to `--to` (explicit token) or the UNIQUE DTCG candidate whose
 *      resolved value equals the observed computed value (ambiguous or
 *      absent candidates → REFUSED by name; guessing names is forbidden),
 *   4. writes resolved.contract.json (the enriched contract + the applied
 *      decisions; the generated enriched.contract.json is NEVER mutated — it
 *      must stay byte-reproducible by run.ts),
 *   5. appends the decision to decisions.json and regenerates decisions.md —
 *      the decisions ledger (evidence + action + explicit-ack provenance).
 *
 * Playground receipts for contradictions are NAMED FUTURE UI — this workflow
 * is CLI-only today (the queue file is machine-readable for that UI).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, tokensByPropEntries, walkAnatomy, type Contract, type Part } from '../../scripts/contract-schema.js';
import { validateContract } from '../../core/emit-react.js';
import { loadConfig, propSpaceFor } from './capture.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const REPO = path.resolve(HERE, '..', '..');

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};

interface QueueItem {
  id: string;
  combo: string;
  part: string;
  channel: string;
  ref: string;
  computedProp: string;
  expected: string;
  observed: string;
  cause: string;
  candidates: string[];
  status: string;
}

interface Decision {
  ids: string[];
  part: string;
  channel: string;
  scope: 'base' | `axis:${string}`;
  from: string;
  to: string;
  observed: string;
  expected: string;
  cause: string;
  ack: 'explicit CLI --apply';
}

function fail(msg: string): never {
  console.error(`REFUSED: ${msg}`);
  process.exit(1);
}

const dir = arg('dir') ?? fail('need --dir <out dir> (e.g. extract/computed/out/button)');
const applyArg = arg('apply') ?? fail('need --apply "<item-id>[,<item-id>…]" — resolution is explicit-ack only, there is no --all');
const toRef = arg('to');
const toMapRaw = arg('to-map');
const toMap: Record<string, string> | null = toMapRaw ? (JSON.parse(toMapRaw) as Record<string, string>) : null;
// Finest-grain explicit ack (Phase B): per-ITEM targets — the per-variant
// case where ONE observed value legitimately maps to DIFFERENT tokens per
// axis value (Badge white label = color-on-accent(info) / color-on-error
// (error) — Meta's own source binds per-variant). Items sharing a target
// group together; the axis-partition rule then applies per target group.
const toItemsRaw = arg('to-items');
const toItems: Record<string, string> | null = toItemsRaw ? (JSON.parse(toItemsRaw) as Record<string, string>) : null;
const configPath = path.resolve(arg('config') ?? path.join(HERE, 'configs', 'polaris.json'));

const dirAbs = path.resolve(dir);
const queuePath = path.join(dirAbs, 'review-queue.json');
if (!existsSync(queuePath)) fail(`no review-queue.json in ${dir}`);
const queue = JSON.parse(readFileSync(queuePath, 'utf8')) as {
  component: string;
  contract: string;
  items: QueueItem[];
};
const enrichedPath = path.join(dirAbs, 'enriched.contract.json');
const resolvedPath = path.join(dirAbs, 'resolved.contract.json');
const decisionsJsonPath = path.join(dirAbs, 'decisions.json');
const decisionsMdPath = path.join(dirAbs, 'decisions.md');

const baseContract = JSON.parse(
  readFileSync(existsSync(resolvedPath) ? resolvedPath : enrichedPath, 'utf8'),
) as Contract;
const priorDecisions: Decision[] = existsSync(decisionsJsonPath)
  ? (JSON.parse(readFileSync(decisionsJsonPath, 'utf8')) as Decision[])
  : [];

const cfg = loadConfig(REPO, configPath);
const comp = cfg.components.find((c) => c.name === queue.component) ?? fail(`component ${queue.component} not in ${configPath}`);
const space = propSpaceFor(REPO, cfg, comp);

const ids = applyArg.split(',').map((s) => s.trim()).filter(Boolean);
const alreadyResolved = new Set(priorDecisions.flatMap((d) => d.ids));
const items = ids.map((id) => {
  const item = queue.items.find((i) => i.id === id) ?? fail(`no queue item with id "${id}"`);
  if (alreadyResolved.has(id)) fail(`item "${id}" is already resolved (see decisions.json)`);
  return item;
});

// ---------------------------------------------------------------------------
// Group by (part, channel, observed) and determine the driving axis
// ---------------------------------------------------------------------------
const axisValuesOf = (combo: string): Record<string, string> => {
  const parts = combo.split('.');
  const out: Record<string, string> = {};
  space.axes.forEach((ax, i) => { out[ax.prop] = parts[i]; });
  return out;
};

interface Group {
  part: string;
  channel: string;
  observed: string;
  items: QueueItem[];
}
const groups = new Map<string, Group>();
for (const item of items) {
  // per-item targets split same-observed items into per-target groups (the
  // axis-partition rule then scopes each to its variants).
  const itemTarget = toItems?.[item.id] ?? '';
  const key = `${item.part}|${item.channel}|${item.observed}|${itemTarget}`;
  const g = groups.get(key) ?? { part: item.part, channel: item.channel, observed: item.observed, items: [] };
  g.items.push(item);
  groups.set(key, g);
}
if (toRef && groups.size > 1) fail(`--to targets ONE (part, channel, observed) group; the named items form ${groups.size}`);

const resolved = structuredClone(baseContract) as Contract;
const partByName = new Map(walkAnatomy(resolved).map((w) => [w.name, w.part] as const));
const newDecisions: Decision[] = [];

for (const g of groups.values()) {
  const target: Part | undefined = partByName.get(g.part);
  if (!target) fail(`part "${g.part}" not in the contract anatomy`);

  // every OPEN queue item for this (part, channel) — the axis partition must
  // account for all of them, selected or not (partial acks are refused: a
  // half-resolved binding would contradict itself)
  const allForChannel = queue.items.filter(
    (i) => i.part === g.part && i.channel === g.channel && !alreadyResolved.has(i.id),
  );
  // The whole-channel rule compares against the FULL invocation selection —
  // a multi-value channel arrives as several (part, channel, observed)
  // groups in ONE apply (--to-map), and each group must see its siblings as
  // selected (comparing per-group refused every fully-named multi-value
  // apply; single-value channels never exercised this).
  const selectedIds = new Set(ids);
  const unselected = allForChannel.filter((i) => !selectedIds.has(i.id));
  if (unselected.length > 0) {
    fail(
      `items for ${g.part}.${g.channel} not all named: also open ${unselected.map((i) => i.id).join(', ')} — resolve the whole binding site together (partial acks would leave a self-contradicting binding)`,
    );
  }

  const contradictingCombos = new Set(g.items.map((i) => i.combo));
  const enabledCombos = space.enumeration.combos.filter((c) => Object.values(c.stateFlags).every((f) => !f));
  const confirmingCombos = enabledCombos.map((c) => c.key).filter((k) => !contradictingCombos.has(k));

  // resolution target ref — per-observed-value map wins (Phase B: multi-value
  // channels resolve in ONE whole-channel apply, each value to its own named
  // token; the all-named rule above still holds), then the single --to, then
  // the unique-candidate rule.
  let to = toItems?.[g.items[0].id] ?? toMap?.[g.observed] ?? toRef;
  if (!to) {
    const cands = g.items[0].candidates;
    if (cands.length === 0) fail(`${g.part}.${g.channel}: no DTCG candidate equals "${g.observed}" — pass an explicit --to "{token.ref}" (guessing names is forbidden)`);
    if (cands.length > 1) fail(`${g.part}.${g.channel}: ${cands.length} DTCG candidates share the value "${g.observed}" (${cands.join(', ')}) — pass an explicit --to`);
    to = `{${cands[0]}}`;
  }
  // Phase B: a resolution target may be a LITERAL CSS value (the v14
  // literals channel) — a computed truth no token carries (Astryx Card's
  // 15px padding). Token refs stay brace-wrapped; a literal must look like
  // a plain dimension/number/color-hex (keywords like 'auto'/'normal' are
  // NOT resolvable bindings — they stay open by name).
  const isTokenRef = /^\{[a-z0-9.-]+\}$/i.test(to);
  const isLiteral = !isTokenRef && /^-?[\d.]+(px|rem|em|%)?$|^#[0-9a-f]{3,8}$/i.test(to);
  if (!isTokenRef && !isLiteral) fail(`--to must be a brace-wrapped token ref or a plain CSS literal value, got "${to}"`);

  let scope: Decision['scope'];
  if (confirmingCombos.length === 0) {
    // uniform contradiction → computed wins at the BASE binding. Per-value
    // overrides of this channel are removed too: base scope is only reached
    // when EVERY combo contradicts, so every per-value override of the
    // channel is contradicted by definition — leaving them in place would
    // let the (wrong) overrides beat the (resolved) base in the cascade
    // (the Banner tone map was exactly this).
    if (isTokenRef) {
      target.tokens ??= {};
      target.tokens[g.channel] = to;
      if (target.literals) delete (target.literals as Record<string, unknown>)[g.channel];
    } else {
      target.literals ??= {};
      (target.literals as Record<string, unknown>)[g.channel] = to;
      if (target.tokens) delete (target.tokens as Record<string, unknown>)[g.channel];
    }
    for (const field of ['tokensByProp', 'literalsByProp'] as const) {
      const raw = target[field] as Array<{ prop: string; map: Record<string, Record<string, unknown>> }> | { prop: string; map: Record<string, Record<string, unknown>> } | undefined;
      if (!raw) continue;
      const list = Array.isArray(raw) ? raw : [raw];
      for (const e of list) {
        for (const [value, m] of Object.entries(e.map)) {
          delete m[g.channel];
          if (Object.keys(m).length === 0) delete e.map[value];
        }
      }
      const kept = list.filter((e) => Object.keys(e.map).length > 0);
      if (kept.length === 0) delete target[field];
      else (target as Record<string, unknown>)[field] = Array.isArray(raw) ? kept : kept[0];
    }
    scope = 'base';
  } else {
    // find the single axis that cleanly partitions the combos
    const axis = space.axes.find((ax) => {
      const cValues = new Set([...contradictingCombos].map((k) => axisValuesOf(k)[ax.prop]));
      const okValues = new Set(confirmingCombos.map((k) => axisValuesOf(k)[ax.prop]));
      return [...cValues].every((v) => !okValues.has(v));
    });
    if (!axis) {
      fail(
        `${g.part}.${g.channel}: no single enum axis partitions contradicting from confirming combos — a multi-axis contradiction needs schema-level review, not a CLI patch (the evidence stays in review-queue.json)`,
      );
    }
    const values = [...new Set([...contradictingCombos].map((k) => axisValuesOf(k)[axis.prop]))].sort();
    // merge into tokensByProp WITHOUT violating the v14 refusal rule: reuse
    // the entry (same prop) that already maps this channel, else append one.
    if (isTokenRef) {
      const entries = tokensByPropEntries(target).map((e) => structuredClone(e));
      let entry = entries.find((e) => e.prop === axis.prop && Object.values(e.map).some((m) => g.channel in m));
      if (!entry) entry = entries.find((e) => e.prop === axis.prop && entries.filter((x) => x.prop === axis.prop).length === 1);
      if (!entry) {
        entry = { prop: axis.prop, map: {} };
        entries.push(entry);
      }
      for (const v of values) (entry.map[v] ??= {})[g.channel] = to;
      target.tokensByProp = entries as never;
    } else {
      const rawL = target.literalsByProp as Array<{ prop: string; map: Record<string, Record<string, unknown>> }> | undefined;
      const entriesL = rawL ? structuredClone(rawL) : [];
      let entryL = entriesL.find((e) => e.prop === axis.prop);
      if (!entryL) {
        entryL = { prop: axis.prop, map: {} };
        entriesL.push(entryL);
      }
      for (const v of values) (entryL.map[v] ??= {})[g.channel] = to;
      target.literalsByProp = entriesL as never;
    }
    scope = `axis:${axis.prop}=${values.join('|')}` as Decision['scope'];
  }

  newDecisions.push({
    ids: g.items.map((i) => i.id).sort(),
    part: g.part,
    channel: g.channel,
    scope,
    from: g.items[0].ref,
    to,
    observed: g.observed,
    expected: g.items[0].expected,
    cause: g.items[0].cause,
    ack: 'explicit CLI --apply',
  });
  console.log(`✔ ${g.part}.${g.channel} [${scope}]: ${g.items[0].ref} → ${to} (${g.items.length} queue item(s), computed-wins)`);
}

// the resolved contract must still be a REAL contract
ContractSchema.parse(resolved);
const errors: string[] = [];
const iconAssets = new Map<string, string>();
if (cfg.icons) {
  for (const f of readdirSync(path.join(REPO, cfg.icons)).sort()) {
    if (f.endsWith('.svg')) iconAssets.set(f.slice(0, -4), readFileSync(path.join(REPO, cfg.icons, f), 'utf8').trim());
  }
}
validateContract(resolved, new Map([[resolved.id, resolved]]), errors, iconAssets);
if (errors.length > 0) fail(`resolved contract fails generator validation:\n${errors.map((e) => `  - ${e}`).join('\n')}`);

const decisions = [...priorDecisions, ...newDecisions];
writeFileSync(resolvedPath, JSON.stringify(resolved, null, 2) + '\n');
writeFileSync(decisionsJsonPath, JSON.stringify(decisions, null, 2) + '\n');
writeFileSync(
  decisionsMdPath,
  [
    `# Decisions ledger — ${queue.component} contradiction resolutions`,
    '',
    'Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).',
    'The generated enriched.contract.json is never mutated; resolutions land in',
    'resolved.contract.json. Evidence for every row lives in review-queue.json.',
    '',
    '| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |',
    '|---|---|---|---|---|---|---|',
    ...decisions.map(
      (d) => `| ${d.part}.${d.channel} | ${d.scope} | \`${d.from}\` | \`${d.to}\` | \`${d.observed}\` | \`${d.expected}\` | ${d.ids.length} |`,
    ),
    '',
    '## Named causes',
    '',
    ...decisions.map((d) => `- **${d.part}.${d.channel}** (${d.ids.length} items): ${d.cause}`),
    '',
  ].join('\n') + '\n',
);
console.log(`\n✔ resolved.contract.json (schema + generator valid) · decisions.json (${decisions.length} decision(s)) · decisions.md`);
