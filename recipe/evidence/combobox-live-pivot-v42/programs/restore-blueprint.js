
await figma.loadAllPagesAsync();
const NS="ds.contracts.combobox.recipe.v1";
const PAGE_ID="__WRITER_PAGE_ID__";
const SET_IDS=["__MUI_COMBOBOX_SET_ID__","__MUI_OPTION_SET_ID__","__ANTD_COMBOBOX_SET_ID__","__ANTD_OPTION_SET_ID__"];
const ROLES=new Set(["combobox/input","combobox/option/label"]);
const PARENTS=new Set(["combobox/trigger"]);
const INPUT_SET="combobox/set";
const OPTION_SET="combobox/option-set";
const MARKER="COMBOBOX-TEXT-FILL-MEASURE-VISIBLE";
if(PAGE_ID==="115:295378")throw new Error("COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE");
const page=await figma.getNodeByIdAsync(PAGE_ID);
if(!page||page.type!=="PAGE")throw new Error("COMBOBOX-V8-RESTORE-PAGE");
if(page.id==="115:295378")throw new Error("COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE");
if(page.getSharedPluginData(NS,"pageOwner")!=="recipe/combobox/"+"58ef8274-85b2f4a0-combobox-v1")throw new Error("COMBOBOX-V8-RESTORE-OWNER");
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>SET_IDS.includes(node.id));
if(sets.length!==4)throw new Error("COMBOBOX-V8-RESTORE-ROOTS:"+sets.length);
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
if(restored.length!==144)throw new Error("COMBOBOX-V8-RESTORE-COUNT:"+restored.length);
if(restored.some(entry=>entry.after!=="FILL"))throw new Error("COMBOBOX-V8-RESTORE-NOT-FILL");
return{pageId:page.id,setIds:[...sets.map(set=>set.id)].sort(),restoredCount:restored.length,fixedBefore:restored.filter(entry=>entry.before==="FIXED").length,hiddenRevealedForFill:restored.filter(entry=>entry.hidden).length,retriedForFill:restored.filter(entry=>entry.retried).length,contentFillAfter:true,marker:MARKER};
