import assert from "node:assert/strict";
import test from "node:test";

import {
  CALENDAR_LIVE_V15_TARGET,
  calendarLiveV1RequestSequence,
} from "./calendar-live-v15-broker.js";
import { CALENDAR_LIVE_V15_CAPTURE_COUNT } from "./calendar-live-v15-contract.js";

test("Calendar live v15 broker pins Scratch and 8 captures", () => {
  assert.equal(CALENDAR_LIVE_V15_TARGET.fileKey, "byMp6lt0Ij9b2QbkDGFwBh");
  assert.equal(CALENDAR_LIVE_V15_CAPTURE_COUNT, 8);
  assert.equal(calendarLiveV1RequestSequence("writer"), 1);
  assert.equal(calendarLiveV1RequestSequence("cleanup"), 2);
  assert.equal(calendarLiveV1RequestSequence("restore"), 3);
  assert.equal(calendarLiveV1RequestSequence("extract"), 4);
  assert.equal(calendarLiveV1RequestSequence("probe"), 5);
  assert.equal(calendarLiveV1RequestSequence("capture", 0), 6);
  assert.equal(calendarLiveV1RequestSequence("capture", 7), 13);
  assert.throws(() => calendarLiveV1RequestSequence("capture", 8));
});
