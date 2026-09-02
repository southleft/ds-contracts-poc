const PLAN={"pageName":"Recipe Pivot / Dialog / e482eb49-b275da16-d479cda5-dialog-v5-plugin","runIdentity":"e482eb49-b275da16-d479cda5-dialog-v5-plugin","sources":[{"adapterIdentity":"astryx-dialog-reviewed-v1","displayName":"Astryx","sourceName":"Astryx Dialog","recipeHash":"e482eb490976c22f9c7527fbe8d3fb545ef450d75e7a03c75c1b392cb9371a8f","envelopeHash":"283d1e67fc48321a82eb4834bc30d0ce09fdd167fed47c5a221139767aae68e6","variables":[{"identity":"astryx.dialog.body","name":"token/color/id-6173747279782e6469616c6f672e626f6479","type":"COLOR","value":"#0a1317ff"},{"identity":"astryx.dialog.paper-fill","name":"token/color/id-6173747279782e6469616c6f672e70617065722d66696c6c","type":"COLOR","value":"#ffffffff"},{"identity":"astryx.dialog.title","name":"token/color/id-6173747279782e6469616c6f672e7469746c65","type":"COLOR","value":"#0a1317ff"},{"identity":"astryx.dialog.bodyFontSize","name":"token/float/id-6173747279782e6469616c6f672e626f6479466f6e7453697a65","type":"FLOAT","value":14},{"identity":"astryx.dialog.bodyLineHeight","name":"token/float/id-6173747279782e6469616c6f672e626f64794c696e65486569676874","type":"FLOAT","value":20},{"identity":"astryx.dialog.paper-itemSpacing","name":"token/float/id-6173747279782e6469616c6f672e70617065722d6974656d53706163696e67","type":"FLOAT","value":0},{"identity":"astryx.dialog.paper-minWidth","name":"token/float/id-6173747279782e6469616c6f672e70617065722d6d696e5769647468","type":"FLOAT","value":400},{"identity":"astryx.dialog.paper-paddingX","name":"token/float/id-6173747279782e6469616c6f672e70617065722d70616464696e6758","type":"FLOAT","value":16},{"identity":"astryx.dialog.paper-paddingY","name":"token/float/id-6173747279782e6469616c6f672e70617065722d70616464696e6759","type":"FLOAT","value":16},{"identity":"astryx.dialog.paper-radius","name":"token/float/id-6173747279782e6469616c6f672e70617065722d726164697573","type":"FLOAT","value":12},{"identity":"astryx.dialog.titleFontSize","name":"token/float/id-6173747279782e6469616c6f672e7469746c65466f6e7453697a65","type":"FLOAT","value":20},{"identity":"astryx.dialog.titleLineHeight","name":"token/float/id-6173747279782e6469616c6f672e7469746c654c696e65486569676874","type":"FLOAT","value":28}],"comparedIrFacts":20,"chip":{"label":"Astryx Dialog","role":"dialog/variant/default","bindings":[{"field":"layout.itemSpacing","type":"FLOAT","variable":"astryx.dialog.paper-itemSpacing"},{"field":"layout.padding.top","type":"FLOAT","variable":"astryx.dialog.paper-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"astryx.dialog.paper-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"astryx.dialog.paper-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"astryx.dialog.paper-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.dialog.paper-fill"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"astryx.dialog.paper-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"astryx.dialog.paper-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"astryx.dialog.paper-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"astryx.dialog.paper-radius"},{"field":"layout.minWidth","type":"FLOAT","variable":"astryx.dialog.paper-minWidth"}],"kind":"component","layout":{"mode":"vertical","primaryAxisAlign":"min","counterAxisAlign":"min","itemSpacing":0,"padding":{"top":16,"right":16,"bottom":16,"left":16},"width":{"mode":"hug"},"height":{"mode":"hug"},"minWidth":400},"fills":[{"kind":"solid","color":"#ffffffff"}],"cornerRadius":{"topLeft":12,"topRight":12,"bottomRight":12,"bottomLeft":12},"variantProperties":{"Default":"true"},"children":[{"label":"dialog/title","role":"dialog/title","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"astryx.dialog.titleFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"astryx.dialog.titleLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.dialog.title"}],"kind":"text","characters":"Dialog title","type":{"fontFamily":"SF Pro","fontStyle":"Semibold","fontProvenance":{"requestedFamily":"-apple-system","requestedStyle":"Semibold","requestSource":"DialogHeader Heading level 2 --text-heading-2-size 20 / --text-heading-2-leading 1.4 → 28 Semibold","fallbackChain":[{"family":"-apple-system","style":"Semibold"},{"family":"SF Pro","style":"Semibold"},{"family":"Roboto","style":"Medium"},{"family":"Helvetica","style":"Bold"},{"family":"Arial","style":"Bold"}],"resolvedFamily":"SF Pro","resolvedStyle":"Semibold","resolution":"fallback","degradation":"source -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif Semibold; Figma cannot load a CSS stack; first named host font is SF Pro Semibold"},"fontSize":20,"lineHeight":{"unit":"px","value":28}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#0a1317ff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}},{"label":"dialog/body","role":"dialog/body","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"astryx.dialog.bodyFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"astryx.dialog.bodyLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.dialog.body"}],"kind":"text","characters":"Dialog body","type":{"fontFamily":"SF Pro","fontStyle":"Regular","fontProvenance":{"requestedFamily":"-apple-system","requestedStyle":"Regular","requestSource":"Dialog children Layout content; Text body --text-label-size 14 / 20 Regular --color-text-primary","fallbackChain":[{"family":"-apple-system","style":"Regular"},{"family":"SF Pro","style":"Regular"},{"family":"Segoe UI","style":"Regular"},{"family":"Roboto","style":"Regular"},{"family":"Helvetica","style":"Regular"},{"family":"Arial","style":"Regular"}],"resolvedFamily":"SF Pro","resolvedStyle":"Regular","resolution":"fallback","degradation":"source -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif Regular; Figma cannot load a CSS stack; first named host font is SF Pro Regular"},"fontSize":14,"lineHeight":{"unit":"px","value":20}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#0a1317ff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]}},{"adapterIdentity":"mui-dialog-reviewed-v1","displayName":"MUI","sourceName":"MUI Dialog","recipeHash":"b275da1672c18ab147c939c61bdc8192e415acf3bc412ea9758c6a91e6780ac7","envelopeHash":"f544a21b36616c339406b8a055782462b9886dac674bb0a9bfbe14a877969b55","variables":[{"identity":"mui.dialog.body","name":"token/color/id-6d75692e6469616c6f672e626f6479","type":"COLOR","value":"#000000de"},{"identity":"mui.dialog.paper-fill","name":"token/color/id-6d75692e6469616c6f672e70617065722d66696c6c","type":"COLOR","value":"#ffffffff"},{"identity":"mui.dialog.title","name":"token/color/id-6d75692e6469616c6f672e7469746c65","type":"COLOR","value":"#000000de"},{"identity":"mui.dialog.bodyFontSize","name":"token/float/id-6d75692e6469616c6f672e626f6479466f6e7453697a65","type":"FLOAT","value":16},{"identity":"mui.dialog.bodyLineHeight","name":"token/float/id-6d75692e6469616c6f672e626f64794c696e65486569676874","type":"FLOAT","value":24},{"identity":"mui.dialog.paper-itemSpacing","name":"token/float/id-6d75692e6469616c6f672e70617065722d6974656d53706163696e67","type":"FLOAT","value":0},{"identity":"mui.dialog.paper-minWidth","name":"token/float/id-6d75692e6469616c6f672e70617065722d6d696e5769647468","type":"FLOAT","value":600},{"identity":"mui.dialog.paper-paddingX","name":"token/float/id-6d75692e6469616c6f672e70617065722d70616464696e6758","type":"FLOAT","value":24},{"identity":"mui.dialog.paper-paddingY","name":"token/float/id-6d75692e6469616c6f672e70617065722d70616464696e6759","type":"FLOAT","value":16},{"identity":"mui.dialog.paper-radius","name":"token/float/id-6d75692e6469616c6f672e70617065722d726164697573","type":"FLOAT","value":4},{"identity":"mui.dialog.titleFontSize","name":"token/float/id-6d75692e6469616c6f672e7469746c65466f6e7453697a65","type":"FLOAT","value":20},{"identity":"mui.dialog.titleLineHeight","name":"token/float/id-6d75692e6469616c6f672e7469746c654c696e65486569676874","type":"FLOAT","value":32}],"comparedIrFacts":20,"chip":{"label":"MUI Dialog","role":"dialog/variant/default","bindings":[{"field":"layout.itemSpacing","type":"FLOAT","variable":"mui.dialog.paper-itemSpacing"},{"field":"layout.padding.top","type":"FLOAT","variable":"mui.dialog.paper-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"mui.dialog.paper-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"mui.dialog.paper-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"mui.dialog.paper-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"mui.dialog.paper-fill"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"mui.dialog.paper-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"mui.dialog.paper-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"mui.dialog.paper-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"mui.dialog.paper-radius"},{"field":"layout.minWidth","type":"FLOAT","variable":"mui.dialog.paper-minWidth"}],"kind":"component","layout":{"mode":"vertical","primaryAxisAlign":"min","counterAxisAlign":"min","itemSpacing":0,"padding":{"top":16,"right":24,"bottom":16,"left":24},"width":{"mode":"hug"},"height":{"mode":"hug"},"minWidth":600},"fills":[{"kind":"solid","color":"#ffffffff"}],"cornerRadius":{"topLeft":4,"topRight":4,"bottomRight":4,"bottomLeft":4},"variantProperties":{"Default":"true"},"children":[{"label":"dialog/title","role":"dialog/title","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"mui.dialog.titleFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"mui.dialog.titleLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"mui.dialog.title"}],"kind":"text","characters":"Dialog title","type":{"fontFamily":"Roboto","fontStyle":"Medium","fontProvenance":{"requestedFamily":"Roboto","requestedStyle":"Medium","requestSource":"DialogTitle variant h6; createTypography h6 fontWeightMedium 20 lineHeight 1.6 → 32","fallbackChain":[{"family":"Roboto","style":"Medium"},{"family":"Helvetica","style":"Bold"},{"family":"Arial","style":"Bold"}],"resolvedFamily":"Roboto","resolvedStyle":"Medium","resolution":"requested"},"fontSize":20,"lineHeight":{"unit":"px","value":32}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#000000de"}],"width":{"mode":"hug"},"height":{"mode":"hug"}},{"label":"dialog/body","role":"dialog/body","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"mui.dialog.bodyFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"mui.dialog.bodyLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"mui.dialog.body"}],"kind":"text","characters":"Dialog body","type":{"fontFamily":"Roboto","fontStyle":"Regular","fontProvenance":{"requestedFamily":"Roboto","requestedStyle":"Regular","requestSource":"DialogContent inherits theme.typography.body1 16 Regular lineHeight 1.5 → 24","fallbackChain":[{"family":"Roboto","style":"Regular"},{"family":"Helvetica","style":"Regular"},{"family":"Arial","style":"Regular"}],"resolvedFamily":"Roboto","resolvedStyle":"Regular","resolution":"requested"},"fontSize":16,"lineHeight":{"unit":"px","value":24}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#000000de"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]}},{"adapterIdentity":"antd-dialog-reviewed-v1","displayName":"Ant Design","sourceName":"Ant Design Modal","recipeHash":"d479cda5dd84ed7a52f65ea671e23e51695c9ce4181be9a8b8807c11fc27ea6d","envelopeHash":"30905d72b7c48bac63d8cab6c603ab3dc70d695a28a658655dd08f9e9313b485","variables":[{"identity":"antd.dialog.body","name":"token/color/id-616e74642e6469616c6f672e626f6479","type":"COLOR","value":"#000000e0"},{"identity":"antd.dialog.paper-fill","name":"token/color/id-616e74642e6469616c6f672e70617065722d66696c6c","type":"COLOR","value":"#ffffffff"},{"identity":"antd.dialog.title","name":"token/color/id-616e74642e6469616c6f672e7469746c65","type":"COLOR","value":"#000000e0"},{"identity":"antd.dialog.bodyFontSize","name":"token/float/id-616e74642e6469616c6f672e626f6479466f6e7453697a65","type":"FLOAT","value":14},{"identity":"antd.dialog.bodyLineHeight","name":"token/float/id-616e74642e6469616c6f672e626f64794c696e65486569676874","type":"FLOAT","value":22},{"identity":"antd.dialog.paper-itemSpacing","name":"token/float/id-616e74642e6469616c6f672e70617065722d6974656d53706163696e67","type":"FLOAT","value":8},{"identity":"antd.dialog.paper-minWidth","name":"token/float/id-616e74642e6469616c6f672e70617065722d6d696e5769647468","type":"FLOAT","value":520},{"identity":"antd.dialog.paper-paddingX","name":"token/float/id-616e74642e6469616c6f672e70617065722d70616464696e6758","type":"FLOAT","value":24},{"identity":"antd.dialog.paper-paddingY","name":"token/float/id-616e74642e6469616c6f672e70617065722d70616464696e6759","type":"FLOAT","value":20},{"identity":"antd.dialog.paper-radius","name":"token/float/id-616e74642e6469616c6f672e70617065722d726164697573","type":"FLOAT","value":8},{"identity":"antd.dialog.titleFontSize","name":"token/float/id-616e74642e6469616c6f672e7469746c65466f6e7453697a65","type":"FLOAT","value":16},{"identity":"antd.dialog.titleLineHeight","name":"token/float/id-616e74642e6469616c6f672e7469746c654c696e65486569676874","type":"FLOAT","value":24}],"comparedIrFacts":20,"chip":{"label":"Ant Design Modal","role":"dialog/variant/default","bindings":[{"field":"layout.itemSpacing","type":"FLOAT","variable":"antd.dialog.paper-itemSpacing"},{"field":"layout.padding.top","type":"FLOAT","variable":"antd.dialog.paper-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"antd.dialog.paper-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"antd.dialog.paper-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"antd.dialog.paper-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"antd.dialog.paper-fill"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"antd.dialog.paper-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"antd.dialog.paper-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"antd.dialog.paper-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"antd.dialog.paper-radius"},{"field":"layout.minWidth","type":"FLOAT","variable":"antd.dialog.paper-minWidth"}],"kind":"component","layout":{"mode":"vertical","primaryAxisAlign":"min","counterAxisAlign":"min","itemSpacing":8,"padding":{"top":20,"right":24,"bottom":20,"left":24},"width":{"mode":"hug"},"height":{"mode":"hug"},"minWidth":520},"fills":[{"kind":"solid","color":"#ffffffff"}],"cornerRadius":{"topLeft":8,"topRight":8,"bottomRight":8,"bottomLeft":8},"variantProperties":{"Default":"true"},"children":[{"label":"dialog/title","role":"dialog/title","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"antd.dialog.titleFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"antd.dialog.titleLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"antd.dialog.title"}],"kind":"text","characters":"Dialog title","type":{"fontFamily":"SF Pro","fontStyle":"Semibold","fontProvenance":{"requestedFamily":"-apple-system","requestedStyle":"Semibold","requestSource":"antd Modal titleFontSize fontSizeHeading5 16; titleLineHeight lineHeightHeading5 1.5 → 24; fontWeightStrong","fallbackChain":[{"family":"-apple-system","style":"Semibold"},{"family":"SF Pro","style":"Semibold"},{"family":"Roboto","style":"Medium"},{"family":"Helvetica Neue","style":"Bold"},{"family":"Arial","style":"Bold"}],"resolvedFamily":"SF Pro","resolvedStyle":"Semibold","resolution":"fallback","degradation":"antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Semibold"},"fontSize":16,"lineHeight":{"unit":"px","value":24}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#000000e0"}],"width":{"mode":"hug"},"height":{"mode":"hug"}},{"label":"dialog/body","role":"dialog/body","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"antd.dialog.bodyFontSize"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"antd.dialog.bodyLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"antd.dialog.body"}],"kind":"text","characters":"Dialog body","type":{"fontFamily":"SF Pro","fontStyle":"Regular","fontProvenance":{"requestedFamily":"-apple-system","requestedStyle":"Regular","requestSource":"antd/es/modal/style body fontSize 14; resetComponent lineHeight 1.5714 → 22","fallbackChain":[{"family":"-apple-system","style":"Regular"},{"family":"SF Pro","style":"Regular"},{"family":"Segoe UI","style":"Regular"},{"family":"Roboto","style":"Regular"},{"family":"Helvetica Neue","style":"Regular"},{"family":"Arial","style":"Regular"}],"resolvedFamily":"SF Pro","resolvedStyle":"Regular","resolution":"fallback","degradation":"antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Regular"},"fontSize":14,"lineHeight":{"unit":"px","value":22}},"align":"left","verticalAlign":"center","fills":[{"kind":"solid","color":"#000000e0"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]}}]};
const NS="ds.contracts.dialog.recipe.v1";
const WRITER_VERSION="1";
const PAGE_OWNER="recipe/dialog/"+PLAN.runIdentity;
void "DIALOG-WRITER-SHARED-RUNTIME";

void "DIALOG-WRITER-PLUGIN-TARGET-NO-FILE-PIN";
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR:"+figma.editorType);


await figma.loadAllPagesAsync();
const setSharedData=(target,key,value)=>target.setSharedPluginData(NS,key,String(value));
const getSharedData=(target,key)=>target.getSharedPluginData(NS,key);
let page=figma.root.children.find(candidate=>candidate.name===PLAN.pageName);
const createdNodeIds=[],mutatedNodeIds=[];
if(page){
  if(getSharedData(page,"pageOwner")!==PAGE_OWNER)throw new Error("DIALOG-PAGE-OWNERSHIP-COLLISION:"+page.id);
  if(getSharedData(page,"runIdentity")!==PLAN.runIdentity)throw new Error("DIALOG-PAGE-IDENTITY-MISMATCH:"+page.id);
}else{
  page=figma.createPage();page.name=PLAN.pageName;createdNodeIds.push(page.id);
}

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
  if(!found)throw new Error("DIALOG-FONT-UNAVAILABLE:"+spec.requestedFamily+":"+spec.requestedStyle);
  const resolution=found.fontName.family===spec.requestedFamily&&found.fontName.style===spec.requestedStyle?"requested":"fallback";
  if(found.fontName.family!==spec.resolvedFamily||found.fontName.style!==spec.resolvedStyle||resolution!==spec.resolution)throw new Error("DIALOG-FONT-PROVENANCE-TAMPER:"+found.fontName.family+":"+found.fontName.style);
  if(resolution==="fallback"&&!spec.degradation)throw new Error("DIALOG-FONT-FALLBACK-WITHOUT-DEGRADATION");
  return found.fontName;
};
const summaries=[];
let nextSectionX=0;
for(const child of page.children){
  if(child.type==="SECTION")nextSectionX=Math.max(nextSectionX,child.x+child.width+240);
}
for(const source of PLAN.sources){
  const existingSection=page.children.find(node=>node.type==="SECTION"&&getSharedData(node,"adapterIdentity")===source.adapterIdentity&&getSharedData(node,"recipeHash")===source.recipeHash);
  if(existingSection)throw new Error("DIALOG-SECTION-EXISTS:"+source.adapterIdentity+":"+existingSection.id);
  const section=figma.createSection();
  section.name="Recipe Pivot / "+source.displayName+" / "+source.recipeHash.slice(0,8);
  section.x=nextSectionX;section.y=0;page.appendChild(section);
  setSharedData(section,"adapterIdentity",source.adapterIdentity);
  setSharedData(section,"recipeHash",source.recipeHash);
  createdNodeIds.push(section.id);
  const collectionName="Recipe Dialog / "+PLAN.runIdentity+" / "+source.adapterIdentity;
  const localCollections=figma.variables.getLocalVariableCollectionsAsync?await figma.variables.getLocalVariableCollectionsAsync():[];
  if(localCollections.some(candidate=>candidate.name===collectionName))throw new Error("DIALOG-VARIABLE-COLLECTION-COLLISION:"+collectionName);
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
    void "DIALOG-WRITER-EFFECTS";
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
    void "DIALOG-WRITER-CLIPS-ONLY-WHEN-SAID";
    // Figma's frame default is clipsContent=true; CSS's overflow default is
    // visible. A frame clips only when the IR says so — otherwise a box's own
    // shadow is cut off at a hit area the same size as the box (shadcn) —
    // EXCEPT that Figma renders a frame's own drop shadow like Chromium only
    // when that frame clips (MUI switch thumb tail, measured against the real
    // render 27/37/44/54: clipping 45/51/71/80, not clipping 73/76/84/88 and a
    // row longer). So a shadowed frame clips unless the IR says otherwise.
    const shadowed=Array.isArray(ir.effects)&&ir.effects.some(e=>e.kind==="drop-shadow");
    node.clipsContent=ir.clipsContent===undefined?shadowed:ir.clipsContent;
    void "DIALOG-WRITER-LAYOUT-MIN-WIDTH";
    if(layout.minWidth!==undefined){node.minWidth=layout.minWidth;bindFloat(node,"minWidth",bindingFor(ir,"layout.minWidth"));}
    if(layout.minHeight!==undefined){node.minHeight=layout.minHeight;bindFloat(node,"minHeight",bindingFor(ir,"layout.minHeight"));}
    if(layout.positioning==="absolute"){
      if(!layout.offset||!layout.constraints)throw new Error("DIALOG-OVERLAY-DECLARATION-INCOMPLETE:"+ir.role);
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
    void "DIALOG-WRITER-ABSOLUTE-CHILD-IS-FIXED-SIZED";
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
  void "DIALOG-WRITER-FIRST-SEGMENT-BIND";
  void "DIALOG-WRITER-PLACE-ABSOLUTE-AFTER-PARENT-SIZES";
  const placeAbsolute=(parentNode,parentIr)=>{
    for(const childIr of parentIr.children||[]){
      if(!isAbsolute(childIr))continue;
      const child=parentNode.children.find(c=>firstSegment(c.name)===childIr.role);
      if(!child)throw new Error("DIALOG-ABSOLUTE-CHILD-MISSING:"+childIr.role);
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
  void "DIALOG-WRITER-DEFER-FILL-UNTIL-AUTOLAYOUT-PARENT";
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
      if(!ir.type.fontProvenance)throw new Error("DIALOG-FONT-PROVENANCE-ABSENT:"+ir.role);
      const label=figma.createText();const font=resolveFont(ir.type.fontProvenance);await figma.loadFontAsync(font);
      label.fontName=font;label.characters=ir.characters;label.fontSize=ir.type.fontSize;
      label.lineHeight=ir.type.lineHeight.unit==="px"?{unit:"PIXELS",value:ir.type.lineHeight.value}:ir.type.lineHeight.unit==="percent"?{unit:"PERCENT",value:ir.type.lineHeight.value}:{unit:"AUTO"};
      void "DIALOG-WRITER-LETTER-SPACING";
      if(ir.type.letterSpacing)label.letterSpacing=ir.type.letterSpacing.unit==="px"?{unit:"PIXELS",value:ir.type.letterSpacing.value}:{unit:"PERCENT",value:ir.type.letterSpacing.value};
      if(ir.type.textCase==="upper")label.textCase="UPPER";else if(ir.type.textCase==="lower")label.textCase="LOWER";else if(ir.type.textCase==="title")label.textCase="TITLE";
      if(ir.type.textDecoration==="underline")label.textDecoration="UNDERLINE";else if(ir.type.textDecoration==="strikethrough")label.textDecoration="STRIKETHROUGH";
      label.textAlignHorizontal=ir.align.toUpperCase();label.textAlignVertical=ir.verticalAlign.toUpperCase();
      label.textAutoResize="WIDTH_AND_HEIGHT";label.blendMode="NORMAL";
      void "DIALOG-WRITER-HUG-TEXT-POST-CHARACTER-INTRINSIC";
      void "DIALOG-WRITER-NAMED-FALLBACK-AFTER-ZERO-GLYPH";
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
        if(!painted&&(label.width<=0||label.absoluteRenderBounds===null))throw new Error("DIALOG-FONT-ZERO-INTRINSIC:"+ir.role);
      }
      node=label;
    }else if(ir.kind==="vector"){
      void "DIALOG-WRITER-VECTOR-PATH";
      const vector=figma.createVector();
      vector.vectorPaths=[{windingRule:ir.windingRule==="evenodd"?"EVENODD":"NONZERO",data:ir.assetRef}];
      vector.effects=[];
      if(ir.strokeCap&&ir.strokeCap!=="none")vector.strokeCap=ir.strokeCap.toUpperCase();
      if(ir.strokeJoin)vector.strokeJoin=ir.strokeJoin.toUpperCase();
      if(ir.rotation)vector.rotation=ir.rotation;
      void "DIALOG-WRITER-GLYPH-BOUNDS-GUARD";
      const wantW=ir.width.mode==="fixed"?ir.width.value:vector.width,wantH=ir.height.mode==="fixed"?ir.height.value:vector.height;
      if(Math.abs(vector.width-wantW)>0.05||Math.abs(vector.height-wantH)>0.05)throw new Error("DIALOG-GLYPH-BOUNDS-MISMATCH:"+ir.role+":"+vector.width.toFixed(3)+"x"+vector.height.toFixed(3)+" vs "+wantW+"x"+wantH);
      node=vector;
    }else throw new Error("UNSUPPORTED-CHILD-KIND:"+ir.kind);
    node.visible=ir.visible!==false;node.opacity=ir.opacity===undefined?1:ir.opacity;
    node.name=ir.role&&ir.label&&ir.role!==ir.label?ir.role+" :: "+ir.label:(ir.label||ir.role||ir.kind);
    if(ir.kind==="text"&&ir.type.fontProvenance)node.name+=" :: font-provenance="+encodeURIComponent(JSON.stringify(ir.type.fontProvenance));
    let hugTextIntrinsic=null;
    if(ir.kind==="text"){
      void "DIALOG-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE";
      void "DIALOG-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC";
      if(node.width<=0||node.height<=0)throw new Error("DIALOG-TEXT-GEOMETRY:"+ir.role);
      hugTextIntrinsic={width:node.width,height:node.height};
    }
    tag(node,ir,ownershipKey);if(ir.kind!=="instance")applyPaints(node,ir);parent.appendChild(node);
    if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
    if(ir.kind==="frame"){applyLayout(node,ir);await renderChildren(node,ir,ownershipKey);applySizing(node,ir);placeAbsolute(node,ir);}
    else applySizing(node,ir);
    if(ir.kind==="text"){
      bindFloat(node,"fontSize",bindingFor(ir,"type.fontSize"));
      void "DIALOG-WRITER-PERCENT-LINE-HEIGHT-STAYS-LITERAL";
      if(ir.type.lineHeight.unit!=="percent")bindFloat(node,"lineHeight",bindingFor(ir,"type.lineHeight.value"));
      bindFloat(node,"letterSpacing",bindingFor(ir,"type.letterSpacing.value"));
      if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
      if(node.characters.trim().length===0||node.width<=0||node.height<=0)throw new Error("DIALOG-TEXT-GEOMETRY:"+ir.role);
    }
    createdNodeIds.push(node.id);return node;
  };
  const mintComponent=async(ir)=>{
    const component=figma.createComponent();component.clipsContent=false;
    void "DIALOG-WRITER-COMPONENT-NAME-CARRIES-COMPILE-LABEL";
    component.name=ir.role+" :: "+(ir.label||source.sourceName);
    component.description="Experimental dialog@1 primitive-IR mint. Recipe "+source.recipeHash+"; source adapter "+source.adapterIdentity+".";
    if(ir.opacity!==undefined)component.opacity=ir.opacity;
    tag(component,ir,"dialog");applyLayout(component,ir);applyPaints(component,ir);
    section.appendChild(component);
    await renderChildren(component,ir,"dialog/children");
    applySizing(component,ir);placeAbsolute(component,ir);
    if(component.layoutMode!=="HORIZONTAL"&&component.layoutMode!=="VERTICAL")throw new Error("DIALOG-FAKE-LAYOUT:"+component.name);
    createdNodeIds.push(component.id);
    const container=figma.createFrame();
    container.name="Component Container";
    container.layoutMode="NONE";
    container.fills=[];
    container.x=80;container.y=96;
    section.appendChild(container);
    container.appendChild(component);
    void "DIALOG-WRITER-CONTAINER-HUGS-COMPONENT";
    container.clipsContent=false;
    container.resizeWithoutConstraints(Math.max(1,component.width),Math.max(1,component.height));
    createdNodeIds.push(container.id);
    setSharedData(container,"runIdentity",PLAN.runIdentity);setSharedData(container,"adapterIdentity",source.adapterIdentity);setSharedData(container,"recipeHash",source.recipeHash);setSharedData(container,"ownershipKey","dialog/container");
    return {component,container};
  };
  const minted=await mintComponent(source.chip);
  section.resizeWithoutConstraints(minted.container.width+160,minted.container.y+minted.container.height+80);
  nextSectionX+=section.width+240;
  summaries.push({adapterIdentity:source.adapterIdentity,sectionId:section.id,componentId:minted.component.id,containerId:minted.container.id,collectionId:collection.id,variableCount:variables.size,variantCount:1,recipeHash:source.recipeHash,envelopeHash:source.envelopeHash,comparedIrFacts:source.comparedIrFacts});
}
return{writerVersion:Number(WRITER_VERSION),fileKey:figma.fileKey||null,fileName:figma.root.name,pageId:page.id,pageName:page.name,runIdentity:PLAN.runIdentity,namespace:NS,createdNodeIds:[...new Set(createdNodeIds)],mutatedNodeIds:[...new Set(mutatedNodeIds)],sources:summaries};
