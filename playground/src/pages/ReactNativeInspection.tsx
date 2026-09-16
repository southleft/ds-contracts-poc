import { useEffect, useState } from 'react';
import type { NativeOperationSnapshot } from '../../../source-reference/native-operation-jobs';
import type { ReactOwnershipReport } from '../../../source-reference/react-ownership-run';
import type { ReactContentInspection } from '../../../source-reference/react-content-inspection';

interface Operation {
  kind: 'root' | 'comparison'; parentOperationId?: string;
  caseId: string; ownershipId: string; fileKey: string; operation: NativeOperationSnapshot;
  connection: { paired: boolean; connected: boolean; started: boolean; finished: boolean };
  content?: Pick<ReactContentInspection, 'phase' | 'sourceUnchanged' | 'problems'> & Partial<ReactContentInspection>;
}
export function ReactNativeInspection({ referenceId, selectedCase, ownership }: {
  referenceId: string; selectedCase: string; ownership: ReactOwnershipReport | null;
}) {
  const [rows, setRows] = useState<Operation[]>([]), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [codes, setCodes] = useState<Record<string, string>>({});
  const root = `/api/source-reference/react/${referenceId}`;
  const active = rows.some(r => (r.connection.paired && !r.connection.finished) || r.content?.phase === 'running');
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
    {rows.map(row => {
      const op = row.operation, id = op.id, comparison = row.kind === 'comparison';
      const savedComparison = rows.find(r => r.parentOperationId === id);
      return <details key={id} open={row.caseId === selectedCase}>
        <summary>{row.caseId} {comparison ? '· caller-content comparison' : '· reusable roots'} · {op.phase.replaceAll('-', ' ')}</summary>
        <p>{comparison ? 'Instance of the saved main' : `${op.counters.variants} root variants`} · {op.counters.variables} variables · {op.sourceCurrent ? 'source evidence current' : 'source evidence unavailable'}</p>
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
        {!comparison && !savedComparison && <button type="button" disabled={busy || !op.sourceCurrent || row.content?.phase === 'running'}
          onClick={() => void action(`native-operation/${id}/content`)}>Prepare caller-content comparison</button>}
        {!comparison && row.content?.content?.status === 'compiled-comparison-draft' && <button type="button"
          disabled={busy || !!savedComparison || !op.sourceCurrent || op.phase !== 'component-structure-observed'}
          onClick={() => void action(`native-operation/${id}/comparison`)}>{savedComparison ? 'Comparison operation saved' : 'Prepare native comparison operation'}</button>}
        {row.content && <section aria-label="Caller-content preparation">
          <p>Content preparation: {row.content.phase}. {row.content.sourceUnchanged ? 'The original rendering and source files are unchanged.' : 'Source equivalence is not yet established.'}</p>
          {!!row.content.fontFamilies?.length && <p>Observed text fonts: {row.content.fontFamilies.join(', ')}.</p>}
          {row.content.content && <p>{row.content.content.status === 'compiled-comparison-draft'
            ? 'Caller content compiled for comparison. Review the separate native comparison operation when prepared; visual fidelity remains unverified.'
            : 'Caller content has unsupported facts that prevent native comparison.'} Reusable main slots remain empty.</p>}
          {[...row.content.problems, ...(row.content.content?.problems ?? [])].length > 0 && <ul>{[...row.content.problems, ...(row.content.content?.problems ?? [])].map((p, i) => <li key={i}>{p}</li>)}</ul>}
        </section>}
        {op.problems.length > 0 && <ul>{op.problems.map(p => <li key={p}>{p}</li>)}</ul>}
        {!!op.imageObservation?.images.length && <details open={comparison}><summary>{comparison ? 'Native caller-content export' : 'Native root exports'} · diagnostic only</summary>
          <p>{comparison ? 'This export comes from the saved native instance with caller content. Image presence alone does not establish visual fidelity.' : 'These are empty component mains. They are not comparisons against the caller’s content or a passing fidelity result.'}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
          {comparison && <figure><img alt={`Original React ${row.caseId}`} src={`${root}/native-operation/${row.parentOperationId}/source.png`} /><figcaption>Original React · unchanged source</figcaption></figure>}
          {op.imageObservation.images.map(image => <figure key={image.caseId}>
            <img loading="lazy" alt={`Native ${comparison ? 'comparison' : 'root'} ${image.caseId}`} src={`/api/source-reference/native/${id}/images/${op.imageObservation!.attemptId}/${image.sha256}.png`} />
            <figcaption>{image.caseId}</figcaption>
          </figure>)}
          </div>
        </details>}
      </details>;
    })}
  </section>;
}
