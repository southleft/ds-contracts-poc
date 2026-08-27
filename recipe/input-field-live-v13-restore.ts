import { canonicalJson } from "./normalize.js";

export const V12_WRITER_PROGRAM_SHA256 =
  "a01d95b3b2a46999d4228814101d5e8b19ef35bb0f0b9113b1d9d438e150d6b3";
export const V12_WRITER_PAYLOAD_SHA256 =
  "b091cf61288e21aea4031e7717957e5329f2fb1ec164757b08f1f0d9ea830597";

export const INPUT_LIVE_V13_NAMESPACE = "ds.contracts.input.recipe.v5";
export const INPUT_LIVE_V13_POST_WRITER_FILL_MARKER =
  "INPUT-TEXT-FILL-AFTER-WRITER";
export const INPUT_LIVE_V13_RESTORE_CONTENT_ROLES = [
  "input-field/content/placeholder",
  "input-field/content/value",
] as const;

export interface InputLiveV13RestoreWriter {
  pageId: string;
  runIdentity: string;
  setIds: readonly [string, string];
}

export interface InputLiveV13RestorePayload {
  pageId: string;
  setIds: string[];
  restoredCount: 256;
  fixedBefore: number;
  contentFillAfter: true;
  marker: typeof INPUT_LIVE_V13_POST_WRITER_FILL_MARKER;
}

export function buildInputLiveV13RestoreProgram(
  writer: InputLiveV13RestoreWriter,
): string {
  if (writer.setIds.length !== 2)
    throw new TypeError("Input live v13 restore requires two owned sets");
  return String.raw`
await figma.loadAllPagesAsync();
const V13_NS=${JSON.stringify(INPUT_LIVE_V13_NAMESPACE)};
const V13_PAGE_ID=${JSON.stringify(writer.pageId)};
const V13_SET_IDS=${JSON.stringify([...writer.setIds])};
const V13_ROLES=new Set(${JSON.stringify([...INPUT_LIVE_V13_RESTORE_CONTENT_ROLES])});
const V13_MARKER=${JSON.stringify(INPUT_LIVE_V13_POST_WRITER_FILL_MARKER)};
const page=await figma.getNodeByIdAsync(V13_PAGE_ID);
if(!page||page.type!=="PAGE")throw new Error("INPUT-V13-RESTORE-PAGE");
if(page.getSharedPluginData(V13_NS,"pageOwner")!=="recipe/input-field/"+${JSON.stringify(writer.runIdentity)})throw new Error("INPUT-V13-RESTORE-OWNER");
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>V13_SET_IDS.includes(node.id));
if(sets.length!==2)throw new Error("INPUT-V13-RESTORE-ROOTS:"+sets.length);
const restored=[];
for(const set of sets){
  for(const component of set.children){
    if(component.type!=="COMPONENT")continue;
    for(const descendant of component.findAllWithCriteria({types:["TEXT","FRAME"]})){
      const role=descendant.name.split(" :: ",1)[0];
      if(descendant.type==="TEXT"&&V13_ROLES.has(role)){
        const before=descendant.layoutSizingHorizontal;
        descendant.textAutoResize="HEIGHT";
        descendant.layoutSizingHorizontal="FILL";
        if(descendant.width<=0||descendant.height<=0)throw new Error(V13_MARKER+":"+role);
        restored.push({setId:set.id,componentName:component.name,role,before,after:descendant.layoutSizingHorizontal});
      }
      if(descendant.type==="FRAME"&&role==="input-field/content-row")descendant.layoutSizingHorizontal="FILL";
    }
  }
}
if(restored.length!==256)throw new Error("INPUT-V13-RESTORE-COUNT:"+restored.length);
if(restored.some(entry=>entry.after!=="FILL"))throw new Error("INPUT-V13-RESTORE-NOT-FILL");
return{pageId:page.id,setIds:[...sets.map(set=>set.id)].sort(),restoredCount:restored.length,fixedBefore:restored.filter(entry=>entry.before==="FIXED").length,contentFillAfter:true,marker:V13_MARKER};
`;
}

export function validateInputLiveV13RestorePayload(
  payload: unknown,
  writer: InputLiveV13RestoreWriter,
): InputLiveV13RestorePayload {
  if (payload === null || typeof payload !== "object")
    throw new TypeError("Input live v13 restore payload must be an object");
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
    value.contentFillAfter !== true ||
    value.marker !== INPUT_LIVE_V13_POST_WRITER_FILL_MARKER
  )
    throw new TypeError(
      "Input live v13 restore did not re-assert content FILL",
    );
  return value as InputLiveV13RestorePayload;
}
