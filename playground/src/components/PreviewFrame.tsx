import { useMemo } from 'react';
import type { Contract } from '../../../core/index.js';
import { buildPreview, type PreviewSurface } from '../engine/preview';
import { useTokenSource } from '../engine/token-source';

/** Sandboxed srcdoc iframe rendering the `html` emitter's output with the
 *  repo token stylesheets on a neutral canvas surface (independent of the
 *  app theme — see PreviewSurface). allow-same-origin is NOT granted — the
 *  document is static markup + CSS by construction (no scripts emitted). */
export function PreviewFrame({
  contract,
  contracts,
  title,
  className,
  surface = 'light',
}: {
  contract: Contract;
  contracts: Map<string, Contract>;
  title: string;
  className?: string;
  surface?: PreviewSurface;
}) {
  // buildPreview reads the active token source; subscribing here re-renders
  // the frame when the user applies (or resets) a pasted token tree.
  const tokenSource = useTokenSource();
  const result = useMemo(
    () => buildPreview(contract, contracts, surface),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contract, contracts, surface, tokenSource],
  );
  if (!result.ok) {
    return <div className="output__error">{result.error}</div>;
  }
  return <iframe className={className} sandbox="" srcDoc={result.doc} title={title} />;
}
