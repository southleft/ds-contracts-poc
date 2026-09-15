import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright-core";
import { ContractSchema, type Contract } from "../scripts/contract-schema.js";
import { emitReact } from "./emit-react.js";
import { emitReactInline } from "./emit-react-inline.js";
import { generatedTypeErrors, mountGenerated } from "./react-test-runtime.js";
import { flattenTokens, tokenInventoryFromJson } from "./tokens.js";

// The literal string "undefined" is a legal declared option, not omission.
// It deliberately differs from the source base plane in tag, role, text/paint.
function fixture(): Contract {
  return ContractSchema.parse({
    id: "probe.defaultless",
    name: "DefaultlessProbe",
    version: "1.0.0",
    description:
      "Defaultless scalar conformance, not a qualified source component.",
    archetype: "none",
    semantics: {
      element: "div",
      role: "group",
      elementByProp: {
        prop: "variant",
        map: { secondary: "span", undefined: "section" },
      },
      roleByProp: {
        prop: "variant",
        map: { secondary: "status", undefined: "alert" },
      },
    },
    props: [
      {
        name: "variant",
        type: { enum: ["secondary", "undefined"] },
        bindings: {
          figma: {
            kind: "VARIANT",
            property: "Variant",
            values: { secondary: "Secondary", undefined: "String undefined" },
          },
          code: { prop: "appearance" },
        },
      },
      {
        name: "busy",
        type: "boolean",
        bindings: {
          figma: { kind: "BOOLEAN", property: "Busy" },
          code: { prop: "isBusy" },
        },
      },
      {
        name: "amount",
        type: "number",
        bindings: {
          figma: { kind: "TEXT", property: "Amount" },
          code: { prop: "amount" },
        },
      },
    ],
    states: [],
    anatomy: {
      root: {
        tokens: { "background-color": "{paint.base}" },
        tokensByProp: [
          {
            prop: "variant",
            map: {
              secondary: { "background-color": "{paint.secondary}" },
              undefined: { "background-color": "{paint.literal}" },
            },
          },
        ],
        attrs: {
          "data-variant-value": "{variant}",
          "data-busy-value": "{busy}",
          "data-amount": "{amount}",
        },
        parts: {
          label: {
            element: "span",
            text: "Source base",
            textByProp: {
              prop: "variant",
              map: { secondary: "Secondary", undefined: "Literal undefined" },
            },
          },
        },
      },
    },
    bindings: {
      figma: { anchors: { fileKey: null, componentSetKey: null } },
      code: {
        anchors: {
          importPath: "./DefaultlessProbe",
          export: "DefaultlessProbe",
        },
      },
    },
  });
}
const tokens = {
  primitives: {
    paint: {
      base: { $type: "color", $value: "#4375ff" },
      secondary: { $type: "color", $value: "#00aa00" },
      literal: { $type: "color", $value: "#ff0000" },
    },
  },
  semantic: {},
  light: {},
  dark: {},
  brands: { default: {} },
};
function emit(
  contract: Contract,
  inline: boolean,
  tokenTree = tokens,
  icons = new Map<string, string>(),
) {
  const ctx = { contracts: new Map([[contract.id, contract]]), icons };
  if (inline)
    return {
      ...emitReactInline(contract, { ...ctx, tokens: tokenTree }),
      css: "",
    };
  const output = emitReact(contract, {
    ...ctx,
    tokens: tokenInventoryFromJson([tokenTree.primitives]),
  });
  const declarations = [...flattenTokens(tokenTree.primitives)].map(
    ([key, token]) => `--${key.replaceAll(".", "-")}: ${token.value};`,
  );
  return {
    ...output,
    css: `:root {${declarations.join("\n")}}\n${output.css}`,
  };
}
test("defaultless scalar absence survives generated React instead of becoming false, zero or the string undefined", async (t) => {
  const browser = await chromium.launch();
  try {
    for (const inline of [false, true])
      await t.test(inline ? "inline" : "css-module", async () => {
        const contract = fixture();
        const output = emit(contract, inline);
        const page = await browser.newPage();
        try {
          const render = await mountGenerated(
            page,
            contract.name,
            output.tsx,
            output.css,
          );
          const observe = () =>
            page
              .locator("#root > :first-child")
              .evaluate((el) => ({
                tag: el.localName,
                role: el.getAttribute("role"),
                text: el.textContent,
                paint: getComputedStyle(el).backgroundColor,
                variant: el.getAttribute("data-variant-value"),
                busy: el.getAttribute("data-busy-value"),
                amount: el.getAttribute("data-amount"),
              }));
          assert.deepEqual(await observe(), {
            tag: "div",
            role: "group",
            text: "Source base",
            paint: "rgb(67, 117, 255)",
            variant: null,
            busy: null,
            amount: null,
          });
          await render({ appearance: "undefined", isBusy: false, amount: 0 });
          assert.deepEqual(await observe(), {
            tag: "section",
            role: "alert",
            text: "Literal undefined",
            paint: "rgb(255, 0, 0)",
            variant: "undefined",
            busy: "false",
            amount: "0",
          });
          await render({ appearance: "secondary", isBusy: true, amount: 2 });
          assert.deepEqual(await observe(), {
            tag: "span",
            role: "status",
            text: "Secondary",
            paint: "rgb(0, 170, 0)",
            variant: "secondary",
            busy: "true",
            amount: "2",
          });
          await render({});
          assert.equal(
            (await observe()).paint,
            "rgb(67, 117, 255)",
            "resetting props restores the actual absent plane",
          );
          assert.deepEqual(
            generatedTypeErrors(contract.name, output.tsx),
            [],
            "generated code must typecheck, not merely transpile",
          );
        } finally {
          await page.close();
        }
      });
  } finally {
    await browser.close();
  }
});

test("explicit scalar defaults remain explicit and do not change when callers omit values", async () => {
  const contract = fixture();
  [
    contract.props[0].default,
    contract.props[1].default,
    contract.props[2].default,
  ] = ["secondary", true, 7];
  for (const inline of [false, true]) {
    const output = emit(contract, inline);
    assert.match(output.tsx, /appearance = 'secondary'/);
    assert.match(output.tsx, /isBusy = true/);
    assert.match(output.tsx, /amount = 7/);
    assert.deepEqual(generatedTypeErrors(contract.name, output.tsx), []);
  }
});

test("defaultless story args do not silently override absence", () => {
  const output = emit(fixture(), false);
  assert.ok("stories" in output);
  const args = output.stories.match(/  args: \{([\s\S]*?)\n  \},/)?.[1];
  assert.notEqual(args, undefined);
  assert.doesNotMatch(args!, /appearance:|isBusy:|amount:/);
});

test("omitted icon enum renders no glyph, independently of a declared icon named undefined", async (t) => {
  const contract = fixture();
  contract.anatomy.root.parts!.glyph = { icon: { asset: "{variant}" } };
  const icons = new Map(
    ["secondary", "undefined"].map((name) => [
      name,
      '<svg viewBox="0 0 10 10"><path d="M1 1h8v8H1z"/></svg>',
    ]),
  );
  const browser = await chromium.launch();
  try {
    for (const inline of [false, true])
      await t.test(inline ? "inline" : "css-module", async () => {
        const output = emit(contract, inline, tokens, icons);
        assert.deepEqual(generatedTypeErrors(contract.name, output.tsx), []);
        const page = await browser.newPage();
        try {
          const render = await mountGenerated(
            page,
            contract.name,
            output.tsx,
            output.css,
          );
          assert.equal(await page.locator("svg").count(), 0);
          await render({ appearance: "undefined" });
          assert.equal(await page.locator("svg").count(), 1);
          await render({});
          assert.equal(await page.locator("svg").count(), 0);
        } finally {
          await page.close();
        }
      });
  } finally {
    await browser.close();
  }
});

test("defaultless uncontrolled toggles start absent and remain interactive", async (t) => {
  const contract = fixture();
  contract.events = [
    {
      name: "activate",
      trigger: "root",
      toggles: { prop: "variant", between: ["secondary", "undefined"] },
      bindings: { code: { prop: "onActivate" } },
    },
  ];
  const browser = await chromium.launch();
  try {
    for (const inline of [false, true])
      await t.test(inline ? "inline" : "css-module", async () => {
        const output = emit(contract, inline);
        assert.deepEqual(generatedTypeErrors(contract.name, output.tsx), []);
        const page = await browser.newPage();
        try {
          const render = await mountGenerated(
            page,
            contract.name,
            output.tsx,
            output.css,
          );
          const root = page.locator("#root > :first-child");
          assert.equal(await root.textContent(), "Source base");
          await root.click();
          assert.equal(await root.textContent(), "Literal undefined");
          await root.click();
          assert.equal(await root.textContent(), "Secondary");
          await render({ appearance: "undefined" });
          await root.click();
          assert.equal(
            await root.textContent(),
            "Literal undefined",
            "a supplied value remains controlled",
          );
        } finally {
          await page.close();
        }
      });
  } finally {
    await browser.close();
  }
});

test("compound variant lookup requires both optional axes, not stringified omission", async (t) => {
  const contract = fixture();
  contract.props.push({
    name: "tone",
    type: { enum: ["soft", "undefined"] },
    bindings: {
      figma: { kind: "VARIANT", property: "Tone" },
      code: { prop: "tone" },
    },
  });
  contract.anatomy.root.tokens!.color = "{compound.{variant}.{tone}}";
  // No hardcoded component styling: this is the actual fixture token input.
  const tokenTree = {
    ...tokens,
    primitives: {
      ...tokens.primitives,
      compound: Object.fromEntries(
        ["secondary", "undefined"].map((variant) => [
          variant,
          Object.fromEntries(
            ["soft", "undefined"].map((tone) => [
              tone,
              { $type: "color", $value: "#ff0000" },
            ]),
          ),
        ]),
      ),
    },
  };
  const browser = await chromium.launch();
  try {
    for (const inline of [false, true])
      await t.test(inline ? "inline" : "css-module", async () => {
        const output = emit(contract, inline, tokenTree);
        assert.deepEqual(generatedTypeErrors(contract.name, output.tsx), []);
        const page = await browser.newPage();
        try {
          const render = await mountGenerated(
            page,
            contract.name,
            output.tsx,
            output.css,
          );
          const ink = () =>
            page
              .locator("#root > :first-child")
              .evaluate((el) => getComputedStyle(el).color);
          for (const props of [
            {},
            { appearance: "undefined" },
            { tone: "undefined" },
          ]) {
            await render(props);
            assert.equal(
              await ink(),
              "rgb(0, 0, 0)",
              "omission must not select the literal undefined compound",
            );
          }
          await render({ appearance: "undefined", tone: "undefined" });
          assert.equal(await ink(), "rgb(255, 0, 0)");
          await render({});
          assert.equal(await ink(), "rgb(0, 0, 0)");
        } finally {
          await page.close();
        }
      });
  } finally {
    await browser.close();
  }
});
