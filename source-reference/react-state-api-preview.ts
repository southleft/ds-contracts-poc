import { build } from 'esbuild';
import type { ReactBehaviorContract } from './react-behavior-contract.js';

/** A normal consumer of emitted React only. The selected source runtime and
 * stylesheet are never imported to supply missing behavior or appearance. */
export async function buildReactStateApiPreview(repo: string, draft: ReactBehaviorContract) {
  const contract = draft.contract, prop = contract?.props.find(p => p.bindings.code.initial);
  const event = contract?.events?.find(e => e.toggles?.prop === prop?.name);
  const values = prop?.bindings.code.values;
  const domain = values ? Object.values(values) : [];
  if (draft.status !== 'generated-draft' || draft.problems.length || !contract || !draft.tsx || !prop || !event ||
      domain.filter(v => v === false).length !== 1 || domain.filter(v => v === true).length !== 1 ||
      domain.some(v => v !== false && v !== true && (contract?.semantics.role !== 'checkbox' || v !== 'indeterminate')) ||
      domain.filter(v => v === 'indeterminate').length > 1)
    throw Error('state-api-preview-draft-unavailable');
  const dependencies = new Map((draft.dependencies ?? []).map(d => [d.contract.name, d.tsx]));
  if (dependencies.size !== (draft.dependencies ?? []).length || dependencies.has(contract.name))
    throw Error('state-api-preview-dependencies-invalid');
  const config = { controlled: prop.bindings.code.prop, initial: prop.bindings.code.initial!.prop,
    callback: event.bindings.code.prop, values: domain, disabled: contract.props.find(p => p.name === 'disabled')?.bindings.code.prop };
  const built = await build({ absWorkingDir: repo, stdin: { resolveDir: repo, sourcefile: 'state-api-consumer.tsx', loader: 'tsx', contents: `
    import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import {${contract.name} as Subject} from 'generated-state-api';
    const config=${JSON.stringify(config)};
    const options=<><option value="omit">Omitted</option>{config.values.map(value=><option key={String(value)} value={String(value)}>{String(value)}</option>)}</>;
    const booleanOptions=<><option value="omit">Omitted</option><option value="false">false</option><option value="true">true</option></>;
    function Consumer(){
      const [held,setHeld]=useState('omit'),[initial,setInitial]=useState('omit'),[disabled,setDisabled]=useState('omit'),
        [accept,setAccept]=useState(false),[mount,setMount]=useState(0),[calls,setCalls]=useState([]);
      const props={};
      for(const [name,value] of [[config.controlled,held],[config.initial,initial],[config.disabled,disabled]])
        if(name&&value!=='omit')props[name]=value==='true'?true:value==='false'?false:value;
      props[config.callback]=(next)=>{setCalls(prior=>[...prior,next].slice(-32));if(accept&&held!=='omit')setHeld(String(next));};
      return <>
        <section aria-label="Generated state component" className="subject"><Subject key={mount} id="generated-state-control" {...props}/><label htmlFor="generated-state-control">State</label></section>
        <section aria-label="State consumer controls" className="controls"><h2>Try generated React state</h2>
          <p>Pass controlled and initial values independently. Initial values apply on a fresh mount; controlled values take precedence.</p>
          <label htmlFor="held">Controlled value</label><select id="held" value={held} onChange={e=>setHeld(e.target.value)}>{options}</select>
          <label htmlFor="initial">Initial value</label><select id="initial" value={initial} onChange={e=>setInitial(e.target.value)}>{options}</select>
          {config.disabled&&<><label htmlFor="disabled">Disabled value</label><select id="disabled" value={disabled} onChange={e=>setDisabled(e.target.value)}>{booleanOptions}</select></>}
          <label><input type="checkbox" checked={accept} onChange={e=>setAccept(e.target.checked)}/> Accept callback values as controlled input</label>
          <button type="button" onClick={()=>{setMount(n=>n+1);setCalls([]);}}>Remount and clear callbacks</button>
          <p>Callback: <code>{config.callback}</code></p><output aria-label="Generated callback values">{JSON.stringify(calls)}</output>
          <p>Emitted component and inline styles only. The label is consumer content. Source fonts, visual equivalence, excluded inputs and the native round trip remain unqualified.</p>
        </section>
      </>;
    }createRoot(document.getElementById('root')).render(<Consumer/>);
  ` }, bundle: true, write: false, format: 'iife', jsx: 'automatic', logLevel: 'silent', plugins: [{ name: 'generated-state-api', setup(builder) {
    builder.onResolve({filter:/^generated-state-api$/},()=>({path:'generated-state-api',namespace:'state-api'}));
    builder.onResolve({filter:/^\.\//,namespace:'state-api'},args=>{
      const name=args.path.slice(2);
      if(!dependencies.has(name))throw Error('state-api-preview-dependency-unavailable:'+name);
      return {path:name,namespace:'state-api'};
    });
    builder.onLoad({filter:/.*/,namespace:'state-api'},args=>({contents:args.path==='generated-state-api'?draft.tsx!:dependencies.get(args.path)!,loader:'tsx',resolveDir:repo}));
  } }] });
  if (built.warnings.length) throw Error('state-api-preview-build-warning');
  return { javascript: built.outputFiles[0].text,
    css: 'body{margin:0;color:#202020;font:14px/1.5 system-ui,sans-serif}.subject{display:flex;align-items:center;gap:12px;min-height:52px;padding:12px}.controls{border-top:1px solid #ddd;padding:12px}.controls h2{font-size:16px}.controls label{display:block;margin:10px 0}.controls select{display:block;margin-top:4px}.controls button,.controls select{font:inherit}.controls output{display:block;overflow-wrap:anywhere;font-family:monospace}' };
}
