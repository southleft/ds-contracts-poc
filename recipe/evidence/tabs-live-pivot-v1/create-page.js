if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.tabs.recipe.v1";
const runIdentity = "34d1e257-b5d949f6-20e72946-tabs-v1";
const pageName = "Recipe Pivot / Tabs / 34d1e257-b5d949f6-20e72946-tabs-v1";
const signed = ["115:295378","163:35981","183:70641","183:69150","85:6781","173:48924","181:64873","183:74742","183:75031","183:75302","183:75495","183:75801","183:75976","183:76022","183:76063","183:76109","183:76151"];
await figma.loadAllPagesAsync();
let page = figma.root.children.find((candidate) => candidate.name === pageName);
if (page) {
  if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity)
    throw new Error("TABS-PAGE-IDENTITY-MISMATCH:" + page.id);
  if (signed.includes(page.id)) throw new Error("TABS-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
  return { pageId: page.id, pageName: page.name, created: false };
}
page = figma.createPage();
page.name = pageName;
if (signed.includes(page.id)) throw new Error("TABS-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
page.setSharedPluginData(NS, "pageOwner", "recipe/tabs/" + runIdentity);
page.setSharedPluginData(NS, "runIdentity", runIdentity);
page.setSharedPluginData(NS, "writerVersion", "1");
return { pageId: page.id, pageName: page.name, created: true };
