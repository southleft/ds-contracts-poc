import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBOBOX_LIVE_V3_TARGET,
  comboboxLiveV3RequestSequence,
} from "./combobox-live-v3-broker.js";
import { COMBOBOX_LIVE_V3_CAPTURE_COUNT } from "./combobox-live-v3-contract.js";

test("Combobox live v3 broker pins Scratch and 72 captures", () => {
  assert.equal(COMBOBOX_LIVE_V3_TARGET.fileKey, "byMp6lt0Ij9b2QbkDGFwBh");
  assert.equal(COMBOBOX_LIVE_V3_CAPTURE_COUNT, 72);
  assert.equal(comboboxLiveV3RequestSequence("writer"), 1);
  assert.equal(comboboxLiveV3RequestSequence("cleanup"), 2);
  assert.equal(comboboxLiveV3RequestSequence("restore"), 3);
  assert.equal(comboboxLiveV3RequestSequence("extract"), 4);
  assert.equal(comboboxLiveV3RequestSequence("probe"), 5);
  assert.equal(comboboxLiveV3RequestSequence("capture", 0), 6);
  assert.equal(comboboxLiveV3RequestSequence("capture", 71), 77);
  assert.throws(() => comboboxLiveV3RequestSequence("capture", 72));
});
