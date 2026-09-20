/** Shared, deterministic image framing and source/native facts. No journal or output writes. */
import { cropSourceFrame } from "../source-reference/source-framing.js";
import {
  framingCrop,
  sha256,
  type Box,
  type Pair,
  type TextRect,
} from "./react-native-fidelity-check.js";
const refuse = (name: string, detail: string): never => {
  throw new Error(`${name}: ${detail}`);
};
export function nativeSide(
  readback: any,
  image: any,
  where: string,
): { native: Pair["native"]; png: Buffer } {
  const png = Buffer.from(image.pngBase64, "base64");
  if (png.toString("base64") !== image.pngBase64)
    refuse("native-image-encoding-invalid", `${where} ${image.caseId}`);
  const nodes = new Map<string, any>(readback.nodes.map((n: any) => [n.id, n]));
  const root =
    nodes.get(image.nodeId) ??
    refuse(
      "native-image-node-missing",
      `${where} ${image.caseId} ${image.nodeId}`,
    );
  const bounds = image.exportBounds;
  if (
    !bounds ||
    ![bounds.layout, bounds.render].every(
      (b: any) =>
        b && ["x", "y", "width", "height"].every((k) => Number.isFinite(b[k])),
    )
  )
    refuse(
      "native-layout-origin-not-recorded",
      `${where} ${image.caseId} carries no exportBounds`,
    );
  const textRects: TextRect[] = [],
    typography: Pair["native"]["typography"] = [];
  const layoutOffset = {
    x: bounds.layout.x - Math.floor(bounds.render.x),
    y: bounds.layout.y - Math.floor(bounds.render.y),
  };
  for (const node of nodes.values()) {
    if (node.type !== "TEXT") continue;
    const chain: any[] = [];
    let id: string = node.id,
      inside = false;
    while (nodes.has(id) && !chain.includes(nodes.get(id))) {
      if (id === image.nodeId) {
        inside = true;
        break;
      }
      chain.push(nodes.get(id));
      id = nodes.get(id).parentId;
    }
    if (!inside) continue;
    let x = 0,
      y = 0,
      visible = true;
    for (const current of chain) {
      const t = current.values.relativeTransform;
      if (
        !Array.isArray(t) ||
        t[0][0] !== 1 ||
        t[0][1] !== 0 ||
        t[1][0] !== 0 ||
        t[1][1] !== 1 ||
        t[0][2] !== current.values.x ||
        t[1][2] !== current.values.y
      )
        refuse(
          "text-rect-transform-unsupported",
          `${where} ${image.caseId} node ${current.id} is not a pure translation`,
        );
      if (current.values.visible === false) visible = false;
      x += current.values.x;
      y += current.values.y;
    }
    if (
      !visible ||
      typeof node.values.characters !== "string" ||
      node.values.characters.length === 0
    )
      continue;
    textRects.push({
      nodeId: node.id,
      characters: node.values.characters,
      x: layoutOffset.x + x,
      y: layoutOffset.y + y,
      width: node.values.width,
      height: node.values.height,
    });
    typography.push({
      characters: node.values.characters,
      family: node.values.fontName?.family,
      style: node.values.fontName?.style,
      fontSize: node.values.fontSize,
      lineHeight: node.values.lineHeight,
      letterSpacing: node.values.letterSpacing,
    });
  }
  const order = (
    a: { nodeId?: string; characters: string },
    b: { nodeId?: string; characters: string },
  ) => (a.characters < b.characters ? -1 : a.characters > b.characters ? 1 : 0);
  textRects.sort((a, b) => a.y - b.y || a.x - b.x || order(a, b));
  typography.sort(order);
  return {
    png,
    native: {
      nodeId: image.nodeId,
      caseId: image.caseId,
      exportBounds: { layout: bounds.layout, render: bounds.render },
      layoutOffset,
      layoutSize: { width: root.values.width, height: root.values.height },
      textRects,
      typography,
    },
  };
}

/** Every text node of a recorded source tree, with the computed typography of the element that owns it. */
export function sourceTypography(
  tree: any,
  fonts: any,
): NonNullable<Pair["source"]["typography"]> {
  const rows: NonNullable<Pair["source"]["typography"]> = [];
  const resolved: any[] = fonts?.status === "observed" ? fonts.rows : [];
  const walk = (element: any): void => {
    for (const child of element.nodes ?? []) {
      if (child.t === "text") {
        const text = String(child.v),
          style = element.style ?? {},
          font = resolved.find((row) => row.text === text)?.fonts?.[0];
        if (text.trim().length === 0) continue;
        for (const channel of [
          "font-family",
          "font-weight",
          "font-size",
          "line-height",
          "letter-spacing",
        ])
          if (typeof style[channel] !== "string")
            refuse(
              "source-typography-not-recorded",
              `text ${JSON.stringify(text)} has no computed ${channel}`,
            );
        rows.push({
          text,
          family: font?.familyName ?? null,
          postScriptName: font?.postScriptName ?? null,
          cssFamily: style["font-family"],
          cssWeight: style["font-weight"],
          fontSize: style["font-size"],
          lineHeight: style["line-height"],
          letterSpacing: style["letter-spacing"],
        });
      } else if (child.t === "el") walk(child.el);
    }
  };
  walk(tree);
  return rows.sort((a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
}

export function sourceSide(
  original: Buffer,
  bounds: Box,
  boundsRecord: string,
  typography: Pair["source"]["typography"],
): { source: Pair["source"]; png: Buffer } {
  const cropped = cropSourceFrame(original, bounds);
  if (
    JSON.stringify(cropped.crop) !==
    JSON.stringify(framingCrop(bounds, cropped.sourceSize))
  )
    refuse(
      "source-framing-drift",
      "cropSourceFrame no longer matches the check's framing arithmetic",
    );
  return {
    png: cropped.bytes,
    source: {
      originalSha256: sha256(original),
      originalSize: cropped.sourceSize,
      bounds,
      crop: cropped.crop,
      boundsRecord,
      typography,
    },
  };
}

/** Every label a change set could carry as a native variant name; the pairing demands exactly one hit. */
export function variantCandidates(
  changes: Record<string, { kind: string; value?: unknown }>,
  axisNames: Record<string, string>,
): string[] {
  let out = [""];
  for (const [prop, change] of Object.entries(changes)) {
    const values =
      change.kind === "omit"
        ? ["(unset)"]
        : [
            String(change.value),
            `${typeof change.value}-${String(change.value)}`,
          ];
    out = out.flatMap((prefix) =>
      values.map(
        (v) => `${prefix}${prefix ? ", " : ""}${axisNames[prop] ?? prop}=${v}`,
      ),
    );
  }
  return out;
}
