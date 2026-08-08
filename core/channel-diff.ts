/**
 * Typed per-channel diff — Wave 3 workflow spine (slice 1).
 *
 * One pairing vocabulary for snapshot lines (`id|channel|value`) shared by
 * parity/variant-drift, update reports, CLI summaries, and (later) three-way
 * merge. The Figma plugin keeps a byte-pinned ES5 twin of the pairing rule
 * inside `figma-sync/plugin/engine/entry.ts` / `code.js` until a shared emit
 * lands; behaviour must stay identical (prefix = first two `|` fields).
 */

/** One paired channel change after prefix matching. */
export interface ChannelChange {
  /** Designer / report subject: part path tail, or full `id|channel` key. */
  what: string;
  /** Channel word when parseable ("fill", "paddingTop", "bound:paddingLeft"). */
  channel: string;
  was: string;
  now: string;
  /** Optional anatomy part name (path tail). */
  part?: string;
  /** Variant names carrying this change; null/undefined = every / unknown. */
  variants?: string[] | null;
}

export interface DiffChannelLinesOptions {
  /**
   * When true, `what` is the full `id|channel` prefix (parity SnapshotChange).
   * When false (default), `what` is the path/id segment and `channel` is
   * split out (plugin StyleChange shape).
   */
  whatIsPrefix?: boolean;
}

/** First two pipe-separated fields — the prefix used for pairing. */
export function channelLinePrefix(line: string): string {
  const i = line.indexOf("|");
  const j = line.indexOf("|", i + 1);
  return j > 0 ? line.slice(0, j) : line;
}

export function channelLineValue(line: string): string {
  const prefix = channelLinePrefix(line);
  return line.length > prefix.length + 1 ? line.slice(prefix.length + 1) : "";
}

/** Split `path|channel` prefix into path + channel (last `|` in prefix). */
export function splitPrefix(prefix: string): { path: string; channel: string } {
  const bar = prefix.lastIndexOf("|");
  if (bar < 0) return { path: prefix, channel: "" };
  return { path: prefix.slice(0, bar), channel: prefix.slice(bar + 1) };
}

/** Anatomy / report part name — path tail after `/`, else after `>` (variant>). */
export function partNameOf(path: string): string {
  if (path.includes("/")) return path.split("/").pop() ?? path;
  const gt = path.lastIndexOf(">");
  if (gt >= 0) return path.slice(gt + 1) || path;
  return path;
}

/**
 * Line-set diff with `id|channel` prefix pairing — same rule as
 * `parity/variant-drift.diffSnapshots` and plugin `styleDiffOf` raw pairing.
 */
export function diffChannelLines(
  beforeLines: string[],
  afterLines: string[],
  options: DiffChannelLinesOptions = {},
): ChannelChange[] {
  const whatIsPrefix = options.whatIsPrefix === true;
  const inA = new Set(beforeLines);
  const inB = new Set(afterLines);
  const removed = beforeLines.filter((l) => !inB.has(l));
  const added = afterLines.filter((l) => !inA.has(l));
  const remByPrefix = new Map<string, string[]>();
  for (const l of removed) {
    const k = channelLinePrefix(l);
    const bucket = remByPrefix.get(k);
    if (bucket) bucket.push(l);
    else remByPrefix.set(k, [l]);
  }
  const out: ChannelChange[] = [];
  const usedRem = new Set<string>();
  for (const l of added) {
    const prefix = channelLinePrefix(l);
    const now = channelLineValue(l);
    const candidates = (remByPrefix.get(prefix) ?? []).filter(
      (r) => !usedRem.has(r),
    );
    const { path, channel } = splitPrefix(prefix);
    const part = partNameOf(path);
    if (candidates.length === 1) {
      usedRem.add(candidates[0]!);
      out.push({
        what: whatIsPrefix ? prefix : part || path,
        channel,
        was: channelLineValue(candidates[0]!),
        now,
        part,
      });
    } else {
      out.push({
        what: whatIsPrefix ? prefix : part || path,
        channel,
        was: "(absent)",
        now,
        part,
      });
    }
  }
  for (const l of removed) {
    if (usedRem.has(l)) continue;
    const prefix = channelLinePrefix(l);
    const { path, channel } = splitPrefix(prefix);
    const part = partNameOf(path);
    out.push({
      what: whatIsPrefix ? prefix : part || path,
      channel,
      was: channelLineValue(l),
      now: "(removed)",
      part,
    });
  }
  return out;
}

/** Parity / variant-drift shape. */
export function toSnapshotChanges(changes: ChannelChange[]): Array<{
  what: string;
  was: string;
  now: string;
}> {
  return changes.map((c) => ({
    what: c.what,
    was: c.was,
    now: c.now,
  }));
}

/** Plugin / update-report StyleChange shape (no variants aggregation). */
export function toStyleChanges(changes: ChannelChange[]): Array<{
  part: string;
  channel: string;
  was: string;
  now: string;
  variants: string[] | null;
}> {
  return changes.map((c) => ({
    part: c.part ?? c.what,
    channel: c.channel,
    was: c.was,
    now: c.now,
    variants: c.variants ?? null,
  }));
}

/** One-line English for CLI / PR summaries (G11 precursor). */
export function summarizeChannelChange(change: ChannelChange): string {
  const label = change.channel
    ? `${change.part ?? change.what}.${change.channel}`
    : change.what;
  return `${label}: ${change.was} → ${change.now}`;
}
