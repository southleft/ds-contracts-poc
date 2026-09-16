import { useState } from "react";
interface Reference {
  id: string;
  source: string;
  theme: string;
  sourceFiles: number;
  qualification: "unqualified";
  cases: { id: string; subject: string; label: string; url: string }[];
}
export function ReactSourceReference() {
  const [reference, setReference] = useState<Reference | null>(null);
  const [selected, setSelected] = useState("button-default");
  const [busy, setBusy] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/source-reference/react", {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setReference(result);
      setLoadVersion((v) => v + 1);
    } catch (e) {
      setReference(null);
      setError(
        e instanceof Error ? e.message : "React originals could not load.",
      );
    } finally {
      setBusy(false);
    }
  }
  const current = reference?.cases.find((c) => c.id === selected);
  return (
    <section
      className="react-source-reference"
      aria-labelledby="react-original-title"
    >
      <h2 id="react-original-title">React originals</h2>
      <p>
        Inspect the actual shadcn source components before conversion: Button,
        Checkbox and a composed Card. All ten selected cases remain in the
        cohort.
      </p>
      <button type="button" onClick={() => void load()} disabled={busy}>
        {busy
          ? "Loading React originals…"
          : reference
            ? "Reload React originals"
            : "Load React originals"}
      </button>
      {error && <p role="alert">{error}</p>}
      {reference && (
        <>
          <p>
            <strong>Source readiness: unqualified.</strong> This is the original
            React runtime, with its sandbox theme and fonts. Recorded input
            identities do not establish styling, behavior or Figma fidelity.
          </p>
          <p>
            {reference.theme} · {reference.sourceFiles} recorded input files ·
            Reference {reference.id.slice(0, 12)}
          </p>
          <label htmlFor="react-reference-case">
            Original component and state
          </label>
          <select
            id="react-reference-case"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {reference.cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.subject} — {c.label}
              </option>
            ))}
          </select>
          {current && (
            <div className="react-source-viewport">
              <iframe
                key={`${current.url}:${loadVersion}`}
                title={`Original React: ${current.subject} — ${current.label}`}
                src={current.url}
                sandbox="allow-scripts"
                className="react-source-frame"
              />
            </div>
          )}
          <p>
            Original at 900 px wide. Scroll horizontally on smaller screens.
          </p>
          <p>
            Generated output and conversion controls will be available here
            after source validation is connected. The existing import workspace
            remains available from <a href="/playground">Playground</a>.
          </p>
        </>
      )}
    </section>
  );
}
