import { Link } from "../router";
import { REPO_URL } from "../App";
import { contractsById } from "../engine/data";

export function Landing() {
  return (
    <div className="landing">
      <p className="landing__kicker">Design System Contracts</p>
      <h1>Start with the library you have.</h1>
      <p className="landing__pitch">
        Turn supported component facts into a shared contract, generate the
        other surface, and verify the result. The goal includes tables, forms
        and other composed components with nested instances, slots, variants and
        tokens.
      </p>
      <p className="landing__pitch">
        Today you can import and inspect proposals, explore generated code, and
        validate a configured local source library. Complete connected
        conversion and two-way repair are still in development. Choose a path
        for its setup, available actions and remaining steps.
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
        <a href="/start#designer-first" className="cta">
          <div className="cta__title">I have a Figma library</div>
          <div className="cta__desc">
            Import an approved set, review its contract and inspect generated
            code. See the steps to reusable library delivery.
          </div>
        </a>
        <a href="/start#code-first" className="cta">
          <div className="cta__title">I have a code library</div>
          <div className="cta__desc">
            Inspect original components and their states. Follow the path to
            editable native Figma components.
          </div>
        </a>
        <a href="/start#both-libraries" className="cta">
          <div className="cta__title">I already have both</div>
          <div className="cta__desc">
            Understand identity mapping, shared ownership, drift comparison and
            the repair workflow being built.
          </div>
        </a>
      </div>
      <p className="landing__pitch landing__pitch--aside">
        <Link to="/start">Installation and full user guide</Link>
        {" · "}
        <Link to="/examples">Explore examples</Link>
        {" · "}
        <Link to="/system">Current status and milestone exits</Link>
      </p>

      <p className="landing__foot">
        The explorer runs the checked-out engine over {contractsById.size}{" "}
        repository contracts. Generated previews are useful engine checks;
        native Figma verification remains separate.{" "}
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          Source on GitHub
        </a>{" "}
        ·{" "}
        <a
          href={`${REPO_URL}/blob/main/docs/CURRENT.md`}
          target="_blank"
          rel="noreferrer"
        >
          Current status
        </a>
      </p>
    </div>
  );
}
