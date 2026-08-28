import assert from "node:assert/strict";
import test from "node:test";

import {
  buildComboboxLiveV1RestoreProgram,
  COMBOBOX_LIVE_V1_RESTORE_CONTENT_ROLES,
  COMBOBOX_LIVE_V1_RESTORE_COUNT,
  FORBIDDEN_INPUT_PAGE_ID,
} from "./combobox-live-v1-restore.js";

test("Combobox restore refuses the Input page and names FILL roles from source", () => {
  assert.equal(FORBIDDEN_INPUT_PAGE_ID, "115:295378");
  assert.equal(COMBOBOX_LIVE_V1_RESTORE_COUNT, 144);
  assert.deepEqual(
    [...COMBOBOX_LIVE_V1_RESTORE_CONTENT_ROLES],
    ["combobox/input", "combobox/option/label"],
  );
  assert.throws(() =>
    buildComboboxLiveV1RestoreProgram({
      pageId: FORBIDDEN_INPUT_PAGE_ID,
      runIdentity: "x-combobox-v1",
      setIds: ["a", "b", "c", "d"],
    }),
  );
  const program = buildComboboxLiveV1RestoreProgram({
    pageId: "1:2",
    runIdentity: "x-combobox-v1",
    setIds: ["a", "b", "c", "d"],
  });
  assert.match(program, /COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.match(program, /combobox\/input/);
  assert.match(program, /combobox\/option\/label/);
  assert.match(program, /restored\.length!==144/);
  assert.doesNotMatch(program, /ds\.contracts\.input\.recipe\.v5/);
});
