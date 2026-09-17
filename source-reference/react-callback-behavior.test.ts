import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright-core";
import { readReactSourceProgram } from "./react-source-program.js";
import {
  reactOwnershipHook,
  reactOwnershipRead,
  type ReactOwnership,
} from "./react-ownership.js";
import { probeReactInitialProperties } from "./react-property-probe.js";
import { observeReactCallbackBehavior } from "./react-callback-behavior.js";

test("original callback values distinguish controlled and initial-only inputs without API-name heuristics", async () => {
  mkdirSync("private", { recursive: true });
  const dir = mkdtempSync(
    path.join(process.cwd(), "private/callback-fixture-"),
  );
  const browser = await chromium.launch();
  try {
    const source = `import React from 'react';
  type State=false|true|'partial';
  export function Switch({value,initialValue=false,disabled=false,emit}:{value?:State;initialValue?:State;disabled?:boolean;emit?:(value:State)=>void}){
   const [local,setLocal]=React.useState(initialValue);const current=value===undefined?local:value;
   return <button id="control" type="button" role="checkbox" disabled={disabled} aria-checked={current==='partial'?'mixed':current} onClick={()=>{
    const next=current===true?false:true;if(value===undefined)setLocal(next);emit?.call({receiver:'original'},next);
   }}>Choose</button>;
  }`;
    writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          skipLibCheck: true,
          jsx: "react-jsx",
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
        },
      }),
    );
    writeFileSync(path.join(dir, "components.tsx"), source);
    const program = readReactSourceProgram(dir, ["components.tsx"]);
    assert.deepEqual(program.problems, []);
    const identity = program.components.map((c) => ({
      module: c.module,
      exportName: c.exportName,
      sourceSha256: c.sourceSha256,
      span: c.span,
    }));
    const bundle = await build({
      stdin: {
        contents:
          source +
          `;import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';window.__DSC_REACT_CLONE_ELEMENT=React.cloneElement;window.__DSC_REACT_EXPORTS=[{identity:${JSON.stringify(identity[0])},value:Switch}];window.delegated=[];flushSync(()=>createRoot(document.getElementById('mount')).render(<main><label htmlFor="control">Preference</label><Switch initialValue={false} emit={function(value){window.delegated.push({value,receiver:this.receiver});return 42;}}/></main>));`,
        resolveDir: dir,
        loader: "tsx",
      },
      bundle: true,
      write: false,
      format: "iife",
    });
    const context = await browser.newContext();
    await context.addInitScript(reactOwnershipHook);
    const page = await context.newPage();
    await page.setContent('<div id="mount"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const selector = "#control";
    const ownership = (await page.evaluate(
      reactOwnershipRead(selector),
    )) as ReactOwnership;
    assert.deepEqual(ownership.problems, []);
    const instanceId = ownership.components[0].id;
    const original = await page.locator("#mount").innerHTML();
    let restores = 0;
    const assertRestored = async () => {
      assert.equal(await page.locator("#mount").innerHTML(), original);
      assert.deepEqual(
        await page.evaluate(reactOwnershipRead(selector)),
        ownership,
      );
      restores++;
    };
    const args = {
      page,
      selector,
      program,
      ownership,
      instanceId,
      assertRestored,
      assertCurrent: () => {},
    };
    const result = await observeReactCallbackBehavior(args);
    assert.deepEqual(result.problems, []);
    assert.equal(result.rows.length, 12);
    assert.deepEqual(
      result.relationships.map((r) => [r.property, r.status]),
      [
        ["initialValue", "initial-only-observed"],
        ["value", "controlled-observed"],
      ],
    );
    assert.equal(restores, 18);
    await assertRestored();
    const delegated = await page.evaluate(() => (window as any).delegated);
    assert.equal(delegated.length, 24);
    assert(
      delegated.every(
        (call: any) =>
          call.receiver === "original" && typeof call.value === "boolean",
      ),
    );
    // Wrapper return and this semantics are preserved even though the checker
    // deliberately accepts only void public callback declarations.
    const returned = await probeReactInitialProperties(
      page,
      selector,
      program,
      instanceId,
      { value: { kind: "set", value: false } },
      async (phase) => {
        if (phase !== "changed") return null;
        return page.evaluate(`(()=>{
    const state=window.__DSC_REACT_OWNERSHIP,root=[...state.roots.values()][0];
    let target;const walk=fiber=>{for(let n=fiber;n;n=n.sibling){if(n.memoizedProps?.emit)target=n;if(n.child)walk(n.child);}};walk(root.root.current);
    return target.memoizedProps.emit.call({receiver:'direct'},true);
   })()`);
      },
      "emit",
    );
    assert.equal(returned.changed, 42);
    assert.deepEqual(returned.callbackObservation, {
      calls: [[true]],
      problems: [],
    });
    await assertRestored();
    // Failure after real interaction still restores the source mount and clears
    // the observer. No callback recorder may leak into another trial.
    await assert.rejects(
      probeReactInitialProperties(
        page,
        selector,
        program,
        instanceId,
        { initialValue: { kind: "set", value: true } },
        async (phase) => {
          if (phase === "changed") {
            await page.locator(selector).click();
            throw Error("interrupted trial");
          }
          return null;
        },
        "emit",
      ),
      /interrupted trial/,
    );
    await assertRestored();
    assert.equal(
      await page.evaluate(
        () => (window as any).__DSC_REACT_OWNERSHIP.propertyProbes.size,
      ),
      0,
    );
    await assert.rejects(
      probeReactInitialProperties(
        page,
        selector,
        program,
        instanceId,
        { value: { kind: "set", value: false } },
        async () => null,
        "missing",
      ),
      /callback-unsupported/,
    );
    // A disabled original never emits. Its rows cannot establish controlled vs
    // default semantics, so the result must remain unresolved.
    await page.evaluate(() => {
      const state = (window as any).__DSC_REACT_OWNERSHIP,
        root = [...state.roots.values()][0] as any,
        renderer = state.renderers.get(root.id);
      const element = root.root.current.memoizedState.element,
        clone = (window as any).__DSC_REACT_CLONE_ELEMENT;
      const children = element.props.children.map((child: any) =>
        child.type === "label" ? child : clone(child, { disabled: true }),
      );
      renderer.scheduleRoot(root.root, clone(element, {}, ...children));
    });
    await page.waitForFunction(
      () => document.querySelector<HTMLButtonElement>("#control")!.disabled,
    );
    const disabledOwnership = (await page.evaluate(
      reactOwnershipRead(selector),
    )) as ReactOwnership;
    const disabled = await observeReactCallbackBehavior({
      ...args,
      ownership: disabledOwnership,
      assertRestored: async () => {
        assert.equal(await page.locator(selector).isDisabled(), true);
        assert.deepEqual(
          await page.evaluate(reactOwnershipRead(selector)),
          disabledOwnership,
        );
      },
    });
    assert.deepEqual(disabled.problems, []);
    assert.equal(disabled.rows.length, 12);
    assert(
      disabled.rows.every((row) =>
        row.steps.every(
          (step) =>
            step.callback.calls.length === 0 &&
            step.control.checked === row.initial.checked,
        ),
      ),
    );
    assert(disabled.relationships.every((row) => row.status === "unresolved"));
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
