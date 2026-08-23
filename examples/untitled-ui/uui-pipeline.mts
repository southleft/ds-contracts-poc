/**
 * storybook/contracts/*.contract.json + storybook/tokens/minted.dtcg.json —
 * the kit's 30 contracts and its 797 provisional token leaves, rebuilt from
 * the COMMITTED dumps. This is the design→contract half of the fidelity loop
 * and it was the one link with no committed script: the dumps were captured,
 * inverted once, and the outputs committed, so nothing proved the outputs
 * still follow from the inputs. It is byte-identical to the committed files
 * over unchanged inputs, which is how it was verified before being trusted.
 *
 *   dumps-v2/MERGED.dump.json  → proposeFromDump per set, IMPORT_ORDER below
 *   assets/icons/manifest.json → keyToAsset → the propose-side `iconAssets`
 *   storybook/tokens/captured.dtcg.json (`{}`) → the token corpus
 *
 *   npx tsx examples/untitled-ui/uui-pipeline.mts            # verify only
 *   npx tsx examples/untitled-ui/uui-pipeline.mts --write    # rewrite both
 *
 * FOUR THINGS ARE LOAD-BEARING. Each was measured, not guessed:
 *
 *  1. THE INPUT IS THE MERGED DUMP. Cross-set facts only exist in it:
 *     textOverrideDemandFromDumps needs every set at once (a child is
 *     proposed before its hosts, so its hosts' overrides cannot be
 *     discovered during its own pass), and one session's contract scope is
 *     what links Avatar group's children to ds.avatar instead of stubbing
 *     a second ds.avatar.
 *
 *  2. THE TOKEN CORPUS IS EMPTY. The canvas was hand-built and used ZERO
 *     published Figma variables, so captured.dtcg.json is `{}` and every
 *     styled fact mints. Handing the proposal this repo's own token trees
 *     instead would silently bind kit text to repo tokens it never used
 *     (measured: slider's value labels bound {font.control.size.md} and
 *     social-button's label {font.title.size} — refs to a corpus the
 *     Untitled UI canvas has no relationship with).
 *
 *  3. IMPORT_ORDER, not the dump's own key order. The order decides which
 *     host CLAIMS each shared child stub — every stub's `description` names
 *     its claimant ("… instances of _Badge base") — and a host proposed
 *     BEFORE its child stubs the child instead of linking to it. It also
 *     fixes the key order of the merged minted tree. Children first, then
 *     their hosts.
 *
 *  4. THE INK PASS IS THIS SCRIPT'S, NOT THE ENGINE'S. Gap-closing round 8
 *     normalised every SINGLE-INK glyph export to `currentColor`
 *     (examples/untitled-ui/glyph-ink.mts writes the SVGs and records the
 *     baked hex in the icon manifest). A glyph drawing `currentColor` needs
 *     its contract to bind that ink, and a host drawing the same glyph in
 *     its own ink needs to override it — the schema's REF_OVERRIDE_CHANNELS
 *     `color` channel. core/propose-figma.ts carries the size /
 *     background-color / background-image channels only, so the `color`
 *     channel is applied here, after the proposals, from the manifest's own
 *     ink records and the dumps' observed instancePrimaryFill. Nothing is
 *     invented: a stub binds `color` only when its glyph assets agree on ONE
 *     baked ink, and a host overrides it only when its own observed ink is a
 *     single value that DIFFERS from the child's.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  componentIdSlug,
  dumpCapturesHidden,
  proposeFromDump,
  textOverrideDemandFromDumps,
  type FigmaProposalResult,
  type StubIconAsset,
} from '../../core/propose-figma.js';
import { tokenCorpusFromJson } from '../../core/token-corpus.js';
import type { DumpNode, DumpSet } from '../../extract/figma/types.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const SB = path.join(HERE, 'storybook');
const CONTRACTS = path.join(SB, 'contracts');
const MINTED = path.join(SB, 'tokens', 'minted.dtcg.json');
const WRITE = process.argv.includes('--write');

const readJson = (p: string): any => JSON.parse(readFileSync(p, 'utf8'));

/** The 15 drawn sets, in the order they were imported. See note 3 above:
 *  children before their hosts. The pipeline refuses to run if this list and
 *  the dump's own sets disagree — a re-capture that adds or renames a set
 *  must be a deliberate edit here, never a silent reordering. */
const IMPORT_ORDER = [
  'Avatar',
  '_Badge base',
  '_Button base',
  'Tooltip',
  '_Avatar add button',
  'Slider',
  'Progress circle',
  'Progress bar',
  '_Toggle base',
  '_Dropdown list item',
  '_Input field base',
  'Social button',
  'Avatar group',
  'Avatar label group',
  '_Button group base',
];

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

const dump = readJson(path.join(HERE, 'dumps-v2', 'MERGED.dump.json')) as Record<string, unknown>;
const manifest = readJson(path.join(HERE, 'assets', 'icons', 'manifest.json')) as {
  assets: Record<string, { naturalWidth: number; naturalHeight: number; refused?: boolean; circleFill?: boolean; ink?: { baked?: string } }>;
  keyToAsset: Record<string, string>;
};

const isDumpSet = (v: unknown): v is DumpSet =>
  typeof v === 'object' && v !== null && Array.isArray((v as { variants?: unknown }).variants);

const drawnSets = Object.keys(dump).filter((k) => isDumpSet(dump[k]));
const missing = IMPORT_ORDER.filter((n) => !drawnSets.includes(n));
const extra = drawnSets.filter((n) => !IMPORT_ORDER.includes(n));
if (missing.length > 0 || extra.length > 0) {
  console.error(
    `✘ IMPORT_ORDER does not match the dump's sets — missing: [${missing.join(', ')}], not listed: [${extra.join(', ')}]. ` +
      'Edit IMPORT_ORDER deliberately (it decides which host claims each shared child stub).',
  );
  process.exit(1);
}

// The canvas used zero published variables: captured.dtcg.json is `{}`, so
// the proposal has no corpus to match against and every fact mints (note 2).
const corpus = tokenCorpusFromJson({
  primitives: {},
  semantic: readJson(path.join(SB, 'tokens', 'captured.dtcg.json')) as Record<string, unknown>,
  light: {},
  brandDefault: {},
});

/** instanceKey → exported glyph (iteration 8). A `refused` manifest entry is
 *  a committed export receipt, never a carriage — it is left out entirely. */
const iconAssets = new Map<string, StubIconAsset>();
for (const [key, asset] of Object.entries(manifest.keyToAsset)) {
  const a = manifest.assets[asset];
  if (!a || a.refused) continue;
  iconAssets.set(key, {
    asset,
    naturalWidth: a.naturalWidth,
    naturalHeight: a.naturalHeight,
    ...(a.circleFill ? { circleFill: true } : {}),
  });
}

// ---------------------------------------------------------------------------
// Pass 1 — propose every set, one session, in IMPORT_ORDER
// ---------------------------------------------------------------------------

type AnyContract = Record<string, any>;

const contractIdByName = new Map<string, string>();
const contractIdByKey = new Map<string, string>();
const contractsById = new Map<string, any>();
const sessionClaimedIds = new Set<string>();
/** The accumulating minted-value ledger (leaf dot-path → literal): what lets
 *  a later host PROVE its observed facts diverge from a child's own. */
const ledger = new Map<string, string>();
const mintedTree: Record<string, any> = {};
/** contract id → contract, in the order each was first proposed. */
const contracts = new Map<string, AnyContract>();
/** Which of those are auto-proposed child STUBs — their minted namespace is
 *  `imported.stub-<slug>` (core/propose-figma.ts stubGeometry), not
 *  `imported.<slug>`, and only they carry a glyph the ink pass can bind. */
const stubIds = new Set<string>();

const mergeTree = (dst: Record<string, any>, src: Record<string, any>): void => {
  for (const [k, v] of Object.entries(src)) {
    if (v !== null && typeof v === 'object' && !('$value' in v)) {
      dst[k] = dst[k] ?? {};
      mergeTree(dst[k], v as Record<string, any>);
    } else {
      dst[k] = v;
    }
  }
};

const collectLeaves = (tree: Record<string, any>, prefix: string[], into: Map<string, string>): void => {
  for (const [k, v] of Object.entries(tree)) {
    if (v !== null && typeof v === 'object' && '$value' in v) into.set([...prefix, k].join('.'), String(v.$value));
    else if (v !== null && typeof v === 'object') collectLeaves(v as Record<string, any>, [...prefix, k], into);
  }
};

const register = (c: AnyContract): void => {
  if (typeof c?.id !== 'string' || typeof c?.name !== 'string') return;
  contractIdByName.set(c.name, c.id);
  contractsById.set(c.id, c);
  const key = c.bindings?.figma?.anchors?.componentSetKey;
  if (typeof key === 'string' && key.length > 0) contractIdByKey.set(key, c.id);
  sessionClaimedIds.add(c.id);
  if (!contracts.has(c.id)) contracts.set(c.id, c);
};

const fileKey = (dump._provenance as { fileKey?: string | null } | undefined)?.fileKey ?? null;
const textOverrideDemand = textOverrideDemandFromDumps(dump);

/** Every proposal's named notes, per set — refusals AND carried-but-caveated
 *  bindings. These were ephemeral until now: propose produced them, the
 *  pipeline dropped them, and the only prose that survived into a committed
 *  file was each contract's one-line `description`. That made half of the
 *  minting doctrine unreadable — a SATURATED axis pair is carried with a
 *  caveat saying the correlation is unwitnessed, and a caveat nobody can read
 *  is indistinguishable from a silent claim. NOTES.md is byte-verified by the
 *  same drift check as the contracts, so the naming cannot rot. */
const notesBySet = new Map<string, string[]>();

for (const setName of IMPORT_ORDER) {
  const proposal: FigmaProposalResult = proposeFromDump(dump[setName] as DumpSet, {
    projectionMode: 'reviewable-inversion',
    corpus,
    contractIdByName,
    contractIdByKey,
    contractsById,
    sessionClaimedIds: new Set(sessionClaimedIds),
    fileKey,
    mintUnbound: true,
    hiddenCaptured: dumpCapturesHidden(dump._provenance as never),
    textOverrideDemand,
    iconAssets,
    instanceOverrides: ledger,
  });
  if ((proposal.notes ?? []).length > 0) notesBySet.set(setName, proposal.notes as string[]);
  register(proposal.contract as AnyContract);
  for (const stub of proposal.childStubs ?? []) {
    register(stub as AnyContract);
    stubIds.add(String((stub as AnyContract).id));
  }
  // The set's own contract wins the registry slot even when a stub claimed
  // the id first (the re-import / stub-heal path).
  const selfId = String((proposal.contract as AnyContract).id);
  contracts.set(selfId, proposal.contract as AnyContract);
  stubIds.delete(selfId);
  if (proposal.mintedTokens) {
    mergeTree(mintedTree, proposal.mintedTokens.tree as Record<string, any>);
    collectLeaves(proposal.mintedTokens.tree as Record<string, any>, [], ledger);
  }
}

// ---------------------------------------------------------------------------
// Pass 2 — the round-8 glyph-ink channel (note 4)
// ---------------------------------------------------------------------------

/** core/mint-tokens.ts's own spellings, reproduced: one token-path segment,
 *  and an anatomy path below the root ('a/b' → 'a-b'). */
const sanitizeSegment = (s: string): string => {
  const seg = s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return seg.length > 0 ? seg : 'part';
};
const partSegment = (segs: string[]): string => (segs.length > 0 ? segs.map(sanitizeSegment).join('-') : 'root');

const colorLeaf = (hex: string) => ({ $value: hex, $type: 'color' });

/** Set a minted leaf by dot path, creating containers in insertion order. */
const putLeaf = (dotPath: string, value: Record<string, string>): void => {
  const segs = dotPath.split('.');
  let node: Record<string, any> = mintedTree;
  for (const seg of segs.slice(0, -1)) node = node[seg] = node[seg] ?? {};
  node[segs[segs.length - 1]] = value;
};

/** Every asset a contract's anatomy draws, `{prop}` refs expanded through
 *  that contract's own enum values (the repo's icon convention). */
const assetsDrawnBy = (contract: AnyContract): string[] => {
  const enums = new Map<string, string[]>(
    (contract.props ?? [])
      .filter((p: any) => Array.isArray(p?.type?.enum))
      .map((p: any) => [String(p.name), p.type.enum as string[]]),
  );
  const out: string[] = [];
  const walk = (part: any): void => {
    const asset = part?.icon?.asset;
    if (typeof asset === 'string') {
      const ref = asset.match(/^\{([a-z][\w-]*)\}$/);
      if (ref) out.push(...(enums.get(ref[1]) ?? []));
      else out.push(asset);
    }
    for (const child of Object.values(part?.parts ?? {})) walk(child);
  };
  for (const part of Object.values(contract.anatomy ?? {})) walk(part);
  return out;
};

// 2a. THE CHILD HALF — a stub whose glyph assets agree on ONE baked ink binds
//     it as `color` and declares the channel overridable. Assets the
//     single-ink test refused keep their own multi-colour markup, so a stub
//     that draws only refused glyphs binds nothing.
/** stub contract id → the one baked ink it draws with. */
const stubInk = new Map<string, string>();
for (const [id, contract] of contracts) {
  if (!stubIds.has(id)) continue;
  const baked = [
    ...new Set(
      assetsDrawnBy(contract)
        .map((a) => manifest.assets[a]?.ink?.baked)
        .filter((h): h is string => typeof h === 'string'),
    ),
  ];
  if (baked.length !== 1) continue;
  const root = contract.anatomy?.root;
  if (!root) continue;
  root.tokens = root.tokens ?? {};
  const dotPath = `imported.stub-${partSegment([id.replace(/^ds\./, '')])}.root.color`;
  root.tokens.color = `{${dotPath}}`;
  root.overridable = [...(root.overridable ?? []), 'color'];
  putLeaf(dotPath, colorLeaf(baked[0]));
  stubInk.set(id, baked[0]);
}

// 2b. THE HOST HALF — a host that draws one of those glyphs in its OWN ink
//     overrides the channel. `instancePrimaryFill` on the nested instance is
//     the observed ink; axes the host does not expose as enum props are
//     interaction states, so they are pinned to their default value (the
//     proposal's anatomy is built from the default plane too). Anything that
//     leaves more than one ink is refused — an override ref carries at most
//     one placeholder, and a wrong constant is worse than the baked default.
/** "Size=xs, State=Hover" → { Size: 'xs', State: 'Hover' } */
const axesOf = (variantName: string): Record<string, string> =>
  Object.fromEntries(
    variantName.split(', ').map((pair) => {
      const i = pair.indexOf('=');
      return [pair.slice(0, i), pair.slice(i + 1)] as [string, string];
    }),
  );

/** Observed ink per nested-instance occurrence of `assets` inside one set. */
const observedInk = (set: DumpSet, assets: Set<string>): Array<{ variant: string; hex: string }> => {
  const out: Array<{ variant: string; hex: string }> = [];
  const walk = (node: DumpNode, variant: string): void => {
    if (node.type === 'INSTANCE') {
      const asset = node.instanceKey !== undefined ? manifest.keyToAsset[node.instanceKey] : undefined;
      const hex = (node as { instancePrimaryFill?: { hex?: string } }).instancePrimaryFill?.hex;
      if (asset !== undefined && assets.has(asset) && hex !== undefined) out.push({ variant, hex: `#${hex}` });
    }
    for (const child of node.children ?? []) walk(child, variant);
  };
  for (const variant of set.variants) for (const child of variant.children ?? []) walk(child, variant.name);
  return out;
};

interface AxisSpec {
  propName: string;
  figmaProperty: string;
  values: string[];
  contractValueOf: Map<string, string>;
}

/** Round 10 — the SMALLEST subset of the host's enum axes the observed ink is
 *  a total function of: every occurrence agrees on a value for its
 *  combination, and every combination in the cartesian is observed. Subsets
 *  are tried by size and then declared order, so the answer is a function of
 *  the contract and the observations alone. null = no subset explains it, and
 *  the ink stays the child's baked default (the round-8 refusal, unchanged). */
const inkAxisFit = (
  occurrences: Array<{ variant: string; hex: string }>,
  specs: AxisSpec[],
): { axes: AxisSpec[]; byCombo: Map<string, string> } | null => {
  const comboOf = (variant: string, axes: AxisSpec[]): string | null => {
    const figma = axesOf(variant);
    const parts: string[] = [];
    for (const a of axes) {
      const v = a.contractValueOf.get(figma[a.figmaProperty]);
      if (v === undefined) return null;
      parts.push(v);
    }
    return parts.join('.');
  };
  const subsets: AxisSpec[][] = [];
  for (let size = 1; size <= specs.length; size++) {
    const build = (start: number, acc: AxisSpec[]): void => {
      if (acc.length === size) { subsets.push([...acc]); return; }
      for (let i = start; i < specs.length; i++) build(i + 1, [...acc, specs[i]]);
    };
    build(0, []);
  }
  for (const axes of subsets) {
    const byCombo = new Map<string, string>();
    let fits = true;
    for (const o of occurrences) {
      const key = comboOf(o.variant, axes);
      if (key === null) { fits = false; break; }
      const seen = byCombo.get(key);
      if (seen !== undefined && seen !== o.hex) { fits = false; break; }
      byCombo.set(key, o.hex);
    }
    if (!fits) continue;
    let total = 1;
    for (const a of axes) total *= a.values.length;
    if (byCombo.size !== total) continue; // partial cartesian → dangling ref
    return { axes, byCombo };
  }
  return null;
};

for (const setName of IMPORT_ORDER) {
  const set = dump[setName] as DumpSet;
  const host = contracts.get(`ds.${componentIdSlug(setName)}`);
  if (!host) continue;
  /** The Figma variant properties the host exposes as enum props; every other
   *  axis in the variant names is an interaction/theme plane the proposal
   *  promoted out of the API. */
  const apiAxes = new Set<string>(
    (host.props ?? [])
      .filter((p: any) => p?.bindings?.figma?.kind === 'VARIANT' && typeof p.bindings.figma.property === 'string')
      .map((p: any) => String(p.bindings.figma.property)),
  );
  /** The host's enum props that ride a Figma VARIANT axis, in declared order,
   *  with the Figma value spelling mapped back to the contract's own. */
  const axisSpecs: AxisSpec[] = (host.props ?? [])
    .filter((p: any) => p?.bindings?.figma?.kind === 'VARIANT' && typeof p.bindings.figma.property === 'string' && p?.type?.enum)
    .map((p: any) => ({
      propName: String(p.name),
      figmaProperty: String(p.bindings.figma.property),
      values: p.type.enum as string[],
      contractValueOf: new Map<string, string>(
        Object.entries(p.bindings.figma.values ?? {}).map(([contractValue, figmaValue]) => [String(figmaValue), contractValue]),
      ),
    }));
  const walk = (part: any, pathSegs: string[]): void => {
    const childId = part?.component?.id;
    if (typeof childId === 'string' && stubInk.has(childId)) {
      const assets = new Set(assetsDrawnBy(contracts.get(childId) as AnyContract));
      const occurrences = observedInk(set, assets);
      if (occurrences.length > 0) {
        const defaults = axesOf(occurrences[0].variant);
        const onDefaultPlane = occurrences.filter((o) => {
          const axes = axesOf(o.variant);
          return Object.keys(axes).every((a) => apiAxes.has(a) || axes[a] === defaults[a]);
        });
        const inks = [...new Set(onDefaultPlane.map((o) => o.hex))];
        const base = `imported.${componentIdSlug(setName)}.${partSegment(pathSegs)}.color`;
        if (inks.length === 1 && inks[0] !== stubInk.get(childId)) {
          part.component.overrides = { ...(part.component.overrides ?? {}), color: `{${base}}` };
          putLeaf(base, colorLeaf(inks[0]));
        } else if (inks.length > 1) {
          // GAP-CLOSING ROUND 10 — PER-USAGE INK THAT IS A FUNCTION OF MORE
          // THAN ONE AXIS. Round 8 refused this outright ("an override ref
          // carries at most one placeholder"), and the refusal was not a
          // named approximation: Social button's icon ink is
          // f(Social x Theme) — white on the brand grounds, #a3a3a3 on Color,
          // the platform's own hex on Color-with-brand — so nothing carried
          // and 48 of its 108 variants drew a WHITE glyph on a WHITE ground.
          // core/emit-react.ts now expands an override ref's placeholders as
          // the compound ancestor selector (.social-facebook.theme-color
          // .socialIcon), so the arity limit is gone and the honest carriage
          // is the SMALLEST axis subset the ink is a total function of.
          // Smallest, and every combination OBSERVED: a partial cartesian
          // would ship a dangling ref, and a bigger subset than the evidence
          // supports would claim a dependency the canvas does not draw.
          const fit = inkAxisFit(onDefaultPlane, axisSpecs);
          if (fit && [...fit.byCombo.values()].some((hex) => hex !== stubInk.get(childId))) {
            part.component.overrides = {
              ...(part.component.overrides ?? {}),
              color: `{${base}.${fit.axes.map((a) => `{${a.propName}}`).join('.')}}`,
            };
            for (const [combo, hex] of fit.byCombo) putLeaf(`${base}.${combo}`, colorLeaf(hex));
          }
        }
      }
    }
    for (const [name, child] of Object.entries(part?.parts ?? {})) walk(child, [...pathSegs, name]);
  };
  for (const part of Object.values(host.anatomy ?? {})) walk(part, []);
}

// ---------------------------------------------------------------------------
// Verify / write
// ---------------------------------------------------------------------------

const serialize = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const built = new Map<string, string>();
for (const [id, contract] of contracts) built.set(`${id.replace(/^ds\./, '')}.contract.json`, serialize(contract));
built.set('minted.dtcg.json', serialize(mintedTree));
built.set('NOTES.md', renderNotes());

function renderNotes(): string {
  const sets = [...notesBySet.keys()].sort();
  const total = [...notesBySet.values()].reduce((n, v) => n + v.length, 0);
  const caveats = [...notesBySet.values()].flat().filter((n) => n.includes('SATURATED')).length;
  const out: string[] = [
    '# Proposal notes — every named decision the inversion made',
    '',
    'Generated by `npx tsx examples/untitled-ui/uui-pipeline.mts --write`. Byte-verified',
    'against a rebuild from `dumps-v2/MERGED.dump.json` by the same drift check that',
    'guards the contracts, so these notes cannot drift from the code that produced them.',
    '',
    'Two kinds of note appear here, and the difference is load-bearing:',
    '',
    '- **REFUSED** — nothing was bound. The fact was measured but no rule fit it, so the',
    '  contract carries no ref and an adopter must bind it by hand.',
    '- **CARRIED, CAVEATED** — the binding EXISTS and reproduces every measured value,',
    '  but the evidence is weaker than the ref shape implies. Today that means exactly',
    "  one thing: a SATURATED axis pair, where the pair's cell count is at least the",
    '  observation count, so every cell holds at most one observation and ANY values',
    '  would have fit. The values are real; the CORRELATION is unwitnessed. Carrying it',
    '  reproduces the drawing; naming it stops the ref from reading as a proven rule.',
    '',
    `**${total} note(s) across ${sets.length} set(s)** — ${caveats} carried-and-caveated, ${total - caveats} refusals.`,
    '',
  ];
  for (const set of sets) {
    out.push(`## ${set}`, '');
    for (const n of notesBySet.get(set)!) out.push(`- ${n}`);
    out.push('');
  }
  return out.join('\n');
}

const pathFor = (file: string): string =>
  file === 'minted.dtcg.json' ? MINTED : file === 'NOTES.md' ? path.join(CONTRACTS, file) : path.join(CONTRACTS, file);

const committed = new Set(readdirSync(CONTRACTS).filter((f) => f.endsWith('.contract.json')));
const orphans = [...committed].filter((f) => !built.has(f));

const drift: string[] = [];
for (const [file, text] of built) {
  let current: string | null = null;
  try {
    current = readFileSync(pathFor(file), 'utf8');
  } catch {
    current = null;
  }
  if (current === text) continue;
  drift.push(current === null ? `${file} (not committed)` : file);
  if (WRITE) writeFileSync(pathFor(file), text);
}

const nContracts = built.size - 2; // minted.dtcg.json + NOTES.md
if (WRITE) {
  console.log(
    drift.length === 0
      ? `= unchanged — ${nContracts} contracts + minted.dtcg.json (${[...built.get('minted.dtcg.json')!.matchAll(/"\$value"/g)].length} leaves)`
      : `✎ rewrote ${drift.length} file(s) of ${built.size} — ${drift.join(', ')}`,
  );
} else if (drift.length === 0 && orphans.length === 0) {
  console.log(
    `✔ ${nContracts}/${nContracts} contracts byte-identical to a rebuild from dumps-v2/MERGED.dump.json\n` +
      `✔ minted.dtcg.json byte-identical (${[...built.get('minted.dtcg.json')!.matchAll(/"\$value"/g)].length} provisional leaves)`,
  );
} else {
  console.error(`✘ ${drift.length + orphans.length} file(s) DIVERGE from a rebuild of the committed dumps — run with --write`);
  for (const f of drift) console.error(`  - ${f}`);
  for (const f of orphans) console.error(`  - ${f} (committed, but no set or stub proposes it)`);
  process.exit(1);
}
