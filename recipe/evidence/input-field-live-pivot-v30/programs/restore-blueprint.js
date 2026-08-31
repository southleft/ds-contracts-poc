
await figma.loadAllPagesAsync();
const V30_NS="ds.contracts.input.recipe.v5";
const V30_PAGE_ID="__WRITER_PAGE_ID__";
const V30_SET_IDS=["__MUI_SET_ID__","__POLARIS_SET_ID__"];
const V30_ROLES=new Set(["input-field/content/placeholder","input-field/content/value"]);
const V30_PARENTS=new Set(["input-field/surface","input-field/content-row"]);
const V30_MARKER="INPUT-TEXT-FILL-MEASURE-VISIBLE";
const page=await figma.getNodeByIdAsync(V30_PAGE_ID);
if(!page||page.type!=="PAGE")throw new Error("INPUT-V30-RESTORE-PAGE");
if(page.getSharedPluginData(V30_NS,"pageOwner")!=="recipe/input-field/"+"input-live-v30")throw new Error("INPUT-V30-RESTORE-OWNER");
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>V30_SET_IDS.includes(node.id));
if(sets.length!==2)throw new Error("INPUT-V30-RESTORE-ROOTS:"+sets.length);
const parents=[];
const texts=[];
for(const set of sets){
  for(const component of set.children){
    if(component.type!=="COMPONENT")continue;
    for(const descendant of component.findAllWithCriteria({types:["TEXT","FRAME"]})){
      const role=descendant.name.split(" :: ",1)[0];
      if(descendant.type==="FRAME"&&V30_PARENTS.has(role))parents.push(descendant);
      if(descendant.type==="TEXT"&&V30_ROLES.has(role))texts.push({setId:set.id,componentName:component.name,role,node:descendant});
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
  if(node.width<=0||node.height<=0)throw new Error(V30_MARKER+":"+entry.role);
  restored.push({setId:entry.setId,componentName:entry.componentName,role:entry.role,before,after,hidden,retried});
  if(hidden)node.visible=false;
}
if(restored.length!==256)throw new Error("INPUT-V30-RESTORE-COUNT:"+restored.length);
if(restored.some(entry=>entry.after!=="FILL"))throw new Error("INPUT-V30-RESTORE-NOT-FILL");
return{pageId:page.id,setIds:[...sets.map(set=>set.id)].sort(),restoredCount:restored.length,fixedBefore:restored.filter(entry=>entry.before==="FIXED").length,hiddenRevealedForFill:restored.filter(entry=>entry.hidden).length,retriedForFill:restored.filter(entry=>entry.retried).length,contentFillAfter:true,marker:V30_MARKER};
