import {useEffect,useState} from 'react';
import type {ReactSourceRepairPreview as Preview} from '../../../source-reference/react-source-repair-preview';

export function ReactSourceRepairPreview({endpoint}:{endpoint:string}) {
  const [preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const running=preview?.phase==='running';
  useEffect(()=>{
    let stopped=false,pending=false;
    const read=async()=>{
      if(pending)return;pending=true;
      try {
        const response=await fetch(endpoint),result=await response.json();
        if(!response.ok)throw Error(result.reason??result.error);
        if(!stopped)setPreview(result.preview);
      }catch(error){if(!stopped)setError(error instanceof Error?error.message:String(error));}
      finally{pending=false;}
    };
    void read();const timer=running?setInterval(()=>void read(),4000):undefined;
    return()=>{stopped=true;if(timer)clearInterval(timer);};
  },[endpoint,running]);
  const start=async()=>{
    setBusy(true);setError('');
    try {
      const response=await fetch(endpoint,{method:'POST'}),result=await response.json();
      if(!response.ok)throw Error(result.reason??result.error);setPreview(result.preview);
    }catch(error){setError(error instanceof Error?error.message:String(error));}
    finally{setBusy(false);}
  };
  const selected=preview?.candidates.find(candidate=>candidate.index===preview.selected);
  return <section aria-label="React source repair preview">
    <h5>Preview a React source repair</h5>
    <p>Check a supported opacity edit in an isolated copy of the original source, across every recorded state. The preview leaves the original files unchanged.</p>
    <button type="button" disabled={busy||running} onClick={()=>void start()}>Prepare source repair preview</button>
    {error&&<p role="alert">{error}</p>}
    {preview&&<>
      <p role="status">{preview.step}. {!preview.current&&'The source or design evidence has changed; prepare again.'}</p>
      {!!preview.problems.length&&<ul>{preview.problems.map(problem=><li key={problem}>{problem}</li>)}</ul>}
      {!!preview.candidates.length&&<table style={{borderSpacing:'12px 6px',textAlign:'left'}}>
        <thead><tr><th>Source module</th><th>Before</th><th>Proposed</th><th>Result</th></tr></thead>
        <tbody>{preview.candidates.map(candidate=><tr key={candidate.index}>
          <td>{candidate.module}</td><td><code>{candidate.before}</code></td><td><code>{candidate.after}</code></td>
          <td>{candidate.status==='verified'?'All recorded states match the requested effect':candidate.problem??'Checking…'}</td>
        </tr>)}</tbody>
      </table>}
      {selected?.css&&<details><summary>Generated CSS change: {selected.css.file}</summary>
        <p>Removed</p><pre style={{whiteSpace:'pre-wrap'}}>{selected.css.removed||'(none)'}</pre>
        <p>Added</p><pre style={{whiteSpace:'pre-wrap'}}>{selected.css.added||'(none)'}</pre>
      </details>}
      {selected?.comparison&&<>
        <p>{selected.comparison.rows.filter(row=>row.changed).length} changed states; {selected.comparison.rows.filter(row=>!row.changed).length} unchanged states with identical images. Other recorded styles, content, fonts and geometry match.</p>
        <p>This checks the recorded caller and finite state set. Other callers and interactions still need verification before applying a source edit. Automatic source application is not available yet.</p>
        {preview.current&&<details><summary>Compare all {selected.comparison.rows.length} source states</summary>
          {selected.comparison.rows.map(row=><figure key={row.observation} style={{margin:'16px 0'}}>
            <figcaption>{row.variant}: opacity {row.beforeOpacity} → {row.afterOpacity}</figcaption>
            <div style={{display:'flex',gap:12,overflow:'auto'}}>
              <img src={`${endpoint}/${preview.id}/original/${row.observation}/${row.beforeImage}.png`} alt={`Original source ${row.variant}`} width={450} height={300}/>
              <img src={`${endpoint}/${preview.id}/candidate-${preview.selected}/${row.observation}/${row.afterImage}.png`} alt={`Proposed source ${row.variant}`} width={450} height={300}/>
            </div>
          </figure>)}
        </details>}
      </>}
    </>}
  </section>;
}
