import { useEffect, useState } from "react";
import "./sources.css";

interface Row {
  story: string;
  status: string;
  problems: string[];
  limitations: string[];
  sourceImage: string | null;
  replayImage: string | null;
  semanticIntake?: {
    status: string;
    tagName?: string;
    problems: string[];
    limitations: string[];
    coverage?: {
      declaredProperties: number;
      observedScalarProperties: number;
      declaredSlots: number;
      renderedSlots: number;
      declaredEvents: number;
    };
    declaration?: {
      properties: {
        name: string;
        attribute?: string;
        typeText?: string;
        default?: string;
      }[];
      slots: { name: string }[];
      events: { name: string }[];
    };
    observation?: {
      properties: Record<string, { kind: string; value?: unknown }>;
      slots: { name: string }[];
      nativeElements: {
        tag: string;
        attributes: Record<string, string>;
        properties: Record<string, { kind: string; value?: unknown }>;
      }[];
    };
  } | null;
  compilerInput?: {
    status: string;
    problems: string[];
    census?: {
      elements: number;
      textRuns: number;
      pseudoPlanes: number;
      tokenCandidateChannels: number;
    };
    boundary?: { kind: string; reason: string }[];
  } | null;
}
interface Job {
  id: string;
  state: string;
  startedAt?: string;
  completedAt?: string;
  recovered?: boolean;
  sourceRevision: string;
  theme: string;
  qualified: number;
  denominator: number;
  rows: Row[];
  problem?: string;
}
function problemText(problem: string) {
  if (problem === "probe-state-mismatch:input:disabled")
    return "The disabled story still exposes an enabled native control.";
  if (problem === "resource-failure")
    return "A required source asset failed to load.";
  if (problem.startsWith("probe-state-mismatch:image:"))
    return "The source image did not decode at its expected dimensions.";
  if (problem === "font-substitution")
    return "The browser painted a fallback font, not the design-system font.";
  if (problem === "readiness-timeout")
    return "The rendering did not finish loading within the time limit.";
  if (problem === "source-changed-during-capture")
    return "Source files changed during validation. This run cannot become an answer key.";
  if (problem.startsWith("style-mismatch:"))
    return `The rendered ${problem.split(":")[1]} does not match the source specification.`;
  return "A source check failed; inspect the diagnostic below before proceeding.";
}
export function Sources() {
  const [origin, setOrigin] = useState("http://127.0.0.1:6017");
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("atoms-button--default");
  useEffect(() => {
    let alive = true;
    fetch("/api/source-reference")
      .then(async (r) => {
        if (
          !r.ok ||
          !r.headers.get("content-type")?.includes("application/json")
        )
          throw new Error();
        return r.json();
      })
      .then((data) => {
        if (alive) {
          setReady(true);
          setJob(data.latest);
          if (!data.checkoutAvailable)
            setError(
              "The pinned Altitude checkout is not available beside this repository. Source connection cannot run until that library is present.",
            );
        }
      })
      .catch(() => {
        if (alive)
          setError(
            "Live source validation is available in the local app (npm run playground), not this static deployment.",
          );
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (job?.state !== "running") return;
    let alive = true;
    const timer = setInterval(
      () =>
        fetch(`/api/source-reference/${job.id}`)
          .then(async (r) => {
            if (!r.ok) throw new Error();
            return r.json();
          })
          .then((data) => {
            if (alive) {
              setJob(data);
              setError("");
            }
          })
          .catch(() => {
            if (alive)
              setError(
                "Connection lost. Refresh to reconnect; no result is assumed successful.",
              );
          }),
      1500,
    );
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [job?.id, job?.state]);
  async function validate() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/source-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setJob(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation could not start.");
    } finally {
      setBusy(false);
    }
  }
  const row = job?.rows.find((r) => r.story === selected);
  return (
    <div className="source-workspace">
      <p className="source-eyebrow">Code → design · source connection</p>
      <h1>Verify the source before generating design.</h1>
      <p>
        Connect the original styled Storybook. Keep its fonts, theme, assets and
        states intact; compare a fresh, network-isolated replay before treating
        it as an answer key.
      </p>
      <form
        className="source-connect"
        onSubmit={(e) => {
          e.preventDefault();
          void validate();
        }}
      >
        <label>
          Altitude Storybook origin
          <input
            type="url"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            required
          />
        </label>
        <button disabled={!ready || busy || job?.state === "running"}>
          {busy
            ? "Connecting…"
            : job?.state === "running"
              ? "Validating all 10 states…"
              : "Connect and validate"}
        </button>
      </form>
      <p className="source-note">
        Current adapter: the pinned sibling Altitude Web Component library, dark
        theme. Start its existing Storybook and enter its local origin. No
        source files or Figma files are changed. Other libraries are not yet
        supported by this screen.
      </p>
      {error && <p role="alert">{error}</p>}
      {job && (
        <>
          <section
            className="source-status"
            aria-label="Independent validation statuses"
          >
            <div>
              <span>Source references</span>
              <strong>
                {job.qualified} / {job.denominator} valid
              </strong>
              <small>
                {job.state === "running"
                  ? "Capture/replay in progress; source integrity pending"
                  : job.state}
              </small>
            </div>
            <div>
              <span>API and content intake</span>
              <strong>
                {
                  job.rows.filter(
                    (r) => r.semanticIntake?.status === "observed",
                  ).length
                }{" "}
                / {job.denominator} observed
              </strong>
              <small>Inventory only — contract not accepted</small>
            </div>
            <div>
              <span>Figma fidelity</span>
              <strong>Not measured</strong>
            </div>
            <div>
              <span>Reusable output / behavior</span>
              <strong>Not qualified</strong>
            </div>
            <div>
              <span>Complete workflow</span>
              <strong>Not complete</strong>
            </div>
          </section>
          <p className="source-note">
            {job.theme} · Source revision <code>{job.sourceRevision}</code> ·
            {job.startedAt
              ? ` Started ${new Date(job.startedAt).toLocaleString()}`
              : job.completedAt
                ? ` Recorded ${new Date(job.completedAt).toLocaleString()}`
                : " Time not recorded"}
          </p>
          {job.recovered && (
            <p role="note">
              Recovered completed evidence after a server restart. These are
              recorded results, not a new source check or permission to
              generate.
            </p>
          )}
          {job.problem && <p role="alert">{job.problem}</p>}
          <div className="source-evidence">
            <nav aria-label="All selected source states">
              {job.rows.map((r) => (
                <button
                  key={r.story}
                  aria-pressed={selected === r.story}
                  onClick={() => setSelected(r.story)}
                >
                  <span>{r.story.replace("--", " / ")}</span>
                  <small>Source: {r.status.replaceAll("-", " ")}</small>
                  <small>
                    API:{" "}
                    {r.semanticIntake?.status.replaceAll("-", " ") ??
                      "not observed"}
                  </small>
                </button>
              ))}
            </nav>
            {row && (
              <section aria-label="Selected source evidence">
                <h2>{row.story.replace("--", " / ")}</h2>
                {row.compilerInput && (
                  <div className="source-note">
                    <strong>
                      Compiler input:{" "}
                      {row.compilerInput.status.replaceAll("-", " ")}
                    </strong>
                    {row.compilerInput.census && (
                      <p>
                        {row.compilerInput.census.elements} elements ·{" "}
                        {row.compilerInput.census.textRuns} text runs ·{" "}
                        {row.compilerInput.census.pseudoPlanes} pseudo-element
                        planes ·{" "}
                        {row.compilerInput.census.tokenCandidateChannels}{" "}
                        channels with token candidates. Read from the original
                        rendered tree, then compared with its independent
                        replay.
                      </p>
                    )}
                    {!!row.compilerInput.boundary?.length && (
                      <p>
                        {row.compilerInput.boundary.length} stylesheet
                        boundaries could not be read. These remain conversion
                        limitations.
                      </p>
                    )}
                    {row.compilerInput.problems.length > 0 && (
                      <p>
                        Capture cannot proceed:{" "}
                        {row.compilerInput.problems.join(", ")}
                      </p>
                    )}
                  </div>
                )}
                <div className="source-images">
                  {(
                    [
                      ["Original styled source", row.sourceImage],
                      ["Independent replay — not Figma", row.replayImage],
                    ] as const
                  ).map(([title, src]) => (
                    <figure key={title}>
                      <figcaption>{title}</figcaption>
                      {src ? (
                        <a href={src} target="_blank" rel="noreferrer">
                          <img src={src} alt={`${row.story}: ${title}`} />
                        </a>
                      ) : (
                        <p>Not captured yet.</p>
                      )}
                    </figure>
                  ))}
                </div>
                {row.semanticIntake && (
                  <section aria-label="Semantic contract intake">
                    <h3>
                      Component API and content — {row.semanticIntake.status}
                    </h3>
                    <p>
                      Declared metadata is compared with the actual custom
                      element and its replay. These are inputs to a contract
                      proposal, not an accepted contract or proof of reusable
                      output.
                    </p>
                    {row.semanticIntake.coverage && (
                      <p>
                        <code>{row.semanticIntake.tagName}</code>:{" "}
                        {row.semanticIntake.coverage.declaredProperties}{" "}
                        declared properties,{" "}
                        {row.semanticIntake.coverage.observedScalarProperties}{" "}
                        observed scalar values;{" "}
                        {row.semanticIntake.coverage.renderedSlots} of{" "}
                        {row.semanticIntake.coverage.declaredSlots} slots
                        rendered in this state;{" "}
                        {row.semanticIntake.coverage.declaredEvents} declared
                        events (behavior not yet tested).
                      </p>
                    )}
                    {!!row.semanticIntake.problems.length && (
                      <p>
                        Intake blocked: {row.semanticIntake.problems.join(", ")}
                      </p>
                    )}
                    {row.semanticIntake.declaration && (
                      <details>
                        <summary>
                          Declared API versus observed source state
                        </summary>
                        <ul>
                          {row.semanticIntake.declaration.properties.map(
                            (property, index) => {
                              const actual =
                                row.semanticIntake?.observation?.properties[
                                  property.name
                                ];
                              return (
                                <li key={`${property.name}-${index}`}>
                                  <code>{property.name}</code> (
                                  {property.typeText ?? "type not declared"}):
                                  observed{" "}
                                  <code>
                                    {actual?.kind === "value"
                                      ? JSON.stringify(actual.value)
                                      : (actual?.kind ?? "missing")}
                                  </code>
                                  ; declared default:{" "}
                                  <code>
                                    {property.default ?? "not declared"}
                                  </code>
                                </li>
                              );
                            },
                          )}
                        </ul>
                        <p>
                          Declared slots:{" "}
                          {row.semanticIntake.declaration.slots
                            .map((slot) => slot.name || "(default)")
                            .join(", ") || "none"}
                          .
                        </p>
                        <p>
                          Rendered slots:{" "}
                          {row.semanticIntake.observation?.slots
                            .map((slot) => slot.name || "(default)")
                            .join(", ") || "none"}
                          . A conditional slot missing from this state is not
                          assumed absent from the component.
                        </p>
                        <p>
                          Declared events:{" "}
                          {row.semanticIntake.declaration.events
                            .map((event) => event.name)
                            .join(", ") || "none"}
                          . Names are preserved verbatim, not rewritten as
                          guessed callbacks.
                        </p>
                        <pre>
                          {JSON.stringify(
                            row.semanticIntake.observation?.nativeElements,
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    )}
                    <details>
                      <summary>Unresolved semantic evidence</summary>
                      <ul>
                        {row.semanticIntake.limitations.map((limit, index) => (
                          <li key={index}>{limit}</li>
                        ))}
                      </ul>
                    </details>
                  </section>
                )}
                {row.problems.length > 0 && (
                  <div role="note">
                    <h3>Reference rejected</h3>
                    <ul>
                      {row.problems.map((p) => (
                        <li key={p}>
                          {problemText(p)}{" "}
                          <details>
                            <summary>Diagnostic</summary>
                            <code>{p}</code>
                          </details>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <h3>What this result does not prove</h3>
                <ul>
                  {row.limitations.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <p>
                  Recorded resources reproduce the loaded bytes, not an
                  independent dependency rebuild. Passing source checks does not
                  establish conversion fidelity or grant release approval.
                </p>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
