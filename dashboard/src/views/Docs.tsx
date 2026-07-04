import { useMemo } from 'react';
import { marked } from 'marked';
import { Section, Source } from '../components/ui';
import { cn } from '../lib/utils';

/**
 * Documentation — renders the repo's real docs/ markdown inside the Hub.
 * The same files engineers read in the repo are the ones shown here; nothing
 * is duplicated or paraphrased for the dashboard.
 */
const docModules = {
  ...import.meta.glob<string>('../../../docs/*.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob<string>('../../../docs/research/*.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
};

interface Doc {
  slug: string;
  path: string;
  title: string;
  markdown: string;
}

const DOCS: Doc[] = Object.entries(docModules)
  .map(([path, markdown]) => {
    const file = path.split('/').pop()!;
    const slug = file.replace(/\.md$/, '');
    const heading = markdown.match(/^#\s+(.+)$/m)?.[1] ?? slug;
    return {
      slug,
      path: path.replace(/^(\.\.\/)+/, ''),
      title: heading.replace(/^\d+\s*·\s*/, ''),
      markdown,
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

// Cross-doc links in the markdown point at sibling .md files — rewrite them
// to hash routes so navigation stays inside the Hub.
const renderer = new marked.Renderer();
const defaultLink = renderer.link.bind(renderer);
renderer.link = (token) => {
  const target = token.href.match(/(?:^|\/)([\w.-]+)\.md(#.*)?$/);
  if (target && DOCS.some((d) => d.slug === target[1])) {
    return defaultLink({ ...token, href: `#/docs/${target[1]}` });
  }
  return defaultLink(token);
};

function docHtml(markdown: string): string {
  return marked.parse(markdown, { renderer, async: false });
}

export function Docs({ slug }: { slug?: string }) {
  const active = DOCS.find((d) => d.slug === slug) ?? DOCS[0];
  const html = useMemo(() => (active ? docHtml(active.markdown) : ''), [active]);

  if (!active) {
    return <p className="text-muted-foreground text-sm">No documentation found in docs/.</p>;
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documentation</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
          The concept, the contract spec, and the evidence — rendered straight from the repo's{' '}
          <code>docs/</code> folder. These are the working documents the system was built against,
          not a summary written for this page.
        </p>
      </div>

      <Section title={active.title}>
        <div className="flex flex-col gap-8 lg:flex-row">
          <nav aria-label="Documentation" className="shrink-0 lg:w-64">
            <ul className="space-y-0.5">
              {DOCS.map((doc) => {
                const isActive = doc.slug === active.slug;
                return (
                  <li key={doc.slug}>
                    <a
                      href={`#/docs/${doc.slug}`}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'block rounded-md px-3 py-1.5 text-sm outline-none focus-visible:ring-2',
                        isActive
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground',
                      )}
                    >
                      {doc.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <article
            className="doc-prose min-w-0 max-w-3xl flex-1"
            // Trusted content: repo-local markdown compiled at build time.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
        <Source path={active.path} />
      </Section>
    </>
  );
}
