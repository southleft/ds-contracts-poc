/**
 * Stage 3a of the canvas→code journey (docs/35 §5): the CANVAS-FACTS surface.
 *
 * Promotes `recipe/scene-readback.ts` output from an internal verification
 * artifact to a stable, documented product shape. A canvas-facts document is
 * derived from ONE committed scene observe (a `SceneNodeSnapshot` tree read
 * back from a live Figma page) with ZERO forward-direction inputs: ownership
 * keys are assigned structurally (`root`, `root/children/N`, …), never from a
 * compile plan, so the document states only what the canvas itself shows.
 *
 * The fact vocabulary is scene-readback's own projection
 * (`sceneToNormalizedIr` → `compileExpectedScenePlan`), which is what the
 * inversion gates already prove lossless against live observes — this module
 * adds no new fact channel and invents no value. Live variable names that
 * carry a hex-encoded token identity (`token/<type>/id-<hex>`, the v4 writer's
 * encoding) are DECODED alongside the live spelling; a name that does not
 * decode stays `tokenIdentity: null` — named, never guessed.
 *
 * Shape documentation: recipe/canvas-facts-shape.md (kept in lockstep — the
 * canvas-to-code gate hashes both).
 */
import { createHash } from "node:crypto";

import { decodeButtonHexTokenName } from "./button-scene-inversion.js";
import {
  compileExpectedScenePlan,
  sceneToNormalizedIr,
  type SceneFact,
  type SceneNodeSnapshot,
  type SceneNodeType,
} from "./scene-readback.js";

export const CANVAS_FACTS_VERSION = "canvas-facts-v1";

export interface CanvasFactsSource {
  /** Repo-relative path of the committed observe artifact. */
  observePath: string;
  /** sha256 of the observe artifact bytes (the .json.gz file as committed). */
  observeSha256: string;
}

/** Node hierarchy + roles — the structural skeleton without style channels. */
export interface CanvasFactsNode {
  ownershipKey: string;
  type: SceneNodeType;
  name: string;
  /** Semantic role when the canvas carries one (`semanticRole`, or the
   *  `role :: label` name convention). */
  role?: string;
  /** Variant tuple for COMPONENT children of a COMPONENT_SET. */
  variantProperties?: Record<string, string>;
  children: CanvasFactsNode[];
}

/** One live variable name observed in a binding, with its decoded token
 *  identity when the name carries one. */
export interface CanvasTokenIdentity {
  /** The live variable name exactly as the canvas spells it. */
  variableName: string;
  /** Decoded dot-path identity (`imported.shared.size-8`) or null when the
   *  live name does not carry the hex encoding — named, never guessed. */
  tokenIdentity: string | null;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  /** How many binding sites observe this variable. */
  bindingSites: number;
}

export interface CanvasFactsDocument {
  version: typeof CANVAS_FACTS_VERSION;
  source: CanvasFactsSource;
  /** The observe tree with STRUCTURAL ownership keys assigned (root,
   *  root/children/N, …). Every other value is the observe verbatim. */
  scene: SceneNodeSnapshot;
  /** Node hierarchy + roles (see CanvasFactsNode). */
  hierarchy: CanvasFactsNode;
  /** The full fact projection: geometry, fills/strokes/effects, text +
   *  typography, bound variables, component-set axes/variants, hierarchy
   *  channels. Same ids/channels as scene-readback's expected-plan facts. */
  facts: SceneFact[];
  /** Every distinct bound-variable name, with decoded identities. */
  tokenIdentities: CanvasTokenIdentity[];
  /** Named binding-spelling folds applied before projection — never silent. */
  normalizations: CanvasBindingNormalization[];
  counts: {
    nodes: number;
    facts: number;
    byChannel: Record<string, number>;
  };
}

/** One named binding normalization applied before IR projection — the Figma
 *  API spells some facts twice (paint alias bindings) or per-side (stroke
 *  weights); folding them is mechanical, and every fold is recorded here so
 *  the document never absorbs a spelling silently. */
export interface CanvasBindingNormalization {
  ownershipKey: string;
  kind:
    | "paint-alias-duplicate-dropped"
    | "uniform-stroke-side-weights-collapsed"
    | "nonuniform-stroke-side-weights-receipted"
    | "partial-stroke-side-weights-receipted";
  detail: string;
}

export const sha256OfBytes = (bytes: Uint8Array | string): string =>
  createHash("sha256").update(bytes).digest("hex");

/** Assign canvas-only structural ownership keys. The observe artifacts store
 *  `ownershipKey: "pending"` (live readback assigns keys from the compile
 *  plan; the canvas-facts surface must not) — keys here are derived from the
 *  tree shape alone, the same `root/children/N` grammar the expected-plan
 *  compiler uses. Pure: returns a structured clone. */
export function assignStructuralOwnershipKeys(
  scene: SceneNodeSnapshot,
): SceneNodeSnapshot {
  const clone = structuredClone(scene);
  const visit = (node: SceneNodeSnapshot, key: string): void => {
    node.ownershipKey = key;
    node.children.forEach((child, index) =>
      visit(child, `${key}/children/${index}`),
    );
  };
  visit(clone, "root");
  return clone;
}

const STROKE_SIDE_FIELDS = [
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
] as const;

/** Fold Figma-API binding spellings the IR vocabulary does not carry, each
 *  fold NAMED. (1) A paint alias binding (`fills.0` beside `fills.0.color`,
 *  same variable — the API reports both) drops the alias. (2) Four per-side
 *  stroke weights binding ONE variable collapse to `strokes.0.weight`.
 *  (3) Per-side weights binding DIFFERENT variables cannot collapse — the
 *  bindings are removed from the IR projection and RECEIPTED by name (the
 *  ledger downstream must carry them; nothing is invented). */
export function normalizeSceneBindings(scene: SceneNodeSnapshot): {
  scene: SceneNodeSnapshot;
  normalizations: CanvasBindingNormalization[];
} {
  const clone = structuredClone(scene);
  const normalizations: CanvasBindingNormalization[] = [];
  const visit = (node: SceneNodeSnapshot): void => {
    let bindings = node.boundVariables ?? [];
    const withoutAliases = bindings.filter((binding) => {
      const alias = binding.field.match(/^fills\.(\d+)$/)
        ? `fills.${binding.field.split(".")[1]}.color`
        : binding.field.match(/^strokes\.(\d+)$/)
          ? `strokes.${binding.field.split(".")[1]}.paint.color`
          : binding.field.match(/^effects\.(\d+)$/)
            ? `effects.${binding.field.split(".")[1]}.color`
            : undefined;
      if (alias === undefined) return true;
      const duplicate = bindings.some(
        (other) =>
          other !== binding &&
          other.field === alias &&
          other.variableName === binding.variableName &&
          other.resolvedType === binding.resolvedType,
      );
      if (duplicate) {
        normalizations.push({
          ownershipKey: node.ownershipKey,
          kind: "paint-alias-duplicate-dropped",
          detail: `${binding.field} duplicates ${alias} (${binding.variableName})`,
        });
      }
      return !duplicate;
    });
    bindings = withoutAliases;
    const sides = STROKE_SIDE_FIELDS.map((field) =>
      bindings.find(
        (binding) =>
          binding.field === field && binding.resolvedType === "FLOAT",
      ),
    );
    if (sides.every((binding) => binding !== undefined)) {
      const names = sides.map((binding) => binding!.variableName);
      const uniform = names.every((name) => name === names[0]);
      bindings = bindings.filter(
        (binding) =>
          !STROKE_SIDE_FIELDS.includes(
            binding.field as (typeof STROKE_SIDE_FIELDS)[number],
          ),
      );
      if (uniform) {
        const hasWeight = bindings.some(
          (binding) =>
            binding.field === "strokes.0.weight" ||
            binding.field === "strokeWeight",
        );
        if (!hasWeight) {
          bindings = [
            ...bindings,
            {
              field: "strokes.0.weight",
              variableName: names[0]!,
              resolvedType: "FLOAT",
            },
          ];
        }
        normalizations.push({
          ownershipKey: node.ownershipKey,
          kind: "uniform-stroke-side-weights-collapsed",
          detail: `strokeTop/Right/Bottom/LeftWeight all bind ${names[0]} → strokes.0.weight`,
        });
      } else {
        normalizations.push({
          ownershipKey: node.ownershipKey,
          kind: "nonuniform-stroke-side-weights-receipted",
          detail: `per-side stroke weights bind distinct variables (${names.join(", ")}) — no IR spelling; RECEIPT, nothing invented`,
        });
      }
    }
    // Leftover side-weight fields (e.g. only strokeBottomWeight on a header
    // divider) have no IR spelling either — RECEIPT and drop, never throw.
    const leftoverSides = bindings.filter((binding) =>
      STROKE_SIDE_FIELDS.includes(
        binding.field as (typeof STROKE_SIDE_FIELDS)[number],
      ),
    );
    if (leftoverSides.length > 0) {
      bindings = bindings.filter(
        (binding) =>
          !STROKE_SIDE_FIELDS.includes(
            binding.field as (typeof STROKE_SIDE_FIELDS)[number],
          ),
      );
      normalizations.push({
        ownershipKey: node.ownershipKey,
        kind: "partial-stroke-side-weights-receipted",
        detail: `partial stroke side weight(s) ${leftoverSides
          .map((binding) => `${binding.field}=${binding.variableName}`)
          .join(", ")} — no IR spelling; RECEIPT, nothing invented`,
      });
    }
    node.boundVariables = bindings;
    for (const child of node.children) visit(child);
  };
  visit(clone);
  return { scene: clone, normalizations };
}

const nodeCount = (scene: SceneNodeSnapshot): number =>
  1 + scene.children.reduce((sum, child) => sum + nodeCount(child), 0);

const hierarchyOf = (scene: SceneNodeSnapshot): CanvasFactsNode => ({
  ownershipKey: scene.ownershipKey,
  type: scene.type,
  name: scene.name,
  ...(scene.semanticRole === undefined ? {} : { role: scene.semanticRole }),
  ...(scene.variantProperties === undefined
    ? {}
    : { variantProperties: { ...scene.variantProperties } }),
  children: scene.children.map(hierarchyOf),
});

/** Project observed facts from a keyed scene: normalize to IR, compile the
 *  fact plan, then restore the OBSERVED name/role/visible/opacity values
 *  (the plan compiler recomputes names from variant tuples; the observed
 *  spelling is the canvas fact). Mirrors scene-readback's own observation
 *  path, which compareSceneToExpectedPlan uses internally. */
export function projectCanvasFacts(scene: SceneNodeSnapshot): SceneFact[] {
  const normalized = sceneToNormalizedIr(scene);
  const byOwnership = new Map<string, SceneNodeSnapshot>();
  const index = (node: SceneNodeSnapshot): void => {
    if (byOwnership.has(node.ownershipKey))
      throw new TypeError(
        `canvas-facts: duplicate ownership key ${node.ownershipKey}`,
      );
    byOwnership.set(node.ownershipKey, node);
    for (const child of node.children) index(child);
  };
  index(scene);
  const projected = compileExpectedScenePlan(normalized, {
    instancePayload: (_node, ownershipKey) =>
      byOwnership.get(ownershipKey)?.instancePayload,
  });
  const sceneRole = (node: SceneNodeSnapshot): string | undefined =>
    node.semanticRole ??
    (node.name.includes("/") && !node.name.includes("=")
      ? node.name.split(" :: ", 1)[0]
      : undefined);
  return projected.facts.map((fact) => {
    const node = byOwnership.get(fact.nodeOwnershipKey);
    if (!node)
      throw new TypeError(
        `canvas-facts: projection lost ${fact.nodeOwnershipKey}`,
      );
    if (fact.channel === "name") return { ...fact, value: node.name };
    if (fact.channel === "role") return { ...fact, value: sceneRole(node) };
    if (fact.channel === "visible") return { ...fact, value: node.visible };
    if (fact.channel === "opacity") return { ...fact, value: node.opacity };
    return fact;
  });
}

/** Collect every distinct bound-variable name with its decoded identity. */
export function collectTokenIdentities(
  scene: SceneNodeSnapshot,
): CanvasTokenIdentity[] {
  const byName = new Map<string, CanvasTokenIdentity>();
  const visit = (node: SceneNodeSnapshot): void => {
    for (const binding of node.boundVariables ?? []) {
      const existing = byName.get(binding.variableName);
      if (existing) {
        existing.bindingSites += 1;
        continue;
      }
      byName.set(binding.variableName, {
        variableName: binding.variableName,
        tokenIdentity: decodeButtonHexTokenName(binding.variableName) ?? null,
        resolvedType: binding.resolvedType,
        bindingSites: 1,
      });
    }
    for (const child of node.children) visit(child);
  };
  visit(scene);
  return [...byName.values()].sort((a, b) =>
    a.variableName.localeCompare(b.variableName),
  );
}

/** Derive the canvas-facts document from a raw observe tree. */
export function deriveCanvasFacts(
  raw: SceneNodeSnapshot,
  source: CanvasFactsSource,
): CanvasFactsDocument {
  const keyed = assignStructuralOwnershipKeys(raw);
  const { scene, normalizations } = normalizeSceneBindings(keyed);
  const facts = projectCanvasFacts(scene);
  const byChannel: Record<string, number> = {};
  for (const fact of facts)
    byChannel[fact.channel] = (byChannel[fact.channel] ?? 0) + 1;
  return {
    version: CANVAS_FACTS_VERSION,
    source,
    scene,
    hierarchy: hierarchyOf(scene),
    facts,
    tokenIdentities: collectTokenIdentities(scene),
    normalizations,
    counts: {
      nodes: nodeCount(scene),
      facts: facts.length,
      byChannel: Object.fromEntries(
        Object.entries(byChannel).sort(([a], [b]) => a.localeCompare(b)),
      ),
    },
  };
}
