import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBOBOX_LIVE_V39_TARGET,
  comboboxLiveV5RequestSequence,
} from "./combobox-live-v39-broker.js";
import { COMBOBOX_LIVE_V39_CAPTURE_COUNT } from "./combobox-live-v39-contract.js";

test("Combobox live v39 broker pins Scratch and 72 captures", () => {
  assert.equal(COMBOBOX_LIVE_V39_TARGET.fileKey, "byMp6lt0Ij9b2QbkDGFwBh");
  assert.equal(COMBOBOX_LIVE_V39_CAPTURE_COUNT, 72);
  assert.equal(comboboxLiveV5RequestSequence("writer"), 1);
  assert.equal(comboboxLiveV5RequestSequence("cleanup"), 2);
  assert.equal(comboboxLiveV5RequestSequence("restore"), 3);
  assert.equal(comboboxLiveV5RequestSequence("extract"), 4);
  assert.equal(comboboxLiveV5RequestSequence("probe"), 5);
  assert.equal(comboboxLiveV5RequestSequence("capture", 0), 6);
  assert.equal(comboboxLiveV5RequestSequence("capture", 71), 77);
  assert.throws(() => comboboxLiveV5RequestSequence("capture", 72));
});
