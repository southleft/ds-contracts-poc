import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import {
  CALENDAR_LIVE_V42_TARGET,
  calendarLiveV1RequestSequence,
} from "./calendar-live-v42-broker.js";
import {
  CALENDAR_LIVE_V42_CAPTURE_COUNT,
  CALENDAR_LIVE_V42_SOURCE_ROOTS,
} from "./calendar-live-v42-contract.js";

test("Calendar live v42 broker pins Scratch and 8 captures", () => {
  assert.equal(CALENDAR_LIVE_V42_TARGET.fileKey, "byMp6lt0Ij9b2QbkDGFwBh");
  assert.equal(CALENDAR_LIVE_V42_CAPTURE_COUNT, 8);
  assert.equal(CALENDAR_LIVE_V42_SOURCE_ROOTS, 1);
  assert.equal(calendarLiveV1RequestSequence("writer"), 1);
  assert.equal(calendarLiveV1RequestSequence("cleanup"), 2);
  assert.equal(calendarLiveV1RequestSequence("restore"), 3);
  assert.equal(calendarLiveV1RequestSequence("extract"), 4);
  assert.equal(calendarLiveV1RequestSequence("probe"), 5);
  assert.equal(calendarLiveV1RequestSequence("capture", 0), 6);
  assert.equal(calendarLiveV1RequestSequence("capture", 7), 13);
  assert.throws(() => calendarLiveV1RequestSequence("capture", 8));
});

test("gates validate one Astryx root — the Calendar live v22 class", () => {
  const broker = readFileSync("recipe/calendar-live-v42-broker.ts", "utf8");
  assert.match(
    broker,
    /artifact\.roots\.length !== CALENDAR_LIVE_V42_SOURCE_ROOTS/,
  );
  assert.equal(
    broker.includes("artifact.roots.length !== 2"),
    false,
    "two-root Table leftover is the refused class",
  );
});
