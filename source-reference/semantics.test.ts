import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import { readCemDeclarations } from "../extract/adapters/cem.js";
import {
  assessSemantics,
  captureStableSemantics,
  observeSemantics,
  semanticHash,
} from "./semantics.js";

test("semantic intake preserves declared identity, actual slot assignment and native state without inventing defaults or event wiring", async () => {
  const { declarations, problems } = readCemDeclarations({
    modules: [
      {
        path: "button.ts",
        declarations: [
          {
            kind: "class",
            customElement: true,
            name: "SourceButton",
            tagName: "source-button",
            members: [
              {
                kind: "field",
                name: "isDisabled",
                type: { text: "boolean" },
                attribute: "isDisabled",
              },
            ],
            attributes: [
              {
                name: "isDisabled",
                fieldName: "isDisabled",
                type: { text: "boolean" },
              },
            ],
            slots: [{ name: "" }, { name: "after" }],
            events: [{ name: "onActivate" }],
          },
        ],
      },
    ],
  });
  assert.deepEqual(problems, []);
  const declaration = declarations[0];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.setContent("<source-button>Source label</source-button>");
    await page.evaluate(() => {
      customElements.define(
        "source-button",
        class extends HTMLElement {
          isDisabled = true;
          constructor() {
            super();
            this.attachShadow({ mode: "open" }).innerHTML =
              '<button aria-disabled="true"><span><slot>Fallback source text</slot></span></button>';
          }
        },
      );
    });
    const observation = await observeSemantics(
      page,
      ["source-button"],
      declaration,
    );
    assert.equal(observation.hostTag, "source-button");
    assert.deepEqual(observation.properties.isDisabled, {
      kind: "value",
      value: true,
    });
    assert.deepEqual(observation.nativeElements[0].properties.disabled, {
      kind: "value",
      value: false,
    });
    assert.equal(
      observation.nativeElements[0].attributes["aria-disabled"],
      "true",
    );
    assert.deepEqual(observation.slots[0].assigned, [
      { kind: "text", text: "Source label" },
    ]);
    assert.deepEqual(observation.slots[0].fallback, [
      { kind: "text", text: "Fallback source text" },
    ]);
    const reference = {
      valid: true,
      sourcePngSha256: "a".repeat(64),
      sourceTreeSha256: "b".repeat(64),
    };
    const intake = assessSemantics(declaration, observation, reference);
    assert.equal(intake.status, "observed");
    assert.equal(intake.declaration.events[0].name, "onActivate");
    assert.equal(intake.declaration.properties[0].default, undefined);
    assert.ok(
      intake.limitations.includes("slot-not-rendered-in-this-state:after"),
    );
    assert.ok(intake.limitations.includes("default-not-declared:isDisabled"));
    assert.ok(
      intake.limitations.includes("event-behavior-not-observed:onActivate"),
    );
    assert.equal(intake.observationSha256, semanticHash(observation));
    assert.equal(
      assessSemantics(declaration, observation, { ...reference, valid: false })
        .status,
      "refused",
    );
    assert.equal(
      assessSemantics(declaration, observation, reference, [
        "ambiguous-declaration",
      ]).status,
      "refused",
    );
    assert.equal(
      assessSemantics(
        declaration,
        { ...observation, hostTag: "different-component" },
        reference,
      ).status,
      "refused",
    );
    assert.equal(
      assessSemantics(
        declaration,
        { ...observation, properties: {} },
        reference,
      ).status,
      "refused",
    );
    assert.ok(
      assessSemantics(
        declaration,
        {
          ...observation,
          properties: { isDisabled: { kind: "value", value: "true" } },
        },
        reference,
      ).problems.includes("declared-property-type-mismatch:isDisabled"),
    );
    assert.ok(
      assessSemantics(
        declaration,
        { ...observation, properties: { isDisabled: { kind: "non-scalar" } } },
        reference,
      ).problems.includes("declared-property-type-mismatch:isDisabled"),
    );
    await page.evaluate(() => {
      document
        .querySelector("source-button")!
        .appendChild(document.createElement("strong")).textContent =
        "Replacement content";
    });
    const changed = await observeSemantics(
      page,
      ["source-button"],
      declaration,
    );
    assert.notEqual(semanticHash(changed), semanticHash(observation));
    assert.deepEqual(changed.slots[0].assigned[1], {
      kind: "element",
      tag: "strong",
      attributes: {},
      properties: {},
      children: [{ kind: "text", text: "Replacement content" }],
    });
    await page.evaluate(() => {
      document.querySelector("source-button")!.innerHTML =
        '<a href="/original" aria-label="Original"><input type="checkbox"></a>';
    });
    const linked = await observeSemantics(page, ["source-button"], declaration);
    await page.evaluate(() => {
      document.querySelector("a")!.setAttribute("href", "/different");
      document.querySelector("a")!.setAttribute("aria-label", "Different");
      document.querySelector("input")!.checked = true;
    });
    const relinked = await observeSemantics(
      page,
      ["source-button"],
      declaration,
    );
    assert.notEqual(semanticHash(linked), semanticHash(relinked));
    const link = relinked.slots[0].assigned[0];
    assert.equal(link.kind, "element");
    if (link.kind !== "element") throw new Error("Expected assigned element");
    assert.equal(link.attributes.href, "/different");
    assert.equal(link.attributes["aria-label"], "Different");
    const input = link.children[0];
    assert.equal(input.kind, "element");
    if (input.kind !== "element") throw new Error("Expected nested control");
    assert.deepEqual(input.properties.checked, { kind: "value", value: true });
    const screenshotSha = async () =>
      createHash("sha256")
        .update(await page.screenshot({ fullPage: true, caret: "initial" }))
        .digest("hex");
    const stable = await captureStableSemantics(
      page,
      ["source-button"],
      declaration,
      await screenshotSha(),
      50,
    );
    assert.equal(
      assessSemantics(declaration, stable, reference).status,
      "observed",
      JSON.stringify(stable.problems),
    );
    assert.ok(
      (
        await captureStableSemantics(
          page,
          ["source-button"],
          declaration,
          "0".repeat(64),
          50,
        )
      ).problems.includes("semantic-source-image-not-stable"),
    );
    // Synchronous, reverted and property-only getter writes all invalidate the
    // observation, even when the final pixels happen to remain identical.
    for (const effect of ["attribute", "reverted", "native-state"]) {
      await page.evaluate((effect) => {
        const host = document.querySelector("source-button")!;
        Object.defineProperty(host, "isDisabled", {
          configurable: true,
          get() {
            if (effect === "native-state") {
              const input = host.querySelector("input")!;
              input.checked = !input.checked;
            } else {
              host.setAttribute("data-getter-write", "changed");
              if (effect === "reverted")
                host.removeAttribute("data-getter-write");
            }
            return true;
          },
        });
      }, effect);
      const unsafe = await observeSemantics(
        page,
        ["source-button"],
        declaration,
      );
      assert.ok(
        unsafe.problems.includes("source-mutated-during-semantic-observation"),
        effect,
      );
      assert.equal(
        assessSemantics(declaration, unsafe, reference).status,
        "refused",
      );
    }
    await page.evaluate(() => {
      const host = document.querySelector("source-button")!;
      Object.defineProperty(host, "isDisabled", {
        configurable: true,
        get() {
          setTimeout(() => {
            host.setAttribute("data-async-write", "changed");
            host.textContent = "Changed by getter";
          }, 10);
          return true;
        },
      });
    });
    const asyncUnsafe = await captureStableSemantics(
      page,
      ["source-button"],
      declaration,
      await screenshotSha(),
      50,
    );
    assert.ok(
      asyncUnsafe.problems.includes("semantic-source-image-not-stable"),
    );
    assert.ok(asyncUnsafe.problems.includes("semantic-observation-not-stable"));
    assert.equal(
      assessSemantics(declaration, asyncUnsafe, reference).status,
      "refused",
    );
    // A mutation after only the SECOND read used to escape the PNG-only final
    // check. Neither aria changes nor set-and-revert writes change the pixels.
    for (const revert of [false, true]) {
      await page.evaluate((revert) => {
        const host = document.querySelector("source-button")!;
        let reads = 0;
        Object.defineProperty(host, "isDisabled", {
          configurable: true,
          get() {
            if (++reads === 2)
              setTimeout(() => {
                host.setAttribute("aria-label", "Changed after second probe");
                if (revert) host.removeAttribute("aria-label");
              }, 10);
            return true;
          },
        });
      }, revert);
      const lateMutation = await captureStableSemantics(
        page,
        ["source-button"],
        declaration,
        await screenshotSha(),
        50,
      );
      assert.ok(
        lateMutation.problems.includes("source-mutated-during-semantic-window"),
      );
      assert.equal(
        assessSemantics(declaration, lateMutation, reference).status,
        "refused",
      );
    }
    await page.evaluate(() =>
      Object.defineProperty(
        document.querySelector("source-button")!,
        "isDisabled",
        { configurable: true, value: true },
      ),
    );
    await page.evaluate(() =>
      Object.defineProperty(
        document
          .querySelector("source-button")!
          .shadowRoot!.querySelector("button")!,
        "disabled",
        {
          get() {
            throw new Error("Unreadable control");
          },
        },
      ),
    );
    assert.ok(
      (
        await observeSemantics(page, ["source-button"], declaration)
      ).problems.includes("native-property-unobserved:button:disabled"),
    );
    await page.evaluate(() => {
      document.querySelector("source-button")!.shadowRoot!.innerHTML +=
        '<slot name="undeclared"></slot>';
    });
    const mismatch = assessSemantics(
      declaration,
      await observeSemantics(page, ["source-button"], declaration),
      reference,
    );
    assert.ok(
      mismatch.problems.includes("rendered-slot-not-declared:undeclared"),
    );
    await page.evaluate(() =>
      document.body.appendChild(document.createElement("source-button")),
    );
    const ambiguous = await observeSemantics(
      page,
      ["source-button"],
      declaration,
    );
    assert.equal(ambiguous.hostCount, 2);
    assert.equal(
      assessSemantics(declaration, ambiguous, reference).status,
      "refused",
    );
  } finally {
    await browser.close();
  }
});
