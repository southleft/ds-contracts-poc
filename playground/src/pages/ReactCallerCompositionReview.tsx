import { useState } from 'react';
import type { ReactCallerComposition } from '../../../source-reference/react-caller-composition';
import type { ReactCallerNativeCompilation } from '../../../source-reference/react-caller-native';

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
        <ul>{draft.children.map(child => <li key={child.instanceId}>{child.exportName}: {child.behavior ? 'observed state behavior' : 'observed root with caller content'}.</li>)}</ul>
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
