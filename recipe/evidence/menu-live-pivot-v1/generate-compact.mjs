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
];
const byAdapter = Object.fromEntries(
  plan.sources.map((source) => [source.adapterIdentity, source]),
);

const astryxFont = {
  requestedFamily: "-apple-system", requestedStyle: "Regular",
  resolvedFamily: "SF Pro", resolvedStyle: "Regular", resolution: "fallback",
  fallbackChain: [
    { family: "-apple-system", style: "Regular" }, { family: "SF Pro", style: "Regular" },
    { family: "Segoe UI", style: "Regular" }, { family: "Roboto", style: "Regular" },
    { family: "Helvetica", style: "Regular" }, { family: "Arial", style: "Regular" },
  ],
  degradation: "source -apple-system Regular; Figma cannot load a CSS stack; first named host font is SF Pro Regular",
};
const muiFont = {
  requestedFamily: "Roboto", requestedStyle: "Regular",
  resolvedFamily: "Roboto", resolvedStyle: "Regular", resolution: "requested",
  fallbackChain: [
    { family: "Roboto", style: "Regular" }, { family: "Helvetica", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
};
const antdFont = {
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
    adapterIdentity: "astryx-menu-reviewed-v1", displayName: "Astryx",
    componentLabel: "Astryx DropdownMenu", prefix: "astryx.menu",
    recipeHash: byAdapter["astryx-menu-reviewed-v1"].recipeHash,
    envelopeHash: byAdapter["astryx-menu-reviewed-v1"].envelopeHash,
    font: astryxFont, fontSize: 14, lineHeight: 20, label: "#0a1317ff",
    panel: { padding: 4, radius: 12, gap: 2, fill: "#ffffffff" },
    item: { paddingX: 8, paddingY: 6, minHeight: 0, fill: "#00000000" },
  },
  mui: {
    adapterIdentity: "mui-menu-reviewed-v1", displayName: "MUI",
    componentLabel: "MUI Menu", prefix: "mui.menu",
    recipeHash: byAdapter["mui-menu-reviewed-v1"].recipeHash,
    envelopeHash: byAdapter["mui-menu-reviewed-v1"].envelopeHash,
    font: muiFont, fontSize: 16, lineHeight: 24, label: "#000000de",
    panel: { padding: 0, radius: 4, gap: 0, fill: "#ffffffff" },
    item: { paddingX: 16, paddingY: 6, minHeight: 48, fill: "#00000000" },
  },
  antd: {
    adapterIdentity: "antd-menu-reviewed-v1", displayName: "Ant Design",
    componentLabel: "Ant Design Dropdown", prefix: "antd.menu",
    recipeHash: byAdapter["antd-menu-reviewed-v1"].recipeHash,
    envelopeHash: byAdapter["antd-menu-reviewed-v1"].envelopeHash,
    font: antdFont, fontSize: 14, lineHeight: 22, label: "#000000e0",
    panel: { padding: 4, radius: 8, gap: 0, fill: "#ffffffff" },
    item: { paddingX: 12, paddingY: 5, minHeight: 0, fill: "#00000000" },
  },
};

function emit(lib) {
  const p = lib.prefix;
  const planned = [
    ["FLOAT", `${p}.panel-padding`, lib.panel.padding],
    ["FLOAT", `${p}.panel-radius`, lib.panel.radius],
    ["FLOAT", `${p}.panel-itemSpacing`, lib.panel.gap],
    ["COLOR", `${p}.panel-fill`, lib.panel.fill],
    ["FLOAT", `${p}.item-paddingX`, lib.item.paddingX],
    ["FLOAT", `${p}.item-paddingY`, lib.item.paddingY],
    ...(lib.item.minHeight > 0 ? [["FLOAT", `${p}.item-minHeight`, lib.item.minHeight]] : []),
    ["COLOR", `${p}.item-fill`, lib.item.fill],
    ["FLOAT", `${p}.labelFontSize`, lib.fontSize],
    ["FLOAT", `${p}.labelLineHeight`, lib.lineHeight],
    ["COLOR", `${p}.label`, lib.label],
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
if (!page) throw new Error("MENU-PAGE-MISSING");
if (signed.includes(page.id)) throw new Error("MENU-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity) throw new Error("MENU-PAGE-IDENTITY-MISMATCH:" + page.id);
await figma.setCurrentPageAsync(page);
if (page.children.some((n) => n.type === "SECTION" && n.getSharedPluginData(NS, "adapterIdentity") === adapterIdentity))
  throw new Error("MENU-SECTION-EXISTS:" + adapterIdentity);
const hex = (v) => ({ r: parseInt(v.slice(1, 3), 16) / 255, g: parseInt(v.slice(3, 5), 16) / 255, b: parseInt(v.slice(5, 7), 16) / 255, a: parseInt(v.slice(7, 9), 16) / 255 });
const paint = (v) => { const c = hex(v); return { type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }; };
const allFonts = await figma.listAvailableFontsAsync();
const spec = ${JSON.stringify(lib.font)};
const found = spec.fallbackChain.map((c) => allFonts.find((f) => f.fontName.family === c.family && f.fontName.style === c.style)).find(Boolean);
if (!found) throw new Error("MENU-FONT-UNAVAILABLE");
if (found.fontName.family !== spec.resolvedFamily || found.fontName.style !== spec.resolvedStyle)
  throw new Error("MENU-FONT-PROVENANCE-TAMPER:" + found.fontName.family + ":" + found.fontName.style);
await figma.loadFontAsync(found.fontName);
const painted = { spec, painted: found.fontName };
const collection = figma.variables.createVariableCollection("Recipe Menu / " + runIdentity + " / " + adapterIdentity);
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
const geom = ${JSON.stringify({ ...lib, font: undefined })};
const paintText = async (characters) => {
  const node = figma.createText();
  node.fontName = painted.painted;
  node.characters = characters;
  node.fontSize = geom.fontSize;
  node.lineHeight = { unit: "PIXELS", value: geom.lineHeight };
  node.textAlignHorizontal = "LEFT";
  node.textAlignVertical = "CENTER";
  node.textAutoResize = "WIDTH_AND_HEIGHT";
  if (node.characters.trim().length > 0 && (node.width <= 0 || node.absoluteRenderBounds === null)) {
    for (const candidate of painted.spec.fallbackChain) {
      if (candidate.family === painted.spec.resolvedFamily && candidate.style === painted.spec.resolvedStyle) continue;
      const next = allFonts.find((e) => e.fontName.family === candidate.family && e.fontName.style === candidate.style);
      if (!next) continue;
      await figma.loadFontAsync(next.fontName);
      node.fontName = next.fontName;
      node.characters = characters;
      if (node.width > 0 && node.absoluteRenderBounds) { painted.painted = next.fontName; break; }
    }
  }
  if (node.width <= 0 || node.height <= 0) throw new Error("MENU-TEXT-GEOMETRY");
  node.fills = [bindColor(paint(geom.label), prefix + ".label")];
  bindFloat(node, "fontSize", prefix + ".labelFontSize");
  bindFloat(node, "lineHeight", prefix + ".labelLineHeight");
  node.name = "menu/label :: font-provenance=" + encodeURIComponent(JSON.stringify(painted.spec));
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
component.name = "menu/variant/default :: " + geom.componentLabel;
component.layoutMode = "VERTICAL";
component.primaryAxisAlignItems = "MIN";
component.counterAxisAlignItems = "MIN";
component.itemSpacing = geom.panel.gap;
component.paddingTop = geom.panel.padding;
component.paddingRight = geom.panel.padding;
component.paddingBottom = geom.panel.padding;
component.paddingLeft = geom.panel.padding;
component.fills = [bindColor(paint(geom.panel.fill), prefix + ".panel-fill")];
component.topLeftRadius = geom.panel.radius;
component.topRightRadius = geom.panel.radius;
component.bottomRightRadius = geom.panel.radius;
component.bottomLeftRadius = geom.panel.radius;
bindFloat(component, "itemSpacing", prefix + ".panel-itemSpacing");
bindFloat(component, "paddingTop", prefix + ".panel-padding");
bindFloat(component, "paddingRight", prefix + ".panel-padding");
bindFloat(component, "paddingBottom", prefix + ".panel-padding");
bindFloat(component, "paddingLeft", prefix + ".panel-padding");
bindFloat(component, "topLeftRadius", prefix + ".panel-radius");
bindFloat(component, "topRightRadius", prefix + ".panel-radius");
bindFloat(component, "bottomRightRadius", prefix + ".panel-radius");
bindFloat(component, "bottomLeftRadius", prefix + ".panel-radius");
section.appendChild(component);
for (const characters of ["Item One", "Item Two"]) {
  const item = figma.createFrame();
  item.name = "menu/item";
  item.layoutMode = "HORIZONTAL";
  item.primaryAxisAlignItems = "MIN";
  item.counterAxisAlignItems = "CENTER";
  item.paddingTop = geom.item.paddingY;
  item.paddingRight = geom.item.paddingX;
  item.paddingBottom = geom.item.paddingY;
  item.paddingLeft = geom.item.paddingX;
  item.fills = [bindColor(paint(geom.item.fill), prefix + ".item-fill")];
  bindFloat(item, "paddingTop", prefix + ".item-paddingY");
  bindFloat(item, "paddingRight", prefix + ".item-paddingX");
  bindFloat(item, "paddingBottom", prefix + ".item-paddingY");
  bindFloat(item, "paddingLeft", prefix + ".item-paddingX");
  if (geom.item.minHeight > 0) { item.minHeight = geom.item.minHeight; bindFloat(item, "minHeight", prefix + ".item-minHeight"); }
  component.appendChild(item);
  item.appendChild(await paintText(characters));
  item.layoutSizingHorizontal = "HUG";
  item.layoutSizingVertical = "HUG";
}
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
container.setSharedPluginData(NS, "ownershipKey", "menu/container");
component.setSharedPluginData(NS, "runIdentity", runIdentity);
component.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
component.setSharedPluginData(NS, "recipeHash", recipeHash);
component.setSharedPluginData(NS, "envelopeHash", envelopeHash);
component.setSharedPluginData(NS, "ownershipKey", "menu");
section.resizeWithoutConstraints(container.width + 160, container.y + container.height + 80);
return { pageId: page.id, sectionId: section.id, componentId: component.id, containerId: container.id, adapterIdentity, paintedFont: painted.painted };
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
  if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity) throw new Error("MENU-PAGE-IDENTITY-MISMATCH:" + page.id);
  if (signed.includes(page.id)) throw new Error("MENU-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
  return { pageId: page.id, pageName: page.name, created: false };
}
page = figma.createPage();
page.name = pageName;
if (signed.includes(page.id)) throw new Error("MENU-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
page.setSharedPluginData(NS, "pageOwner", "recipe/menu/" + runIdentity);
page.setSharedPluginData(NS, "runIdentity", runIdentity);
page.setSharedPluginData(NS, "writerVersion", "1");
return { pageId: page.id, pageName: page.name, created: true };
`,
);
console.log("wrote compact hosts and create-page");
