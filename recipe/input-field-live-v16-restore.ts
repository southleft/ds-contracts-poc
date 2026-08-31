import { canonicalJson } from "./normalize.js";

export const V12_WRITER_PROGRAM_SHA256 =
  "a01d95b3b2a46999d4228814101d5e8b19ef35bb0f0b9113b1d9d438e150d6b3";
export const V12_WRITER_PAYLOAD_SHA256 =
  "b091cf61288e21aea4031e7717957e5329f2fb1ec164757b08f1f0d9ea830597";
export const V15_RESTORE_SOURCE_SHA256 =
  "005196311279494e58dd419c5c7626aaa55617b540ef825442df478891d469fc";
export const V15_RESTORE_BLUEPRINT_SHA256 =
  "da9775162035d50aa60c9539467dec2e6b7d9d50f82b9fedd6b6df7b0d7afee9";
export const V15_RUNTIME_SOURCE_SHA256 =
  "b8d80b16f6371fe865fa09770d8aec5d653ccf8049a78be695d19d822f089ec1";
export const V15_EXTRACT_BLUEPRINT_SHA256 =
  "2c9f1b1e440ce07cdb8b61276ba27818c54490c7ef34e7359d977e9075af15d4";

export const INPUT_LIVE_V16_NAMESPACE = "ds.contracts.input.recipe.v5";
export const INPUT_LIVE_V16_MEASURE_VISIBLE_FILL_MARKER =
  "INPUT-TEXT-FILL-MEASURE-VISIBLE";
export const INPUT_LIVE_V16_RESTORE_CONTENT_ROLES = [
  "input-field/content/placeholder",
  "input-field/content/value",
] as const;
export const INPUT_LIVE_V16_RESTORE_PARENT_ROLES = [
  "input-field/surface",
  "input-field/content-row",
] as const;

export interface InputLiveV16RestoreWriter {
  pageId: string;
  runIdentity: string;
  setIds: readonly [string, string];
}

export interface InputLiveV16RestorePayload {
  pageId: string;
  setIds: string[];
  restoredCount: 256;
  fixedBefore: number;
  hiddenRevealedForFill: number;
  retriedForFill: number;
  contentFillAfter: true;
  marker: typeof INPUT_LIVE_V16_MEASURE_VISIBLE_FILL_MARKER;
}

export function buildInputLiveV16RestoreProgram(
  writer: InputLiveV16RestoreWriter,
): string {
  if (writer.setIds.length !== 2)
    throw new TypeError("Input live v16 restore requires two owned sets");
  return String.raw`
await figma.loadAllPagesAsync();
const V16_NS=${JSON.stringify(INPUT_LIVE_V16_NAMESPACE)};
const V16_PAGE_ID=${JSON.stringify(writer.pageId)};
const V16_SET_IDS=${JSON.stringify([...writer.setIds])};
const V16_ROLES=new Set(${JSON.stringify([...INPUT_LIVE_V16_RESTORE_CONTENT_ROLES])});
const V16_PARENTS=new Set(${JSON.stringify([...INPUT_LIVE_V16_RESTORE_PARENT_ROLES])});
const V16_MARKER=${JSON.stringify(INPUT_LIVE_V16_MEASURE_VISIBLE_FILL_MARKER)};
const page=await figma.getNodeByIdAsync(V16_PAGE_ID);
if(!page||page.type!=="PAGE")throw new Error("INPUT-V16-RESTORE-PAGE");
if(page.getSharedPluginData(V16_NS,"pageOwner")!=="recipe/input-field/"+${JSON.stringify(writer.runIdentity)})throw new Error("INPUT-V16-RESTORE-OWNER");
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>V16_SET_IDS.includes(node.id));
if(sets.length!==2)throw new Error("INPUT-V16-RESTORE-ROOTS:"+sets.length);
const parents=[];
const texts=[];
for(const set of sets){
  for(const component of set.children){
    if(component.type!=="COMPONENT")continue;
    for(const descendant of component.findAllWithCriteria({types:["TEXT","FRAME"]})){
      const role=descendant.name.split(" :: ",1)[0];
      if(descendant.type==="FRAME"&&V16_PARENTS.has(role))parents.push(descendant);
      if(descendant.type==="TEXT"&&V16_ROLES.has(role))texts.push({setId:set.id,componentName:component.name,role,node:descendant});
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
  if(node.width<=0||node.height<=0)throw new Error(V16_MARKER+":"+entry.role);
  restored.push({setId:entry.setId,componentName:entry.componentName,role:entry.role,before,after,hidden,retried});
  if(hidden)node.visible=false;
}
if(restored.length!==256)throw new Error("INPUT-V16-RESTORE-COUNT:"+restored.length);
if(restored.some(entry=>entry.after!=="FILL"))throw new Error("INPUT-V16-RESTORE-NOT-FILL");
return{pageId:page.id,setIds:[...sets.map(set=>set.id)].sort(),restoredCount:restored.length,fixedBefore:restored.filter(entry=>entry.before==="FIXED").length,hiddenRevealedForFill:restored.filter(entry=>entry.hidden).length,retriedForFill:restored.filter(entry=>entry.retried).length,contentFillAfter:true,marker:V16_MARKER};
`;
}

export function validateInputLiveV16RestorePayload(
  payload: unknown,
  writer: InputLiveV16RestoreWriter,
): InputLiveV16RestorePayload {
  if (payload === null || typeof payload !== "object")
    throw new TypeError("Input live v16 restore payload must be an object");
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
    typeof value.retriedForFill !== "number" ||
    !Number.isInteger(value.retriedForFill) ||
    value.retriedForFill < 0 ||
    value.retriedForFill > 256 ||
    value.contentFillAfter !== true ||
    value.marker !== INPUT_LIVE_V16_MEASURE_VISIBLE_FILL_MARKER
  )
    throw new TypeError(
      "Input live v16 restore did not re-assert content FILL",
    );
  return value as InputLiveV16RestorePayload;
}
