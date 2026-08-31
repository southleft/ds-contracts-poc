import { Link } from "../router";
import { REPO_URL } from "../App";
import { contractsById } from "../engine/data";

export function Landing() {
  return (
    <div className="landing">
      <p className="landing__kicker">
        Design-system contracts — pre-pivot playground
      </p>
      <h1>The contract loop, in your browser.</h1>
      <p className="landing__pitch">
        A <b>contract</b> is one JSON file per component. It records the things
        design and engineering have to agree on — the props and their legal
        values, the parts the component is made of, which design token paints
        each part, and its states. Both a React component and a real Figma
        component set are <i>generated</i> from that one file, and then
        continuously checked against it.
      </p>
      <p className="landing__pitch">
        This page runs the real <b>pre-pivot</b> <code>core/</code> engine —
        the same code behind a {contractsById.size}-component library — right
        in your browser. Load a contract, change it, and watch what happens:
        the React, the HTML, the Figma sync script and the canvas preview all
        move together, and anything the engine can&rsquo;t do it says out loud
        instead of guessing. <b>Nothing you paste leaves your browser</b>, and
        there are no accounts.
      </p>
      <p className="landing__pitch">
        <b>Start here:</b> open an example, then break its contract on purpose —
        delete a required field, or point a token binding at a name that
        doesn&rsquo;t exist. The refusal that appears, named and on screen, is
        the whole idea.
      </p>
      <p className="landing__pitch landing__pitch--aside">
        <b>Not the v1 proof.</b> After the recipe-IR pivot, v1 proof is five
        live-minted, owner-signed archetypes (Button, Input, Combobox, Table,
        Calendar) under <code>recipe/</code> — and product v1 is still
        incomplete (F1). This page still proposes and emits the pre-pivot{" "}
        <code>*.contract.json</code> envelope. A playground mint or refusal is
        not recipe-IR evidence.{" "}
        <a
          href={`${REPO_URL}/blob/main/docs/32-recipe-ir-pivot.md`}
          target="_blank"
          rel="noreferrer"
        >
          docs/32
        </a>
        . This playground is for <i>understanding</i> that older loop. Building
        a library into Figma on this path is the CLI plus the companion plugin —{" "}
        <a
          href="https://ds-contracts-spec.pages.dev/get-started/"
          target="_blank"
          rel="noreferrer"
        >
          the three get-started paths
        </a>{" "}
        walk that end to end.
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
