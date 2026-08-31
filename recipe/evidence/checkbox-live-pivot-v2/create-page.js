if(figma.fileKey!=="byMp6lt0Ij9b2QbkDGFwBh")throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!=="Scratch Project")throw new Error("WRONG-FILE-NAME:"+figma.root.name);
const signed=["115:295378","163:35981","183:70641","173:48924","181:64873","183:69150","85:6781","183:74742"];
if(signed.includes(figma.currentPage.id))throw new Error("ON-SIGNED-PAGE:"+figma.currentPage.id);
await figma.loadAllPagesAsync();
const pageName="Recipe Pivot / Checkbox / 548cf953-c8ce9a83-7856869a-checkbox-v2";
const NS="ds.contracts.checkbox.recipe.v1";
const runIdentity="548cf953-c8ce9a83-7856869a-checkbox-v2";
let page=figma.root.children.find(p=>p.name===pageName);
if(page){
  if(page.getSharedPluginData(NS,"pageOwner")!=="recipe/checkbox/"+runIdentity)throw new Error("CHECKBOX-PAGE-OWNERSHIP-COLLISION:"+page.id);
  if(page.getSharedPluginData(NS,"runIdentity")!==runIdentity)throw new Error("CHECKBOX-PAGE-IDENTITY-MISMATCH:"+page.id);
  if(signed.includes(page.id))throw new Error("PAGE-IS-SIGNED:"+page.id);
  return{pageId:page.id,pageName:page.name,created:false};
}
page=figma.createPage();
page.name=pageName;
if(signed.includes(page.id))throw new Error("CREATED-SIGNED:"+page.id);
page.setSharedPluginData(NS,"pageOwner","recipe/checkbox/"+runIdentity);
page.setSharedPluginData(NS,"runIdentity",runIdentity);
page.setSharedPluginData(NS,"writerVersion","2");
return{pageId:page.id,pageName:page.name,created:true};
