if(figma.fileKey!=="byMp6lt0Ij9b2QbkDGFwBh")throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!=="Scratch Project")throw new Error("WRONG-FILE-NAME:"+figma.root.name);
const signed=["115:295378","163:35981","183:70641","173:48924","181:64873","183:69150","85:6781","183:74742","183:75031","196:76370"];
if(signed.includes(figma.currentPage.id))throw new Error("ON-SIGNED-PAGE:"+figma.currentPage.id);
await figma.loadAllPagesAsync();
const pageName="Recipe Pivot / Radio / 0b0ee218-7e6bbd32-6c11de88-radio-v2";
const NS="ds.contracts.radio.recipe.v1";
const runIdentity="0b0ee218-7e6bbd32-6c11de88-radio-v2";
let page=figma.root.children.find(p=>p.name===pageName);
if(page){
  if(page.getSharedPluginData(NS,"pageOwner")!=="recipe/radio/"+runIdentity)throw new Error("RADIO-PAGE-OWNERSHIP-COLLISION:"+page.id);
  if(page.getSharedPluginData(NS,"runIdentity")!==runIdentity)throw new Error("RADIO-PAGE-IDENTITY-MISMATCH:"+page.id);
  if(signed.includes(page.id))throw new Error("PAGE-IS-SIGNED:"+page.id);
  return{pageId:page.id,pageName:page.name,created:false};
}
page=figma.createPage();
page.name=pageName;
if(signed.includes(page.id))throw new Error("CREATED-SIGNED:"+page.id);
page.setSharedPluginData(NS,"pageOwner","recipe/radio/"+runIdentity);
page.setSharedPluginData(NS,"runIdentity",runIdentity);
page.setSharedPluginData(NS,"writerVersion","2");
return{pageId:page.id,pageName:page.name,created:true};
