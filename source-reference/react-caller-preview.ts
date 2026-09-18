import { build } from 'esbuild';
import path from 'node:path';
import type { ReactCallerComposition } from './react-caller-composition.js';

export async function buildReactCallerPreview(repo: string, draft: ReactCallerComposition) {
  if (draft.status !== 'generated-draft' || draft.problems.length || !draft.contract || !draft.modules)
    throw Error('react-caller-preview-draft-unavailable');
  const config = { identities: draft.identities.map(i => i.prop), props: draft.contract.props.filter(p => !draft.identities.some(i => i.prop === p.name)) };
  const modules = new Map(draft.modules.map(m => [m.name, m.tsx]));
  const bundle = await build({ absWorkingDir: repo, stdin: { loader: 'tsx', sourcefile: 'caller-consumer.tsx', resolveDir: repo,
    contents: `import React,{useId,useState} from 'react';import {createRoot} from 'react-dom/client';
      import {${draft.contract.name} as Subject} from 'generated-caller';
      const config=${JSON.stringify(config)};
      function Example({values,mount,index}){const prefix=useId();const ids=Object.fromEntries(config.identities.map((name,i)=>[name,prefix+'-'+i]));
        return <section aria-label={'Generated composition '+index} className="example"><Subject key={mount} {...values} {...ids}/></section>;}
      function Consumer(){const [values,setValues]=useState({}),[mount,setMount]=useState(0);
        const change=(name,value)=>setValues(before=>({...before,[name]:value}));
        return <><section className="examples" aria-label="Generated compositions"><Example values={values} mount={mount} index={1}/><Example values={values} mount={mount} index={2}/></section>
          <section className="consumer" aria-label="Composition consumer controls"><h2>Try two generated compositions</h2>
            <p>Each copy gets IDs from React useId. The generated child owns its state. Initial inputs take effect on remount.</p>
            {config.props.map(prop=><label key={prop.name}>{prop.bindings.code.prop}
              {prop.type==='text'?<input value={values[prop.name]??prop.default??''} onChange={e=>change(prop.name,e.target.value)}/>
              :prop.type==='boolean'?<input type="checkbox" checked={values[prop.name]??prop.default??false} onChange={e=>change(prop.name,e.target.checked)}/>
              :prop.type.enum?<select value={values[prop.name]??prop.default??''} onChange={e=>change(prop.name,e.target.value)}>{prop.type.enum.map(v=><option key={v}>{v}</option>)}</select>:null}</label>)}
            <button onClick={()=>setMount(value=>value+1)}>Remount generated compositions</button>
            <p>Observed source context only. External fonts, responsive behavior, clean installation and native mapping remain unqualified. Review context discrepancies outside this preview.</p>
          </section></>;}
      createRoot(document.getElementById('root')).render(<Consumer/>);` },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', logLevel: 'silent', plugins: [{ name: 'host-derived-caller', setup(builder) {
      builder.onResolve({ filter: /^generated-caller$/ }, () => ({ path: draft.contract!.name, namespace: 'caller' }));
      builder.onResolve({ filter: /^\.\.?\/[A-Za-z][\w-]*$/ }, args => modules.has(path.basename(args.path)) ? { path: path.basename(args.path), namespace: 'caller' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'caller' }, args => ({ contents: modules.get(args.path)!, loader: 'tsx', resolveDir: repo }));
    } }] });
  if (bundle.warnings.length) throw Error('react-caller-preview-build-warning');
  return { javascript: bundle.outputFiles[0].text,
    css: `body{margin:0;color:#202020;font:14px/1.5 system-ui,sans-serif}.examples{display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start}.example{width:${draft.observedWidth && Number.isFinite(draft.observedWidth) ? draft.observedWidth + 'px' : 'auto'};max-width:100%}.consumer{margin-top:24px;border-top:1px solid #ddd;padding-top:16px}.consumer h2{font-size:16px}.consumer label{display:block;margin:8px 0}.consumer input:not([type=checkbox]),.consumer select{display:block;font:inherit;width:300px;max-width:100%}.consumer button{font:inherit;margin-top:12px}` };
}
