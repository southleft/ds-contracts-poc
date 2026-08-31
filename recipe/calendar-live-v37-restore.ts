import { CALENDAR_FIGMA_NAMESPACE } from "./calendar-figma-writer.js";
import { canonicalJson } from "./normalize.js";

export const CALENDAR_LIVE_V37_NAMESPACE = CALENDAR_FIGMA_NAMESPACE;
export const CALENDAR_LIVE_V37_MEASURE_HUG_MARKER = "CALENDAR-TEXT-HUG-MEASURE";
export const CALENDAR_LIVE_V37_RESTORE_CONTENT_ROLES = [
  "calendar/day/label",
] as const;
export const CALENDAR_LIVE_V37_RESTORE_DAY_SET_ROLE = "calendar/day-set";
export const CALENDAR_LIVE_V37_RESTORE_COUNT = 4;
export const FORBIDDEN_INPUT_PAGE_ID = "115:295378";
export const FORBIDDEN_COMBOBOX_PAGE_ID = "163:35981";
export const FORBIDDEN_BUTTON_PAGE_ID = "85:6781";
export const FORBIDDEN_TABLE_PAGE_ID = "173:48924";
export const FORBIDDEN_CALENDAR_V30_PAGE_ID = "180:56126";

export interface CalendarLiveV37RestoreWriter {
  pageId: string;
  runIdentity: string;
  setIds: readonly string[];
}

export interface CalendarLiveV37RestorePayload {
  pageId: string;
  setIds: string[];
  restoredCount: 4;
  fixedBefore: number;
  hiddenRevealedForHug: number;
  retriedForHug: number;
  contentHugAfter: true;
  marker: typeof CALENDAR_LIVE_V37_MEASURE_HUG_MARKER;
}

export function buildCalendarLiveV37RestoreProgram(
  writer: CalendarLiveV37RestoreWriter,
): string {
  if (writer.setIds.length !== 3)
    throw new TypeError("Calendar live v37 restore requires three owned sets");
  if (
    writer.pageId === FORBIDDEN_INPUT_PAGE_ID ||
    writer.pageId === FORBIDDEN_COMBOBOX_PAGE_ID ||
    writer.pageId === FORBIDDEN_BUTTON_PAGE_ID ||
    writer.pageId === FORBIDDEN_TABLE_PAGE_ID ||
    writer.pageId === FORBIDDEN_CALENDAR_V30_PAGE_ID
  )
    throw new TypeError(
      "Calendar restore must not target Input, Combobox, Button, or Table pages",
    );
  return String.raw`
await figma.loadAllPagesAsync();
const NS=${JSON.stringify(CALENDAR_LIVE_V37_NAMESPACE)};
const PAGE_ID=${JSON.stringify(writer.pageId)};
const SET_IDS=${JSON.stringify([...writer.setIds])};
const ROLES=new Set(${JSON.stringify([...CALENDAR_LIVE_V37_RESTORE_CONTENT_ROLES])});
const DAY_SET=${JSON.stringify(CALENDAR_LIVE_V37_RESTORE_DAY_SET_ROLE)};
const MARKER=${JSON.stringify(CALENDAR_LIVE_V37_MEASURE_HUG_MARKER)};
if(PAGE_ID==="115:295378")throw new Error("CALENDAR-MUST-NOT-WRITE-INPUT-PAGE");
if(PAGE_ID==="163:35981")throw new Error("CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(PAGE_ID==="85:6781")throw new Error("CALENDAR-MUST-NOT-WRITE-BUTTON-PAGE");
if(PAGE_ID==="173:48924")throw new Error("CALENDAR-MUST-NOT-WRITE-TABLE-PAGE");
const page=await figma.getNodeByIdAsync(PAGE_ID);
if(!page||page.type!=="PAGE")throw new Error("CALENDAR-V5-RESTORE-PAGE");
if(page.id==="115:295378")throw new Error("CALENDAR-MUST-NOT-WRITE-INPUT-PAGE");
if(page.id==="163:35981")throw new Error("CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(page.id==="85:6781")throw new Error("CALENDAR-MUST-NOT-WRITE-BUTTON-PAGE");
if(page.id==="173:48924")throw new Error("CALENDAR-MUST-NOT-WRITE-TABLE-PAGE");
if(page.getSharedPluginData(NS,"pageOwner")!=="recipe/calendar/"+${JSON.stringify(writer.runIdentity)})throw new Error("CALENDAR-V5-RESTORE-OWNER");
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>SET_IDS.includes(node.id));
if(sets.length!==3)throw new Error("CALENDAR-V5-RESTORE-ROOTS:"+sets.length);
const texts=[];
for(const set of sets){
  const setRole=set.name.split(" :: ",1)[0];
  if(setRole!==DAY_SET)continue;
  for(const component of set.children){
    if(component.type!=="COMPONENT")continue;
    for(const descendant of component.findAllWithCriteria({types:["TEXT"]})){
      const role=descendant.name.split(" :: ",1)[0];
      if(!ROLES.has(role))continue;
      texts.push({setId:set.id,componentName:component.name,role,node:descendant});
    }
  }
}
const restored=[];
for(const entry of texts){
  const node=entry.node;
  const before=node.layoutSizingHorizontal;
  const hidden=node.visible===false;
  if(hidden)node.visible=true;
  const assign=()=>{
    node.textAutoResize="WIDTH_AND_HEIGHT";
    node.layoutGrow=0;
    node.layoutSizingHorizontal="HUG";
    node.layoutSizingVertical="HUG";
  };
  assign();
  let after=node.layoutSizingHorizontal;
  let retried=false;
  if(after!=="HUG"){
    assign();
    after=node.layoutSizingHorizontal;
    retried=true;
  }
  if(node.width<=0||node.height<=0)throw new Error(MARKER+":"+entry.role);
  if(after==="FILL")throw new Error("CALENDAR-V5-RESTORE-INVENTED-FILL:"+entry.role);
  restored.push({setId:entry.setId,componentName:entry.componentName,role:entry.role,before,after,hidden,retried});
  if(hidden)node.visible=false;
}
if(restored.length!==4)throw new Error("CALENDAR-V5-RESTORE-COUNT:"+restored.length);
if(restored.some(entry=>entry.after!=="HUG"))throw new Error("CALENDAR-V5-RESTORE-NOT-HUG");
return{pageId:page.id,setIds:[...sets.map(set=>set.id)].sort(),restoredCount:restored.length,fixedBefore:restored.filter(entry=>entry.before==="FIXED").length,hiddenRevealedForHug:restored.filter(entry=>entry.hidden).length,retriedForHug:restored.filter(entry=>entry.retried).length,contentHugAfter:true,marker:MARKER};
`;
}

export function validateCalendarLiveV37RestorePayload(
  payload: unknown,
  writer: CalendarLiveV37RestoreWriter,
): CalendarLiveV37RestorePayload {
  if (payload === null || typeof payload !== "object")
    throw new TypeError("Calendar live v37 restore payload must be an object");
  const value = payload as Record<string, unknown>;
  if (
    value.pageId !== writer.pageId ||
    value.pageId === FORBIDDEN_INPUT_PAGE_ID ||
    value.pageId === FORBIDDEN_COMBOBOX_PAGE_ID ||
    value.pageId === FORBIDDEN_BUTTON_PAGE_ID ||
    value.pageId === FORBIDDEN_TABLE_PAGE_ID ||
    value.pageId === FORBIDDEN_CALENDAR_V30_PAGE_ID ||
    !Array.isArray(value.setIds) ||
    canonicalJson([...value.setIds].sort()) !==
      canonicalJson([...writer.setIds].sort()) ||
    value.restoredCount !== 4 ||
    typeof value.fixedBefore !== "number" ||
    !Number.isInteger(value.fixedBefore) ||
    value.fixedBefore < 0 ||
    value.fixedBefore > 4 ||
    typeof value.hiddenRevealedForHug !== "number" ||
    !Number.isInteger(value.hiddenRevealedForHug) ||
    value.hiddenRevealedForHug < 0 ||
    value.hiddenRevealedForHug > 4 ||
    typeof value.retriedForHug !== "number" ||
    !Number.isInteger(value.retriedForHug) ||
    value.retriedForHug < 0 ||
    value.retriedForHug > 4 ||
    value.contentHugAfter !== true ||
    value.marker !== CALENDAR_LIVE_V37_MEASURE_HUG_MARKER
  )
    throw new TypeError("Calendar live v37 restore did not re-assert content HUG");
  return value as CalendarLiveV37RestorePayload;
}
