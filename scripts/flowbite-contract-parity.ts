/**
 * Authored vs captured-code contract parity for the eight Flowbite stems.
 *
 * The North Star hop #5: when both a contract and a surface exist, name
 * where they disagree. This report diffs the authored contracts against the
 * computed-capture enriched contracts (the code-side truth we promoted from).
 * Canvas recovery (Figma dump → proposed) is a separate hop — events will
 * never appear there.
 *
 *   npx tsx scripts/flowbite-contract-parity.ts
 *   npm run parity:flowbite
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const AUTHORED = path.join(ROOT, 'examples', 'tailwind', 'contracts');
const ENRICHED = path.join(ROOT, 'extract', 'computed', 'out', 'tailwind');
const CANVAS = path.join(ROOT, 'parity', 'receipts', 'beta', 'FLOWBITE-CANVAS-INVENTORY.json');
const OUT = path.join(ROOT, 'parity', 'receipts', 'beta', 'FLOWBITE-PARITY.md');

type Prop = {
  name: string;
  type?: unknown;
  bindings?: { code?: { prop?: string }; figma?: { kind?: string; property?: string; values?: Record<string, string> } };
};
type Contractish = {
  id?: string;
  name?: string;
  semantics?: { element?: string; role?: string };
  props?: Prop[];
  events?: Array<{ name: string; trigger?: string; bindings?: { code?: { prop?: string } }; toggles?: { prop?: string } }>;
  anatomy?: unknown;
  states?: string[];
  figmaStatePreviews?: boolean;
};

const walkParts = (node: unknown, acc: string[] = []): string[] => {
  if (!node || typeof node !== 'object') return acc;
  const rec = node as Record<string, unknown>;
  const parts = rec.parts;
  if (parts && typeof parts === 'object') {
    for (const [name, child] of Object.entries(parts as Record<string, unknown>)) {
      acc.push(name);
      walkParts(child, acc);
    }
  }
  return acc;
};

const walkAnatomy = (anatomy: unknown): string[] => {
  if (!anatomy || typeof anatomy !== 'object') return [];
  const acc: string[] = [];
  for (const [name, node] of Object.entries(anatomy as Record<string, unknown>)) {
    acc.push(name);
    walkParts(node, acc);
  }
  return acc;
};

const loadAuthored = (): Map<string, Contractish> => {
  const out = new Map<string, Contractish>();
  for (const f of readdirSync(AUTHORED).filter((n) => n.endsWith('.contract.json'))) {
    const c = JSON.parse(readFileSync(path.join(AUTHORED, f), 'utf8')) as Contractish;
    out.set((c.name ?? f).toLowerCase().replace(/\s+/g, ''), c);
  }
  return out;
};

const loadEnriched = (stem: string): Contractish | null => {
  const p = path.join(ENRICHED, stem, 'enriched.contract.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8')) as Contractish;
};

const stems = ['alert', 'badge', 'button', 'card', 'helpertext', 'kbd', 'label', 'toggleswitch'];
const authored = loadAuthored();

const lines: string[] = [
  '# Flowbite contract parity — authored vs code-capture',
  '',
  `Recorded ${new Date().toISOString().slice(0, 10)}. Authored contracts in`,
  '`examples/tailwind/contracts` vs `extract/computed/out/tailwind/<stem>/enriched.contract.json`.',
  '',
  'This is hop 5 of [NORTH-STAR.md](./NORTH-STAR.md): align the contracts we have',
  '(authored + captured-from-code + canvas property inventory) and **name** the gaps.',
  '',
];

type CanvasProp = { name: string; type: string; options?: string[] | null };
type CanvasSet = { stem: string; id: string; variants: number; boundVarHits: number; props: CanvasProp[] };
const canvasInv = existsSync(CANVAS)
  ? (JSON.parse(readFileSync(CANVAS, 'utf8')) as { fileKey: string; sets: CanvasSet[] })
  : null;
const canvasByStem = new Map((canvasInv?.sets ?? []).map((s) => [s.stem, s]));

let gapCount = 0;
const standing: string[] = [];

for (const stem of stems) {
  const a = authored.get(stem);
  const e = loadEnriched(stem);
  lines.push(`## ${a?.name ?? stem}`);
  lines.push('');
  if (!a) {
    lines.push('- **missing authored contract**');
    gapCount++;
    lines.push('');
    continue;
  }
  if (!e) {
    lines.push('- **no enriched capture** — cannot compare to code-side truth');
    gapCount++;
    lines.push('');
    continue;
  }

  const aProps = new Set((a.props ?? []).map((p) => p.name));
  const eProps = new Set((e.props ?? []).map((p) => p.name));
  const onlyA = [...aProps].filter((p) => !eProps.has(p));
  const onlyE = [...eProps].filter((p) => !aProps.has(p));
  const aParts = new Set(walkAnatomy(a.anatomy));
  const eParts = new Set(walkAnatomy(e.anatomy));
  const partsOnlyA = [...aParts].filter((p) => !eParts.has(p));
  const partsOnlyE = [...eParts].filter((p) => !aParts.has(p));
  const aEvents = a.events ?? [];
  const eEvents = e.events ?? [];

  lines.push(`- host: authored \`${a.semantics?.element ?? '?'}\`${a.semantics?.role ? ` role=${a.semantics.role}` : ''} · captured \`${e.semantics?.element ?? '?'}\``);
  lines.push(`- props: authored [${[...aProps].join(', ') || '∅'}] · captured [${[...eProps].join(', ') || '∅'}]`);
  if (onlyA.length || onlyE.length) {
    lines.push(`- **prop gap** authored-only: ${onlyA.join(', ') || '∅'} · captured-only: ${onlyE.join(', ') || '∅'}`);
    gapCount++;
  } else {
    lines.push('- props: **aligned**');
  }
  lines.push(`- parts: authored ${aParts.size} · captured ${eParts.size}`);
  if (partsOnlyA.length || partsOnlyE.length) {
    lines.push(`- **part gap** authored-only: ${partsOnlyA.join(', ') || '∅'} · captured-only: ${partsOnlyE.join(', ') || '∅'}`);
    gapCount++;
  } else {
    lines.push('- parts: **aligned**');
  }
  if (aEvents.length === 0 && eEvents.length === 0) {
    lines.push('- events: none on either side (presentational)');
  } else if (eEvents.length === 0 && aEvents.length > 0) {
    lines.push(
      `- **event gap (standing)** authored declares ${aEvents.map((ev) => `${ev.bindings?.code?.prop ?? ev.name}@${ev.trigger}`).join(', ')}; captured-from-code has none — the static/type seed never saw handlers`,
    );
    standing.push(`${a.name}: ${aEvents.map((ev) => ev.bindings?.code?.prop ?? ev.name).join(', ')}`);
    gapCount++;
  } else {
    lines.push(`- events: authored ${aEvents.length} · captured ${eEvents.length}`);
  }

  const canvas = canvasByStem.get(stem);
  if (canvas) {
    const authoredFigma = (a.props ?? [])
      .map((p) => p.bindings?.figma)
      .filter((f): f is NonNullable<typeof f> & { property: string; kind: string } =>
        Boolean(f?.property && f.kind && f.kind !== 'NONE'),
      );
    if (a.figmaStatePreviews && (a.states?.length ?? 0) > 0) {
      authoredFigma.push({ kind: 'VARIANT', property: 'State' });
    }
    const canvasNames = new Set(canvas.props.map((p) => p.name));
    const authoredNames = new Set(authoredFigma.map((f) => f.property));
    const missingOnCanvas = [...authoredNames].filter((n) => !canvasNames.has(n));
    const extraOnCanvas = [...canvasNames].filter((n) => !authoredNames.has(n));
    const kindMiss: string[] = [];
    for (const f of authoredFigma) {
      const c = canvas.props.find((p) => p.name === f.property);
      if (c && c.type !== f.kind) kindMiss.push(`${f.property}: authored ${f.kind} vs canvas ${c.type}`);
    }
    if (missingOnCanvas.length || extraOnCanvas.length || kindMiss.length) {
      lines.push(
        `- **canvas prop gap** missing=${missingOnCanvas.join(', ') || '∅'} extra=${extraOnCanvas.join(', ') || '∅'}${kindMiss.length ? ` kind: ${kindMiss.join('; ')}` : ''}`,
      );
      gapCount++;
    } else {
      lines.push(
        `- canvas (${canvas.id}): **props aligned** · ${canvas.variants} variant(s) · ${canvas.boundVarHits} variable binds`,
      );
    }
  } else if (canvasInv) {
    lines.push('- **canvas inventory miss** — stem not in FLOWBITE-CANVAS-INVENTORY.json');
    gapCount++;
  }
  lines.push('');
}

lines.push('## Standing gaps (named, not unfinished)');
lines.push('');
lines.push('1. **Events are authored, never recovered.** Capture-from-code and dump-from-Figma do not invent `onToggle` / `onDismiss`. The functional React hop requires the authored `events[]` block.');
lines.push('2. **Canvas cannot run behavior.** Figma shows ToggleSwitch `checked` and Alert `Dismissable` as variants/booleans. That is the correct projection, not a miss.');
lines.push('3. **`FC-FONT-SUBSTRATE`** — ToggleSwitch Path B visual-truth 6.19% is label glyphs, not track/thumb geometry.');
lines.push('4. **HelperText / Label / Kbd Path B visual-truth** is named `UNSCORED-NO-ORIG-SHOT`. Code-vs-library AA is already perfect (20/20, 20/20, 4/4). Canvas sets exist on `59mLQ…` and are property-aligned. We will not invent a score against the contract’s own gate-shot.');
lines.push('');
if (standing.length) {
  lines.push('Authored events with no captured counterpart:');
  for (const s of standing) lines.push(`- ${s}`);
  lines.push('');
}
lines.push(`**${gapCount} named gap(s) in this report.** Gaps are the product. Closing them silently would be a lie.`);
lines.push('');

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join('\n'));
console.log(`wrote ${path.relative(ROOT, OUT)} (${gapCount} named gap(s))`);
