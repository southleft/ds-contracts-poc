import { useState } from 'react';
import {
  Alert, AlertDescription, AlertTitle, Badge, Button, Input, Label, NativeSelect, Section, Source, Textarea,
} from '../components/ui';
import { catalog } from '../data';
import { saveMemory, saveRules, UNAVAILABLE_NOTE, type ApiResponse, type EditableRule } from '../api';

function StatusNote({ result, okText }: { result: ApiResponse<unknown> | null; okText: string }) {
  if (!result) return null;
  if (result.status === 'unavailable') return <p className="text-muted-foreground text-sm">{UNAVAILABLE_NOTE}</p>;
  if (result.status === 'error') return <p className="text-destructive text-sm">{result.message}</p>;
  return <p className="text-success text-sm">{okText} The catalog was re-emitted — this page reloads with the fresh data.</p>;
}

function MemoryEditor() {
  const [content, setContent] = useState(catalog.context?.memory ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResponse<unknown> | null>(null);

  return (
    <div className="max-w-3xl space-y-3">
      <Textarea
        aria-label="System memory"
        className="min-h-52 font-sans text-sm"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setResult(await saveMemory(content));
          setBusy(false);
        }}
      >
        {busy ? 'Saving…' : 'Save memory'}
      </Button>
      <StatusNote result={result} okText="Memory saved to context/memory.md." />
    </div>
  );
}

function RulesEditor() {
  const [rules, setRules] = useState<EditableRule[]>(
    catalog.rules.map((r) => ({
      id: r.id,
      statement: r.statement,
      enforcement: r.enforcement as 'judge' | 'agent',
      ...('forbiddenRawElements' in r && Array.isArray((r as unknown as Record<string, unknown>).forbiddenRawElements)
        ? { forbiddenRawElements: (r as unknown as { forbiddenRawElements: string[] }).forbiddenRawElements }
        : {}),
    })),
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResponse<unknown> | null>(null);

  const update = (index: number, patch: Partial<EditableRule>) =>
    setRules((all) => all.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <div className="max-w-4xl space-y-3">
      {rules.map((rule, i) => (
        <div key={i} className="bg-card space-y-2 rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={`Rule ${i + 1} id`}
              className="w-64 font-mono text-xs"
              value={rule.id}
              onChange={(e) => update(i, { id: e.target.value })}
            />
            <NativeSelect
              aria-label={`Rule ${i + 1} enforcement`}
              value={rule.enforcement}
              onChange={(e) => update(i, { enforcement: e.target.value as 'judge' | 'agent' })}
            >
              <option value="judge">judge (deterministic)</option>
              <option value="agent">agent (guidance)</option>
            </NativeSelect>
            {rule.forbiddenRawElements ? (
              <Badge variant="outline" className="font-mono text-[10px]">
                forbids: {rule.forbiddenRawElements.join(', ')}
              </Badge>
            ) : null}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setRules((all) => all.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
          <Textarea
            aria-label={`Rule ${i + 1} statement`}
            className="min-h-16 font-sans"
            value={rule.statement}
            onChange={(e) => update(i, { statement: e.target.value })}
          />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            setRules((all) => [...all, { id: `new-rule-${all.length + 1}`, statement: '', enforcement: 'agent' }])
          }
        >
          Add rule
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setResult(await saveRules(rules));
            setBusy(false);
          }}
        >
          {busy ? 'Saving…' : 'Save rules'}
        </Button>
      </div>
      <StatusNote result={result} okText="Rules saved to context/rules.json." />
      <Alert>
        <AlertTitle>Rules with judge enforcement change behavior immediately</AlertTitle>
        <AlertDescription>
          The judge reads rules from the compiled catalog — e.g. editing <code>no-raw-equivalents</code>'s forbidden
          elements changes what the judge rejects on the next run. Agent rules guide generation and are reviewed by
          humans.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function Context() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Context</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
          The governed source is more than component specs. Memory says what the system is for; rules are its
          constitution; references are files an agent may consult for judgment calls the deterministic checks don't
          cover. All three compile into the catalog, so every consumer reads the same context. Edits here write the
          real files and re-emit the catalog.
        </p>
      </div>

      <Section
        title="Memory"
        lead="Standing intent — read by every generating surface before it produces anything. Keep it short and directive."
      >
        <MemoryEditor />
        <Source path="context/memory.md → catalog/catalog.json" />
      </Section>

      <Section
        title="Rules"
        lead="The org constitution. Deterministic rules are enforced mechanically by the judge; guidance rules steer the agent."
      >
        <RulesEditor />
        <Source path="context/rules.json → catalog/catalog.json" />
      </Section>

      <Section
        title="References"
        lead="Consultable files for judgment calls — drop documents into context/references/ and they're listed in the catalog for agents to read on demand."
      >
        <div className="flex max-w-3xl flex-wrap gap-1.5">
          {(catalog.context?.references ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">No reference files yet.</p>
          ) : (
            (catalog.context?.references ?? []).map((f) => (
              <code key={f} className="bg-muted rounded px-2 py-1 text-xs">{f}</code>
            ))
          )}
        </div>
        <Source path="context/references/ → catalog/catalog.json" />
      </Section>
    </>
  );
}
