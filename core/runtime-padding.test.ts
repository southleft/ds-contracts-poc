import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { build } from "esbuild";
import { chromium } from "playwright-core";
import ts from "typescript";
import { ContractSchema } from "../scripts/contract-schema.js";
import { revisionOf } from "./contract-provenance.js";
import { emitReact } from "./emit-react.js";
import {
  emitRuntimeReact,
  resolveRuntimeEmission,
  runtimeProjectionRevision,
  type RuntimeArtifactForEmission,
  type RuntimeEmissionContext,
  type RuntimePaddingMapping,
  type RuntimeProjectionBinding,
} from "./runtime-emission.js";
import { tokenInventoryFromJson } from "./tokens.js";

/** Synthetic authored custom element: this measures the existing emitter's
 * lowering, not Altitude/Figma fidelity or arbitrary caller CSS qualification. */
const original = `export class PaddingElement extends HTMLElement {
 constructor(){super();this.attachShadow({mode:'open'}).innerHTML='<style>:host{display:inline-block}button{padding:var(--source-padding,8px 16px);background:rgb(11,22,33);color:white}</style><button><slot name="before"></slot><slot></slot></button>';}
 variant=undefined;href=undefined;label=undefined;hideText=undefined;fullWidth=undefined;styleModifier=undefined;isPressed=undefined;
 connectedCallback(){this.shadowRoot.querySelector('button').setAttribute('aria-label',this.label??'');}
}`;
const tokens = {
  primitives: {
    space: {
      $type: "dimension",
      small: { $value: "4px" },
      medium: { $value: "8px" },
      block: { $value: "14px" },
      large: { $value: "20px" },
      bad: { $value: "1rem" },
    },
  },
  semantic: { pad: { $type: "dimension", $value: "{space.small}" } },
  light: {},
  dark: {},
  brands: { default: {} },
};

function fixture(storage: "literals" | "tokens" = "literals") {
  const contract = ContractSchema.parse({
    id: "padding.probe",
    name: "PaddingProbe",
    description: "Synthetic retained padding proof.",
    version: "0.1.0",
    status: "draft",
    archetype: "none",
    semantics: { element: "button" },
    props: [
      {
        name: "variant",
        type: { enum: ["secondary", "danger"] },
        bindings: {
          code: { prop: "variant" },
          figma: {
            kind: "VARIANT",
            property: "Variant",
            unsetValue: "(unset)",
            values: { secondary: "Secondary", danger: "Danger" },
          },
        },
      },
    ],
    states: [],
    anatomy: {
      root: {
        layout: { display: "flex" },
        [storage]:
          storage === "literals"
            ? { "padding-block": "4px", "padding-inline": "8px" }
            : { "padding-block": "{pad}", "padding-inline": "{space.medium}" },
        parts: {
          before: { slot: { name: "before" } },
          content: { slot: { name: "children" } },
        },
      },
    },
    bindings: {
      code: {
        anchors: {
          importPath: "components/PaddingProbe",
          export: "PaddingProbe",
        },
      },
      figma: { anchors: { fileKey: null, componentSetKey: null } },
    },
  });
  const properties = [
    { name: "variant", typeText: "'secondary' | 'danger'" },
    { name: "href", typeText: "string" },
    { name: "label", typeText: "string" },
    { name: "hideText", typeText: "boolean" },
    { name: "fullWidth", typeText: "boolean" },
    { name: "styleModifier", typeText: "string" },
    { name: "isPressed", typeText: "boolean | 'mixed'" },
  ].map((p) => ({ ...p, writable: true }));
  const api = {
    module: { path: "source.js", exportName: "PaddingElement" },
    declaration: { path: "source.d.ts", exportName: "PaddingElement" },
    writableProperties: properties.map((p) => p.name),
    properties,
    slots: [{ name: "" }, { name: "before" }],
    peerRuntime: {
      name: "react" as const,
      major: 19 as const,
      mounting: "direct-custom-element" as const,
    },
  };
  const artifact: RuntimeArtifactForEmission = {
    artifactRevision: revisionOf(original),
    interfaceRevision: revisionOf(api),
    interface: api,
    registrationTag: "runtime-padding-probe",
    stylesheets: [],
  };
  const padding: RuntimePaddingMapping = {
    kind: "host-padding-pair-v1",
    partPath: ["root"],
    storage,
    customProperty: "--source-padding",
    evidenceRevision: revisionOf({ synthetic: "authored fixture only" }),
    scope: {
      mode: "light",
      brand: "default",
      paddingPairs: [
        { blockPx: 4, inlinePx: 8 },
        { blockPx: 14, inlinePx: 20 },
        { blockPx: 8, inlinePx: 16 },
      ],
      cases: [
        {
          variant: { kind: "omitted" },
          href: { kind: "omitted" },
          label: { kind: "value", value: "Accessible" },
          hideText: { kind: "omitted" },
          fullWidth: { kind: "omitted" },
          styleModifier: { kind: "omitted" },
          isPressed: { kind: "value", value: "mixed" },
        },
      ],
    },
  };
  const binding: RuntimeProjectionBinding = {
    version: 2,
    artifactRevision: artifact.artifactRevision,
    interfaceRevision: artifact.interfaceRevision,
    contractRevision: runtimeProjectionRevision(contract, padding),
    tokenRevision: revisionOf(tokens),
    properties: [{ contractProp: "variant", sourceProperty: "variant" }],
    slots: [
      { contractSlot: "before", sourceSlot: "before" },
      { contractSlot: "children", sourceSlot: "" },
    ],
    padding,
  };
  const context: RuntimeEmissionContext = {
    artifacts: new Map([[artifact.artifactRevision, artifact]]),
    bindings: new Map(),
    tokens: structuredClone(tokens),
    mode: "light",
    brand: "default",
  };
  const f = {
    contract,
    artifact,
    padding,
    binding: binding as RuntimeProjectionBinding,
    context,
  };
  rebind(f);
  return f;
}
type Fixture = ReturnType<typeof fixture>;
function rebind(f: Fixture) {
  const r = revisionOf(f.binding);
  f.context.bindings = new Map([[r, f.binding]]);
  f.contract.bindings.code.runtime = {
    version: 1,
    kind: "custom-element",
    artifactRevision: f.artifact.artifactRevision,
    interfaceRevision: f.artifact.interfaceRevision,
    bindingRevision: r,
  };
}
function emit(f: Fixture) {
  return emitReact(f.contract, {
    tokens: tokenInventoryFromJson([tokens.primitives, tokens.semantic]),
    icons: new Map(),
    contracts: new Map([[f.contract.id, f.contract]]),
    runtimeArtifacts: f.context,
    tokenValues: f.context.tokens,
    mode: f.context.mode as "light" | "dark",
    brand: f.context.brand,
  });
}

test("v2 lowers an explicit pair and invariant preserves every unmapped field", () => {
  const f = fixture();
  const originalRevision = f.binding.contractRevision;
  assert.deepEqual(
    [
      resolveRuntimeEmission(f.contract, f.context).padding?.blockPx,
      resolveRuntimeEmission(f.contract, f.context).padding?.inlinePx,
    ],
    [4, 8],
  );
  const bytes = emit(f).tsx;
  assert.equal(emit(f).tsx, bytes);
  f.contract.anatomy.root.literals!["padding-block"] = "14px";
  f.contract.anatomy.root.literals!["padding-inline"] = "20px";
  assert.equal(
    runtimeProjectionRevision(f.contract, f.padding),
    originalRevision,
  );
  assert.match(emit(f).tsx, /14px 20px/);
  f.contract.anatomy.root.literals!["padding-block"] = "8px";
  f.contract.anatomy.root.literals!["padding-inline"] = "16px";
  assert.match(emit(f).tsx, /8px 16px/);
  f.contract.description = "not an editable padding field";
  assert.throws(() => emit(f), /UNQUALIFIED-CONTRACT-CHANGE/);
});

test("pair removal, competing carriers, conditional padding and unsupported dimensions fail closed", () => {
  const changes: Array<(f: Fixture) => void> = [
    (f) => {
      delete f.contract.anatomy.root.literals!["padding-block"];
    },
    (f) => {
      f.contract.anatomy.root.tokens = { "padding-inline": "{space.medium}" };
    },
    (f) => {
      f.contract.anatomy.root.literals!["padding-left"] = "2px";
    },
    (f) => {
      f.contract.anatomy.root.literalsByProp = [
        { prop: "variant", map: { secondary: { "padding-block": "2px" } } },
      ];
    },
    (f) => {
      f.contract.anatomy.root.stylesWhen = [
        { when: { variant: "secondary" }, styles: { "padding-inline": "2px" } },
      ] as never;
    },
    (f) => {
      f.contract.anatomy.root.literals!["padding-block"] = "-1px";
    },
    (f) => {
      f.contract.anatomy.root.literals!["padding-block"] = "1rem";
    },
    (f) => {
      f.contract.anatomy.root.literals!["padding-block"] = "var(--other)";
    },
    (f) => {
      f.contract.anatomy.root.literals!["padding-block"] = "Infinitypx";
    },
  ];
  for (const change of changes) {
    const f = fixture();
    change(f);
    assert.throws(
      () => resolveRuntimeEmission(f.contract, f.context),
      /PADDING-/,
    );
  }
});

test("token pair can select existing dimension leaves, never change token values or modes", () => {
  const f = fixture("tokens");
  assert.equal(
    resolveRuntimeEmission(f.contract, f.context).padding?.cssValue,
    "4px 8px",
  );
  f.contract.anatomy.root.tokens!["padding-block"] = "{space.block}";
  f.contract.anatomy.root.tokens!["padding-inline"] = "{space.large}";
  assert.equal(
    resolveRuntimeEmission(f.contract, f.context).padding?.cssValue,
    "14px 20px",
  );
  assert.match(emit(f).tsx, /14px 20px/);
  f.contract.anatomy.root.tokens!["padding-inline"] = "{space.bad}";
  assert.throws(
    () => resolveRuntimeEmission(f.contract, f.context),
    /PADDING-DIMENSION/,
  );
  f.contract.anatomy.root.tokens!["padding-inline"] = "{space.large}";
  (f.context.tokens as typeof tokens).primitives.space.small.$value = "5px";
  assert.throws(() => emit(f), /UNQUALIFIED-TOKEN-CHANGE/);
  for (const context of [
    { mode: "dark", brand: "default" },
    { mode: "light", brand: "other" },
    { mode: undefined, brand: "default" },
  ]) {
    const g = fixture();
    Object.assign(g.context, context);
    assert.throws(
      () => resolveRuntimeEmission(g.contract, g.context),
      /PADDING-CONTEXT/,
    );
  }
  const dark = fixture();
  dark.padding.scope.mode = "dark";
  dark.context.mode = "dark";
  rebind(dark);
  assert.equal(
    resolveRuntimeEmission(dark.contract, dark.context).padding?.cssValue,
    "4px 8px",
  );
});

test("numeric qualification is exactly the measured pairs, never all finite lengths", () => {
  for (const pair of [
    [0, 0],
    [4, 20],
    [1e30, 8],
  ]) {
    const f = fixture();
    f.contract.anatomy.root.literals!["padding-block"] = `${pair[0]}px`;
    f.contract.anatomy.root.literals!["padding-inline"] = `${pair[1]}px`;
    assert.throws(
      () => resolveRuntimeEmission(f.contract, f.context),
      /PADDING-(?:PAIR-UNQUALIFIED|DIMENSION)/,
    );
  }
  for (const pairs of [
    [],
    [{ blockPx: -1, inlinePx: 8 }],
    [{ blockPx: Infinity, inlinePx: 8 }],
    [
      { blockPx: 4, inlinePx: 8 },
      { blockPx: 4, inlinePx: 8 },
    ],
    [{ blockPx: 4, inlinePx: 8, extra: true }],
  ]) {
    const f = fixture();
    f.padding.scope.paddingPairs = pairs;
    rebind(f);
    assert.throws(
      () => resolveRuntimeEmission(f.contract, f.context),
      /PADDING-MAPPING-INVALID/,
    );
  }
});

test("hash-consistent forged or incomplete qualification records do not gain admission", () => {
  const changes: Array<(f: Fixture) => void> = [
    (f) => {
      delete f.padding.scope.cases[0].hideText;
    },
    (f) => {
      f.padding.scope.cases[0].invented = { kind: "omitted" };
    },
    (f) => {
      f.padding.scope.cases[0].hideText = { kind: "value", value: "false" };
    },
    (f) => {
      f.padding.customProperty = "padding";
    },
    (f) => {
      f.padding.evidenceRevision = "not-a-revision";
    },
    (f) => {
      f.padding.scope.cases = [];
    },
    (f) => {
      (f.padding as unknown as Record<string, unknown>).css = "arbitrary";
    },
    (f) => {
      f.padding.partPath = ["content"] as never;
    },
  ];
  for (const change of changes) {
    const f = fixture();
    change(f);
    rebind(f);
    assert.throws(
      () => resolveRuntimeEmission(f.contract, f.context),
      /PADDING-/,
    );
  }
});

test("v2 helper globals cannot be shadowed by named-slot destructuring", () => {
  for (const name of ["Object", "Array"]) {
    const f = fixture();
    f.contract.anatomy.root.parts!.before.slot!.name = name;
    f.binding.slots[0].contractSlot = name;
    f.binding.contractRevision = runtimeProjectionRevision(
      f.contract,
      f.padding,
    );
    rebind(f);
    assert.throws(() => emit(f), /PADDING-STYLE-API-COLLISION/);
  }
});

test("generated v2 TSX retains the original typed API and valid style lowering", () => {
  const f = fixture(),
    filename = path.resolve("core/__runtime_padding__/PaddingProbe.tsx");
  const declaration = path.resolve(
    path.dirname(filename),
    "runtime",
    f.artifact.artifactRevision.slice(7),
    "source.d.ts",
  );
  const files = new Map([
    [filename, emit(f).tsx],
    [
      declaration,
      "export declare class PaddingElement extends HTMLElement { variant?: 'secondary'|'danger'; href?:string; label?:string; hideText?:boolean; fullWidth?:boolean; styleModifier?:string; isPressed?:boolean|'mixed'; }",
    ],
  ]);
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    types: ["react"],
  };
  const host = ts.createCompilerHost(options),
    read = host.readFile.bind(host),
    exists = host.fileExists.bind(host),
    directory = host.directoryExists?.bind(host);
  host.readFile = (file) => files.get(file) ?? read(file);
  host.fileExists = (file) => files.has(file) || exists(file);
  host.directoryExists = (dir) =>
    [...files.keys()].some((file) => file.startsWith(dir + path.sep)) ||
    !!directory?.(dir);
  host.getSourceFile = (file, language) => {
    const content = host.readFile(file);
    return content === undefined
      ? undefined
      : ts.createSourceFile(file, content, language);
  };
  assert.deepEqual(
    ts
      .getPreEmitDiagnostics(ts.createProgram([...files.keys()], options, host))
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    [],
  );
  assert.match(
    emit(f).tsx,
    /"hideText" \| "fullWidth" \| "styleModifier" \| "isPressed"/,
    "unqualified inputs remain declared, not silently erased",
  );
});

async function bundle(f: Fixture) {
  const generated = emit(f).tsx;
  const entry = `import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import{PaddingProbe}from'./generated';const root=createRoot(document.getElementById('root'));window.mount=(extra={})=>flushSync(()=>root.render(React.createElement(PaddingProbe,{label:'Accessible',isPressed:'mixed',before:React.createElement('span',{},'Before'),...extra},'Visible')));window.call=(extra={})=>PaddingProbe({label:'Accessible',isPressed:'mixed',...extra});`;
  const result = await build({
    stdin: { contents: entry, loader: "tsx", resolveDir: process.cwd() },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    plugins: [
      {
        name: "authored-runtime",
        setup(b) {
          b.onResolve({ filter: /^\.\/generated$/ }, () => ({
            path: "generated",
            namespace: "padding",
          }));
          b.onLoad({ filter: /.*/, namespace: "padding" }, () => ({
            contents: generated,
            loader: "tsx",
            resolveDir: process.cwd(),
          }));
          b.onResolve({ filter: /\/runtime\/.*\/source\.js$/ }, () => ({
            path: "source",
            namespace: "original",
          }));
          b.onLoad({ filter: /.*/, namespace: "original" }, () => ({
            contents: original,
            loader: "js",
            resolveDir: path.resolve("."),
          }));
        },
      },
    ],
  });
  return result.outputFiles[0].text;
}

test("existing React emitter changes authored runtime padding 4/8 →14/20 → explicit8/16 and refuses unsupported caller scope", async () => {
  const browser = await chromium.launch();
  try {
    for (const pair of [
      [4, 8],
      [14, 20],
      [8, 16],
    ]) {
      const f = fixture();
      f.contract.anatomy.root.literals!["padding-block"] = `${pair[0]}px`;
      f.contract.anatomy.root.literals!["padding-inline"] = `${pair[1]}px`;
      const page = await browser.newPage();
      await page.setContent('<div id="root"></div>');
      await page.addScriptTag({ content: await bundle(f) });
      await page.evaluate(() => {
        (window as any).mount({
          className: "kept",
          style: { color: "rgb(1, 2, 3)" },
        });
      });
      const observed = await page.evaluate(() => {
        const host = document.querySelector(
          "runtime-padding-probe",
        ) as HTMLElement;
        const native = host.shadowRoot!.querySelector("button")!;
        const css = getComputedStyle(native);
        return {
          padding: [css.paddingTop, css.paddingRight],
          label: native.getAttribute("aria-label"),
          text: host.textContent,
          style: host.style.color,
          className: host.className,
          pressed: (host as any).isPressed,
        };
      });
      assert.deepEqual(observed, {
        padding: pair.map((v) => `${v}px`),
        label: "Accessible",
        text: "BeforeVisible",
        style: "rgb(1, 2, 3)",
        className: "kept",
        pressed: "mixed",
      });
      for (const extra of [
        { hideText: true },
        { fullWidth: true },
        { styleModifier: "al-u-is-vishidden" },
        { variant: "secondary" },
        { href: "#unqualified" },
        { style: { "--source-padding": "0px" } },
        { style: "padding:0" },
      ]) {
        const error = await page.evaluate((extra) => {
          try {
            (window as any).call(extra);
            return null;
          } catch (e) {
            return String(e);
          }
        }, extra);
        assert.match(error!, /RUNTIME-EMISSION-PADDING-/);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test("v1 exact projection and emission stay byte-stable without the opt-in", () => {
  const f = fixture();
  const { padding: _padding, ...base } = f.binding as Extract<
    RuntimeProjectionBinding,
    { version: 2 }
  >;
  f.binding = {
    ...base,
    version: 1,
    contractRevision: runtimeProjectionRevision(f.contract),
  };
  rebind(f);
  const first = emitRuntimeReact(f.contract, f.context);
  const copy = structuredClone(f.contract);
  assert.deepEqual(emitRuntimeReact(copy, f.context), first);
  assert.doesNotMatch(first.tsx, /PADDING-|--source-padding/);
  // Captured before the v2 implementation was added.
  assert.equal(
    revisionOf(first),
    "sha256:c2f3b7ab4d299c25248a802ad81b6057c0517e8e29b062fe888e436d789ccc99",
  );
});
