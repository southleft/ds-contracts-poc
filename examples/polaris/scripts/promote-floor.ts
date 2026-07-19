/**
 * FLOOR PROMOTION (Round 4 — v0.3.0) — computed-floor enriched contracts
 * REPLACE the static-promotion showcase contracts. Round 4 adds the
 * DOM-ANATOMY PROMOTION: computed-only elements are REAL parts (Banner's
 * tone ribbon + icon + dismiss + action row, Checkbox/Radio glyphs, Tag's
 * remove button), svg content rides committed icon assets reconstructed
 * from captured computed truth (copied into assets/icons here), and
 * structure-creating optional props are boolean contract props.
 *
 *   npx tsx examples/polaris/scripts/promote-floor.ts
 *
 * For every showcase component whose computed floor ran to a committed
 * artifact set (extract/computed/out/<comp>/), this script promotes:
 *
 *   · the RESOLVED contract when a decisions ledger exists (human-acked
 *     contradiction resolutions, extract/computed/resolve.ts), else the
 *     generated enriched contract — version bumped 0.1.0 → 0.2.0, provenance
 *     appended (capture method, browser build, npm package pin);
 *   · the extension block (everything the vocabulary cannot carry, BY NAME)
 *     alongside the contract as contracts/<kebab>.extension.json;
 *   · every component's minted token tree, merged into
 *     tokens/polaris-minted.dtcg.json (namespace `imported.*` — the
 *     generators' inventory and the HTML token stylesheet include it).
 *
 * Text and TextField are promoted with the rest (owner ruling, round 2):
 * their contracts keep the FULL prop space; canvas axis curation lives in
 * generate.ts's CANVAS_PROJECTIONS (a named projection of the emitted Figma
 * scripts only — code bindings and the truth gates always run the full
 * space).
 *
 * State previews (owner ruling policy 3/6): every promoted contract whose
 * declared states carry token overrides opts into `figmaStatePreviews` so
 * hover/active/focus-visible/disabled render as canvas State cells; a
 * contract the referee refuses (a state with no overrides would render
 * identically to Default) stays opted out, with the refusal printed.
 *
 * Deterministic by construction: everything derives from committed inputs;
 * re-running is byte-stable. The old static-promotion ledger
 * (extraction/PROMOTION.md) is superseded per component by
 * extract/computed/out/<comp>/LEDGER.md.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../../scripts/contract-schema.js';
import { validateContract } from '../../../core/emit-react.js';
import { readdirSync } from 'node:fs';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const EXAMPLE = path.dirname(HERE);
const REPO = path.resolve(EXAMPLE, '..', '..');
const OUT = path.join(REPO, 'extract', 'computed', 'out');

/** Promoted floor components: floor out-dir name → contracts/<kebab>. */
const PROMOTED: Array<{ dir: string; kebab: string }> = [
  { dir: 'button', kebab: 'button' },
  { dir: 'tag', kebab: 'tag' },
  { dir: 'badge', kebab: 'badge' },
  { dir: 'banner', kebab: 'banner' },
  { dir: 'checkbox', kebab: 'checkbox' },
  { dir: 'radiobutton', kebab: 'radio-button' },
  { dir: 'avatar', kebab: 'avatar' },
  { dir: 'spinner', kebab: 'spinner' },
  { dir: 'progressbar', kebab: 'progress-bar' },
  { dir: 'thumbnail', kebab: 'thumbnail' },
  { dir: 'text', kebab: 'text' },
  { dir: 'textfield', kebab: 'text-field' },
];

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;

const icons = new Map<string, string>(
  readdirSync(path.join(EXAMPLE, 'assets', 'icons'))
    .filter((f) => f.endsWith('.svg'))
    .sort()
    .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(EXAMPLE, 'assets', 'icons', f), 'utf8').trim()]),
);

const mergeInto = (dst: Record<string, unknown>, src: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !('$value' in (v as object))) {
      mergeInto((dst[k] ??= {}) as Record<string, unknown>, v as Record<string, unknown>);
    } else if (!(k in dst)) {
      dst[k] = v;
    } else if (JSON.stringify(dst[k]) !== JSON.stringify(v)) {
      throw new Error(`minted-token collision at "${k}" — two components minted different values under one path`);
    }
  }
};

const mintedMerged: Record<string, unknown> = {};
const promotedIds: string[] = [];
const promotedAssets: string[] = [];

for (const { dir, kebab } of PROMOTED) {
  const outDir = path.join(OUT, dir);
  const resolvedPath = path.join(outDir, 'resolved.contract.json');
  const enrichedPath = path.join(outDir, 'enriched.contract.json');
  const extensionPath = path.join(outDir, 'enriched.extension.json');
  const src = existsSync(resolvedPath) ? resolvedPath : enrichedPath;
  if (!existsSync(src) || !existsSync(extensionPath)) {
    throw new Error(`${dir}: no committed floor artifacts under extract/computed/out/${dir} — run the floor first`);
  }
  const contract = readJson(src) as unknown as Contract;
  const extension = readJson(extensionPath);

  // Round 4: floor-reconstructed svg assets → committed icon assets (the
  // generators' shared map). Byte-copied; re-running is byte-stable.
  const floorAssets = path.join(outDir, 'assets');
  if (existsSync(floorAssets)) {
    for (const f of readdirSync(floorAssets).sort()) {
      if (!f.endsWith('.svg')) continue;
      const body = readFileSync(path.join(floorAssets, f), 'utf8');
      writeFileSync(path.join(EXAMPLE, 'assets', 'icons', f), body);
      icons.set(f.replace(/\.svg$/, ''), body.trim());
      promotedAssets.push(f);
    }
  }

  const browser = String(extension.browser ?? 'unknown');
  const library = String(extension.library ?? 'unknown');
  contract.version = '0.3.0';
  const resolvedNote = src === resolvedPath
    ? `contradictions resolved computed-wins per the decisions ledger (extract/computed/out/${dir}/decisions.md, human-acked; source resolved.contract.json)`
    : `zero binding contradictions in the review queue (source enriched.contract.json)`;
  contract.description =
    `${contract.description} FLOOR-PROMOTED v0.3.0 (extract/computed round 4): this contract is the computed-floor ` +
    `rebuild — complete browser truth captured from the real ${library} npm package rendered in headless Chromium ` +
    `${browser} (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run ` +
    `byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels ` +
    `MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), with the ` +
    `round-4 DOM-ANATOMY PROMOTION: every rendered element is a carried part, svg glyph content rides committed ` +
    `icon assets reconstructed from the captured d/fill channels, presence facts gate structure-creating props, ` +
    `${resolvedNote}. Everything the vocabulary cannot carry is named in ` +
    `contracts/${kebab}.extension.json. Delta ledger: extract/computed/out/${dir}/LEDGER.md (supersedes this ` +
    `component's section of extraction/PROMOTION.md).`;

  // State previews (owner ruling): opt in wherever the referee accepts —
  // a canvas cell per declared interaction state on the primary axis.
  if ((contract.states ?? []).length > 0 && !contract.figmaStatePreviews) {
    const probe = structuredClone(contract);
    probe.figmaStatePreviews = true;
    const probeErrors: string[] = [];
    validateContract(probe, new Map([[probe.id, probe]]), probeErrors, icons);
    if (probeErrors.length === 0) {
      contract.figmaStatePreviews = true;
      console.log(`  · ${contract.id}: figmaStatePreviews ON (${contract.states.join(', ')})`);
    } else {
      console.log(
        `  · ${contract.id}: figmaStatePreviews REFUSED by the referee (named): ${probeErrors[0]}`,
      );
    }
  }

  ContractSchema.parse(contract);
  const errors: string[] = [];
  validateContract(contract, new Map([[contract.id, contract]]), errors, icons);
  if (errors.length > 0) {
    throw new Error(`${dir}: promoted contract fails generator validation:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }

  writeFileSync(path.join(EXAMPLE, 'contracts', `${kebab}.contract.json`), JSON.stringify(contract, null, 2) + '\n');
  writeFileSync(
    path.join(EXAMPLE, 'contracts', `${kebab}.extension.json`),
    JSON.stringify(
      {
        _marker: `COMPUTED-FLOOR EXTENSION BLOCK for polaris.${kebab} v0.2.0 — committed alongside the contract (copied verbatim from extract/computed/out/${dir}/enriched.extension.json). Nothing here is contract vocabulary; every entry names why it does not fit.`,
        ...extension,
      },
      null,
      2,
    ) + '\n',
  );
  mergeInto(mintedMerged, (extension.mintedTokens ?? {}) as Record<string, unknown>);
  promotedIds.push(contract.id);
  console.log(`✔ ${contract.id} v0.2.0 promoted from ${path.relative(REPO, src)}`);
}

writeFileSync(
  path.join(EXAMPLE, 'tokens', 'polaris-minted.dtcg.json'),
  JSON.stringify(mintedMerged, null, 2) + '\n',
);
console.log(`✔ ${promotedIds.length} contracts promoted; minted token tree → tokens/polaris-minted.dtcg.json; ${promotedAssets.length} floor-reconstructed icon assets → assets/icons/`);
