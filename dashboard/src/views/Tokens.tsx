import { Check, Section, Source, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui';
import { figmaVariableNames, semanticTokensByGroup, tokenUsedBy } from '../data';
import { resolveVar, useThemeVersion } from '../lib/use-theme-version';

function Preview({ cssVar, type }: { cssVar: string; type: string }) {
  const value = resolveVar(cssVar);
  if (type === 'color') {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-block size-5 shrink-0 rounded-sm border" style={{ background: `var(${cssVar})` }} />
        <span className="text-muted-foreground text-xs tabular-nums">{value}</span>
      </span>
    );
  }
  if (type === 'dimension') {
    const px = parseFloat(value);
    return (
      <span className="inline-flex items-center gap-2">
        <span className="bg-primary/60 inline-block h-2 rounded-sm" style={{ width: Math.min(Number.isFinite(px) ? px : 0, 96) }} />
        <span className="text-muted-foreground text-xs tabular-nums">{value}</span>
      </span>
    );
  }
  return <span className="text-muted-foreground text-xs tabular-nums">{value}</span>;
}

export function Tokens() {
  useThemeVersion();
  const groups = semanticTokensByGroup();

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tokens</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
          The semantic token layer — every styling decision components are allowed to make. Each row maps one token to
          its three lives: the resolved value in the current theme (flip the theme toggle and watch this column change),
          the CSS custom property the code consumes, and the Figma variable designers consume — verified to exist in the
          file. "Used by" shows which contracts bind it.
        </p>
      </div>

      {[...groups.entries()].map(([group, tokens]) => (
        <Section key={group} title={group} lead="">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Resolved (live)</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Code · CSS variable</TableHead>
                <TableHead>Design · Figma variable</TableHead>
                <TableHead className="w-20">In Figma</TableHead>
                <TableHead>Used by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => {
                const users = tokenUsedBy(token.dotPath);
                return (
                  <TableRow key={token.dotPath}>
                    <TableCell><Preview cssVar={token.cssVar} type={token.type} /></TableCell>
                    <TableCell><code className="text-xs">{token.dotPath}</code></TableCell>
                    <TableCell className="font-mono text-xs">var({token.cssVar})</TableCell>
                    <TableCell className="font-mono text-xs">{token.figmaName}</TableCell>
                    <TableCell>
                      <Check ok={figmaVariableNames.has(token.figmaName)} label="variable exists in the Figma file" />
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {users.length === 0 ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          users.map((name) => (
                            <a
                              key={name}
                              href={`#/components/${encodeURIComponent(`ds.${name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`)}`}
                              className="bg-muted hover:bg-accent rounded px-1.5 py-0.5 text-xs"
                            >
                              {name}
                            </a>
                          ))
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Section>
      ))}
      <Source path="tokens/semantic.tokens.json · tokens/modes/semantic.light.tokens.json · src/styles/tokens.css (live) · parity/snapshots/figma-tokens.json · contracts/*.contract.json (used-by)" />
    </>
  );
}
