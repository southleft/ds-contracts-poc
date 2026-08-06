/**
 * Wave 3 slice 2 — three-way merge pins.
 *   npx tsx core/three-way-merge-check.ts
 */
import assert from "node:assert/strict";
import {
  mergeThreeWay,
  summarizeMergeOutcome,
} from "./three-way-merge.js";

// Auto-compose non-overlapping channels (padding mine + fill theirs)
{
  const r = mergeThreeWay({
    contractId: "mui.button",
    genesis: { "root|fill": "primary", "root|paddingTop": "6" },
    incoming: { "root|fill": "secondary", "root|paddingTop": "6" },
    canvas: { "root|fill": "primary", "root|paddingTop": "8" },
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.composed["root|fill"], "secondary");
    assert.equal(r.composed["root|paddingTop"], "8");
    assert.deepEqual(r.autoTheirs, ["root|fill"]);
    assert.deepEqual(r.autoMine, ["root|paddingTop"]);
  }
}

// Collision refuses without choices
{
  const r = mergeThreeWay({
    contractId: "mui.button",
    genesis: { "root|fill": "a" },
    incoming: { "root|fill": "b" },
    canvas: { "root|fill": "c" },
  });
  assert.equal(r.ok, false);
  if (!r.ok && r.reason === "need-choices") {
    assert.equal(r.collisions.length, 1);
    assert.match(r.message, /no silent winner/);
  }
}

// Explicit mine/theirs resolves
{
  const r = mergeThreeWay({
    contractId: "mui.button",
    genesis: { "root|fill": "a" },
    incoming: { "root|fill": "b" },
    canvas: { "root|fill": "c" },
    choices: { "root|fill": "mine" },
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.composed["root|fill"], "c");
    assert.equal(r.resolved[0]!.choice, "mine");
  }
}

// Both sides same edit = agreed, no choice needed
{
  const r = mergeThreeWay({
    contractId: "mui.switch",
    genesis: { "thumb|translate-x": "0" },
    incoming: { "thumb|translate-x": "20" },
    canvas: { "thumb|translate-x": "20" },
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.agreed, ["thumb|translate-x"]);
    assert.equal(r.composed["thumb|translate-x"], "20");
  }
}

// Stale base refused before compose
{
  const r = mergeThreeWay({
    contractId: "mui.button",
    genesis: { "root|fill": "a" },
    incoming: { "root|fill": "b" },
    canvas: { "root|fill": "a" },
    base: { stale: true, syncsBehind: 3 },
  });
  assert.equal(r.ok, false);
  if (!r.ok && r.reason === "stale-base") {
    assert.equal(r.syncsBehind, 3);
    assert.match(r.message, /3 syncs behind/);
    assert.match(summarizeMergeOutcome(r)[0]!, /stale-base REFUSED/);
  }
}

console.log("✔ three-way-merge-check: auto-compose, collisions, choices, stale-base");
