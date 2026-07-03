import { useState } from 'react';
import { Badge, Button, TableCell, TableHeaderCell, TableRow } from '../../../src/components';
import { judgeSource, UNAVAILABLE_NOTE } from '../api';
import type { JudgeFileReport } from '../api';
import { adherence, catalog, evals, evalsByClaim } from '../data';
import { Source } from '../ui';

const CLAIM_LABELS: Record<string, string> = {
  'C1-determinism': 'C1 — Determinism',
  'C2-refusal': 'C2 — Refusal',
  'C3-detection': 'C3 — Detection',
  'C4-convergence': 'C4 — Convergence',
};

const DEFAULT_SNIPPET = `import { Button, Stack } from 'ds-contracts-poc';

export function Screen() {
  return (
    <Stack gap="md">
      <Button variant="primary">Save</Button>
    </Stack>
  );
}
`;

type JudgeState =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'done'; report: JudgeFileReport }
  | { phase: 'unavailable' }
  | { phase: 'error'; message: string };

function JudgePlayground() {
  const [source, setSource] = useState(DEFAULT_SNIPPET);
  const [state, setState] = useState<JudgeState>({ phase: 'idle' });

  const judge = async () => {
    setState({ phase: 'running' });
    const response = await judgeSource(source);
    if (response.status === 'ok') {
      const report = response.data.report.reports[0];
      if (report) {
        setState({ phase: 'done', report });
      } else {
        setState({ phase: 'error', message: 'judge returned an empty report' });
      }
    } else if (response.status === 'unavailable') {
      setState({ phase: 'unavailable' });
    } else {
      setState({ phase: 'error', message: response.message });
    }
  };

  return (
    <section className="section">
      <h2 className="micro section-label">Judge playground</h2>
      <p className="section-lede">
        Paste any React screen below and score it against the catalog — the same deterministic
        judge that scored the A/B eval, run live against whatever you paste.
      </p>
      <textarea
        className="judge-input mono"
        value={source}
        onChange={(event) => setSource(event.target.value)}
        rows={10}
        spellCheck={false}
        aria-label="Screen source to judge"
      />
      <div className="run-controls">
        <Button variant="primary" size="sm" loading={state.phase === 'running'} onClick={judge}>
          Judge this screen
        </Button>
        {state.phase === 'running' ? (
          <span className="muted">
            running <span className="mono">npx tsx parity/judge.ts</span>…
          </span>
        ) : null}
        {state.phase === 'unavailable' ? <span className="muted">{UNAVAILABLE_NOTE}</span> : null}
        {state.phase === 'error' ? (
          <span className="run-error">failed: {state.message}</span>
        ) : null}
      </div>

      {state.phase === 'done' ? (
        <div className="judge-result">
          <div className="judge-score">
            <span className="stat-value">{state.report.score}</span>
            <span className="stat-note">
              {state.report.adherent ? 'adherent — zero violations' : 'not adherent'} ·{' '}
              {state.report.elements} elements · {state.report.checks} checks ·{' '}
              {state.report.violations.length}{' '}
              {state.report.violations.length === 1 ? 'violation' : 'violations'}
            </span>
          </div>
          {state.report.violations.length > 0 ? (
            <div className="findings">
              {state.report.violations.map((violation, index) => (
                <div className="finding-row finding-row--judge" key={index}>
                  <Badge variant="danger">{violation.rule}</Badge>
                  <span>{violation.detail}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <p className="muted run-note">
        the judge parses the pasted source with the TypeScript compiler and checks every element
        and prop against <span className="mono">catalog/catalog.json</span> — no LLM, no rubric
        drift
      </p>
    </section>
  );
}

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
        <p className="section-lede muted">
          The rules every generated screen is held to — each one is either mechanically checkable
          (enforced by the judge) or advisory (guides the agent).
        </p>
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
        <Source path="catalog/catalog.json (compiled from context/rules.json)" />
      </section>

      <JudgePlayground />

      <section className="section">
        <h2 className="micro section-label">Adherence per screen</h2>
        <p className="section-lede">
          Judge scores for the same {armA.screens} screens, generated with and without the
          governed catalog — the per-screen detail behind the Overview meters. Rendered with the
          system's own TableRow / TableCell components.
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
        <Source path="evals/adherence/results.json" />
      </section>

      <section className="section">
        <h2 className="micro section-label">
          Eval suite · {evals.passed}/{evals.total} passing
        </h2>
        <p className="section-lede muted">
          The PoC's core claims as falsifiable checks — each case runs the real pipeline in a
          scratch copy of the repo and asserts the exact expected behavior.
        </p>
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
                        className={
                          result.pass ? 'eval-mark eval-mark--pass' : 'eval-mark eval-mark--fail'
                        }
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
        <Source path="evals/results.json" />
      </section>
    </div>
  );
}
