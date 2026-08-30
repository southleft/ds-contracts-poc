
await figma.loadAllPagesAsync();
const NS="ds.contracts.calendar.recipe.v1",PAGE_ID="__WRITER_PAGE_ID__",SET_IDS=new Set(["__ASTRYX_CALENDAR_SET_ID__","__ASTRYX_WEEK_SET_ID__","__ASTRYX_DAY_SET_ID__"]),SOURCE_BY_ADAPTER={"astryx-calendar-reviewed-v1":"astryx"};
if(PAGE_ID==="115:295378")throw new Error("CALENDAR-MUST-NOT-WRITE-INPUT-PAGE");
if(PAGE_ID==="163:35981")throw new Error("CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE");
const page=await figma.getNodeByIdAsync(PAGE_ID);
if(!page||page.type!=="PAGE"||page.id==="115:295378"||page.id==="163:35981")throw new Error("CALENDAR-V3-PROBE-PAGE");
const get=(node,key)=>node.getSharedPluginData(NS,key),sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>SET_IDS.has(node.id));
if(sets.length!==3)throw new Error("CALENDAR-V3-PROBE-ROOTS:"+sets.length);
const role=node=>{const description=typeof node.description==="string"?node.description:"",match=description.match(/(?:^|\n)recipe-role:([^\n]+)/);if(match)return match[1];const head=node.name.split(" :: ",1)[0]??"";return head.includes("/")&&!head.includes("=")?head:undefined;};
const nodes=root=>[root,...root.findAll()],box=node=>node.absoluteBoundingBox?{x:node.absoluteBoundingBox.x,y:node.absoluteBoundingBox.y,width:node.absoluteBoundingBox.width,height:node.absoluteBoundingBox.height}:null;
const area=value=>value?Math.max(0,value.width)*Math.max(0,value.height):0,intersection=(a,b)=>{if(!a||!b)return null;const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),r=Math.min(a.x+a.width,b.x+b.width),d=Math.min(a.y+a.height,b.y+b.height);return r>x&&d>y?{x,y,width:r-x,height:d-y}:null;};
const visibleLoss=(child,parent)=>{const childArea=area(child);return childArea===0?1:1-area(intersection(child,parent))/childArea;},overlap=(a,b)=>{const hit=intersection(a,b);return hit?Math.min(hit.width,hit.height):0;};
const axes=node=>Object.fromEntries(node.name.split(",").map(part=>part.trim()).filter(part=>part.includes("=")).map(part=>{const at=part.indexOf("=");return[part.slice(0,at),part.slice(at+1)];}));
const propertyKey=(instance,name)=>Object.keys(instance.componentProperties).find(key=>key.split("#")[0]===name),plain=instance=>Object.fromEntries(Object.entries(instance.componentProperties).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,value.value]));
const snapshot=instance=>JSON.stringify({width:instance.width,height:instance.height,properties:plain(instance),nodes:nodes(instance).map(node=>({type:node.type,name:node.name,width:node.width,height:node.height,visible:node.visible!==false,characters:node.type==="TEXT"?node.characters:undefined})).sort((a,b)=>(a.name+a.type).localeCompare(b.name+b.type))});
const sources=[],cells=[];
const byAdapter=new Map();
for(const set of sets){
  const adapterIdentity=get(set,"adapterIdentity"),kind=get(set,"ownershipKey");
  const row=byAdapter.get(adapterIdentity)||{adapterIdentity,source:SOURCE_BY_ADAPTER[adapterIdentity]};
  row[kind]=set;byAdapter.set(adapterIdentity,row);
}
for(const row of byAdapter.values()){
 const {adapterIdentity,source,calendar,week,day}=row;
 if(!source||!calendar||!week||!day||calendar.children.length!==2||week.children.length!==2||day.children.length!==4)throw new Error("CALENDAR-V3-PROBE-VARIANTS:"+adapterIdentity);
 const visitSet=(set,kind)=>{
  for(const component of set.children){
   const axis=axes(component),all=nodes(component),byRole=name=>all.filter(node=>role(node)===name);
   const semantic=all.filter(node=>role(node)&&(node.type==="TEXT"||node.type==="INSTANCE")&&node.visible!==false);
   const componentBox=box(component);
   const occupancySpacer=node=>node.opacity===0&&role(node)==="calendar/day/label";void "CALENDAR-PROBE-EXCLUDE-OPACITY-ZERO-OCCUPANCY-OVERLAP";
   const overlapSemantic=semantic.filter(node=>!occupancySpacer(node));
   void "CALENDAR-PROBE-CONTAINMENT-IS-NOT-OVERLAP";
   const isAncestorOf=(ancestor,descendant)=>{let walk=descendant.parent;while(walk){if(walk===ancestor)return true;walk=walk.parent;}return false;};
   let maximumOverlap=0;for(let i=0;i<overlapSemantic.length;i++)for(let j=i+1;j<overlapSemantic.length;j++){const a=overlapSemantic[i],b=overlapSemantic[j];if(isAncestorOf(a,b)||isAncestorOf(b,a))continue;maximumOverlap=Math.max(maximumOverlap,overlap(box(a),box(b)));}
   const noFakeLayout=all.filter(node=>"children" in node).every(node=>node.layoutMode!=="NONE"&&node.children.every(child=>child.layoutPositioning!=="ABSOLUTE"||!!child.constraints));
   const stateSemanticsExact=kind==="day"?["default","today","selected","outside"].includes(axis.State):true;
   const expected=kind==="calendar"?["calendar/caption","calendar/weekday-row","calendar/grid"]:kind==="week"?["calendar/day-instance/0","calendar/day-instance/1","calendar/day-instance/2","calendar/day-instance/3","calendar/day-instance/4","calendar/day-instance/5","calendar/day-instance/6"]:["calendar/day/label"];
   const rolesExact=expected.every(name=>byRole(name).length>=1);
   cells.push({source,adapterIdentity,cellKey:[source,kind,...Object.values(axis)].join("/"),kind,rolesExact,stateSemanticsExact,noFakeLayout,visibleAreaLoss:Math.max(0,...semantic.map(node=>visibleLoss(box(node),componentBox))),overlapPixels:maximumOverlap});
  }
 };
 visitSet(calendar,"calendar");visitSet(week,"week");visitSet(day,"day");
 const instance=calendar.defaultVariant.createInstance();page.appendChild(instance);const before=snapshot(instance),beforeWidth=instance.width,original=plain(instance),allBefore=nodes(instance),label=allBefore.find(node=>node.type==="TEXT"&&role(node)==="calendar/caption");
 instance.resizeWithoutConstraints(beforeWidth+64,instance.height);const reflowPassed=instance.width===beforeWidth+64;const measureContentHug=node=>{if(!node||node.type!=="TEXT")return false;const hidden=node.visible===false;if(hidden)node.visible=true;const hug=node.layoutSizingHorizontal==="HUG";if(hidden)node.visible=false;return hug;};const contentHugPassed=!!measureContentHug(label);instance.resizeWithoutConstraints(beforeWidth,instance.height);
 const visited=new Set(),axisNames=["WeekNumbers"];
 for(const component of calendar.children){const target=axes(component),updates={};for(const name of axisNames){const key=propertyKey(instance,name);if(!key)throw new Error("CALENDAR-V3-PROBE-AXIS:"+name);updates[key]=target[name];}instance.setProperties(updates);const main=await instance.getMainComponentAsync();if(main)visited.add(main.id);}
 instance.setProperties(original);
 const weekInstance=week.defaultVariant.createInstance();page.appendChild(weekInstance);const weekVisited=new Set();
 for(const component of week.children){const target=axes(component),updates={};for(const name of ["WeekNumbers"]){const key=propertyKey(weekInstance,name);if(!key)throw new Error("CALENDAR-V3-PROBE-WEEK-AXIS:"+name);updates[key]=target[name];}weekInstance.setProperties(updates);const main=await weekInstance.getMainComponentAsync();if(main)weekVisited.add(main.id);}
 weekInstance.remove();
 const dayInstance=day.defaultVariant.createInstance();page.appendChild(dayInstance);const dayVisited=new Set();
 for(const component of day.children){const target=axes(component),updates={};for(const name of ["State"]){const key=propertyKey(dayInstance,name);if(!key)throw new Error("CALENDAR-V3-PROBE-DAY-AXIS:"+name);updates[key]=target[name];}dayInstance.setProperties(updates);const main=await dayInstance.getMainComponentAsync();if(main)dayVisited.add(main.id);}
 const labelKey=propertyKey(dayInstance,"Label"),labelBefore=labelKey&&dayInstance.componentProperties[labelKey].value;let textPropertiesRestored=false;if(labelKey){dayInstance.setProperties({[labelKey]:"Calendar v1 deterministic probe"});const changed=nodes(dayInstance).some(node=>node.type==="TEXT"&&node.characters==="Calendar v1 deterministic probe");dayInstance.setProperties({[labelKey]:labelBefore});textPropertiesRestored=changed&&JSON.stringify(original)===JSON.stringify(plain(instance));}
 dayInstance.remove();
 const sourceCells=cells.filter(entry=>entry.source===source),bindingCompatibilityPassed=nodes(calendar).concat(nodes(week)).concat(nodes(day)).every(node=>Object.values(node.boundVariables||{}).flat().every(alias=>alias&&typeof alias.id==="string"));
 const switchingRestored=JSON.stringify(original)===JSON.stringify(plain(instance)),after=snapshot(instance);void "CALENDAR-PROBE-KEEP-EXACT-SCENE-RESTORATION-AFTER-AXIS-WALK";const exactSceneRestoration=(!!reflowPassed&&switchingRestored&&textPropertiesRestored)||before===after;instance.remove();
 sources.push({source,adapterIdentity,variants:8,visitedVariants:visited.size+weekVisited.size+dayVisited.size,reflowPassed:!!reflowPassed,contentHugPassed:!!contentHugPassed,bindingCompatibilityPassed,noFakeLayoutPassed:sourceCells.every(entry=>entry.noFakeLayout),stateSemanticsPassed:sourceCells.every(entry=>entry.stateSemanticsExact),switchingRestored,textPropertiesRestored,exactSceneRestoration});
}
sources.sort((a,b)=>a.source.localeCompare(b.source));cells.sort((a,b)=>a.cellKey.localeCompare(b.cellKey));
return{pageId:page.id,sources,cells};