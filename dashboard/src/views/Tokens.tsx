import { useEffect, useState } from 'react';
import { catalog, semanticTokens, semanticTokensByGroup } from '../data';
import type { TokenInfo } from '../data';
import { Source } from '../ui';

const GROUP_LABELS: Record<string, string> = {
  color: 'Color',
  space: 'Space',
  radius: 'Radius',
  size: 'Size',
  font: 'Font',
  border: 'Border',
  opacity: 'Opacity',
};

const GROUP_LEDES: Record<string, string> = {
  color: 'Surface, action, and feedback colors — the swatch shows the value the current theme resolves to.',
  space: 'Padding and gap scales — each bar is drawn relative to the largest space token, with its real value printed beside it.',
  radius: 'Corner rounding used by the generated components (the dashboard chrome itself is deliberately square).',
  size: 'Fixed component dimensions — bars are relative to the largest size token, so wide values like table width stay in frame.',
  font: 'Type family, sizes, and weights — the specimen renders with the actual token applied.',
  border: 'Stroke widths, shown at relative scale with the literal value printed.',
};

/**
 * Resolve every semantic token to its literal value from the loaded
 * stylesheet (src/styles/tokens.css). Re-resolves when the theme attribute
 * flips so color values track light/dark live.
 */
function useResolvedTokenValues(): Map<string, string> {
  const [values, setValues] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    const resolve = () => {
      const style = getComputedStyle(document.documentElement);
      const next = new Map<string, string>();
      for (const token of semanticTokens) {
        next.set(token.cssVar, style.getPropertyValue(token.cssVar).trim());
      }
      setValues(next);
    };
    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return values;
}

function parsePx(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(-?\d*\.?\d+)px$/.exec(value);
  return match ? Number(match[1]) : null;
}

function TokenPreview({
  token,
  value,
  groupMaxPx,
}: {
  token: TokenInfo;
  value: string | undefined;
  groupMaxPx: number;
}) {
  const varRef = `var(${token.cssVar})`;

  if (token.group === 'color') {
    return <span className="swatch" style={{ background: varRef }} aria-hidden="true" />;
  }
  if (token.group === 'radius') {
    return <span className="radius-square" style={{ borderRadius: varRef }} aria-hidden="true" />;
  }
  if (token.group === 'space' || token.group === 'size' || token.group === 'border') {
    // Bars are scaled relative to the LARGEST token in the group (never the
    // literal pixel width, which can exceed the track — e.g. 480px table
    // width) and hard-capped at 100% of the track.
    const px = parsePx(value);
    const width = px !== null && groupMaxPx > 0 ? `${(px / groupMaxPx) * 100}%` : varRef;
    return (
      <span className="dim-bar-track" aria-hidden="true">
        <span className="dim-bar" style={{ width }} />
      </span>
    );
  }
  if (token.group === 'font') {
    if (token.dotPath.includes('size')) {
      return (
        <span className="specimen" style={{ fontSize: varRef }} aria-hidden="true">
          Ag
        </span>
      );
    }
    if (token.type === 'fontWeight' || token.dotPath.includes('weight')) {
      return (
        <span
          className="specimen"
          style={{ fontWeight: `var(${token.cssVar})` as never }}
          aria-hidden="true"
        >
          Ag
        </span>
      );
    }
    if (token.type === 'fontFamily' || token.dotPath.includes('family')) {
      return (
        <span className="specimen" style={{ fontFamily: varRef }} aria-hidden="true">
          Ag
        </span>
      );
    }
  }
  return <span className="muted">—</span>;
}

export function Tokens() {
  const groups = semanticTokensByGroup();
  const resolved = useResolvedTokenValues();

  // Largest resolved px value per group — the 100% reference for bars.
  const groupMaxPx = new Map<string, number>();
  for (const [groupName, tokens] of groups) {
    let max = 0;
    for (const token of tokens) {
      const px = parsePx(resolved.get(token.cssVar));
      if (px !== null && px > max) max = px;
    }
    groupMaxPx.set(groupName, max);
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Tokens</h1>
        <p className="page-lede">
          Every visual decision in the system — color, spacing, type — is a named token defined
          once and consumed by both surfaces. {catalog.tokens.allCssVariables.length} custom
          properties total · {catalog.tokens.semanticCssVariables.length} semantic. Each semantic
          token exists twice — as a CSS custom property in code and as a Figma variable on canvas —
          resolved from the same source. Values below are read live from the loaded stylesheet;
          the theme toggle in the header switches modes live.
        </p>
      </header>

      {[...groups.entries()].map(([groupName, tokens]) => (
        <section className="section" key={groupName}>
          <h2 className="micro section-label">
            {GROUP_LABELS[groupName] ?? groupName} · {tokens.length}
          </h2>
          {GROUP_LEDES[groupName] ? (
            <p className="section-lede muted">{GROUP_LEDES[groupName]}</p>
          ) : null}
          <div className="token-list">
            {tokens.map((token) => (
              <div className="token-row" key={token.cssVar}>
                <span className="token-preview">
                  <TokenPreview
                    token={token}
                    value={resolved.get(token.cssVar)}
                    groupMaxPx={groupMaxPx.get(groupName) ?? 0}
                  />
                </span>
                <span className="token-value mono" title={resolved.get(token.cssVar)}>
                  {resolved.get(token.cssVar) || '—'}
                </span>
                <span className="token-css mono">{token.cssVar}</span>
                <span className="token-figma mono muted">{token.figmaName}</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <Source path="tokens/semantic.tokens.json · tokens/modes/semantic.light.tokens.json · values resolved live from src/styles/tokens.css" />
    </div>
  );
}
