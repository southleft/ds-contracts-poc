import { useMemo } from 'react';
import type { Contract } from '../../../core/index.js';
import { buildPreview } from '../engine/preview';
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
  const result = useMemo(() => buildPreview(contract, contracts, theme), [contract, contracts, theme]);
  if (!result.ok) {
    return <div className="output__error">{result.error}</div>;
  }
  return <iframe className={className} sandbox="" srcDoc={result.doc} title={title} />;
}
