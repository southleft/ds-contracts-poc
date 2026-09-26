import {useEffect,useRef,useState} from 'react';
import {Link,useRoute} from '../router';
import type {NativeOperationSnapshot} from '../../../source-reference/native-operation-jobs';
import './sources.css';

interface State {
  operation: NativeOperationSnapshot | null;
  connection: {paired:boolean;connected:boolean;started:boolean;finished:boolean} | null;
  library: {name:string;brands:string[]} | null;
}
const phaseNames: Partial<Record<NativeOperationSnapshot['phase'],string>> = {
  prepared:'Ready to connect', 'awaiting-native-result':'Waiting for Figma',
  'tokens-created':'Tokens created', 'tokens-observed':'Tokens checked',
  'components-created':'Components created', 'component-structure-observed':'Native structure checked',
  'component-observation-refused':'Native changes need review', 'observation-refused':'Token changes need review',
  'component-creation-refused':'Component creation refused', 'creation-refused':'Token creation refused',
  'component-partial-allocation':'Creation stopped with partial output',
  'library-replacement-observed':'Replacement ready for review',
  'library-replacement-refused':'Replacement refused',
  'library-replacement-unknown':'Replacement outcome unconfirmed',
  'evidence-unavailable':'Saved evidence unavailable',
};

export function PreparedLibraryNative({artifactId}:{artifactId:string}) {
  const {params,navigate} = useRoute(), mode = params.get('mode') ?? 'light', brand = params.get('brand') ?? 'default';
  const root = `/api/source-reference/prepared-library/${artifactId}/native`;
  const [state,setState] = useState<State | null>(null), [busy,setBusy] = useState(false);
  const [error,setError] = useState<string | null>(null), [code,setCode] = useState('');
  const [readError,setReadError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const selection = `${root}?${new URLSearchParams({mode,brand})}`;
  const currentSelection = useRef(selection), mutating = useRef(false);
  currentSelection.current = selection;
  useEffect(()=>{
    let disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
    setState(null); setCode(''); setError(null); setReadError(null);setBusy(false);mutating.current=false;
    const refresh = async()=>{
      if (mutating.current) {timer=setTimeout(()=>void refresh(),1000);return;}
      const version = ++requestVersion.current;
      try {
        const response = await fetch(`${root}?${new URLSearchParams({mode,brand})}`);
        const result = await response.json();
        if (!response.ok) throw Error([result.error,result.reason].filter(Boolean).join(' '));
        if (!disposed && version === requestVersion.current) {setState(result);setReadError(null);}
      } catch (cause) {
        if (!disposed && version === requestVersion.current) setReadError(cause instanceof Error ? cause.message : 'Unable to read the saved operation.');
      }
      if (!disposed) timer = setTimeout(()=>void refresh(),3000);
    };
    void refresh();
    return ()=>{disposed=true; ++requestVersion.current; clearTimeout(timer);};
  },[root,mode,brand]);
  const action = async(name = '')=>{
    if (mutating.current) return;
    mutating.current=true;setBusy(true);setError(null);++requestVersion.current;
    try {
      const response = await fetch(root+(name ? '/'+name : ''),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,brand,
        ...(name==='apply-replacement'?{reviewRevision:state?.operation?.libraryReplacement?.revision}:{})})});
      const result = await response.json();
      if (currentSelection.current !== selection) return;
      if (!response.ok) throw Error([result.error,result.reason].filter(Boolean).join(' '));
      if (typeof result.connection === 'string') setCode(result.connection);
      else setState(result);
    } catch (cause) {
      if(currentSelection.current === selection) setError(cause instanceof Error ? cause.message : 'The operation could not proceed.');
    } finally {
      if(currentSelection.current === selection) {mutating.current=false;setBusy(false);}
    }
  };
  const operation = state?.operation, connection = state?.connection;
  const operationProblems=(operation?.problems??[]).filter(problem=>!operation?.libraryReplacement||problem!=='native-operation-source-evidence-unavailable');
  const readOnlyPhase = operation?.pendingPhase?.endsWith('readback');
  const inspectable = operation && (readOnlyPhase || operation.canInspectPartial || ['component-structure-observed','component-observation-refused','observation-refused'].includes(operation.phase));
  return <main className="source-workspace">
    <p className="source-eyebrow">Prepared library · technical preview</p>
    <h1>Inspect this library in Figma.</h1>
    <p>Create editable native components from the same saved contracts and tokens used for your React download.</p>
    {state?.library ? <div className="source-connect">
      <label>Theme<select value={mode} disabled={busy} onChange={event=>navigate(`/prepared-library/${artifactId}?${new URLSearchParams({mode:event.target.value,brand})}`)}>
        <option value="light">Light</option><option value="dark">Dark</option>
      </select></label>
      <label>Brand<select value={brand} disabled={busy} onChange={event=>navigate(`/prepared-library/${artifactId}?${new URLSearchParams({mode,brand:event.target.value})}`)}>
        {!state.library.brands.includes(brand) && <option value={brand} disabled>Choose an available brand</option>}
        {state.library.brands.map(value=><option value={value} key={value}>{value}</option>)}
      </select></label>
    </div> : <p>Selected theme: <strong>{mode}</strong> · brand: <strong>{brand}</strong>.</p>}
    <p className="source-note">Library {artifactId}. This link reopens the saved selection after a server restart.</p>
    <p><Link to="/playground">Back to Playground</Link> · <a href={`/api/react-library/download/${artifactId}`}>Download saved React library</a></p>
    {(error || readError) && <p role="alert">{error ?? readError}</p>}
    {state && !operation && <div className="source-connect">
      <button disabled={busy || !state.library?.brands.includes(brand)} onClick={()=>void action()}>{busy ? 'Preparing…' : 'Prepare editable Figma components'}</button>
    </div>}
    {state?.library && !state.library.brands.length && <p>This library has no named brand. Its React download remains available; native preparation currently requires a saved brand context.</p>}
    {!state && !error && !readError && <p role="status">Opening saved library…</p>}
    {operation && <section className="source-native" aria-label="Library operation">
      <h2>{operation.componentName ?? 'Library'} · {phaseNames[operation.phase] ?? 'Operation needs review'}</h2>
      <p role="status">{operation.counters.variants} root {operation.counters.variants === 1 ? 'variant' : 'variants'} · {operation.counters.variables} variables.</p>
      <p className="source-note">Operation {operation.id}</p>
      {!operation.sourceCurrent && <p>{operation.libraryReplacement
        ? 'The original attempt used an older compiler plan. This replacement review uses the current compiler with the same saved library and token context.'
        : 'The saved operation no longer matches the current library or compiler. Creation is unavailable; inspection still uses the original operation and recorded allocation.'}</p>}
      {operation.canInspectPartial ? <p>Figma reported an incomplete creation. Inspect the retained output before recovery. Inspection reads the existing page and does not create or remove components.</p>
        : operation.nativeOutcome === 'unknown' && <p>Figma’s result has not been confirmed. Reconnect the same companion to return its saved result. This operation will not create a replacement graph.</p>}
      {operation.phase !== 'evidence-unavailable' && <>
        <ol>
          <li>Open DS Contracts Evaluations in Figma Desktop.</li>
          <li>Open DS Contracts Sync Runner, choose Build, then Connect the local source workflow.</li>
          <li>Paste this operation’s connection code and choose Connect / resume.</li>
        </ol>
        <div className="source-connect">
          <button disabled={busy} onClick={()=>void action('connection')}>{code ? 'Show connection code again' : 'Get connection code'}</button>
        </div>
        {code && <label>Local app connection<input readOnly value={code} onFocus={event=>event.currentTarget.select()} /></label>}
        <p>{connection?.connected ? 'Figma companion connected.' : 'Waiting for the Figma companion.'}</p>
        <div className="source-connect">
          {!connection?.started && <button disabled={busy || !operation.sourceCurrent || !connection?.connected}
            onClick={()=>void action('start')}>Create and inspect in Figma</button>}
          {inspectable && <button disabled={busy || !connection?.paired}
            onClick={()=>void action('retry-observation')}>{readOnlyPhase ? 'Retry interrupted inspection' : operation.canInspectPartial ? 'Inspect partial output' : 'Inspect native output again'}</button>}
          {operation.canReviewLibraryReplacement && <button disabled={busy || !connection?.paired}
            onClick={()=>void action('review-replacement')}>Review replacement</button>}
        </div>
      </>}
      {!!operationProblems.length && <ul>{operationProblems.map(problem=><li key={problem}>{problem}</li>)}</ul>}
      {operation.partialObservation && <section aria-label="Partial output inspection">
        <h3>{operation.libraryReplacement||operation.libraryReplacementOutcome ? 'Earlier partial output inspection' : operation.partialObservation.status==='partial-output-inspected' ? 'Partial output inspected' : 'Partial output inspection refused'}</h3>
        <p>{operation.partialObservation.nodeCount} nodes observed on the retained page; {operation.partialObservation.recordedNodeCount} allocations were recorded, including the page.</p>
        <p>{operation.partialObservation.missingNodeIds.length} missing · {operation.partialObservation.additionalNodeIds.length} additional · {operation.partialObservation.changedTypeNodeIds.length} changed types · {operation.partialObservation.ownershipMismatchNodeIds.length} ownership differences.</p>
        {!!operation.partialObservation.inheritedNodeIds.length && <p>{operation.partialObservation.inheritedNodeIds.length} layers inherit their identity from component definitions. {operation.partialObservation.allocationAliases.length} caller allocations have replacement IDs assigned by Figma.</p>}
        <p>{operation.partialObservation.tokensObserved ? 'The saved token context matches.' : 'The saved token context could not be verified.'} This inspection does not qualify the incomplete components. Review replacement checks whether this operation can safely rebuild its partial page.</p>
      </section>}
      {operation.libraryReplacement && <section aria-label="Replacement review">
        <h3>Replace the inspected partial page</h3>
        <p>Remove this operation’s partial page and its {operation.libraryReplacement.nodeCount-1} observed child nodes, including inherited layers and edits within those nodes. Rebuild {operation.libraryReplacement.componentCount} components from the same saved library, with {operation.libraryReplacement.rootVariants} root variants, and reuse all {operation.libraryReplacement.variableCount} variables.</p>
        <p>Every observed node is accounted for by a recorded allocation or its inherited component structure. No external component, swap or prototype references were detected. The supported properties and tokens will be checked again before removal. The original failed operation remains in the history.</p>
        <button disabled={busy || !connection?.connected} onClick={()=>void action('apply-replacement')}>Replace partial page and inspect</button>
      </section>}
      {operation.libraryReplacementOutcome && <p>{operation.libraryReplacementOutcome.status==='replacement-executed'
        ? `Replacement ran; ${operation.libraryReplacementOutcome.retiredNodeCount} old nodes were retired. The new output still requires an independent structure check and visual qualification.`
        : operation.canReviewLibraryReplacement
          ? 'The previous attempt stopped during removal. Review the retained page before proposing a separately recorded continuation.'
          : 'Replacement did not complete with a confirmed result. This write cannot be repeated; the retained result needs investigation.'}</p>}
      {operation.structuralObservation?.status === 'supported-structure-observed' && <p>The saved native graph matches the supported contract structure. Visual fidelity and React interactions still require separate qualification.</p>}
      {!!operation.imageObservation?.images.length && <>
        <h3>Native output</h3>
        <p>Close the plugin window to review the canvas. These exports are diagnostic and do not constitute a visual-fidelity pass.</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:24,overflow:'auto'}}>
          {operation.imageObservation.images.map(image=><figure key={image.caseId} style={{margin:0}}>
            <figcaption>{image.caseId}</figcaption>
            <img alt={`Native ${image.caseId}`} width={image.width} height={image.height} style={{display:'block',maxWidth:'none'}}
              src={`/api/source-reference/prepared-library-native/${operation.id}/images/${operation.imageObservation!.attemptId}/${image.sha256}.png`} />
          </figure>)}
        </div>
      </>}
    </section>}
  </main>;
}
