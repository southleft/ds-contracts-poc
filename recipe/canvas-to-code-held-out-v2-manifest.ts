/**
 * Canvas→code held-out exam v2 — the substrate manifest.
 *
 * Every subject is a component set drawn by a designer who never used this
 * tool, in a file this repository never wrote. The exam only READS these files
 * (Desktop Bridge observe, zero writes); the only writable Figma file remains
 * Scratch `byMp6lt0Ij9b2QbkDGFwBh`, and it is not involved here.
 *
 * Node ids are resolved ON CANVAS by page + set name, never from the published
 * component-set listing: the Altitude sets were rebuilt on 2026-09-08 and the
 * published ids now point at deleted nodes (`/nodes` returns them with empty
 * children). `publishedSetNodeId` is provenance only.
 */

export const HELD_OUT_V2_VERSION = "canvas-to-code-held-out-v2";
export const HELD_OUT_V2_ROOT = "recipe/evidence/canvas-to-code-held-out-v2";

export interface HeldOutFile {
  fileKey: string;
  fileName: string;
  role: "read-only";
  /** Who drew it, in words a stranger can check. */
  authoredBy: string;
}

export interface HeldOutSubject {
  /** Directory name under HELD_OUT_V2_ROOT. */
  slug: string;
  fileKey: string;
  fileName: string;
  pageId: string;
  pageName: string;
  setNodeId: string;
  setName: string;
  /** Recipe archetype this set corresponds to (for the proposed contract name). */
  archetype: string;
  provenance: "designer-drawn, never minted by this repo";
  /** The stale published id, kept as provenance only. */
  publishedSetNodeId?: string;
  /**
   * Optional two-sided check: the REAL coded component's capture, when this
   * repository already holds one. Never a tuning signal — a reported column.
   */
  codeReference?: {
    config: string;
    component: string;
    origShots: string;
  };
  /**
   * The set is published but no longer exists on canvas (the page it lived on
   * is gone). Recorded as a refusal at the observe stage; setNodeId/pageId are
   * then the published ids for provenance only and are never observed.
   */
  absentOnCanvas?: { reason: string; measuredAt: string; fileVersion: string };
}

export const HELD_OUT_V2_FILES: readonly HeldOutFile[] = [
  {
    fileKey: "y83n4o9LOGs74oAoguFcGS",
    fileName: "Altitude Design System",
    role: "read-only",
    authoredBy:
      "Southleft's Altitude design team in Figma; sets rebuilt 2026-09-08 (file version history). This repository's only references to the file are a focus-ring diagnosis receipt and docs/32 — it never wrote to it.",
  },
  {
    fileKey: "WofZT8xaxXuc2Q6Je9S4XE",
    fileName: "CBDS UI Kit Demo",
    role: "read-only",
    authoredBy:
      "TJ Pitre's workshop kit, drawn by hand in Figma; no reference to it exists anywhere in this repository.",
  },
];

export const HELD_OUT_V2_SUBJECTS: readonly HeldOutSubject[] = [
  {
    slug: "altitude-badge",
    fileKey: "y83n4o9LOGs74oAoguFcGS",
    fileName: "Altitude Design System",
    pageId: "6587:47476",
    pageName: "🛠 Badge",
    setNodeId: "3538:35772",
    setName: "Badge",
    archetype: "badge",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "2626:541",
    codeReference: {
      config: "extract/computed/configs/altitude.json",
      component: "Badge",
      origShots: "extract/computed/out/altitude/badge/orig-shots",
    },
  },
  {
    slug: "altitude-chip",
    fileKey: "y83n4o9LOGs74oAoguFcGS",
    fileName: "Altitude Design System",
    pageId: "3435:965",
    pageName: "🛠 Chip",
    setNodeId: "3540:43526",
    setName: "Chip",
    archetype: "chip",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "3435:1086",
  },
  {
    slug: "altitude-link",
    fileKey: "y83n4o9LOGs74oAoguFcGS",
    fileName: "Altitude Design System",
    pageId: "3435:927",
    pageName: "🛠 Link",
    setNodeId: "3543:47075",
    setName: "Link",
    archetype: "link",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "3435:964",
  },
  {
    slug: "altitude-checkbox",
    fileKey: "y83n4o9LOGs74oAoguFcGS",
    fileName: "Altitude Design System",
    pageId: "3435:1219",
    pageName: "🛠 Checkbox",
    setNodeId: "3539:42167",
    setName: "Checkbox",
    archetype: "checkbox",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "3435:1422",
  },
  {
    slug: "altitude-radio",
    fileKey: "y83n4o9LOGs74oAoguFcGS",
    fileName: "Altitude Design System",
    pageId: "3436:1482",
    pageName: "🛠 Radio",
    setNodeId: "3543:47540",
    setName: "Radio",
    archetype: "radio",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "3436:1613",
  },
  {
    slug: "altitude-textarea",
    fileKey: "y83n4o9LOGs74oAoguFcGS",
    fileName: "Altitude Design System",
    pageId: "3442:25596",
    pageName: "🛠 Textarea",
    setNodeId: "3544:49378",
    setName: "Textarea",
    archetype: "textarea",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "3442:25715",
  },
  {
    slug: "altitude-menu",
    fileKey: "y83n4o9LOGs74oAoguFcGS",
    fileName: "Altitude Design System",
    pageId: "3442:25360",
    pageName: "🛠 Menu",
    setNodeId: "3558:61424",
    setName: "Menu",
    archetype: "menu",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "3442:25397",
  },
  {
    slug: "altitude-tabs",
    fileKey: "y83n4o9LOGs74oAoguFcGS",
    fileName: "Altitude Design System",
    pageId: "3442:25398",
    pageName: "🛠 Tabs",
    setNodeId: "3558:61955",
    setName: "Tabs",
    archetype: "tabs",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "3442:25425",
  },
  {
    slug: "altitude-toggle",
    fileKey: "y83n4o9LOGs74oAoguFcGS",
    fileName: "Altitude Design System",
    pageId: "2873:2",
    pageName: "🛠 Toggle",
    setNodeId: "3543:48094",
    setName: "Toggle",
    archetype: "switch",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "2874:20",
  },
  // Published but no longer on canvas: the "🛝 Playground" page that held them
  // is gone (54 pages, none named Avatar/Alert/Playground; the published ids
  // resolve to COMPONENT_SET stubs with zero children). A refusal at observe.
  {
    slug: "altitude-avatar",
    fileKey: "y83n4o9LOGs74oAoguFcGS",
    fileName: "Altitude Design System",
    pageId: "0:0",
    pageName: "(absent)",
    setNodeId: "1292:2",
    setName: "Avatar",
    archetype: "avatar",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "1292:2",
    absentOnCanvas: {
      reason:
        "published component set 1292:2 resolves to a stub with zero children; no page named Avatar/Alert/Playground exists among the file's 54 pages",
      measuredAt: "2026-09-13",
      fileVersion: "2397989613251461242",
    },
  },
  {
    slug: "altitude-alert",
    fileKey: "y83n4o9LOGs74oAoguFcGS",
    fileName: "Altitude Design System",
    pageId: "0:0",
    pageName: "(absent)",
    setNodeId: "2093:14099",
    setName: "Alert",
    archetype: "alert",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "2093:14099",
    absentOnCanvas: {
      reason:
        "published component set 2093:14099 resolves to a stub with zero children; no page named Avatar/Alert/Playground exists among the file's 54 pages",
      measuredAt: "2026-09-13",
      fileVersion: "2397989613251461242",
    },
  },
  // CBDS UI Kit Demo — all thirteen archetypes, vanilla, hand-drawn. Published ids
  // equal on-canvas ids here (verified by a pruned REST walk, 2026-09-13).
  {
    slug: "cbds-toggle",
    fileKey: "WofZT8xaxXuc2Q6Je9S4XE",
    fileName: "CBDS UI Kit Demo",
    pageId: "255:1597",
    pageName: "👉 Selection controls - Checkbox/Radio/Toggle",
    setNodeId: "272:730",
    setName: "Toggle",
    archetype: "switch",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "272:730",
  },
  {
    slug: "cbds-checkbox",
    fileKey: "WofZT8xaxXuc2Q6Je9S4XE",
    fileName: "CBDS UI Kit Demo",
    pageId: "255:1597",
    pageName: "👉 Selection controls - Checkbox/Radio/Toggle",
    setNodeId: "272:96",
    setName: "Checkbox",
    archetype: "checkbox",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "272:96",
  },
  {
    slug: "cbds-radio",
    fileKey: "WofZT8xaxXuc2Q6Je9S4XE",
    fileName: "CBDS UI Kit Demo",
    pageId: "255:1597",
    pageName: "👉 Selection controls - Checkbox/Radio/Toggle",
    setNodeId: "272:346",
    setName: "Radio button",
    archetype: "radio",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "272:346",
  },
  {
    slug: "cbds-link",
    fileKey: "WofZT8xaxXuc2Q6Je9S4XE",
    fileName: "CBDS UI Kit Demo",
    pageId: "392:1552",
    pageName: "👉 Button - Link",
    setNodeId: "6660:63303",
    setName: "Link",
    archetype: "link",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "6660:63303",
  },
  {
    slug: "cbds-badge",
    fileKey: "WofZT8xaxXuc2Q6Je9S4XE",
    fileName: "CBDS UI Kit Demo",
    pageId: "255:1633",
    pageName: "👉 Badge",
    setNodeId: "277:822",
    setName: "Badge",
    archetype: "badge",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "277:822",
  },
  {
    slug: "cbds-tab-line",
    fileKey: "WofZT8xaxXuc2Q6Je9S4XE",
    fileName: "CBDS UI Kit Demo",
    pageId: "509:695",
    pageName: "👉 Tab",
    setNodeId: "544:1811",
    setName: "Tab-Line",
    archetype: "tabs",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "544:1811",
  },
  {
    slug: "cbds-text-area",
    fileKey: "WofZT8xaxXuc2Q6Je9S4XE",
    fileName: "CBDS UI Kit Demo",
    pageId: "265:2226",
    pageName: "👉 TextArea",
    setNodeId: "199:1428",
    setName: "Text Area",
    archetype: "textarea",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "199:1428",
  },
  {
    slug: "cbds-alert",
    fileKey: "WofZT8xaxXuc2Q6Je9S4XE",
    fileName: "CBDS UI Kit Demo",
    pageId: "435:749",
    pageName: "👉 Alert",
    setNodeId: "438:1401",
    setName: "Alert",
    archetype: "alert",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "438:1401",
  },
  {
    slug: "cbds-chip",
    fileKey: "WofZT8xaxXuc2Q6Je9S4XE",
    fileName: "CBDS UI Kit Demo",
    pageId: "255:1644",
    pageName: "👉 Chips",
    setNodeId: "279:2861",
    setName: "Chip",
    archetype: "chip",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "279:2861",
  },
  {
    slug: "cbds-dialog",
    fileKey: "WofZT8xaxXuc2Q6Je9S4XE",
    fileName: "CBDS UI Kit Demo",
    pageId: "555:913",
    pageName: "👉 Dialog",
    setNodeId: "599:1333",
    setName: "Dialog",
    archetype: "dialog",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "599:1333",
  },
  {
    slug: "cbds-menu",
    fileKey: "WofZT8xaxXuc2Q6Je9S4XE",
    fileName: "CBDS UI Kit Demo",
    pageId: "253:1546",
    pageName: "👉 Menu",
    setNodeId: "303:7130",
    setName: "Menu",
    archetype: "menu",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "303:7130",
  },
  {
    slug: "cbds-tooltip",
    fileKey: "WofZT8xaxXuc2Q6Je9S4XE",
    fileName: "CBDS UI Kit Demo",
    pageId: "695:305",
    pageName: "👉 Tooltip",
    setNodeId: "695:313",
    setName: "Tooltip",
    archetype: "tooltip",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "695:313",
  },
  {
    slug: "cbds-avatar",
    fileKey: "WofZT8xaxXuc2Q6Je9S4XE",
    fileName: "CBDS UI Kit Demo",
    pageId: "255:1634",
    pageName: "👉 Avatar",
    setNodeId: "284:11",
    setName: "Avatar",
    archetype: "avatar",
    provenance: "designer-drawn, never minted by this repo",
    publishedSetNodeId: "284:11",
  },
];

export function subjectBySlug(slug: string): HeldOutSubject {
  const subject = HELD_OUT_V2_SUBJECTS.find((s) => s.slug === slug);
  if (!subject)
    throw new Error(
      `held-out v2: no subject ${JSON.stringify(slug)}; known: ${HELD_OUT_V2_SUBJECTS.map((s) => s.slug).join(", ")}`,
    );
  return subject;
}
