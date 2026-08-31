import assert from "node:assert/strict";
import test from "node:test";

import {
  TABLE_LIVE_V31_TARGET,
  tableLiveV2RequestSequence,
} from "./table-live-v31-broker.js";
import { TABLE_LIVE_V31_CAPTURE_COUNT } from "./table-live-v31-contract.js";

test("Table live v31 broker pins Scratch and 20 captures", () => {
  assert.equal(TABLE_LIVE_V31_TARGET.fileKey, "byMp6lt0Ij9b2QbkDGFwBh");
  assert.equal(TABLE_LIVE_V31_CAPTURE_COUNT, 20);
  assert.equal(tableLiveV2RequestSequence("writer"), 1);
  assert.equal(tableLiveV2RequestSequence("cleanup"), 2);
  assert.equal(tableLiveV2RequestSequence("restore"), 3);
  assert.equal(tableLiveV2RequestSequence("extract"), 4);
  assert.equal(tableLiveV2RequestSequence("probe"), 5);
  assert.equal(tableLiveV2RequestSequence("capture", 0), 6);
  assert.equal(tableLiveV2RequestSequence("capture", 19), 25);
  assert.throws(() => tableLiveV2RequestSequence("capture", 20));
});
