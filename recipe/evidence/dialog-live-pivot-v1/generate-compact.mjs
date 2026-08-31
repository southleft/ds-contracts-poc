import { readFileSync, writeFileSync } from "node:fs";

const plan = JSON.parse(
  readFileSync(new URL("./plan.json", import.meta.url), "utf8"),
);
const RUN = plan.runIdentity;
const PAGE = plan.pageName;
const NS = plan.namespace;
const SIGNED = [
  "115:295378","163:35981","183:70641","183:69150","85:6781","173:48924",
  "181:64873","183:74742","183:75031","183:75302","183:75495","183:75801",
  "183:75976","183:76022","183:76063","183:76109","183:76151","183:76193",
  "183:76259",
];
const byAdapter = Object.fromEntries(
  plan.sources.map((source) => [source.adapterIdentity, source]),
);

const astryxTitle = {
  requestedFamily: "-apple-system", requestedStyle: "Semibold",
  resolvedFamily: "SF Pro", resolvedStyle: "Semibold", resolution: "fallback",
  fallbackChain: [
    { family: "-apple-system", style: "Semibold" }, { family: "SF Pro", style: "Semibold" },
    { family: "Roboto", style: "Medium" }, { family: "Helvetica", style: "Bold" },
    { family: "Arial", style: "Bold" },
  ],
  degradation: "source -apple-system Semibold; Figma cannot load a CSS stack; first named host font is SF Pro Semibold",
};
const astryxBody = {
  requestedFamily: "-apple-system", requestedStyle: "Regular",
  resolvedFamily: "SF Pro", resolvedStyle: "Regular", resolution: "fallback",
  fallbackChain: [
    { family: "-apple-system", style: "Regular" }, { family: "SF Pro", style: "Regular" },
    { family: "Segoe UI", style: "Regular" }, { family: "Roboto", style: "Regular" },
    { family: "Helvetica", style: "Regular" }, { family: "Arial", style: "Regular" },
  ],
  degradation: "source -apple-system Regular; Figma cannot load a CSS stack; first named host font is SF Pro Regular",
};
const muiTitle = {
  requestedFamily: "Roboto", requestedStyle: "Medium",
  resolvedFamily: "Roboto", resolvedStyle: "Medium", resolution: "requested",
  fallbackChain: [
    { family: "Roboto", style: "Medium" }, { family: "Helvetica", style: "Bold" },
    { family: "Arial", style: "Bold" },
  ],
};
const muiBody = {
  requestedFamily: "Roboto", requestedStyle: "Regular",
  resolvedFamily: "Roboto", resolvedStyle: "Regular", resolution: "requested",
  fallbackChain: [
    { family: "Roboto", style: "Regular" }, { family: "Helvetica", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
};
const antdTitle = {
  requestedFamily: "-apple-system", requestedStyle: "Semibold",
  resolvedFamily: "SF Pro", resolvedStyle: "Semibold", resolution: "fallback",
  fallbackChain: [
    { family: "-apple-system", style: "Semibold" }, { family: "SF Pro", style: "Semibold" },
    { family: "Roboto", style: "Medium" }, { family: "Helvetica Neue", style: "Bold" },
    { family: "Arial", style: "Bold" },
  ],
  degradation: "antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Semibold",
};
const antdBody = {
  requestedFamily: "-apple-system", requestedStyle: "Regular",
  resolvedFamily: "SF Pro", resolvedStyle: "Regular", resolution: "fallback",
  fallbackChain: [
    { family: "-apple-system", style: "Regular" }, { family: "SF Pro", style: "Regular" },
    { family: "Segoe UI", style: "Regular" }, { family: "Roboto", style: "Regular" },
    { family: "Helvetica Neue", style: "Regular" }, { family: "Arial", style: "Regular" },
  ],
  degradation: "antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Regular",
};

const libraries = {
  astryx: {
    adapterIdentity: "astryx-dialog-reviewed-v1", displayName: "Astryx",
    componentLabel: "Astryx Dialog", prefix: "astryx.dialog",
    recipeHash: byAdapter["astryx-dialog-reviewed-v1"].recipeHash,
    envelopeHash: byAdapter["astryx-dialog-reviewed-v1"].envelopeHash,
    titleFont: astryxTitle, bodyFont: astryxBody,
    titleSize: 20, titleLine: 28, titleFill: "#0a1317ff",
    bodySize: 14, bodyLine: 20, bodyFill: "#0a1317ff",
    paper: { paddingX: 16, paddingY: 16, radius: 12, gap: 0, minWidth: 400, fill: "#ffffffff" },
  },
  mui: {
    adapterIdentity: "mui-dialog-reviewed-v1", displayName: "MUI",
    componentLabel: "MUI Dialog", prefix: "mui.dialog",
    recipeHash: byAdapter["mui-dialog-reviewed-v1"].recipeHash,
    envelopeHash: byAdapter["mui-dialog-reviewed-v1"].envelopeHash,
    titleFont: muiTitle, bodyFont: muiBody,
    titleSize: 20, titleLine: 32, titleFill: "#000000de",
    bodySize: 16, bodyLine: 24, bodyFill: "#000000de",
    paper: { paddingX: 24, paddingY: 16, radius: 4, gap: 0, minWidth: 600, fill: "#ffffffff" },
  },
  antd: {
    adapterIdentity: "antd-dialog-reviewed-v1", displayName: "Ant Design",
    componentLabel: "Ant Design Modal", prefix: "antd.dialog",
    recipeHash: byAdapter["antd-dialog-reviewed-v1"].recipeHash,
    envelopeHash: byAdapter["antd-dialog-reviewed-v1"].envelopeHash,
    titleFont: antdTitle, bodyFont: antdBody,
    titleSize: 16, titleLine: 24, titleFill: "#000000e0",
    bodySize: 14, bodyLine: 22, bodyFill: "#000000e0",
    paper: { paddingX: 24, paddingY: 20, radius: 8, gap: 8, minWidth: 520, fill: "#ffffffff" },
  },
};

function emit(lib) {
  const p = lib.prefix;
  const planned = [
    ["FLOAT", `${p}.paper-paddingX`, lib.paper.paddingX],
    ["FLOAT", `${p}.paper-paddingY`, lib.paper.paddingY],
    ["FLOAT", `${p}.paper-radius`, lib.paper.radius],
    ["FLOAT", `${p}.paper-itemSpacing`, lib.paper.gap],
    ["FLOAT", `${p}.paper-minWidth`, lib.paper.minWidth],
    ["COLOR", `${p}.paper-fill`, lib.paper.fill],
    ["FLOAT", `${p}.titleFontSize`, lib.titleSize],
    ["FLOAT", `${p}.titleLineHeight`, lib.titleLine],
    ["COLOR", `${p}.title`, lib.titleFill],
    ["FLOAT", `${p}.bodyFontSize`, lib.bodySize],
    ["FLOAT", `${p}.bodyLineHeight`, lib.bodyLine],
    ["COLOR", `${p}.body`, lib.bodyFill],
  ];
  return `if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = ${JSON.stringify(NS)};
const runIdentity = ${JSON.stringify(RUN)};
const pageName = ${JSON.stringify(PAGE)};
const adapterIdentity = ${JSON.stringify(lib.adapterIdentity)};
const recipeHash = ${JSON.stringify(lib.recipeHash)};
const envelopeHash = ${JSON.stringify(lib.envelopeHash)};
const signed = ${JSON.stringify(SIGNED)};
await figma.loadAllPagesAsync();
const page = figma.root.children.find((c) => c.name === pageName);
if (!page) throw new Error("DIALOG-PAGE-MISSING");
if (signed.includes(page.id)) throw new Error("DIALOG-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity) throw new Error("DIALOG-PAGE-IDENTITY-MISMATCH:" + page.id);
await figma.setCurrentPageAsync(page);
if (page.children.some((n) => n.type === "SECTION" && n.getSharedPluginData(NS, "adapterIdentity") === adapterIdentity))
  throw new Error("DIALOG-SECTION-EXISTS:" + adapterIdentity);
const hex = (v) => ({ r: parseInt(v.slice(1, 3), 16) / 255, g: parseInt(v.slice(3, 5), 16) / 255, b: parseInt(v.slice(5, 7), 16) / 255, a: parseInt(v.slice(7, 9), 16) / 255 });
const paint = (v) => { const c = hex(v); return { type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }; };
const allFonts = await figma.listAvailableFontsAsync();
const resolvePainted = (spec) => {
  const found = spec.fallbackChain.map((c) => allFonts.find((f) => f.fontName.family === c.family && f.fontName.style === c.style)).find(Boolean);
  if (!found) throw new Error("DIALOG-FONT-UNAVAILABLE");
  if (found.fontName.family !== spec.resolvedFamily || found.fontName.style !== spec.resolvedStyle)
    throw new Error("DIALOG-FONT-PROVENANCE-TAMPER:" + found.fontName.family + ":" + found.fontName.style);
  return found.fontName;
};
const titleSpec = ${JSON.stringify(lib.titleFont)};
const bodySpec = ${JSON.stringify(lib.bodyFont)};
const titleResolved = resolvePainted(titleSpec);
const bodyResolved = resolvePainted(bodySpec);
await figma.loadFontAsync(titleResolved);
await figma.loadFontAsync(bodyResolved);
const paintedTitle = { spec: titleSpec, painted: titleResolved };
const paintedBody = { spec: bodySpec, painted: bodyResolved };
const collection = figma.variables.createVariableCollection("Recipe Dialog / " + runIdentity + " / " + adapterIdentity);
collection.renameMode(collection.modes[0].modeId, "Default");
collection.hiddenFromPublishing = true;
const modeId = collection.modes[0].modeId;
const planned = ${JSON.stringify(planned)};
const vars = new Map();
for (const [type, identity, value] of planned) {
  const name = "token/" + (type === "COLOR" ? "color" : "float") + "/id-" + Array.from(identity).map((ch) => ch.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  const variable = figma.variables.createVariable(name, collection, type);
  variable.scopes = ["ALL_SCOPES"];
  variable.setValueForMode(modeId, type === "COLOR" ? hex(value) : value);
  vars.set(type + ":" + identity, variable);
}
const bindColor = (base, identity) => figma.variables.setBoundVariableForPaint(base, "color", vars.get("COLOR:" + identity));
const bindFloat = (node, field, identity) => node.setBoundVariable(field, vars.get("FLOAT:" + identity));
const prefix = ${JSON.stringify(p)};
const geom = ${JSON.stringify({ ...lib, titleFont: undefined, bodyFont: undefined })};
const paintText = async (characters, role, specState, size, line, fillId, sizeId, lineId) => {
  const node = figma.createText();
  node.fontName = specState.painted;
  node.characters = characters;
  node.fontSize = size;
  node.lineHeight = { unit: "PIXELS", value: line };
  node.textAlignHorizontal = "LEFT";
  node.textAlignVertical = "CENTER";
  node.textAutoResize = "WIDTH_AND_HEIGHT";
  if (node.characters.trim().length > 0 && (node.width <= 0 || node.absoluteRenderBounds === null)) {
    for (const candidate of specState.spec.fallbackChain) {
      if (candidate.family === specState.spec.resolvedFamily && candidate.style === specState.spec.resolvedStyle) continue;
      const next = allFonts.find((e) => e.fontName.family === candidate.family && e.fontName.style === candidate.style);
      if (!next) continue;
      await figma.loadFontAsync(next.fontName);
      node.fontName = next.fontName;
      node.characters = characters;
      if (node.width > 0 && node.absoluteRenderBounds) { specState.painted = next.fontName; break; }
    }
  }
  if (node.width <= 0 || node.height <= 0) throw new Error("DIALOG-TEXT-GEOMETRY:" + role);
  node.fills = [bindColor(paint(fillId === prefix + ".title" ? geom.titleFill : geom.bodyFill), fillId)];
  bindFloat(node, "fontSize", sizeId);
  bindFloat(node, "lineHeight", lineId);
  node.name = role + " :: font-provenance=" + encodeURIComponent(JSON.stringify(specState.spec));
  return node;
};
let nextX = 0;
for (const child of page.children) if (child.type === "SECTION") nextX = Math.max(nextX, child.x + child.width + 240);
const section = figma.createSection();
section.name = "Recipe Pivot / ${lib.displayName} / " + recipeHash.slice(0, 8);
section.x = nextX; section.y = 0; page.appendChild(section);
section.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
section.setSharedPluginData(NS, "recipeHash", recipeHash);
const component = figma.createComponent();
component.clipsContent = false;
component.name = "dialog/variant/default :: " + geom.componentLabel;
component.layoutMode = "VERTICAL";
component.primaryAxisAlignItems = "MIN";
component.counterAxisAlignItems = "MIN";
component.itemSpacing = geom.paper.gap;
component.paddingTop = geom.paper.paddingY;
component.paddingRight = geom.paper.paddingX;
component.paddingBottom = geom.paper.paddingY;
component.paddingLeft = geom.paper.paddingX;
component.minWidth = geom.paper.minWidth;
component.fills = [bindColor(paint(geom.paper.fill), prefix + ".paper-fill")];
component.topLeftRadius = geom.paper.radius;
component.topRightRadius = geom.paper.radius;
component.bottomRightRadius = geom.paper.radius;
component.bottomLeftRadius = geom.paper.radius;
bindFloat(component, "itemSpacing", prefix + ".paper-itemSpacing");
bindFloat(component, "paddingTop", prefix + ".paper-paddingY");
bindFloat(component, "paddingRight", prefix + ".paper-paddingX");
bindFloat(component, "paddingBottom", prefix + ".paper-paddingY");
bindFloat(component, "paddingLeft", prefix + ".paper-paddingX");
bindFloat(component, "minWidth", prefix + ".paper-minWidth");
bindFloat(component, "topLeftRadius", prefix + ".paper-radius");
bindFloat(component, "topRightRadius", prefix + ".paper-radius");
bindFloat(component, "bottomRightRadius", prefix + ".paper-radius");
bindFloat(component, "bottomLeftRadius", prefix + ".paper-radius");
section.appendChild(component);
component.appendChild(await paintText("Dialog title", "dialog/title", paintedTitle, geom.titleSize, geom.titleLine, prefix + ".title", prefix + ".titleFontSize", prefix + ".titleLineHeight"));
component.appendChild(await paintText("Dialog body", "dialog/body", paintedBody, geom.bodySize, geom.bodyLine, prefix + ".body", prefix + ".bodyFontSize", prefix + ".bodyLineHeight"));
component.layoutSizingHorizontal = "HUG";
component.layoutSizingVertical = "HUG";
const container = figma.createFrame();
container.name = "Component Container";
container.layoutMode = "NONE";
container.fills = [];
container.x = 80; container.y = 96;
section.appendChild(container);
container.appendChild(component);
container.setSharedPluginData(NS, "runIdentity", runIdentity);
container.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
container.setSharedPluginData(NS, "recipeHash", recipeHash);
container.setSharedPluginData(NS, "ownershipKey", "dialog/container");
component.setSharedPluginData(NS, "runIdentity", runIdentity);
component.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
component.setSharedPluginData(NS, "recipeHash", recipeHash);
component.setSharedPluginData(NS, "envelopeHash", envelopeHash);
component.setSharedPluginData(NS, "ownershipKey", "dialog");
section.resizeWithoutConstraints(Math.max(container.width, geom.paper.minWidth) + 160, container.y + container.height + 80);
return { pageId: page.id, sectionId: section.id, componentId: component.id, containerId: container.id, adapterIdentity, paintedTitle: paintedTitle.painted, paintedBody: paintedBody.painted };
`;
}

for (const [slug, lib] of Object.entries(libraries)) {
  writeFileSync(new URL(`./compact-${slug}.js`, import.meta.url), emit(lib));
}
writeFileSync(
  new URL("./create-page.js", import.meta.url),
  `if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = ${JSON.stringify(NS)};
const runIdentity = ${JSON.stringify(RUN)};
const pageName = ${JSON.stringify(PAGE)};
const signed = ${JSON.stringify(SIGNED)};
await figma.loadAllPagesAsync();
let page = figma.root.children.find((c) => c.name === pageName);
if (page) {
  if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity) throw new Error("DIALOG-PAGE-IDENTITY-MISMATCH:" + page.id);
  if (signed.includes(page.id)) throw new Error("DIALOG-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
  return { pageId: page.id, pageName: page.name, created: false };
}
page = figma.createPage();
page.name = pageName;
if (signed.includes(page.id)) throw new Error("DIALOG-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
page.setSharedPluginData(NS, "pageOwner", "recipe/dialog/" + runIdentity);
page.setSharedPluginData(NS, "runIdentity", runIdentity);
page.setSharedPluginData(NS, "writerVersion", "1");
return { pageId: page.id, pageName: page.name, created: true };
`,
);
console.log("wrote compact hosts and create-page");
