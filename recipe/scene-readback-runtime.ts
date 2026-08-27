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
const readSceneDerivedTree=async node=>{
  const ownershipKey=node.getSharedPluginData(SCENE_READBACK_NS,"ownershipKey");
  if(!ownershipKey)throw new Error("SCENE-OWNERSHIP-KEY-ABSENT:"+node.id);
  const snapshot={
    ownershipKey,
    type:node.type,
    name:node.name,
    semanticRole:sceneRole(node),
    width:node.width,
    height:node.height,
    visible:node.visible!==false,
    opacity:node.opacity===undefined?1:node.opacity,
    boundVariables:await sceneBindings(node),
    children:[],
  };
  for(const field of ["layoutMode","layoutSizingHorizontal","layoutSizingVertical","primaryAxisAlignItems","counterAxisAlignItems","itemSpacing","paddingTop","paddingRight","paddingBottom","paddingLeft","minWidth","minHeight","layoutPositioning","x","y","constraints","clipsContent","strokeWeight","strokeAlign","dashPattern","characters","fontName","fontSize","lineHeight","letterSpacing","textCase","textDecoration","textAlignHorizontal","textAlignVertical"]){
    if(field in node&&node[field]!==figma.mixed)snapshot[field]=node[field];
  }
  if(node.type==="TEXT"){const provenance=node.name.match(/ :: font-provenance=([^\n]+)/);if(provenance)snapshot.fontProvenance=JSON.parse(decodeURIComponent(provenance[1]));}
  if(Array.isArray(node.fills))snapshot.fills=node.fills.map(scenePaint);
  if(Array.isArray(node.strokes))snapshot.strokes=node.strokes.map(scenePaint);
  if(Array.isArray(node.effects))snapshot.effects=node.effects.map(sceneEffect);
  if("topLeftRadius" in node)snapshot.cornerRadius={topLeft:node.topLeftRadius,topRight:node.topRightRadius,bottomRight:node.bottomRightRadius,bottomLeft:node.bottomLeftRadius};
  if(node.type==="COMPONENT")snapshot.variantProperties=sceneVariantProperties(node);
  if(node.type==="COMPONENT_SET")snapshot.variantGroupProperties=Object.fromEntries(Object.entries(node.variantGroupProperties).map(([name,axis])=>[name,{values:[...axis.values]}]));
  if(node.type==="INSTANCE"){
    const main=await node.getMainComponentAsync();
    snapshot.componentProperties=scenePlainProperties(node);
    snapshot.componentRef=main?main.name.split(" / ").at(-1):null;
    snapshot.instancePayload=await sceneInstancePayload(node);
  }
  if("children" in node)snapshot.children=await Promise.all(node.children.map(readSceneDerivedTree));
  return snapshot;
};`;
}
