import { Link } from '../router';
import { REPO_URL } from '../App';
import { contractsById } from '../engine/data';

export function Landing() {
  return (
    <div className="landing">
      <p className="landing__kicker">Design-system contracts — proof of concept</p>
      <h1>The contract loop, in your browser.</h1>
      <p className="landing__pitch">
        A component contract is a machine-readable agreement about a component&rsquo;s API,
        anatomy, and token bindings — one source of truth that both design tools and code
        generate from. This playground runs the actual engine behind a{' '}
        {contractsById.size}-component library: import a design or paste code, watch a contract
        be proposed, edit it under schema governance, and generate React, static HTML, and a
        Figma sync script from the same document. Everything runs client-side; nothing you
        paste leaves your browser.
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
        <span className="landing__loop-step">schema governance (named refusals)</span>
        <span className="landing__loop-arrow" aria-hidden>
          →
        </span>
        <span className="landing__loop-step">React · HTML · inline · Figma</span>
      </div>

      <div className="landing__ctas">
        <Link to="/examples" className="cta">
          <div className="cta__title">Try an example</div>
          <div className="cta__desc">
            Pick from the gallery — atoms to compositions, plus foreign code degrading honestly.
          </div>
        </Link>
        <Link to="/playground?source=figma" className="cta">
          <div className="cta__title">Import from Figma</div>
          <div className="cta__desc">
            Paste a figma.com component URL + token; get a proposed contract with real bindings
            or named degradations.
          </div>
        </Link>
        <Link to="/playground?source=code" className="cta">
          <div className="cta__title">Paste code</div>
          <div className="cta__desc">
            TSX + CSS in, a proposed contract out — raw values reported with nearest-token
            candidates, never invented.
          </div>
        </Link>
      </div>

      <p className="landing__foot">
        Same engine, no demo copy: the code emitting here generates the repo&rsquo;s{' '}
        {contractsById.size} shipping components, byte-guarded by its evals.{' '}
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          Source on GitHub
        </a>{' '}
        ·{' '}
        <a href={`${REPO_URL}/blob/main/MILESTONES.md`} target="_blank" rel="noreferrer">
          Milestones
        </a>
      </p>
    </div>
  );
}
