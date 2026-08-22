/**
 * EMIT-SPEC DISTILLATION — the few facts of an emitted Figma script that the
 * canvas-drift probe compares against the live cell.
 *
 * Shared by scripts/console-loop-canvas-drift-probe.mjs (which reads them) and
 * scripts/console-loop-canvas-drift-mint-specs.mjs (which writes them to the
 * committed receipt canvas-drift/EMIT-SPECS.json for the first-party lane,
 * whose wave-numbered scripts under parity/receipts/console-loop/emitted/ are
 * gitignored rebuild targets and therefore NOT a committed input).
 *
 * Pure functions over script SOURCE TEXT — no filesystem, no Figma.
 */
import { createHash } from "node:crypto";

/** The emitted script's `const COMPONENTS = [...]` payload is plain JSON. */
export function readComponents(src) {
  const marker = "const COMPONENTS = ";
  const i = src.indexOf(marker);
  if (i < 0) return null;
  const j = src.indexOf("\n];", i);
  if (j < 0) return null;
  try {
    return JSON.parse(src.slice(i + marker.length, j + 2));
  } catch {
    return null;
  }
}

/** Every variable collection the script creates. A lane owns exactly these. */
export function collectionsCreatedBy(src) {
  return [...src.matchAll(/createVariableCollection\('([^']+)'\)/g)].map((m) => m[1]);
}

/** Every fontFamily the spec declares, anywhere in the tree. A CSS stack is
 *  split on commas and unquoted, so `"IBM Plex Sans", system-ui` matches a node
 *  drawing IBM Plex Sans. */
export function specFontFamilies(spec) {
  const out = new Set();
  const walk = (x) => {
    if (!x || typeof x !== "object") return;
    if (Array.isArray(x)) return x.forEach(walk);
    if (x.fontFamily) {
      for (const part of String(x.fontFamily).split(",")) {
        const name = part.trim().replace(/^['"]|['"]$/g, "");
        if (name) out.add(name);
      }
    }
    for (const k of Object.keys(x)) walk(x[k]);
  };
  walk(spec);
  return out;
}

/** One variant, reduced to what the probe reads: its name, its bindings, its
 *  fixed width/height, and the font families it declares. Nothing else in the
 *  spec is compared, so nothing else is carried. */
export function distillVariant(v) {
  const spec = v?.spec ?? {};
  const fixed = (f) => (f && typeof f.px === "number" ? { px: f.px, varName: f.varName ?? null } : null);
  return {
    name: String(v?.name ?? ""),
    bindings: { ...(spec.bindings ?? {}) },
    fixedWidth: fixed(spec.fixedWidth),
    fixedHeight: fixed(spec.fixedHeight),
    fontFamilies: [...specFontFamilies(spec)].sort(),
  };
}

/** The whole script, distilled. `null` when the COMPONENTS payload is absent or
 *  unparseable (the probe reports UNPARSEABLE-SCRIPT for that). */
export function distillScript(src) {
  const components = readComponents(src);
  const component = components && components[0];
  if (!component) return null;
  return {
    collections: collectionsCreatedBy(src),
    variants: (component.variants ?? []).map(distillVariant),
    stateVariants: (component.stateVariants ?? []).map(distillVariant),
  };
}

export function sha256(src) {
  return createHash("sha256").update(src).digest("hex");
}

/** The gitignored rebuild target (see .gitignore: "regenerate with npm run
 *  console-loop:emit"). Anything the probe would read from under here is a
 *  machine-local fact, never a committed one. */
export const EMITTED_DIR = "parity/receipts/console-loop/emitted/";
