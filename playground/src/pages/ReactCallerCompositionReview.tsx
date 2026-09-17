import { useEffect, useState } from 'react';
import type { ReactCallerComposition } from '../../../source-reference/react-caller-composition';
import type { ReactCallerNativeCompilation } from '../../../source-reference/react-caller-native';
import type { ReactInitialInspection } from '../../../source-reference/react-initial-inspection';
import type { ReactCallbackInspection } from '../../../source-reference/react-callback-inspection';

function ContextualInspection({ url, name }: { url: string; name: string }) {
  const [initial, setInitial] = useState<ReactInitialInspection | null>(null);
  const [behavior, setBehavior] = useState<ReactCallbackInspection | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const running = initial?.phase === 'running' || behavior?.phase === 'running';
  useEffect(() => {
    let active = true, pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const kinds = initial?.phase === 'running' ? ['initial-states'] : behavior?.phase === 'running' ? ['callback-behavior'] : ['initial-states', 'callback-behavior'];
        const responses = await Promise.all(kinds.map(async kind => {
          const response = await fetch(`${url}/${kind}`), result = await response.json();
          if (!response.ok) throw Error(result.error);
          return { kind, inspection: result.inspection };
        }));
        if (active) {
          for (const response of responses) {
            if (response.kind === 'initial-states') setInitial(response.inspection); else setBehavior(response.inspection);
          }
          setError('');
        }
      } catch (error) { if (active) setError(error instanceof Error ? error.message : String(error)); }
      finally { pending = false; }
    }
    void refresh();
    const timer = running ? setInterval(() => void refresh(), 4000) : undefined;
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [url, running, initial?.phase, behavior?.phase]);
  async function inspect(kind: 'initial-states' | 'callback-behavior') {
    setBusy(true); setError('');
    try {
      const response = await fetch(`${url}/${kind}`, { method: 'POST' }), result = await response.json();
      if (!response.ok) throw Error(result.error);
      let inspection = result.inspection;
      if (inspection?.phase === 'complete') {
        const reopened = await fetch(`${url}/${kind}`), current = await reopened.json();
        if (!reopened.ok) throw Error(current.error);
        inspection = current.inspection;
      }
      if (kind === 'initial-states') setInitial(inspection); else setBehavior(inspection);
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  return <section aria-label={`${name} in source composition`}>
    <p>Inspect {name} inside this composition, with its original inherited styles and label. Each trial must restore the full original.</p>
    <button type="button" disabled={busy || running} onClick={() => void inspect('initial-states')}>Inspect {name} states in composition</button>
    <button type="button" disabled={busy || running || initial?.draft?.status !== 'compiled-draft'} onClick={() => void inspect('callback-behavior')}>Inspect {name} behavior in composition</button>
    {initial && <p>Contextual states: {initial.phase}; {initial.observation?.rows.filter(row => row.status === 'observed' && row.restored).length ?? 0} restored observations. Contract: {initial.draft?.status ?? 'pending'}.</p>}
    {behavior && <p>Contextual behavior: {behavior.phase}; {behavior.observation?.rows.filter(row => row.restored).length ?? 0} restored trials. Contract: {behavior.draft?.status ?? 'pending'}.</p>}
    {[...(initial?.problems ?? []), ...(initial?.draft?.problems ?? []), ...(behavior?.problems ?? []), ...(behavior?.draft?.problems ?? [])].map((problem, i) => <p role="alert" key={i}>{problem}</p>)}
    {error && <p role="alert">{error}</p>}
    {behavior?.draft?.status === 'generated-draft' && <p>Contextual evidence is ready for composition generation. Native delivery and fidelity still require verification.</p>}
  </section>;
}

export function ReactCallerCompositionReview({ root, operationId }: { root: string; operationId: string }) {
  const [draft, setDraft] = useState<ReactCallerComposition>(), [busy, setBusy] = useState(false), [error, setError] = useState(''), [preview, setPreview] = useState(false);
  const [native, setNative] = useState<ReactCallerNativeCompilation>();
  const url = `${root}/native-operation/${operationId}/caller-react`;
  async function generate() {
    setBusy(true); setError(''); setPreview(false); setNative(undefined);
    try {
      const response = await fetch(url), result = await response.json();
      if (!response.ok) throw Error(result.error);
      setDraft(result.draft);
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  async function compileNative() {
    setBusy(true); setError(''); setNative(undefined);
    try {
      const response = await fetch(`${url}/native-compilation`), result = await response.json();
      if (!response.ok) throw Error(result.error);
      setNative(result.compilation);
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  return <section aria-label="Generated caller composition">
    <h4>Generate the observed React composition</h4>
    <p>Use the saved source ownership, content and behavior observations to assemble nested React components. Original source files and native objects stay unchanged.</p>
    <button type="button" disabled={busy} onClick={() => void generate()}>{busy ? 'Generating composition…' : 'Generate React composition'}</button>
    {error && <p role="alert">{error}</p>}
    {draft && <>
      <p>Composition: {draft.status.replaceAll('-', ' ')}. {draft.children.length} child identities projected.</p>
      {!!draft.problems.length && <p role="alert">{draft.problems.join(', ')}</p>}
      {!!draft.contextDifferences.length && <details open><summary>Source context discrepancies · {draft.contextDifferences.length}</summary>
        <p>The text-free control inherits different typography in this composition. The preview retains and reports these differences; fidelity and native reuse are not qualified.</p>
        <ul>{draft.contextDifferences.map((difference, i) => <li key={i}>{difference.sourcePath} · {difference.field}: generated {difference.generated}, source {difference.source}.</li>)}</ul>
      </details>}
      {draft.status === 'generated-draft' && <>
        {!draft.contextDifferences.length && <p>The selected behavior observations match this source context.</p>}
        <ul>{draft.children.map(child => <li key={child.instanceId}>{child.exportName}: {child.behavior ? 'observed state behavior' : 'observed root with caller content'}.
          {child.behavior && <ContextualInspection url={`${url}/child/${child.instanceId}`} name={child.exportName} />}
        </li>)}</ul>
        <p>Labels and controls receive caller-supplied IDs. The preview uses React useId for two independent copies. Wider layout and property coverage, external fonts, clean installation and native property mapping remain unfinished.</p>
        <button type="button" onClick={() => setPreview(value => !value)}>{preview ? 'Close generated composition' : 'Try generated composition'}</button>
        <button type="button" disabled={busy} onClick={() => void compileNative()}>Check native composition</button>
        {native && <section aria-label="Native composition compilation">
          <h5>Native composition compiled · delivery unfinished</h5>
          <p>{native.components.length} components compiled at the observed {native.observedWidth} px width, with separate token and asset identities for each component. This check creates no Figma objects.</p>
          <ul>{native.components.map(component => <li key={component.contractId}>{component.contractId === draft.contract!.id ? 'Source composition' : draft.children.find(child => child.contractId === component.contractId)?.exportName ?? component.name}: {component.variants} native {component.variants === 1 ? 'variant' : 'variants'}{component.editableTextProperties.length ? `, ${component.editableTextProperties.length} caller text properties` : ''}.</li>)}</ul>
          <p>Before delivery, the application must verify reuse of the existing child components and connect this graph to the companion operation. Live editing and visual verification remain required.</p>
          {native.blockers.includes('source-context-differences-unqualified') && <p>The reported source typography differences still prevent qualification of child reuse.</p>}
        </section>}
        {preview && <iframe title="Generated React caller composition" src={`${url}/preview`} sandbox="allow-scripts" style={{ width: '100%', height: 900, border: '1px solid #ccc', marginTop: 12 }} />}
        <details><summary>Review generated composition code</summary>{draft.modules?.map(module => <details key={module.name}><summary>{module.name}.tsx</summary><pre style={{ overflowX: 'auto' }}><code>{module.tsx}</code></pre></details>)}</details>
      </>}
    </>}
  </section>;
}
