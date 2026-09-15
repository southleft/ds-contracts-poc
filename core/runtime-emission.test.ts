import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { build } from "esbuild";
import { chromium, type Page } from "playwright-core";
import ts from "typescript";
import { ContractSchema, type Contract } from "../scripts/contract-schema.js";
import { revisionOf } from "./contract-provenance.js";
import { emitReact, generateTsx } from "./emit-react.js";
import { emitReactInline } from "./emit-react-inline.js";
import { emitHtml } from "./emit-html.js";
import { createFigmaEngine } from "./emit-figma-script.js";
import {
  emitCodeConnectReact,
  emitCodeConnectHtml,
} from "./emit-code-connect.js";
import {
  reactEmitter,
  figmaScriptEmitter,
  codeConnectEmitter,
  codeConnectHtmlEmitter,
} from "./emitter.js";
import { emitWebComponent } from "../packages/emitter-web-components/src/emit-wc.js";
import {
  emitRuntimeReact,
  resolveRuntimeEmission,
  runtimeProjectionRevision,
  type RuntimeArtifactForEmission,
  type RuntimeEmissionContext,
  type RuntimeProjectionBinding,
} from "./runtime-emission.js";

/** Synthetic authored runtime, not an Altitude reconstruction or fidelity
 * fixture. Its own setters, DOM, styles and delayed fallback exercise the
 * generated adapter. No implementation is inferred from a screenshot. */
const originalModule = `
export class FixtureElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'}).innerHTML = '<style>:host{display:inline-block}button{padding:7px;background:rgb(19,41,63);color:var(--original-ink,rgb(1,2,3))}button[data-variant="secondary"]{background:rgb(51,71,91)}button[data-variant="danger"]{background:rgb(111,21,31)}</style><button part="button"><slot name="before"></slot><slot></slot><slot name="after"></slot></button>';
  }
  get label() { return this._label; }
  set label(value) { this._label=value; this.sync(); }
  get variant() { return this._variant; }
  set variant(value) { this._variant=value; this.sync(); }
  get isPressed() { return this._isPressed; }
  set isPressed(value) { this._isPressed=value; this.sync(); }
  get styleModifier() { return this._styleModifier; }
  set styleModifier(value) { this._styleModifier=value; this.sync(); }
  get slotNodes() { return this.shadowRoot.querySelector('slot:not([name])').assignedNodes(); }
  originalMethod() { return 'original-method'; }
  sync() {
    const button=this.shadowRoot?.querySelector('button'); if(!button) return;
    for(const [name,value] of [['aria-label',this.label],['aria-pressed',this.isPressed],['data-variant',this.variant],['data-modifier',this.styleModifier]]) {
      if(value===undefined) button.removeAttribute(name); else button.setAttribute(name,String(value));
    }
  }
  connectedCallback() {
    this.labelAtConnection=this.label;
    if(!this.label) setTimeout(()=>{this.label=this.slotNodes.find(node=>node.nodeType===Node.TEXT_NODE)?.textContent.trim();},10);
    this.sync();
  }
}
`;
const originalDeclaration = `
export declare class FixtureElement extends HTMLElement {
  label?: string;
  variant?: 'secondary' | 'danger';
  isPressed?: boolean | 'mixed';
  styleModifier?: string;
  readonly slotNodes: readonly Node[];
  readonly labelAtConnection: string | undefined;
  originalMethod(): 'original-method';
}
`;
const originalStylesheet =
  "original-runtime-probe { --original-ink: rgb(13, 23, 33); outline: 2px solid rgb(71, 81, 91); }";
const tokenValues = {
  primitives: { ink: { $type: "color", $value: "#123456" } },
  semantic: {},
  light: {},
  dark: {},
  brands: { default: {} },
};
type Fixture = {
  contract: Contract;
  context: RuntimeEmissionContext;
  artifact: RuntimeArtifactForEmission;
  binding: RuntimeProjectionBinding;
};

function fixture(): Fixture {
  const contract = ContractSchema.parse({
    id: "probe.retained",
    name: "RetainedProbe",
    version: "0.1.0",
    status: "draft",
    description:
      "Synthetic retained runtime adapter conformance, not source-library or canvas proof.",
    archetype: "none",
    semantics: { element: "button" },
    props: [
      {
        name: "label",
        type: "text",
        bindings: {
          code: { prop: "label" },
          figma: { kind: "TEXT", property: "Accessible label" },
        },
      },
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
        parts: {
          content: { slot: { name: "children" } },
          before: { slot: { name: "before" } },
          after: { slot: { name: "after" } },
        },
      },
    },
    bindings: {
      figma: { anchors: { fileKey: null, componentSetKey: null } },
      code: {
        anchors: {
          importPath: "components/RetainedProbe",
          export: "RetainedProbe",
        },
      },
    },
  });
  const publicProperties = [
    { name: "label", typeText: "string" },
    { name: "variant", typeText: "'secondary' | 'danger'" },
    { name: "isPressed", typeText: "boolean | 'mixed'" },
    { name: "styleModifier", typeText: "string" },
  ];
  const api = {
    version: 1,
    module: { path: "fixture.js", exportName: "FixtureElement" },
    declaration: { path: "fixture.d.ts", exportName: "FixtureElement" },
    writableProperties: publicProperties.map((property) => property.name),
    properties: [
      ...publicProperties.map((property) => ({
        ...property,
        sourcePath: "fixture.ts",
        declaringClass: "OriginalElement",
        writable: true,
        reason: "lit-property",
      })),
      {
        name: "slotNodes",
        typeText: "readonly Node[]",
        sourcePath: "fixture.ts",
        declaringClass: "OriginalElement",
        writable: false,
        reason: "computed-query",
      },
    ],
    slots: [{ name: "" }, { name: "before" }, { name: "after" }],
    peerRuntime: {
      name: "react" as const,
      major: 19 as const,
      mounting: "direct-custom-element" as const,
    },
  };
  const artifactRevision = revisionOf({
    module: originalModule,
    declaration: originalDeclaration,
    stylesheet: originalStylesheet,
    interface: api,
  });
  const artifact: RuntimeArtifactForEmission = {
    artifactRevision,
    interfaceRevision: revisionOf(api),
    registrationTag: "original-runtime-probe",
    interface: api,
    stylesheets: ["fixture.css"],
  };
  const binding: RuntimeProjectionBinding = {
    version: 1,
    artifactRevision,
    interfaceRevision: artifact.interfaceRevision,
    contractRevision: runtimeProjectionRevision(contract),
    tokenRevision: revisionOf(tokenValues),
    properties: [
      { contractProp: "label", sourceProperty: "label" },
      { contractProp: "variant", sourceProperty: "variant" },
    ],
    slots: [
      { contractSlot: "children", sourceSlot: "" },
      { contractSlot: "before", sourceSlot: "before" },
      { contractSlot: "after", sourceSlot: "after" },
    ],
  };
  const result: Fixture = {
    contract,
    artifact,
    binding,
    context: {
      artifacts: new Map(),
      bindings: new Map(),
      tokens: structuredClone(tokenValues),
    },
  };
  rebind(result);
  return result;
}

/** Re-author identities for deliberately invalid but internally hash-consistent
 * fixtures. Hash consistency alone must not authorize an invalid mapping. */
function rebind(f: Fixture, updateContract = false) {
  f.artifact.interfaceRevision = revisionOf(f.artifact.interface);
  f.binding.interfaceRevision = f.artifact.interfaceRevision;
  if (updateContract)
    f.binding.contractRevision = runtimeProjectionRevision(f.contract);
  const bindingRevision = revisionOf(f.binding);
  f.contract.bindings.code.runtime = {
    version: 1,
    kind: "custom-element",
    artifactRevision: f.artifact.artifactRevision,
    interfaceRevision: f.artifact.interfaceRevision,
    bindingRevision,
  };
  f.context = {
    artifacts: new Map([[f.artifact.artifactRevision, f.artifact]]),
    bindings: new Map([[bindingRevision, f.binding]]),
    tokens: f.context.tokens,
  };
}
const emitted = (f: Fixture) => emitRuntimeReact(f.contract, f.context);
const existingContext = (f: Fixture) => ({
  tokens: new Set<string>(),
  icons: new Map<string, string>(),
  contracts: new Map([[f.contract.id, f.contract]]),
  runtimeArtifacts: {
    artifacts: f.context.artifacts,
    bindings: f.context.bindings,
  },
  tokenValues: f.context.tokens,
});
const existingEmitted = (f: Fixture) =>
  emitReact(f.contract, existingContext(f));
function requiredEnumFixture() {
  const f = fixture();
  f.contract.props[1].required = true;
  delete f.contract.props[1].bindings.figma.unsetValue;
  rebind(f, true);
  return f;
}

test("existing emitReact selects the same verified runtime lowering and refuses missing context or changed actual token values", () => {
  const f = fixture(),
    pure = emitted(f),
    ctx = existingContext(f);
  const result = emitReact(f.contract, ctx);
  assert.equal(result.tsx, pure.tsx);
  assert.equal(result.css, pure.css);
  assert.match(result.stories, /qualified source recipe/);
  assert.match(result.stories, /export \{\};/);
  assert.doesNotMatch(
    result.stories,
    /export const|<button|<span|Playground|Matrix/,
    "no invented native state examples",
  );
  const { runtimeArtifacts: _runtimeArtifacts, ...withoutRuntime } = ctx;
  assert.throws(
    () => emitReact(f.contract, withoutRuntime),
    /RUNTIME-EMISSION-/,
  );
  const changed = {
    ...ctx,
    tokenValues: {
      ...tokenValues,
      primitives: { ink: { $type: "color", $value: "#ffffff" } },
    },
  };
  assert.throws(
    () => emitReact(f.contract, changed),
    /RUNTIME-EMISSION-UNQUALIFIED-TOKEN-CHANGE/,
  );
});

test("registered React target always binds actual token values, never a stale override inside runtime context", () => {
  const f = fixture(),
    ctx = existingContext(f);
  const registered = {
    icons: ctx.icons,
    contracts: ctx.contracts,
    tokens: structuredClone(tokenValues),
    runtimeArtifacts: {
      ...ctx.runtimeArtifacts,
      tokens: structuredClone(tokenValues),
    },
  };
  const files = reactEmitter.emit(f.contract, registered);
  assert.equal(
    files.find(
      (file) =>
        file.path.endsWith(".tsx") && !file.path.endsWith(".stories.tsx"),
    )?.contents,
    emitted(f).tsx,
  );
  registered.tokens.primitives.ink.$value = "#abcdef";
  assert.deepEqual(
    Object.keys(registered.tokens.primitives),
    Object.keys(tokenValues.primitives),
  );
  assert.throws(
    () => reactEmitter.emit(f.contract, registered),
    /RUNTIME-EMISSION-UNQUALIFIED-TOKEN-CHANGE/,
  );
});

test("direct native TSX and unsupported code emitters refuse retained-runtime contracts before reconstructing anatomy", async (t) => {
  const f = fixture(),
    ctx = existingContext(f);
  for (const [name, emit] of [
    ["generateTsx", () => generateTsx(f.contract, ctx.contracts, ctx.icons)],
    [
      "react-inline",
      () => emitReactInline(f.contract, { ...ctx, tokens: tokenValues }),
    ],
    ["html", () => emitHtml(f.contract, ctx)],
    ["web-components", () => emitWebComponent(f.contract, ctx)],
    [
      "figma-script target",
      () =>
        figmaScriptEmitter.emit(f.contract, { ...ctx, tokens: tokenValues }),
    ],
    [
      "Figma compileComponentData",
      () =>
        createFigmaEngine({
          tokens: tokenValues,
          icons: ctx.icons,
        }).compileComponentData(f.contract, ctx.contracts),
    ],
    ["Code Connect React", () => emitCodeConnectReact(f.contract)],
    ["Code Connect HTML", () => emitCodeConnectHtml(f.contract)],
    [
      "Code Connect React target",
      () =>
        codeConnectEmitter.emit(f.contract, { ...ctx, tokens: tokenValues }),
    ],
    [
      "Code Connect HTML target",
      () =>
        codeConnectHtmlEmitter.emit(f.contract, {
          ...ctx,
          tokens: tokenValues,
        }),
    ],
  ] as const)
    await t.test(name, () => assert.throws(emit, /RUNTIME-EMISSION-/, name));
});

function typeErrors(f: Fixture, generated: string, consumer = ""): string[] {
  const generatedPath = path.resolve(
    "core/__runtime_emission__/RetainedProbe.tsx",
  );
  const runtimePath = path.resolve(
    path.dirname(generatedPath),
    "runtime",
    f.artifact.artifactRevision.slice(7),
    "fixture.d.ts",
  );
  const files = new Map([
    [generatedPath, generated],
    [runtimePath, originalDeclaration],
    [
      path.resolve(path.dirname(generatedPath), "styles.d.ts"),
      'declare module "*.css" {}',
    ],
    [
      path.resolve(path.dirname(generatedPath), "consumer.tsx"),
      `import * as React from 'react'; import {RetainedProbe} from './RetainedProbe.js'; ${consumer}`,
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
  const host = ts.createCompilerHost(options);
  const read = host.readFile.bind(host),
    exists = host.fileExists.bind(host),
    directory = host.directoryExists?.bind(host);
  host.readFile = (file) => files.get(file) ?? read(file);
  host.fileExists = (file) => files.has(file) || exists(file);
  host.directoryExists = (dir) =>
    [...files.keys()].some((file) => file.startsWith(dir + path.sep)) ||
    !!directory?.(dir);
  host.getSourceFile = (file, languageVersion) => {
    const contents = host.readFile(file);
    return contents === undefined
      ? undefined
      : ts.createSourceFile(file, contents, languageVersion);
  };
  return ts
    .getPreEmitDiagnostics(ts.createProgram([...files.keys()], options, host))
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    );
}

async function bundle(
  f: Fixture,
  options: { reactVersion?: string; bootstrap?: boolean } = {},
) {
  const generated = existingEmitted(f);
  return build({
    stdin: {
      contents:
        options.bootstrap === false
          ? "import 'generated-subject';"
          : `
        import * as React from 'react'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom';
        import {RetainedProbe} from 'generated-subject';
        const root=createRoot(document.getElementById('root'));
        window.renderSubject=(props)=>flushSync(()=>root.render(React.createElement(RetainedProbe,props)));
        window.callSubject=(props)=>RetainedProbe(props);
        window.callBadSlot=(kind)=> {
          const component=()=>null;
          const child=React.createElement(kind==='fragment'?React.Fragment:kind==='component'?component:'i',kind==='conflict'?{slot:'after'}:{},'Content');
          return RetainedProbe({label:'Explicit',variant:'secondary',before:child});
        };
        window.renderCase=(value)=> {
          const {beforeKind,afterKind,visible,...props}=value;
          const before=beforeKind==='element' ? React.createElement('i',{'data-original':'before'},'Before')
            : beforeKind==='conflict' ? React.createElement('i',{slot:'after'},'Wrong')
            : beforeKind==='primitive' ? 'Before' : undefined;
          const after=afterKind==='element' ? React.createElement('b',{'data-original':'after'},'After') : undefined;
          window.renderSubject({...props,before,after,children:visible,ref:element=>window.originalRef=element});
        };
        window.renderAuthoredChildren=()=>window.renderSubject({label:'Independent',children:[
          React.createElement('i',{key:'before',slot:'before','data-original':'authored'},'Before'),
          'Visible',React.createElement('b',{key:'after',slot:'after'},'After')
        ]});
      `,
      resolveDir: process.cwd(),
      sourcefile: "runtime-emission-mount.tsx",
      loader: "tsx",
    },
    bundle: true,
    write: false,
    outfile: "runtime-subject.js",
    format: "iife",
    jsx: "automatic",
    plugins: [
      {
        name: "recorded-runtime-fixture",
        setup(builder) {
          builder.onResolve({ filter: /^generated-subject$/ }, () => ({
            path: "RetainedProbe.tsx",
            namespace: "generated-runtime",
          }));
          builder.onLoad(
            { filter: /.*/, namespace: "generated-runtime" },
            () => ({
              contents: generated.tsx,
              loader: "tsx",
              resolveDir: process.cwd(),
            }),
          );
          builder.onResolve(
            { filter: /^\.\/runtime\//, namespace: "generated-runtime" },
            (args) => ({ path: args.path, namespace: "original-runtime" }),
          );
          builder.onLoad(
            { filter: /.*/, namespace: "original-runtime" },
            (args) => {
              if (args.path.endsWith("/fixture.js"))
                return { contents: originalModule, loader: "js" };
              if (args.path.endsWith("/fixture.css"))
                return { contents: originalStylesheet, loader: "css" };
              throw Error(`unexpected fixture import ${args.path}`);
            },
          );
          if (options.reactVersion) {
            builder.onResolve(
              { filter: /^react$/, namespace: "generated-runtime" },
              () => ({
                path: "version-probe",
                namespace: "react-version-probe",
              }),
            );
            builder.onLoad(
              { filter: /.*/, namespace: "react-version-probe" },
              () => ({
                contents: `export * from ${JSON.stringify(path.resolve("node_modules/react/index.js"))}; export const version=${JSON.stringify(options.reactVersion)};`,
                loader: "js",
                resolveDir: process.cwd(),
              }),
            );
          }
        },
      },
    ],
  });
}
async function mount(
  page: Page,
  f: Fixture,
  options: { reactVersion?: string; bootstrap?: boolean } = {},
) {
  const built = await bundle(f, options);
  await page.setContent(
    '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
  );
  const css = built.outputFiles.find((file) => file.path.endsWith(".css"));
  if (css) await page.addStyleTag({ content: css.text });
  await page.addScriptTag({
    content: built.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
  });
}
async function render(page: Page, input: Record<string, unknown>) {
  await page.evaluate(
    (value) =>
      (
        window as unknown as {
          renderCase(value: Record<string, unknown>): void;
        }
      ).renderCase(value),
    input,
  );
}
async function observe(page: Page) {
  return page.locator("original-runtime-probe").evaluate((element) => {
    const host = element as HTMLElement & {
      label?: string;
      variant?: string;
      isPressed?: boolean | "mixed";
      styleModifier?: string;
      labelAtConnection?: string;
      slotNodes: Node[];
      originalMethod(): string;
    };
    const button = host.shadowRoot!.querySelector("button")!;
    return {
      label: host.label ?? null,
      labelAtConnection: host.labelAtConnection ?? null,
      variant: host.variant ?? null,
      pressed: host.isPressed ?? null,
      pressedType: typeof host.isPressed,
      ariaLabel: button.getAttribute("aria-label"),
      ariaPressed: button.getAttribute("aria-pressed"),
      variantAttribute: button.getAttribute("data-variant"),
      modifier: button.getAttribute("data-modifier"),
      className: host.className,
      hostColor: getComputedStyle(host).color,
      outline: getComputedStyle(host).outlineColor,
      color: getComputedStyle(button).color,
      background: getComputedStyle(button).backgroundColor,
      padding: getComputedStyle(button).padding,
      light: [...host.childNodes].map((node) => ({
        kind: node.nodeType,
        tag: node instanceof Element ? node.tagName : null,
        text: node.textContent,
        slot: node instanceof Element ? node.getAttribute("slot") : null,
      })),
      slots: [...host.shadowRoot!.querySelectorAll("slot")].map((slot) => ({
        name: slot.name,
        assigned: slot
          .assignedNodes()
          .map((node) => ({ kind: node.nodeType, text: node.textContent })),
      })),
      refIsHost:
        (window as unknown as { originalRef?: unknown }).originalRef === host,
      refMethod: host.originalMethod(),
      refSlotCount: host.slotNodes.length,
      hasReconstructedWrapper: host.querySelector("div,span") !== null,
    };
  });
}

test("pure lowering retains original imports/types and rejects absent or altered trust records", () => {
  const f = fixture();
  const result = emitted(f);
  assert.match(result.tsx, /FixtureElement as OriginalElement/);
  assert.match(result.tsx, /Partial<Pick<OriginalElementType/);
  assert.match(result.tsx, /fixture\.css/);
  assert.doesNotMatch(result.tsx, /<button|attachShadow|innerHTML/);
  assert.throws(() => emitRuntimeReact(f.contract), /TRUSTED-CONTEXT-MISSING/);
  assert.throws(
    () =>
      emitRuntimeReact(f.contract, {
        artifacts: new Map(),
        bindings: new Map(),
        tokens: tokenValues,
      }),
    /ARTIFACT-OR-BINDING-UNAVAILABLE/,
  );
  for (const change of [
    (g: Fixture) => {
      g.artifact.interface.module.exportName = "Changed";
    },
    (g: Fixture) => {
      g.binding.properties[0].sourceProperty = "variant";
    },
    (g: Fixture) => {
      g.contract.bindings.code.runtime!.interfaceRevision = `sha256:${"0".repeat(64)}`;
    },
  ]) {
    const g = fixture();
    change(g);
    assert.throws(() => emitted(g), /IDENTITY-MISMATCH/);
  }
  const changed = fixture();
  changed.contract.anatomy.root.layout!.direction = "column";
  assert.throws(() => emitted(changed), /UNQUALIFIED-CONTRACT-CHANGE/);
  const tokenChanged = fixture();
  (tokenChanged.context.tokens as typeof tokenValues).primitives.ink.$value =
    "#abcdef";
  assert.throws(
    () => emitted(tokenChanged),
    /UNQUALIFIED-TOKEN-CHANGE/,
    "unchanged token names do not hide changed token values",
  );
  const relocated = fixture();
  relocated.contract.bindings.figma.anchors = {
    fileKey: "new-file",
    componentSetKey: "new-key",
    nodeId: "1:2",
  };
  relocated.contract.bindings.code.anchors.importPath = "new/output/location";
  assert.doesNotThrow(
    () => emitted(relocated),
    "location is not source runtime identity or styling authority",
  );
});

test("hash-consistent invalid aliases, paths, adapters and mappings refuse", () => {
  for (const mutate of [
    (f: Fixture) => {
      f.artifact.interface.module.path = "../untrusted.js";
    },
    (f: Fixture) => {
      f.artifact.interface.declaration.path =
        "https://example.invalid/types.d.ts";
    },
    (f: Fixture) => {
      f.artifact.interface.peerRuntime = {
        name: "react",
        major: 18,
        mounting: "direct-custom-element",
      } as never;
    },
    (f: Fixture) => {
      f.artifact.interface.writableProperties.push("slotNodes");
    },
    (f: Fixture) => {
      f.binding.properties[0].sourceProperty = "notDeclared";
    },
    (f: Fixture) => {
      f.binding.properties.pop();
    },
    (f: Fixture) => {
      f.binding.properties.push({ ...f.binding.properties[0] });
    },
    (f: Fixture) => {
      f.contract.props[0].bindings.code.prop = "alias";
    },
    (f: Fixture) => {
      f.binding.slots[0].sourceSlot = "missing";
    },
    (f: Fixture) => {
      f.binding.slots[1].contractSlot = "label";
    },
    ...["sourceProps", "props", "return"].map((name) => (f: Fixture) => {
      f.contract.anatomy.root.parts!.before.slot!.name = name;
      f.binding.slots[1].contractSlot = name;
    }),
    (f: Fixture) => {
      f.contract.events = [
        {
          name: "activate",
          trigger: "root",
          bindings: { code: { prop: "onActivate" } },
        },
      ];
    },
  ]) {
    const f = fixture();
    mutate(f);
    rebind(f, true);
    assert.throws(
      () => resolveRuntimeEmission(f.contract, f.context),
      /RUNTIME-EMISSION-/,
    );
  }
});

test("hash consistency cannot qualify wrong projected types, invented defaults or missing source declaration types", () => {
  for (const mutate of [
    (f: Fixture) => {
      f.contract.props[0].type = "boolean";
    },
    (f: Fixture) => {
      f.contract.props[1].type = { enum: ["secondary", "invented"] };
    },
    (f: Fixture) => {
      f.contract.props[1].default = "secondary";
    },
    (f: Fixture) => {
      f.contract.props.push({
        name: "isPressed",
        type: "boolean",
        bindings: {
          code: { prop: "isPressed" },
          figma: { kind: "BOOLEAN", property: "Pressed" },
        },
      });
      f.binding.properties.push({
        contractProp: "isPressed",
        sourceProperty: "isPressed",
      });
    },
    (f: Fixture) => {
      Reflect.deleteProperty(f.artifact.interface, "properties");
    },
  ]) {
    const f = fixture();
    mutate(f);
    rebind(f, true);
    assert.throws(() => emitted(f), /RUNTIME-EMISSION-/);
  }
});

test("unqualified slot constraints and global-shadowing exports refuse instead of silently changing semantics", async (t) => {
  for (const [key, value] of Object.entries({
    required: true,
    min: 1,
    max: 1,
    accepts: [],
    defaultContent: [],
  })) {
    await t.test(`slot ${key}`, () => {
      const f = fixture();
      Object.assign(f.contract.anatomy.root.parts!.before.slot!, {
        [key]: value,
      });
      rebind(f, true);
      assert.throws(() => emitted(f), /RUNTIME-EMISSION-/);
    });
  }
  for (const name of ["customElements", "Number", "Error"]) {
    await t.test(`export ${name}`, () => {
      const f = fixture();
      f.contract.name = name;
      rebind(f, true);
      assert.throws(() => emitted(f), /RUNTIME-EMISSION-EXPORT-NAME-UNSAFE/);
    });
  }
});

test("required text keeps existing validator constraints and does not invent a runtime default", () => {
  const f = fixture();
  f.contract.props[0].required = true;
  rebind(f, true);
  assert.throws(
    () => existingEmitted(f),
    /required text prop "label" must declare a string default/,
  );
  f.contract.props[0].default = "Invented";
  rebind(f, true);
  assert.throws(
    () => existingEmitted(f),
    /RUNTIME-EMISSION-DECLARED-DEFAULT-UNQUALIFIED/,
  );
});

test("generated TSX semantically typechecks against original declaration, retaining mixed values and ref-only members", () => {
  const f = fixture(),
    generated = existingEmitted(f).tsx;
  assert.deepEqual(
    typeErrors(
      f,
      generated,
      `
    const first=<RetainedProbe label="Independent" variant={undefined} isPressed="mixed" styleModifier="inherited" before={<i>Before</i>} after={<b>After</b>}>Visible</RetainedProbe>;
    const second=<RetainedProbe variant="secondary" isPressed={false} className="consumer" style={{color:'red'}} ref={element=>{if(element){const nodes:readonly Node[]=element.slotNodes;const result:'original-method'=element.originalMethod();}}}/>;
  `,
    ),
    [],
  );
  for (const consumer of [
    '<RetainedProbe isPressed="yes"/>;',
    '<RetainedProbe variant="primary"/>;',
    "<RetainedProbe label={false}/>;",
    "<RetainedProbe slotNodes={[]}/>;",
    '<RetainedProbe before="invented wrapper"/>;',
  ])
    assert.ok(typeErrors(f, generated, consumer).length > 0, consumer);
  const required = requiredEnumFixture();
  const requiredTsx = existingEmitted(required).tsx;
  assert.deepEqual(
    typeErrors(required, requiredTsx, '<RetainedProbe variant="secondary"/>;'),
    [],
  );
  assert.ok(typeErrors(required, requiredTsx, "<RetainedProbe/>;").length > 0);
  assert.ok(
    typeErrors(required, requiredTsx, "<RetainedProbe variant={undefined}/>;")
      .length > 0,
  );
});

test("actual generated React 19 preserves original lifecycle, typed values, CSS, slots and host/ref passthrough", async (t) => {
  const browser = await chromium.launch();
  try {
    await t.test(
      "initial properties precede connection and do not conflate accessible label with visible content",
      async () => {
        const page = await browser.newPage();
        try {
          await mount(page, fixture());
          await render(page, {
            label: "Explicit accessible",
            visible: "Different visible",
            isPressed: "mixed",
            styleModifier: "original-modifier",
            beforeKind: "element",
            afterKind: "element",
            className: "consumer-class",
            style: { color: "rgb(91, 101, 111)" },
          });
          await page.waitForTimeout(25);
          const state = await observe(page);
          assert.equal(state.labelAtConnection, "Explicit accessible");
          assert.equal(state.ariaLabel, "Explicit accessible");
          assert.equal(state.ariaPressed, "mixed");
          assert.equal(state.pressedType, "string");
          assert.equal(state.modifier, "original-modifier");
          assert.equal(state.variant, null);
          assert.equal(state.variantAttribute, null);
          assert.equal(state.background, "rgb(19, 41, 63)");
          assert.equal(state.padding, "7px");
          assert.equal(state.color, "rgb(13, 23, 33)");
          assert.equal(state.outline, "rgb(71, 81, 91)");
          assert.equal(state.hostColor, "rgb(91, 101, 111)");
          assert.equal(state.className, "consumer-class");
          assert.equal(state.refIsHost, true);
          assert.equal(state.refMethod, "original-method");
          assert.equal(state.refSlotCount, 1);
          assert.equal(state.hasReconstructedWrapper, false);
          assert.deepEqual(state.light, [
            { kind: 1, tag: "I", text: "Before", slot: "before" },
            { kind: 1, tag: "B", text: "After", slot: "after" },
            { kind: 3, tag: null, text: "Different visible", slot: null },
          ]);
          assert.deepEqual(state.slots, [
            { name: "before", assigned: [{ kind: 1, text: "Before" }] },
            { name: "", assigned: [{ kind: 3, text: "Different visible" }] },
            { name: "after", assigned: [{ kind: 1, text: "After" }] },
          ]);
          await render(page, {
            label: "Still independent",
            visible: "Changed visible",
            variant: "secondary",
            isPressed: false,
          });
          let changed = await observe(page);
          assert.equal(changed.ariaPressed, "false");
          assert.equal(changed.pressedType, "boolean");
          assert.equal(changed.variant, "secondary");
          assert.equal(changed.background, "rgb(51, 71, 91)");
          await render(page, {
            label: "Still independent",
            visible: "Changed visible",
          });
          changed = await observe(page);
          assert.equal(changed.variant, null);
          assert.equal(changed.variantAttribute, null);
          assert.equal(changed.pressedType, "undefined");
          assert.equal(changed.ariaPressed, null);
          assert.equal(changed.background, "rgb(19, 41, 63)");
        } finally {
          await page.close();
        }
      },
    );
    await t.test(
      "authored physical named children remain unwrapped and original fallback remains original behavior",
      async () => {
        const page = await browser.newPage();
        try {
          await mount(page, fixture());
          await page.evaluate(() =>
            (
              window as unknown as { renderAuthoredChildren(): void }
            ).renderAuthoredChildren(),
          );
          const authored = await observe(page);
          assert.deepEqual(
            authored.light.map((node) => [node.tag, node.slot, node.text]),
            [
              ["I", "before", "Before"],
              [null, null, "Visible"],
              ["B", "after", "After"],
            ],
          );
          assert.equal(authored.hasReconstructedWrapper, false);
          await page.evaluate(() =>
            (
              window as unknown as { renderSubject(value: unknown): void }
            ).renderSubject({
              key: "fresh",
              children: "  Original fallback  ",
            }),
          );
          await page.waitForFunction(
            () =>
              document
                .querySelector("original-runtime-probe")
                ?.shadowRoot?.querySelector("button")
                ?.getAttribute("aria-label") === "Original fallback",
          );
          const fallback = await observe(page);
          assert.equal(fallback.labelAtConnection, null);
          assert.equal(fallback.label, "Original fallback");
          assert.equal(fallback.light[0].text, "  Original fallback  ");
        } finally {
          await page.close();
        }
      },
    );
    await t.test(
      "unsupported React version and pre-existing different custom-element constructor refuse",
      async () => {
        const page = await browser.newPage();
        try {
          const versionError = page.waitForEvent("pageerror", {
            timeout: 5000,
          });
          await mount(page, fixture(), {
            reactVersion: "18.3.1",
            bootstrap: false,
          });
          assert.match(
            (await versionError).message,
            /RUNTIME-EMISSION-REACT-VERSION/,
          );
          const built = await bundle(fixture(), { bootstrap: false });
          await page.addScriptTag({
            content:
              "customElements.define('original-runtime-probe',class DifferentElement extends HTMLElement {});",
          });
          const collisionError = page.waitForEvent("pageerror", {
            timeout: 5000,
          });
          await page.addScriptTag({
            content: built.outputFiles.find((file) =>
              file.path.endsWith(".js"),
            )!.text,
          });
          assert.match(
            (await collisionError).message,
            /RUNTIME-EMISSION-REGISTRATION-COLLISION/,
          );
        } finally {
          await page.close();
        }
      },
    );
    await t.test(
      "named primitive/conflicting/custom slots and omitted required properties refuse without inventing DOM",
      async () => {
        const page = await browser.newPage();
        try {
          const f = requiredEnumFixture();
          await mount(page, f);
          await assert.rejects(
            page.evaluate(() =>
              (
                window as unknown as { callSubject(props: unknown): unknown }
              ).callSubject({}),
            ),
            /RUNTIME-EMISSION-REQUIRED-PROPERTY/,
          );
          await assert.rejects(
            page.evaluate(() =>
              (
                window as unknown as { callSubject(props: unknown): unknown }
              ).callSubject({
                variant: "secondary",
                label: "Explicit",
                before: "Primitive",
              }),
            ),
            /RUNTIME-EMISSION-SLOTTED-ELEMENT-UNSUPPORTED/,
          );
          for (const value of ["conflict", "fragment", "component"]) {
            await assert.rejects(
              page.evaluate(
                (kind) =>
                  (
                    window as unknown as { callBadSlot(kind: string): unknown }
                  ).callBadSlot(kind),
                value,
              ),
              value === "conflict"
                ? /RUNTIME-EMISSION-SLOT-CONFLICT/
                : /RUNTIME-EMISSION-SLOTTED-ELEMENT-UNSUPPORTED/,
            );
          }
          assert.equal(
            await page.locator("#root").textContent(),
            "",
            "refused values create no fallback wrappers",
          );
        } finally {
          await page.close();
        }
      },
    );
  } finally {
    await browser.close();
  }
});
