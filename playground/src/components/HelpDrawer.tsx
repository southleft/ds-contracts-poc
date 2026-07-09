import { useEffect, useRef } from 'react';

/**
 * "How do I use this?" — a plain right-side drawer. No tour machinery: six
 * short sections, one per way in, imperative voice. Esc, the Close button,
 * or a click outside dismisses it.
 */
export function HelpDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="drawer__scrim" onClick={onClose} aria-hidden />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="How to use the playground">
        <div className="drawer__head">
          <span className="pane__title">How do I use this?</span>
          <button type="button" ref={closeRef} className="btn--small drawer__close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="drawer__body">
          <section>
            <h3 className="drawer__section-title">Coming from design</h3>
            <p>
              Open the <b>Figma</b> tab. Three rungs, by variable-name fidelity: paste a plugin
              dump in the JSON tab (native names, zero ambiguity); run{' '}
              <code>npm run extract:figma:mcp</code> in the repo against the desktop app (full
              names on any plan — CLI-only, the desktop server allows no browser origins); or
              paste a figma.com URL + token here. The token stays in your browser, sent only to
              api.figma.com. When the plan withholds variable names, resolved values are minted
              as provisional <code>imported.*</code> tokens — the preview stays styled, the
              receipts list every mint, and &lsquo;Suggest semantic names (AI)&rsquo; proposes
              renames you apply one by one, refereed. No token? Demo import runs the identical
              path over a committed fixture.
            </p>
          </section>
          <section>
            <h3 className="drawer__section-title">Coming from code</h3>
            <p>
              Open the <b>Code</b> tab. Paste TSX + CSS, or a public GitHub file or directory
              URL — the tracer follows the entry&rsquo;s relative imports (every fetch
              receipted), and anything it cannot close is a named gap with an AI fetch-plan as
              the next rung. Every raw value is reported with nearest-token candidates, nothing
              invented. Check the Figma script tab for its design side.
            </p>
          </section>
          <section>
            <h3 className="drawer__section-title">Using the examples</h3>
            <p>
              Pick a contract from the <b>Examples</b> gallery. Edit it in the center pane — the
              schema and generator referee every keystroke, refusals by name, offending lines
              highlighted. The output tabs regenerate live.
            </p>
          </section>
          <section>
            <h3 className="drawer__section-title">Starting from nothing</h3>
            <p>
              Open the <b>Describe</b> tab. One sentence plus your Anthropic key generates a
              contract — never freeform code — refereed by the same editor. No key? Demo generate
              replays a recorded response through the same path.
            </p>
          </section>
          <section>
            <h3 className="drawer__section-title">Tokens</h3>
            <p>
              Bring your own: paste DTCG token JSON in the <b>Tokens</b> tab and every consumer —
              validation, preview, suggestions, emitters — rebinds to your tree.
            </p>
          </section>
          <section>
            <h3 className="drawer__section-title">Share</h3>
            <p>
              <b>Share</b> copies a URL carrying the contract, output tab, and theme — never your
              tokens or keys.
            </p>
          </section>
          <section>
            <h3 className="drawer__section-title">Glossary</h3>
            <dl className="drawer__glossary">
              <dt>Contract</dt>
              <dd>
                The one JSON document that describes a component — its props, structure, and
                token references — from which every output is generated.
              </dd>
              <dt>Anatomy</dt>
              <dd>
                The contract&rsquo;s named tree of parts (root, label, icon…) that both the CSS
                and the Figma layers are built from.
              </dd>
              <dt>Token binding</dt>
              <dd>
                A style tied to a design-token name, like{' '}
                <code>{'{color.action.primary.background}'}</code>, instead of a hard-coded value.
              </dd>
              <dt>Emitter</dt>
              <dd>
                A function that turns a contract into one kind of output — React code, plain
                HTML, or a script that builds the Figma component.
              </dd>
              <dt>Refusal</dt>
              <dd>
                The engine declining to generate because something in the contract is wrong, with
                the exact reason named — never a silent guess or fix.
              </dd>
              <dt>Degradation</dt>
              <dd>
                When an import can&rsquo;t get full information (say, no variable names), the
                result steps down a tier and reports what was missing instead of inventing it.
              </dd>
              <dt>Promotion</dt>
              <dd>
                A change made on one surface (design or code) becoming a reviewed update to the
                contract, which then regenerates the other surface to match.
              </dd>
            </dl>
          </section>
        </div>
      </aside>
    </>
  );
}
