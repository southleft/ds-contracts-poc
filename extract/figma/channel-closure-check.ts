/**
 * THE CLOSURE GATE — `npm run closure:check`
 *
 * THE PROBLEM THIS REPLACES. "Find every edge case" is unbounded and therefore
 * hopeless: you discover holes one production failure at a time, forever. This
 * converts it into a FINITE, MACHINE-CHECKED PROPERTY.
 *
 * THE INVARIANT. If the canvas can DRAW a channel, then the Figma READER must
 * either read that channel back, or NAME a degradation for it. Anything else is
 * a fact the engine can write and can never recover — a one-directional hole,
 * and the round trip loses it silently.
 *
 * WHY THIS SHAPE. Five parallel audits (2026-08-02) found the project's worst
 * defects, and the four highest-ranked read-side gaps shared ONE shape: the
 * write side has the channel, the read side does not, and no refusal fires.
 * Mining an independent project's 63 architecture decisions for edge cases
 * produced mostly things we already cover — and the ones we missed collapsed
 * into this same class. A class with one shape deserves a gate, not a list of
 * individual bug fixes that leaves the NEXT instance to be found by an adopter.
 *
 * WHAT IT DOES NOT CLAIM. Passing does not mean lossless. Figma has no cascade,
 * no inheritance, no container queries; CSS has no component-property types.
 * Some facts genuinely have no counterpart, and for those the correct outcome
 * is a NAMED degradation, which this gate accepts. The bar is "nothing is lost
 * SILENTLY", never "nothing is lost".
 *
 * MACHINE-READABLE BY DESIGN. `--json` emits the per-channel verdict, because
 * that artifact is the input an AI-assisted layer would consume: the named gaps
 * are its work queue. A human-readable-only gate would have to be re-parsed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DECLARED_CHANNELS } from '@ds-contracts/schema';

const ROOT = process.cwd();
const JSON_OUT = process.argv.includes('--json');

/** The Figma readers. A channel is READ if any of these names its property. */
const READERS = [
  'extract/figma/dump.plugin.js', // the Plugin API path — the primary one
  'extract/figma/rest/map.ts', // the REST path
];

/**
 * CSS draw-channel → the Figma node property that carries the same fact.
 *
 * THIS MAP IS THE REVIEWABLE ARTIFACT. It is hand-authored on purpose: deciding
 * that `text-overflow` corresponds to `textTruncation` is a judgement about two
 * products, not something derivable from either. A draw channel MISSING from
 * this map is a hard refusal below — so a channel added tomorrow cannot slip
 * through by being unmapped, which is exactly how the existing holes formed.
 *
 * `degradation` names the receipt code that legitimately stands in for a
 * reader: the fact is not carried, but the adopter is told. That is a PASS
 * under this gate's bar, and it is recorded distinctly from a real read so the
 * two can never be confused in the JSON.
 */
interface ChannelMap {
  /** Figma node properties that would carry this fact. */
  properties: string[];
  /** A degradation code that names the loss instead of carrying it. */
  degradation?: string;
  /** Why this channel needs no property lookup (structural, not a node field). */
  structural?: string;
}

const CHANNEL_TO_FIGMA: Record<string, ChannelMap> = {
  // Folded into absolute offsets at lowering; recovered from geometry, not
  // from a `transform` field — Figma has none.
  transform: { properties: ['absoluteBoundingBox', 'relativeTransform'], structural: 'lowered into absolute x/y; read back as geometry' },
  translate: { properties: ['absoluteBoundingBox', 'relativeTransform'], structural: 'lowered into absolute x/y; read back as geometry' },
  // Figma's box model is fixed; strokeAlign is the nearest analogue and IS read.
  'box-sizing': { properties: ['strokeAlign'], structural: "Figma has no box-sizing; strokeAlign carries the inside/outside distinction" },
  'aspect-ratio': { properties: ['targetAspectRatio'], degradation: 'aspect-ratio-unsupported' },
  'text-overflow': { properties: ['textTruncation', 'maxLines'], degradation: 'text-channel-unsupported' },
  'text-transform': { properties: ['textCase'], degradation: 'text-channel-unsupported' },
  'text-decoration-line': { properties: ['textDecoration'], degradation: 'text-channel-unsupported' },
  'text-align': { properties: ['textAlignHorizontal', 'textAlignVertical'], degradation: 'text-channel-unsupported' },
  'font-family': { properties: ['fontName'] },
};

const sources = new Map(READERS.map((r) => [r, readFileSync(path.join(ROOT, r), 'utf8')]));

/**
 * MENTIONED ANYWHERE — including inside a refusal message.
 *
 * This is deliberately NOT the same question as "is it read". The first version
 * of this gate used only this, and the moment a degradation message quoted the
 * property name the channel flipped to READ — the gate reporting carriage
 * because a refusal mentioned the word. That is the exact defect class this
 * file exists to catch, reproduced inside the catcher.
 */
const mentions = (needle: string): string[] =>
  [...sources.entries()].filter(([, text]) => text.includes(needle)).map(([f]) => f);

/**
 * ACTUALLY READ — the property appears on at least one line that is not part of
 * a refusal. A property whose every occurrence sits inside `degrade(...)` or a
 * `channels.push(...)` that feeds one is NAMED, not carried, and the two must
 * never be reported with the same word.
 */
const readsValue = (needle: string): string[] =>
  [...sources.entries()]
    .filter(([, text]) =>
      text
        .split('\n')
        .some((line) => line.includes(needle) && !/degrade\(|channels\.push\(/.test(line)),
    )
    .map(([f]) => f);

type Verdict = 'READ' | 'NAMED' | 'STRUCTURAL' | 'SILENT' | 'UNMAPPED';
interface Row {
  channel: string;
  verdict: Verdict;
  properties: string[];
  readBy: string[];
  degradation?: string;
  detail: string;
}

const rows: Row[] = [];
for (const [channel, spec] of Object.entries(DECLARED_CHANNELS)) {
  if ((spec as { canvas?: string }).canvas !== 'draw') continue;
  const map = CHANNEL_TO_FIGMA[channel];
  if (!map) {
    rows.push({
      channel,
      verdict: 'UNMAPPED',
      properties: [],
      readBy: [],
      detail:
        'the canvas DRAWS this channel and no entry in CHANNEL_TO_FIGMA says which Figma property carries it back — add one (or a degradation code) rather than leaving the direction undecided',
    });
    continue;
  }
  // DEGRADATION IS CHECKED FIRST, ON PURPOSE. A channel whose map declares a
  // degradation is claiming "not carried, but named" — and its refusal LOGIC
  // necessarily touches the property (`if (node.textAlignHorizontal !== 'LEFT')`
  // reads it in order to decide whether to complain). Testing "is the property
  // mentioned" first therefore reports NAMED channels as READ, which is the
  // gate flattering itself. The declared intent wins; the gate's job is to
  // verify the mechanism it claims actually exists.
  const readBy = [...new Set(map.properties.flatMap(readsValue))];
  if (map.degradation) {
    const named = mentions(map.degradation).length > 0;
    rows.push(
      named
        ? { channel, verdict: 'NAMED', properties: map.properties, readBy: [], degradation: map.degradation, detail: `NOT carried — named by \`${map.degradation}\`` }
        : { channel, verdict: 'SILENT', properties: map.properties, readBy: [], degradation: map.degradation, detail: `claims degradation \`${map.degradation}\` but NO reader raises that code` },
    );
  } else if (readBy.length > 0) {
    rows.push({ channel, verdict: 'READ', properties: map.properties, readBy, detail: `read as ${map.properties.join(' / ')}` });
  } else if (map.structural) {
    rows.push({ channel, verdict: 'STRUCTURAL', properties: map.properties, readBy: [], detail: map.structural });
  } else {
    rows.push({
      channel, verdict: 'SILENT', properties: map.properties, readBy: [],
      detail: `the canvas draws it; NO reader mentions ${map.properties.join(' / ')} and no degradation names the loss — a fact the engine can write and can never read back`,
    });
  }
}

rows.sort((a, b) => a.channel.localeCompare(b.channel));
const broken = rows.filter((r) => r.verdict === 'SILENT' || r.verdict === 'UNMAPPED');

if (JSON_OUT) {
  const out = path.join(ROOT, 'extract', 'figma', 'channel-closure.json');
  writeFileSync(out, `${JSON.stringify({ generatedBy: 'extract/figma/channel-closure-check.ts', rows, summary: { total: rows.length, silent: broken.length } }, null, 2)}\n`);
  console.log(`wrote ${path.relative(ROOT, out)}`);
}

const MARK: Record<Verdict, string> = { READ: '✔', NAMED: '✔', STRUCTURAL: '✔', SILENT: '✖', UNMAPPED: '✖' };
for (const r of rows) console.log(`  ${MARK[r.verdict]} ${r.channel.padEnd(22)} ${r.verdict.padEnd(11)} ${r.detail}`);

console.log(
  `\n${rows.length} channel(s) the canvas can DRAW. READ ${rows.filter((r) => r.verdict === 'READ').length} · ` +
    `NAMED ${rows.filter((r) => r.verdict === 'NAMED').length} · STRUCTURAL ${rows.filter((r) => r.verdict === 'STRUCTURAL').length} · ` +
    `SILENT ${rows.filter((r) => r.verdict === 'SILENT').length} · UNMAPPED ${rows.filter((r) => r.verdict === 'UNMAPPED').length}`,
);

if (broken.length > 0) {
  console.error(
    `\n✘ CLOSURE BROKEN for ${broken.length} channel(s) — each is a fact the canvas can DRAW and the reader can never recover, with nothing telling the adopter:\n` +
      broken.map((r) => `  - ${r.channel}: ${r.detail}`).join('\n') +
      '\n\nFix by reading the property, or by naming a degradation. Both satisfy the bar; silence does not.',
  );
  process.exit(1);
}
console.log('\n✔ CLOSURE HOLDS — every channel the canvas can draw is either read back or named as lost.');
