import { useMemo } from 'react';
import type { Contract } from '../../../core/index.js';
import { buildCanvasPreview } from '../engine/canvas-preview';
import { useTokenSource } from '../engine/token-source';
import { InfoPopover } from './InfoPopover';

/** The DESIGN side of the contract: the figma engine's compiled node specs
 *  (the same data the sync script serializes) rendered as a Figma-canvas-
 *  styled document. Always light, like Figma — deliberately not themed.
 *  Sandboxed srcdoc iframe, static markup + CSS by construction.
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
  if (!result.ok) {
    return (
      <div className="output__error">
        Canvas preview refused — {result.error}
      </div>
    );
  }
  return (
    <>
      <div className="preview__cap">
        <span>{cap}</span>
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
      <iframe sandbox="" srcDoc={result.doc} title={title} />
    </>
  );
}
