import { Link } from '../router';
import { REPO_URL } from '../App';
import { CODE_TO_FIGMA, FIGMA_TO_CODE, HOPS } from '../engine/tours';

/**
 * /flow — the landing for the two guided walkthroughs. Deep-links only; the
 * walkthroughs themselves run inside the playground (?tour=…), on the real
 * engine, over committed inputs.
 */
export function Flow() {
  return (
    <div className="landing flowpage">
      <p className="landing__kicker">How it flows</p>
      <h1>Figma ↔ code, through the contract.</h1>
      <p className="landing__pitch">
        There is no Figma-to-code converter here and no code-to-Figma converter. There is one pure
        function per direction — one compiles the contract into a Figma script, one proposes a
        contract from a canvas dump — plus the code emitters, and a set of referees that compare
        each surface to the contract and never to each other. A change on
        either side is a proposal to the contract, merged as a pull request or not merged at all.
        No tool picks a winner; a human merging a contract PR does.
      </p>
      <p className="landing__pitch">
        Every fact that crosses a hop ends in one of three dispositions — <b>carried</b>,{' '}
        <b>named</b> (written to a receipt a person can read), or <b>refused by name</b> — and the
        conformance manifests treat the fourth outcome, silent loss, as a hard failure. Both
        walkthroughs below run the engine in your browser over committed inputs and show the
        receipts as they are produced; anything that cannot run here (bundle assembly, the
        round-trip comparator, the canvas itself) is labelled as a preview or a replay of a committed
        receipt.
      </p>

      <div className="flowpage__hops" aria-label="The five hops">
        {HOPS.map((h) => (
          <div key={h.n} className="flowpage__hop">
            <span className="flowpage__hop-n">hop {h.n}</span>
            <span className="flowpage__hop-path">
              {h.from} → {h.to}
            </span>
            <span className="flowpage__hop-verb">{h.verb}</span>
          </div>
        ))}
      </div>

      <div className="landing__ctas flowpage__ctas">
        <Link to={`/playground?tour=${CODE_TO_FIGMA.id}`} className="cta">
          <div className="cta__title">{CODE_TO_FIGMA.title}</div>
          <div className="cta__desc">
            {CODE_TO_FIGMA.direction}. {CODE_TO_FIGMA.intro}
          </div>
          <ol className="cta__steps">
            {CODE_TO_FIGMA.steps.map((s) => (
              <li key={s.id}>{s.label}</li>
            ))}
          </ol>
        </Link>
        <Link to={`/playground?tour=${FIGMA_TO_CODE.id}`} className="cta">
          <div className="cta__title">{FIGMA_TO_CODE.title}</div>
          <div className="cta__desc">
            {FIGMA_TO_CODE.direction}. {FIGMA_TO_CODE.intro}
          </div>
          <ol className="cta__steps">
            {FIGMA_TO_CODE.steps.map((s) => (
              <li key={s.id}>{s.label}</li>
            ))}
          </ol>
        </Link>
      </div>

      <p className="landing__foot">
        The prose version, with every table and the six adjudication instruments, is{' '}
        <a href={`${REPO_URL}/blob/main/docs/29-how-it-flows.md`} target="_blank" rel="noreferrer">
          docs/29-how-it-flows.md
        </a>
        ; the walls with codes are catalogued in{' '}
        <a href={`${REPO_URL}/blob/main/docs/23-known-limitations.md`} target="_blank" rel="noreferrer">
          docs/23-known-limitations.md
        </a>
        .
      </p>
    </div>
  );
}
