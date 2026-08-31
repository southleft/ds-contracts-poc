if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.switch.recipe.v1";
const runIdentity = "a8686d63-3d086535-f55e4ace-switch-v1";
const pageName = "Recipe Pivot / Switch / a8686d63-3d086535-f55e4ace-switch-v1";
const adapterIdentity = "mui-switch-reviewed-v1";
const recipeHash = "3d086535652c5e04f6745d2edfb6eeee5601a01c8891a1fe3aca2ddade7a20c7";
const envelopeHash = "657e88a4611f93ed02925b49553aa1a19fd21f523f3ce123d3a6bcd36ef6b035";
const signed = ["115:295378","163:35981","183:70641","183:69150","85:6781","173:48924","181:64873","183:74742","183:75031"];
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
const fontSpec = {"requestedFamily":"Roboto","requestedStyle":"Regular","resolvedFamily":"Roboto","resolvedStyle":"Regular","resolution":"requested","fallbackChain":[{"family":"Roboto","style":"Regular"},{"family":"Helvetica","style":"Regular"},{"family":"Arial","style":"Regular"}]};
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
const prefix = "mui.switch";
const planned = [["FLOAT","mui.switch.wrapper-width",58],["FLOAT","mui.switch.wrapper-height",38],["FLOAT","mui.switch.wrapper-padding",12],["FLOAT","mui.switch.track-width",34],["FLOAT","mui.switch.track-height",14],["FLOAT","mui.switch.track-radius",7],["FLOAT","mui.switch.track-padding",0],["FLOAT","mui.switch.thumb-offSize",20],["FLOAT","mui.switch.thumb-onSize",20],["FLOAT","mui.switch.thumb-travel",20],["FLOAT","mui.switch.row-gap",0],["FLOAT","mui.switch.labelFontSize",16],["COLOR","mui.switch.states-false-enabled-trackFill","#00000061"],["COLOR","mui.switch.states-false-enabled-thumbFill","#ffffffff"],["COLOR","mui.switch.states-false-enabled-label","#000000de"],["COLOR","mui.switch.states-false-disabled-trackFill","#0000001f"],["COLOR","mui.switch.states-false-disabled-thumbFill","#f5f5f5ff"],["COLOR","mui.switch.states-false-disabled-label","#00000061"],["COLOR","mui.switch.states-true-enabled-trackFill","#1976d280"],["COLOR","mui.switch.states-true-enabled-thumbFill","#1976d2ff"],["COLOR","mui.switch.states-true-enabled-label","#000000de"],["COLOR","mui.switch.states-true-disabled-trackFill","#1976d21f"],["COLOR","mui.switch.states-true-disabled-thumbFill","#a7caedff"],["COLOR","mui.switch.states-true-disabled-label","#00000061"]];
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
const geom = {"wrapper":{"width":58,"height":38,"padding":12},"track":{"width":34,"height":14,"radius":7,"padding":0},"thumb":{"off":20,"on":20,"travel":20},"gap":0,"hitClips":true,"trackClips":false,"fontSize":16,"cells":{"false/false":{"track":"#00000061","thumb":"#ffffffff","opacity":1,"label":"#000000de"},"false/true":{"track":"#0000001f","thumb":"#f5f5f5ff","opacity":1,"label":"#00000061"},"true/false":{"track":"#1976d280","thumb":"#1976d2ff","opacity":1,"label":"#000000de"},"true/true":{"track":"#1976d21f","thumb":"#a7caedff","opacity":1,"label":"#00000061"}}};

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
section.name = "Recipe Pivot / MUI / " + recipeHash.slice(0, 8);
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
set.name = "switch/set :: MUI Switch";
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
