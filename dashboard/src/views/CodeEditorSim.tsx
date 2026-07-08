/**
 * Code Editor Simulator — what a contract-governed in-tool code editor
 * experiences. The contract sits between the editor and BOTH surfaces:
 * every edit is validated against the real Zod schema (the same one the
 * generators run), and valid edits ripple deterministically into an API
 * diff, a canvas amend plan, and version-bump advice — computed entirely
 * client-side by diffing the edited contract against the governed original.
 * Illegal documents are refused by name and never reach either surface.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Label,
  Section,
  Separator,
  Source,
  Textarea,
} from '../components/ui';
import { cn } from '../lib/utils';
import { components, contractFilePath, type ComponentEntry } from '../data';
import { renderSample } from '../samples';
import {
  adviseVersion,
  childrenDefault,
  defaultProps,
  diffApi,
  parseContract,
  planAmend,
  previewAxis,
  ContractSchema,
  type ApiChange,
  type Contract,
  type ParseOutcome,
  type Severity,
} from '../lib/contract-editor';

const DEBOUNCE_MS = 300;

/** Contract-backed components only — the editor edits real governed sources. */
const editable = components.filter((c) => c.contract);

const contractText = (entry: ComponentEntry): string =>
  JSON.stringify(entry.contract, null, 2);

const SEVERITY_BADGE: Record<Severity, 'destructive' | 'warning' | 'secondary'> = {
  major: 'destructive',
  minor: 'warning',
  patch: 'secondary',
};

/* ----------------------------------------------------------- left: picker */

function Picker({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="max-h-72 overflow-y-auto rounded-md border">
      <ul>
        {editable.map((c) => {
          const active = c.id === selectedId;
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(c.id)}
                className={cn(
                  'flex w-full items-baseline justify-between gap-2 border-b px-3 py-1.5 text-left text-[13px] outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-muted font-medium'
                    : 'hover:bg-muted/50',
                )}
              >
                <span className="truncate">{c.name}</span>
                <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                  v{c.version}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------- left: preview */

function Preview({
  entry,
  original,
  edited,
}: {
  entry: ComponentEntry;
  original: Contract;
  edited: Contract | null;
}) {
  // Render from the EDITED contract when it validates — defaults ripple live.
  const contract = edited ?? original;
  const props = defaultProps(contract);
  const childText = childrenDefault(contract);
  const axis = previewAxis(contract);
  const originalAxis = previewAxis(original);
  const knownValues =
    axis && originalAxis && axis.name === originalAxis.name ? originalAxis.values : [];

  if (!axis) {
    return (
      <div className="bg-background rounded-md border border-dashed p-4">
        {renderSample(entry.name, props, childText)}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {axis.values.map((value) => {
        const isNew = !knownValues.includes(value);
        return (
          <div key={value} className="flex items-center gap-3">
            <code className="text-muted-foreground w-24 shrink-0 truncate text-right text-[11px]">
              {value}
            </code>
            {isNew ? (
              <div className="text-muted-foreground flex-1 rounded-md border border-dashed px-3 py-2 text-xs">
                new value — no generated rendering exists yet; the amend plan adds its variants
              </div>
            ) : (
              <div className="bg-background flex-1 overflow-x-auto rounded-md border border-dashed px-3 py-2">
                {renderSample(entry.name, { ...props, [axis.codeProp]: value }, childText)}
              </div>
            )}
          </div>
        );
      })}
      <p className="text-muted-foreground pt-1 text-[11px]">
        one row per <code>{axis.name}</code> value, rendered by the real generated{' '}
        <code>src/components/{entry.name}</code>
      </p>
    </div>
  );
}

/* ------------------------------------------------------ right: API changes */

function ApiChanges({ changes }: { changes: ApiChange[] }) {
  if (changes.length === 0) {
    return <p className="text-muted-foreground text-sm">No changes — the document matches the governed original.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {changes.map((c, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <Badge variant={SEVERITY_BADGE[c.severity]} className="mt-px w-14 justify-center text-[10px]">
            {c.severity}
          </Badge>
          <span>
            <code className="text-xs font-medium">{c.subject}</code>{' '}
            <span className="text-muted-foreground text-xs">{c.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------ right: canvas plan */

function VariantList({ names, tone }: { names: string[]; tone?: string }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? names : names.slice(0, 6);
  return (
    <>
      <ul className="mt-1 space-y-0.5">
        {shown.map((n) => (
          <li key={n} className={cn('truncate font-mono text-[11px]', tone)}>
            {n}
          </li>
        ))}
      </ul>
      {names.length > 6 ? (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground mt-0.5 text-[11px] underline-offset-2 hover:underline"
        >
          {expanded ? 'show fewer' : `show all ${names.length}`}
        </button>
      ) : null}
    </>
  );
}

function CanvasPlan({ original, edited }: { original: Contract; edited: Contract }) {
  const plan = useMemo(() => planAmend(original, edited), [original, edited]);

  if (plan.kind !== 'amend') {
    return <p className="text-muted-foreground text-sm">{plan.note}</p>;
  }
  const groups: Array<{ label: string; note: string; names: string[]; tone?: string }> = [
    {
      label: `ADDED (${plan.addedVariants.length})`,
      note: 'expected combos with no existing variant — built and appended',
      names: plan.addedVariants,
      tone: 'text-success',
    },
    {
      label: `REBUILT (${plan.rebuiltVariants.length})`,
      note: 'name-matched variants — interiors rebuilt from spec; node identity and property IDs survive, so placed instances keep their overrides',
      names: plan.rebuiltVariants,
    },
    {
      label: `EXTRA — reported (${plan.extraVariants.length})`,
      note: 'existing variants no expected combo names — never deleted; a human retires them',
      names: plan.extraVariants,
      tone: 'text-warning',
    },
  ];
  return (
    <div className="space-y-3 text-sm">
      {groups.map((g) =>
        g.names.length > 0 ? (
          <div key={g.label}>
            <p className="text-xs font-medium">
              {g.label} <span className="text-muted-foreground font-normal">— {g.note}</span>
            </p>
            <VariantList names={g.names} tone={g.tone} />
          </div>
        ) : null,
      )}
      {plan.addedProps.length > 0 ? (
        <p className="text-xs">
          <span className="font-medium">Properties added:</span>{' '}
          <code>{plan.addedProps.join(', ')}</code>
        </p>
      ) : null}
      {plan.editedDefaults.length > 0 ? (
        <p className="text-xs">
          <span className="font-medium">Defaults edited in place:</span>{' '}
          <code>{plan.editedDefaults.join(', ')}</code>
        </p>
      ) : null}
      {plan.strandedProps.length > 0 ? (
        <p className="text-warning text-xs">
          <span className="font-medium">Properties stranded:</span>{' '}
          <code>{plan.strandedProps.join(', ')}</code> — amend never deletes properties; reported
          for a human to retire.
        </p>
      ) : null}
      {plan.skippedProps.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          Skipped by every design-side consumer (declared fidelity limit, figma kind NONE):{' '}
          <code>{plan.skippedProps.join(', ')}</code>
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        {plan.totalExpected} expected variants{plan.capped ? ' (enumeration capped)' : ''} · default
        variant <code className="text-[11px]">{plan.defaultVariant}</code> stays first — the
        all-defaults combo is Figma's positional default.
      </p>
    </div>
  );
}

/* -------------------------------------------------- right: version advice */

function VersionAdviceBlock({
  original,
  edited,
  changes,
}: {
  original: Contract;
  edited: Contract;
  changes: ApiChange[];
}) {
  const advice = useMemo(() => adviseVersion(original, edited, changes), [original, edited, changes]);
  if (advice.bump === 'none') {
    return (
      <p className="text-muted-foreground text-sm">
        No governed change — <code>v{advice.from}</code> stands.
      </p>
    );
  }
  return (
    <div className="space-y-1.5 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <Badge variant={SEVERITY_BADGE[advice.bump]}>{advice.bump}</Badge>
        <code className="text-xs">
          v{advice.from} → v{advice.suggested}
        </code>
        {advice.editedVersionOk ? (
          <span className="text-success text-xs font-medium">✓ version field already says {advice.suggested}</span>
        ) : (
          <span className="text-warning text-xs">
            document still says v{advice.editedVersion} — set <code>version</code> to{' '}
            {advice.suggested}
          </span>
        )}
      </p>
      <ul className="text-muted-foreground space-y-0.5 text-xs">
        {advice.reasons.slice(0, 4).map((r, i) => (
          <li key={i}>∵ {r}</li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">
        Policy: added optional prop = minor; removed/renamed prop or value = major
        (docs/02-contract-spec.md).
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- view */

export function CodeEditorSim() {
  const [selectedId, setSelectedId] = useState(
    () => editable.find((c) => c.id === 'ds.button')?.id ?? editable[0]?.id ?? '',
  );
  const entry = editable.find((c) => c.id === selectedId) ?? editable[0];
  const [text, setText] = useState(() => (entry ? contractText(entry) : ''));
  const [outcome, setOutcome] = useState<ParseOutcome | null>(null);

  // The governed original, normalized through the SAME schema the edit runs
  // through, so the diff never manufactures differences out of defaults.
  const original = useMemo(() => {
    const parsed = ContractSchema.safeParse(entry?.contract);
    return parsed.success ? parsed.data : null;
  }, [entry]);

  useEffect(() => {
    const timer = setTimeout(() => setOutcome(parseContract(text)), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const select = (id: string) => {
    const next = editable.find((c) => c.id === id);
    if (!next) return;
    setSelectedId(id);
    setText(contractText(next));
    setOutcome(null);
  };

  if (!entry || !original) {
    return <p className="text-muted-foreground">No contract-backed components found.</p>;
  }

  const edited = outcome?.kind === 'valid' ? outcome.contract : null;
  const changes = edited ? diffApi(original, edited) : [];
  const dirty = text !== contractText(entry);

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Code Editor Simulator</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          What a contract-governed in-tool code editor experiences. The contract sits between the
          editor and both surfaces: an edit either validates against the schema and ripples
          deterministically — API diff, canvas amend plan, version advice — or is refused by name.
          Nothing silently drifts.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* -------------------------------------------------- left column */}
        <div className="space-y-6 lg:col-span-3">
          <Section title="Component" lead="Every contract in the governed set is editable.">
            <Picker selectedId={selectedId} onSelect={select} />
          </Section>
          <Section
            title="Live render"
            lead="The real generated component, driven by the edited contract's defaults."
          >
            <Preview entry={entry} original={original} edited={edited} />
          </Section>
        </div>

        {/* ------------------------------------------------ center column */}
        <div className="space-y-3 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="ces-editor" className="text-sm font-semibold">
              Contract source
              <span className="text-muted-foreground ml-2 font-mono text-[11px] font-normal">
                {contractFilePath(entry.id)}
              </span>
            </Label>
            <Button
              variant="outline"
              size="sm"
              disabled={!dirty}
              onClick={() => {
                setText(contractText(entry));
                setOutcome(null);
              }}
            >
              Revert to governed
            </Button>
          </div>
          <Textarea
            id="ces-editor"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="min-h-[560px] resize-y whitespace-pre"
            aria-label={`Contract JSON for ${entry.name}`}
          />
          <p className="text-muted-foreground text-xs">
            Validated on every edit against <code>scripts/contract-schema.ts</code> — the identical
            Zod schema the generators run. Try removing an enum value, retyping a prop, or adding an
            unknown key.
          </p>
        </div>

        {/* ------------------------------------------------- right column */}
        <div className="space-y-6 lg:col-span-4">
          {outcome?.kind === 'syntax' ? (
            <Alert variant="warning">
              <AlertTitle>Not a document yet</AlertTitle>
              <AlertDescription>
                <p className="font-mono text-xs">{outcome.message}</p>
                <p className="mt-1">Nothing propagates until the JSON parses.</p>
              </AlertDescription>
            </Alert>
          ) : null}

          {outcome?.kind === 'refused' ? (
            <Alert variant="destructive">
              <AlertTitle>Refused — {outcome.issues.length} schema violation{outcome.issues.length === 1 ? '' : 's'}</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 space-y-1.5">
                  {outcome.issues.map((issue, i) => (
                    <li key={i} className="text-xs">
                      <code className="text-foreground font-medium">{issue.path}</code>
                      <br />
                      {issue.message}
                    </li>
                  ))}
                </ul>
                <p className="mt-2">
                  The schema names every violation; an illegal contract never reaches either
                  surface. Both keep rendering the last governed version.
                </p>
              </AlertDescription>
            </Alert>
          ) : null}

          {edited ? (
            <>
              <Section
                title="API changes"
                lead="What the code surface's public interface does — computed by diffing the edited contract against the governed original."
              >
                <ApiChanges changes={changes} />
              </Section>
              <Separator />
              <Section
                title="Canvas plan"
                lead="How the in-place amend reconciles the published variant set: combos matched by name over the enum cartesian product, all-defaults first."
              >
                <CanvasPlan original={original} edited={edited} />
              </Section>
              <Separator />
              <Section title="Version advice" lead="Per the contract spec's change policy.">
                <VersionAdviceBlock original={original} edited={edited} changes={changes} />
              </Section>
            </>
          ) : null}

          {outcome === null && dirty ? (
            <p className="text-muted-foreground text-sm">Validating…</p>
          ) : null}

          <Source path={`${contractFilePath(entry.id)} · scripts/contract-schema.ts (live import) · docs/02-contract-spec.md`} />
        </div>
      </div>
    </>
  );
}
