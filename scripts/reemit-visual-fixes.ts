/**
 * One-shot re-emit of stems fixed for visual-match work.
 * Uses the workspace core/emit-figma-script (not a stale packaged CLI build).
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ContractSchema, sortByDependencies, type Contract } from "./contract-schema.js";
import { createFigmaEngine } from "../core/emit-figma-script.js";

function loadJson(p: string) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function loadIcons(exampleDir: string): Map<string, string> {
  const iconsDir = path.join(exampleDir, "assets", "icons");
  const icons = new Map<string, string>();
  if (!existsSync(iconsDir)) return icons;
  for (const f of readdirSync(iconsDir)) {
    if (!f.endsWith(".svg")) continue;
    icons.set(f.replace(/\.svg$/, ""), readFileSync(path.join(iconsDir, f), "utf8").trim());
  }
  return icons;
}

type CanvasProjection = {
  keep: Record<string, string[] | "*">;
};

const POLARIS_CANVAS_PROJECTIONS: Record<string, CanvasProjection> = {
  "polaris.text-field": {
    keep: {
      type: ["text"],
      inputMode: ["text"],
      align: ["left"],
      variant: "*",
      size: "*",
    },
  },
};

function projectForCanvas(contract: Contract): Contract {
  const projection = POLARIS_CANVAS_PROJECTIONS[contract.id];
  if (!projection) return contract;
  const clone = structuredClone(contract);
  const keptByProp = new Map<string, Set<string>>();
  for (const p of clone.props) {
    if (typeof p.type !== "object" || !("enum" in p.type)) continue;
    const keep = projection.keep[p.name];
    if (!keep || keep === "*") continue;
    const kept = [...keep];
    if (p.default !== undefined && !kept.includes(String(p.default))) {
      kept.unshift(String(p.default));
    }
    p.type.enum = p.type.enum.filter((v: string) => kept.includes(v));
    if (p.type.enum.length === 0) {
      throw new Error(`${contract.id}: canvas projection empties enum "${p.name}"`);
    }
    keptByProp.set(p.name, new Set(p.type.enum));
    if (p.bindings.figma.values) {
      p.bindings.figma.values = Object.fromEntries(
        Object.entries(p.bindings.figma.values).filter(([k]) =>
          keptByProp.get(p.name)!.has(k),
        ),
      );
    }
  }
  const pruneMaps = (part: Record<string, unknown>) => {
    for (const field of ["tokensByProp", "literalsByProp", "layoutByProp"] as const) {
      const entries = part[field];
      if (!Array.isArray(entries)) continue;
      for (const e of entries as Array<{ prop: string; map: Record<string, unknown> }>) {
        const kept = keptByProp.get(e.prop);
        if (!kept) continue;
        e.map = Object.fromEntries(Object.entries(e.map).filter(([k]) => kept.has(k)));
      }
    }
    for (const child of Object.values((part.parts as Record<string, Record<string, unknown>>) ?? {})) {
      pruneMaps(child);
    }
  };
  pruneMaps(clone.anatomy.root as unknown as Record<string, unknown>);
  return ContractSchema.parse(clone);
}

function emitLib(opts: {
  contractsDir: string;
  outDir: string;
  tokenFiles: string[];
  only: string[];
  exampleDir?: string;
  variableCollection?: string;
}) {
  const [base, minted] = opts.tokenFiles;
  const exampleDir =
    opts.exampleDir ?? path.dirname(opts.contractsDir);
  const engine = createFigmaEngine({
    tokens: {
      primitives: loadJson(base),
      semantic: minted ? loadJson(minted) : {},
      light: {},
      dark: {},
      brands: { default: {} },
    },
    icons: loadIcons(exampleDir),
    variableCollection: opts.variableCollection,
  });
  const files = readdirSync(opts.contractsDir).filter((f) =>
    f.endsWith(".contract.json"),
  );
  const contracts = files.map((f) =>
    ContractSchema.parse(loadJson(path.join(opts.contractsDir, f))),
  );
  const byId = new Map(contracts.map((c) => [c.id, c]));
  mkdirSync(opts.outDir, { recursive: true });
  for (const c of sortByDependencies(contracts)) {
    if (c.bindings.figma.representation === "native") continue;
    // Prefer human file stem (ToggleSwitch → toggle-switch) over id tail
    // (flowbite.toggleswitch → toggleswitch) so examples/*/figma names match.
    const nameStem = c.name
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/\s+/g, "-")
      .toLowerCase();
    const idStem = c.id.split(".").slice(1).join("-");
    const stem = opts.only.includes(nameStem)
      ? nameStem
      : opts.only.includes(idStem)
        ? idStem
        : null;
    if (!stem) continue;
    const outName = `${stem}.figma.js`;
    const canvasContract = projectForCanvas(c);
    const script = engine.buildComponentScript(canvasContract, byId, undefined);
    writeFileSync(path.join(opts.outDir, outName), script);
    console.log(
      "wrote",
      path.join(opts.outDir, outName),
      "lineHeightObj=",
      /"lineHeight":\s*\{/.test(script),
      "showFalse=",
      /BOOLEAN', false/.test(script),
      "fwGuard=",
      /fw != null/.test(script),
    );
  }
}

emitLib({
  contractsDir: "examples/astryx/contracts",
  outDir: "examples/astryx/figma",
  tokenFiles: [
    "examples/astryx/tokens/astryx-docs.dtcg.json",
    "examples/astryx/tokens/astryx-minted.dtcg.json",
  ],
  only: [
    "progress-bar",
    "toast",
    "slider",
    "switch",
    "text-input",
    "checkbox-input",
    "badge",
    "banner",
  ],
  variableCollection: "Astryx",
});

emitLib({
  contractsDir: "examples/altitude/contracts",
  outDir: "examples/altitude/figma",
  tokenFiles: [
    "examples/altitude/tokens/altitude.dtcg.json",
    "examples/altitude/tokens/altitude-minted.dtcg.json",
  ],
  only: ["badge", "chip", "button", "avatar", "divider", "heading", "icon-close", "link"],
  variableCollection: "Altitude",
});

// polaris.text-field uses CANVAS_PROJECTION (variant×size = 4 cells) — see
// examples/polaris/generate.ts CANVAS_PROJECTIONS.

emitLib({
  contractsDir: "examples/tailwind/contracts",
  outDir: "examples/tailwind/figma",
  tokenFiles: [
    "examples/tailwind/tokens/tailwind.dtcg.json",
    "examples/tailwind/tokens/tailwind-minted.dtcg.json",
  ],
  only: ["toggle-switch", "alert", "button"],
  variableCollection: "Tailwind",
});

emitLib({
  contractsDir: "examples/carbon/contracts",
  outDir: "examples/carbon/figma",
  tokenFiles: [
    "examples/carbon/tokens/carbon.dtcg.json",
    "examples/carbon/tokens/carbon-minted.dtcg.json",
  ],
  only: [
    "checkbox",
    "tabs",
    "text-input",
    "tag",
    "accordion",
    "icon-button",
    "inline-notification",
    "modal",
  ],
  variableCollection: "Carbon",
});

emitLib({
  contractsDir: "examples/polaris/contracts",
  outDir: "examples/polaris/figma",
  tokenFiles: [
    "examples/polaris/tokens/polaris-light.dtcg.json",
    "examples/polaris/tokens/polaris-minted.dtcg.json",
  ],
  only: [
    "button",
    "checkbox",
    "radio-button",
    "badge",
    "text-field",
    "progress-bar",
    "thumbnail",
    "spinner",
    "banner",
    "tag",
    "avatar",
  ],
  variableCollection: "Imported (provisional)",
});

emitLib({
  contractsDir: "examples/astryx/contracts",
  outDir: "examples/astryx/figma",
  tokenFiles: [
    "examples/astryx/tokens/astryx-docs.dtcg.json",
    "examples/astryx/tokens/astryx-minted.dtcg.json",
  ],
  only: ["switch"],
  variableCollection: "Astryx",
});
