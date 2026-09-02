/**
 * THE SHARED FIGMA WRITER RUNTIME — one IR → canvas program for every
 * boilerplate archetype.
 *
 * Until 2026-09-01 each of the thirteen boilerplate writers carried its own
 * copy of this program (≈600 lines each, ≈85% identical), and each copy had
 * lost a different fact: the badge copy never applied `layout.minWidth` or the
 * absolute `offset`; every copy bound a float variable to a PERCENT line-height
 * (which Figma turns into PIXELS of the same number); every copy wrapped a
 * single component in a default 100x100 frame that clips its export. Fixing a
 * defect in one copy fixed one archetype. This module is the fix for all of
 * them, and it is the same program the shipped plugin can execute: a writer is
 * an async plugin body that ends in `return <report>`, which is exactly what
 * the plugin's Paste-a-script verb runs.
 *
 * Two targets, one program:
 *   - "scratch": the developer protocol. Pins the Scratch file, refuses the
 *     signed and preserved pages by id, refuses foreign identities.
 *   - "plugin":  the product path. No file pin, no page list — the program
 *     creates its own page in whatever file the plugin runs in and never
 *     touches an existing page.
 *
 * Everything the IR can say is handled here, and a field the IR carries that
 * this runtime cannot express throws by name instead of being dropped:
 * frames (auto-layout, absolute positioning with constraints and offsets,
 * min sizes, clipping), text (font provenance with a tamper check and a named
 * fallback chain, size, line-height in px/percent/auto, letter-spacing, case,
 * alignment), vectors (paths with winding, caps, joins, rotation, and a bounds
 * guard against the size the recipe computed), paints, strokes, corner radii,
 * effects, opacity, visibility, variable bindings for floats, colours and
 * effect colours, component sets via combineAsVariants, single components in
 * a hugging, non-clipping container, and ownership tags on every node.
 */

export interface ForbiddenPage {
  /** Figma page id, e.g. "115:295378". */
  id: string;
  /** Marker suffix, e.g. "INPUT-PAGE" → `${prefix}-MUST-NOT-WRITE-INPUT-PAGE`. */
  marker: string;
}

export interface ForbiddenIdentity {
  namespace?: string;
  runIdentity?: string;
  /** Marker suffix, e.g. "INPUT-IDENTITY-REUSE". */
  marker: string;
}

export interface WriterRuntimeSpec {
  /** Lowercase archetype name — ownership keys and descriptions ("checkbox"). */
  archetype: string;
  /** Uppercase marker/error prefix ("CHECKBOX"). */
  prefix: string;
  namespace: string;
  writerVersion: number | string;
  target: "scratch" | "plugin";
  /** Variable-collection label ("Recipe Checkbox"). */
  collectionLabel: string;
  /** What the plan's per-source entry carries and how it is minted. */
  mint: { kind: "set" | "component"; field: string };
  forbiddenPages?: ForbiddenPage[];
  forbiddenIdentities?: ForbiddenIdentity[];
  /** The Scratch file pin (scratch target only). */
  scratch?: { fileKey: string; fileName: string };
}

export const SCRATCH_FILE = { fileKey: "byMp6lt0Ij9b2QbkDGFwBh", fileName: "Scratch Project" } as const;

/** The plugin-target report shape, for callers that read the result. */
export interface WriterReport {
  writerVersion: number;
  fileKey: string | null;
  fileName: string;
  pageId: string;
  pageName: string;
  runIdentity: string;
  namespace: string;
  createdNodeIds: string[];
  mutatedNodeIds: string[];
  sources: Array<Record<string, unknown>>;
}

export function figmaWriterRuntime(spec: WriterRuntimeSpec): string {
  const P = spec.prefix;
  const a = spec.archetype;
  const scratch = spec.target === "scratch";
  // The page list and the identity list are the developer protocol for the
  // Scratch file. A plugin run in a user's file has neither: the program only
  // ever creates its own page.
  const pages = scratch ? (spec.forbiddenPages ?? []) : [];
  const identities = scratch ? (spec.forbiddenIdentities ?? []) : [];
  const pin = scratch ? (spec.scratch ?? SCRATCH_FILE) : null;
  const q = (s: string): string => JSON.stringify(s);

  const identityGuards = identities
    .map((f) => {
      const tests: string[] = [];
      if (f.namespace) tests.push(`NS===${q(f.namespace)}`);
      if (f.runIdentity) tests.push(`PLAN.runIdentity===${q(f.runIdentity)}`);
      return tests.length ? `if(${tests.join("||")})throw new Error(${q(`${P}-${f.marker}`)});` : "";
    })
    .filter(Boolean)
    .join("\n");
  const pageMarkers = pages.map((p) => `void ${q(`${P}-MUST-NOT-WRITE-${p.marker}`)};`).join("\n");
  const currentPageGuards = pages
    .map((p) => `if(figma.currentPage&&figma.currentPage.id===${q(p.id)})throw new Error(${q(`${P}-MUST-NOT-WRITE-${p.marker}`)});`)
    .join("\n");
  const createdPageGuards = pages
    .map((p) => `if(page.id===${q(p.id)})throw new Error(${q(`${P}-MUST-NOT-WRITE-${p.marker}`)});`)
    .join("\n");
  const filePin = pin
    ? `const EXPECTED_FILE_KEY=${q(pin.fileKey)},EXPECTED_FILE_NAME=${q(pin.fileName)};
if(figma.fileKey!==EXPECTED_FILE_KEY)throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!==EXPECTED_FILE_NAME)throw new Error("WRONG-FILE-NAME:"+figma.root.name);`
    : `void "${P}-WRITER-PLUGIN-TARGET-NO-FILE-PIN";`;

  const mintBlock =
    spec.mint.kind === "set"
      ? `  const mintSet=async(setIr)=>{
    const components=[];
    for(const [componentIndex,ir] of setIr.children.entries()){
      const component=figma.createComponent();component.clipsContent=false;
      component.name=Object.entries(ir.variantProperties).map(([key,value])=>key+"="+value).join(", ");
      component.description="recipe-role:"+(ir.role||"");
      tag(component,ir,"${a}/children/"+componentIndex);applyLayout(component,ir);applyPaints(component,ir);
      section.appendChild(component);
      await renderChildren(component,ir,"${a}/children/"+componentIndex);
      applySizing(component,ir);placeAbsolute(component,ir);
      if(component.layoutMode!=="HORIZONTAL"&&component.layoutMode!=="VERTICAL")throw new Error("${P}-FAKE-LAYOUT:"+component.name);
      components.push(component);createdNodeIds.push(component.id);
    }
    const set=figma.combineAsVariants(components,section);
    void "${P}-WRITER-SET-NAME-CARRIES-COMPILE-LABEL";
    set.name=setIr.role+" :: "+(setIr.label||source.sourceName);
    set.description="Experimental ${a}@1 primitive-IR mint. Recipe "+source.recipeHash+"; source adapter "+source.adapterIdentity+".";
    applySetLayout(set,setIr);
    setSharedData(set,"runIdentity",PLAN.runIdentity);setSharedData(set,"adapterIdentity",source.adapterIdentity);setSharedData(set,"recipeHash",source.recipeHash);setSharedData(set,"ownershipKey","${a}");
    return set;
  };
  const minted=await mintSet(source.${spec.mint.field});
  minted.x=80;minted.y=96;
  section.resizeWithoutConstraints(minted.width+160,minted.y+minted.height+80);
  nextSectionX+=section.width+240;
  summaries.push({adapterIdentity:source.adapterIdentity,sectionId:section.id,setId:minted.id,collectionId:collection.id,variableCount:variables.size,variantCount:minted.children.length,recipeHash:source.recipeHash,envelopeHash:source.envelopeHash,comparedIrFacts:source.comparedIrFacts});`
      : `  const mintComponent=async(ir)=>{
    const component=figma.createComponent();component.clipsContent=false;
    void "${P}-WRITER-COMPONENT-NAME-CARRIES-COMPILE-LABEL";
    component.name=ir.role+" :: "+(ir.label||source.sourceName);
    component.description="Experimental ${a}@1 primitive-IR mint. Recipe "+source.recipeHash+"; source adapter "+source.adapterIdentity+".";
    if(ir.opacity!==undefined)component.opacity=ir.opacity;
    tag(component,ir,"${a}");applyLayout(component,ir);applyPaints(component,ir);
    section.appendChild(component);
    await renderChildren(component,ir,"${a}/children");
    applySizing(component,ir);placeAbsolute(component,ir);
    if(component.layoutMode!=="HORIZONTAL"&&component.layoutMode!=="VERTICAL")throw new Error("${P}-FAKE-LAYOUT:"+component.name);
    createdNodeIds.push(component.id);
    const container=figma.createFrame();
    container.name="Component Container";
    container.layoutMode="NONE";
    container.fills=[];
    container.x=80;container.y=96;
    section.appendChild(container);
    container.appendChild(component);
    void "${P}-WRITER-CONTAINER-HUGS-COMPONENT";
    container.clipsContent=false;
    container.resizeWithoutConstraints(Math.max(1,component.width),Math.max(1,component.height));
    createdNodeIds.push(container.id);
    setSharedData(container,"runIdentity",PLAN.runIdentity);setSharedData(container,"adapterIdentity",source.adapterIdentity);setSharedData(container,"recipeHash",source.recipeHash);setSharedData(container,"ownershipKey","${a}/container");
    return {component,container};
  };
  const minted=await mintComponent(source.${spec.mint.field});
  section.resizeWithoutConstraints(minted.container.width+160,minted.container.y+minted.container.height+80);
  nextSectionX+=section.width+240;
  summaries.push({adapterIdentity:source.adapterIdentity,sectionId:section.id,componentId:minted.component.id,containerId:minted.container.id,collectionId:collection.id,variableCount:variables.size,variantCount:1,recipeHash:source.recipeHash,envelopeHash:source.envelopeHash,comparedIrFacts:source.comparedIrFacts});`;

  return `const NS=${q(spec.namespace)};
const WRITER_VERSION=${q(String(spec.writerVersion))};
const PAGE_OWNER="recipe/${a}/"+PLAN.runIdentity;
void "${P}-WRITER-SHARED-RUNTIME";
${identityGuards}
${filePin}
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR:"+figma.editorType);
${pageMarkers}
${currentPageGuards}
await figma.loadAllPagesAsync();
const setSharedData=(target,key,value)=>target.setSharedPluginData(NS,key,String(value));
const getSharedData=(target,key)=>target.getSharedPluginData(NS,key);
let page=figma.root.children.find(candidate=>candidate.name===PLAN.pageName);
const createdNodeIds=[],mutatedNodeIds=[];
if(page){
  if(getSharedData(page,"pageOwner")!==PAGE_OWNER)throw new Error("${P}-PAGE-OWNERSHIP-COLLISION:"+page.id);
  if(getSharedData(page,"runIdentity")!==PLAN.runIdentity)throw new Error("${P}-PAGE-IDENTITY-MISMATCH:"+page.id);
}else{
  page=figma.createPage();page.name=PLAN.pageName;createdNodeIds.push(page.id);
}
${createdPageGuards}
await figma.setCurrentPageAsync(page);
setSharedData(page,"pageOwner",PAGE_OWNER);
setSharedData(page,"runIdentity",PLAN.runIdentity);
setSharedData(page,"writerVersion",WRITER_VERSION);
mutatedNodeIds.push(page.id);
const rgba=hex=>({r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255,a:parseInt(hex.slice(7,9),16)/255});
const paint=hex=>{const value=rgba(hex);return{type:"SOLID",color:{r:value.r,g:value.g,b:value.b},opacity:value.a};};
const allFonts=await figma.listAvailableFontsAsync();
const resolveFont=spec=>{
  const found=spec.fallbackChain.map(candidate=>allFonts.find(font=>font.fontName.family===candidate.family&&font.fontName.style===candidate.style)).find(Boolean);
  if(!found)throw new Error("${P}-FONT-UNAVAILABLE:"+spec.requestedFamily+":"+spec.requestedStyle);
  const resolution=found.fontName.family===spec.requestedFamily&&found.fontName.style===spec.requestedStyle?"requested":"fallback";
  if(found.fontName.family!==spec.resolvedFamily||found.fontName.style!==spec.resolvedStyle||resolution!==spec.resolution)throw new Error("${P}-FONT-PROVENANCE-TAMPER:"+found.fontName.family+":"+found.fontName.style);
  if(resolution==="fallback"&&!spec.degradation)throw new Error("${P}-FONT-FALLBACK-WITHOUT-DEGRADATION");
  return found.fontName;
};
const summaries=[];
let nextSectionX=0;
for(const child of page.children){
  if(child.type==="SECTION")nextSectionX=Math.max(nextSectionX,child.x+child.width+240);
}
for(const source of PLAN.sources){
  const existingSection=page.children.find(node=>node.type==="SECTION"&&getSharedData(node,"adapterIdentity")===source.adapterIdentity&&getSharedData(node,"recipeHash")===source.recipeHash);
  if(existingSection)throw new Error("${P}-SECTION-EXISTS:"+source.adapterIdentity+":"+existingSection.id);
  const section=figma.createSection();
  section.name="Recipe Pivot / "+source.displayName+" / "+source.recipeHash.slice(0,8);
  section.x=nextSectionX;section.y=0;page.appendChild(section);
  setSharedData(section,"adapterIdentity",source.adapterIdentity);
  setSharedData(section,"recipeHash",source.recipeHash);
  createdNodeIds.push(section.id);
  const collectionName=${q(`${spec.collectionLabel} / `)}+PLAN.runIdentity+" / "+source.adapterIdentity;
  const localCollections=figma.variables.getLocalVariableCollectionsAsync?await figma.variables.getLocalVariableCollectionsAsync():[];
  if(localCollections.some(candidate=>candidate.name===collectionName))throw new Error("${P}-VARIABLE-COLLECTION-COLLISION:"+collectionName);
  const collection=figma.variables.createVariableCollection(collectionName);
  setSharedData(collection,"collectionOwner",PAGE_OWNER+"/variable-collection");
  setSharedData(collection,"runIdentity",PLAN.runIdentity);
  setSharedData(collection,"adapterIdentity",source.adapterIdentity);
  collection.renameMode(collection.modes[0].modeId,"Default");
  collection.hiddenFromPublishing=true;
  setSharedData(section,"variableCollectionId",collection.id);
  const modeId=collection.modes[0].modeId,variables=new Map();
  for(const planned of source.variables){
    const variable=figma.variables.createVariable(planned.name,collection,planned.type);
    variable.scopes=["ALL_SCOPES"];
    variable.setValueForMode(modeId,planned.type==="COLOR"?rgba(planned.value):planned.value);
    variable.setVariableCodeSyntax("WEB","var(--"+planned.identity.replace(/[^a-zA-Z0-9_-]+/g,"-").toLowerCase()+")");
    variables.set(planned.type+":"+planned.identity,variable);
  }
  const boundPaint=(hex,binding)=>{
    const base=paint(hex);
    if(!binding)return base;
    const variable=variables.get("COLOR:"+binding.variable);
    if(!variable)throw new Error("MISSING-COLOR-VARIABLE:"+binding.variable);
    return figma.variables.setBoundVariableForPaint(base,"color",variable);
  };
  const bindFloat=(node,field,binding)=>{
    if(!binding)return;
    const variable=variables.get("FLOAT:"+binding.variable);
    if(!variable)throw new Error("MISSING-FLOAT-VARIABLE:"+binding.variable);
    node.setBoundVariable(field,variable);
  };
  const bindingFor=(ir,field)=>(ir.bindings||[]).find(binding=>binding.field===field);
  const tag=(node,ir,ownershipKey)=>{
    setSharedData(node,"runIdentity",PLAN.runIdentity);
    setSharedData(node,"adapterIdentity",source.adapterIdentity);
    setSharedData(node,"recipeHash",source.recipeHash);
    setSharedData(node,"envelopeHash",source.envelopeHash);
    setSharedData(node,"ownershipKey",ownershipKey);
  };
  const applyPaints=(node,ir)=>{
    if(ir.fills)node.fills=ir.fills.map((entry,index)=>boundPaint(entry.color,bindingFor(ir,"fills."+index+".color")));
    if(ir.strokes){
      node.strokes=ir.strokes.map((entry,index)=>boundPaint(entry.paint.color,bindingFor(ir,"strokes."+index+".paint.color")));
      if(ir.strokes[0]){
        node.strokeWeight=ir.strokes[0].weight;node.strokeAlign=ir.strokes[0].align.toUpperCase();
        if(ir.strokes[0].dashPattern)node.dashPattern=ir.strokes[0].dashPattern;
        bindFloat(node,"strokeWeight",bindingFor(ir,"strokes.0.weight"));
      }
    }else if(ir.kind==="vector"){node.strokes=[];}
    if(ir.cornerRadius){
      for(const [irKey,figmaKey] of [["topLeft","topLeftRadius"],["topRight","topRightRadius"],["bottomRight","bottomRightRadius"],["bottomLeft","bottomLeftRadius"]]){
        node[figmaKey]=ir.cornerRadius[irKey];bindFloat(node,figmaKey,bindingFor(ir,"cornerRadius."+irKey));
      }
    }
    void "${P}-WRITER-EFFECTS";
    if(ir.effects){
      // A CSS box-shadow never paints under its own box. Figma's
      // showShadowBehindNode=true paints it there — visible through a
      // translucent fill (shadcn's unchecked checkbox) — but Figma renders a
      // knocked-out shadow (false) markedly DARKER than Chromium outside the
      // node (MUI switch thumb tail, measured: 73/76/84/88 vs real 27/37/44/54;
      // behind=true gave 45/51/71/80). So: behind the node only when the node
      // is fully opaque, where the two agree; knocked out only where it would
      // otherwise bleed through.
      const opaque=Array.isArray(ir.fills)&&ir.fills.length>0&&ir.fills.every(f=>rgba(f.color).a===1)&&(ir.opacity===undefined||ir.opacity===1);
      node.effects=ir.effects.map((effect,index)=>{
        const base=effect.kind==="drop-shadow"||effect.kind==="inner-shadow"?{type:effect.kind==="drop-shadow"?"DROP_SHADOW":"INNER_SHADOW",color:rgba(effect.color),offset:{x:effect.offsetX,y:effect.offsetY},radius:effect.blur,spread:effect.spread,showShadowBehindNode:opaque,visible:true,blendMode:"NORMAL"}:{type:effect.kind==="layer-blur"?"LAYER_BLUR":"BACKGROUND_BLUR",radius:effect.blur,visible:true};
        const binding=bindingFor(ir,"effects."+index+".color");
        if(!binding||!("color" in base))return base;
        const variable=variables.get("COLOR:"+binding.variable);
        if(!variable)throw new Error("MISSING-COLOR-VARIABLE:"+binding.variable);
        return figma.variables.setBoundVariableForEffect(base,"color",variable);
      });
    }
  };
  const align={min:"MIN",center:"CENTER",max:"MAX","space-between":"SPACE_BETWEEN",baseline:"BASELINE"};
  const constraintValue=value=>({left:"MIN",right:"MAX",top:"MIN",bottom:"MAX",center:"CENTER",scale:"SCALE",stretch:"STRETCH"})[value];
  const applyLayout=(node,ir)=>{
    const layout=ir.layout;
    node.layoutMode=layout.mode.toUpperCase();
    node.primaryAxisAlignItems=align[layout.primaryAxisAlign];
    node.counterAxisAlignItems=align[layout.counterAxisAlign];
    node.itemSpacing=layout.itemSpacing;
    node.paddingTop=Math.max(0,layout.padding.top);node.paddingRight=Math.max(0,layout.padding.right);node.paddingBottom=Math.max(0,layout.padding.bottom);node.paddingLeft=Math.max(0,layout.padding.left);
    void "${P}-WRITER-CLIPS-ONLY-WHEN-SAID";
    // Figma's frame default is clipsContent=true; CSS's overflow default is
    // visible. A frame clips only when the IR says so — otherwise a box's own
    // shadow is cut off at a hit area the same size as the box (shadcn) —
    // EXCEPT that Figma renders a frame's own drop shadow like Chromium only
    // when that frame clips (MUI switch thumb tail, measured against the real
    // render 27/37/44/54: clipping 45/51/71/80, not clipping 73/76/84/88 and a
    // row longer). So a shadowed frame clips unless the IR says otherwise.
    const shadowed=Array.isArray(ir.effects)&&ir.effects.some(e=>e.kind==="drop-shadow");
    node.clipsContent=ir.clipsContent===undefined?shadowed:ir.clipsContent;
    void "${P}-WRITER-LAYOUT-MIN-WIDTH";
    if(layout.minWidth!==undefined){node.minWidth=layout.minWidth;bindFloat(node,"minWidth",bindingFor(ir,"layout.minWidth"));}
    if(layout.minHeight!==undefined){node.minHeight=layout.minHeight;bindFloat(node,"minHeight",bindingFor(ir,"layout.minHeight"));}
    if(layout.positioning==="absolute"){
      if(!layout.offset||!layout.constraints)throw new Error("${P}-OVERLAY-DECLARATION-INCOMPLETE:"+ir.role);
      node.layoutPositioning="ABSOLUTE";
      node.constraints={horizontal:constraintValue(layout.constraints.horizontal),vertical:constraintValue(layout.constraints.vertical)};
    }
    bindFloat(node,"itemSpacing",bindingFor(ir,"layout.itemSpacing"));
    for(const [key,field] of [["paddingTop","top"],["paddingRight","right"],["paddingBottom","bottom"],["paddingLeft","left"]])bindFloat(node,key,bindingFor(ir,"layout.padding."+field));
  };
  const isAbsolute=ir=>!!(ir.layout&&ir.layout.positioning==="absolute");
  const applySizing=(node,ir)=>{
    const width=ir.layout?ir.layout.width:ir.width,height=ir.layout?ir.layout.height:ir.height;
    const fixedWidth=width.mode==="fixed"?width.value:Math.max(node.width,1),fixedHeight=height.mode==="fixed"?height.value:Math.max(node.height,1);
    if(width.mode==="fixed"||height.mode==="fixed")node.resizeWithoutConstraints(fixedWidth,fixedHeight);
    void "${P}-WRITER-ABSOLUTE-CHILD-IS-FIXED-SIZED";
    if(isAbsolute(ir)){node.layoutSizingHorizontal="FIXED";node.layoutSizingVertical="FIXED";}
    else{
      if(width.mode==="fill")node.layoutSizingHorizontal="FILL";
      else if(width.mode==="hug")node.layoutSizingHorizontal="HUG";
      else node.layoutSizingHorizontal="FIXED";
      if(height.mode==="fill")node.layoutSizingVertical="FILL";
      else if(height.mode==="hug")node.layoutSizingVertical="HUG";
      else node.layoutSizingVertical="FIXED";
    }
    if(ir.layout){
      node.primaryAxisSizingMode=(ir.layout.mode==="horizontal"?width:height).mode==="hug"?"AUTO":"FIXED";
      node.counterAxisSizingMode=(ir.layout.mode==="horizontal"?height:width).mode==="hug"?"AUTO":"FIXED";
    }
    bindFloat(node,"width",bindingFor(ir,"width.value")||bindingFor(ir,"layout.width.value"));
    bindFloat(node,"height",bindingFor(ir,"height.value")||bindingFor(ir,"layout.height.value"));
  };
  const applySetLayout=(set,ir)=>{applyLayout(set,ir);applyPaints(set,ir);applySizing(set,ir);};
  const firstSegment=name=>name.split(" :: ",1)[0];
  void "${P}-WRITER-FIRST-SEGMENT-BIND";
  void "${P}-WRITER-PLACE-ABSOLUTE-AFTER-PARENT-SIZES";
  const placeAbsolute=(parentNode,parentIr)=>{
    for(const childIr of parentIr.children||[]){
      if(!isAbsolute(childIr))continue;
      const child=parentNode.children.find(c=>firstSegment(c.name)===childIr.role);
      if(!child)throw new Error("${P}-ABSOLUTE-CHILD-MISSING:"+childIr.role);
      const off=childIr.layout.offset,c=childIr.layout.constraints;
      if(c.horizontal==="stretch"){child.x=off.x;child.resizeWithoutConstraints(Math.max(1,parentNode.width-2*off.x),child.height);}
      else if(c.horizontal==="right")child.x=parentNode.width-child.width+off.x;
      else if(c.horizontal==="center")child.x=(parentNode.width-child.width)/2+off.x;
      else child.x=off.x;
      if(c.vertical==="stretch"){child.y=off.y;child.resizeWithoutConstraints(child.width,Math.max(1,parentNode.height-2*off.y));}
      else if(c.vertical==="bottom")child.y=parentNode.height-child.height-off.y;
      else if(c.vertical==="center")child.y=(parentNode.height-child.height)/2+off.y;
      else child.y=off.y;
    }
  };
  void "${P}-WRITER-DEFER-FILL-UNTIL-AUTOLAYOUT-PARENT";
  const renderChildren=async(node,ir,ownershipKey)=>{
    const hugKids=[],fillKids=[];
    for(const [childIndex,child] of ir.children.entries()){
      const width=child.layout?child.layout.width:child.width;
      ((width&&width.mode==="fill"&&!isAbsolute(child))?fillKids:hugKids).push([childIndex,child]);
    }
    for(const [childIndex,child] of hugKids)await render(child,node,ownershipKey+"/children/"+childIndex);
    if(fillKids.length>0)applySizing(node,ir);
    for(const [childIndex,child] of fillKids)await render(child,node,ownershipKey+"/children/"+childIndex);
  };
  const render=async(ir,parent,ownershipKey)=>{
    let node;
    if(ir.kind==="frame")node=figma.createFrame();
    else if(ir.kind==="text"){
      if(!ir.type.fontProvenance)throw new Error("${P}-FONT-PROVENANCE-ABSENT:"+ir.role);
      const label=figma.createText();const font=resolveFont(ir.type.fontProvenance);await figma.loadFontAsync(font);
      label.fontName=font;label.characters=ir.characters;label.fontSize=ir.type.fontSize;
      label.lineHeight=ir.type.lineHeight.unit==="px"?{unit:"PIXELS",value:ir.type.lineHeight.value}:ir.type.lineHeight.unit==="percent"?{unit:"PERCENT",value:ir.type.lineHeight.value}:{unit:"AUTO"};
      void "${P}-WRITER-LETTER-SPACING";
      if(ir.type.letterSpacing)label.letterSpacing=ir.type.letterSpacing.unit==="px"?{unit:"PIXELS",value:ir.type.letterSpacing.value}:{unit:"PERCENT",value:ir.type.letterSpacing.value};
      if(ir.type.textCase==="upper")label.textCase="UPPER";else if(ir.type.textCase==="lower")label.textCase="LOWER";else if(ir.type.textCase==="title")label.textCase="TITLE";
      if(ir.type.textDecoration==="underline")label.textDecoration="UNDERLINE";else if(ir.type.textDecoration==="strikethrough")label.textDecoration="STRIKETHROUGH";
      label.textAlignHorizontal=ir.align.toUpperCase();label.textAlignVertical=ir.verticalAlign.toUpperCase();
      label.textAutoResize="WIDTH_AND_HEIGHT";label.blendMode="NORMAL";
      void "${P}-WRITER-HUG-TEXT-POST-CHARACTER-INTRINSIC";
      void "${P}-WRITER-NAMED-FALLBACK-AFTER-ZERO-GLYPH";
      if(label.characters.trim().length>0&&(label.width<=0||label.absoluteRenderBounds===null)){
        const chain=ir.type.fontProvenance.fallbackChain||[];
        const resolvedFamily=ir.type.fontProvenance.resolvedFamily;
        const resolvedStyle=ir.type.fontProvenance.resolvedStyle;
        let painted=false;
        for(const candidate of chain){
          if(candidate.family===resolvedFamily&&candidate.style===resolvedStyle)continue;
          const found=allFonts.find(entry=>entry.fontName.family===candidate.family&&entry.fontName.style===candidate.style);
          if(!found)continue;
          await figma.loadFontAsync(found.fontName);
          label.fontName=found.fontName;
          label.characters=ir.characters;
          if(label.width>0&&label.absoluteRenderBounds){painted=true;break;}
        }
        if(!painted&&(label.width<=0||label.absoluteRenderBounds===null))throw new Error("${P}-FONT-ZERO-INTRINSIC:"+ir.role);
      }
      node=label;
    }else if(ir.kind==="vector"){
      void "${P}-WRITER-VECTOR-PATH";
      const vector=figma.createVector();
      vector.vectorPaths=[{windingRule:ir.windingRule==="evenodd"?"EVENODD":"NONZERO",data:ir.assetRef}];
      vector.effects=[];
      if(ir.strokeCap&&ir.strokeCap!=="none")vector.strokeCap=ir.strokeCap.toUpperCase();
      if(ir.strokeJoin)vector.strokeJoin=ir.strokeJoin.toUpperCase();
      if(ir.rotation)vector.rotation=ir.rotation;
      void "${P}-WRITER-GLYPH-BOUNDS-GUARD";
      const wantW=ir.width.mode==="fixed"?ir.width.value:vector.width,wantH=ir.height.mode==="fixed"?ir.height.value:vector.height;
      if(Math.abs(vector.width-wantW)>0.05||Math.abs(vector.height-wantH)>0.05)throw new Error("${P}-GLYPH-BOUNDS-MISMATCH:"+ir.role+":"+vector.width.toFixed(3)+"x"+vector.height.toFixed(3)+" vs "+wantW+"x"+wantH);
      node=vector;
    }else throw new Error("UNSUPPORTED-CHILD-KIND:"+ir.kind);
    node.visible=ir.visible!==false;node.opacity=ir.opacity===undefined?1:ir.opacity;
    node.name=ir.role&&ir.label&&ir.role!==ir.label?ir.role+" :: "+ir.label:(ir.label||ir.role||ir.kind);
    if(ir.kind==="text"&&ir.type.fontProvenance)node.name+=" :: font-provenance="+encodeURIComponent(JSON.stringify(ir.type.fontProvenance));
    let hugTextIntrinsic=null;
    if(ir.kind==="text"){
      void "${P}-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE";
      void "${P}-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC";
      if(node.width<=0||node.height<=0)throw new Error("${P}-TEXT-GEOMETRY:"+ir.role);
      hugTextIntrinsic={width:node.width,height:node.height};
    }
    tag(node,ir,ownershipKey);if(ir.kind!=="instance")applyPaints(node,ir);parent.appendChild(node);
    if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
    if(ir.kind==="frame"){applyLayout(node,ir);await renderChildren(node,ir,ownershipKey);applySizing(node,ir);placeAbsolute(node,ir);}
    else applySizing(node,ir);
    if(ir.kind==="text"){
      bindFloat(node,"fontSize",bindingFor(ir,"type.fontSize"));
      void "${P}-WRITER-PERCENT-LINE-HEIGHT-STAYS-LITERAL";
      if(ir.type.lineHeight.unit!=="percent")bindFloat(node,"lineHeight",bindingFor(ir,"type.lineHeight.value"));
      bindFloat(node,"letterSpacing",bindingFor(ir,"type.letterSpacing.value"));
      if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
      if(node.characters.trim().length===0||node.width<=0||node.height<=0)throw new Error("${P}-TEXT-GEOMETRY:"+ir.role);
    }
    createdNodeIds.push(node.id);return node;
  };
${mintBlock}
}
return{writerVersion:Number(WRITER_VERSION),fileKey:${scratch ? "figma.fileKey" : "figma.fileKey||null"},fileName:figma.root.name,pageId:page.id,pageName:page.name,runIdentity:PLAN.runIdentity,namespace:NS,createdNodeIds:[...new Set(createdNodeIds)],mutatedNodeIds:[...new Set(mutatedNodeIds)],sources:summaries};
`;
}
