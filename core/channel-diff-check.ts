/**
 * Wave 3 slice 1 — channel-diff pairing pins.
 *   npx tsx core/channel-diff-check.ts
 */
import assert from "node:assert/strict";
import {
  channelLinePrefix,
  diffChannelLines,
  summarizeChannelChange,
  toSnapshotChanges,
  toStyleChanges,
} from "./channel-diff.js";

assert.equal(
  channelLinePrefix("a/b|fill|#fff"),
  "a/b|fill",
  "prefix is first two pipe fields",
);

const paired = diffChannelLines(
  ["root>Button|fill|color/primary", "root>Button|gap|4"],
  ["root>Button|fill|color/secondary", "root>Button|gap|4"],
  { whatIsPrefix: true },
);
assert.equal(paired.length, 1);
assert.equal(paired[0]!.was, "color/primary");
assert.equal(paired[0]!.now, "color/secondary");
assert.equal(paired[0]!.channel, "fill");

const snap = toSnapshotChanges(paired);
assert.equal(snap[0]!.what, "root>Button|fill");

const style = toStyleChanges(
  diffChannelLines(
    ["v1>root|fill|a"],
    ["v1>root|fill|b"],
  ),
);
assert.equal(style[0]!.part, "root");
assert.equal(style[0]!.channel, "fill");

const removed = diffChannelLines(
  ["x|bound:paddingTop|space/1"],
  [],
  { whatIsPrefix: true },
);
assert.equal(removed[0]!.now, "(removed)");
assert.match(
  summarizeChannelChange(removed[0]!),
  /bound:paddingTop: space\/1 → \(removed\)/,
);

// Collision: two facts under the same prefix must not silently pair wrong
const collide = diffChannelLines(
  ["n|fill|a", "n|fill|b"],
  ["n|fill|c"],
  { whatIsPrefix: true },
);
assert.ok(
  collide.some((c) => c.was === "(absent)" || c.now === "(removed)"),
  "ambiguous same-prefix facts degrade instead of inventing a pair",
);

console.log("✔ channel-diff-check: pairing + adapters hold");
