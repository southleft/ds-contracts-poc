import { useEffect, useState } from "react";
import "./sources.css";

interface Row {
  story: string;
  status: string;
  problems: string[];
  limitations: string[];
  sourceImage: string | null;
  replayImage: string | null;
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
  startedAt: string;
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
            Started {new Date(job.startedAt).toLocaleString()}
          </p>
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
                  <small>{r.status.replaceAll("-", " ")}</small>
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
