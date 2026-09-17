import { build } from "esbuild";
import type { ReactBehaviorContract } from "./react-behavior-contract.js";

/** Bundle only the host-derived React draft and a normal consumer. No source
 * stylesheet or runtime is imported to make the generated result look right. */
export async function buildReactBehaviorPreview(
  repo: string,
  draft: ReactBehaviorContract,
) {
  const contract = draft.contract;
  if (
    draft.status !== "generated-draft" ||
    !contract ||
    !draft.tsx ||
    draft.problems.length
  )
    throw Error("react-behavior-preview-draft-unavailable");
  const inputs = contract.props.filter((prop) => prop.bindings.code.initial);
  if (
    inputs.length !== 1 ||
    typeof inputs[0].type !== "object" ||
    !("enum" in inputs[0].type)
  )
    throw Error("react-behavior-preview-state-unavailable");
  const prop = inputs[0],
    initial = prop.bindings.code.initial!;
  const event = contract.events?.find(
    (event) => event.toggles?.prop === prop.name,
  );
  if (!event || event.bindings.code.argument !== "next-value")
    throw Error("react-behavior-preview-callback-unavailable");
  const values = (inputs[0].type as { enum: string[] }).enum.map((key) =>
    prop.bindings.code.values ? prop.bindings.code.values[key] : key,
  );
  const disabled = contract.props.find(
    (p) => p.name === "disabled" && p.type === "boolean",
  )?.bindings.code.prop;
  const config = {
    controlled: prop.bindings.code.prop,
    initial: initial.prop,
    callback: event.bindings.code.prop,
    values,
    disabled,
  };
  const result = await build({
    absWorkingDir: repo,
    stdin: {
      sourcefile: "react-behavior-consumer.tsx",
      resolveDir: repo,
      loader: "tsx",
      contents: `
      import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {${contract.name} as Subject} from 'generated-behavior';
      const config = ${JSON.stringify(config)};
      function Consumer() {
        const [mode,setMode]=useState('initial'), [input,setInput]=useState(-1),
          [disabled,setDisabled]=useState(false), [mount,setMount]=useState(0), [calls,setCalls]=useState([]);
        const props={};
        if(input>=0) props[mode==='initial'?config.initial:config.controlled]=config.values[input];
        if(config.disabled) props[config.disabled]=disabled;
        props[config.callback]=(value)=>{
          setCalls(before=>[...before,value].slice(-32));
          if(mode==='accept') setInput(config.values.findIndex(item=>Object.is(item,value)));
        };
        return <>
          <section aria-label="Generated component" className="subject"><Subject key={mount} {...props}/></section>
          <section aria-label="React consumer controls" className="consumer">
            <h2>Try the generated React</h2>
            <p>These controls pass props to the generated component. Its own emitted handlers implement state changes.</p>
            <label>State management<select value={mode} onChange={event=>setMode(event.target.value)}>
              <option value="initial">Initial value</option><option value="accept">Controlled — accept changes</option>
              <option value="hold">Controlled — hold value</option></select></label>
            <label>Input value<select value={input} onChange={event=>setInput(Number(event.target.value))}>
              <option value={-1}>Omitted</option>{config.values.map((value,index)=><option key={index} value={index}>{JSON.stringify(value)}</option>)}
            </select></label>
            {config.disabled&&<label><input type="checkbox" checked={disabled} onChange={event=>setDisabled(event.target.checked)}/> Disabled</label>}
            <button type="button" onClick={()=>{setMount(value=>value+1);setCalls([])}}>Remount with current inputs</button>
            <p>Input prop: <code>{mode==='initial'?config.initial:config.controlled}</code>. Changing an initial value leaves mounted state unchanged; remount to initialize again. With the controlled input omitted, the component manages its own state.</p>
            <p>Callback: <code>{config.callback}</code></p><output aria-label="Callback values">{JSON.stringify(calls)}</output>
            <p>Emitted inline styles only. Caller labels, external fonts and full visual equivalence remain unqualified.</p>
          </section>
        </>;
      }
      createRoot(document.getElementById('root')).render(<Consumer/>);
    `,
    },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    logLevel: "silent",
    plugins: [
      {
        name: "host-derived-behavior",
        setup(builder) {
          builder.onResolve({ filter: /^generated-behavior$/ }, () => ({
            path: "generated-behavior",
            namespace: "behavior",
          }));
          builder.onLoad({ filter: /.*/, namespace: "behavior" }, () => ({
            contents: draft.tsx!,
            loader: "tsx",
            resolveDir: repo,
          }));
        },
      },
    ],
  });
  if (result.warnings.length)
    throw Error("react-behavior-preview-build-warning");
  return {
    javascript: result.outputFiles[0].text,
    css: `body{margin:0;color:#202020;font:14px/1.5 system-ui,sans-serif}.subject{min-height:48px}.consumer{border-top:1px solid #ddd;padding-top:16px}.consumer h2{font-size:16px}.consumer label{display:block;margin:10px 0}.consumer select{display:block;max-width:100%;margin-top:4px}.consumer button,.consumer select{font:inherit}.consumer output{display:block;overflow-wrap:anywhere;font-family:monospace}`,
  };
}
