import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { chromium, type Browser } from "playwright-core";
import type { CemDeclarationFacts } from "../extract/adapters/cem.js";
import {
  readLitTemplateBindings,
  type LitNode,
} from "../extract/adapters/lit-template.js";
import {
  probeBindingDifferential,
  checkDependency,
  type BindingDifferentialInput,
  type BindingIntervention,
} from "./binding-differential.js";
import type { SourceProfile } from "./check.js";
import { watchSourceFailures } from "./observe.js";
import { captureReference } from "./replay.js";
import {
  assessSemantics,
  captureStableSemantics,
  semanticHash,
} from "./semantics.js";

const sha = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const strings = [
  { kind: "value" as const, value: "First independent string" },
  { kind: "value" as const, value: "Second distinct string" },
];
const booleans = [
  { kind: "undefined" as const },
  { kind: "value" as const, value: false },
  { kind: "value" as const, value: true },
];
const declaration: CemDeclarationFacts = {
  modulePath: "source-button.ts",
  className: "SourceButton",
  tagName: "source-button",
  attributes: [],
  properties: [
    { name: "label", typeText: "string" },
    { name: "isDisabled", typeText: "boolean" },
  ],
  slots: [{ name: "" }],
  events: [],
  cssParts: [],
  cssProperties: [],
};

/** Synthetic source-browser mechanics fixture, NOT generated target code or
 * authentication of the Lit implementation. Actual Altitude qualification must
 * use its recorded HAR; the separate syntax fixture tests exact span checks. */
async function fixture(
  options: {
    multiple?: boolean;
    splitText?: boolean;
    visibleLabel?: boolean;
  } = {},
) {
  const font = readFileSync(
    "extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2",
  );
  const sourceText =
    "import {html} from 'lit'; import {ifDefined} from 'lit/directives/if-defined.js'; export class SourceButton { render() { return html`<button aria-label=${ifDefined(this.label)} aria-disabled=${ifDefined(this.isDisabled)}><slot></slot></button>" +
    (options.multiple
      ? "<button aria-label=${ifDefined(this.label)}></button>"
      : "") +
    "`; } }";
  const source = {
    source: sourceText,
    sourceSha256: sha(sourceText),
    modulePath: declaration.modulePath,
    className: declaration.className,
  };
  const syntax = readLitTemplateBindings(source);
  const elements: Array<Extract<LitNode, { kind: "element" }>> = [];
  const walk = (nodes: LitNode[]) => {
    for (const node of nodes)
      if (node.kind === "element") {
        elements.push(node);
        walk(node.children);
      }
  };
  syntax.templates.forEach((template) => walk(template.roots));
  const button = elements.find((node) => node.tag === "button")!;
  const slot = elements.find((node) => node.tag === "slot")!;
  const runtime = `customElements.define('source-button', class extends HTMLElement {
    constructor(){super();this._label='Same';this._isDisabled=undefined;this.attachShadow({mode:'open'}).innerHTML=${JSON.stringify('<button style="font:16px &quot;IBM Plex Sans&quot;;display:inline-flex;background:var(--accent)">' + (options.visibleLabel ? '<span id="visible-label">Same</span>' : "") + "<slot>Fallback</slot></button>" + (options.multiple ? "<button>Other native target</button>" : ""))};this.update();}
    get label(){return this._label;} set label(value){this._label=value;this.update();}
    get isDisabled(){return this._isDisabled;} set isDisabled(value){this._isDisabled=value;this.update();}
    update(){for(const button of this.shadowRoot.querySelectorAll('button')){if(this._label===undefined)button.removeAttribute('aria-label');else button.setAttribute('aria-label',String(this._label));}const button=this.shadowRoot.querySelector('button');if(this._isDisabled===undefined)button.removeAttribute('aria-disabled');else button.setAttribute('aria-disabled',String(this._isDisabled));${options.visibleLabel ? "this.shadowRoot.querySelector('#visible-label').textContent=String(this._label);" : ""}}
  });`;
  const server = createServer((request, response) => {
    if (request.url === "/font.woff2") {
      response.setHeader("Content-Type", "font/woff2");
      response.end(font);
    } else if (request.url === "/theme.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(
        '@font-face{font-family:"IBM Plex Sans";src:url(/font.woff2)}:root{--accent:#2850a0}',
      );
    } else if (request.url === "/runtime.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(runtime);
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(
        '<link rel="stylesheet" href="/theme.css"><source-button>Same' +
          (options.splitText ? "<!-- separate original node -->Other" : "") +
          '</source-button><script src="/runtime.js"></script>',
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
  const dir = mkdtempSync(path.join(tmpdir(), "binding-differential-"));
  const harPath = path.join(dir, "source.har");
  const browser = await chromium.launch();
  const profile: SourceProfile = {
    id: "differential-mechanics-source",
    provenance:
      "binding-differential.test.ts synthetic source fixture; not Altitude",
    path: ["source-button", "button"],
    fontFamily: "IBM Plex Sans",
    requiredStyles: {
      display: "inline-flex",
      "background-color": "rgb(40, 80, 160)",
    },
    requiredTokens: { "--accent": "#2850a0" },
  };
  try {
    const context = await browser.newContext({
      viewport: { width: 900, height: 600 },
      deviceScaleFactor: 1,
      colorScheme: "dark",
      serviceWorkers: "block",
      recordHar: { path: harPath, content: "embed", mode: "full" },
    });
    const page = await context.newPage();
    const failures = watchSourceFailures(page);
    await page.goto(url);
    const reference = await captureReference(page, profile, failures, 0);
    assert.equal(reference.status, "valid", JSON.stringify(reference.problems));
    const observed = await captureStableSemantics(
      page,
      ["source-button"],
      declaration,
      reference.secondSha256,
      0,
    );
    const semantics = assessSemantics(declaration, observed, {
      valid: true,
      sourcePngSha256: reference.secondSha256,
    });
    assert.equal(
      semantics.status,
      "observed",
      JSON.stringify(semantics.problems),
    );
    failures.dispose();
    await context.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    const base = {
      replay: { harPath, harSha256: sha(readFileSync(harPath)), url, profile },
      source,
      semantics,
      quietMs: 0,
    };
    const label: BindingIntervention = {
      kind: "property",
      name: "label",
      values: strings,
      sourceNodeId: button.id,
      sourceSpan: button.span,
      target: { path: "0", tag: "button", attribute: "aria-label" },
    };
    const disabled: BindingIntervention = {
      ...label,
      name: "isDisabled",
      values: booleans,
      target: { path: "0", tag: "button", attribute: "aria-disabled" },
    };
    const content: BindingIntervention = {
      kind: "slot-text",
      name: "",
      path: options.visibleLabel ? "0/1" : "0/0",
      assignedDomPath: "host/0",
      values: strings,
      sourceNodeId: slot.id,
      sourceSpan: slot.span,
    };
    return {
      browser,
      base,
      label,
      disabled,
      content,
      close: async () => {
        await browser.close();
        rmSync(dir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    server.close();
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

test("distinct source-property and slot interventions disambiguate identical starting text; undefined/false/true keep native disabled separate", async () => {
  const f = await fixture();
  try {
    const baseline = JSON.stringify(f.base);
    const images: Array<{ index: number; before: string; after: string }> = [];
    const label = await probeBindingDifferential(
      f.browser,
      {
        ...f.base,
        intervention: f.label,
      },
      {
        onImages(index, before, after) {
          images.push({ index, before: sha(before), after: sha(after) });
        },
      },
    );
    assert.equal(
      label.status,
      "dependency-observed",
      JSON.stringify(label.problems),
    );
    assert.equal(label.observed, 2);
    const corruptedAfter = structuredClone(label.cases[0].after!);
    corruptedAfter.nativeElements[0].attributes["aria-label"] =
      "Changed after the report was written";
    assert.ok(
      checkDependency(
        f.label,
        label.cases[0].value,
        label.cases[0].before!,
        corruptedAfter,
        label.cases[0].beforePngSha256!,
        label.cases[0].afterPngSha256!,
      ).includes("differential-dependency-not-observed"),
      "reader can rederive a dependency refusal even if stored status/digests were replaced",
    );
    assert.deepEqual(
      images,
      label.cases.map((row, index) => ({
        index,
        before: row.beforePngSha256,
        after: row.afterPngSha256,
      })),
    );
    for (const [index, row] of label.cases.entries()) {
      assert.equal(
        row.before!.nativeElements[0].attributes["aria-label"],
        "Same",
      );
      assert.equal(
        row.after!.nativeElements[0].attributes["aria-label"],
        strings[index].value,
      );
      assert.deepEqual(row.after!.slots, row.before!.slots);
      assert.equal(row.afterPngSha256, row.beforePngSha256);
    }
    const content = await probeBindingDifferential(f.browser, {
      ...f.base,
      intervention: f.content,
    });
    assert.equal(
      content.status,
      "dependency-observed",
      JSON.stringify(content.problems),
    );
    assert.equal(content.observed, 2);
    for (const [index, row] of content.cases.entries()) {
      assert.equal(
        row.after!.nativeElements[0].attributes["aria-label"],
        "Same",
      );
      assert.deepEqual(row.after!.slots[0].assigned, [
        { kind: "text", text: strings[index].value },
      ]);
      assert.notEqual(row.afterPngSha256, row.beforePngSha256);
      assert.deepEqual(
        row.before!.slots[0].assigned,
        [{ kind: "text", text: "Same" }],
        "every case starts in a fresh original replay",
      );
    }
    const disabled = await probeBindingDifferential(f.browser, {
      ...f.base,
      intervention: f.disabled,
    });
    assert.equal(
      disabled.status,
      "dependency-observed",
      JSON.stringify(disabled.problems),
    );
    assert.equal(disabled.denominator, 3);
    assert.deepEqual(
      disabled.cases.map(
        (row) => row.after!.nativeElements[0].attributes["aria-disabled"],
      ),
      [undefined, "false", "true"],
    );
    assert.deepEqual(
      disabled.cases.map((row) => row.after!.properties.isDisabled),
      booleans,
    );
    assert.ok(
      disabled.cases.every(
        (row) =>
          sameNativeDisabled(row.after!) && sameNativeDisabled(row.before!),
      ),
    );
    assert.equal(disabled.acceptedContract, null);
    assert.equal(
      disabled.digest,
      semanticHash({ ...disabled, digest: undefined }),
    );
    assert.equal(
      JSON.stringify(f.base),
      baseline,
      "never rewrite original answer key",
    );
    assert.equal(
      sha(readFileSync(f.base.replay.harPath)),
      f.base.replay.harSha256,
      "HAR remains byte-identical",
    );
  } finally {
    await f.close();
  }
});
function sameNativeDisabled(
  observation: BindingDifferentialInput["semantics"]["observation"],
) {
  return (
    JSON.stringify(observation.nativeElements[0].properties.disabled) ===
    JSON.stringify({ kind: "value", value: false })
  );
}

test("multiple causal native targets, multiple assigned text nodes and property-driven visible text refuse a simple dependency claim", async () => {
  for (const options of [
    { multiple: true },
    { splitText: true },
    { visibleLabel: true },
  ]) {
    const f = await fixture(options);
    try {
      const intervention = options.splitText ? f.content : f.label;
      const result = await probeBindingDifferential(f.browser, {
        ...f.base,
        intervention,
      });
      assert.equal(result.status, "refused");
      assert.equal(result.denominator, 2);
      assert.equal(result.cases.length, 2);
      assert.equal(result.observed, 0);
      assert.ok(
        result.problems.includes(
          options.splitText
            ? "differential-assigned-text-not-unique"
            : options.visibleLabel
              ? "differential-label-changed-visible-source"
              : "differential-unexpected-semantic-change",
        ),
        JSON.stringify(result.problems),
      );
    } finally {
      await f.close();
    }
  }
});

test("unsupported or tampered source targets fail before context creation; a broken or swapped HAR never drops the denominator", async () => {
  const f = await fixture();
  try {
    for (const mutate of [
      (input: BindingDifferentialInput) => {
        input.replay.url = "file:///not-an-owned-replay";
      },
      (input: BindingDifferentialInput) => {
        input.source.source += " ";
      },
      (input: BindingDifferentialInput) => {
        input.intervention.sourceSpan.start++;
      },
      (input: BindingDifferentialInput) => {
        input.semantics.observation.hostTag = "forged";
      },
      (input: BindingDifferentialInput) => {
        input.intervention.values = [strings[0], strings[0]];
      },
      (input: BindingDifferentialInput) => {
        if (input.intervention.kind === "property")
          input.intervention.name = "unknown";
      },
    ]) {
      const input = structuredClone({ ...f.base, intervention: f.label });
      mutate(input);
      const result = await probeBindingDifferential({} as Browser, input);
      assert.equal(result.status, "refused");
      assert.equal(result.denominator, 2);
      assert.equal(result.observed, 0);
      assert.ok(
        !result.problems.includes("differential-observation-failed"),
        JSON.stringify(result.problems),
      );
    }
    const wrongHar = await probeBindingDifferential(f.browser, {
      ...f.base,
      replay: { ...f.base.replay, harSha256: "a".repeat(64) },
      intervention: f.disabled,
    });
    assert.equal(wrongHar.observed, 0);
    assert.equal(wrongHar.cases.length, 3);
    assert.ok(
      wrongHar.cases.every((row) =>
        row.problems.includes("differential-har-identity-mismatch"),
      ),
    );
    const artifactFailure = await probeBindingDifferential(
      f.browser,
      { ...f.base, intervention: f.label },
      {
        onImages() {
          throw new Error(
            "A private artifact path must never leak from this exception",
          );
        },
      },
    );
    assert.equal(artifactFailure.status, "refused");
    assert.equal(artifactFailure.observed, 0);
    assert.equal(artifactFailure.denominator, 2);
    assert.deepEqual(artifactFailure.problems, [
      "differential-image-artifact-failed",
    ]);
    const archive = JSON.parse(readFileSync(f.base.replay.harPath, "utf8"));
    archive.log.entries = archive.log.entries.filter(
      (entry: { request: { url: string } }) =>
        !entry.request.url.endsWith("runtime.js"),
    );
    const broken = path.join(
      path.dirname(f.base.replay.harPath),
      "missing-runtime.har",
    );
    writeFileSync(broken, JSON.stringify(archive));
    const missing = await probeBindingDifferential(f.browser, {
      ...f.base,
      replay: {
        ...f.base.replay,
        harPath: broken,
        harSha256: sha(readFileSync(broken)),
      },
      intervention: f.label,
    });
    assert.equal(missing.status, "refused");
    assert.equal(missing.cases.length, 2);
    assert.equal(missing.observed, 0);
  } finally {
    await f.close();
  }
});
