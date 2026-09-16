import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  loadRecordedSourceProgram,
  type RecordedSourceInput,
} from "./source-program.js";
import { inspectRecordedSourceBindings } from "./source-bindings.js";

const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
function sandbox() {
  const checkout = mkdtempSync(path.join(tmpdir(), "recorded-source-"));
  const sourceHashes: Record<string, string> = {};
  const put = (file: string, text: string) => {
    const target = path.join(checkout, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text);
    sourceHashes[file] = sha(text);
  };
  put("lib/custom-elements.json", "{}");
  const input: RecordedSourceInput = {
    checkout,
    revision: "a".repeat(40),
    manifestPath: "lib/custom-elements.json",
    manifestSha256: sourceHashes["lib/custom-elements.json"],
    modulePath: "Button.ts",
    className: "Button",
    sourceHashes,
  };
  return {
    checkout,
    input,
    put,
    close: () => rmSync(checkout, { recursive: true, force: true }),
  };
}

test("recorded local graph resolves source-only identities without executing top-level code, getters, decorators or controllers", () => {
  const s = sandbox();
  try {
    s.put(
      "lib/Button.ts",
      `import {Base as Parent} from './Base.js'; import './style.css'; throw new Error('must never execute'); export class Button extends Parent { get dangerous(){ throw Error('getter executed'); } protected controller = new Thing(); private hidden=1; static tag='x-button'; render(){return 'text';} }`,
    );
    s.put(
      "lib/Base.ts",
      "export class Base { styleModifier:string; public dispatch() {} }",
    );
    s.put("lib/style.css", "button { color: red }");
    const a = loadRecordedSourceProgram(s.input),
      b = loadRecordedSourceProgram(s.input);
    assert.deepEqual(a, b);
    assert.equal(a.status, "partial");
    assert.deepEqual(a.problems, [
      { code: "source-asset-dependencies-unverified", path: "lib/style.css" },
    ]);
    assert.equal(a.modules.length, 2);
    assert.equal(a.assets.length, 1);
    const entry = a.modules.find((m) => m.path === "lib/Button.ts")!;
    assert.deepEqual(entry.imports[0].bindings, [
      { local: "Parent", imported: "Base" },
    ]);
    assert.equal(entry.classes[0].extends, "Parent");
    assert.equal(
      entry.classes[0].members.find((m) => m.name === "hidden")?.visibility,
      "private",
    );
    assert.equal(
      entry.classes[0].members.find((m) => m.name === "controller")?.visibility,
      "protected",
    );
    assert.equal(
      entry.classes[0].members.find((m) => m.name === "tag")?.static,
      true,
    );
    for (const member of entry.classes[0].members)
      assert.ok(
        entry.text
          .slice(member.span.start, member.span.end)
          .includes(member.name),
      );
  } finally {
    s.close();
  }
});

test("exact recorded Altitude local source graph exposes inherited API, conditional template and form controller without inventing runtime semantics", () => {
  const s = sandbox();
  try {
    const fixture = JSON.parse(
      readFileSync(
        new URL(
          "./fixtures/source-program-button-recorded.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const existing = JSON.parse(
      readFileSync(
        new URL(
          "./fixtures/contract-plan-button-recorded.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const manifest = JSON.parse(
      gunzipSync(Buffer.from(existing.payload, "base64")).toString(),
    )["manifest.json"];
    assert.equal(sha(manifest.utf8), fixture.manifestSha256);
    s.put(fixture.manifestPath, manifest.utf8);
    for (const [file, record] of Object.entries(fixture.files) as [
      string,
      { text: string; sha256: string },
    ][]) {
      assert.equal(sha(record.text), record.sha256);
      s.put(file, record.text);
    }
    const result = loadRecordedSourceProgram({
      ...s.input,
      revision: fixture.sourceRevision,
      manifestPath: fixture.manifestPath,
      manifestSha256: fixture.manifestSha256,
      modulePath: "components/button/button.ts",
      className: "ALButton",
    });
    assert.equal(result.status, "partial");
    assert.equal(result.modules.length, 3);
    assert.equal(result.assets.length, 2);
    assert.ok(
      result.problems.length > 0 &&
        result.problems.every((p) =>
          [
            "external-import-resolution-unverified",
            "source-asset-dependencies-unverified",
          ].includes(p.code),
        ),
    );
    const base = result.modules.find((m) => m.path.endsWith("/ALElement.ts"))!;
    assert.equal(base.classes[0].extends, "LitElement");
    assert.ok(
      base.classes[0].members.some(
        (m) => m.name === "styleModifier" && m.visibility === "public",
      ),
    );
    assert.ok(base.classes[0].members.some((m) => m.name === "slotNotEmpty"));
    const controller = result.modules.find((m) =>
      m.path.endsWith("/controllers/form.ts"),
    )!;
    assert.ok(controller.classes[0].members.some((m) => m.name === "submit"));
    const button = result.modules.find((m) => m.path.endsWith("/button.ts"))!;
    assert.ok(
      button.classes[0].members.some((m) => m.name === "handleOnClick"),
    );
    assert.ok(
      button.text.includes("aria-disabled=${ifDefined(this.isDisabled)}"),
    );
    assert.ok(!button.text.includes("?disabled="));
    for (const module of result.modules)
      assert.equal(module.sha256, fixture.files[module.path].sha256);
    const bindingInput = {
      ...s.input,
      revision: fixture.sourceRevision,
      manifestPath: fixture.manifestPath,
      manifestSha256: fixture.manifestSha256,
      modulePath: "components/button/button.ts",
      className: "ALButton",
      tagName: "al-button",
    };
    const facts = inspectRecordedSourceBindings(bindingInput);
    assert.equal(facts.status, "partial");
    assert.equal(facts.acceptedContract, null);
    assert.deepEqual(
      inspectRecordedSourceBindings(bindingInput),
      facts,
      "app source inventory is deterministic without a new render",
    );
    assert.ok(
      facts.bindings.some(
        (b) =>
          b.tag === "button" &&
          b.target === "aria-label" &&
          b.expression === "ifDefined(this.label)",
      ),
    );
    assert.ok(
      facts.bindings.some(
        (b) =>
          b.tag === "button" &&
          b.target === "aria-disabled" &&
          b.channel === "attribute",
      ),
    );
    assert.ok(
      !facts.bindings.some((b) => b.target === "disabled"),
      "do not promote aria-disabled to native behavior",
    );
    assert.ok(
      facts.bindings.some(
        (b) =>
          b.tag === "button" && b.channel === "event" && b.target === "click",
      ),
    );
    assert.ok(
      !facts.bindings.some((b) => b.tag === "a" && b.channel === "event"),
      "do not leak button listener into anchor branch",
    );
    assert.ok(
      facts.templates.some(
        (t) =>
          t.role === "returned" &&
          t.roots.includes("a") &&
          t.guards.some(
            (g) => g.expression === "this.href" && g.when === "truthy",
          ),
      ),
    );
    assert.ok(
      facts.templates.some(
        (t) =>
          t.role === "returned" &&
          t.roots.includes("button") &&
          t.guards.some(
            (g) => g.expression === "this.href" && g.when === "falsy",
          ),
      ),
    );
    assert.ok(
      facts.templates.some((t) => t.slots.includes("")),
      "default slot is not a label binding",
    );
    assert.ok(
      facts.classes.some(
        (c) =>
          c.name === "ALElement" && c.publicMembers.includes("styleModifier"),
      ),
    );
    assert.ok(
      !JSON.stringify(facts).includes("requestSubmit()"),
      "inventory does not publish or execute complete source bodies",
    );
    writeFileSync(
      path.join(
        s.checkout,
        fixture.manifestPath.replace(
          "custom-elements.json",
          "components/button/button.ts",
        ),
      ),
      "changed source",
    );
    const changed = inspectRecordedSourceBindings(bindingInput);
    assert.equal(changed.status, "refused");
    assert.equal(changed.acceptedContract, null);
    assert.deepEqual(changed.bindings, []);
    assert.deepEqual(changed.templates, []);
    assert.deepEqual(changed.classes, []);
  } finally {
    s.close();
  }
});

test("changed or unrecorded files, ambiguous resolution, symlinks and traversal refuse without executing alternate sources", () => {
  const cases: Array<[string, (s: ReturnType<typeof sandbox>) => void]> = [
    [
      "source-file-hash-mismatch",
      (s) =>
        writeFileSync(
          path.join(s.checkout, "lib/Button.ts"),
          "export class Button { changed=true }",
        ),
    ],
    [
      "source-import-not-recorded",
      (s) =>
        s.put("lib/Button.ts", "import './Missing'; export class Button {}"),
    ],
    [
      "source-import-resolution-ambiguous",
      (s) => {
        s.put("lib/Button.ts", "import './Base'; export class Button {}");
        s.put("lib/Base.ts", "");
        s.put("lib/Base.js", "");
      },
    ],
    [
      "source-import-outside-library",
      (s) =>
        s.put("lib/Button.ts", "import '../outside'; export class Button {}"),
    ],
    [
      "source-import-extension-unsupported",
      (s) =>
        s.put("lib/Button.ts", "import './secret.env'; export class Button {}"),
    ],
    [
      "source-symlink-or-kind-refused",
      (s) => {
        s.put("lib/Actual.ts", "export class Button {}");
        rmSync(path.join(s.checkout, "lib/Button.ts"));
        symlinkSync(
          path.join(s.checkout, "lib/Actual.ts"),
          path.join(s.checkout, "lib/Button.ts"),
        );
      },
    ],
    [
      "source-syntax-invalid",
      (s) => s.put("lib/Button.ts", "export class Button {"),
    ],
    [
      "source-class-identity-not-unique",
      (s) => s.put("lib/Button.ts", "export class Different {}"),
    ],
    [
      "source-dynamic-module-resolution-unsupported",
      (s) =>
        s.put(
          "lib/Button.ts",
          "export class Button { async init(){return import('./Base')} }",
        ),
    ],
    [
      "source-dynamic-module-resolution-unsupported",
      (s) =>
        s.put(
          "lib/Button.ts",
          "export class Button { init(){return module.require('./Missing.js')} }",
        ),
    ],
    [
      "source-dynamic-module-resolution-unsupported",
      (s) =>
        s.put(
          "lib/Button.ts",
          "export class Button { worker=new Worker(new URL('./Missing.js',import.meta.url)) }",
        ),
    ],
  ];
  for (const [code, change] of cases) {
    const s = sandbox();
    try {
      s.put("lib/Button.ts", "export class Button {}");
      change(s);
      const r = loadRecordedSourceProgram(s.input);
      assert.equal(r.status, "refused", code);
      assert.ok(
        r.problems.some((p) => p.code === code),
        JSON.stringify(r.problems),
      );
    } finally {
      s.close();
    }
  }
  const s = sandbox();
  try {
    assert.equal(
      loadRecordedSourceProgram({ ...s.input, modulePath: "../Button.ts" })
        .problems[0].code,
      "source-identity-invalid",
    );
    for (const field of [
      "modulePath",
      "manifestPath",
      "revision",
      "className",
      "checkout",
      "sourceHashes",
    ])
      assert.equal(
        loadRecordedSourceProgram({ ...s.input, [field]: 17 }).problems[0].code,
        "source-identity-invalid",
      );
    writeFileSync(path.join(s.checkout, "lib/custom-elements.json"), "changed");
    assert.equal(
      loadRecordedSourceProgram(s.input).problems[0].code,
      "source-manifest-unavailable-or-changed",
    );
  } finally {
    s.close();
  }
});

test("import cycles terminate and external directive names remain an explicit unresolved implementation boundary", () => {
  const s = sandbox();
  try {
    s.put(
      "lib/Button.ts",
      "import {html as h} from 'lit'; import {ifDefined as defined} from 'lit/directives/if-defined.js'; import './Base'; export class Button { render(){return h`<button aria-label=${defined(this.label)}></button>`} }",
    );
    s.put("lib/Base.ts", "import './Button'; export class Base {}");
    const r = loadRecordedSourceProgram(s.input);
    assert.equal(r.status, "partial");
    assert.equal(r.modules.length, 2);
    assert.equal(
      r.problems.filter(
        (p) => p.code === "external-import-resolution-unverified",
      ).length,
      2,
    );
    assert.deepEqual(
      r.modules.find((m) => m.path === "lib/Button.ts")!.imports[1].bindings,
      [{ local: "defined", imported: "ifDefined" }],
    );
  } finally {
    s.close();
  }
});

// These tests use the actual source graph, with a synthetic already-verified
// runtime envelope. They do not stand in for readVerifiedRuntimeArtifact.
import {
  deriveAltitudeComponentDependencies,
  type SourceComponentDependenciesInput,
} from "./source-component-dependencies.js";
import { altitudeRuntimeRecipeIdentity } from "./runtime-artifact.js";
import { matchLitRender } from "./lit-render-match.js";
import { projectSourceBoundAnatomy } from "./source-bound-anatomy.js";
function dependencyFixture(): SourceComponentDependenciesInput {
  const read = (name: string) =>
    JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));
  const decode = (name: string) => {
    const f = read(name),
      bytes = gunzipSync(Buffer.from(f.payload, "base64"));
    if (f.sha256) assert.equal(sha(bytes), f.sha256);
    return JSON.parse(bytes.toString());
  };
  const { program, packageJson } = decode(
    "./fixtures/checkbox-source-program.json",
  );
  const matched = decode("./fixtures/lit-render-match/altitude-checkbox.json");
  const treeRecord = read("./fixtures/checkbox-anatomy-tree.json");
  const root = JSON.parse(
    gunzipSync(Buffer.from(treeRecord.payload, "base64")).toString(),
  );
  const match = matchLitRender(matched),
    branch = match.nodes.find(
      (n) =>
        n.domPath === matched.boundTopology.topology.observation.rootDomPath,
    )!;
  const anatomy = projectSourceBoundAnatomy({
    ...matched,
    version: 2,
    expectedCaseId: "default",
    sourceProgramSha256: program.digest,
    tree: { root, sha256: treeRecord.sha256 },
    case: {
      id: "default",
      story: "default",
      status: "structure-matched",
      problems: [],
      limitations: [],
      nodes: match.nodes,
      branch: {
        templateId: branch.templateId,
        sourceNodeId: branch.sourceNodeId,
        tag: branch.tag,
      },
      sourcePngSha256: match.sourcePngSha256,
      sourceTreeSha256: match.sourceTreeSha256,
      semanticObservationSha256: match.semanticObservationSha256,
      topologyObservationSha256: match.topologyObservationSha256,
    },
  });
  assert.equal(anatomy.status, "structural-projection");
  const recipe = altitudeRuntimeRecipeIdentity("checkbox");
  return {
    source: matched.source,
    program,
    expectedProgramSha256: program.digest,
    packageJson,
    anatomy,
    artifact: {
      artifactRevision: "sha256:" + "a".repeat(64),
      manifest: {
        adapter: "altitude-checkbox-v1",
        source: { revision: program.revision },
        recipe: { ...recipe, repeatedBuildIdentical: true },
        inputs: {
          files: [...program.modules, ...program.assets].map((m) => ({
            path: m.path,
            sha256: m.sha256,
          })),
        },
        consumedInputs: [...program.modules, ...program.assets].map(
          (m) => m.path,
        ),
      },
    } as SourceComponentDependenciesInput["artifact"],
  };
}
function rebindDependencySource(
  input: SourceComponentDependenciesInput,
  transform: (s: string) => string,
) {
  const entry = input.program.modules.find(
    (m) => m.path === input.program.entryPath,
  )!;
  entry.text = transform(entry.text);
  entry.sha256 = sha(entry.text);
  input.source.source = entry.text;
  input.source.sourceSha256 = entry.sha256;
  input.anatomy.sourceSha256 = entry.sha256;
  input.artifact.manifest.inputs.files.find(
    (f) => f.path === entry.path,
  )!.sha256 = entry.sha256;
  const tagStart = entry.text.indexOf("<${this.fieldNoteEl}");
  const host = input.anatomy.samples.flatMap((s) => s.nestedHosts ?? [])[0];
  host.sourceSpan.end += tagStart - host.sourceSpan.start;
  host.sourceSpan.start = tagStart;
  input.program.digest = sha(
    JSON.stringify({ ...input.program, digest: undefined }),
  );
  input.expectedProgramSha256 = input.program.digest;
  input.anatomy.sourceProgramSha256 = input.program.digest;
}

test("Checkbox dependency resolves its imported FieldNote constructor across original and packaged tag spellings", () => {
  const input = dependencyFixture(),
    before = JSON.stringify(input),
    out = deriveAltitudeComponentDependencies(input);
  assert.equal(
    out.status,
    "dependencies-resolved",
    JSON.stringify(out.problems),
  );
  assert.equal(out.acceptedContract, null);
  assert.equal(JSON.stringify(input), before);
  assert.equal(out.dependencies.length, 1);
  const d = out.dependencies[0];
  assert.equal(d.source.className, "ALFieldNote");
  assert.equal(
    d.source.modulePath,
    "libs/al-web-components/components/field-note/field-note.ts",
  );
  assert.equal(d.source.tagName, "al-field-note");
  assert.equal(d.runtime.registrationTag, "al-field-note-1-0-0");
  assert.equal(d.slotName, "field-note");
  assert.equal(d.distribution, "fallback");
  assert.equal(d.source.moduleSha256, sha(d.source.text));
  assert.deepEqual(deriveAltitudeComponentDependencies(input), out);
});

test("nested dependency refuses wrong source imports, registry helper, runtime guard and mutable tag selection", async (t) => {
  for (const mutation of [
    "stale-module",
    "helper",
    "child-path",
    "package",
    "unconsumed",
    "recipe",
    "constructor-pair",
    "map-write",
    "tag-write",
    "consumer",
  ])
    await t.test(mutation, () => {
      const input = dependencyFixture();
      if (mutation === "stale-module")
        input.program.modules[0].text += "changed";
      if (mutation === "helper") {
        const m = input.program.modules.find((m) =>
          m.path.endsWith("/register.ts"),
        )!;
        m.text += "\n// alternate helper";
        m.sha256 = sha(m.text);
      }
      if (mutation === "child-path") {
        const entry = input.program.modules.find(
          (m) => m.path === input.program.entryPath,
        )!;
        entry.imports.find((i) =>
          i.bindings.some((b) => b.imported === "ALFieldNote"),
        )!.path = "libs/al-web-components/components/other/field-note.ts";
      }
      if (mutation === "package")
        input.packageJson = input.packageJson.replace(
          '"version": "1.0.0"',
          '"version": "2.0.0"',
        );
      if (mutation === "unconsumed")
        input.artifact.manifest.consumedInputs = [];
      if (mutation === "recipe")
        input.artifact.manifest.recipe.sha256 = "b".repeat(64);
      if (mutation === "constructor-pair")
        rebindDependencySource(input, (s) =>
          s.replace(
            "[[ALFieldNote.el, ALFieldNote]]",
            "[[ALFieldNote.el, ALElement]]",
          ),
        );
      if (mutation === "map-write")
        rebindDependencySource(input, (s) =>
          s.replace(
            "render() {",
            'render() { this.elementMap.set("al-field-note", "foreign-note");',
          ),
        );
      if (mutation === "tag-write")
        rebindDependencySource(input, (s) =>
          s.replace(
            "render() {",
            'render() { this.fieldNoteEl = unsafeStatic("foreign-note");',
          ),
        );
      if (mutation === "consumer")
        input.anatomy.samples.find((s) => s.nestedHosts?.length)!.distribution =
          "assigned";
      if (["stale-module", "helper", "child-path"].includes(mutation)) {
        input.program.digest = sha(
          JSON.stringify({ ...input.program, digest: undefined }),
        );
        input.expectedProgramSha256 = input.program.digest;
        input.anatomy.sourceProgramSha256 = input.program.digest;
      }
      const out = deriveAltitudeComponentDependencies(input);
      assert.equal(out.status, "refused", mutation);
      assert.equal(out.dependencies.length, 0);
      assert.ok(out.problems.length);
    });
});

test(
  "resolved nested dependency is the registered original constructor in the admitted runtime across all four source states",
  {
    skip:
      process.env.DS_RUNTIME_ARTIFACT_COMPONENT !== "checkbox" ||
      !process.env.DS_RUNTIME_ARTIFACT_DIR ||
      !process.env.DS_RUNTIME_ARTIFACT_REVISION,
  },
  async () => {
    const { readVerifiedRuntimeArtifact } =
      await import("./runtime-artifact.js");
    const input = dependencyFixture();
    input.artifact = readVerifiedRuntimeArtifact(
      process.env.DS_RUNTIME_ARTIFACT_DIR!,
      process.env.DS_RUNTIME_ARTIFACT_REVISION!,
    );
    const dependencies = deriveAltitudeComponentDependencies(input);
    assert.equal(
      dependencies.status,
      "dependencies-resolved",
      JSON.stringify(dependencies.problems),
    );
    const child = dependencies.dependencies[0];
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ serviceWorkers: "block" });
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== "http://127.0.0.1:43211") return route.abort();
        if (url.pathname === "/")
          return route.fulfill({
            contentType: "text/html",
            body: "<!doctype html><main></main>",
          });
        const bytes = input.artifact.files.get(url.pathname.slice(1));
        return bytes
          ? route.fulfill({ body: bytes, contentType: "text/javascript" })
          : route.abort();
      });
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:43211");
      const result = await page.evaluate(
        async ({ parentTag, module, childTag }) => {
          const loaded = await import("/" + module.path);
          customElements.define(parentTag, loaded[module.exportName]);
          const childConstructor = customElements.get(childTag);
          if (!childConstructor) throw Error("nested-constructor-unregistered");
          const rows = [];
          for (const state of [
            {},
            { isChecked: true },
            { isChecked: true, isIndeterminate: true },
            { isDisabled: true },
          ]) {
            const parent = document.createElement(parentTag) as HTMLElement & {
              updateComplete: Promise<unknown>;
              fieldNote: string;
            };
            Object.assign(parent, state, { fieldNote: "Dependency content" });
            parent.textContent = "Checkbox";
            document.querySelector("main")!.append(parent);
            await parent.updateComplete;
            const children = parent.shadowRoot!.querySelectorAll(childTag);
            if (children.length !== 1)
              throw Error("nested-instance-not-unique");
            const nested = children[0] as HTMLElement & {
              updateComplete: Promise<unknown>;
              isDisabled?: boolean;
            };
            await nested.updateComplete;
            const identity =
              Object.getPrototypeOf(nested) === childConstructor.prototype &&
              nested.constructor === childConstructor;
            const before = nested;
            parent.fieldNote = "Updated dependency content";
            await parent.updateComplete;
            await nested.updateComplete;
            const slot = nested.shadowRoot!.querySelector("slot")!;
            rows.push({
              state,
              identity,
              retained: parent.shadowRoot!.querySelector(childTag) === before,
              content: slot
                .assignedNodes()
                .map((n) => n.textContent)
                .join("")
                .trim(),
              disabled: nested.isDisabled === true,
            });
            parent.remove();
          }
          return rows;
        },
        {
          parentTag: input.artifact.registrationTag,
          module: input.artifact.manifest.interface.module,
          childTag: child.runtime.registrationTag,
        },
      );
      assert.equal(result.length, 4);
      for (const row of result) {
        assert.equal(row.identity, true);
        assert.equal(row.retained, true);
        assert.equal(row.content, "Updated dependency content");
        assert.equal(row.disabled, "isDisabled" in row.state);
      }
    } finally {
      await browser.close();
    }
  },
);
