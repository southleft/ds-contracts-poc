import type { ReactValidation } from "../../../source-reference/react-reference-validation";
import { useEffect, useState } from "react";
interface Reference {
  id: string;
  source: string;
  theme: string;
  sourceFiles: number;
  qualification: "unqualified";
  validation?: ReactValidation | null;
  cases: { id: string; subject: string; label: string; url: string }[];
}
export function ReactSourceReference() {
  const [reference, setReference] = useState<Reference | null>(null);
  const [validation, setValidation] = useState<ReactValidation | null>(null);
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
      setValidation(result.validation ?? null);
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
  useEffect(() => {
    if (!reference || validation?.state !== "running") return;
    let cancelled = false;
    const timer = setInterval(() => {
      void fetch(`/api/source-reference/react/${reference.id}/validate`)
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw Error(data.error);
          if (!cancelled) setValidation(data);
        })
        .catch((e) => {
          if (!cancelled)
            setError(
              e instanceof Error ? e.message : "Validation status unavailable.",
            );
        });
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [reference?.id, validation?.state]);
  async function validate() {
    if (!reference) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/source-reference/react/${reference.id}/validate`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setValidation(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Source validation could not start.",
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
      <button
        type="button"
        onClick={() => void load()}
        disabled={busy || validation?.state === "running"}
      >
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
            <strong>
              Source readiness:{" "}
              {validation?.state === "complete"
                ? `${validation.valid} / ${validation.denominator} valid`
                : validation?.state === "running"
                  ? "checking originals and replay…"
                  : "unqualified"}
              .
            </strong>{" "}
            Original React runtime with its sandbox theme and fonts. Figma
            fidelity, editable output and behavior remain unqualified.
          </p>
          <p>
            {reference.theme} · {reference.sourceFiles} recorded input files ·
            Reference {reference.id.slice(0, 12)}
          </p>
          <button
            type="button"
            onClick={() => void validate()}
            disabled={busy || validation?.state === "running"}
          >
            {validation?.state === "running"
              ? "Validating React sources…"
              : validation
                ? "Validate again"
                : "Validate React sources"}
          </button>
          {validation && (
            <div role="status">
              <p>
                {validation.state === "running"
                  ? `${validation.rows.length} of ${validation.denominator} cases reached; final source integrity pending.`
                  : `Recorded ${validation.completedAt ? new Date(validation.completedAt).toLocaleString() : validation.startedAt}. Source inputs ${validation.sourceUnchanged ? "unchanged" : "not verified"}.`}
              </p>
              {validation.problem && <p>{validation.problem}</p>}
              <ul>
                {validation.rows.map((row) => (
                  <li key={row.id}>
                    {row.id}:{" "}
                    {validation.state === "running"
                      ? "provisional"
                      : row.sourceValid
                        ? "source and replay valid"
                        : "not qualified"}
                    {row.problems.length > 0
                      ? ` — ${row.problems.join(", ")}`
                      : ""}
                    {row.negativeControls
                      ? ` · ${row.negativeControls.filter((n) => n.rejected).length}/${row.negativeControls.length} negative controls rejected`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
          {validation &&
            validation.rows.find((r) => r.id === selected)?.sourceImage && (
              <div className="native-image-pair">
                {(["source", "replay"] as const).map((side) => {
                  const row = validation.rows.find((r) => r.id === selected);
                  const hash =
                    side === "source" ? row?.sourceImage : row?.replayImage;
                  return hash ? (
                    <figure key={`${side}:${hash}`}>
                      <figcaption>
                        {side === "source"
                          ? "Recorded original"
                          : "Network-isolated replay"}{" "}
                        ·{" "}
                        {validation.state === "running"
                          ? "provisional"
                          : row?.sourceValid
                            ? "source valid"
                            : "not qualified"}
                      </figcaption>
                      <img
                        alt={`${side} ${selected}`}
                        src={`/api/source-reference/react/${reference.id}/${validation.id}/${selected}/${side}/${hash}.png`}
                      />
                    </figure>
                  ) : null;
                })}
              </div>
            )}
          <p>
            Original at 900 px wide. Scroll horizontally on smaller screens.
          </p>
          <p>
            Source checks do not qualify Figma conversion. Native generation is
            the next integration step. The existing import workspace remains
            available from <a href="/playground">Playground</a>.
          </p>
        </>
      )}
    </section>
  );
}
