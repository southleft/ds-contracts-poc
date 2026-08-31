import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { build } from "vite";

import { chromiumExecutable } from "../extract/figma/visual-parity/render.js";
import { adaptReviewedInputField } from "./adapters/input-field.js";
import { muiInputFieldAdapterConfig } from "./fixtures/library-input-fields.js";
import { emitInputFieldOutputs } from "./output/input-field.js";
import { compileInputFieldRecipe } from "./recipes/input-field.js";

const sourceContract = JSON.parse(
  readFileSync("examples/mui/contracts/text-field.contract.json", "utf8"),
);
const instance = adaptReviewedInputField(
  sourceContract,
  muiInputFieldAdapterConfig,
);
const bundle = emitInputFieldOutputs(
  compileInputFieldRecipe(instance),
  instance.provenance.selection,
);
const reactSource = bundle.react.find((file) =>
  file.path.endsWith("InputField.tsx"),
)!.contents;
const stylesheet = bundle.react.find((file) =>
  file.path.endsWith(".css"),
)!.contents;
const webComponentSource = bundle.webComponent.find((file) =>
  file.path.endsWith("recipe-input-field.js"),
)!.contents;

const rectsAreNonzero = (
  rects: Record<string, { width: number; height: number }>,
): void => {
  assert.ok(Object.keys(rects).length >= 5);
  for (const [name, rect] of Object.entries(rects)) {
    assert.ok(rect.width > 0, `${name} width`);
    assert.ok(rect.height > 0, `${name} height`);
  }
};

test("React controlled and uncontrolled lifecycle stays visually coherent", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "recipe-input-react-"));
  try {
    symlinkSync(
      path.resolve("node_modules"),
      path.join(directory, "node_modules"),
    );
    writeFileSync(path.join(directory, "InputField.tsx"), reactSource);
    writeFileSync(path.join(directory, "input-field.css"), stylesheet);
    writeFileSync(
      path.join(directory, "entry.tsx"),
      `import React from "react";
import { createRoot } from "react-dom/client";
import { InputField } from "./InputField";
import "./input-field.css";
window.__changes = 0;
const App = () => <main>
  <InputField id="uncontrolled" defaultValue="" leadingAdornment="$" trailingAdornment="USD" onChange={() => window.__changes++} />
  <InputField id="controlled" value="fixed" onChange={() => window.__changes++} />
  <InputField id="error" state="error" errorText="Amount is invalid" leadingAdornment="$" trailingAdornment="USD" />
  <InputField id="disabled" disabled value="disabled" />
</main>;
createRoot(document.getElementById("app")).render(<App />);`,
    );
    await build({
      root: directory,
      logLevel: "silent",
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      plugins: [react()],
      build: {
        outDir: "dist",
        emptyOutDir: true,
        lib: {
          entry: path.join(directory, "entry.tsx"),
          formats: ["iife"],
          name: "InputBrowserTest",
          fileName: () => "app.js",
          cssFileName: "app",
        },
      },
    });
    const browser = await chromium.launch({
      executablePath: chromiumExecutable(),
      headless: true,
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 1100, height: 800 },
      });
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.setContent('<div id="app"></div>');
      await page.addStyleTag({ content: stylesheet });
      await page.addScriptTag({
        path: path.join(directory, "dist", "app.js"),
      });
      await page.waitForTimeout(100);
      assert.deepEqual(pageErrors, []);
      await page.waitForSelector("#uncontrolled", { timeout: 5_000 });
      const input = page.locator("#uncontrolled");
      const root = input.locator(
        "xpath=ancestor::div[@class='recipe-input-field']",
      );
      assert.equal(await root.getAttribute("data-content"), "placeholder");
      await input.focus();
      assert.equal(await root.getAttribute("data-state"), "focus-visible");
      await input.type("125.00");
      assert.equal(await root.getAttribute("data-content"), "value");
      await input.blur();
      assert.equal(await root.getAttribute("data-content"), "value");
      assert.equal(await root.getAttribute("data-state"), "default");
      assert.equal(await input.inputValue(), "125.00");
      await input.focus();
      assert.equal(await root.getAttribute("data-state"), "focus-visible");
      assert.ok((await page.evaluate(() => (window as any).__changes)) > 0);

      const controlled = page.locator("#controlled");
      await controlled.fill("attempted-change");
      assert.equal(await controlled.inputValue(), "fixed");
      assert.equal(await page.locator('label[for="uncontrolled"]').count(), 1);
      assert.equal(
        await page.locator("#error").getAttribute("aria-invalid"),
        "true",
      );
      assert.equal(await page.locator("#disabled").isDisabled(), true);

      const rects = await page.evaluate(() => {
        const selectors = {
          surface: "#uncontrolled + *",
          label: 'label[for="uncontrolled"]',
          helper: "#uncontrolled-message",
          leading: "#uncontrolled-leading-adornment",
          trailing: "#uncontrolled-trailing-adornment",
          errorSurface: "#error",
          disabledSurface: "#disabled",
        };
        return Object.fromEntries(
          Object.entries(selectors).map(([name, selector]) => {
            let node = document.querySelector(selector);
            if (name === "surface" || name.endsWith("Surface")) {
              const inputNode = document.querySelector(
                name === "surface"
                  ? "#uncontrolled"
                  : name === "errorSurface"
                    ? "#error"
                    : "#disabled",
              );
              node = inputNode?.closest(".recipe-input-field__surface") ?? null;
            }
            const rect = node!.getBoundingClientRect();
            return [name, { width: rect.width, height: rect.height }];
          }),
        );
      });
      rectsAreNonzero(rects);
    } finally {
      await browser.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Web Component preserves node, focus, caret, events, and external updates", async () => {
  const browser = await chromium.launch({
    executablePath: chromiumExecutable(),
    headless: true,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 800, height: 600 },
    });
    await page.setContent("<main></main>");
    await page.addScriptTag({
      content: webComponentSource.replaceAll("export ", ""),
    });
    await page.evaluate(() => {
      const element = document.createElement("recipe-input-field");
      element.id = "wc";
      element.setAttribute("label", '<img src=x onerror="window.__xss=1">');
      element.setAttribute("placeholder", "Enter amount");
      const leading = document.createElement("span");
      leading.slot = "leading-adornment";
      leading.textContent = "$";
      const trailing = document.createElement("span");
      trailing.slot = "trailing-adornment";
      trailing.textContent = "USD";
      element.append(leading, trailing);
      (window as any).__events = [];
      element.addEventListener("value-input", (event: Event) =>
        (window as any).__events.push((event as CustomEvent).detail.value),
      );
      element.addEventListener("value-change", (event: Event) =>
        (window as any).__events.push((event as CustomEvent).detail.value),
      );
      document.querySelector("main")!.append(element);
      (window as any).__inputNode = element.shadowRoot!.querySelector("input");
    });
    const input = page.locator("recipe-input-field").locator("input");
    await input.focus();
    await input.type("abcdef");
    await input.press("ArrowLeft");
    await input.press("ArrowLeft");
    const lifecycle = await page.evaluate(() => {
      const element = document.querySelector("recipe-input-field")!;
      const inputNode = element.shadowRoot!.querySelector("input")!;
      const original = (window as any).__inputNode;
      const before = {
        same: inputNode === original,
        focused: element.shadowRoot!.activeElement === inputNode,
        start: inputNode.selectionStart,
        end: inputNode.selectionEnd,
        content: element
          .shadowRoot!.querySelector(".recipe-input-field")!
          .getAttribute("data-content"),
      };
      inputNode.dispatchEvent(new Event("change", { bubbles: true }));
      element.setAttribute("value", "external");
      element.setAttribute("error-text", "Invalid");
      element.setAttribute("disabled", "");
      return {
        before,
        after: {
          same: element.shadowRoot!.querySelector("input") === original,
          value: (
            element.shadowRoot!.querySelector("input") as HTMLInputElement
          ).value,
          disabled: (
            element.shadowRoot!.querySelector("input") as HTMLInputElement
          ).disabled,
          invalid: element
            .shadowRoot!.querySelector("input")!
            .getAttribute("aria-invalid"),
          eventCount: (window as any).__events.length,
          imageCount: element.shadowRoot!.querySelectorAll("img").length,
          labelText: element.shadowRoot!.querySelector("label")!.textContent,
        },
      };
    });
    assert.deepEqual(lifecycle.before, {
      same: true,
      focused: true,
      start: 4,
      end: 4,
      content: "value",
    });
    assert.equal(lifecycle.after.same, true);
    assert.equal(lifecycle.after.value, "external");
    assert.equal(lifecycle.after.disabled, true);
    assert.equal(lifecycle.after.invalid, "true");
    assert.ok(lifecycle.after.eventCount >= 2);
    assert.equal(lifecycle.after.imageCount, 0);
    assert.equal(
      lifecycle.after.labelText,
      '<img src=x onerror="window.__xss=1">',
    );

    await page.evaluate(() => {
      const element = document.querySelector("recipe-input-field")!;
      element.removeAttribute("disabled");
      element.removeAttribute("error-text");
    });
    const rects = await page.evaluate(() => {
      const root = document.querySelector("recipe-input-field")!.shadowRoot!;
      return Object.fromEntries(
        [
          "surface",
          "label",
          "message",
          "adornment--leading",
          "adornment--trailing",
        ].map((part) => {
          const node = root.querySelector(
            part === "label"
              ? "label"
              : part === "message"
                ? ".recipe-input-field__message"
                : `.recipe-input-field__${part}`,
          )!;
          const rect = node.getBoundingClientRect();
          return [part, { width: rect.width, height: rect.height }];
        }),
      );
    });
    rectsAreNonzero(rects);
  } finally {
    await browser.close();
  }
});
