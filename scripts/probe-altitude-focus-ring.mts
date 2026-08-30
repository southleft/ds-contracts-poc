/**
 * DIAGNOSTIC (read-only, no evidence mutation): reproduce the pinned Altitude
 * al-button focus-visible render and report the computed outline facts for
 * BOTH the light-DOM host and the shadow inner button, plus ring pixel
 * measurements — to name which element paints the dark ring TJ flagged.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { PNG } from "pngjs";

import { launchGateBrowser, newGatePage } from "../extract/figma/canvas-gate/shots.js";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const SANDBOX = path.join(REPO, "examples/altitude/.altitude-sandbox");

const stripAtImports = (css: string): string =>
  css.replace(
    /@import\s*(?:url\((?:"[^"]*"|'[^']*'|[^)]*)\)|"[^"]*"|'[^']*')\s*;/g,
    "",
  );

const sandboxRequire = createRequire(path.join(SANDBOX, "package.json"));
const esbuild = sandboxRequire("esbuild") as {
  build(options: Record<string, unknown>): Promise<{ outputFiles?: Array<{ text: string }> }>;
};
const bundleResult = await esbuild.build({
  stdin: {
    contents: `
globalThis.alAutoRegistry = true;
(async () => {
  await import("altitude-web-components");
  await customElements.whenDefined("al-button");
  const button = document.createElement("al-button");
  button.textContent = "Button";
  document.querySelector("[data-cell]").appendChild(button);
  if (button.updateComplete) await button.updateComplete;
  await document.fonts.ready;
  globalThis.__BUTTON_READY__ = true;
})().catch((error) => { globalThis.__BUTTON_ERROR__ = String(error && error.stack || error); });
`,
    resolveDir: SANDBOX,
    sourcefile: "probe-entry.js",
    loader: "js",
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: "chrome149",
  sourcemap: false,
  legalComments: "none",
});
const bundleSource = bundleResult.outputFiles?.[0]?.text;
if (!bundleSource) throw new Error("probe bundle produced zero bytes");

const themeCss = stripAtImports(
  `${readFileSync(path.join(SANDBOX, "node_modules/altitude-web-components/dist/css/main.css"), "utf8")}\n${readFileSync(path.join(SANDBOX, "node_modules/altitude-web-components/dist/css/tokens-light.css"), "utf8")}`,
);
const frameCss = `
html { color-scheme: light; }
body { margin: 0; padding: 24px; background: #fff; color: #1e1e1e; font-family: system-ui, sans-serif; }
.gate-cell { display: flex; align-items: flex-start; width: max-content; margin: 0 0 64px 0; }
*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }
`;
const html = `<!doctype html><html><head><meta charset="utf-8">
<style id="al-theme-sheet">${themeCss}</style><style>${frameCss}</style>
</head><body><button data-sentinel="probe" aria-label="sentinel" style="width:8px;height:8px;padding:0;border:0;margin:0 0 28px 0;background:#eee"></button>
<div class="gate-cell" data-cell="probe"></div><script>${bundleSource}</script></body></html>`;

const browser = await launchGateBrowser();
const { context, page } = await newGatePage(browser);
try {
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForFunction(
    "globalThis.__BUTTON_READY__ === true || !!globalThis.__BUTTON_ERROR__",
  );
  const harnessError = await page.evaluate("globalThis.__BUTTON_ERROR__ || null");
  if (harnessError) throw new Error(`probe harness failed: ${harnessError}`);

  await page.evaluate(
    `(() => { const s = document.querySelector('[data-sentinel="probe"]'); if (s) s.focus(); })()`,
  );
  await page.keyboard.press("Tab");
  // Let al-button's shadow-DOM `transition: all 0.2s` fully settle before
  // sampling — the light-DOM `transition: none !important` cannot reach it.
  await page.waitForTimeout(600);
  const animationCensus = await page.evaluate(`(() => {
    const host = document.querySelector('[data-cell] > *');
    const documentAnimations = document.getAnimations().length;
    const inner = host.shadowRoot.querySelector('button');
    const innerAnimations = inner.getAnimations({ subtree: true }).length;
    return { documentAnimations, innerAnimations };
  })()`);
  console.log("animation-census:", JSON.stringify(animationCensus));

  const facts = await page.evaluate(`(() => {
    const host = document.querySelector('[data-cell] > *');
    const inner = host.shadowRoot.querySelector('button');
    const vars = [
      '--al-theme-color-focus-ring',
      '--al-theme-color-border-primary-default',
      '--al-color-brand-blue-500',
      '--al-theme-border-width-md',
      '--al-border-width-2',
      '--al-focus-outline-offset',
    ];
    const pick = (el) => {
      const cs = getComputedStyle(el);
      const after = getComputedStyle(el, '::after');
      const before = getComputedStyle(el, '::before');
      return {
        tag: el.tagName.toLowerCase(),
        matchesFocusVisible: el.matches(':focus-visible'),
        matchesFocus: el.matches(':focus'),
        outline: [cs.outlineStyle, cs.outlineColor, cs.outlineWidth, cs.outlineOffset].join(' | '),
        boxShadow: cs.boxShadow,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        vars: Object.fromEntries(vars.map((name) => [name, JSON.stringify(cs.getPropertyValue(name))])),
        afterOutlineShadow: after.content === 'none' ? null : [after.content, after.outlineStyle, after.boxShadow, after.borderTopWidth, after.borderTopColor].join(' | '),
        beforeOutlineShadow: before.content === 'none' ? null : [before.content, before.outlineStyle, before.boxShadow, before.borderTopWidth, before.borderTopColor].join(' | '),
        rect: el.getBoundingClientRect().toJSON(),
      };
    };
    const focusRules = [];
    for (const sheet of host.shadowRoot.adoptedStyleSheets || []) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.cssText && rule.cssText.includes('focus')) focusRules.push(rule.cssText.slice(0, 400));
        }
      } catch (e) { focusRules.push('unreadable: ' + e); }
    }
    return {
      activeElement: document.activeElement && document.activeElement.tagName.toLowerCase(),
      shadowActive: host.shadowRoot.activeElement && host.shadowRoot.activeElement.tagName.toLowerCase(),
      adoptedSheetCount: (host.shadowRoot.adoptedStyleSheets || []).length,
      shadowStyleTags: host.shadowRoot.querySelectorAll('style').length,
      host: pick(host),
      inner: pick(inner),
      rootVars: Object.fromEntries(vars.map((name) => [name, JSON.stringify(getComputedStyle(document.documentElement).getPropertyValue(name))])),
      focusRules,
    };
  })()`);
  console.log(JSON.stringify(facts, null, 2));

  const shotBuffer = await page.screenshot({
    clip: { x: 0, y: 30, width: 160, height: 100 },
  });
  writeFileSync("/tmp/altitude-focus-probe.png", shotBuffer);
  const png = PNG.sync.read(Buffer.from(shotBuffer));
  const midY = Math.floor(png.height / 2);
  const runs: Array<{ x: number; color: string }> = [];
  let previous = "";
  for (let x = 0; x < png.width; x += 1) {
    const index = (midY * png.width + x) * 4;
    const color = `#${[png.data[index], png.data[index + 1], png.data[index + 2]]
      .map((component) => component!.toString(16).padStart(2, "0"))
      .join("")}`;
    if (color !== previous) {
      runs.push({ x, color });
      previous = color;
    }
  }
  console.log("midrow-runs:", JSON.stringify(runs.slice(0, 16)));
} finally {
  await context.close();
  await browser.close();
}
