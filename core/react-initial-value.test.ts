import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright-core";
import { ContractSchema } from "../scripts/contract-schema.js";
import { emitReact } from "./emit-react.js";
import { emitReactInline } from "./emit-react-inline.js";
import { generatedTypeErrors, mountGenerated } from "./react-test-runtime.js";

function fixture(nested = false) {
  return ContractSchema.parse({
    id: "probe.initial",
    name: "Selection",
    version: "1.0.0",
    status: "draft",
    description: "Separate controlled and initial input semantics.",
    semantics: nested
      ? { element: "div" }
      : {
          element: "button",
          role: "checkbox",
          roleException: "Declared button-backed toggle.",
        },
    props: [
      {
        name: "state",
        type: { enum: ["off", "on", "mixed", "empty"] },
        bindings: {
          code: {
            prop: "checked",
            initial: { prop: "defaultChecked", default: "off" },
            values: {
              off: false,
              on: true,
              mixed: "indeterminate",
              empty: null,
            },
          },
          figma: { kind: "VARIANT", property: "State", unsetValue: "(unset)" },
        },
      },
      {
        name: "disabled",
        type: "boolean",
        default: false,
        bindings: {
          code: { prop: "disabled" },
          figma: { kind: "BOOLEAN", property: "Disabled" },
        },
      },
    ],
    states: [],
    anatomy: {
      root: nested
        ? {
            parts: {
              control: {
                element: "button",
                roleException: "Declared button-backed toggle.",
                attrs: { role: "checkbox", disabled: "{disabled}" },
                slot: { name: "label" },
              },
            },
          }
        : { text: "Choose" },
    },
    events: [
      {
        name: "change",
        trigger: nested ? "control" : "root",
        toggles: { prop: "state", between: ["off", "on"], aria: "checked" },
        bindings: { code: { prop: "onCheckedChange", argument: "next-value" } },
      },
    ],
    bindings: {
      code: { anchors: { importPath: "./Selection", export: "Selection" } },
      figma: { anchors: { fileKey: null, componentSetKey: null } },
    },
  });
}
function emit(contract: ReturnType<typeof fixture>, inline: boolean) {
  const contracts = new Map([[contract.id, contract]]),
    icons = new Map<string, string>();
  return inline
    ? {
        ...emitReactInline(contract, {
          contracts,
          icons,
          tokens: {
            primitives: {},
            semantic: {},
            light: {},
            dark: {},
            brands: { default: {} },
          },
        }),
        css: "",
      }
    : emitReact(contract, { contracts, icons, tokens: new Set<string>() });
}

test("both React targets preserve initial-only values, controlled priority, omission, null and callback payloads in a real consumer", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  for (const inline of [false, true])
    for (const nested of [false, true]) {
      const contract = fixture(nested),
        output = emit(contract, inline);
      assert.deepEqual(
        generatedTypeErrors(
          contract.name,
          output.tsx +
            `
  const initial = <Selection defaultChecked="indeterminate"/>;
  const nullValue = <Selection defaultChecked={null} checked={false}/>;
  // @ts-expect-error canonical values are not the public API
  const wrong = <Selection defaultChecked="off"/>;
  `,
        ),
        [],
      );
      const page = await browser.newPage();
      page.setDefaultTimeout(3000);
      try {
        await mountGenerated(page, contract.name, output.tsx, output.css);
        const control = page.locator("button");
        for (const initial of [false, true, "indeterminate", null]) {
          await page.evaluate(
            `window.calls=[];window.renderSubject({key:${JSON.stringify("initial-" + initial)},label:'Choose',defaultChecked:${JSON.stringify(initial)},onCheckedChange:value=>window.calls.push(value)});`,
          );
          assert.equal(
            await control.getAttribute("aria-checked"),
            initial === true ? "true" : initial === false ? "false" : "mixed",
          );
          const before = await control.getAttribute("aria-checked");
          await page.evaluate(
            `window.renderSubject({key:${JSON.stringify("initial-" + initial)},label:'Choose',defaultChecked:${JSON.stringify(initial === false ? true : false)},onCheckedChange:value=>window.calls.push(value)});`,
          );
          assert.equal(
            await control.getAttribute("aria-checked"),
            before,
            "updating the initializer must not update mounted state",
          );
          await control.press("Space");
          await control.click();
          assert.deepEqual(
            await page.evaluate("window.calls"),
            initial === true ? [false, true] : [true, false],
          );
          assert.equal(
            await control.getAttribute("defaultChecked"),
            null,
            "initial prop must not leak to the DOM",
          );
        }
        // A rejected controlled update must not mutate the hidden uncontrolled
        // state. Removing the controlled value exposes the original initializer.
        await page.evaluate(
          `window.calls=[];window.renderSubject({key:'controlled',label:'Choose',checked:false,defaultChecked:'indeterminate',onCheckedChange:value=>window.calls.push(value)});`,
        );
        await control.click();
        assert.equal(await control.getAttribute("aria-checked"), "false");
        assert.deepEqual(await page.evaluate("window.calls"), [true]);
        await page.evaluate(
          `window.renderSubject({key:'controlled',label:'Choose',defaultChecked:true});`,
        );
        assert.equal(await control.getAttribute("aria-checked"), "mixed");
        await page.evaluate(
          `window.renderSubject({key:'fallback',label:'Choose'});`,
        );
        assert.equal(await control.getAttribute("aria-checked"), "false");
        await page.evaluate(
          `window.calls=[];window.renderSubject({key:'disabled',label:'Choose',defaultChecked:'indeterminate',disabled:true,onCheckedChange:value=>window.calls.push(value)});`,
        );
        await control.click({ force: true });
        await control.press("Space");
        assert.deepEqual(await page.evaluate("window.calls"), []);
        assert.equal(await control.getAttribute("aria-checked"), "mixed");
      } finally {
        await page.close();
      }
    }
});

test("initial bindings reject invalid domains, missing toggles, required inputs and public/generated namespace collisions", () => {
  for (const mutate of [
    (c: ReturnType<typeof fixture>) => {
      c.props[0].bindings.code.initial!.default = "unknown";
    },
    (c: ReturnType<typeof fixture>) => {
      c.props[0].required = true;
    },
    (c: ReturnType<typeof fixture>) => {
      c.events = [];
    },
    (c: ReturnType<typeof fixture>) => {
      c.props[0].bindings.code.initial!.prop = "disabled";
    },
    (c: ReturnType<typeof fixture>) => {
      c.props[0].bindings.code.initial!.prop = "checked";
    },
    (c: ReturnType<typeof fixture>) => {
      c.props[0].bindings.code.initial!.prop = "handleChange";
    },
    (c: ReturnType<typeof fixture>) => {
      c.props[0].bindings.code.initial!.prop = "checkedProp";
    },
    (c: ReturnType<typeof fixture>) => {
      c.props[0].bindings.code.initial!.prop = "constructor";
    },
  ]) {
    const contract = fixture();
    mutate(contract);
    assert.equal(ContractSchema.safeParse(contract).success, false);
    for (const inline of [false, true])
      assert.throws(() => emit(contract, inline));
  }
  const contract = fixture();
  contract.props[1].bindings.code.prop = "__dscInitial0";
  for (const inline of [false, true])
    assert.throws(() => emit(contract, inline), /INITIAL_BINDING_COLLISION/);
  const slotCollision = fixture();
  slotCollision.anatomy.root.parts = {
    content: { slot: { name: "__dscInitial0" } },
  };
  for (const inline of [false, true])
    assert.throws(() => emit(slotCollision, inline), /INITIAL_BINDING_COLLISION/);
  const eventCollision = fixture();
  eventCollision.events![0].bindings.code.prop = "__dscInitial0";
  for (const inline of [false, true])
    assert.throws(() => emit(eventCollision, inline));
});
