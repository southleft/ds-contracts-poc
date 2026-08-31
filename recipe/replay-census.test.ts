import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
  REPLAY_CENSUS_BUTTON_KNOWN_B2J_CHANNEL,
  REPLAY_CENSUS_CALENDAR_KNOWN_V42_REFUSAL,
  REPLAY_CENSUS_TABLE_KNOWN_V23_REFUSAL,
  buildButtonReplayCensus,
  buildCalendarReplayCensus,
  buildReplayCensus,
  buildTableReplayCensus,
} from "./replay-census.js";
import { TABLE_TAIL_CENSUS_KNOWN_V23_REFUSAL } from "./table-tail-census.js";

const TABLE_SUBSTRATE = "private/table-live-v27-transaction/004-extract.raw.json";
const CALENDAR_SUBSTRATE =
  "private/calendar-live-v42-transaction/004-extract.raw.json";

test("table replay census delegates to table-tail-census", {
  skip: existsSync(TABLE_SUBSTRATE)
    ? false
    : "private/ substrate absent (gitignored); run after a live attempt",
}, () => {
  const census = buildTableReplayCensus();
  assert.equal(census.artifactVersion, "replay-census-v1");
  assert.equal(census.archetype, "table");
  assert.equal(census.predicts, "read-side tail only");
  assert.equal(
    census.knownHistoricalRefusal,
    REPLAY_CENSUS_TABLE_KNOWN_V23_REFUSAL,
  );
  assert.equal(
    TABLE_TAIL_CENSUS_KNOWN_V23_REFUSAL,
    REPLAY_CENSUS_TABLE_KNOWN_V23_REFUSAL,
  );
  assert.equal(census.roots.length, 2);
});

test("calendar replay census holds v42 teaching on persisted extract", {
  skip: existsSync(CALENDAR_SUBSTRATE)
    ? false
    : "private/ substrate absent (gitignored); run after a live attempt",
}, () => {
  const census = buildCalendarReplayCensus();
  assert.equal(census.archetype, "calendar");
  assert.equal(census.reproducesKnownHistoricalRefusal, false);
  assert.equal(census.roots[0]?.preDiffRefusal, null);
  assert.equal(census.totalDifferences, 0);
});

test("calendar replay census reproduces v42 day-button binding refusal on teaching revert", {
  skip: existsSync(CALENDAR_SUBSTRATE)
    ? false
    : "private/ substrate absent (gitignored); run after a live attempt",
}, () => {
  const census = buildCalendarReplayCensus(undefined, {
    revertDayButtonBindingCompileOrder: true,
  });
  assert.equal(census.reproducesKnownHistoricalRefusal, true);
  assert.ok(
    census.roots[0]?.preDiffRefusal?.includes(
      REPLAY_CENSUS_CALENDAR_KNOWN_V42_REFUSAL,
    ),
  );
});

test("button replay census reproduces B2j root name mismatch on teaching revert", () => {
  const census = buildButtonReplayCensus(undefined, {
    revertB2jRoleOnlyNameRecovery: true,
  });
  assert.equal(census.archetype, "button");
  assert.equal(census.reproducesKnownHistoricalRefusal, true);
  const rootNameMismatch = census.roots
    .flatMap((root) => root.accounting)
    .find(
      (entry) =>
        entry.class === "mismatched" &&
        entry.ownershipKey === "root" &&
        entry.channel === REPLAY_CENSUS_BUTTON_KNOWN_B2J_CHANNEL,
    );
  assert.ok(rootNameMismatch);
  assert.equal(rootNameMismatch.observed, "Button / button@1 proof");
});

test("button replay census with teaching applied reports no B2j root name mismatch", () => {
  const census = buildButtonReplayCensus();
  assert.equal(census.reproducesKnownHistoricalRefusal, false);
  const rootNameMismatch = census.roots
    .flatMap((root) => root.accounting)
    .find(
      (entry) =>
        entry.class === "mismatched" &&
        entry.ownershipKey === "root" &&
        entry.channel === REPLAY_CENSUS_BUTTON_KNOWN_B2J_CHANNEL,
    );
  assert.equal(rootNameMismatch, undefined);
});

test("buildReplayCensus dispatches by archetype", () => {
  const button = buildReplayCensus("button", {
    revertB2jRoleOnlyNameRecovery: true,
  });
  assert.equal(button.archetype, "button");
});
