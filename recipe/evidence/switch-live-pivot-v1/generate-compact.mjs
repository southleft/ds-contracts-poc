import { writeFileSync } from "node:fs";

const RUN = "a8686d63-3d086535-f55e4ace-switch-v1";
const PAGE = `Recipe Pivot / Switch / ${RUN}`;
const NS = "ds.contracts.switch.recipe.v1";
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
];

const astryxFont = {
  requestedFamily: "-apple-system",
  requestedStyle: "Medium",
  resolvedFamily: "SF Pro",
  resolvedStyle: "Medium",
  resolution: "fallback",
  fallbackChain: [
    { family: "-apple-system", style: "Medium" },
    { family: "SF Pro", style: "Medium" },
    { family: "Segoe UI", style: "Semibold" },
    { family: "Roboto", style: "Medium" },
    { family: "Helvetica", style: "Bold" },
    { family: "Arial", style: "Bold" },
  ],
  degradation:
    "source -apple-system stack; Figma cannot load a CSS stack; first named host font is SF Pro Medium",
};

const muiFont = {
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

const antdFont = {
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

const libraries = {
  astryx: {
    adapterIdentity: "astryx-switch-reviewed-v1",
    displayName: "Astryx",
    setLabel: "Astryx Switch",
    recipeHash:
      "a8686d63bbcec90bc7f3c3916a1c75c257d1629c7e7b86d8f4da9e2b85a0fd96",
    envelopeHash:
      "1097fbc9ac542b32d5302417e062c4b25c410c9c2b56c2f8d0176c93847dc542",
    prefix: "astryx.switch",
    font: astryxFont,
    fontSize: 14,
    wrapper: { width: 40, height: 24, padding: 0 },
    track: { width: 40, height: 24, radius: 9999, padding: 4 },
    thumb: { off: 16, on: 20, travel: 14 },
    gap: 8,
    hitClips: false,
    trackClips: false,
    cells: {
      "false/false": {
        track: "#0a131733",
        thumb: "#ffffffff",
        opacity: 1,
        label: "#4e606fff",
      },
      "false/true": {
        track: "#0a131733",
        thumb: "#ffffffff",
        opacity: 0.5,
        label: "#a4b0bcff",
      },
      "true/false": {
        track: "#0064e0ff",
        thumb: "#ffffffff",
        opacity: 1,
        label: "#4e606fff",
      },
      "true/true": {
        track: "#0064e0ff",
        thumb: "#ffffffff",
        opacity: 0.5,
        label: "#a4b0bcff",
      },
    },
  },
  mui: {
    adapterIdentity: "mui-switch-reviewed-v1",
    displayName: "MUI",
    setLabel: "MUI Switch",
    recipeHash:
      "3d086535652c5e04f6745d2edfb6eeee5601a01c8891a1fe3aca2ddade7a20c7",
    envelopeHash:
      "657e88a4611f93ed02925b49553aa1a19fd21f523f3ce123d3a6bcd36ef6b035",
    prefix: "mui.switch",
    font: muiFont,
    fontSize: 16,
    wrapper: { width: 58, height: 38, padding: 12 },
    track: { width: 34, height: 14, radius: 7, padding: 0 },
    thumb: { off: 20, on: 20, travel: 20 },
    gap: 0,
    hitClips: true,
    trackClips: false,
    cells: {
      "false/false": {
        track: "#00000061",
        thumb: "#ffffffff",
        opacity: 1,
        label: "#000000de",
      },
      "false/true": {
        track: "#0000001f",
        thumb: "#f5f5f5ff",
        opacity: 1,
        label: "#00000061",
      },
      "true/false": {
        track: "#1976d280",
        thumb: "#1976d2ff",
        opacity: 1,
        label: "#000000de",
      },
      "true/true": {
        track: "#1976d21f",
        thumb: "#a7caedff",
        opacity: 1,
        label: "#00000061",
      },
    },
  },
  antd: {
    adapterIdentity: "antd-switch-reviewed-v1",
    displayName: "Ant Design",
    setLabel: "Ant Design Switch",
    recipeHash:
      "f55e4ace9eb990c26fb6c8d145a122111dc098ee6dfcb7d02317b6314732d067",
    envelopeHash:
      "37652c6deb3f25e61557cee99054d41e099fed0d3eede952362b76c2691874ab",
    prefix: "antd.switch",
    font: antdFont,
    fontSize: 14,
    wrapper: { width: 44, height: 22, padding: 0 },
    track: { width: 44, height: 22, radius: 100, padding: 2 },
    thumb: { off: 18, on: 18, travel: 24 },
    gap: 8,
    hitClips: false,
    trackClips: false,
    cells: {
      "false/false": {
        track: "#00000040",
        thumb: "#ffffffff",
        opacity: 1,
        label: "#000000e0",
      },
      "false/true": {
        track: "#00000040",
        thumb: "#ffffffff",
        opacity: 0.65,
        label: "#00000040",
      },
      "true/false": {
        track: "#1677ffff",
        thumb: "#ffffffff",
        opacity: 1,
        label: "#000000e0",
      },
      "true/true": {
        track: "#1677ffff",
        thumb: "#ffffffff",
        opacity: 0.65,
        label: "#00000040",
      },
    },
  },
};

function emit(lib) {
  const p = lib.prefix;
  const planned = [
    ["FLOAT", `${p}.wrapper-width`, lib.wrapper.width],
    ["FLOAT", `${p}.wrapper-height`, lib.wrapper.height],
    ["FLOAT", `${p}.wrapper-padding`, lib.wrapper.padding],
    ["FLOAT", `${p}.track-width`, lib.track.width],
    ["FLOAT", `${p}.track-height`, lib.track.height],
    ["FLOAT", `${p}.track-radius`, lib.track.radius],
    ["FLOAT", `${p}.track-padding`, lib.track.padding],
    ["FLOAT", `${p}.thumb-offSize`, lib.thumb.off],
    ["FLOAT", `${p}.thumb-onSize`, lib.thumb.on],
    ["FLOAT", `${p}.thumb-travel`, lib.thumb.travel],
    ["FLOAT", `${p}.row-gap`, lib.gap],
    ["FLOAT", `${p}.labelFontSize`, lib.fontSize],
  ];
  for (const checked of ["false", "true"]) {
    for (const disabled of ["false", "true"]) {
      const arm = disabled === "true" ? "disabled" : "enabled";
      const cell = lib.cells[`${checked}/${disabled}`];
      planned.push(["COLOR", `${p}.states-${checked}-${arm}-trackFill`, cell.track]);
      planned.push(["COLOR", `${p}.states-${checked}-${arm}-thumbFill`, cell.thumb]);
      planned.push(["COLOR", `${p}.states-${checked}-${arm}-label`, cell.label]);
    }
  }

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
const page = figma.root.children.find((p) => p.name === pageName);
if (!page) throw new Error("SWITCH-PAGE-MISSING");
if (signed.includes(page.id)) throw new Error("SWITCH-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity)
  throw new Error("SWITCH-PAGE-IDENTITY-MISMATCH:" + page.id);
await figma.setCurrentPageAsync(page);
if (signed.includes(figma.currentPage.id)) throw new Error("SWITCH-MUST-NOT-WRITE-SIGNED-PAGE:" + figma.currentPage.id);
if (page.children.some((n) => n.type === "SECTION" && n.getSharedPluginData(NS, "adapterIdentity") === adapterIdentity))
  throw new Error("SWITCH-SECTION-EXISTS:" + adapterIdentity);

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
const fontSpec = ${JSON.stringify(lib.font)};
const found = fontSpec.fallbackChain
  .map((c) => allFonts.find((f) => f.fontName.family === c.family && f.fontName.style === c.style))
  .find(Boolean);
if (!found) throw new Error("SWITCH-FONT-UNAVAILABLE:" + fontSpec.requestedFamily + ":" + fontSpec.requestedStyle);
if (found.fontName.family !== fontSpec.resolvedFamily || found.fontName.style !== fontSpec.resolvedStyle)
  throw new Error("SWITCH-FONT-PROVENANCE-TAMPER:" + found.fontName.family + ":" + found.fontName.style);
await figma.loadFontAsync(found.fontName);

const collectionName = "Recipe Switch / " + runIdentity + " / " + adapterIdentity;
const locals = figma.variables.getLocalVariableCollectionsAsync
  ? await figma.variables.getLocalVariableCollectionsAsync()
  : [];
if (locals.some((c) => c.name === collectionName)) throw new Error("SWITCH-VARIABLE-COLLECTION-COLLISION:" + collectionName);
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
    wrapper: lib.wrapper,
    track: lib.track,
    thumb: lib.thumb,
    gap: lib.gap,
    hitClips: lib.hitClips,
    trackClips: lib.trackClips,
    fontSize: lib.fontSize,
    cells: lib.cells,
  })};

let paintedFont = found.fontName;
const paintLabel = async (characters) => {
  const label = figma.createText();
  label.fontName = paintedFont;
  label.characters = characters;
  label.fontSize = geom.fontSize;
  label.lineHeight = { unit: "AUTO" };
  label.textAlignHorizontal = "LEFT";
  label.textAlignVertical = "CENTER";
  label.textAutoResize = "WIDTH_AND_HEIGHT";
  if (label.characters.trim().length > 0 && (label.width <= 0 || label.absoluteRenderBounds === null)) {
    let ok = false;
    for (const candidate of fontSpec.fallbackChain) {
      if (candidate.family === fontSpec.resolvedFamily && candidate.style === fontSpec.resolvedStyle) continue;
      const next = allFonts.find((entry) => entry.fontName.family === candidate.family && entry.fontName.style === candidate.style);
      if (!next) continue;
      await figma.loadFontAsync(next.fontName);
      label.fontName = next.fontName;
      label.characters = characters;
      if (label.width > 0 && label.absoluteRenderBounds) {
        paintedFont = next.fontName;
        ok = true;
        break;
      }
    }
    if (!ok && (label.width <= 0 || label.absoluteRenderBounds === null))
      throw new Error("SWITCH-FONT-ZERO-INTRINSIC:switch/label");
  }
  if (label.width <= 0 || label.height <= 0) throw new Error("SWITCH-TEXT-GEOMETRY:switch/label");
  return label;
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

const components = [];
for (const checked of ["false", "true"]) {
  for (const disabled of ["false", "true"]) {
    const arm = disabled === "true" ? "disabled" : "enabled";
    const cell = geom.cells[checked + "/" + disabled];
    const thumbSize = checked === "true" ? geom.thumb.on : geom.thumb.off;
    const travel = checked === "true" ? geom.thumb.travel : 0;
    const vertical = Math.max(0, (geom.track.height - thumbSize) / 2);
    const component = figma.createComponent();
    component.clipsContent = false;
    component.name = "Checked=" + checked + ", Disabled=" + disabled;
    component.layoutMode = "HORIZONTAL";
    component.primaryAxisAlignItems = "MIN";
    component.counterAxisAlignItems = "CENTER";
    component.itemSpacing = geom.gap;
    component.fills = [];
    bindFloat(component, "itemSpacing", prefix + ".row-gap");
    section.appendChild(component);

    const hit = figma.createFrame();
    hit.name = "switch/hit";
    hit.layoutMode = "HORIZONTAL";
    hit.primaryAxisAlignItems = "CENTER";
    hit.counterAxisAlignItems = "CENTER";
    hit.itemSpacing = 0;
    hit.fills = [];
    hit.clipsContent = geom.hitClips;
    hit.paddingTop = geom.wrapper.padding;
    hit.paddingRight = geom.wrapper.padding;
    hit.paddingBottom = geom.wrapper.padding;
    hit.paddingLeft = geom.wrapper.padding;
    hit.resizeWithoutConstraints(geom.wrapper.width, geom.wrapper.height);
    hit.layoutSizingHorizontal = "FIXED";
    hit.layoutSizingVertical = "FIXED";
    bindFloat(hit, "width", prefix + ".wrapper-width");
    bindFloat(hit, "height", prefix + ".wrapper-height");
    bindFloat(hit, "paddingTop", prefix + ".wrapper-padding");
    bindFloat(hit, "paddingRight", prefix + ".wrapper-padding");
    bindFloat(hit, "paddingBottom", prefix + ".wrapper-padding");
    bindFloat(hit, "paddingLeft", prefix + ".wrapper-padding");
    component.appendChild(hit);

    const track = figma.createFrame();
    track.name = "switch/track";
    track.layoutMode = "HORIZONTAL";
    track.primaryAxisAlignItems = "MIN";
    track.counterAxisAlignItems = "CENTER";
    track.itemSpacing = 0;
    track.clipsContent = geom.trackClips;
    track.opacity = cell.opacity;
    track.paddingTop = vertical;
    track.paddingRight = geom.track.padding;
    track.paddingBottom = vertical;
    track.paddingLeft = geom.track.padding + travel;
    track.resizeWithoutConstraints(geom.track.width, geom.track.height);
    track.layoutSizingHorizontal = "FIXED";
    track.layoutSizingVertical = "FIXED";
    track.fills = [bindColor(paint(cell.track), prefix + ".states-" + checked + "-" + arm + "-trackFill")];
    track.topLeftRadius = geom.track.radius;
    track.topRightRadius = geom.track.radius;
    track.bottomRightRadius = geom.track.radius;
    track.bottomLeftRadius = geom.track.radius;
    bindFloat(track, "width", prefix + ".track-width");
    bindFloat(track, "height", prefix + ".track-height");
    if (checked === "false") bindFloat(track, "paddingLeft", prefix + ".track-padding");
    bindFloat(track, "topLeftRadius", prefix + ".track-radius");
    bindFloat(track, "topRightRadius", prefix + ".track-radius");
    bindFloat(track, "bottomRightRadius", prefix + ".track-radius");
    bindFloat(track, "bottomLeftRadius", prefix + ".track-radius");
    hit.appendChild(track);

    const thumb = figma.createFrame();
    thumb.name = "switch/thumb";
    thumb.layoutMode = "HORIZONTAL";
    thumb.resizeWithoutConstraints(thumbSize, thumbSize);
    thumb.layoutSizingHorizontal = "FIXED";
    thumb.layoutSizingVertical = "FIXED";
    thumb.fills = [bindColor(paint(cell.thumb), prefix + ".states-" + checked + "-" + arm + "-thumbFill")];
    thumb.topLeftRadius = thumbSize / 2;
    thumb.topRightRadius = thumbSize / 2;
    thumb.bottomRightRadius = thumbSize / 2;
    thumb.bottomLeftRadius = thumbSize / 2;
    bindFloat(thumb, "width", prefix + (checked === "true" ? ".thumb-onSize" : ".thumb-offSize"));
    bindFloat(thumb, "height", prefix + (checked === "true" ? ".thumb-onSize" : ".thumb-offSize"));
    track.appendChild(thumb);

    const label = await paintLabel("Enable notifications");
    label.name = "switch/label :: font-provenance=" + encodeURIComponent(JSON.stringify(fontSpec));
    label.fills = [bindColor(paint(cell.label), prefix + ".states-" + checked + "-" + arm + "-label")];
    bindFloat(label, "fontSize", prefix + ".labelFontSize");
    component.appendChild(label);
    component.layoutSizingHorizontal = "HUG";
    component.layoutSizingVertical = "HUG";
    if (component.layoutMode !== "HORIZONTAL") throw new Error("SWITCH-FAKE-LAYOUT:" + component.name);
    components.push(component);
  }
}
const set = figma.combineAsVariants(components, section);
set.name = "switch/set :: ${lib.setLabel}";
set.description = "Experimental switch@1 primitive-IR mint. Recipe " + recipeHash + "; source adapter " + adapterIdentity + ".";
set.layoutMode = "VERTICAL";
set.primaryAxisAlignItems = "MIN";
set.counterAxisAlignItems = "MIN";
set.itemSpacing = 16;
set.paddingTop = 16;
set.paddingRight = 16;
set.paddingBottom = 16;
set.paddingLeft = 16;
set.fills = [];
set.layoutSizingHorizontal = "HUG";
set.layoutSizingVertical = "HUG";
set.setSharedPluginData(NS, "runIdentity", runIdentity);
set.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
set.setSharedPluginData(NS, "recipeHash", recipeHash);
set.setSharedPluginData(NS, "envelopeHash", envelopeHash);
set.x = 80;
set.y = 96;
section.resizeWithoutConstraints(set.width + 160, set.y + set.height + 80);
return {
  pageId: page.id,
  pageName: page.name,
  sectionId: section.id,
  setId: set.id,
  collectionId: collection.id,
  variantCount: set.children.length,
  adapterIdentity,
  recipeHash,
  paintedFont,
};
`;
}

for (const [slug, lib] of Object.entries(libraries)) {
  writeFileSync(
    new URL(`./compact-${slug}.js`, import.meta.url),
    emit(lib),
  );
}
console.log("wrote compact hosts");
