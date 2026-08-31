if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.switch.recipe.v1";
const runIdentity = "a8686d63-3d086535-0720db18-switch-v2";
const pageName = "Recipe Pivot / Switch / a8686d63-3d086535-0720db18-switch-v2";
const adapterIdentity = "antd-switch-reviewed-v1";
const recipeHash = "0720db18b3adc4f736a5444aff4a7f2e7de30fded087d4f58342a3bc55ddb85c";
const envelopeHash = "15b2d3ab46d8f605e912d4b4c02ce375c99208b8d2d57bd4a2eddea33ead8da6";
const signed = ["115:295378","163:35981","183:70641","183:69150","85:6781","173:48924","181:64873","183:74742","183:75031","183:75302","196:76370","197:76679"];
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
const fontSpec = {"requestedFamily":"-apple-system","requestedStyle":"Regular","resolvedFamily":"SF Pro","resolvedStyle":"Regular","resolution":"fallback","fallbackChain":[{"family":"-apple-system","style":"Regular"},{"family":"SF Pro","style":"Regular"},{"family":"Segoe UI","style":"Regular"},{"family":"Roboto","style":"Regular"},{"family":"Helvetica Neue","style":"Regular"},{"family":"Arial","style":"Regular"}],"degradation":"antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Regular"};
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
const prefix = "antd.switch";
const planned = [["FLOAT","antd.switch.wrapper-width",44],["FLOAT","antd.switch.wrapper-height",22],["FLOAT","antd.switch.wrapper-padding",0],["FLOAT","antd.switch.track-width",44],["FLOAT","antd.switch.track-height",22],["FLOAT","antd.switch.track-radius",100],["FLOAT","antd.switch.track-padding",2],["FLOAT","antd.switch.thumb-offSize",18],["FLOAT","antd.switch.thumb-onSize",18],["FLOAT","antd.switch.thumb-travel",22],["FLOAT","antd.switch.row-gap",8],["FLOAT","antd.switch.labelFontSize",14],["COLOR","antd.switch.states-false-enabled-trackFill","#00000040"],["COLOR","antd.switch.states-false-enabled-thumbFill","#ffffffff"],["COLOR","antd.switch.states-false-enabled-label","#000000e0"],["COLOR","antd.switch.states-false-disabled-trackFill","#00000040"],["COLOR","antd.switch.states-false-disabled-thumbFill","#ffffffff"],["COLOR","antd.switch.states-false-disabled-label","#00000040"],["COLOR","antd.switch.states-true-enabled-trackFill","#1677ffff"],["COLOR","antd.switch.states-true-enabled-thumbFill","#ffffffff"],["COLOR","antd.switch.states-true-enabled-label","#000000e0"],["COLOR","antd.switch.states-true-disabled-trackFill","#1677ffff"],["COLOR","antd.switch.states-true-disabled-thumbFill","#ffffffff"],["COLOR","antd.switch.states-true-disabled-label","#00000040"]];
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
const geom = {"wrapper":{"width":44,"height":22,"padding":0},"track":{"width":44,"height":22,"radius":100,"padding":2},"thumb":{"off":18,"on":18,"travel":22},"gap":8,"hitClips":false,"trackClips":false,"fontSize":14,"cells":{"false/false":{"track":"#00000040","thumb":"#ffffffff","opacity":1,"label":"#000000e0"},"false/true":{"track":"#00000040","thumb":"#ffffffff","opacity":0.65,"label":"#00000040"},"true/false":{"track":"#1677ffff","thumb":"#ffffffff","opacity":1,"label":"#000000e0"},"true/true":{"track":"#1677ffff","thumb":"#ffffffff","opacity":0.65,"label":"#00000040"}}};

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
section.name = "Recipe Pivot / Ant Design / " + recipeHash.slice(0, 8);
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
set.name = "switch/set :: Ant Design Switch";
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
