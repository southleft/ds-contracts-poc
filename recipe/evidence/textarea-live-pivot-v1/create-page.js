if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.textarea.recipe.v1";
const runIdentity = "830c90b5-e9c10699-09726acb-textarea-v1";
const pageName = "Recipe Pivot / Textarea / 830c90b5-e9c10699-09726acb-textarea-v1";
const signed = ["115:295378","163:35981","183:70641","183:69150","85:6781","173:48924","181:64873","183:74742","183:75031","183:75302"];
await figma.loadAllPagesAsync();
let page = figma.root.children.find((p) => p.name === pageName);
if (page) {
  if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity)
    throw new Error("TEXTAREA-PAGE-IDENTITY-MISMATCH:" + page.id);
  if (signed.includes(page.id)) throw new Error("TEXTAREA-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
  return { pageId: page.id, pageName: page.name, created: false };
}
page = figma.createPage();
page.name = pageName;
if (signed.includes(page.id)) throw new Error("TEXTAREA-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
page.setSharedPluginData(NS, "pageOwner", "recipe/textarea/" + runIdentity);
page.setSharedPluginData(NS, "runIdentity", runIdentity);
page.setSharedPluginData(NS, "writerVersion", "1");
return { pageId: page.id, pageName: page.name, created: true };
