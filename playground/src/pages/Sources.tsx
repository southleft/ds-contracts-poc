import { useEffect, useState } from "react";
import type { SourceContractPlan } from "../../../source-reference/contract-plan";
import type { SourceBindingInventory } from "../../../source-reference/source-bindings";
import type { BindingJobSnapshot } from "../../../source-reference/binding-jobs";
import type { CandidateJobSnapshot } from "../../../source-reference/candidate-jobs";
import type { NativeOperationSnapshot } from "../../../source-reference/native-operation-jobs";
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
  sourceStable?: boolean;
  supplements?: Job[];
  bindingTraces?: BindingJobSnapshot[];
  candidatePreparations?: CandidateJobSnapshot[];
  candidateVisuals?: CandidateJobSnapshot[];
  nativeOperation?: NativeOperationSnapshot | null;
  nativeConnection?: {
    paired: boolean;
    connected: boolean;
    started: boolean;
    finished: boolean;
  } | null;
  contractAdmission?: {
    status: "blocked";
    acceptedContract: null;
    plans: SourceContractPlan[];
    sourceBindings: SourceBindingInventory[];
    problems: string[];
  };
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

function RenderedBindingTrace({ trace }: { trace: BindingJobSnapshot }) {
  const [selectedStory, setSelectedStory] = useState("atoms-button--default");
  const [selectedCase, setSelectedCase] = useState("0:0");
  const [unavailableImages, setUnavailableImages] = useState<string[]>([]);
  const row =
    trace.rows.find((item) => item.story === selectedStory) ?? trace.rows[0];
  const cases =
    row?.differentials.flatMap((probe, probeIndex) =>
      (probe.result?.cases ?? []).map((item, caseIndex) => ({
        id: `${probeIndex}:${caseIndex}`,
        probe,
        probeIndex,
        caseIndex,
        item,
      })),
    ) ?? [];
  const selected = cases.find((item) => item.id === selectedCase) ?? cases[0];
  const observed = trace.rows.reduce(
    (total, item) => total + item.observedDependencies,
    0,
  );
  const planned = trace.rows.reduce(
    (total, item) => total + item.plannedDependencies,
    0,
  );
  return (
    <div className="source-binding-results">
      <p role="status">
        <strong>
          {trace.matched} / {trace.denominator} states structurally matched
        </strong>
        {" · "}
        {trace.state}.
        {trace.state === "running" &&
          " Recorded-source replay is running; final results are pending."}
        {trace.state === "interrupted" &&
          " The previous process stopped. Retry to create a new attempt; no success is assumed."}
        {trace.state === "failed" &&
          " The trace failed or its recorded evidence no longer validates."}
      </p>
      {trace.problems.map((problem, index) => (
        <p role="alert" key={index}>
          {problem}
        </p>
      ))}
      {trace.rows.length > 0 && (
        <>
          <p>
            <strong>
              {observed} / {planned} planned dependencies observed
            </strong>{" "}
            in finite probes of the default Button only. A structural match is
            not proof of every attribute, state or behavior.
          </p>
          <div className="source-binding-table-wrap">
            <table className="source-binding-table">
              <caption>Every selected Button state, including refusals</caption>
              <thead>
                <tr>
                  <th scope="col">Source state</th>
                  <th scope="col">Structure</th>
                  <th scope="col">Elements / slots</th>
                  <th scope="col">Dependencies</th>
                </tr>
              </thead>
              <tbody>
                {trace.rows.map((item) => (
                  <tr key={item.story}>
                    <th scope="row">
                      <button
                        type="button"
                        aria-pressed={row?.story === item.story}
                        onClick={() => {
                          setSelectedStory(item.story);
                          setSelectedCase("0:0");
                        }}
                      >
                        {item.story.replace("atoms-button--", "")}
                      </button>
                    </th>
                    <td>
                      {item.status === "structure-matched"
                        ? "Matched"
                        : "Refused"}
                    </td>
                    <td>
                      {item.matchedElements} / {item.mappedSlots}
                    </td>
                    <td>
                      {item.plannedDependencies
                        ? `${item.observedDependencies} / ${item.plannedDependencies} observed`
                        : "Not probed"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {row && (
            <section aria-label="Selected rendered binding evidence">
              <h3>{row.story.replace("--", " / ")}</h3>
              {row.problems.length > 0 && (
                <ul>
                  {row.problems.map((problem, index) => (
                    <li key={index}>
                      <code>{problem}</code>
                    </li>
                  ))}
                </ul>
              )}
              {row.differentials.map((probe) => (
                <details key={probe.key}>
                  <summary>
                    {probe.key}:{" "}
                    {probe.result?.status.replaceAll("-", " ") ??
                      "not observed"}
                  </summary>
                  <ul>
                    {[...probe.problems, ...(probe.result?.problems ?? [])].map(
                      (problem, index) => (
                        <li key={index}>
                          <code>{problem}</code>
                        </li>
                      ),
                    )}
                  </ul>
                  {probe.result?.limitations.length ? (
                    <ul>
                      {probe.result.limitations.map((limit, index) => (
                        <li key={index}>{limit}</li>
                      ))}
                    </ul>
                  ) : null}
                </details>
              ))}
              {cases.length > 0 && (
                <label className="source-binding-select">
                  Inspect a controlled replay change
                  <select
                    value={selected?.id ?? ""}
                    onChange={(event) => setSelectedCase(event.target.value)}
                  >
                    {cases.map(({ id, probe, item }) => (
                      <option key={id} value={id}>
                        {probe.key} →{" "}
                        {item.value.kind === "undefined"
                          ? "(omitted / undefined)"
                          : JSON.stringify(item.value.value)}{" "}
                        · {item.status}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {selected && (
                <>
                  <p className="source-note">
                    Actual browser captures before and after this one
                    intervention, not Figma or generated output. The changed
                    capture does not replace the original answer key. ARIA-only
                    changes may look identical.
                  </p>
                  {selected.item.problems.length > 0 && (
                    <p>
                      Case refused:{" "}
                      <code>{selected.item.problems.join(", ")}</code>
                    </p>
                  )}
                  <div className="source-images source-binding-images">
                    {(["before", "after"] as const).map((phase) => {
                      const hash =
                        phase === "before"
                          ? selected.item.beforePngSha256
                          : selected.item.afterPngSha256;
                      const src = `/api/source-reference/bindings/${encodeURIComponent(trace.id)}/${encodeURIComponent(row.story)}/probe-${selected.probeIndex}-case-${selected.caseIndex}-${phase}.png`;
                      return (
                        <figure key={`${selected.id}-${phase}`}>
                          <figcaption>
                            {phase === "before"
                              ? "Before: recorded-source replay"
                              : "After: controlled source intervention"}
                          </figcaption>
                          {unavailableImages.includes(src) ? (
                            <p role="alert">
                              This recorded image is unavailable or no longer
                              validates. It cannot be used as evidence.
                            </p>
                          ) : hash && /^[a-f0-9]{64}$/.test(hash) ? (
                            <a href={src} target="_blank" rel="noreferrer">
                              <img
                                src={src}
                                alt={`${row.story}, ${selected.probe.key}, ${phase} intervention`}
                                onError={() =>
                                  setUnavailableImages((current) =>
                                    current.includes(src)
                                      ? current
                                      : [...current, src],
                                  )
                                }
                              />
                            </a>
                          ) : (
                            <p>No verified image recorded for this case.</p>
                          )}
                        </figure>
                      );
                    })}
                  </div>
                </>
              )}
              {!cases.length && (
                <p>
                  No controlled dependency probes were recorded for this state.{" "}
                  {row.status === "refused"
                    ? "The refusal remains in the denominator."
                    : "Only its structural correspondence was checked."}
                </p>
              )}
            </section>
          )}
        </>
      )}
      <details>
        <summary>Trace identity</summary>
        <code>{trace.id}</code>
      </details>
    </div>
  );
}
export function Sources() {
  const [origin, setOrigin] = useState("http://127.0.0.1:6017");
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nativeConnection, setNativeConnection] = useState("");
  const [selected, setSelected] = useState("atoms-button--default");
  const capturing =
    job?.state === "running" ||
    !!job?.supplements?.some((supplement) => supplement.state === "running") ||
    !!job?.bindingTraces?.some((trace) => trace.state === "running") ||
    !!job?.candidatePreparations?.some(
      (candidate) => candidate.state === "running",
    ) ||
    !!job?.candidateVisuals?.some(
      (candidate) => candidate.state === "running",
    ) ||
    (!!job?.nativeConnection?.started && !job.nativeConnection.finished);
  const polling =
    capturing ||
    (!!job?.nativeConnection?.paired && !job.nativeConnection.finished);
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
    if (!polling || !job) return;
    let alive = true;
    let pending = false;
    const timer = setInterval(() => {
      if (pending) return;
      pending = true;
      void fetch(`/api/source-reference/${job.id}`)
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
        })
        .finally(() => {
          pending = false;
        });
    }, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [job?.id, polling]);
  async function nativeAction(
    action: "connection" | "start" | "retry-observation",
  ) {
    if (!job) return;
    setBusy(true);
    setError("");
    const post = async (suffix: string) => {
      const response = await fetch(
        `/api/source-reference/${job.id}/button-native-${suffix}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error ?? "Native operation unavailable.");
      return data;
    };
    try {
      if (action === "connection") {
        if (!job.nativeOperation) await post("operation");
        const paired = await post("connection");
        setNativeConnection(paired.connection);
        const refreshed = await fetch(`/api/source-reference/${job.id}`);
        if (!refreshed.ok)
          throw Error("Connection prepared; refresh to inspect the operation.");
        setJob(await refreshed.json());
      } else setJob(await post(action));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Native operation unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
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
  async function captureMissingVariants() {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/source-reference/${job.id}/button-variants`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin, retry: true }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setJob(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Supplemental capture could not start.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function traceRenderedBindings() {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/source-reference/${job.id}/button-bindings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            job.bindingTraces?.length ? { retry: true } : {},
          ),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setJob(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Binding replay could not start.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function prepareSourceCandidate() {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/source-reference/${job.id}/button-candidate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            job.candidatePreparations?.length ? { retry: true } : {},
          ),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setJob(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Source candidate preparation could not start.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function deriveVisualCandidate() {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/source-reference/${job.id}/button-visual-candidate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            visualCandidate?.state === "failed" ||
              visualCandidate?.state === "interrupted" ||
              visualCandidate?.phase === "visual-refused"
              ? { retry: true }
              : {},
          ),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setJob(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Visual candidate derivation could not start.",
      );
    } finally {
      setBusy(false);
    }
  }
  const supplement = job?.supplements?.at(-1);
  const bindingTrace = job?.bindingTraces?.at(-1);
  const candidate = job?.candidatePreparations?.at(-1);
  const visualCandidate = job?.candidateVisuals?.at(-1);
  const allRows = [...(job?.rows ?? []), ...(supplement?.rows ?? [])];
  const row = allRows.find((r) => r.story === selected);
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
        <button disabled={!ready || busy || capturing}>
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
          <section
            className="source-admission"
            aria-label="Component contract admission"
          >
            <h2>What still prevents an editable component?</h2>
            <p>
              Source validity is not component completeness. This work order
              rechecks the recorded images, trees and declared API together. No
              contract is accepted while bindings and behavior are unproven.
            </p>
            {job.contractAdmission?.problems.map((problem) => (
              <p key={problem}>
                <code>{problem}</code>
              </p>
            ))}
            {job.contractAdmission?.plans.map((plan) => (
              <article key={plan.component.tagName}>
                <h3>
                  <code>{plan.component.tagName}</code> · contract blocked
                </h3>
                <p>
                  {plan.evidence.observedStories.length} recorded states
                  contribute semantic evidence;{" "}
                  {plan.evidence.rejectedStories.length} refused. No Figma
                  result is implied.
                </p>
                <ul>
                  {plan.enumDomains.map((domain) => (
                    <li key={domain.property}>
                      <strong>
                        {domain.property}: {domain.observed} / {domain.total}{" "}
                        states observed
                      </strong>
                      {domain.omission &&
                        " (including omission; no public default invented)"}
                      .
                      {domain.missing.length > 0 &&
                        ` Missing: ${domain.missing.map((state) => (state.kind === "omitted" ? "(omitted)" : state.value)).join(", ")}.`}
                    </li>
                  ))}
                </ul>
                <details>
                  <summary>
                    Unresolved bindings, behavior and coverage (
                    {plan.findings.length})
                  </summary>
                  <ul>
                    {plan.findings.map((finding, index) => (
                      <li key={index}>
                        <code>
                          {finding.code}
                          {finding.property
                            ? `: ${finding.property}`
                            : finding.slot !== undefined
                              ? `: ${finding.slot || "(default slot)"}`
                              : ""}
                        </code>{" "}
                        {finding.message}
                        {finding.story && ` (${finding.story})`}
                      </li>
                    ))}
                  </ul>
                </details>
                {job.contractAdmission?.sourceBindings
                  ?.filter((facts) => facts.tagName === plan.component.tagName)
                  .map((facts) => (
                    <details key={facts.tagName}>
                      <summary>
                        Trace the actual source:{" "}
                        {facts.status === "refused"
                          ? "source identity refused"
                          : "syntax read; runtime bindings unverified"}
                      </summary>
                      <p>
                        <code>{facts.entry.path}</code> ·{" "}
                        {facts.entry.className}. {facts.modules.length} local
                        code files hash-checked against this recorded run. This
                        is not a generated component or a complete behavior
                        contract.
                      </p>
                      <p>
                        Source inventory digest: <code>{facts.digest}</code>
                      </p>
                      <h4>Authored render branches and slots</h4>
                      <ul>
                        {facts.templates.map((template) => (
                          <li key={template.id}>
                            Line {template.line}: {template.role} template ·{" "}
                            {template.roots.join(", ") || "no static root"}
                            {template.guards.map((guard, index) => (
                              <span key={index}>
                                {" "}
                                · <code>{guard.expression}</code> is{" "}
                                {guard.when}
                              </span>
                            ))}
                            {template.guardAlternatives &&
                              ` · unresolved shared template with ${template.guardAlternatives.length} alternative guard paths; the displayed path is not exclusive`}
                            {template.slots.length > 0 &&
                              ` · slots: ${template.slots.map((slot) => slot || "(default)").join(", ")}`}
                            {!template.syntaxComplete &&
                              " · contains unsupported syntax"}
                          </li>
                        ))}
                      </ul>
                      <h4>Attribute, property and event expressions</h4>
                      <p>
                        These are source expressions, not inferred matches to
                        screenshot text. Rendered-part identity and target
                        preservation remain unproven.
                      </p>
                      <ul>
                        {facts.bindings.map((binding, index) => (
                          <li key={index}>
                            Line {binding.line}: <code>{binding.tag}</code> ·{" "}
                            {binding.channel} <code>{binding.target}</code> ←{" "}
                            <code>{binding.expression}</code> (
                            {binding.syntaxKind})
                          </li>
                        ))}
                      </ul>
                      <h4>Classes in the local import graph</h4>
                      <p>
                        Includes base and controller declarations; this is not a
                        resolved inheritance chain.
                      </p>
                      <ul>
                        {facts.classes.map((cls) => (
                          <li key={`${cls.modulePath}:${cls.name}`}>
                            <code>{cls.name}</code>
                            {cls.extends && (
                              <>
                                {" "}
                                extends <code>{cls.extends}</code>
                              </>
                            )}{" "}
                            · public members:{" "}
                            {cls.publicMembers.join(", ") || "none"}
                          </li>
                        ))}
                      </ul>
                      <ul>
                        {facts.problems.map((problem, index) => (
                          <li key={index}>
                            <code>{problem}</code>
                          </li>
                        ))}
                      </ul>
                      <ul>
                        {facts.limitations.map((limitation, index) => (
                          <li key={index}>{limitation}</li>
                        ))}
                      </ul>
                    </details>
                  ))}
              </article>
            ))}
          </section>
          <section
            className="source-admission"
            aria-label="Additional Button appearance evidence"
          >
            <h2>Complete the Button appearance evidence</h2>
            <p>
              The original cohort covers the omitted and secondary appearances.
              Its declared API also includes tertiary, bare and danger. Capture
              those three original stories without rerunning or replacing the
              ten-state baseline above.
            </p>
            <div className="source-connect">
              <button
                type="button"
                disabled={
                  busy ||
                  capturing ||
                  job.state !== "complete" ||
                  job.sourceStable !== true ||
                  (supplement?.state === "complete" &&
                    supplement.qualified === supplement.denominator)
                }
                onClick={() => void captureMissingVariants()}
              >
                {supplement?.state === "running"
                  ? "Capturing missing Button states…"
                  : supplement?.state === "complete" &&
                      supplement.qualified === supplement.denominator
                    ? "Supplemental capture complete"
                    : supplement
                      ? "Retry missing Button states"
                      : "Capture missing Button states"}
              </button>
            </div>
            {supplement && (
              <p>
                Additional source references:{" "}
                <strong>
                  {supplement.qualified} / {supplement.denominator} valid
                </strong>{" "}
                · {supplement.state}. The baseline denominator and rejected
                states are unchanged.
              </p>
            )}
            {supplement?.problem && <p role="alert">{supplement.problem}</p>}
            {(job.supplements?.length ?? 0) > 1 && (
              <details>
                <summary>Preserved supplemental attempts</summary>
                <ul>
                  {job.supplements!.map((attempt) => (
                    <li key={attempt.id}>
                      <code>{attempt.id}</code>: {attempt.qualified}/
                      {attempt.denominator} source references valid ·{" "}
                      {attempt.state}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="source-note">
              Same pinned source bytes required. This does not prove
              prop-to-part bindings, token bindings, interaction behavior or a
              generatable contract. No source or Figma files are changed.
            </p>
          </section>
          <section
            className="source-admission source-binding-trace"
            aria-label="Rendered source binding trace"
          >
            <h2>Trace rendered bindings</h2>
            <p>
              Join the pinned source syntax to its actual rendered elements and
              slots. Replay all four original Button states, plus the three
              supplemental appearances when recorded; retain every refused state
              in the result. No original capture is replaced.
            </p>
            <p className="source-note">
              Controlled probes are limited to three dependencies in the default
              Button: label → aria-label, isDisabled → aria-disabled, and
              default slot text. This does not prove the complete API, token
              bindings, interactions or conversion. No contract is accepted and
              no Figma file or source file is changed.
            </p>
            <div className="source-connect">
              <button
                type="button"
                disabled={
                  busy ||
                  capturing ||
                  job.state !== "complete" ||
                  job.sourceStable !== true ||
                  (!!supplement && supplement.state !== "complete")
                }
                onClick={() => void traceRenderedBindings()}
              >
                {bindingTrace?.state === "running"
                  ? "Tracing rendered bindings…"
                  : bindingTrace
                    ? "Retry rendered binding trace"
                    : "Trace rendered bindings"}
              </button>
            </div>
            {bindingTrace ? (
              <RenderedBindingTrace
                key={bindingTrace.id}
                trace={bindingTrace}
              />
            ) : (
              <p>No rendered binding trace recorded yet.</p>
            )}
            {(job.bindingTraces?.length ?? 0) > 1 && (
              <details>
                <summary>Preserved binding trace attempts</summary>
                <ul>
                  {job.bindingTraces!.map((attempt) => (
                    <li key={attempt.id}>
                      <code>{attempt.id}</code>: {attempt.matched} /{" "}
                      {attempt.denominator} structurally matched ·{" "}
                      {attempt.state}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
          <section
            className="source-admission"
            aria-label="Source candidate preparation"
          >
            <h2>Source candidate preparation</h2>
            <p>
              Prepare the pinned original runtime and source semantics from the
              latest verified binding trace and its exact baseline and
              supplement. Previous captures and preparation attempts are
              preserved.
            </p>
            <p className="source-note">
              Preparation does not accept a Contract or produce native Figma
              output. A measured visual candidate can then be derived from the
              same verified evidence. Native comparison and the complete
              conversion journey remain pending.
            </p>
            <div className="source-connect">
              <button
                type="button"
                disabled={
                  busy ||
                  capturing ||
                  job.state !== "complete" ||
                  job.sourceStable !== true ||
                  bindingTrace?.state !== "complete" ||
                  (!!supplement && supplement.state !== "complete")
                }
                onClick={() => void prepareSourceCandidate()}
              >
                {candidate?.state === "running"
                  ? "Preparing source candidate…"
                  : candidate
                    ? "Retry source candidate preparation"
                    : "Prepare source candidate"}
              </button>
            </div>
            <p role="status">
              {!candidate
                ? "No source candidate preparation recorded yet."
                : candidate.phase === "prepared"
                  ? "Source/runtime prepared; visual contract and native verification still pending."
                  : candidate.state === "running"
                    ? "Preparing the original source/runtime. No result is assumed successful."
                    : candidate.state === "interrupted"
                      ? "Preparation was interrupted. Retry creates a new attempt; no success is assumed."
                      : "Source candidate preparation failed or its recorded evidence no longer validates."}
            </p>
            {candidate?.problems.map((problem, index) => (
              <p role="alert" key={index}>
                <code>{problem}</code>
              </p>
            ))}
            {candidate?.phase === "prepared" && (
              <div
                className="source-status"
                aria-label="Prepared source inventory, not conversion results"
              >
                {(
                  [
                    ["plannedCases", "Source cases planned"],
                    ["structurallyMatchedCases", "Structurally matched"],
                    ["refusedCases", "Refused cases"],
                    ["variantStates", "Style variants observed"],
                    ["slots", "Source slots retained"],
                    ["writableProperties", "Writable source properties"],
                  ] as const
                ).map(([key, label]) =>
                  candidate.counters[key] === undefined ? null : (
                    <div key={key}>
                      <strong>{candidate.counters[key]}</strong>
                      <small>{label}</small>
                    </div>
                  ),
                )}
              </div>
            )}
            {(job.candidatePreparations?.length ?? 0) > 1 && (
              <details>
                <summary>Preserved candidate preparation attempts</summary>
                <ul>
                  {job.candidatePreparations!.map((attempt) => (
                    <li key={attempt.id}>
                      <code>{attempt.id}</code>: {attempt.phase}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {(candidate?.phase === "prepared" || visualCandidate) && (
              <section aria-label="Measured visual candidate">
                <h3>Measured visual candidate</h3>
                <p>
                  Derive source-owned structure, observed styles and recorded
                  token references and conditional wrappers from the verified
                  preparation. Source slots remain separate from comparison
                  content; missing cases and unsupported wrappers stay visible
                  as limitations.
                </p>
                <div className="source-connect">
                  <button
                    type="button"
                    disabled={
                      busy ||
                      capturing ||
                      candidate?.phase !== "prepared" ||
                      job.state !== "complete" ||
                      job.sourceStable !== true ||
                      bindingTrace?.state !== "complete" ||
                      (!!supplement && supplement.state !== "complete")
                    }
                    onClick={() => void deriveVisualCandidate()}
                  >
                    {visualCandidate?.state === "running"
                      ? "Deriving measured visual candidate…"
                      : visualCandidate?.state === "failed" ||
                          visualCandidate?.state === "interrupted" ||
                          visualCandidate?.phase === "visual-refused"
                        ? "Retry visual candidate derivation"
                        : "Derive measured visual candidate"}
                  </button>
                </div>
                <p role="status">
                  {!visualCandidate
                    ? "No measured visual candidate recorded yet."
                    : visualCandidate.phase === "measured-candidate"
                      ? "Measured visual candidate; not accepted or emitted. Native verification remains pending."
                      : visualCandidate.phase === "visual-refused"
                        ? "Visual derivation completed with a refusal. The evidence and refused cases are preserved."
                        : visualCandidate.state === "running"
                          ? "Deriving the visual candidate from existing evidence and runtime."
                          : visualCandidate.state === "interrupted"
                            ? "Visual derivation was interrupted. Retry creates a new attempt."
                            : "Visual derivation failed or its recorded evidence no longer validates."}
                </p>
                {!!visualCandidate?.problems.length && (
                  <div>
                    <h4>Still to verify</h4>
                    <ul>
                      {[
                        ...new Set(
                          visualCandidate.problems.map(
                            (problem) =>
                              (
                                ({
                                  "candidate-visual-contract-unaccepted":
                                    "Confirm that the proposed component preserves the source structure and styles.",
                                  "candidate-runtime-binding-unqualified":
                                    "Verify that the retained source behavior matches this candidate.",
                                  "candidate-native-projection-unverified":
                                    "Create and independently compare the native Figma output.",
                                  "candidate-token-bindings-observations-only":
                                    "Unrecorded token identities and native bindings remain unverified.",
                                  "candidate-source-cases-refused":
                                    "Resolve the refused source cases; they remain in the coverage total.",
                                  "candidate-wrapper-source-case-refused":
                                    "Resolve the refused source cases; they remain in the coverage total.",
                                  "candidate-visual-refused":
                                    "The recorded evidence could not support a measured visual candidate.",
                                  "candidate-token-bindings-refused":
                                    "The recorded token evidence could not be qualified.",
                                  "candidate-token-projection-unaccepted":
                                    "Verify the projected token references against native variable identities and modes.",
                                  "candidate-wrapper-snapshots-only":
                                    "Verify conditional wrappers beyond the recorded snapshots, including native slot edits.",
                                  "candidate-wrapper-branches-unprojected":
                                    "Verify the remaining source branches before widening this candidate.",
                                  "candidate-token-projection-refused":
                                    "Recorded token references could not be safely projected into the candidate.",
                                  "candidate-wrapper-projection-refused":
                                    "The source wrapper conditions did not match the recorded component structure.",
                                  "candidate-evidence-unavailable-or-changed":
                                    "Recheck evidence that is missing or has changed before retrying.",
                                  "candidate-visual-assembly-failed":
                                    "Derivation could not finish. Inspect its recorded details before retrying.",
                                  "candidate-job-history-invalid":
                                    "A saved attempt cannot be read or verified. Its history is preserved.",
                                }) as Record<string, string>
                              )[problem] ??
                              "A recorded check still needs review before this candidate can proceed.",
                          ),
                        ),
                      ].map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                    <details>
                      <summary>Technical details</summary>
                      <ul>
                        {visualCandidate.problems.map((problem, index) => (
                          <li key={index}>
                            <code>{problem}</code>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                )}
                {(visualCandidate?.phase === "measured-candidate" ||
                  visualCandidate?.phase === "visual-refused") && (
                  <div
                    className="source-status"
                    aria-label="Measured visual inventory, not conversion results"
                  >
                    {(
                      [
                        ["plannedCases", "Source cases planned"],
                        ["projectedCases", "Cases projected"],
                        ["refusedCases", "Refused cases"],
                        ["stylePlanes", "Style appearances observed"],
                        ["observedChannels", "Style channels observed"],
                        ["excludedChannels", "Style channels excluded"],
                        ["boundTokenChannels", "Named token correspondences"],
                        ["projectedTokenPaths", "Source token names retained"],
                        [
                          "projectedTokenAddresses",
                          "Token references projected",
                        ],
                        ["wrapperPredicates", "Source wrapper conditions"],
                        ["wrapperSnapshots", "Wrapper snapshots matched"],
                        [
                          "unprojectedWrapperPredicates",
                          "Unprojected wrapper conditions",
                        ],
                        [
                          "ambiguousTokenChannels",
                          "Ambiguous recorded references",
                        ],
                        [
                          "unresolvedTokenChannels",
                          "Unresolved recorded references",
                        ],
                      ] as const
                    ).map(([key, label]) =>
                      visualCandidate.counters[key] === undefined ? null : (
                        <div key={key}>
                          <strong>{visualCandidate.counters[key]}</strong>
                          <small>{label}</small>
                        </div>
                      ),
                    )}
                  </div>
                )}
                <p className="source-note">
                  Observed styles and token-name matches do not qualify runtime
                  behavior or native Figma output. No Contract is accepted by
                  this step.
                </p>
                {(job.candidateVisuals?.length ?? 0) > 1 && (
                  <details>
                    <summary>Preserved visual derivation attempts</summary>
                    <ul>
                      {job.candidateVisuals!.map((attempt) => (
                        <li key={attempt.id}>
                          <code>{attempt.id}</code>: {attempt.phase}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            )}
          </section>
          {(visualCandidate?.phase === "measured-candidate" ||
            job.nativeOperation) && (
            <section
              className="source-native"
              aria-label="Native Figma inspection"
            >
              <h2>Create and inspect in Figma</h2>
              <p>
                Create this source candidate in the authorized Scratch file,
                then read its actual nodes back. Tokens, component variants and
                comparison instances share the saved source plan.
              </p>
              <ol>
                <li>
                  <a href="/ds-contracts-sync-runner-plugin.zip" download>
                    Download the current companion plugin
                  </a>
                  , import its manifest through Figma’s Development plugins
                  menu, and run it in Scratch.
                </li>
                <li>
                  Copy the connection below into Build → Connect the local
                  source workflow.
                </li>
                <li>Keep the plugin open and start the inspection here.</li>
              </ol>
              <div className="source-connect">
                <button
                  type="button"
                  disabled={busy || (!job.nativeOperation && capturing)}
                  onClick={() => void nativeAction("connection")}
                >
                  Prepare connection
                </button>
                {nativeConnection && (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(nativeConnection)
                        .catch(() =>
                          setError(
                            "Could not copy the connection. Select it in the field below.",
                          ),
                        );
                    }}
                  >
                    Copy connection
                  </button>
                )}
                <button
                  type="button"
                  disabled={
                    busy ||
                    !job.nativeConnection?.connected ||
                    job.nativeConnection.started
                  }
                  onClick={() => void nativeAction("start")}
                >
                  Create and inspect
                </button>
                {(job.nativeOperation?.pendingPhase === "token-readback" ||
                  job.nativeOperation?.pendingPhase === "component-readback" ||
                  job.nativeOperation?.phase === "observation-refused" ||
                  job.nativeOperation?.phase ===
                    "component-observation-refused") && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void nativeAction("retry-observation")}
                  >
                    Retry readback
                  </button>
                )}
              </div>
              {nativeConnection && (
                <label>
                  Connection (keep private)
                  <input
                    type="text"
                    value={nativeConnection}
                    readOnly
                    onFocus={(event) => event.target.select()}
                  />
                </label>
              )}
              <p role="status">
                {!job.nativeOperation
                  ? "No native operation prepared."
                  : job.nativeOperation.phase === "component-structure-observed"
                    ? "Supported native structure observed. Visual fidelity, editability and the complete journey are still unqualified."
                    : `Operation: ${job.nativeOperation.phase.replaceAll("-", " ")}. ${job.nativeConnection?.connected ? "Plugin connected." : "Waiting for the companion plugin."}`}
              </p>
              {job.nativeOperation && !job.nativeOperation.sourceCurrent && (
                <p>
                  The source has changed or cannot be verified. Its saved native
                  result does not establish agreement with the current source.
                </p>
              )}
              {job.nativeOperation?.nativeOutcome === "unknown" && (
                <p>
                  A dispatched operation has no verified result yet. Reconnect
                  the same plugin to deliver a saved result. Creation will not
                  repeat.
                </p>
              )}
              {!!job.nativeOperation?.problems.length && (
                <details>
                  <summary>Operation diagnostics</summary>
                  <ul>
                    {job.nativeOperation.problems.map((problem) => (
                      <li key={problem}>
                        <code>{problem}</code>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <p className="source-note">
                This creates an unaccepted inspection candidate. Structural
                readback does not establish visual fidelity or qualify v1.
              </p>
            </section>
          )}
          <div className="source-evidence">
            <nav aria-label="All selected source states">
              {allRows.map((r) => (
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
