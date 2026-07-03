import { Badge } from '../../../src/components';
import { catalog, parity } from '../data';

function classificationVariant(
  classification: 'ahead' | 'behind' | 'mismatch',
): 'info' | 'warning' | 'danger' {
  if (classification === 'ahead') return 'warning';
  if (classification === 'behind') return 'info';
  return 'danger';
}

const CLASSIFICATIONS = [
  {
    name: 'ahead',
    badge: 'warning' as const,
    summary: 'A surface gained a capability the contract lacks.',
    remedy: 'Propose a contract patch — the change is promoted, never synced sideways.',
  },
  {
    name: 'behind',
    badge: 'info' as const,
    summary: 'A surface is missing something the contract declares.',
    remedy: 'Regenerate that surface from the contract.',
  },
  {
    name: 'mismatch',
    badge: 'danger' as const,
    summary: 'The surfaces disagree with each other or with the contract.',
    remedy: 'The contract is canonical — correct the surfaces to match it.',
  },
];

export function Parity() {
  const clean = parity.findings.length === 0;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Parity</h1>
        <p className="page-lede">
          The parity check diffs both surfaces against the contract — never against each other.
          Last checked at commit <span className="mono">{catalog.system.gitCommit}</span>.
        </p>
      </header>

      {clean ? (
        <div className="parity-hero parity-hero--clean">
          <span className="parity-hero-mark" aria-hidden="true">
            ✓
          </span>
          <div>
            <p className="parity-hero-title">
              Parity clean — code, Figma, and tokens all match the contract
            </p>
            <p className="parity-hero-sub">
              {parity.checkedContracts.length} contracts checked · 0 findings
            </p>
          </div>
        </div>
      ) : (
        <section className="section">
          <h2 className="micro section-label">Findings · {parity.findings.length}</h2>
          <div className="findings">
            {parity.findings.map((finding, index) => (
              <div className="finding-row" key={index}>
                <Badge variant={classificationVariant(finding.classification)}>
                  {finding.classification}
                </Badge>
                <span className="mono">{finding.subject}</span>
                <span>{finding.detail}</span>
                <span className="muted">{finding.remedy}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="micro section-label">
          Checked contracts · {parity.checkedContracts.length}
        </h2>
        <div className="chip-row chip-row--wrap">
          {parity.checkedContracts.map((contract) => (
            <span key={contract} className="chip mono">
              {contract}
            </span>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="micro section-label">How findings are classified</h2>
        <div className="classification-grid">
          {CLASSIFICATIONS.map((classification) => (
            <div className="classification-card" key={classification.name}>
              <Badge variant={classification.badge}>{classification.name}</Badge>
              <p>{classification.summary}</p>
              <p className="muted">{classification.remedy}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
