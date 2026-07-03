/**
 * Small shared chrome elements for the dashboard.
 */

/**
 * Provenance micro-label — names the repo artifact a module's data is read
 * from, so "this is real data" is self-evident on every panel.
 */
export function Source({ path }: { path: string }) {
  return (
    <p className="source-line mono">
      source: <span className="source-path">{path}</span>
    </p>
  );
}
