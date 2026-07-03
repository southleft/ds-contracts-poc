import { useState } from 'react';
import {
  Alert, AlertDescription, AlertTitle, Badge, Button, Card, CardContent, CardDescription,
  CardHeader, CardTitle, Section, Source,
} from '../components/ui';
import { catalog, parity } from '../data';
import { runTask, UNAVAILABLE_NOTE, type ApiResponse, type RunResult } from '../api';

const CLASSIFICATIONS = [
  {
    name: 'ahead',
    badge: 'warning' as const,
    what: 'A surface gained a capability the contract lacks.',
    remedy: 'Propose a contract patch — the change is promoted, never synced sideways.',
  },
  {
    name: 'behind',
    badge: 'secondary' as const,
    what: 'A surface is missing something the contract declares.',
    remedy: 'Regenerate that surface from the contract.',
  },
  {
    name: 'mismatch',
    badge: 'destructive' as const,
    what: 'The surfaces disagree with the contract on a value.',
    remedy: 'The contract is canonical: adopt (patch it) or enforce (regenerate).',
  },
];

export function Parity() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResponse<RunResult> | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(await runTask('parity'));
    setBusy(false);
  };

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Parity</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
          One question: do the shipped code and the published Figma library still match the contract? The differ checks
          both surfaces against the contract — never against each other. Last checked at commit{' '}
          <code>{catalog.system.gitCommit}</code>.
        </p>
      </div>

      {parity.findings.length === 0 ? (
        <Alert variant="success" className="max-w-3xl">
          <AlertTitle>✓ Parity clean — code, Figma, and tokens all match the contract</AlertTitle>
          <AlertDescription>
            {parity.checkedContracts.length} contracts checked · 0 findings
          </AlertDescription>
        </Alert>
      ) : (
        <div className="max-w-3xl space-y-2">
          {parity.findings.map((finding, i) => (
            <Alert key={i} variant="warning">
              <AlertTitle className="flex flex-wrap items-center gap-2">
                <Badge variant={finding.classification === 'mismatch' ? 'destructive' : finding.classification === 'ahead' ? 'warning' : 'secondary'}>
                  {finding.surface} {finding.classification}
                </Badge>
                <code className="text-xs">{finding.subject}</code>
              </AlertTitle>
              <AlertDescription>
                {finding.detail}
                <br />
                <span className="text-foreground">→ {finding.remedy}</span>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
      <Source path="parity/report.json" />

      <Section
        title="Run it yourself"
        lead="This button executes the actual parity differ in the repo, right now — nothing on this page is pre-recorded. When the report changes, Vite hot-reloads the data above."
      >
        <div className="max-w-3xl space-y-3">
          <Button onClick={run} disabled={busy}>
            {busy ? 'Running…' : 'Run parity check'}
          </Button>
          {result?.status === 'unavailable' ? <p className="text-muted-foreground text-sm">{UNAVAILABLE_NOTE}</p> : null}
          {result?.status === 'ok' ? (
            <pre className="bg-muted max-h-64 overflow-auto rounded-lg border p-3 font-mono text-xs">
              {result.data.output || `(exit ${result.data.exitCode})`}
            </pre>
          ) : null}
        </div>
      </Section>

      <Section
        title={`Checked contracts · ${parity.checkedContracts.length}`}
        lead="Every contract the differ verified on its last run — full coverage of the catalog, not a sample."
      >
        <div className="flex max-w-4xl flex-wrap gap-1.5">
          {parity.checkedContracts.map((c) => (
            <code key={c} className="bg-muted rounded px-2 py-1 text-xs">{c}</code>
          ))}
        </div>
        <Source path="parity/report.json" />
      </Section>

      <Section
        title="How findings are classified"
        lead="Every possible drift falls into one of three classes, and each class has exactly one prescribed remedy — so a finding is always actionable."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {CLASSIFICATIONS.map((c) => (
            <Card key={c.name} className="gap-2 py-4">
              <CardHeader className="px-4">
                <Badge variant={c.badge} className="w-fit">{c.name}</Badge>
                <CardTitle className="text-sm font-medium">{c.what}</CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <CardDescription>{c.remedy}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
