
await figma.loadAllPagesAsync();
const NS="ds.contracts.calendar.recipe.v1";
const PAGE_ID="__WRITER_PAGE_ID__";
const SET_IDS=["__ASTRYX_CALENDAR_SET_ID__","__ASTRYX_WEEK_SET_ID__","__ASTRYX_DAY_SET_ID__"];
const ROLES=new Set(["calendar/day/label"]);
const DAY_SET="calendar/day-set";
const MARKER="CALENDAR-TEXT-HUG-MEASURE";
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
if(page.getSharedPluginData(NS,"pageOwner")!=="recipe/calendar/"+"19be1c96-calendar-v25")throw new Error("CALENDAR-V5-RESTORE-OWNER");
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
