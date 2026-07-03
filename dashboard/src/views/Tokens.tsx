import { catalog, semanticTokensByGroup } from '../data';
import type { TokenInfo } from '../data';

const GROUP_LABELS: Record<string, string> = {
  color: 'Color',
  space: 'Space',
  radius: 'Radius',
  size: 'Size',
  font: 'Font',
  border: 'Border',
  opacity: 'Opacity',
};

function TokenPreview({ token }: { token: TokenInfo }) {
  const varRef = `var(${token.cssVar})`;

  if (token.group === 'color') {
    return <span className="swatch" style={{ background: varRef }} aria-hidden="true" />;
  }
  if (token.group === 'radius') {
    return <span className="radius-square" style={{ borderRadius: varRef }} aria-hidden="true" />;
  }
  if (token.group === 'space' || token.group === 'size' || token.group === 'border') {
    return (
      <span className="dim-bar-track" aria-hidden="true">
        <span className="dim-bar" style={{ width: varRef }} />
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
        <span className="specimen" style={{ fontWeight: `var(${token.cssVar})` as never }} aria-hidden="true">
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

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Tokens</h1>
        <p className="page-lede">
          {catalog.tokens.allCssVariables.length} custom properties total ·{' '}
          {catalog.tokens.semanticCssVariables.length} semantic. Each semantic token exists twice —
          as a CSS custom property in code and as a Figma variable on canvas — resolved from the
          same source. Swatches below show the <strong>current theme's</strong> value; the theme
          toggle in the header switches modes live.
        </p>
      </header>

      {[...groups.entries()].map(([groupName, tokens]) => (
        <section className="section" key={groupName}>
          <h2 className="micro section-label">
            {GROUP_LABELS[groupName] ?? groupName} · {tokens.length}
          </h2>
          <div className="token-list">
            {tokens.map((token) => (
              <div className="token-row" key={token.cssVar}>
                <span className="token-preview">
                  <TokenPreview token={token} />
                </span>
                <span className="token-css mono">{token.cssVar}</span>
                <span className="token-figma mono muted">{token.figmaName}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
