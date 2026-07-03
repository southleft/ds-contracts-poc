import { adherence, catalog, components, evals, nativeComponentCount, parity } from '../data';

const RULE_LABELS: Record<string, string> = {
  'components-from-catalog': 'components-from-catalog',
  'tokens-only': 'tokens-only',
  'no-style-overrides': 'no-style-overrides',
};

export function Overview() {
  const armA = adherence.summary['arm-a'];
  const armB = adherence.summary['arm-b'];
  const parityClean = parity.findings.length === 0;

  const violationEntries = Object.entries(armB.violationsByRule).sort((a, b) => b[1] - a[1]);
  const maxViolations = Math.max(1, ...violationEntries.map(([, count]) => count));

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">One contract. Two surfaces. Zero drift.</h1>
        <p className="page-lede">
          A machine-readable contract is the single source of truth between the Figma library and
          the React codebase. Everything on this page is read live from the governed artifacts.
        </p>
      </header>

      <section className="stat-grid" aria-label="System status">
        <div className="stat">
          <span className="micro">Components</span>
          <span className="stat-value">{components.length}</span>
          <span className="stat-note">{nativeComponentCount} native to canvas</span>
        </div>
        <div className="stat">
          <span className="micro">Tokens</span>
          <span className="stat-value">{catalog.tokens.allCssVariables.length}</span>
          <span className="stat-note">
            custom properties · {catalog.tokens.semanticCssVariables.length} semantic
          </span>
        </div>
        <div className="stat">
          <span className="micro">Evals</span>
          <span className="stat-value">
            {evals.passed}/{evals.total}
          </span>
          <span className="stat-note">claims passing</span>
        </div>
        <div className="stat">
          <span className="micro">Parity</span>
          <span className="stat-value">{parityClean ? 'Clean' : parity.findings.length}</span>
          <span className="stat-note">
            {parityClean
              ? `0 drift findings · ${parity.checkedContracts.length} contracts checked`
              : 'drift findings open'}
          </span>
        </div>
        <div className="stat stat--accent">
          <span className="micro">Adherence</span>
          <span className="stat-value">
            {armA.meanScore} vs {armB.meanScore}
          </span>
          <span className="stat-note">governed vs ungoverned</span>
        </div>
      </section>

      <section className="section">
        <h2 className="micro section-label">The loop</h2>
        <div className="loop">
          <div className="loop-row">
            <div className="loop-box">
              <span className="loop-box-title">Code surface</span>
              <span className="loop-box-sub">React + Storybook</span>
            </div>
            <span className="loop-arrow" aria-hidden="true">
              ←
            </span>
            <div className="loop-box loop-box--contract">
              <span className="loop-box-title">Contract</span>
              <span className="loop-box-sub">the governed source</span>
            </div>
            <span className="loop-arrow" aria-hidden="true">
              →
            </span>
            <div className="loop-box">
              <span className="loop-box-title">Design surface</span>
              <span className="loop-box-sub">Figma variables + components</span>
            </div>
          </div>
          <div className="loop-bar micro">parity check</div>
          <p className="loop-caption muted">
            changes on either side are promoted into the contract — never synced side-to-side
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="micro section-label">Adherence, A/B</h2>
        <p className="section-lede">
          The same five screens were generated twice — once with the governed catalog in context,
          once without it. The judge scored both arms against the org rules.
        </p>

        <div className="meter-block">
          <div className="meter-label">
            <strong>With governed catalog</strong> — {armA.meanScore} · {armA.adherentScreens}/
            {armA.screens} screens adherent · {armA.totalViolations}/{armA.totalChecks} violations
          </div>
          <div className="meter-track">
            <div
              className="meter-fill meter-fill--governed"
              style={{ width: `${armA.meanScore}%` }}
            />
          </div>
        </div>

        <div className="meter-block">
          <div className="meter-label">
            <strong>Without</strong> — {armB.meanScore} · {armB.adherentScreens}/{armB.screens}{' '}
            adherent · {armB.totalViolations}/{armB.totalChecks} violations
          </div>
          <div className="meter-track">
            <div
              className="meter-fill meter-fill--ungoverned"
              style={{ width: `${armB.meanScore}%` }}
            />
          </div>
        </div>

        <div className="rule-breakdown">
          <h3 className="micro">Ungoverned violations, by rule</h3>
          {violationEntries.map(([rule, count]) => (
            <div className="mini-meter" key={rule}>
              <span className="mini-meter-name mono">{RULE_LABELS[rule] ?? rule}</span>
              <span className="mini-meter-track">
                <span
                  className="mini-meter-fill"
                  style={{ width: `${(count / maxViolations) * 100}%` }}
                />
              </span>
              <span className="mini-meter-count">{count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="callout">
          <h2 className="micro section-label">Show the gaps, never fake it</h2>
          <p>
            When the governed generator hit a real limitation, it reported the gap instead of
            inventing a workaround:
          </p>
          <blockquote className="mono">
            GAP: TableHeaderCell has no legal parent slot (Table accepts only TableRow, TableRow
            accepts only TableCell), so the header row uses TableCell.
          </blockquote>
          <p>
            That defect in the vocabulary was promoted through the standard loop as{' '}
            <span className="mono">ds.table-row v1.1.0</span> — the row's cells slot was widened to
            accept header cells, the catalog was re-emitted, and the corrected composition became
            legal on both surfaces.
          </p>
        </div>
      </section>
    </div>
  );
}
