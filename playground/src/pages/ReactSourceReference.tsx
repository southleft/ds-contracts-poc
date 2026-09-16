import type {
  ReactSourceComponent,
  ReactRootFact,
} from "../../../source-reference/react-source-program";
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
function rootLabel(root: ReactRootFact): string {
  if (root.kind === "conditional")
    return `${root.condition}: ${rootLabel(root.whenTrue!)} / ${rootLabel(root.whenFalse!)}`;
  return root.kind === "component"
    ? `${root.module} → ${root.export}`
    : root.kind === "host"
      ? `<${root.name}>`
      : `Unresolved: ${root.reason}`;
}
export function ReactSourceReference() {
  const [reference, setReference] = useState<Reference | null>(null);
  const [validation, setValidation] = useState<ReactValidation | null>(null);
  const [selected, setSelected] = useState("button-default");
  const [busy, setBusy] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [error, setError] = useState("");
  const [program, setProgram] = useState<{
    id: string;
    status: string;
    sourceFiles: number;
    compatibilityNotes: string[];
    components: ReactSourceComponent[];
    problems: string[];
  } | null>(null);
  const [readingProgram, setReadingProgram] = useState(false);
  async function inspectProgram() {
    if (!reference) return;
    setReadingProgram(true);
    setError("");
    try {
      const response = await fetch(
        `/api/source-reference/react/${reference.id}/program`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setProgram(data);
    } catch (e) {
      setProgram(null);
      setError(
        e instanceof Error ? e.message : "Source APIs could not be read.",
      );
    } finally {
      setReadingProgram(false);
    }
  }
  async function load() {
    setBusy(true);
    setProgram(null);
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
        disabled={busy || readingProgram || validation?.state === "running"}
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
            disabled={busy || readingProgram || validation?.state === "running"}
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
          <section aria-label="React source API inspection">
            <h3>Source APIs and component roots</h3>
            <p>
              Read the original JSX and installed type declarations, including
              inherited properties and nested references. These facts do not yet
              qualify a contract or prove runtime behavior.
            </p>
            <button
              type="button"
              disabled={
                busy || readingProgram || validation?.state === "running"
              }
              onClick={() => void inspectProgram()}
            >
              {readingProgram ? "Reading source APIs…" : "Inspect React APIs"}
            </button>
            {program && (
              <div>
                <p>
                  {program.components.length} component definitions ·{" "}
                  {program.sourceFiles} source and declaration files recorded ·{" "}
                  {program.status === "observed"
                    ? "API facts recorded"
                    : "Read incomplete"}
                  . Snapshot {program.id.slice(0, 12)}. Reinspect after
                  declaration changes.
                </p>
                {program.compatibilityNotes.length > 0 && (
                  <details>
                    <summary>Reader compatibility notes</summary>
                    <ul>
                      {program.compatibilityNotes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {program.problems.length > 0 && (
                  <ul>
                    {program.problems.map((problem, i) => (
                      <li key={i}>{problem}</li>
                    ))}
                  </ul>
                )}
                {program.components.map((component) => (
                  <details key={`${component.module}:${component.exportName}`}>
                    <summary>
                      {component.exportName} · {component.props.length}{" "}
                      properties · {rootLabel(component.root)}
                    </summary>
                    <p>
                      {component.module}. Declared defaults:{" "}
                      {JSON.stringify(component.defaults)}. Forwarded spreads:{" "}
                      {component.forwardedProps.join(", ") || "none recorded"}.
                    </p>
                    {component.problems.length > 0 && (
                      <p>{component.problems.join("; ")}</p>
                    )}
                    {component.componentReferences.length > 0 && (
                      <p>
                        Component references:{" "}
                        {component.componentReferences
                          .map((r) => rootLabel(r.target))
                          .join("; ")}
                        .
                      </p>
                    )}
                    <ul>
                      {component.props.map((prop) => (
                        <li key={prop.name}>
                          <code>
                            {prop.name}
                            {prop.optional ? "?" : ""}
                          </code>
                          : <code>{prop.type.text}</code>
                          {prop.type.kind === "union" &&
                            prop.type.members.every(
                              (member) =>
                                member.kind === "literal" ||
                                member.kind === "undefined" ||
                                member.kind === "null",
                            ) && (
                              <span>
                                {" "}
                                — values:{" "}
                                {prop.type.members
                                  .map((member) =>
                                    member.kind === "literal"
                                      ? JSON.stringify(member.value)
                                      : member.kind,
                                  )
                                  .join(", ")}
                              </span>
                            )}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            )}
          </section>
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
