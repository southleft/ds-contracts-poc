import { TABLE_FIGMA_NAMESPACE } from "./table-figma-writer.js";
import { canonicalJson } from "./normalize.js";

export const TABLE_LIVE_V7_NAMESPACE = TABLE_FIGMA_NAMESPACE;
export const TABLE_LIVE_V7_MEASURE_HUG_MARKER = "TABLE-TEXT-HUG-MEASURE";
export const TABLE_LIVE_V7_RESTORE_CONTENT_ROLES = ["table/cell/label"] as const;
export const TABLE_LIVE_V7_RESTORE_CELL_SET_ROLE = "table/cell-set";
export const TABLE_LIVE_V7_RESTORE_COUNT = 8;
export const FORBIDDEN_INPUT_PAGE_ID = "115:295378";
export const FORBIDDEN_COMBOBOX_PAGE_ID = "163:35981";

export interface TableLiveV7RestoreWriter {
  pageId: string;
  runIdentity: string;
  setIds: readonly string[];
}

export interface TableLiveV7RestorePayload {
  pageId: string;
  setIds: string[];
  restoredCount: 8;
  fixedBefore: number;
  hiddenRevealedForHug: number;
  retriedForHug: number;
  contentHugAfter: true;
  marker: typeof TABLE_LIVE_V7_MEASURE_HUG_MARKER;
}

export function buildTableLiveV7RestoreProgram(
  writer: TableLiveV7RestoreWriter,
): string {
  if (writer.setIds.length !== 6)
    throw new TypeError("Table live v7 restore requires six owned sets");
  if (
    writer.pageId === FORBIDDEN_INPUT_PAGE_ID ||
    writer.pageId === FORBIDDEN_COMBOBOX_PAGE_ID
  )
    throw new TypeError("Table restore must not target Input or Combobox pages");
  return String.raw`
await figma.loadAllPagesAsync();
const NS=${JSON.stringify(TABLE_LIVE_V7_NAMESPACE)};
const PAGE_ID=${JSON.stringify(writer.pageId)};
const SET_IDS=${JSON.stringify([...writer.setIds])};
const ROLES=new Set(${JSON.stringify([...TABLE_LIVE_V7_RESTORE_CONTENT_ROLES])});
const CELL_SET=${JSON.stringify(TABLE_LIVE_V7_RESTORE_CELL_SET_ROLE)};
const MARKER=${JSON.stringify(TABLE_LIVE_V7_MEASURE_HUG_MARKER)};
if(PAGE_ID==="115:295378")throw new Error("TABLE-MUST-NOT-WRITE-INPUT-PAGE");
if(PAGE_ID==="163:35981")throw new Error("TABLE-MUST-NOT-WRITE-COMBOBOX-PAGE");
const page=await figma.getNodeByIdAsync(PAGE_ID);
if(!page||page.type!=="PAGE")throw new Error("TABLE-V2-RESTORE-PAGE");
if(page.id==="115:295378")throw new Error("TABLE-MUST-NOT-WRITE-INPUT-PAGE");
if(page.id==="163:35981")throw new Error("TABLE-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(page.getSharedPluginData(NS,"pageOwner")!=="recipe/table/"+${JSON.stringify(writer.runIdentity)})throw new Error("TABLE-V2-RESTORE-OWNER");
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>SET_IDS.includes(node.id));
if(sets.length!==6)throw new Error("TABLE-V2-RESTORE-ROOTS:"+sets.length);
const texts=[];
for(const set of sets){
  const setRole=set.name.split(" :: ",1)[0];
  if(setRole!==CELL_SET)continue;
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
  if(after==="FILL")throw new Error("TABLE-V2-RESTORE-INVENTED-FILL:"+entry.role);
  restored.push({setId:entry.setId,componentName:entry.componentName,role:entry.role,before,after,hidden,retried});
  if(hidden)node.visible=false;
}
if(restored.length!==8)throw new Error("TABLE-V2-RESTORE-COUNT:"+restored.length);
if(restored.some(entry=>entry.after!=="HUG"))throw new Error("TABLE-V2-RESTORE-NOT-HUG");
return{pageId:page.id,setIds:[...sets.map(set=>set.id)].sort(),restoredCount:restored.length,fixedBefore:restored.filter(entry=>entry.before==="FIXED").length,hiddenRevealedForHug:restored.filter(entry=>entry.hidden).length,retriedForHug:restored.filter(entry=>entry.retried).length,contentHugAfter:true,marker:MARKER};
`;
}

export function validateTableLiveV7RestorePayload(
  payload: unknown,
  writer: TableLiveV7RestoreWriter,
): TableLiveV7RestorePayload {
  if (payload === null || typeof payload !== "object")
    throw new TypeError("Table live v7 restore payload must be an object");
  const value = payload as Record<string, unknown>;
  if (
    value.pageId !== writer.pageId ||
    value.pageId === FORBIDDEN_INPUT_PAGE_ID ||
    value.pageId === FORBIDDEN_COMBOBOX_PAGE_ID ||
    !Array.isArray(value.setIds) ||
    canonicalJson([...value.setIds].sort()) !==
      canonicalJson([...writer.setIds].sort()) ||
    value.restoredCount !== 8 ||
    typeof value.fixedBefore !== "number" ||
    !Number.isInteger(value.fixedBefore) ||
    value.fixedBefore < 0 ||
    value.fixedBefore > 8 ||
    typeof value.hiddenRevealedForHug !== "number" ||
    !Number.isInteger(value.hiddenRevealedForHug) ||
    value.hiddenRevealedForHug < 0 ||
    value.hiddenRevealedForHug > 8 ||
    typeof value.retriedForHug !== "number" ||
    !Number.isInteger(value.retriedForHug) ||
    value.retriedForHug < 0 ||
    value.retriedForHug > 8 ||
    value.contentHugAfter !== true ||
    value.marker !== TABLE_LIVE_V7_MEASURE_HUG_MARKER
  )
    throw new TypeError("Table live v7 restore did not re-assert content HUG");
  return value as TableLiveV7RestorePayload;
}
