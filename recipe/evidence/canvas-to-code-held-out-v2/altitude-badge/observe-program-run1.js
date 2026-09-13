const __observe=async()=>{
await figma.loadAllPagesAsync();
if(figma.fileKey!=="y83n4o9LOGs74oAoguFcGS")throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!=="Altitude Design System")throw new Error("WRONG-NAME:"+figma.root.name);
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR:"+figma.editorType);
const page=await figma.getNodeByIdAsync("6587:47476");
if(!page||page.type!=="PAGE")throw new Error("PAGE-ABSENT:"+"6587:47476");
if(page.name!=="🛠 Badge")throw new Error("PAGE-NAME-MISMATCH:"+page.name);
const set=await figma.getNodeByIdAsync("3538:35772");
if(!set||set.type!=="COMPONENT_SET")throw new Error("SET-ABSENT:"+"3538:35772");
if(set.name!=="Badge")throw new Error("SET-NAME-MISMATCH:"+set.name);
let owner=set.parent;while(owner&&owner.type!=="PAGE")owner=owner.parent;
if(!owner||owner.id!==page.id)throw new Error("SET-NOT-ON-PAGE:"+(owner?owner.id:"none"));
const SUPPORTED=new Set(["FRAME","TEXT","RECTANGLE","ELLIPSE","VECTOR","INSTANCE","COMPONENT","COMPONENT_SET"]);
const hex=value=>Math.round(Math.max(0,Math.min(1,value))*255).toString(16).padStart(2,"0");
const color=(paintColor,opacity=1)=>"#"+hex(paintColor.r)+hex(paintColor.g)+hex(paintColor.b)+hex((paintColor.a===undefined?1:paintColor.a)*opacity);
const paint=item=>{
  if(item.type==="SOLID")return{type:"SOLID",color:color(item.color,item.opacity===undefined?1:item.opacity)};
  if(item.type==="GRADIENT_LINEAR"||item.type==="GRADIENT_RADIAL")return{type:item.type,angle:0,gradientStops:(item.gradientStops||[]).map(stop=>({position:stop.position,color:color(stop.color)}))};
  if(item.type==="IMAGE")return{type:"IMAGE",assetRef:item.imageHash||"unresolved-image",scaleMode:item.scaleMode};
  throw new Error("UNSUPPORTED-SCENE-PAINT:"+item.type);
};
const effect=item=>{
  const common={type:item.type,radius:item.radius,visible:item.visible!==false};
  if(item.type==="DROP_SHADOW"||item.type==="INNER_SHADOW")return{...common,offset:item.offset,spread:item.spread||0,color:color(item.color)};
  return common;
};
const variableOf=async id=>{const v=await figma.variables.getVariableByIdAsync(id);if(!v)throw new Error("UNRESOLVED-SCENE-VARIABLE:"+id);return v;};
const bindings=async node=>{
  const out=[];
  for(const [field,alias] of Object.entries(node.boundVariables||{})){
    if(Array.isArray(alias)){
      for(let index=0;index<alias.length;index++){
        if(!alias[index]||!alias[index].id)continue;
        const variable=await variableOf(alias[index].id);
        out.push({field:field+"."+index,variableName:variable.name,resolvedType:variable.resolvedType});
      }
    }else if(alias&&alias.id){
      const variable=await variableOf(alias.id);
      out.push({field,variableName:variable.name,resolvedType:variable.resolvedType});
    }
  }
  const paintLists=[["fills",node.fills,"color"],["strokes",node.strokes,"paint.color"],["effects",node.effects,"color"]];
  for(const [listName,list,suffix] of paintLists){
    for(const [index,item] of [...(Array.isArray(list)?list:[])].entries()){
      if(item.boundVariables&&item.boundVariables.color&&item.boundVariables.color.id){
        const variable=await variableOf(item.boundVariables.color.id);
        out.push({field:listName+"."+index+"."+suffix,variableName:variable.name,resolvedType:variable.resolvedType});
      }
    }
  }
  return out.sort((a,b)=>(a.field+"|"+a.variableName).localeCompare(b.field+"|"+b.variableName));
};
const variantProps=name=>Object.fromEntries((name||"").split(",").map(part=>part.trim()).filter(part=>part.includes("=")).map(part=>{const at=part.indexOf("=");return[part.slice(0,at),part.slice(at+1)];}));
const snapshot=async(node,walkChildren,pathIds)=>{
  if(!SUPPORTED.has(node.type))throw new Error("UNSUPPORTED-SCENE-NODE-TYPE:"+node.type+"@"+node.id+" ("+pathIds.concat(node.id).join(">")+")");
  const row={
    ownershipKey:"pending",
    type:node.type,
    name:node.name,
    width:node.width,
    height:node.height,
    visible:node.visible!==false,
    opacity:node.opacity===undefined?1:node.opacity,
    boundVariables:await bindings(node),
    children:[]
  };
  for(const field of ["layoutMode","layoutSizingHorizontal","layoutSizingVertical","primaryAxisAlignItems","counterAxisAlignItems","itemSpacing","paddingTop","paddingRight","paddingBottom","paddingLeft","minWidth","minHeight","layoutPositioning","x","y","constraints","clipsContent","strokeWeight","strokeAlign","dashPattern","characters","fontName","fontSize","lineHeight","letterSpacing","textCase","textDecoration","textAlignHorizontal","textAlignVertical"]){
    if(field in node&&node[field]!==figma.mixed)row[field]=node[field];
  }
  if(Array.isArray(node.fills))row.fills=node.fills.map(paint);
  if(Array.isArray(node.strokes))row.strokes=node.strokes.map(paint);
  if(Array.isArray(node.effects))row.effects=node.effects.map(effect);
  if("topLeftRadius" in node)row.cornerRadius={topLeft:node.topLeftRadius,topRight:node.topRightRadius,bottomRight:node.bottomRightRadius,bottomLeft:node.bottomLeftRadius};
  if(node.type==="COMPONENT")row.variantProperties=variantProps(node.name);
  if(node.type==="COMPONENT_SET")row.variantGroupProperties=Object.fromEntries(Object.entries(node.variantGroupProperties).map(([name,axis])=>[name,{values:[...axis.values]}]));
  if(node.type==="INSTANCE"){
    const main=await node.getMainComponentAsync();
    row.componentRef=main?main.name:null;
    row.componentProperties=Object.fromEntries(Object.entries(node.componentProperties||{}).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,value.value]));
  }
  if(walkChildren&&"children" in node){
    for(const child of node.children)row.children.push(await snapshot(child,child.type!=="INSTANCE",pathIds.concat(node.id)));
  }
  return row;
};
const scene=await snapshot(set,true,[]);
const propertyDefinitions=Object.fromEntries(Object.entries(set.componentPropertyDefinitions||{}).map(([key,def])=>[key,{type:def.type,defaultValue:def.defaultValue,variantOptions:def.variantOptions?[...def.variantOptions]:undefined}]));
return{
  writes:0,
  fileKey:figma.fileKey,
  rootName:figma.root.name,
  pageId:page.id,
  pageName:page.name,
  setId:set.id,
  setName:set.name,
  variants:set.children.length,
  propertyDefinitions,
  scene
};
};
const __result=await __observe();
const __body=JSON.stringify({run:1,result:__result});
const __res=await fetch("http://localhost:9231/observe",{method:"POST",headers:{"content-type":"text/plain"},body:__body});
const __ack=await __res.json();
return {posted:__res.ok,run:1,writes:__result.writes,variants:__result.variants,bytes:__body.length,sceneSha256:__ack.sceneSha256};