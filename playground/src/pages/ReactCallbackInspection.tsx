import { useEffect, useState } from "react";
import type { ReactCallbackInspection as Inspection } from "../../../source-reference/react-callback-inspection";
import { ReactStateApiInspection } from './ReactStateApiInspection';

export function ReactCallbackInspection({
  referenceId,
  caseId,
  available, prepareStateApi, nativeBusy, onStateApiChange,
}: {
  referenceId: string;
  caseId: string;
  available: boolean;
  prepareStateApi?:()=>void; nativeBusy?:boolean;
  onStateApiChange?:()=>void;
}) {
  const [result, setResult] = useState<Inspection | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false);
  const endpoint = `/api/source-reference/react/${referenceId}/callback-behavior/${caseId}`;
  useEffect(() => {
    let stopped = false,
      pending = false;
    setResult(null);
    setPreview(false);
    setError("");
    if (!available) return;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch(endpoint),
          data = await response.json();
        if (!response.ok) throw Error(data.error);
        if (!stopped) {
          setResult(data.inspection);
          setError("");
        }
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : String(e));
      } finally {
        pending = false;
      }
    };
    void load();
    return () => {
      stopped = true;
    };
  }, [endpoint, available]);
  useEffect(() => {
    if (result?.phase !== "running") return;
    let stopped = false,
      pending = false;
    const timer = setInterval(() => {
      if (pending) return;
      pending = true;
      void fetch(endpoint)
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw Error(data.error);
          if (!stopped) setResult(data.inspection);
        })
        .catch((e) => {
          if (!stopped) setError(String(e));
        })
        .finally(() => {
          pending = false;
        });
    }, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [endpoint, result?.phase]);
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "POST" }),
        data = await response.json();
      if (!response.ok) throw Error(data.error);
      setResult(data.inspection);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Callback behavior inspection">
      <h3>Inspect state and callback behavior</h3>
      <p>
        Observe the original checkbox or switch with each compatible input, real label and
        keyboard activation, and live input updates. Each trial restores the
        original render. These observations inform the contract; generated
        behavior still needs verification.
      </p>
      <button
        type="button"
        disabled={
          !available ||
          busy ||
          result?.phase === "running" ||
          result?.phase === "complete"
        }
        onClick={() => void start()}
      >
        {result?.phase === "complete"
          ? "Callback observations saved"
          : busy || result?.phase === "running"
            ? "Observing callback behavior…"
            : `Inspect ${caseId} callback behavior`}
      </button>
      {!available && (
        <p>A saved, current source structure observation is required.</p>
      )}
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <p>
            Callback inspection: {result.phase}.{" "}
            {result.sourceUnchanged
              ? "Original source, rendering and ownership restored."
              : "Original equivalence is not yet established."}
          </p>
          {result.restoration && <p>Each trial verifies restored structure and ownership, then replays the unchanged original page and requires an exact image match. Same-mount pixel differences retained: {result.restoration.checks.filter(check => !check.sameMountPixelsMatch).length}. This does not demonstrate recovery of a user's runtime state.</p>}
          {result.draft && <section aria-label="Generated behavior draft">
            <h4>React behavior draft: {result.draft.status}</h4>
            {result.draft.contract && <p>State API: {result.draft.contract.props.filter(prop=>prop.bindings.code.initial).map(prop=>`${prop.bindings.code.prop} (controlled), ${prop.bindings.code.initial!.prop} (initial only)`).join(', ')}. Callback: {result.draft.contract.events?.map(event=>event.bindings.code.prop).join(', ')}.</p>}
            <p>This code combines observed state behavior with the saved appearance draft. Controlled-state visual comparisons, associated label composition, generated-consumer qualification and native metadata preservation remain unfinished.</p>
            {result.draft.status === 'generated-draft' && <>
              <button type="button" onClick={()=>setPreview(value=>!value)}>{preview?'Close React comparison':'Try generated React beside the original'}</button>
              {preview && <section aria-label="Original and generated React comparison">
                <p>Both views are interactive. The original includes its caller composition; the generated view currently contains the control only. This is a review surface, not a visual pass.</p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,340px),1fr))',gap:16}}>
                  <div><h5>Unchanged original case</h5><iframe title="Original behavior comparison" sandbox="allow-scripts" src={`/api/source-reference/react/${referenceId}?case=${caseId}`} style={{width:'100%',height:580,border:'1px solid #ddd'}}/></div>
                  <div><h5>Generated React control</h5><iframe title="Generated React behavior preview" sandbox="allow-scripts" src={`/api/source-reference/react/${referenceId}/behavior-preview/${caseId}`} style={{width:'100%',height:580,border:'1px solid #ddd'}}/></div>
                </div>
              </section>}
            </>}
            {result.draft.tsx && <details><summary>Review generated React code</summary><pre style={{maxHeight:320,overflow:'auto'}}><code>{result.draft.tsx}</code></pre></details>}
            {result.draft.problems.map(problem=><p key={problem}>{problem}</p>)}
          </section>}
          {result.observation?.relationships.map((row) => (
            <p key={row.callback + ":" + row.property}>
              <strong>
                {row.property} → {row.callback}:{" "}
                {row.status.replaceAll("-", " ")}
              </strong>
              . {row.reason}
            </p>
          ))}
          {!!result.observation?.refusals?.length && (
            <section aria-label="Refused callback trials">
              <h4>Inputs that could not be observed</h4>
              <p>The original was restored before inspecting other inputs. These refusals keep the full behavior observation unqualified.</p>
              <ul>{result.observation.refusals.map((row, index) => (
                <li key={index}>{row.property}={JSON.stringify(row.value)} → {row.callback}: {row.problem}</li>
              ))}</ul>
            </section>
          )}
          {!!result.observation?.rows.length && (
            <details>
              <summary>
                Review callback values and state transitions (
                {result.observation.rows.length} trials)
              </summary>
              <table style={{ borderSpacing: "12px 6px", textAlign: "left" }}>
                <thead>
                  <tr>
                    <th>Input</th>
                    <th>Action</th>
                    <th>Initial state</th>
                    <th>After each activation</th>
                    <th>Callback arguments</th>
                    <th>Live input state</th>
                  </tr>
                </thead>
                <tbody>
                  {result.observation.rows.map((row, index) => (
                    <tr key={index}>
                      <td>
                        {row.property} = {JSON.stringify(row.value)}
                      </td>
                      <td>{row.action}</td>
                      <td>
                        {row.initial.checked}
                        {row.initial.disabled ? " (disabled)" : ""}
                      </td>
                      <td>
                        {row.steps
                          .map((step) => step.control.checked)
                          .join(" → ")}
                      </td>
                      <td>
                        {JSON.stringify(row.steps.at(-1)?.callback.calls)}
                      </td>
                      <td>{row.live.checked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
          {[...result.problems, ...(result.observation?.problems ?? [])].map(
            (problem, index) => (
              <p key={index} role="alert">
                {problem}
              </p>
            ),
          )}
        </>
      )}
      <ReactStateApiInspection onObservationChange={onStateApiChange} referenceId={referenceId} caseId={caseId} prepareNative={prepareStateApi} nativeBusy={nativeBusy} available={available && !!result?.sourceUnchanged &&
        result.observation?.relationships.filter(r => r.status === 'controlled-observed').length === 1 &&
        result.observation?.relationships.filter(r => r.status === 'initial-only-observed').length === 1}/>
    </section>
  );
}
