import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBOBOX_LIVE_V4_TARGET,
  comboboxLiveV4RequestSequence,
} from "./combobox-live-v4-broker.js";
import { COMBOBOX_LIVE_V4_CAPTURE_COUNT } from "./combobox-live-v4-contract.js";

test("Combobox live v4 broker pins Scratch and 72 captures", () => {
  assert.equal(COMBOBOX_LIVE_V4_TARGET.fileKey, "byMp6lt0Ij9b2QbkDGFwBh");
  assert.equal(COMBOBOX_LIVE_V4_CAPTURE_COUNT, 72);
  assert.equal(comboboxLiveV4RequestSequence("writer"), 1);
  assert.equal(comboboxLiveV4RequestSequence("cleanup"), 2);
  assert.equal(comboboxLiveV4RequestSequence("restore"), 3);
  assert.equal(comboboxLiveV4RequestSequence("extract"), 4);
  assert.equal(comboboxLiveV4RequestSequence("probe"), 5);
  assert.equal(comboboxLiveV4RequestSequence("capture", 0), 6);
  assert.equal(comboboxLiveV4RequestSequence("capture", 71), 77);
  assert.throws(() => comboboxLiveV4RequestSequence("capture", 72));
});
