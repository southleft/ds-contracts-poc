import { Link, useRoute } from './router';
import { ThemeProvider, useTheme } from './theme';
import { Landing } from './pages/Landing';
import { Examples } from './pages/Examples';
import { Playground } from './pages/Playground';

export const REPO_URL = 'https://github.com/southleft/ds-contracts-poc';

function TopBar() {
  const { pathname } = useRoute();
  const { theme, toggle } = useTheme();
  const navClass = (path: string) => `topbar__link${pathname === path ? ' is-active' : ''}`;
  return (
    <header className="topbar">
      <Link to="/" className="topbar__brand">
        <span className="topbar__glyph">{'{}'}</span> Contract Playground
      </Link>
      <nav className="topbar__nav">
        <Link to="/playground" className={navClass('/playground')}>
          Playground
        </Link>
        <Link to="/examples" className={navClass('/examples')}>
          Examples
        </Link>
        <a href={REPO_URL} className="topbar__link" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </nav>
      <button
        type="button"
        className="topbar__theme"
        onClick={toggle}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      >
        {theme === 'light' ? 'Dark' : 'Light'}
      </button>
    </header>
  );
}

function Routes() {
  const { pathname } = useRoute();
  if (pathname === '/playground') return <Playground />;
  if (pathname === '/examples') return <Examples />;
  return <Landing />;
}

export function App() {
  return (
    <ThemeProvider>
      <div className="app">
        <TopBar />
        <main className="app__main">
          <Routes />
        </main>
      </div>
    </ThemeProvider>
  );
}
