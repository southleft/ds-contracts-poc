/**
 * G7 — brownfield write-back suggested diffs (propose only, never apply).
 *
 * docs/18 Flow 6: after a design-led merge, emit anchor-derived reviewable
 * patches for hand-written source ("Badge.module.css:14: var(--a) → var(--b)").
 * A human applies them; this module MUST NOT write files.
 */
import type { ChannelChange } from "./channel-diff.js";

export interface ProvenanceAnchor {
  leaf?: string;
  token?: string;
  part: string;
  cssProperty: string;
  varName?: string;
  selector?: string;
  /** Future static readers may carry file:line; optional today. */
  file?: string;
  line?: number;
}

export type SuggestedDiffKind = "code-css" | "canvas-channel" | "unanchored";

export interface SuggestedDiff {
  kind: SuggestedDiffKind;
  /** One-line PR comment body. */
  summary: string;
  path?: string;
  line?: number;
  was: string;
  now: string;
  /** Always false — G7 is propose-only. */
  autoApplied: false;
  part?: string;
  channel?: string;
  anchor?: ProvenanceAnchor;
}

function cssChannelName(channel: string): string | null {
  // anatomy-diff emits `tokens.background-color` / `layout.padding-left`
  const m = channel.match(/^(?:tokens|layout|declared|state\.[^.]+)\.(.+)$/);
  return m ? m[1]! : null;
}

function matchAnchor(
  change: ChannelChange,
  anchors: readonly ProvenanceAnchor[],
): ProvenanceAnchor | undefined {
  const part = change.part ?? change.what;
  const cssProp = cssChannelName(change.channel);
  if (!cssProp) return undefined;
  return anchors.find(
    (a) =>
      a.part === part &&
      (a.cssProperty === cssProp ||
        a.cssProperty === cssProp.replace(/-/g, "") ||
        // background-color vs backgroundColor
        a.cssProperty.toLowerCase().replace(/-/g, "") ===
          cssProp.toLowerCase().replace(/-/g, "")),
  );
}

function formatCssValue(raw: string): string {
  if (raw.startsWith("{") && raw.endsWith("}")) {
    const path = raw.slice(1, -1);
    if (!path.includes("{")) return `var(--${path.split(".").join("-")})`;
  }
  if (raw.startsWith("--")) return `var(${raw})`;
  return raw;
}

/**
 * Build reviewable suggested diffs from channel changes + provenance anchors.
 * Never mutates the filesystem.
 */
export function suggestDiffsFromChannelChanges(
  changes: readonly ChannelChange[],
  anchors: readonly ProvenanceAnchor[] = [],
  opts: { defaultSourcePath?: string } = {},
): SuggestedDiff[] {
  const out: SuggestedDiff[] = [];
  for (const change of changes) {
    if (change.was === change.now) continue;
    const was = change.was ?? "(absent)";
    const now = change.now ?? "(absent)";
    const anchor = matchAnchor(change, anchors);
    const cssProp = cssChannelName(change.channel);
    // Anchored CSS/token channels → reviewable code suggestion.
    // Token channels without an anchor still format as css-ish canvas hints.
    // Everything else (layout, structure) stays unanchored — never silent.
    if (anchor || (cssProp && change.channel.startsWith("tokens."))) {
      const path = anchor?.file ?? opts.defaultSourcePath;
      const line = anchor?.line;
      const wasCss = formatCssValue(was);
      const nowCss = formatCssValue(now);
      const loc =
        path && typeof line === "number"
          ? `${path}:${line}`
          : path
            ? path
            : anchor?.selector
              ? `(selector ${anchor.selector})`
              : `${change.part ?? change.what}.${change.channel}`;
      out.push({
        kind: anchor ? "code-css" : "canvas-channel",
        summary: `${loc}: ${wasCss} → ${nowCss}`,
        ...(path ? { path } : {}),
        ...(typeof line === "number" ? { line } : {}),
        was: wasCss,
        now: nowCss,
        autoApplied: false,
        part: change.part ?? change.what,
        channel: change.channel,
        ...(anchor ? { anchor } : {}),
      });
      continue;
    }
    out.push({
      kind: "unanchored",
      summary: `${change.part ?? change.what}.${change.channel}: ${was} → ${now} (no provenance anchor — review manually)`,
      was,
      now,
      autoApplied: false,
      part: change.part ?? change.what,
      channel: change.channel,
    });
  }
  return out;
}

/** Fail closed: suggested diffs must never claim auto-apply. */
export function assertProposeOnly(diffs: readonly SuggestedDiff[]): void {
  for (const d of diffs) {
    if (d.autoApplied !== false) {
      throw new Error(
        `G7 violation: suggested diff marked autoApplied — ${d.summary}`,
      );
    }
  }
}
