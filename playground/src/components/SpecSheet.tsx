import {
  slotsOf,
  statePreviewLabel,
  walkAnatomy,
  type Contract,
  type Prop,
} from '../../../core/index.js';

/**
 * The Spec view — the SAME contract, rendered as a designer-facing spec
 * sheet. Read-only by design: every fact on screen is derived from the
 * parsed contract (nothing is stored twice, nothing can drift); editing
 * happens in the JSON view, one toggle away. Chips are square text chips,
 * never pills; token refs render verbatim, {placeholders} included.
 */

const isEnumProp = (p: Prop): p is Prop & { type: { enum: string[] } } =>
  typeof p.type === 'object' && 'enum' in p.type;
const isArrayProp = (p: Prop): p is Prop & { type: { arrayOf: Record<string, string> } } =>
  typeof p.type === 'object' && 'arrayOf' in p.type;

const typeLabel = (p: Prop): string => {
  if (isEnumProp(p)) return 'enum';
  if (isArrayProp(p)) return 'list';
  return p.type as string;
};

const defaultLabel = (p: Prop): string => {
  if (p.type === 'boolean') return p.default === true ? 'on' : 'off';
  if (p.default === undefined) return '—';
  if (p.type === 'text') return `“${String(p.default)}”`;
  return String(p.default);
};

const Chips = ({ values, mono = false }: { values: string[]; mono?: boolean }) => (
  <span className="spec__chips">
    {values.map((v) => (
      <span key={v} className={`spec__chip${mono ? ' spec__chip--mono' : ''}`}>
        {v}
      </span>
    ))}
  </span>
);

/** Unique token refs, grouped by their leading path segment (color / space /
 *  radius / font / …), in first-appearance group order. */
function tokenGroups(contract: Contract): Array<[string, string[]]> {
  const groups = new Map<string, Set<string>>();
  const add = (ref: string) => {
    const category = ref.slice(1).split('.')[0].replace(/\}.*$/, '');
    if (!groups.has(category)) groups.set(category, new Set());
    groups.get(category)!.add(ref);
  };
  for (const { part } of walkAnatomy(contract)) {
    for (const ref of Object.values(part.tokens ?? {})) add(ref);
    for (const state of Object.values(part.states ?? {})) {
      for (const ref of Object.values(state)) add(ref);
    }
  }
  return [...groups.entries()].map(([category, refs]) => [category, [...refs]]);
}

/** Per-variant layout overrides (layoutByProp), one line per part — the
 *  ChatMessage "sender=user flips the row" story, generically. */
function layoutNotes(contract: Contract): string[] {
  const notes: string[] = [];
  for (const { name, part } of walkAnatomy(contract)) {
    const byProp = part.layoutByProp;
    if (!byProp) continue;
    for (const [value, override] of Object.entries(byProp.map)) {
      const changes = Object.entries(override)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      notes.push(`${name} — when ${byProp.prop} is “${value}”: ${changes}`);
    }
  }
  return notes;
}

function a11yLine(contract: Contract): string | null {
  const a = contract.a11y;
  if (!a) return null;
  const parts: string[] = [];
  if (a.focusVisible) parts.push('visible focus ring required');
  if (a.minHitArea) parts.push(`hit area at least ${a.minHitArea}×${a.minHitArea}px`);
  if (a.contrast) parts.push(`contrast ${a.contrast}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function SpecSheet({
  contract,
  contracts,
  onEditJson,
}: {
  contract: Contract;
  contracts: Map<string, Contract>;
  /** Switches the pane back to the JSON view — spec is read-only. */
  onEditJson(): void;
}) {
  const enums = contract.props.filter(isEnumProp);
  const comboCount = enums.reduce((n, p) => n * p.type.enum.length, 1);
  const slots = slotsOf(contract);
  const tokens = tokenGroups(contract);
  const layouts = layoutNotes(contract);
  const a11y = a11yLine(contract);
  const nameOf = (id: string) => contracts.get(id)?.name ?? id;

  return (
    <div className="spec" aria-label={`${contract.name} spec sheet`}>
      <div className="spec__header">
        <div className="spec__title-row">
          <span className="spec__name">{contract.name}</span>
          <span className="spec__meta">
            v{contract.version} · {contract.status}
          </span>
          <button
            type="button"
            className="btn--small spec__edit"
            onClick={onEditJson}
            title="The spec is read-only — every edit happens in the JSON, refereed by the schema."
          >
            Edit JSON
          </button>
        </div>
        <p className="spec__desc">{contract.description}</p>
      </div>

      <section className="spec__section">
        <h3 className="spec__section-title">Props</h3>
        {contract.props.length === 0 ? (
          <p className="spec__none">No props — this component renders one way.</p>
        ) : (
          <div className="spec__table-wrap">
            <table className="spec__table">
              <thead>
                <tr>
                  <th>Prop</th>
                  <th>Type</th>
                  <th>Options</th>
                  <th>Default</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {contract.props.map((p) => (
                  <tr key={p.name}>
                    <td className="spec__mono">{p.name}</td>
                    <td>{typeLabel(p)}</td>
                    <td>
                      {isEnumProp(p) ? (
                        <Chips values={p.type.enum} />
                      ) : isArrayProp(p) ? (
                        <Chips values={Object.entries(p.type.arrayOf).map(([f, t]) => `${f}: ${t}`)} mono />
                      ) : p.type === 'boolean' ? (
                        'on / off'
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{defaultLabel(p)}</td>
                    <td className="spec__notes">
                      {p.description ?? ''}
                      {p.required ? <span className="spec__tag">required</span> : null}
                      {p.bindings.figma.kind === 'NONE' ? (
                        <span
                          className="spec__tag"
                          title="Declared fidelity limit: this prop has no canvas manifestation — it exists in code only."
                        >
                          code-only
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="spec__section">
        <h3 className="spec__section-title">Variants</h3>
        {enums.length === 0 ? (
          <p className="spec__none">No variant axes.</p>
        ) : (
          <>
            <ul className="spec__list">
              {enums.map((p) => (
                <li key={p.name}>
                  <span className="spec__mono">{p.name}</span> × {p.type.enum.length}{' '}
                  <Chips values={p.type.enum} />
                </li>
              ))}
            </ul>
            <p className="spec__line">
              {comboCount} combination{comboCount === 1 ? '' : 's'} (
              {enums.map((p) => p.name).join(' × ')})
            </p>
            {contract.figmaStatePreviews ? (
              <p className="spec__line">
                State previews (canvas): a State axis renders{' '}
                {['Default', ...contract.states.map(statePreviewLabel)].join(', ')} as extra Figma
                variants — code keeps these as live CSS states.
              </p>
            ) : null}
          </>
        )}
        {layouts.length > 0 ? (
          <>
            <p className="spec__line spec__line--label">Layout varies by variant:</p>
            <ul className="spec__list">
              {layouts.map((note) => (
                <li key={note} className="spec__mono">
                  {note}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {slots.length > 0 ? (
        <section className="spec__section">
          <h3 className="spec__section-title">Slots</h3>
          <ul className="spec__list">
            {slots.map(({ slot, part }) => (
              <li key={slot.name}>
                <span className="spec__mono">{slot.name}</span>
                {' — accepts '}
                {slot.accepts && slot.accepts.length > 0 ? (
                  <Chips values={slot.accepts.map(nameOf)} />
                ) : (
                  'anything (unconstrained)'
                )}
                {part.optional ? <span className="spec__tag">optional</span> : null}
                {slot.min !== undefined || slot.max !== undefined ? (
                  <span className="spec__faint">
                    {' '}
                    ({slot.min !== undefined ? `min ${slot.min}` : ''}
                    {slot.min !== undefined && slot.max !== undefined ? ', ' : ''}
                    {slot.max !== undefined ? `max ${slot.max}` : ''})
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {contract.events && contract.events.length > 0 ? (
        <section className="spec__section">
          <h3 className="spec__section-title">Events</h3>
          <ul className="spec__list">
            {contract.events.map((e) => (
              <li key={e.name}>
                <span className="spec__mono">{e.bindings.code.prop}</span>
                <span
                  className="spec__tag"
                  title="Events are declared, not implemented on the canvas — the callback exists in generated code only."
                >
                  code-only
                </span>
                {e.description ? <span className="spec__notes"> {e.description}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tokens.length > 0 ? (
        <section className="spec__section">
          <h3 className="spec__section-title">Tokens used</h3>
          {tokens.map(([category, refs]) => (
            <div key={category} className="spec__token-group">
              <span className="spec__token-cat">{category}</span>
              <Chips values={refs} mono />
            </div>
          ))}
        </section>
      ) : null}

      <section className="spec__section">
        <h3 className="spec__section-title">States</h3>
        <p className="spec__line">
          {contract.states.length > 0 ? contract.states.join(' · ') : 'none declared'}
        </p>
      </section>

      {a11y ? (
        <section className="spec__section">
          <h3 className="spec__section-title">Accessibility</h3>
          <p className="spec__line">{a11y}</p>
        </section>
      ) : null}
    </div>
  );
}
