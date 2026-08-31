import { readFileSync, writeFileSync } from "node:fs";

const plan = JSON.parse(
  readFileSync(new URL("./plan.json", import.meta.url), "utf8"),
);
const RUN = plan.runIdentity;
const PAGE = plan.pageName;
const NS = plan.namespace;
const SIGNED = [
  "115:295378",
  "163:35981",
  "183:70641",
  "183:69150",
  "85:6781",
  "173:48924",
  "181:64873",
  "183:74742",
  "183:75031",
  "183:75302",
  "183:75495",
  "183:75801",
  "183:75976",
  "183:76022",
  "183:76063",
];

const astryxLabelFont = {
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  resolvedFamily: "SF Pro",
  resolvedStyle: "Regular",
  resolution: "fallback",
  fallbackChain: [
    { family: "-apple-system", style: "Regular" },
    { family: "SF Pro", style: "Regular" },
    { family: "Segoe UI", style: "Regular" },
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
  degradation:
    "source -apple-system Regular; Figma cannot load a CSS stack; first named host font is SF Pro Regular",
};

const muiLabelFont = {
  requestedFamily: "Roboto",
  requestedStyle: "Regular",
  resolvedFamily: "Roboto",
  resolvedStyle: "Regular",
  resolution: "requested",
  fallbackChain: [
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
};

const antdLabelFont = {
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  resolvedFamily: "SF Pro",
  resolvedStyle: "Regular",
  resolution: "fallback",
  fallbackChain: [
    { family: "-apple-system", style: "Regular" },
    { family: "SF Pro", style: "Regular" },
    { family: "Segoe UI", style: "Regular" },
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica Neue", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
  degradation:
    "antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Regular",
};

const byAdapter = Object.fromEntries(
  plan.sources.map((source) => [source.adapterIdentity, source]),
);

const libraries = {
  astryx: {
    adapterIdentity: "astryx-link-reviewed-v1",
    displayName: "Astryx",
    componentLabel: "Astryx Link",
    recipeHash: byAdapter["astryx-link-reviewed-v1"].recipeHash,
    envelopeHash: byAdapter["astryx-link-reviewed-v1"].envelopeHash,
    prefix: "astryx.link",
    labelFont: astryxLabelFont,
    label: "Link",
    decoration: "NONE",
    lineHeightUnit: "PIXELS",
    labelFontSize: 14,
    labelLineHeight: 20,
    rest: {
      boxFill: "#00000000",
      boxBorder: "#00000000",
      boxOpacity: 1,
      label: "#0064e0ff",
    },
  },
  mui: {
    adapterIdentity: "mui-link-reviewed-v1",
    displayName: "MUI",
    componentLabel: "MUI Link",
    recipeHash: byAdapter["mui-link-reviewed-v1"].recipeHash,
    envelopeHash: byAdapter["mui-link-reviewed-v1"].envelopeHash,
    prefix: "mui.link",
    labelFont: muiLabelFont,
    label: "Link",
    decoration: "UNDERLINE",
    lineHeightUnit: "AUTO",
    labelFontSize: 14,
    labelLineHeight: 0,
    rest: {
      boxFill: "#00000000",
      boxBorder: "#00000000",
      boxOpacity: 1,
      label: "#1976d2ff",
    },
  },
  antd: {
    adapterIdentity: "antd-link-reviewed-v1",
    displayName: "Ant Design",
    componentLabel: "Ant Design Typography.Link",
    recipeHash: byAdapter["antd-link-reviewed-v1"].recipeHash,
    envelopeHash: byAdapter["antd-link-reviewed-v1"].envelopeHash,
    prefix: "antd.link",
    labelFont: antdLabelFont,
    label: "Link",
    decoration: "NONE",
    lineHeightUnit: "PIXELS",
    labelFontSize: 14,
    labelLineHeight: 22,
    rest: {
      boxFill: "#00000000",
      boxBorder: "#00000000",
      boxOpacity: 1,
      label: "#1677ffff",
    },
  },
};

function emit(lib) {
  const p = lib.prefix;
  const planned = [
    ["FLOAT", `${p}.box-paddingX`, 0],
    ["FLOAT", `${p}.box-paddingY`, 0],
    ["FLOAT", `${p}.box-radius`, 0],
    ["FLOAT", `${p}.box-borderWidth`, 0],
    ["FLOAT", `${p}.labelFontSize`, lib.labelFontSize],
    ...(lib.lineHeightUnit === "PIXELS"
      ? [["FLOAT", `${p}.labelLineHeight`, lib.labelLineHeight]]
      : []),
    ["COLOR", `${p}.rest-boxFill`, lib.rest.boxFill],
    ["COLOR", `${p}.rest-boxBorder`, lib.rest.boxBorder],
    ["COLOR", `${p}.rest-label`, lib.rest.label],
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
const page = figma.root.children.find((candidate) => candidate.name === pageName);
if (!page) throw new Error("LINK-PAGE-MISSING");
if (signed.includes(page.id)) throw new Error("LINK-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity)
  throw new Error("LINK-PAGE-IDENTITY-MISMATCH:" + page.id);
await figma.setCurrentPageAsync(page);
if (signed.includes(figma.currentPage.id)) throw new Error("LINK-MUST-NOT-WRITE-SIGNED-PAGE:" + figma.currentPage.id);
if (page.children.some((node) => node.type === "SECTION" && node.getSharedPluginData(NS, "adapterIdentity") === adapterIdentity))
  throw new Error("LINK-SECTION-EXISTS:" + adapterIdentity);

const hex = (value) => ({
  r: parseInt(value.slice(1, 3), 16) / 255,
  g: parseInt(value.slice(3, 5), 16) / 255,
  b: parseInt(value.slice(5, 7), 16) / 255,
  a: parseInt(value.slice(7, 9), 16) / 255,
});
const paint = (value) => {
  const c = hex(value);
  return { type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a };
};
const allFonts = await figma.listAvailableFontsAsync();
const resolvePainted = async (spec) => {
  const found = spec.fallbackChain
    .map((candidate) => allFonts.find((font) => font.fontName.family === candidate.family && font.fontName.style === candidate.style))
    .find(Boolean);
  if (!found) throw new Error("LINK-FONT-UNAVAILABLE:" + spec.requestedFamily + ":" + spec.requestedStyle);
  if (found.fontName.family !== spec.resolvedFamily || found.fontName.style !== spec.resolvedStyle)
    throw new Error("LINK-FONT-PROVENANCE-TAMPER:" + found.fontName.family + ":" + found.fontName.style);
  await figma.loadFontAsync(found.fontName);
  return { spec, found: found.fontName, painted: found.fontName };
};
const labelResolved = await resolvePainted(${JSON.stringify(lib.labelFont)});

const collectionName = "Recipe Link / " + runIdentity + " / " + adapterIdentity;
const locals = figma.variables.getLocalVariableCollectionsAsync
  ? await figma.variables.getLocalVariableCollectionsAsync()
  : [];
if (locals.some((collection) => collection.name === collectionName)) throw new Error("LINK-VARIABLE-COLLECTION-COLLISION:" + collectionName);
const collection = figma.variables.createVariableCollection(collectionName);
collection.renameMode(collection.modes[0].modeId, "Default");
collection.hiddenFromPublishing = true;
const modeId = collection.modes[0].modeId;
const prefix = ${JSON.stringify(p)};
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
const geom = ${JSON.stringify({
    labelFontSize: lib.labelFontSize,
    labelLineHeight: lib.labelLineHeight,
    lineHeightUnit: lib.lineHeightUnit,
    decoration: lib.decoration,
    label: lib.label,
    rest: lib.rest,
    componentLabel: lib.componentLabel,
  })};

const paintText = async (resolved, characters, fontSize, lineHeight, lineHeightUnit, decoration) => {
  const node = figma.createText();
  node.fontName = resolved.painted;
  node.characters = characters;
  node.fontSize = fontSize;
  node.lineHeight = lineHeightUnit === "AUTO" ? { unit: "AUTO" } : { unit: "PIXELS", value: lineHeight };
  node.textDecoration = decoration;
  node.textAlignHorizontal = "LEFT";
  node.textAlignVertical = "CENTER";
  node.textAutoResize = "WIDTH_AND_HEIGHT";
  if (node.characters.trim().length > 0 && (node.width <= 0 || node.absoluteRenderBounds === null)) {
    let ok = false;
    for (const candidate of resolved.spec.fallbackChain) {
      if (candidate.family === resolved.spec.resolvedFamily && candidate.style === resolved.spec.resolvedStyle) continue;
      const next = allFonts.find((entry) => entry.fontName.family === candidate.family && entry.fontName.style === candidate.style);
      if (!next) continue;
      await figma.loadFontAsync(next.fontName);
      node.fontName = next.fontName;
      node.characters = characters;
      if (node.width > 0 && node.absoluteRenderBounds) {
        resolved.painted = next.fontName;
        ok = true;
        break;
      }
    }
    if (!ok && (node.width <= 0 || node.absoluteRenderBounds === null))
      throw new Error("LINK-FONT-ZERO-INTRINSIC");
  }
  if (node.width <= 0 || node.height <= 0) throw new Error("LINK-TEXT-GEOMETRY");
  return node;
};

let nextX = 0;
for (const child of page.children) {
  if (child.type === "SECTION") nextX = Math.max(nextX, child.x + child.width + 240);
}
const section = figma.createSection();
section.name = "Recipe Pivot / ${lib.displayName} / " + recipeHash.slice(0, 8);
section.x = nextX;
section.y = 0;
page.appendChild(section);
section.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
section.setSharedPluginData(NS, "recipeHash", recipeHash);
section.setSharedPluginData(NS, "variableCollectionId", collection.id);

const component = figma.createComponent();
component.clipsContent = false;
component.name = "link/variant/default :: " + geom.componentLabel;
component.description = "Experimental link@1 inline-text mint. Recipe " + recipeHash + "; source adapter " + adapterIdentity + ".";
component.opacity = geom.rest.boxOpacity;
component.layoutMode = "HORIZONTAL";
component.primaryAxisAlignItems = "MIN";
component.counterAxisAlignItems = "CENTER";
component.itemSpacing = 0;
component.paddingTop = 0;
component.paddingRight = 0;
component.paddingBottom = 0;
component.paddingLeft = 0;
component.fills = [bindColor(paint(geom.rest.boxFill), prefix + ".rest-boxFill")];
component.strokes = [bindColor(paint(geom.rest.boxBorder), prefix + ".rest-boxBorder")];
component.strokeWeight = 0;
component.strokeAlign = "INSIDE";
component.topLeftRadius = 0;
component.topRightRadius = 0;
component.bottomRightRadius = 0;
component.bottomLeftRadius = 0;
bindFloat(component, "paddingTop", prefix + ".box-paddingY");
bindFloat(component, "paddingRight", prefix + ".box-paddingX");
bindFloat(component, "paddingBottom", prefix + ".box-paddingY");
bindFloat(component, "paddingLeft", prefix + ".box-paddingX");
bindFloat(component, "strokeWeight", prefix + ".box-borderWidth");
bindFloat(component, "topLeftRadius", prefix + ".box-radius");
bindFloat(component, "topRightRadius", prefix + ".box-radius");
bindFloat(component, "bottomRightRadius", prefix + ".box-radius");
bindFloat(component, "bottomLeftRadius", prefix + ".box-radius");
section.appendChild(component);

const label = await paintText(labelResolved, geom.label, geom.labelFontSize, geom.labelLineHeight, geom.lineHeightUnit, geom.decoration);
label.name = "link/label :: font-provenance=" + encodeURIComponent(JSON.stringify(labelResolved.spec));
label.fills = [bindColor(paint(geom.rest.label), prefix + ".rest-label")];
bindFloat(label, "fontSize", prefix + ".labelFontSize");
if (geom.lineHeightUnit === "PIXELS") bindFloat(label, "lineHeight", prefix + ".labelLineHeight");
component.appendChild(label);

component.layoutSizingHorizontal = "HUG";
component.layoutSizingVertical = "HUG";
if (component.layoutMode !== "HORIZONTAL") throw new Error("LINK-FAKE-LAYOUT:" + component.name);

const container = figma.createFrame();
container.name = "Component Container";
container.layoutMode = "NONE";
container.fills = [];
container.x = 80;
container.y = 96;
section.appendChild(container);
container.appendChild(component);
container.setSharedPluginData(NS, "runIdentity", runIdentity);
container.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
container.setSharedPluginData(NS, "recipeHash", recipeHash);
container.setSharedPluginData(NS, "ownershipKey", "link/container");
component.setSharedPluginData(NS, "runIdentity", runIdentity);
component.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
component.setSharedPluginData(NS, "recipeHash", recipeHash);
component.setSharedPluginData(NS, "envelopeHash", envelopeHash);
component.setSharedPluginData(NS, "ownershipKey", "link");
section.resizeWithoutConstraints(container.width + 160, container.y + container.height + 80);
return {
  pageId: page.id,
  pageName: page.name,
  sectionId: section.id,
  componentId: component.id,
  containerId: container.id,
  collectionId: collection.id,
  variantCount: 1,
  adapterIdentity,
  recipeHash,
  paintedLabelFont: labelResolved.painted,
};
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
let page = figma.root.children.find((candidate) => candidate.name === pageName);
if (page) {
  if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity)
    throw new Error("LINK-PAGE-IDENTITY-MISMATCH:" + page.id);
  if (signed.includes(page.id)) throw new Error("LINK-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
  return { pageId: page.id, pageName: page.name, created: false };
}
page = figma.createPage();
page.name = pageName;
if (signed.includes(page.id)) throw new Error("LINK-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
page.setSharedPluginData(NS, "pageOwner", "recipe/link/" + runIdentity);
page.setSharedPluginData(NS, "runIdentity", runIdentity);
page.setSharedPluginData(NS, "writerVersion", "1");
return { pageId: page.id, pageName: page.name, created: true };
`,
);
console.log("wrote compact hosts and create-page");
