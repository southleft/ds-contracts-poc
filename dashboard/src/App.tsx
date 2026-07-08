import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight, Moon, Sun } from 'lucide-react';
import { Button } from './components/ui';
import { cn } from './lib/utils';
import { catalog, components } from './data';
import { Overview } from './views/Overview';
import { ComponentsList } from './views/ComponentsList';
import { ComponentDetail } from './views/ComponentDetail';
import { Tokens } from './views/Tokens';
import { Governance } from './views/Governance';
import { Parity } from './views/Parity';
import { Context } from './views/Context';
import { Docs } from './views/Docs';
import { CodeEditorSim } from './views/CodeEditorSim';

type Theme = 'light' | 'dark';
type Brand = 'default' | 'aurora';

const NAV_ITEMS = [
  { href: '#/', label: 'Overview', section: '' },
  { href: '#/components', label: 'Components', section: 'components' },
  { href: '#/tokens', label: 'Tokens', section: 'tokens' },
  { href: '#/governance', label: 'Governance', section: 'governance' },
  { href: '#/editor', label: 'Code Editor', section: 'editor' },
  { href: '#/context', label: 'Context', section: 'context' },
  { href: '#/parity', label: 'Parity', section: 'parity' },
  { href: '#/docs', label: 'Docs', section: 'docs' },
];

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return hash;
}

export function App() {
  const hash = useHashRoute();
  const [theme, setTheme] = useState<Theme>('light');
  const [brand, setBrand] = useState<Brand>('default');

  useEffect(() => {
    // Chrome (shadcn) keys off .dark; the design-system samples key off
    // [data-theme] — one toggle drives both worlds.
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    // Brand mode drives only the generated token layer ([data-brand]) —
    // the Hub chrome deliberately does NOT rebrand; only the samples do.
    document.documentElement.dataset.brand = brand;
  }, [brand]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [hash]);

  const segments = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const section = segments[0] ?? '';
  const activeComponentId =
    section === 'components' && segments[1] ? decodeURIComponent(segments[1]) : null;
  // null = follow the route (open while browsing components); a boolean means
  // the user toggled it manually and their choice wins.
  const [componentsOpen, setComponentsOpen] = useState<boolean | null>(null);

  let view: ReactNode;
  if (section === 'components' && segments[1]) {
    view = <ComponentDetail id={decodeURIComponent(segments[1])} />;
  } else if (section === 'components') {
    view = <ComponentsList />;
  } else if (section === 'tokens') {
    view = <Tokens />;
  } else if (section === 'governance') {
    view = <Governance />;
  } else if (section === 'editor') {
    view = <CodeEditorSim />;
  } else if (section === 'context') {
    view = <Context />;
  } else if (section === 'parity') {
    view = <Parity />;
  } else if (section === 'docs') {
    view = <Docs slug={segments[1] ? decodeURIComponent(segments[1]) : undefined} />;
  } else {
    view = <Overview />;
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {navigator.webdriver ? (
        <div className="bg-destructive fixed inset-x-0 top-0 z-50 px-4 py-2 text-center text-sm font-medium text-white">
          QA automation browser — the viewport is pinned and will crop. Review at{' '}
          <code>http://localhost:5180</code> in your own browser.
        </div>
      ) : null}

      <aside className="bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-dvh md:w-56 md:shrink-0 md:flex-col md:overflow-y-auto">
        <div className="px-5 pt-5 pb-2">
          <a href="#/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <svg viewBox="0 0 437.1666 264.4827" className="h-5 w-8 shrink-0" aria-hidden>
              <path d="M212.9201,240.6041l-102.7592-102.6577c-3.1659-3.1628-3.1666-8.2939-.0014-11.4574L212.8578,23.842c3.1626-3.1611,8.2887-3.1608,11.451.0007l102.6993,102.6716c3.1635,3.1626,3.1638,8.2911.0006,11.4541l-102.6384,102.6331c-3.1616,3.1615-8.2871,3.1627-11.4502.0027Z" fill="#5aa1f2" />
              <path d="M282.2417,234.7913l97.5292-97.6266c2.7326-2.7353,2.7331-7.1671.001-9.9031l-97.3973-97.5358c-2.7227-2.7266-2.7329-7.1399-.0228-9.879l17.5796-17.7681c2.7318-2.7611,7.1883-2.7731,9.935-.0269l125.2475,125.226c2.7365,2.736,2.7369,7.1723.001,9.9089l-125.1874,125.2174c-2.7326,2.7332-7.1622,2.7377-9.9003.0099l-17.7737-17.7067c-2.7442-2.7338-2.7495-7.1756-.0118-9.9159Z" fill="currentColor" />
              <path d="M57.4354,137.1591l97.5065,97.6701c2.7355,2.7401,2.7301,7.1796-.0122,9.9129l-17.7541,17.6964c-2.7377,2.7288-7.1681,2.7251-9.9012-.0083L2.052,137.1944c-2.7364-2.7367-2.7359-7.1735.001-9.9096L127.2578,2.1195c2.7309-2.73,7.1558-2.736,9.894-.0134l17.7701,17.6684c2.7491,2.7334,2.7562,7.1796.0158,9.9217L57.438,127.2557c-2.7333,2.7349-2.7344,7.167-.0026,9.9034Z" fill="currentColor" />
            </svg>
            Contract Hub
          </a>
          <p className="text-sidebar-foreground/60 mt-0.5 text-xs">The governed source, visualized</p>
        </div>
        <nav aria-label="Main" className="flex flex-row flex-wrap gap-1 px-3 py-3 md:flex-col md:gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = item.section === section;
            if (item.section !== 'components') {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                  )}
                >
                  {item.label}
                </a>
              );
            }
            const open = componentsOpen ?? active;
            return (
              <div key={item.href} className="md:min-w-0">
                <div className="flex items-center">
                  <a
                    href={item.href}
                    aria-current={active && !activeComponentId ? 'page' : undefined}
                    className={cn(
                      'flex-1 rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                    )}
                  >
                    {item.label}
                    <span className="text-sidebar-foreground/50 ml-1.5 font-mono text-[10px]">
                      {components.length}
                    </span>
                  </a>
                  <button
                    type="button"
                    aria-label={open ? 'Collapse component list' : 'Expand component list'}
                    aria-expanded={open}
                    onClick={() => setComponentsOpen(!open)}
                    className="hover:bg-sidebar-accent/60 hidden rounded-md p-2 outline-none focus-visible:ring-2 focus-visible:ring-white/60 md:block"
                  >
                    <ChevronRight
                      aria-hidden
                      className={cn('size-3.5 transition-transform', open && 'rotate-90')}
                    />
                  </button>
                </div>
                {open ? (
                  <ul className="border-sidebar-accent mt-0.5 mb-1 ml-4 hidden border-l pl-1 md:block">
                    {components.map((c) => {
                      const current = activeComponentId === c.id;
                      return (
                        <li key={c.id}>
                          <a
                            href={`#/components/${encodeURIComponent(c.id)}`}
                            aria-current={current ? 'page' : undefined}
                            className={cn(
                              'block truncate rounded-md px-2 py-1 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                              current
                                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                            )}
                          >
                            {c.name}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="mt-auto hidden px-5 py-4 font-mono text-[11px] text-white/40 md:block">
          {catalog.package.name}
          <br />
          catalog v{catalog.system.catalogVersion}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="bg-background/95 sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 backdrop-blur md:px-8">
          <span className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            {section === '' ? 'Overview' : section}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden font-mono text-xs sm:inline">
              catalog v{catalog.system.catalogVersion} · {catalog.system.gitCommit}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Switch brand mode (current: ${brand})`}
              onClick={() => setBrand(brand === 'default' ? 'aurora' : 'default')}
            >
              <span
                aria-hidden
                className="inline-block size-3 rounded-full"
                style={{ background: 'var(--color-action-primary-background)' }}
              />
              <span className="hidden capitalize sm:inline">{brand}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? <Moon aria-hidden /> : <Sun aria-hidden />}
              <span className="hidden sm:inline">{theme === 'light' ? 'Dark' : 'Light'}</span>
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl min-w-0 space-y-10 px-4 py-6 md:px-8 md:py-8">
          {view}
        </main>
      </div>
    </div>
  );
}
