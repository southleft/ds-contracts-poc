import type { ReactNode } from 'react';
import type { CodeOnlyFact } from '../../../core/index.js';
import type {
  CompileReceipt,
  DumpSummary,
  EnvelopePreview,
  Excerpt,
  ProposeFixtureResult,
  ProjectionMode,
  RoundtripRows,
} from '../engine/flow-engine';
import { PRODUCER_DUMP_GRAMMAR, fixtureLabel } from '../engine/flow-engine';
import type { TailwindBundle } from '../engine/flow-data';
import { ENVELOPE_DOORS, HOPS, QUOTED_REFUSALS, type TourStep } from '../engine/tours';
import { CopyButton } from './CopyButton';

/**
 * The Flow tab's body — one artifact per walkthrough step, every number on
 * it read from an engine call or a committed receipt the step names. The
 * page computes a FlowView (pages/Playground.tsx) and this component only
 * lays it out; no fact originates here.
 */

export type FlowView =
  | { kind: 'loading'; what: string }
  | { kind: 'error'; message: string }
  | { kind: 'contract'; highlighted: Array<{ needle: string; line: number | null }> }
  | { kind: 'compile'; receipt: CompileReceipt }
  | { kind: 'script'; excerpt: Excerpt | null; receipt: CompileReceipt; onOpenTab: () => void }
  | {
      kind: 'facts';
      receipt: CompileReceipt;
      bundleCheck: { agree: boolean; detail: string };
      lines: (number | null)[];
      onJump: (line: number) => void;
      excerpts: Excerpt[];
      onOpenTab: () => void;
    }
  | { kind: 'bundle'; bundle: TailwindBundle }
  | { kind: 'canvas' }
  | { kind: 'break'; refusals: string[] }
  | { kind: 'reset' }
  | { kind: 'dump'; summary: DumpSummary; focus: string; variantJson: string }
  | { kind: 'propose'; result: ProposeFixtureResult; setSummary: DumpSummary }
  | {
      kind: 'adjudicate';
      rows: RoundtripRows;
      live: Array<{ channel: string; proposed: string | null; shipping: string | null; same: boolean }>;
      shippingId: string;
    }
  | { kind: 'generate'; excerpt: Excerpt | null; onOpenTab: () => void }
  | { kind: 'envelope'; preview: EnvelopePreview; json: string }
  | {
      kind: 'absent';
      rows: RoundtripRows;
      toggleFact: CodeOnlyFact | null;
      toggleProposalEvents: unknown;
      toggleShippingEvents: number;
    }
  | {
      kind: 'stamped';
      result: ProposeFixtureResult;
      summary: DumpSummary;
      mode: ProjectionMode;
      onMode: (mode: ProjectionMode) => void;
      /** The editor referee's verdict on the proposal as loaded — live. */
      referee: string[];
    }
  | { kind: 'exact-break'; refusal: { code: string; message: string } | null; skipped: ProposeFixtureResult['skipped'] };

const Mono = ({ children }: { children: ReactNode }) => <code className="flow__mono">{children}</code>;

/** `Name = default` pairs, one chip each. */
const PropList = ({ rows }: { rows: Array<[string, string]> }) => (
  <span className="flow__chips">
    {rows.map(([name, value]) => (
      <Mono key={name}>
        {name} = {value}
      </Mono>
    ))}
  </span>
);

function Kv({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="flow__kv">
      {rows.map(([k, v]) => (
        <div key={k} className="flow__kv-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ExcerptBlock({ excerpt, caption }: { excerpt: Excerpt; caption?: string }) {
  return (
    <figure className="flow__excerpt">
      <figcaption>
        <span className="flow__mono">{excerpt.path}</span> — line {excerpt.line} of {excerpt.totalLines}
        {caption ? ` · ${caption}` : ''}
      </figcaption>
      <pre>
        {excerpt.rows.map((r) => (
          <div key={r.n} className={`flow__excerpt-row${r.hit ? ' is-hit' : ''}`}>
            <span className="flow__excerpt-n">{r.n}</span>
            <span>{r.text || ' '}</span>
          </div>
        ))}
      </pre>
    </figure>
  );
}

function Source({ children }: { children: ReactNode }) {
  return <p className="flow__source">{children}</p>;
}

function FactsTable({
  facts,
  lines,
  onJump,
}: {
  facts: CodeOnlyFact[];
  lines: (number | null)[];
  onJump: (line: number) => void;
}) {
  return (
    <div className="flow__table-wrap">
      <table className="flow__table">
        <thead>
          <tr>
            <th>part</th>
            <th>kind</th>
            <th>channel</th>
            <th>value</th>
            <th>variants</th>
            <th>reason</th>
          </tr>
        </thead>
        <tbody>
          {facts.map((f, i) => {
            const line = lines[i] ?? null;
            return (
              <tr key={i} className={line !== null ? 'is-jumpable' : ''} onClick={line !== null ? () => onJump(line) : undefined}>
                <td>
                  <Mono>{f.part}</Mono>
                </td>
                <td>{f.kind}</td>
                <td>
                  <Mono>{f.channel}</Mono>
                </td>
                <td>
                  <Mono>{f.value}</Mono>
                </td>
                <td>
                  {f.variants.count}/{f.variants.of}
                </td>
                <td>
                  {f.reason}
                  {line !== null ? <span className="validation__jump-line"> → line {line + 1}</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Body({ view }: { view: FlowView }) {
  switch (view.kind) {
    case 'loading':
      return <p className="hint">Loading {view.what}…</p>;
    case 'error':
      return <div className="output__error">{view.message}</div>;

    case 'contract':
      return (
        <>
          <Kv
            rows={view.highlighted.map(({ needle, line }) => [
              line === null ? 'not found in the text' : `line ${line + 1}`,
              <Mono key={needle}>{needle}</Mono>,
            ])}
          />
          <h4 className="flow__h">The five hops</h4>
          <ol className="flow__hops">
            {HOPS.map((h) => (
              <li key={h.n}>
                <b>hop {h.n}</b> {h.from} → {h.to} <span className="flow__muted">({h.verb})</span>
              </li>
            ))}
          </ol>
          <p className="hint">
            Every hop reads or writes exactly one artifact — the contract. The canvas and the codebase never see
            each other. A fact crossing a hop ends carried, named (written to a receipt), or refused by name;
            silent loss is the fourth outcome the conformance manifests treat as a hard failure.
          </p>
        </>
      );

    case 'compile': {
      const r = view.receipt;
      return (
        <>
          <Kv
            rows={[
              ['set', <Mono key="s">{r.setName}</Mono>],
              ['variants (enum cartesian)', String(r.variantCount)],
              [
                'State previews',
                r.statePreviews
                  ? `${r.stateVariantCount} — bindings.figma.statePreviews is on, so every hover / focus-visible / disabled state draws as a State=… preview variant instead of becoming a code-only fact`
                  : 'none (statePreviews not set)',
              ],
              ['first variant', <Mono key="v">{r.firstVariantName ?? '—'}</Mono>],
              ['root fill (bound variable, slash name)', <Mono key="f">{r.rootFill ?? '— (no fill binding on root)'}</Mono>],
              [
                'textProps (text props no node binds)',
                r.textProps.length === 0 ? 'none' : <PropList key="t" rows={r.textProps.map((p) => [p.property, JSON.stringify(p.default)])} />,
              ],
              ['boolProps', r.boolProps.length === 0 ? 'none' : <PropList key="b" rows={r.boolProps.map((p) => [p.property, String(p.default)])} />],
              ['code-only facts', String(r.codeOnlyFacts.length)],
            ]}
          />
          <Source>
            Read from <Mono>compileComponentData(contract)</Mono> — core/emit-figma-script.ts, run in this tab. The
            slash name is <Mono>dotPath.split('.').join('/')</Mono>; the canvas binds the variable, never a hex.
          </Source>
        </>
      );
    }

    case 'script':
      return (
        <>
          {view.excerpt ? (
            <ExcerptBlock excerpt={view.excerpt} caption="the root fill, bound by slash name" />
          ) : (
            <p className="hint">The emitted script carries no line for this fill — nothing to show.</p>
          )}
          <div className="btn-row">
            <button type="button" onClick={view.onOpenTab}>
              Open the Figma script tab
            </button>
          </div>
          <Source>
            The script is emitted here by the figma-script emitter (core/emitter.ts registers it beside react); the
            CLI’s bytes from the same core are pinned by evals/golden.json. The Preview tab’s Canvas view renders the
            same compiled data as HTML.
          </Source>
        </>
      );

    case 'facts': {
      const r = view.receipt;
      return (
        <>
          <Kv
            rows={[
              ['contract', <Mono key="c">{r.contractId}</Mono>],
              ['variants', `${r.variantCount}${r.stateVariantCount ? ` + ${r.stateVariantCount} State previews` : ''}`],
              ['code-only facts (live compile)', String(r.codeOnlyFacts.length)],
              [
                'vs committed bundle row',
                <span key="b" className={view.bundleCheck.agree ? 'flow__ok' : 'flow__bad'}>
                  {view.bundleCheck.agree ? 'agrees' : 'DISAGREES'} — {view.bundleCheck.detail}
                </span>,
              ],
            ]}
          />
          <FactsTable facts={r.codeOnlyFacts} lines={view.lines} onJump={view.onJump} />
          {view.excerpts.map((ex, i) => (
            <ExcerptBlock
              key={i}
              excerpt={ex}
              caption={i === 0 ? 'the unchecked thumb: constraint MIN + left offset' : 'the checked thumb: constraint MAX + right offset'}
            />
          ))}
          <div className="btn-row">
            <button type="button" onClick={view.onOpenTab}>
              Open the Figma script tab
            </button>
          </div>
          <Source>
            The thumb is a <Mono>::after</Mono> with <Mono>translate: 100%</Mono> in Flowbite’s CSS. The computed
            floor folded that translate into a right anchor (the contract’s description says so), the canvas carries
            the placement as a constraint + offset, and the translate itself never needs a canvas field. The facts
            list is the same object that rides the bundle (<Mono>bundle.codeOnlyFacts[i].facts</Mono>), the
            <Mono>figma bundle</Mono> stdout, the plugin run report, and the set’s{' '}
            <Mono>ds_contracts/codeOnlyFacts</Mono> stamp; <Mono>npm run code-only-facts:check</Mono> pins the
            per-contract counts. One known class of fact is named nowhere yet: an <Mono>anatomy.root.attrs</Mono>{' '}
            binding (top-nav-item’s <Mono>href</Mono>) reaches the canvas only as a text property’s VALUE — the
            binding itself is not a code-only fact (docs/23 §B.31).
          </Source>
        </>
      );
    }

    case 'bundle': {
      const b = view.bundle;
      const total = b.codeOnlyFacts.reduce((n, row) => n + row.facts.length, 0);
      return (
        <>
          <p className="flow__label">bundle preview — ds-contracts figma bundle writes the real one</p>
          <Kv
            rows={[
              ['type', <Mono key="t">{b.type}</Mono>],
              ['version', String(b.version)],
              [
                'tokenSet',
                <span key="ts">
                  <Mono>{b.tokenSet.name}</Mono> — base tree with {Object.keys(b.tokenSet.base).length} top-level groups
                  {b.tokenSet.minted ? `, minted tree rooted at ${Object.keys(b.tokenSet.minted).join(', ')}` : ', no minted tree'}
                </span>,
              ],
              ['icons', `${Object.keys(b.icons ?? {}).length} SVGs`],
              [
                'contracts (raw bytes)',
                <span key="c" className="flow__chips">
                  <span>{b.contracts.length}:</span>
                  {[...b.contractsById.keys()].map((id) => (
                    <Mono key={id}>{id}</Mono>
                  ))}
                </span>,
              ],
              [
                'codeOnlyFacts',
                <span key="f">
                  {total} facts across {b.codeOnlyFacts.length} contracts —{' '}
                  {b.codeOnlyFacts.map((row) => `${row.name} ${row.facts.length}`).join(', ')}
                </span>,
              ],
            ]}
          />
          <h4 className="flow__h">When a contract does not compile against the token set</h4>
          <blockquote className="flow__quote">
            {QUOTED_REFUSALS.bundle.text}
            <footer>{QUOTED_REFUSALS.bundle.file}</footer>
          </blockquote>
          <p className="hint">
            One list, nothing written. The bundle is refused whole rather than shipped with a hole the plugin would
            hit later.
          </p>
          <Source>
            Committed at examples/tailwind/figma/tailwind.bundle.json; its per-contract fact counts are what{' '}
            <Mono>npm run code-only-facts:check</Mono> (core/code-only-facts-check.ts) refuses to let move.
          </Source>
        </>
      );
    }

    case 'canvas':
      return (
        <>
          <ol className="flow__hops">
            <li>
              <b>Build tab</b> — paste the bundle (or <Mono>figma push &lt;bundle&gt; --code &lt;CODE&gt;</Mono>, or{' '}
              <Mono>figma publish</Mono> to a channel the Changes tab reads once on open and on “Check for
              updates” — deliberately no poll timer). The plan validates every contract.
            </li>
            <li>
              <b>All or none</b> —
              <blockquote className="flow__quote flow__quote--inline">
                {QUOTED_REFUSALS.plan.text}
                <footer>{QUOTED_REFUSALS.plan.file}</footer>
              </blockquote>
            </li>
            <li>
              <b>A human clicks Apply.</b> No tool in this repository writes a canvas on its own.
            </li>
            <li>
              <b>The set is stamped</b> — plugin data under <Mono>ds_contracts/</Mono>: <Mono>contractId</Mono>,{' '}
              <Mono>specHash</Mono>, <Mono>version</Mono>, <Mono>canvasFingerprint</Mono>, <Mono>codeOnlyFacts</Mono>,{' '}
              <Mono>semantics</Mono>. The Changes tab re-computes the fingerprint to tell a canvas edit from an
              engine change; the Send tab reads the stamps back so the other direction knows what it is looking at.
            </li>
          </ol>
          <h4 className="flow__h">From this playground</h4>
          <p className="hint">
            Copy the Figma script tab’s output and run it through the Sync Runner plugin’s{' '}
            <b>Advanced → Paste a script</b> drawer (a developer surface). {QUOTED_REFUSALS.everydayDoor.text}
          </p>
        </>
      );

    case 'break':
      return (
        <>
          {view.refusals.length > 0 ? (
            <ul className="flow__refusals">
              {view.refusals.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="hint">The referee is still running on the edited text…</p>
          )}
          <h4 className="flow__h">What each door does with it</h4>
          <Kv
            rows={[
              ['generate', <span key="g">{QUOTED_REFUSALS.generate.text}</span>],
              ['figma bundle', <span key="b">{QUOTED_REFUSALS.bundle.text}</span>],
              ['plugin Build', <span key="p">{QUOTED_REFUSALS.plan.text}</span>],
            ]}
          />
          <Source>
            Sentences quoted from {QUOTED_REFUSALS.generate.file}, {QUOTED_REFUSALS.bundle.file} and{' '}
            {QUOTED_REFUSALS.plan.file}; playground/scripts/flow-check.ts refuses if any of them drifts.
          </Source>
        </>
      );

    case 'reset':
      return (
        <p className="hint">
          Both directions are deep-linkable: <Mono>/playground?tour=code-to-figma</Mono> and{' '}
          <Mono>/playground?tour=figma-to-code</Mono>.
        </p>
      );

    case 'dump': {
      const s = view.summary;
      return (
        <>
          <Kv
            rows={[
              ['fixture label', fixtureLabel(s)],
              ['producers’ grammar today', `dump v${PRODUCER_DUMP_GRAMMAR} (REST_DUMP_VERSION, extract/figma/rest/map.ts; dump.plugin.js writes the same)`],
              ['_provenance.fileKey', <Mono key="k">{s.fileKey ?? '—'}</Mono>],
              ['_provenance.extractedAt', s.extractedAt ?? '—'],
              [
                'sets',
                <span key="sets">
                  {s.sets.map((set) => (
                    <span key={set.name} className={`flow__chip${set.name === view.focus ? ' is-focus' : ''}`}>
                      {set.name} · {set.variants} variant{set.variants === 1 ? '' : 's'}
                      {set.hasPropertyDefinitions ? ' · propertyDefinitions' : ' · no propertyDefinitions'}
                      {set.stamps.contractId ? ` · stamped ${set.stamps.contractId}` : ' · unstamped'}
                    </span>
                  ))}
                </span>,
              ],
              [
                '_degradations',
                s.hasDegradationsChannel
                  ? s.degradations.length === 0
                    ? 'channel present, no rows'
                    : `${s.degradations.length} rows`
                  : 'no _degradations channel in this capture — the producer predates it',
              ],
              ['_variables', s.capturedVariables > 0 ? `${s.capturedVariables} captured` : 'none'],
            ]}
          />
          {s.degradations.length > 0 ? (
            <ul className="flow__refusals flow__refusals--soft">
              {s.degradations.slice(0, 8).map((d, i) => (
                <li key={i}>
                  <Mono>[{d.code}]</Mono> {d.nodePath} — {d.message}
                </li>
              ))}
              {s.degradations.length > 8 ? <li className="flow__muted">… {s.degradations.length - 8} more</li> : null}
            </ul>
          ) : null}
          {s.note ? (
            <details className="flow__details">
              <summary>_provenance.note</summary>
              <p className="hint">{s.note}</p>
            </details>
          ) : null}
          <h4 className="flow__h">{view.focus} — first variant, as captured</h4>
          <pre className="flow__json">{view.variantJson}</pre>
          <Source>
            The JSON tab consumes a dump like this and shows only the proposal; this pane shows the input. Where a
            producer cannot see a channel it writes a <Mono>_degradations</Mono> row (
            <Mono>degrade(code, nodePath, message)</Mono> in dump.plugin.js) — the dump saying what it could not
            see.
          </Source>
        </>
      );
    }

    case 'propose': {
      const r = view.result;
      const p = r.proposal;
      return (
        <>
          <Kv
            rows={[
              ['projection mode used', <Mono key="m">{r.mode}</Mono>],
              [
                'exact projection said',
                r.exactRefusal ? (
                  <span key="x">
                    <Mono>{r.exactRefusal.code}</Mono> — {r.exactRefusal.message}
                  </span>
                ) : (
                  'proposes (structured evidence present)'
                ),
              ],
              ['projection status', <Mono key="s">{p ? `${p.projection.status}${'reason' in p.projection && p.projection.reason ? ` (${String(p.projection.reason)})` : ''}` : '—'}</Mono>],
              ['proposed id', <Mono key="id">{p ? String(p.contract.id) : '—'}</Mono>],
              ['notes[]', p ? String(p.notes.length) : '—'],
              ['unbound[]', p ? String(p.unbound.length) : '—'],
              ['minted imported.* tokens', p?.mintedTokens ? String(p.mintedTokens.count) : 'none'],
              ['child stubs', p?.childStubs ? String(p.childStubs.length) : 'none'],
              ['canvas provenance', <span key="pv"><Mono>{r.provenance}</Mono> — {r.provenanceSentence}</span>],
            ]}
          />
          {r.skipped.length > 0 ? (
            <ul className="flow__refusals">
              {r.skipped.map((s) => (
                <li key={s.setName}>{s.reason}</li>
              ))}
            </ul>
          ) : null}
          <Source>
            The rules are fixed inverses of documented generator rules (extract/figma/propose.ts lists them: LAYOUT,
            TOKENS, ENUM SUBST, TEXT, PROPS, SLOTS, COMPOSITION, ARTIFACTS, SPACERS, UNBOUND). ENUM SUBST is the one
            in play here: the same node binds <Mono>color/feedback/info/background</Mono>,{' '}
            <Mono>color/feedback/success/background</Mono>, … across the Variant axis, differing in exactly the
            segment equal to the variant value, so the proposal writes{' '}
            <Mono>{'{color.feedback.{variant}.background}'}</Mono>. Anything else becomes a note, never a guess.
          </Source>
        </>
      );
    }

    case 'adjudicate': {
      const r = view.rows;
      return (
        <>
          <p className="flow__label">replayed from the committed receipt extract/figma/ROUNDTRIP.md</p>
          <Kv
            rows={[
              ['MATCHED', String(r.counts.matched)],
              ['CANVAS-ABSENT', String(r.counts.canvasAbsent)],
              ['MISMATCH', String(r.counts.mismatch)],
            ]}
          />
          <h4 className="flow__h">MATCHED ({r.matched.length})</h4>
          <p className="flow__chips">
            {r.matched.map((m) => (
              <Mono key={m}>{m}</Mono>
            ))}
          </p>
          <h4 className="flow__h">CANVAS-ABSENT ({r.canvasAbsent.length}) — declared fidelity limits</h4>
          <ul className="flow__refusals flow__refusals--soft">
            {r.canvasAbsent.map((row) => (
              <li key={row.subject}>
                <Mono>{row.subject}</Mono> — {row.reason}
              </li>
            ))}
          </ul>
          {r.mismatch.length > 0 ? (
            <>
              <h4 className="flow__h">MISMATCH ({r.mismatch.length})</h4>
              <ul className="flow__refusals">
                {r.mismatch.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </>
          ) : null}
          <h4 className="flow__h">Live cross-check — root token refs, proposal vs {view.shippingId}</h4>
          <div className="flow__table-wrap">
            <table className="flow__table">
              <thead>
                <tr>
                  <th>channel</th>
                  <th>proposed</th>
                  <th>shipping</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {view.live.map((row) => (
                  <tr key={row.channel}>
                    <td>
                      <Mono>{row.channel}</Mono>
                    </td>
                    <td>
                      <Mono>{row.proposed ?? '—'}</Mono>
                    </td>
                    <td>
                      <Mono>{row.shipping ?? '—'}</Mono>
                    </td>
                    <td className={row.same ? 'flow__ok' : 'flow__muted'}>
                      {row.same ? 'same' : row.proposed === null ? 'text cascade — compared by effective value in the receipt' : 'differs'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Source>
            <Mono>compareContracts</Mono> lives in extract/figma/roundtrip.ts, which imports node:fs — it is not in
            the browser core, so the three counts above are the receipt’s, not this tab’s. The live table is the one
            slice this tab can compute itself. Beyond this tab, six instruments classify drift —{' '}
            <Mono>npm run parity</Mono>, <Mono>ds-contracts diff</Mono>/<Mono>diagnose</Mono>,{' '}
            <Mono>extract --reconcile</Mono>, the plugin Changes tab, the sync ledger, and the conformance kits
            (docs/29 §4.4). The adjudication never picks a winner: a human merging the contract PR does.
          </Source>
        </>
      );
    }

    case 'generate':
      return (
        <>
          {view.excerpt ? (
            <ExcerptBlock excerpt={view.excerpt} caption="the Info variant’s background, as a CSS custom property" />
          ) : (
            <p className="hint">The React emitter’s output carries no line for this token — nothing to show.</p>
          )}
          <div className="btn-row">
            <button type="button" onClick={view.onOpenTab}>
              Open the React tab
            </button>
          </div>
          <Source>
            <Mono>ds-contracts generate &lt;contracts..&gt; --out &lt;dir&gt; --target react</Mono> writes the same
            files (<Mono>&lt;Name&gt;.tsx</Mono>, <Mono>.module.css</Mono>, <Mono>.stories.tsx</Mono>). It is atomic per
            contract: {QUOTED_REFUSALS.generate.text} A <Mono>var(--x)</Mono> the generated CSS references and{' '}
            <Mono>tokens.css</Mono> does not define is a refusal too.
          </Source>
        </>
      );

    case 'envelope':
      return (
        <>
          <p className="flow__label">envelope preview — assembled here in the shape the plugin Send tab exports; the plugin writes the real one</p>
          <div className="flow__json-head">
            <span>CONTRACT-PROPOSAL</span>
            <CopyButton text={view.json} className="output__copy" />
          </div>
          <pre className="flow__json flow__json--tall">{view.json}</pre>
          <h4 className="flow__h">Not filled from a fixture</h4>
          <ul className="flow__refusals flow__refusals--soft">
            {view.preview.omitted.map((o) => (
              <li key={o.field}>
                <Mono>{o.field}</Mono> — {o.reason}
              </li>
            ))}
          </ul>
          <h4 className="flow__h">Three doors into the repo</h4>
          <div className="flow__table-wrap">
            <table className="flow__table">
              <thead>
                <tr>
                  <th>door</th>
                  <th>command</th>
                  <th>writes</th>
                </tr>
              </thead>
              <tbody>
                {ENVELOPE_DOORS.map((d) => (
                  <tr key={d.door}>
                    <td>{d.door}</td>
                    <td>{d.command ? <Mono>{d.command}</Mono> : '—'}</td>
                    <td>{d.writes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <blockquote className="flow__quote">
            {QUOTED_REFUSALS.receive.text}
            <footer>{QUOTED_REFUSALS.receive.file}</footer>
          </blockquote>
        </>
      );

    case 'absent': {
      const r = view.rows;
      return (
        <>
          <h4 className="flow__h">Badge — CANVAS-ABSENT ({r.canvasAbsent.length}), from ROUNDTRIP.md</h4>
          <ul className="flow__refusals flow__refusals--soft">
            {r.canvasAbsent.map((row) => (
              <li key={row.subject}>
                <Mono>{row.subject}</Mono> — {row.reason}
              </li>
            ))}
          </ul>
          <h4 className="flow__h">ToggleSwitch — the event, both directions</h4>
          <Kv
            rows={[
              [
                'code → canvas (bundle codeOnlyFacts)',
                view.toggleFact ? (
                  <span key="f">
                    <Mono>
                      {view.toggleFact.part} · {view.toggleFact.kind} · {view.toggleFact.channel} · {view.toggleFact.value}
                    </Mono>{' '}
                    — {view.toggleFact.reason}
                  </span>
                ) : (
                  'no event row in the committed bundle for flowbite.toggleswitch'
                ),
              ],
              [
                'canvas → contract (the proposal)',
                view.toggleProposalEvents === undefined || (Array.isArray(view.toggleProposalEvents) && view.toggleProposalEvents.length === 0) ? (
                  <span key="e">
                    the proposal declares no <Mono>events</Mono> — the canvas cannot run behaviour, so the dump cannot
                    invent <Mono>onToggle</Mono>; the shipping contract declares {view.toggleShippingEvents}
                  </span>
                ) : (
                  <Mono key="e2">{JSON.stringify(view.toggleProposalEvents)}</Mono>
                ),
              ],
            ]}
          />
          <Source>
            Named on the way out (the bundle row, the plugin run report, the set’s <Mono>ds_contracts/codeOnlyFacts</Mono>{' '}
            stamp) and absent by declaration on the way back (ROUNDTRIP’s CANVAS-ABSENT class lists events, semantics
            and a11y with a reason each). A fact that is neither carried nor named is the one outcome the
            conformance manifests treat as a hard failure.
          </Source>
        </>
      );
    }

    case 'stamped': {
      const r = view.result;
      const p = r.proposal;
      const set = view.summary.sets.find((s) => s.stamps.contractId === 'flowbite.toggleswitch') ?? view.summary.sets[0];
      return (
        <>
          <div className="seg" role="group" aria-label="Projection mode">
            {(['exact', 'reviewable-inversion'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`seg__btn${view.mode === m ? ' is-active' : ''}`}
                aria-pressed={view.mode === m}
                onClick={() => view.onMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <Kv
            rows={[
              ['fixture label', fixtureLabel(view.summary)],
              [
                'set stamps',
                set ? (
                  <span key="st">
                    contractId <Mono>{set.stamps.contractId ?? '—'}</Mono> · specHash <Mono>{set.stamps.specHash ?? '—'}</Mono> · version{' '}
                    <Mono>{set.stamps.version ?? '—'}</Mono> · semantics <Mono>{JSON.stringify(set.semantics)}</Mono>
                  </span>
                ) : (
                  '—'
                ),
              ],
              ['propertyDefinitions', set?.hasPropertyDefinitions ? 'present — structured axis evidence' : 'absent'],
              [
                'exact projection said',
                r.exactRefusal ? (
                  <span key="x">
                    <Mono>{r.exactRefusal.code}</Mono> — {r.exactRefusal.message}
                  </span>
                ) : (
                  'proposes'
                ),
              ],
              ['projection status', <Mono key="s">{p ? p.projection.status : '—'}</Mono>],
              ['proposed id', <Mono key="id">{p ? String(p.contract.id) : '—'}</Mono>],
              ['notes[]', p ? String(p.notes.length) : '—'],
              ['unbound[]', p ? String(p.unbound.length) : '—'],
              ['minted imported.* tokens', p?.mintedTokens ? String(p.mintedTokens.count) : 'none'],
              ['canvas provenance', <span key="pv"><Mono>{r.provenance}</Mono> — {r.provenanceSentence}</span>],
            ]}
          />
          {r.skipped.length > 0 ? (
            <ul className="flow__refusals">
              {r.skipped.map((s) => (
                <li key={s.setName}>{s.reason}</li>
              ))}
            </ul>
          ) : null}
          <h4 className="flow__h">The referee’s verdict on this proposal (live, under the editor)</h4>
          {view.referee.length > 0 ? (
            <>
              <ul className="flow__refusals">
                {view.referee.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="hint">
                Named, not a tour artefact: the set’s <Mono>ds_contracts/semantics</Mono> stamp carries element and
                role only — <Mono>semantics.roleException</Mono>, which the shipping contract declares, is not stamped
                on the canvas and not re-proposed, so <Mono>generate</Mono> refuses this proposal by name until a
                person adds the exception back. A hop-4 gap for docs/23, surfaced here rather than hidden.
              </p>
            </>
          ) : (
            <p className="hint">No refusals — the proposal validates and would generate as is.</p>
          )}
          <Source>
            The bundle’s token set (base + minted trees) is the active token source while this set is loaded, the way
            a pasted tree in the Tokens tab would be — so the proposal’s <Mono>{'{imported.*}'}</Mono> refs resolve in
            the referee and the preview. It is restored when you leave the walkthrough.{' '}
            scripts/flowbite-dump-propose-check.ts pins this set’s recovered thumb placement (<Mono>left: 2px</Mono>{' '}
            / <Mono>right: 2px</Mono> from the LEFT / RIGHT constraints) and per-size literals.
          </Source>
        </>
      );
    }

    case 'exact-break':
      return (
        <>
          {view.refusal ? (
            <blockquote className="flow__quote">
              <Mono>{view.refusal.code}</Mono> — {view.refusal.message}
              <footer>ExactProjectionError, core/propose-figma.ts; the code is one of the EXACT_* codes in accuracy/grammar.json</footer>
            </blockquote>
          ) : (
            <p className="hint">Exact projection did not refuse — nothing to show (this would be a gate failure).</p>
          )}
          {view.skipped.length > 0 ? (
            <>
              <h4 className="flow__h">As proposeBatchFromDump reports it (plain words, per set)</h4>
              <ul className="flow__refusals">
                {view.skipped.map((s) => (
                  <li key={s.setName}>{s.reason}</li>
                ))}
              </ul>
            </>
          ) : null}
          <Source>
            Exact mode fails closed: without structured evidence it refuses by code rather than inverting names and
            hoping. <Mono>reviewable-inversion</Mono> is the explicit opt-in that proposes anyway and stamps the
            projection <Mono>legacy-unverified</Mono>. The CLI twin is <Mono>npm run extract:figma -- &lt;dump&gt; --reviewable-inversion</Mono>.
          </Source>
        </>
      );
  }
}

export function FlowPanel({
  step,
  index,
  total,
  view,
}: {
  step: TourStep;
  index: number;
  total: number;
  view: FlowView;
}) {
  return (
    <div className="flow">
      <div className="flow__head">
        <span className="flow__step">
          step {index + 1} of {total} · {step.hop}
        </span>
        <h3 className="flow__title">{step.title}</h3>
        <p className="flow__lead">{step.lead}</p>
      </div>
      <div className="flow__body">
        <Body view={view} />
      </div>
    </div>
  );
}
