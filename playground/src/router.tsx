/**
 * Minimal history router — the playground keeps public-facing dependencies
 * near zero, and three routes don't justify one. pushState + popstate, a
 * Link that intercepts plain left-clicks, and a hook exposing pathname +
 * search params. Cloudflare Pages SPA fallback lives in public/_redirects.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';

interface RouterState {
  url: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterState | null>(null);

const currentUrl = () => window.location.pathname + window.location.search;

export function RouterProvider({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState(currentUrl);
  useEffect(() => {
    const onPop = () => setUrl(currentUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = useCallback((to: string) => {
    window.history.pushState(null, '', to);
    setUrl(currentUrl());
    window.scrollTo(0, 0);
  }, []);
  return <RouterContext.Provider value={{ url, navigate }}>{children}</RouterContext.Provider>;
}

export function useRoute() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRoute outside RouterProvider');
  const parsed = new URL(ctx.url, window.location.origin);
  return { pathname: parsed.pathname, params: parsed.searchParams, navigate: ctx.navigate };
}

export function Link({
  to,
  children,
  ...rest
}: { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('Link outside RouterProvider');
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    ctx.navigate(to);
  };
  return (
    <a href={to} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}
