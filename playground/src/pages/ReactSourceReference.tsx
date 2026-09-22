import type { ReactOwnershipReport } from "../../../source-reference/react-ownership-run";
import type { ReactProgramProposal } from "../../../source-reference/react-program-proposal";
import type {
  ReactSourceComponent,
  ReactRootFact,
} from "../../../source-reference/react-source-program";
import type { ReactValidation } from "../../../source-reference/react-reference-validation";
import { useEffect, useState } from "react";
import { ReactNativeInspection } from './ReactNativeInspection';
import { ReactSourceRepairs } from './ReactSourceRepairs';
interface Reference {
  id: string;
  source: string;
  theme: string;
  sourceFiles: number;
  qualification: "unqualified";
  validation?: ReactValidation | null;
  ownership?: ReactOwnershipReport | null;
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
  // The served cohort decides which cases exist; nothing is assumed here.
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [error, setError] = useState("");
  const [program, setProgram] = useState<{
    id: string;
    status: string;
    sourceFiles: number;
    compatibilityNotes: string[];
    proposal: ReactProgramProposal;
    components: ReactSourceComponent[];
    problems: string[];
  } | null>(null);
  const [readingProgram, setReadingProgram] = useState(false);
  const [ownership, setOwnership] = useState<ReactOwnershipReport | null>(null);
  async function traceOwnership() {
    if (!reference) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/source-reference/react/${reference.id}/ownership`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setOwnership(data);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Component structure could not be observed.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!reference || ownership?.state !== "running") return;
    let cancelled = false;
    const timer = setInterval(() => {
      void fetch(`/api/source-reference/react/${reference.id}/ownership`)
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw Error(data.error);
          if (!cancelled) setOwnership(data);
        })
        .catch((e) => {
          if (!cancelled) setError(String(e));
        });
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [reference?.id, ownership?.state]);
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
    setOwnership(null);
    setError("");
    try {
      const response = await fetch("/api/source-reference/react", {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(
          result.reason ? `${result.error} (${result.reason})` : result.error,
        );
      setReference(result);
      setSelected((previous) =>
        (result as Reference).cases.some((c) => c.id === previous)
          ? previous
          : ((result as Reference).cases[0]?.id ?? ""),
      );
      setValidation(result.validation ?? null);
      setOwnership(result.ownership ?? null);
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
      <ReactSourceRepairs onReload={()=>void load()}/>
      <p>
        Inspect the actual source components before conversion. A source
        workspace may declare its own cases; without a declaration the built-in
        shadcn cohort is used (Button, Checkbox and a composed Card, ten cases).
        Every case remains in the cohort.
      </p>
      <button
        type="button"
        onClick={() => void load()}
        disabled={
          busy ||
          readingProgram ||
          validation?.state === "running" ||
          ownership?.state === "running"
        }
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
            Original React runtime with its own theme and fonts. Figma
            fidelity, editable output and behavior remain unqualified.
          </p>
          <p>
            {reference.source} · {reference.theme} · {reference.sourceFiles}{" "}
            recorded input files ·
            Reference {reference.id.slice(0, 12)}
          </p>
          <button
            type="button"
            onClick={() => void validate()}
            disabled={
              busy ||
              readingProgram ||
              validation?.state === "running" ||
              ownership?.state === "running"
            }
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
                    {row.behavior && <details><summary>Original {row.behavior.role === 'switch' ? 'Switch' : 'Checkbox'} interactions · {row.behavior.status === 'observed' && row.behavior.restored ? 'observed and restored' : 'not verified'}</summary>
                      <p>Original React behavior only. This does not establish Figma interactions or generated React behavior.</p>
                      <ul>{row.behavior.rows.map(action => <li key={action.action}>{action.action === 'space' ? 'Space key' : 'Associated label'}: {action.before} → {action.after}; expected {action.expected} · {action.passed ? 'observed' : 'failed'}</li>)}</ul>
                    </details>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <section aria-label="React component structure">
            <h3>Component structure</h3>
            <p>
              Locate mounted components and their nested instances in the
              original render. A separate observation must match the original
              screenshot and measured tree. Finite style properties are then
              varied in an isolated copy and the original render is restored.
              This does not yet generate or qualify Figma output.
            </p>
            <button
              type="button"
              disabled={
                busy ||
                readingProgram ||
                validation?.state === "running" ||
                ownership?.state === "running"
              }
              onClick={() => void traceOwnership()}
            >
              {ownership?.state === "running"
                ? "Tracing React structure…"
                : "Trace React structure"}
            </button>
            <ReactNativeInspection key={reference.id} referenceId={reference.id} selectedCase={selected} ownership={ownership} />
            {ownership && (
              <>
                <p role="status">
                  {ownership.state === "running"
                    ? `${ownership.rows.length} of ${ownership.denominator} cases reached; results provisional.`
                    : `${ownership.matched} / ${ownership.denominator} cases matched the original during structure observation.`}
                </p>
                {ownership.problem && <p>{ownership.problem}</p>}
                {ownership.rows.map((row) => (
                  <details key={row.id}>
                    <summary>
                      {row.id} ·{" "}
                      {ownership.state === "running"
                        ? "provisional"
                        : row.matched
                          ? "render unchanged"
                          : "not verified"}
                    </summary>
                    {row.problems.length > 0 && (
                      <p>{row.problems.join(" · ")}</p>
                    )}
                    <ul>
                      {row.ownership?.components.map((instance) => (
                        <li key={instance.id}>
                          {instance.source.exportName}
                          {instance.parent
                            ? ` inside ${row.ownership?.components.find((i) => i.id === instance.parent)?.source.exportName ?? "unresolved parent"}`
                            : " at the selected root"}{" "}
                          · {instance.roots.length} rendered root
                          {instance.roots.length === 1 ? "" : "s"}
                        </li>
                      ))}
                    </ul>
                    {ownership.state === "complete" && row.matched && row.anatomy && (
                      <section aria-label={`${row.id} source anatomy`}>
                        <h4>Source-to-rendered anatomy</h4>
                        <p>Observed roots and caller content are linked below. Styling rules, native behavior and generation remain unqualified.</p>
                        {row.anatomy.problems.length > 0 && <p>{row.anatomy.problems.join(" · ")}</p>}
                        <ul>{row.anatomy.instances.map(instance => (
                          <li key={instance.instanceId}>
                            {instance.source.exportName}: {instance.roots.map(root => `<${root.tag}> (${root.correspondence})`).join(", ")}
                            {instance.content === "caller-slot" ? " · reusable caller-content slot; sample children are not component anatomy" : instance.content === "nested-caller-slot" ? " · caller content inside source wrappers; native generation remains unqualified" : instance.content === "unresolved" ? " · content ownership unresolved" : " · authored or dependency-rendered content"}
                            {instance.dependencies.length > 0 && ` · ${instance.dependencies.length} nested component instance(s) kept as references`}
                            {instance.problems.length > 0 && ` · ${instance.problems.join(" · ")}`}
                          </li>
                        ))}</ul>
                      </section>
                    )}
                    {ownership.state === "complete" && row.matched && row.rootVisual && (
                      <section aria-label={`${row.id} native root check`}>
                        <h4>Native conversion check</h4>
                        <p>Checks the observed root box against the native compiler. This does not create Figma components or qualify the full component.</p>
                        {row.rootVisual.problems.length > 0 && <p>{row.rootVisual.problems.join(" · ")}</p>}
                        <ul>{row.rootVisual.roots.map(root => (
                          <li key={root.instanceId}>
                            {root.source.exportName}: {root.status === "native-compiled" ? "root layout and styles compiled; content and API assembly pending" : root.status === "style-prepared" ? "styles prepared; native layout unsupported" : "source content needs further mapping"}
                            {root.problems.length > 0 && ` · ${root.problems.join(" · ")}`}
                            {!!root.sourceBindings?.length && <ul aria-label={`${root.source.exportName} source token bindings`}>
                              {root.sourceBindings.map(binding => <li key={binding.channel}>
                                {binding.channel}: {binding.tokenPath ? `${binding.variable} retained as a shared source token` : `source binding unresolved (${binding.reason})`}
                              </li>)}
                            </ul>}
                            {!!root.residuals?.length && ` · ${root.residuals.length} style facts remain outside the projection`}
                            {!!root.residuals?.length && <details>
                              <summary>Unprojected styles for {root.source.exportName}</summary>
                              <ul>{root.residuals.map((fact, index) => <li key={`${fact.channel}-${index}`}>{fact.channel}: {fact.reason}</li>)}</ul>
                            </details>}
                          </li>
                        ))}</ul>
                        <p>Measured values are provisional. Sample sizes, other property combinations, unresolved token bindings, token modes and native visual fidelity remain unqualified.</p>
                      </section>
                    )}
                    {ownership.state === "complete" && row.matched && row.rootMatrix && (
                      <section aria-label={`${row.id} root matrix`}>
                        <h4>Combined root style draft</h4>
                        <p>{row.rootMatrix.draft?.properties.length === 0 ? "The unchanged source baseline is observed without changing its inputs." : "Selected finite properties are observed together."} The draft preserves their root styling and a replaceable children slot. Fixed source sizes are retained where their origin is verified. Boolean state, nested styling, responsive sizing and native visual fidelity remain unqualified.</p>
                        {row.rootMatrix.problems.length>0 && <p>{row.rootMatrix.problems.join(" · ")}</p>}
                        {row.rootMatrix.draft && [row.rootMatrix.draft].map(draft=><details key="draft">
                          <summary>{draft.properties.join(" × ") || "Unchanged source baseline"}: {draft.status==="native-compiled"?`${draft.native?.variants.length} native root combinations compiled`:draft.status==="style-prepared"?"styles prepared; native compilation incomplete":"assembly refused"}</summary>
                          {draft.problems.length>0 && <p>{draft.problems.join(" · ")}</p>}
                          {draft.contract?.props.map(prop=><p key={prop.name}>{prop.name}: {Object.values(prop.bindings.code.values ?? (typeof prop.type==="object" && "enum" in prop.type ? Object.fromEntries(prop.type.enum.map(v=>[v,v])) : {})).map(v=>JSON.stringify(v)).join(", ")}</p>)}
                          {draft.sizing?.map(size=><p key={size.channel}>{size.channel}: {size.status==="retained"?"source constraint retained":size.status==="intrinsic"?"automatic sizing; sample dimensions not fixed":size.status==="fill"?"own 100% declaration; fills the width its parent supplies":`not projected (${size.reason})`}</p>)}
                          {!!draft.lowerings.length && <p>{draft.lowerings.length} normal flex-gap values use equivalent zero spacing.</p>}
                          {!!draft.residuals?.length && <details><summary>Unprojected styling</summary><ul>{draft.residuals.map((r,i)=><li key={i}>{r.channel}: {r.reason}</li>)}</ul></details>}
                        </details>)}
                      </section>
                    )}
                    {ownership.state === "complete" && row.matched && row.propertyMatrix && (
                      <section aria-label={`${row.id} property matrix`}>
                        <h4>Combined source property effects</h4>
                        <p>{row.propertyMatrix.rows.filter(r=>r.status==="observed").length} / {row.propertyMatrix.planned} planned observations verified. {row.propertyMatrix.rows.some(r=>r.baseline) ? "This baseline is read repeatedly without changing props or scheduling a React update; every render witness must remain unchanged." : "Each changes all selected properties in one React update and verifies restoration. Omission is observed separately before any default is collapsed."}</p>
                        {row.propertyMatrix.axes.map(axis=><p key={axis.property}>{axis.property}: {axis.values.map(v=>v.kind==="omit"?"omitted":JSON.stringify(v.value)).join(", ")}</p>)}
                        {row.propertyMatrix.problems.length>0 && <p>{row.propertyMatrix.problems.join(" · ")}</p>}
                        <details><summary>Properties outside this observation</summary>{row.propertyMatrix.skipped.map(p=><p key={p.property}>{p.property}: {p.reason}</p>)}</details>
                        <details><summary>Review observed combinations</summary>{row.propertyMatrix.rows.map(effect=><details key={effect.id}>
                          <summary>{effect.baseline ? "Unchanged source baseline" : Object.entries(effect.changes).map(([property,value])=>`${property} = ${value.kind==="omit"?"omitted":JSON.stringify(value.value)}`).join(" · ")} · {effect.status==="refused" ? "not verified" : effect.visibleChange ? "visible change; original restored" : "no visible change; original restored"}</summary>
                          {effect.problem && <p>{effect.problem}</p>}
                          {!!effect.changedInstances?.length && <details><summary>Changed component styles</summary>{effect.changedInstances.map(i=><p key={i.instanceId}>{i.name}: {i.channels.join(", ")}</p>)}</details>}
                          {effect.status==="observed" && <div className="native-image-pair">
                            <figure><figcaption>Original example · <a href={`/api/source-reference/react/${reference.id}/ownership/${ownership.id}/${row.id}/source/${row.sourceImage}.png`} target="_blank" rel="noreferrer">Full size</a></figcaption><img loading="lazy" alt={`${row.id} original before property changes`} src={`/api/source-reference/react/${reference.id}/ownership/${ownership.id}/${row.id}/source/${row.sourceImage}.png`}/></figure>
                            <figure><figcaption>Observed combination {effect.id} · <a href={`/api/source-reference/react/${reference.id}/ownership/${ownership.id}/${row.id}/matrix/${effect.id}/${effect.image}.png`} target="_blank" rel="noreferrer">Full size</a></figcaption><img loading="lazy" alt={`${row.id} observed combination ${effect.id}`} src={`/api/source-reference/react/${reference.id}/ownership/${ownership.id}/${row.id}/matrix/${effect.id}/${effect.image}.png`}/></figure>
                          </div>}
                        </details>)}</details>
                      </section>
                    )}
                    {ownership.state === "complete" && row.matched && (
                      <div className="native-image-pair">
                        {(["source", "observed"] as const).map((side) => (
                          <figure key={side}>
                            <figcaption>
                              {side === "source"
                                ? "Untouched original"
                                : "Component observation — same render"}
                            </figcaption>
                            <img
                              alt={`${row.id} ${side} structure check`}
                              src={`/api/source-reference/react/${reference.id}/ownership/${ownership.id}/${row.id}/${side}/${side === "source" ? row.sourceImage : row.observedImage}.png`}
                            />
                          </figure>
                        ))}
                      </div>
                    )}
                  </details>
                ))}
              </>
            )}
          </section>
          {program?.proposal && (
            <section aria-label="React contract proposals">
              <h3>Contract proposals from installed APIs</h3>
              <p>
                {program.proposal.result.proposals.length} incomplete drafts.
                These use the existing contract importer with installed property
                types. Styling, source-to-node correspondence and native output
                are still unverified.
              </p>
              {program.proposal.components.map((component) => (
                <details key={component.name}>
                  <summary>
                    {component.name}: {component.carried.length} API properties
                    carried; {component.unsupported.length} unsupported
                  </summary>
                  <p>Carried: {component.carried.join(", ") || "None"}</p>
                  <p>
                    Reusable content slots:{" "}
                    {component.slots.join(", ") || "None verified"}
                  </p>
                  <ul>
                    {component.unsupported.map((prop) => (
                      <li key={prop.name}>
                        {prop.name}: {prop.type} — {prop.reason}
                      </li>
                    ))}
                  </ul>
                  <p>{component.problems.join(" · ")}</p>
                  {!!component.callbacks?.length && (
                    <details>
                      <summary>
                        Callback signatures and possible state inputs
                      </summary>
                      <p>
                        Matching types are candidates for interaction checks.
                        They do not prove a state relationship, and these
                        callbacks are not emitted as zero-argument events.
                      </p>
                      <ul>
                        {component.callbacks.map((callback) => (
                          <li key={callback.callback}>
                            <strong>{callback.callback}</strong>:{" "}
                            {callback.signature}
                            <br />
                            Possible state inputs:{" "}
                            {callback.stateProperties.join(", ") ||
                              "None"}.{" "}
                            {callback.status === "needs-observation"
                              ? "Interaction checks must establish which input controls state and what this callback returns."
                              : "This callback signature is not yet supported."}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <details>
                    <summary>
                      Platform forwarding outside the native API
                    </summary>
                    <p>{component.platform.join(", ")}</p>
                  </details>
                  <details>
                    <summary>Proposed contract JSON</summary>
                    <pre>
                      {JSON.stringify(
                        program.proposal.result.proposals.find(
                          (p) => p.name === component.name,
                        )?.proposal.contract ?? null,
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </details>
              ))}
              <ul>
                {program.proposal.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </section>
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
                busy ||
                readingProgram ||
                validation?.state === "running" ||
                ownership?.state === "running"
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
            Source checks do not qualify Figma conversion. Native root inspection
            is available for supported drafts; complete content, state and visual
            comparisons remain unfinished. The existing import workspace remains
            available from <a href="/playground">Playground</a>.
          </p>
        </>
      )}
    </section>
  );
}
