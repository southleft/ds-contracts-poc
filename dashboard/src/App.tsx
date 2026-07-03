import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../src/components';
import { catalog } from './data';
import { Overview } from './views/Overview';
import { ComponentsList } from './views/ComponentsList';
import { ComponentDetail } from './views/ComponentDetail';
import { Tokens } from './views/Tokens';
import { Governance } from './views/Governance';
import { Parity } from './views/Parity';

type Theme = 'light' | 'dark';

const NAV_ITEMS = [
  { href: '#/', label: 'Overview', section: '' },
  { href: '#/components', label: 'Components', section: 'components' },
  { href: '#/tokens', label: 'Tokens', section: 'tokens' },
  { href: '#/governance', label: 'Governance', section: 'governance' },
  { href: '#/parity', label: 'Parity', section: 'parity' },
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [hash]);

  const segments = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const section = segments[0] ?? '';

  let view: ReactNode;
  let sectionLabel: string;
  if (section === 'components' && segments[1]) {
    view = <ComponentDetail id={decodeURIComponent(segments[1])} />;
    sectionLabel = 'Components';
  } else if (section === 'components') {
    view = <ComponentsList />;
    sectionLabel = 'Components';
  } else if (section === 'tokens') {
    view = <Tokens />;
    sectionLabel = 'Tokens';
  } else if (section === 'governance') {
    view = <Governance />;
    sectionLabel = 'Governance';
  } else if (section === 'parity') {
    view = <Parity />;
    sectionLabel = 'Parity';
  } else {
    view = <Overview />;
    sectionLabel = 'Overview';
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <a className="brand-name" href="#/">
            Contract Hub
          </a>
          <p className="brand-sub">The governed source, visualized</p>
        </div>
        <nav className="nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.section === '' ? section === '' : section === item.section;
            return (
              <a
                key={item.href}
                href={item.href}
                className={isActive ? 'active' : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="sidebar-foot mono">
          {catalog.package.name}
          <br />
          catalog v{catalog.system.catalogVersion}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-section micro">{sectionLabel}</span>
          <div className="topbar-meta">
            <span className="muted">
              catalog v{catalog.system.catalogVersion} ·{' '}
              <span className="mono">{catalog.system.gitCommit}</span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </Button>
          </div>
        </header>
        <main className="content">{view}</main>
      </div>
    </div>
  );
}
