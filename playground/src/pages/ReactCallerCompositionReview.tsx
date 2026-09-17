import { useEffect, useState } from 'react';
import type { ReactCallerComposition } from '../../../source-reference/react-caller-composition';
import type { ReactCallerNativeCompilation } from '../../../source-reference/react-caller-native';
import type { NativeOperationSnapshot } from '../../../source-reference/native-operation-jobs';
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
  const [delivery, setDelivery] = useState<{ operation: NativeOperationSnapshot | null; connection: { paired: boolean; connected: boolean; started: boolean; finished: boolean } | null }>();
  const [connectionCode, setConnectionCode] = useState('');
  const url = `${root}/native-operation/${operationId}/caller-react`;
  const deliveryActive = !!delivery?.connection?.started && !delivery.connection.finished;
  useEffect(() => {
    if (!native) return;
    let active = true, pending = false;
    const refresh = async () => {
      if (pending) return; pending = true;
      try { const response = await fetch(`${url}/native-operation`), result = await response.json();
        if (response.ok && active) setDelivery(result); }
      finally { pending = false; }
    };
    void refresh();
    const timer = deliveryActive ? setInterval(() => void refresh(), 3000) : undefined;
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [url, native, deliveryActive]);
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
  async function prepareDelivery() {
    setBusy(true); setError('');
    try { const response = await fetch(`${url}/native-operation`, { method: 'POST' }), result = await response.json();
      if (!response.ok) throw Error(result.error); setDelivery(result); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  async function deliveryAction(action: 'connection' | 'start' | 'retry-observation') {
    if (!delivery?.operation) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`${root}/native-operation/${delivery.operation.id}/${action}`, { method: 'POST' }), result = await response.json();
      if (!response.ok) throw Error(result.error);
      if (action === 'connection') setConnectionCode(typeof result.connection === 'string'
        ? result.connection : result.connection?.code ?? result.connection?.url ?? JSON.stringify(result.connection));
      const refreshed = await fetch(`${url}/native-operation`), body = await refreshed.json();
      if (refreshed.ok) setDelivery(body);
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
          <h5>{native.unsupportedPropertyBindings?.length ? 'Native composition blocked · unsupported property bindings'
            : delivery?.operation?.phase === 'component-structure-observed' ? 'Native component graph created and read back'
              : 'Native composition compiled · ready for delivery'}</h5>
          <p>{native.components.length} components compiled at the observed {native.observedWidth} px width, with separate token and asset identities for each component. This check creates no Figma objects.</p>
          <ul>{native.components.map(component => <li key={component.contractId}>{component.contractId === draft.contract!.id ? 'Source composition' : draft.children.find(child => child.contractId === component.contractId)?.exportName ?? component.name}: {component.variants} native {component.variants === 1 ? 'variant' : 'variants'}{component.editableTextProperties.length ? `, ${component.editableTextProperties.length} property-panel text controls` : ''}{component.editableCanvasText.length ? `, ${component.editableCanvasText.length} directly editable caller text nodes` : ''}.</li>)}</ul>
          {!!native.components.flatMap(component => component.editableCanvasText).length && <details open>
            <summary>Directly editable nested content · {native.components.flatMap(component => component.editableCanvasText).length}</summary>
            <p>Figma cannot lift text controls through nested instance slots. These native text layers remain editable on the canvas and retain their exact contract-property identity for deterministic readback.</p>
            <ul>{native.components.flatMap(component => component.editableCanvasText.map(binding =>
              <li key={`${component.contractId}:${binding.property}:${binding.nodeName}`}>{binding.property} → {binding.nodeName}.</li>))}</ul>
          </details>}
          <p>The application emits the closed component graph in dependency order and independently reads the parent structure back. Visual fidelity remains a separate result.</p>
          {!native.unsupportedPropertyBindings.length && !native.blockers.includes('source-context-differences-unqualified') && <section aria-label="Native graph delivery">
            {!delivery?.operation && <button type="button" disabled={busy} onClick={() => void prepareDelivery()}>Prepare native graph operation</button>}
            {delivery?.operation && <>
              <p>Native graph operation: {delivery.operation.phase.replaceAll('-', ' ')}. {delivery.operation.counters.variants} parent variants; {delivery.operation.counters.variables} scoped variables.</p>
              {!delivery.connection?.paired && <button type="button" disabled={busy} onClick={() => void deliveryAction('connection')}>Get Figma connection code</button>}
              {connectionCode && <p><code>{connectionCode}</code></p>}
              {delivery.connection?.paired && !delivery.connection.started && <button type="button" disabled={busy} onClick={() => void deliveryAction('start')}>Create and inspect native graph</button>}
              {!delivery.operation.pendingPhase && (delivery.operation.phase === 'component-observation-refused' || delivery.operation.phase === 'components-created') &&
                <button type="button" disabled={busy} onClick={() => void deliveryAction('retry-observation')}>Inspect native graph again</button>}
              {delivery.operation.structuralObservation && <p>Structure: {delivery.operation.structuralObservation.status.replaceAll('-', ' ')}.</p>}
              {!!delivery.operation.problems.length && <p role="alert">{delivery.operation.problems.join(', ')}</p>}
            </>}
          </section>}
          {!!native.unsupportedPropertyBindings?.length && <div role="alert">
            <p>These remaining mappings cannot be represented as direct canvas edits or property controls. Delivery is refused before creating nodes; the requested mappings have not been dropped.</p>
            <ul>{native.unsupportedPropertyBindings.map(binding => <li key={`${binding.contractId}:${binding.property}:${binding.nodeName}`}>{binding.property} → {binding.nodeName} ({binding.kind.toLowerCase()}).</li>)}</ul>
          </div>}
          {native.blockers.includes('source-context-differences-unqualified') && <p>The reported source typography differences still prevent qualification of child reuse.</p>}
        </section>}
        {preview && <iframe title="Generated React caller composition" src={`${url}/preview`} sandbox="allow-scripts" style={{ width: '100%', height: 900, border: '1px solid #ccc', marginTop: 12 }} />}
        <details><summary>Review generated composition code</summary>{draft.modules?.map(module => <details key={module.name}><summary>{module.name}.tsx</summary><pre style={{ overflowX: 'auto' }}><code>{module.tsx}</code></pre></details>)}</details>
      </>}
    </>}
  </section>;
}
