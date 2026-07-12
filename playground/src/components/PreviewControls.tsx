import { useEffect, useState } from 'react';
import type { Contract } from '../../../core/index.js';
import type { PreviewPropOverrides } from '../engine/preview';

/**
 * The controls strip over the single-instance preview — one control per
 * contract prop, derived from the ACTIVE contract (never hardcoded):
 * enum → select over the canonical values, boolean → checkbox, text/number →
 * inputs, arrayOf/kind-NONE → a "code-only" tag and no control. Text and
 * number inputs debounce 150ms so typing doesn't rebuild the frame per
 * keystroke; selects and checkboxes commit instantly.
 */

export interface PreviewControl {
  kind: 'enum' | 'boolean' | 'text' | 'number' | 'code-only';
  name: string;
  description?: string;
  values?: string[];
  /** The value the emitter renders when nothing is overridden. */
  fallback: string | boolean | number;
}

export function previewControlsFor(contract: Contract): PreviewControl[] {
  return contract.props.map((p): PreviewControl => {
    if (typeof p.type === 'object' && 'enum' in p.type) {
      return {
        kind: 'enum',
        name: p.name,
        description: p.description,
        values: p.type.enum,
        fallback: String(p.default ?? p.type.enum[0]),
      };
    }
    if (p.type === 'boolean') {
      return { kind: 'boolean', name: p.name, description: p.description, fallback: p.default === true };
    }
    if (p.type === 'text') {
      // Mirrors the html emitter's fallback: prop default, else the name.
      return {
        kind: 'text',
        name: p.name,
        description: p.description,
        fallback: typeof p.default === 'string' ? p.default : contract.name,
      };
    }
    if (p.type === 'number') {
      return {
        kind: 'number',
        name: p.name,
        description: p.description,
        fallback: typeof p.default === 'number' ? p.default : 0,
      };
    }
    // arrayOf — bindings.figma.kind 'NONE' by schema; no visual control exists.
    return { kind: 'code-only', name: p.name, description: p.description, fallback: '' };
  });
}

/** Overrides narrowed to values the current contract can actually take —
 *  stale entries (from a previous edit of the same contract) drop out. */
export function sanitizeOverrides(
  contract: Contract,
  overrides: PreviewPropOverrides,
): PreviewPropOverrides {
  const out: PreviewPropOverrides = {};
  for (const control of previewControlsFor(contract)) {
    const v = overrides[control.name];
    if (v === undefined) continue;
    if (control.kind === 'enum' && typeof v === 'string' && control.values!.includes(v)) out[control.name] = v;
    else if (control.kind === 'boolean' && typeof v === 'boolean') out[control.name] = v;
    else if (control.kind === 'text' && typeof v === 'string') out[control.name] = v;
    else if (control.kind === 'number' && typeof v === 'number') out[control.name] = v;
  }
  return out;
}

/** Text/number input that commits on a 150ms debounce — typing feels live
 *  without rebuilding the iframe per keystroke. */
function DebouncedInput({
  id,
  kind,
  value,
  onCommit,
}: {
  id: string;
  kind: 'text' | 'number';
  value: string | number;
  onCommit(next: string | number): void;
}) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => {
    setLocal(String(value));
  }, [value]);
  useEffect(() => {
    if (local === String(value)) return;
    const t = window.setTimeout(() => {
      onCommit(kind === 'number' ? Number(local) || 0 : local);
    }, 150);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);
  return (
    <input
      id={id}
      type={kind === 'number' ? 'number' : 'text'}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      spellCheck={false}
    />
  );
}

const NO_CHANGE_NOTE =
  'No visible change — by design: this prop has no effect in the static HTML preview (it manifests in code or on the canvas).';

/** DISPLAY order for an enum select: the contract's default first, the rest
 *  alphabetical — a proposed contract arrives in raw canvas order (`none`
 *  buried mid-list on the tooltip fixture). The CONTRACT is never reordered;
 *  this is a controls-UI concern only. */
export function enumDisplayOrder(values: string[], defaultValue: string): string[] {
  const rest = values.filter((v) => v !== defaultValue).sort((a, b) => a.localeCompare(b));
  return values.includes(defaultValue) ? [defaultValue, ...rest] : rest;
}

export function PreviewControls({
  contract,
  overrides,
  onChange,
  notedProp,
}: {
  contract: Contract;
  overrides: PreviewPropOverrides;
  onChange(name: string, value: string | boolean | number): void;
  /** The prop whose last toggle produced no visible change — honest note. */
  notedProp: string | null;
}) {
  const controls = previewControlsFor(contract);
  if (controls.length === 0 && !(contract.events?.length)) return null;
  return (
    <div className="pv-controls" role="group" aria-label="Preview prop controls">
      {controls.map((c) => {
        const id = `pv-${c.name}`;
        const current = overrides[c.name] ?? c.fallback;
        return (
          <div key={c.name} className="pv-control" title={c.description}>
            {c.kind === 'code-only' ? (
              <>
                <span className="pv-control__label">{c.name}</span>
                <span
                  className="pv-tag"
                  title="This prop is a list — it renders in code only; the canvas and this static preview have no control for it."
                >
                  code-only
                </span>
              </>
            ) : c.kind === 'boolean' ? (
              <>
                <span className="pv-control__label">{c.name}</span>
                <label className="pv-control__check" htmlFor={id}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={current === true}
                    onChange={(e) => onChange(c.name, e.target.checked)}
                  />
                  {current === true ? 'on' : 'off'}
                </label>
              </>
            ) : c.kind === 'enum' ? (
              <>
                <label className="pv-control__label" htmlFor={id}>
                  {c.name}
                </label>
                <select id={id} value={String(current)} onChange={(e) => onChange(c.name, e.target.value)}>
                  {enumDisplayOrder(c.values!, String(c.fallback)).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="pv-control__label" htmlFor={id}>
                  {c.name}
                </label>
                <DebouncedInput
                  id={id}
                  kind={c.kind}
                  value={current as string | number}
                  onCommit={(v) => onChange(c.name, v)}
                />
              </>
            )}
            {notedProp === c.name ? <span className="pv-note">{NO_CHANGE_NOTE}</span> : null}
          </div>
        );
      })}
      {contract.events && contract.events.length > 0 ? (
        <div className="pv-control pv-control--events">
          <span className="pv-control__label">events</span>
          <span className="pv-events">
            {contract.events.map((e) => e.bindings.code.prop).join(', ')}{' '}
            <span className="pv-tag" title="Declared callbacks run in the generated code — this static preview cannot fire them.">
              code-only
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
