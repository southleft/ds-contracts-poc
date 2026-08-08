/**
 * G7 — suggested-diff stubs (propose only).
 * `npx tsx core/suggested-diff-check.ts`
 */
import {
  assertProposeOnly,
  suggestDiffsFromChannelChanges,
  type ProvenanceAnchor,
} from "./suggested-diff.js";
import type { ChannelChange } from "./channel-diff.js";

const errors: string[] = [];

const anchors: ProvenanceAnchor[] = [
  {
    part: "root",
    cssProperty: "border-radius",
    varName: "--radius-md",
    selector: ".root",
    file: "src/components/Badge/Badge.module.css",
    line: 14,
  },
  {
    part: "root",
    cssProperty: "background-color",
    varName: "--color-surface",
    selector: ".root",
  },
];

// §1 — file:line suggestion matches docs/18 example shape
{
  const changes: ChannelChange[] = [
    {
      what: "root",
      channel: "tokens.border-radius",
      was: "{radius.md}",
      now: "{radius.lg}",
      part: "root",
    },
  ];
  const diffs = suggestDiffsFromChannelChanges(changes, anchors);
  assertProposeOnly(diffs);
  if (diffs.length !== 1) errors.push(`§1 expected 1 diff, got ${diffs.length}`);
  const d = diffs[0]!;
  if (d.autoApplied !== false) errors.push("§1 must be propose-only");
  if (!d.summary.includes("Badge.module.css:14")) {
    errors.push(`§1 summary should name file:line, got: ${d.summary}`);
  }
  if (!d.summary.includes("var(--radius-md)") || !d.summary.includes("var(--radius-lg)")) {
    errors.push(`§1 summary should show css var swap, got: ${d.summary}`);
  }
  if (d.kind !== "code-css") errors.push(`§1 kind code-css, got ${d.kind}`);
}

// §2 — selector-only anchor (no file:line) still emits a reviewable line
{
  const changes: ChannelChange[] = [
    {
      what: "root",
      channel: "tokens.background-color",
      was: "{color.surface}",
      now: "{color.surface.raised}",
      part: "root",
    },
  ];
  const diffs = suggestDiffsFromChannelChanges(changes, anchors);
  if (diffs.length !== 1) errors.push(`§2 expected 1, got ${diffs.length}`);
  if (!diffs[0]!.summary.includes("var(--color-surface)")) {
    errors.push(`§2 expected css formatting: ${diffs[0]?.summary}`);
  }
  if (diffs[0]!.path) {
    // selector-only uses parenthetical path — path field may be unset
  }
}

// §3 — unanchored change stays visible, never silent
{
  const changes: ChannelChange[] = [
    {
      what: "label",
      channel: "layout.align",
      was: "center",
      now: "start",
      part: "label",
    },
  ];
  const diffs = suggestDiffsFromChannelChanges(changes, anchors);
  if (diffs.length !== 1 || diffs[0]!.kind !== "unanchored") {
    errors.push(`§3 expected unanchored, got ${JSON.stringify(diffs)}`);
  }
  if (!diffs[0]!.summary.includes("no provenance anchor")) {
    errors.push(`§3 must name missing anchor: ${diffs[0]?.summary}`);
  }
}

// §4 — never writes / never autoApplies (structural pin)
{
  const diffs = suggestDiffsFromChannelChanges(
    [
      {
        what: "root",
        channel: "tokens.border-radius",
        was: "{radius.md}",
        now: "{radius.lg}",
        part: "root",
      },
    ],
    anchors,
  );
  for (const d of diffs) {
    if (d.autoApplied !== false) errors.push("§4 autoApplied must be false");
  }
  try {
    assertProposeOnly([{ ...diffs[0]!, autoApplied: true as false }]);
    errors.push("§4 assertProposeOnly should throw on autoApplied true");
  } catch {
    /* expected */
  }
}

if (errors.length) {
  for (const e of errors) console.error(`  ✖ ${e}`);
  console.error("✖ suggested-diff-check failed");
  process.exit(1);
}
console.log(
  "✔ suggested-diff-check: G7 propose-only stubs (file:line, selector, unanchored) hold",
);
