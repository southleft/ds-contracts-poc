import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  realpathSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { revisionOf } from "../core/contract-provenance.js";
import {
  inspectAltitudeButtonRuntimeInputs,
  inspectAltitudeRuntimeInputs,
  altitudeButtonRuntimeRecipeIdentity,
  altitudeRuntimeRecipeIdentity,
  ALTITUDE_CHECKBOX_REGISTRATION_GUARD,
  prepareAltitudeRuntime,
  prepareAltitudeButtonRuntime,
  readVerifiedRuntimeArtifact,
  type RuntimeArtifactManifest,
  type RuntimeArtifactInterface,
  type RuntimeInputManifest,
} from "./runtime-artifact.js";

const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "runtime-artifact-test-"));
  const bodies = new Map([
    ["components/button.js", "export class ALButton extends HTMLElement {}\n"],
    [
      "components/button.d.ts",
      "export declare class ALButton extends HTMLElement { isPressed: boolean | 'mixed'; readonly slotNodes: Node[]; }\n",
    ],
    ["css/theme.css", ":root { --example: blue; }\n"],
  ]);
  const inputBase: Omit<RuntimeInputManifest, "inputRevision"> = {
    version: 1,
    adapter: "altitude-button-v1",
    sourceRevision: "a".repeat(40),
    files: [
      {
        path: "src/button.ts",
        bytes: 12,
        sha256: "a".repeat(64),
        kind: "source",
      },
    ],
    packages: [],
    tools: {
      vite: "tools/vite",
      sass: "tools/sass",
      typescript: "tools/typescript",
    },
  };
  const inputs = {
    ...inputBase,
    inputRevision: sha(JSON.stringify(inputBase)),
  };
  const iface: RuntimeArtifactInterface = {
    version: 1,
    module: { path: "components/button.js", exportName: "ALButton" },
    declaration: { path: "components/button.d.ts", exportName: "ALButton" },
    tagBase: "al-button",
    writableProperties: ["isPressed"],
    properties: [
      {
        name: "isPressed",
        typeText: "boolean | 'mixed'",
        sourcePath: "src/button.ts",
        declaringClass: "ALButton",
        writable: true,
        reason: "lit-property",
      },
      {
        name: "slotNodes",
        typeText: "Node[]",
        sourcePath: "src/button.ts",
        declaringClass: "ALButton",
        writable: false,
        reason: "computed-query",
      },
    ],
    slots: [{ name: "" }, { name: "before" }],
    events: [],
    originalDeclarations: [],
    typeDependencies: [{ name: "lit", version: "3.3.3" }],
    peerRuntime: {
      name: "react",
      major: 19,
      mounting: "direct-custom-element",
    },
  };
  const manifest: RuntimeArtifactManifest = {
    version: 1,
    kind: "original-custom-element-runtime",
    adapter: "fixture",
    source: {
      revision: inputs.sourceRevision,
      inputRevision: inputs.inputRevision,
      baselineSha256: "b".repeat(64),
    },
    recipe: {
      version: "fixture",
      sha256: "c".repeat(64),
      node: process.version,
      conditions: ["browser"],
      repeatedBuildIdentical: true,
    },
    interface: iface,
    interfaceRevision: revisionOf(iface),
    inputs,
    consumedInputs: ["src/button.ts"],
    stylesheetInputs: [],
    files: [...bodies].map(([file, body]) => ({
      path: file,
      bytes: Buffer.byteLength(body),
      sha256: sha(body),
      kind: file.endsWith(".d.ts")
        ? "declaration"
        : file.endsWith(".css")
          ? "stylesheet"
          : "module",
    })),
    limitations: ["Synthetic reader fixture only."],
  };
  for (const [file, body] of bodies) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), body);
  }
  const save = () => {
    const body = JSON.stringify(manifest) + "\n";
    writeFileSync(path.join(root, "manifest.json"), body);
    return "sha256:" + sha(body);
  };
  return {
    root,
    bodies,
    manifest,
    save,
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("verified artifact preserves exact files, typed union and read-only ref API without executing runtime", () => {
  const f = fixture();
  try {
    const revision = f.save(),
      first = readVerifiedRuntimeArtifact(f.root, revision),
      second = readVerifiedRuntimeArtifact(f.root, revision);
    assert.deepEqual(first, second);
    assert.equal(first.files.size, 3);
    assert.deepEqual(first.manifest.interface.writableProperties, [
      "isPressed",
    ]);
    assert.equal(
      first.manifest.interface.properties.find(
        (property) => property.name === "slotNodes",
      )?.writable,
      false,
    );
    assert.match(
      first.files.get("components/button.d.ts")!.toString(),
      /boolean \| 'mixed'/,
    );
    assert.match(first.registrationTag, /^al-button-runtime-[a-f0-9]{16}$/);
    // The module would throw in this Node process if evaluated. Reading stays data-only.
    assert.equal(typeof globalThis.HTMLElement, "undefined");
  } finally {
    f.dispose();
  }
});

test("tampered, missing, extra and symlinked artifact bytes refuse", async (t) => {
  for (const kind of [
    "tampered",
    "missing",
    "extra",
    "file-symlink",
    "directory-symlink",
  ])
    await t.test(kind, () => {
      const f = fixture(),
        outside = mkdtempSync(
          path.join(os.tmpdir(), "runtime-artifact-outside-"),
        );
      try {
        const revision = f.save(),
          module = path.join(f.root, "components/button.js");
        if (kind === "tampered") writeFileSync(module, "changed");
        if (kind === "missing") rmSync(module);
        if (kind === "extra")
          writeFileSync(path.join(f.root, "unrecorded.js"), "not listed");
        if (kind === "file-symlink") {
          writeFileSync(
            path.join(outside, "button.js"),
            f.bodies.get("components/button.js")!,
          );
          rmSync(module);
          symlinkSync(path.join(outside, "button.js"), module);
        }
        if (kind === "directory-symlink") {
          writeFileSync(
            path.join(outside, "button.js"),
            f.bodies.get("components/button.js")!,
          );
          rmSync(path.join(f.root, "components"), { recursive: true });
          symlinkSync(outside, path.join(f.root, "components"));
        }
        assert.throws(() => readVerifiedRuntimeArtifact(f.root, revision));
      } finally {
        f.dispose();
        rmSync(outside, { recursive: true, force: true });
      }
    });
});

test("an ancestor symlink cannot redirect an artifact directory", () => {
  const f = fixture();
  const outside = mkdtempSync(
    path.join(os.tmpdir(), "runtime-artifact-parent-"),
  );
  try {
    const revision = f.save();
    const alias = path.join(outside, "alias");
    symlinkSync(path.dirname(f.root), alias);
    assert.throws(
      () =>
        readVerifiedRuntimeArtifact(
          path.join(alias, path.basename(f.root)),
          revision,
        ),
      /directory-symlink/,
    );
  } finally {
    f.dispose();
    rmSync(outside, { recursive: true, force: true });
  }
});

test("manifest, interface, code paths and writable members require exact validated identities", async (t) => {
  const mutations: Array<
    [string, (manifest: RuntimeArtifactManifest) => void]
  > = [
    [
      "path traversal",
      (m) => {
        m.interface.module.path = "../outside.js";
      },
    ],
    [
      "absolute module",
      (m) => {
        m.interface.module.path = "/tmp/outside.js";
      },
    ],
    [
      "duplicate output",
      (m) => {
        m.files.push({ ...m.files[0] });
      },
    ],
    [
      "declaration-as-runtime",
      (m) => {
        m.interface.module.path = m.interface.declaration.path;
      },
    ],
    [
      "untyped runtime import despite separate declaration",
      (m) => {
        m.interface.declaration.path = "types/button.d.ts";
      },
    ],
    [
      "unknown writable property",
      (m) => {
        m.interface.writableProperties.push("invented");
      },
    ],
    [
      "query made writable",
      (m) => {
        m.interface.properties[1].writable = true;
        m.interface.writableProperties.push("slotNodes");
      },
    ],
    [
      "duplicate slot",
      (m) => {
        m.interface.slots.push({ name: "before" });
      },
    ],
    [
      "unrecorded consumed module",
      (m) => {
        m.consumedInputs.push("node_modules/unrecorded.js");
      },
    ],
    [
      "discovery consumed as runtime",
      (m) => {
        m.inputs.files[0].kind = "config-discovery";
        m.inputs.inputRevision = sha(
          JSON.stringify({ ...m.inputs, inputRevision: undefined }),
        );
      },
    ],
  ];
  for (const [name, mutate] of mutations)
    await t.test(name, () => {
      const f = fixture();
      try {
        mutate(f.manifest);
        f.manifest.interfaceRevision = revisionOf(f.manifest.interface);
        assert.throws(() => readVerifiedRuntimeArtifact(f.root, f.save()));
      } finally {
        f.dispose();
      }
    });
  const f = fixture();
  try {
    const revision = f.save();
    f.manifest.interface.events.push({ name: "changed" });
    f.save();
    assert.throws(
      () => readVerifiedRuntimeArtifact(f.root, revision),
      /manifest-hash-mismatch/,
    );
    assert.throws(
      () => readVerifiedRuntimeArtifact(f.root, f.save()),
      /manifest-invalid/,
    );
    assert.throws(
      () => readVerifiedRuntimeArtifact(f.root, "wrong"),
      /expected-revision-invalid/,
    );
  } finally {
    f.dispose();
  }
});

test("preparation requires explicit trusted-local approval and unchanged baseline before any source build", () => {
  const root = realpathSync(
    mkdtempSync(path.join(os.tmpdir(), "runtime-preparation-refusal-")),
  );
  try {
    const request = {
      checkout: root,
      expectedInputManifest: {
        adapter: "altitude-button-v1",
        sourceRevision: "a".repeat(40),
        inputRevision: "b".repeat(64),
      },
      sourceApproval: {
        kind: "canvas-metadata",
        checkout: root,
        sourceRevision: "a".repeat(40),
        inputRevision: "b".repeat(64),
        baseline: {
          path: path.join(root, "measurement.json"),
          sha256: "c".repeat(64),
        },
      },
      outputRoot: root,
    };
    assert.throws(
      () => prepareAltitudeButtonRuntime(request as never),
      /approval-required/,
    );
    request.sourceApproval.kind = "local-source-build";
    assert.throws(
      () => prepareAltitudeRuntime(request as never, "checkbox"),
      /approval-required/,
    );
    writeFileSync(request.sourceApproval.baseline.path, "{}");
    assert.throws(
      () => prepareAltitudeButtonRuntime(request as never),
      /baseline-changed/,
    );
    request.sourceApproval.baseline.sha256 = sha(
      readFileSync(request.sourceApproval.baseline.path),
    );
    assert.throws(
      () => prepareAltitudeButtonRuntime(request as never),
      /baseline-invalid/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Opt-in because the current private Altitude artifact is not public test data.
// The byte reader tests above run in every environment without that library.
test(
  "actual prepared original module refuses auto-registration before any define and preserves original Lit inputs",
  {
    skip:
      !process.env.DS_RUNTIME_ARTIFACT_DIR ||
      !process.env.DS_RUNTIME_ARTIFACT_REVISION ||
      process.env.DS_RUNTIME_ARTIFACT_COMPONENT === "checkbox",
  },
  async () => {
    const artifact = readVerifiedRuntimeArtifact(
      process.env.DS_RUNTIME_ARTIFACT_DIR!,
      process.env.DS_RUNTIME_ARTIFACT_REVISION!,
    );
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ headless: true });
    try {
      for (const auto of [undefined, false, true]) {
        const context = await browser.newContext({ serviceWorkers: "block" });
        await context.route("**/*", async (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== "http://127.0.0.1:43211") return route.abort();
          if (url.pathname === "/")
            return route.fulfill({
              contentType: "text/html",
              body: "<!doctype html><div id='root'></div>",
            });
          const bytes = artifact.files.get(url.pathname.slice(1));
          return bytes
            ? route.fulfill({
                body: bytes,
                contentType: url.pathname.endsWith(".css")
                  ? "text/css"
                  : "text/javascript",
              })
            : route.abort();
        });
        const page = await context.newPage();
        await page.goto("http://127.0.0.1:43211/");
        const result = await page.evaluate(
          async ({ auto, module, tag }) => {
            if (auto !== undefined)
              Reflect.set(globalThis, "alAutoRegistry", auto);
            let defines = 0;
            const originalDefine = customElements.define.bind(customElements);
            customElements.define = (...args) => {
              defines++;
              return originalDefine(...args);
            };
            try {
              const loaded = await import("/" + module.path);
              const element = loaded[module.exportName];
              const beforeRegistration = defines;
              customElements.define(tag, element);
              const host = document.createElement(tag) as HTMLElement & {
                isPressed: unknown;
                label: unknown;
                updateComplete: Promise<unknown>;
              };
              host.isPressed = "mixed";
              host.label = "Separate accessible name";
              host.append("Visible slot text");
              document.getElementById("root")!.append(host);
              await host.updateComplete;
              await new Promise((resolve) => setTimeout(resolve, 30));
              return {
                status: "loaded",
                defines,
                beforeRegistration,
                inputs: [
                  ...element.elementProperties.keys(),
                ].sort() as string[],
                label: host.label,
                pressed: host.isPressed,
                nativeLabel: host
                  .shadowRoot!.querySelector("button")!
                  .getAttribute("aria-label"),
              };
            } catch (error) {
              return { status: "refused", defines, message: String(error) };
            }
          },
          {
            auto,
            module: artifact.manifest.interface.module,
            tag: artifact.registrationTag,
          },
        );
        if (auto === true) {
          assert.equal(result.status, "refused");
          assert.equal(result.defines, 0);
          assert.match(
            result.message!,
            /RUNTIME-ARTIFACT-AUTO-REGISTRY-REFUSED/,
          );
        } else {
          assert.equal(result.status, "loaded");
          assert.equal(result.beforeRegistration, 0);
          assert.equal(result.defines, 1);
          assert.deepEqual(
            result.inputs,
            artifact.manifest.interface.writableProperties.slice().sort(),
          );
          assert.equal(result.label, "Separate accessible name");
          assert.equal(result.nativeLabel, "Separate accessible name");
          assert.equal(result.pressed, "mixed");
        }
        await context.close();
      }
    } finally {
      await browser.close();
    }
  },
);

test(
  "fresh original declarations resolve in a strict consumer without skipLibCheck or invented public types",
  {
    skip:
      !process.env.DS_RUNTIME_ARTIFACT_DIR ||
      !process.env.DS_RUNTIME_ARTIFACT_REVISION ||
      !process.env.DS_RUNTIME_ARTIFACT_CHECKOUT,
  },
  async () => {
    const artifact = readVerifiedRuntimeArtifact(
      process.env.DS_RUNTIME_ARTIFACT_DIR!,
      process.env.DS_RUNTIME_ARTIFACT_REVISION!,
    );
    const checkout = realpathSync(process.env.DS_RUNTIME_ARTIFACT_CHECKOUT!);
    assert.equal(
      inspectAltitudeRuntimeInputs(
        checkout,
        artifact.manifest.interface.tagBase === "al-checkbox"
          ? "checkbox"
          : "button",
      ).inputRevision,
      artifact.manifest.inputs.inputRevision,
    );
    const lib = path.join(checkout, "libs/al-web-components");
    const ts = (
      await import(
        pathToFileURL(
          path.join(
            checkout,
            artifact.manifest.inputs.tools.typescript,
            "lib/typescript.js",
          ),
        ).href
      )
    ).default as typeof import("typescript");
    const declarations = new Map(
      artifact.manifest.files
        .filter((file) => file.kind === "declaration")
        .map((file) => [
          path.join(lib, "dist", file.path),
          artifact.files.get(file.path)!.toString(),
        ]),
    );
    const virtual = path.join(lib, "__runtime_consumer_typecheck__.ts");
    const source =
      artifact.manifest.interface.tagBase === "al-checkbox"
        ? `
import {ALCheckbox} from './dist/components/checkbox/checkbox.js';
import type {ALFieldNote} from './dist/components/field-note/field-note.js';
declare const checkbox: ALCheckbox;
declare const note: ALFieldNote;
checkbox.isChecked = true; checkbox.isDisabled = false;
checkbox.isIndeterminate = true; checkbox.fieldNote = 'Updated note';
checkbox.errorNote = 'Validation error'; checkbox.value = 'accepted';
checkbox.handleOnChange(); checkbox.handleOnKeydown(new KeyboardEvent('keydown'));
checkbox.componentClassNames('source-class');
note.isError = true;
// @ts-expect-error original boolean is not a string union
checkbox.isChecked = 'mixed';
// @ts-expect-error source does not declare a numeric field note
checkbox.fieldNote = 1;
`
        : `import type {ALButton} from './dist/components/button/button';
import {ALButton as OriginalConstructor} from './dist/components/button/button.js';
const constructor: typeof OriginalConstructor = OriginalConstructor;
declare const button: ALButton;
button.isPressed = 'mixed'; button.isDisabled = false;
button.label = 'Separate label'; button.styleModifier = 'preserved';
button.slotNodes.map(node => node.nodeType);
const result = button.componentClassNames('source-class');
// @ts-expect-error source enum has no invented default option
button.variant = 'default';
// @ts-expect-error mixed union is not an arbitrary string
button.isPressed = 'other';
`;
    const options = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      strict: true,
      skipLibCheck: false,
      types: [],
    };
    const host = ts.createCompilerHost(options),
      read = host.readFile,
      exists = host.fileExists,
      directoryExists = host.directoryExists!;
    const canonical = (file: string) => {
      try {
        return realpathSync(file);
      } catch {
        return path.resolve(file);
      }
    };
    host.readFile = (file) =>
      file === virtual
        ? source
        : (declarations.get(canonical(file)) ?? read(file));
    host.fileExists = (file) =>
      file === virtual || declarations.has(canonical(file)) || exists(file);
    host.directoryExists = (dir) =>
      [...declarations.keys()].some((file) =>
        file.startsWith(canonical(dir) + path.sep),
      ) || directoryExists(dir);
    const program = ts.createProgram([virtual], options, host);
    assert.deepEqual(
      ts.getPreEmitDiagnostics(program).map((d) => ({
        code: d.code,
        message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
      })),
      [],
    );
  },
);

test("component-specific runtime recipes preserve the exact historical Button build and reject unknown targets", () => {
  assert.equal(
    altitudeButtonRuntimeRecipeIdentity().sha256,
    "d926537ca44b0dabcbf46ee8b16160a827ebdf26de291bd3f2d5ef5a8bb49cef",
  );
  assert.deepEqual(
    altitudeRuntimeRecipeIdentity("button"),
    altitudeButtonRuntimeRecipeIdentity(),
  );
  assert.notEqual(
    altitudeRuntimeRecipeIdentity("checkbox").sha256,
    altitudeButtonRuntimeRecipeIdentity().sha256,
  );
  assert.equal(
    altitudeRuntimeRecipeIdentity("checkbox").version,
    "altitude-checkbox-vite-memory-v1",
  );
  assert.throws(
    () => altitudeRuntimeRecipeIdentity("arbitrary" as never),
    /component-unsupported/,
  );
  assert.throws(
    () => prepareAltitudeRuntime({} as never, "arbitrary" as never),
    /component-unsupported/,
  );
});

test("nested registration reserves the original constructor, repeats without writes and rejects a foreign constructor", () => {
  const run = new Function(
    "PackageJson",
    "ALFieldNote",
    "customElements",
    ALTITUDE_CHECKBOX_REGISTRATION_GUARD,
  );
  class Original {
    static el = "al-field-note";
  }
  class Foreign {}
  const registrations = new Map<string, unknown>();
  const writes: string[] = [];
  const registry = {
    get: (tag: string) => registrations.get(tag),
    define: (tag: string, constructor: unknown) => {
      registrations.set(tag, constructor);
      writes.push(tag);
    },
  };
  run({ version: "1.0.0" }, Original, registry);
  run({ version: "1.0.0" }, Original, registry);
  assert.deepEqual(writes, ["al-field-note-1-0-0"]);
  assert.equal(registrations.get(writes[0]), Original);
  registrations.set(writes[0], Foreign);
  assert.throws(
    () => run({ version: "1.0.0" }, Original, registry),
    /NESTED-REGISTRY-COLLISION/,
  );
  assert.equal(writes.length, 1);
  assert.equal(registrations.get(writes[0]), Foreign);
  run({ version: "2.0.0_rc" }, Original, registry);
  assert.equal(registrations.get("al-field-note-2-0-0-rc"), Original);
});

test(
  "original Checkbox runtime retains state, events, text and nested slots and refuses registry collisions",
  {
    skip:
      process.env.DS_RUNTIME_ARTIFACT_COMPONENT !== "checkbox" ||
      !process.env.DS_RUNTIME_ARTIFACT_DIR ||
      !process.env.DS_RUNTIME_ARTIFACT_REVISION,
  },
  async () => {
    const artifact = readVerifiedRuntimeArtifact(
      process.env.DS_RUNTIME_ARTIFACT_DIR!,
      process.env.DS_RUNTIME_ARTIFACT_REVISION!,
    );
    assert.equal(artifact.manifest.interface.module.exportName, "ALCheckbox");
    assert.ok(artifact.files.has("components/field-note/field-note.d.ts"));
    assert.equal(
      artifact.manifest.recipe.sha256,
      altitudeRuntimeRecipeIdentity("checkbox").sha256,
    );
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ headless: true });
    try {
      for (const mode of ["ordinary", "auto", "collision"] as const) {
        const context = await browser.newContext({ serviceWorkers: "block" });
        try {
          await context.route("**/*", async (route) => {
            const url = new URL(route.request().url());
            if (url.origin !== "http://127.0.0.1:43211") return route.abort();
            if (url.pathname === "/")
              return route.fulfill({
                contentType: "text/html",
                body: "<!doctype html><main></main>",
              });
            const bytes = artifact.files.get(url.pathname.slice(1));
            return bytes
              ? route.fulfill({
                  body: bytes,
                  contentType: url.pathname.endsWith(".css")
                    ? "text/css"
                    : "text/javascript",
                })
              : route.abort();
          });
          const page = await context.newPage();
          await page.goto("http://127.0.0.1:43211/");
          const result = await page.evaluate(
            async ({ mode, module, tag }) => {
              if (mode === "auto")
                Reflect.set(globalThis, "alAutoRegistry", true);
              const childTag = "al-field-note-1-0-0";
              if (mode === "collision")
                customElements.define(childTag, class extends HTMLElement {});
              let defines = 0;
              const define = customElements.define.bind(customElements);
              customElements.define = (...args) => {
                defines++;
                return define(...args);
              };
              try {
                const loaded = await import("/" + module.path);
                const repeated = await import("/" + module.path);
                if (repeated[module.exportName] !== loaded[module.exportName])
                  throw Error("runtime-module-changed");
                customElements.define(tag, loaded[module.exportName]);
                type Checkbox = HTMLElement & {
                  isChecked?: boolean;
                  isIndeterminate?: boolean;
                  isDisabled?: boolean;
                  isRequired?: boolean;
                  isError?: boolean;
                  fieldNote?: string;
                  errorNote?: string;
                  fieldId?: string;
                  ariaDescribedBy?: string;
                  value?: string;
                  updateComplete: Promise<unknown>;
                };
                const rows = [];
                for (const state of [
                  "default",
                  "checked",
                  "indeterminate",
                  "disabled",
                ]) {
                  const host = document.createElement(tag) as Checkbox;
                  if (state === "checked") host.isChecked = true;
                  if (state === "indeterminate") host.isIndeterminate = true;
                  if (state === "disabled") host.isDisabled = true;
                  host.fieldNote = "Original help";
                  host.value = "accepted";
                  host.append("Original label");
                  const events: unknown[] = [];
                  host.addEventListener("onCheckboxChange", (e) =>
                    events.push((e as CustomEvent).detail),
                  );
                  document.querySelector("main")!.append(host);
                  await host.updateComplete;
                  const input = host.shadowRoot!.querySelector("input")!;
                  const child = host.shadowRoot!.querySelector(
                    childTag,
                  ) as HTMLElement & { updateComplete: Promise<unknown> };
                  await child.updateComplete;
                  const initial = {
                    checked: input.checked,
                    disabled: input.disabled,
                    omitted: host.isChecked === undefined,
                    indeterminateClass: !!host.shadowRoot!.querySelector(
                      ".al-is-indeterminate",
                    ),
                    nested:
                      !!child.shadowRoot?.querySelector(".al-c-field-note"),
                    text: child.textContent?.trim(),
                    linked:
                      input.id === host.fieldId &&
                      input.getAttribute("aria-describedby") === child.id &&
                      !!child.id,
                  };
                  input.click();
                  await host.updateComplete;
                  const clicked = {
                    checked: host.isChecked ?? null,
                    indeterminate: host.isIndeterminate ?? null,
                    events: events.slice(),
                  };
                  if (state !== "disabled") {
                    input.dispatchEvent(
                      new KeyboardEvent("keydown", {
                        code: "Enter",
                        bubbles: true,
                      }),
                    );
                    await host.updateComplete;
                  }
                  host.fieldNote = "Updated help";
                  host.isRequired = true;
                  host.isError = true;
                  host.errorNote = "Validation error";
                  await host.updateComplete;
                  const updated = {
                    sameChild:
                      child === host.shadowRoot!.querySelector(childTag),
                    text: child.textContent?.trim(),
                    required: input.required,
                    checked: host.isChecked ?? null,
                    events: events.slice(),
                    error: host
                      .shadowRoot!.querySelector('slot[name="error"]')
                      ?.textContent?.trim(),
                  };
                  const slotted = document.createElement("strong");
                  slotted.slot = "field-note";
                  slotted.textContent = "Custom nested content";
                  host.append(slotted);
                  await host.updateComplete;
                  const assigned = (
                    host.shadowRoot!.querySelector(
                      'slot[name="field-note"]',
                    ) as HTMLSlotElement
                  ).assignedElements();
                  rows.push({
                    state,
                    initial,
                    clicked,
                    updated,
                    customSlot: assigned[0] === slotted,
                  });
                  host.remove();
                }
                return { status: "loaded", defines, rows };
              } catch (error) {
                return { status: "refused", defines, message: String(error) };
              }
            },
            {
              mode,
              module: artifact.manifest.interface.module,
              tag: artifact.registrationTag,
            },
          );
          if (mode !== "ordinary") {
            assert.equal(result.status, "refused", JSON.stringify(result));
            assert.equal(result.defines, 0);
            assert.match(
              result.message!,
              mode === "auto"
                ? /AUTO-REGISTRY-REFUSED/
                : /NESTED-REGISTRY-COLLISION/,
            );
          } else {
            assert.equal(result.status, "loaded", JSON.stringify(result));
            assert.equal(result.defines, 2);
            assert.equal(result.rows!.length, 4);
            for (const row of result.rows!) {
              const disabled = row.state === "disabled",
                checked = row.state === "checked";
              assert.deepEqual(row.initial, {
                checked,
                disabled,
                omitted: !checked,
                indeterminateClass: row.state === "indeterminate",
                nested: true,
                text: "Original help",
                linked: true,
              });
              assert.equal(row.clicked.checked, disabled ? null : !checked);
              assert.equal(
                row.clicked.indeterminate,
                row.state === "indeterminate" ? false : null,
              );
              assert.equal(row.clicked.events.length, disabled ? 0 : 1);
              assert.equal(row.updated.events.length, disabled ? 0 : 2);
              if (!disabled)
                assert.deepEqual(row.clicked.events[0], {
                  checked: !checked,
                  indeterminate:
                    row.state === "indeterminate" ? false : undefined,
                  value: "accepted",
                });
              assert.equal(row.updated.checked, disabled ? null : checked);
              assert.equal(row.updated.sameChild, true);
              assert.equal(row.updated.text, "Updated help");
              assert.equal(row.updated.required, true);
              assert.equal(row.updated.error, "Validation error");
              assert.equal(row.customSlot, true);
            }
          }
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  },
);
