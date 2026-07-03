import { Badge } from '../../../src/components';
import { components } from '../data';
import type { ComponentEntry } from '../data';
import { Source } from '../ui';

function statusVariant(status: string): 'info' | 'success' | 'warning' | 'danger' {
  if (status === 'stable') return 'success';
  if (status === 'deprecated') return 'danger';
  return 'info';
}

function surfaceLine(component: ComponentEntry): string {
  return component.figma.representation === 'component'
    ? 'Code ✓ · Figma ✓'
    : 'Code ✓ · Figma: native auto-layout';
}

export function ComponentsList() {
  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Components</h1>
        <p className="page-lede">
          This is the system's entire vocabulary — {components.length} concepts in the catalog,
          each governed by one contract that anchors both the React export and the Figma component
          set. Open any card to see the contract and both generated surfaces side by side.
        </p>
      </header>

      <div className="comp-grid">
        {components.map((component) => (
          <a
            key={component.id}
            className="comp-card"
            href={`#/components/${encodeURIComponent(component.id)}`}
          >
            <div className="comp-card-head">
              <span className="comp-card-name">{component.name}</span>
              <span className="comp-card-badges">
                <span className="chip mono">v{component.version}</span>
                <Badge variant={statusVariant(component.status)}>{component.status}</Badge>
              </span>
            </div>
            <p className="comp-card-desc">{component.description}</p>
            <div className="comp-card-meta muted">
              <span>{surfaceLine(component)}</span>
              <span>
                {component.props.length} {component.props.length === 1 ? 'prop' : 'props'} ·{' '}
                {component.slots.length} named {component.slots.length === 1 ? 'slot' : 'slots'} ·{' '}
                {component.children.kind} children
              </span>
            </div>
          </a>
        ))}
      </div>
      <Source path="catalog/catalog.json" />
    </div>
  );
}
