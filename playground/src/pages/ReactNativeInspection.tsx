import type { ReactCompositionReview } from '../../../source-reference/react-composition';
import { useEffect, useState } from 'react';
import type { NativeOperationSnapshot } from '../../../source-reference/native-operation-jobs';
import type { ReactOwnershipReport } from '../../../source-reference/react-ownership-run';
import type { ReactContentInspection } from '../../../source-reference/react-content-inspection';
import type { SourceFrame } from '../../../source-reference/source-framing';
import { ReactInitialInspection } from './ReactInitialInspection';
import type { createNativeUpdateJobs } from '../../../source-reference/native-update-jobs';

interface Operation {
  kind: 'root' | 'comparison' | 'initial';
  initialStates?: Array<{ observation: string; variant: string }>; parentOperationId?: string;
  updates?: Array<{ id: string; status: 'planned'; changes: Array<{ nodeId: string; variant: string; part: string; before: number; after: number }>;
    operation?: ReturnType<ReturnType<typeof createNativeUpdateJobs>['get']> | null;
    connection?: {paired:boolean;connected:boolean;started:boolean;finished:boolean} }>;
  caseId: string; ownershipId: string; fileKey: string; operation: NativeOperationSnapshot;
  connection: { paired: boolean; connected: boolean; started: boolean; finished: boolean };
  content?: Pick<ReactContentInspection, 'phase' | 'sourceUnchanged' | 'problems'> & Partial<ReactContentInspection>;
  sourceFrame?: SourceFrame; sourceFrameProblem?: string;
  composition?: ReactCompositionReview; compositionProblem?: string;
}
export function ReactNativeInspection({ referenceId, selectedCase, ownership }: {
  referenceId: string; selectedCase: string; ownership: ReactOwnershipReport | null;
}) {
  const [rows, setRows] = useState<Operation[]>([]), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [codes, setCodes] = useState<Record<string, string>>({});
  const root = `/api/source-reference/react/${referenceId}`;
  const active = rows.some(r => (r.connection.paired && !r.connection.finished) || r.content?.phase === 'running' || r.updates?.some(u=>u.connection?.paired&&!u.connection.finished));
  useEffect(() => {
    let stopped = false, pending = false;
    const load = async () => {
      if (pending) return; pending = true;
      try {
        const response = await fetch(`${root}/native`), result = await response.json();
        if (!response.ok) throw Error(result.error);
        if (!stopped) { setRows(result.operations); setError(''); }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : String(e)); }
      finally { pending = false; }
    };
    void load();
    const timer = active ? setInterval(() => void load(), 4000) : undefined;
    return () => { stopped = true; if (timer) clearInterval(timer); };
  }, [root, active]);
  async function action(route: string, id?: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`${root}/${route}`, { method: 'POST' }), result = await response.json();
      if (!response.ok) throw Error(result.error);
      if (result.connection && id) {
        setCodes(old => ({ ...old, [id]: result.connection }));
        const refreshed = await fetch(`${root}/native`), snapshot = await refreshed.json();
        if (!refreshed.ok) throw Error(snapshot.error);
        setRows(snapshot.operations);
      } else setRows(result.operations);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  const selected = ownership?.rows.find(r => r.id === selectedCase);
  const ready = ownership?.state === 'complete' && ownership.sourceUnchanged && selected?.matched && selected.rootMatrix?.draft?.status === 'native-compiled';
  return <section className="react-native-inspection">
    <h3>Inspect editable Figma roots</h3>
    <p>Create a native draft from the observed root styles and properties. Its content slot stays empty and editable.
      Prepare separate caller-content instances for comparison below. Visual fidelity, stateful behavior and the complete composed component remain unqualified.</p>
    <button type="button" disabled={busy || !ready} onClick={() => void action(`native/${selectedCase}`)}>
      Prepare {selectedCase} for Figma
    </button>
    {!ready && <p>Complete a matching structure observation with a compiled root draft for the selected case first.</p>}
    {error && <p role="alert">{error}</p>}
    <ReactInitialInspection referenceId={referenceId} caseId={selectedCase} available={rows.some(r => r.kind === 'root' && r.operation.sourceCurrent)} nativeSaved={rows.some(r => r.kind === 'initial' && r.caseId === selectedCase)} nativeBusy={busy} prepareNative={() => void action(`native-initial/${selectedCase}`)} />
    {rows.map(row => {
      const op = row.operation, id = op.id, comparison = row.kind === 'comparison', initial = row.kind === 'initial';
      const savedComparison = rows.find(r => r.parentOperationId === id);
      return <details key={id} open={row.caseId === selectedCase}>
        <summary>{row.caseId} {initial ? '· observed initial states' : comparison ? '· caller-content comparison' : '· reusable roots'} · {op.phase.replaceAll('-', ' ')}</summary>
        <p>{comparison ? 'Instance of the saved main' : `${op.counters.variants} ${initial ? 'initial-state' : 'root'} variants`} · {op.counters.variables} variables · {op.sourceCurrent ? 'saved plan matches current inputs' : 'saved plan differs from current inputs, or inputs are unavailable'}</p>
        {initial && op.phase === 'component-structure-observed' && <section aria-label="Native update review">
          <button type="button" disabled={busy} onClick={() => void action(`native-operation/${id}/update-plan`)}>Review compiler update</button>
          {row.updates?.map(update => <div key={update.id}>
            <p>Reviewed update: {update.changes.length} node opacity changes. Existing node identities are retained. {update.operation?.phase==='update-verified' ? 'A separate readback verified the corrected values and unchanged surrounding structure. Visual fidelity remains unqualified.' : 'Preparation does not change Figma. Connect the companion and apply the correction to inspect, update and independently read back these nodes.'}</p>
            {!!update.changes.length && <table style={{ borderSpacing: '12px 6px', textAlign: 'left' }}><thead><tr><th>Variant</th><th>Part</th><th>Saved opacity</th><th>Proposed opacity</th></tr></thead>
              <tbody>{update.changes.map(change => <tr key={change.nodeId}><td><a href={`https://www.figma.com/design/${row.fileKey}?node-id=${change.nodeId.replace(':','-')}`} target="_blank" rel="noreferrer">{change.variant}</a></td><td>{change.part}</td><td>{change.before}</td><td>{change.after}</td></tr>)}</tbody></table>}
            {!update.operation && <button type="button" disabled={busy} onClick={()=>void action(`native-operation/${id}/update/${update.id}/prepare`)}>Prepare reviewed correction</button>}
            {update.operation && <>
              <p>Update: {update.operation.phase.replaceAll('-',' ')}. {update.operation.sourceCurrent ? 'Pinned inputs match.' : 'Inputs changed or are unavailable; writes are blocked.'}</p>
              {!update.connection?.finished && <>
                <p>Use the current companion plugin in the authorized file. Connect using this update’s code.</p>
                <button type="button" disabled={busy} onClick={()=>void action(`native-operation/${id}/update/${update.id}/connection`,update.operation!.id)}>Get update connection code</button>
                {codes[update.operation.id] && <label>Update connection code <input readOnly value={codes[update.operation.id]} onFocus={e=>e.currentTarget.select()} /></label>}
                <p>{update.connection?.connected?'Companion connected for this update.':'Waiting for the update connection.'}</p>
                <button type="button" disabled={busy||!update.operation.sourceCurrent||!update.connection?.paired||update.connection.started} onClick={()=>void action(`native-operation/${id}/update/${update.id}/start`)}>Apply and verify correction</button>
              </>}
              {(update.operation.pendingPhase?.endsWith('readback') || ['update-verified','update-refused','update-recovery-required'].includes(update.operation.phase)) && <button type="button" disabled={busy} onClick={()=>void action(`native-operation/${id}/update/${update.id}/retry-observation`)}>Inspect update again</button>}
              {update.operation.pendingPhase==='update-apply' && <p>A write is awaiting its result. Keep the companion connected; this write will not be repeated automatically.</p>}
              {!!update.operation.problems.length && <ul>{update.operation.problems.map(p=><li key={p}>{p}</li>)}</ul>}
              {!!update.operation.imageObservation?.images.length && <details open><summary>Updated native exports · diagnostic only</summary>
                <p>Fresh exports of the same native nodes, shown without resizing. The original creation exports below remain historical evidence.</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:24}}>{update.operation.imageObservation.images.map(image=><figure key={image.caseId} style={{margin:0}}>
                  {row.initialStates?.filter(state=>'variant:'+state.variant===image.caseId).map(state=><div key={state.observation}>
                    <p>Original React · {state.variant}</p><img loading="lazy" alt={`Original for corrected state ${state.observation}`} style={{maxWidth:'none',backgroundColor:'white'}} src={`${root}/native-operation/${id}/initial-source/${state.observation}.png`} />
                  </div>)}
                  <figcaption>{image.caseId}</figcaption><div style={{padding:8,backgroundColor:'white',width:'max-content'}}><img loading="lazy" alt={`Updated native ${image.caseId}`} style={{maxWidth:'none',width:image.width,height:image.height}} src={`${root}/native-operation/${id}/update/${update.id}/images/${image.sha256}.png`} /></div>
                </figure>)}</div>
              </details>}
            </>}
          </div>)}
        </section>}
        <p>Target: <a href={`https://www.figma.com/design/${row.fileKey}`} target="_blank" rel="noreferrer">DS Contracts Evaluations</a>.</p>
        {!row.connection.finished && <>
          <p>Open the <a href="/ds-contracts-sync-runner-plugin.zip" download>DS Contracts companion plugin</a> in this file. Under “Connect the local source workflow,” enter the code and choose “Connect / resume.”</p>
          <button type="button" disabled={busy} onClick={() => void action(`native-operation/${id}/connection`, id)}>Get connection code</button>
          {codes[id] && <label>Connection code <input readOnly value={codes[id]} onFocus={e => e.currentTarget.select()} /></label>}
          <p>{row.connection.connected ? 'Companion plugin connected.' : 'Waiting for the companion plugin.'}</p>
          <button type="button" disabled={busy || !op.sourceCurrent || !row.connection.paired || row.connection.started}
            onClick={() => void action(`native-operation/${id}/start`)}>{comparison ? 'Create and inspect native comparison' : 'Create and inspect native draft'}</button>
        </>}
        {(op.pendingPhase?.endsWith('readback') || ['observation-refused', 'component-observation-refused', 'component-structure-observed'].includes(op.phase)) && <button type="button" disabled={busy}
          onClick={() => void action(`native-operation/${id}/retry-observation`)}>{op.pendingPhase ? 'Retry interrupted readback' : 'Inspect native draft again'}</button>}
        {op.nativeOutcome === 'unknown' && <p>The native outcome is unknown. Creation will not be repeated automatically.</p>}
        {op.structuralObservation && <p>Supported structure: {op.structuralObservation.status.replaceAll('-', ' ')}. Visual fidelity remains unverified.</p>}
        {row.kind === 'root' && !savedComparison && <button type="button" disabled={busy || !op.sourceCurrent || row.content?.phase === 'running'}
          onClick={() => void action(`native-operation/${id}/content`)}>Prepare caller-content comparison</button>}
        {row.kind === 'root' && row.content?.content?.status === 'compiled-comparison-draft' && <button type="button"
          disabled={busy || !!savedComparison || !op.sourceCurrent || op.phase !== 'component-structure-observed' || row.composition?.status !== 'ready' || !!row.compositionProblem}
          onClick={() => void action(`native-operation/${id}/comparison`)}>{savedComparison ? 'Comparison operation saved' : 'Prepare native comparison operation'}</button>}
        {row.compositionProblem && <p role="alert">{row.compositionProblem}</p>}
        {!!row.composition?.problems.length && <p role="alert">The captured source and compiled content do not have a verified correspondence. Composed output is unavailable until this is resolved.</p>}
        {!!row.composition?.denominator && <section aria-label="Nested component mapping">
          <h4>Nested component mapping</h4>
          <p>{row.composition.matched} of {row.composition.denominator} child instances matched to independently inspected native mains.
            {row.composition.status === 'incomplete' ? ' Resolve every required child before creating this composed comparison.' : ' Source mappings are ready; native creation and visual comparison remain separate checks.'}</p>
          <table><thead><tr><th>Child export</th><th>Source location</th><th>Native mapping</th></tr></thead>
            <tbody>{row.composition.rows.map(child => <tr key={child.instanceId}>
              <td>{child.exportName}</td><td>{child.sourcePaths.join(', ')}</td>
              <td>{child.status === 'matched' ? `Verified main · ${child.variantName}` : child.problems.map(compositionProblem).join(' ')}</td>
            </tr>)}</tbody></table>
        </section>}
        {row.content && <section aria-label="Caller-content preparation">
          <p>Content preparation: {row.content.phase}. {row.content.sourceUnchanged ? 'The original rendering and source files are unchanged.' : 'Source equivalence is not yet established.'}</p>
          {!!row.content.fontFamilies?.length && <p>Observed text fonts: {row.content.fontFamilies.join(', ')}.</p>}
          {row.content.content && <p>{row.content.content.status === 'compiled-comparison-draft'
            ? 'Caller content compiled for comparison. Review the separate native comparison operation when prepared; visual fidelity remains unverified.'
            : 'Caller content has unsupported facts that prevent native comparison.'} Reusable main slots remain empty.</p>}
          {[...row.content.problems, ...(row.content.content?.problems ?? [])].length > 0 && <ul>{[...row.content.problems, ...(row.content.content?.problems ?? [])].map((p, i) => <li key={i}>{p}</li>)}</ul>}
        </section>}
        {op.problems.length > 0 && <ul>{op.problems.map(p => <li key={p}>{p}</li>)}</ul>}
        {!!op.imageObservation?.images.length && <details open={comparison || initial}><summary>{initial ? 'Native initial-state exports' : comparison ? 'Native caller-content export' : 'Native root exports'} · diagnostic only</summary>
          <p>{initial ? 'These are observed initial-state mains. Original and native pixels are shown without resizing. Structure and image presence do not qualify visual fidelity or runtime behavior.' : comparison ? 'This export comes from the saved native instance with caller content. Image presence alone does not establish visual fidelity.' : 'These are empty component mains. They are not comparisons against the caller’s content or a passing fidelity result.'}</p>
          {comparison && <>
            {!row.sourceFrame && <button type="button" disabled={busy || !op.sourceCurrent}
              onClick={() => void action(`native-operation/${row.parentOperationId}/source-frame`)}>Measure original comparison frame</button>}
            {row.sourceFrameProblem && <p role="alert">{row.sourceFrameProblem}</p>}
            <p>{row.sourceFrame ? 'Original pixels cropped around independently measured source bounds, with up to 8 px of surrounding context. Both images use 1 image pixel per CSS pixel on white surfaces; no resizing or best-fit alignment.' : 'The original includes its browser stage. Measure its frame for an unscaled component comparison.'} <a href={`${root}/native-operation/${row.parentOperationId}/source.png`} target="_blank" rel="noreferrer">Open full original</a></p>
          </>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
          {comparison && <figure style={{ margin: 0, maxWidth: '100%', overflow: 'auto' }}>
            <figcaption>Original React · unchanged source{row.sourceFrame && <><br />Layout: {row.sourceFrame.bounds.width.toFixed(2)} × {row.sourceFrame.bounds.height.toFixed(2)} px</>}</figcaption>
            <img alt={`Original React ${row.caseId}`} style={{ maxWidth: 'none', backgroundColor: 'white', ...(row.sourceFrame ? { width: row.sourceFrame.crop.width, height: row.sourceFrame.crop.height } : {}) }}
              src={`${root}/native-operation/${row.parentOperationId}/${row.sourceFrame ? `source-frame/${row.sourceFrame.imageSha256}.png` : 'source.png'}`} />
          </figure>}
          {op.imageObservation.images.map(image => <figure key={image.caseId} style={{ margin: 0, maxWidth: '100%', overflow: 'auto' }}>
            {initial && row.initialStates?.filter(state => 'variant:' + state.variant === image.caseId).map(state => <div key={state.observation}>
              <p>Original React · {state.variant}</p>
              <img loading="lazy" style={{ maxWidth: 'none', backgroundColor: 'white' }} alt={`Original state ${state.observation}`}
                src={`${root}/native-operation/${id}/initial-source/${state.observation}.png`}
                onError={() => setError('A pinned original state image could not be verified or loaded. Reload unchanged originals before reviewing this comparison.')} />
            </div>)}
            <figcaption>Native {image.caseId}{image.layoutSize && <><br />Layout: {image.layoutSize.width.toFixed(2)} × {image.layoutSize.height.toFixed(2)} px</>}</figcaption>
            <div style={{ padding: comparison || initial ? 8 : 0, width: 'max-content', backgroundColor: 'white' }}><img loading="lazy" style={{ maxWidth: 'none', width: image.width, height: image.height }} alt={`Native ${initial ? 'initial state' : comparison ? 'comparison' : 'root'} ${image.caseId}`} src={`/api/source-reference/native/${id}/images/${op.imageObservation!.attemptId}/${image.sha256}.png`} /></div>
          </figure>)}
          </div>
        </details>}
      </details>;
    })}
  </section>;
}


function compositionProblem(code: string): string {
  const messages: Record<string, string> = {
    'react-composition-runtime-or-multiple-root-unqualified': 'Runtime-owned content or multiple roots still need a supported mapping.',
    'react-composition-compiler-path-unavailable': 'The observed child has no unambiguous native content node.',
    'react-composition-main-ambiguous': 'Several verified mains match this export; selection is unresolved.',
    'react-composition-main-not-verified': 'Create and independently inspect this child’s native main.',
    'react-composition-main-readback-invalid': 'Inspect the child’s native main again before using it.',
    'react-composition-held-inputs-differ': 'This usage supplies inputs outside the child’s observed property matrix.',
    'react-composition-observed-root-context-differs': 'This child’s styling differs in its parent context; the standalone main cannot be reused yet.',
    'react-composition-variant-unavailable': 'The child’s observed property values have no verified native variant.',
    'react-composition-root-slot-unavailable': 'The child needs one supported editable content slot.',
  };
  return messages[code] ?? 'The child’s source properties need a supported mapping.';
}
