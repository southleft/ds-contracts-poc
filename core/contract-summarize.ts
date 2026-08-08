/**
 * Contract English channel summarizer — docs/18 G11 precursor.
 * Compares two contract JSON documents via flattened channel lines and
 * `core/channel-diff` pairing. Used by `ds-contracts diff --summarize`.
 */

import { diffChannelLines, summarizeChannelChange } from "./channel-diff.js";

/** Flatten a JSON value into `path|leaf|jsonValue` channel lines. */
export function flattenContractChannels(
  value: unknown,
  path: string = "contract",
): string[] {
  const lines: string[] = [];
  const walk = (v: unknown, p: string) => {
    if (v === null || typeof v !== "object") {
      lines.push(`${p}|value|${JSON.stringify(v)}`);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${p}/${i}`));
      return;
    }
    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    if (keys.length === 0) {
      lines.push(`${p}|value|{}`);
      return;
    }
    for (const k of keys) {
      // Skip provenance noise in summaries unless it is the only change surface
      if (k === "provenance" && p === "contract") continue;
      walk(obj[k], `${p}/${k}`);
    }
  };
  walk(value, path);
  return lines.sort();
}

export function summarizeContractDiff(
  before: unknown,
  after: unknown,
): string[] {
  const changes = diffChannelLines(
    flattenContractChannels(before),
    flattenContractChannels(after),
    { whatIsPrefix: true },
  );
  return changes.map(summarizeChannelChange);
}
