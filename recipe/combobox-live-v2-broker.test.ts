import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBOBOX_LIVE_V2_TARGET,
  comboboxLiveV2RequestSequence,
} from "./combobox-live-v2-broker.js";
import { COMBOBOX_LIVE_V2_CAPTURE_COUNT } from "./combobox-live-v2-contract.js";

test("Combobox live v1 broker pins Scratch and 72 captures", () => {
  assert.equal(COMBOBOX_LIVE_V2_TARGET.fileKey, "byMp6lt0Ij9b2QbkDGFwBh");
  assert.equal(COMBOBOX_LIVE_V2_CAPTURE_COUNT, 72);
  assert.equal(comboboxLiveV2RequestSequence("writer"), 1);
  assert.equal(comboboxLiveV2RequestSequence("cleanup"), 2);
  assert.equal(comboboxLiveV2RequestSequence("restore"), 3);
  assert.equal(comboboxLiveV2RequestSequence("extract"), 4);
  assert.equal(comboboxLiveV2RequestSequence("probe"), 5);
  assert.equal(comboboxLiveV2RequestSequence("capture", 0), 6);
  assert.equal(comboboxLiveV2RequestSequence("capture", 71), 77);
  assert.throws(() => comboboxLiveV2RequestSequence("capture", 72));
});
