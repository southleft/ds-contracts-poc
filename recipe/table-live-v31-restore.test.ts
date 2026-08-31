import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTableLiveV31RestoreProgram,
  FORBIDDEN_COMBOBOX_PAGE_ID,
  FORBIDDEN_INPUT_PAGE_ID,
  TABLE_LIVE_V31_MEASURE_HUG_MARKER,
  TABLE_LIVE_V31_RESTORE_CELL_SET_ROLE,
  TABLE_LIVE_V31_RESTORE_CONTENT_ROLES,
  TABLE_LIVE_V31_RESTORE_COUNT,
} from "./table-live-v31-restore.js";

test("Table restore owns HUG labels from cell-set only, never 144 FILL texts", () => {
  assert.equal(FORBIDDEN_INPUT_PAGE_ID, "115:295378");
  assert.equal(FORBIDDEN_COMBOBOX_PAGE_ID, "163:35981");
  assert.equal(TABLE_LIVE_V31_RESTORE_COUNT, 8);
  assert.equal(TABLE_LIVE_V31_RESTORE_CELL_SET_ROLE, "table/cell-set");
  assert.deepEqual([...TABLE_LIVE_V31_RESTORE_CONTENT_ROLES], [
    "table/cell/label",
  ]);
  assert.throws(() =>
    buildTableLiveV31RestoreProgram({
      pageId: FORBIDDEN_INPUT_PAGE_ID,
      runIdentity: "x-table-v2",
      setIds: ["a", "b", "c", "d", "e", "f"],
    }),
  );
  assert.throws(() =>
    buildTableLiveV31RestoreProgram({
      pageId: FORBIDDEN_COMBOBOX_PAGE_ID,
      runIdentity: "x-table-v2",
      setIds: ["a", "b", "c", "d", "e", "f"],
    }),
  );
  const program = buildTableLiveV31RestoreProgram({
    pageId: "1:2",
    runIdentity: "x-table-v2",
    setIds: ["a", "b", "c", "d", "e", "f"],
  });
  assert.match(program, /TABLE-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.match(program, /TABLE-MUST-NOT-WRITE-COMBOBOX-PAGE/);
  assert.match(program, /table\/cell\/label/);
  assert.match(program, /table\/cell-set/);
  assert.match(program, /setRole!==CELL_SET/);
  assert.match(program, /restored\.length!==8/);
  assert.match(program, /TABLE-V2-RESTORE-COUNT/);
  assert.match(program, /TABLE-V2-RESTORE-INVENTED-FILL/);
  assert.match(program, new RegExp(TABLE_LIVE_V31_MEASURE_HUG_MARKER));
  assert.match(program, /layoutSizingHorizontal="HUG"/);
  assert.doesNotMatch(program, /144/);
  assert.doesNotMatch(program, /combobox\/input/);
  assert.doesNotMatch(program, /combobox\/option\/label/);
  assert.doesNotMatch(program, /ds\.contracts\.input\.recipe\.v5/);
});
