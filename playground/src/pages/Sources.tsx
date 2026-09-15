import { useEffect, useState } from "react";
import type { SourceContractPlan } from "../../../source-reference/contract-plan";
import type { SourceBindingInventory } from "../../../source-reference/source-bindings";
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
export function Sources() {
  const [origin, setOrigin] = useState("http://127.0.0.1:6017");
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("atoms-button--default");
  const capturing =
    job?.state === "running" ||
    !!job?.supplements?.some((supplement) => supplement.state === "running");
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
    if (!capturing || !job) return;
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
  }, [job?.id, capturing]);
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
  const supplement = job?.supplements?.at(-1);
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
