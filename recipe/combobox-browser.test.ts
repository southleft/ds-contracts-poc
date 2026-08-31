import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { chromium, type Page } from "playwright-core";
import { build } from "vite";

import { chromiumExecutable } from "../extract/figma/visual-parity/render.js";
import { canonicalComboboxRecipeInstance } from "./fixtures/combobox.js";
import { emitComboboxOutputs } from "./output/combobox.js";
import { compileComboboxRecipe } from "./recipes/combobox.js";

const bundle = emitComboboxOutputs(
  compileComboboxRecipe(canonicalComboboxRecipeInstance),
  canonicalComboboxRecipeInstance.provenance.selection,
);
const reactSource = bundle.react.find((file) =>
  file.path.endsWith("Combobox.tsx"),
)!.contents;
const css = bundle.react.find((file) => file.path.endsWith(".css"))!.contents;
const wcSource = bundle.webComponent.find((file) =>
  file.path.endsWith(".js"),
)!.contents;

const assertBehavior = async (
  page: Page,
  inputSelector: string,
  optionSelector: string,
  rootSelector: string,
): Promise<void> => {
  const input = page.locator(inputSelector);
  await input.focus();
  assert.equal(await input.getAttribute("role"), "combobox");
  assert.equal(await input.getAttribute("aria-expanded"), "false");
  const controls = await input.getAttribute("aria-controls");
  assert.ok(controls);

  await input.press("ArrowDown");
  assert.equal(await input.getAttribute("aria-expanded"), "true");
  assert.match(
    (await input.getAttribute("aria-activedescendant")) ?? "",
    /option-0$/,
  );
  await input.press("ArrowDown");
  assert.match(
    (await input.getAttribute("aria-activedescendant")) ?? "",
    /option-1$/,
  );
  await input.press("ArrowDown");
  assert.match(
    (await input.getAttribute("aria-activedescendant")) ?? "",
    /option-3$/,
    "disabled option index 2 must be skipped",
  );
  await input.press("Escape");
  assert.equal(await input.getAttribute("aria-expanded"), "false");
  assert.equal(
    await input.evaluate(
      (node) =>
        (node.getRootNode() as Document | ShadowRoot).activeElement === node,
    ),
    true,
  );

  await input.fill("gra");
  assert.equal(await input.getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator(optionSelector).count(), 1);
  assert.equal(
    await page.locator(optionSelector).first().textContent(),
    "Grace Hopper",
  );
  await input.press("Enter");
  await page.waitForTimeout(30);
  assert.equal(await input.getAttribute("aria-expanded"), "false");
  assert.equal(await input.inputValue(), "Grace Hopper");
  assert.equal(
    await input.evaluate(
      (node) =>
        (node.getRootNode() as Document | ShadowRoot).activeElement === node,
    ),
    true,
  );

  const stability = await page.evaluate(
    ({ inputSelector, rootSelector }) => {
      const root = document.querySelector(rootSelector)!;
      const input =
        root instanceof HTMLElement && root.shadowRoot
          ? root.shadowRoot.querySelector("input")!
          : document.querySelector(inputSelector)!;
      (window as any).__comboboxInput = input;
      (input as HTMLInputElement).focus();
      (input as HTMLInputElement).setSelectionRange(3, 3);
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
      return {
        same:
          (root instanceof HTMLElement && root.shadowRoot
            ? root.shadowRoot.querySelector("input")
            : document.querySelector(inputSelector)) ===
          (window as any).__comboboxInput,
        start: (input as HTMLInputElement).selectionStart,
        focused:
          (root instanceof HTMLElement && root.shadowRoot
            ? root.shadowRoot.activeElement
            : document.activeElement) === input,
      };
    },
    { inputSelector, rootSelector },
  );
  assert.deepEqual(stability, { same: true, start: 3, focused: true });
};

test("generated React combobox has real keyboard, query, selection, ARIA, and focus behavior", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "recipe-combobox-react-"));
  try {
    symlinkSync(
      path.resolve("node_modules"),
      path.join(directory, "node_modules"),
    );
    writeFileSync(path.join(directory, "Combobox.tsx"), reactSource);
    writeFileSync(path.join(directory, "combobox.css"), css);
    writeFileSync(
      path.join(directory, "entry.tsx"),
      `import React from "react";
import { createRoot } from "react-dom/client";
import { Combobox } from "./Combobox";
import "./combobox.css";
window.__events = [];
const options = ${JSON.stringify(canonicalComboboxRecipeInstance.content.options)};
const App = () => <main>
  <Combobox id="react-combobox" options={options}
    onOpenChange={open => window.__events.push(["open", open])}
    onInputChange={value => window.__events.push(["query", value])}
    onChange={value => window.__events.push(["selection", value])}
    onHighlightChange={value => window.__events.push(["highlight", value])} />
  <Combobox id="disabled-combobox" disabled options={options} />
  <Combobox id="error-combobox" errorText="Invalid person" options={options} />
  <Combobox id="loading-combobox" loading defaultOpen options={options} />
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
          name: "ComboboxBehavior",
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
        viewport: { width: 900, height: 800 },
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setContent('<div id="app"></div>');
      await page.addStyleTag({ content: css });
      await page.addScriptTag({ path: path.join(directory, "dist", "app.js") });
      await page.waitForSelector("#react-combobox");
      await assertBehavior(
        page,
        "#react-combobox",
        "#react-combobox-listbox [role=option]",
        ".recipe-combobox",
      );
      assert.deepEqual(errors, []);
      assert.equal(await page.locator("#disabled-combobox").isDisabled(), true);
      assert.equal(
        await page.locator("#error-combobox").getAttribute("aria-invalid"),
        "true",
      );
      assert.match(
        (await page.locator("#loading-combobox-listbox").textContent()) ?? "",
        /Loading/,
      );
      const events = await page.evaluate(() => (window as any).__events);
      assert.ok(events.some(([name]: string[]) => name === "query"));
      assert.ok(events.some(([name]: string[]) => name === "selection"));
      assert.ok(events.some(([name]: string[]) => name === "highlight"));
    } finally {
      await browser.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("generated Web Component preserves input/caret while patching behavior safely", async () => {
  const browser = await chromium.launch({
    executablePath: chromiumExecutable(),
    headless: true,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 800, height: 700 },
    });
    await page.setContent("<main></main>");
    await page.addScriptTag({ content: wcSource.replaceAll("export ", "") });
    await page.evaluate((options) => {
      const element = document.createElement("recipe-combobox");
      element.id = "wc-combobox";
      element.setAttribute("options", JSON.stringify(options));
      element.setAttribute(
        "label",
        '<img src=x onerror="window.__comboboxXss=1">',
      );
      (window as any).__wcEvents = [];
      for (const name of [
        "open-change",
        "query-change",
        "selection-change",
        "highlight-change",
      ])
        element.addEventListener(name, (event: Event) =>
          (window as any).__wcEvents.push([
            name,
            (event as CustomEvent).detail,
          ]),
        );
      document.querySelector("main")!.append(element);
    }, canonicalComboboxRecipeInstance.content.options);
    await assertBehavior(
      page,
      "recipe-combobox input",
      "recipe-combobox [role=option]",
      "recipe-combobox",
    );
    const safety = await page.evaluate(() => {
      const element = document.querySelector("recipe-combobox")!;
      return {
        images: element.shadowRoot!.querySelectorAll("img").length,
        label: element.shadowRoot!.querySelector("label")!.textContent,
        xss: Boolean((window as any).__comboboxXss),
        events: (window as any).__wcEvents.map((row: unknown[]) => row[0]),
      };
    });
    assert.equal(safety.images, 0);
    assert.equal(safety.label, '<img src=x onerror="window.__comboboxXss=1">');
    assert.equal(safety.xss, false);
    assert.ok(safety.events.includes("query-change"));
    assert.ok(safety.events.includes("selection-change"));
    assert.ok(safety.events.includes("highlight-change"));
  } finally {
    await browser.close();
  }
});
