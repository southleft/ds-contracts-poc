import { useMemo } from 'react';
import type { Contract } from '../../../core/index.js';
import { buildPreview } from '../engine/preview';
import { useTokenSource } from '../engine/token-source';
import { useTheme } from '../theme';

/** Sandboxed srcdoc iframe rendering the `html` emitter's output with the
 *  repo token stylesheets. allow-same-origin is NOT granted — the document
 *  is static markup + CSS by construction (no scripts emitted). */
export function PreviewFrame({
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
  const { theme } = useTheme();
  // buildPreview reads the active token source; subscribing here re-renders
  // the frame when the user applies (or resets) a pasted token tree.
  const tokenSource = useTokenSource();
  const result = useMemo(
    () => buildPreview(contract, contracts, theme),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contract, contracts, theme, tokenSource],
  );
  if (!result.ok) {
    return <div className="output__error">{result.error}</div>;
  }
  return <iframe className={className} sandbox="" srcDoc={result.doc} title={title} />;
}
