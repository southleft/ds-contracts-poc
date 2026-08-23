/**
 * DESIGN→CODE CENSUS — the CARRIAGE ACCOUNTING engine.
 *
 * Denominator: every Figma-side fact on the RAW REST node documents of a
 * component set (the committed fixture extract/figma/fixtures/census-d2c/
 * <kit>.rest-nodes.json), enumerated by a fixed fact grammar (one row per
 * node × channel; instance internals count once as the instance — they
 * belong to the child component).
 *
 * Each fact is classified by EVIDENCE, never by assertion:
 *   CARRIED — a structural landing exists in the proposed contract (a prop,
 *             a state, a part channel, an anchor, the description…), and the
 *             row names WHERE it lands in the contract and in the generated
 *             code (React prop / story arg / CSS var / WC attribute).
 *   NAMED   — no landing, but the loss is receipted BY NAME: a proposal
 *             note, a dump `_degradations` row, or a `_provenance`
 *             captureGap that covers the channel.
 *   SILENT  — neither. A SILENT row is a defect to fix at the cause
 *             (propose/map/generate), and `census:check --phase
 *             design-to-code` goes RED on it by name.
 *
 * The classifier reads FOUR artifacts and nothing else: the raw REST node
 * document, the mapped dump entry (+ its receipts), the proposed contract
 * (+ its notes), and the generated code files. Every CARRIED/NAMED row
 * carries its evidence string so the receipt is auditable.
 */
import type { DumpDegradation, DumpSet } from "../types.js";

// ---------------------------------------------------------------------------
// Fact rows
// ---------------------------------------------------------------------------

export type Disposition = "CARRIED" | "NAMED" | "SILENT";

export interface FactRow {
  /** setName:VariantName/Child/… — the propose.ts note-path spelling. */
  path: string;
  /** The channel this fact lives on (REST field, normalized). */
  channel: string;
  /** Short rendering of the drawn value. */
  value: string;
  disposition: Disposition;
  /** CARRIED: where it lands; NAMED: the receipt that names it. */
  evidence: string;
  /** Render-inert facts (aspect-ratio lock at fixed size, …) — still
   *  accounted, flagged so the receipt can say so. */
  inert?: boolean;
}

export interface SetAccount {
  setName: string;
  contractId: string;
  carried: number;
  named: number;
  silent: number;
  rows: FactRow[];
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

interface RestNodeDoc {
  id: string;
  name: string;
  type: string;
  [k: string]: unknown;
  children?: RestNodeDoc[];
}

export interface AccountInputs {
  /** The set's raw REST document (COMPONENT_SET or COMPONENT). */
  doc: RestNodeDoc;
  /** Response metadata for the set id (description / documentationLinks / key). */
  meta: { description?: string; documentationLinks?: Array<{ uri?: string }>; key?: string } | undefined;
  dumpSet: DumpSet;
  degradations: DumpDegradation[];
  captureGaps: string[];
  contract: Record<string, unknown>;
  notes: string[];
  /** filename → file text, across every generated surface (React tsx/css/
   *  stories + WC ts/css.ts). */
  generated: ReadonlyMap<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const short = (v: unknown): string => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s === undefined ? "undefined" : s.length > 90 ? `${s.slice(0, 87)}…` : s;
};

interface Part {
  name: string;
  json: string;
  node: Record<string, unknown>;
}

/** Every part in the contract anatomy (recursive), by VERBATIM name — the
 *  proposer keeps drawn layer names as part names. */
function collectParts(contract: Record<string, unknown>): Map<string, Part> {
  const out = new Map<string, Part>();
  const anatomy = (contract.anatomy ?? {}) as Record<string, unknown>;
  const walk = (name: string, node: Record<string, unknown>): void => {
    if (!out.has(name)) out.set(name, { name, json: JSON.stringify(node), node });
    for (const [child, sub] of Object.entries((node.parts ?? {}) as Record<string, unknown>)) {
      if (sub && typeof sub === "object") walk(child, sub as Record<string, unknown>);
    }
  };
  for (const [rootName, rootNode] of Object.entries(anatomy)) {
    if (rootNode && typeof rootNode === "object") walk(rootName, rootNode as Record<string, unknown>);
  }
  return out;
}

/** True when the PART's serialized JSON mentions any of the channel keys —
 *  tokens, literals, declared, tokensByProp, states, layout all count. */
const partCarries = (part: Part | undefined, keys: string[]): string | null => {
  if (!part) return null;
  for (const k of keys) if (part.json.includes(`"${k}"`)) return k;
  return null;
};

export function accountSet(inputs: AccountInputs): SetAccount {
  const { doc, meta, dumpSet, degradations, captureGaps, contract, notes, generated } = inputs;
  const setName = doc.name;
  const rows: FactRow[] = [];
  const parts = collectParts(contract);
  const contractText = JSON.stringify(contract);
  const generatedText = [...generated.values()].join("\n");
  const props = (contract.props ?? []) as Array<{
    name: string;
    type: unknown;
    default?: unknown;
    bindings?: { figma?: { property?: string; values?: Record<string, string> } };
  }>;
  const states = (contract.states ?? []) as string[];

  const note = (...frags: string[]): string | null => {
    const hit = notes.find((n) => frags.every((f) => n.includes(f)));
    return hit ?? null;
  };
  const degr = (pathFrag: string, ...msgFrags: string[]): DumpDegradation | null =>
    degradations.find(
      (d) => d.nodePath.includes(pathFrag) && msgFrags.every((f) => d.message.includes(f)),
    ) ?? null;
  const gap = (...frags: string[]): string | null =>
    captureGaps.find((g) => frags.every((f) => g.includes(f))) ?? null;

  const add = (
    path: string,
    channel: string,
    value: unknown,
    disposition: Disposition,
    evidence: string,
    inert = false,
  ): void => {
    rows.push({ path, channel, value: short(value), disposition, evidence, ...(inert ? { inert: true } : {}) });
  };

  /** CARRIED if found; else NAMED via note/degradation candidates; else SILENT. */
  const classify = (
    path: string,
    channel: string,
    value: unknown,
    carriedEvidence: string | null,
    namedEvidence: string | null | undefined,
    inert = false,
  ): void => {
    if (carriedEvidence) add(path, channel, value, "CARRIED", carriedEvidence, inert);
    else if (namedEvidence) add(path, channel, value, "NAMED", short(namedEvidence), inert);
    else add(path, channel, value, "SILENT", "no landing, no receipt", inert);
  };

  // -------------------------------------------------------------------------
  // SET LEVEL — identity, metadata, property definitions, stamps
  // -------------------------------------------------------------------------
  const setPath = `${setName}`;
  const contractId = String(contract.id ?? "");

  // key / nodeId → anchors
  const anchors = ((contract.bindings as Record<string, unknown> | undefined)?.figma as
    | { anchors?: { componentSetKey?: string | null; nodeId?: string } }
    | undefined)?.anchors;
  if (meta?.key)
    classify(setPath, "set key (publish identity)", meta.key,
      anchors?.componentSetKey === meta.key ? "bindings.figma.anchors.componentSetKey" : null,
      null);
  classify(setPath, "set nodeId", doc.id,
    anchors?.nodeId === doc.id ? "bindings.figma.anchors.nodeId" : null, null);

  // description
  if (typeof meta?.description === "string" && meta.description.trim() !== "") {
    const stamped = typeof dumpSet.contractId === "string";
    classify(setPath, "set description (designer's words)", meta.description,
      contract.description === meta.description
        ? "contract.description (verbatim) → React JSDoc + Storybook docs + WC header"
        : null,
      note("description:") ?? (stamped ? note("emit caption") : null));
  }
  // documentation links
  for (const l of meta?.documentationLinks ?? []) {
    if (typeof l?.uri !== "string" || l.uri === "") continue;
    const inContract = JSON.stringify(((contract.documentationLinks ?? []) as Array<{ uri: string }>)).includes(l.uri);
    const inCode = generatedText.includes(l.uri);
    classify(setPath, "set documentationLinks", l.uri,
      inContract ? `contract.documentationLinks → ${inCode ? "JSDoc @see + Storybook docs link" : "(code emitters)"}` : null,
      note("documentationLinks:"));
  }

  // ds_contracts stamps (plugin_data=shared)
  const stamps = (doc.sharedPluginData as Record<string, Record<string, string>> | undefined)?.ds_contracts ?? {};
  for (const [k, v] of Object.entries(stamps)) {
    if (k === "canvasFingerprint" || k === "canvasSnapshot" || k === "canvasSetSnapshot") {
      add(`${setPath}`, `stamp ds_contracts/${k}`, `${String(v).length} chars`, "NAMED",
        "sync-domain fingerprint stamp — read by sync/observe.ts (drift arithmetic), deliberately not a contract fact");
      continue;
    }
    const carriedBy: Record<string, () => string | null> = {
      contractId: () => (contractId === v ? "contract.id (dump v1.32 stamp read-back)" : null),
      version: () => (contract.version === v ? "contract.version" : null),
      specHash: () => (dumpSet.specHash === v ? "dump.specHash — exact-mode evidence (proves the set matches the emit)" : null),
      semantics: () => {
        try {
          const s = JSON.parse(v) as { element?: string; role?: string };
          const cs = contract.semantics as { element?: string; role?: string };
          return cs.element === (s.element ?? "div") && cs.role === s.role ? "contract.semantics (stamp outranks inference)" : null;
        } catch { return null; }
      },
      propNames: () => {
        try {
          const m = JSON.parse(v) as Record<string, string>;
          const ok = Object.entries(m).every(([figmaName, codeName]) =>
            props.some((p) => p.bindings?.figma?.property === figmaName && p.name === codeName) ||
            contractText.includes(`"${codeName}"`),
          );
          return ok ? "prop names (design spelling → contract prop names)" : null;
        } catch { return null; }
      },
      statePreviewAxis: () => {
        try {
          const s = JSON.parse(v) as { states?: string[] };
          const kebab = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          return (s.states ?? []).every((st) => states.includes(kebab(st)))
            ? "contract.states (sparse State matrix accepted via the declared axis)"
            : null;
        } catch { return null; }
      },
    };
    classify(setPath, `stamp ds_contracts/${k}`, v.length > 60 ? `${v.slice(0, 57)}…` : v,
      (carriedBy[k] ?? (() => null))(), note(k));
  }

  // componentPropertyDefinitions
  const defs = (doc.componentPropertyDefinitions ?? {}) as Record<
    string,
    { type: string; defaultValue?: unknown; variantOptions?: string[]; preferredValues?: Array<{ type: string; key: string }> }
  >;
  const kebab = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  for (const [defName, def] of Object.entries(defs)) {
    const bare = defName.split("#")[0];
    const p = `${setPath}.propertyDefinitions.${bare}`;
    if (def.type === "VARIANT" && bare === "State") {
      const promoted = (def.variantOptions ?? []).every(
        (o) => o === "Default" || states.includes(kebab(o)),
      );
      const asEnumProp = props.find((x) => x.bindings?.figma?.property === "State");
      classify(p, "interaction-state axis", (def.variantOptions ?? []).join("|"),
        promoted && states.length > 0
          ? `contract.states [${states.join(", ")}] → CSS pseudo-class planes (:hover/:active/:focus-visible/[disabled]) + statePreviews`
          : asEnumProp
            ? `props.${asEnumProp.name} — kept as an enum prop (no default/non-default split to promote; the proposal names it for review)`
            : null,
        note("State", "promoted") ?? note("interaction states") ?? note('variant axis "State"'));
      continue;
    }
    if (def.type === "VARIANT") {
      const prop = props.find((x) => x.bindings?.figma?.property === bare);
      const enumType = prop && typeof prop.type === "object" && prop.type !== null && "enum" in (prop.type as object);
      const boolType = prop && prop.type === "boolean";
      const reactSig = prop ? new RegExp(`${prop.name}\\??:`).test(generatedText) : false;
      classify(p, "variant axis", (def.variantOptions ?? []).join("|"),
        prop && enumType
          ? `props.${prop.name} (enum[${(prop.type as { enum: string[] }).enum.length}]) → React prop \`${prop.name}\`${reactSig ? "" : " (NOT in generated signature)"} + story argTypes + CSS .${prop.name}-<value> classes + WC attribute`
          : prop && boolType
            ? `props.${prop.name} (boolean — the axis's options are literally true/false) → React prop + story args + WC attribute`
            : null,
        note(bare, "axis"));
      if (prop && typeof def.defaultValue === "string") {
        const values = prop.bindings?.figma?.values ?? {};
        const canonical = Object.entries(values).find(([, drawn]) => drawn === def.defaultValue)?.[0] ?? kebab(String(def.defaultValue));
        classify(`${p}.defaultValue`, "declared axis default", def.defaultValue,
          prop.default === canonical ? `props.${prop.name}.default = ${JSON.stringify(prop.default)} → React default arg + story args` : null,
          note(prop.name, "default"));
      }
      continue;
    }
    if (def.type === "BOOLEAN") {
      const prop = props.find((x) => x.bindings?.figma?.property === bare && contractText.includes('"boolean"'));
      classify(p, "BOOLEAN property", `default=${String(def.defaultValue)}`,
        prop ? `props.${prop.name} (boolean, default ${JSON.stringify(prop.default)}) → React prop + visibleWhen part visibility` : null,
        note(bare));
      continue;
    }
    if (def.type === "TEXT") {
      const prop = props.find((x) => x.bindings?.figma?.property === bare && x.type === "text");
      classify(p, "TEXT property", `default=${short(def.defaultValue)}`,
        prop ? `props.${prop.name} (text, default ${JSON.stringify(prop.default)}) → React prop / children + story args` : null,
        note(bare));
      continue;
    }
    if (def.type === "INSTANCE_SWAP" || def.type === "SLOT") {
      const isSlot = contractText.includes('"slot"');
      classify(p, `${def.type} property`, `default=${short(def.defaultValue)}`,
        isSlot && (contractText.includes(`"${bare}"`) || note(bare) === null)
          ? `anatomy slot part (property "${bare}") → React slot prop / children`
          : null,
        note(bare));
      const pv = def.preferredValues;
      if (Array.isArray(pv)) {
        classify(`${p}.preferredValues`, "swap/slot accepts", pv.length === 0 ? "[] (unconstrained)" : pv.map((x) => x.key.slice(0, 8)).join(","),
          pv.length > 0 && contractText.includes('"accepts"') ? "slot.accepts (keys resolved through in-scope contracts)" : null,
          pv.length === 0
            ? note(bare, "EMPTY") ?? note("preferredValues is EMPTY")
            : note("preferredValues") ?? note(bare));
      }
    }
  }

  // -------------------------------------------------------------------------
  // NODE LEVEL — walk every variant subtree
  // -------------------------------------------------------------------------
  const variants: RestNodeDoc[] = doc.type === "COMPONENT_SET" ? (doc.children ?? []) : [doc];

  const visit = (node: RestNodeDoc, path: string, isRoot: boolean, parent: RestNodeDoc | null): void => {
    const part = isRoot ? parts.get("root") : parts.get(node.name);
    const pj = part?.json ?? "";
    const n = node as Record<string, unknown> & RestNodeDoc;

    // bound variables — every alias is a fact
    const aliasFields: string[] = [];
    const collectAliases = (v: unknown, field: string): void => {
      if (!v) return;
      if (Array.isArray(v)) return v.forEach((x) => collectAliases(x, field));
      if (typeof v === "object") {
        if ((v as { type?: string }).type === "VARIABLE_ALIAS") aliasFields.push(field);
        else for (const [k, x] of Object.entries(v)) collectAliases(x, field === "" ? k : field);
      }
    };
    for (const [field, v] of Object.entries((n.boundVariables ?? {}) as Record<string, unknown>)) {
      if (field === "componentProperties") continue;
      collectAliases(v, field);
    }
    for (const field of aliasFields) {
      classify(path, `boundVariables.${field}`, "variable alias",
        null,
        degr(path.split("/")[0], field === "effects" ? "effects[" : `${field}:`)?.message ??
          degr(setName, field)?.message ??
          gap("variable names") ?? note("variable-unresolved"));
    }

    if (node.type === "INSTANCE") {
      classify(path, "instance main component", String(n.componentId ?? ""),
        pj !== "" || contractText.includes('"component"') || contractText.includes('"defaultContent"')
          ? "anatomy component ref / slot defaultContent (internals belong to the child contract)"
          : null,
        note(node.name, "stub") ?? note(node.name));
      for (const [k, d] of Object.entries((n.componentProperties ?? {}) as Record<string, { type: string; value: unknown }>)) {
        const bare = k.split("#")[0];
        if (d.type === "SLOT") {
          classify(`${path}`, `componentProperties.${bare} (SLOT value)`, "{guid}", null,
            degr(setName, "SLOT-typed")?.message ?? note(bare, "SLOT"));
        } else if (d.type === "INSTANCE_SWAP") {
          classify(`${path}`, `componentProperties.${bare} (fixed swap)`, short(d.value),
            null, note("INSTANCE_SWAP", "fixes") ?? note("fixedSwaps") ?? note(bare));
        } else {
          classify(`${path}`, `componentProperties.${bare}`, short(d.value),
            contractText.includes(`"${bare}"`) || contractText.includes(short(d.value)) ||
              note(node.name, "canonicalized") !== null
              ? "component ref props (canonicalized through the child's bindings)"
              : null,
            note(bare) ?? note(node.name, "does not map through"));
        }
      }
      const ov = ((n.overrides ?? []) as Array<{ id: string; overriddenFields?: string[] }>).filter(
        (o) => o.id !== node.id && (o.overriddenFields ?? []).some((f) => f === "fills" || f === "characters"),
      );
      if (ov.length > 0)
        classify(path, "overrides[] (host overrides inside the instance)", `${ov.length} node(s)`,
          note(node.name, "override") ?? note("host override") ? null : null,
          note("host override") ?? note(node.name, "override") ?? degr(setName, "override")?.message);
      const tar = n.targetAspectRatio as { x?: number; y?: number } | undefined;
      if (tar) classify(path, "targetAspectRatio", `${tar.x}:${tar.y}`, null, note("aspect-ratio lock"), true);
      if (n.visible === false)
        classify(path, "visible=false", "hidden",
          contractText.includes('"visibleWhen"') || pj.includes('"visibleWhen"') ? "boolean default / visibleWhen" : null,
          note(node.name, "hidden") ?? note("visib"));
      return; // internals belong to the child contract
    }

    // paints
    const fills = ((n.fills ?? []) as Array<Record<string, unknown>>).filter((f) => f.visible !== false);
    if (fills.length > 0) {
      const t = String(fills[0].type ?? "");
      const colorChannels = node.type === "TEXT" ? ["color"] : ["background-color", "background", "fill"];
      if (t === "SOLID") {
        classify(path, "fills[0] SOLID", fills[0].color,
          partCarries(part, colorChannels) ? `part "${part!.name}" ${partCarries(part, colorChannels)} token/literal → CSS var` : null,
          note(isRoot ? "root fill" : node.name) ?? note("UNBOUND", "fill") ?? note("fill"));
      } else if (t.startsWith("GRADIENT")) {
        classify(path, `fills[0] ${t}`, "gradient",
          pj.includes("gradient") || contractText.includes("gradient") ? "gradient background carried" : null,
          note("gradient") ?? gap("image fills"));
      } else if (t === "IMAGE") {
        classify(path, "fills[0] IMAGE", "image paint", null, gap("image fills") ?? note("image"));
      } else {
        classify(path, `fills[0] ${t}`, t, null, degr(setName, "paint")?.message ?? note("paint"));
      }
      if (fills.length > 1)
        classify(path, "fills (multi-paint stack)", `${fills.length} paints`, null,
          degr(setName, "stack")?.message ?? note("paint stack") ?? note("stacked"));
    }
    const strokes = ((n.strokes ?? []) as Array<Record<string, unknown>>).filter((s) => s.visible !== false);
    if (strokes.length > 0 && node.type !== "VECTOR" && node.type !== "LINE") {
      const w = n.individualStrokeWeights as { top: number; right: number; bottom: number; left: number } | undefined;
      const nonUniform = w && new Set([w.top, w.right, w.bottom, w.left]).size > 1;
      if (nonUniform) {
        classify(path, "individualStrokeWeights (per-side stroke)", JSON.stringify(w), 
          partCarries(part, ["border-top-width", "border-bottom-width", "border-left-width", "border-right-width"])
            ? `part "${part!.name}" per-side border-* channels`
            : null,
          degr(setName, "per-side")?.message ?? degr(setName, "stroke-weights")?.message ?? note("per-side"));
      } else {
        classify(path, "strokes[0] + strokeWeight", `${String(n.strokeWeight)}px`,
          partCarries(part, ["border-color", "border-width", "border-top-color", "outline-color"])
            ? `part "${part!.name}" border/outline channels → CSS vars`
            : null,
          note("stroke") ?? note("outline"));
      }
      const align = n.strokeAlign as string | undefined;
      if (align && align !== "INSIDE")
        classify(path, "strokeAlign", align,
          partCarries(part, ["outline-color", "outline-width", "outline-offset"]) ? "outline-* channels (OUTSIDE stroke inverted to outline)" : null,
          gap("strokeAlign") ?? note("strokeAlign"));
      const dashes = n.strokeDashes as number[] | undefined;
      if (Array.isArray(dashes) && dashes.length > 0)
        classify(path, "strokeDashes", JSON.stringify(dashes),
          partCarries(part, ["border-style"]) ? "border-style: dashed" : null,
          degr(setName, "dash")?.message ?? note("dash"));
    }
    // effects
    const effects = ((n.effects ?? []) as Array<Record<string, unknown>>).filter((e) => e.visible !== false);
    if (effects.length > 0) {
      const types = effects.map((e) => String(e.type));
      const onlyShadow = types.every((t) => t === "DROP_SHADOW" || t === "INNER_SHADOW");
      classify(path, "effects", types.join(","),
        onlyShadow && (partCarries(part, ["box-shadow"]) || contractText.includes("box-shadow")) ? "box-shadow token/literal" : null,
        note("effect") ?? note("box-shadow"));
      const styleRef = (n.styles as Record<string, string> | undefined)?.effect;
      if (styleRef)
        classify(path, "styles.effect (effect STYLE identity)", styleRef, null,
          note("EFFECT STYLE") ?? degr(setName, "effect style")?.message);
    }
    // geometry / corners / opacity
    const cr = n.cornerRadius as number | undefined;
    if (typeof cr === "number" && cr > 0)
      classify(path, "cornerRadius", cr,
        partCarries(part, ["border-radius"]) ? `part "${part?.name ?? "root"}" border-radius` : null,
        note("radius"));
    const rcr = n.rectangleCornerRadii as number[] | undefined;
    if (Array.isArray(rcr) && new Set(rcr).size > 1)
      classify(path, "rectangleCornerRadii (per-corner)", JSON.stringify(rcr),
        partCarries(part, ["border-top-left-radius", "border-start-start-radius"]) ? "per-corner radius channels" : null,
        degr(setName, "radii")?.message ?? note("radii"));
    const op = n.opacity as number | undefined;
    if (typeof op === "number" && op < 1)
      classify(path, "opacity", op,
        partCarries(part, ["opacity"]) || contractText.includes('"opacity"') ? "opacity token/literal (or disabled state plane)" : null,
        note("opacity"));
    if (n.blendMode && !["PASS_THROUGH", "NORMAL"].includes(String(n.blendMode)))
      classify(path, "blendMode", n.blendMode, null, degr(setName, "blend")?.message ?? note("blend"));
    if (n.visible === false)
      classify(path, "visible=false", "hidden",
        pj.includes('"visibleWhen"') || contractText.includes('"visibleWhen"') ? "visibleWhen / boolean default" : null,
        note("hidden"));
    if (n.clipsContent === true && ["FRAME", "COMPONENT", "SLOT"].includes(node.type))
      classify(path, "clipsContent", true,
        partCarries(part, ["overflow"]) ? "overflow: hidden" : null,
        note("clipsContent") ?? note("overflow"));

    // auto-layout
    const lm = n.layoutMode as string | undefined;
    if (lm && lm !== "NONE" && lm !== "GRID") {
      const tuple = `${lm} ${String(n.primaryAxisAlignItems ?? "MIN")}/${String(n.counterAxisAlignItems ?? "MIN")} p=[${String(n.paddingTop ?? 0)},${String(n.paddingRight ?? 0)},${String(n.paddingBottom ?? 0)},${String(n.paddingLeft ?? 0)}] gap=${String(n.itemSpacing ?? 0)}`;
      const layoutCarried =
        (part && (pj.includes('"layout"') || pj.includes("padding") || pj.includes('"gap"'))) ||
        (isRoot && (contractText.includes('"layout"') || contractText.includes("padding")));
      classify(path, "auto-layout (mode/align/padding/gap)", tuple,
        layoutCarried ? `part "${part?.name ?? "root"}" layout block + padding/gap channels (row/column defaults elide)` : "layout at the emit default (row/center/center) — elides by the generator's own rule",
        note("layout"));
      if (n.layoutWrap === "WRAP")
        classify(path, "layoutWrap", "WRAP", pj.includes('"wrap"') ? "layout.wrap" : null, gap("wrap") ?? note("wrap"));
      if (n.itemReverseZIndex === true)
        classify(path, "itemReverseZIndex", true, null, note("itemReverseZIndex"), true);
    }
    if (lm === "GRID") {
      classify(path, "grid layout (tracks/gaps/flow)", `${String(n.gridColumnCount)}×${String(n.gridRowCount)}`,
        pj.includes('"grid"') || contractText.includes('"grid"') ? "layout.grid (declared tracks + per-child cells)" : null,
        degr(setName, "grid")?.message ?? note("grid"));
    }
    const cellAnchored = typeof n.gridRowAnchorIndex === "number" || typeof n.gridColumnAnchorIndex === "number";
    if (!isRoot && cellAnchored && parent && (parent as Record<string, unknown>).layoutMode === "GRID")
      classify(path, "grid cell (anchor/span/align)", `r${String(n.gridRowAnchorIndex ?? 0)}c${String(n.gridColumnAnchorIndex ?? 0)}`,
        pj.includes('"placement"') || contractText.includes('"areas"')
          ? `part "${part?.name ?? node.name}" placement (row/column/span/align) / layout.areas`
          : null,
        note("cell"));

    // sizing
    const lsh = n.layoutSizingHorizontal as string | undefined;
    const lsv = n.layoutSizingVertical as string | undefined;
    if (isRoot) {
      if (lsh)
        classify(path, "root layoutSizingHorizontal", lsh,
          lsh === "HUG"
            ? (contractText.includes("fit-content") ? "root literals width: fit-content" : null)
            : contractText.includes('"width"') || contractText.includes("max-width")
              ? "root width/max-width minted from the drawn box"
              : null,
          note("width") ?? note("HUG"));
      if (lsv)
        classify(path, "root layoutSizingVertical", lsv,
          lsv === "HUG"
            ? (contractText.includes("fit-content") ? "root literals height: fit-content" : null)
            : contractText.includes('"height"') || contractText.includes("min-height")
              ? "root height/min-height minted from the drawn box"
              : null,
          note("height"));
    } else {
      if (lsh === "FILL")
        classify(path, "layoutSizingHorizontal=FILL", "FILL",
          pj.includes('"grow"') || pj.includes("100%") || contractText.includes("stretch") ? "layout.grow / align stretch" : null,
          note(node.name, "FILL") ?? note("fillWidth"));
      if (lsv === "FILL")
        classify(path, "layoutSizingVertical=FILL", "FILL",
          pj.includes('"grow"') || pj.includes("100%") ? "height: 100% / layout.grow on the filling part" : null,
          note("fillHeight") ?? note(node.name, "FILL"));
      const bbox = n.absoluteBoundingBox as { width?: number; height?: number } | undefined;
      if (lsh === "FIXED" && node.type !== "TEXT" && n.layoutPositioning !== "ABSOLUTE")
        classify(path, "layoutSizingHorizontal=FIXED (child)", `${Math.round(bbox?.width ?? 0)}px`,
          partCarries(part, ["width", "max-width", "min-width"]) || pj.includes('"shape"') ? `part "${part?.name ?? node.name}" width channel / shape box` : null,
          note("FC-GEOMETRY-EXCLUDED") ?? note(node.name, "FIXED") ?? note("fixed") ?? gap("fixed sizes"));
      if (lsv === "FIXED" && node.type !== "TEXT" && n.layoutPositioning !== "ABSOLUTE")
        classify(path, "layoutSizingVertical=FIXED (child)", `${Math.round(bbox?.height ?? 0)}px`,
          partCarries(part, ["height", "min-height"]) || pj.includes('"shape"') ? `part "${part?.name ?? node.name}" height channel / shape box` : null,
          note("FC-GEOMETRY-EXCLUDED") ?? note(node.name, "FIXED") ?? note("fixed") ?? gap("fixed sizes"));
    }
    for (const dim of ["minWidth", "minHeight", "maxWidth", "maxHeight"] as const) {
      const v = n[dim] as number | undefined;
      if (typeof v === "number" && v > 0) {
        const css = dim.replace(/([A-Z])/g, "-$1").toLowerCase();
        classify(path, dim, v,
          partCarries(part, [css]) || contractText.includes(`"${css}"`) ? `${css} channel` : null,
          note(dim) ?? note(css));
      }
    }
    if (n.layoutPositioning === "ABSOLUTE")
      classify(path, "layoutPositioning=ABSOLUTE", "out of flow",
        partCarries(part, ["outline-color", "outline-offset"]) ? "focus-ring inversion (outline-*)" : null,
        gap("absolute placement") ?? note("ABSOLUTE"));

    // prototype wiring
    const interactions = (n.interactions ?? []) as Array<Record<string, unknown>>;
    if (interactions.length > 0)
      classify(path, "interactions (prototype reactions)", `${interactions.length} reaction(s)`,
        null, note("prototype reaction") ?? degr(setName, "reaction")?.message ?? note("reactions"));

    // shapes / vectors
    if (["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "POLYGON"].includes(node.type)) {
      classify(path, "vector geometry", node.type, null,
        degr(setName, "vector")?.message ?? note("vector") ?? gap("vector"));
      return;
    }
    if (node.type === "ELLIPSE" || node.type === "RECTANGLE") {
      classify(path, `${node.type} decor`, node.name,
        pj.includes('"shape"') || partCarries(part, ["background-color"]) ? `shape part "${part?.name ?? node.name}"` : null,
        note(node.name));
    }

    if (node.type === "SLOT") {
      classify(path, "SLOT node (native insertion point)", node.name,
        contractText.includes('"slot"') ? `slot part "${node.name}"` : null, note("slot"));
      for (const c of node.children ?? []) {
        classify(`${path}/${c.name}`, `SLOT child ${c.type} (design-time content)`, c.name,
          c.type === "INSTANCE" && contractText.includes('"defaultContent"') ? "slot.defaultContent" : null,
          note("design-time content") ?? note(c.name));
      }
      return;
    }

    if (node.type === "TEXT") {
      const s = (n.style ?? {}) as Record<string, unknown>;
      classify(path, "text.characters", n.characters,
        pj.includes('"content"') || contractText.includes(short(n.characters))
          ? "TEXT prop default / static part text → React children"
          : null,
        note("characters") ?? note("text"));
      classify(path, "text font size/weight", `${String(s.fontSize)}/${String(s.fontWeight)}`,
        partCarries(part, ["font-size", "font-weight"]) || contractText.includes("font-size") ? "font-size/font-weight tokens → CSS vars" : null,
        note("font"));
      const fam = s.fontFamily as string | undefined;
      if (fam)
        classify(path, "text fontFamily", fam,
          fam === "Inter" ? "Inter is the pipeline's own default face (nothing to declare)" : partCarries(part, ["font-family"]) ? "declared font-family" : null,
          note("font family") ?? note("fontFamily"));
      const lhUnit = s.lineHeightUnit as string | undefined;
      classify(path, "text lineHeight", `${String(s.lineHeightPx)}px (${String(lhUnit)})`,
        lhUnit === "PIXELS" && (partCarries(part, ["line-height"]) || contractText.includes("line-height")) ? "line-height token/literal" : null,
        degr(setName, "lineHeight")?.message ?? degr(setName, "line height")?.message ?? note("line-height") ?? degr(setName, "text-channel")?.message);
      const ls = s.letterSpacing as number | undefined;
      if (ls) classify(path, "text letterSpacing", ls,
        partCarries(part, ["letter-spacing"]) ? "letter-spacing" : null,
        degr(setName, "letterSpacing")?.message ?? note("letter"));
      const tc = s.textCase as string | undefined;
      if (tc && tc !== "ORIGINAL")
        classify(path, "text textCase", tc,
          partCarries(part, ["text-transform"]) ? "text-transform" : null, note("textCase") ?? degr(setName, "textCase")?.message);
      const td = s.textDecoration as string | undefined;
      if (td && td !== "NONE")
        classify(path, "text textDecoration", td,
          partCarries(part, ["text-decoration"]) ? "text-decoration" : null, note("decoration") ?? degr(setName, "textDecoration")?.message);
      const ta = s.textAlignHorizontal as string | undefined;
      if (ta && ta !== "LEFT")
        classify(path, "text textAlignHorizontal", ta,
          partCarries(part, ["text-align"]) ? "declared text-align" : null, note("text-align") ?? note("textAlign"));
      const tr = s.textAutoResize as string | undefined;
      if (tr && tr !== "WIDTH_AND_HEIGHT" && lsh !== "FILL")
        classify(path, "text textAutoResize (fixed-box text)", tr,
          partCarries(part, ["width"]) ? "width channel on the text part" : null,
          note("textAutoResize") ?? gap("fixed sizes"));
      const tt = s.textTruncation as string | undefined;
      if (tt && tt !== "DISABLED")
        classify(path, "text textTruncation", `${tt} maxLines=${String(s.maxLines)}`,
          partCarries(part, ["text-overflow", "-webkit-line-clamp"]) ? "truncation channels" : null,
          note("truncation") ?? degr(setName, "truncation")?.message);
      const cso = n.characterStyleOverrides as number[] | undefined;
      if (Array.isArray(cso) && cso.length > 0)
        classify(path, "text characterStyleOverrides (mixed styling)", `${cso.length} chars`, null,
          degr(setName, "character ranges")?.message ?? degr(setName, "textStyleOverride")?.message ?? note("mixed") ?? degr(setName, "override")?.message);
      const styleId = (n.styles as Record<string, string> | undefined)?.text;
      if (styleId)
        classify(path, "styles.text (TextStyle identity)", styleId,
          partCarries(part, ["font-size"]) || contractText.includes("font.") ? "text style identity → font token family" : null,
          degr(setName, "text style")?.message ?? note("style"));
      const textStamps = (n.sharedPluginData as Record<string, Record<string, string>> | undefined)?.ds_contracts ?? {};
      for (const key of ["fontWeightVar", "lineHeightVar"]) {
        const v = textStamps[key];
        if (!v) continue;
        const ref = `{${v.replace(/\//g, ".")}}`;
        // The contract may spell the ref SUBSTITUTED — the axis-value segment
        // replaced by a {prop} placeholder ({imported.button.root.line-height.md}
        // ≡ {imported.button.root.line-height.{size}}). Both are the same
        // carried identity; match either spelling.
        const segs = v.split("/").map((x) => x.replace(/[.*+?^$()[\]{}|\\]/g, "\\$&"));
        const substituted = new RegExp(
          `\\{${segs.map((x) => `(?:${x}|\\{[a-z][a-zA-Z0-9]*\\})`).join("\\.")}\\}`,
        );
        const channel = key === "fontWeightVar" ? "font-weight" : "line-height";
        classify(path, `stamp ds_contracts/${key}`, v,
          contractText.includes(ref)
            ? `${channel} token ref ${ref} → CSS var`
            : substituted.test(contractText)
              ? `${channel} token ref carried substituted (axis segment → {prop} placeholder) → CSS var`
              : null,
          note(key) ?? note(v));
      }
      return;
    }

    for (const c of node.children ?? []) visit(c, `${path}/${c.name}`, false, node);
  };

  for (const v of variants) visit(v, `${setName}:${v.name}`, true, null);

  const carried = rows.filter((r) => r.disposition === "CARRIED").length;
  const named = rows.filter((r) => r.disposition === "NAMED").length;
  const silent = rows.filter((r) => r.disposition === "SILENT").length;
  return { setName, contractId, carried, named, silent, rows };
}
