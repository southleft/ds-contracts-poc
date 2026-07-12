import { useEffect, useMemo, useRef, useState } from 'react';
import type { Contract } from '../../../core/index.js';
import { buildCanvasPreview } from '../engine/canvas-preview';
import { measureDocSize, type DocSize } from '../engine/measure';
import { useTokenSource } from '../engine/token-source';
import { InfoPopover } from './InfoPopover';

/** Below this the grid stops being readable — the frame keeps this scale and
 *  scrolls the remainder instead (visible scrollbar, styled in .canvas-fit). */
const MIN_FIT_SCALE = 0.45;

/** The DESIGN side of the contract: the figma engine's compiled node specs
 *  (the same data the sync script serializes) rendered as a Figma-canvas-
 *  styled document. Always light, like Figma — deliberately not themed.
 *  Sandboxed srcdoc iframe, static markup + CSS by construction.
 *
 *  Fit-to-pane: the document's natural size is measured offscreen
 *  (engine/measure.ts — the sandboxed visible frame can't report it) and the
 *  frame scales DOWN to the pane width, so a 945px variant grid is visible
 *  at rest in a 282px split pane instead of silently clipping. The cap shows
 *  the applied zoom; below MIN_FIT_SCALE the wrapper scrolls.
 *
 *  The frame owns its caption row: the Canvas label plus the ⓘ popover
 *  holding the NAMED fidelity notes (formerly a footer inside the canvas). */
export function CanvasFrame({
  contract,
  contracts,
  title,
  cap = 'Canvas — figma engine',
}: {
  contract: Contract;
  contracts: Map<string, Contract>;
  title: string;
  /** Caption label — swaps to "compiled from the contract" beside ground truth. */
  cap?: string;
}) {
  // buildCanvasPreview reads the active token source (minted layer included);
  // subscribing here re-renders when the source changes.
  const tokenSource = useTokenSource();
  const result = useMemo(
    () => buildCanvasPreview(contract, contracts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contract, contracts, tokenSource],
  );

  const doc = result.ok ? result.doc : null;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<DocSize | null>(null);
  const [paneWidth, setPaneWidth] = useState<number | null>(null);

  useEffect(() => {
    setNatural(null);
    if (!doc) return;
    let cancelled = false;
    void measureDocSize(doc).then((size) => {
      if (!cancelled) setNatural(size);
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setPaneWidth(el.clientWidth));
    observer.observe(el);
    setPaneWidth(el.clientWidth);
    return () => observer.disconnect();
  }, [result.ok]);

  if (!result.ok) {
    return <div className="output__error">Canvas preview refused — {result.error}</div>;
  }

  const scale =
    natural && paneWidth && natural.width > paneWidth
      ? Math.max(MIN_FIT_SCALE, paneWidth / natural.width)
      : 1;
  const fitted = natural !== null && scale < 1;

  return (
    <>
      <div className="preview__cap">
        <span>{cap}</span>
        {fitted ? (
          <span
            className="preview__cap-zoom"
            title="Scaled down so the whole variant grid fits the pane — the document itself is unchanged."
          >
            fit {Math.round(scale * 100)}%
          </span>
        ) : null}
        <InfoPopover title="Fidelity notes — what this HTML render of the canvas can and cannot mimic">
          <p>
            <strong>Deterministic — both sides compiled from the same contract; no AI.</strong>{' '}
            This is the sync script’s node spec rendered as HTML. Fidelity notes:
          </p>
          <ul>
            {result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </InfoPopover>
      </div>
      <div className="canvas-fit" ref={wrapRef}>
        {fitted && natural ? (
          // The horizontal scrollbar (floored-scale case) lives on this inner
          // wrapper, so it sits directly UNDER the grid — a visible, adjacent
          // affordance instead of an overlay bar a pane-height away.
          <div className="canvas-fit__scroll">
            <div
              className="canvas-fit__box"
              style={{ width: Math.ceil(natural.width * scale), height: Math.ceil(natural.height * scale) }}
            >
              <iframe
                sandbox=""
                srcDoc={result.doc}
                title={title}
                style={{
                  width: natural.width,
                  height: natural.height,
                  transform: `scale(${scale})`,
                  transformOrigin: '0 0',
                  border: 0,
                }}
              />
            </div>
          </div>
        ) : (
          <iframe sandbox="" srcDoc={result.doc} title={title} />
        )}
      </div>
    </>
  );
}
