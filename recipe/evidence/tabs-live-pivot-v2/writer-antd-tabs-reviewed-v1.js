const PLAN={"pageName":"Recipe Pivot / Tabs / 34d1e257-8e1aa500-20e72946-tabs-v2","runIdentity":"34d1e257-8e1aa500-20e72946-tabs-v2","sources":[{"adapterIdentity":"antd-tabs-reviewed-v1","displayName":"Ant Design","sourceName":"Ant Design Tabs","recipeHash":"20e729469b8ff036fd9a9584feaa5b02c06d8ab2ccec64329b2293008cb4c828","envelopeHash":"a15635b4fb7daf7af7fe0b1794ddb6f12aec90ab7b40d69753837dc02c869355","variables":[{"identity":"antd.tabs.indicator-fill","name":"token/color/id-616e74642e746162732e696e64696361746f722d66696c6c","type":"COLOR","value":"#1677ffff"},{"identity":"antd.tabs.rest-label","name":"token/color/id-616e74642e746162732e726573742d6c6162656c","type":"COLOR","value":"#000000e0"},{"identity":"antd.tabs.selected-label","name":"token/color/id-616e74642e746162732e73656c65637465642d6c6162656c","type":"COLOR","value":"#1677ffff"},{"identity":"antd.tabs.tab-fill","name":"token/color/id-616e74642e746162732e7461622d66696c6c","type":"COLOR","value":"#00000000"},{"identity":"antd.tabs.indicator-height","name":"token/float/id-616e74642e746162732e696e64696361746f722d686569676874","type":"FLOAT","value":2},{"identity":"antd.tabs.indicator-radius","name":"token/float/id-616e74642e746162732e696e64696361746f722d726164697573","type":"FLOAT","value":0},{"identity":"antd.tabs.labelFontSize","name":"token/float/id-616e74642e746162732e6c6162656c466f6e7453697a65","type":"FLOAT","value":14},{"identity":"antd.tabs.labelLineHeight","name":"token/float/id-616e74642e746162732e6c6162656c4c696e65486569676874","type":"FLOAT","value":22},{"identity":"antd.tabs.list-itemSpacing","name":"token/float/id-616e74642e746162732e6c6973742d6974656d53706163696e67","type":"FLOAT","value":32},{"identity":"antd.tabs.tab-paddingX","name":"token/float/id-616e74642e746162732e7461622d70616464696e6758","type":"FLOAT","value":0},{"identity":"antd.tabs.tab-paddingY","name":"token/float/id-616e74642e746162732e7461622d70616464696e6759","type":"FLOAT","value":12},{"identity":"antd.tabs.tab-radius","name":"token/float/id-616e74642e746162732e7461622d726164697573","type":"FLOAT","value":0}],"comparedIrFacts":37,"chip":{"label":"Ant Design Tabs","role":"tabs/variant/default","bindings":[{"field":"layout.itemSpacing","type":"FLOAT","variable":"antd.tabs.list-itemSpacing"}],"kind":"component","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"max","itemSpacing":32,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"hug"},"height":{"mode":"hug"}},"fills":[],"variantProperties":{"Default":"true"},"children":[{"label":"tabs/item/selected","role":"tabs/item/selected","bindings":[{"field":"layout.padding.top","type":"FLOAT","variable":"antd.tabs.tab-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"antd.tabs.tab-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"antd.tabs.tab-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"antd.tabs.tab-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"antd.tabs.tab-fill"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"antd.tabs.tab-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"antd.tabs.tab-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"antd.tabs.tab-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"antd.tabs.tab-radius"}],"kind":"frame","layout":{"mode":"vertical","primaryAxisAlign":"min","counterAxisAlign":"min","itemSpacing":0,"padding":{"top":12,"right":0,"bottom":12,"left":0},"width":{"mode":"hug"},"height":{"mode":"hug"}},"fills":[{"kind":"solid","color":"#00000000"}],"cornerRadius":{"topLeft":0,"topRight":0,"bottomRight":0,"bottomLeft":0},"children":[{"label":"tabs/label","role":"tabs/label","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"antd.tabs.labelFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"antd.tabs.labelLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"antd.tabs.selected-label"}],"kind":"text","characters":"Item One","type":{"fontFamily":"SF Pro","fontStyle":"Regular","fontProvenance":{"requestedFamily":"-apple-system","requestedStyle":"Regular","requestSource":"antd/es/tabs/style/index.js titleFontSize token.fontSize 14; resetComponent lineHeight 1.5714 → 22","fallbackChain":[{"family":"-apple-system","style":"Regular"},{"family":"SF Pro","style":"Regular"},{"family":"Segoe UI","style":"Regular"},{"family":"Roboto","style":"Regular"},{"family":"Helvetica Neue","style":"Regular"},{"family":"Arial","style":"Regular"}],"resolvedFamily":"SF Pro","resolvedStyle":"Regular","resolution":"fallback","degradation":"antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Regular"},"fontSize":14,"lineHeight":{"unit":"px","value":22},"textCase":"original"},"align":"center","verticalAlign":"center","fills":[{"kind":"solid","color":"#1677ffff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}},{"label":"tabs/indicator","role":"tabs/indicator","bindings":[{"field":"layout.height.value","type":"FLOAT","variable":"antd.tabs.indicator-height"},{"field":"fills.0.color","type":"COLOR","variable":"antd.tabs.indicator-fill"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"antd.tabs.indicator-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"antd.tabs.indicator-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"antd.tabs.indicator-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"antd.tabs.indicator-radius"}],"opacity":1,"kind":"frame","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"min","itemSpacing":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"fill"},"height":{"mode":"fixed","value":2}},"fills":[{"kind":"solid","color":"#1677ffff"}],"cornerRadius":{"topLeft":0,"topRight":0,"bottomRight":0,"bottomLeft":0},"children":[]}]},{"label":"tabs/item/rest","role":"tabs/item/rest","bindings":[{"field":"layout.padding.top","type":"FLOAT","variable":"antd.tabs.tab-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"antd.tabs.tab-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"antd.tabs.tab-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"antd.tabs.tab-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"antd.tabs.tab-fill"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"antd.tabs.tab-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"antd.tabs.tab-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"antd.tabs.tab-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"antd.tabs.tab-radius"}],"kind":"frame","layout":{"mode":"vertical","primaryAxisAlign":"min","counterAxisAlign":"min","itemSpacing":0,"padding":{"top":12,"right":0,"bottom":12,"left":0},"width":{"mode":"hug"},"height":{"mode":"hug"}},"fills":[{"kind":"solid","color":"#00000000"}],"cornerRadius":{"topLeft":0,"topRight":0,"bottomRight":0,"bottomLeft":0},"children":[{"label":"tabs/label","role":"tabs/label","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"antd.tabs.labelFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"antd.tabs.labelLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"antd.tabs.rest-label"}],"kind":"text","characters":"Item Two","type":{"fontFamily":"SF Pro","fontStyle":"Regular","fontProvenance":{"requestedFamily":"-apple-system","requestedStyle":"Regular","requestSource":"antd/es/tabs/style/index.js titleFontSize token.fontSize 14; resetComponent lineHeight 1.5714 → 22","fallbackChain":[{"family":"-apple-system","style":"Regular"},{"family":"SF Pro","style":"Regular"},{"family":"Segoe UI","style":"Regular"},{"family":"Roboto","style":"Regular"},{"family":"Helvetica Neue","style":"Regular"},{"family":"Arial","style":"Regular"}],"resolvedFamily":"SF Pro","resolvedStyle":"Regular","resolution":"fallback","degradation":"antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Regular"},"fontSize":14,"lineHeight":{"unit":"px","value":22},"textCase":"original"},"align":"center","verticalAlign":"center","fills":[{"kind":"solid","color":"#000000e0"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]}]}}]};

const EXPECTED_FILE_KEY="byMp6lt0Ij9b2QbkDGFwBh";
const EXPECTED_FILE_NAME="Scratch Project";
const NS = "ds.contracts.tabs.recipe.v1";
const WRITER_VERSION="1";
const PAGE_OWNER="recipe/tabs/"+PLAN.runIdentity;
if(NS==="ds.contracts.input.recipe.v5"||PLAN.runIdentity==="4a074b24-e8503dd5-input-v5")throw new Error("TABS-INPUT-IDENTITY-REUSE");
if(NS==="ds.contracts.combobox.recipe.v1"||PLAN.runIdentity==="70c24cbd-d27f2e85-combobox-v1")throw new Error("TABS-COMBOBOX-IDENTITY-REUSE");
if(NS==="ds.contracts.table.recipe.v1")throw new Error("TABS-TABLE-IDENTITY-REUSE");
if(NS==="ds.contracts.calendar.recipe.v1")throw new Error("TABS-CALENDAR-IDENTITY-REUSE");
if(NS==="ds.contracts.checkbox.recipe.v1")throw new Error("TABS-CHECKBOX-IDENTITY-REUSE");
if(NS==="ds.contracts.radio.recipe.v1")throw new Error("TABS-RADIO-IDENTITY-REUSE");
if(NS==="ds.contracts.switch.recipe.v1")throw new Error("TABS-SWITCH-IDENTITY-REUSE");
if(NS==="ds.contracts.textarea.recipe.v1")throw new Error("TABS-TEXTAREA-IDENTITY-REUSE");
if(NS==="ds.contracts.alert.recipe.v1")throw new Error("TABS-ALERT-IDENTITY-REUSE");
if(NS==="ds.contracts.chip.recipe.v1")throw new Error("TABS-CHIP-IDENTITY-REUSE");
if(NS==="ds.contracts.badge.recipe.v1")throw new Error("TABS-BADGE-IDENTITY-REUSE");
if(NS==="ds.contracts.avatar.recipe.v1")throw new Error("TABS-AVATAR-IDENTITY-REUSE");
if(NS==="ds.contracts.link.recipe.v1")throw new Error("TABS-LINK-IDENTITY-REUSE");
if(NS==="ds.contracts.tooltip.recipe.v1")throw new Error("TABS-TOOLTIP-IDENTITY-REUSE");
if(figma.fileKey!==EXPECTED_FILE_KEY)throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!==EXPECTED_FILE_NAME)throw new Error("WRONG-FILE-NAME:"+figma.root.name);
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR:"+figma.editorType);
void "TABS-MUST-NOT-WRITE-INPUT-PAGE";
void "TABS-MUST-NOT-WRITE-TABS-V1-PAGE";
void "TABS-MUST-NOT-WRITE-COMBOBOX-PAGE";
void "TABS-MUST-NOT-WRITE-COMBOBOX-V42-PAGE";
void "TABS-MUST-NOT-WRITE-BUTTON-PAGE";
void "TABS-MUST-NOT-WRITE-PRESERVED-BUTTON-PAGE";
void "TABS-MUST-NOT-WRITE-TABLE-PAGE";
void "TABS-MUST-NOT-WRITE-CALENDAR-PAGE";
void "TABS-MUST-NOT-WRITE-CHECKBOX-PAGE";
void "TABS-MUST-NOT-WRITE-RADIO-PAGE";
void "TABS-MUST-NOT-WRITE-SWITCH-PAGE";
void "TABS-MUST-NOT-WRITE-TEXTAREA-PAGE";
void "TABS-MUST-NOT-WRITE-ALERT-PAGE";
void "TABS-MUST-NOT-WRITE-CHIP-PAGE";
void "TABS-MUST-NOT-WRITE-BADGE-PAGE";
void "TABS-MUST-NOT-WRITE-AVATAR-PAGE";
void "TABS-MUST-NOT-WRITE-LINK-PAGE";
void "TABS-MUST-NOT-WRITE-TOOLTIP-PAGE";
if(figma.currentPage&&figma.currentPage.id==="115:295378")throw new Error("TABS-MUST-NOT-WRITE-INPUT-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:76193")throw new Error("TABS-MUST-NOT-WRITE-TABS-V1-PAGE");
if(figma.currentPage&&figma.currentPage.id==="163:35981")throw new Error("TABS-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:70641")throw new Error("TABS-MUST-NOT-WRITE-COMBOBOX-V42-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:69150")throw new Error("TABS-MUST-NOT-WRITE-BUTTON-PAGE");
if(figma.currentPage&&figma.currentPage.id==="85:6781")throw new Error("TABS-MUST-NOT-WRITE-PRESERVED-BUTTON-PAGE");
if(figma.currentPage&&figma.currentPage.id==="173:48924")throw new Error("TABS-MUST-NOT-WRITE-TABLE-PAGE");
if(figma.currentPage&&figma.currentPage.id==="181:64873")throw new Error("TABS-MUST-NOT-WRITE-CALENDAR-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:74742")throw new Error("TABS-MUST-NOT-WRITE-CHECKBOX-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75031")throw new Error("TABS-MUST-NOT-WRITE-RADIO-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75302")throw new Error("TABS-MUST-NOT-WRITE-SWITCH-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75495")throw new Error("TABS-MUST-NOT-WRITE-TEXTAREA-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75801")throw new Error("TABS-MUST-NOT-WRITE-ALERT-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75976")throw new Error("TABS-MUST-NOT-WRITE-CHIP-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:76022")throw new Error("TABS-MUST-NOT-WRITE-BADGE-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:76063")throw new Error("TABS-MUST-NOT-WRITE-AVATAR-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:76109")throw new Error("TABS-MUST-NOT-WRITE-LINK-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:76151")throw new Error("TABS-MUST-NOT-WRITE-TOOLTIP-PAGE");
await figma.loadAllPagesAsync();
const setSharedData=(target,key,value)=>target.setSharedPluginData(NS,key,String(value));
const getSharedData=(target,key)=>target.getSharedPluginData(NS,key);
let page=figma.root.children.find(candidate=>candidate.name===PLAN.pageName);
const createdNodeIds=[],mutatedNodeIds=[];
if(page){
  if(getSharedData(page,"pageOwner")!==PAGE_OWNER)throw new Error("TABS-PAGE-OWNERSHIP-COLLISION:"+page.id);
  if(getSharedData(page,"runIdentity")!==PLAN.runIdentity)throw new Error("TABS-PAGE-IDENTITY-MISMATCH:"+page.id);
}else{
  page=figma.createPage();page.name=PLAN.pageName;createdNodeIds.push(page.id);
}
if(page.id==="115:295378")throw new Error("TABS-MUST-NOT-WRITE-INPUT-PAGE");
if(page.id==="163:35981")throw new Error("TABS-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(page.id==="183:70641")throw new Error("TABS-MUST-NOT-WRITE-COMBOBOX-V42-PAGE");
if(page.id==="183:69150")throw new Error("TABS-MUST-NOT-WRITE-BUTTON-PAGE");
if(page.id==="85:6781")throw new Error("TABS-MUST-NOT-WRITE-PRESERVED-BUTTON-PAGE");
if(page.id==="173:48924")throw new Error("TABS-MUST-NOT-WRITE-TABLE-PAGE");
if(page.id==="181:64873")throw new Error("TABS-MUST-NOT-WRITE-CALENDAR-PAGE");
if(page.id==="183:74742")throw new Error("TABS-MUST-NOT-WRITE-CHECKBOX-PAGE");
if(page.id==="183:75031")throw new Error("TABS-MUST-NOT-WRITE-RADIO-PAGE");
if(page.id==="183:75302")throw new Error("TABS-MUST-NOT-WRITE-SWITCH-PAGE");
if(page.id==="183:75495")throw new Error("TABS-MUST-NOT-WRITE-TEXTAREA-PAGE");
if(page.id==="183:75801")throw new Error("TABS-MUST-NOT-WRITE-ALERT-PAGE");
if(page.id==="183:75976")throw new Error("TABS-MUST-NOT-WRITE-CHIP-PAGE");
if(page.id==="183:76022")throw new Error("TABS-MUST-NOT-WRITE-BADGE-PAGE");
if(page.id==="183:76063")throw new Error("TABS-MUST-NOT-WRITE-AVATAR-PAGE");
if(page.id==="183:76109")throw new Error("TABS-MUST-NOT-WRITE-LINK-PAGE");
if(page.id==="183:76151")throw new Error("TABS-MUST-NOT-WRITE-TOOLTIP-PAGE");
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
  if(!found)throw new Error("TABS-FONT-UNAVAILABLE:"+spec.requestedFamily+":"+spec.requestedStyle);
  const resolution=found.fontName.family===spec.requestedFamily&&found.fontName.style===spec.requestedStyle?"requested":"fallback";
  if(found.fontName.family!==spec.resolvedFamily||found.fontName.style!==spec.resolvedStyle||resolution!==spec.resolution)throw new Error("TABS-FONT-PROVENANCE-TAMPER:"+found.fontName.family+":"+found.fontName.style);
  if(resolution==="fallback"&&!spec.degradation)throw new Error("TABS-FONT-FALLBACK-WITHOUT-DEGRADATION");
  return found.fontName;
};
const summaries=[];
let nextSectionX=0;
for(const child of page.children){
  if(child.type==="SECTION")nextSectionX=Math.max(nextSectionX,child.x+child.width+240);
}
for(const source of PLAN.sources){
  const existingSection=page.children.find(node=>node.type==="SECTION"&&getSharedData(node,"adapterIdentity")===source.adapterIdentity&&getSharedData(node,"recipeHash")===source.recipeHash);
  if(existingSection)throw new Error("TABS-SECTION-EXISTS:"+source.adapterIdentity+":"+existingSection.id);
  const section=figma.createSection();
  section.name="Recipe Pivot / "+source.displayName+" / "+source.recipeHash.slice(0,8);
  section.x=nextSectionX;section.y=0;page.appendChild(section);
  setSharedData(section,"adapterIdentity",source.adapterIdentity);
  setSharedData(section,"recipeHash",source.recipeHash);
  createdNodeIds.push(section.id);
  const collectionName="Recipe Tabs / "+PLAN.runIdentity+" / "+source.adapterIdentity;
  const localCollections=figma.variables.getLocalVariableCollectionsAsync?await figma.variables.getLocalVariableCollectionsAsync():[];
  if(localCollections.some(candidate=>candidate.name===collectionName))throw new Error("TABS-VARIABLE-COLLECTION-COLLISION:"+collectionName);
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
        bindFloat(node,"strokeWeight",bindingFor(ir,"strokes.0.weight"));
      }
    }
    if(ir.cornerRadius){
      for(const [irKey,figmaKey] of [["topLeft","topLeftRadius"],["topRight","topRightRadius"],["bottomRight","bottomRightRadius"],["bottomLeft","bottomLeftRadius"]]){
        node[figmaKey]=ir.cornerRadius[irKey];bindFloat(node,figmaKey,bindingFor(ir,"cornerRadius."+irKey));
      }
    }
  };
  const align={min:"MIN",center:"CENTER",max:"MAX","space-between":"SPACE_BETWEEN",baseline:"BASELINE"};
  const applyLayout=(node,ir)=>{
    const layout=ir.layout;
    node.layoutMode=layout.mode.toUpperCase();
    node.primaryAxisAlignItems=align[layout.primaryAxisAlign];
    node.counterAxisAlignItems=align[layout.counterAxisAlign];
    node.itemSpacing=layout.itemSpacing;
    node.paddingTop=Math.max(0,layout.padding.top);node.paddingRight=Math.max(0,layout.padding.right);node.paddingBottom=Math.max(0,layout.padding.bottom);node.paddingLeft=Math.max(0,layout.padding.left);
    if(ir.clipsContent!==undefined)node.clipsContent=ir.clipsContent;
    bindFloat(node,"itemSpacing",bindingFor(ir,"layout.itemSpacing"));
    for(const [key,field] of [["paddingTop","top"],["paddingRight","right"],["paddingBottom","bottom"],["paddingLeft","left"]])bindFloat(node,key,bindingFor(ir,"layout.padding."+field));
  };
  const applySizing=(node,ir)=>{
    const width=ir.layout?ir.layout.width:ir.width,height=ir.layout?ir.layout.height:ir.height;
    const fixedWidth=width.mode==="fixed"?width.value:Math.max(node.width,1),fixedHeight=height.mode==="fixed"?height.value:Math.max(node.height,1);
    if(width.mode==="fixed"||height.mode==="fixed")node.resizeWithoutConstraints(fixedWidth,fixedHeight);
    if(width.mode==="fill")node.layoutSizingHorizontal="FILL";
    else if(width.mode==="hug")node.layoutSizingHorizontal="HUG";
    else node.layoutSizingHorizontal="FIXED";
    if(height.mode==="fill")node.layoutSizingVertical="FILL";
    else if(height.mode==="hug")node.layoutSizingVertical="HUG";
    else node.layoutSizingVertical="FIXED";
    if(ir.layout){
      node.primaryAxisSizingMode=(ir.layout.mode==="horizontal"?width:height).mode==="hug"?"AUTO":"FIXED";
      node.counterAxisSizingMode=(ir.layout.mode==="horizontal"?height:width).mode==="hug"?"AUTO":"FIXED";
    }
    if(ir.layout&&ir.layout.minWidth!==undefined){node.minWidth=ir.layout.minWidth;bindFloat(node,"minWidth",bindingFor(ir,"layout.minWidth"));}
    if(ir.layout&&ir.layout.minHeight!==undefined){node.minHeight=ir.layout.minHeight;bindFloat(node,"minHeight",bindingFor(ir,"layout.minHeight"));}
    bindFloat(node,"width",bindingFor(ir,"width.value")||bindingFor(ir,"layout.width.value"));
    bindFloat(node,"height",bindingFor(ir,"height.value")||bindingFor(ir,"layout.height.value"));
  };
  const applyComponentLayout=(node,ir)=>{applyLayout(node,ir);applyPaints(node,ir);applySizing(node,ir);};
  const firstSegment=name=>name.split(" :: ",1)[0];
  void "TABS-WRITER-FIRST-SEGMENT-BIND";
  const render=async(ir,parent,ownershipKey)=>{
    let node;
    if(ir.kind==="frame")node=figma.createFrame();
    else if(ir.kind==="text"){
      if(!ir.type.fontProvenance)throw new Error("TABS-FONT-PROVENANCE-ABSENT:"+ir.role);
      const label=figma.createText();const font=resolveFont(ir.type.fontProvenance);await figma.loadFontAsync(font);
      label.fontName=font;label.characters=ir.characters;label.fontSize=ir.type.fontSize;
      label.lineHeight=ir.type.lineHeight.unit==="px"?{unit:"PIXELS",value:ir.type.lineHeight.value}:ir.type.lineHeight.unit==="percent"?{unit:"PERCENT",value:ir.type.lineHeight.value}:{unit:"AUTO"};if(ir.type.textCase==="upper")label.textCase="UPPER";
      label.textDecoration=ir.type.textDecoration==="underline"?"UNDERLINE":ir.type.textDecoration==="strikethrough"?"STRIKETHROUGH":"NONE";
      label.textAlignHorizontal=ir.align.toUpperCase();label.textAlignVertical=ir.verticalAlign.toUpperCase();
      label.textAutoResize="WIDTH_AND_HEIGHT";label.blendMode="NORMAL";
      void "TABS-WRITER-HUG-TEXT-POST-CHARACTER-INTRINSIC";
      void "TABS-WRITER-NAMED-FALLBACK-AFTER-ZERO-GLYPH";
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
        if(!painted&&(label.width<=0||label.absoluteRenderBounds===null))throw new Error("TABS-FONT-ZERO-INTRINSIC:"+ir.role);
      }
      node=label;
    }else throw new Error("UNSUPPORTED-CHILD-KIND:"+ir.kind);
    node.visible=ir.visible!==false;node.opacity=ir.opacity===undefined?1:ir.opacity;
    node.name=ir.role&&ir.label&&ir.role!==ir.label?ir.role+" :: "+ir.label:(ir.label||ir.role||ir.kind);
    if(ir.kind==="text"&&ir.type.fontProvenance)node.name+=" :: font-provenance="+encodeURIComponent(JSON.stringify(ir.type.fontProvenance));
    let hugTextIntrinsic=null;
    if(ir.kind==="text"){
      void "TABS-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE";
      void "TABS-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC";
      if(node.width<=0||node.height<=0)throw new Error("TABS-TEXT-GEOMETRY:"+ir.role);
      hugTextIntrinsic={width:node.width,height:node.height};
    }
    tag(node,ir,ownershipKey);if(ir.kind!=="instance")applyPaints(node,ir);parent.appendChild(node);
    if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
    if(ir.kind==="frame"){applyLayout(node,ir);const hugKids=[],fillKids=[];for(const [childIndex,child] of ir.children.entries()){const width=child.layout?child.layout.width:child.width;((width&&width.mode==="fill")?fillKids:hugKids).push([childIndex,child]);}for(const [childIndex,child] of hugKids)await render(child,node,ownershipKey+"/children/"+childIndex);applySizing(node,ir);for(const [childIndex,child] of fillKids)await render(child,node,ownershipKey+"/children/"+childIndex);}
    else applySizing(node,ir);
    if(ir.kind==="text"){
      bindFloat(node,"fontSize",bindingFor(ir,"type.fontSize"));bindFloat(node,"lineHeight",bindingFor(ir,"type.lineHeight.value"));
      if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
      if(node.characters.trim().length===0||node.width<=0||node.height<=0)throw new Error("TABS-TEXT-GEOMETRY:"+ir.role);
    }
    createdNodeIds.push(node.id);return node;
  };
  const mintComponent=async(ir)=>{
    const component=figma.createComponent();component.clipsContent=false;
    void "TABS-WRITER-COMPONENT-NAME-CARRIES-COMPILE-LABEL";
    component.name=ir.role+" :: "+(ir.label||source.sourceName);
    component.description="Experimental tabs@1 primitive-IR mint. Recipe "+source.recipeHash+"; source adapter "+source.adapterIdentity+".";
    if(ir.opacity!==undefined)component.opacity=ir.opacity;
    tag(component,ir,"tabs");applyLayout(component,ir);applyPaints(component,ir);
    section.appendChild(component);
    const hugKids=[],fillKids=[];
    for(const [childIndex,child] of ir.children.entries()){const width=child.layout?child.layout.width:child.width;((width&&width.mode==="fill")?fillKids:hugKids).push([childIndex,child]);}
    for(const [childIndex,child] of hugKids)await render(child,component,"tabs/children/"+childIndex);
    applySizing(component,ir);
    for(const [childIndex,child] of fillKids)await render(child,component,"tabs/children/"+childIndex);
    if(component.layoutMode!=="HORIZONTAL"&&component.layoutMode!=="VERTICAL")throw new Error("TABS-FAKE-LAYOUT:"+component.name);
    createdNodeIds.push(component.id);
    const container=figma.createFrame();
    container.name="Component Container";
    container.layoutMode="NONE";
    container.fills=[];
    container.x=80;container.y=96;
    section.appendChild(container);
    container.appendChild(component);
    createdNodeIds.push(container.id);
    setSharedData(container,"runIdentity",PLAN.runIdentity);setSharedData(container,"adapterIdentity",source.adapterIdentity);setSharedData(container,"recipeHash",source.recipeHash);setSharedData(container,"ownershipKey","tabs/container");
    return {component,container};
  };
  const minted=await mintComponent(source.chip);
  section.resizeWithoutConstraints(minted.container.width+160,minted.container.y+minted.container.height+80);
  nextSectionX+=section.width+240;
  summaries.push({adapterIdentity:source.adapterIdentity,sectionId:section.id,componentId:minted.component.id,containerId:minted.container.id,collectionId:collection.id,variableCount:variables.size,variantCount:1,recipeHash:source.recipeHash,envelopeHash:source.envelopeHash,comparedIrFacts:source.comparedIrFacts});
}
return{writerVersion:Number(WRITER_VERSION),fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,runIdentity:PLAN.runIdentity,namespace:NS,createdNodeIds:[...new Set(createdNodeIds)],mutatedNodeIds:[...new Set(mutatedNodeIds)],sources:summaries};
