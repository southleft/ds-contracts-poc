/**
 * FLOOR PROMOTION — the shared pipeline, extracted from six near-identical
 * copies of `examples/<lib>/scripts/promote-floor.{mjs,ts}`.
 *
 * Promotion is step 6 of the bring-your-own-design-system recipe (docs/21 §2.6)
 * and it was the ONE step with no CLI verb: every library carried its own
 * ~450-line script, and a fix landed in one of them (the class-stem join
 * defect, task #25) stayed latent in the other five. This module is that
 * pipeline once, driven by a per-library JSON config:
 *
 *   ds-contracts promote --config examples/carbon/promote.config.json
 *   (and, inside `ds-contracts onboard --continue`, the promote stage)
 *
 * What it does, per component:
 *   · pick the RESOLVED contract when a decisions ledger produced one, else
 *     the enriched contract; bump the version; append promotion provenance;
 *   · copy floor-reconstructed svg assets into the example's icon dir (a
 *     contract referencing an uncopied asset refuses by name at emit);
 *   · probe `figmaStatePreviews` against the REAL referee (core/emit-react
 *     validateContract) — the referee decides, and its refusals are printed;
 *   · SOURCE-ALIAS the minted tree: a minted leaf whose covering combos all
 *     agree on ONE source token, and whose minted value equals that token's
 *     DTCG value, becomes a DTCG alias to it. Value equality is checked twice
 *     (capture + here), so aliasing can never move a pixel — it only changes
 *     SEMANTICS: Figma variables and emitted code reference the library's own
 *     token names instead of anonymous imported literals;
 *   · write provenance-anchor sidecars for every aliased leaf;
 *   · REFUSE the whole promotion if any contract `{imported.*}` ref (axis-
 *     expanded) or any alias fails to resolve.
 *
 * NOT GENERALIZED, BY NAME: `examples/polaris/scripts/promote-floor.ts` (a
 * different generation — v0.3.2, no source-alias pass, bespoke per-component
 * provenance prose, ContractSchema.parse enforcement, un-namespaced capture
 * out dirs) and `examples/astryx/scripts/promote-floor.ts` (the re-anchor
 * decisions ledger must be re-applied after the mint merge, and it refuses at
 * HEAD on a stale ledger row — task #43). Both keep their scripts. A partial
 * generalization that says which two it left alone beats a total one that
 * moves artifacts silently.
 *
 * BYTE DISCIPLINE: every per-library string that reaches a committed artifact
 * (the promoter path in the contract description, the possessive in the
 * receipt, the MINTED.md title) is a CONFIG FIELD, not a derivation — the
 * four generalized libraries reproduce their committed bytes exactly, quirks
 * included (see `examples/tailwind/promote.config.json`).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { validateContract } from '../../../core/emit-react.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface PromoteConfig {
  /** Library slug — used only in log lines. */
  library: string;
  /** Repo-relative example dir (`examples/carbon`). */
  exampleDir: string;
  /** Repo-relative capture out dir (`extract/computed/out/carbon`). */
  captureOut: string;
  /** Repo-relative base DTCG file — aliases are value-verified against it. */
  dtcg: string;
  /** Repo-relative minted tree written by this run. */
  mintedOut: string;
  /** Repo-relative MINTED.md receipt written by this run. */
  mintedDoc: string;
  /** Capture out-dir names, in promotion order. */
  components: string[];
  /** Components whose minted trees merge in (defaults to `components` —
   *  Astryx-style shared minting can list more). */
  mintSources?: string[];
  /** capture-dir name → contract file stem, where the two spellings differ. */
  contractStem?: Record<string, string>;
  /** Version stamped on every promoted contract. */
  contractVersion: string;
  /** Path named inside each promoted contract's description — the thing a
   *  reader runs to reproduce it. */
  promoterPath: string;
  /** Possessive used in the description and receipt ("Carbon's", "MUI's",
   *  "the library's"). A CONFIG field because it is committed bytes. */
  possessive: string;
  /** First line of MINTED.md, minus the "— promotion receipt" suffix. */
  mintedDocTitle: string;
  /** Receipt every source fact that reached no minted leaf (a silent alias
   *  loss). Carbon ships these; turning it on elsewhere ADDS receipt lines to
   *  that library's MINTED.md, so it stays opt-in per library. */
  unjoinedFactReceipts?: boolean;
}

const REQUIRED: Array<keyof PromoteConfig> = [
  'library', 'exampleDir', 'captureOut', 'dtcg', 'mintedOut', 'mintedDoc',
  'components', 'contractVersion', 'promoterPath', 'possessive', 'mintedDocTitle',
];

/** PURE referee: unknown JSON → PromoteConfig, refusing every missing field BY
 *  NAME (`__`-prefixed keys are notes and are ignored, the capture-config
 *  convention). */
export function parsePromoteConfig(raw: unknown, from: string): PromoteConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${from}: promote config must be a JSON object`);
  }
  const obj = raw as Record<string, unknown>;
  const missing = REQUIRED.filter((k) => obj[k] === undefined);
  if (missing.length > 0) {
    throw new Error(`${from}: promote config is missing required field(s): ${missing.join(', ')}`);
  }
  if (!Array.isArray(obj.components) || obj.components.length === 0) {
    throw new Error(`${from}: "components" must be a non-empty array of capture out-dir names`);
  }
  return obj as unknown as PromoteConfig;
}

// ---------------------------------------------------------------------------
// Pure core — value comparison, minted merge, join-key normalization
// ---------------------------------------------------------------------------

type Leaf = { $value: unknown; [k: string]: unknown };
type Tree = Record<string, unknown>;
const isLeaf = (v: unknown): v is Leaf => !!v && typeof v === 'object' && '$value' in (v as object);
const isTree = (v: unknown): v is Tree => !!v && typeof v === 'object' && !('$value' in (v as object));

/** PURE: colour literal → comparable `r,g,b,a` tuple, or null when the value is
 *  not a colour (lengths compare as strings). */
export const colorTuple = (v: unknown): string | null => {
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

/** PURE: two token values are the same value (string-equal, or the same colour
 *  spelled differently). */
export const valueEq = (a: unknown, b: unknown): boolean => {
  if (String(a) === String(b)) return true;
  const ta = colorTuple(String(a));
  return ta !== null && ta === colorTuple(String(b));
};

/**
 * JOIN-KEY NORMALIZATION (class-stem prefix round, task #25).
 *
 * The alias pass joins a MINTED TOKEN PATH segment against a SOURCE FACT's
 * `part` name, and those two spellings are not the same string: the minted
 * path runs every segment through `core/mint-tokens.ts` `sanitizeSegment`
 * ([a-z0-9-] only, camel split, runs collapsed) while `source-bindings.json`
 * carries the RAW promoted part name.
 *
 * With positional part names (`part-1-1-0`) the sanitized form equalled the
 * raw form and the join worked BY COINCIDENCE. Carbon's BEM element stems
 * carry `__` — `toggle__switch` mints as `toggle-switch` — and the join
 * silently missed, costing four verified aliases. Carbon's script fixed it
 * locally and its comment said the same latent join lived in the other five
 * scripts; generalizing makes the fix unconditional for every library that
 * goes through this module. It is byte-neutral for MUI/Tailwind/Altitude
 * (proven by re-promotion, not assumed).
 *
 * MIRRORED, NOT IMPORTED: `sanitizeSegment` is module-private in
 * `core/mint-tokens.ts`, and exporting it would change the plugin ENGINE
 * BUNDLE to serve promotion. The rule is copied here verbatim; the
 * unjoined-fact receipt makes a future divergence LOUD instead of silent.
 */
export const mintSegment = (s: string): string =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

/** PURE: merge one component's minted tree into the accumulator; two
 *  components minting different values under one path is a hard refusal. */
export function mergeInto(target: Tree, src: Tree, prefix = ''): void {
  for (const [k, v] of Object.entries(src)) {
    if (isTree(v)) {
      if (!(k in target)) target[k] = {};
      mergeInto(target[k] as Tree, v, `${prefix}${k}.`);
    } else if (k in target && JSON.stringify(target[k]) !== JSON.stringify(v)) {
      throw new Error(`minted-token collision at "${prefix}${k}" — two components minted different values under one path`);
    } else {
      target[k] = v;
    }
  }
}

export interface SourceFact {
  part: string;
  channel: string;
  token: string;
  axisValues: Record<string, string>;
  varName?: string;
  anchor?: { selector?: string };
}

export interface Anchor {
  leaf: string;
  token: string;
  part: string;
  cssProperty: string;
  varName: string;
  selector: string;
}

export interface AliasOutcome {
  aliased: number;
  literalKept: number;
  receipts: string[];
  anchors: Anchor[];
  /** `${part}|${channel}` keys that reached a leaf. */
  joined: Set<string>;
}

/**
 * PURE (mutates the passed tree, returns the receipts): the SOURCE-ALIAS pass.
 * Walks one component's `imported.*` minted subtree; a leaf whose covering
 * combos all name ONE token — with matching value — is rewritten to `{token}`.
 * Everything else stays literal, and every non-obvious refusal is receipted.
 */
export function aliasPass(
  node: Tree,
  segs: string[],
  facts: SourceFact[],
  tokenValue: (name: string) => unknown,
  out: AliasOutcome,
): void {
  for (const [k, v] of Object.entries(node)) {
    if (isLeaf(v)) {
      const leafPath = [...segs, k];
      // leaf: imported.<comp>.<part...>.<channel>[.axisVal...] — find the
      // channel segment (the one matching a fact's channel); trailing segments
      // are the axis values the leaf is conditioned on. Join on the MINTED
      // spelling of the fact's part (see mintSegment).
      const byChannel = new Set<string>();
      for (const f of facts) byChannel.add(`${mintSegment(f.part)}|${f.channel}`);
      let matched: { token: string; part: string; channel: string; varName: string; selector: string } | null = null;
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
          (f) => mintSegment(f.part) === part && f.channel === channel &&
            axisVals.every((av) => Object.values(f.axisValues).includes(av)) &&
            valueEq(v.$value, tokenValue(f.token)),
        );
        if (covering.length === 0) break;
        const toks = new Set(covering.map((f) => f.token));
        if (toks.size !== 1) {
          out.receipts.push(`kept literal ${leafPath.join('.')}: covering combos disagree (${[...toks].sort().join(', ')})`);
          break;
        }
        const tok = [...toks][0];
        if (!valueEq(v.$value, tokenValue(tok))) {
          out.receipts.push(`kept literal ${leafPath.join('.')}: minted value ${v.$value} ≠ ${tok} value ${tokenValue(tok)}`);
          break;
        }
        const witness = covering[0];
        matched = { token: tok, part, channel, varName: witness.varName ?? '', selector: witness.anchor?.selector ?? '' };
        out.joined.add(`${part}|${channel}`);
        break;
      }
      if (matched) {
        v.$value = `{${matched.token}}`;
        out.aliased++;
        out.anchors.push({
          leaf: leafPath.join('.'),
          token: matched.token,
          part: matched.part,
          cssProperty: matched.channel,
          varName: matched.varName,
          selector: matched.selector,
        });
      } else out.literalKept++;
    } else if (isTree(v)) {
      aliasPass(v as Tree, [...segs, k], facts, tokenValue, out);
    }
  }
}

/** PURE: every `$value` path in a token tree, dot-joined. */
export function leafPaths(tree: Tree): Set<string> {
  const set = new Set<string>();
  (function walk(n: Tree, p: string[]) {
    for (const [k, v] of Object.entries(n)) {
      if (isLeaf(v)) set.add([...p, k].join('.'));
      else if (isTree(v)) walk(v as Tree, [...p, k]);
    }
  })(tree, []);
  return set;
}

/**
 * PURE: the RESOLUTION GUARD. Every `{imported.*}` ref in every promoted
 * contract (axis placeholders expanded over that contract's enum values) must
 * resolve in the merged tree, and every alias in the tree must resolve in the
 * base DTCG. A promoted set that cannot resolve is not a promotion.
 */
export function resolutionGuard(
  minted: Tree,
  contracts: Array<{ name: string; contract: Record<string, unknown> }>,
  tokenValue: (name: string) => unknown,
): { dangling: string[]; badAliases: string[] } {
  const leafSet = leafPaths(minted);
  const dangling: string[] = [];
  for (const { name, contract } of contracts) {
    const enums: Record<string, string[]> = {};
    for (const pr of (contract.props ?? []) as Array<{ name: string; type?: { enum?: string[] } }>) {
      if (pr.type?.enum) enums[pr.name] = pr.type.enum;
    }
    const expand = (ref: string): string[] => {
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
  const badAliases: string[] = [];
  (function walk(n: Tree, p: string[]) {
    for (const [k, v] of Object.entries(n)) {
      if (isLeaf(v)) {
        const mm = /^\{(.+)\}$/.exec(String(v.$value));
        if (mm && tokenValue(mm[1]) === undefined) badAliases.push([...p, k].join('.') + ' -> ' + String(v.$value));
      } else if (isTree(v)) walk(v as Tree, [...p, k]);
    }
  })(minted, []);
  return { dangling, badAliases };
}

// ---------------------------------------------------------------------------
// Shell — the promotion run
// ---------------------------------------------------------------------------

export interface PromoteResult {
  promoted: string[];
  promotedAssets: string[];
  aliased: number;
  literalKept: number;
  receipts: string[];
  statePreviewsOn: string[];
  stateRefusals: string[];
}

/** The full promotion, against a repo root. Writes contracts, extension
 *  sidecars, anchors, the minted tree and MINTED.md; THROWS on an unresolvable
 *  ref (the resolution guard) or a minted collision. */
export function promote(
  repoRoot: string,
  cfg: PromoteConfig,
  log: (line: string) => void = console.log,
): PromoteResult {
  const EX = path.resolve(repoRoot, cfg.exampleDir);
  const OUT = path.resolve(repoRoot, cfg.captureOut);
  const stemOf = (n: string): string => cfg.contractStem?.[n] ?? n;

  const dtcg = JSON.parse(readFileSync(path.resolve(repoRoot, cfg.dtcg), 'utf8')) as Record<string, { $value?: unknown }>;
  const tokenValue = (name: string): unknown => dtcg[name]?.$value;

  // Icon map — the referee needs it to validate `icon.asset` refs, and floor-
  // reconstructed assets promoted below are added to it as they land.
  const ICON_DIR = path.join(EX, 'assets', 'icons');
  const icons = new Map<string, string>(
    existsSync(ICON_DIR)
      ? readdirSync(ICON_DIR)
          .filter((f) => f.endsWith('.svg'))
          .sort()
          .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(ICON_DIR, f), 'utf8').trim()] as [string, string])
      : [],
  );

  const stateRefusals: string[] = [];
  const statePreviewsOn: string[] = [];
  /** The Polaris probe: opt into `figmaStatePreviews` wherever the REFEREE
   *  accepts it, so the canvas draws a State cell per declared interaction
   *  state instead of pretending the component has only a default plane. The
   *  referee — not this module — decides: a state with no token overrides
   *  would render identically to Default, and that refusal is PRINTED, never
   *  worked around. A refused contract ships unpreviewed (its declared states
   *  still drive the code surface and declaredStates). */
  const statePreviewProbe = (contract: Record<string, unknown>): void => {
    const states = (contract.states ?? []) as string[];
    if (states.length === 0 || contract.figmaStatePreviews) return;
    const probe = structuredClone(contract) as Record<string, unknown>;
    probe.figmaStatePreviews = true;
    const probeErrors: string[] = [];
    validateContract(probe as never, new Map([[probe.id as string, probe as never]]), probeErrors, icons);
    if (probeErrors.length === 0) {
      contract.figmaStatePreviews = true;
      statePreviewsOn.push(`${contract.id} (${states.join(', ')})`);
      log(`  · ${contract.id}: figmaStatePreviews ON (${states.join(', ')})`);
    } else {
      stateRefusals.push(`${contract.id}: ${probeErrors[0]}`);
      log(`  · ${contract.id}: figmaStatePreviews REFUSED by the referee (named): ${probeErrors[0]}`);
    }
  };

  // ---- promotion ----
  const promoted: string[] = [];
  const promotedAssets: string[] = [];
  for (const name of cfg.components) {
    const dir = path.join(OUT, name);
    // Floor-reconstructed svg assets → committed icon assets; the figma
    // compile (`--icons examples/<lib>/assets/icons`) emits them, and a
    // contract referencing an uncopied asset refuses by name there.
    const floorAssets = path.join(dir, 'assets');
    if (existsSync(floorAssets)) {
      mkdirSync(ICON_DIR, { recursive: true });
      for (const f of readdirSync(floorAssets).sort()) {
        if (!f.endsWith('.svg')) continue;
        const body = readFileSync(path.join(floorAssets, f), 'utf8');
        writeFileSync(path.join(ICON_DIR, f), body);
        icons.set(f.replace(/\.svg$/, ''), body.trim());
        promotedAssets.push(f);
      }
    }
    const resolvedPath = path.join(dir, 'resolved.contract.json');
    const enrichedPath = path.join(dir, 'enriched.contract.json');
    const src = existsSync(resolvedPath) ? resolvedPath : enrichedPath;
    if (!existsSync(src)) throw new Error(`${name}: no computed artifact (${src})`);
    const contract = JSON.parse(readFileSync(src, 'utf8')) as Record<string, unknown>;
    const extension = JSON.parse(readFileSync(path.join(dir, 'enriched.extension.json'), 'utf8')) as unknown;

    contract.version = cfg.contractVersion;
    contract.description =
      `${contract.description} FLOOR-PROMOTED (${cfg.promoterPath}): ` +
      `${path.basename(src)} — computed-capture truth; minted leaves source-aliased to ${cfg.possessive} ` +
      `own CSS-variable references where verified (source-bindings.json); extension sidecar ` +
      `carries the named overflow.`;

    statePreviewProbe(contract);
    writeFileSync(path.join(EX, 'contracts', `${stemOf(name)}.contract.json`), JSON.stringify(contract, null, 2) + '\n');
    writeFileSync(path.join(EX, 'contracts', `${stemOf(name)}.extension.json`), JSON.stringify(extension, null, 2) + '\n');
    promoted.push(name);
  }

  // ---- minted merge + source-alias pass ----
  const mintedMerged: Tree = {};
  let aliased = 0;
  let literalKept = 0;
  const aliasReceipts: string[] = [];
  const anchorsByComponent = new Map<string, Anchor[]>();
  for (const name of cfg.mintSources ?? cfg.components) {
    const extPath = path.join(OUT, name, 'enriched.extension.json');
    if (!existsSync(extPath)) continue;
    const extension = JSON.parse(readFileSync(extPath, 'utf8')) as { mintedTokens?: Tree };
    const minted = extension.mintedTokens ?? {};
    const sbPath = path.join(OUT, name, 'source-bindings.json');
    const facts: SourceFact[] = existsSync(sbPath)
      ? ((JSON.parse(readFileSync(sbPath, 'utf8')) as { facts?: SourceFact[] }).facts ?? [])
      : [];
    if (facts.length > 0 && minted.imported) {
      const out: AliasOutcome = { aliased: 0, literalKept: 0, receipts: [], anchors: [], joined: new Set() };
      aliasPass(minted.imported as Tree, ['imported'], facts, tokenValue, out);
      aliased += out.aliased;
      literalKept += out.literalKept;
      aliasReceipts.push(...out.receipts);
      if (out.anchors.length > 0) anchorsByComponent.set(name, out.anchors);
      // UNJOINED-FACT RECEIPT (class-stem prefix round). A verified source fact
      // that reaches NO minted leaf is a silent alias loss — exactly how the
      // part-name/mint-path spelling mismatch cost four aliases without a word.
      // Naming it here means the next spelling divergence is loud.
      if (cfg.unjoinedFactReceipts) {
        for (const key of new Set(facts.map((f) => `${mintSegment(f.part)}|${f.channel}`))) {
          if (!out.joined.has(key)) {
            aliasReceipts.push(`fact NOT JOINED ${name}: (part "${key.split('|')[0]}", channel "${key.split('|')[1]}") verified at capture but reached no minted leaf — either the leaf's value disagrees with the token (a plane split) or the part spelling diverged from the minted path`);
          }
        }
      }
    }
    mergeInto(mintedMerged, minted);
  }

  // ---- provenance-anchor sidecars ----
  for (const [name, anchors] of [...anchorsByComponent].sort()) {
    writeFileSync(
      path.join(EX, 'contracts', `${name}.anchors.json`),
      JSON.stringify({
        _marker: 'PROVENANCE ANCHORS — write-back through-lines for source-aliased leaves. Sidecar, never contract vocabulary. selector = the CSSOM rule declaring the channel (render-level anchor for Emotion-runtime libraries; static readers will carry file:line anchors).',
        component: name,
        anchors: anchors.sort((a, b) => a.leaf.localeCompare(b.leaf)),
      }, null, 2) + '\n',
    );
  }

  // ---- resolution guard ----
  {
    const contracts = cfg.components.map((name) => ({
      name,
      contract: JSON.parse(readFileSync(path.join(EX, 'contracts', `${stemOf(name)}.contract.json`), 'utf8')) as Record<string, unknown>,
    }));
    const { dangling, badAliases } = resolutionGuard(mintedMerged, contracts, tokenValue);
    if (dangling.length > 0 || badAliases.length > 0) {
      const lines = [
        '✘ promotion REFUSED — unresolvable refs:',
        ...dangling.slice(0, 20).map((d) => '  dangling: ' + d),
        ...badAliases.slice(0, 20).map((b) => '  bad alias: ' + b),
      ];
      throw new Error(lines.join('\n'));
    }
    log('✔ resolution guard: every contract {imported.*} ref (axis-expanded) resolves; every alias resolves in the DTCG base');
  }

  writeFileSync(path.resolve(repoRoot, cfg.mintedOut), JSON.stringify(mintedMerged, null, 2) + '\n');
  writeFileSync(
    path.resolve(repoRoot, cfg.mintedDoc),
    `# ${cfg.mintedDocTitle} — promotion receipt\n\nGenerated by \`${cfg.promoterPath}\`.\n\n` +
      `- **${aliased} leaves source-aliased** to ${cfg.possessive} own CSS-variable-named tokens (value-verified twice: capture + promotion)\n` +
      `- **${literalKept} leaves kept literal** (no verified source reference)\n` +
      `- **${aliasReceipts.length} named alias refusals**${aliasReceipts.length ? ':' : ''}\n` +
      aliasReceipts.map((r) => `  - ${r}`).join('\n') + '\n',
  );
  log(`✔ floor-promoted ${promoted.length} contract(s) → ${cfg.exampleDir}/contracts (v${cfg.contractVersion}): ${promoted.join(', ')}`);
  if (promotedAssets.length > 0) log(`✔ ${promotedAssets.length} floor-reconstructed icon asset(s) → ${cfg.exampleDir}/assets/icons/: ${promotedAssets.join(', ')}`);
  log(`✔ minted tree → ${cfg.mintedOut} (${aliased} source-aliased, ${literalKept} literal, ${aliasReceipts.length} named refusals)`);
  log(
    `✔ figmaStatePreviews: ${statePreviewsOn.length} accepted by the referee` +
      (statePreviewsOn.length ? ` (${statePreviewsOn.join('; ')})` : '') +
      `, ${stateRefusals.length} REFUSED BY NAME` +
      (stateRefusals.length ? `:\n${stateRefusals.map((r) => `    - ${r}`).join('\n')}` : ''),
  );

  return { promoted, promotedAssets, aliased, literalKept, receipts: aliasReceipts, statePreviewsOn, stateRefusals };
}

/** Shell entry used by the example shims and the `promote` verb. */
export function promoteFromConfigFile(configPath: string, repoRoot?: string): PromoteResult {
  const abs = path.resolve(configPath);
  if (!existsSync(abs)) throw new Error(`promote config not found: ${configPath}`);
  const cfg = parsePromoteConfig(JSON.parse(readFileSync(abs, 'utf8')), configPath);
  // Config paths are repo-relative; the repo root defaults to the directory
  // two levels above the example dir the config names.
  const root = repoRoot ?? path.resolve(path.dirname(abs), ...cfg.exampleDir.split('/').map(() => '..'));
  return promote(root, cfg);
}
