import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBOBOX_LIVE_V1_TARGET,
  comboboxLiveV1RequestSequence,
} from "./combobox-live-v1-broker.js";
import { COMBOBOX_LIVE_V1_CAPTURE_COUNT } from "./combobox-live-v1-contract.js";

test("Combobox live v1 broker pins Scratch and 72 captures", () => {
  assert.equal(COMBOBOX_LIVE_V1_TARGET.fileKey, "byMp6lt0Ij9b2QbkDGFwBh");
  assert.equal(COMBOBOX_LIVE_V1_CAPTURE_COUNT, 72);
  assert.equal(comboboxLiveV1RequestSequence("writer"), 1);
  assert.equal(comboboxLiveV1RequestSequence("cleanup"), 2);
  assert.equal(comboboxLiveV1RequestSequence("restore"), 3);
  assert.equal(comboboxLiveV1RequestSequence("extract"), 4);
  assert.equal(comboboxLiveV1RequestSequence("probe"), 5);
  assert.equal(comboboxLiveV1RequestSequence("capture", 0), 6);
  assert.equal(comboboxLiveV1RequestSequence("capture", 71), 77);
  assert.throws(() => comboboxLiveV1RequestSequence("capture", 72));
});
