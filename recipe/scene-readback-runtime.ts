import { FIGMA_PORTABLE_RUNTIME } from "./figma-runtime-portability.js";

/**
 * Runtime injected into future live verifiers. Plugin data is read only for
 * the opaque ownership key used to join a node to the pre-execution plan.
 * No expected/source IR, role, axis, value, paint, or binding is read from it.
 */
export function buildFigmaSceneReadbackRuntime(namespace: string): string {
  if (!/^[A-Za-z0-9_.]+$/.test(namespace)) {
    throw new TypeError(`invalid scene-readback namespace: ${namespace}`);
  }
  return String.raw`
const SCENE_READBACK_NS=${JSON.stringify(namespace)};
${FIGMA_PORTABLE_RUNTIME}
const sceneRuntimePreflight=runtimePreflight();
const sceneHexByte=value=>Math.round(Math.max(0,Math.min(1,value))*255).toString(16).padStart(2,"0");
const sceneColor=(color,opacity=1)=>"#"+sceneHexByte(color.r)+sceneHexByte(color.g)+sceneHexByte(color.b)+sceneHexByte((color.a===undefined?1:color.a)*opacity);
const sceneRole=node=>{
  const description=typeof node.description==="string"?node.description:"";
  const match=description.match(/(?:^|\n)recipe-role:([^\n]+)/);
  if(match)return match[1];
  return node.name.includes("/")&&!node.name.includes("=")?node.name.split(" :: ",1)[0]:undefined;
};
const scenePaint=paint=>{
  if(paint.type==="SOLID")return{type:"SOLID",color:sceneColor(paint.color,paint.opacity===undefined?1:paint.opacity)};
  if(paint.type==="GRADIENT_LINEAR"||paint.type==="GRADIENT_RADIAL")return{type:paint.type,angle:0,gradientStops:paint.gradientStops.map(stop=>({position:stop.position,color:sceneColor(stop.color)}))};
  if(paint.type==="IMAGE")return{type:"IMAGE",assetRef:paint.imageHash||"unresolved-image",scaleMode:paint.scaleMode};
  throw new Error("UNSUPPORTED-SCENE-PAINT:"+paint.type);
};
const sceneEffect=effect=>{
  const common={type:effect.type,radius:effect.radius,visible:effect.visible!==false};
  if(effect.type==="DROP_SHADOW"||effect.type==="INNER_SHADOW")return{...common,offset:effect.offset,spread:effect.spread||0,color:sceneColor(effect.color)};
  return common;
};
const sceneVariableIdentity=name=>{
  const match=name.match(/^token\/(?:color|float)\/id-([0-9a-f]+)$/);
  if(!match||match[1].length%2!==0)throw new Error("NONREVERSIBLE-SCENE-VARIABLE-NAME:"+name);
  const bytes=new Uint8Array(match[1].match(/../g).map(byte=>parseInt(byte,16)));
  return runtimeDecodeUtf8(bytes,"SCENE-VARIABLE-UTF8").value;
};
const sceneVariable=async(field,alias)=>{
  const variable=alias&&alias.id?await figma.variables.getVariableByIdAsync(alias.id):null;
  if(!variable)throw new Error("UNRESOLVED-SCENE-VARIABLE:"+field);
  return{field,variableName:sceneVariableIdentity(variable.name),resolvedType:variable.resolvedType};
};
const sceneBindings=async node=>{
  const bindings=[];
  for(const [field,alias] of Object.entries(node.boundVariables||{})){
    if(Array.isArray(alias)){for(let index=0;index<alias.length;index++)if(alias[index])bindings.push(await sceneVariable(field+"."+index,alias[index]));}
    else if(alias)bindings.push(await sceneVariable(field,alias));
  }
  for(const [index,paint] of [...(Array.isArray(node.fills)?node.fills:[])] .entries())if(paint.boundVariables&&paint.boundVariables.color)bindings.push(await sceneVariable("fills."+index+".color",paint.boundVariables.color));
  for(const [index,paint] of [...(Array.isArray(node.strokes)?node.strokes:[])] .entries())if(paint.boundVariables&&paint.boundVariables.color)bindings.push(await sceneVariable("strokes."+index+".paint.color",paint.boundVariables.color));
  for(const [index,effect] of [...(Array.isArray(node.effects)?node.effects:[])] .entries())if(effect.boundVariables&&effect.boundVariables.color)bindings.push(await sceneVariable("effects."+index+".color",effect.boundVariables.color));
  return bindings.sort((a,b)=>(a.field+"\0"+a.variableName).localeCompare(b.field+"\0"+b.variableName));
};
const scenePlainProperties=node=>Object.fromEntries(Object.entries(node.componentProperties||{}).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,value.value]));
const sceneVariantProperties=node=>{
  if(node.type!=="COMPONENT")return undefined;
  return Object.fromEntries(node.name.split(",").map(part=>part.trim()).filter(part=>part.includes("=")).map(part=>{const index=part.indexOf("=");return[part.slice(0,index),part.slice(index+1)];}));
};
const sceneInstancePayload=async node=>{
  if(node.type!=="INSTANCE")return undefined;
  const textNodes=node.findAllWithCriteria({types:["TEXT"]}).filter(child=>child.visible!==false);
  const text=textNodes.map(child=>child.characters);
  const assetNodes=node.findAll().filter(child=>["VECTOR","BOOLEAN_OPERATION","STAR","POLYGON","ELLIPSE","RECTANGLE"].includes(child.type));
  const assets=assetNodes.map(child=>child.name);
  const main=await node.getMainComponentAsync();
  const description=main&&typeof main.description==="string"?main.description:"";
  const sourceMatch=description.match(/(?:^|\n)adornment-source:([^\n]+)/);
  const accessibilityMatch=description.match(/(?:^|\n)adornment-accessibility:([^\n]+)/);
  const firstText=textNodes[0];
  const content=assets.length>0?{kind:"glyph",text:text[0]||"",assetRef:assets[0]}:{kind:"text",text:text[0]||""};
  const provenanceMatch=firstText&&firstText.name.match(/ :: font-provenance=([^\n]+)/);
  const fontProvenance=provenanceMatch?JSON.parse(decodeURIComponent(provenanceMatch[1])):undefined;
  const typography=firstText?{fontFamily:firstText.fontName.family,fontStyle:firstText.fontName.style,...(fontProvenance?{fontProvenance}:{}),fontSize:firstText.fontSize,lineHeight:firstText.lineHeight.unit==="PIXELS"?{unit:"px",value:firstText.lineHeight.value}:{unit:"auto"}}:undefined;
  const fills=firstText&&Array.isArray(firstText.fills)?firstText.fills.map(scenePaint):[];
  const alignValue=value=>value==="MIN"?"start":value==="MAX"?"end":"center";
  return{text,assets,content,typography,fills,opacity:firstText&&firstText.opacity!==undefined?firstText.opacity:1,intrinsicSize:{width:main?main.width:node.width,height:main?main.height:node.height},padding:{top:main&&"paddingTop" in main?main.paddingTop:0,right:main&&"paddingRight" in main?main.paddingRight:0,bottom:main&&"paddingBottom" in main?main.paddingBottom:0,left:main&&"paddingLeft" in main?main.paddingLeft:0},alignment:{horizontal:alignValue(main&&"primaryAxisAlignItems" in main?main.primaryAxisAlignItems:"CENTER"),vertical:alignValue(main&&"counterAxisAlignItems" in main?main.counterAxisAlignItems:"CENTER")},accessibility:accessibilityMatch?JSON.parse(accessibilityMatch[1]):{relation:"none",decorative:true},source:sourceMatch?sourceMatch[1]:"scene-description-missing"};
};
const sceneIdentityPart=value=>encodeURIComponent(value).replace(/%/g,"~");
const sceneMainComponentRef=async node=>{
  if(node.type!=="INSTANCE")return undefined;
  const main=await node.getMainComponentAsync();
  if(!main)return null;
  const marker=" / ",index=main.name.lastIndexOf(marker);
  return index<0?main.name:main.name.slice(index+marker.length);
};
const sceneDerivedOwnershipKey=(ownerKey,ownerMainRef,lineage)=>ownerKey+"/generated/"+sceneIdentityPart(ownerMainRef)+"/"+lineage.map(step=>step.childIndex+":"+step.occurrence+":"+step.type+":"+(step.mainComponentRef===undefined?"-":sceneIdentityPart(step.mainComponentRef))).join("/");
const readSceneDerivedTree=async(node,expectedPlan,expectedOwner)=>{
  const directKeys=new Set(expectedPlan?(expectedPlan.directOwnershipKeys||expectedPlan.facts.map(fact=>fact.nodeOwnershipKey)):[]);
  const expectedDerived=new Map((expectedPlan&&expectedPlan.generatedDescendants||[]).map(entry=>[entry.ownershipKey,entry]));
  if(expectedDerived.size!==(expectedPlan&&expectedPlan.generatedDescendants||[]).length)throw new Error("SCENE-DERIVED-IDENTITY-PLAN-DUPLICATE");
  const used=new Set();
  const read=async(current,generatedContext)=>{
    const explicit=current.getSharedPluginData(SCENE_READBACK_NS,"ownershipKey");
    let ownershipKey=explicit;
    let currentContext=generatedContext;
    let mainComponentRef;
    if(explicit){
      if(generatedContext)throw new Error("SCENE-GENERATED-DESCENDANT-DIRECT-KEY:"+current.id);
      if(expectedPlan&&!directKeys.has(explicit))throw new Error("SCENE-DIRECT-OWNERSHIP-UNEXPECTED:"+current.id+":"+explicit);
      if(expectedOwner){
        for(const field of ["runIdentity","adapterIdentity","recipeHash","envelopeHash"])if(current.getSharedPluginData(SCENE_READBACK_NS,field)!==expectedOwner[field])throw new Error("SCENE-DIRECT-OWNERSHIP-METADATA:"+current.id+":"+field);
      }
      if(current.type==="INSTANCE"){
        mainComponentRef=await sceneMainComponentRef(current);
        if(!mainComponentRef)throw new Error("SCENE-OWNED-INSTANCE-MAIN-COMPONENT-ABSENT:"+current.id);
        currentContext={ownerKey:explicit,ownerMainRef:mainComponentRef,lineage:[]};
      }
    }else{
      if(!generatedContext)throw new Error("SCENE-OWNERSHIP-KEY-ABSENT:"+current.id);
      if(current.type==="COMPONENT"||current.type==="COMPONENT_SET")throw new Error("SCENE-GENERATED-COMPONENT-DESCENDANT:"+current.id);
      mainComponentRef=await sceneMainComponentRef(current);
      if(current.type==="INSTANCE"&&!mainComponentRef)throw new Error("SCENE-GENERATED-INSTANCE-MAIN-COMPONENT-ABSENT:"+current.id);
      const segment={type:current.type,childIndex:generatedContext.childIndex,occurrence:generatedContext.occurrence,...(mainComponentRef?{mainComponentRef}:{})};
      const lineage=[...generatedContext.lineage,segment];
      ownershipKey=sceneDerivedOwnershipKey(generatedContext.ownerKey,generatedContext.ownerMainRef,lineage);
      const planned=expectedDerived.get(ownershipKey);
      if(!planned||planned.ownedAncestorKey!==generatedContext.ownerKey||planned.ownedAncestorMainComponentRef!==generatedContext.ownerMainRef||JSON.stringify(planned.lineage)!==JSON.stringify(lineage))throw new Error("SCENE-DERIVED-IDENTITY-UNEXPECTED:"+current.id+":"+ownershipKey);
      currentContext={...generatedContext,lineage};
    }
    if(used.has(ownershipKey))throw new Error("SCENE-OWNERSHIP-COLLISION:"+ownershipKey);
    used.add(ownershipKey);
    const snapshot={
      ownershipKey,
      type:current.type,
      name:current.name,
      semanticRole:sceneRole(current),
      width:current.width,
      height:current.height,
      visible:current.visible!==false,
      opacity:current.opacity===undefined?1:current.opacity,
      boundVariables:await sceneBindings(current),
      children:[],
    };
    for(const field of ["layoutMode","layoutSizingHorizontal","layoutSizingVertical","primaryAxisAlignItems","counterAxisAlignItems","itemSpacing","paddingTop","paddingRight","paddingBottom","paddingLeft","minWidth","minHeight","layoutPositioning","x","y","constraints","clipsContent","strokeWeight","strokeAlign","dashPattern","characters","fontName","fontSize","lineHeight","letterSpacing","textCase","textDecoration","textAlignHorizontal","textAlignVertical"]){
      if(field in current&&current[field]!==figma.mixed)snapshot[field]=current[field];
    }
    if(current.type==="TEXT"){const provenance=current.name.match(/ :: font-provenance=([^\n]+)/);if(provenance)snapshot.fontProvenance=JSON.parse(decodeURIComponent(provenance[1]));}
    if(Array.isArray(current.fills))snapshot.fills=current.fills.map(scenePaint);
    if(Array.isArray(current.strokes))snapshot.strokes=current.strokes.map(scenePaint);
    if(Array.isArray(current.effects))snapshot.effects=current.effects.map(sceneEffect);
    if("topLeftRadius" in current)snapshot.cornerRadius={topLeft:current.topLeftRadius,topRight:current.topRightRadius,bottomRight:current.bottomRightRadius,bottomLeft:current.bottomLeftRadius};
    if(current.type==="COMPONENT")snapshot.variantProperties=sceneVariantProperties(current);
    if(current.type==="COMPONENT_SET")snapshot.variantGroupProperties=Object.fromEntries(Object.entries(current.variantGroupProperties).map(([name,axis])=>[name,{values:[...axis.values]}]));
    if(current.type==="INSTANCE"){
      snapshot.componentProperties=scenePlainProperties(current);
      snapshot.componentRef=mainComponentRef===undefined?await sceneMainComponentRef(current):mainComponentRef;
      snapshot.instancePayload=await sceneInstancePayload(current);
    }
    if("children" in current){
      const counts=new Map();
      for(let childIndex=0;childIndex<current.children.length;childIndex++){
        const child=current.children[childIndex],childMainRef=child.type==="INSTANCE"?await sceneMainComponentRef(child):undefined;
        const signature=child.type+"\0"+(childMainRef||""),occurrence=counts.get(signature)||0;
        counts.set(signature,occurrence+1);
        const context=currentContext?{...currentContext,childIndex,occurrence}:null;
        snapshot.children.push(await read(child,context));
      }
    }
    return snapshot;
  };
  const snapshot=await read(node,null);
  const missing=[...expectedDerived.keys()].filter(key=>!used.has(key));
  if(missing.length>0)throw new Error("SCENE-DERIVED-IDENTITY-MISSING:"+missing.join(","));
  return snapshot;
};`;
}
