/**
 * MUI FLOOR PROMOTION — `node examples/mui/scripts/promote-floor.mjs`
 *
 * The Astryx promote-floor pattern with one MUI-specific addition: the
 * SOURCE-ALIAS pass. MUI ships Emotion runtime styles, so there is no static
 * token layer — but in CSS-variables mode the library's own emitted rules
 * name the token each channel binds (var(--mui-palette-primary-main), one
 * indirection hop followed). The capture verified those references against
 * computed truth per combo (source-bindings.json). Here, every minted leaf
 * whose covering combos ALL agree on one source token — and whose minted
 * value equals that token's DTCG value — becomes a DTCG ALIAS to it:
 *
 *   imported.button.root.background-color.contained.primary: "#1976d2"
 *     → "{palette-primary-main}"
 *
 * Aliasing cannot change a rendered pixel (value equality is checked twice);
 * it changes SEMANTICS: the Figma variables and emitted code reference MUI's
 * own palette instead of anonymous imported literals. Leaves with no
 * agreeing fact stay literal; every refusal is receipted.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const REPO = path.join(EX, '..', '..');
const OUT = path.join(REPO, 'extract', 'computed', 'out', 'mui');

const COMPONENTS = ['button', 'chip', 'card', 'switch', 'slider'];
const MINT_SOURCES = COMPONENTS;

// ---- DTCG base (for alias value verification) ----
const dtcg = JSON.parse(readFileSync(path.join(EX, 'tokens', 'mui.dtcg.json'), 'utf8'));
const tokenValue = (name) => dtcg[name]?.$value;

const tuple = (v) => {
  if (typeof v !== 'string') return null;
  let s = v.trim();
  const h3 = /^#([0-9a-f]{3,4})$/i.exec(s);
  if (h3) s = '#' + [...h3[1]].map((c) => c + c).join('');
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${m[2] ? Math.round((parseInt(m[2], 16) / 255) * 10000) / 10000 : 1}`;
  }
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(s);
  if (m) return `${m[1]},${m[2]},${m[3]},${Number(m[4] ?? 1)}`;
  return null;
};
const valueEq = (a, b) => {
  if (String(a) === String(b)) return true;
  const ta = tuple(String(a));
  return ta !== null && ta === tuple(String(b));
};

// ---- minted merge (Astryx mergeInto, verbatim policy) ----
const mintedMerged = {};
function mergeInto(target, src, prefix = '') {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !('$value' in v)) {
      if (!(k in target)) target[k] = {};
      mergeInto(target[k], v, `${prefix}${k}.`);
    } else if (k in target && JSON.stringify(target[k]) !== JSON.stringify(v)) {
      throw new Error(`minted-token collision at "${prefix}${k}" — two components minted different values under one path`);
    } else {
      target[k] = v;
    }
  }
}

// ---- source-alias pass ----
let aliased = 0;
let literalKept = 0;
const aliasReceipts = [];
function aliasPass(node, segs, facts) {
  for (const [k, v] of Object.entries(node)) {
    if (v && typeof v === 'object' && '$value' in v) {
      const leafPath = [...segs, k];
      // leaf: imported.<comp>.<part...>.<channel>[.axisVal...]
      // find the channel segment = the segment matching a fact's channel;
      // trailing segments are axis values the leaf is conditioned on.
      const byChannel = new Map();
      for (const f of facts) byChannel.set(`${f.part}|${f.channel}`, true);
      let matched = null;
      for (let ci = leafPath.length - 1; ci >= 2; ci--) {
        // a state-plane leaf spells the channel with a -state-<x> suffix
        // (background-color-state-disabled) — same source channel.
        const channel = leafPath[ci].replace(/-state-[a-z-]+$/, '');
        const part = leafPath.slice(2, ci).join('.') || 'root';
        if (!byChannel.has(`${part}|${channel}`)) continue;
        const axisVals = leafPath.slice(ci + 1);
        // VALUE AGREEMENT is the plane selector: state facts and base facts
        // share (part, channel, axis values) — the minted value picks which
        // plane this leaf belongs to (equality was verified at capture, so
        // this drops only other-plane facts, never the leaf's own).
        const covering = facts.filter(
          (f) => f.part === part && f.channel === channel &&
            axisVals.every((av) => Object.values(f.axisValues).includes(av)) &&
            valueEq(v.$value, tokenValue(f.token)),
        );
        if (covering.length === 0) break;
        const toks = new Set(covering.map((f) => f.token));
        if (toks.size !== 1) {
          aliasReceipts.push(`kept literal ${leafPath.join('.')}: covering combos disagree (${[...toks].sort().join(', ')})`);
          break;
        }
        const tok = [...toks][0];
        if (!valueEq(v.$value, tokenValue(tok))) {
          aliasReceipts.push(`kept literal ${leafPath.join('.')}: minted value ${v.$value} ≠ ${tok} value ${tokenValue(tok)}`);
          break;
        }
        matched = tok;
        break;
      }
      if (matched) { v.$value = `{${matched}}`; aliased++; }
      else literalKept++;
    } else if (v && typeof v === 'object') {
      aliasPass(v, [...segs, k], facts);
    }
  }
}

// ---- promotion ----
const promoted = [];
for (const name of COMPONENTS) {
  const dir = path.join(OUT, name);
  const resolvedPath = path.join(dir, 'resolved.contract.json');
  const enrichedPath = path.join(dir, 'enriched.contract.json');
  const src = existsSync(resolvedPath) ? resolvedPath : enrichedPath;
  if (!existsSync(src)) throw new Error(`${name}: no computed artifact (${src})`);
  const contract = JSON.parse(readFileSync(src, 'utf8'));
  const extension = JSON.parse(readFileSync(path.join(dir, 'enriched.extension.json'), 'utf8'));

  contract.version = '0.2.0';
  contract.description =
    `${contract.description} FLOOR-PROMOTED (examples/mui/scripts/promote-floor.mjs): ` +
    `${path.basename(src)} — computed-capture truth; minted leaves source-aliased to MUI's ` +
    `own CSS-variable references where verified (source-bindings.json); extension sidecar ` +
    `carries the named overflow.`;

  writeFileSync(path.join(EX, 'contracts', `${name}.contract.json`), JSON.stringify(contract, null, 2) + '\n');
  writeFileSync(path.join(EX, 'contracts', `${name}.extension.json`), JSON.stringify(extension, null, 2) + '\n');
  promoted.push(name);
}

for (const name of MINT_SOURCES) {
  const extPath = path.join(OUT, name, 'enriched.extension.json');
  if (!existsSync(extPath)) continue;
  const extension = JSON.parse(readFileSync(extPath, 'utf8'));
  const minted = extension.mintedTokens ?? {};
  const sbPath = path.join(OUT, name, 'source-bindings.json');
  const facts = existsSync(sbPath) ? (JSON.parse(readFileSync(sbPath, 'utf8')).facts ?? []) : [];
  if (facts.length > 0 && minted.imported) aliasPass(minted.imported, ['imported'], facts);
  mergeInto(mintedMerged, minted);
}

// ---- resolution guard (the dangling-ref trap this round hit: a promoted
// contract referencing {imported.*} leaves a desynced re-run never minted).
// Every {imported.*} ref in every promoted contract must resolve in the
// merged tree (axis placeholders expanded over the contract's enum values),
// and every alias in the tree must resolve in the base DTCG. REFUSES on any
// dangling ref — a promoted set that cannot resolve is not a promotion.
{
  const leafSet = new Set();
  (function walk(n, p) {
    for (const [k, v] of Object.entries(n)) {
      if (v && typeof v === 'object' && '$value' in v) leafSet.add([...p, k].join('.'));
      else if (v && typeof v === 'object') walk(v, [...p, k]);
    }
  })(mintedMerged, []);
  const dangling = [];
  for (const name of COMPONENTS) {
    const contract = JSON.parse(readFileSync(path.join(EX, 'contracts', `${name}.contract.json`), 'utf8'));
    const enums = {};
    for (const pr of contract.props ?? []) if (pr.type?.enum) enums[pr.name] = pr.type.enum;
    const expand = (ref) => {
      let refs = [ref];
      for (const [prop, vals] of Object.entries(enums)) {
        if (!ref.includes(`{${prop}}`)) continue;
        refs = refs.flatMap((r) => vals.map((v) => r.replaceAll(`{${prop}}`, v)));
      }
      return refs;
    };
    for (const m of JSON.stringify(contract).matchAll(/"\{(imported\.[^"]+)\}"/g)) {
      for (const r of expand(m[1])) {
        if (!leafSet.has(r)) dangling.push(`${name}: {${r}} (from {${m[1]}})`);
      }
    }
  }
  const badAliases = [];
  (function walk(n, p) {
    for (const [k, v] of Object.entries(n)) {
      if (v && typeof v === 'object' && '$value' in v) {
        const mm = /^\{(.+)\}$/.exec(String(v.$value));
        if (mm && tokenValue(mm[1]) === undefined) badAliases.push([...p, k].join('.') + ' -> ' + v.$value);
      } else if (v && typeof v === 'object') walk(v, [...p, k]);
    }
  })(mintedMerged, []);
  if (dangling.length > 0 || badAliases.length > 0) {
    console.error(`✘ promotion REFUSED — unresolvable refs:`);
    for (const d of dangling.slice(0, 20)) console.error('  dangling: ' + d);
    for (const b of badAliases.slice(0, 20)) console.error('  bad alias: ' + b);
    process.exit(1);
  }
  console.log(`✔ resolution guard: every contract {imported.*} ref (axis-expanded) resolves; every alias resolves in the DTCG base`);
}

writeFileSync(path.join(EX, 'tokens', 'mui-minted.dtcg.json'), JSON.stringify(mintedMerged, null, 2) + '\n');
writeFileSync(
  path.join(EX, 'tokens', 'MINTED.md'),
  `# MUI minted tokens — promotion receipt\n\nGenerated by \`examples/mui/scripts/promote-floor.mjs\`.\n\n` +
    `- **${aliased} leaves source-aliased** to MUI's own CSS-variable-named tokens (value-verified twice: capture + promotion)\n` +
    `- **${literalKept} leaves kept literal** (no verified source reference)\n` +
    `- **${aliasReceipts.length} named alias refusals**${aliasReceipts.length ? ':' : ''}\n` +
    aliasReceipts.map((r) => `  - ${r}`).join('\n') + '\n',
);
console.log(`✔ floor-promoted ${promoted.length} contract(s) → examples/mui/contracts (v0.2.0): ${promoted.join(', ')}`);
console.log(`✔ minted tree → examples/mui/tokens/mui-minted.dtcg.json (${aliased} source-aliased, ${literalKept} literal, ${aliasReceipts.length} named refusals)`);
