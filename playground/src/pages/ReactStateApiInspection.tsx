import { useEffect, useState } from 'react';
import type { ReactStateApiInspection as Inspection } from '../../../source-reference/react-state-api-inspection';

export function ReactStateApiInspection({ referenceId, caseId, available }: { referenceId: string; caseId: string; available: boolean }) {
  const [result, setResult] = useState<Inspection | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const endpoint = `/api/source-reference/react/${referenceId}/state-api/${caseId}`;
  useEffect(() => {
    let stopped = false;
    setResult(null); setError('');
    if (available) void fetch(endpoint).then(async response => {
      const data = await response.json(); if (!response.ok) throw Error(data.error);
      if (!stopped) setResult(data.inspection);
    }).catch(e => { if (!stopped) setError(e instanceof Error ? e.message : String(e)); });
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
      }).catch(e => { if (!stopped) setError(e instanceof Error ? e.message : String(e)); }).finally(() => { pending = false; });
    }, 3000);
    return () => { stopped = true; clearInterval(timer); };
  }, [endpoint, result?.phase]);
  const start = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST' }), data = await response.json();
      if (!response.ok) throw Error(data.error); setResult(data.inspection);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return <section aria-label="Supported state API inspection">
    <h4>Verify state inputs together</h4>
    <p>Check controlled values, initial values and observed disabled inputs in every supported combination, including omitted props. Each combination exercises live updates, keyboard and associated-label activation, callback values and exact restoration of the original.</p>
    <p>This records a separate, bounded check. The earlier input refusals remain visible. Generated behavior and the native round trip still need qualification. An unchanged request reuses its saved observations.</p>
    <button type="button" disabled={!available || busy || result?.phase === 'running'} onClick={() => void start()}>
      {busy || result?.phase === 'running' ? 'Checking state inputs…' : `Check ${caseId} state inputs together`}
    </button>
    {!available && <p>First inspect callback behavior to identify one controlled and one initial-only input.</p>}
    {error && <p role="alert">{error}</p>}
    {result && <>
      <p>Selected state API check: {result.phase}. {result.sourceUnchanged ? 'Original source, render and ownership restored.' : 'Original equivalence is not yet established.'}</p>
      <p>Inputs in this check: {result.plan.controlled} (controlled), {result.plan.initial} (initial only){result.plan.disabled ? `, ${result.plan.disabled} (disabled)` : ''}. Callback: {result.plan.callback}.</p>
      <p>{result.observation?.rows.length ?? 0} / {result.plan.cases.length * 2} activation trials; {result.restorationChecks} exact restoration checks.</p>
      {!!result.plan.excludedInputs.length && <details><summary>Inputs outside this check ({result.plan.excludedInputs.length})</summary>
        <p>{result.plan.excludedInputs.join(', ')} are held omitted. This result makes no behavior claim for those inputs.</p>
      </details>}
      {!!result.observation?.rows.length && <details><summary>Review simultaneous input trials</summary>
        <table style={{ borderSpacing: '12px 6px', textAlign: 'left' }}><thead><tr><th>Inputs</th><th>Action</th><th>Checked state</th><th>Callback values</th><th>Live update</th></tr></thead>
          <tbody>{result.observation.rows.map(row => <tr key={row.id + ':' + row.action}>
            <td>{Object.entries(result.plan.cases.find(c => c.id === row.id)!.changes).filter(([name]) => !result.plan.excludedInputs.includes(name))
              .map(([name, value]) => `${name}=${value.kind === 'omit' ? '(omitted)' : JSON.stringify(value.value)}`).join(', ')}</td>
            <td>{row.action}</td><td>{[row.initial.checked, ...row.steps.map(s => s.control.checked)].join(' → ')}{row.initial.disabled ? ' (disabled)' : ''}</td>
            <td>{JSON.stringify(row.steps.at(-1)?.callback.calls)}</td><td>{row.live.before.checked} → {row.live.changed.checked}</td>
          </tr>)}</tbody>
        </table>
      </details>}
      {result.draft && <section aria-label="Generated state API draft"><h4>Generated state behavior: {result.draft.status}</h4>
        <p>This draft uses the contract's existing state and callback model. The original broad inspection remains unchanged. Visual fidelity, excluded inputs and native behavior still require qualification.</p>
        {result.draft.status === 'generated-draft' && <details><summary>Try the generated state control</summary>
          <iframe title="Generated state API consumer" src={endpoint + '/preview'} sandbox="allow-scripts" style={{width:'100%',height:610,border:'1px solid #ddd'}}/>
        </details>}
        {result.draft.problems.map(problem=><p key={problem} role="alert">{problem}</p>)}
      </section>}
      {[...result.problems, ...(result.observation?.problems ?? [])].map((problem, index) => <p key={index} role="alert">{problem}</p>)}
    </>}
  </section>;
}
