const PLAN={"pageName":"Recipe Pivot / Link / be7109bb-d810f4f2-7a6db373-46536054-51646118-3c37b1a8-link-v8","runIdentity":"be7109bb-d810f4f2-7a6db373-46536054-51646118-3c37b1a8-link-v8","sources":[{"adapterIdentity":"altitude-link-proposed-v1","displayName":"altitude (proposed)","sourceName":"altitude (proposed) Link","recipeHash":"4653605473b7a7062a3e0004262150142792179bbc54c3aaf6f191baf8656e39","envelopeHash":"7f631a90cdfecbd436138e4d69dfa2edc907daf0fd6fd0b9b32e0b6b662827da","variables":[{"identity":"altitude.link.rest-boxBorder","name":"token/color/id-616c7469747564652e6c696e6b2e726573742d626f78426f72646572","type":"COLOR","value":"#4375ffff"},{"identity":"altitude.link.rest-boxFill","name":"token/color/id-616c7469747564652e6c696e6b2e726573742d626f7846696c6c","type":"COLOR","value":"#00000000"},{"identity":"altitude.link.rest-label","name":"token/color/id-616c7469747564652e6c696e6b2e726573742d6c6162656c","type":"COLOR","value":"#4375ffff"},{"identity":"altitude.link.box-borderWidth","name":"token/float/id-616c7469747564652e6c696e6b2e626f782d626f726465725769647468","type":"FLOAT","value":0},{"identity":"altitude.link.box-paddingX","name":"token/float/id-616c7469747564652e6c696e6b2e626f782d70616464696e6758","type":"FLOAT","value":0},{"identity":"altitude.link.box-paddingY","name":"token/float/id-616c7469747564652e6c696e6b2e626f782d70616464696e6759","type":"FLOAT","value":0},{"identity":"altitude.link.box-radius","name":"token/float/id-616c7469747564652e6c696e6b2e626f782d726164697573","type":"FLOAT","value":0},{"identity":"altitude.link.labelFontSize","name":"token/float/id-616c7469747564652e6c696e6b2e6c6162656c466f6e7453697a65","type":"FLOAT","value":16},{"identity":"altitude.link.labelLineHeight","name":"token/float/id-616c7469747564652e6c696e6b2e6c6162656c4c696e65486569676874","type":"FLOAT","value":24}],"comparedIrFacts":16,"chip":{"label":"altitude (proposed) Link","role":"link/variant/default","bindings":[{"field":"layout.padding.top","type":"FLOAT","variable":"altitude.link.box-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"altitude.link.box-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"altitude.link.box-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"altitude.link.box-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"altitude.link.rest-boxFill"},{"field":"strokes.0.weight","type":"FLOAT","variable":"altitude.link.box-borderWidth"},{"field":"strokes.0.paint.color","type":"COLOR","variable":"altitude.link.rest-boxBorder"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"altitude.link.box-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"altitude.link.box-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"altitude.link.box-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"altitude.link.box-radius"}],"opacity":1,"kind":"component","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"center","itemSpacing":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"hug"},"height":{"mode":"hug"}},"fills":[{"kind":"solid","color":"#00000000"}],"strokes":[{"weight":0,"align":"inside","paint":{"kind":"solid","color":"#4375ffff"}}],"cornerRadius":{"topLeft":0,"topRight":0,"bottomRight":0,"bottomLeft":0},"variantProperties":{"Default":"true"},"children":[{"label":"link/label","role":"link/label","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"altitude.link.labelFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"altitude.link.labelLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"altitude.link.rest-label"}],"kind":"text","characters":"Link","type":{"fontFamily":"IBM Plex Sans","fontStyle":"Regular","fontProvenance":{"requestedFamily":"IBM Plex Sans","requestedStyle":"Regular","requestSource":"extract/computed/out/altitude/link/captured-truth.json label font-family/font-weight: \"IBM Plex Sans\", sans-serif / Regular","fallbackChain":[{"family":"IBM Plex Sans","style":"Regular"},{"family":"IBM Plex Sans","style":"Regular"}],"resolvedFamily":"IBM Plex Sans","resolvedStyle":"Regular","resolution":"requested"},"fontSize":16,"lineHeight":{"unit":"px","value":24},"textDecoration":"underline"},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#4375ffff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]}}]};
const NS="ds.contracts.link.recipe.v1";
const WRITER_VERSION="1";
const PAGE_OWNER="recipe/link/"+PLAN.runIdentity;
void "LINK-WRITER-SHARED-RUNTIME";
if(NS==="ds.contracts.input.recipe.v5"||PLAN.runIdentity==="4a074b24-e8503dd5-input-v5")throw new Error("LINK-INPUT-IDENTITY-REUSE");
if(NS==="ds.contracts.combobox.recipe.v1"||PLAN.runIdentity==="70c24cbd-d27f2e85-combobox-v1")throw new Error("LINK-COMBOBOX-IDENTITY-REUSE");
if(NS==="ds.contracts.table.recipe.v1")throw new Error("LINK-TABLE-IDENTITY-REUSE");
if(NS==="ds.contracts.calendar.recipe.v1")throw new Error("LINK-CALENDAR-IDENTITY-REUSE");
if(NS==="ds.contracts.checkbox.recipe.v1")throw new Error("LINK-CHECKBOX-IDENTITY-REUSE");
if(NS==="ds.contracts.radio.recipe.v1")throw new Error("LINK-RADIO-IDENTITY-REUSE");
if(NS==="ds.contracts.switch.recipe.v1")throw new Error("LINK-SWITCH-IDENTITY-REUSE");
if(NS==="ds.contracts.textarea.recipe.v1")throw new Error("LINK-TEXTAREA-IDENTITY-REUSE");
if(NS==="ds.contracts.alert.recipe.v1")throw new Error("LINK-ALERT-IDENTITY-REUSE");
if(NS==="ds.contracts.chip.recipe.v1")throw new Error("LINK-CHIP-IDENTITY-REUSE");
if(NS==="ds.contracts.badge.recipe.v1")throw new Error("LINK-BADGE-IDENTITY-REUSE");
if(NS==="ds.contracts.avatar.recipe.v1")throw new Error("LINK-AVATAR-IDENTITY-REUSE");
const EXPECTED_FILE_KEY="byMp6lt0Ij9b2QbkDGFwBh",EXPECTED_FILE_NAME="Scratch Project";
if(figma.fileKey!==EXPECTED_FILE_KEY)throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!==EXPECTED_FILE_NAME)throw new Error("WRONG-FILE-NAME:"+figma.root.name);
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR:"+figma.editorType);
void "LINK-MUST-NOT-WRITE-LINK-V7-PAGE";
void "LINK-MUST-NOT-WRITE-LINK-V6-PAGE";
void "LINK-MUST-NOT-WRITE-LINK-V5-PAGE";
void "LINK-MUST-NOT-WRITE-LINK-V4-PAGE";
void "LINK-MUST-NOT-WRITE-LINK-V3-PAGE";
void "LINK-MUST-NOT-WRITE-LINK-V2-PAGE";
void "LINK-MUST-NOT-WRITE-INPUT-PAGE";
void "LINK-MUST-NOT-WRITE-COMBOBOX-PAGE";
void "LINK-MUST-NOT-WRITE-COMBOBOX-V42-PAGE";
void "LINK-MUST-NOT-WRITE-BUTTON-PAGE";
void "LINK-MUST-NOT-WRITE-PRESERVED-BUTTON-PAGE";
void "LINK-MUST-NOT-WRITE-TABLE-PAGE";
void "LINK-MUST-NOT-WRITE-CALENDAR-PAGE";
void "LINK-MUST-NOT-WRITE-CHECKBOX-PAGE";
void "LINK-MUST-NOT-WRITE-RADIO-PAGE";
void "LINK-MUST-NOT-WRITE-SWITCH-PAGE";
void "LINK-MUST-NOT-WRITE-TEXTAREA-PAGE";
void "LINK-MUST-NOT-WRITE-ALERT-PAGE";
void "LINK-MUST-NOT-WRITE-CHIP-PAGE";
void "LINK-MUST-NOT-WRITE-BADGE-PAGE";
void "LINK-MUST-NOT-WRITE-AVATAR-PAGE";
if(figma.currentPage&&figma.currentPage.id==="218:91169")throw new Error("LINK-MUST-NOT-WRITE-LINK-V7-PAGE");
if(figma.currentPage&&figma.currentPage.id==="218:90280")throw new Error("LINK-MUST-NOT-WRITE-LINK-V6-PAGE");
if(figma.currentPage&&figma.currentPage.id==="218:87690")throw new Error("LINK-MUST-NOT-WRITE-LINK-V5-PAGE");
if(figma.currentPage&&figma.currentPage.id==="218:86197")throw new Error("LINK-MUST-NOT-WRITE-LINK-V4-PAGE");
if(figma.currentPage&&figma.currentPage.id==="218:84715")throw new Error("LINK-MUST-NOT-WRITE-LINK-V3-PAGE");
if(figma.currentPage&&figma.currentPage.id==="212:81437")throw new Error("LINK-MUST-NOT-WRITE-LINK-V2-PAGE");
if(figma.currentPage&&figma.currentPage.id==="115:295378")throw new Error("LINK-MUST-NOT-WRITE-INPUT-PAGE");
if(figma.currentPage&&figma.currentPage.id==="163:35981")throw new Error("LINK-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:70641")throw new Error("LINK-MUST-NOT-WRITE-COMBOBOX-V42-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:69150")throw new Error("LINK-MUST-NOT-WRITE-BUTTON-PAGE");
if(figma.currentPage&&figma.currentPage.id==="85:6781")throw new Error("LINK-MUST-NOT-WRITE-PRESERVED-BUTTON-PAGE");
if(figma.currentPage&&figma.currentPage.id==="173:48924")throw new Error("LINK-MUST-NOT-WRITE-TABLE-PAGE");
if(figma.currentPage&&figma.currentPage.id==="181:64873")throw new Error("LINK-MUST-NOT-WRITE-CALENDAR-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:74742")throw new Error("LINK-MUST-NOT-WRITE-CHECKBOX-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75031")throw new Error("LINK-MUST-NOT-WRITE-RADIO-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75302")throw new Error("LINK-MUST-NOT-WRITE-SWITCH-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75495")throw new Error("LINK-MUST-NOT-WRITE-TEXTAREA-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75801")throw new Error("LINK-MUST-NOT-WRITE-ALERT-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75976")throw new Error("LINK-MUST-NOT-WRITE-CHIP-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:76022")throw new Error("LINK-MUST-NOT-WRITE-BADGE-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:76063")throw new Error("LINK-MUST-NOT-WRITE-AVATAR-PAGE");
await figma.loadAllPagesAsync();
const setSharedData=(target,key,value)=>target.setSharedPluginData(NS,key,String(value));
const getSharedData=(target,key)=>target.getSharedPluginData(NS,key);
let page=figma.root.children.find(candidate=>candidate.name===PLAN.pageName);
const createdNodeIds=[],mutatedNodeIds=[];
if(page){
  if(getSharedData(page,"pageOwner")!==PAGE_OWNER)throw new Error("LINK-PAGE-OWNERSHIP-COLLISION:"+page.id);
  if(getSharedData(page,"runIdentity")!==PLAN.runIdentity)throw new Error("LINK-PAGE-IDENTITY-MISMATCH:"+page.id);
}else{
  page=figma.createPage();page.name=PLAN.pageName;createdNodeIds.push(page.id);
}
if(page.id==="218:91169")throw new Error("LINK-MUST-NOT-WRITE-LINK-V7-PAGE");
if(page.id==="218:90280")throw new Error("LINK-MUST-NOT-WRITE-LINK-V6-PAGE");
if(page.id==="218:87690")throw new Error("LINK-MUST-NOT-WRITE-LINK-V5-PAGE");
if(page.id==="218:86197")throw new Error("LINK-MUST-NOT-WRITE-LINK-V4-PAGE");
if(page.id==="218:84715")throw new Error("LINK-MUST-NOT-WRITE-LINK-V3-PAGE");
if(page.id==="212:81437")throw new Error("LINK-MUST-NOT-WRITE-LINK-V2-PAGE");
if(page.id==="115:295378")throw new Error("LINK-MUST-NOT-WRITE-INPUT-PAGE");
if(page.id==="163:35981")throw new Error("LINK-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(page.id==="183:70641")throw new Error("LINK-MUST-NOT-WRITE-COMBOBOX-V42-PAGE");
if(page.id==="183:69150")throw new Error("LINK-MUST-NOT-WRITE-BUTTON-PAGE");
if(page.id==="85:6781")throw new Error("LINK-MUST-NOT-WRITE-PRESERVED-BUTTON-PAGE");
if(page.id==="173:48924")throw new Error("LINK-MUST-NOT-WRITE-TABLE-PAGE");
if(page.id==="181:64873")throw new Error("LINK-MUST-NOT-WRITE-CALENDAR-PAGE");
if(page.id==="183:74742")throw new Error("LINK-MUST-NOT-WRITE-CHECKBOX-PAGE");
if(page.id==="183:75031")throw new Error("LINK-MUST-NOT-WRITE-RADIO-PAGE");
if(page.id==="183:75302")throw new Error("LINK-MUST-NOT-WRITE-SWITCH-PAGE");
if(page.id==="183:75495")throw new Error("LINK-MUST-NOT-WRITE-TEXTAREA-PAGE");
if(page.id==="183:75801")throw new Error("LINK-MUST-NOT-WRITE-ALERT-PAGE");
if(page.id==="183:75976")throw new Error("LINK-MUST-NOT-WRITE-CHIP-PAGE");
if(page.id==="183:76022")throw new Error("LINK-MUST-NOT-WRITE-BADGE-PAGE");
if(page.id==="183:76063")throw new Error("LINK-MUST-NOT-WRITE-AVATAR-PAGE");
await figma.setCurrentPageAsync(page);
setSharedData(page,"pageOwner",PAGE_OWNER);
setSharedData(page,"runIdentity",PLAN.runIdentity);
setSharedData(page,"writerVersion",WRITER_VERSION);
mutatedNodeIds.push(page.id);
const rgba=hex=>({r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255,a:parseInt(hex.slice(7,9),16)/255});
const paint=hex=>{const value=rgba(hex);return{type:"SOLID",color:{r:value.r,g:value.g,b:value.b},opacity:value.a};};
const allFonts=await figma.listAvailableFontsAsync();
// A font STYLE name is compared without case or spacing: foundries spell the
// same face "SemiBold", "Semibold" and "Semi Bold", and a fixture read from a
// CSS font-weight cannot know which spelling this machine's file uses.
// NOTE the doubled backslash: this line lives inside the emitted program's
// template literal, and a single s reached the plugin as /[s_-]/ — a regex
// that strips the LETTER s, so a two-word "Semi Bold" never matched a
// CSS-weight "Semibold" (measured 2026-09-02 on the Chakra dialog title:
// FONT-UNAVAILABLE while the same lookup succeeded run directly in the file).
const sameStyle=(a,b)=>String(a).toLowerCase().replace(/[\s_-]/g,"")===String(b).toLowerCase().replace(/[\s_-]/g,"");
const resolveFont=spec=>{
  const found=spec.fallbackChain.map(candidate=>allFonts.find(font=>font.fontName.family===candidate.family&&sameStyle(font.fontName.style,candidate.style))).find(Boolean);
  if(!found)throw new Error("LINK-FONT-UNAVAILABLE:"+spec.requestedFamily+":"+spec.requestedStyle);
  const resolution=found.fontName.family===spec.requestedFamily&&sameStyle(found.fontName.style,spec.requestedStyle)?"requested":"fallback";
  if(found.fontName.family!==spec.resolvedFamily||!sameStyle(found.fontName.style,spec.resolvedStyle)||resolution!==spec.resolution)throw new Error("LINK-FONT-PROVENANCE-TAMPER:"+found.fontName.family+":"+found.fontName.style);
  if(resolution==="fallback"&&!spec.degradation)throw new Error("LINK-FONT-FALLBACK-WITHOUT-DEGRADATION");
  return found.fontName;
};
const summaries=[];
let nextSectionX=0;
for(const child of page.children){
  if(child.type==="SECTION")nextSectionX=Math.max(nextSectionX,child.x+child.width+240);
}
for(const source of PLAN.sources){
  const existingSection=page.children.find(node=>node.type==="SECTION"&&getSharedData(node,"adapterIdentity")===source.adapterIdentity&&getSharedData(node,"recipeHash")===source.recipeHash);
  if(existingSection)throw new Error("LINK-SECTION-EXISTS:"+source.adapterIdentity+":"+existingSection.id);
  const section=figma.createSection();
  section.name="Recipe Pivot / "+source.displayName+" / "+source.recipeHash.slice(0,8);
  section.x=nextSectionX;section.y=0;page.appendChild(section);
  setSharedData(section,"adapterIdentity",source.adapterIdentity);
  setSharedData(section,"recipeHash",source.recipeHash);
  createdNodeIds.push(section.id);
  const collectionName="Recipe Link / "+PLAN.runIdentity+" / "+source.adapterIdentity;
  const localCollections=figma.variables.getLocalVariableCollectionsAsync?await figma.variables.getLocalVariableCollectionsAsync():[];
  if(localCollections.some(candidate=>candidate.name===collectionName))throw new Error("LINK-VARIABLE-COLLECTION-COLLISION:"+collectionName);
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
        // Per-side weights when the IR carries them (a source that draws one
        // edge — MUI's table cell bottom rule). Figma requires the uniform
        // strokeWeight first; these then override per side.
        if(ir.strokes[0].sideWeights){const sw=ir.strokes[0].sideWeights;for(const [side,prop] of [["top","strokeTopWeight"],["right","strokeRightWeight"],["bottom","strokeBottomWeight"],["left","strokeLeftWeight"]]){node[prop]=sw[side];bindFloat(node,prop,bindingFor(ir,"strokes.0.sideWeights."+side));}}
        if(ir.strokes[0].dashPattern)node.dashPattern=ir.strokes[0].dashPattern;
        bindFloat(node,"strokeWeight",bindingFor(ir,"strokes.0.weight"));
      }
    }else if(ir.kind==="vector"){node.strokes=[];}
    if(ir.cornerRadius){
      for(const [irKey,figmaKey] of [["topLeft","topLeftRadius"],["topRight","topRightRadius"],["bottomRight","bottomRightRadius"],["bottomLeft","bottomLeftRadius"]]){
        node[figmaKey]=ir.cornerRadius[irKey];bindFloat(node,figmaKey,bindingFor(ir,"cornerRadius."+irKey));
      }
    }
    void "LINK-WRITER-EFFECTS";
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
    void "LINK-WRITER-CLIPS-ONLY-WHEN-SAID";
    // Figma's frame default is clipsContent=true; CSS's overflow default is
    // visible. A frame clips only when the IR says so — otherwise a box's own
    // shadow is cut off at a hit area the same size as the box (shadcn) —
    // EXCEPT that Figma renders a frame's own drop shadow like Chromium only
    // when that frame clips (MUI switch thumb tail, measured against the real
    // render 27/37/44/54: clipping 45/51/71/80, not clipping 73/76/84/88 and a
    // row longer). So a shadowed frame clips unless the IR says otherwise.
    const shadowed=Array.isArray(ir.effects)&&ir.effects.some(e=>e.kind==="drop-shadow");
    node.clipsContent=ir.clipsContent===undefined?shadowed:ir.clipsContent;
    void "LINK-WRITER-LAYOUT-MIN-WIDTH";
    if(layout.minWidth!==undefined){node.minWidth=layout.minWidth;bindFloat(node,"minWidth",bindingFor(ir,"layout.minWidth"));}
    if(layout.minHeight!==undefined){node.minHeight=layout.minHeight;bindFloat(node,"minHeight",bindingFor(ir,"layout.minHeight"));}
    if(layout.positioning==="absolute"){
      if(!layout.offset||!layout.constraints)throw new Error("LINK-OVERLAY-DECLARATION-INCOMPLETE:"+ir.role);
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
    void "LINK-WRITER-ABSOLUTE-CHILD-IS-FIXED-SIZED";
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
  void "LINK-WRITER-FIRST-SEGMENT-BIND";
  void "LINK-WRITER-PLACE-ABSOLUTE-AFTER-PARENT-SIZES";
  const placeAbsolute=(parentNode,parentIr)=>{
    for(const childIr of parentIr.children||[]){
      if(!isAbsolute(childIr))continue;
      const child=parentNode.children.find(c=>firstSegment(c.name)===childIr.role);
      if(!child)throw new Error("LINK-ABSOLUTE-CHILD-MISSING:"+childIr.role);
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
  void "LINK-WRITER-DEFER-FILL-UNTIL-AUTOLAYOUT-PARENT";
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
      if(!ir.type.fontProvenance)throw new Error("LINK-FONT-PROVENANCE-ABSENT:"+ir.role);
      const label=figma.createText();const font=resolveFont(ir.type.fontProvenance);await figma.loadFontAsync(font);
      label.fontName=font;label.characters=ir.characters;label.fontSize=ir.type.fontSize;
      label.lineHeight=ir.type.lineHeight.unit==="px"?{unit:"PIXELS",value:ir.type.lineHeight.value}:ir.type.lineHeight.unit==="percent"?{unit:"PERCENT",value:ir.type.lineHeight.value}:{unit:"AUTO"};
      void "LINK-WRITER-LETTER-SPACING";
      if(ir.type.letterSpacing)label.letterSpacing=ir.type.letterSpacing.unit==="px"?{unit:"PIXELS",value:ir.type.letterSpacing.value}:{unit:"PERCENT",value:ir.type.letterSpacing.value};
      if(ir.type.textCase==="upper")label.textCase="UPPER";else if(ir.type.textCase==="lower")label.textCase="LOWER";else if(ir.type.textCase==="title")label.textCase="TITLE";
      if(ir.type.textDecoration==="underline")label.textDecoration="UNDERLINE";else if(ir.type.textDecoration==="strikethrough")label.textDecoration="STRIKETHROUGH";
      label.textAlignHorizontal=ir.align.toUpperCase();label.textAlignVertical=ir.verticalAlign.toUpperCase();
      label.textAutoResize="WIDTH_AND_HEIGHT";label.blendMode="NORMAL";
      void "LINK-WRITER-HUG-TEXT-POST-CHARACTER-INTRINSIC";
      void "LINK-WRITER-NAMED-FALLBACK-AFTER-ZERO-GLYPH";
      if(label.characters.trim().length>0&&(label.width<=0||label.absoluteRenderBounds===null)){
        const chain=ir.type.fontProvenance.fallbackChain||[];
        const resolvedFamily=ir.type.fontProvenance.resolvedFamily;
        const resolvedStyle=ir.type.fontProvenance.resolvedStyle;
        let painted=false;
        for(const candidate of chain){
          if(candidate.family===resolvedFamily&&candidate.style===resolvedStyle)continue;
          // the same spacing-and-case-blind style match as resolveFont (a two-word "Semi Bold" vs a CSS-weight "Semibold")
          const found=allFonts.find(entry=>entry.fontName.family===candidate.family&&sameStyle(entry.fontName.style,candidate.style));
          if(!found)continue;
          await figma.loadFontAsync(found.fontName);
          label.fontName=found.fontName;
          label.characters=ir.characters;
          if(label.width>0&&label.absoluteRenderBounds){painted=true;break;}
        }
        if(!painted&&(label.width<=0||label.absoluteRenderBounds===null))throw new Error("LINK-FONT-ZERO-INTRINSIC:"+ir.role);
      }
      node=label;
    }else if(ir.kind==="vector"){
      void "LINK-WRITER-VECTOR-PATH";
      const vector=figma.createVector();
      vector.vectorPaths=[{windingRule:ir.windingRule==="evenodd"?"EVENODD":"NONZERO",data:ir.assetRef}];
      vector.effects=[];
      if(ir.strokeCap&&ir.strokeCap!=="none")vector.strokeCap=ir.strokeCap.toUpperCase();
      if(ir.strokeJoin)vector.strokeJoin=ir.strokeJoin.toUpperCase();
      if(ir.rotation)vector.rotation=ir.rotation;
      void "LINK-WRITER-GLYPH-BOUNDS-GUARD";
      const wantW=ir.width.mode==="fixed"?ir.width.value:vector.width,wantH=ir.height.mode==="fixed"?ir.height.value:vector.height;
      if(Math.abs(vector.width-wantW)>0.05||Math.abs(vector.height-wantH)>0.05)throw new Error("LINK-GLYPH-BOUNDS-MISMATCH:"+ir.role+":"+vector.width.toFixed(3)+"x"+vector.height.toFixed(3)+" vs "+wantW+"x"+wantH);
      node=vector;
    }else throw new Error("UNSUPPORTED-CHILD-KIND:"+ir.kind);
    node.visible=ir.visible!==false;node.opacity=ir.opacity===undefined?1:ir.opacity;
    node.name=ir.role&&ir.label&&ir.role!==ir.label?ir.role+" :: "+ir.label:(ir.label||ir.role||ir.kind);
    if(ir.kind==="text"&&ir.type.fontProvenance)node.name+=" :: font-provenance="+encodeURIComponent(JSON.stringify(ir.type.fontProvenance));
    let hugTextIntrinsic=null;
    if(ir.kind==="text"){
      void "LINK-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE";
      void "LINK-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC";
      if(node.width<=0||node.height<=0)throw new Error("LINK-TEXT-GEOMETRY:"+ir.role);
      hugTextIntrinsic={width:node.width,height:node.height};
    }
    tag(node,ir,ownershipKey);if(ir.kind!=="instance")applyPaints(node,ir);parent.appendChild(node);
    if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
    if(ir.kind==="frame"){applyLayout(node,ir);await renderChildren(node,ir,ownershipKey);applySizing(node,ir);placeAbsolute(node,ir);}
    else applySizing(node,ir);
    if(ir.kind==="text"){
      bindFloat(node,"fontSize",bindingFor(ir,"type.fontSize"));
      void "LINK-WRITER-PERCENT-LINE-HEIGHT-STAYS-LITERAL";
      if(ir.type.lineHeight.unit!=="percent")bindFloat(node,"lineHeight",bindingFor(ir,"type.lineHeight.value"));
      bindFloat(node,"letterSpacing",bindingFor(ir,"type.letterSpacing.value"));
      if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
      if(node.characters.trim().length===0||node.width<=0||node.height<=0)throw new Error("LINK-TEXT-GEOMETRY:"+ir.role);
    }
    createdNodeIds.push(node.id);return node;
  };
  const mintComponent=async(ir)=>{
    const component=figma.createComponent();component.clipsContent=false;
    void "LINK-WRITER-COMPONENT-NAME-CARRIES-COMPILE-LABEL";
    component.name=ir.role+" :: "+(ir.label||source.sourceName);
    component.description="Experimental link@1 primitive-IR mint. Recipe "+source.recipeHash+"; source adapter "+source.adapterIdentity+".";
    if(ir.opacity!==undefined)component.opacity=ir.opacity;
    tag(component,ir,"link");applyLayout(component,ir);applyPaints(component,ir);
    section.appendChild(component);
    await renderChildren(component,ir,"link/children");
    applySizing(component,ir);placeAbsolute(component,ir);
    if(component.layoutMode!=="HORIZONTAL"&&component.layoutMode!=="VERTICAL")throw new Error("LINK-FAKE-LAYOUT:"+component.name);
    createdNodeIds.push(component.id);
    const container=figma.createFrame();
    container.name="Component Container";
    container.layoutMode="NONE";
    container.fills=[];
    container.x=80;container.y=96;
    section.appendChild(container);
    container.appendChild(component);
    void "LINK-WRITER-CONTAINER-HUGS-COMPONENT";
    container.clipsContent=false;
    container.resizeWithoutConstraints(Math.max(1,component.width),Math.max(1,component.height));
    createdNodeIds.push(container.id);
    setSharedData(container,"runIdentity",PLAN.runIdentity);setSharedData(container,"adapterIdentity",source.adapterIdentity);setSharedData(container,"recipeHash",source.recipeHash);setSharedData(container,"ownershipKey","link/container");
    return {component,container};
  };
  const minted=await mintComponent(source.chip);
  section.resizeWithoutConstraints(minted.container.width+160,minted.container.y+minted.container.height+80);
  nextSectionX+=section.width+240;
  summaries.push({adapterIdentity:source.adapterIdentity,sectionId:section.id,componentId:minted.component.id,containerId:minted.container.id,collectionId:collection.id,variableCount:variables.size,variantCount:1,recipeHash:source.recipeHash,envelopeHash:source.envelopeHash,comparedIrFacts:source.comparedIrFacts});
}
return{writerVersion:Number(WRITER_VERSION),fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,runIdentity:PLAN.runIdentity,namespace:NS,createdNodeIds:[...new Set(createdNodeIds)],mutatedNodeIds:[...new Set(mutatedNodeIds)],sources:summaries};
