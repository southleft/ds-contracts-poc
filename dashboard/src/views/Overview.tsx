import { Alert, AlertDescription, AlertTitle, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Section, Source } from '../components/ui';
import { adherence, catalog, components, evals, nativeComponentCount, parity, reportedGap, semanticTokens } from '../data';
import type { ArmSummary } from '../data';

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardDescription className="text-xs tracking-widest uppercase">{label}</CardDescription>
        <CardTitle className="text-3xl font-light tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground px-4 text-xs">{note}</CardContent>
    </Card>
  );
}

function ABBar({ label, summary, tone }: { label: string; summary: ArmSummary; tone: 'primary' | 'warning' }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm">
        <span className="font-medium">{label}</span> — {summary.meanScore} · {summary.adherentScreens}/{summary.screens}{' '}
        screens adherent · {summary.totalViolations}/{summary.totalChecks} violations
      </p>
      <div
        className="bg-muted h-3 w-full overflow-hidden rounded-sm"
        role="img"
        aria-label={`${label}: mean score ${summary.meanScore} of 100`}
      >
        <div
          className={tone === 'primary' ? 'bg-primary h-full' : 'bg-warning h-full'}
          style={{ width: `${summary.meanScore}%` }}
        />
      </div>
    </div>
  );
}

export function Overview() {
  const armA = adherence.summary['arm-a'];
  const armB = adherence.summary['arm-b'];

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">One contract. Two surfaces. Zero drift.</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
          A machine-readable contract is the single source of truth between the Figma library and the React codebase.
          Everything on this page is read live from the governed artifacts — nothing is typed in by hand.
        </p>
      </div>

      <Section
        title="System status"
        lead="Computed from the artifacts the pipeline itself produces: what exists, whether the surfaces agree, and whether the checks pass."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Stat label="Components" value={String(components.length)} note={`${nativeComponentCount} map to native canvas features`} />
          <Stat label="Tokens" value={String(catalog.tokens.allCssVariables.length)} note={`custom properties · ${semanticTokens.length} semantic`} />
          <Stat label="Evals" value={`${evals.passed}/${evals.total}`} note="deterministic claims passing" />
          <Stat
            label="Parity"
            value={parity.findings.length === 0 ? 'Clean' : String(parity.findings.length)}
            note={`${parity.checkedContracts.length} contracts checked · ${parity.findings.length} drift findings`}
          />
          <Stat label="Adherence" value={`${armA.meanScore} vs ${armB.meanScore}`} note="governed vs ungoverned generation" />
        </div>
        <Source path="catalog/catalog.json · parity/report.json · evals/results.json · evals/adherence/results.json" />
      </Section>

      <Section
        title="The loop"
        lead="Both surfaces are generated from the contract, and the parity check verifies each one against it — surfaces are never copied into each other."
      >
        <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-3">
          <Card className="justify-center py-4 text-center">
            <CardContent className="space-y-1">
              <p className="font-medium">Code surface</p>
              <p className="text-muted-foreground text-xs">React + CSS Modules + Storybook</p>
            </CardContent>
          </Card>
          <Card className="border-primary justify-center border-2 py-4 text-center">
            <CardContent className="space-y-1">
              <p className="text-primary font-semibold tracking-wide">CONTRACT</p>
              <p className="text-muted-foreground text-xs">the governed source — contracts/*.contract.json + tokens/</p>
            </CardContent>
          </Card>
          <Card className="justify-center py-4 text-center">
            <CardContent className="space-y-1">
              <p className="font-medium">Design surface</p>
              <p className="text-muted-foreground text-xs">Figma variables + component sets</p>
            </CardContent>
          </Card>
        </div>
        <p className="text-muted-foreground text-center text-xs">
          changes on either side are <span className="text-foreground font-medium">promoted into the contract</span> — never
          synced side-to-side
        </p>
      </Section>

      <Section
        title="Adherence, A/B"
        lead={`Does governance change what an AI generates? The same ${armA.screens} screens were generated twice — once with the governed catalog in context, once without. The deterministic judge scored both arms against the org rules.`}
      >
        <div className="max-w-3xl space-y-4">
          <ABBar label="With governed catalog" summary={armA} tone="primary" />
          <ABBar label="Without" summary={armB} tone="warning" />
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              Ungoverned violations, by rule
            </p>
            {Object.entries(armB.violationsByRule).map(([rule, count]) => (
              <div key={rule} className="flex items-center gap-3 text-xs">
                <code className="w-40 shrink-0 sm:w-52">{rule}</code>
                <div className="bg-muted h-2 min-w-0 flex-1 overflow-hidden rounded-sm">
                  <div className="bg-destructive/70 h-full" style={{ width: `${(count / armB.totalViolations) * 100}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <Source path="evals/adherence/results.json" />
      </Section>

      {reportedGap ? (
        <Section
          title="Show the gaps, never fake it"
          lead="During the eval, the governed generator hit something the contracts couldn't express — and reported it instead of inventing a lookalike. The quote below is extracted from the generator's actual output file, not restated."
        >
          <Alert variant="warning" className="max-w-3xl">
            <AlertTitle className="font-mono text-xs leading-5 font-normal">{reportedGap}</AlertTitle>
            <AlertDescription>
              Promoted through the standard loop as{' '}
              <Badge variant="outline" className="font-mono">
                ds.table-row v{components.find((c) => c.id === 'ds.table-row')?.version}
              </Badge>{' '}
              — the slot's accepts list was widened (a minor version, per the compatibility rule), and the corrected
              composition became legal for every consumer.
            </AlertDescription>
          </Alert>
          <Source path="evals/adherence/arm-a/account-overview.tsx (?raw import) · catalog/catalog.json" />
        </Section>
      ) : null}
    </>
  );
}
