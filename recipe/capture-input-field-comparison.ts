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
  adaptReviewedInputField,
  auditReviewedInputFieldAcquisition,
} from "./adapters/input-field.js";
import {
  INPUT_FIELD_COMPARISON_ADORNMENTS,
  INPUT_FIELD_COMPARISON_CELLS,
  INPUT_FIELD_COMPARISON_CONTENT,
  INPUT_FIELD_COMPARISON_LIBRARIES,
  INPUT_FIELD_COMPARISON_PROTOCOL_VERSION,
  INPUT_FIELD_COMPARISON_REQUIRED,
  INPUT_FIELD_COMPARISON_SIZES,
  INPUT_FIELD_COMPARISON_STATES,
  REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS,
  validateInputFieldComparisonMatrix,
  type InputFieldComparisonCell,
  type InputFieldComparisonLibrary,
} from "./input-field-comparison-fixture.js";
import {
  validatePinnedComparisonEvidence,
  type ComparisonOutputManifest,
  type PinnedComparisonFixture,
  type SourceReferenceProvenance,
} from "./comparison.js";
import {
  muiInputFieldAdapterConfig,
  polarisInputFieldAdapterConfig,
} from "./fixtures/library-input-fields.js";
import { emitInputFieldOutputs } from "./output/input-field.js";
import { compileInputFieldRecipe } from "./recipes/input-field.js";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const EVIDENCE = path.join(REPO, "recipe/evidence/input-field-comparison");
const NEXT = path.join(REPO, "recipe/evidence/.input-field-comparison-next");
const CAPTURE_COMMAND = "npx tsx recipe/capture-input-field-comparison.ts";
const VIEWPORT = { width: 600, height: 800 };
const DPR = 2;

const sha256 = (bytes: string | Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");
const fileHash = (file: string): string => sha256(readFileSync(file));
const writeJson = (file: string, value: unknown): void =>
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const relative = (file: string): string =>
  path.relative(REPO, file).split(path.sep).join("/");
const finalEvidencePath = (file: string): string =>
  relative(file).replace(
    "recipe/evidence/.input-field-comparison-next",
    "recipe/evidence/input-field-comparison",
  );
const artifactName = (cellKey: string): string =>
  `cell-${sha256(cellKey).slice(0, 20)}.png`;

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
  "extract/computed/fonts/roboto/roboto-latin-400-normal.woff2",
  "extract/computed/fonts/roboto/roboto-latin-500-normal.woff2",
  "extract/computed/fonts/roboto/roboto-latin-700-normal.woff2",
  "extract/computed/fonts/inter/inter-latin-variable.woff2",
].map((file) => path.join(REPO, file));
const dataFont = (file: string): string =>
  `data:font/woff2;base64,${readFileSync(file).toString("base64")}`;
const fontCss = `
@font-face { font-family: "Roboto"; src: url("${dataFont(fontFiles[0]!)}") format("woff2"); font-style: normal; font-weight: 400; font-display: block; }
@font-face { font-family: "Roboto"; src: url("${dataFont(fontFiles[1]!)}") format("woff2"); font-style: normal; font-weight: 500; font-display: block; }
@font-face { font-family: "Roboto"; src: url("${dataFont(fontFiles[2]!)}") format("woff2"); font-style: normal; font-weight: 700; font-display: block; }
@font-face { font-family: "Inter"; src: url("${dataFont(fontFiles[3]!)}") format("woff2"); font-style: normal; font-weight: 100 900; font-display: block; }
`;
const fontsHash = hashFiles(fontFiles);
const frameCss = `
html { color-scheme: light; }
body { margin: 0; padding: 24px; background: #fff; color: #1e1e1e; font-family: Inter, system-ui, sans-serif; }
.gate-cell { display: flex; align-items: flex-start; width: max-content; margin: 0 0 64px 0; }
*, *::before, *::after { animation-play-state: paused !important; transition: none !important; caret-color: transparent !important; }
`;

interface BrowserBundle {
  script: string;
  css: string;
}
interface EsbuildOutput {
  outputFiles?: Array<{ path: string; text: string }>;
}
const bundle = async (
  sandbox: string,
  source: string,
): Promise<BrowserBundle> => {
  const absolute = path.join(REPO, sandbox);
  const sandboxRequire = createRequire(path.join(absolute, "package.json"));
  const esbuild = sandboxRequire("esbuild") as {
    build(options: Record<string, unknown>): Promise<EsbuildOutput>;
  };
  const result = await esbuild.build({
    stdin: {
      contents: source,
      resolveDir: absolute,
      sourcefile: "input-field-reference-entry.tsx",
      loader: "tsx",
    },
    bundle: true,
    write: false,
    outdir: "out",
    format: "iife",
    platform: "browser",
    target: "chrome149",
    sourcemap: false,
    legalComments: "none",
  });
  const outputs = result.outputFiles ?? [];
  const script =
    outputs.find((file) => file.path.endsWith(".js"))?.text ??
    outputs.find((file) => !file.path.endsWith(".css"))?.text;
  if (!script) throw new Error("source harness bundle produced zero JS bytes");
  return {
    script,
    css: outputs
      .filter((file) => file.path.endsWith(".css"))
      .map((file) => file.text)
      .join("\n"),
  };
};

const sourceBundles: Record<InputFieldComparisonLibrary, BrowserBundle> = {
  mui: await bundle(
    REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS.mui.sandbox,
    `
import React from "react";
import { createRoot } from "react-dom/client";
import { InputAdornment, TextField } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
const cell = globalThis.__INPUT_FIELD_CELL__;
const text = globalThis.__INPUT_FIELD_TEXT__;
const inputProps = {};
if (cell.adornments === "both") {
  inputProps.startAdornment = React.createElement(InputAdornment, { position: "start" }, text.leading);
  inputProps.endAdornment = React.createElement(InputAdornment, { position: "end" }, text.trailing);
}
const stateProps = cell.state === "focus-visible" ? { focused: true } :
  cell.state === "error" ? { error: true } :
  cell.state === "disabled" ? { disabled: true } : {};
const root = createRoot(document.querySelector("[data-cell]"));
root.render(React.createElement(ThemeProvider, {
  theme: createTheme({ cssVariables: true, colorSchemes: { light: true } }),
}, React.createElement(TextField, {
  id: globalThis.__INPUT_FIELD_ID__, variant: "outlined", type: "text",
  size: cell.size, label: text.label, placeholder: text.placeholder,
  value: cell.content === "value" ? text.value : "",
  required: cell.required === "true",
  helperText: cell.state === "error" ? text.error : text.helper,
  slotProps: { input: inputProps }, onChange() {}, ...stateProps,
})));
(async () => {
  for (let i = 0; i < 100 && !document.querySelector("[data-cell] input"); i++) await new Promise((r) => requestAnimationFrame(r));
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  globalThis.__INPUT_FIELD_READY__ = true;
})().catch((error) => { globalThis.__INPUT_FIELD_ERROR__ = String(error && error.stack || error); });
`,
  ),
  polaris: await bundle(
    REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS.polaris.sandbox,
    `
import React from "react";
import { createRoot } from "react-dom/client";
import { AppProvider, TextField } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
const cell = globalThis.__INPUT_FIELD_CELL__;
const text = globalThis.__INPUT_FIELD_TEXT__;
const stateProps = cell.state === "focus-visible" ? { focused: true } :
  cell.state === "error" ? { error: text.error } :
  cell.state === "disabled" ? { disabled: true } : {};
const adornmentProps = cell.adornments === "both" ? { prefix: text.leading, suffix: text.trailing } : {};
const root = createRoot(document.querySelector("[data-cell]"));
root.render(React.createElement(AppProvider, { i18n: en }, React.createElement(TextField, {
  id: globalThis.__INPUT_FIELD_ID__, label: text.label, placeholder: text.placeholder,
  value: cell.content === "value" ? text.value : "",
  helpText: cell.state === "error" ? undefined : text.helper,
  autoComplete: "off", type: "text", variant: "inherit",
  size: cell.size === "small" ? "slim" : "medium",
  requiredIndicator: cell.required === "true", onChange() {},
  ...adornmentProps, ...stateProps,
})));
(async () => {
  for (let i = 0; i < 100 && !document.querySelector("[data-cell] input"); i++) await new Promise((r) => requestAnimationFrame(r));
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  globalThis.__INPUT_FIELD_READY__ = true;
})().catch((error) => { globalThis.__INPUT_FIELD_ERROR__ = String(error && error.stack || error); });
`,
  ),
};

const sourceHtml = (
  cell: InputFieldComparisonCell,
  source: BrowserBundle,
): string => {
  const adapter = REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[cell.library];
  const controlId = `source-${sha256(cell.key).slice(0, 12)}`;
  return `<!doctype html><html><head><meta charset="utf-8">
<style>${fontCss}</style><style>${source.css}</style><style>${frameCss}</style>
<script>
globalThis.__INPUT_FIELD_CELL__ = ${JSON.stringify(cell)};
globalThis.__INPUT_FIELD_TEXT__ = ${JSON.stringify(adapter.text)};
globalThis.__INPUT_FIELD_ID__ = ${JSON.stringify(controlId)};
</script></head><body>
<button data-sentinel="${cell.key}" aria-label="sentinel" style="width:8px;height:8px;padding:0;border:0;margin:0 0 28px 0;background:#eee"></button>
<div class="gate-cell" data-cell="${cell.key}"></div>
<script>${source.script}</script></body></html>`;
};

interface DomProbe {
  inputFound: boolean;
  inputTag: string | null;
  labelFound: boolean;
  labelForMatches: boolean;
  accessibleNameMatched: boolean;
  value: string;
  placeholder: string;
  required: boolean;
  disabled: boolean;
  ariaInvalid: string | null;
  ariaDescribedBy: string | null;
  structure: {
    labels: number;
    inputs: number;
    messages: number;
    adornments: number;
  };
}

const probeDom = async (
  page: Awaited<ReturnType<typeof newGatePage>>["page"],
  label: string,
): Promise<DomProbe> => {
  const probe = (await page.evaluate(`(() => {
    const stage = document.querySelector("[data-cell]");
    const host = stage && stage.firstElementChild;
    const root = host && host.shadowRoot ? host.shadowRoot : stage;
    const inputs = root ? [...root.querySelectorAll("input")] : [];
    const input = inputs.find((candidate) => /^(source|recipe)-/.test(candidate.id)) || inputs[0];
    const labels = root ? [...root.querySelectorAll("label")] : [];
    const label = input ? labels.find((candidate) => candidate.htmlFor === input.id) : labels[0];
    const scope = input && input.closest(".MuiFormControl-root, .Polaris-Labelled--root, .recipe-input-field") || root;
    const all = (selector) => scope ? [...scope.querySelectorAll(selector)] : [];
    const expectedLabel = ${JSON.stringify(label)};
    const labelText = label ? (label.textContent || "").replace(/\\s+/g, " ").trim() : "";
    return {
      inputFound: !!input,
      inputTag: input ? input.tagName.toLowerCase() : null,
      labelFound: !!label,
      labelForMatches: !!(input && label && label.htmlFor && label.htmlFor === input.id),
      accessibleNameMatched: !!(input && label && label.htmlFor === input.id && labelText.includes(expectedLabel)),
      value: input ? input.value : "",
      placeholder: input ? input.getAttribute("placeholder") || "" : "",
      required: !!(input && input.required),
      disabled: !!(input && input.disabled),
      ariaInvalid: input ? input.getAttribute("aria-invalid") : null,
      ariaDescribedBy: input ? input.getAttribute("aria-describedby") : null,
      structure: {
        labels: all("label").length,
        inputs: all("input").length,
        messages: all(".recipe-input-field__message, .MuiFormHelperText-root, .Polaris-InlineError, .Polaris-Text--root").length,
        adornments: all(".recipe-input-field__adornment, .MuiInputAdornment-root, .Polaris-TextField__Prefix, .Polaris-TextField__Suffix").length,
      },
    };
  })()`)) as DomProbe;
  return probe;
};

interface Captured {
  cellKey: string;
  file: string;
  hash: string;
  width: number;
  height: number;
  paintedPixels: number;
  contentBox: { width: number; height: number };
  focusVisibleMatched?: boolean;
  dom: DomProbe;
}

const interactionFor = (cell: InputFieldComparisonCell): Interaction =>
  cell.state === "focus-visible" ? "focus-visible" : "default";

const captureDocument = async (
  page: Awaited<ReturnType<typeof newGatePage>>["page"],
  cell: InputFieldComparisonCell,
  html: string,
  outputFile: string,
  waitForSource: boolean,
  resetRealm = false,
): Promise<Captured> => {
  if (resetRealm) await page.goto("about:blank");
  await page.setContent(html, { waitUntil: "load" });
  if (waitForSource) {
    await page.waitForFunction(
      `globalThis.__INPUT_FIELD_READY__ === true || !!globalThis.__INPUT_FIELD_ERROR__`,
    );
    const harnessError = await page.evaluate(
      "globalThis.__INPUT_FIELD_ERROR__ || null",
    );
    if (harnessError) throw new Error(`source harness failed: ${harnessError}`);
  }
  await page.evaluate("document.fonts.ready");
  const interaction = interactionFor(cell);
  const shot = await captureCell(page, cell.key, interaction);
  let focusVisibleMatched = shot.focusVisibleMatched;
  if (interaction === "focus-visible" && focusVisibleMatched !== true) {
    focusVisibleMatched = (await page.evaluate(`(() => {
      const host = document.querySelector("[data-cell] > *");
      if (!host) return false;
      if (host.matches(":focus-visible") || host.querySelector(":focus-visible")) return true;
      return !!(host.shadowRoot && host.shadowRoot.querySelector(":focus-visible"));
    })()`)) as boolean;
  }
  if (interaction === "focus-visible" && focusVisibleMatched !== true) {
    throw new Error(`${cell.key}: focus-visible stimulation did not match`);
  }
  if (shot.png.length === 0) {
    throw new Error(`${cell.key}: capture produced zero bytes`);
  }
  const png = PNG.sync.read(shot.png);
  let paintedPixels = 0;
  for (let offset = 0; offset < png.data.length; offset += 4) {
    if (
      png.data[offset + 3]! > 0 &&
      png.data[offset]! + png.data[offset + 1]! + png.data[offset + 2]! < 750
    ) {
      paintedPixels += 1;
    }
  }
  if (png.width <= 0 || png.height <= 0 || paintedPixels <= 0) {
    throw new Error(`${cell.key}: ZERO-PAINTED-PIXELS`);
  }
  mkdirSync(path.dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, shot.png);
  const adapter = REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[cell.library];
  const dom = await probeDom(page, adapter.text.label);
  if (!dom.inputFound || !dom.labelFound || !dom.accessibleNameMatched) {
    throw new Error(
      `${cell.key}: label/input source semantics are incomplete: ${JSON.stringify(dom)}`,
    );
  }
  return {
    cellKey: cell.key,
    file: finalEvidencePath(outputFile),
    hash: sha256(shot.png),
    width: png.width,
    height: png.height,
    paintedPixels,
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
  Function(
    "require",
    "module",
    "exports",
    transpiled,
  )(
    (id: string): unknown => {
      if (id === "react") return React;
      if (id === "react/jsx-runtime") return nodeRequire("react/jsx-runtime");
      throw new Error(`unexpected generated React import ${id}`);
    },
    reactModule,
    reactModule.exports,
  );
  const InputField = reactModule.exports.InputField as React.ElementType;
  return renderToStaticMarkup(React.createElement(InputField, props));
};

const contractByLibrary = {
  mui: JSON.parse(
    readFileSync(
      path.join(REPO, "examples/mui/contracts/text-field.contract.json"),
      "utf8",
    ),
  ) as unknown,
  polaris: JSON.parse(
    readFileSync(
      path.join(REPO, "examples/polaris/contracts/text-field.contract.json"),
      "utf8",
    ),
  ) as unknown,
};
const recipeAdapterByLibrary = {
  mui: muiInputFieldAdapterConfig,
  polaris: polarisInputFieldAdapterConfig,
};
const recipeBundles = new Map<
  InputFieldComparisonLibrary,
  ReturnType<typeof emitInputFieldOutputs>
>();
const acquisitionReports = new Map<
  InputFieldComparisonLibrary,
  ReturnType<typeof auditReviewedInputFieldAcquisition>
>();
const deterministicEmission = new Map<
  InputFieldComparisonLibrary,
  {
    byteIdenticalTwoRun: boolean;
    reactHash: string;
    webComponentHash: string;
  }
>();
for (const library of INPUT_FIELD_COMPARISON_LIBRARIES) {
  const config = recipeAdapterByLibrary[library];
  const contract = contractByLibrary[library];
  const instance = adaptReviewedInputField(contract, config);
  acquisitionReports.set(
    library,
    auditReviewedInputFieldAcquisition(contract, config, instance),
  );
  const envelope = compileInputFieldRecipe(instance);
  const first = emitInputFieldOutputs(envelope, instance.provenance.selection);
  const second = emitInputFieldOutputs(envelope, instance.provenance.selection);
  assert.deepEqual(first, second);
  recipeBundles.set(library, first);
  deterministicEmission.set(library, {
    byteIdenticalTwoRun: true,
    reactHash: sha256(
      first.react.map((file) => `${file.path}\0${file.contents}`).join("\0"),
    ),
    webComponentHash: sha256(
      first.webComponent
        .map((file) => `${file.path}\0${file.contents}`)
        .join("\0"),
    ),
  });
}

const recipeReactHtml = (cell: InputFieldComparisonCell): string => {
  const adapter = REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[cell.library];
  const output = recipeBundles.get(cell.library)!;
  const source = output.react.find((file) =>
    file.path.endsWith("InputField.tsx"),
  )!;
  const css = output.react.find((file) =>
    file.path.endsWith("input-field.css"),
  )!;
  const markup = reactMarkup(source.contents, {
    id: `recipe-${sha256(cell.key).slice(0, 12)}`,
    size: cell.size,
    state: cell.state,
    label: adapter.text.label,
    required: cell.required === "true",
    disabled: cell.state === "disabled",
    value: cell.content === "value" ? adapter.text.value : "",
    placeholder: adapter.text.placeholder,
    helperText: adapter.text.helper,
    errorText: cell.state === "error" ? adapter.text.error : undefined,
    leadingAdornment:
      cell.adornments === "both" ? adapter.text.leading : undefined,
    trailingAdornment:
      cell.adornments === "both" ? adapter.text.trailing : undefined,
  });
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}</style><style>${frameCss}</style><style>${css.contents}</style></head>
<body><button data-sentinel="${cell.key}" aria-label="sentinel" style="width:8px;height:8px;padding:0;border:0;margin:0 0 28px 0;background:#eee"></button>
<div class="gate-cell" data-cell="${cell.key}">${markup}</div></body></html>`;
};

const recipeWcHtml = (cell: InputFieldComparisonCell): string => {
  const adapter = REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[cell.library];
  const output = recipeBundles.get(cell.library)!;
  const source = output.webComponent.find((file) =>
    file.path.endsWith("recipe-input-field.js"),
  )!;
  const attrs = [
    `id="recipe-${sha256(cell.key).slice(0, 12)}"`,
    `size="${cell.size}"`,
    `state="${cell.state}"`,
    `label="${adapter.text.label}"`,
    `placeholder="${adapter.text.placeholder}"`,
    `helper-text="${adapter.text.helper}"`,
    `value="${cell.content === "value" ? adapter.text.value : ""}"`,
    cell.required === "true" ? "required" : "",
    cell.state === "disabled" ? "disabled" : "",
    cell.state === "error" ? `error-text="${adapter.text.error}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const slots =
    cell.adornments === "both"
      ? `<span slot="leading-adornment">${adapter.text.leading}</span><span slot="trailing-adornment">${adapter.text.trailing}</span>`
      : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}</style><style>${frameCss}</style></head>
<body><button data-sentinel="${cell.key}" aria-label="sentinel" style="width:8px;height:8px;padding:0;border:0;margin:0 0 28px 0;background:#eee"></button>
<div class="gate-cell" data-cell="${cell.key}"><recipe-input-field style="display:inline-flex" ${attrs}>${slots}</recipe-input-field></div>
<script>${source.contents.replaceAll("export ", "")}</script></body></html>`;
};

const { corpus } = enumerateCorpus();
const legacyRows = Object.fromEntries(
  INPUT_FIELD_COMPARISON_LIBRARIES.map((library) => {
    const row = corpus.find(
      (candidate) => candidate.row.id === `${library}.text-field`,
    );
    if (!row) throw new Error(`legacy row ${library}.text-field is absent`);
    return [library, row];
  }),
);
const legacyInputs: Record<
  InputFieldComparisonLibrary,
  (cell: InputFieldComparisonCell) => {
    subst: Record<string, string>;
    bools: Record<string, boolean>;
  }
> = {
  mui: (cell) => ({
    subst: { variant: "outlined", size: cell.size },
    bools: {},
  }),
  polaris: (cell) => ({
    subst: {
      variant: "inherit",
      size: cell.size === "small" ? "slim" : "medium",
      value:
        cell.content === "value"
          ? REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS.polaris.text.value
          : "",
      placeholder:
        REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS.polaris.text.placeholder,
    },
    bools: {
      disabled: cell.state === "disabled",
      focused: cell.state === "focus-visible",
      requiredIndicator: cell.required === "true",
      withPrefix: cell.adornments === "both",
      withSuffix: cell.adornments === "both",
    },
  }),
};
const legacyHtml = (cell: InputFieldComparisonCell): string => {
  const row = legacyRows[cell.library]!;
  const world = loadLibraryWorld(row.library);
  const inputs = legacyInputs[cell.library](cell);
  const doc = buildCssCellDoc({
    contract: row.contract,
    subst: inputs.subst,
    bools: inputs.bools,
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
  sandboxPackageJsonHash: string;
  packageJsonHash: string;
  packageLockHash: string;
  packageIntegrity: string;
  installedSourceTreeHash: string;
  sourceHash: string;
}
const packagePin = (library: InputFieldComparisonLibrary): PackagePin => {
  const adapter = REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[library];
  const sandbox = path.join(REPO, adapter.sandbox);
  const sandboxPackagePath = path.join(sandbox, "package.json");
  const sandboxPackage = JSON.parse(
    readFileSync(sandboxPackagePath, "utf8"),
  ) as { dependencies: Record<string, string> };
  assert.equal(
    sandboxPackage.dependencies[adapter.packageName],
    adapter.exactVersion,
    `${adapter.packageName} sandbox dependency must be exact`,
  );
  const packageRoot = path.join(
    sandbox,
    "node_modules",
    ...adapter.packageName.split("/"),
  );
  const packageJsonPath = path.join(packageRoot, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version: string;
  };
  assert.equal(packageJson.version, adapter.exactVersion);
  const lockPath = path.join(sandbox, "package-lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8")) as {
    packages: Record<string, { version?: string; integrity?: string }>;
  };
  const lockEntry = lock.packages[`node_modules/${adapter.packageName}`];
  assert.equal(lockEntry?.version, adapter.exactVersion);
  assert.ok(lockEntry?.integrity);
  const installedSourceTreeHash = treeHash(packageRoot);
  return {
    packageName: adapter.packageName,
    exactVersion: adapter.exactVersion,
    sandboxPackageJsonHash: fileHash(sandboxPackagePath),
    packageJsonHash: fileHash(packageJsonPath),
    packageLockHash: fileHash(lockPath),
    packageIntegrity: lockEntry.integrity!,
    installedSourceTreeHash,
    sourceHash: sha256(
      `${adapter.packageName}\0${adapter.exactVersion}\0${installedSourceTreeHash}`,
    ),
  };
};

validateInputFieldComparisonMatrix(INPUT_FIELD_COMPARISON_CELLS);
for (const library of INPUT_FIELD_COMPARISON_LIBRARIES) {
  assert.deepEqual(
    REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[library].unsupportedAgreedCells,
    [],
    `${library}: agreed matrix contains a source blocker`,
  );
}
const pins = {
  mui: packagePin("mui"),
  polaris: packagePin("polaris"),
};
const fixtureHash = hashFiles([
  path.join(REPO, "recipe/input-field-comparison-fixture.ts"),
  path.join(REPO, "recipe/fixtures/library-input-fields.ts"),
  path.join(REPO, "recipe/fixtures/input-field.ts"),
  path.join(REPO, "examples/mui/contracts/text-field.contract.json"),
  path.join(REPO, "examples/polaris/contracts/text-field.contract.json"),
]);
const sampleMatrixHash = sha256(JSON.stringify(INPUT_FIELD_COMPARISON_CELLS));
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: REPO,
  encoding: "utf8",
}).trim();
const harnessHash = fileHash(
  path.join(REPO, "recipe/capture-input-field-comparison.ts"),
);
const sourceAdapterHashes = Object.fromEntries(
  INPUT_FIELD_COMPARISON_LIBRARIES.map((library) => [
    library,
    sha256(JSON.stringify(REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[library])),
  ]),
) as Record<InputFieldComparisonLibrary, string>;

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
  locale: "en-US",
  timezone: "UTC",
  fonts: fontFiles.map((file) => ({
    file: relative(file),
    hash: fileHash(file),
  })),
  fontsHash,
};
const environmentHash = sha256(JSON.stringify(environment));
const protocol = {
  version: INPUT_FIELD_COMPARISON_PROTOCOL_VERSION,
  rubricHash: sha256(
    "Recognisable as the same Input/Field source cell; record concrete defects and confidence; do not rank specimens.",
  ),
  environmentHash,
  crop: "painted-union+24-css-px-white-margin",
  scale: DPR,
  browser: `${browserVersion} (playwright chromium-${browserRevision})`,
  fontsHash,
  passThreshold:
    "independent recognisable=true for each specimen against its paired original-source reference",
};

const references: Captured[] = [];
const legacyOutputs: Captured[] = [];
const recipeOutputs: Captured[] = [];
const wcOutputs: Captured[] = [];
const { context, page } = await newGatePage(browser);
const wcIsolated = await newGatePage(browser);
try {
  for (const cell of INPUT_FIELD_COMPARISON_CELLS) {
    const name = artifactName(cell.key);
    references.push(
      await captureDocument(
        page,
        cell,
        sourceHtml(cell, sourceBundles[cell.library]),
        path.join(refsDirectory, name),
        true,
      ),
    );
    legacyOutputs.push(
      await captureDocument(
        page,
        cell,
        legacyHtml(cell),
        path.join(legacyDirectory, name),
        false,
      ),
    );
    recipeOutputs.push(
      await captureDocument(
        page,
        cell,
        recipeReactHtml(cell),
        path.join(reactDirectory, name),
        false,
      ),
    );
    wcOutputs.push(
      await captureDocument(
        wcIsolated.page,
        cell,
        recipeWcHtml(cell),
        path.join(wcDirectory, name),
        false,
        true,
      ),
    );
  }
} finally {
  await wcIsolated.context.close();
  await context.close();
  await browser.close();
}

const byCell = <T extends { cellKey: string }>(values: T[]): Map<string, T> =>
  new Map(values.map((value) => [value.cellKey, value]));
const referenceByCell = byCell(references);
const wcByCell = byCell(wcOutputs);
const comparedPixels = (left: Captured, right: Captured): number => {
  const pixels =
    Math.min(left.width, right.width) * Math.min(left.height, right.height);
  if (!Number.isSafeInteger(pixels) || pixels <= 0) {
    throw new Error(`${right.cellKey}: ZERO-COMPARED-PIXELS`);
  }
  return pixels;
};
for (const react of recipeOutputs) {
  const webComponent = wcByCell.get(react.cellKey);
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
  assert.deepEqual(
    webComponent.dom,
    react.dom,
    `${react.cellKey}: Web Component semantic structure differs from React`,
  );
}

const referenceHashes: Record<string, string> = {};
const referenceProvenance: Record<string, SourceReferenceProvenance> = {};
for (const reference of references) {
  const cell = INPUT_FIELD_COMPARISON_CELLS.find(
    (candidate) => candidate.key === reference.cellKey,
  )!;
  const adapter = REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[cell.library];
  const pin = pins[cell.library];
  const captureInputHash = sha256(
    [
      pin.sourceHash,
      sourceAdapterHashes[cell.library],
      harnessHash,
      environmentHash,
      cell.key,
      CAPTURE_COMMAND,
    ].join("\0"),
  );
  referenceHashes[cell.key] = reference.hash;
  referenceProvenance[cell.key] = {
    sourceKind: "external-library-package",
    externalOwner: adapter.externalOwner,
    sourceId: adapter.packageName,
    sourceVersionOrRevision: adapter.exactVersion,
    sourceHash: pin.sourceHash,
    packageLockHash: pin.packageLockHash,
    packageIntegrity: pin.packageIntegrity,
    componentOrNodeId: adapter.component,
    sourceAdapterHash: sourceAdapterHashes[cell.library],
    renderHarnessHash: harnessHash,
    captureInputHash,
    browser: protocol.browser,
    browserRevision,
    browserExecutableHash,
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    fontsHash,
    environmentHash,
    cellKey: cell.key,
    screenshotHash: reference.hash,
    captureCommand: CAPTURE_COMMAND,
    producedBy: "independent-original-package-component-harness",
    independentHarness: true,
  };
}

const manifestFor = (outputs: Captured[]): ComparisonOutputManifest => ({
  fixtureHash,
  sampleMatrixHash,
  cells: outputs.map((output) => ({
    cellKey: output.cellKey,
    outputHash: output.hash,
    referenceHash: referenceByCell.get(output.cellKey)!.hash,
    comparedPixels: comparedPixels(
      referenceByCell.get(output.cellKey)!,
      output,
    ),
  })),
});
const legacyManifest = manifestFor(legacyOutputs);
const recipeManifest = manifestFor(recipeOutputs);
const wcManifest = manifestFor(wcOutputs);
const comparisonPin: PinnedComparisonFixture = {
  sourceCommit,
  fixtureHash,
  sampleMatrixHash,
  cellKeys: INPUT_FIELD_COMPARISON_CELLS.map((cell) => cell.key),
  referenceHashes,
  referenceProvenance,
  protocol,
};
validatePinnedComparisonEvidence(comparisonPin, legacyManifest, recipeManifest);

const blindSeed = sha256(
  `${fixtureHash}\0${sampleMatrixHash}\0${environmentHash}\0input-field-blind-order-v1`,
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
const packetCells = INPUT_FIELD_COMPARISON_CELLS.map((cell) => {
  const reference = referenceByCell.get(cell.key)!;
  const anonymousCell = `cell-${sha256(`${blindSeed}\0${cell.key}`).slice(0, 12)}`;
  const referenceName = `${anonymousCell}.png`;
  copyFileSync(
    path.join(
      NEXT,
      reference.file.replace("recipe/evidence/input-field-comparison/", ""),
    ),
    path.join(blindRefs, referenceName),
  );
  const candidates = [
    {
      implementationPath: "legacy" as const,
      artifact: byCell(legacyOutputs).get(cell.key)!,
    },
    {
      implementationPath: "recipe-react" as const,
      artifact: byCell(recipeOutputs).get(cell.key)!,
    },
  ]
    .map((candidate) => ({
      ...candidate,
      anonymousLabel: `specimen-${sha256(
        `${blindSeed}\0${cell.key}\0${candidate.implementationPath}`,
      ).slice(0, 12)}`,
    }))
    .sort((left, right) =>
      left.anonymousLabel < right.anonymousLabel ? -1 : 1,
    );
  const specimens = candidates.map((candidate) => {
    const name = `${candidate.anonymousLabel}.png`;
    copyFileSync(
      path.join(
        NEXT,
        candidate.artifact.file.replace(
          "recipe/evidence/input-field-comparison/",
          "",
        ),
      ),
      path.join(blindSpecimens, name),
    );
    answerKey.push({
      anonymousCell,
      anonymousLabel: candidate.anonymousLabel,
      implementationPath: candidate.implementationPath,
      cellKey: cell.key,
      outputHash: candidate.artifact.hash,
    });
    return {
      anonymousLabel: candidate.anonymousLabel,
      image: `specimens/${name}`,
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
}).sort((left, right) => (left.anonymousCell < right.anonymousCell ? -1 : 1));
assert.equal(
  packetCells.length,
  128,
  "blind packet must contain 128 references",
);
assert.equal(answerKey.length, 256, "blind packet must contain 256 specimens");
assert.equal(
  new Set(answerKey.map((answer) => answer.anonymousLabel)).size,
  256,
  "blind specimen labels must be unique",
);
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
  version: INPUT_FIELD_COMPARISON_PROTOCOL_VERSION,
  status: "awaiting-independent-blind-grade",
  instructions: [
    "Use only this blind-packet directory. Do not inspect parent directories, source code, or any answer key.",
    "For every opaque cell, compare both opaque specimens independently with its reference.",
    "Set recognisable to true or false, list concrete defects for every false result, and record low, medium, or high confidence.",
    "Do not rank specimens, infer implementation identity, or lower the 256-specimen scope.",
  ],
  protocol,
  randomizedBatchHash,
  counts: { references: 128, specimens: 256, specimensPerReference: 2 },
  cells: packetCells,
};
writeJson(path.join(blindPacketDirectory, "packet.json"), packet);
writeJson(path.join(NEXT, "sealed-answer-key.json"), {
  version: INPUT_FIELD_COMPARISON_PROTOCOL_VERSION,
  sealedFromBlindGrader: true,
  randomizationSeedHash: sha256(blindSeed),
  randomizedBatchHash,
  answers: answerKey,
});

const expectedDomFor = (cell: InputFieldComparisonCell) => ({
  value:
    cell.content === "value"
      ? REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[cell.library].text.value
      : "",
  placeholder:
    REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[cell.library].text.placeholder,
  required: cell.required === "true",
  disabled: cell.state === "disabled",
  invalid: cell.state === "error",
  adornments: cell.adornments === "both" ? 2 : 0,
});
for (const output of [...recipeOutputs, ...wcOutputs]) {
  const cell = INPUT_FIELD_COMPARISON_CELLS.find(
    (candidate) => candidate.key === output.cellKey,
  )!;
  const expected = expectedDomFor(cell);
  assert.equal(output.dom.labelForMatches, true);
  assert.equal(output.dom.accessibleNameMatched, true);
  assert.equal(output.dom.value, expected.value);
  assert.equal(output.dom.placeholder, expected.placeholder);
  assert.equal(output.dom.required, expected.required);
  assert.equal(output.dom.disabled, expected.disabled);
  assert.equal(output.dom.ariaInvalid === "true", expected.invalid);
  assert.equal(output.dom.structure.adornments, expected.adornments);
}

const totalComparedPixels = (manifest: ComparisonOutputManifest): number =>
  manifest.cells.reduce((total, cell) => total + cell.comparedPixels, 0);
const legacyCellSupport = INPUT_FIELD_COMPARISON_CELLS.map((cell) => ({
  cellKey: cell.key,
  outputPresent: true,
  unsupportedMappings:
    REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[cell.library]
      .legacyUnsupportedMappings,
}));
const eventContract = Object.fromEntries(
  INPUT_FIELD_COMPARISON_LIBRARIES.map((library) => {
    const output = recipeBundles.get(library)!;
    const react = output.react.find((file) =>
      file.path.endsWith("InputField.tsx"),
    )!.contents;
    const wc = output.webComponent.find((file) =>
      file.path.endsWith("recipe-input-field.js"),
    )!.contents;
    return [
      library,
      {
        react: {
          input: react.includes("onInput={onInput}"),
          change: react.includes("onChange={onChange}"),
          focus: react.includes("onFocus={onFocus}"),
          blur: react.includes("onBlur={onBlur}"),
        },
        webComponent: {
          input: wc.includes('"value-input"'),
          change: wc.includes('"value-change"'),
          focus: wc.includes('["focus", "blur"]'),
          blur: wc.includes('["focus", "blur"]'),
        },
      },
    ];
  }),
);
assert.equal(
  Object.values(eventContract)
    .flatMap((surface) => [
      ...Object.values(surface.react),
      ...Object.values(surface.webComponent),
    ])
    .every(Boolean),
  true,
  "recipe event contract is incomplete",
);

const packetPath =
  "recipe/evidence/input-field-comparison/blind-packet/packet.json";
const sealedKeyPath =
  "recipe/evidence/input-field-comparison/sealed-answer-key.json";
const gradingPrompt = [
  "Act as the independent blind grader for the Input/Field paired benchmark.",
  `Open only ${packetPath} and files beneath its blind-packet directory; do not inspect parent evidence, source code, or ${sealedKeyPath}.`,
  "Grade all 256 opaque specimens against their 128 paired references exactly as instructed in packet.json.",
  "For each specimen set recognisable to true or false, provide at least one concrete visual defect when false, and record low, medium, or high confidence.",
  "Do not rank specimens, guess implementation identity, omit a cell, or reduce scope.",
  "Write the completed grade artifact as blind-packet/grades.json with grader identity, the packet protocol and randomizedBatchHash, and one grade per anonymous specimen. Do not unseal or adjudicate the answer key.",
].join(" ");
const packetHash = fileHash(path.join(blindPacketDirectory, "packet.json"));
const receipt = {
  version: 1,
  status: {
    evidenceGeneration: "complete",
    independentBlindGrade: "pending",
    legacyRecognisability: "ungraded",
    recipeReactRecognisability: "ungraded",
    recipeWebComponentRecognisability: "ungraded-parity-only",
    inputFieldOverall: false,
  },
  historicalInputFieldContext: {
    sets: 11,
    recognisableSets: 3,
    totalVariants: 1415,
    variantWeightedSetVerdict: "1349/1415",
    changed: false,
    evidence: "recipe/evidence/pivot-comparison.json#legacyContext.inputField",
    whyNotPairedBaseline:
      "The census uses 11 heterogeneous contracts and capped historical samples, not these two real packages rendered over the frozen 128-cell Size×State×Content×Required×Adornments denominator.",
  },
  matrix: {
    frozenBeforeRender: true,
    sampleMatrixHash,
    axesCompared: ["Size", "State", "Content", "Required", "Adornments"],
    values: {
      Size: INPUT_FIELD_COMPARISON_SIZES,
      State: INPUT_FIELD_COMPARISON_STATES,
      Content: INPUT_FIELD_COMPARISON_CONTENT,
      Required: INPUT_FIELD_COMPARISON_REQUIRED,
      Adornments: INPUT_FIELD_COMPARISON_ADORNMENTS,
    },
    recipeVariantsPerSource: 128,
    pairedCellsPerSource: 64,
    libraries: 2,
    totalSourceCells: 128,
    cells: INPUT_FIELD_COMPARISON_CELLS,
    everyAxisValueCovered: true,
    everyCellMapsExactlyOncePerSource: true,
  },
  reviewedMappings: Object.fromEntries(
    INPUT_FIELD_COMPARISON_LIBRARIES.map((library) => [
      library,
      {
        setupSeconds:
          REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[library].manualSetupSeconds,
        decisions:
          REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[library].mappingDecisions,
        unsupportedAgreedCells:
          REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[library].unsupportedAgreedCells,
        unsupportedMappingsOutsideMatrix:
          REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[library]
            .unsupportedMappingsOutsideMatrix,
        legacyUnsupportedMappings:
          REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[library]
            .legacyUnsupportedMappings,
      },
    ]),
  ),
  provenance: {
    sourceCommit,
    fixtureHash,
    harnessHash,
    captureCommand: CAPTURE_COMMAND,
    captureCommandHash: sha256(CAPTURE_COMMAND),
    sourceAdapterHashes,
    packages: pins,
    adapters: REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS,
    environment,
    environmentHash,
  },
  references,
  outputs: {
    legacy: legacyOutputs,
    recipeReact: recipeOutputs,
    recipeWebComponent: wcOutputs,
  },
  comparisonPin,
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
    blindReferences: packetCells.length,
    blindSpecimens: answerKey.length,
  },
  comparisonCompleteness: {
    sourceCells: "128/128",
    legacyCells: "128/128",
    recipeReactCells: "128/128",
    recipeWebComponentCells: "128/128",
    packetReferences: "128/128",
    packetSpecimens: "256/256",
    exactDenominatorParity: true,
    claimsRestrictedToFrozenMatrix: true,
    legacyCellSupport,
    nonComparableBlockers: [],
  },
  nonvisualEvidence: {
    legacyComparedPixels: totalComparedPixels(legacyManifest),
    recipeReactComparedPixels: totalComparedPixels(recipeManifest),
    recipeWebComponentComparedPixels: totalComparedPixels(wcManifest),
    zeroPixelComparisons: 0,
    sourceReferenceIndependence: true,
    sourceReferenceProvenanceComplete: true,
    deterministicStateStimulation:
      "default is static; focus-visible uses reviewed focused source props plus sentinel-keyboard focus; error and disabled use explicit package props; capture waits for mounted input, document fonts, and two animation frames",
    acquisitionAccounting: Object.fromEntries(acquisitionReports),
    deterministicEmission: Object.fromEntries(deterministicEmission),
    semanticApiAria: {
      labelInputAssociation: "256/256 recipe outputs",
      nativeRequired: "256/256 recipe outputs match cells",
      nativeDisabled: "256/256 recipe outputs match cells",
      ariaInvalid: "256/256 recipe outputs match cells",
      ariaDescribedBy: "present with helper/error message",
      contentPolicy: "256/256 recipe outputs match value/placeholder cells",
      adornments: "256/256 recipe outputs match none/both cells",
      events: eventContract,
    },
    recipeWebComponentParity: {
      cells: 128,
      nonzeroCells: 128,
      pixelHashEqualToReact: 128,
      geometryEqualToReact: 128,
      semanticProbeEqualToReact: 128,
      includedInBlindSpecimens: false,
    },
  },
  blindPacket: {
    path: packetPath,
    sealedAnswerKey: sealedKeyPath,
    packetHash,
    randomizedBatchHash,
    recognisabilityVerdictsAuthoredByBuilder: false,
    exactIndependentGradingPrompt: gradingPrompt,
  },
};
const receiptPath = path.join(NEXT, "receipt.json");
writeJson(receiptPath, receipt);
const index = {
  version: 1,
  archetype: "input / field",
  status: "false-ungraded",
  overall: false,
  gradeWritten: false,
  receipt: "recipe/evidence/input-field-comparison/receipt.json",
  receiptHash: fileHash(receiptPath),
  packet: packetPath,
  packetHash,
  sealedAnswerKey: sealedKeyPath,
  counts: receipt.counts,
  comparisonCompleteness: receipt.comparisonCompleteness,
};
writeJson(path.join(NEXT, "index.json"), index);

rmSync(EVIDENCE, { recursive: true, force: true });
renameSync(NEXT, EVIDENCE);
console.log(
  `Input/Field comparison evidence: ${references.length} references, ${legacyOutputs.length} legacy, ${recipeOutputs.length} recipe React, ${wcOutputs.length} recipe WC; ${answerKey.length} blind specimens; status false/ungraded`,
);
