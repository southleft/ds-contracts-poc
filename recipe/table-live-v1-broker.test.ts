import assert from "node:assert/strict";
import test from "node:test";

import {
  TABLE_LIVE_V1_TARGET,
  tableLiveV1RequestSequence,
} from "./table-live-v1-broker.js";
import { TABLE_LIVE_V1_CAPTURE_COUNT } from "./table-live-v1-contract.js";

test("Table live v1 broker pins Scratch and 20 captures", () => {
  assert.equal(TABLE_LIVE_V1_TARGET.fileKey, "byMp6lt0Ij9b2QbkDGFwBh");
  assert.equal(TABLE_LIVE_V1_CAPTURE_COUNT, 20);
  assert.equal(tableLiveV1RequestSequence("writer"), 1);
  assert.equal(tableLiveV1RequestSequence("cleanup"), 2);
  assert.equal(tableLiveV1RequestSequence("restore"), 3);
  assert.equal(tableLiveV1RequestSequence("extract"), 4);
  assert.equal(tableLiveV1RequestSequence("probe"), 5);
  assert.equal(tableLiveV1RequestSequence("capture", 0), 6);
  assert.equal(tableLiveV1RequestSequence("capture", 19), 25);
  assert.throws(() => tableLiveV1RequestSequence("capture", 20));
});
