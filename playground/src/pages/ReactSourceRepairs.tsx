import {useEffect,useState} from 'react';
import type {SourceRepairApplication} from '../../../source-reference/react-source-repair-apply';

const root='/api/source-reference/react/source-repairs';
const phases:Record<SourceRepairApplication['phase'],string>={
  prepared:'Ready to apply the reviewed change.',
  'reading-design':'Checking the current Figma design. Keep Sync Runner connected.',
  'writing-source':'Updating the reviewed source and generated CSS.',
  'validating-source':'Checking every configured example against the updated source.',
  'reading-result':'Verifying that the Figma design still matches the reviewed change.',
  applied:'Source change applied. Source validation and the final canvas read passed.',
  'rolled-back':'Original source and CSS restored and validated. The Figma design remains unchanged.',
  'recovery-required':'This operation stopped before verification completed. Reconnect Sync Runner and resume or restore the original source.',
  refused:'This operation could not complete. Review the reason before retrying.',
};

export function ReactSourceRepairs({onReload}:{onReload:()=>void}){
  const [applications,setApplications]=useState<SourceRepairApplication[]>([]),[error,setError]=useState('');
  const [busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
  const [connection,setConnection]=useState<{id:string;value:string}>();
  const running=applications.some(a=>a.running);
  useEffect(()=>{
    const update=()=>setRevision(r=>r+1);window.addEventListener('react-source-repair-changed',update);
    return()=>window.removeEventListener('react-source-repair-changed',update);
  },[]);
  useEffect(()=>{
    let stopped=false,pending=false;
    const read=async()=>{
      if(pending)return;pending=true;
      try{
        const response=await fetch(root),result=await response.json();
        if(!response.ok)throw Error(result.reason??result.error);
        if(!stopped){setApplications(result.applications);setError('');}
      }catch(error){if(!stopped)setError(error instanceof Error?error.message:String(error));}
      finally{pending=false;}
    };
    void read();const timer=running?setInterval(()=>void read(),4000):undefined;
    return()=>{stopped=true;if(timer)clearInterval(timer);};
  },[running,revision]);
  const action=async(id:string,action:'apply'|'rollback'|'connection')=>{
    setBusy(id);setError('');setNotice('');
    try{
      const response=await fetch(`${root}/${id}/${action}`,{method:'POST'}),result=await response.json();
      if(!response.ok)throw Error(result.reason??result.error);
      if(action==='connection'){
        setConnection({id,value:result.connection});
        setNotice('Connection ready. Copy it into Sync Runner’s Local app connection, then select Connect / resume.');
      }else setApplications(rows=>rows.map(row=>row.id===id?result.application:row));
      setRevision(r=>r+1);
    }catch(error){setError(error instanceof Error?error.message:String(error));}
    finally{setBusy('');}
  };
  if(!applications.length&&!error)return null;
  return <section aria-label="React source applications">
    <h3>Source changes and recovery</h3>
    <p>These records remain available after reload. Applying changes the reviewed original module and generated CSS. Restoring source leaves the Figma design as it is.</p>
    <button type="button" disabled={!!busy} onClick={()=>setRevision(r=>r+1)}>Refresh source changes</button>
    {error&&<p role="alert">{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    {applications.map(a=><article key={a.id} style={{margin:'16px 0',padding:'12px 0',borderTop:'1px solid var(--border, #ddd)'}}>
      <h4>Source repair {a.id.slice(0,8)}</h4>
      <p role="status">{a.recordedCompletion&&a.phase!==a.recordedCompletion
        ? `This operation previously ${a.recordedCompletion==='applied'?'applied and verified its source change':'restored and verified the original source'}. The current source or validation evidence has since changed.`
        :phases[a.phase]}</p>
      {a.problem&&<p role="alert">{a.problem}</p>}
      {a.running&&<p>File status is from the most recent transaction check. Apply checks again before writing.</p>}
      <ul>{a.files.map(file=><li key={file.file}><code>{file.file}</code>: {file.state==='before'?'original bytes':file.state==='after'?'reviewed change':file.state==='missing'?'interrupted file replacement':'changed outside this operation'}</li>)}</ul>
      {a.validation&&<p>Recorded source validation: {a.validation.valid}/{a.validation.total} examples. Reference {a.validation.referenceId.slice(0,12)}.</p>}
      {a.phase!=='rolled-back'&&<button type="button" disabled={!!busy} onClick={()=>void action(a.id,'connection')}>Prepare Sync Runner connection</button>}
      {connection?.id===a.id&&<div>
        <label>Sync Runner connection <input type="password" autoComplete="off" readOnly value={connection.value} onFocus={event=>event.currentTarget.select()}/></label>
        <button type="button" onClick={()=>{
          setNotice('Copying connection. You can also select and copy the connection field.');
          void navigator.clipboard.writeText(connection.value).then(()=>setNotice('Connection copied. Paste it into Sync Runner’s Local app connection, then select Connect / resume.'),()=>setNotice('Select and copy the connection field, then paste it into Sync Runner.'));
        }}>Copy Sync Runner connection</button>
      </div>}
      {!['applied','rolled-back'].includes(a.phase)&&<button type="button" disabled={!!busy||running||a.transaction==='conflict'} onClick={()=>void action(a.id,a.direction==='rollback'?'rollback':'apply')}>
        {a.direction==='rollback'?'Resume restoring source':'Apply / resume reviewed change'}
      </button>}
      {a.transaction!=='prepared'&&a.phase!=='rolled-back'&&<button type="button" disabled={!!busy||running||a.transaction==='conflict'} onClick={()=>void action(a.id,'rollback')}>Restore original source and CSS</button>}
      {['applied','rolled-back'].includes(a.phase)&&<button type="button" disabled={!!busy||running} onClick={onReload}>Load verified source</button>}
    </article>)}
  </section>;
}
