import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCalendarLiveV32RestoreProgram,
  FORBIDDEN_BUTTON_PAGE_ID,
  FORBIDDEN_COMBOBOX_PAGE_ID,
  FORBIDDEN_INPUT_PAGE_ID,
  FORBIDDEN_TABLE_PAGE_ID,
  FORBIDDEN_CALENDAR_V30_PAGE_ID,
  CALENDAR_LIVE_V32_MEASURE_HUG_MARKER,
  CALENDAR_LIVE_V32_RESTORE_CONTENT_ROLES,
  CALENDAR_LIVE_V32_RESTORE_COUNT,
  CALENDAR_LIVE_V32_RESTORE_DAY_SET_ROLE,
} from "./calendar-live-v32-restore.js";

test("Calendar restore owns HUG labels from day-set only", () => {
  assert.equal(FORBIDDEN_INPUT_PAGE_ID, "115:295378");
  assert.equal(FORBIDDEN_COMBOBOX_PAGE_ID, "163:35981");
  assert.equal(FORBIDDEN_BUTTON_PAGE_ID, "85:6781");
  assert.equal(FORBIDDEN_TABLE_PAGE_ID, "173:48924");
  assert.equal(FORBIDDEN_CALENDAR_V30_PAGE_ID, "180:56126");
  assert.equal(CALENDAR_LIVE_V32_RESTORE_COUNT, 4);
  assert.equal(CALENDAR_LIVE_V32_RESTORE_DAY_SET_ROLE, "calendar/day-set");
  assert.deepEqual([...CALENDAR_LIVE_V32_RESTORE_CONTENT_ROLES], [
    "calendar/day/label",
  ]);
  assert.throws(() =>
    buildCalendarLiveV32RestoreProgram({
      pageId: FORBIDDEN_INPUT_PAGE_ID,
      runIdentity: "x-calendar-v32",
      setIds: ["a", "b", "c"],
    }),
  );
  assert.throws(() =>
    buildCalendarLiveV32RestoreProgram({
      pageId: FORBIDDEN_COMBOBOX_PAGE_ID,
      runIdentity: "x-calendar-v32",
      setIds: ["a", "b", "c"],
    }),
  );
  assert.throws(() =>
    buildCalendarLiveV32RestoreProgram({
      pageId: FORBIDDEN_TABLE_PAGE_ID,
      runIdentity: "x-calendar-v32",
      setIds: ["a", "b", "c"],
    }),
  );
  assert.throws(() =>
    buildCalendarLiveV32RestoreProgram({
      pageId: FORBIDDEN_CALENDAR_V30_PAGE_ID,
      runIdentity: "x-calendar-v32",
      setIds: ["a", "b", "c"],
    }),
  );
  const program = buildCalendarLiveV32RestoreProgram({
    pageId: "1:2",
    runIdentity: "x-calendar-v32",
    setIds: ["a", "b", "c"],
  });
  assert.match(program, /CALENDAR-MUST-NOT-WRITE-INPUT-PAGE/);
  assert.match(program, /CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE/);
  assert.match(program, /CALENDAR-MUST-NOT-WRITE-BUTTON-PAGE/);
  assert.match(program, /CALENDAR-MUST-NOT-WRITE-TABLE-PAGE/);
  assert.match(program, /calendar\/day\/label/);
  assert.match(program, /calendar\/day-set/);
  assert.match(program, /setRole!==DAY_SET/);
  assert.match(program, /restored\.length!==4/);
  assert.match(program, /CALENDAR-V5-RESTORE-COUNT/);
  assert.match(program, /CALENDAR-V5-RESTORE-INVENTED-FILL/);
  assert.match(program, new RegExp(CALENDAR_LIVE_V32_MEASURE_HUG_MARKER));
  assert.match(program, /layoutSizingHorizontal="HUG"/);
  assert.doesNotMatch(program, /table\/cell\/label/);
  assert.doesNotMatch(program, /combobox\/input/);
  assert.doesNotMatch(program, /ds\.contracts\.input\.recipe\.v5/);
});
