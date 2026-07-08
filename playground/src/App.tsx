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
        <svg viewBox="0 0 437.1666 264.4827" className="topbar__glyph" aria-hidden>
          <path d="M212.9201,240.6041l-102.7592-102.6577c-3.1659-3.1628-3.1666-8.2939-.0014-11.4574L212.8578,23.842c3.1626-3.1611,8.2887-3.1608,11.451.0007l102.6993,102.6716c3.1635,3.1626,3.1638,8.2911.0006,11.4541l-102.6384,102.6331c-3.1616,3.1615-8.2871,3.1627-11.4502.0027Z" fill="#5aa1f2" />
          <path d="M282.2417,234.7913l97.5292-97.6266c2.7326-2.7353,2.7331-7.1671.001-9.9031l-97.3973-97.5358c-2.7227-2.7266-2.7329-7.1399-.0228-9.879l17.5796-17.7681c2.7318-2.7611,7.1883-2.7731,9.935-.0269l125.2475,125.226c2.7365,2.736,2.7369,7.1723.001,9.9089l-125.1874,125.2174c-2.7326,2.7332-7.1622,2.7377-9.9003.0099l-17.7737-17.7067c-2.7442-2.7338-2.7495-7.1756-.0118-9.9159Z" fill="currentColor" />
          <path d="M57.4354,137.1591l97.5065,97.6701c2.7355,2.7401,2.7301,7.1796-.0122,9.9129l-17.7541,17.6964c-2.7377,2.7288-7.1681,2.7251-9.9012-.0083L2.052,137.1944c-2.7364-2.7367-2.7359-7.1735.001-9.9096L127.2578,2.1195c2.7309-2.73,7.1558-2.736,9.894-.0134l17.7701,17.6684c2.7491,2.7334,2.7562,7.1796.0158,9.9217L57.438,127.2557c-2.7333,2.7349-2.7344,7.167-.0026,9.9034Z" fill="currentColor" />
        </svg>
        <span className="topbar__brand-name">Contract Playground</span>
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
