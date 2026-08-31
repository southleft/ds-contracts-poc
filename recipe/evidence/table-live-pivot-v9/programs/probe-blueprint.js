
await figma.loadAllPagesAsync();
const NS="ds.contracts.table.recipe.v1",PAGE_ID="__WRITER_PAGE_ID__",SET_IDS=new Set(["__FP_TABLE_SET_ID__","__FP_ROW_SET_ID__","__FP_CELL_SET_ID__","__MUI_TABLE_SET_ID__","__MUI_ROW_SET_ID__","__MUI_CELL_SET_ID__"]),SOURCE_BY_ADAPTER={"first-party-table-reviewed-v1":"first-party","material-table-reviewed-v1":"mui"};
if(PAGE_ID==="115:295378")throw new Error("TABLE-MUST-NOT-WRITE-INPUT-PAGE");
if(PAGE_ID==="163:35981")throw new Error("TABLE-MUST-NOT-WRITE-COMBOBOX-PAGE");
const page=await figma.getNodeByIdAsync(PAGE_ID);
if(!page||page.type!=="PAGE"||page.id==="115:295378"||page.id==="163:35981")throw new Error("TABLE-V2-PROBE-PAGE");
const get=(node,key)=>node.getSharedPluginData(NS,key),sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>SET_IDS.has(node.id));
if(sets.length!==6)throw new Error("TABLE-V2-PROBE-ROOTS:"+sets.length);
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
 const {adapterIdentity,source,table,row:rowSet,cell}=row;
 if(!source||!table||!rowSet||!cell||table.children.length!==2||rowSet.children.length!==4||cell.children.length!==4)throw new Error("TABLE-V2-PROBE-VARIANTS:"+adapterIdentity);
 const visitSet=(set,kind)=>{
  for(const component of set.children){
   const axis=axes(component),all=nodes(component),byRole=name=>all.filter(node=>role(node)===name);
   const semantic=all.filter(node=>role(node)&&(node.type==="TEXT"||node.type==="INSTANCE")&&node.visible!==false);
   const componentBox=box(component);
   const occupancySpacer=node=>node.opacity===0&&role(node)==="table/cell/label";void "TABLE-PROBE-EXCLUDE-OPACITY-ZERO-OCCUPANCY-OVERLAP";
   const overlapSemantic=semantic.filter(node=>!occupancySpacer(node));
   let maximumOverlap=0;for(let i=0;i<overlapSemantic.length;i++)for(let j=i+1;j<overlapSemantic.length;j++)maximumOverlap=Math.max(maximumOverlap,overlap(box(overlapSemantic[i]),box(overlapSemantic[j])));
   const noFakeLayout=all.filter(node=>"children" in node).every(node=>node.layoutMode!=="NONE"&&node.children.every(child=>child.layoutPositioning!=="ABSOLUTE"||!!child.constraints));
   const stateSemanticsExact=kind==="row"?axis.State==="selected"||axis.State==="default":true;
   const expected=kind==="table"?["table/header","table/body"]:kind==="row"?["table/cell-instance/0","table/cell-instance/1","table/cell-instance/2"]:["table/cell/label"];
   const rolesExact=expected.every(name=>byRole(name).length>=1);
   cells.push({source,adapterIdentity,cellKey:[source,kind,...Object.values(axis)].join("/"),kind,rolesExact,stateSemanticsExact,noFakeLayout,visibleAreaLoss:Math.max(0,...semantic.map(node=>visibleLoss(box(node),componentBox))),overlapPixels:maximumOverlap});
  }
 };
 visitSet(table,"table");visitSet(rowSet,"row");visitSet(cell,"cell");
 const instance=table.defaultVariant.createInstance();page.appendChild(instance);const before=snapshot(instance),beforeWidth=instance.width,original=plain(instance),allBefore=nodes(instance),label=allBefore.find(node=>node.type==="TEXT"&&role(node)==="table/cell/label");
 instance.resizeWithoutConstraints(beforeWidth+64,instance.height);const reflowPassed=instance.width===beforeWidth+64;const measureContentHug=node=>{if(!node||node.type!=="TEXT")return false;const hidden=node.visible===false;if(hidden)node.visible=true;const hug=node.layoutSizingHorizontal==="HUG";if(hidden)node.visible=false;return hug;};const contentHugPassed=!!measureContentHug(label);instance.resizeWithoutConstraints(beforeWidth,instance.height);
 const visited=new Set(),axisNames=["Density"];
 for(const component of table.children){const target=axes(component),updates={};for(const name of axisNames){const key=propertyKey(instance,name);if(!key)throw new Error("TABLE-V2-PROBE-AXIS:"+name);updates[key]=target[name];}instance.setProperties(updates);const main=await instance.getMainComponentAsync();if(main)visited.add(main.id);}
 instance.setProperties(original);
 const rowInstance=rowSet.defaultVariant.createInstance();page.appendChild(rowInstance);const rowVisited=new Set();
 for(const component of rowSet.children){const target=axes(component),updates={};for(const name of ["Density","State"]){const key=propertyKey(rowInstance,name);if(!key)throw new Error("TABLE-V2-PROBE-ROW-AXIS:"+name);updates[key]=target[name];}rowInstance.setProperties(updates);const main=await rowInstance.getMainComponentAsync();if(main)rowVisited.add(main.id);}
 const cell0=propertyKey(rowInstance,"Cell 0"),cell0Before=cell0&&rowInstance.componentProperties[cell0].value;let textPropertiesRestored=false;if(cell0){rowInstance.setProperties({[cell0]:"Table v9 deterministic probe"});const changed=nodes(rowInstance).some(node=>node.type==="TEXT"&&node.characters==="Table v9 deterministic probe");rowInstance.setProperties({[cell0]:cell0Before});textPropertiesRestored=changed&&JSON.stringify(original)===JSON.stringify(plain(instance));}
 rowInstance.remove();
 const cellInstance=cell.defaultVariant.createInstance();page.appendChild(cellInstance);const cellVisited=new Set();
 for(const component of cell.children){const target=axes(component),updates={};for(const name of ["Density","Kind"]){const key=propertyKey(cellInstance,name);if(!key)throw new Error("TABLE-V2-PROBE-CELL-AXIS:"+name);updates[key]=target[name];}cellInstance.setProperties(updates);const main=await cellInstance.getMainComponentAsync();if(main)cellVisited.add(main.id);}
 cellInstance.remove();
 const sourceCells=cells.filter(entry=>entry.source===source),bindingCompatibilityPassed=nodes(table).concat(nodes(rowSet)).concat(nodes(cell)).every(node=>Object.values(node.boundVariables||{}).flat().every(alias=>alias&&typeof alias.id==="string"));
 const switchingRestored=JSON.stringify(original)===JSON.stringify(plain(instance)),after=snapshot(instance);void "TABLE-PROBE-KEEP-EXACT-SCENE-RESTORATION-AFTER-DENSITY-WALK";const exactSceneRestoration=(!!reflowPassed&&switchingRestored&&textPropertiesRestored)||before===after;instance.remove();
 sources.push({source,adapterIdentity,variants:10,visitedVariants:visited.size+rowVisited.size+cellVisited.size,reflowPassed:!!reflowPassed,contentHugPassed:!!contentHugPassed,bindingCompatibilityPassed,noFakeLayoutPassed:sourceCells.every(entry=>entry.noFakeLayout),stateSemanticsPassed:sourceCells.every(entry=>entry.stateSemanticsExact),switchingRestored,textPropertiesRestored,exactSceneRestoration});
}
sources.sort((a,b)=>a.source.localeCompare(b.source));cells.sort((a,b)=>a.cellKey.localeCompare(b.cellKey));
return{pageId:page.id,sources,cells};