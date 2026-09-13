/**
 * Observe program for the canvas→code held-out exam v2 — designer-drawn
 * substrates in files this repository never wrote.
 *
 * Built from `buildButtonSceneObserveProgram` (recipe/button-scene-inversion.ts)
 * with the Scratch/Button preconditions replaced by the subject's own file, page
 * and set identity. It is READ-ONLY by construction: `assertReadOnlyProgram`
 * refuses any program text that names a mutating Plugin API, and the program
 * returns `writes: 0` alongside the scene.
 *
 * Differences from the Button program, each on purpose:
 * - `UNSUPPORTED-SCENE-NODE-TYPE` — a node outside the SceneNodeType union that
 *   is not instance-internal is refused BY NAME (LINE, REGULAR_POLYGON, GROUP,
 *   SLOT, BOOLEAN_OPERATION…). The Button program's else-branch would have let
 *   `sceneToNormalizedIr` project such a node as an ellipse "shape" silently.
 * - `propertyDefinitions` are returned so BOOLEAN / TEXT / INSTANCE_SWAP props
 *   (which `SceneNodeSnapshot` cannot carry) are named in the receipt rather
 *   than dropped.
 * - variable names are the designer's own, verbatim; nothing decodes them.
 */
import type { HeldOutSubject } from "./canvas-to-code-held-out-v2-manifest.js";

export const SUPPORTED_SCENE_NODE_TYPES = [
  "FRAME",
  "TEXT",
  "RECTANGLE",
  "ELLIPSE",
  "VECTOR",
  "INSTANCE",
  "COMPONENT",
  "COMPONENT_SET",
] as const;

/** Plugin API calls that write. A program containing any of these is refused. */
export const MUTATING_PLUGIN_API_PATTERNS: readonly RegExp[] = [
  /figma\.create[A-Z]\w*/,
  /\.remove\s*\(/,
  /\.appendChild\s*\(/,
  /\.insertChild\s*\(/,
  /\.setPluginData\s*\(/,
  /\.setSharedPluginData\s*\(/,
  /\.resize(?:WithoutConstraints)?\s*\(/,
  /\.rescale\s*\(/,
  /figma\.currentPage\s*=/,
  /\.clone\s*\(/,
  /figma\.variables\.create\w*/,
  /\.setBoundVariable\w*\s*\(/,
  // Property writes on a scene node. The program's own `row` object is exempt:
  // it is a plain object the snapshot builds, not a node.
  /(?<!\brow)\.fills\s*=[^=]/,
  /(?<!\brow)\.strokes\s*=[^=]/,
  /(?<!\brow)\.characters\s*=[^=]/,
  /(?<!\brow)\.name\s*=[^=]/,
  /figma\.commitUndo/,
  /figma\.closePlugin/,
];

export function assertReadOnlyProgram(code: string): void {
  const hits = MUTATING_PLUGIN_API_PATTERNS.filter((pattern) => pattern.test(code));
  if (hits.length > 0)
    throw new Error(
      `held-out observe program is not read-only: ${hits
        .map((pattern) => pattern.source)
        .join(", ")}`,
    );
}

export function buildHeldOutObserveProgram(subject: HeldOutSubject): string {
  if (!/^\d+:\d+$/.test(subject.setNodeId))
    throw new TypeError(`invalid set node id ${subject.setNodeId}`);
  if (!/^\d+:\d+$/.test(subject.pageId))
    throw new TypeError(`invalid page id ${subject.pageId}`);
  const code = String.raw`
await figma.loadAllPagesAsync();
if(figma.fileKey!==${JSON.stringify(subject.fileKey)})throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!==${JSON.stringify(subject.fileName)})throw new Error("WRONG-NAME:"+figma.root.name);
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR:"+figma.editorType);
const page=await figma.getNodeByIdAsync(${JSON.stringify(subject.pageId)});
if(!page||page.type!=="PAGE")throw new Error("PAGE-ABSENT:"+${JSON.stringify(subject.pageId)});
if(page.name!==${JSON.stringify(subject.pageName)})throw new Error("PAGE-NAME-MISMATCH:"+page.name);
const set=await figma.getNodeByIdAsync(${JSON.stringify(subject.setNodeId)});
if(!set||set.type!=="COMPONENT_SET")throw new Error("SET-ABSENT:"+${JSON.stringify(subject.setNodeId)});
if(set.name!==${JSON.stringify(subject.setName)})throw new Error("SET-NAME-MISMATCH:"+set.name);
let owner=set.parent;while(owner&&owner.type!=="PAGE")owner=owner.parent;
if(!owner||owner.id!==page.id)throw new Error("SET-NOT-ON-PAGE:"+(owner?owner.id:"none"));
const SUPPORTED=new Set(${JSON.stringify(SUPPORTED_SCENE_NODE_TYPES)});
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
};`;
  assertReadOnlyProgram(code);
  return code;
}
