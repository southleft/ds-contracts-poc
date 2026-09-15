import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "playwright-core";
import {
  ContractSchema,
  type Contract,
  type Part,
} from "../scripts/contract-schema.js";
import { emitReact } from "./emit-react.js";
import { emitReactInline } from "./emit-react-inline.js";
import { reactPartAttrList } from "./react-attributes.js";

const bool = (name: string) => ({
  name,
  type: "boolean",
  bindings: {
    figma: { kind: "BOOLEAN", property: name },
    code: { prop: name },
  },
});
function fixture(nested: boolean): Contract {
  const control: Part = {
    element: "input",
    attrs: {
      type: "checkbox",
      disabled: "{isDisabled}",
      checked: "{isChecked}",
      required: "{isRequired}",
      "aria-disabled": "{isDisabled}",
      "aria-checked": "{isChecked}",
      tabIndex: "{tabOrder}",
    },
  };
  return ContractSchema.parse({
    id: nested ? "probe.nested" : "probe.root",
    name: nested ? "NestedProbe" : "RootProbe",
    version: "1.0.0",
    status: "draft",
    description: "Native attribute conformance fixture.",
    archetype: "none",
    semantics: { element: nested ? "div" : "input" },
    props: [
      ...["isDisabled", "isChecked", "isRequired"].map(bool),
      {
        name: "tabOrder",
        type: "number",
        default: 0,
        bindings: {
          figma: { kind: "TEXT", property: "Tab order" },
          code: { prop: "tabOrder" },
        },
      },
    ],
    states: [],
    anatomy: { root: nested ? { parts: { control } } : control },
    bindings: {
      figma: { anchors: { fileKey: null, componentSetKey: null } },
      code: {
        anchors: {
          importPath: "./Probe",
          export: nested ? "NestedProbe" : "RootProbe",
        },
      },
    },
  });
}
const emit = (contract: Contract, inline: boolean) => {
  const ctx = {
    contracts: new Map([[contract.id, contract]]),
    icons: new Map<string, string>(),
    tokens: {
      primitives: {},
      semantic: {},
      light: {},
      dark: {},
      brands: { default: {} },
    },
  };
  return inline
    ? emitReactInline(contract, ctx).tsx
    : emitReact(contract, { ...ctx, tokens: new Set<string>() }).tsx;
};

async function mount(browser: Browser, contract: Contract, inline: boolean) {
  const generated = emit(contract, inline);
  const bundle = await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {${contract.name}} from 'generated-probe';
      const root=createRoot(document.getElementById('root'));
      window.renderProbe=(props)=>root.render(React.createElement(${contract.name}, props));`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    plugins: [
      {
        name: "generated-probe",
        setup(builder) {
          builder.onResolve({ filter: /^generated-probe$/ }, () => ({
            path: "Probe.tsx",
            namespace: "probe",
          }));
          builder.onLoad({ filter: /.*/, namespace: "probe" }, () => ({
            contents: generated,
            loader: "tsx",
            resolveDir: process.cwd(),
          }));
          // This is a native-state test, not a visual proof. Generated style
          // tokens have no bearing on input.checked/disabled/required.
          builder.onResolve({ filter: /\.module\.css$/ }, () => ({
            path: "styles",
            namespace: "probe-css",
          }));
          builder.onLoad({ filter: /.*/, namespace: "probe-css" }, () => ({
            contents: "export default {};",
            loader: "js",
          }));
        },
      },
    ],
  });
  const page = await browser.newPage();
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  return page;
}
async function render(page: Page, props: Record<string, unknown>) {
  await page.evaluate(
    (props) =>
      (
        window as unknown as {
          renderProbe(props: Record<string, unknown>): void;
        }
      ).renderProbe(props),
    props,
  );
  await page.waitForSelector("#root input", { timeout: 3000 });
}
const inspect = (page: Page) =>
  page.locator("#root input").evaluate((input) => {
    const node = input as HTMLInputElement;
    return {
      disabled: node.disabled,
      checked: node.checked,
      required: node.required,
      ariaDisabled: node.getAttribute("aria-disabled"),
      ariaChecked: node.getAttribute("aria-checked"),
      tabIndex: node.tabIndex,
    };
  });

test("both existing React emitters preserve false/true native booleans at root and nested controls", async (t) => {
  const browser = await chromium.launch();
  try {
    for (const inline of [false, true])
      for (const nested of [false, true]) {
        await t.test(
          `${inline ? "inline" : "css-module"} ${nested ? "nested" : "root"}`,
          async () => {
            const contract = fixture(nested);
            const page = await mount(browser, contract, inline);
            try {
              for (const value of [false, true, false]) {
                await render(page, {
                  isDisabled: value,
                  isChecked: value,
                  isRequired: value,
                  tabOrder: value ? 3 : -1,
                });
                await page.waitForFunction(
                  (value) =>
                    document.querySelector<HTMLInputElement>("#root input")
                      ?.tabIndex === (value ? 3 : -1),
                  value,
                );
                assert.deepEqual(
                  await inspect(page),
                  {
                    disabled: value,
                    checked: value,
                    required: value,
                    ariaDisabled: String(value),
                    ariaChecked: String(value),
                    tabIndex: value ? 3 : -1,
                  },
                  `${inline ? "inline" : "css-module"} ${nested ? "nested" : "root"} value=${value}`,
                );
              }
            } finally {
              await page.close();
            }
          },
        );
      }
  } finally {
    await browser.close();
  }
});

test("literal native booleans follow raw HTML presence, including empty and false spellings", async (t) => {
  const browser = await chromium.launch();
  try {
    for (const inline of [false, true])
      for (const nested of [false, true]) {
        for (const literal of ["", "false", "true", undefined]) {
          await t.test(
            `${inline ? "inline" : "css-module"} ${nested ? "nested" : "root"} literal=${JSON.stringify(literal)}`,
            async () => {
              const contract = fixture(nested);
              const control = nested
                ? contract.anatomy.root.parts!.control
                : contract.anatomy.root;
              control.attrs = {
                type: "checkbox",
                "aria-disabled": "false",
                "aria-checked": "false",
                tabIndex: "-1",
              };
              if (literal !== undefined)
                for (const attr of ["disabled", "checked", "required"])
                  control.attrs[attr] = literal;
              const page = await mount(browser, contract, inline);
              try {
                await render(page, {});
                const raw = await page.evaluate((literal) => {
                  const input = document.createElement("input");
                  input.type = "checkbox";
                  if (literal !== undefined)
                    for (const attr of ["disabled", "checked", "required"])
                      input.setAttribute(attr, literal);
                  return {
                    disabled: input.disabled,
                    checked: input.checked,
                    required: input.required,
                  };
                }, literal);
                assert.deepEqual(await inspect(page), {
                  ...raw,
                  ariaDisabled: "false",
                  ariaChecked: "false",
                  tabIndex: -1,
                });
              } finally {
                await page.close();
              }
            },
          );
        }
      }
  } finally {
    await browser.close();
  }
});

test("omitted native boolean bindings remain absent and omit optional ARIA projection", async (t) => {
  const browser = await chromium.launch();
  try {
    for (const inline of [false, true])
      for (const nested of [false, true]) {
        await t.test(
          `${inline ? "inline" : "css-module"} ${nested ? "nested" : "root"}`,
          async () => {
            const contract = fixture(nested);
            delete contract.props.find((p) => p.name === "tabOrder")!.default;
            const page = await mount(browser, contract, inline);
            try {
              await render(page, {});
              assert.deepEqual(await inspect(page), {
                disabled: false,
                checked: false,
                required: false,
                ariaDisabled: null,
                ariaChecked: null,
                tabIndex: 0,
              });
              assert.equal(
                await page.locator("#root input").getAttribute("tabindex"),
                null,
              );
            } finally {
              await page.close();
            }
          },
        );
      }
  } finally {
    await browser.close();
  }
});

test("unknown and nonboolean native boolean bindings are refused by both emitters", () => {
  for (const inline of [false, true])
    for (const nested of [false, true]) {
      for (const attr of ["disabled", "checked", "required"]) {
        const contract = fixture(nested);
        const control = nested
          ? contract.anatomy.root.parts!.control
          : contract.anatomy.root;
        control.attrs![attr] = "{unknown}";
        assert.throws(
          () => emit(contract, inline),
          /attrs references unknown prop "unknown"/,
        );
        control.attrs![attr] = "{tabOrder}";
        assert.throws(
          () => emit(contract, inline),
          new RegExp(
            `native boolean attribute "${attr}" requires a boolean prop`,
          ),
        );
      }
    }
});

test("raw native names readonly and tabindex retain typed behavior after React projection", async (t) => {
  const browser = await chromium.launch();
  try {
    for (const inline of [false, true])
      for (const nested of [false, true]) {
        await t.test(
          `${inline ? "inline" : "css-module"} ${nested ? "nested" : "root"}`,
          async () => {
            const contract = fixture(nested);
            const control = nested
              ? contract.anatomy.root.parts!.control
              : contract.anatomy.root;
            control.attrs = {
              type: "checkbox",
              readonly: "{isDisabled}",
              tabindex: "{tabOrder}",
            };
            const page = await mount(browser, contract, inline);
            try {
              for (const value of [false, true, false]) {
                await render(page, {
                  isDisabled: value,
                  tabOrder: value ? 3 : -1,
                });
                await page.waitForFunction(
                  (value) =>
                    document.querySelector<HTMLInputElement>("#root input")
                      ?.tabIndex === (value ? 3 : -1),
                  value,
                );
                assert.deepEqual(
                  await page.locator("#root input").evaluate((input) => {
                    const node = input as HTMLInputElement;
                    return { readOnly: node.readOnly, tabIndex: node.tabIndex };
                  }),
                  { readOnly: value, tabIndex: value ? 3 : -1 },
                );
              }
            } finally {
              await page.close();
            }
          },
        );
      }
  } finally {
    await browser.close();
  }
});

test("automatic root disabled uses the declared code alias and yields to explicit root attrs", async (t) => {
  const browser = await chromium.launch();
  try {
    for (const inline of [false, true])
      for (const explicit of [undefined, "{isChecked}", ""]) {
        await t.test(
          `${inline ? "inline" : "css-module"} explicit=${JSON.stringify(explicit)}`,
          async () => {
            const contract = fixture(false);
            contract.props[0].name = "disabled";
            const attrs = contract.anatomy.root.attrs!;
            attrs["aria-disabled"] = "{disabled}";
            if (explicit === undefined) delete attrs.disabled;
            else attrs.disabled = explicit;
            const generated = emit(contract, inline);
            assert.equal(
              [...generated.matchAll(/\bdisabled=\{/g)].filter(
                (m) => generated[m.index! - 1] !== "-",
              ).length,
              1,
              "native disabled must be emitted exactly once",
            );
            const page = await mount(browser, contract, inline);
            try {
              for (const value of [false, true, false]) {
                await render(page, {
                  isDisabled: value,
                  isChecked: !value,
                  isRequired: false,
                  tabOrder: value ? 3 : -1,
                });
                await page.waitForFunction(
                  (value) =>
                    document.querySelector<HTMLInputElement>("#root input")
                      ?.tabIndex === (value ? 3 : -1),
                  value,
                );
                assert.equal(
                  await page
                    .locator("#root input")
                    .evaluate((input) => (input as HTMLInputElement).disabled),
                  explicit === undefined
                    ? value
                    : explicit === ""
                      ? true
                      : !value,
                );
              }
            } finally {
              await page.close();
            }
          },
        );
      }
  } finally {
    await browser.close();
  }
});

test("shared lowering preserves numeric expressions and optional string-valued attributes", () => {
  const contract = fixture(false);
  delete contract.props.find((p) => p.name === "tabOrder")!.default;
  const bind = (name: string) =>
    contract.props.find((p) => p.name === name)!.bindings.code.prop;
  for (const attr of ["rows", "cols", "tabIndex", "colSpan", "rowSpan"]) {
    assert.deepEqual(
      reactPartAttrList(contract, { attrs: { [attr]: "{tabOrder}" } }, bind),
      [`${attr}={tabOrder}`],
    );
    assert.deepEqual(
      reactPartAttrList(contract, { attrs: { [attr]: "2" } }, bind),
      [`${attr}={2}`],
    );
  }
  assert.deepEqual(
    reactPartAttrList(
      contract,
      {
        attrs: {
          tabIndex: "-1",
          "aria-checked": "{isChecked}",
          "data-order": "{tabOrder}",
          "aria-disabled": "false",
        },
      },
      bind,
    ),
    [
      "tabIndex={-1}",
      "aria-checked={isChecked === undefined ? undefined : String(isChecked)}",
      "data-order={tabOrder === undefined ? undefined : String(tabOrder)}",
      'aria-disabled="false"',
    ],
  );
  assert.deepEqual(
    reactPartAttrList(
      contract,
      { attrs: { readonly: "", tabindex: "-1" } },
      bind,
    ),
    ["readOnly={true}", "tabIndex={-1}"],
  );
  assert.throws(
    () =>
      reactPartAttrList(
        contract,
        { attrs: { readonly: "", readOnly: "false" } },
        bind,
      ),
    /duplicate native attribute aliases for "readOnly"/,
  );
  assert.throws(
    () =>
      reactPartAttrList(contract, { attrs: { readonly: "{tabOrder}" } }, bind),
    /native boolean attribute "readOnly" requires a boolean prop/,
  );
});
