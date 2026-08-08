/**
 * dumps/REST-RECOVERY.json — the dump v1.16 channels RECOVERED over REST for
 * the two named degradation classes the committed plugin dump (v1.11,
 * pre-gradient/pre-textCase) could not carry:
 *
 *   · GRADIENT_LINEAR fills  (16 `paint-unsupported` receipts — Badge
 *     accent/info/warning/featured and Molecules/Alert grounds)
 *   · textCase UPPER         (`text-channel-unsupported` receipts — Badge
 *     labels render "Label" for "LABEL")
 *
 * The honest recapture is a plugin re-dump with dump v1.16
 * (extract/figma/dump.plugin.js now carries both channels), but that needs
 * the Eventz file open in Figma Desktop with the bridge plugin. This sidecar
 * is the REST projection of EXACTLY those two channels — same fact shapes as
 * the dump grammar (DumpGradient / DumpText.textCase), fetched from the same
 * file the dump names, grafted in-memory by eventz-pipeline.mts with its own
 * provenance receipt. Nothing else is recovered; a fact whose node the dump
 * cannot host (REST descends into instances, dump v1 stops at their
 * boundary) is a NAMED skip, never a graft into invented anatomy.
 *
 * KNOWN LIMIT, named: gradient stops that ride bound variables carry their
 * RESOLVED colors only — the REST variables endpoint is Enterprise-only, so
 * the stop-level variable NAMES are not recoverable on this route (they are
 * counted per fact as `stopsBound`); a v1.16 plugin recapture resolves them.
 *
 *   source .env && npx tsx examples/eventz-vars/fetch-rest-recovery.mts
 *
 * Requires FIGMA_TOKEN with read access to the dump's fileKey; on failure it
 * reports and exits 1 — it never substitutes another source of truth.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
// @ts-ignore — untyped committed helper, the same import fetch-references.mts uses
import { figmaToken, fetchNodes } from '../../extract/figma/visual-truth/rest.mjs';
import type { DumpGradient, DumpNode, DumpSet } from '../../extract/figma/types.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..', '..');
const CACHE = path.join(ROOT, 'extract', 'figma', 'visual-parity', 'out', 'eventz-vars-recovery');
const OUT = path.join(HERE, 'dumps', 'REST-RECOVERY.json');

const dump = JSON.parse(readFileSync(path.join(HERE, 'dumps', 'MERGED.json'), 'utf8')) as Record<string, any>;
const fileKey: string | undefined = dump._provenance?.fileKey;
if (!fileKey) {
  console.error('FATAL: dumps/MERGED.json carries no _provenance.fileKey — cannot address the source file');
  process.exit(1);
}

const sets = Object.keys(dump).filter((k) => !k.startsWith('_'));
const token = figmaToken(ROOT);
// depth 4 reaches every dump-reachable node (variant root → frames → text);
// deeper nodes live inside instances the dump does not host anyway.
const res = await fetchNodes(CACHE, token, fileKey, sets.map((s) => (dump[s] as DumpSet).nodeId), { depth: 4 });
if (!res.ok) {
  console.error(`FATAL: /v1/files/${fileKey}/nodes answered ${res.status} — fix access and re-run; nothing is substituted.`);
  process.exit(1);
}

const round4 = (v: number) => Math.round(v * 10000) / 10000;
const rgbToHex = (c: { r: number; g: number; b: number }) =>
  [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

interface RecoveredFact {
  set: string;
  variant: string;
  /** Child NAME path from the variant root ([] = the root itself). */
  path: string[];
  gradient?: DumpGradient;
  /** Stops observed bound to variables REST cannot NAME (Enterprise-only
   *  endpoint) — counted so the loss is receipted, never silent. */
  stopsBound?: number;
  textCase?: 'UPPER' | 'LOWER' | 'TITLE';
}

/** Is this node path hosted by the committed dump? (dump v1 stops at
 *  INSTANCE boundaries — facts inside instances are NAMED skips.) */
const dumpHosts = (set: string, variant: string, p: string[]): boolean => {
  const v = (dump[set] as DumpSet).variants.find((x) => x.name === variant);
  if (!v) return false;
  let node: DumpNode | undefined = v;
  for (const name of p) {
    if (node.type === 'INSTANCE') return false;
    node = (node.children ?? []).find((c) => c.name === name);
    if (!node) return false;
  }
  return node.type !== 'INSTANCE' || p.length === 0;
};

const facts: RecoveredFact[] = [];
const skips: string[] = [];

for (const setName of sets) {
  const setDump = dump[setName] as DumpSet;
  const doc = res.nodes.get(setDump.nodeId);
  if (!doc) {
    console.error(`FATAL: set "${setName}" nodeId ${setDump.nodeId} unknown to the REST API — the dump and the live file disagree; re-dump first.`);
    process.exit(1);
  }
  const variants: any[] = doc.type === 'COMPONENT_SET' ? (doc.children ?? []) : [doc];
  for (const variant of variants) {
    const walk = (n: any, p: string[]): void => {
      const fills: any[] = Array.isArray(n.fills) ? n.fills.filter((f: any) => f.visible !== false) : [];
      const solid = fills.find((f) => f.type === 'SOLID');
      const grad = fills.find((f) => f.type === 'GRADIENT_LINEAR');
      if (grad && (!solid || fills.indexOf(grad) > fills.indexOf(solid)) && Array.isArray(grad.gradientHandlePositions) && grad.gradientHandlePositions.length >= 2 && Array.isArray(grad.gradientStops) && grad.gradientStops.length >= 2) {
        if (!dumpHosts(setName, variant.name, p)) {
          skips.push(`${setName}:${variant.name}/${p.join('/')} gradient — node not hosted by the committed dump (instance interior); skipped by name`);
        } else {
          const h = grad.gradientHandlePositions;
          let stopsBound = 0;
          const gradient: DumpGradient = {
            start: { x: round4(h[0].x), y: round4(h[0].y) },
            end: { x: round4(h[1].x), y: round4(h[1].y) },
            stops: grad.gradientStops.map((s: any) => {
              if (s.boundVariables?.color) stopsBound++;
              const stop: DumpGradient['stops'][number] = { position: round4(s.position), hex: rgbToHex(s.color) };
              const sa = s.color?.a ?? 1;
              if (sa < 1) stop.alpha = round4(sa);
              return stop;
            }),
          };
          if ((grad.opacity ?? 1) < 1) gradient.alpha = round4(grad.opacity);
          facts.push({ set: setName, variant: variant.name, path: p, gradient, ...(stopsBound > 0 ? { stopsBound } : {}) });
        }
      }
      const tc = n.style?.textCase;
      if (tc === 'UPPER' || tc === 'LOWER' || tc === 'TITLE') {
        if (!dumpHosts(setName, variant.name, p)) {
          skips.push(`${setName}:${variant.name}/${p.join('/')} textCase ${tc} — node not hosted by the committed dump (instance interior); skipped by name`);
        } else {
          facts.push({ set: setName, variant: variant.name, path: p, textCase: tc });
        }
      }
      for (const c of n.children ?? []) walk(c, [...p, c.name]);
    };
    walk(variant, []);
  }
}

facts.sort((a, b) =>
  a.set.localeCompare(b.set) || a.variant.localeCompare(b.variant) || a.path.join('/').localeCompare(b.path.join('/')) || (a.gradient ? 0 : 1) - (b.gradient ? 0 : 1),
);

const out = {
  _provenance: {
    fileKey,
    fetchedAt: new Date().toISOString().slice(0, 10),
    fileVersion: res.version ?? 'unversioned',
    note:
      'REST recovery sidecar (examples/eventz-vars/fetch-rest-recovery.mts) — dump v1.16 gradient/textCase facts for the committed v1.11 plugin dump, grafted in-memory by eventz-pipeline.mts. Supersede by a full v1.16 plugin re-dump.',
    source: `GET /v1/files/${fileKey}/nodes?depth=4`,
  },
  facts,
};

writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(`✎ ${path.relative(ROOT, OUT)} — ${facts.length} fact(s): ${facts.filter((f) => f.gradient).length} gradient, ${facts.filter((f) => f.textCase).length} textCase; ${skips.length} named skip(s)`);
for (const s of skips) console.log(`  SKIP ${s}`);
const bound = facts.reduce((n, f) => n + (f.stopsBound ?? 0), 0);
if (bound > 0) {
  console.log(`  NOTE ${bound} gradient stop binding(s) observed but not nameable over REST (variables endpoint is Enterprise-only) — stops carry resolved colors; a dump v1.16 plugin recapture resolves the names`);
}
