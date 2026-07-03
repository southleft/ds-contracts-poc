import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Check, Checkbox, Input, Label,
  NativeSelect, Section, Source, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui';
import {
  contractFilePath, figmaNodeUrl, figmaSetByName, figmaVariableNames, findingsForComponent,
  getComponent, type AnatomyNode, type ComponentEntry, type RawProp,
} from '../data';
import { renderSample } from '../samples';
import { resolveVar, useThemeVersion } from '../lib/use-theme-version';

/* ------------------------------------------------ binding map (the point) */

interface BindingRow {
  kind: string;
  contract: ReactNode;
  code: ReactNode;
  figma: ReactNode;
  ok: boolean | null; // null = not applicable (native representation)
  okLabel: string;
}

function figmaPropsOf(entry: ComponentEntry): Map<string, { type: string; variantOptions: string[] | null }> {
  const set = figmaSetByName(entry.name);
  const map = new Map<string, { type: string; variantOptions: string[] | null }>();
  if (!set) return map;
  for (const [key, def] of Object.entries(set.properties)) {
    map.set(key.split('#')[0], { type: def.type, variantOptions: def.variantOptions ?? null });
  }
  return map;
}

function bindingRows(entry: ComponentEntry): BindingRow[] {
  const native = entry.figma.representation === 'native';
  const figmaProps = figmaPropsOf(entry);
  const rows: BindingRow[] = [];

  for (const prop of entry.contract?.props ?? []) {
    const figmaBinding = prop.bindings?.figma;
    const codeName = prop.bindings?.code?.prop ?? prop.name;
    const live = figmaBinding ? figmaProps.get(figmaBinding.property) : undefined;
    const isEnum = typeof prop.type === 'object';

    let ok: boolean | null = null;
    let okLabel = 'native representation — no Figma property expected';
    if (!native && figmaBinding) {
      if (!live) {
        ok = false;
        okLabel = `Figma property "${figmaBinding.property}" not found in the published set`;
      } else if (isEnum) {
        const want = (prop.type as { enum: string[] }).enum.map((v) => figmaBinding.values?.[v] ?? v);
        ok = want.every((v) => live.variantOptions?.includes(v));
        okLabel = ok ? 'every contract value exists as a Figma variant option' : 'variant options diverge from the contract';
      } else {
        ok = live.type === figmaBinding.kind;
        okLabel = ok ? `property present as ${live.type}` : `expected ${figmaBinding.kind}, Figma has ${live.type}`;
      }
    }

    rows.push({
      kind: isEnum ? 'enum' : prop.type === 'boolean' ? 'boolean' : 'text',
      contract: (
        <span className="font-mono text-xs">
          {prop.name}
          {isEnum ? `: ${(prop.type as { enum: string[] }).enum.join(' | ')}` : `: ${prop.type}`}
        </span>
      ),
      code: <code className="text-xs">{codeName}{prop.required ? '' : '?'}</code>,
      figma: figmaBinding ? (
        <span className="font-mono text-xs">
          {figmaBinding.property} <span className="text-muted-foreground">{figmaBinding.kind}</span>
        </span>
      ) : '—',
      ok,
      okLabel,
    });

    // one row per enum VALUE — the spelling map is the contract's core trick
    if (isEnum && figmaBinding?.values) {
      for (const value of (prop.type as { enum: string[] }).enum) {
        const figmaValue = figmaBinding.values[value] ?? value;
        const present = native ? null : (figmaProps.get(figmaBinding.property)?.variantOptions ?? []).includes(figmaValue);
        rows.push({
          kind: 'value',
          contract: <span className="text-muted-foreground pl-4 font-mono text-xs">· {value}</span>,
          code: <code className="text-xs">"{value}"</code>,
          figma: <span className="font-mono text-xs">{figmaValue}</span>,
          ok: present,
          okLabel: present ? 'variant option exists in Figma' : 'variant option missing in Figma',
        });
      }
    }
  }

  // slots (named + default) from the catalog entry
  const slotDefs = [
    ...(entry.children.kind === 'slot' ? [{ prop: 'children', accepts: entry.children.accepts ?? [], optional: false }] : []),
    ...entry.slots.map((s) => ({ prop: s.prop, accepts: s.accepts, optional: s.optional })),
  ];
  const set = figmaSetByName(entry.name);
  for (const slot of slotDefs) {
    const figmaProp = [...figmaPropsOf(entry).entries()].find(([, d]) => d.type === 'INSTANCE_SWAP');
    const multi = slot.accepts.length > 0 && (set?.nestedInstances ?? []).some((n) => slot.accepts.includes(n));
    const ok = entry.figma.representation === 'native' ? null : Boolean(figmaProp) || multi;
    rows.push({
      kind: 'slot',
      contract: (
        <span className="font-mono text-xs">
          slot: {slot.prop}
          {slot.accepts.length > 0 ? ` accepts ${slot.accepts.join(', ')}` : ' (open)'}
        </span>
      ),
      code: <code className="text-xs">{slot.prop}{slot.optional ? '?' : ''}: ReactNode</code>,
      figma: multi
        ? <span className="text-xs">rendered content (multi-child — INSTANCE_SWAP can't hold it; native SLOT is the migration target)</span>
        : figmaProp
          ? <span className="font-mono text-xs">{figmaProp[0]} INSTANCE_SWAP</span>
          : '—',
      ok,
      okLabel: ok === null ? 'native representation' : ok ? 'slot represented in Figma' : 'slot missing in Figma',
    });
  }

  return rows;
}

/* -------------------------------------------------- token binding mapping */

interface TokenRow {
  part: string;
  cssProp: string;
  refPath: string;   // may contain {prop} placeholders
  expansions: string[]; // concrete dot-paths
}

function collectTokenRows(entry: ComponentEntry): TokenRow[] {
  const rows: TokenRow[] = [];
  const enums = new Map<string, string[]>();
  for (const p of entry.contract?.props ?? []) {
    if (typeof p.type === 'object') enums.set(p.name, p.type.enum);
  }
  const expand = (ref: string): string[] => {
    const m = ref.match(/\{([a-z][\w-]*)\}/);
    if (!m) return [ref];
    const values = enums.get(m[1]) ?? [];
    return values.flatMap((v) => expand(ref.replace(`{${m[1]}}`, v)));
  };
  const visit = (name: string, node: AnatomyNode) => {
    for (const [cssProp, ref] of Object.entries(node.tokens ?? {})) {
      const path = ref.slice(1, -1);
      rows.push({ part: name, cssProp, refPath: path, expansions: expand(path) });
    }
    for (const [state, decls] of Object.entries(node.states ?? {})) {
      for (const [cssProp, ref] of Object.entries(decls)) {
        const path = ref.slice(1, -1);
        rows.push({ part: `${name}:${state}`, cssProp, refPath: path, expansions: expand(path) });
      }
    }
    for (const [childName, child] of Object.entries(node.parts ?? {})) visit(childName, child);
  };
  if (entry.contract) visit('root', entry.contract.anatomy.root);
  return rows;
}

function TokenValue({ dotPath }: { dotPath: string }) {
  useThemeVersion();
  const cssVar = `--${dotPath.split('.').join('-')}`;
  const value = resolveVar(cssVar);
  const isColor = /^(#|rgb|oklch|hsl)/.test(value);
  return (
    <span className="inline-flex items-center gap-1.5">
      {isColor ? <span className="inline-block size-3.5 shrink-0 rounded-sm border" style={{ background: `var(${cssVar})` }} /> : null}
      <span className="text-muted-foreground text-xs tabular-nums">{value || '—'}</span>
    </span>
  );
}

/* -------------------------------------------------------------- playground */

function Playground({ entry }: { entry: ComponentEntry }) {
  const [props, setProps] = useState<Record<string, unknown>>({});
  const [childText, setChildText] = useState('');
  const hasTextChildren = entry.children.kind === 'text';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        {entry.props.map((p) =>
          Array.isArray(p.type) ? (
            <div key={p.name} className="space-y-1">
              <Label htmlFor={`pg-${p.name}`} className="text-muted-foreground block text-xs">{p.name}</Label>
              <NativeSelect
                id={`pg-${p.name}`}
                value={String(props[p.name] ?? p.default ?? p.type[0])}
                onChange={(e) => setProps((s) => ({ ...s, [p.name]: e.target.value }))}
              >
                {p.type.map((v) => <option key={v} value={v}>{v}</option>)}
              </NativeSelect>
            </div>
          ) : p.type === 'boolean' ? (
            <Label key={p.name} htmlFor={`pg-${p.name}`} className="flex items-center gap-2 pb-2 text-xs">
              <Checkbox
                id={`pg-${p.name}`}
                checked={Boolean(props[p.name] ?? p.default ?? false)}
                onChange={(e) => setProps((s) => ({ ...s, [p.name]: e.target.checked }))}
              />
              {p.name}
            </Label>
          ) : (
            <div key={p.name} className="space-y-1">
              <Label htmlFor={`pg-${p.name}`} className="text-muted-foreground block text-xs">{p.name}</Label>
              <Input
                id={`pg-${p.name}`}
                className="w-44"
                value={String(props[p.name] ?? p.default ?? '')}
                onChange={(e) => setProps((s) => ({ ...s, [p.name]: e.target.value }))}
              />
            </div>
          ),
        )}
        {hasTextChildren ? (
          <div className="space-y-1">
            <Label htmlFor="pg-children" className="text-muted-foreground block text-xs">children</Label>
            <Input id="pg-children" className="w-44" value={childText} placeholder="text content" onChange={(e) => setChildText(e.target.value)} />
          </div>
        ) : null}
      </div>
      <div className="bg-background overflow-x-auto rounded-lg border border-dashed p-6">
        {renderSample(entry.name, props, childText || undefined)}
      </div>
      <p className="text-muted-foreground text-xs">
        Live render of the real generated component from <code>src/components/{entry.name}</code> — the controls above are
        generated from the catalog entry, so only contract-legal values are offered.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ view */

export function ComponentDetail({ id }: { id: string }) {
  const entry = getComponent(id);
  const rows = useMemo(() => (entry ? bindingRows(entry) : []), [entry]);
  const tokenRows = useMemo(() => (entry ? collectTokenRows(entry) : []), [entry]);
  useThemeVersion();

  if (!entry) {
    return <p className="text-muted-foreground">Unknown component id: {id}</p>;
  }
  const native = entry.figma.representation === 'native';
  const findings = findingsForComponent(entry.name);
  const nodeId = entry.contract?.anchors.figma.nodeId ?? null;

  return (
    <>
      <div className="space-y-2">
        <a href="#/components" className="text-muted-foreground text-sm hover:underline">← Components</a>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{entry.name}</h1>
          <code className="text-muted-foreground text-sm">{entry.id}</code>
          <Badge variant="outline" className="font-mono">v{entry.version}</Badge>
          <Badge variant={entry.status === 'stable' ? 'success' : 'secondary'}>{entry.status}</Badge>
        </div>
        <p className="text-muted-foreground max-w-3xl text-sm">{entry.description}</p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <code className="bg-muted rounded-md px-2 py-1 text-xs">
            import {'{'} {entry.name} {'}'} from '{entry.contract?.anchors.code.importPath}'
          </code>
          {!native && nodeId ? (
            <Button asChild variant="outline" size="sm">
              <a href={figmaNodeUrl(nodeId)} target="_blank" rel="noreferrer">
                Open in Figma <ExternalLink aria-hidden />
              </a>
            </Button>
          ) : (
            <Badge variant="secondary">Figma: native auto-layout</Badge>
          )}
        </div>
      </div>

      {findings.length === 0 ? (
        <p className="text-success text-sm font-medium">✓ In parity — both surfaces match this contract (last differ run)</p>
      ) : (
        <p className="text-destructive text-sm font-medium">✕ {findings.length} drift finding(s) — see Parity</p>
      )}

      <Section
        title="Try it"
        lead="The component itself, rendered live from the generated package. Change any prop — the controls are built from the contract, so illegal values aren't even offered."
      >
        <Playground entry={entry} />
      </Section>

      <Section
        title="Binding map — one contract, two surfaces"
        lead="Every prop, value, and slot the contract declares, next to how it manifests in code and in Figma. The status column is computed live against the Figma snapshot — it's a verification, not an illustration."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Kind</TableHead>
              <TableHead>Contract (canonical)</TableHead>
              <TableHead>Code surface</TableHead>
              <TableHead>Design surface (Figma)</TableHead>
              <TableHead className="w-16">Match</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                <TableCell><Badge variant="outline" className="text-[10px]">{row.kind}</Badge></TableCell>
                <TableCell>{row.contract}</TableCell>
                <TableCell>{row.code}</TableCell>
                <TableCell>{row.figma}</TableCell>
                <TableCell>{row.ok === null ? <span className="text-muted-foreground text-xs">n/a</span> : <Check ok={row.ok} label={row.okLabel} />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Source path={`${contractFilePath(entry.id)} · parity/snapshots/figma-components.json`} />
      </Section>

      <Section
        title="Token bindings — the styling contract"
        lead="Where every visual decision comes from: each anatomy part binds CSS properties to design tokens. The resolved value is read live from the loaded stylesheet (flip the theme to watch it change); the Figma column is verified against the variables actually in the file."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part</TableHead>
              <TableHead>CSS property</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Resolved (live)</TableHead>
              <TableHead>Figma variable</TableHead>
              <TableHead className="w-16">In Figma</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokenRows.flatMap((row) =>
              row.expansions.map((dotPath, j) => (
                <TableRow key={`${row.part}-${row.cssProp}-${j}`}>
                  <TableCell className="font-mono text-xs">{j === 0 ? row.part : ''}</TableCell>
                  <TableCell className="font-mono text-xs">{j === 0 ? row.cssProp : ''}</TableCell>
                  <TableCell><code className="text-xs">{`{${dotPath}}`}</code></TableCell>
                  <TableCell><TokenValue dotPath={dotPath} /></TableCell>
                  <TableCell className="font-mono text-xs">{dotPath.split('.').join('/')}</TableCell>
                  <TableCell>
                    <Check
                      ok={figmaVariableNames.has(dotPath.split('.').join('/'))}
                      label="variable exists in the Figma file (from parity/snapshots/figma-tokens.json)"
                    />
                  </TableCell>
                </TableRow>
              )),
            )}
          </TableBody>
        </Table>
        <Source path={`${contractFilePath(entry.id)} · src/styles/tokens.css (live) · parity/snapshots/figma-tokens.json`} />
      </Section>

      {!native ? (
        <Section
          title="Design surface detail"
          lead="What the published Figma component set actually exposes, read from the latest extraction — identity is anchored by key, so renames on either side can't fork it."
        >
          <Card className="max-w-xl gap-3">
            <CardHeader>
              <CardTitle className="text-sm">{figmaSetByName(entry.name)?.variantCount ?? '?'} variants published</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {Object.entries(figmaSetByName(entry.name)?.properties ?? {}).map(([key, def]) => (
                <div key={key} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{key.split('#')[0]}</span>
                  <Badge variant="outline" className="text-[10px]">{def.type}</Badge>
                  {(def.variantOptions ?? []).map((v) => (
                    <code key={v} className="bg-muted rounded px-1.5 py-0.5 text-xs">{v}</code>
                  ))}
                </div>
              ))}
              <p className="text-muted-foreground font-mono text-xs">
                key {entry.contract?.anchors.figma.componentSetKey?.slice(0, 16)}…
              </p>
            </CardContent>
          </Card>
          <Source path="parity/snapshots/figma-components.json" />
        </Section>
      ) : null}
    </>
  );
}
