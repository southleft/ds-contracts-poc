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
  const key = c.anchors?.figma?.componentSetKey;
  if (typeof key === 'string' && key.length > 0) contractIdByKey.set(key, c.id);
  sessionClaimedIds.add(c.id);
  if (!contracts.has(c.id)) contracts.set(c.id, c);
};

const fileKey = (dump._provenance as { fileKey?: string | null } | undefined)?.fileKey ?? null;
const textOverrideDemand = textOverrideDemandFromDumps(dump);

for (const setName of IMPORT_ORDER) {
  const proposal: FigmaProposalResult = proposeFromDump(dump[setName] as DumpSet, {
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
        if (inks.length === 1 && inks[0] !== stubInk.get(childId)) {
          const dotPath = `imported.${componentIdSlug(setName)}.${partSegment(pathSegs)}.color`;
          part.component.overrides = { ...(part.component.overrides ?? {}), color: `{${dotPath}}` };
          putLeaf(dotPath, colorLeaf(inks[0]));
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

const pathFor = (file: string): string => (file === 'minted.dtcg.json' ? MINTED : path.join(CONTRACTS, file));

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

const nContracts = built.size - 1;
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
