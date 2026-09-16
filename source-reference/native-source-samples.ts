/** Comparison-instance content only. The source component's terminal slots
 * stay empty. Every emitted node goes through the shared Contract compiler. */
import { createHash } from "node:crypto";
import { canonicalJson, revisionOf } from "../core/contract-provenance.js";
import { createFigmaEngine, type NodeSpec } from "../core/emit-figma-script.js";
import { reconstructSvg } from "../extract/computed/anatomy.js";
import type { CapturedNode } from "../extract/computed/lib.js";
import { ContractSchema, type Part } from "../scripts/contract-schema.js";
import type { SourceAnatomyIdentity } from "./source-bound-anatomy.js";
import {
  buildSourceVisualContractCandidate,
  type SourceVisualContractInput,
} from "./source-visual-contract.js";

export interface NativeSourceSampleInput {
  source: SourceVisualContractInput;
  /** Pinned by the host's validated v3 report, not a UI-supplied candidate flag. */
  expectedVisualRevision: string;
}
export interface NativeSourceSampleSlot {
  identity: SourceAnatomyIdentity;
  sourceName: string;
  distribution: "assigned" | "fallback";
  sampleIds: string[];
  sampleDomPaths: string[];
  status: "lowered" | "refused";
  specs: NodeSpec[];
  specRevision?: string;
  sampleRevision: string;
  contentRevision?: string;
  styleRevision?: string;
  geometryRevision?: string;
  topologyRevision: string;
  expectations?: {
    /** Text is CSS-collapsed from the complete ordered slot sequence. */
    characters?: string;
    rawTextRuns?: string[];
    font?: {
      family: string;
      size: number;
      weight: number;
      lineHeight: number;
      color: string;
      align: "left" | "center" | "right";
    };
    geometry: {
      width: number;
      height: number;
      source: "slot-owner-content-box";
    };
    svg: Array<{
      domPath: string;
      viewBox: string;
      width: number;
      height: number;
      fill: string;
      color: string;
      markupRevision: string;
    }>;
  };
  /** Original variable-reference observations remain unqualified evidence. */
  observedStyles?: Array<{
    domPath: string;
    style: Record<string, string>;
    vrefs?: CapturedNode["vrefs"];
  }>;
  problems: string[];
}
export interface NativeSourceSamples {
  version: 1;
  status: "comparison-samples-lowered" | "refused";
  acceptedContract: null;
  qualification: "comparison-instance-samples-only";
  nativeQualification: "unqualified";
  visualRevision: string;
  source: {
    revision: string;
    sourceSha256: string;
    sourceProgramSha256: string;
    semanticsRevision: string;
  };
  cases: Array<{
    id: string;
    status: "lowered" | "refused";
    sourceTreeSha256?: string;
    topologyObservationSha256?: string;
    slots: NativeSourceSampleSlot[];
    problems: string[];
  }>;
  problems: string[];
}
const hash = /^sha256:[a-f0-9]{64}$/;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
function fail(code: string): never {
  throw Error(`native-source-samples-${code}`);
}
function problem(error: unknown): string {
  return error instanceof Error &&
    /^native-source-samples-[a-z-]+$/.test(error.message)
    ? error.message
    : "native-source-samples-input-invalid";
}
const identity = (node: SourceAnatomyIdentity): SourceAnatomyIdentity => ({
  templateId: node.templateId,
  sourceNodeId: node.sourceNodeId,
  sourceSpan: { ...node.sourceSpan },
});
function px(value: string | undefined): number {
  if (!value || !/^(?:0|[1-9]\d*)(?:\.\d+)?px$/.test(value))
    fail("geometry-unreadable");
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n > 8192) fail("geometry-out-of-bounds");
  return n;
}
function plainBox(node: CapturedNode, svg = false): void {
  const style = node.style;
  if (!style || Object.keys(node.pseudo ?? {}).length)
    fail("pseudo-content-unsupported");
  const defaults: Record<string, string[]> = {
    position: ["static"],
    visibility: ["visible"],
    opacity: ["1"],
    transform: ["none"],
    translate: ["none"],
    rotate: ["none"],
    scale: ["none"],
    filter: ["none"],
    "backdrop-filter": ["none"],
    "clip-path": ["none"],
    "background-image": ["none"],
    "background-color": ["rgba(0, 0, 0, 0)", "transparent"],
    "mask-image": ["none"],
    "box-shadow": ["none"],
    "text-shadow": ["none"],
    "mix-blend-mode": ["normal"],
    "writing-mode": ["horizontal-tb"],
    "overflow-x": svg ? ["visible", "hidden"] : ["visible"],
    "overflow-y": svg ? ["visible", "hidden"] : ["visible"],
  };
  for (const [channel, allowed] of Object.entries(defaults))
    if (style[channel] !== undefined && !allowed.includes(style[channel]))
      fail("style-outside-sample-grammar");
  for (const side of ["top", "right", "bottom", "left"])
    for (const channel of [
      `padding-${side}`,
      `margin-${side}`,
      `border-${side}-width`,
    ])
      if (style[channel] !== undefined && style[channel] !== "0px")
        fail("sample-box-decoration-unsupported");
  for (const corner of ["top-left", "top-right", "bottom-left", "bottom-right"])
    if (
      style[`border-${corner}-radius`] !== undefined &&
      style[`border-${corner}-radius`] !== "0px"
    )
      fail("sample-box-decoration-unsupported");
}
function typography(
  node: CapturedNode,
): NonNullable<NonNullable<NativeSourceSampleSlot["expectations"]>["font"]> {
  plainBox(node);
  const s = node.style;
  if (s.display !== "block") fail("text-flow-unsupported");
  for (const [channel, allowed] of Object.entries({
    "font-stretch": ["100%", "normal"],
    "font-feature-settings": ["normal"],
    "font-variation-settings": ["normal"],
    "font-variant-caps": ["normal"],
    "font-variant-ligatures": ["normal"],
    "font-variant-numeric": ["normal"],
    "font-variant-position": ["normal"],
    "text-indent": ["0px"],
    "text-emphasis-style": ["none"],
    "text-align-last": ["auto"],
    direction: ["ltr"],
  }))
    if (s[channel] !== undefined && !allowed.includes(s[channel]))
      fail("typography-unsupported");
  if (
    (s["white-space-collapse"] ?? s["white-space"]) !== "collapse" &&
    s["white-space"] !== "normal"
  )
    fail("whitespace-unsupported");
  if (
    (s["white-space"] && !["normal", "nowrap"].includes(s["white-space"])) ||
    (s["font-style"] && s["font-style"] !== "normal") ||
    (s["text-transform"] && s["text-transform"] !== "none") ||
    (s["text-decoration-line"] && s["text-decoration-line"] !== "none") ||
    (s["-webkit-text-fill-color"] &&
      s["-webkit-text-fill-color"] !== s.color) ||
    (s["-webkit-text-stroke-width"] &&
      s["-webkit-text-stroke-width"] !== "0px") ||
    (s["letter-spacing"] && !["normal", "0px"].includes(s["letter-spacing"])) ||
    (s["word-spacing"] && s["word-spacing"] !== "0px")
  )
    fail("typography-unsupported");
  const family = (s["font-family"] ?? "")
    .split(",")[0]
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2");
  if (!family || !/^[\w -]+$/.test(family)) fail("font-family-unreadable");
  const weight = Number(s["font-weight"]);
  const align = s["text-align"] === "start" ? "left" : s["text-align"];
  if (align !== "left" && align !== "center" && align !== "right")
    fail("text-alignment-unsupported");
  if (![100, 200, 300, 400, 500, 600, 700, 800, 900].includes(weight))
    fail("font-weight-unsupported");
  if (
    !/^rgba?\([\d., ]+\)$|^#[a-fA-F0-9]{6}(?:[a-fA-F0-9]{2})?$/.test(
      s.color ?? "",
    )
  )
    fail("color-unsupported");
  return {
    family,
    size: px(s["font-size"]),
    weight,
    lineHeight: px(s["line-height"]),
    color: s.color,
    align,
  };
}

/** Raw source/tree/topology joins are repeated before lowering. The host still
 * authenticates original bytes; a self-computed digest is not that authority. */
export function buildNativeSourceSamples(
  input: NativeSourceSampleInput,
): NativeSourceSamples {
  const visual = buildSourceVisualContractCandidate(input.source);
  const out: NativeSourceSamples = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    qualification: "comparison-instance-samples-only",
    nativeQualification: "unqualified",
    visualRevision: revisionOf(visual),
    source: {
      revision: input.source.semantics.source.revision,
      sourceSha256: input.source.source.sourceSha256,
      sourceProgramSha256: input.source.semantics.source.programSha256,
      semanticsRevision: revisionOf(input.source.semantics),
    },
    cases: input.source.semantics.cases.map((row) => {
      const visualCase = visual.cases.find((c) => c.id === row.id);
      return {
        id: row.id,
        status: "refused",
        slots: [],
        problems:
          visualCase?.status === "projected"
            ? []
            : [
                ...(visualCase?.problems ?? row.problems),
                "native-source-samples-source-case-refused",
              ],
      };
    }),
    problems: [],
  };
  try {
    if (
      !hash.test(input.expectedVisualRevision) ||
      out.visualRevision !== input.expectedVisualRevision
    )
      fail("visual-revision-mismatch");
    if (visual.status !== "measured-candidate") fail("visual-source-refused");
    for (const [index, row] of visual.cases.entries()) {
      const target = out.cases[index];
      if (row.status === "refused") continue;
      try {
        const projection = row.projection;
        const raw = input.source.cases.filter(
          (c) => c.expectedCaseId === row.id,
        );
        if (!projection || raw.length !== 1 || !raw[0].boundTopology.topology)
          fail("case-identity-mismatch");
        const topology = raw[0].boundTopology.topology;
        if (
          topology.status !== "captured" ||
          !topology.observation ||
          sha(JSON.stringify(topology.observation)) !==
            projection.topologyObservationSha256 ||
          topology.observationSha256 !== projection.topologyObservationSha256
        )
          fail("topology-revision-mismatch");
        target.sourceTreeSha256 = projection.sourceTreeSha256;
        target.topologyObservationSha256 = projection.topologyObservationSha256;
        for (const slot of projection.slots) {
          const samples = slot.sampleIds.map((id) => {
            const found = projection.samples.filter((s) => s.id === id);
            if (found.length !== 1) fail("sample-identity-mismatch");
            return found[0];
          });
          const lowered: NativeSourceSampleSlot = {
            identity: identity(slot),
            sourceName: slot.sourceName,
            distribution: slot.distribution,
            sampleIds: [...slot.sampleIds],
            sampleDomPaths: samples.map((s) => s.domPath),
            status: "refused",
            specs: [],
            sampleRevision: revisionOf(samples),
            topologyRevision: projection.topologyObservationSha256,
            problems: [],
          };
          target.slots.push(lowered);
          try {
            if (
              new Set(slot.sampleIds).size !== slot.sampleIds.length ||
              samples.some(
                (s) =>
                  !same(s.slot, identity(slot)) ||
                  s.sourceName !== slot.sourceName ||
                  s.distribution !== slot.distribution,
              ) ||
              !same(
                samples.map((s) => s.domPath),
                slot.distribution === "assigned"
                  ? slot.assigned
                  : slot.fallback,
              )
            )
              fail("slot-identity-mismatch");
            // Fallback is authored main content, a separate qualification. It
            // cannot enter through the comparison-consumer sample door.
            if (
              slot.distribution !== "assigned" ||
              samples.some((s) => s.sourceNodes.length)
            )
              fail("authored-fallback-unqualified");
            const owners = projection.elements.filter(
              (e) =>
                same(identity(e), slot.owner) &&
                e.visualPath === slot.ownerVisualPath,
            );
            if (owners.length !== 1) fail("slot-owner-mismatch");
            const owner = owners[0];
            plainBox(owner.node);
            const geometry = {
              width: px(owner.node.style.width),
              height: px(owner.node.style.height),
              source: "slot-owner-content-box" as const,
            };
            const styles: NonNullable<
              NativeSourceSampleSlot["observedStyles"]
            > = [
              {
                domPath: owner.domPath,
                style: owner.node.style,
                ...(owner.node.vrefs ? { vrefs: owner.node.vrefs } : {}),
              },
            ];
            const icons = new Map<string, string>();
            const svgs: NonNullable<
              NativeSourceSampleSlot["expectations"]
            >["svg"] = [];
            const byVisual = (pointer: string, node: CapturedNode) => {
              const found = topology.observation!.nodes.filter(
                (n) =>
                  n.visualPath === pointer &&
                  n.kind === "element" &&
                  n.tag === node.tag,
              );
              if (found.length !== 1) fail("element-topology-mismatch");
              return found[0];
            };
            let nodeCount = 0;
            const lowerElement = (
              node: CapturedNode,
              pointer: string,
              depth: number,
            ): Part => {
              if (++nodeCount > 128 || depth > 12)
                fail("subtree-bound-exceeded");
              const original = byVisual(pointer, node);
              styles.push({
                domPath: original.domPath,
                style: node.style,
                ...(node.vrefs ? { vrefs: node.vrefs } : {}),
              });
              plainBox(
                node,
                node.tag === "svg" ||
                  ["path", "g", "circle"].includes(node.tag),
              );
              if (node.tag === "svg") {
                const viewBox = original.attributes?.viewBox;
                const match = /^0 0 ([1-9]\d*) \1$/.exec(viewBox ?? "");
                if (!match) fail("svg-viewbox-unqualified");
                const extent = Number(match[1]);
                const width = px(node.style.width),
                  height = px(node.style.height);
                if (width !== height || width <= 0 || extent > 8192)
                  fail("svg-geometry-unsupported");
                const checkSvg = (
                  part: CapturedNode,
                  p: string,
                  svgDepth = 0,
                ) => {
                  if (++nodeCount > 128 || depth + svgDepth > 12)
                    fail("subtree-bound-exceeded");
                  const fact = byVisual(p, part);
                  plainBox(part, true);
                  if (!["svg", "g", "path", "circle"].includes(part.tag))
                    fail("svg-subtree-unsupported");
                  if (
                    (part.style.stroke && part.style.stroke !== "none") ||
                    (part.style["fill-opacity"] &&
                      part.style["fill-opacity"] !== "1") ||
                    (part.style["vector-effect"] &&
                      part.style["vector-effect"] !== "none")
                  )
                    fail("svg-paint-unsupported");
                  if (part.tag !== "svg")
                    styles.push({
                      domPath: fact.domPath,
                      style: part.style,
                      ...(part.vrefs ? { vrefs: part.vrefs } : {}),
                    });
                  if (
                    Object.keys(fact.attributes ?? {}).some(
                      (key) =>
                        ![
                          "viewBox",
                          "width",
                          "height",
                          "xmlns",
                          "d",
                          "fill-rule",
                          "clip-rule",
                          "fill",
                          "stroke",
                          "stroke-width",
                          "cx",
                          "cy",
                          "r",
                        ].includes(key),
                    )
                  )
                    fail("svg-attribute-unsupported");
                  if (part.tag === "path") {
                    const d = /^path\("([^"]+)"\)$/.exec(
                      part.style.d ?? "",
                    )?.[1];
                    const tokens = (value: string) =>
                      value.match(
                        /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g,
                      );
                    if (
                      !d ||
                      !/^[MmZzLlHhVvCcSsQqTtAa\d.,+eE\s-]+$/.test(d) ||
                      !same(tokens(d), tokens(fact.attributes?.d ?? ""))
                    )
                      fail("svg-path-identity-mismatch");
                  }
                  if (
                    Object.values(part.style).some((value) =>
                      /url\(/i.test(value),
                    )
                  )
                    fail("svg-external-reference-unsupported");
                  for (const [i, child] of part.nodes.entries()) {
                    if (child.t === "text") {
                      if (/\S/.test(child.v)) fail("svg-text-unsupported");
                    } else
                      checkSvg(child.el, `${p}/nodes/${i}/el`, svgDepth + 1);
                  }
                };
                checkSvg(node, pointer);
                const captured = structuredClone(node);
                captured.style.width = `${extent}px`;
                captured.style.height = `${extent}px`;
                const receipts: string[] = [];
                const svg = reconstructSvg(
                  captured,
                  receipts,
                  "comparison sample",
                );
                if (
                  !svg ||
                  svg.bumped ||
                  !svg.markup.startsWith(`<svg viewBox="${viewBox}" `)
                )
                  fail("svg-reconstruction-refused");
                const paint =
                  /^(?:none|rgba?\([\d., ]+\)|#[a-fA-F0-9]{6}(?:[a-fA-F0-9]{2})?)$/;
                if (
                  !paint.test(node.style.fill ?? "") ||
                  !paint.test(node.style.color ?? "")
                )
                  fail("svg-paint-unsupported");
                // Reconstruction can fold equal path fill into its SVG host.
                // The sample must carry that host paint explicitly; the
                // shared icon branch does not inherit its own literal color.
                // Resolve currentColor only from this captured SVG context.
                const markup = svg.markup
                  .replace(/^<svg /, `<svg fill="${node.style.fill}" `)
                  .replaceAll("currentColor", node.style.color);
                const asset = `sample-${icons.size}`;
                icons.set(asset, markup);
                svgs.push({
                  domPath: original.domPath,
                  viewBox: viewBox!,
                  width,
                  height,
                  fill: node.style.fill,
                  color: node.style.color,
                  markupRevision: revisionOf(markup),
                });
                return {
                  icon: { asset, size: width },
                };
              }
              if (
                !["span", "div"].includes(node.tag) &&
                !/^[a-z][a-z0-9]*-[a-z0-9-]+$/.test(node.tag)
              )
                fail("element-kind-unsupported");
              if (
                ![
                  "inline",
                  "block",
                  "inline-block",
                  "flex",
                  "inline-flex",
                ].includes(node.style.display)
              )
                fail("layout-unsupported");
              const children = node.nodes.flatMap((child, i) => {
                if (child.t === "text") {
                  if (/\S/.test(child.v)) fail("mixed-content-unsupported");
                  return [];
                }
                return [
                  lowerElement(child.el, `${pointer}/nodes/${i}/el`, depth + 1),
                ];
              });
              // This bounded carrier grammar does not infer flow from a DOM
              // sibling list. Only a single child has unambiguous placement.
              if (children.length !== 1) fail("layout-unsupported");
              const auto =
                node.style.width === "auto" && node.style.height === "auto";
              if (
                !auto &&
                (px(node.style.width) <= 0 || px(node.style.height) <= 0)
              )
                fail("geometry-unreadable");
              const onlyElement = node.nodes.find((child) => child.t === "el")!;
              if (
                !auto &&
                onlyElement.t === "el" &&
                (px(node.style.width) !== px(onlyElement.el.style.width) ||
                  px(node.style.height) !== px(onlyElement.el.style.height))
              )
                fail("carrier-placement-unqualified");
              return {
                layout: {
                  display: "flex",
                  direction: "row",
                  align: "start",
                  justify: "start",
                },
                ...(!auto
                  ? {
                      literals: {
                        width: node.style.width,
                        height: node.style.height,
                      },
                    }
                  : {}),
                parts: { child: children[0] },
              };
            };
            let part: Part | undefined;
            let characters: string | undefined;
            let font: ReturnType<typeof typography> | undefined;
            let rawTextRuns: string[] | undefined;
            if (
              samples.every(
                (s) => s.kind === "text" && s.text !== undefined && !s.element,
              )
            ) {
              font = typography(owner.node);
              if (
                font.size <= 0 ||
                font.lineHeight <= 0 ||
                geometry.height !== font.lineHeight
              )
                fail("text-line-geometry-unqualified");
              rawTextRuns = samples.map((s) => s.text!);
              characters = rawTextRuns
                .join("")
                .replace(/[\t\n\f\r ]+/g, " ")
                .replace(/^ | $/g, "");
              if (characters.length > 8192) fail("text-bound-exceeded");
              if (characters)
                part = {
                  // The shared writer applies literal dimensions to FRAMEs.
                  // A measured comparison carrier preserves the text box and
                  // alignment without inventing a main-slot constraint.
                  layout: {
                    display: "flex",
                    direction: "row",
                    align: "start",
                    justify:
                      font.align === "left"
                        ? "start"
                        : font.align === "right"
                          ? "end"
                          : "center",
                  },
                  literals: {
                    width: `${geometry.width}px`,
                    height: `${geometry.height}px`,
                  },
                  parts: {
                    text: {
                      text: characters,
                      tokens: { "font-weight": "{sample-weight}" },
                      literals: {
                        color: font.color,
                        "font-size": `${font.size}px`,
                        "line-height": `${font.lineHeight}px`,
                      },
                      declared: {
                        "font-family": font.family,
                        "text-transform": "none",
                        "text-decoration-line": "none",
                        "text-align": font.align,
                      },
                    },
                  },
                };
            } else if (
              samples.length === 1 &&
              samples[0].kind === "element" &&
              samples[0].element &&
              samples[0].visualPath
            ) {
              const found = topology.observation.nodes.filter(
                (n) =>
                  n.domPath === samples[0].domPath &&
                  n.visualPath === samples[0].visualPath &&
                  n.kind === "element",
              );
              if (found.length !== 1) fail("sample-topology-mismatch");
              part = lowerElement(samples[0].element, samples[0].visualPath, 0);
            } else fail("sample-sequence-unsupported");
            if (part) {
              const contract = ContractSchema.parse({
                $schema: "./contract.schema.json",
                id: "source.comparison-sample",
                name: "SourceComparisonSample",
                version: "0.1.0",
                status: "draft",
                description:
                  "Private compile-only comparison sample fragment; never a main component or accepted source Contract.",
                semantics: { element: "div" },
                props: [],
                states: [],
                anatomy: {
                  root: {
                    layout: {
                      display: "flex",
                      direction: "row",
                      align: "start",
                      justify: "start",
                    },
                    parts: { sample: part },
                  },
                },
                bindings: {
                  figma: { anchors: { fileKey: null, componentSetKey: null } },
                  code: {
                    anchors: {
                      importPath: "@private/source-comparison-sample",
                      export: "SourceComparisonSample",
                    },
                  },
                },
              });
              const engine = createFigmaEngine({
                tokens: {
                  primitives: {
                    "sample-weight": {
                      $type: "number",
                      $value: String(font?.weight ?? 400),
                    },
                  },
                  semantic: {},
                  light: {},
                  dark: {},
                  brands: { default: {} },
                },
                icons,
              });
              const data = engine.compileComponentData(
                contract,
                new Map([[contract.id, contract]]),
              );
              if (data.variants.length !== 1 || data.codeOnlyFacts?.length)
                fail("engine-lowering-refused");
              const specs = data.variants[0].spec.children ?? [];
              const stripPrivateTransport = (spec: NodeSpec) => {
                if (spec.fontWeightVar === "sample-weight")
                  delete spec.fontWeightVar;
                if (
                  spec.fontWeightVar ||
                  spec.textFill ||
                  spec.svgPaintVar ||
                  spec.type === "instance" ||
                  spec.type === "slot" ||
                  spec.contentProp
                )
                  fail("unexpected-engine-reference");
                for (const child of spec.children ?? [])
                  stripPrivateTransport(child);
              };
              specs.forEach(stripPrivateTransport);
              lowered.specs = specs;
            }
            lowered.expectations = {
              ...(characters !== undefined
                ? { characters, rawTextRuns, font }
                : {}),
              geometry,
              svg: svgs,
            };
            lowered.observedStyles = styles;
            lowered.contentRevision = revisionOf(
              samples.map((s) => ({
                kind: s.kind,
                text: s.text,
                element: s.element,
              })),
            );
            lowered.styleRevision = revisionOf(styles);
            lowered.geometryRevision = revisionOf({ geometry, svg: svgs });
            lowered.specRevision = revisionOf(lowered.specs);
            lowered.status = "lowered";
          } catch (error) {
            lowered.problems.push(problem(error));
            lowered.specs = [];
          }
        }
        if (target.slots.some((slot) => slot.status !== "lowered"))
          fail("case-sample-refused");
        target.status = "lowered";
      } catch (error) {
        target.problems.push(problem(error));
        for (const slot of target.slots) {
          slot.specs = [];
          delete slot.specRevision;
          slot.status = "refused";
        }
      }
    }
    if (
      input.source.semantics.cases.some(
        (row, i) =>
          row.status === "structure-matched" &&
          out.cases[i].status !== "lowered",
      )
    )
      fail("eligible-cases-refused");
    out.status = "comparison-samples-lowered";
  } catch (error) {
    out.problems.push(problem(error));
  }
  return structuredClone(out);
}
