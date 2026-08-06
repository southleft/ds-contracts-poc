/**
 * Wave 3 slice 4 — apply preview pins.
 *   npx tsx core/apply-preview-check.ts
 */
import assert from "node:assert/strict";
import {
  buildApplyPreview,
  buildApplyRecoveryReceipt,
} from "./apply-preview.js";

const plan = buildApplyPreview([
  {
    contractId: "mui.button",
    setName: "Button",
    action: "amend",
    canvasEdited: true,
    warning: "applying overwrites your edit to paddingTop",
    changes: [
      {
        what: "root",
        channel: "fill",
        was: "primary",
        now: "secondary",
        part: "root",
      },
    ],
    preserveChannels: ["root|gap"],
  },
  {
    contractId: "mui.chip",
    setName: "Chip",
    action: "create",
    changes: [],
  },
]);

assert.equal(plan.hasOverwriteRisk, true);
assert.ok(plan.lines.some((l) => /Overwrite risk/.test(l)));
assert.ok(plan.lines.some((l) => /rebuild root\.fill/.test(l)));

const receipt = buildApplyRecoveryReceipt(
  plan,
  [
    {
      contractId: "mui.button",
      beforeFingerprint: "v6:1",
      beforeChannels: { "root|paddingTop": "8" },
    },
  ],
  { status: "preview", fileKey: "TEST" },
);
assert.equal(receipt.version, 1);
assert.equal(receipt.status, "preview");
assert.equal(receipt.recovery[0]!.beforeChannels["root|paddingTop"], "8");

console.log("✔ apply-preview-check: overwrite risk + recovery receipt");
