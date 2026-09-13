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
];

export function subjectBySlug(slug: string): HeldOutSubject {
  const subject = HELD_OUT_V2_SUBJECTS.find((s) => s.slug === slug);
  if (!subject)
    throw new Error(
      `held-out v2: no subject ${JSON.stringify(slug)}; known: ${HELD_OUT_V2_SUBJECTS.map((s) => s.slug).join(", ")}`,
    );
  return subject;
}
