import { useEffect, useState } from "react";
import type { ReactCallbackInspection as Inspection } from "../../../source-reference/react-callback-inspection";

export function ReactCallbackInspection({
  referenceId,
  caseId,
  available,
}: {
  referenceId: string;
  caseId: string;
  available: boolean;
}) {
  const [result, setResult] = useState<Inspection | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const endpoint = `/api/source-reference/react/${referenceId}/callback-behavior/${caseId}`;
  useEffect(() => {
    let stopped = false,
      pending = false;
    setResult(null);
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
        Observe the original checkbox with each compatible input, real label and
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
          {result.observation?.relationships.map((row) => (
            <p key={row.callback + ":" + row.property}>
              <strong>
                {row.property} → {row.callback}:{" "}
                {row.status.replaceAll("-", " ")}
              </strong>
              . {row.reason}
            </p>
          ))}
          {!!result.observation?.rows.length && (
            <details>
              <summary>
                Review callback values and state transitions (
                {result.observation.rows.length} trials)
              </summary>
              <table>
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
    </section>
  );
}
