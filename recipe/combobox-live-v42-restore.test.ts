import assert from "node:assert/strict";
import test from "node:test";

import {
  buildComboboxLiveV42RestoreProgram,
  COMBOBOX_LIVE_V42_RESTORE_CONTENT_ROLES,
  COMBOBOX_LIVE_V42_RESTORE_COUNT,
  COMBOBOX_LIVE_V42_RESTORE_INPUT_SET_ROLE,
  COMBOBOX_LIVE_V42_RESTORE_OPTION_LABEL_SET_ROLE,
  FORBIDDEN_INPUT_PAGE_ID,
} from "./combobox-live-v42-restore.js";

test("Combobox restore owns input from combobox/set and option/label from option-set", () => {
  assert.equal(FORBIDDEN_INPUT_PAGE_ID, "115:295378");
  assert.equal(COMBOBOX_LIVE_V42_RESTORE_COUNT, 144);
  assert.equal(COMBOBOX_LIVE_V42_RESTORE_INPUT_SET_ROLE, "combobox/set");
  assert.equal(
    COMBOBOX_LIVE_V42_RESTORE_OPTION_LABEL_SET_ROLE,
    "combobox/option-set",
  );
  assert.deepEqual(
    [...COMBOBOX_LIVE_V42_RESTORE_CONTENT_ROLES],
    ["combobox/input", "combobox/option/label"],
  );
  assert.throws(() =>
    buildComboboxLiveV42RestoreProgram({
      pageId: FORBIDDEN_INPUT_PAGE_ID,
      runIdentity: "x-combobox-v1",
      setIds: ["a", "b", "c", "d"],
    }),
  );
  const program = buildComboboxLiveV42RestoreProgram({
    pageId: "1:2",
    runIdentity: "x-combobox-v1",
    setIds: ["a", "b", "c", "d"],
  });
  assert.match(program, /COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.match(program, /combobox\/input/);
  assert.match(program, /combobox\/option\/label/);
  assert.match(program, /combobox\/set/);
  assert.match(program, /combobox\/option-set/);
  assert.match(program, /setRole!==INPUT_SET/);
  assert.match(program, /setRole!==OPTION_SET/);
  assert.match(program, /restored\.length!==144/);
  assert.match(program, /COMBOBOX-V8-RESTORE-COUNT/);
  assert.doesNotMatch(program, /ds\.contracts\.input\.recipe\.v5/);
});
