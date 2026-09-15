import { createHash } from "node:crypto";
import type { CapturedNode } from "../extract/computed/lib.js";
import { IRNodeSchema, type ComponentNode, type FrameNode, type IRNode, type TextNode } from "../recipe/figma-ir.js";
import { figmaWriterRuntime } from "../recipe/figma-writer-runtime.js";

const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export interface RenderInput {
  status: string;
  tree: CapturedNode;
  treeSha256: string;
  sourcePngSha256: string;
}
export interface FontFace { family: string; style: string }
export interface Compilation {
  status: "renderable-draft" | "refused";
  problems: string[];
  limitations: string[];
  sourceTreeSha256: string;
  sourcePngSha256: string;
  component?: ComponentNode;
}

/** Deliberately bounded first automatic path. No archetype selection, reviewed
 * role map, inferred state matrix, substitute font, or value-matched token.
 * A renderable draft is NOT a visual/behavioral or design-system qualification.
 */
export function compileRenderedTree(input: RenderInput, fonts: readonly FontFace[]): Compilation {
  const problems: string[] = [];
  const result: Compilation = {
    status: "refused", problems,
    limitations: [
      "Token candidates are not proven bindings; this draft retains literal computed values.",
      "Fixed measured sizes do not establish responsive sizing or content expansion.",
      "Interaction, accessibility, variants and full CSS-channel coverage remain unqualified.",
      "Only text leaves and non-wrapping flex containers are currently supported.",
    ],
    sourceTreeSha256: input.treeSha256, sourcePngSha256: input.sourcePngSha256,
  };
  const fail = (path: string, reason: string): never => { throw new Error(`${path}: ${reason}`); };
  if (input.status !== "captured" || sha(input.tree) !== input.treeSha256 || !/^[a-f0-9]{64}$/.test(input.sourcePngSha256)) {
    problems.push("unverified-or-altered-capture"); return result;
  }
  const px = (value: string, path: string): number => {
    if (!/^-?(?:\d+\.?\d*|\.\d+)px$/.test(value)) return fail(path, `unsupported-length:${value}`);
    return Number(value.slice(0, -2));
  };
  const color = (value: string, path: string): string => {
    const match = value.match(/^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/);
    if (!match) return fail(path, `unsupported-color:${value}`);
    const channels = [...match.slice(1, 4).map(Number), Math.round(Number(match[4] ?? 1) * 255)];
    if (channels.some(c => c < 0 || c > 255)) return fail(path, "color-out-of-range");
    return "#" + channels.map(c => c.toString(16).padStart(2, "0")).join("");
  };
  const fixed = (value: number) => ({ mode: "fixed" as const, value });
  const visit = (node: CapturedNode, path: string): IRNode => {
    const s = node.style;
    if (Object.keys(node.pseudo).length) fail(path, "pseudo-planes-not-yet-supported");
    if (["svg", "img", "input", "canvas", "video"].includes(node.tag)) fail(path, `element-not-yet-supported:${node.tag}`);
    const defaults: Record<string, string[]> = {
      transform: ["none"], filter: ["none"], "backdrop-filter": ["none"],
      "background-image": ["none"], "box-shadow": ["none"], "text-shadow": ["none"],
      "clip-path": ["none"], "mask-image": ["none"], "mix-blend-mode": ["normal"],
      "animation-name": ["none"], visibility: ["visible"],
      position: ["static", "relative"], "writing-mode": ["horizontal-tb"], direction: ["ltr"],
      "white-space-collapse": ["collapse"], "text-transform": ["none"],
      "text-decoration-line": ["none"], "font-style": ["normal"],
      "overflow-x": ["visible"], "overflow-y": ["visible"],
    };
    for (const [property, values] of Object.entries(defaults)) {
      if (s[property] === undefined || !values.includes(s[property])) fail(path, `unsupported:${property}=${s[property]}`);
    }
    for (const side of ["top", "right", "bottom", "left"]) {
      if (s[`margin-${side}`] !== "0px") fail(path, `margin-${side}-not-supported`);
      if (s.position === "relative" && !["auto", "0px"].includes(s[side])) fail(path, `relative-${side}-not-supported`);
    }
    const width = px(s.width, path), height = px(s.height, path);
    if (!(width > 0 && height > 0)) fail(path, "nonpositive-size");
    if (s["box-sizing"] !== "border-box") fail(path, "content-box-not-supported");
    const opacity = Number(s.opacity);
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) fail(path, "invalid-opacity");
    const kids = node.nodes.filter(n => n.t === "el");
    const ownText = node.nodes.filter(n => n.t === "text").map(n => n.v).join("").replace(/[\t\n\r\f ]+/g, " ").trim();
    const fill = color(s["background-color"], path);
    const borderWidths = ["top", "right", "bottom", "left"].map(side => px(s[`border-${side}-width`], path));
    const padding = Object.fromEntries(["top", "right", "bottom", "left"].map(side => [side, px(s[`padding-${side}`], path)])) as FrameNode["layout"]["padding"];
    if (!kids.length && ownText) {
      if (!fill.endsWith("00") || borderWidths.some(Boolean) || Object.values(padding).some(Boolean)) fail(path, "decorated-text-leaf-not-supported");
      const family = s["font-family"].split(",")[0].trim().replace(/^["']|["']$/g, "");
      const styles: Record<string, string> = { "100": "Thin", "200": "ExtraLight", "300": "Light", "400": "Regular", "500": "Medium", "600": "SemiBold", "700": "Bold", "800": "ExtraBold", "900": "Black" };
      const style = styles[s["font-weight"]];
      const normalize = (v: string) => v.toLowerCase().replace(/[\s_-]/g, "");
      const font = fonts.find(f => f.family === family && style && normalize(f.style) === normalize(style));
      if (!font) return fail(path, `exact-font-unavailable:${family}:${s["font-weight"]}`);
      const align = s["text-align"] === "start" ? "left" : s["text-align"];
      if (!["left", "center", "right"].includes(align)) fail(path, "unsupported-text-alignment");
      const text: TextNode = {
        kind: "text", role: path, label: "Text", characters: ownText, opacity,
        type: { fontFamily: font.family, fontStyle: font.style, fontSize: px(s["font-size"], path),
          lineHeight: { unit: "px", value: px(s["line-height"], path) },
          letterSpacing: { unit: "px", value: s["letter-spacing"] === "normal" ? 0 : px(s["letter-spacing"], path) },
          fontProvenance: { requestedFamily: font.family, requestedStyle: font.style,
            requestSource: "validated-rendered-source", fallbackChain: [font], resolvedFamily: font.family,
            resolvedStyle: font.style, resolution: "requested" } },
        align: align as TextNode["align"], verticalAlign: "top",
        fills: [{ kind: "solid", color: color(s.color, path) }], width: fixed(width), height: fixed(height),
      };
      return text;
    }
    if (ownText) fail(path, "mixed-or-direct-container-text-not-supported");
    if (!["flex", "inline-flex"].includes(s.display) || s["flex-wrap"] !== "nowrap") fail(path, "non-flex-or-wrapping-container-not-supported");
    if (!["row", "column"].includes(s["flex-direction"])) fail(path, "reverse-flow-not-supported");
    if (borderWidths.some(Boolean)) fail(path, "border-not-yet-supported");
    const primary = ({ center: "center", "flex-start": "min", normal: "min", "flex-end": "max", "space-between": "space-between" } as const)[s["justify-content"]];
    const counter = ({ center: "center", "flex-start": "min", "flex-end": "max", baseline: "baseline" } as const)[s["align-items"]];
    if (!primary || !counter) return fail(path, "unsupported-flex-alignment");
    const gap = s[s["flex-direction"] === "row" ? "column-gap" : "row-gap"];
    const radius = Object.fromEntries(["top-left", "top-right", "bottom-right", "bottom-left"].map((corner, index) => [
      ["topLeft", "topRight", "bottomRight", "bottomLeft"][index], px(s[`border-${corner}-radius`], path),
    ])) as FrameNode["cornerRadius"];
    return { kind: "frame", role: path, label: node.tag, opacity,
      layout: { mode: s["flex-direction"] === "row" ? "horizontal" : "vertical", primaryAxisAlign: primary,
        counterAxisAlign: counter, itemSpacing: gap === "normal" ? 0 : px(gap, path), padding, width: fixed(width), height: fixed(height) },
      cornerRadius: radius, fills: fill.endsWith("00") ? [] : [{ kind: "solid", color: fill }],
      children: kids.map((child, i) => visit(child.el, `${path}/${i}`)), clipsContent: false,
    };
  };
  try {
    const root = visit(input.tree, "source");
    if (root.kind !== "frame") fail("source", "component-root-must-have-layout");
    const component: ComponentNode = { ...(root as FrameNode), kind: "component", variantProperties: {} };
    IRNodeSchema.parse(component);
    result.component = component;
    result.status = "renderable-draft";
  } catch (error) { problems.push(error instanceof Error ? error.message : "compilation-failed"); }
  return result;
}

/** Reuses the production IR writer; no parallel hand-drawn Figma implementation. */
export function emitRenderedDraft(compilation: Compilation, label: string): string {
  if (compilation.status !== "renderable-draft" || !compilation.component) throw new Error("compilation-refused");
  const identity = sha({ compiler: 1, compilation, label }).slice(0, 16);
  const plan = { runIdentity: identity, pageName: `Outcome Trial / ${identity}`, sources: [{
    adapterIdentity: "rendered-tree-v1", sourceName: label, displayName: label,
    recipeHash: sha(compilation.component), envelopeHash: sha(compilation), comparedIrFacts: 0,
    variables: [], component: { ...compilation.component, label },
  }] };
  return `const PLAN=${JSON.stringify(plan)};\n` + figmaWriterRuntime({
    archetype: "rendered-source", prefix: "RENDERED-SOURCE", namespace: "ds.contracts.outcome.rendered.v1",
    writerVersion: 1, target: "scratch", collectionLabel: "Outcome Rendered Source", mint: { kind: "component", field: "component" },
  });
}
