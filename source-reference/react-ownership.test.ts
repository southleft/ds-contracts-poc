import { captureJs } from "../extract/computed/capture.js";
import type { CapturedNode } from "../extract/computed/lib.js";
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright-core";
import {
  reactOwnershipHook,
  reactOwnershipRead,
  reactOwnershipMatchesTree,
  type ReactOwnership,
} from "./react-ownership.js";

async function mount(browser: Browser, source: string) {
  const context = await browser.newContext();
  await context.addInitScript(reactOwnershipHook);
  const page = await context.newPage();
  await page.setContent('<div id="mount"></div><div id="portal"></div>');
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync,createPortal} from 'react-dom';
 const identity=(exportName)=>({module:'components.tsx',exportName,sourceSha256:'a'.repeat(64),span:{start:0,end:10}});
 ${source}`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    format: "iife",
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  return {
    context,
    page,
    read: (selector = "#mount > :first-child") =>
      page.evaluate(reactOwnershipRead(selector)) as Promise<ReactOwnership>,
  };
}
const fixture = `
 const First=React.memo(function SameName(props){return <section>{props.children}</section>});
 const Second=React.forwardRef(function SameName(props,ref){return <button ref={ref}>{String(props.checked)}</button>});
 window.__DSC_REACT_EXPORTS=[{identity:identity('First'),value:First},{identity:identity('Second'),value:Second}];
 flushSync(()=>createRoot(document.getElementById('mount')).render(<First><Second checked={false}/><Second checked={null}/></First>));`;

test('a child state update retains source owners when React switches ancestor fiber buffers', async () => {
  const browser = await chromium.launch();
  try {
    const { context, page, read } = await mount(browser, `
      function Parent({children}) { return <section>{children}</section> }
      function Child() { const [count,setCount]=React.useState(0); return <button onClick={()=>setCount(count+1)}>{count}</button> }
      window.__DSC_REACT_EXPORTS=[{identity:identity('Parent'),value:Parent},{identity:identity('Child'),value:Child}];
      flushSync(()=>createRoot(document.getElementById('mount')).render(<Parent><Child/></Parent>));`);
    try {
      const original = await read();
      assert.equal(original.nodes[0].createdBy, 'instance-0');
      assert.equal(original.nodes[1].createdBy, 'instance-1');
      for (let count = 1; count <= 3; count++) {
        await page.getByRole('button').click();
        assert.equal(await page.getByRole('button').textContent(), String(count));
        assert.deepEqual(await read(), original, 'runtime state changes do not change the source that creates a host node');
      }
    } finally { await context.close(); }
  } finally { await browser.close(); }
});

test("real renderer matches export objects through memo and forwardRef, keeping repeated instances and typed props", async () => {
  const browser = await chromium.launch();
  try {
    const { context, page, read } = await mount(browser, fixture);
    try {
      const before = await page.screenshot(),
        html = await page.locator("#mount").innerHTML(),
        result = await read();
      assert.deepEqual(result.problems, []);
      assert.deepEqual(
        result.components.map((c) => [c.source.exportName, c.parent, c.roots]),
        [
          ["First", undefined, [""]],
          ["Second", "instance-0", ["0"]],
          ["Second", "instance-0", ["1"]],
        ],
      );
      assert.equal(result.components[1].props.checked, false);
      assert.equal(result.components[2].props.checked, null);
      assert.deepEqual(await read(), result);
      assert.equal(await page.locator("#mount").innerHTML(), html);
      assert.deepEqual(await page.screenshot(), before);
      // A caller-shaped element with the same text/classes is not adopted.
      await page
        .locator("section")
        .evaluate((e) => e.appendChild(document.createElement("button")));
      assert.ok(
        (await read()).problems.some((p) =>
          p.startsWith("react-ownership-dom-without-fiber"),
        ),
      );
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
});

test("missing instrumentation, unsupported renderer, alias ambiguity and portals do not produce an accepted correspondence", async () => {
  const browser = await chromium.launch();
  try {
    const first = await mount(browser, fixture);
    try {
      await first.page.evaluate(
        "window.__DSC_REACT_EXPORTS.push(window.__DSC_REACT_EXPORTS[0])",
      );
      assert.deepEqual((await first.read()).problems, [
        "react-ownership-export-alias-ambiguous",
      ]);
      await first.page.evaluate(
        "window.__DSC_REACT_EXPORTS.pop();[...window.__DSC_REACT_OWNERSHIP.renderers.values()][0].version='999.0.0'",
      );
      assert.deepEqual((await first.read()).problems, [
        "react-ownership-renderer-unsupported",
      ]);
      await first.page.evaluate("delete window.__DSC_REACT_EXPORTS");
      assert.deepEqual((await first.read()).problems, [
        "react-ownership-instrumentation-missing",
      ]);
    } finally {
      await first.context.close();
    }
    const portal = await mount(
      browser,
      `
   function Panel(){return <section>Local{createPortal(<button>Elsewhere</button>,document.getElementById('portal'))}</section>}
   window.__DSC_REACT_EXPORTS=[{identity:identity('Panel'),value:Panel}];
   flushSync(()=>createRoot(document.getElementById('mount')).render(<Panel/>));`,
    );
    try {
      assert.ok(
        (await portal.read()).problems.some((p) =>
          p.startsWith("react-ownership-host-outside-selection"),
        ),
      );
    } finally {
      await portal.context.close();
    }
  } finally {
    await browser.close();
  }
});

test("compiler correspondence refuses shifted paths caused by non-painting SVG metadata", async () => {
  const browser = await chromium.launch();
  try {
    const instance = await mount(
      browser,
      `
   function Icon(){return <svg><title>Accessible name</title><path d="M0 0 L10 10"/></svg>}
   window.__DSC_REACT_EXPORTS=[{identity:identity('Icon'),value:Icon}];
   flushSync(()=>createRoot(document.getElementById('mount')).render(<Icon/>));`,
    );
    try {
      await instance.page.evaluate(
        "window.__ALL_PROPS=[...getComputedStyle(document.documentElement)].sort()",
      );
      const tree = (await instance.page.evaluate(
        captureJs("#mount", undefined, "--", ["#mount > svg"]),
      )) as CapturedNode;
      const ownership = await instance.read();
      assert.deepEqual(ownership.problems, []);
      assert.equal(
        reactOwnershipMatchesTree(ownership, tree),
        false,
        "a title omitted by capture must not shift a path onto a different element",
      );
    } finally {
      await instance.context.close();
    }
  } finally {
    await browser.close();
  }
});
