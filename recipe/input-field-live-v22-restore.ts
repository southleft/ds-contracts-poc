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
export const V16_RESTORE_SOURCE_SHA256 =
  "a7df1e4af2ff4872a43a122e2dbfb3f0123aa53575ab93478a434f0bfd6ab1b1";
export const V16_RESTORE_BLUEPRINT_SHA256 =
  "8dd1f997392a365fc80bede5157fe654876cacb5369176c39dd209a9694388ef";
export const V16_RUNTIME_SOURCE_SHA256 =
  "266dc3738fbe8c89a4edeef58f2818a231969366ead07ededbf442c9d66440b5";
export const V16_EXTRACT_BLUEPRINT_SHA256 =
  "6c76021228bdb5e4e1a42f0b01f4ff95dd83739c95b2a964f4c40fc894d46494";
export const V16_SCENE_READBACK_SHA256 =
  "95b8b4aafbdbcb6b271e636a62f4e1ae1882465463ef86e4cf144d6ed1825fd7";
export const V17_SCENE_READBACK_SHA256 =
  "4a99833d5576a23134a5be6a1b62225eadfae46949563249dd324d0e5d514762";
export const V18_RESTORE_SOURCE_SHA256 =
  "86d4c2d7db51854bba61c7d71693347f82e7983b64111f53cd0f1a73c2fa906a";
export const V18_RESTORE_BLUEPRINT_SHA256 =
  "c195b6428dc8618bc3c193eba30cb1f6529effb0da80b0e3c00ae6c852ccb852";
export const V18_EXTRACT_BLUEPRINT_SHA256 =
  "eaa11b3dcb9e9e78a5a85bc56d41f297d5002deccfe5748af5f12b069ab3c283";
export const V18_SCENE_READBACK_SHA256 =
  "3028b85f4605c058dfe79344417c75a5ac2a550d8f693d1d61f72931a64a7cab";
export const V19_SCENE_READBACK_SHA256 =
  "6fea0cbd9c096b28d7c9178bb1c5e5b901a45d843c42ecac39b71e915a46e25f";
export const V20_SCENE_READBACK_SHA256 =
  "fb0a1934792454ca2cd2a925f70a0ce117b2cd6ed72076196f5f98aeefbacbb8";
export const V21_SCENE_READBACK_SHA256 =
  "306879eb6bdb225739733ce2aa48bdd1a945453132d0f9beb1c4c208901f019a";

export const INPUT_LIVE_V22_NAMESPACE = "ds.contracts.input.recipe.v5";
export const INPUT_LIVE_V22_MEASURE_VISIBLE_FILL_MARKER =
  "INPUT-TEXT-FILL-MEASURE-VISIBLE";
export const INPUT_LIVE_V22_RESTORE_CONTENT_ROLES = [
  "input-field/content/placeholder",
  "input-field/content/value",
] as const;
export const INPUT_LIVE_V22_RESTORE_PARENT_ROLES = [
  "input-field/surface",
  "input-field/content-row",
] as const;

export interface InputLiveV22RestoreWriter {
  pageId: string;
  runIdentity: string;
  setIds: readonly [string, string];
}

export interface InputLiveV22RestorePayload {
  pageId: string;
  setIds: string[];
  restoredCount: 256;
  fixedBefore: number;
  hiddenRevealedForFill: number;
  retriedForFill: number;
  contentFillAfter: true;
  marker: typeof INPUT_LIVE_V22_MEASURE_VISIBLE_FILL_MARKER;
}

export function buildInputLiveV22RestoreProgram(
  writer: InputLiveV22RestoreWriter,
): string {
  if (writer.setIds.length !== 2)
    throw new TypeError("Input live v22 restore requires two owned sets");
  return String.raw`
await figma.loadAllPagesAsync();
const V22_NS=${JSON.stringify(INPUT_LIVE_V22_NAMESPACE)};
const V22_PAGE_ID=${JSON.stringify(writer.pageId)};
const V22_SET_IDS=${JSON.stringify([...writer.setIds])};
const V22_ROLES=new Set(${JSON.stringify([...INPUT_LIVE_V22_RESTORE_CONTENT_ROLES])});
const V22_PARENTS=new Set(${JSON.stringify([...INPUT_LIVE_V22_RESTORE_PARENT_ROLES])});
const V22_MARKER=${JSON.stringify(INPUT_LIVE_V22_MEASURE_VISIBLE_FILL_MARKER)};
const page=await figma.getNodeByIdAsync(V22_PAGE_ID);
if(!page||page.type!=="PAGE")throw new Error("INPUT-V22-RESTORE-PAGE");
if(page.getSharedPluginData(V22_NS,"pageOwner")!=="recipe/input-field/"+${JSON.stringify(writer.runIdentity)})throw new Error("INPUT-V22-RESTORE-OWNER");
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>V22_SET_IDS.includes(node.id));
if(sets.length!==2)throw new Error("INPUT-V22-RESTORE-ROOTS:"+sets.length);
const parents=[];
const texts=[];
for(const set of sets){
  for(const component of set.children){
    if(component.type!=="COMPONENT")continue;
    for(const descendant of component.findAllWithCriteria({types:["TEXT","FRAME"]})){
      const role=descendant.name.split(" :: ",1)[0];
      if(descendant.type==="FRAME"&&V22_PARENTS.has(role))parents.push(descendant);
      if(descendant.type==="TEXT"&&V22_ROLES.has(role))texts.push({setId:set.id,componentName:component.name,role,node:descendant});
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
  if(node.width<=0||node.height<=0)throw new Error(V22_MARKER+":"+entry.role);
  restored.push({setId:entry.setId,componentName:entry.componentName,role:entry.role,before,after,hidden,retried});
  if(hidden)node.visible=false;
}
if(restored.length!==256)throw new Error("INPUT-V22-RESTORE-COUNT:"+restored.length);
if(restored.some(entry=>entry.after!=="FILL"))throw new Error("INPUT-V22-RESTORE-NOT-FILL");
return{pageId:page.id,setIds:[...sets.map(set=>set.id)].sort(),restoredCount:restored.length,fixedBefore:restored.filter(entry=>entry.before==="FIXED").length,hiddenRevealedForFill:restored.filter(entry=>entry.hidden).length,retriedForFill:restored.filter(entry=>entry.retried).length,contentFillAfter:true,marker:V22_MARKER};
`;
}

export function validateInputLiveV22RestorePayload(
  payload: unknown,
  writer: InputLiveV22RestoreWriter,
): InputLiveV22RestorePayload {
  if (payload === null || typeof payload !== "object")
    throw new TypeError("Input live v22 restore payload must be an object");
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
    value.marker !== INPUT_LIVE_V22_MEASURE_VISIBLE_FILL_MARKER
  )
    throw new TypeError(
      "Input live v22 restore did not re-assert content FILL",
    );
  return value as InputLiveV22RestorePayload;
}
