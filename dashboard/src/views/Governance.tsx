import { Badge, TableCell, TableHeaderCell, TableRow } from '../../../src/components';
import { adherence, catalog, evals, evalsByClaim } from '../data';

const CLAIM_LABELS: Record<string, string> = {
  'C1-determinism': 'C1 — Determinism',
  'C2-refusal': 'C2 — Refusal',
  'C3-detection': 'C3 — Detection',
  'C4-convergence': 'C4 — Convergence',
};

export function Governance() {
  const armA = adherence.summary['arm-a'];
  const armB = adherence.summary['arm-b'];

  const screens = armA.perScreen.map((screen) => ({
    file: screen.file,
    governed: screen,
    ungoverned: armB.perScreen.find((other) => other.file === screen.file),
  }));

  const claims = evalsByClaim();

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Governance</h1>
        <p className="page-lede">
          The org rules ship inside the catalog, so every consumer — human or agent — reads the
          same constitution. Deterministic rules are enforced by the judge; the rest guide the
          agent.
        </p>
      </header>

      <section className="section">
        <h2 className="micro section-label">Org rules · {catalog.rules.length}</h2>
        <div className="rule-list">
          {catalog.rules.map((rule) => (
            <div className="rule-row" key={rule.id}>
              <div className="rule-main">
                <span className="mono muted rule-id">{rule.id}</span>
                <p className="rule-statement">{rule.statement}</p>
                {rule.forbiddenRawElements ? (
                  <span className="chip-row">
                    {rule.forbiddenRawElements.map((element) => (
                      <span key={element} className="chip mono">
                        &lt;{element}&gt;
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
              <Badge variant={rule.enforcement === 'judge' ? 'success' : 'info'}>
                {rule.enforcement === 'judge' ? 'deterministic' : 'guidance'}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="micro section-label">Adherence per screen</h2>
        <p className="section-lede">
          Judge scores for the same five screens, generated with and without the governed catalog.
          Rendered with the system's own TableRow / TableCell components.
        </p>
        <div className="score-table" role="table" aria-label="Adherence per screen">
          <TableRow>
            <TableHeaderCell>Screen</TableHeaderCell>
            <TableHeaderCell>Governed</TableHeaderCell>
            <TableHeaderCell>Ungoverned</TableHeaderCell>
          </TableRow>
          {screens.map((screen) => (
            <TableRow key={screen.file}>
              <TableCell>{screen.file.replace('.tsx', '')}</TableCell>
              <TableCell>{`${screen.governed.score} ✓`}</TableCell>
              <TableCell>
                {screen.ungoverned
                  ? `${screen.ungoverned.score} · ${screen.ungoverned.violations} violations`
                  : '—'}
              </TableCell>
            </TableRow>
          ))}
        </div>
        <p className="muted score-note">
          Governed mean {armA.meanScore} · Ungoverned mean {armB.meanScore} ·{' '}
          {armB.totalViolations} violations across {armB.screens} ungoverned screens
        </p>
      </section>

      <section className="section">
        <h2 className="micro section-label">
          Eval suite · {evals.passed}/{evals.total} passing
        </h2>
        <div className="eval-groups">
          {[...claims.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([claim, results]) => (
            <div className="eval-group" key={claim}>
              <h3 className="micro">{CLAIM_LABELS[claim] ?? claim}</h3>
              <ul className="eval-list">
                {results.map((result) => (
                  <li key={result.id} className="eval-item">
                    <span
                      className={result.pass ? 'eval-mark eval-mark--pass' : 'eval-mark eval-mark--fail'}
                    >
                      {result.pass ? '✓' : '—'}
                    </span>
                    <span className="mono">{result.id}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
