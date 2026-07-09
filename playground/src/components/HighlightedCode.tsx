import { useEffect, useMemo, useState } from 'react';
import {
  HIGHLIGHT_LIMIT,
  highlight,
  languageForPath,
  loadPrism,
  prismNow,
  type PrismApi,
} from '../engine/prism-lazy';

/**
 * A read-only output code block with syntax colors. Renders plain text
 * immediately; the colors arrive when the lazy Prism chunk does (first
 * output tab render kicks off the fetch). Files at or over 200 KB skip
 * highlighting behind a one-line note — never jank. Anything that can't
 * be colored (unknown extension, tokenizer failure) is simply plain.
 */
export function HighlightedCode({ path, code }: { path: string; code: string }) {
  const lang = languageForPath(path);
  const oversized = code.length >= HIGHLIGHT_LIMIT;
  const [prism, setPrism] = useState<PrismApi | null>(prismNow);
  useEffect(() => {
    if (prism || !lang || oversized) return;
    let live = true;
    void loadPrism()
      .then((p) => {
        if (live) setPrism(p);
      })
      .catch(() => {
        /* chunk failure reported by prism-lazy — stay plain */
      });
    return () => {
      live = false;
    };
  }, [prism, lang, oversized]);

  const html = useMemo(
    () => (prism && lang && !oversized ? highlight(prism, code, lang) : null),
    [prism, lang, oversized, code],
  );

  if (html === null) {
    return (
      <>
        {oversized && lang ? (
          <div className="output__hlnote">Syntax colors skipped — this file is over 200 KB.</div>
        ) : null}
        <pre className="output__code">{code}</pre>
      </>
    );
  }
  return (
    <pre className="output__code code-hl">
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}
