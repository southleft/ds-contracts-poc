import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

import { auditButtonAccounting } from "./accounting.js";
import {
  adaptReviewedButton,
  auditReviewedButtonAcquisition,
  type ReviewedButtonAdapterConfig,
} from "./adapters/button.js";
import { canonicalButtonRecipeInstance } from "./fixtures/button.js";
import {
  altitudeButtonAdapterConfig,
  fluentButtonAdapterConfig,
} from "./fixtures/library-buttons.js";
import { hashRecipeEnvelope } from "./hash.js";
import { emitButtonOutputs } from "./output/button.js";
import {
  assertCompleteRequiredFactMapping,
  measureButtonRequiredFacts,
} from "./required-facts.js";
import { compileButtonRecipe } from "./recipes/button.js";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8"));

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const nodeRequire = createRequire(import.meta.url);

test("two unrelated library contracts use one reviewed adapter and recipe", () => {
  const altitude = adaptReviewedButton(
    readJson("examples/altitude/contracts/button.contract.json"),
    altitudeButtonAdapterConfig,
  );
  const fluent = adaptReviewedButton(
    readJson("examples/fluent/contracts/button.contract.json"),
    fluentButtonAdapterConfig,
  );
  const altitudeEnvelope = compileButtonRecipe(altitude);
  const fluentEnvelope = compileButtonRecipe(fluent);
  const altitudeAccounting = auditButtonAccounting(altitude, altitudeEnvelope);
  const fluentAccounting = auditButtonAccounting(fluent, fluentEnvelope);

  assert.equal(altitude.provenance.selection.mechanism, "reviewed-config");
  assert.equal(fluent.provenance.selection.mechanism, "reviewed-config");
  assert.ok(altitude.provenance.selection.manualCost.value > 0);
  assert.ok(fluent.provenance.selection.manualCost.value > 0);
  assert.equal(
    altitudeAccounting.factsCompared + fluentAccounting.factsCompared,
    42,
  );
  assert.deepEqual(altitudeAccounting.failures, []);
  assert.deepEqual(fluentAccounting.failures, []);
  assert.notEqual(
    hashRecipeEnvelope(altitudeEnvelope),
    hashRecipeEnvelope(fluentEnvelope),
  );

  const compiler = readFileSync(
    "recipe/recipes/button.ts",
    "utf8",
  ).toLowerCase();
  const adapter = readFileSync(
    "recipe/adapters/button.ts",
    "utf8",
  ).toLowerCase();
  const emitter = readFileSync("recipe/output/button.ts", "utf8").toLowerCase();
  for (const libraryName of [
    "altitude",
    "fluent",
    "altitude-web-components",
    "@fluentui/react-components",
    "al-button",
    "fluent.button",
    "altitude.button",
  ]) {
    assert.equal(
      compiler.includes(libraryName),
      false,
      `${libraryName} must not appear in recipe compiler logic`,
    );
    assert.equal(
      adapter.includes(libraryName),
      false,
      `${libraryName} must not appear in generic adapter logic`,
    );
    assert.equal(
      emitter.includes(libraryName),
      false,
      `${libraryName} must not appear in generic emitter logic`,
    );
  }

  const counterexample = structuredClone(
    altitudeButtonAdapterConfig,
  ) as ReviewedButtonAdapterConfig;
  counterexample.parameters.appearance.primary.default.background = {
    kind: "literal",
    value: "#123456ff",
    receipt: {
      evidence: "synthetic reviewed counterexample",
      method: "proves parameters, not source identities, control output",
    },
  };
  counterexample.sourceFacts = counterexample.sourceFacts.filter(
    (fact) => fact.landing !== "tokens.appearance.primary.default.background",
  );
  const synthetic = adaptReviewedButton(
    readJson("examples/altitude/contracts/button.contract.json"),
    counterexample,
  );
  assert.equal(
    synthetic.tokens.appearance.primary.default.background.kind,
    "literal",
  );
  assert.equal(
    synthetic.tokens.appearance.primary.default.background.value,
    "#123456ff",
  );
});

test("by-field acquisition accounting catches geometry, type, fill, and state defects", () => {
  const source = readJson("examples/altitude/contracts/button.contract.json");
  const instance = adaptReviewedButton(source, altitudeButtonAdapterConfig);
  const clean = auditReviewedButtonAcquisition(
    source,
    altitudeButtonAdapterConfig,
    instance,
  );
  assert.ok(clean.factsSelected > 0);
  assert.deepEqual(clean.failures, []);

  for (const category of ["geometry", "typography", "fill", "state"] as const) {
    const planted = structuredClone(
      altitudeButtonAdapterConfig,
    ) as ReviewedButtonAdapterConfig;
    const index = planted.sourceFacts.findIndex(
      (fact) => fact.category === category,
    );
    assert.notEqual(index, -1);
    const facts = [...planted.sourceFacts];
    facts[index] = {
      ...facts[index]!,
      landing: `tokens.omitted.${category}`,
    };
    planted.sourceFacts = facts;
    assert.match(
      auditReviewedButtonAcquisition(source, planted, instance).failures.join(
        "\n",
      ),
      new RegExp(`parameter landing tokens\\.omitted\\.${category} is absent`),
    );
  }
});

test("independent accounting has non-zero denominators and catches planted reds", () => {
  const envelope = compileButtonRecipe(canonicalButtonRecipeInstance);
  const clean = auditButtonAccounting(canonicalButtonRecipeInstance, envelope);
  assert.equal(clean.factsCompared, 8);
  assert.equal(clean.measuredLandings, 8);
  assert.ok(clean.carried > 0);
  assert.ok(clean.extensions > 0);
  assert.ok(clean.receipts > 0);
  assert.deepEqual(clean.failures, []);

  const omitted = structuredClone(envelope);
  assert.equal(omitted.ir.kind, "component-set");
  omitted.ir.children[0]!.children = omitted.ir.children[0]!.children.filter(
    (child) => child.role !== "button/label",
  );
  assert.match(
    auditButtonAccounting(canonicalButtonRecipeInstance, omitted).failures.join(
      "\n",
    ),
    /root#label: claimed CARRIED has no measured landing/,
  );

  const mislabeled = structuredClone(envelope);
  const activation = mislabeled.extensions.find(
    (extension) => extension.id === "button/activation",
  )!;
  activation.id = "button/activation-mislabeled";
  assert.match(
    auditButtonAccounting(
      canonicalButtonRecipeInstance,
      mislabeled,
    ).failures.join("\n"),
    /root#activation-behavior: claimed EXTENSION has no measured landing/,
  );
});

test("button required facts evolve the existing registry seed", () => {
  const envelope = compileButtonRecipe(canonicalButtonRecipeInstance);
  assert.equal(envelope.ir.kind, "component-set");
  const measured = measureButtonRequiredFacts(envelope.ir);
  assert.equal(measured.length, 5);
  assert.equal(
    measured.every((fact) => fact.status === "measured"),
    true,
  );

  const planted = structuredClone(envelope.ir);
  planted.children[0]!.layout.mode = "vertical";
  const red = measureButtonRequiredFacts(planted);
  assert.equal(
    red.find((fact) => fact.requiredFactId === "button/row-layout")?.status,
    "missing",
  );
});

test("required-fact adapters refuse a newly seeded fact without a mapping", () => {
  assert.throws(
    () =>
      assertCompleteRequiredFactMapping(
        "button@1",
        new Set(["button/row-layout", "button/new-upstream-fact"]),
        [{ id: "button/row-layout" }],
      ),
    /unmapped=button\/new-upstream-fact/,
  );
});

test("React and Web Component outputs are deterministic, semantic and interactive", () => {
  const envelope = compileButtonRecipe(canonicalButtonRecipeInstance);
  const selection = canonicalButtonRecipeInstance.provenance.selection;
  const first = emitButtonOutputs(envelope, selection);
  const second = emitButtonOutputs(envelope, selection);
  assert.deepEqual(first, second);

  const files = [...first.react, ...first.webComponent];
  const bytes = files.reduce(
    (total, file) => total + Buffer.byteLength(file.contents),
    0,
  );
  assert.equal(files.length, 6);
  assert.ok(bytes > 0);
  assert.equal(new Set(files.map((file) => sha256(file.contents))).size, 5);

  const reactSource = first.react.find((file) =>
    file.path.endsWith("Button.tsx"),
  )!.contents;
  const transpiled = ts.transpileModule(reactSource, {
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
    if (id === "react/jsx-runtime")
      return nodeRequire("react/jsx-runtime") as unknown;
    throw new Error(`unexpected generated React import ${id}`);
  };
  Function(
    "require",
    "module",
    "exports",
    transpiled,
  )(requireModule, reactModule, reactModule.exports);
  const Button = reactModule.exports.Button as React.ElementType;
  const html = renderToStaticMarkup(
    React.createElement(Button, {
      variant: "secondary",
      size: "small",
      loading: true,
      label: "Saving",
    }),
  );
  assert.match(html, /^<button/);
  assert.match(html, /type="button"/);
  assert.match(html, /data-variant="secondary"/);
  assert.match(html, /data-size="small"/);
  assert.match(html, /data-state="loading"/);
  assert.match(html, /aria-disabled="true"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, />Saving</);

  const forwardRef = Button as unknown as {
    render: (
      props: Record<string, unknown>,
      ref: unknown,
    ) => React.ReactElement<{
      onClick: (event: { preventDefault: () => void }) => void;
    }>;
  };
  let pressed = 0;
  const enabled = forwardRef.render({ onPress: () => pressed++ }, null);
  enabled.props.onClick({ preventDefault() {} });
  assert.equal(pressed, 1);
  let prevented = 0;
  const disabled = forwardRef.render(
    { disabled: true, onPress: () => pressed++ },
    null,
  );
  disabled.props.onClick({ preventDefault: () => prevented++ });
  assert.equal(prevented, 1);
  assert.equal(pressed, 1);

  const css = first.react.find((file) => file.path.endsWith(".css"))!.contents;
  const references = [...css.matchAll(/var\((--[^)]+)\)/g)].map(
    (match) => match[1],
  );
  const definitions = new Set(
    [...css.matchAll(/^\s*(--[^:]+):/gm)].map((match) => match[1]),
  );
  assert.ok(references.length > 0);
  assert.equal(
    references.every((reference) => definitions.has(reference)),
    true,
  );

  const wcSource = first.webComponent.find((file) =>
    file.path.endsWith("recipe-button.js"),
  )!.contents;
  const registry = new Map<string, unknown>();
  class MockShadowRoot {
    innerHTML = "";
    listeners = new Map<string, (event: Record<string, unknown>) => void>();
    label = { textContent: "" };
    button = {
      addEventListener: (
        type: string,
        listener: (event: Record<string, unknown>) => void,
      ) => this.listeners.set(type, listener),
    };
    querySelector(selector: string) {
      return selector === ".recipe-button__label" ? this.label : this.button;
    }
  }
  class MockElement {
    attributes = new Map<string, string>();
    shadowRoot: MockShadowRoot | null = null;
    dispatched: unknown[] = [];
    attachShadow() {
      this.shadowRoot = new MockShadowRoot();
      return this.shadowRoot;
    }
    getAttribute(name: string) {
      return this.attributes.get(name) ?? null;
    }
    hasAttribute(name: string) {
      return this.attributes.has(name);
    }
    querySelector() {
      return null;
    }
    dispatchEvent(event: unknown) {
      this.dispatched.push(event);
      return true;
    }
  }
  class MockCustomEvent {
    constructor(
      readonly type: string,
      readonly options: Record<string, unknown>,
    ) {}
  }
  const context = vm.createContext({
    HTMLElement: MockElement,
    CustomEvent: MockCustomEvent,
    customElements: {
      get: (name: string) => registry.get(name),
      define: (name: string, value: unknown) => registry.set(name, value),
    },
  });
  vm.runInContext(wcSource.replaceAll("export ", ""), context);
  const RecipeButton = registry.get("recipe-button") as new () => MockElement;
  const wc = new RecipeButton();
  assert.match(wc.shadowRoot!.innerHTML, /<button part="button"/);
  assert.match(wc.shadowRoot!.innerHTML, /type="button"/);
  wc.shadowRoot!.listeners.get("click")!({
    preventDefault() {},
    stopImmediatePropagation() {},
  });
  assert.equal(wc.dispatched.length, 1);
});
