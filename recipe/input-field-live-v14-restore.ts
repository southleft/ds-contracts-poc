import { canonicalJson } from "./normalize.js";

export const V12_WRITER_PROGRAM_SHA256 =
  "a01d95b3b2a46999d4228814101d5e8b19ef35bb0f0b9113b1d9d438e150d6b3";
export const V12_WRITER_PAYLOAD_SHA256 =
  "b091cf61288e21aea4031e7717957e5329f2fb1ec164757b08f1f0d9ea830597";
export const V13_RESTORE_SOURCE_SHA256 =
  "4c140645423313cf0a45b181d39eefafaed8c7bf535c9ac5a12eef060196cd0a";
export const V13_RESTORE_BLUEPRINT_SHA256 =
  "77997efc45e5067e5a8ee78b073da36bb2ed09fafe7cfada2b23ad30a78ae838";

export const INPUT_LIVE_V14_NAMESPACE = "ds.contracts.input.recipe.v5";
export const INPUT_LIVE_V14_TWO_PASS_FILL_MARKER = "INPUT-TEXT-FILL-TWO-PASS";
export const INPUT_LIVE_V14_RESTORE_CONTENT_ROLES = [
  "input-field/content/placeholder",
  "input-field/content/value",
] as const;
export const INPUT_LIVE_V14_RESTORE_PARENT_ROLES = [
  "input-field/surface",
  "input-field/content-row",
] as const;

export interface InputLiveV14RestoreWriter {
  pageId: string;
  runIdentity: string;
  setIds: readonly [string, string];
}

export interface InputLiveV14RestorePayload {
  pageId: string;
  setIds: string[];
  restoredCount: 256;
  fixedBefore: number;
  hiddenRevealedForFill: number;
  contentFillAfter: true;
  marker: typeof INPUT_LIVE_V14_TWO_PASS_FILL_MARKER;
}

export function buildInputLiveV14RestoreProgram(
  writer: InputLiveV14RestoreWriter,
): string {
  if (writer.setIds.length !== 2)
    throw new TypeError("Input live v14 restore requires two owned sets");
  return String.raw`
await figma.loadAllPagesAsync();
const V14_NS=${JSON.stringify(INPUT_LIVE_V14_NAMESPACE)};
const V14_PAGE_ID=${JSON.stringify(writer.pageId)};
const V14_SET_IDS=${JSON.stringify([...writer.setIds])};
const V14_ROLES=new Set(${JSON.stringify([...INPUT_LIVE_V14_RESTORE_CONTENT_ROLES])});
const V14_PARENTS=new Set(${JSON.stringify([...INPUT_LIVE_V14_RESTORE_PARENT_ROLES])});
const V14_MARKER=${JSON.stringify(INPUT_LIVE_V14_TWO_PASS_FILL_MARKER)};
const page=await figma.getNodeByIdAsync(V14_PAGE_ID);
if(!page||page.type!=="PAGE")throw new Error("INPUT-V14-RESTORE-PAGE");
if(page.getSharedPluginData(V14_NS,"pageOwner")!=="recipe/input-field/"+${JSON.stringify(writer.runIdentity)})throw new Error("INPUT-V14-RESTORE-OWNER");
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>V14_SET_IDS.includes(node.id));
if(sets.length!==2)throw new Error("INPUT-V14-RESTORE-ROOTS:"+sets.length);
const parents=[];
const texts=[];
for(const set of sets){
  for(const component of set.children){
    if(component.type!=="COMPONENT")continue;
    for(const descendant of component.findAllWithCriteria({types:["TEXT","FRAME"]})){
      const role=descendant.name.split(" :: ",1)[0];
      if(descendant.type==="FRAME"&&V14_PARENTS.has(role))parents.push(descendant);
      if(descendant.type==="TEXT"&&V14_ROLES.has(role))texts.push({setId:set.id,componentName:component.name,role,node:descendant});
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
  node.textAutoResize="HEIGHT";
  node.layoutGrow=1;
  node.layoutSizingHorizontal="FILL";
  if(node.width<=0||node.height<=0)throw new Error(V14_MARKER+":"+entry.role);
  if(hidden)node.visible=false;
  restored.push({setId:entry.setId,componentName:entry.componentName,role:entry.role,before,after:node.layoutSizingHorizontal,hidden});
}
if(restored.length!==256)throw new Error("INPUT-V14-RESTORE-COUNT:"+restored.length);
if(restored.some(entry=>entry.after!=="FILL"))throw new Error("INPUT-V14-RESTORE-NOT-FILL");
return{pageId:page.id,setIds:[...sets.map(set=>set.id)].sort(),restoredCount:restored.length,fixedBefore:restored.filter(entry=>entry.before==="FIXED").length,hiddenRevealedForFill:restored.filter(entry=>entry.hidden).length,contentFillAfter:true,marker:V14_MARKER};
`;
}

export function validateInputLiveV14RestorePayload(
  payload: unknown,
  writer: InputLiveV14RestoreWriter,
): InputLiveV14RestorePayload {
  if (payload === null || typeof payload !== "object")
    throw new TypeError("Input live v14 restore payload must be an object");
  const value = payload as Record<string, unknown>;
  if (
    value.pageId !== writer.pageId ||
    !Array.isArray(value.setIds) ||
    canonicalJson([...value.setIds].sort()) !==
      canonicalJson([...writer.setIds].sort()) ||
    value.restoredCount !== 256 ||
    typeof value.fixedBefore !== "number" ||
    !Number.isInteger(value.fixedBefore) ||
    value.fixedBefore < 0 ||
    value.fixedBefore > 256 ||
    typeof value.hiddenRevealedForFill !== "number" ||
    !Number.isInteger(value.hiddenRevealedForFill) ||
    value.hiddenRevealedForFill < 0 ||
    value.hiddenRevealedForFill > 256 ||
    value.contentFillAfter !== true ||
    value.marker !== INPUT_LIVE_V14_TWO_PASS_FILL_MARKER
  )
    throw new TypeError(
      "Input live v14 restore did not re-assert content FILL",
    );
  return value as InputLiveV14RestorePayload;
}
