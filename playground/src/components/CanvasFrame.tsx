import { useMemo } from 'react';
import type { Contract } from '../../../core/index.js';
import { buildCanvasPreview } from '../engine/canvas-preview';
import { useTokenSource } from '../engine/token-source';

/** The DESIGN side of the contract: the figma engine's compiled node specs
 *  (the same data the sync script serializes) rendered as a Figma-canvas-
 *  styled document. Always light, like Figma — deliberately not themed.
 *  Sandboxed srcdoc iframe, static markup + CSS by construction. */
export function CanvasFrame({
  contract,
  contracts,
  title,
  className,
}: {
  contract: Contract;
  contracts: Map<string, Contract>;
  title: string;
  className?: string;
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
  return <iframe className={className} sandbox="" srcDoc={result.doc} title={title} />;
}
