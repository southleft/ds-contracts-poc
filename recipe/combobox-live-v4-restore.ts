import { COMBOBOX_FIGMA_NAMESPACE } from "./combobox-figma-writer.js";
import { canonicalJson } from "./normalize.js";

export const COMBOBOX_LIVE_V4_NAMESPACE = COMBOBOX_FIGMA_NAMESPACE;
export const COMBOBOX_LIVE_V4_MEASURE_VISIBLE_FILL_MARKER =
  "COMBOBOX-TEXT-FILL-MEASURE-VISIBLE";
export const COMBOBOX_LIVE_V4_RESTORE_CONTENT_ROLES = [
  "combobox/input",
  "combobox/option/label",
] as const;
export const COMBOBOX_LIVE_V4_RESTORE_PARENT_ROLES = [
  "combobox/trigger",
] as const;
export const COMBOBOX_LIVE_V4_RESTORE_INPUT_SET_ROLE = "combobox/set";
export const COMBOBOX_LIVE_V4_RESTORE_OPTION_LABEL_SET_ROLE =
  "combobox/option-set";
export const COMBOBOX_LIVE_V4_RESTORE_COUNT = 144;
export const FORBIDDEN_INPUT_PAGE_ID = "115:295378";

export interface ComboboxLiveV4RestoreWriter {
  pageId: string;
  runIdentity: string;
  setIds: readonly string[];
}

export interface ComboboxLiveV4RestorePayload {
  pageId: string;
  setIds: string[];
  restoredCount: 144;
  fixedBefore: number;
  hiddenRevealedForFill: number;
  retriedForFill: number;
  contentFillAfter: true;
  marker: typeof COMBOBOX_LIVE_V4_MEASURE_VISIBLE_FILL_MARKER;
}

export function buildComboboxLiveV4RestoreProgram(
  writer: ComboboxLiveV4RestoreWriter,
): string {
  if (writer.setIds.length !== 4)
    throw new TypeError("Combobox live v4 restore requires four owned sets");
  if (writer.pageId === FORBIDDEN_INPUT_PAGE_ID)
    throw new TypeError("Combobox restore must not target Input page");
  return String.raw`
await figma.loadAllPagesAsync();
const NS=${JSON.stringify(COMBOBOX_LIVE_V4_NAMESPACE)};
const PAGE_ID=${JSON.stringify(writer.pageId)};
const SET_IDS=${JSON.stringify([...writer.setIds])};
const ROLES=new Set(${JSON.stringify([...COMBOBOX_LIVE_V4_RESTORE_CONTENT_ROLES])});
const PARENTS=new Set(${JSON.stringify([...COMBOBOX_LIVE_V4_RESTORE_PARENT_ROLES])});
const INPUT_SET=${JSON.stringify(COMBOBOX_LIVE_V4_RESTORE_INPUT_SET_ROLE)};
const OPTION_SET=${JSON.stringify(COMBOBOX_LIVE_V4_RESTORE_OPTION_LABEL_SET_ROLE)};
const MARKER=${JSON.stringify(COMBOBOX_LIVE_V4_MEASURE_VISIBLE_FILL_MARKER)};
if(PAGE_ID==="115:295378")throw new Error("COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE");
const page=await figma.getNodeByIdAsync(PAGE_ID);
if(!page||page.type!=="PAGE")throw new Error("COMBOBOX-V4-RESTORE-PAGE");
if(page.id==="115:295378")throw new Error("COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE");
if(page.getSharedPluginData(NS,"pageOwner")!=="recipe/combobox/"+${JSON.stringify(writer.runIdentity)})throw new Error("COMBOBOX-V4-RESTORE-OWNER");
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>SET_IDS.includes(node.id));
if(sets.length!==4)throw new Error("COMBOBOX-V4-RESTORE-ROOTS:"+sets.length);
const parents=[];
const texts=[];
for(const set of sets){
  const setRole=set.name.split(" :: ",1)[0];
  for(const component of set.children){
    if(component.type!=="COMPONENT")continue;
    for(const descendant of component.findAllWithCriteria({types:["TEXT","FRAME"]})){
      const role=descendant.name.split(" :: ",1)[0];
      if(descendant.type==="FRAME"&&PARENTS.has(role))parents.push(descendant);
      if(descendant.type!=="TEXT"||!ROLES.has(role))continue;
      if(role==="combobox/input"&&setRole!==INPUT_SET)continue;
      if(role==="combobox/option/label"&&setRole!==OPTION_SET)continue;
      texts.push({setId:set.id,componentName:component.name,role,node:descendant});
    }
  }
}
for(const frame of parents)frame.layoutSizingHorizontal="FILL";
const restored=[];
for(const entry of texts){
  const node=entry.node;
  const before=node.layoutSizingHorizontal;
  const hidden=node.visible===false;
  if(hidden)node.visible=true;
  const assign=()=>{
    node.textAutoResize="HEIGHT";
    node.layoutGrow=1;
    node.layoutSizingHorizontal="FILL";
  };
  assign();
  let after=node.layoutSizingHorizontal;
  let retried=false;
  if(after!=="FILL"){
    assign();
    after=node.layoutSizingHorizontal;
    retried=true;
  }
  if(node.width<=0||node.height<=0)throw new Error(MARKER+":"+entry.role);
  restored.push({setId:entry.setId,componentName:entry.componentName,role:entry.role,before,after,hidden,retried});
  if(hidden)node.visible=false;
}
if(restored.length!==144)throw new Error("COMBOBOX-V4-RESTORE-COUNT:"+restored.length);
if(restored.some(entry=>entry.after!=="FILL"))throw new Error("COMBOBOX-V4-RESTORE-NOT-FILL");
return{pageId:page.id,setIds:[...sets.map(set=>set.id)].sort(),restoredCount:restored.length,fixedBefore:restored.filter(entry=>entry.before==="FIXED").length,hiddenRevealedForFill:restored.filter(entry=>entry.hidden).length,retriedForFill:restored.filter(entry=>entry.retried).length,contentFillAfter:true,marker:MARKER};
`;
}

export function validateComboboxLiveV4RestorePayload(
  payload: unknown,
  writer: ComboboxLiveV4RestoreWriter,
): ComboboxLiveV4RestorePayload {
  if (payload === null || typeof payload !== "object")
    throw new TypeError("Combobox live v4 restore payload must be an object");
  const value = payload as Record<string, unknown>;
  if (
    value.pageId !== writer.pageId ||
    value.pageId === FORBIDDEN_INPUT_PAGE_ID ||
    !Array.isArray(value.setIds) ||
    canonicalJson([...value.setIds].sort()) !==
      canonicalJson([...writer.setIds].sort()) ||
    value.restoredCount !== 144 ||
    typeof value.fixedBefore !== "number" ||
    !Number.isInteger(value.fixedBefore) ||
    value.fixedBefore < 0 ||
    value.fixedBefore > 144 ||
    typeof value.hiddenRevealedForFill !== "number" ||
    !Number.isInteger(value.hiddenRevealedForFill) ||
    value.hiddenRevealedForFill < 0 ||
    value.hiddenRevealedForFill > 144 ||
    typeof value.retriedForFill !== "number" ||
    !Number.isInteger(value.retriedForFill) ||
    value.retriedForFill < 0 ||
    value.retriedForFill > 144 ||
    value.contentFillAfter !== true ||
    value.marker !== COMBOBOX_LIVE_V4_MEASURE_VISIBLE_FILL_MARKER
  )
    throw new TypeError(
      "Combobox live v4 restore did not re-assert content FILL",
    );
  return value as ComboboxLiveV4RestorePayload;
}
