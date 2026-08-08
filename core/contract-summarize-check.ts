/**
 *   npx tsx core/contract-summarize-check.ts
 */
import assert from "node:assert/strict";
import { summarizeContractDiff } from "./contract-summarize.js";

const before = {
  id: "mui.button",
  anatomy: { root: { tokens: { fill: "{color.primary}" } } },
};
const after = {
  id: "mui.button",
  anatomy: { root: { tokens: { fill: "{color.secondary}" } } },
};
const lines = summarizeContractDiff(before, after);
assert.ok(lines.some((l) => /fill/.test(l) && /primary/.test(l) && /secondary/.test(l)));
assert.equal(summarizeContractDiff(before, before).length, 0);
console.log("✔ contract-summarize-check: English channel lines");
