import { readNative } from "./figma-read.mjs";
import { patchNative } from "./figma-patch.mjs";
import { canonical } from "./surface.mjs";
import { makePlan } from "./surface.mjs";
import { resolveBundle } from "./model.mjs";
export async function runtime(R, figma, read = readNative, patch = patchNative) {
  if (figma.fileKey !== R.fileKey) throw Error("wrong target file");
  const B = R.bundle,
    stable = (x) =>
      JSON.stringify(x, (_, v) =>
        typeof v === "number"
          ? Math.round(v * 1e6) / 1e6
          : v && typeof v === "object" && !Array.isArray(v)
            ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
            : v,
      ),
    rgb = (h) => ({
      r: parseInt(h.slice(1, 3), 16) / 255,
      g: parseInt(h.slice(3, 5), 16) / 255,
      b: parseInt(h.slice(5, 7), 16) / 255,
    }),
    hex = (c) =>
      "#" +
      [c.r, c.g, c.b]
        .map((v) =>
          Math.round(v * 255)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
  let page = figma.root.children.find((p) => p.name === R.page);
  if (!page) throw Error("missing target page");
  await page.loadAsync();
  const inventory = async () => ({
    pageChildren: page.children.length,
    variables: (await figma.variables.getLocalVariablesAsync()).length,
    collections: (await figma.variables.getLocalVariableCollectionsAsync()).length,
  });
  if (R.plan.status !== "ready") {
    const before = await inventory();
    return { ...R.plan, created: 0, before, after: await inventory() };
  }
  const parent = B.components[B.root],
    collectionNames = Object.fromEntries(["primitive", "semantic", "component"].map((t) => [t, R.prefix + " / " + t]));
  let board = page.children.find((n) => n.name === R.prefix),
    collections = {},
    vars = {},
    components = {};
  for (const c of await figma.variables.getLocalVariableCollectionsAsync()) {
    const tier = Object.keys(collectionNames).find((k) => collectionNames[k] === c.name);
    if (tier) collections[tier] = c;
  }
  for (const [id, t] of Object.entries(B.system.tokens)) {
    const c = collections[t.tier];
    if (c)
      vars[id] = (await Promise.all(c.variableIds.map((id) => figma.variables.getVariableByIdAsync(id)))).find(
        (v) => v.name === id.replaceAll(".", "/"),
      );
  }
  if (board)
    for (const n of board.findAll(
      (n) =>
        ["COMPONENT", "COMPONENT_SET"].includes(n.type) &&
        n.getSharedPluginData("ds_contracts_roundtrip_v1", "contract-id") !== "",
    ))
      components[n.getSharedPluginData("ds_contracts_roundtrip_v1", "contract-id")] = n;
  const tokenFor = (a) => (a ? (Object.keys(vars).find((id) => vars[id]?.id === a.id) ?? null) : null);
  const paints = (n) => n.fills?.filter((p) => p.visible !== false && p.type === "SOLID") ?? [];
  const shot = () => read({ B, parent, board, collections, vars, components, tokenFor, paints, stable, hex });
  const before = await shot();
  if (R.action === "read") return before;
  const applyTokens = () => {
    for (const id of R.plan.tokenOrder) {
      const t = B.system.tokens[id];
      vars[id].setValueForMode(
        collections[t.tier].defaultModeId,
        t.alias ? figma.variables.createVariableAlias(vars[t.alias]) : rgb(t.value),
      );
    }
  };
  if (board) {
    if (R.action === "create") {
      for (const [id, c] of Object.entries(B.components))
        if (components[id]?.getSharedPluginData("ds_contracts_roundtrip_v1", "contract-revision") !== c.revision)
          throw Error("existing projection has a different contract: " + id);
      return { status: "unchanged", created: 0, snapshot: before };
    }
    if (R.action === "patch")
      return patch({ R, figma, B, parent, vars, collections, components, stable, rgb, shot, before });
    if (stable(before) !== stable(R.expected)) throw Error("native revision conflict");
    return { status: "unchanged", created: 0, snapshot: before };
  }
  if (R.action !== "create") throw Error("missing native projection");
  if (Object.values(collections).length) throw Error("partial existing projection");
  const fonts = await figma.listAvailableFontsAsync();
  for (const v of R.appearance.variants)
    for (const p of Object.values(v.parts))
      if (p.kind === "text") {
        const f = { family: p.styles["font-family"], style: p.styles["font-style"] };
        if (!fonts.some((x) => x.fontName.family === f.family && x.fontName.style === f.style))
          throw Error("missing font: " + f.family + " / " + f.style);
        await figma.loadFontAsync(f);
      }
  await figma.setCurrentPageAsync(page);
  const created = [],
    track = (x) => {
      created.push(x);
      return x;
    };
  try {
    for (const tier of new Set(Object.values(B.system.tokens).map((t) => t.tier))) {
      const c = track(figma.variables.createVariableCollection(collectionNames[tier]));
      c.renameMode(c.defaultModeId, B.system.mode);
      collections[tier] = c;
    }
    for (const id of R.plan.tokenOrder) {
      const t = B.system.tokens[id],
        v = track(figma.variables.createVariable(id.replaceAll(".", "/"), collections[t.tier], "COLOR"));
      v.scopes = t.scopes;
      v.setVariableCodeSyntax("WEB", "var(" + t.css + ")");
      v.description = t.tier + " token; source: " + t.source.file + "#/" + t.source.path.join("/");
      vars[id] = v;
    }
    applyTokens();
    board = track(figma.createFrame());
    page.appendChild(board);
    board.name = R.prefix;
    board.layoutMode = "HORIZONTAL";
    board.itemSpacing = 64;
    board.paddingLeft = board.paddingRight = board.paddingTop = board.paddingBottom = 24;
    board.primaryAxisSizingMode = board.counterAxisSizingMode = "AUTO";
    board.x = R.x;
    board.y = R.y;
    board.fills = [{ type: "SOLID", color: rgb("#ffffff") }];
    const bind = (n, token, field = "fills") => {
      n[field] = [
        figma.variables.setBoundVariableForPaint({ type: "SOLID", color: rgb("#000000") }, "color", vars[token]),
      ];
    };
    for (const id of R.plan.componentOrder) {
      const c = B.components[id];
      if (c.kind !== "svg") continue;
      const svg = track(figma.createNodeFromSvg(c.svg.replaceAll("currentColor", "#000000")));
      const n = track(figma.createComponentFromNode(svg));
      board.appendChild(n);
      n.name = c.name;
      n.setSharedPluginData("ds_contracts_roundtrip_v1", "contract-id", id);
      n.setSharedPluginData("ds_contracts_roundtrip_v1", "contract-revision", c.revision);
      components[id] = n;
    }
    const roots = [];
    for (const v of R.appearance.variants) {
      const nodes = {};
      for (const [part, p] of Object.entries(v.parts).sort(
        (a, b) => a[1].depth - b[1].depth || a[1].order - b[1].order,
      )) {
        const s = p.styles,
          n = track(
            part === "root" ? figma.createComponent() : p.kind === "text" ? figma.createText() : figma.createFrame(),
          );
        (p.parent ? nodes[p.parent] : board).appendChild(n);
        nodes[part] = n;
        n.name = part;
        n.setSharedPluginData("ds_contracts_roundtrip_v1", "part", part);
        if (p.kind === "text") {
          n.fontName = { family: s["font-family"], style: s["font-style"] };
          n.fontSize = s["font-size"];
          n.lineHeight = { unit: "PIXELS", value: s["line-height"] };
          n.letterSpacing = { unit: "PIXELS", value: s["letter-spacing"] };
          n.characters = s.text;
          if (p.tokens.color) bind(n, p.tokens.color);
          else n.fills = [{ type: "SOLID", color: rgb(s.color) }];
          n.textAutoResize = s["width-sizing"] === "hug" ? "WIDTH_AND_HEIGHT" : "HEIGHT";
        } else {
          n.layoutMode = s.layout === "row" ? "HORIZONTAL" : "VERTICAL";
          n.itemSpacing = s.gap;
          [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft] = s.padding;
          n.primaryAxisAlignItems = s["align-main"] === "center" ? "CENTER" : "MIN";
          n.counterAxisAlignItems = s["align-cross"] === "center" ? "CENTER" : "MIN";
          n.cornerRadius = s.radius;
          n.clipsContent = s.clip;
          n.strokesIncludedInLayout = s["stroke-in-layout"];
          n.fills = [];
          if (p.tokens.fill) bind(n, p.tokens.fill);
          else if (s.fill) n.fills = [{ type: "SOLID", color: rgb(s.fill) }];
          if (s.stroke) {
            n.strokeWeight = s["stroke-width"];
            n.strokeAlign = s["stroke-align"].toUpperCase();
            n.strokesIncludedInLayout = s["stroke-in-layout"];
            if (p.tokens.stroke) bind(n, p.tokens.stroke, "strokes");
            else n.strokes = [{ type: "SOLID", color: rgb(s.stroke) }];
          }
        }
        n.resize(Math.max(0.01, s.width), Math.max(0.01, s.height));
        n.opacity = s.opacity;
        n.visible = s.visible;
        n.layoutSizingHorizontal = s["width-sizing"].toUpperCase();
        n.layoutSizingVertical = s["height-sizing"].toUpperCase();
        if (parent.instances[part]) {
          const dep = parent.instances[part],
            i = track(components[dep.component].createInstance());
          n.appendChild(i);
          if (dep.width) {
            if (Math.abs(dep.width / i.width - dep.height / i.height) > 1e-6) throw Error("nonuniform SVG scale");
            i.rescale(dep.width / i.width);
          }
          i.name = part + " / " + B.components[dep.component].name;
          for (const v of i.findAll((n) => n.type === "VECTOR")) bind(v, dep.colorToken, dep.paint ?? "fills");
        }
      }
      const r = nodes.root;
      r.name = Object.entries(v.axes)
        .map(([k, x]) => k + "=" + x)
        .join(", ");
      r.setSharedPluginData("ds_contracts_roundtrip_v1", "variant", v.key);
      r.setSharedPluginData("ds_contracts_roundtrip_v1", "axes", JSON.stringify(v.axes));
      roots.push(r);
    }
    const set = track(figma.combineAsVariants(roots, board));
    set.name = parent.name;
    set.layoutMode = "VERTICAL";
    set.itemSpacing = 24;
    set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 24;
    set.primaryAxisSizingMode = set.counterAxisSizingMode = "AUTO";
    set.fills = [];
    set.setSharedPluginData("ds_contracts_roundtrip_v1", "contract-id", B.root);
    set.setSharedPluginData("ds_contracts_roundtrip_v1", "contract-revision", parent.revision);
    components[B.root] = set;
    for (const prop of parent.appearance.props) {
      const part = Object.keys(parent.appearance.parts).find(
        (k) => parent.appearance.parts[k].binds?.text === prop.name,
      );
      if (!part) continue;
      const ref = set.addComponentProperty(prop.name, "TEXT", prop.default);
      for (const r of roots)
        r.findOne(
          (n) => n.getSharedPluginData("ds_contracts_roundtrip_v1", "part") === part,
        ).componentPropertyReferences = { characters: ref };
    }
    for (const slot of Object.keys(parent.instances)) {
      const dep = parent.instances[slot],
        prop = set.addComponentProperty(slot, "INSTANCE_SWAP", components[dep.component].id);
      for (const r of roots)
        r.findOne(
          (n) => n.getSharedPluginData("ds_contracts_roundtrip_v1", "part") === slot,
        ).children[0].componentPropertyReferences = { mainComponent: prop };
    }
    const review = track(figma.createFrame());
    board.appendChild(review);
    review.name = "Review instances";
    review.layoutMode = "VERTICAL";
    review.itemSpacing = 24;
    review.primaryAxisSizingMode = review.counterAxisSizingMode = "AUTO";
    review.fills = [];
    for (const r of roots) review.appendChild(track(r.createInstance()));
    figma.viewport.scrollAndZoomIntoView([board]);
    return {
      status: "created",
      created: new Set(created.filter((x) => !x.removed).map((x) => x.id)).size,
      snapshot: await shot(),
      review: review.id,
    };
  } catch (e) {
    for (const x of created.reverse())
      try {
        x.remove();
      } catch {}
    throw e;
  }
}
export function emitSystem(bundle, options) {
  const plan = resolveBundle(bundle),
    parent = bundle.components[bundle.root];
  if (!options?.fileKey || !options?.page || !options?.prefix) throw Error("missing Figma target");
  return `return (${runtime.toString()})(${canonical({ action: "create", bundle, plan, appearance: plan.status === "ready" ? makePlan(parent.appearance) : null, ...options })},figma,(${readNative.toString()}),(${patchNative.toString()}));\n`;
}
