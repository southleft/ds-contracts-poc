import { Link } from "../router";
import { REPO_URL } from "../App";
import { contractsById } from "../engine/data";

export function Landing() {
  return (
    <div className="landing">
      <p className="landing__kicker">
        Design-system contracts — engine explorer
      </p>
      <h1>The contract loop, in your browser.</h1>
      <p className="landing__pitch">
        A <b>contract</b> is one JSON file per component. It records the things
        design and engineering have to agree on — the props and their legal
        values, the parts the component is made of, which design token paints
        each part, and its states. Both a React component and a real Figma
        component set can be <i>generated</i> from supported contracts. The
        autonomous apply-and-reobserve product loop is not connected yet.
      </p>
      <p className="landing__pitch">
        This page runs the current checked-out <code>core/</code> engine's
        universal-contract workflow —
        the same code behind a {contractsById.size}-component library — right
        in your browser. Load a contract, change it, and watch what happens:
        the React, the HTML, the Figma sync script and the canvas preview all
        move together, and anything the engine can&rsquo;t do it says out loud
        instead of guessing. The canvas preview is HTML, not a native Figma
        export. Editing a pasted contract is local; connected import and source
        validation are separate operations.
      </p>
      <p className="landing__pitch">
        <b>Start here:</b> open an example, then break its contract on purpose —
        delete a required field, or point a token binding at a name that
        doesn&rsquo;t exist. The refusal that appears, named and on screen, is
        the whole idea.
      </p>
      <p className="landing__pitch landing__pitch--aside">
        <b>What to use next:</b>{" "}
        <Link to="/sources">Source validation</Link> checks a real styled
        original before conversion. <Link to="/system">The whole loop</Link>{" "}
        explains the current architecture, transport adapters and remaining
        code-led, design-led and brownfield work. This engine explorer teaches
        contract mechanics; it does not prove those complete journeys.
      </p>

      {/* The one-line thesis: it may wrap BETWEEN steps at narrow widths but
          never truncates — a pipeline that ends in "React · HT" isn't one. */}
      <div className="landing__loop" aria-label="The contract loop">
        <span className="landing__loop-step">design / code</span>
        <span className="landing__loop-arrow" aria-hidden>
          →
        </span>
        <b className="landing__loop-step">proposed contract</b>
        <span className="landing__loop-arrow" aria-hidden>
          →
        </span>
        <span className="landing__loop-step">
          schema governance (named refusals)
        </span>
        <span className="landing__loop-arrow" aria-hidden>
          →
        </span>
        <span className="landing__loop-step">
          React · HTML · inline · Figma
        </span>
      </div>

      <div className="landing__ctas">
        <Link to="/flow" className="cta">
          <div className="cta__title">How it flows</div>
          <div className="cta__desc">
            Two guided walkthroughs — code → Figma and Figma → code — through
            the contract, on the real engine, with every receipt shown as it is
            produced.
          </div>
        </Link>
        <Link to="/examples" className="cta">
          <div className="cta__title">Try an example</div>
          <div className="cta__desc">
            Pick from the gallery — atoms to compositions, plus foreign code
            degrading honestly.
          </div>
        </Link>
        <Link to="/playground?source=figma" className="cta">
          <div className="cta__title">Import from Figma</div>
          <div className="cta__desc">
            Paste a figma.com component URL + token; get a proposed contract
            with real bindings or named degradations.
          </div>
        </Link>
        <Link to="/playground?source=code" className="cta">
          <div className="cta__title">Paste code</div>
          <div className="cta__desc">
            TSX + CSS in, a proposed contract out — raw values reported with
            nearest-token candidates, never invented.
          </div>
        </Link>
      </div>

      <p className="landing__foot">
        Same pre-pivot engine, no demo copy: the code emitting here generates
        the repo&rsquo;s {contractsById.size} shipping{" "}
        <code>*.contract.json</code> components, byte-guarded by its evals.
        That is not recipe-IR.{" "}
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          Source on GitHub
        </a>{" "}
        ·{" "}
        <a
          href={`${REPO_URL}/blob/main/MILESTONES.md`}
          target="_blank"
          rel="noreferrer"
        >
          Milestones
        </a>
      </p>
    </div>
  );
}
