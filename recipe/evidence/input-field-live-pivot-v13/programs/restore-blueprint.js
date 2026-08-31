
await figma.loadAllPagesAsync();
const V13_NS="ds.contracts.input.recipe.v5";
const V13_PAGE_ID="__WRITER_PAGE_ID__";
const V13_SET_IDS=["__MUI_SET_ID__","__POLARIS_SET_ID__"];
const V13_ROLES=new Set(["input-field/content/placeholder","input-field/content/value"]);
const V13_MARKER="INPUT-TEXT-FILL-AFTER-WRITER";
const page=await figma.getNodeByIdAsync(V13_PAGE_ID);
if(!page||page.type!=="PAGE")throw new Error("INPUT-V13-RESTORE-PAGE");
if(page.getSharedPluginData(V13_NS,"pageOwner")!=="recipe/input-field/"+"input-live-v13")throw new Error("INPUT-V13-RESTORE-OWNER");
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
