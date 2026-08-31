import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { PNG } from "pngjs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

import { buildCssCellDoc } from "../extract/figma/catalog-visual/css-doc.js";
import {
  captureCell,
  launchGateBrowser,
  newGatePage,
  type Interaction,
} from "../extract/figma/canvas-gate/shots.js";
import {
  enumerateCorpus,
  loadLibraryWorld,
} from "../extract/figma/census/corpus.js";
import {
  chromiumExecutable,
  pinnedChromiumRevision,
} from "../extract/figma/visual-parity/render.js";
import {
  adaptReviewedButton,
  auditReviewedButtonAcquisition,
} from "./adapters/button.js";
import {
  BUTTON_COMPARISON_CELLS,
  BUTTON_COMPARISON_PROTOCOL_VERSION,
  REVIEWED_SOURCE_BUTTON_ADAPTERS,
  type ButtonComparisonCell,
  type ButtonComparisonLibrary,
} from "./button-comparison-fixture.js";
import {
  validatePinnedComparisonEvidence,
  type ComparisonOutputManifest,
  type PinnedComparisonFixture,
  type SourceReferenceProvenance,
} from "./comparison.js";
import { canonicalButtonRecipeInstance } from "./fixtures/button.js";
import {
  altitudeButtonAdapterConfig,
  fluentButtonAdapterConfig,
} from "./fixtures/library-buttons.js";
import { emitButtonOutputs } from "./output/button.js";
import { compileButtonRecipe } from "./recipes/button.js";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const V1_EVIDENCE = path.join(REPO, "recipe/evidence/button-comparison");
const EVIDENCE = path.join(REPO, "recipe/evidence/button-comparison-v2");
const NEXT = path.join(REPO, "recipe/evidence/.button-comparison-v2-next");
const CAPTURE_COMMAND = "npx tsx recipe/capture-button-comparison.ts";
const VIEWPORT = { width: 600, height: 800 };
const DPR = 2;

const sha256 = (bytes: string | Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");
const fileHash = (file: string): string => sha256(readFileSync(file));
const jsonBytes = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;
const writeJson = (file: string, value: unknown): void =>
  writeFileSync(file, jsonBytes(value));
const relative = (file: string): string =>
  path.relative(REPO, file).split(path.sep).join("/");
const slug = (key: string): string =>
  key.replaceAll("/", "__").replaceAll("=", "-");

const treeHash = (root: string): string => {
  const hash = createHash("sha256");
  const walk = (directory: string): void => {
    for (const name of readdirSync(directory).sort()) {
      const full = path.join(directory, name);
      const rel = path.relative(root, full).split(path.sep).join("/");
      const stat = lstatSync(full);
      if (stat.isDirectory()) {
        hash.update(`d\0${rel}\0`);
        walk(full);
      } else if (stat.isSymbolicLink()) {
        hash.update(`l\0${rel}\0${stat.size}\0`);
      } else {
        hash.update(`f\0${rel}\0${stat.size}\0`);
        hash.update(readFileSync(full));
      }
    }
  };
  walk(root);
  return hash.digest("hex");
};

const hashFiles = (files: string[]): string => {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(`${relative(file)}\0`);
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
};

const fontFiles = [
  "extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2",
  "extract/computed/fonts/ibm-plex-sans/IBMPlexSans-SemiBold.woff2",
  "extract/computed/fonts/inter/inter-latin-variable.woff2",
].map((file) => path.join(REPO, file));
const fontsHash = hashFiles(fontFiles);
const dataFont = (file: string): string =>
  `data:font/woff2;base64,${readFileSync(file).toString("base64")}`;
const fontCss = `
@font-face { font-family: "IBM Plex Sans"; src: url("${dataFont(fontFiles[0]!)}") format("woff2"); font-style: normal; font-weight: 400; font-display: block; }
@font-face { font-family: "IBM Plex Sans"; src: url("${dataFont(fontFiles[1]!)}") format("woff2"); font-style: normal; font-weight: 600; font-display: block; }
@font-face { font-family: "Inter"; src: url("${dataFont(fontFiles[2]!)}") format("woff2"); font-style: normal; font-weight: 100 900; font-display: block; }
`;

const frameCss = `
html { color-scheme: light; }
body { margin: 0; padding: 24px; background: #fff; color: #1e1e1e; font-family: Inter, system-ui, sans-serif; }
.gate-cell { display: flex; align-items: flex-start; width: max-content; margin: 0 0 64px 0; }
*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }
`;

const stripAtImports = (css: string): string =>
  css.replace(
    /@import\s*(?:url\((?:"[^"]*"|'[^']*'|[^)]*)\)|"[^"]*"|'[^']*')\s*;/g,
    "",
  );

interface EsbuildOutput {
  outputFiles?: Array<{ text: string }>;
}

const bundle = async (
  sandbox: string,
  source: string,
  loader: "js" | "tsx" = "js",
): Promise<string> => {
  const absolute = path.join(REPO, sandbox);
  const sandboxRequire = createRequire(path.join(absolute, "package.json"));
  const esbuild = sandboxRequire("esbuild") as {
    build(options: Record<string, unknown>): Promise<EsbuildOutput>;
  };
  const result = await esbuild.build({
    stdin: {
      contents: source,
      resolveDir: absolute,
      sourcefile: "button-reference-entry.tsx",
      loader,
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "chrome149",
    sourcemap: false,
    legalComments: "none",
  });
  const output = result.outputFiles?.[0]?.text;
  if (!output) throw new Error(`source harness bundle produced zero bytes`);
  return output;
};

const sourceBundles = {
  altitude: await bundle(
    REVIEWED_SOURCE_BUTTON_ADAPTERS.altitude.sandbox,
    `
globalThis.alAutoRegistry = true;
(async () => {
  await import("altitude-web-components");
  await customElements.whenDefined("al-button");
  const cell = globalThis.__BUTTON_CELL__;
  const button = document.createElement("al-button");
  if (cell.variant === "secondary") button.setAttribute("variant", "secondary");
  button.textContent = cell.label;
  document.querySelector("[data-cell]").appendChild(button);
  if (button.updateComplete) await button.updateComplete;
  await document.fonts.ready;
  globalThis.__BUTTON_READY__ = true;
})().catch((error) => { globalThis.__BUTTON_ERROR__ = String(error && error.stack || error); });
`,
  ),
  fluent: await bundle(
    REVIEWED_SOURCE_BUTTON_ADAPTERS.fluent.sandbox,
    `
import React from "react";
import { createRoot } from "react-dom/client";
import { Button, FluentProvider, webLightTheme } from "@fluentui/react-components";
const cell = globalThis.__BUTTON_CELL__;
const root = createRoot(document.getElementById("app"));
root.render(React.createElement(
  FluentProvider,
  { theme: webLightTheme },
  React.createElement(React.Fragment, null,
    React.createElement("button", {
      "data-sentinel": cell.key,
      "aria-label": "sentinel",
      style: { width: 8, height: 8, padding: 0, border: 0, margin: "0 0 28px 0", background: "#eee" },
    }),
    React.createElement("div", { className: "gate-cell", "data-cell": cell.key },
      React.createElement(Button, {
        appearance: cell.variant,
        size: "medium",
        shape: "rounded",
        iconPosition: "before",
      }, cell.label),
    ),
  ),
));
(async () => {
  for (let i = 0; i < 100 && !document.querySelector("[data-cell] > button"); i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  await document.fonts.ready;
  globalThis.__BUTTON_READY__ = true;
})().catch((error) => { globalThis.__BUTTON_ERROR__ = String(error && error.stack || error); });
`,
    "tsx",
  ),
};

const sourceHtml = (
  cell: ButtonComparisonCell,
  bundleSource: string,
): string => {
  const altitudeTheme =
    cell.library === "altitude"
      ? `<style id="al-theme-sheet">${stripAtImports(
          `${readFileSync(
            path.join(
              REPO,
              "examples/altitude/.altitude-sandbox/node_modules/altitude-web-components/dist/css/main.css",
            ),
            "utf8",
          )}\n${readFileSync(
            path.join(
              REPO,
              "examples/altitude/.altitude-sandbox/node_modules/altitude-web-components/dist/css/tokens-light.css",
            ),
            "utf8",
          )}`,
        )}</style>`
      : "";
  const body =
    cell.library === "altitude"
      ? `<button data-sentinel="${cell.key}" aria-label="sentinel" style="width:8px;height:8px;padding:0;border:0;margin:0 0 28px 0;background:#eee"></button>
<div class="gate-cell" data-cell="${cell.key}"></div>`
      : `<div id="app"></div>`;
  return `<!doctype html><html><head><meta charset="utf-8">
<style>${fontCss}</style>${altitudeTheme}<style>${frameCss}</style>
<script>globalThis.__BUTTON_CELL__ = ${JSON.stringify(cell)};</script>
</head><body>${body}<script>${bundleSource}</script></body></html>`;
};

const interactionFor = (cell: ButtonComparisonCell): Interaction =>
  cell.state === "default" ? "default" : cell.state;

interface DomProbe {
  hostTag: string;
  buttonFound: boolean;
  buttonTag: string | null;
  role: string | null;
  text: string;
  accessibleNameMatched: boolean;
  disabled: boolean;
  ariaDisabled: string | null;
  ariaBusy: string | null;
}

const probeDom = async (page: {
  evaluate(expression: string): Promise<unknown>;
}): Promise<DomProbe> =>
  (await page.evaluate(`(() => {
    const stage = document.querySelector("[data-cell]");
    const host = stage && stage.firstElementChild;
    const direct = host && host.matches && host.matches("button") ? host : null;
    const button = direct || (host && host.shadowRoot && host.shadowRoot.querySelector("button")) ||
      (host && host.querySelector && host.querySelector("button"));
    const slottedText = host && host.shadowRoot
      ? [...host.shadowRoot.querySelectorAll("slot")]
          .flatMap((slot) => slot.assignedNodes({ flatten: true }))
          .map((node) => node.textContent || "")
          .join(" ")
      : "";
    return {
      hostTag: host ? host.tagName.toLowerCase() : "",
      buttonFound: !!button,
      buttonTag: button ? button.tagName.toLowerCase() : null,
      role: button ? (button.getAttribute("role") || button.getAttribute("type") || "button") : null,
      text: button ? (button.innerText || button.textContent || host.textContent || slottedText).replace(/\\s+/g, " ").trim() : "",
      accessibleNameMatched: false,
      disabled: !!(button && button.disabled),
      ariaDisabled: button ? button.getAttribute("aria-disabled") : null,
      ariaBusy: button ? button.getAttribute("aria-busy") : null,
    };
  })()`)) as DomProbe;

interface Captured {
  cellKey: string;
  file: string;
  hash: string;
  width: number;
  height: number;
  contentBox: { width: number; height: number };
  focusVisibleMatched?: boolean;
  dom: DomProbe;
}

const captureDocument = async (
  page: Awaited<ReturnType<typeof newGatePage>>["page"],
  cell: ButtonComparisonCell,
  html: string,
  interaction: Interaction,
  outputFile: string,
  waitForHarness = false,
): Promise<Captured> => {
  await page.setContent(html, { waitUntil: "load" });
  if (waitForHarness) {
    await page.waitForFunction(
      `globalThis.__BUTTON_READY__ === true || !!globalThis.__BUTTON_ERROR__`,
    );
    const harnessError = await page.evaluate(
      "globalThis.__BUTTON_ERROR__ || null",
    );
    if (harnessError) throw new Error(`source harness failed: ${harnessError}`);
  }
  await page.evaluate(
    "Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 5000))])",
  );
  const shot = await captureCell(page, cell.key, interaction);
  let focusVisibleMatched = shot.focusVisibleMatched;
  if (interaction === "focus-visible" && focusVisibleMatched !== true) {
    focusVisibleMatched = (await page.evaluate(`(() => {
      const host = document.querySelector("[data-cell] > *");
      if (!host) return false;
      if (host.matches(":focus-visible")) return true;
      if (host.shadowRoot && host.shadowRoot.querySelector(":focus-visible")) return true;
      return !!host.querySelector(":focus-visible");
    })()`)) as boolean;
  }
  if (interaction === "focus-visible" && focusVisibleMatched !== true) {
    throw new Error(`${cell.key}: focus-visible stimulation did not match`);
  }
  if (shot.png.length === 0)
    throw new Error(`${cell.key}: capture produced zero bytes`);
  mkdirSync(path.dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, shot.png);
  const png = PNG.sync.read(shot.png);
  if (png.width <= 0 || png.height <= 0)
    throw new Error(`${cell.key}: capture produced zero pixels`);
  const dom = await probeDom(page);
  dom.accessibleNameMatched =
    (await page
      .getByRole("button", { name: cell.label, exact: true })
      .count()) > 0;
  if (!dom.buttonFound)
    throw new Error(`${cell.key}: DOM/API probe found no real button`);
  if (!dom.accessibleNameMatched)
    throw new Error(`${cell.key}: ARIA probe did not resolve Button`);
  return {
    cellKey: cell.key,
    file: relative(outputFile).replace(
      "recipe/evidence/.button-comparison-v2-next",
      "recipe/evidence/button-comparison-v2",
    ),
    hash: sha256(shot.png),
    width: png.width,
    height: png.height,
    contentBox: shot.contentBox,
    ...(focusVisibleMatched === undefined ? {} : { focusVisibleMatched }),
    dom,
  };
};

const nodeRequire = createRequire(import.meta.url);
const reactMarkup = (
  source: string,
  props: Record<string, unknown>,
): string => {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const reactModule = { exports: {} as Record<string, unknown> };
  const requireModule = (id: string): unknown => {
    if (id === "react") return React;
    if (id === "react/jsx-runtime") return nodeRequire("react/jsx-runtime");
    throw new Error(`unexpected generated React import ${id}`);
  };
  Function(
    "require",
    "module",
    "exports",
    transpiled,
  )(requireModule, reactModule, reactModule.exports);
  const Button = reactModule.exports.Button as React.ElementType;
  return renderToStaticMarkup(React.createElement(Button, props));
};

const recipeBundles = new Map<
  ButtonComparisonLibrary,
  ReturnType<typeof emitButtonOutputs>
>();
const acquisitionReports = new Map<
  ButtonComparisonLibrary,
  ReturnType<typeof auditReviewedButtonAcquisition>
>();
const emissionEvidence = new Map<
  ButtonComparisonLibrary,
  { byteIdenticalTwoRun: boolean; reactHash: string; webComponentHash: string }
>();
const contractByLibrary = {
  altitude: JSON.parse(
    readFileSync(
      path.join(REPO, "examples/altitude/contracts/button.contract.json"),
      "utf8",
    ),
  ) as unknown,
  fluent: JSON.parse(
    readFileSync(
      path.join(REPO, "examples/fluent/contracts/button.contract.json"),
      "utf8",
    ),
  ) as unknown,
};
const recipeAdapterByLibrary = {
  altitude: altitudeButtonAdapterConfig,
  fluent: fluentButtonAdapterConfig,
};
for (const library of ["altitude", "fluent"] as const) {
  const instance = adaptReviewedButton(
    contractByLibrary[library],
    recipeAdapterByLibrary[library],
  );
  acquisitionReports.set(
    library,
    auditReviewedButtonAcquisition(
      contractByLibrary[library],
      recipeAdapterByLibrary[library],
      instance,
    ),
  );
  const envelope = compileButtonRecipe(instance);
  const firstEmission = emitButtonOutputs(
    envelope,
    instance.provenance.selection,
  );
  const secondEmission = emitButtonOutputs(
    envelope,
    instance.provenance.selection,
  );
  assert.deepEqual(firstEmission, secondEmission);
  recipeBundles.set(library, firstEmission);
  emissionEvidence.set(library, {
    byteIdenticalTwoRun: true,
    reactHash: sha256(
      firstEmission.react
        .map((file) => `${file.path}\0${file.contents}`)
        .join("\0"),
    ),
    webComponentHash: sha256(
      firstEmission.webComponent
        .map((file) => `${file.path}\0${file.contents}`)
        .join("\0"),
    ),
  });
}

const recipeReactHtml = (cell: ButtonComparisonCell): string => {
  const output = recipeBundles.get(cell.library)!;
  const source = output.react.find((file) => file.path.endsWith("Button.tsx"))!;
  const css = output.react.find((file) => file.path.endsWith("button.css"))!;
  const markup = reactMarkup(source.contents, {
    variant: cell.variant,
    size: cell.recipeSize,
    state: cell.state,
    label: cell.label,
  });
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}</style><style>${frameCss}</style><style>${css.contents}</style></head>
<body><button data-sentinel="${cell.key}" aria-label="sentinel" style="width:8px;height:8px;padding:0;border:0;margin:0 0 28px 0;background:#eee"></button>
<div class="gate-cell" data-cell="${cell.key}">${markup}</div></body></html>`;
};

const recipeWcHtml = (cell: ButtonComparisonCell): string => {
  const output = recipeBundles.get(cell.library)!;
  const source = output.webComponent.find((file) =>
    file.path.endsWith("recipe-button.js"),
  )!;
  const attributes = [
    `variant="${cell.variant}"`,
    `size="${cell.recipeSize}"`,
    `state="${cell.state}"`,
    `label="${cell.label}"`,
  ].join(" ");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}</style><style>${frameCss}</style></head>
<body><button data-sentinel="${cell.key}" aria-label="sentinel" style="width:8px;height:8px;padding:0;border:0;margin:0 0 28px 0;background:#eee"></button>
<div class="gate-cell" data-cell="${cell.key}"><recipe-button ${attributes}></recipe-button></div>
<script>${source.contents.replaceAll("export ", "")}</script></body></html>`;
};

const { corpus } = enumerateCorpus();
const legacyRows = Object.fromEntries(
  (["altitude", "fluent"] as const).map((library) => {
    const row = corpus.find(
      (candidate) => candidate.row.id === `${library}.button`,
    );
    if (!row) throw new Error(`legacy row ${library}.button is absent`);
    return [library, row];
  }),
);

const legacyHtml = (cell: ButtonComparisonCell): string => {
  const row = legacyRows[cell.library]!;
  const world = loadLibraryWorld(row.library);
  const subst: Record<string, string> =
    cell.library === "altitude"
      ? cell.variant === "secondary"
        ? { variant: "secondary" }
        : {}
      : {
          appearance: cell.variant,
          size: "medium",
          shape: "rounded",
        };
  const doc = buildCssCellDoc({
    contract: row.contract,
    subst,
    bools: {},
    tokenCss: world.tokenCss,
    inventory: world.inventory,
    icons: world.icons,
    contracts: world.byId,
    cellKey: cell.key,
  });
  return doc.replace("<head>", `<head><style>${fontCss}</style>`);
};

interface PackagePin {
  packageName: string;
  exactVersion: string;
  packageJsonHash: string;
  packageLockHash: string;
  packageIntegrity: string;
  installedTreeHash: string;
  componentPackage?: {
    packageName: string;
    exactVersion: string;
    installedTreeHash: string;
    integrity: string;
  };
  sourceHash: string;
}

const packagePin = (library: ButtonComparisonLibrary): PackagePin => {
  const adapter = REVIEWED_SOURCE_BUTTON_ADAPTERS[library];
  const sandbox = path.join(REPO, adapter.sandbox);
  const packageJsonPath = path.join(
    sandbox,
    "node_modules",
    ...adapter.packageName.split("/"),
    "package.json",
  );
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version: string;
  };
  assert.equal(
    packageJson.version,
    adapter.exactVersion,
    `${adapter.packageName} version drift`,
  );
  const lockPath = path.join(sandbox, "package-lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8")) as {
    packages: Record<string, { version?: string; integrity?: string }>;
  };
  const packageKey = `node_modules/${adapter.packageName}`;
  const lockEntry = lock.packages[packageKey];
  assert.equal(lockEntry?.version, adapter.exactVersion);
  assert.ok(lockEntry?.integrity);
  const packageRoot = path.dirname(packageJsonPath);
  const installedTreeHash = treeHash(packageRoot);
  let componentPackage: PackagePin["componentPackage"];
  if (library === "fluent") {
    const componentName = "@fluentui/react-button";
    const componentRoot = path.join(
      sandbox,
      "node_modules/@fluentui/react-button",
    );
    const componentJson = JSON.parse(
      readFileSync(path.join(componentRoot, "package.json"), "utf8"),
    ) as { version: string };
    const componentLock = lock.packages[`node_modules/${componentName}`];
    assert.ok(componentLock?.integrity);
    componentPackage = {
      packageName: componentName,
      exactVersion: componentJson.version,
      installedTreeHash: treeHash(componentRoot),
      integrity: componentLock.integrity,
    };
  }
  const sourceHash = sha256(
    `${installedTreeHash}\0${componentPackage?.installedTreeHash ?? ""}`,
  );
  return {
    packageName: adapter.packageName,
    exactVersion: adapter.exactVersion,
    packageJsonHash: fileHash(packageJsonPath),
    packageLockHash: fileHash(lockPath),
    packageIntegrity: lockEntry.integrity!,
    installedTreeHash,
    ...(componentPackage ? { componentPackage } : {}),
    sourceHash,
  };
};

const pins = {
  altitude: packagePin("altitude"),
  fluent: packagePin("fluent"),
};

const v1Receipt = JSON.parse(
  readFileSync(path.join(V1_EVIDENCE, "receipt.json"), "utf8"),
) as {
  provenance: { environmentHash: string };
  references: Captured[];
  outputs: { legacy: Captured[] };
  comparisonPin: {
    referenceProvenance: Record<string, SourceReferenceProvenance>;
  };
};

rmSync(NEXT, { recursive: true, force: true });
mkdirSync(NEXT, { recursive: true });
const refsDirectory = path.join(NEXT, "source-reference");
const legacyDirectory = path.join(NEXT, "legacy");
const reactDirectory = path.join(NEXT, "recipe-react");
const wcDirectory = path.join(NEXT, "recipe-wc");

const browserExecutable = chromiumExecutable();
const browserExecutableHash = fileHash(browserExecutable);
const browserRevision = pinnedChromiumRevision();
const browser = await launchGateBrowser();
const browserVersion = browser.version();
const environment = {
  platform: process.platform,
  arch: process.arch,
  node: process.version,
  browser: browserVersion,
  browserRevision,
  browserExecutableHash,
  viewport: VIEWPORT,
  deviceScaleFactor: DPR,
  colorScheme: "light",
  background: "#ffffff",
  fonts: fontFiles.map((file) => ({
    file: relative(file),
    hash: fileHash(file),
  })),
  fontsHash,
};
const environmentHash = sha256(JSON.stringify(environment));
assert.equal(
  environmentHash,
  v1Receipt.provenance.environmentHash,
  "v2 environment differs from the sealed v1 environment",
);
const protocol = {
  version: BUTTON_COMPARISON_PROTOCOL_VERSION,
  rubricHash: sha256(
    "Recognisable as the same Button source cell; record defects and confidence; do not rank implementations.",
  ),
  environmentHash,
  crop: "painted-union+24-css-px-white-margin",
  scale: DPR,
  browser: `${browserVersion} (playwright chromium-${browserRevision})`,
  fontsHash,
  passThreshold: "independent recognisable=true for each paired specimen",
};

const harnessHash = fileHash(
  path.join(REPO, "recipe/capture-button-comparison.ts"),
);
const fixtureModulePath = path.join(
  REPO,
  "recipe/button-comparison-fixture.ts",
);
const sourceAdapterHashes = {
  altitude: sha256(JSON.stringify(REVIEWED_SOURCE_BUTTON_ADAPTERS.altitude)),
  fluent: sha256(JSON.stringify(REVIEWED_SOURCE_BUTTON_ADAPTERS.fluent)),
};
const fixtureHash = hashFiles([
  fixtureModulePath,
  path.join(REPO, "recipe/fixtures/library-buttons.ts"),
  path.join(REPO, "recipe/fixtures/button.ts"),
  path.join(REPO, "examples/altitude/contracts/button.contract.json"),
  path.join(REPO, "examples/fluent/contracts/button.contract.json"),
]);
const sampleMatrixHash = sha256(JSON.stringify(BUTTON_COMPARISON_CELLS));
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: REPO,
  encoding: "utf8",
}).trim();

const references: Captured[] = [];
const legacyOutputs: Captured[] = [];
const recipeOutputs: Captured[] = [];
const wcOutputs: Captured[] = [];
const { context, page } = await newGatePage(browser);
try {
  for (const cell of BUTTON_COMPARISON_CELLS) {
    const name = `${slug(cell.key)}.png`;
    const sealedReference = v1Receipt.references.find(
      (reference) => reference.cellKey === cell.key,
    );
    assert.ok(
      sealedReference,
      `${cell.key}: sealed v1 source reference absent`,
    );
    const referenceFile = path.join(refsDirectory, name);
    mkdirSync(path.dirname(referenceFile), { recursive: true });
    copyFileSync(path.join(REPO, sealedReference.file), referenceFile);
    references.push({
      ...sealedReference,
      file: relative(referenceFile).replace(
        "recipe/evidence/.button-comparison-v2-next",
        "recipe/evidence/button-comparison-v2",
      ),
    });
    legacyOutputs.push(
      await captureDocument(
        page,
        cell,
        legacyHtml(cell),
        interactionFor(cell),
        path.join(legacyDirectory, name),
      ),
    );
    recipeOutputs.push(
      await captureDocument(
        page,
        cell,
        recipeReactHtml(cell),
        "default",
        path.join(reactDirectory, name),
      ),
    );
    const isolated = await newGatePage(browser);
    try {
      wcOutputs.push(
        await captureDocument(
          isolated.page,
          cell,
          recipeWcHtml(cell),
          "default",
          path.join(wcDirectory, name),
        ),
      );
    } finally {
      await isolated.context.close();
    }
  }
} finally {
  await context.close();
  await browser.close();
}

const assertPinnedBytesUnchanged = (
  label: string,
  actual: Captured[],
  sealed: Captured[],
): void => {
  const sealedByCell = new Map(
    sealed.map((artifact) => [artifact.cellKey, artifact]),
  );
  for (const artifact of actual) {
    const prior = sealedByCell.get(artifact.cellKey);
    assert.ok(prior, `${label} ${artifact.cellKey}: absent from sealed v1`);
    assert.equal(
      artifact.hash,
      prior.hash,
      `${label} ${artifact.cellKey}: bytes differ from sealed v1`,
    );
  }
};
assertPinnedBytesUnchanged(
  "source reference",
  references,
  v1Receipt.references,
);
assertPinnedBytesUnchanged(
  "legacy output",
  legacyOutputs,
  v1Receipt.outputs.legacy,
);
for (const react of recipeOutputs) {
  const webComponent = wcOutputs.find(
    (candidate) => candidate.cellKey === react.cellKey,
  );
  assert.ok(webComponent, `${react.cellKey}: Web Component parity cell absent`);
  assert.deepEqual(
    webComponent.contentBox,
    react.contentBox,
    `${react.cellKey}: Web Component geometry differs from React`,
  );
  assert.equal(
    webComponent.hash,
    react.hash,
    `${react.cellKey}: Web Component pixels differ from React`,
  );
}

const byCell = <T extends { cellKey: string }>(values: T[]): Map<string, T> =>
  new Map(values.map((value) => [value.cellKey, value]));
const refByCell = byCell(references);
const comparedPixels = (left: Captured, right: Captured): number => {
  const pixels =
    Math.min(left.width, right.width) * Math.min(left.height, right.height);
  if (!Number.isSafeInteger(pixels) || pixels <= 0) {
    throw new Error(`${right.cellKey}: ZERO-COMPARED-PIXELS`);
  }
  return pixels;
};

const referenceHashes: Record<string, string> = {};
const referenceProvenance: Record<string, SourceReferenceProvenance> = {};
for (const reference of references) {
  const cell = BUTTON_COMPARISON_CELLS.find(
    (candidate) => candidate.key === reference.cellKey,
  )!;
  referenceHashes[cell.key] = reference.hash;
  referenceProvenance[cell.key] =
    v1Receipt.comparisonPin.referenceProvenance[cell.key]!;
}

const manifestFor = (outputs: Captured[]): ComparisonOutputManifest => ({
  fixtureHash,
  sampleMatrixHash,
  cells: outputs.map((output) => {
    const reference = refByCell.get(output.cellKey)!;
    return {
      cellKey: output.cellKey,
      outputHash: output.hash,
      referenceHash: reference.hash,
      comparedPixels: comparedPixels(reference, output),
    };
  }),
});
const legacyManifest = manifestFor(legacyOutputs);
const recipeManifest = manifestFor(recipeOutputs);
const wcManifest = manifestFor(wcOutputs);
const pin: PinnedComparisonFixture = {
  sourceCommit,
  fixtureHash,
  sampleMatrixHash,
  cellKeys: BUTTON_COMPARISON_CELLS.map((cell) => cell.key),
  referenceHashes,
  referenceProvenance,
  protocol,
};
validatePinnedComparisonEvidence(pin, legacyManifest, recipeManifest);

const blindSeed = sha256(
  `${fixtureHash}\0${sampleMatrixHash}\0${environmentHash}\0blind-order-v2`,
);
const blindPacketDirectory = path.join(NEXT, "blind-packet");
const blindRefs = path.join(blindPacketDirectory, "references");
const blindSpecimens = path.join(blindPacketDirectory, "specimens");
mkdirSync(blindRefs, { recursive: true });
mkdirSync(blindSpecimens, { recursive: true });
const answerKey: Array<{
  anonymousCell: string;
  anonymousLabel: string;
  implementationPath: "legacy" | "recipe-react";
  cellKey: string;
  outputHash: string;
}> = [];
const packetCells = BUTTON_COMPARISON_CELLS.map((cell) => {
  const reference = refByCell.get(cell.key)!;
  const anonymousCell = `cell-${sha256(`${blindSeed}\0${cell.key}`).slice(0, 12)}`;
  const referenceName = `${anonymousCell}.png`;
  copyFileSync(
    path.join(
      NEXT,
      reference.file.replace("recipe/evidence/button-comparison-v2/", ""),
    ),
    path.join(blindRefs, referenceName),
  );
  const candidates = [
    { path: "legacy" as const, artifact: byCell(legacyOutputs).get(cell.key)! },
    {
      path: "recipe-react" as const,
      artifact: byCell(recipeOutputs).get(cell.key)!,
    },
  ]
    .map((candidate) => ({
      ...candidate,
      anonymousLabel: `specimen-${sha256(
        `${blindSeed}\0${cell.key}\0${candidate.path}`,
      ).slice(0, 12)}`,
    }))
    .sort((left, right) =>
      left.anonymousLabel < right.anonymousLabel ? -1 : 1,
    );
  const specimens = candidates.map((candidate) => {
    const file = `${candidate.anonymousLabel}.png`;
    copyFileSync(
      path.join(
        NEXT,
        candidate.artifact.file.replace(
          "recipe/evidence/button-comparison-v2/",
          "",
        ),
      ),
      path.join(blindSpecimens, file),
    );
    answerKey.push({
      anonymousCell,
      anonymousLabel: candidate.anonymousLabel,
      implementationPath: candidate.path,
      cellKey: cell.key,
      outputHash: candidate.artifact.hash,
    });
    return {
      anonymousLabel: candidate.anonymousLabel,
      image: `specimens/${file}`,
      outputHash: candidate.artifact.hash,
      grade: {
        recognisable: null,
        defects: [],
        confidence: null,
      },
    };
  });
  return {
    anonymousCell,
    reference: {
      image: `references/${referenceName}`,
      screenshotHash: reference.hash,
    },
    specimens,
  };
});
const randomizedBatchHash = sha256(
  JSON.stringify(
    packetCells.map((cell) => ({
      anonymousCell: cell.anonymousCell,
      referenceHash: cell.reference.screenshotHash,
      specimens: cell.specimens.map((specimen) => ({
        anonymousLabel: specimen.anonymousLabel,
        outputHash: specimen.outputHash,
      })),
    })),
  ),
);
const packet = {
  version: BUTTON_COMPARISON_PROTOCOL_VERSION,
  status: "awaiting-independent-blind-grade",
  instructions: [
    "Use only this blind-packet directory; do not inspect parent evidence, source code, or the sealed answer key.",
    "For each anonymous cell, compare both specimens independently with the source reference.",
    "Set recognisable to true or false, list concrete defects for every false result, and record low/medium/high confidence.",
    "Do not rank specimens and do not infer an expected winner.",
  ],
  protocol,
  randomizedBatchHash,
  cells: packetCells,
};
writeJson(path.join(blindPacketDirectory, "packet.json"), packet);
writeJson(path.join(NEXT, "sealed-answer-key.json"), {
  version: BUTTON_COMPARISON_PROTOCOL_VERSION,
  sealedFromBlindGrader: true,
  randomizationSeedHash: sha256(blindSeed),
  randomizedBatchHash,
  answers: answerKey,
});

const apiDomAria = {
  sourceReference: references.map(({ cellKey, dom }) => ({ cellKey, ...dom })),
  legacy: legacyOutputs.map(({ cellKey, dom }) => ({ cellKey, ...dom })),
  recipeReact: recipeOutputs.map(({ cellKey, dom }) => ({ cellKey, ...dom })),
  recipeWebComponent: wcOutputs.map(({ cellKey, dom }) => ({
    cellKey,
    ...dom,
  })),
};
const totalComparedPixels = (manifest: ComparisonOutputManifest): number =>
  manifest.cells.reduce((total, cell) => total + cell.comparedPixels, 0);
const receipt = {
  version: 2,
  status: {
    evidenceGeneration: "complete",
    independentBlindGrade: "pending",
    legacyRecognisability: "ungraded",
    recipeRecognisability: "ungraded",
    buttonSuccess: false,
  },
  historicalCorpusBaseline: {
    recognisable: "117/170",
    usable: "39/170",
    changed: false,
  },
  verifiedButtonLegacyContext: {
    sets: 2,
    recognisableSets: 1,
    totalVariants: 49,
    historicalRenderedSampleCells: 18,
    scope: "context only; not a per-cell blind grade",
  },
  matrix: {
    frozenBeforeRender: true,
    sampleMatrixHash,
    axesCompared: ["Variant", "State"],
    variants: [...new Set(BUTTON_COMPARISON_CELLS.map((cell) => cell.variant))],
    states: [...new Set(BUTTON_COMPARISON_CELLS.map((cell) => cell.state))],
    fixed: { Size: "medium", Icons: "none", Label: "Button" },
    sharedCellsPerLibrary: 6,
    libraries: 2,
    totalSourceCells: BUTTON_COMPARISON_CELLS.length,
    cells: BUTTON_COMPARISON_CELLS,
    excludedByName:
      REVIEWED_SOURCE_BUTTON_ADAPTERS.altitude.unsupportedPairedCells,
  },
  provenance: {
    sourceCommit,
    fixtureHash,
    harnessHash,
    sourceAdapterHashes,
    packages: pins,
    adapters: REVIEWED_SOURCE_BUTTON_ADAPTERS,
    environment,
    environmentHash,
    captureCommand: CAPTURE_COMMAND,
  },
  references,
  outputs: {
    legacy: legacyOutputs,
    recipeReact: recipeOutputs,
    recipeWebComponent: wcOutputs,
  },
  comparisonPin: pin,
  manifests: {
    legacy: legacyManifest,
    recipeReact: recipeManifest,
    recipeWebComponentParity: wcManifest,
  },
  counts: {
    sourceReferences: references.length,
    legacyOutputs: legacyOutputs.length,
    recipeReactOutputs: recipeOutputs.length,
    recipeWebComponentOutputs: wcOutputs.length,
    blindSpecimens: answerKey.length,
  },
  nonvisualEvidence: {
    setsCompared: 2,
    cellsPerPath: legacyManifest.cells.length,
    variantsCompared: 2,
    axesCompared: 2,
    statesCompared: 3,
    legacyComparedPixels: totalComparedPixels(legacyManifest),
    recipeReactComparedPixels: totalComparedPixels(recipeManifest),
    recipeWebComponentComparedPixels: totalComparedPixels(wcManifest),
    zeroPixelComparisons: 0,
    byteEqualSourceLegacyPairs: legacyManifest.cells.filter(
      (cell) => cell.outputHash === cell.referenceHash,
    ).length,
    byteEqualSourceRecipePairs: recipeManifest.cells.filter(
      (cell) => cell.outputHash === cell.referenceHash,
    ).length,
    apiDomAria,
    provenanceFieldsComplete: true,
    acquisitionAccounting: Object.fromEntries(acquisitionReports),
    deterministicEmission: Object.fromEntries(emissionEvidence),
    usabilityFactsAvailableOffline: {
      legacy: {
        reflow:
          "contract HTML uses real flex/inline-flex layout; no fixed coordinates in the sampled Button roots",
        variantSwitching:
          "legacy contract axes map to source variants in the frozen matrix",
        tokenBinding:
          "legacy HTML resolves committed bundle tokenSet custom properties",
        noFakeLayout: "sampled roots use CSS flex/inline-flex",
      },
      recipe: {
        reflow: "recipe React/WC outputs use inline-flex and content padding",
        variantSwitching:
          "data-variant and data-state select explicit recipe cells",
        tokenBinding:
          "every emitted var() reference has a generated custom-property definition",
        noFakeLayout:
          "button@1 IR and emitted code use auto/flex layout, not coordinates",
      },
      finalUsabilityVerdict: "ungraded",
    },
  },
  blindPacket: {
    path: "recipe/evidence/button-comparison-v2/blind-packet/packet.json",
    sealedAnswerKey:
      "recipe/evidence/button-comparison-v2/sealed-answer-key.json",
    randomizedBatchHash,
    packetHash: fileHash(path.join(blindPacketDirectory, "packet.json")),
    recognisabilityVerdictsAuthoredByBuilder: false,
  },
};
writeJson(path.join(NEXT, "receipt.json"), receipt);

rmSync(EVIDENCE, { recursive: true, force: true });
renameSync(NEXT, EVIDENCE);
console.log(
  `Button comparison evidence: ${references.length} references, ${legacyOutputs.length} legacy, ${recipeOutputs.length} recipe React, ${wcOutputs.length} recipe WC; blind packet ${relative(path.join(EVIDENCE, "blind-packet/packet.json"))}`,
);
