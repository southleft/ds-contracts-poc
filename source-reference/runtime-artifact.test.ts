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
      !process.env.DS_RUNTIME_ARTIFACT_REVISION,
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
      inspectAltitudeButtonRuntimeInputs(checkout).inputRevision,
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
    const source = `import type {ALButton} from './dist/components/button/button';
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
