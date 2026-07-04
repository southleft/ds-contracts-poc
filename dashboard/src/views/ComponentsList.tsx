import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Section, Source } from '../components/ui';
import { components } from '../data';
import { renderSample } from '../samples';

export function ComponentsList() {
  return (
    <Section
      title="Components"
      lead="Every component the catalog governs. Each one is generated to code (always) and to Figma (unless the concept maps to a native canvas feature). Open one to see the contract and both surfaces mapped against it."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {components.map((c) => (
          // Overlay-link pattern: previews render REAL components (some are
          // themselves links), so the card can't be an <a> — nested anchors
          // are invalid HTML. A stretched link on the title covers the card.
          <div key={c.id} className="relative">
            <Card className="hover:border-primary/40 focus-within:ring-ring h-full gap-3 transition-colors focus-within:ring-2">
              <div className="mx-5 flex h-24 items-center overflow-hidden rounded-md border border-dashed bg-[var(--color-surface-background)] px-3" aria-hidden inert>
                <div className="pointer-events-none origin-left scale-[0.65] whitespace-nowrap">
                  {renderSample(c.name)}
                </div>
              </div>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>
                    <a
                      href={`#/components/${encodeURIComponent(c.id)}`}
                      className="outline-none after:absolute after:inset-0 after:content-['']"
                    >
                      {c.name}
                    </a>
                  </CardTitle>
                  <Badge variant="outline" className="font-mono">
                    v{c.version}
                  </Badge>
                  <Badge variant={c.status === 'stable' ? 'success' : 'secondary'}>{c.status}</Badge>
                </div>
                <CardDescription className="line-clamp-2">{c.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span>Code ✓</span>
                <span>{c.figma.representation === 'native' ? 'Figma: native auto-layout' : 'Figma ✓'}</span>
                <span>{c.props.length} props</span>
                <span>{c.slots.length + (c.children.kind === 'slot' ? 1 : 0)} slots</span>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
      <Source path="catalog/catalog.json" />
    </Section>
  );
}
