/**
 * Apply rebuild preview + recovery receipt — Wave 3 slice 4 (docs/18 G2/G3).
 *
 * Before a destructive Apply, enumerate what will be rebuilt vs preserved,
 * show before/after channel values, and emit a recovery receipt the operator
 * can keep next to the live oracle receipts.
 */

import type { ChannelChange } from "./channel-diff.js";
import { summarizeChannelChange } from "./channel-diff.js";

export type ApplyAction = "create" | "amend" | "skip" | "refused";

export interface ApplyTargetPreview {
  contractId: string;
  setName: string;
  action: ApplyAction;
  /** Canvas has un-proposed edits (G2). */
  canvasEdited: boolean;
  /** Named overwrite warning when canvasEdited. */
  warning?: string;
  /** Channels that will change if Apply proceeds. */
  willRebuild: ChannelChange[];
  /** Channels present on canvas that Apply will leave alone (same value). */
  willPreserve: string[];
}

export interface ApplyPreviewPlan {
  version: 1;
  targets: ApplyTargetPreview[];
  /** True when any selected amend would overwrite canvas edits. */
  hasOverwriteRisk: boolean;
  lines: string[];
}

export interface ApplyRecoveryReceipt {
  version: 1;
  status: "preview" | "applied" | "cancelled";
  at: string;
  fileKey?: string;
  plan: ApplyPreviewPlan;
  /** Per-target before fingerprints / channel dumps for restore. */
  recovery: Array<{
    contractId: string;
    beforeFingerprint?: string;
    beforeChannels: Record<string, string>;
  }>;
}

export function buildApplyPreview(
  targets: Array<{
    contractId: string;
    setName: string;
    action: ApplyAction;
    canvasEdited?: boolean;
    warning?: string;
    changes?: ChannelChange[];
    preserveChannels?: string[];
  }>,
): ApplyPreviewPlan {
  const rows: ApplyTargetPreview[] = targets.map((t) => ({
    contractId: t.contractId,
    setName: t.setName,
    action: t.action,
    canvasEdited: t.canvasEdited === true,
    warning: t.warning,
    willRebuild: t.changes ?? [],
    willPreserve: t.preserveChannels ?? [],
  }));
  const hasOverwriteRisk = rows.some(
    (r) => r.action === "amend" && r.canvasEdited,
  );
  const lines: string[] = ["Apply preview — nothing applied yet."];
  for (const r of rows) {
    lines.push(
      `${r.setName} (${r.contractId}): ${r.action}` +
        (r.canvasEdited ? " — canvas-edited" : ""),
    );
    if (r.warning) lines.push(`  warning: ${r.warning}`);
    for (const c of r.willRebuild) {
      lines.push(`  rebuild ${summarizeChannelChange(c)}`);
    }
    if (r.willPreserve.length) {
      lines.push(`  preserve: ${r.willPreserve.join(", ")}`);
    }
  }
  if (hasOverwriteRisk) {
    lines.push(
      "Overwrite risk: one or more amend targets have canvas edits — default-unchecked; confirm before Apply.",
    );
  }
  return { version: 1, targets: rows, hasOverwriteRisk, lines };
}

export function buildApplyRecoveryReceipt(
  plan: ApplyPreviewPlan,
  recovery: ApplyRecoveryReceipt["recovery"],
  opts: { status?: ApplyRecoveryReceipt["status"]; fileKey?: string } = {},
): ApplyRecoveryReceipt {
  return {
    version: 1,
    status: opts.status ?? "preview",
    at: new Date().toISOString(),
    fileKey: opts.fileKey,
    plan,
    recovery,
  };
}
