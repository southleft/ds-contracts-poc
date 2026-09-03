/**
 * Stage 3b of the canvas→code journey (docs/35 §5): the BRIDGE.
 *
 * Adapts a canvas-facts document (recipe/canvas-facts.ts, stage 3a) into the
 * node-tree dump shape `core/propose-figma.ts` `proposeFromDump` inverts into
 * a schema-valid universal contract (the same shape extract/figma/dump.plugin.js
 * produces — see extract/figma/types.ts and the fixtures under
 * extract/figma/fixtures/).
 *
 * ZERO-SILENT DISCIPLINE: every fact in the canvas-facts document lands in
 * exactly one ledger row —
 *
 *   named     the fact maps to a dump field (the landing names the field);
 *   carried   the fact is the dump vocabulary's own default / rides another
 *             named landing (the landing says which);
 *   receipted the fact has NO dump spelling — the landing is the named
 *             reason, and nothing is invented in its place.
 *
 * `silent` (facts with no row) MUST be zero — bridgeCanvasFactsToDump throws
 * otherwise. The bridge never widens the dump vocabulary and never writes a
 * value no canvas fact names.
 *
 * Token names: the canvas spells variables as `token/<type>/id-<hex>` (the v4
 * writer's identity encoding). The bridge uses the DECODED dot-path identity
 * (already recorded in the canvas-facts document's `tokenIdentities`) in the
 * dump's slash form — a mechanical rename, named per variable in the result.
 * A live name that does not decode keeps its live spelling (never guessed).
 */
import type {
  DumpEffect,
  DumpFile,
  DumpNode,
  DumpPaint,
  DumpPropertyDefinition,
  DumpSet,
  DumpVariable,
} from "../extract/figma/types.js";
import type {
  CanvasFactsDocument,
} from "./canvas-facts.js";
import type {
  SceneEffect,
  SceneFact,
  SceneNodeSnapshot,
  ScenePaint,
} from "./scene-readback.js";

export type BridgeDisposition = "named" | "carried" | "receipted";

export interface BridgeLedgerRow {
  factId: string;
  nodeOwnershipKey: string;
  channel: string;
  disposition: BridgeDisposition;
  /** Dump field for `named`, carriage rule for `carried`, named reason for
   *  `receipted`. */
  landing: string;
}

export interface BridgeTokenRename {
  liveName: string;
  dumpName: string;
  decoded: boolean;
}

export interface CanvasBridgeResult {
  dump: DumpFile;
  setName: string;
  ledger: BridgeLedgerRow[];
  tokenRenames: BridgeTokenRename[];
  counts: {
    facts: number;
    named: number;
    carried: number;
    receipted: number;
    silent: number;
  };
}

// ---------------------------------------------------------------------------
// Paint / color helpers — canvas hex is #rrggbb or #rrggbbaa
// ---------------------------------------------------------------------------

const splitHexAlpha = (
  color: string,
): { hex: string; alpha?: number } => {
  const raw = color.toLowerCase();
  if (/^#[0-9a-f]{8}$/.test(raw)) {
    const alpha = Number.parseInt(raw.slice(7, 9), 16) / 255;
    return alpha >= 1
      ? { hex: raw.slice(0, 7) }
      : { hex: raw.slice(0, 7), alpha: Math.round(alpha * 1000) / 1000 };
  }
  return { hex: raw };
};

/** DumpVariable COLOR spelling: '#rrggbb' (or 8-digit '#rrggbbaa'). */
const variableColor = (color: string): string => {
  const raw = color.toLowerCase();
  if (/^#[0-9a-f]{8}$/.test(raw) && raw.endsWith("ff")) return raw.slice(0, 7);
  return raw;
};

// ---------------------------------------------------------------------------
// The bridge
// ---------------------------------------------------------------------------

type Landing = { disposition: BridgeDisposition; landing: string };

class Ledger {
  private readonly landings = new Map<string, Landing>();

  land(
    key: string,
    channel: string,
    occurrence: number,
    disposition: BridgeDisposition,
    landing: string,
  ): void {
    const id = `${key}#${channel}@${String(occurrence).padStart(4, "0")}`;
    if (this.landings.has(id))
      throw new TypeError(`bridge ledger: duplicate landing for ${id}`);
    this.landings.set(id, { disposition, landing });
  }

  rows(facts: readonly SceneFact[]): {
    ledger: BridgeLedgerRow[];
    silent: SceneFact[];
    orphans: string[];
  } {
    const ledger: BridgeLedgerRow[] = [];
    const silent: SceneFact[] = [];
    const seen = new Set<string>();
    for (const fact of facts) {
      seen.add(fact.id);
      const landing = this.landings.get(fact.id);
      if (landing === undefined) {
        silent.push(fact);
        continue;
      }
      ledger.push({
        factId: fact.id,
        nodeOwnershipKey: fact.nodeOwnershipKey,
        channel: fact.channel,
        disposition: landing.disposition,
        landing: landing.landing,
      });
    }
    const orphans = [...this.landings.keys()].filter((id) => !seen.has(id));
    return { ledger, silent, orphans };
  }
}

const dotToSlash = (dotPath: string): string => dotPath.split(".").join("/");

export function bridgeCanvasFactsToDump(
  doc: CanvasFactsDocument,
): CanvasBridgeResult {
  const scene = doc.scene;
  if (scene.type !== "COMPONENT_SET")
    throw new TypeError(
      `bridge: root must be a COMPONENT_SET (got ${scene.type})`,
    );

  const ledger = new Ledger();

  // Token rename table — decoded identity in slash form, or the live name.
  const dumpNameByLive = new Map<string, string>();
  const tokenRenames: BridgeTokenRename[] = [];
  for (const identity of doc.tokenIdentities) {
    const dumpName =
      identity.tokenIdentity === null
        ? identity.variableName
        : dotToSlash(identity.tokenIdentity);
    dumpNameByLive.set(identity.variableName, dumpName);
    tokenRenames.push({
      liveName: identity.variableName,
      dumpName,
      decoded: identity.tokenIdentity !== null,
    });
  }
  const dumpName = (liveName: string): string =>
    dumpNameByLive.get(liveName) ?? liveName;

  // Captured variable values — resolved literals observed at binding sites.
  const variables = new Map<string, DumpVariable & { sites: string[] }>();
  const observeVariable = (
    liveName: string,
    type: DumpVariable["type"],
    value: string | number | undefined,
    site: string,
  ): void => {
    if (value === undefined) return;
    const name = dumpName(liveName);
    const existing = variables.get(name);
    if (existing === undefined) {
      variables.set(name, { type, value, sites: [site] });
      return;
    }
    if (existing.value !== value || existing.type !== type) {
      throw new TypeError(
        `bridge: variable ${name} observed with conflicting resolved values ` +
          `(${JSON.stringify(existing.value)} at ${existing.sites[0]}, ` +
          `${JSON.stringify(value)} at ${site}) — one variable resolves to one ` +
          `value per mode; refusing to invent one`,
      );
    }
    existing.sites.push(site);
  };

  // -------------------------------------------------------------------------
  // Per-node bridging
  // -------------------------------------------------------------------------

  const paintFor = (
    paint: ScenePaint,
    boundVar: string | undefined,
    key: string,
    site: string,
  ): DumpPaint => {
    if (paint.type !== "SOLID" || paint.color === undefined)
      throw new TypeError(
        `bridge: ${key} carries a non-solid paint (${paint.type}) — not in this bridge's vocabulary yet; refuse rather than approximate`,
      );
    const { hex, alpha } = splitHexAlpha(paint.color);
    const paintOpacity = paint.opacity ?? 1;
    const effective =
      (alpha ?? 1) * paintOpacity === 1
        ? undefined
        : Math.round((alpha ?? 1) * paintOpacity * 1000) / 1000;
    if (boundVar !== undefined) {
      observeVariable(boundVar, "COLOR", variableColor(paint.color), site);
      return {
        var: dumpName(boundVar),
        ...(effective === undefined ? {} : { alpha: effective }),
      };
    }
    return { hex, ...(effective === undefined ? {} : { alpha: effective }) };
  };

  const effectFor = (
    effect: SceneEffect,
    boundColorVar?: string,
  ): DumpEffect => {
    const color =
      effect.color === undefined ? undefined : splitHexAlpha(effect.color);
    return {
      type: effect.type,
      ...(color === undefined ? {} : { color }),
      ...(effect.offset === undefined ? {} : { offset: effect.offset }),
      radius: effect.radius,
      ...(effect.spread === undefined || effect.spread === 0
        ? {}
        : { spread: effect.spread }),
      ...(boundColorVar === undefined
        ? {}
        : { bound: { color: dumpName(boundColorVar) } }),
    };
  };

  /** Land the shared identity channels every node projects. */
  const landIdentity = (
    node: SceneNodeSnapshot,
    key: string,
    nameLanding: string,
    kindLanding: string,
  ): void => {
    ledger.land(key, "kind", 0, "carried", kindLanding);
    ledger.land(key, "name", 0, "named", nameLanding);
    if (
      node.semanticRole !== undefined ||
      (node.name.includes("/") && !node.name.includes("="))
    ) {
      ledger.land(
        key,
        "role",
        0,
        "carried",
        `rides the name ("role :: label" spelling carried by ${nameLanding})`,
      );
    }
    ledger.land(
      key,
      "visible",
      0,
      node.visible
        ? "carried"
        : "named",
      node.visible
        ? "dump captures `hidden` only when false — absence IS visible:true"
        : "hidden: true",
    );
    ledger.land(
      key,
      "opacity",
      0,
      node.opacity === 1 ? "carried" : "named",
      node.opacity === 1
        ? "dump omits opacity 1 (the Figma default) — absence IS opaque"
        : "opacity",
    );
  };

  /** Bindings → dump `bound` / paint vars / text vars. Returns the lookup
   *  used by paint/text bridging. */
  const landBindings = (
    node: SceneNodeSnapshot,
    key: string,
    kind: "frame" | "text",
  ): {
    bound: Record<string, string>;
    byField: Map<string, string>;
  } => {
    const bound: Record<string, string> = {};
    const byField = new Map<string, string>();
    (node.boundVariables ?? []).forEach((binding, index) => {
      byField.set(binding.field, binding.variableName);
      const name = dumpName(binding.variableName);
      const site = `${key}/${binding.field}`;
      const landNamed = (dumpField: string): void =>
        ledger.land(key, "binding", index, "named", dumpField);
      const float = (value: number | null | undefined): number | undefined =>
        value === null || value === undefined ? undefined : value;
      switch (binding.field) {
        case "paddingTop":
        case "paddingRight":
        case "paddingBottom":
        case "paddingLeft":
        case "itemSpacing": {
          bound[binding.field] = name;
          landNamed(`bound.${binding.field} = ${name}`);
          observeVariable(
            binding.variableName,
            "FLOAT",
            float(node[binding.field]),
            site,
          );
          break;
        }
        case "minWidth":
        case "minHeight": {
          const resolved = float(node[binding.field]);
          if (resolved === undefined) {
            // Observe snapshot carries null for an unbound-looking min that
            // still has a variable alias — without a resolved float we cannot
            // mint the token. RECEIPT the binding; do not invent 0 from the name.
            ledger.land(
              key,
              "binding",
              index,
              "receipted",
              `${binding.field} binds ${binding.variableName} but the observe resolves ${binding.field}=null — no dump value to capture; RECEIPT, nothing invented`,
            );
            break;
          }
          bound[binding.field] = name;
          landNamed(`bound.${binding.field} = ${name}`);
          observeVariable(
            binding.variableName,
            "FLOAT",
            resolved,
            site,
          );
          break;
        }
        case "topLeftRadius":
        case "topRightRadius":
        case "bottomLeftRadius":
        case "bottomRightRadius": {
          bound[binding.field] = name;
          landNamed(`bound.${binding.field} = ${name}`);
          const corner = {
            topLeftRadius: node.cornerRadius?.topLeft,
            topRightRadius: node.cornerRadius?.topRight,
            bottomLeftRadius: node.cornerRadius?.bottomLeft,
            bottomRightRadius: node.cornerRadius?.bottomRight,
          }[binding.field];
          observeVariable(binding.variableName, "FLOAT", float(corner), site);
          break;
        }
        case "strokes.0.weight": {
          // The canvas-facts normalization collapsed four uniform per-side
          // weights into this spelling; the dump vocabulary is per-side.
          for (const side of [
            "strokeTopWeight",
            "strokeRightWeight",
            "strokeBottomWeight",
            "strokeLeftWeight",
          ])
            bound[side] = name;
          landNamed(
            `bound.strokeTop/Right/Bottom/LeftWeight = ${name} (uniform side weights — the canvas-facts collapse re-expanded to the dump's per-side spelling)`,
          );
          observeVariable(
            binding.variableName,
            "FLOAT",
            float(node.strokeWeight),
            site,
          );
          break;
        }
        case "fills.0.color": {
          landNamed(
            kind === "text"
              ? `text.fillVar + fill.var = ${name}`
              : `fill.var = ${name}`,
          );
          // Value observed by paintFor at the fill site.
          break;
        }
        case "strokes.0.paint.color": {
          landNamed(`stroke.var = ${name}`);
          break;
        }
        case "fontSize.0":
        case "fontSize": {
          landNamed(`text.fontSizeVar = ${name}`);
          observeVariable(
            binding.variableName,
            "FLOAT",
            float(node.fontSize),
            site,
          );
          break;
        }
        case "lineHeight.0":
        case "lineHeight": {
          landNamed(`text.lineHeightVar = ${name}`);
          observeVariable(
            binding.variableName,
            "FLOAT",
            node.lineHeight?.unit === "PIXELS"
              ? float(node.lineHeight.value)
              : undefined,
            site,
          );
          break;
        }
        case "width":
        case "height": {
          bound[binding.field] = name;
          landNamed(`bound.${binding.field} = ${name}`);
          observeVariable(
            binding.variableName,
            "FLOAT",
            binding.field === "width" ? node.width : node.height,
            site,
          );
          break;
        }
        default: {
          const effectColor = binding.field.match(/^effects\.(\d+)\.color$/);
          if (effectColor) {
            const effectIndex = Number(effectColor[1]);
            landNamed(`effects[${effectIndex}].bound.color = ${name} (dump v1.31 effect-channel binding)`);
            const effect = (node.effects ?? [])[effectIndex];
            observeVariable(
              binding.variableName,
              "COLOR",
              effect?.color === undefined
                ? undefined
                : variableColor(effect.color),
              site,
            );
            break;
          }
          ledger.land(
            key,
            "binding",
            index,
            "receipted",
            `binding field "${binding.field}" has no dump spelling — receipt, nothing invented`,
          );
        }
      }
    });
    return { bound, byField };
  };

  const landPaints = (
    node: SceneNodeSnapshot,
    key: string,
    byField: Map<string, string>,
    kind: "frame" | "text",
  ): { fill?: DumpPaint; stroke?: DumpPaint } => {
    let fill: DumpPaint | undefined;
    let stroke: DumpPaint | undefined;
    (node.fills ?? []).forEach((paint, index) => {
      if (index === 0) {
        fill = paintFor(
          paint,
          byField.get("fills.0.color"),
          key,
          `${key}/fills.0`,
        );
        ledger.land(
          key,
          "fill",
          index,
          "named",
          kind === "text"
            ? `text fill → ${fill.var ? `fill.var ${fill.var}` : `fill.hex ${fill.hex}`}`
            : fill.var
              ? `fill.var ${fill.var}`
              : `fill.hex ${fill.hex}`,
        );
      } else {
        ledger.land(
          key,
          "fill",
          index,
          "receipted",
          "dump v1 carries the FIRST visible solid fill; additional paint-stack entries have no spelling — receipt",
        );
      }
    });
    (node.strokes ?? []).forEach((paint, index) => {
      if (index === 0) {
        stroke = paintFor(
          paint,
          byField.get("strokes.0.paint.color"),
          key,
          `${key}/strokes.0`,
        );
        ledger.land(
          key,
          "stroke",
          index,
          "named",
          `stroke.var/hex + strokeWeight ${node.strokeWeight ?? 0} + strokeAlign ${node.strokeAlign ?? "INSIDE"}`,
        );
      } else {
        ledger.land(
          key,
          "stroke",
          index,
          "receipted",
          "dump v1 carries the FIRST stroke paint; additional strokes have no spelling — receipt",
        );
      }
    });
    (node.effects ?? []).forEach((effect, index) => {
      if (!effect.visible) return; // invisible effects project no fact
      ledger.land(
        key,
        "effect",
        index,
        "named",
        `effects[] (${effect.type})`,
      );
    });
    return { fill, stroke };
  };

  const landCornerRadius = (
    node: SceneNodeSnapshot,
    key: string,
    bound: Record<string, string>,
  ): number | undefined => {
    const radius = node.cornerRadius;
    if (radius === undefined) return undefined;
    const corners = [
      radius.topLeft,
      radius.topRight,
      radius.bottomRight,
      radius.bottomLeft,
    ];
    const uniform = corners.every((corner) => corner === corners[0]);
    const boundRadii =
      bound.topLeftRadius !== undefined ||
      bound.topRightRadius !== undefined ||
      bound.bottomLeftRadius !== undefined ||
      bound.bottomRightRadius !== undefined;
    if (boundRadii) {
      ledger.land(
        key,
        "cornerRadius",
        0,
        "named",
        "bound.topLeft/topRight/bottomLeft/bottomRightRadius (variable-bound radii)",
      );
      return undefined;
    }
    if (uniform && corners[0] === 0) {
      ledger.land(
        key,
        "cornerRadius",
        0,
        "carried",
        "uniform radius 0 — the dump omits it (Figma/CSS default); absence IS zero",
      );
      return undefined;
    }
    if (uniform) {
      ledger.land(key, "cornerRadius", 0, "named", "cornerRadius (uniform literal)");
      return corners[0];
    }
    ledger.land(
      key,
      "cornerRadius",
      0,
      "receipted",
      `non-uniform unbound radii (${corners.join("/")}) — dump v1 spells only uniform literal or bound per-corner; receipt`,
    );
    return undefined;
  };

  const sizingLanding = (
    mode: SceneNodeSnapshot["layoutSizingHorizontal"],
  ): "FIXED" | "AUTO" => (mode === "FIXED" ? "FIXED" : "AUTO");

  const bridgeChildren = (
    node: SceneNodeSnapshot,
    key: string,
  ): DumpNode[] => {
    return node.children.map((child, index) => {
      const childKey = `${key}/children/${index}`;
      ledger.land(key, "child", index, "carried", "children[] order");
      return bridgeNode(child, childKey);
    });
  };

  const bridgeNode = (node: SceneNodeSnapshot, key: string): DumpNode => {
    if (node.type === "TEXT") return bridgeText(node, key);
    if (node.type === "INSTANCE") return bridgeInstance(node, key);
    if (node.type === "FRAME" || node.type === "COMPONENT")
      return bridgeFrame(node, key);
    throw new TypeError(
      `bridge: node type ${node.type} at ${key} is outside this bridge's vocabulary — refuse rather than approximate`,
    );
  };

  const bridgeFrame = (node: SceneNodeSnapshot, key: string): DumpNode => {
    landIdentity(
      node,
      key,
      key === "root" ? "setName" : "variants[]/children[].name",
      node.type === "COMPONENT"
        ? "dump variant node (type COMPONENT)"
        : "dump child node (type FRAME)",
    );
    const { bound, byField } = landBindings(node, key, "frame");
    const { fill, stroke } = landPaints(node, key, byField, "frame");
    const cornerRadius = landCornerRadius(node, key, bound);

    // Layout block (frame/component nodes always project layout facts).
    const mode = node.layoutMode;
    if (mode !== "HORIZONTAL" && mode !== "VERTICAL")
      throw new TypeError(
        `bridge: ${key} has layoutMode ${mode ?? "NONE"} — a variant root without auto-layout is outside this bridge's vocabulary`,
      );
    ledger.land(key, "layout.mode", 0, "named", "layout.mode");
    ledger.land(key, "layout.primaryAxisAlign", 0, "named", "layout.primary");
    ledger.land(key, "layout.counterAxisAlign", 0, "named", "layout.counter");
    ledger.land(key, "layout.itemSpacing", 0, "named", "layout.spacing");
    ledger.land(
      key,
      "layout.padding",
      0,
      "named",
      "layout.padding [top,right,bottom,left]",
    );
    const horizontal = sizingLanding(node.layoutSizingHorizontal);
    const vertical = sizingLanding(node.layoutSizingVertical);
    const primarySizing = mode === "HORIZONTAL" ? horizontal : vertical;
    const counterSizing = mode === "HORIZONTAL" ? vertical : horizontal;
    const fillAxes: { fillWidth?: boolean; fillHeight?: boolean } = {};
    const landSizing = (
      channel: "width.mode" | "height.mode",
      sizing: SceneNodeSnapshot["layoutSizingHorizontal"],
    ): void => {
      if (sizing === "FILL") {
        if (channel === "width.mode") fillAxes.fillWidth = true;
        else fillAxes.fillHeight = true;
        ledger.land(
          key,
          channel,
          0,
          "named",
          channel === "width.mode" ? "fillWidth: true" : "fillHeight: true",
        );
      } else {
        ledger.land(
          key,
          channel,
          0,
          "named",
          `layout.${channel === "width.mode" ? (mode === "HORIZONTAL" ? "primarySizing" : "counterSizing") : mode === "HORIZONTAL" ? "counterSizing" : "primarySizing"} = ${sizing === "FIXED" ? "FIXED" : "AUTO"}`,
        );
      }
    };
    landSizing("width.mode", node.layoutSizingHorizontal);
    landSizing("height.mode", node.layoutSizingVertical);
    const fixed: { width?: number; height?: number } = {};
    if (node.layoutSizingHorizontal === "FIXED") {
      fixed.width = node.width;
      ledger.land(key, "width.value", 0, "named", "bbox.width (drawn FIXED width)");
    }
    if (node.layoutSizingVertical === "FIXED") {
      fixed.height = node.height;
      ledger.land(key, "height.value", 0, "named", "bbox.height (drawn FIXED height)");
    }
    // Geometric minWidth/minHeight facts: dump v1 has no literal min* field —
    // only the bound spelling. When a binding is present, the geometric fact
    // is CARRIED by that binding; otherwise RECEIPT (nothing invented).
    if (node.minWidth !== undefined && node.minWidth !== null) {
      const boundMin = byField.has("minWidth");
      ledger.land(
        key,
        "layout.minWidth",
        0,
        boundMin ? "carried" : "receipted",
        boundMin
          ? "layout.minWidth carried via bound.minWidth (dump has no literal minWidth)"
          : "unbound layout.minWidth — dump v1 has no literal minWidth spelling; RECEIPT, nothing invented",
      );
    }
    if (node.minHeight !== undefined && node.minHeight !== null) {
      const boundMin = byField.has("minHeight");
      ledger.land(
        key,
        "layout.minHeight",
        0,
        boundMin ? "carried" : "receipted",
        boundMin
          ? "layout.minHeight carried via bound.minHeight (dump has no literal minHeight)"
          : "unbound layout.minHeight — dump v1 has no literal minHeight spelling; RECEIPT, nothing invented",
      );
    }
    ledger.land(
      key,
      "clipsContent",
      0,
      node.clipsContent ? "named" : "carried",
      node.clipsContent
        ? "clipsContent: true"
        : "dump captures clipsContent only when true — absence IS the CSS default (visible)",
    );
    ledger.land(
      key,
      "layout.positioning",
      0,
      node.layoutPositioning === "ABSOLUTE" ? "receipted" : "carried",
      node.layoutPositioning === "ABSOLUTE"
        ? "ABSOLUTE positioning not bridged in v1 — receipt"
        : "in-flow (AUTO) is the dump default — absence IS in-flow",
    );
    if (node.type === "COMPONENT") {
      ledger.land(
        key,
        "variantProperties",
        0,
        "named",
        "variants[].variantProperties (dump v1.14 authoritative tuple)",
      );
    }
    const children = bridgeChildren(node, key);
    return {
      name: node.name,
      type: node.type === "COMPONENT" ? "COMPONENT" : "FRAME",
      ...(node.type === "COMPONENT" && node.variantProperties !== undefined
        ? { variantProperties: { ...node.variantProperties } }
        : {}),
      layout: {
        mode,
        primary: node.primaryAxisAlignItems ?? "MIN",
        counter: node.counterAxisAlignItems ?? "MIN",
        spacing: node.itemSpacing ?? 0,
        padding: [
          node.paddingTop ?? 0,
          node.paddingRight ?? 0,
          node.paddingBottom ?? 0,
          node.paddingLeft ?? 0,
        ],
        primarySizing,
        counterSizing,
      },
      ...(cornerRadius === undefined ? {} : { cornerRadius }),
      ...(Object.keys(bound).length === 0 ? {} : { bound }),
      ...(fill === undefined ? {} : { fill }),
      ...(stroke === undefined ? {} : { stroke }),
      ...(node.strokeWeight === undefined || stroke === undefined
        ? {}
        : { strokeWeight: node.strokeWeight }),
      ...(stroke === undefined || node.strokeAlign === undefined
        ? {}
        : { strokeAlign: node.strokeAlign }),
      ...((node.effects ?? []).some((effect) => effect.visible)
        ? {
            effects: (node.effects ?? [])
              .map((effect, index) =>
                effect.visible
                  ? effectFor(effect, byField.get(`effects.${index}.color`))
                  : null,
              )
              .filter((effect): effect is DumpEffect => effect !== null),
          }
        : {}),
      ...fillAxes,
      ...(fixed.width !== undefined && node.type === "COMPONENT"
        ? { bbox: { width: node.width, height: node.height } }
        : Object.keys(fixed).length > 0
          ? { fixedSize: fixed }
          : {}),
      ...((node as { hidden?: boolean }).hidden === false || node.visible === false
        ? { hidden: true }
        : {}),
      ...(node.opacity !== 1 ? { opacity: node.opacity } : {}),
      ...(children.length > 0 ? { children } : {}),
    };
  };

  const bridgeText = (node: SceneNodeSnapshot, key: string): DumpNode => {
    landIdentity(node, key, "children[].name (TEXT)", "dump TEXT node");
    const { byField } = landBindings(node, key, "text");
    const { fill } = landPaints(node, key, byField, "text");
    ledger.land(key, "characters", 0, "named", "text.characters");

    // The `type` fact is the WHOLE typography object; land it named only when
    // every present subfield has a dump spelling, else receipt the residue.
    const residues: string[] = [];
    if (node.lineHeight !== undefined && node.lineHeight.unit !== "PIXELS")
      residues.push(
        `lineHeight unit ${node.lineHeight.unit} (dump carries PIXELS only)`,
      );
    if (node.letterSpacing !== undefined && node.letterSpacing.value !== 0)
      residues.push("letterSpacing (no dump v1 channel)");
    if (node.textDecoration !== undefined && node.textDecoration !== "NONE")
      residues.push("textDecoration (no dump v1 projection)");
    ledger.land(
      key,
      "type",
      0,
      residues.length === 0 ? "named" : "receipted",
      residues.length === 0
        ? "text.fontSize/fontStyle/fontFamily/lineHeight (+ fontSizeVar/lineHeightVar/fillVar)"
        : `typography carried EXCEPT: ${residues.join("; ")} — receipt`,
    );
    ledger.land(key, "align", 0, "named", "text.textAlign");
    ledger.land(
      key,
      "verticalAlign",
      0,
      "receipted",
      "textAlignVertical has no dump v1 channel — the parent's counter-axis centering carries the rendered position; receipt",
    );
    ledger.land(
      key,
      "width.mode",
      0,
      "carried",
      "TEXT hugs by construction in dump v1 (no text sizing channel; absence IS hug)",
    );
    ledger.land(
      key,
      "height.mode",
      0,
      "carried",
      "TEXT hugs by construction in dump v1 (no text sizing channel; absence IS hug)",
    );
    const fontSizeVar = byField.get("fontSize.0") ?? byField.get("fontSize");
    const lineHeightVar =
      byField.get("lineHeight.0") ?? byField.get("lineHeight");
    const fillVar = byField.get("fills.0.color");
    if (node.textCase !== undefined && node.textCase !== "ORIGINAL") {
      // carried by DumpText.textCase — named as part of `type` above.
    }
    return {
      name: node.name,
      type: "TEXT",
      ...(fill === undefined ? {} : { fill }),
      text: {
        characters: node.characters ?? "",
        fontSize: node.fontSize ?? 0,
        fontStyle: node.fontName?.style ?? "",
        ...(node.lineHeight?.unit === "PIXELS" &&
        node.lineHeight.value !== undefined
          ? { lineHeight: node.lineHeight.value }
          : {}),
        ...(node.fontName?.family === undefined
          ? {}
          : { fontFamily: node.fontName.family }),
        ...(node.textAlignHorizontal === undefined
          ? {}
          : { textAlign: node.textAlignHorizontal }),
        ...(node.textCase !== undefined && node.textCase !== "ORIGINAL"
          ? { textCase: node.textCase as "UPPER" | "LOWER" | "TITLE" }
          : {}),
        ...(fontSizeVar === undefined
          ? {}
          : { fontSizeVar: dumpName(fontSizeVar) }),
        ...(lineHeightVar === undefined
          ? {}
          : { lineHeightVar: dumpName(lineHeightVar) }),
        ...(fillVar === undefined ? {} : { fillVar: dumpName(fillVar) }),
      },
      ...(node.visible === false ? { hidden: true } : {}),
      ...(node.opacity !== 1 ? { opacity: node.opacity } : {}),
    };
  };

  const bridgeInstance = (node: SceneNodeSnapshot, key: string): DumpNode => {
    landIdentity(node, key, "children[].name (INSTANCE)", "dump INSTANCE node");
    ledger.land(
      key,
      "componentRef",
      0,
      "named",
      "instanceOf (main component identity; internals belong to the child)",
    );
    ledger.land(
      key,
      "properties",
      0,
      "named",
      "componentProperties (applied values, captured-empty is a canvas fact)",
    );
    // Instance boxes: dump v1 stops at instance boundaries — the OBSERVED
    // bbox is the honest geometry a child stub renders.
    for (const channel of ["width.mode", "height.mode"] as const) {
      const sizing =
        channel === "width.mode"
          ? node.layoutSizingHorizontal
          : node.layoutSizingVertical;
      ledger.land(
        key,
        channel,
        0,
        sizing === "FIXED" ? "named" : "carried",
        sizing === "FIXED"
          ? "bbox (observed instance box)"
          : "instance sizing rides the child component — dump carries observed bbox only",
      );
    }
    if (node.layoutSizingHorizontal === "FIXED")
      ledger.land(key, "width.value", 0, "named", "bbox.width");
    if (node.layoutSizingVertical === "FIXED")
      ledger.land(key, "height.value", 0, "named", "bbox.height");
    // Bindings on instances (none observed for Button; receipt any).
    (node.boundVariables ?? []).forEach((_, index) =>
      ledger.land(
        key,
        "binding",
        index,
        "receipted",
        "instance-level binding — internals belong to the child component; receipt",
      ),
    );
    (node.fills ?? []).forEach((_, index) =>
      ledger.land(
        key,
        "fill",
        index,
        "receipted",
        "instance fill — internals belong to the child component; receipt",
      ),
    );
    return {
      name: node.name,
      type: "INSTANCE",
      ...(node.componentRef === undefined
        ? {}
        : { instanceOf: node.componentRef }),
      bbox: { width: node.width, height: node.height },
      componentProperties: Object.fromEntries(
        Object.entries(node.componentProperties ?? {}).map(([k, v]) => [
          k,
          typeof v === "number" ? String(v) : v,
        ]),
      ),
      ...(node.visible === false ? { hidden: true } : {}),
      ...(node.opacity !== 1 ? { opacity: node.opacity } : {}),
    };
  };

  // -------------------------------------------------------------------------
  // Root COMPONENT_SET → DumpSet
  // -------------------------------------------------------------------------

  landIdentity(
    scene,
    "root",
    "setName (verbatim drawn set name)",
    "COMPONENT_SET → DumpSet",
  );
  // Set-level chrome: the proof sheet's own arrangement. The dump vocabulary
  // carries VARIANTS; a set-level layout/paint block does not exist, and the
  // forward writer stamps this chrome itself — receipts, never silent.
  const setChrome = (channel: string, occurrence = 0): void =>
    ledger.land(
      "root",
      channel,
      occurrence,
      "receipted",
      "component-set proof-sheet chrome (arrangement of the drawn sheet) — the dump vocabulary carries variants, not set-level chrome; receipt",
    );
  for (const channel of [
    "layout.mode",
    "layout.primaryAxisAlign",
    "layout.counterAxisAlign",
    "layout.itemSpacing",
    "layout.padding",
    "layout.positioning",
    "width.mode",
    "height.mode",
    "clipsContent",
  ])
    setChrome(channel);
  if (scene.layoutSizingHorizontal === "FIXED") setChrome("width.value");
  if (scene.layoutSizingVertical === "FIXED") setChrome("height.value");
  (scene.fills ?? []).forEach((_, index) => setChrome("fill", index));
  (scene.strokes ?? []).forEach((_, index) => setChrome("stroke", index));
  if (scene.cornerRadius !== undefined) setChrome("cornerRadius");
  (scene.boundVariables ?? []).forEach((_, index) =>
    setChrome("binding", index),
  );

  // Variant axes → propertyDefinitions. The canvas orders variants; the dump
  // spells a default per axis — the FIRST variant's value (the same
  // canvas-order rule proposeFromDump documents for inversion).
  const firstComponent = scene.children.find(
    (child) => child.type === "COMPONENT",
  );
  if (firstComponent === undefined)
    throw new TypeError("bridge: component set has no COMPONENT children");
  const axes = Object.entries(scene.variantGroupProperties ?? {});
  const propertyDefinitions: Record<string, DumpPropertyDefinition> = {};
  axes.forEach(([axis, group], index) => {
    const defaultValue = firstComponent.variantProperties?.[axis];
    if (defaultValue === undefined)
      throw new TypeError(
        `bridge: axis ${axis} has no value on the first variant — cannot spell a default without inventing one`,
      );
    propertyDefinitions[axis] = {
      type: "VARIANT",
      defaultValue,
      variantOptions: [...group.values],
    };
    ledger.land(
      "root",
      "variantAxis",
      index,
      "named",
      `propertyDefinitions.${axis} (VARIANT; default = first drawn variant's value, the generator's canvas-order rule)`,
    );
  });

  const variants = scene.children.map((child, index) => {
    const childKey = `root/children/${index}`;
    ledger.land("root", "child", index, "carried", "variants[] order");
    if (child.type !== "COMPONENT")
      throw new TypeError(
        `bridge: set child ${index} is ${child.type}, not COMPONENT`,
      );
    return bridgeNode(child, childKey);
  });

  const setName = scene.name;
  const set: DumpSet = {
    setName,
    type: "COMPONENT_SET",
    propertyDefinitions,
    variants,
  };

  const dump: DumpFile = {
    _provenance: {
      fileKey: null,
      // Deterministic — the bridge is a pure function of the committed
      // observe; a wall-clock date here would churn committed evidence.
      extractedAt: `offline-bridge:${doc.source.observeSha256.slice(0, 12)}`,
      note:
        "BRIDGED from a canvas-facts document (recipe/canvas-facts-to-dump.ts, stage 3b of docs/35 §5) — derived offline from a committed scene observe; NOT a dump.plugin.js capture. Field coverage mirrors dump v1 core channels; every canvas fact that could not land is a named receipt in the bridge ledger.",
      dumpVersion: "1.32",
    },
    _variables: Object.fromEntries(
      [...variables.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, { sites: _sites, ...variable }]) => [name, variable]),
    ),
    [setName]: set,
  };

  const { ledger: rows, silent, orphans } = ledger.rows(doc.facts);
  if (orphans.length > 0)
    throw new TypeError(
      `bridge ledger: ${orphans.length} landing(s) matched no projected fact — the bridge and the projection disagree: ${orphans.slice(0, 5).join(", ")}`,
    );
  if (silent.length > 0)
    throw new TypeError(
      `bridge: ${silent.length} canvas fact(s) landed NOWHERE (silent loss forbidden): ${silent
        .slice(0, 10)
        .map((fact) => fact.id)
        .join(", ")}${silent.length > 10 ? ", …" : ""}`,
    );

  const counts = {
    facts: doc.facts.length,
    named: rows.filter((row) => row.disposition === "named").length,
    carried: rows.filter((row) => row.disposition === "carried").length,
    receipted: rows.filter((row) => row.disposition === "receipted").length,
    silent: silent.length,
  };

  return { dump, setName, ledger: rows, tokenRenames, counts };
}
