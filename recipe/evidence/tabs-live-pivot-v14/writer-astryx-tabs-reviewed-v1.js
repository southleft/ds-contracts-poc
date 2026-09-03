const PLAN={"pageName":"Recipe Pivot / Tabs / d89bb28f-8b13b805-37ba5bd4-1dcf1c6d-e77937f5-tabs-v14","runIdentity":"d89bb28f-8b13b805-37ba5bd4-1dcf1c6d-e77937f5-tabs-v14","sources":[{"adapterIdentity":"astryx-tabs-reviewed-v1","displayName":"Astryx","sourceName":"Astryx TabList","recipeHash":"d89bb28f25573142b1d3ee055443a82b779ba667684c87f7b589aecf27db3bb7","envelopeHash":"9940e0330bc710cf14bbbc80f1fe2aaa3aba534e1e59b2e92af050d11b565c10","variables":[{"identity":"astryx.tabs.indicator-fill","name":"token/color/id-6173747279782e746162732e696e64696361746f722d66696c6c","type":"COLOR","value":"#0064e0ff"},{"identity":"astryx.tabs.rest-label","name":"token/color/id-6173747279782e746162732e726573742d6c6162656c","type":"COLOR","value":"#4e606fff"},{"identity":"astryx.tabs.selected-label","name":"token/color/id-6173747279782e746162732e73656c65637465642d6c6162656c","type":"COLOR","value":"#0a1317ff"},{"identity":"astryx.tabs.tab-fill","name":"token/color/id-6173747279782e746162732e7461622d66696c6c","type":"COLOR","value":"#00000000"},{"identity":"astryx.tabs.indicator-height","name":"token/float/id-6173747279782e746162732e696e64696361746f722d686569676874","type":"FLOAT","value":2},{"identity":"astryx.tabs.indicator-radius","name":"token/float/id-6173747279782e746162732e696e64696361746f722d726164697573","type":"FLOAT","value":9999},{"identity":"astryx.tabs.labelFontSize","name":"token/float/id-6173747279782e746162732e6c6162656c466f6e7453697a65","type":"FLOAT","value":14},{"identity":"astryx.tabs.labelLetterSpacing","name":"token/float/id-6173747279782e746162732e6c6162656c4c657474657253706163696e67","type":"FLOAT","value":0},{"identity":"astryx.tabs.labelLineHeight","name":"token/float/id-6173747279782e746162732e6c6162656c4c696e65486569676874","type":"FLOAT","value":20},{"identity":"astryx.tabs.list-itemSpacing","name":"token/float/id-6173747279782e746162732e6c6973742d6974656d53706163696e67","type":"FLOAT","value":2},{"identity":"astryx.tabs.tab-paddingX","name":"token/float/id-6173747279782e746162732e7461622d70616464696e6758","type":"FLOAT","value":12},{"identity":"astryx.tabs.tab-paddingY","name":"token/float/id-6173747279782e746162732e7461622d70616464696e6759","type":"FLOAT","value":0},{"identity":"astryx.tabs.tab-radius","name":"token/float/id-6173747279782e746162732e7461622d726164697573","type":"FLOAT","value":8}],"comparedIrFacts":39,"chip":{"label":"Astryx TabList","role":"tabs/variant/default","bindings":[{"field":"layout.itemSpacing","type":"FLOAT","variable":"astryx.tabs.list-itemSpacing"}],"kind":"component","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"max","itemSpacing":2,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"hug"},"height":{"mode":"hug"}},"fills":[],"variantProperties":{"Default":"true"},"children":[{"label":"tabs/item/selected","role":"tabs/item/selected","bindings":[{"field":"layout.padding.top","type":"FLOAT","variable":"astryx.tabs.tab-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"astryx.tabs.tab-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"astryx.tabs.tab-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"astryx.tabs.tab-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.tabs.tab-fill"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"astryx.tabs.tab-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"astryx.tabs.tab-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"astryx.tabs.tab-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"astryx.tabs.tab-radius"}],"kind":"frame","layout":{"mode":"vertical","primaryAxisAlign":"min","counterAxisAlign":"min","itemSpacing":0,"padding":{"top":0,"right":12,"bottom":0,"left":12},"width":{"mode":"hug"},"height":{"mode":"hug"}},"fills":[{"kind":"solid","color":"#00000000"}],"cornerRadius":{"topLeft":8,"topRight":8,"bottomRight":8,"bottomLeft":8},"children":[{"label":"tabs/label","role":"tabs/label","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"astryx.tabs.labelFontSize"},{"field":"type.letterSpacing.value","type":"FLOAT","variable":"astryx.tabs.labelLetterSpacing"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"astryx.tabs.labelLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.tabs.selected-label"}],"kind":"text","characters":"Item One","type":{"fontFamily":"SF Pro","fontStyle":"Semibold","fontProvenance":{"requestedFamily":"-apple-system","requestedStyle":"Semibold","requestSource":"@astryxdesign/core/src/TabList/Tab.tsx styles.selected fontWeight --font-weight-semibold 600","fallbackChain":[{"family":"-apple-system","style":"Semibold"},{"family":"SF Pro","style":"Semibold"},{"family":"Segoe UI","style":"Semibold"},{"family":"Roboto","style":"Medium"},{"family":"Helvetica","style":"Bold"},{"family":"Arial","style":"Bold"}],"resolvedFamily":"SF Pro","resolvedStyle":"Semibold","resolution":"fallback","degradation":"source -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif Semibold; Figma cannot load a CSS stack; first named host font is SF Pro Semibold"},"fontSize":14,"lineHeight":{"unit":"px","value":20},"letterSpacing":{"unit":"px","value":0},"textCase":"original"},"align":"center","verticalAlign":"center","fills":[{"kind":"solid","color":"#0a1317ff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}},{"label":"tabs/indicator","role":"tabs/indicator","bindings":[{"field":"layout.height.value","type":"FLOAT","variable":"astryx.tabs.indicator-height"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.tabs.indicator-fill"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"astryx.tabs.indicator-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"astryx.tabs.indicator-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"astryx.tabs.indicator-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"astryx.tabs.indicator-radius"}],"opacity":1,"kind":"frame","layout":{"mode":"horizontal","primaryAxisAlign":"min","counterAxisAlign":"min","itemSpacing":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"width":{"mode":"fill"},"height":{"mode":"fixed","value":2},"positioning":"absolute","offset":{"x":12,"y":-1},"constraints":{"horizontal":"stretch","vertical":"bottom"}},"fills":[{"kind":"solid","color":"#0064e0ff"}],"cornerRadius":{"topLeft":9999,"topRight":9999,"bottomRight":9999,"bottomLeft":9999},"children":[]}]},{"label":"tabs/item/rest","role":"tabs/item/rest","bindings":[{"field":"layout.padding.top","type":"FLOAT","variable":"astryx.tabs.tab-paddingY"},{"field":"layout.padding.right","type":"FLOAT","variable":"astryx.tabs.tab-paddingX"},{"field":"layout.padding.bottom","type":"FLOAT","variable":"astryx.tabs.tab-paddingY"},{"field":"layout.padding.left","type":"FLOAT","variable":"astryx.tabs.tab-paddingX"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.tabs.tab-fill"},{"field":"cornerRadius.topLeft","type":"FLOAT","variable":"astryx.tabs.tab-radius"},{"field":"cornerRadius.topRight","type":"FLOAT","variable":"astryx.tabs.tab-radius"},{"field":"cornerRadius.bottomRight","type":"FLOAT","variable":"astryx.tabs.tab-radius"},{"field":"cornerRadius.bottomLeft","type":"FLOAT","variable":"astryx.tabs.tab-radius"}],"kind":"frame","layout":{"mode":"vertical","primaryAxisAlign":"min","counterAxisAlign":"min","itemSpacing":0,"padding":{"top":0,"right":12,"bottom":0,"left":12},"width":{"mode":"hug"},"height":{"mode":"hug"}},"fills":[{"kind":"solid","color":"#00000000"}],"cornerRadius":{"topLeft":8,"topRight":8,"bottomRight":8,"bottomLeft":8},"children":[{"label":"tabs/label","role":"tabs/label","bindings":[{"field":"type.fontSize","type":"FLOAT","variable":"astryx.tabs.labelFontSize"},{"field":"type.letterSpacing.value","type":"FLOAT","variable":"astryx.tabs.labelLetterSpacing"},{"field":"type.lineHeight.value","type":"FLOAT","variable":"astryx.tabs.labelLineHeight"},{"field":"fills.0.color","type":"COLOR","variable":"astryx.tabs.rest-label"}],"kind":"text","characters":"Item Two","type":{"fontFamily":"SF Pro","fontStyle":"Regular","fontProvenance":{"requestedFamily":"-apple-system","requestedStyle":"Regular","requestSource":"@astryxdesign/core/src/TabList/Tab.tsx styles.base fontWeight --font-weight-normal; --text-label-size 14 / --text-label-leading 1.4286 → 20","fallbackChain":[{"family":"-apple-system","style":"Regular"},{"family":"SF Pro","style":"Regular"},{"family":"Segoe UI","style":"Regular"},{"family":"Roboto","style":"Regular"},{"family":"Helvetica","style":"Regular"},{"family":"Arial","style":"Regular"}],"resolvedFamily":"SF Pro","resolvedStyle":"Regular","resolution":"fallback","degradation":"source -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif Regular; Figma cannot load a CSS stack; first named host font is SF Pro Regular"},"fontSize":14,"lineHeight":{"unit":"px","value":20},"letterSpacing":{"unit":"px","value":0},"textCase":"original"},"align":"center","verticalAlign":"center","fills":[{"kind":"solid","color":"#4e606fff"}],"width":{"mode":"hug"},"height":{"mode":"hug"}}]}]}}]};
const NS="ds.contracts.tabs.recipe.v1";
const WRITER_VERSION="1";
const PAGE_OWNER="recipe/tabs/"+PLAN.runIdentity;
void "TABS-WRITER-SHARED-RUNTIME";
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
const EXPECTED_FILE_KEY="byMp6lt0Ij9b2QbkDGFwBh",EXPECTED_FILE_NAME="Scratch Project";
if(figma.fileKey!==EXPECTED_FILE_KEY)throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!==EXPECTED_FILE_NAME)throw new Error("WRONG-FILE-NAME:"+figma.root.name);
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR:"+figma.editorType);
void "TABS-MUST-NOT-WRITE-TABS-V13-PAGE";
void "TABS-MUST-NOT-WRITE-TABS-V12-PAGE";
void "TABS-MUST-NOT-WRITE-TABS-V11-PAGE";
void "TABS-MUST-NOT-WRITE-TABS-V10-PAGE";
void "TABS-MUST-NOT-WRITE-TABS-V9-PAGE";
void "TABS-MUST-NOT-WRITE-TABS-V8-PAGE";
void "TABS-MUST-NOT-WRITE-TABS-V7-PAGE";
void "TABS-MUST-NOT-WRITE-TABS-V6-PAGE";
void "TABS-MUST-NOT-WRITE-INPUT-PAGE";
void "TABS-MUST-NOT-WRITE-TABS-V5-PAGE";
void "TABS-MUST-NOT-WRITE-TABS-V4-PAGE";
void "TABS-MUST-NOT-WRITE-TABS-V3-PAGE";
void "TABS-MUST-NOT-WRITE-TABS-V2-PAGE";
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
if(figma.currentPage&&figma.currentPage.id==="218:91353")throw new Error("TABS-MUST-NOT-WRITE-TABS-V13-PAGE");
if(figma.currentPage&&figma.currentPage.id==="218:91238")throw new Error("TABS-MUST-NOT-WRITE-TABS-V12-PAGE");
if(figma.currentPage&&figma.currentPage.id==="218:90322")throw new Error("TABS-MUST-NOT-WRITE-TABS-V11-PAGE");
if(figma.currentPage&&figma.currentPage.id==="218:87732")throw new Error("TABS-MUST-NOT-WRITE-TABS-V10-PAGE");
if(figma.currentPage&&figma.currentPage.id==="218:86239")throw new Error("TABS-MUST-NOT-WRITE-TABS-V9-PAGE");
if(figma.currentPage&&figma.currentPage.id==="218:84757")throw new Error("TABS-MUST-NOT-WRITE-TABS-V8-PAGE");
if(figma.currentPage&&figma.currentPage.id==="212:81313")throw new Error("TABS-MUST-NOT-WRITE-TABS-V7-PAGE");
if(figma.currentPage&&figma.currentPage.id==="211:80360")throw new Error("TABS-MUST-NOT-WRITE-TABS-V6-PAGE");
if(figma.currentPage&&figma.currentPage.id==="115:295378")throw new Error("TABS-MUST-NOT-WRITE-INPUT-PAGE");
if(figma.currentPage&&figma.currentPage.id==="211:80294")throw new Error("TABS-MUST-NOT-WRITE-TABS-V5-PAGE");
if(figma.currentPage&&figma.currentPage.id==="211:80209")throw new Error("TABS-MUST-NOT-WRITE-TABS-V4-PAGE");
if(figma.currentPage&&figma.currentPage.id==="210:80102")throw new Error("TABS-MUST-NOT-WRITE-TABS-V3-PAGE");
if(figma.currentPage&&figma.currentPage.id==="209:79990")throw new Error("TABS-MUST-NOT-WRITE-TABS-V2-PAGE");
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
if(page.id==="218:91353")throw new Error("TABS-MUST-NOT-WRITE-TABS-V13-PAGE");
if(page.id==="218:91238")throw new Error("TABS-MUST-NOT-WRITE-TABS-V12-PAGE");
if(page.id==="218:90322")throw new Error("TABS-MUST-NOT-WRITE-TABS-V11-PAGE");
if(page.id==="218:87732")throw new Error("TABS-MUST-NOT-WRITE-TABS-V10-PAGE");
if(page.id==="218:86239")throw new Error("TABS-MUST-NOT-WRITE-TABS-V9-PAGE");
if(page.id==="218:84757")throw new Error("TABS-MUST-NOT-WRITE-TABS-V8-PAGE");
if(page.id==="212:81313")throw new Error("TABS-MUST-NOT-WRITE-TABS-V7-PAGE");
if(page.id==="211:80360")throw new Error("TABS-MUST-NOT-WRITE-TABS-V6-PAGE");
if(page.id==="115:295378")throw new Error("TABS-MUST-NOT-WRITE-INPUT-PAGE");
if(page.id==="211:80294")throw new Error("TABS-MUST-NOT-WRITE-TABS-V5-PAGE");
if(page.id==="211:80209")throw new Error("TABS-MUST-NOT-WRITE-TABS-V4-PAGE");
if(page.id==="210:80102")throw new Error("TABS-MUST-NOT-WRITE-TABS-V3-PAGE");
if(page.id==="209:79990")throw new Error("TABS-MUST-NOT-WRITE-TABS-V2-PAGE");
if(page.id==="183:76193")throw new Error("TABS-MUST-NOT-WRITE-TABS-V1-PAGE");
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
  if(!found)throw new Error("TABS-FONT-UNAVAILABLE:"+spec.requestedFamily+":"+spec.requestedStyle);
  const resolution=found.fontName.family===spec.requestedFamily&&sameStyle(found.fontName.style,spec.requestedStyle)?"requested":"fallback";
  if(found.fontName.family!==spec.resolvedFamily||!sameStyle(found.fontName.style,spec.resolvedStyle)||resolution!==spec.resolution)throw new Error("TABS-FONT-PROVENANCE-TAMPER:"+found.fontName.family+":"+found.fontName.style);
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
        if(ir.strokes[0].dashPattern)node.dashPattern=ir.strokes[0].dashPattern;
        bindFloat(node,"strokeWeight",bindingFor(ir,"strokes.0.weight"));
      }
    }else if(ir.kind==="vector"){node.strokes=[];}
    if(ir.cornerRadius){
      for(const [irKey,figmaKey] of [["topLeft","topLeftRadius"],["topRight","topRightRadius"],["bottomRight","bottomRightRadius"],["bottomLeft","bottomLeftRadius"]]){
        node[figmaKey]=ir.cornerRadius[irKey];bindFloat(node,figmaKey,bindingFor(ir,"cornerRadius."+irKey));
      }
    }
    void "TABS-WRITER-EFFECTS";
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
    void "TABS-WRITER-CLIPS-ONLY-WHEN-SAID";
    // Figma's frame default is clipsContent=true; CSS's overflow default is
    // visible. A frame clips only when the IR says so — otherwise a box's own
    // shadow is cut off at a hit area the same size as the box (shadcn) —
    // EXCEPT that Figma renders a frame's own drop shadow like Chromium only
    // when that frame clips (MUI switch thumb tail, measured against the real
    // render 27/37/44/54: clipping 45/51/71/80, not clipping 73/76/84/88 and a
    // row longer). So a shadowed frame clips unless the IR says otherwise.
    const shadowed=Array.isArray(ir.effects)&&ir.effects.some(e=>e.kind==="drop-shadow");
    node.clipsContent=ir.clipsContent===undefined?shadowed:ir.clipsContent;
    void "TABS-WRITER-LAYOUT-MIN-WIDTH";
    if(layout.minWidth!==undefined){node.minWidth=layout.minWidth;bindFloat(node,"minWidth",bindingFor(ir,"layout.minWidth"));}
    if(layout.minHeight!==undefined){node.minHeight=layout.minHeight;bindFloat(node,"minHeight",bindingFor(ir,"layout.minHeight"));}
    if(layout.positioning==="absolute"){
      if(!layout.offset||!layout.constraints)throw new Error("TABS-OVERLAY-DECLARATION-INCOMPLETE:"+ir.role);
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
    void "TABS-WRITER-ABSOLUTE-CHILD-IS-FIXED-SIZED";
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
  void "TABS-WRITER-FIRST-SEGMENT-BIND";
  void "TABS-WRITER-PLACE-ABSOLUTE-AFTER-PARENT-SIZES";
  const placeAbsolute=(parentNode,parentIr)=>{
    for(const childIr of parentIr.children||[]){
      if(!isAbsolute(childIr))continue;
      const child=parentNode.children.find(c=>firstSegment(c.name)===childIr.role);
      if(!child)throw new Error("TABS-ABSOLUTE-CHILD-MISSING:"+childIr.role);
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
  void "TABS-WRITER-DEFER-FILL-UNTIL-AUTOLAYOUT-PARENT";
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
      if(!ir.type.fontProvenance)throw new Error("TABS-FONT-PROVENANCE-ABSENT:"+ir.role);
      const label=figma.createText();const font=resolveFont(ir.type.fontProvenance);await figma.loadFontAsync(font);
      label.fontName=font;label.characters=ir.characters;label.fontSize=ir.type.fontSize;
      label.lineHeight=ir.type.lineHeight.unit==="px"?{unit:"PIXELS",value:ir.type.lineHeight.value}:ir.type.lineHeight.unit==="percent"?{unit:"PERCENT",value:ir.type.lineHeight.value}:{unit:"AUTO"};
      void "TABS-WRITER-LETTER-SPACING";
      if(ir.type.letterSpacing)label.letterSpacing=ir.type.letterSpacing.unit==="px"?{unit:"PIXELS",value:ir.type.letterSpacing.value}:{unit:"PERCENT",value:ir.type.letterSpacing.value};
      if(ir.type.textCase==="upper")label.textCase="UPPER";else if(ir.type.textCase==="lower")label.textCase="LOWER";else if(ir.type.textCase==="title")label.textCase="TITLE";
      if(ir.type.textDecoration==="underline")label.textDecoration="UNDERLINE";else if(ir.type.textDecoration==="strikethrough")label.textDecoration="STRIKETHROUGH";
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
          // the same spacing-and-case-blind style match as resolveFont (a two-word "Semi Bold" vs a CSS-weight "Semibold")
          const found=allFonts.find(entry=>entry.fontName.family===candidate.family&&sameStyle(entry.fontName.style,candidate.style));
          if(!found)continue;
          await figma.loadFontAsync(found.fontName);
          label.fontName=found.fontName;
          label.characters=ir.characters;
          if(label.width>0&&label.absoluteRenderBounds){painted=true;break;}
        }
        if(!painted&&(label.width<=0||label.absoluteRenderBounds===null))throw new Error("TABS-FONT-ZERO-INTRINSIC:"+ir.role);
      }
      node=label;
    }else if(ir.kind==="vector"){
      void "TABS-WRITER-VECTOR-PATH";
      const vector=figma.createVector();
      vector.vectorPaths=[{windingRule:ir.windingRule==="evenodd"?"EVENODD":"NONZERO",data:ir.assetRef}];
      vector.effects=[];
      if(ir.strokeCap&&ir.strokeCap!=="none")vector.strokeCap=ir.strokeCap.toUpperCase();
      if(ir.strokeJoin)vector.strokeJoin=ir.strokeJoin.toUpperCase();
      if(ir.rotation)vector.rotation=ir.rotation;
      void "TABS-WRITER-GLYPH-BOUNDS-GUARD";
      const wantW=ir.width.mode==="fixed"?ir.width.value:vector.width,wantH=ir.height.mode==="fixed"?ir.height.value:vector.height;
      if(Math.abs(vector.width-wantW)>0.05||Math.abs(vector.height-wantH)>0.05)throw new Error("TABS-GLYPH-BOUNDS-MISMATCH:"+ir.role+":"+vector.width.toFixed(3)+"x"+vector.height.toFixed(3)+" vs "+wantW+"x"+wantH);
      node=vector;
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
    if(ir.kind==="frame"){applyLayout(node,ir);await renderChildren(node,ir,ownershipKey);applySizing(node,ir);placeAbsolute(node,ir);}
    else applySizing(node,ir);
    if(ir.kind==="text"){
      bindFloat(node,"fontSize",bindingFor(ir,"type.fontSize"));
      void "TABS-WRITER-PERCENT-LINE-HEIGHT-STAYS-LITERAL";
      if(ir.type.lineHeight.unit!=="percent")bindFloat(node,"lineHeight",bindingFor(ir,"type.lineHeight.value"));
      bindFloat(node,"letterSpacing",bindingFor(ir,"type.letterSpacing.value"));
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
    await renderChildren(component,ir,"tabs/children");
    applySizing(component,ir);placeAbsolute(component,ir);
    if(component.layoutMode!=="HORIZONTAL"&&component.layoutMode!=="VERTICAL")throw new Error("TABS-FAKE-LAYOUT:"+component.name);
    createdNodeIds.push(component.id);
    const container=figma.createFrame();
    container.name="Component Container";
    container.layoutMode="NONE";
    container.fills=[];
    container.x=80;container.y=96;
    section.appendChild(container);
    container.appendChild(component);
    void "TABS-WRITER-CONTAINER-HUGS-COMPONENT";
    container.clipsContent=false;
    container.resizeWithoutConstraints(Math.max(1,component.width),Math.max(1,component.height));
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
