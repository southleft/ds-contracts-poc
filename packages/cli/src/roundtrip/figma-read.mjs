export async function readNative(context) {
  const { B, parent, board, collections, vars, components, tokenFor, paints, stable, hex, tokenValue, sourceTokens } = context;
  if (!board) return null;
  const set = components[B.root],
    variants = [];
  for (const root of set.children) {
    const axes = JSON.parse(root.getSharedPluginData("ds_contracts_roundtrip_v1", "axes"));
    if (
      stable(root.variantProperties) !==
      stable(Object.fromEntries(Object.entries(axes).map(([k, v]) => [k, String(v)])))
    )
      throw Error("native variant properties changed");
    for (const child of root.findAll()) {
      if (child.getSharedPluginData("ds_contracts_roundtrip_v1", "part")) continue;
      let p = child,
        owned = false;
      while (p && p !== root) {
        if (
          p.type === "INSTANCE" &&
          parent.instances[p.parent.getSharedPluginData("ds_contracts_roundtrip_v1", "part")]
        ) {
          owned = true;
          break;
        }
        p = p.parent;
      }
      if (!owned) throw Error("unmapped native child: " + child.name);
    }
    const parts = {},
      instances = {};
    for (const n of [root, ...root.findAll((n) => n.getSharedPluginData("ds_contracts_roundtrip_v1", "part") !== "")]) {
      const part = n.getSharedPluginData("ds_contracts_roundtrip_v1", "part");
      if (!part) throw Error("unmapped native part");
      if (
        n.rotation ||
        n.fills.length > 1 ||
        n.fills.some((p) => p.type !== "SOLID" || (p.opacity ?? 1) !== 1) ||
        n.strokes.length > 1 ||
        n.strokes.some((p) => p.type !== "SOLID" || (p.opacity ?? 1) !== 1) ||
        n.effects.length ||
        n.layoutPositioning === "ABSOLUTE"
      )
        throw Error("unsupported native effects or positioning: " + part);
      if (
        n.type !== "TEXT" &&
        (!["HORIZONTAL", "VERTICAL"].includes(n.layoutMode) ||
          n.layoutWrap === "WRAP" ||
          !["MIN", "CENTER"].includes(n.primaryAxisAlignItems) ||
          !["MIN", "CENTER"].includes(n.counterAxisAlignItems))
      )
        throw Error("unsupported native layout: " + part);
      const styles = {
          visible: n.visible,
          opacity: n.opacity,
          width: n.width,
          height: n.height,
          "width-sizing": n.layoutSizingHorizontal.toLowerCase(),
          "height-sizing": n.layoutSizingVertical.toLowerCase(),
        },
        tokens = {};
      if (n.type === "TEXT") {
        Object.assign(styles, {
          text: n.characters,
          "font-family": n.fontName.family,
          "font-style": n.fontName.style,
          "font-weight": n.fontWeight,
          "font-size": n.fontSize,
          "line-height": n.lineHeight.value,
          "letter-spacing": n.letterSpacing.value,
          color: hex(paints(n)[0].color),
          "text-align": n.textAlignHorizontal.toLowerCase(),
          "text-case": {
            ORIGINAL: "original",
            UPPER: "upper",
            LOWER: "lower",
            TITLE: "title",
          }[n.textCase],
          "text-decoration": n.textDecoration.toLowerCase(),
          positioning: "flow",
          "width-sizing": n.layoutSizingHorizontal.toLowerCase(),
          "height-sizing": n.layoutSizingVertical.toLowerCase(),
        });
        tokens.color = tokenFor(paints(n)[0].boundVariables?.color);
        const size = n.boundVariables?.fontSize;
        if (size !== undefined) {
          const aliases = Array.isArray(size) ? size : [size],
            id = aliases.length === 1 && aliases[0]?.type === "VARIABLE_ALIAS" ? tokenFor(aliases[0]) : null;
          if (!id || B.system.tokens[id]?.type !== "dimension") throw Error("unsupported native font-size binding");
          tokens["font-size"] = id;
        }
      } else
        Object.assign(styles, {
          layout: n.layoutMode === "HORIZONTAL" ? "row" : "column",
          gap: n.itemSpacing,
          padding: [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft],
          radius: n.cornerRadius,
          fill: paints(n).length ? hex(paints(n)[0].color) : null,
          clip: n.clipsContent,
          "align-main": n.primaryAxisAlignItems === "CENTER" ? "center" : "start",
          "align-cross": n.counterAxisAlignItems === "CENTER" ? "center" : "start",
          shadow: [],
          stroke: n.strokes.length ? hex(n.strokes[0].color) : null,
          "stroke-width": n.strokes.length ? n.strokeWeight : null,
          "stroke-align": n.strokes.length ? n.strokeAlign.toLowerCase() : null,
          "stroke-in-layout": n.strokesIncludedInLayout,
        });
      if (n.type !== "TEXT") {
        tokens.fill = tokenFor(paints(n)[0]?.boundVariables?.color);
        tokens.stroke = tokenFor(n.strokes[0]?.boundVariables?.color);
      }
      parts[part] = {
        id: n.id,
        styles,
        tokens: Object.fromEntries(Object.entries(tokens).filter(([, v]) => v)),
      };
      if (parent.instances[part]) {
        if (n.children.length !== 1 || n.children[0].type !== "INSTANCE")
          throw Error("missing component instance: " + part);
        const i = n.children[0],
          main = await i.getMainComponentAsync(),
          vectors = i.findAll((n) => n.type === "VECTOR");
        for (const vector of vectors) {
          const paint = vector[parent.instances[part].paint ?? "fills"];
          if (
            paint.length !== 1 ||
            paint[0].type !== "SOLID" ||
            tokenFor(paint[0].boundVariables?.color) !== parent.instances[part].colorToken
          )
            throw Error("native dependency binding changed: " + part);
        }
        instances[part] = {
          id: i.id,
          main: main.id,
          component: main.getSharedPluginData("ds_contracts_roundtrip_v1", "contract-id"),
          revision: main.getSharedPluginData("ds_contracts_roundtrip_v1", "contract-revision"),
          width: i.width,
          height: i.height,
          x: i.x,
          y: i.y,
          colorToken: tokenFor(vectors[0][parent.instances[part].paint ?? "fills"][0]?.boundVariables?.color),
          vectors: vectors.map((v) => ({
            paths: v.vectorPaths,
            transform: v.relativeTransform,
            width: v.width,
            height: v.height,
            paint: parent.instances[part].paint ?? "fills",
            color: hex(v[parent.instances[part].paint ?? "fills"][0].color),
            strokeWeight: v.strokeWeight,
          })),
        };
      }
    }
    variants.push({
      key: root.getSharedPluginData("ds_contracts_roundtrip_v1", "variant"),
      axes: JSON.parse(root.getSharedPluginData("ds_contracts_roundtrip_v1", "axes")),
      id: root.id,
      parts,
      instances,
    });
  }
  const tokens = {};
  for (const [id, v] of Object.entries(vars)) {
    const c = collections[B.system.tokens[id].tier],
      value = v.valuesByMode[c.defaultModeId];
    const token = B.system.tokens[id];
    if (v.resolvedType !== (token.type === "dimension" ? "FLOAT" : "COLOR"))
      throw Error("native variable type changed: " + id);
    const literal = () => {
      if (token.type !== "dimension") return hex(value);
      const original = sourceTokens?.[id]?.value ?? token.value;
      return original !== undefined && tokenValue(token.type, original, "native") === value
        ? original : tokenValue(token.type, value, "source");
    };
    tokens[id] = {
      id: v.id,
      collection: c.id,
      mode: c.defaultModeId,
      scopes: v.scopes,
      codeSyntax: v.codeSyntax,
      ...(value.type === "VARIABLE_ALIAS" ? { alias: tokenFor(value) } : { value: literal() }),
    };
  }
  return JSON.parse(
    stable({
      board: board.id,
      parent: { id: set.id, component: B.root },
      components: Object.fromEntries(
        Object.entries(components).map(([id, n]) => [
          id,
          {
            id: n.id,
            revision: n.getSharedPluginData("ds_contracts_roundtrip_v1", "contract-revision"),
          },
        ]),
      ),
      tokens,
      variants,
    }),
  );
}
