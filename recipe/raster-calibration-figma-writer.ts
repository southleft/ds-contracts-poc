import {
  RECIPE_RASTER_CALIBRATION_CORPUS,
  RECIPE_RASTER_CALIBRATION_CORPUS_HASH,
  RECIPE_RASTER_CALIBRATION_VERSION,
  assertRasterCalibration,
  requiredCalibrationFonts,
  type RecipeRasterCalibration,
} from "./raster-calibration.js";

export const RECIPE_RASTER_CALIBRATION_PAGE = `Recipe Raster Calibration / ${RECIPE_RASTER_CALIBRATION_CORPUS_HASH.slice(0, 12)}`;
export const RECIPE_RASTER_CALIBRATION_NAMESPACE =
  "ds.contracts.recipe.raster_calibration.v1";

export type CalibrationWriterPhase = "baseline" | "calibrated";

export interface CalibrationFigmaWriter {
  phase: CalibrationWriterPhase;
  pageName: typeof RECIPE_RASTER_CALIBRATION_PAGE;
  code: string;
}

const runtime = String.raw`
const EXPECTED_FILE_KEY="byMp6lt0Ij9b2QbkDGFwBh";
const EXPECTED_FILE_NAME="Scratch Project";
if(figma.fileKey!==EXPECTED_FILE_KEY||figma.root.name!==EXPECTED_FILE_NAME||figma.editorType!=="figma")throw new Error("CALIBRATION-WRONG-TARGET");
await figma.loadAllPagesAsync();
const NS=PLAN.namespace,setData=(node,key,value)=>node.setSharedPluginData(NS,key,String(value)),getData=(node,key)=>node.getSharedPluginData(NS,key);
const fonts=await figma.listAvailableFontsAsync();
for(const expected of PLAN.requiredFonts)if(!fonts.some(font=>font.fontName.family===expected.family&&font.fontName.style===expected.style))throw new Error("MISSING-CALIBRATION-FONT:"+expected.family+"/"+expected.style);
let page=figma.root.children.find(candidate=>candidate.name===PLAN.pageName);
if(PLAN.phase==="baseline"&&page)throw new Error("CALIBRATION-PAGE-PREEXISTS:"+page.id);
if(PLAN.phase==="baseline"){page=figma.createPage();page.name=PLAN.pageName;}
if(!page)throw new Error("CALIBRATION-PAGE-ABSENT");
await figma.setCurrentPageAsync(page);
const existing=page.children.filter(node=>node.type==="SECTION"&&getData(node,"phase")===PLAN.phase);
if(existing.length)throw new Error("CALIBRATION-PHASE-PREEXISTS:"+PLAN.phase);
const section=figma.createSection();section.name="Raster calibration / "+PLAN.phase;section.x=PLAN.phase==="baseline"?0:900;section.y=0;page.appendChild(section);setData(section,"phase",PLAN.phase);
const rgba=(hex,opacity=1)=>({r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255,a:opacity});
const paint=(entry)=>{const value=rgba(entry.color,entry.opacity===undefined?1:entry.opacity);return{type:"SOLID",color:{r:value.r,g:value.g,b:value.b},opacity:value.a};};
const calibration=PLAN.calibration;
const helpers=new Map(),createdNodeIds=[page.id,section.id],mutatedNodeIds=[];
const makeHelper=async(ir)=>{
  const key=JSON.stringify([ir.componentRef,ir.characters,ir.width,ir.height]);
  if(helpers.has(key))return helpers.get(key);
  const component=figma.createComponent();component.name="Calibration adornment / "+ir.componentRef+"/"+ir.characters;component.fills=[];
  const label=figma.createText();const font={family:"Inter",style:"Medium"};await figma.loadFontAsync(font);label.fontName=font;label.characters=ir.characters;label.fontSize=11;label.lineHeight={unit:"PIXELS",value:14};label.textAutoResize="WIDTH_AND_HEIGHT";label.textAlignHorizontal="CENTER";label.textAlignVertical="CENTER";
  if(ir.componentRef==="square-adornment"){
    const width=ir.width.mode==="fixed"?ir.width.value:Math.max(label.width+6,14),height=ir.height.mode==="fixed"?ir.height.value:Math.max(label.height,14);
    component.resizeWithoutConstraints(width,height);component.fills=[paint(ir.fill)];component.cornerRadius=3;component.appendChild(label);label.fills=[paint({color:"#ffffff"})];label.constraints={horizontal:"CENTER",vertical:"CENTER"};label.x=(width-label.width)/2;label.y=(height-label.height)/2;
  }else{
    component.layoutMode="HORIZONTAL";component.primaryAxisSizingMode="AUTO";component.counterAxisSizingMode="AUTO";component.primaryAxisAlignItems="CENTER";component.counterAxisAlignItems="CENTER";component.appendChild(label);label.fills=[paint(ir.fill)];
  }
  component.x=-1000;component.y=helpers.size*40;section.appendChild(component);helpers.set(key,component);createdNodeIds.push(component.id,label.id);return component;
};
const sizing=(node,value,axis)=>{
  if(value.mode==="fixed"){
    const width=axis==="width"?value.value:Math.max(node.width,1),height=axis==="height"?value.value:Math.max(node.height,1);
    node.resizeWithoutConstraints(width,height);
  }
  if(axis==="width")node.layoutSizingHorizontal=value.mode==="fill"?"FILL":value.mode==="hug"?"HUG":"FIXED";
  else node.layoutSizingVertical=value.mode==="fill"?"FILL":value.mode==="hug"?"HUG":"FIXED";
};
const styleGeometry=(node,ir)=>{
  if(ir.fill)node.fills=[paint(ir.fill)];
  if(ir.stroke){node.strokes=[paint({color:ir.stroke.color,opacity:ir.stroke.opacity})];node.strokeWeight=ir.stroke.weight;node.strokeAlign="INSIDE";}
  if(ir.radius!==undefined)node.cornerRadius=ir.radius;
  if(ir.effect)node.effects=[{type:"DROP_SHADOW",color:rgba(ir.effect.color,ir.effect.opacity===undefined?1:ir.effect.opacity),offset:{x:0,y:0},radius:0,spread:ir.effect.spread,visible:true,blendMode:"NORMAL"}];
  if(ir.opacity!==undefined)node.opacity=ir.opacity;
};
const render=async(ir,parent)=>{
  let node;
  if(ir.kind==="text"){
    node=figma.createText();const font={family:ir.font.family,style:ir.font.style};await figma.loadFontAsync(font);node.fontName=font;node.characters=ir.characters;node.fontSize=ir.font.size*(calibration?calibration.writer.fontSizeScale:1);node.lineHeight={unit:"PIXELS",value:ir.font.lineHeight*(calibration?calibration.writer.lineHeightScale:1)};node.letterSpacing={unit:"PIXELS",value:calibration?calibration.writer.letterSpacingPx:0};node.textAutoResize=ir.width.mode==="fill"?"HEIGHT":"WIDTH_AND_HEIGHT";node.fills=[paint({color:ir.color})];
  }else if(ir.kind==="rect"){
    node=figma.createRectangle();styleGeometry(node,ir);
  }else if(ir.kind==="instance"){
    const helper=await makeHelper(ir);node=helper.createInstance();node.name=ir.id;
    if(ir.componentRef==="square-adornment")node.fills=[paint(ir.fill)];
    else{node.fills=[];const label=node.findOne(candidate=>candidate.type==="TEXT");if(label)label.fills=[paint(ir.fill)];}
  }else{
    node=figma.createFrame();node.layoutMode=ir.layout.mode.toUpperCase();node.primaryAxisAlignItems=({min:"MIN",center:"CENTER",max:"MAX","space-between":"SPACE_BETWEEN"})[ir.layout.primary];node.counterAxisAlignItems=({min:"MIN",center:"CENTER",max:"MAX"})[ir.layout.counter];node.itemSpacing=ir.layout.gap;node.paddingTop=ir.layout.padding.top;node.paddingRight=ir.layout.padding.right;node.paddingBottom=ir.layout.padding.bottom;node.paddingLeft=ir.layout.padding.left;node.clipsContent=ir.clipsContent===true;styleGeometry(node,ir);
  }
  node.name=ir.id;setData(node,"id",ir.id);setData(node,"kind",ir.kind);parent.appendChild(node);
  if(ir.positioning){node.layoutPositioning="ABSOLUTE";node.x=ir.positioning.x;node.y=ir.positioning.y;setData(node,"positioning","absolute");}
  else setData(node,"positioning","auto");
  if(ir.kind==="frame"){
    for(const child of ir.children)await render(child,node);
    sizing(node,ir.layout.width,"width");sizing(node,ir.layout.height,"height");
    if(ir.layout.mode==="horizontal"){node.primaryAxisSizingMode=ir.layout.width.mode==="hug"?"AUTO":"FIXED";node.counterAxisSizingMode=ir.layout.height.mode==="hug"?"AUTO":"FIXED";}
    if(ir.layout.mode==="vertical"){node.primaryAxisSizingMode=ir.layout.height.mode==="hug"?"AUTO":"FIXED";node.counterAxisSizingMode=ir.layout.width.mode==="hug"?"AUTO":"FIXED";}
  }else{sizing(node,ir.width,"width");if(ir.height)sizing(node,ir.height,"height");}
  createdNodeIds.push(node.id);return node;
};
const box=(node,origin)=>{const value=node.absoluteBoundingBox,base=origin.absoluteBoundingBox;return{x:value.x-base.x,y:value.y-base.y,width:value.width,height:value.height};};
const projection=node=>({id:getData(node,"id"),kind:getData(node,"kind"),positioning:getData(node,"positioning"),children:getData(node,"kind")==="frame"?node.children.filter(child=>getData(child,"id")).map(projection):undefined});
const captures=[];
for(let index=0;index<PLAN.corpus.length;index++){
  const specimen=PLAN.corpus[index];
  const capture=figma.createFrame();capture.name=specimen.id+" / "+PLAN.phase;capture.resizeWithoutConstraints(specimen.capture.width,specimen.capture.height);capture.layoutMode="HORIZONTAL";capture.primaryAxisAlignItems="CENTER";capture.counterAxisAlignItems="CENTER";capture.primaryAxisSizingMode="FIXED";capture.counterAxisSizingMode="FIXED";capture.fills=[paint({color:specimen.capture.background})];capture.clipsContent=false;capture.x=40+(index%2)*370;capture.y=60+Math.floor(index/2)*210;section.appendChild(capture);createdNodeIds.push(capture.id);
  const root=await render(specimen.root,capture);
  const tagged=[root,...root.findAll(candidate=>getData(candidate,"id"))],roles={},texts=[];
  for(const node of tagged){const id=getData(node,"id");roles[id]=box(node,capture);if(node.type==="TEXT")texts.push({id,characters:node.characters,geometry:roles[id],resolvedFamily:node.fontName.family,resolvedStyle:node.fontName.style});}
  const bytes=await capture.exportAsync({format:"PNG",constraint:{type:"SCALE",value:2}});
  const rerun=await capture.exportAsync({format:"PNG",constraint:{type:"SCALE",value:2}});
  captures.push({specimenId:specimen.id,split:specimen.split,frameId:capture.id,root:box(root,capture),roles,text:texts,structureProjection:projection(root),base64:figma.base64Encode(bytes),rerunBase64:figma.base64Encode(rerun)});
}
section.resizeWithoutConstraints(820,Math.ceil(PLAN.corpus.length/2)*210+100);
return{phase:PLAN.phase,fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,sectionId:section.id,createdNodeIds:[...new Set(createdNodeIds)],mutatedNodeIds:[...new Set(mutatedNodeIds)],availableFonts:fonts.map(entry=>entry.fontName),captures};
`;

export function emitCalibrationFigmaWriter(
  phase: CalibrationWriterPhase,
  calibration?: RecipeRasterCalibration,
): CalibrationFigmaWriter {
  if (phase === "baseline" && calibration !== undefined) {
    throw new TypeError("baseline writer cannot consume calibration");
  }
  if (phase === "calibrated") {
    if (calibration === undefined) {
      throw new TypeError("calibrated writer requires explicit calibration");
    }
    assertRasterCalibration(calibration);
  }
  const plan = {
    version: RECIPE_RASTER_CALIBRATION_VERSION,
    phase,
    namespace: RECIPE_RASTER_CALIBRATION_NAMESPACE,
    pageName: RECIPE_RASTER_CALIBRATION_PAGE,
    corpusHash: RECIPE_RASTER_CALIBRATION_CORPUS_HASH,
    requiredFonts: requiredCalibrationFonts(),
    corpus: RECIPE_RASTER_CALIBRATION_CORPUS,
    calibration: calibration ?? null,
  };
  return {
    phase,
    pageName: RECIPE_RASTER_CALIBRATION_PAGE,
    code: `const PLAN=${JSON.stringify(plan)};\n${runtime}`,
  };
}
