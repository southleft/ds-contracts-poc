
await figma.loadAllPagesAsync();
const NS="ds.contracts.combobox.recipe.v1",PAGE_ID="__WRITER_PAGE_ID__",SET_IDS=new Set(["__MUI_COMBOBOX_SET_ID__","__MUI_OPTION_SET_ID__","__ANTD_COMBOBOX_SET_ID__","__ANTD_OPTION_SET_ID__"]),SOURCE_BY_ADAPTER={"material-combobox-reviewed-v1":"mui","commerce-combobox-reviewed-v1":"antd"};
if(PAGE_ID==="115:295378")throw new Error("COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE");
const page=await figma.getNodeByIdAsync(PAGE_ID);
if(!page||page.type!=="PAGE"||page.id==="115:295378")throw new Error("COMBOBOX-V6-PROBE-PAGE");
const get=(node,key)=>node.getSharedPluginData(NS,key),sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>SET_IDS.has(node.id));
if(sets.length!==4)throw new Error("COMBOBOX-V6-PROBE-ROOTS:"+sets.length);
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
 const {adapterIdentity,source,combobox,option}=row;
 if(!source||!combobox||!option||combobox.children.length!==64||option.children.length!==8)throw new Error("COMBOBOX-V6-PROBE-VARIANTS:"+adapterIdentity);
 const visitSet=(set,kind)=>{
  for(const component of set.children){
   const axis=axes(component),all=nodes(component),byRole=name=>all.filter(node=>role(node)===name);
   const semantic=all.filter(node=>role(node)&&(node.type==="TEXT"||node.type==="INSTANCE")&&node.visible!==false);
   const componentBox=box(component);
   const overlay=all.find(node=>role(node)==="combobox/overlay");void "COMBOBOX-PROBE-EXCLUDE-OVERLAY-AABB";
   const clipSemantic=semantic.filter(node=>!(overlay&&(node===overlay||overlay.findAll&&overlay.findAll().includes(node)||role(node)==="combobox/listbox"||role(node)==="combobox/listbox/empty"||role(node)==="combobox/listbox/loading"||(role(node)||"").startsWith("combobox/option-instance/")||role(node)==="combobox/option/label"&&overlay)));
   const occupancySpacer=node=>node.opacity===0&&(role(node)==="combobox/input"||role(node)==="combobox/option/label"||role(node)==="combobox/listbox/empty"||role(node)==="combobox/listbox/loading");void "COMBOBOX-PROBE-EXCLUDE-OPACITY-ZERO-OCCUPANCY-OVERLAP";
   const overlapSemantic=semantic.filter(node=>!occupancySpacer(node)&&!(overlay&&(node===overlay||(role(node)||"").startsWith("combobox/listbox")||(role(node)||"").startsWith("combobox/option-instance/"))));
   let maximumOverlap=0;for(let i=0;i<overlapSemantic.length;i++)for(let j=i+1;j<overlapSemantic.length;j++)maximumOverlap=Math.max(maximumOverlap,overlap(box(overlapSemantic[i]),box(overlapSemantic[j])));
   const noFakeLayout=all.filter(node=>"children" in node).every(node=>node.layoutMode!=="NONE"&&node.children.every(child=>child.layoutPositioning!=="ABSOLUTE"||!!child.constraints));
   const stateSemanticsExact=kind==="option"?true:(axis["Field state"]==="error"?byRole("combobox/message/error").length===1&&byRole("combobox/message/helper").length===0:byRole("combobox/message/helper").length===1&&byRole("combobox/message/error").length===0);
   const expected=kind==="combobox"?["combobox/label","combobox/trigger","combobox/input"]:[ "combobox/option/label"];
   const rolesExact=expected.every(name=>byRole(name).length>=1);
   cells.push({source,adapterIdentity,cellKey:[source,kind,...Object.values(axis)].join("/"),kind,rolesExact,stateSemanticsExact,noFakeLayout,visibleAreaLoss:Math.max(0,...clipSemantic.map(node=>visibleLoss(box(node),componentBox))),overlapPixels:maximumOverlap});
  }
 };
 visitSet(combobox,"combobox");visitSet(option,"option");
 const instance=combobox.defaultVariant.createInstance();page.appendChild(instance);const before=snapshot(instance),beforeWidth=instance.width,original=plain(instance),allBefore=nodes(instance),trigger=allBefore.find(node=>role(node)==="combobox/trigger"),contentText=allBefore.find(node=>node.type==="TEXT"&&role(node)==="combobox/input"),reflowTarget=contentText,triggerWidth=trigger&&trigger.width,reflowTargetWidth=reflowTarget&&reflowTarget.width;
 instance.resizeWithoutConstraints(beforeWidth+64,instance.height);const reflowPassed=instance.width===beforeWidth+64&&trigger&&trigger.width>triggerWidth&&reflowTarget&&reflowTarget.width>reflowTargetWidth;const measureContentFill=node=>{if(!node||node.type!=="TEXT")return false;const hidden=node.visible===false;if(hidden){void "COMBOBOX-PROBE-MEASURE-HIDDEN-CONTENT-FILL";node.visible=true;}const fill=node.layoutSizingHorizontal==="FILL";if(hidden)node.visible=false;return fill;};const contentFillPassed=!!measureContentFill(contentText);instance.resizeWithoutConstraints(beforeWidth,instance.height);
 const visited=new Set(),axisNames=["Size","Appearance","Open","Field state","Content"];
 for(const component of combobox.children){const target=axes(component),updates={};for(const name of axisNames){const key=propertyKey(instance,name);if(!key)throw new Error("COMBOBOX-V6-PROBE-AXIS:"+name);updates[key]=target[name];}instance.setProperties(updates);const main=await instance.getMainComponentAsync();if(main)visited.add(main.id);}
 instance.setProperties(original);const labelKey=propertyKey(instance,"Label"),labelBefore=labelKey&&instance.componentProperties[labelKey].value;let textPropertiesRestored=false;if(labelKey){instance.setProperties({[labelKey]:"Combobox v1 deterministic probe"});const changed=nodes(instance).some(node=>node.type==="TEXT"&&role(node)==="combobox/label"&&node.characters==="Combobox v1 deterministic probe");instance.setProperties({[labelKey]:labelBefore});textPropertiesRestored=changed&&JSON.stringify(original)===JSON.stringify(plain(instance));}
 const optionInstance=option.defaultVariant.createInstance();page.appendChild(optionInstance);const optionVisited=new Set();
 for(const component of option.children){const target=axes(component),updates={};for(const name of ["Size","Option state"]){const key=propertyKey(optionInstance,name);if(!key)throw new Error("COMBOBOX-V6-PROBE-OPTION-AXIS:"+name);updates[key]=target[name];}optionInstance.setProperties(updates);const main=await optionInstance.getMainComponentAsync();if(main)optionVisited.add(main.id);}
 optionInstance.remove();
 const sourceCells=cells.filter(cell=>cell.source===source),bindingCompatibilityPassed=nodes(combobox).concat(nodes(option)).every(node=>Object.values(node.boundVariables||{}).flat().every(alias=>alias&&typeof alias.id==="string"));
 const switchingRestored=JSON.stringify(original)===JSON.stringify(plain(instance)),after=snapshot(instance);instance.remove();
 sources.push({source,adapterIdentity,variants:72,visitedVariants:visited.size+optionVisited.size,reflowPassed:!!reflowPassed,contentFillPassed:!!contentFillPassed,bindingCompatibilityPassed,noFakeLayoutPassed:sourceCells.every(cell=>cell.noFakeLayout),stateSemanticsPassed:sourceCells.every(cell=>cell.stateSemanticsExact),switchingRestored,textPropertiesRestored,exactSceneRestoration:before===after});
}
sources.sort((a,b)=>a.source.localeCompare(b.source));cells.sort((a,b)=>a.cellKey.localeCompare(b.cellKey));
return{pageId:page.id,sources,cells};