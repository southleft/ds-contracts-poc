import { nativeImageFraming } from '../native-image-framing';
import type { ReactCompositionReview } from '../../../source-reference/react-composition';
import { useEffect, useState } from 'react';
import { ReactCallerCompositionReview } from './ReactCallerCompositionReview';
import type { NativeOperationSnapshot } from '../../../source-reference/native-operation-jobs';
import type { ReactOwnershipReport } from '../../../source-reference/react-ownership-run';
import type { ReactContentInspection } from '../../../source-reference/react-content-inspection';
import type { SourceFrame } from '../../../source-reference/source-framing';
import type { SourceTypography } from '../../../source-reference/react-source-framing';
import { ReactCallbackInspection } from './ReactCallbackInspection';
import { ReactInitialInspection } from './ReactInitialInspection';
import type { createNativeUpdateJobs } from '../../../source-reference/native-update-jobs';
import type { NativeContractUpdatePlan } from '../../../core/native-contract-update';

function correctionValue(value: NativeContractUpdatePlan['changes'][number]['before'] | NativeContractUpdatePlan['changes'][number]['after']) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number(value.toFixed(4));
  if (!value.length) return 'No shadows';
  return <ol>{value.map((effect,index)=><li key={index}>
    {effect.type==='INNER_SHADOW'?'Inner':'Outer'} shadow: offset {effect.offset.x}, {effect.offset.y} px;
    blur {effect.radius} px; spread {effect.spread} px;
    color rgb({[effect.color.r,effect.color.g,effect.color.b].map(c=>Math.round(c*255)).join(', ')}), {Math.round(effect.color.a*100)}% opacity
  </li>)}</ol>;
}

/** An existing native operation for one of these source cases that still
 * follows another revision of the source. */
interface MovedOperation { operationId: string; caseId: string; kind: 'root' | 'initial'; followedReferenceId: string; fileKey: string; phase: string; successionProblem?: string }
function updateProblem(problem: string) {
  const [name, ...node] = problem.split(':'), nodeId = node.join(':');
  if (name === 'native-update-observation-refused') return 'The canvas did not match what this update expected. Nothing further was written.';
  if (name === 'native-update-write-begun-outcome-unresolved') return 'The companion had begun this write, but the canvas still shows the earlier values. It may still land. Nothing is retried; inspect again once the companion has settled.';
  if (name === 'native-update-late-write-result-contradicts-canvas') return 'A result arrived for a write that was already settled from the canvas, and it disagrees with that reading. Inspect the update again before anything else is applied.';
  if (name === 'native-update-write-ran-without-begin') return 'A companion older than this app executed a write without asking. Close every open companion window and reopen the plugin, then inspect this update again.';
  if (name === 'native-update-baseline-conflict') return 'Another property of these components changed in Figma after the last verified readback. Restore it, or review it as a design change, then inspect again.';
  if (name === 'native-update-node-missing') return `Node ${nodeId} no longer exists in the file.`;
  if (name === 'native-update-file-mismatch') return 'The companion is connected to a different Figma file.';
  if (name.endsWith('-conflict')) return `${nodeId ? `Node ${nodeId}: t` : 'T'}he property this update changes holds a value that is neither the saved value nor the proposed value. It was edited in Figma; this update will not overwrite it.`;
  return problem;
}
interface Operation {
  kind: 'root' | 'comparison' | 'initial' | 'nested'; sourceRevisions?: string[]; successionProblem?: string;
  initialStates?: Array<{ observation: string; variant: string; frame?: SourceFrame }>; parentOperationId?: string; sourceOperationId?: string;
  updates?: Array<{ id: string; status: 'planned'; changes: NativeContractUpdatePlan['changes'];
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
  const [moved, setMoved] = useState<MovedOperation[]>([]), [reviewed, setReviewed] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [codes, setCodes] = useState<Record<string, string>>({});
  const [typography, setTypography] = useState<Record<string, SourceTypography>>({});
  const root = `/api/source-reference/react/${referenceId}`;
  const active = rows.some(r => (r.connection.paired && r.connection.started && !r.connection.finished) || r.content?.phase === 'running' ||
    r.updates?.some(u => u.connection?.paired && u.connection.started && !u.connection.finished));
  useEffect(() => {
    let stopped = false, pending = false;
    const load = async () => {
      if (pending) return; pending = true; setLoading(true);
      try {
        const response = await fetch(`${root}/native`), result = await response.json();
        if (!response.ok) throw Error(result.error);
        if (!stopped) { setRows(result.operations); setMoved(result.moved ?? []); setError(''); }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : String(e)); }
      finally { pending = false; if (!stopped) setLoading(false); }
    };
    void load();
    const timer = active ? setInterval(() => void load(), 4000) : undefined;
    return () => { stopped = true; if (timer) clearInterval(timer); };
  }, [root, active]);
  async function inspectTypography(parentId: string, key: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`${root}/native-operation/${parentId}/source-typography`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setTypography(old => ({ ...old, [key]: result.typography }));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function action(route: string, id?: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`${root}/${route}`, { method: 'POST' }), result = await response.json();
      if (!response.ok) throw Error(result.reason ? `${result.error} Refused by: ${result.reason}` : result.error);
      if (result.connection && id) {
        setCodes(old => ({ ...old, [id]: result.connection }));
        const refreshed = await fetch(`${root}/native`), snapshot = await refreshed.json();
        if (!refreshed.ok) throw Error(snapshot.error);
        setRows(snapshot.operations); setMoved(snapshot.moved ?? []);
      } else {
        const review = /^native-operation\/([a-f0-9-]{36})\/update-plan$/.exec(route);
        if (review) {
          // A repeat review that plans nothing reopens the verified correction.
          const ids = (list: Operation[]) => (list.find(r => r.operation.id === review[1])?.updates ?? []).map(u => u.id).join();
          const after: Operation[] = result.operations, tip = after.find(r => r.operation.id === review[1])?.updates?.some(u => u.operation?.phase === 'update-verified' && u.operation.sourceCurrent && !u.operation.superseded);
          setReviewed(old => ({ ...old, [review[1]]: ids(rows) === ids(after) && tip ? 'Reviewed again: the current source and compiler plan no further changes. The verified correction below stands and nothing was prepared or written.' : '' }));
        }
        setRows(result.operations); setMoved(result.moved ?? []);
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  const selected = ownership?.rows.find(r => r.id === selectedCase);
  const ready = ownership?.state === 'complete' && ownership.sourceUnchanged && selected?.matched && selected.rootMatrix?.draft?.status === 'native-compiled';
  const selectedMatrix = ownership?.rows.find(row => row.id === selectedCase)?.rootMatrix;
  const reusableRoot = selectedMatrix && rows.find(row => row.kind === 'root' && row.caseId !== selectedCase &&
    (row.operation.sourceCurrent || row.updates?.some(update => update.operation?.phase === 'update-verified' && update.operation.sourceCurrent)) &&
    JSON.stringify(ownership?.rows.find(source => source.id === row.caseId)?.rootMatrix) === JSON.stringify(selectedMatrix));
  return <section className="react-native-inspection">
    <h3>Inspect editable Figma roots</h3>
    <p>Create a native draft from the observed root styles and properties. Its content slot stays empty and editable.
      Prepare separate caller-content instances for comparison below. Visual fidelity, stateful behavior and the complete composed component remain unqualified.</p>
    {loading && <p role="status">{rows.length ? 'Refreshing saved Figma inspections…' : 'Loading saved Figma inspections…'}</p>}
    {reusableRoot ? <>
      <p>This case uses the same observed component family as {reusableRoot.caseId}. Compare its content using that existing native main.</p>
      <button type="button" disabled={busy || loading || !ready}
        onClick={() => void action(`native-operation/${reusableRoot.operation.id}/compare-case/${selectedCase}`)}>
        {busy ? 'Preparing comparison…' : `Compare ${selectedCase} using existing main`}
      </button>
    </> : <button type="button" disabled={busy || loading || !ready} onClick={() => void action(`native/${selectedCase}`)}>
      Prepare {selectedCase} for Figma
    </button>}
    {!ready && <p>Complete a matching structure observation with a compiled root draft for the selected case first.</p>}
    {moved.map(m => <section key={m.operationId} aria-label="Existing native component from another source revision">
      <p>An existing native {m.kind === 'initial' ? 'initial-state set' : 'root family'} for <strong>{m.caseId}</strong> follows another revision of this source ({m.followedReferenceId.slice(0, 8)}…). Following the current source keeps that operation, its Figma nodes and its verified corrections, and writes nothing to Figma. Afterwards, <em>Review compiler update</em> shows what the source change would alter on those same nodes. Preparing the case again instead would create a second component.</p>
      {m.successionProblem && <p role="alert">Its source-succession record cannot be read, so it cannot follow this source until that is repaired. Do not prepare this case again: that would create a second component. <code>{m.successionProblem}</code></p>}
      <button type="button" disabled={busy || loading || !!m.successionProblem} onClick={() => void action(`native-operation/${m.operationId}/adopt-source`)}>Follow the current source with the existing {m.caseId} {m.kind === 'initial' ? 'states' : 'roots'}</button>
    </section>)}
    {error && <p role="alert">{error}</p>}
    <ReactCallbackInspection key={referenceId + ':' + selectedCase} referenceId={referenceId} caseId={selectedCase} available={rows.some(r => r.kind === 'root' && r.operation.sourceCurrent)} />
    <ReactInitialInspection referenceId={referenceId} caseId={selectedCase} available={rows.some(r => r.kind === 'root' && r.operation.sourceCurrent)} nativeSaved={rows.some(r => r.kind === 'initial' && r.caseId === selectedCase)} nativeBusy={busy} prepareNative={() => void action(`native-initial/${selectedCase}`)} />
    {rows.map(row => {
      const op = row.operation, id = op.id, comparison = row.kind === 'comparison', initial = row.kind === 'initial';
      const savedComparison = rows.find(r => r.parentOperationId === id && r.caseId === row.caseId);
      const corrected = row.updates?.some(update => update.operation?.phase === 'update-verified' && update.operation.sourceCurrent);
      const currentProblems = op.problems.filter(problem => !corrected || problem !== 'native-operation-source-evidence-unavailable');
      return <details key={id} open={row.caseId === selectedCase}>
        <summary>{row.kind === 'nested' ? `${op.componentName ?? 'Nested component'} · observed child root` : `${row.caseId} ${initial ? '· observed initial states' : comparison ? '· caller-content comparison' : '· reusable roots'}`} · {op.phase.replaceAll('-', ' ')}</summary>
        {row.kind === 'nested' && <p>This main covers the captured child inputs. {op.sourceOwnedContent ? 'It retains the component’s own internal content.' : 'Its caller-content slot remains empty.'} Other properties, behavior and visual fidelity remain unqualified.</p>}
        {comparison && op.comparisonWidth !== undefined && <p>This comparison uses the original caller’s declared {op.comparisonWidth} px width. The reusable main keeps its own sizing rules.</p>}
        <p>{comparison ? 'Instance of the saved main' : `${op.counters.variants} ${initial ? 'initial-state' : 'root'} variants`} · {op.counters.variables} variables · {corrected ? 'verified correction matches current inputs; original creation retained below' : op.sourceCurrent ? 'saved plan matches current inputs' : 'saved plan differs from current inputs, or inputs are unavailable'}</p>
        {op.comparisonBaselineRefreshed && <p>This read-only inspection checks the retained instance against verified main corrections. Original creation records and node identities are preserved.</p>}
        {op.sourceCompilerRecompiled && <p>This new draft uses the current compiler with the unchanged, verified source observations. The original capture remains intact. This prepared output is pinned before creation; existing Figma operations are not replaced.</p>}
        {op.sourceCompatibility === 'identity-opacity-omission' && <p>Saved comparison recovered. Its fully opaque source still matches the original output.</p>}
        {row.successionProblem && <p role="alert">This operation's source-succession record cannot be read, so its updates are refused until that is repaired. <code>{row.successionProblem}</code></p>}
        {(row.sourceRevisions?.length ?? 0) > 1 && <p>This operation has followed {row.sourceRevisions!.length} source revisions ({row.sourceRevisions!.map(r => r.slice(0, 8)).join(' → ')}). Its creation evidence belongs to the first; changes since then arrive only as reviewed updates to the same nodes. Content and comparison inspections recorded against an earlier revision are unavailable here.</p>}
        {!comparison && ['component-structure-observed','component-observation-refused'].includes(op.phase) && <section aria-label="Native update review">
          <button type="button" disabled={busy} onClick={() => void action(`native-operation/${id}/update-plan`)}>Review compiler update</button>
          {reviewed[id] && <p role="status">{reviewed[id]}</p>}
          {row.updates?.map(update => <div key={update.id}>
            <p>Reviewed update: {update.changes.length} property corrections. Existing node identities are retained. {update.changes.some(c=>'channel' in c&&c.channel==='background-clip')&&'This migration adds an editable background layer to each listed component and preserves its content slot.'} {update.operation?.phase==='update-verified' ? 'A separate readback verified the corrected values and unchanged surrounding structure. Visual fidelity remains unqualified.' : 'Preparation does not change Figma. Connect the companion and apply the correction to inspect, update and independently read back these nodes.'}</p>
            {!!update.changes.length && <table style={{ borderSpacing: '12px 6px', textAlign: 'left' }}><thead><tr><th>Variant</th><th>Part</th><th>Property</th><th>Saved value</th><th>Proposed value</th></tr></thead>
              <tbody>{update.changes.map(change => <tr key={change.nodeId + ':' + ('channel' in change ? change.channel : 'opacity')}><td><a href={`https://www.figma.com/design/${row.fileKey}?node-id=${change.nodeId.replace(':','-')}`} target="_blank" rel="noreferrer">{change.variant}</a></td><td>{change.part}</td><td>{'channel' in change ? change.channel==='unrequested-fill'?'Unrequested root paint':change.channel==='effects'?'Shadow stack':change.channel==='strokeWeight'?'Stroke width (px)':change.channel==='background-clip'?'Background paint area':change.channel : 'opacity'}</td><td>{correctionValue(change.before)}</td><td>{correctionValue(change.after)}</td></tr>)}</tbody></table>}
            {!update.operation && <button type="button" disabled={busy} onClick={()=>void action(`native-operation/${id}/update/${update.id}/prepare`)}>Prepare reviewed correction</button>}
            {update.operation && <>
              <p>Update: {update.operation.phase.replaceAll('-',' ')}. {update.operation.superseded ? 'Historical correction. Its result is preserved in a later correction chain.' : update.operation.sourceCurrent ? 'Pinned inputs match.' : update.operation.canRefreshObservation ? 'Pinned inputs match. Inspect again with the current reader to restore verification; the original write will not be repeated.' : 'Inputs changed or are unavailable; writes are blocked.'}</p>
              {!update.connection?.finished && <>
                <p>Use the current companion plugin in the authorized file. Connect using this update’s code.</p>
                <button type="button" disabled={busy} onClick={()=>void action(`native-operation/${id}/update/${update.id}/connection`,update.operation!.id)}>Get update connection code</button>
                {codes[update.operation.id] && <label>Update connection code <input readOnly value={codes[update.operation.id]} onFocus={e=>e.currentTarget.select()} /></label>}
                <p>{update.connection?.connected?'Companion connected for this update.':'Waiting for the update connection.'}</p>
                <button type="button" disabled={busy||!update.operation.sourceCurrent||!update.connection?.paired||update.connection.started} onClick={()=>void action(`native-operation/${id}/update/${update.id}/start`)}>Apply and verify correction</button>
              </>}
              {!update.operation.superseded && (update.operation.pendingPhase?.endsWith('readback') || ['update-verified','update-refused','update-recovery-required'].includes(update.operation.phase)) && <button type="button" disabled={busy} onClick={()=>void action(`native-operation/${id}/update/${update.id}/retry-observation`)}>Inspect update again</button>}
              {update.operation.unresolvedWrite==='awaiting-result' && <>
                <p>A write is awaiting its result. Keep the companion connected: a saved result is delivered when it reconnects. If the result is lost, settle it by reading the canvas. That write is never sent again, and the companion is refused permission to begin it from then on.</p>
                <button type="button" disabled={busy||!update.connection?.paired} onClick={()=>void action(`native-operation/${id}/update/${update.id}/resolve-write`)}>Resolve by reading the canvas</button>
              </>}
              {update.operation.unresolvedWrite==='reading-canvas' && <p>Reading the actual nodes to settle an interrupted write. If the values were written, verification continues. If nothing changed and the companion never began the write, the update stops and waits for your decision. Anything else needs recovery.</p>}
              {update.operation.phase==='update-write-untouched' && <>
                <p>The interrupted write never began and did not reach the canvas. It is closed. Nothing further is sent unless you choose to: sending again runs a fresh preflight and then <strong>a new write</strong> under its own claim.</p>
                <button type="button" disabled={busy||!update.operation.sourceCurrent} onClick={()=>void action(`native-operation/${id}/update/${update.id}/rearm-write`)}>Preflight again and send a new write</button>
              </>}
              {!!update.operation.problems.length && <ul>{update.operation.problems.map(p=><li key={p}>{updateProblem(p)} <code>{p}</code></li>)}</ul>}
              {!!update.operation.imageObservation?.images.length && <details open><summary>Updated native exports · diagnostic only</summary>
                <p>Fresh exports of the same native nodes at original pixel scale. Recorded source and native layout origins align when export bounds are available; missing geometry remains unaligned. The original creation exports below remain historical evidence.</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:24}}>{update.operation.imageObservation.images.map(image=><figure key={image.caseId} style={{margin:0}}>
                  {row.initialStates?.filter(state=>'variant:'+state.variant===image.caseId).map(state=><div key={state.observation}>
                    <p>Original React · {state.variant}</p><div style={{...nativeImageFraming(state.frame,image).source,backgroundColor:'white',width:'max-content'}}><img loading="lazy" alt={`Original for corrected state ${state.observation}`} style={{display:'block',maxWidth:'none',backgroundColor:'white',...(state.frame?{width:state.frame.crop.width,height:state.frame.crop.height}:{})}} src={`${root}/native-operation/${id}/initial-source/${state.observation}.png`} /></div>
                  </div>)}
                  <figcaption>{image.caseId}{initial && <><br />{image.layoutOffset && row.initialStates?.some(state=>'variant:'+state.variant===image.caseId && state.frame) ? 'Layout origins aligned from recorded bounds' : 'Layout alignment unavailable; verified source and native export bounds are required'}</>}</figcaption><div style={{padding:8,...nativeImageFraming(row.initialStates?.find(state=>'variant:'+state.variant===image.caseId)?.frame,image).native,backgroundColor:'white',width:'max-content'}}><img loading="lazy" alt={`Updated native ${image.caseId}`} style={{display:'block',maxWidth:'none',width:image.width,height:image.height}} src={`${root}/native-operation/${id}/update/${update.id}/images/${image.sha256}.png`} /></div>
                </figure>)}</div>
              </details>}
            </>}
          </div>)}
        </section>}
        <p>Target: <a href={`https://www.figma.com/design/${row.fileKey}`} target="_blank" rel="noreferrer">DS Contracts Evaluations</a>.</p>
        {(!row.connection.finished || op.canResumeComparison || op.comparisonRepair) && <>
          <p>Open the <a href="/ds-contracts-sync-runner-plugin.zip" download>DS Contracts companion plugin</a> in this file. Under “Connect the local source workflow,” enter the code and choose “Connect / resume.”</p>
          <button type="button" disabled={busy} onClick={() => void action(`native-operation/${id}/connection`, id)}>Get connection code</button>
          {codes[id] && <label>Connection code <input readOnly value={codes[id]} onFocus={e => e.currentTarget.select()} /></label>}
          <p>{row.connection.connected ? 'Companion plugin connected.' : 'Waiting for the companion plugin.'}</p>
          <button type="button" disabled={busy || !op.sourceCurrent || !row.connection.paired || row.connection.started}
            onClick={() => void action(`native-operation/${id}/start`)}>{comparison ? 'Create and inspect native comparison' : 'Create and inspect native draft'}</button>
        </>}
        {op.comparisonRepair && <section aria-label="Repair retained comparison">
          <p>The independent readback found supported corrections to the retained comparison. The app will check the same nodes, source mains and tokens again before applying these changes.</p>
          <ul>{op.comparisonRepair.changes.map((change,index)=><li key={index}>{change.kind==='height'
            ? `Restore the main’s height binding: ${change.before} → ${change.after} px.`
            : change.kind==='metadata' ? 'Reconcile the inherited background layer and existing content identities with the verified main.' : change.kind==='comparison-clipping' ? 'Allow outer shadows beyond the comparison frame; preserve clipping inside the component.' : 'Remove an extra variable mode from a descendant to match its main.'}</li>)}</ul>
          <button type="button" disabled={busy || !row.connection.paired}
            onClick={() => void action(`native-operation/${id}/repair-comparison`)}>Verify and repair comparison</button>
        </section>}
        {op.canResumeComparison && <section aria-label="Resume retained comparison">
          <p>The retained instance is empty. Recovery will inspect its ownership, source mains and tokens, then continue in the same instance if they still match. Original creation evidence stays intact.</p>
          <button type="button" disabled={busy || !row.connection.paired}
            onClick={() => void action(`native-operation/${id}/resume-comparison`)}>Inspect and resume retained comparison</button>
        </section>}
        {!corrected && (op.pendingPhase?.endsWith('readback') || ['observation-refused', 'component-observation-refused', 'component-structure-observed'].includes(op.phase)) && <button type="button" disabled={busy}
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
              <td>{child.status === 'matched' ? `Verified main · ${child.variantName}` : child.problems.map(compositionProblem).join(' ')}
                {child.preparationProblem && <p>The child’s root layout or content cannot yet be represented as an editable native main.</p>}
                {child.canPrepareMain && <button type="button" disabled={busy || !op.sourceCurrent}
                  onClick={() => void action(`native-operation/${id}/child/${child.instanceId}`)}>Prepare {child.exportName} main</button>}
              </td>
            </tr>)}</tbody></table>
        </section>}
        {row.content && <section aria-label="Caller-content preparation">
          <p>Content preparation: {row.content.phase}. {row.content.sourceUnchanged ? 'The original rendering and source files are unchanged.' : 'Source equivalence is not yet established.'}</p>
          {!!row.content.fontFamilies?.length && <p>Observed text fonts: {row.content.fontFamilies.join(', ')}.</p>}
          {row.kind === 'root' && row.content.phase === 'complete' && row.content.sourceUnchanged && !row.content.labelAssociations &&
            <button type="button" disabled={busy} onClick={() => void action(`native-operation/${id}/content`)}>Read source label relationships</button>}
          {row.content.labelAssociations ? (row.content.labelAssociations.status === 'observed'
            ? <details><summary>Source label relationships · {row.content.labelAssociations.rows.length}</summary>
              <p>These are browser-verified relationships within this caller composition. Generated associations, reusable IDs and native property mappings remain unqualified.</p>
              <table style={{borderSpacing:'12px 6px',textAlign:'left'}}><thead><tr><th>Label</th><th>Control</th><th>Association</th></tr></thead><tbody>
                {row.content.labelAssociations.rows.map(label => <tr key={label.labelPath}><td>{label.text}</td><td>{label.controlTag} · {label.controlPath || 'root'}</td><td>{label.mode === 'explicit' ? `Explicit ID: ${label.sourceId}` : 'Control inside label'}</td></tr>)}
              </tbody></table>
            </details>
            : <p>Source label relationships could not be carried within this composition: {row.content.labelAssociations.problems.join(', ')}.</p>)
            : <p>Label relationships were not recorded in this saved preparation.</p>}
          {row.kind === 'root' && row.content.phase === 'complete' && row.content.sourceUnchanged && row.content.labelAssociations?.status === 'observed' &&
            <ReactCallerCompositionReview key={id} root={root} operationId={id} />}
          {row.content.gridConstraints && (row.content.gridConstraints.status === 'observed'
            ? !!row.content.gridConstraints.rows.length && <details><summary>Source grid constraints · {row.content.gridConstraints.rows.length} grids</summary>
              <p>Current CSS constraints and rendered track sizes are shown separately. These observations do not qualify native conversion or other content and viewport combinations.</p>
              {row.content.gridConstraints.rows.map(grid => <section key={grid.path} aria-label={`Grid at ${grid.path || 'root'}`}>
                <h4>{row.composition?.rows.find(child => child.sourcePaths.includes(grid.path))?.exportName ?? 'Source element'} · {grid.path || 'root'}</h4>
                <div style={{overflowX:'auto'}}><table style={{borderSpacing:'12px 6px',textAlign:'left'}}><thead><tr><th scope="col">Constraint</th><th scope="col">Computed CSS</th><th scope="col">Rendered value</th></tr></thead>
                  <tbody>{Object.entries(grid.computed).map(([channel, value]) => <tr key={channel}><th scope="row">{channel}</th><td>{value}</td><td>{grid.used[channel as keyof typeof grid.used]}</td></tr>)}</tbody></table></div>
              </section>)}
            </details>
            : <p role="alert">Source grid constraints could not be verified: {row.content.gridConstraints.problems.join(', ')}.</p>)}
          {row.content.content && <p>{row.content.content.status === 'compiled-comparison-draft'
            ? 'Caller content compiled for comparison. Review the separate native comparison operation when prepared; visual fidelity remains unverified.'
            : 'Caller content has unsupported facts that prevent native comparison.'} Reusable main slots remain empty.</p>}
          {[...row.content.problems, ...(row.content.content?.problems ?? [])].length > 0 && <ul>{[...row.content.problems, ...(row.content.content?.problems ?? [])].map((p, i) => <li key={i}>{p}</li>)}</ul>}
        </section>}
        {currentProblems.length > 0 && <ul>{currentProblems.map(p => <li key={p}>{p}</li>)}</ul>}
        {!!op.imageObservation?.images.length && <details open={comparison || initial}><summary>{initial ? 'Native initial-state exports' : comparison ? 'Native caller-content export' : 'Native root exports'} · diagnostic only</summary>
          <p>{initial ? 'These are observed initial-state mains. Original and native pixels are shown without resizing. Structure and image presence do not qualify visual fidelity or runtime behavior.' : comparison ? 'This export comes from the saved native instance with caller content. Image presence alone does not establish visual fidelity.' : op.sourceOwnedContent ? 'These mains retain the component’s own observed internal content. Other inputs, runtime interactions and visual fidelity remain unqualified.' : 'These are empty component mains. They are not comparisons against the caller’s content or a passing fidelity result.'}</p>
          {comparison && <>
            {!row.sourceFrame && <button type="button" disabled={busy || !op.sourceCurrent}
              onClick={() => void action(`native-operation/${row.sourceOperationId ?? row.parentOperationId}/source-frame`)}>Measure original comparison frame</button>}
            {row.sourceFrameProblem && <p role="alert">{row.sourceFrameProblem}</p>}
            <p>{row.sourceFrame ? 'Original pixels cropped around independently measured source bounds, with up to 8 px of surrounding context. Both images use 1 image pixel per CSS pixel on white surfaces. Where native render bounds are available, layout origins align from geometry; no resizing or best-fit alignment.' : 'The original includes its browser stage. Measure its frame for an unscaled component comparison.'} <a href={`${root}/native-operation/${row.sourceOperationId ?? row.parentOperationId}/source.png`} target="_blank" rel="noreferrer">Open full original</a></p>
          </>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
          {comparison && <figure style={{ margin: 0, maxWidth: '100%', overflow: 'auto' }}>
            <figcaption>Original React · unchanged source{row.sourceFrame && <><br />Layout: {row.sourceFrame.bounds.width.toFixed(2)} × {row.sourceFrame.bounds.height.toFixed(2)} px</>}</figcaption>
            <div style={{...nativeImageFraming(row.sourceFrame,op.imageObservation?.images[0]).source,width:'max-content',backgroundColor:'white'}}><img alt={`Original React ${row.caseId}`} style={{ maxWidth: 'none', backgroundColor: 'white', ...(row.sourceFrame ? { width: row.sourceFrame.crop.width, height: row.sourceFrame.crop.height } : {}) }}
              src={`${root}/native-operation/${row.sourceOperationId ?? row.parentOperationId}/${row.sourceFrame ? `source-frame/${row.sourceFrame.imageSha256}.png` : 'source.png'}`} /></div>
          </figure>}
          {op.imageObservation.images.map(image => <figure key={image.caseId} style={{ margin: 0, maxWidth: '100%', overflow: 'auto' }}>
            {initial && row.initialStates?.filter(state => 'variant:' + state.variant === image.caseId).map(state => <div key={state.observation}>
              <p>Original React · {state.variant}</p>
              <div style={{...nativeImageFraming(state.frame,image).source,width:'max-content',backgroundColor:'white'}}><img loading="lazy" style={{ display: 'block', maxWidth: 'none', backgroundColor: 'white', ...(state.frame ? {width:state.frame.crop.width,height:state.frame.crop.height} : {}) }} alt={`Original state ${state.observation}`}
                src={`${root}/native-operation/${id}/initial-source/${state.observation}.png`}
                onError={() => setError('A pinned original state image could not be verified or loaded. Reload unchanged originals before reviewing this comparison.')} /></div>
            </div>)}
            <figcaption>Native {image.caseId}{image.layoutSize && <><br />Layout: {image.layoutSize.width.toFixed(2)} × {image.layoutSize.height.toFixed(2)} px</>}</figcaption>
            <div style={{ padding: comparison || initial ? 8 : 0, ...(comparison || initial ? nativeImageFraming(initial ? row.initialStates?.find(state=>'variant:'+state.variant===image.caseId)?.frame : row.sourceFrame,image).native : {}), width: 'max-content', backgroundColor: 'white' }}><img loading="lazy" style={{ maxWidth: 'none', width: image.width, height: image.height }} alt={`Native ${initial ? 'initial state' : comparison ? 'comparison' : 'root'} ${image.caseId}`} src={`/api/source-reference/native/${id}/images/${op.imageObservation!.attemptId}/${image.sha256}.png`} /></div>
          </figure>)}
          </div>
          {comparison && op.sourceCurrent && op.imageObservation.attemptId && <details>
            <summary>Compare text measurements</summary>
            <p>Matching font names do not prove matching font versions. This diagnostic compares browser text advances with native text-box widths. Wrapping, box sizing and renderer rounding can also differ; it does not grade fidelity or change either output.</p>
            <button type="button" disabled={busy} onClick={() => void inspectTypography((row.sourceOperationId ?? row.parentOperationId)!, `${referenceId}/${id}/${op.imageObservation!.attemptId}`)}>Measure original text</button>
            {typography[`${referenceId}/${id}/${op.imageObservation.attemptId}`]?.rows.map((text,index) => {
              const measured = typography[`${referenceId}/${id}/${op.imageObservation!.attemptId}`];
              const matches = op.imageObservation!.images.flatMap(image => image.textBoxes ?? []).filter(box => box.text === text.text);
              const native = matches.length === 1 && measured.rows.filter(row => row.text === text.text).length === 1 ? matches[0] : undefined;
              return <section key={index} aria-label={`Text measurement: ${text.text}`}>
                <h4>{text.text}</h4>
                <p>Original: {text.family} · {text.face} · {text.size} · weight {text.weight}. Text advance: {text.width.toFixed(2)} px · {text.lines} line rectangle(s).</p>
                {native ? <p>Native: {native.family} · {native.style} · {native.size} px. Text box: {native.width.toFixed(2)} px.{text.lines === 1 ? ` Difference: ${(native.width-text.width).toFixed(2)} px.` : ' Wrapped text is not a single-line width comparison.'}</p>
                  : <p>No unique native text match; repeated or missing strings require a structural mapping.</p>}
              </section>;
            })}
          </details>}
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
    'react-composition-context-main-not-verified': 'No inspected main matches this child’s exact inputs and source styling.',
    'react-composition-declared-size-not-preserved': 'The inspected main does not retain a source-declared dimension. Correct its sizing before composing it.',
    'react-composition-observed-subtree-context-differs': 'The complete child differs from its observed initial state in this parent context. Inspect this usage before reusing the main.',
    'react-composition-initial-main-observation-stale': 'A saved initial-state main exists, but its current verification is unavailable. Recover its readback before reusing it.',
    'react-composition-content-ownership-differs': 'The inspected main does not match how this child owns its content.',
    'react-comparison-variant-type-unqualified': 'This child’s property type has no supported native variant mapping.',
    'react-composition-observed-root-context-differs': 'This child’s styling differs in its parent context; the standalone main cannot be reused yet.',
    'react-composition-variant-unavailable': 'The child’s observed property values have no verified native variant.',
    'react-composition-root-slot-unavailable': 'The child needs one supported editable content slot.',
  };
  return messages[code] ?? 'The child’s source properties need a supported mapping.';
}
