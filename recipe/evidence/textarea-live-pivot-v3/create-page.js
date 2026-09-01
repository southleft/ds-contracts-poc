if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const signed = [
  "115:295378",
  "163:35981",
  "183:70641",
  "173:48924",
  "181:64873",
  "183:69150",
  "85:6781",
  "183:74742",
  "183:75031",
  "183:75302",
  "183:75495",
  "183:76022",
  "196:76370",
  "197:76679",
  "197:76903",
  "198:77048",
  "198:77177",
];
if (signed.includes(figma.currentPage.id)) throw new Error("ON-SIGNED-PAGE:" + figma.currentPage.id);
await figma.loadAllPagesAsync();
const pageName = "Recipe Pivot / Textarea / 71033c6d-82f958a9-142f3598-textarea-v3";
const NS = "ds.contracts.textarea.recipe.v1";
const runIdentity = "71033c6d-82f958a9-142f3598-textarea-v3";
let page = figma.root.children.find((p) => p.name === pageName);
if (page) {
  if (page.getSharedPluginData(NS, "pageOwner") !== "recipe/textarea/" + runIdentity)
    throw new Error("TEXTAREA-PAGE-OWNERSHIP-COLLISION:" + page.id);
  if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity)
    throw new Error("TEXTAREA-PAGE-IDENTITY-MISMATCH:" + page.id);
  if (signed.includes(page.id)) throw new Error("PAGE-IS-SIGNED:" + page.id);
  return { pageId: page.id, pageName: page.name, created: false };
}
const safe = figma.root.children.find((p) => !signed.includes(p.id));
if (safe) await figma.setCurrentPageAsync(safe);
page = figma.createPage();
page.name = pageName;
if (signed.includes(page.id)) throw new Error("CREATED-SIGNED:" + page.id);
page.setSharedPluginData(NS, "pageOwner", "recipe/textarea/" + runIdentity);
page.setSharedPluginData(NS, "runIdentity", runIdentity);
page.setSharedPluginData(NS, "writerVersion", "3");
return { pageId: page.id, pageName: page.name, created: true };
