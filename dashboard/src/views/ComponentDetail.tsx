import { useState } from 'react';
import type { ReactNode } from 'react';
import { Badge, Button } from '../../../src/components';
import {
  contractFilePath,
  figmaNodeUrl,
  figmaSetByName,
  findingsForComponent,
  getComponent,
} from '../data';
import type { AnatomyNode, CatalogProp, ComponentEntry } from '../data';
import { renderSample, SAMPLE_TEXT } from '../samples';
import { Source } from '../ui';

function statusVariant(status: string): 'info' | 'success' | 'warning' | 'danger' {
  if (status === 'stable') return 'success';
  if (status === 'deprecated') return 'danger';
  return 'info';
}

function classificationVariant(
  classification: 'ahead' | 'behind' | 'mismatch',
): 'info' | 'warning' | 'danger' {
  if (classification === 'ahead') return 'warning';
  if (classification === 'behind') return 'info';
  return 'danger';
}

function formatDefault(value: unknown): string {
  if (value === undefined) return '—';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function propTypeCell(prop: CatalogProp) {
  if (Array.isArray(prop.type)) {
    return (
      <span className="chip-row">
        {prop.type.map((value) => (
          <span key={value} className="chip mono">
            {value}
          </span>
        ))}
      </span>
    );
  }
  return <span className="mono">{prop.type}</span>;
}

/**
 * Interactive props playground — controls are generated from the catalog
 * entry itself (a select per enum prop, a checkbox per boolean, a text input
 * for string props and text children) and drive the REAL component from
 * src/components, re-rendered live on every change.
 */
function Playground({ component }: { component: ComponentEntry }) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const prop of component.props) {
      if (prop.default !== undefined) {
        initial[prop.name] = prop.default;
      } else if (Array.isArray(prop.type)) {
        initial[prop.name] = prop.type[0];
      } else if (prop.type === 'boolean') {
        initial[prop.name] = false;
      }
    }
    return initial;
  });
  const [childText, setChildText] = useState(SAMPLE_TEXT[component.name] ?? '');

  const hasTextChildren = component.children.kind === 'text';
  const setValue = (name: string, value: unknown) =>
    setValues((previous) => ({ ...previous, [name]: value }));

  // Omit empty string-prop values so component defaults apply.
  const stageProps: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(values)) {
    if (value === '' || value === undefined) continue;
    stageProps[name] = value;
  }

  return (
    <div className="playground">
      <h3 className="micro sub-label">Playground</h3>
      <div className="pg-controls">
        {component.props.map((prop) => {
          const controlId = `pg-${component.id}-${prop.name}`;
          if (Array.isArray(prop.type)) {
            return (
              <label className="pg-field" key={prop.name} htmlFor={controlId}>
                <span className="pg-label mono">{prop.name}</span>
                <select
                  id={controlId}
                  className="pg-select mono"
                  value={String(values[prop.name] ?? prop.type[0])}
                  onChange={(event) => setValue(prop.name, event.target.value)}
                >
                  {prop.type.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            );
          }
          if (prop.type === 'boolean') {
            return (
              <label className="pg-field pg-field--check" key={prop.name} htmlFor={controlId}>
                <input
                  id={controlId}
                  type="checkbox"
                  checked={Boolean(values[prop.name])}
                  onChange={(event) => setValue(prop.name, event.target.checked)}
                />
                <span className="pg-label mono">{prop.name}</span>
              </label>
            );
          }
          return (
            <label className="pg-field" key={prop.name} htmlFor={controlId}>
              <span className="pg-label mono">{prop.name}</span>
              <input
                id={controlId}
                className="pg-input mono"
                type="text"
                value={String(values[prop.name] ?? '')}
                onChange={(event) => setValue(prop.name, event.target.value)}
              />
            </label>
          );
        })}
        {hasTextChildren ? (
          <label className="pg-field" htmlFor={`pg-${component.id}-children`}>
            <span className="pg-label mono">children</span>
            <input
              id={`pg-${component.id}-children`}
              className="pg-input mono"
              type="text"
              value={childText}
              onChange={(event) => setChildText(event.target.value)}
            />
          </label>
        ) : null}
      </div>
      <div className="pg-stage">{renderSample(component.name, stageProps, childText)}</div>
    </div>
  );
}

function AnatomyPart({ name, node }: { name: string; node: AnatomyNode }) {
  return (
    <div className="anatomy-part">
      <div className="anatomy-name mono">
        {name}
        {node.optional ? <span className="muted"> · optional</span> : null}
      </div>
      {node.component ? (
        <div className="anatomy-instance muted">
          instance of <span className="mono">{node.component.id}</span>
        </div>
      ) : null}
      {node.slot ? (
        <div className="anatomy-instance muted">
          slot <span className="mono">{node.slot.name}</span>
          {node.slot.accepts && node.slot.accepts.length > 0 ? (
            <>
              {' '}
              accepts{' '}
              {node.slot.accepts.map((id) => (
                <span key={id} className="chip mono">
                  {id}
                </span>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
      {node.tokens
        ? Object.entries(node.tokens).map(([cssProp, tokenRef]) => (
            <div className="binding-row mono" key={cssProp}>
              <span className="binding-prop">{cssProp}</span>
              <span className="binding-arrow" aria-hidden="true">
                →
              </span>
              <span className="binding-token">{tokenRef}</span>
            </div>
          ))
        : null}
      {node.parts
        ? Object.entries(node.parts).map(([childName, child]) => (
            <AnatomyPart key={childName} name={`${name}.${childName}`} node={child} />
          ))
        : null}
    </div>
  );
}

export function ComponentDetail({ id }: { id: string }) {
  const component = getComponent(id);

  if (!component) {
    return (
      <div className="page">
        <p>
          Unknown component <span className="mono">{id}</span>.{' '}
          <a href="#/components">Back to components</a>
        </p>
      </div>
    );
  }

  const contract = component.contract;
  const figmaSet = figmaSetByName(component.name);
  const findings = findingsForComponent(component.name);
  const isFigmaComponent = component.figma.representation === 'component';

  const enumProps = component.props.filter((prop) => Array.isArray(prop.type));
  const rowProp = enumProps[0];
  const colProp = enumProps[1];
  const rows: (string | undefined)[] = rowProp ? (rowProp.type as string[]) : [undefined];
  const cols: (string | undefined)[] = colProp ? (colProp.type as string[]) : [undefined];

  const sampleProps = (row: string | undefined, col: string | undefined) => {
    const props: Record<string, unknown> = {};
    if (rowProp && row !== undefined) props[rowProp.name] = row;
    if (colProp && col !== undefined) props[colProp.name] = col;
    return props;
  };

  const figmaUrl =
    isFigmaComponent && contract && contract.anchors.figma.nodeId
      ? figmaNodeUrl(contract.anchors.figma.nodeId)
      : undefined;

  return (
    <div className="page">
      <a className="back-link muted" href="#/components">
        ← Components
      </a>

      <header className="detail-head">
        <div className="detail-head-title">
          <h1 className="page-title">{component.name}</h1>
          <span className="mono muted">{component.id}</span>
          <span className="chip mono">v{component.version}</span>
          <Badge variant={statusVariant(component.status)}>{component.status}</Badge>
        </div>
        <p className="page-lede">{component.description}</p>
        <div className="detail-links">
          {figmaUrl ? (
            <a href={figmaUrl} target="_blank" rel="noreferrer">
              Open in Figma ↗
            </a>
          ) : null}
          {contract ? (
            <code className="import-snippet mono">
              import {'{'} {contract.anchors.code.export} {'}'} from '
              {contract.anchors.code.importPath}'
            </code>
          ) : null}
        </div>
        <p className="section-lede muted">
          The three panels below show one component from three vantage points: both outer
          surfaces are generated from the contract in the middle — neither is hand-maintained.
        </p>
      </header>

      <div className="detail-grid">
        {/* ------------------------------------------------ Code surface */}
        <section className="panel">
          <h2 className="micro panel-title">Code surface</h2>
          <Playground key={component.id} component={component} />
          <p className="sample-caption muted">
            sample content · components + tokens are real, rendered from src/components
          </p>
          <h3 className="micro sub-label">Matrix</h3>
          {rowProp ? (
            <p className="matrix-caption micro">
              {rowProp.name}
              {colProp ? ` × ${colProp.name}` : ''}
            </p>
          ) : null}
          <div className="matrix-scroll">
            <div
              className="matrix"
              style={{ gridTemplateColumns: `auto repeat(${cols.length}, auto)` }}
            >
              <span className="matrix-corner" aria-hidden="true" />
              {cols.map((col, index) => (
                <span key={col ?? index} className="matrix-col-label micro">
                  {colProp && col !== undefined ? col : ''}
                </span>
              ))}
              {rows.map((row, rowIndex) => (
                <MatrixRow
                  key={row ?? rowIndex}
                  label={rowProp && row !== undefined ? row : ''}
                  cells={cols.map((col, colIndex) => (
                    <div key={col ?? colIndex} className="matrix-cell">
                      {renderSample(component.name, sampleProps(row, col))}
                    </div>
                  ))}
                />
              ))}
            </div>
          </div>
          <p className="judge-line muted">
            governed by contract <span className="mono">{component.id}</span> v{component.version}
          </p>
          <Source path="src/components (live render) · catalog/catalog.json (prop space)" />
        </section>

        {/* ------------------------------------------ Contract (center) */}
        <section className="panel panel--contract">
          <h2 className="micro panel-title">The contract (source of truth)</h2>

          <h3 className="micro sub-label">Props</h3>
          <div className="table-scroll">
            <table className="props-table">
            <thead>
              <tr>
                <th className="micro">name</th>
                <th className="micro">type</th>
                <th className="micro">default</th>
                <th className="micro">required</th>
              </tr>
            </thead>
            <tbody>
              {component.props.map((prop) => (
                <tr key={prop.name}>
                  <td className="mono">{prop.name}</td>
                  <td>{propTypeCell(prop)}</td>
                  <td className="mono">{formatDefault(prop.default)}</td>
                  <td>{prop.required ? '✓' : '—'}</td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>

          <h3 className="micro sub-label">Children &amp; slots</h3>
          <div className="policy-block">
            <div className="policy-row">
              <span className="policy-key muted">children</span>
              <span>
                <span className="chip mono">{component.children.kind}</span>
                {component.children.accepts && component.children.accepts.length > 0 ? (
                  <>
                    {' '}
                    accepts{' '}
                    {component.children.accepts.map((name) => (
                      <span key={name} className="chip mono">
                        {name}
                      </span>
                    ))}
                  </>
                ) : null}
                {component.children.acceptsMode ? (
                  <span className="muted"> · mode: {component.children.acceptsMode}</span>
                ) : null}
              </span>
            </div>
            {component.slots.map((slot) => (
              <div className="policy-row" key={slot.prop}>
                <span className="policy-key muted">slot: {slot.prop}</span>
                <span>
                  accepts{' '}
                  {slot.accepts.map((name) => (
                    <span key={name} className="chip mono">
                      {name}
                    </span>
                  ))}
                  <span className="muted">
                    {' '}
                    · mode: {slot.acceptsMode}
                    {slot.optional ? ' · optional' : ''}
                  </span>
                </span>
              </div>
            ))}
          </div>

          {contract ? (
            <>
              <h3 className="micro sub-label">Anatomy token bindings</h3>
              <div className="anatomy">
                <AnatomyPart name="root" node={contract.anatomy.root} />
              </div>

              {contract.states.length > 0 ? (
                <>
                  <h3 className="micro sub-label">States</h3>
                  <div className="chip-row">
                    {contract.states.map((state) => (
                      <span key={state} className="chip mono">
                        {state}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}

              <h3 className="micro sub-label">Dual identity</h3>
              <div className="identity-block">
                <div className="identity-half">
                  <span className="micro">Figma anchor</span>
                  {contract.anchors.figma.componentSetKey ? (
                    <>
                      <span
                        className="mono identity-line"
                        title={contract.anchors.figma.componentSetKey}
                      >
                        set {contract.anchors.figma.componentSetKey.slice(0, 12)}…
                      </span>
                      <span className="mono identity-line">
                        node {contract.anchors.figma.nodeId}
                      </span>
                    </>
                  ) : (
                    <span className="identity-line muted">native auto-layout — no set</span>
                  )}
                </div>
                <div className="identity-half">
                  <span className="micro">Code anchor</span>
                  <span className="mono identity-line">{contract.anchors.code.importPath}</span>
                  <span className="mono identity-line">export {contract.anchors.code.export}</span>
                </div>
              </div>
            </>
          ) : null}
          <Source path={contractFilePath(component.id)} />
        </section>

        {/* ------------------------------------------------ Design surface */}
        <section className="panel">
          <h2 className="micro panel-title">Design surface (Figma)</h2>
          {isFigmaComponent && figmaSet ? (
            <>
              <p>
                <strong>{figmaSet.variantCount}</strong>{' '}
                {figmaSet.variantCount === 1 ? 'variant' : 'variants'} published in the component
                set.
              </p>
              <div className="figma-props">
                {Object.entries(figmaSet.properties).map(([rawName, property]) => {
                  const name = rawName.split('#')[0];
                  return (
                    <div className="figma-prop" key={rawName}>
                      <span className="figma-prop-name">
                        {name} <span className="muted mono">{property.type}</span>
                      </span>
                      {property.variantOptions ? (
                        <span className="chip-row">
                          {property.variantOptions.map((option) => (
                            <span key={option} className="chip mono">
                              {option}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <p className="mono muted key-line" title={figmaSet.key}>
                key {figmaSet.key.slice(0, 16)}…
              </p>
              {figmaUrl ? (
                <a className="button-link" href={figmaUrl} target="_blank" rel="noreferrer">
                  <Button variant="secondary" size="sm" tabIndex={-1}>
                    Open in Figma
                  </Button>
                </a>
              ) : null}
            </>
          ) : (
            <div className="native-note">
              <p>
                This concept maps to <strong>native Figma auto-layout</strong> — no component is
                generated, and parity doesn't expect one.
              </p>
            </div>
          )}
          <Source path="parity/snapshots/figma-components.json" />
        </section>
      </div>

      {/* --------------------------------------------------- Parity strip */}
      {findings.length === 0 ? (
        <div className="parity-strip parity-strip--clean">
          ✓ In parity — code, Figma, and tokens match contract {component.id} v{component.version}
        </div>
      ) : (
        <div className="findings">
          {findings.map((finding, index) => (
            <div className="finding-row" key={index}>
              <Badge variant={classificationVariant(finding.classification)}>
                {finding.classification}
              </Badge>
              <span className="mono">{finding.subject}</span>
              <span>{finding.detail}</span>
              <span className="muted">{finding.remedy}</span>
            </div>
          ))}
        </div>
      )}
      <Source path="parity/report.json" />
    </div>
  );
}

function MatrixRow({ label, cells }: { label: string; cells: ReactNode[] }) {
  return (
    <>
      <span className="matrix-row-label micro">{label}</span>
      {cells}
    </>
  );
}
