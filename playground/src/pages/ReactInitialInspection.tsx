import { useEffect, useState } from 'react';
import type { ReactInitialInspection as Inspection } from '../../../source-reference/react-initial-inspection';
export function ReactInitialInspection({ referenceId, caseId, available, prepareNative, nativeSaved, nativeBusy, onObservationChange }: { referenceId: string; caseId: string; available: boolean; prepareNative: () => void; nativeSaved: boolean; nativeBusy: boolean; onObservationChange?: () => void }) {
  const [result, setResult] = useState<Inspection | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const endpoint = `/api/source-reference/react/${referenceId}/initial-states/${caseId}`;
  useEffect(() => {
    if (result?.phase === 'complete') onObservationChange?.();
  }, [result?.id, result?.phase, onObservationChange]);
  useEffect(() => {
    let stopped = false;
    setResult(null); setError('');
    if (!available) return;
    const load = async () => {
      try {
        const response = await fetch(endpoint), data = await response.json();
        if (!response.ok) throw Error(data.error);
        if (!stopped) { setResult(data.inspection); setError(''); }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : String(e)); }
    };
    void load();
    return () => { stopped = true; };
  }, [endpoint, available]);
  useEffect(() => {
    if (result?.phase !== 'running') return;
    let stopped = false, pending = false;
    const timer = setInterval(() => {
      if (pending) return; pending = true;
      void fetch(endpoint).then(async response => {
        const data = await response.json(); if (!response.ok) throw Error(data.error);
        if (!stopped) setResult(data.inspection);
      }).catch(e => { if (!stopped) setError(String(e)); }).finally(() => { pending = false; });
    }, 3000);
    return () => { stopped = true; clearInterval(timer); };
  }, [endpoint, result?.phase]);
  async function start() {
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST' }), data = await response.json();
      if (!response.ok) throw Error(data.error); setResult(data.inspection);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <section aria-label="Initial state inspection">
    <h3>Inspect initial states</h3>
    <p>Vary finite caller-supplied inputs on fresh mounts of the original component, then verify the original rendering is restored. This distinguishes initial values from live updates. It does not create Figma components or qualify interaction behavior.</p>
    <button type="button" disabled={!available || busy || result?.phase === 'running' || result?.phase === 'complete' && !result.reobservable} onClick={() => void start()}>
      {result?.phase === 'running' || busy ? 'Inspecting initial states…' : result?.phase === 'complete' ? result.reobservable ? 'Observe again with the current observer' : 'Initial observations saved' : `Inspect ${caseId} initial states`}
    </button>
    {result?.reobservable && <p>{result.reobservable === 'observer-changed'
      ? 'The observer has changed since this observation was saved.'
      : result.reobservable === 'evidence-unobserved-by-recorded-observer' ? 'The current assembler names evidence this observation never recorded.'
      : 'This observation was saved before observer versions were recorded, and the current assembler names evidence it never observed.'} Observing again saves a new run beside it; the saved run and any operation that pins it are unchanged.</p>}
    {result?.lastAttempt && <p role="alert">The latest observation attempt failed ({result.lastAttempt.problems.join(', ') || 'no problem recorded'}). The saved observation above is unchanged.</p>}
    {!available && <p>Prepare a supported Figma root from the structure observation first; its saved source archive also contains this cohort’s stateful cases.</p>}
    {error && <p role="alert">{error}</p>}
    {result && <>
      <p>Initial-state inspection: {result.phase}. {result.sourceUnchanged ? 'Original source and rendering restored.' : 'Source equivalence is not yet established.'}</p>
      {result.draft && <section aria-label="Initial-state contract draft">
        <button type="button" disabled={nativeBusy || nativeSaved || result.draft.status !== 'compiled-draft'} onClick={prepareNative}>
          {nativeSaved ? 'Initial-state native operation saved' : 'Prepare initial states for Figma'}
        </button>
        <h4>Initial-state contract draft: {result.draft.status}</h4>
        <p>{result.draft.compiled?.component?.variants.length ?? 0} native variant specifications assembled from saved observations. Review native creation and readback in the saved operation below. This draft alone does not qualify Figma output. Descendant token identities, nested component mappings and interaction behavior remain unqualified.</p>
        <p>Root source variables retained: {[...new Set(result.draft.sourceBindings.flatMap(row => row.bindings.filter(b => b.tokenPath).map(b => b.variable)))].join(', ') || 'none verified'}. Other channels, aliases and themes remain unqualified.</p>
        {result.draft.compiled?.contract && <p>Observed inputs: {result.draft.compiled.contract.props.map(p => p.name).join(', ')}. Omitted values remain separate from explicit values.</p>}
        {!!result.draft.problems.length && <ul>{result.draft.problems.map(p => <li key={p}>{p}</li>)}</ul>}
      </section>}
      {result.observation && <>
        <p>{result.observation.rows.filter(r => r.status === 'observed').length} / {result.observation.planned} initial input combinations observed. Native state mapping and interaction behavior remain unqualified.</p>
        <details><summary>Review observed initial states</summary>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            {result.observation.rows.map(row => <figure key={row.id} style={{ margin: 0, maxWidth: 260, overflow: 'auto' }}>
              <figcaption>{Object.entries(row.changes).map(([name, value]) => `${name}: ${value.kind === 'omit' ? '(omitted)' : JSON.stringify(value.value)}`).join(' · ')} — {row.status}</figcaption>
              {row.status === 'observed' && <img loading="lazy" style={{ maxWidth: 'none', backgroundColor: 'white' }} alt={`Initial state ${row.id}`} src={`${endpoint}/${result.id}/${row.id}.png`} onError={() => setError('A saved state preview could not be verified or loaded. Reload unchanged originals before reviewing it.')} />}
              {row.problem && <p>{row.problem}</p>}
            </figure>)}
          </div>
        </details>
      </>}
      {!!result.problems.length && <ul>{result.problems.map(p => <li key={p}>{p}</li>)}</ul>}
    </>}
  </section>;
}
