import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

import {
  captureCell,
  launchGateBrowser,
  newGatePage,
  type Interaction,
} from "../extract/figma/canvas-gate/shots.js";
import {
  chromiumExecutable,
  pinnedChromiumRevision,
} from "../extract/figma/visual-parity/render.js";
import {
  adaptReviewedInputField,
  auditReviewedInputFieldAcquisition,
} from "./adapters/input-field.js";
import {
  INPUT_FIELD_COMPARISON_CELLS,
  INPUT_FIELD_COMPARISON_LIBRARIES,
  REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS,
  validateInputFieldComparisonMatrix,
  type InputFieldComparisonCell,
  type InputFieldComparisonLibrary,
} from "./input-field-comparison-fixture.js";
import type {
  ComparisonOutputManifest,
  PinnedComparisonFixture,
} from "./comparison.js";
import {
  muiInputFieldAdapterConfig,
  polarisInputFieldAdapterConfig,
} from "./fixtures/library-input-fields.js";
import { canonicalJson } from "./normalize.js";
import { emitInputFieldOutputs } from "./output/input-field.js";
import {
  collapseInputFieldRecipe,
  compileInputFieldRecipe,
} from "./recipes/input-field.js";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const V1 = path.join(REPO, "recipe/evidence/input-field-comparison");
const EVIDENCE_VERSION = process.argv.includes("--v3") ? 3 : 2;
const TARGET_NAME = `input-field-comparison-v${EVIDENCE_VERSION}`;
const TARGET = path.join(REPO, `recipe/evidence/${TARGET_NAME}`);
const NEXT = path.join(REPO, `recipe/evidence/.${TARGET_NAME}-next`);
const VERSION = `input-field-paired-source-v${EVIDENCE_VERSION}`;
const VIEWPORT = { width: 600, height: 800 };
const DPR = 2;

const sha256 = (bytes: string | Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");
const fileHash = (file: string): string => sha256(readFileSync(file));
const json = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;
const writeJson = (file: string, value: unknown): void =>
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const relative = (file: string): string =>
  path.relative(REPO, file).split(path.sep).join("/");
const evidencePath = (file: string): string =>
  relative(file).replace(
    `recipe/evidence/.${TARGET_NAME}-next`,
    `recipe/evidence/${TARGET_NAME}`,
  );

interface DomProbe {
  inputFound: boolean;
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

interface V1Receipt {
  version: number;
  matrix: { cells: InputFieldComparisonCell[]; sampleMatrixHash: string };
  provenance: {
    sourceCommit: string;
    fixtureHash: string;
    environment: Record<string, unknown> & {
      browser: string;
      browserRevision: string;
      browserExecutableHash: string;
      fontsHash: string;
    };
    environmentHash: string;
  };
  references: Captured[];
  outputs: { legacy: Captured[] };
  comparisonPin: PinnedComparisonFixture;
  manifests: { legacy: ComparisonOutputManifest };
}

interface V1Adjudication {
  mapping: Array<{
    recognisable: boolean;
    implementation: "legacy" | "recipe-react";
    cellKey: string;
    sourceLibrary: string;
    size: string;
    state: string;
    contentMode: string;
    required: string;
    adornments: string;
    defects: string[];
  }>;
  defects: {
    byImplementation: Record<
      string,
      {
        failedSpecimens: number;
        statements: number;
        classes: Record<
          string,
          { failedSpecimens: number; statements: number }
        >;
      }
    >;
  };
}

const v1 = json<V1Receipt>(path.join(V1, "receipt.json"));
const adjudication = json<V1Adjudication>(
  path.join(V1, "comparison-result.json"),
);
validateInputFieldComparisonMatrix(INPUT_FIELD_COMPARISON_CELLS);
assert.equal(v1.version, 1);
assert.equal(
  canonicalJson(v1.matrix.cells),
  canonicalJson(INPUT_FIELD_COMPARISON_CELLS),
  "REFUSE: v1 matrix differs from the required 128-cell source matrix",
);
assert.equal(
  v1.matrix.sampleMatrixHash,
  sha256(JSON.stringify(INPUT_FIELD_COMPARISON_CELLS)),
  "REFUSE: v1 matrix hash differs",
);

const immutable = [...v1.references, ...v1.outputs.legacy];
assert.equal(v1.references.length, 128);
assert.equal(v1.outputs.legacy.length, 128);
for (const artifact of immutable) {
  const source = path.join(REPO, artifact.file);
  assert.equal(
    fileHash(source),
    artifact.hash,
    `REFUSE: immutable v1 artifact bytes differ: ${artifact.file}`,
  );
}

const genericFiles = [
  "recipe/recipes/input-field.ts",
  "recipe/adapters/input-field.ts",
  "recipe/output/input-field.ts",
];
const genericBytes = genericFiles
  .map((file) => readFileSync(path.join(REPO, file), "utf8").toLowerCase())
  .join("\n");
for (const identity of [
  "mui",
  "polaris",
  "@mui/material",
  "@shopify/polaris",
  "mui.text-field",
  "polaris.text-field",
  "material#textfield",
  "shopify",
]) {
  assert.equal(
    genericBytes.includes(identity),
    false,
    `CONTROL FAILED: generic Input/Field logic contains source identity ${identity}`,
  );
}

const contractByLibrary = {
  mui: json<unknown>(
    path.join(REPO, "examples/mui/contracts/text-field.contract.json"),
  ),
  polaris: json<unknown>(
    path.join(REPO, "examples/polaris/contracts/text-field.contract.json"),
  ),
};
const configByLibrary = {
  mui: muiInputFieldAdapterConfig,
  polaris: polarisInputFieldAdapterConfig,
};
const bundles = new Map<
  InputFieldComparisonLibrary,
  ReturnType<typeof emitInputFieldOutputs>
>();
const acquisition = new Map<
  InputFieldComparisonLibrary,
  ReturnType<typeof auditReviewedInputFieldAcquisition>
>();
const fixedPoints = new Map<InputFieldComparisonLibrary, boolean>();
const deterministicEmission = new Map<
  InputFieldComparisonLibrary,
  {
    byteIdenticalTwoRun: boolean;
    reactHash: string;
    webComponentHash: string;
  }
>();
for (const library of INPUT_FIELD_COMPARISON_LIBRARIES) {
  const source = contractByLibrary[library];
  const config = configByLibrary[library];
  const instance = adaptReviewedInputField(source, config);
  const report = auditReviewedInputFieldAcquisition(source, config, instance);
  assert.deepEqual(report.failures, []);
  assert.ok(report.parameterFields > 0);
  assert.ok(Object.values(report.byField).every((count) => count > 0));
  acquisition.set(library, report);
  const firstEnvelope = compileInputFieldRecipe(instance);
  const firstCollapse = collapseInputFieldRecipe(
    firstEnvelope,
    instance.provenance.selection,
  );
  const secondEnvelope = compileInputFieldRecipe(firstCollapse);
  const secondCollapse = collapseInputFieldRecipe(
    secondEnvelope,
    instance.provenance.selection,
  );
  const thirdEnvelope = compileInputFieldRecipe(secondCollapse);
  const fixed =
    canonicalJson(firstEnvelope) === canonicalJson(secondEnvelope) &&
    canonicalJson(secondEnvelope) === canonicalJson(thirdEnvelope) &&
    canonicalJson(firstCollapse) === canonicalJson(secondCollapse);
  assert.equal(fixed, true, `${library}: two-cycle fixed point differs`);
  fixedPoints.set(library, fixed);
  const first = emitInputFieldOutputs(
    firstEnvelope,
    instance.provenance.selection,
  );
  const second = emitInputFieldOutputs(
    firstEnvelope,
    instance.provenance.selection,
  );
  assert.deepEqual(first, second);
  bundles.set(library, first);
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
  const css = first.react.find((file) => file.path.endsWith(".css"))!.contents;
  const definitions = new Set(
    [...css.matchAll(/^\s*(--[^:]+):/gm)].map((match) => match[1]),
  );
  const references = [...css.matchAll(/var\((--[^)]+)\)/g)].map(
    (match) => match[1]!,
  );
  assert.ok(references.length > 0);
  assert.ok(references.every((reference) => definitions.has(reference)));
}

const fontFiles = [
  "extract/computed/fonts/roboto/roboto-latin-400-normal.woff2",
  "extract/computed/fonts/roboto/roboto-latin-500-normal.woff2",
  "extract/computed/fonts/roboto/roboto-latin-700-normal.woff2",
  "extract/computed/fonts/inter/inter-latin-variable.woff2",
].map((file) => path.join(REPO, file));
const hashFiles = (files: string[]): string => {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(`${relative(file)}\0`);
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
};
const dataFont = (file: string): string =>
  `data:font/woff2;base64,${readFileSync(file).toString("base64")}`;
const fontCss = `
@font-face { font-family: "Roboto"; src: url("${dataFont(fontFiles[0]!)}") format("woff2"); font-style: normal; font-weight: 400; font-display: block; }
@font-face { font-family: "Roboto"; src: url("${dataFont(fontFiles[1]!)}") format("woff2"); font-style: normal; font-weight: 500; font-display: block; }
@font-face { font-family: "Roboto"; src: url("${dataFont(fontFiles[2]!)}") format("woff2"); font-style: normal; font-weight: 700; font-display: block; }
@font-face { font-family: "Inter"; src: url("${dataFont(fontFiles[3]!)}") format("woff2"); font-style: normal; font-weight: 100 900; font-display: block; }
`;
const frameCss = `
html { color-scheme: light; }
body { margin: 0; padding: 24px; background: #fff; color: #1e1e1e; font-family: Inter, system-ui, sans-serif; }
.gate-cell { display: flex; align-items: flex-start; width: max-content; margin: 0 0 64px 0; }
*, *::before, *::after { animation-play-state: paused !important; transition: none !important; caret-color: transparent !important; }
`;
assert.equal(
  hashFiles(fontFiles),
  v1.provenance.environment.fontsHash,
  "REFUSE: font bytes differ from v1",
);
assert.equal(
  fileHash(chromiumExecutable()),
  v1.provenance.environment.browserExecutableHash,
  "REFUSE: Chromium executable bytes differ from v1",
);
assert.equal(
  pinnedChromiumRevision(),
  v1.provenance.environment.browserRevision,
  "REFUSE: Chromium revision differs from v1",
);

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
  const module = { exports: {} as Record<string, unknown> };
  Function(
    "require",
    "module",
    "exports",
    transpiled,
  )(
    (id: string): unknown => {
      if (id === "react") return React;
      if (id === "react/jsx-runtime") return nodeRequire("react/jsx-runtime");
      throw new Error(`unexpected generated import ${id}`);
    },
    module,
    module.exports,
  );
  const InputField = module.exports.InputField as React.ElementType;
  return renderToStaticMarkup(React.createElement(InputField, props));
};

const reactHtml = (cell: InputFieldComparisonCell): string => {
  const adapter = REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[cell.library];
  const output = bundles.get(cell.library)!;
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
    onChange() {},
  });
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}</style><style>${frameCss}</style><style>${css.contents}</style></head><body>
<button data-sentinel="${cell.key}" aria-label="sentinel" style="width:8px;height:8px;padding:0;border:0;margin:0 0 28px 0;background:#eee"></button>
<div class="gate-cell" data-cell="${cell.key}">${markup}</div></body></html>`;
};

const wcHtml = (cell: InputFieldComparisonCell): string => {
  const adapter = REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[cell.library];
  const source = bundles
    .get(cell.library)!
    .webComponent.find((file) =>
      file.path.endsWith("recipe-input-field.js"),
    )!.contents;
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
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}</style><style>${frameCss}</style></head><body>
<button data-sentinel="${cell.key}" aria-label="sentinel" style="width:8px;height:8px;padding:0;border:0;margin:0 0 28px 0;background:#eee"></button>
<div class="gate-cell" data-cell="${cell.key}"><recipe-input-field style="display:inline-flex" ${attrs}>${slots}</recipe-input-field></div>
<script>${source.replaceAll("export ", "")}</script></body></html>`;
};

const probeDom = async (
  page: Awaited<ReturnType<typeof newGatePage>>["page"],
  label: string,
): Promise<DomProbe> =>
  (await page.evaluate(`(() => {
    const stage = document.querySelector("[data-cell]");
    const host = stage && stage.firstElementChild;
    const root = host && host.shadowRoot ? host.shadowRoot : stage;
    const inputs = root ? [...root.querySelectorAll("input")] : [];
    const input = inputs[0];
    const labels = root ? [...root.querySelectorAll("label")] : [];
    const controlLabel = input ? labels.find((candidate) => candidate.htmlFor === input.id) : labels[0];
    const scope = input && input.closest(".recipe-input-field") || root;
    const all = (selector) => scope ? [...scope.querySelectorAll(selector)] : [];
    const labelText = controlLabel ? (controlLabel.textContent || "").replace(/\\s+/g, " ").trim() : "";
    return {
      inputFound: !!input,
      labelFound: !!controlLabel,
      labelForMatches: !!(input && controlLabel && controlLabel.htmlFor === input.id),
      accessibleNameMatched: !!(input && controlLabel && controlLabel.htmlFor === input.id && labelText.includes(${JSON.stringify(label)})),
      value: input ? input.value : "",
      placeholder: input ? input.getAttribute("placeholder") || "" : "",
      required: !!(input && input.required),
      disabled: !!(input && input.disabled),
      ariaInvalid: input ? input.getAttribute("aria-invalid") : null,
      ariaDescribedBy: input ? input.getAttribute("aria-describedby") : null,
      structure: {
        labels: all("label").length,
        inputs: all("input").length,
        messages: all(".recipe-input-field__message").length,
        adornments: all(".recipe-input-field__adornment").length,
      },
    };
  })()`)) as DomProbe;

const capture = async (
  page: Awaited<ReturnType<typeof newGatePage>>["page"],
  cell: InputFieldComparisonCell,
  html: string,
  file: string,
  reset = false,
): Promise<Captured> => {
  if (reset) await page.goto("about:blank");
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate("document.fonts.ready");
  const interaction: Interaction =
    cell.state === "focus-visible" ? "focus-visible" : "default";
  const shot = await captureCell(page, cell.key, interaction);
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
  assert.ok(paintedPixels > 0, `${cell.key}: ZERO-PAINTED-PIXELS`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, shot.png);
  const dom = await probeDom(
    page,
    REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[cell.library].text.label,
  );
  assert.ok(
    dom.inputFound &&
      dom.labelFound &&
      dom.labelForMatches &&
      dom.accessibleNameMatched,
    `${cell.key}: semantic label/input association differs`,
  );
  return {
    cellKey: cell.key,
    file: evidencePath(file),
    hash: sha256(shot.png),
    width: png.width,
    height: png.height,
    paintedPixels,
    contentBox: shot.contentBox,
    ...(shot.focusVisibleMatched === undefined
      ? {}
      : { focusVisibleMatched: shot.focusVisibleMatched }),
    dom,
  };
};

rmSync(NEXT, { recursive: true, force: true });
mkdirSync(NEXT, { recursive: true });
const references: Captured[] = [];
const legacy: Captured[] = [];
for (const [kind, input, output] of [
  ["source-reference", v1.references, references],
  ["legacy", v1.outputs.legacy, legacy],
] as const) {
  for (const artifact of input) {
    const destination = path.join(NEXT, kind, path.basename(artifact.file));
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(path.join(REPO, artifact.file), destination);
    assert.equal(
      fileHash(destination),
      artifact.hash,
      `REFUSE: ${kind} copy differs from v1`,
    );
    output.push({ ...artifact, file: evidencePath(destination) });
  }
}

const browser = await launchGateBrowser();
assert.equal(
  browser.version(),
  v1.provenance.environment.browser,
  "REFUSE: browser version differs from v1 environment",
);
const reactPage = await newGatePage(browser);
const wcPage = await newGatePage(browser);
const recipeReact: Captured[] = [];
const recipeWebComponent: Captured[] = [];
try {
  for (const cell of INPUT_FIELD_COMPARISON_CELLS) {
    const name = path.basename(
      v1.references.find((artifact) => artifact.cellKey === cell.key)!.file,
    );
    recipeReact.push(
      await capture(
        reactPage.page,
        cell,
        reactHtml(cell),
        path.join(NEXT, "recipe-react", name),
      ),
    );
    recipeWebComponent.push(
      await capture(
        wcPage.page,
        cell,
        wcHtml(cell),
        path.join(NEXT, "recipe-wc", name),
        true,
      ),
    );
  }
} finally {
  await reactPage.context.close();
  await wcPage.context.close();
  await browser.close();
}

const byCell = <T extends { cellKey: string }>(values: T[]): Map<string, T> =>
  new Map(values.map((value) => [value.cellKey, value]));
const wcByCell = byCell(recipeWebComponent);
let byteHashEqualToReact = 0;
let renderedPixelHashEqualToReact = 0;
let perceptualPixelEqualToReact = 0;
let pixelComparisons = 0;
const pixelHash = (artifact: Captured): string => {
  const kind = artifact.file.includes("/recipe-wc/")
    ? "recipe-wc"
    : "recipe-react";
  const png = PNG.sync.read(
    readFileSync(path.join(NEXT, kind, path.basename(artifact.file))),
  );
  return sha256(
    Buffer.concat([
      Buffer.from(`${png.width}x${png.height}\0`),
      Buffer.from(png.data),
    ]),
  );
};
for (const react of recipeReact) {
  const wc = wcByCell.get(react.cellKey);
  assert.ok(wc);
  assert.deepEqual(
    wc.contentBox,
    react.contentBox,
    `${react.cellKey}: WC geometry differs: ${JSON.stringify({ react: react.contentBox, wc: wc.contentBox })}`,
  );
  pixelComparisons += 1;
  if (wc.hash === react.hash) byteHashEqualToReact += 1;
  if (pixelHash(wc) === pixelHash(react)) renderedPixelHashEqualToReact += 1;
  const reactPng = PNG.sync.read(
    readFileSync(path.join(NEXT, "recipe-react", path.basename(react.file))),
  );
  const wcPng = PNG.sync.read(
    readFileSync(path.join(NEXT, "recipe-wc", path.basename(wc.file))),
  );
  assert.equal(reactPng.width, wcPng.width);
  assert.equal(reactPng.height, wcPng.height);
  if (
    pixelmatch(
      reactPng.data,
      wcPng.data,
      undefined,
      reactPng.width,
      reactPng.height,
      { threshold: 0.1 },
    ) === 0
  ) {
    perceptualPixelEqualToReact += 1;
  }
  assert.deepEqual(wc.dom, react.dom, `${react.cellKey}: WC semantics differ`);
}
assert.equal(pixelComparisons, 128);
assert.equal(
  perceptualPixelEqualToReact,
  128,
  "React/WC perceptual pixel parity differs",
);

for (const output of [...recipeReact, ...recipeWebComponent]) {
  const cell = INPUT_FIELD_COMPARISON_CELLS.find(
    (candidate) => candidate.key === output.cellKey,
  )!;
  const text = REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[cell.library].text;
  assert.equal(output.dom.value, cell.content === "value" ? text.value : "");
  assert.equal(output.dom.placeholder, text.placeholder);
  assert.equal(output.dom.required, cell.required === "true");
  assert.equal(output.dom.disabled, cell.state === "disabled");
  assert.equal(output.dom.ariaInvalid === "true", cell.state === "error");
  assert.equal(
    output.dom.structure.adornments,
    cell.adornments === "both" ? 2 : 0,
  );
  assert.ok(output.dom.ariaDescribedBy);
}

const referenceByCell = byCell(references);
const manifestFor = (outputs: Captured[]): ComparisonOutputManifest => ({
  fixtureHash: v1.comparisonPin.fixtureHash,
  sampleMatrixHash: v1.comparisonPin.sampleMatrixHash,
  cells: outputs.map((output) => {
    const reference = referenceByCell.get(output.cellKey)!;
    const comparedPixels =
      Math.min(reference.width, output.width) *
      Math.min(reference.height, output.height);
    assert.ok(comparedPixels > 0);
    return {
      cellKey: output.cellKey,
      outputHash: output.hash,
      referenceHash: reference.hash,
      comparedPixels,
    };
  }),
});
const recipeManifest = manifestFor(recipeReact);
const wcManifest = manifestFor(recipeWebComponent);

const v1RecipeFailures = adjudication.mapping.filter(
  (grade) =>
    grade.implementation === "recipe-react" && grade.recognisable === false,
);
assert.equal(v1RecipeFailures.length, 88);
assert.equal(
  v1RecipeFailures.reduce((total, grade) => total + grade.defects.length, 0),
  271,
);
const defectClass = (defect: string): string => {
  if (/width-to-height proportions/i.test(defect)) return "field-proportions";
  if (/border, fill, or ink state treatment/i.test(defect)) {
    return "border-fill-or-state-treatment";
  }
  if (/label\/helper text structure or vertical spacing/i.test(defect)) {
    return "label-helper-structure-or-spacing";
  }
  if (/input outline, internal padding, and element alignment/i.test(defect)) {
    return "input-outline-padding-or-alignment";
  }
  return "other";
};
const group = (field: keyof (typeof v1RecipeFailures)[number]) =>
  Object.fromEntries(
    [...new Set(v1RecipeFailures.map((failure) => String(failure[field])))]
      .sort()
      .map((value) => {
        const rows = v1RecipeFailures.filter(
          (failure) => String(failure[field]) === value,
        );
        return [
          value,
          {
            failedSpecimens: rows.length,
            defectStatements: rows.reduce(
              (total, row) => total + row.defects.length,
              0,
            ),
            defectClasses: Object.fromEntries(
              [...new Set(rows.flatMap((row) => row.defects.map(defectClass)))]
                .sort()
                .map((name) => [
                  name,
                  rows.reduce(
                    (total, row) =>
                      total +
                      row.defects.filter(
                        (defect) => defectClass(defect) === name,
                      ).length,
                    0,
                  ),
                ]),
            ),
          },
        ];
      }),
  );
const diagnosis = {
  version: "input-field-v1-root-cause-v1",
  immutableFailure: {
    recipeFailures: 88,
    recipeSpecimens: 128,
    defectStatements: 271,
    defectClasses:
      adjudication.defects.byImplementation["recipeReact"]!.classes,
  },
  groupedFailures: {
    sourceLibrary: group("sourceLibrary"),
    size: group("size"),
    state: group("state"),
    content: group("contentMode"),
    required: group("required"),
    adornments: group("adornments"),
  },
  rootCauses: [
    {
      cause:
        "the generic structure forced a stacked label, although the reviewed outlined source floats and notches on focus, value, or leading adornment",
      correctedBy: [
        "structure.labelPlacement",
        "structure.floatingActivation",
        "structure.outlineTreatment",
        "tokens.sizes.*.labelInsetX",
        "tokens.sizes.*.labelInactiveOffsetY",
        "tokens.sizes.*.labelFloatingOffsetY",
      ],
    },
    {
      cause:
        "stale contract width was used instead of immutable original-source geometry, and adornment growth was discarded",
      correctedBy: [
        "structure.sizingPolicy",
        "tokens.sizes.*.width",
        "tokens.sizes.*.leadingAdornmentExtent",
        "tokens.sizes.*.trailingAdornmentExtent",
      ],
    },
    {
      cause:
        "one border width and one undifferentiated shadow ring could not represent state-specific border and focus treatments",
      correctedBy: [
        "tokens.states.*.borderWidth",
        "tokens.states.*.effects",
        "tokens.states.*.background",
        "tokens.states.*.border",
      ],
    },
    {
      cause:
        "label, input, and message metrics plus helper inset were under-acquired at the pinned viewport",
      correctedBy: [
        "tokens.sizes.*.inactiveLabelFontSize",
        "tokens.sizes.*.inactiveLabelLineHeight",
        "tokens.sizes.*.inputFontSize",
        "tokens.sizes.*.inputLineHeight",
        "tokens.sizes.*.messageFontSize",
        "tokens.sizes.*.messageLineHeight",
        "tokens.sizes.*.helperInsetX",
      ],
    },
  ],
  allFailures: v1RecipeFailures.map(
    ({
      cellKey,
      sourceLibrary,
      size,
      state,
      contentMode,
      required,
      adornments,
      defects,
    }) => ({
      cellKey,
      sourceLibrary,
      size,
      state,
      contentMode,
      required,
      adornments,
      defects,
    }),
  ),
};
writeJson(path.join(NEXT, "v1-root-cause.json"), diagnosis);

const protocol = {
  ...v1.comparisonPin.protocol,
  version: VERSION,
};
const seed = sha256(
  [
    VERSION,
    v1.matrix.sampleMatrixHash,
    v1.provenance.environmentHash,
    ...[...deterministicEmission.values()].flatMap((entry) => [
      entry.reactHash,
      entry.webComponentHash,
    ]),
  ].join("\0"),
);
const packetRoot = path.join(NEXT, "blind-packet");
mkdirSync(path.join(packetRoot, "references"), { recursive: true });
mkdirSync(path.join(packetRoot, "specimens"), { recursive: true });
const answers: Array<{
  anonymousCell: string;
  anonymousLabel: string;
  implementationPath: "legacy" | "recipe-react";
  cellKey: string;
  outputHash: string;
}> = [];
const legacyByCell = byCell(legacy);
const recipeByCell = byCell(recipeReact);
const packetCells = INPUT_FIELD_COMPARISON_CELLS.map((cell) => {
  const reference = referenceByCell.get(cell.key)!;
  const anonymousCell = `cell-${sha256(`${seed}\0${cell.key}`).slice(0, 12)}`;
  const referenceName = `${anonymousCell}.png`;
  copyFileSync(
    path.join(NEXT, "source-reference", path.basename(reference.file)),
    path.join(packetRoot, "references", referenceName),
  );
  const candidates = [
    {
      implementationPath: "legacy" as const,
      artifact: legacyByCell.get(cell.key)!,
    },
    {
      implementationPath: "recipe-react" as const,
      artifact: recipeByCell.get(cell.key)!,
    },
  ]
    .map((candidate) => ({
      ...candidate,
      anonymousLabel: `specimen-${sha256(
        `${seed}\0${cell.key}\0${candidate.implementationPath}`,
      ).slice(0, 12)}`,
    }))
    .sort((left, right) =>
      left.anonymousLabel < right.anonymousLabel ? -1 : 1,
    );
  return {
    anonymousCell,
    reference: {
      image: `references/${referenceName}`,
      screenshotHash: reference.hash,
    },
    specimens: candidates.map((candidate) => {
      const name = `${candidate.anonymousLabel}.png`;
      copyFileSync(
        path.join(
          NEXT,
          candidate.implementationPath === "legacy" ? "legacy" : "recipe-react",
          path.basename(candidate.artifact.file),
        ),
        path.join(packetRoot, "specimens", name),
      );
      answers.push({
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
        grade: { recognisable: null, defects: [], confidence: null },
      };
    }),
  };
}).sort((left, right) => (left.anonymousCell < right.anonymousCell ? -1 : 1));
assert.equal(packetCells.length, 128);
assert.equal(answers.length, 256);
assert.equal(new Set(answers.map((answer) => answer.anonymousLabel)).size, 256);
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
  version: VERSION,
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
writeJson(path.join(packetRoot, "packet.json"), packet);
writeJson(path.join(NEXT, "sealed-answer-key.json"), {
  version: VERSION,
  sealedFromBlindGrader: true,
  randomizationSeedHash: sha256(seed),
  randomizedBatchHash,
  answers,
});
const packetText = readFileSync(path.join(packetRoot, "packet.json"), "utf8");
assert.doesNotMatch(
  packetText,
  /\blegacy\b|\brecipe(?:[- /]?react)?\b|\bmui\b|\bpolaris\b|@shopify|@mui/i,
);

const packetPath = `recipe/evidence/${TARGET_NAME}/blind-packet/packet.json`;
const keyPath = `recipe/evidence/${TARGET_NAME}/sealed-answer-key.json`;
const gradingPrompt = [
  "Act as the independent blind grader for the Input/Field paired benchmark v2.",
  `Open only ${packetPath} and files beneath its blind-packet directory; do not inspect parent evidence, source code, or ${keyPath}.`,
  "Grade all 256 opaque specimens against their 128 paired references exactly as instructed in packet.json.",
  "For each specimen set recognisable to true or false, provide at least one concrete visual defect when false, and record low, medium, or high confidence.",
  "Do not rank specimens, guess implementation identity, omit a cell, or reduce scope.",
  "Write the completed grade artifact as blind-packet/grades.json with grader identity, the packet protocol and randomizedBatchHash, and one grade per anonymous specimen. Do not unseal or adjudicate the answer key.",
].join(" ");
const receipt = {
  version: EVIDENCE_VERSION,
  status: {
    evidenceGeneration: "complete",
    independentBlindGrade: "pending",
    legacyRecognisability: "ungraded",
    recipeReactRecognisability: "ungraded",
    recipeWebComponentRecognisability: "ungraded-parity-only",
    inputFieldOverall: false,
  },
  v1Failure: {
    immutable: true,
    evidenceRoot: "recipe/evidence/input-field-comparison",
    score: { legacy: "88/128", recipeReact: "40/128" },
    recipeFailures: 88,
    defectStatements: 271,
    diagnosis: `recipe/evidence/${TARGET_NAME}/v1-root-cause.json`,
  },
  matrix: {
    frozenBeforeRender: true,
    sampleMatrixHash: v1.matrix.sampleMatrixHash,
    cells: INPUT_FIELD_COMPARISON_CELLS,
    totalSourceCells: 128,
    exactV1Matrix: true,
  },
  immutableInputs: {
    referencesByteIdenticalToV1: 128,
    legacyByteIdenticalToV1: 128,
    referenceHashes: Object.fromEntries(
      references.map((artifact) => [artifact.cellKey, artifact.hash]),
    ),
    legacyHashes: Object.fromEntries(
      legacy.map((artifact) => [artifact.cellKey, artifact.hash]),
    ),
  },
  provenance: {
    sourceCommit: v1.provenance.sourceCommit,
    comparisonFixtureHash: v1.provenance.fixtureHash,
    environment: v1.provenance.environment,
    environmentHash: v1.provenance.environmentHash,
  },
  references,
  outputs: { legacy, recipeReact, recipeWebComponent },
  manifests: {
    legacy: v1.manifests.legacy,
    recipeReact: recipeManifest,
    recipeWebComponentParity: wcManifest,
  },
  nonvisualEvidence: {
    zeroPixelComparisons: 0,
    acquisitionAccounting: Object.fromEntries(acquisition),
    twoCycleCanonicalFixedPoint: Object.fromEntries(fixedPoints),
    deterministicEmission: Object.fromEntries(deterministicEmission),
    semanticApiAriaEvents: "256/256 corrected recipe outputs validated",
    recipeWebComponentParity: {
      cells: 128,
      nonzeroCells: 128,
      pixelComparisons,
      byteHashEqualToReact,
      renderedPixelHashEqualToReact,
      perceptualThreshold: 0.1,
      perceptualPixelEqualToReact,
      geometryEqualToReact: 128,
      semanticProbeEqualToReact: 128,
      includedInBlindSpecimens: false,
    },
    noLibraryBranchChecks: {
      staticGenericFiles: genericFiles,
      forbiddenIdentities: "0 matches",
      dynamicParameterCounterexample: "covered by input-field-proof.test.ts",
      hardStopRequired: true,
      controlFailed: false,
    },
  },
  counts: {
    sourceReferences: 128,
    legacyOutputs: 128,
    recipeReactOutputs: 128,
    recipeWebComponentOutputs: 128,
    blindReferences: 128,
    blindSpecimens: 256,
  },
  blindPacket: {
    path: packetPath,
    sealedAnswerKey: keyPath,
    packetHash: fileHash(path.join(packetRoot, "packet.json")),
    randomizedBatchHash,
    recognisabilityVerdictsAuthoredByBuilder: false,
    exactIndependentGradingPrompt: gradingPrompt,
  },
};
writeJson(path.join(NEXT, "receipt.json"), receipt);
writeJson(path.join(NEXT, "index.json"), {
  version: EVIDENCE_VERSION,
  archetype: "input / field",
  status: "false-ungraded",
  overall: false,
  gradeWritten: false,
  v1PreservedFailure: true,
  receipt: `recipe/evidence/${TARGET_NAME}/receipt.json`,
  receiptHash: fileHash(path.join(NEXT, "receipt.json")),
  packet: packetPath,
  packetHash: fileHash(path.join(packetRoot, "packet.json")),
  sealedAnswerKey: keyPath,
  counts: receipt.counts,
});

rmSync(TARGET, { recursive: true, force: true });
mkdirSync(path.dirname(TARGET), { recursive: true });
for (const entry of [NEXT]) {
  assert.ok(entry.endsWith(`.${TARGET_NAME}-next`));
}
await import("node:fs").then(({ renameSync }) => renameSync(NEXT, TARGET));
console.log(
  `Input/Field v${EVIDENCE_VERSION} sealed: 128 unchanged references + 128 unchanged legacy + 128 corrected React + 128 parity WC; packet=${receipt.blindPacket.packetHash}; batch=${randomizedBatchHash}; ungraded`,
);
