import { useState } from 'react';
import { Badge, Button } from '../../../src/components';
import { runTask, UNAVAILABLE_NOTE } from '../api';
import type { RunResult } from '../api';
import { catalog, parity } from '../data';
import { Source } from '../ui';

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

type RunState =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'done'; result: RunResult }
  | { phase: 'unavailable' }
  | { phase: 'error'; message: string };

function RunParityControl() {
  const [state, setState] = useState<RunState>({ phase: 'idle' });

  const run = async () => {
    setState({ phase: 'running' });
    const response = await runTask('parity');
    if (response.status === 'ok') {
      setState({ phase: 'done', result: response.data });
    } else if (response.status === 'unavailable') {
      setState({ phase: 'unavailable' });
    } else {
      setState({ phase: 'error', message: response.message });
    }
  };

  return (
    <section className="section">
      <h2 className="micro section-label">Run it yourself</h2>
      <p className="section-lede">
        This button executes the actual parity differ in the repo, right now — nothing on this
        page is pre-recorded.
      </p>
      <div className="run-controls">
        <Button variant="primary" size="sm" loading={state.phase === 'running'} onClick={run}>
          Run parity check
        </Button>
        {state.phase === 'running' ? (
          <span className="muted">
            running <span className="mono">npx tsx parity/diff.ts</span>…
          </span>
        ) : null}
        {state.phase === 'unavailable' ? (
          <span className="muted">{UNAVAILABLE_NOTE}</span>
        ) : null}
        {state.phase === 'error' ? (
          <span className="run-error">failed: {state.message}</span>
        ) : null}
        {state.phase === 'done' ? (
          <span className="mono muted">exit code {state.result.exitCode}</span>
        ) : null}
      </div>
      {state.phase === 'done' ? (
        <>
          <pre className="run-output mono">{state.result.output || '(no output)'}</pre>
          <p className="muted run-note">
            this executed <span className="mono">npm run parity</span> against the repo —{' '}
            <span className="mono">parity/report.json</span> was rewritten and Vite hot-reloaded
            the data above
          </p>
        </>
      ) : null}
    </section>
  );
}

export function Parity() {
  const clean = parity.findings.length === 0;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Parity</h1>
        <p className="page-lede">
          This page answers one question: do the shipped code and the published Figma library
          still match the contract? The parity check diffs both surfaces against the contract —
          never against each other. Last checked at commit{' '}
          <span className="mono">{catalog.system.gitCommit}</span>.
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
          <p className="section-lede muted">
            Each finding is one detected drift between a surface and the contract, with the exact
            remedy the loop prescribes.
          </p>
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
      <Source path="parity/report.json" />

      <RunParityControl />

      <section className="section">
        <h2 className="micro section-label">
          Checked contracts · {parity.checkedContracts.length}
        </h2>
        <p className="section-lede muted">
          Every contract the differ verified on its last run — full coverage of the catalog, not a
          sample.
        </p>
        <div className="chip-row chip-row--wrap">
          {parity.checkedContracts.map((contract) => (
            <span key={contract} className="chip mono">
              {contract}
            </span>
          ))}
        </div>
        <Source path="parity/report.json" />
      </section>

      <section className="section">
        <h2 className="micro section-label">How findings are classified</h2>
        <p className="section-lede muted">
          Every possible drift falls into one of three classes, and each class has exactly one
          prescribed remedy — so a finding is always actionable.
        </p>
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
