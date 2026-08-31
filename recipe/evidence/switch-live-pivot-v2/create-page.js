if(figma.fileKey!=="byMp6lt0Ij9b2QbkDGFwBh")throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!=="Scratch Project")throw new Error("WRONG-FILE-NAME:"+figma.root.name);
const signed=["115:295378","163:35981","183:70641","173:48924","181:64873","183:69150","85:6781","183:74742","183:75031","183:75302","196:76370","197:76679"];
await figma.loadAllPagesAsync();
const pageName="Recipe Pivot / Switch / a8686d63-3d086535-0720db18-switch-v2";
const NS="ds.contracts.switch.recipe.v1";
const runIdentity="a8686d63-3d086535-0720db18-switch-v2";
let page=figma.root.children.find(p=>p.name===pageName);
if(page){
  if(page.getSharedPluginData(NS,"pageOwner")!=="recipe/switch/"+runIdentity)throw new Error("SWITCH-PAGE-OWNERSHIP-COLLISION:"+page.id);
  return{pageId:page.id,pageName:page.name,created:false};
}
const safe=figma.root.children.find(p=>!signed.includes(p.id));
if(safe)await figma.setCurrentPageAsync(safe);
page=figma.createPage();
page.name=pageName;
page.setSharedPluginData(NS,"pageOwner","recipe/switch/"+runIdentity);
page.setSharedPluginData(NS,"runIdentity",runIdentity);
page.setSharedPluginData(NS,"writerVersion","2");
return{pageId:page.id,pageName:page.name,created:true};
