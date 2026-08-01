/**
 * GAP-CLOSING ROUND 8 — THE SINGLE-INK TEST, and the currentColor
 * normalisation it licenses.
 *
 * Iteration 8 exported each stub's source glyph with its paint BAKED as a
 * presentation attribute (`stroke="#171717"`, `fill="white"`, …). A host that
 * draws the same glyph in its own ink therefore draws the SOURCE ink instead:
 * measured on this kit, 84 occurrences across 7 assets (see the manifest).
 *
 * THE TEST (computed from the SVG's own markup, never assumed):
 *
 *   drawn ink set = every `fill=` / `stroke=` presentation attribute value
 *   on an element that is actually PAINTED — i.e. outside <defs> (a
 *   <clipPath> rect's `fill="white"` paints nothing) — excluding `none`,
 *   `currentColor` and `url(#…)` references, with named colours folded to
 *   hex and hex lowercased/expanded.
 *
 *   |drawn ink set| == 1  → SINGLE-INK. The one hex is the glyph's whole ink,
 *     so the part can carry it as a `color` binding and the markup can draw
 *     `currentColor`: value-identical by construction, and per-usage ink then
 *     rides the existing REF_OVERRIDE_CHANNELS machinery.
 *   |drawn ink set| >= 2 → REFUSED BY NAME. One part colour cannot honestly
 *     serve two paints; the export is left EXACTLY as it came off the canvas.
 *
 * An asset no contract consumes is left alone whatever the test says — those
 * are committed export receipts (manifest `refused` / `circleFill`), and
 * rewriting a receipt would destroy the only thing it is for.
 *
 * IDEMPOTENT: a re-run sees `currentColor` and an empty drawn set, reads the
 * recorded `ink.baked` back out of the manifest, and writes the same bytes.
 * Deterministic and offline — no live Figma, no re-export.
 *
 *   npx tsx examples/untitled-ui/glyph-ink.mts            # report only
 *   npx tsx examples/untitled-ui/glyph-ink.mts --write    # rewrite SVGs + manifest
 *   npx tsx examples/untitled-ui/glyph-ink.mts --check    # fail on any drift
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const ICONS = path.join(HERE, 'assets', 'icons');
const CONTRACTS = path.join(HERE, 'storybook', 'contracts');
const WRITE = process.argv.includes('--write');
const CHECK = process.argv.includes('--check');

/** The only named colours iteration 8's exporter emits. Anything else stays
 *  verbatim and lands in the ink set as-is, so an unknown name can never be
 *  silently folded into a hex it does not equal. */
const NAMED: Record<string, string> = { white: '#ffffff', black: '#000000' };

const normHex = (raw: string): string => {
  const v = raw.trim().toLowerCase();
  if (NAMED[v]) return NAMED[v];
  const m = v.match(/^#([0-9a-f]{3})$/);
  if (m) return `#${m[1][0]}${m[1][0]}${m[1][1]}${m[1][1]}${m[1][2]}${m[1][2]}`;
  return v;
};

/** Everything between <defs> and </defs> paints nothing (clipPath/mask/
 *  gradient definitions). Blanked, not deleted, so offsets stay honest. */
const withoutDefs = (svg: string): string => svg.replace(/<defs>[\s\S]*?<\/defs>/g, '');

/** THE SINGLE-INK TEST — the drawn ink set, from the markup alone. */
export function drawnInks(svg: string): string[] {
  const inks = new Set<string>();
  for (const m of withoutDefs(svg).matchAll(/\s(?:fill|stroke)="([^"]+)"/g)) {
    const v = m[1].trim();
    if (v === 'none' || v === 'currentColor' || v.startsWith('url(')) continue;
    inks.add(normHex(v));
  }
  return [...inks].sort();
}

/** Rewrite the ONE drawn ink to currentColor, outside <defs> only. */
function toCurrentColor(svg: string, ink: string): string {
  const parts = svg.split(/(<defs>[\s\S]*?<\/defs>)/g);
  return parts
    .map((chunk, i) =>
      i % 2 === 1
        ? chunk
        : chunk.replace(/(\s(?:fill|stroke)=")([^"]+)(")/g, (whole, a, v, b) =>
            v === 'none' || v === 'currentColor' || v.startsWith('url(') || normHex(v) !== ink
              ? whole
              : `${a}currentColor${b}`,
          ),
    )
    .join('');
}

/** Which assets any committed contract actually draws — `{prop}` asset refs
 *  expand through the referencing contract's own enum values. */
function consumedAssets(): Set<string> {
  const out = new Set<string>();
  for (const file of readdirSync(CONTRACTS).filter((f) => f.endsWith('.contract.json'))) {
    const c = JSON.parse(readFileSync(path.join(CONTRACTS, file), 'utf8'));
    const enums = new Map<string, string[]>(
      (c.props ?? [])
        .filter((p: { type?: { enum?: string[] } }) => Array.isArray(p.type?.enum))
        .map((p: { name: string; type: { enum: string[] } }) => [p.name, p.type.enum]),
    );
    const walk = (part: Record<string, any>): void => {
      const asset = part?.icon?.asset;
      if (typeof asset === 'string') {
        const ref = asset.match(/^\{([a-z][\w-]*)\}$/);
        if (ref) for (const v of enums.get(ref[1]) ?? []) out.add(v);
        else out.add(asset);
      }
      for (const child of Object.values(part?.parts ?? {})) walk(child as Record<string, any>);
    };
    for (const part of Object.values(c.anatomy ?? {})) walk(part as Record<string, any>);
  }
  return out;
}

/** ------------------------------------------------------------------------
 *  PER-USAGE INK CARRIAGE — measured from the committed dumps, not asserted.
 *
 *  Normalising the markup only makes per-usage ink POSSIBLE. Whether a given
 *  host can actually carry it is a property of the observed data: an override
 *  ref substitutes AT MOST ONE enum axis (core/emit-react.ts — "override refs
 *  carry at most 1"), so the observed ink at a nesting site is carriable only
 *  when it is constant, or a function of exactly one of the host's own variant
 *  axes. Anything else is REFUSED BY NAME with the axes it actually depends on.
 *  ---------------------------------------------------------------------- */
const DUMPS = path.join(HERE, 'dumps-v2');
const META = new Set(['_provenance', '_degradations', '_variables']);

/** A usage site is one HOST ▸ one nested STUB — the unit an override ref is
 *  attached to. Several assets can share one site (social-button nests ONE
 *  `Social icon` part whose `{platform}` picks the mark), which is exactly why
 *  the site, not the asset, is what the axis test has to be run over. */
type Site = { host: string; stub: string; assets: Set<string>; inkByVariant: Map<string, string> };

function usageSites(keyToAsset: Record<string, string>, assetToStub: Map<string, string>): Site[] {
  const byKey = new Map<string, Site>();
  for (const file of readdirSync(DUMPS).filter((f) => f.endsWith('.dump.json') && f !== 'MERGED.dump.json')) {
    const host = file.replace(/\.dump\.json$/, '');
    const dump = JSON.parse(readFileSync(path.join(DUMPS, file), 'utf8')) as Record<string, any>;
    for (const [setName, set] of Object.entries(dump)) {
      if (META.has(setName) || !Array.isArray(set?.variants)) continue;
      for (const variant of set.variants) {
        const walk = (node: any): void => {
          if (node?.type === 'INSTANCE') {
            const asset = keyToAsset[node.instanceKey];
            const hex = node.instancePrimaryFill?.hex;
            if (asset && hex) {
              const stub = assetToStub.get(asset) ?? `(not drawn as a glyph) ${asset}`;
              const k = `${host} ${stub}`;
              if (!byKey.has(k)) byKey.set(k, { host, stub, assets: new Set(), inkByVariant: new Map() });
              const site = byKey.get(k)!;
              site.assets.add(asset);
              site.inkByVariant.set(`${variant.name} ▸ ${asset}`, `#${hex}`);
            }
          }
          for (const child of node?.children ?? []) walk(child);
        };
        for (const child of variant.children ?? []) walk(child);
      }
    }
  }
  return [...byKey.values()].sort((a, b) => (a.stub + a.host).localeCompare(b.stub + b.host));
}

/** "Size=xs, State=Hover" → { Size: 'xs', State: 'Hover' } */
const axesOf = (variantName: string): Record<string, string> =>
  Object.fromEntries(
    variantName.split(', ').map((pair) => {
      const i = pair.indexOf('=');
      return [pair.slice(0, i), pair.slice(i + 1)];
    }),
  );

/** The SMALLEST set of host axes the observed ink is a function of. */
function inkAxes(inkByVariant: Map<string, string>): { inks: string[]; axes: string[] } {
  const inks = [...new Set(inkByVariant.values())].sort();
  if (inks.length <= 1) return { inks, axes: [] };
  const rows = [...inkByVariant].map(([name, ink]) => ({ a: axesOf(name), ink }));
  const allAxes = [...new Set(rows.flatMap((r) => Object.keys(r.a)))].sort();
  const functional = (pick: string[]): boolean => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      const k = pick.map((p) => r.a[p]).join(' ');
      if (seen.has(k) && seen.get(k) !== r.ink) return false;
      seen.set(k, r.ink);
    }
    return true;
  };
  for (let size = 1; size <= allAxes.length; size++) {
    const combos: string[][] = [[]];
    for (let i = 0; i < size; i++) {
      const next: string[][] = [];
      for (const c of combos) {
        const from = c.length ? allAxes.indexOf(c[c.length - 1]) + 1 : 0;
        for (let j = from; j < allAxes.length; j++) next.push([...c, allAxes[j]]);
      }
      combos.length = 0;
      combos.push(...next);
    }
    for (const c of combos) if (functional(c)) return { inks, axes: c };
  }
  return { inks, axes: allAxes };
}

type Ink =
  | { baked: string; draws: 'currentColor' }
  | { drawn: string[]; refused: string };

const manifestPath = path.join(ICONS, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  $note: string;
  $inkNote?: string;
  $perUsageInkNote?: string;
  assets: Record<string, Record<string, unknown>>;
  keyToAsset: Record<string, string>;
  perUsageInk?: Record<string, unknown>;
};

const consumed = consumedAssets();
const drift: string[] = [];
const rows: Array<[string, string, string]> = [];

for (const file of readdirSync(ICONS).filter((f) => f.endsWith('.svg')).sort()) {
  const asset = file.replace(/\.svg$/, '');
  const svgPath = path.join(ICONS, file);
  const svg = readFileSync(svgPath, 'utf8');
  const entry = manifest.assets[asset];
  if (!entry) {
    drift.push(`${asset}: committed SVG with no manifest entry`);
    continue;
  }
  const inks = drawnInks(svg);
  const recorded = entry.ink as Ink | undefined;
  const baked = inks.length === 1 ? inks[0] : recorded && 'baked' in recorded ? recorded.baked : undefined;

  // An unconsumed asset is a committed export RECEIPT — never rewritten.
  if (!consumed.has(asset)) {
    const why = entry.refused
      ? 'export receipt (refused for carriage) — no contract draws it'
      : 'geometry witness — no contract draws it';
    const ink: Ink = { drawn: inks, refused: `${inks.length === 1 ? 'single-ink' : `${inks.length} drawn inks`}, but NOT NORMALISED: ${why}` };
    rows.push([asset, `receipt (${inks.length} ink${inks.length === 1 ? '' : 's'})`, why]);
    if (JSON.stringify(entry.ink) !== JSON.stringify(ink)) {
      drift.push(`${asset}: manifest ink record out of date`);
      if (WRITE) entry.ink = ink;
    }
    continue;
  }

  if (inks.length >= 2) {
    const ink: Ink = {
      drawn: inks,
      refused: `${inks.length} distinct drawn inks — one part colour cannot carry them; left exactly as exported`,
    };
    rows.push([asset, `REFUSED (${inks.length} inks)`, inks.join(' ')]);
    if (JSON.stringify(entry.ink) !== JSON.stringify(ink)) {
      drift.push(`${asset}: manifest ink record out of date`);
      if (WRITE) entry.ink = ink;
    }
    continue;
  }

  if (baked === undefined) {
    drift.push(`${asset}: no drawn ink and no recorded ink.baked — cannot classify`);
    continue;
  }

  const want = inks.length === 1 ? toCurrentColor(svg, baked) : svg;
  const ink: Ink = { baked, draws: 'currentColor' };
  rows.push([asset, 'normalised', `${baked} → currentColor`]);
  if (want !== svg) {
    drift.push(`${asset}.svg: baked ${baked} not normalised to currentColor`);
    if (WRITE) writeFileSync(svgPath, want);
  }
  if (JSON.stringify(entry.ink) !== JSON.stringify(ink)) {
    drift.push(`${asset}: manifest ink record out of date`);
    if (WRITE) entry.ink = ink;
  }
}

const INK_NOTE =
  'ROUND 8 — THE SINGLE-INK TEST (examples/untitled-ui/glyph-ink.mts, re-runnable offline). Each asset\'s `ink` field is computed from the SVG\'s own markup: the drawn ink set is every fill/stroke presentation value on a PAINTED element (outside <defs> — a clipPath rect paints nothing), minus none/currentColor/url(). Exactly one drawn ink → the glyph carries that hex as its part\'s `color` binding and the markup draws `currentColor`, so per-usage ink rides the REF_OVERRIDE_CHANNELS `color` channel; the rendering is value-identical when no host overrides. Two or more → REFUSED BY NAME and left EXACTLY as exported. An asset no contract draws is a committed export receipt and is never rewritten, whatever the test says.';

const USAGE_NOTE =
  'ROUND 8 — PER-USAGE INK CARRIAGE, one row per (host set ▸ asset), every field READ from dumps-v2 instancePrimaryFill and the committed contracts; nothing typed in. `occurrences` counts the nested instances the dump records. `observed` is the distinct ink set at that site. `axes` is the SMALLEST set of the host\'s own variant axes the ink is a function of. An override ref substitutes at most ONE enum axis (core/emit-react.ts: "override refs carry at most 1"), so `carried` is true only for 0 or 1 axis AND only when the glyph itself passed the single-ink test; every false carries its reason. A refused site keeps drawing the glyph\'s own baked ink — the absent-field no-op, never a silent guess.';

function usageRecord(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const overrides = new Map<string, string>(); // "host asset" → override ref
  for (const file of readdirSync(CONTRACTS).filter((f) => f.endsWith('.contract.json'))) {
    const c = JSON.parse(readFileSync(path.join(CONTRACTS, file), 'utf8'));
    const host = file.replace(/\.contract\.json$/, '');
    const walk = (part: Record<string, any>): void => {
      const id = part?.component?.id as string | undefined;
      if (id) {
        const child = id.replace(/^ds\./, '');
        const ref = part.component.overrides?.color;
        if (ref) overrides.set(`${host} ${child}`, ref);
      }
      for (const ch of Object.values(part?.parts ?? {})) walk(ch as Record<string, any>);
    };
    for (const part of Object.values(c.anatomy ?? {})) walk(part as Record<string, any>);
  }

  // asset → the stub contract that DRAWS it (the unit an override attaches to).
  const assetToStub = new Map<string, string>();
  for (const file of readdirSync(CONTRACTS).filter((f) => f.endsWith('.contract.json'))) {
    const c = JSON.parse(readFileSync(path.join(CONTRACTS, file), 'utf8'));
    const stub = file.replace(/\.contract\.json$/, '');
    const enums = new Map<string, string[]>(
      (c.props ?? [])
        .filter((pr: { type?: { enum?: string[] } }) => Array.isArray(pr.type?.enum))
        .map((pr: { name: string; type: { enum: string[] } }) => [pr.name, pr.type.enum]),
    );
    const walk = (part: Record<string, any>): void => {
      const a = part?.icon?.asset;
      if (typeof a === 'string') {
        const ref = a.match(/^\{([a-z][\w-]*)\}$/);
        if (ref) for (const v of enums.get(ref[1]) ?? []) assetToStub.set(v, stub);
        else assetToStub.set(a, stub);
      }
      for (const ch of Object.values(part?.parts ?? {})) walk(ch as Record<string, any>);
    };
    for (const part of Object.values(c.anatomy ?? {})) walk(part as Record<string, any>);
  }

  for (const site of usageSites(manifest.keyToAsset, assetToStub)) {
    const assets = [...site.assets].sort();
    const glyphs = assets.filter((a) => assetToStub.has(a));
    const inkRecords = glyphs.map((a) => manifest.assets[a]?.ink as Ink | undefined);
    const singleInk = glyphs.length > 0 && inkRecords.every((i) => i && 'baked' in i);
    const { inks, axes } = inkAxes(site.inkByVariant);
    const carriedRef = overrides.get(`${site.host} ${site.stub}`);
    let refused: string | undefined;
    if (glyphs.length === 0) {
      refused = `the host nests a NON-GLYPH stub (${assets.join(', ')} is a geometry witness, not an icon part) — this class is out of the baked-ink scope; its ink rides whatever channel that stub already declares`;
    } else if (!singleInk) {
      const worst = Math.max(...inkRecords.map((i) => (i && 'drawn' in i ? i.drawn.length : 0)));
      refused = `glyph refused by the single-ink test (${worst} drawn inks) — nothing to recolour without destroying the mark`;
    } else if (axes.length > 1) {
      refused = `observed ink is a function of ${axes.length} host axes (${axes.join(' × ')}) — an override ref substitutes at most 1 (core/emit-react.ts); the glyph keeps its own baked ink`;
    } else if (!carriedRef) {
      refused = `no color override on the nesting part — the glyph keeps its own baked ink`;
    }
    // A CONSTANT ref against a ONE-AXIS ink carries only part of the truth:
    // name the observed values it does NOT reach, and where they occur.
    let partial: Record<string, string> | undefined;
    if (carriedRef && !/\{[a-z]/.test(carriedRef.replace(/^\{|\}$/g, ''))) {
      const value = tokenValue(carriedRef);
      const missed: Record<string, string> = {};
      for (const [key, ink] of site.inkByVariant) if (ink !== value) missed[key.split(' ▸ ')[0]] = ink;
      if (Object.keys(missed).length > 0) partial = missed;
    }
    out[`${site.host} ▸ ${site.stub}`] = {
      occurrences: site.inkByVariant.size,
      assets,
      observed: inks,
      axes,
      ...(carriedRef ? { carried: carriedRef } : {}),
      ...(partial
        ? {
            partial: `the override ref is CONSTANT, so ${Object.keys(partial).length} of ${site.inkByVariant.size} occurrences keep an ink the contract does not carry — the divergence rides a host axis that is not a declared enum prop (a CSS interaction state), which a 1-placeholder override cannot express`,
            uncarried: partial,
          }
        : {}),
      ...(refused ? { refused } : {}),
    };
  }
  return out;
}

/** Resolve a `{imported.x.y.z}` ref against the committed token trees —
 *  so a "carried" claim can be CHECKED against the observed ink, not trusted. */
const TOKEN_TREES = ['captured.dtcg.json', 'minted.dtcg.json'].map((f) =>
  JSON.parse(readFileSync(path.join(HERE, 'storybook', 'tokens', f), 'utf8')),
);
function tokenValue(ref: string): string | undefined {
  const segs = ref.replace(/^\{|\}$/g, '').split('.');
  for (const tree of TOKEN_TREES) {
    let node: any = tree;
    for (const seg of segs) node = node?.[seg];
    if (node && typeof node.$value === 'string') return node.$value;
  }
  return undefined;
}

const usage = usageRecord();
if (WRITE) {
  manifest.$inkNote = INK_NOTE;
  manifest.$perUsageInkNote = USAGE_NOTE;
  manifest.perUsageInk = usage;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
} else {
  if (manifest.$inkNote !== INK_NOTE) drift.push('manifest.$inkNote out of date');
  if (manifest.$perUsageInkNote !== USAGE_NOTE) drift.push('manifest.$perUsageInkNote out of date');
  if (JSON.stringify(manifest.perUsageInk) !== JSON.stringify(usage)) drift.push('manifest.perUsageInk out of date');
}

const w = Math.max(...rows.map((r) => r[0].length));
for (const [a, verdict, detail] of rows) {
  console.log(`  ${a.padEnd(w)}  ${verdict.padEnd(22)}  ${detail}`);
}
console.log(
  `\n${rows.filter((r) => r[1] === 'normalised').length} normalised · ` +
    `${rows.filter((r) => r[1].startsWith('REFUSED')).length} refused (multi-ink) · ` +
    `${rows.filter((r) => r[1].startsWith('receipt')).length} untouched receipts`,
);

if (drift.length > 0) {
  console.log(`\n${WRITE ? '✎ rewrote' : '✘ drift'} — ${drift.length}:`);
  for (const d of drift) console.log(`  - ${d}`);
  if (CHECK) process.exit(1);
}
