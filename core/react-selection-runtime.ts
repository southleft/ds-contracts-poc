/** Selection runtime foundation; contract/emitter integration is not yet wired.
 * No component name or description is interpreted as behavior.
 * Keep the runtime as source so both React emitters can include these same bytes
 * without depending on the build tool's Function#toString transformation. */
export const REACT_SELECTION_RUNTIME = String.raw`import { useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';

export interface SelectionItem { key: string; disabled?: boolean }
export interface SelectionOptions {
  items: readonly SelectionItem[];
  value?: string | null;
  defaultValue?: string;
  onValueChange?: (key: string) => void;
  orientation: 'horizontal' | 'vertical';
  direction: 'ltr' | 'rtl';
  activation: 'automatic' | 'manual';
}

/** Explicit tab-pattern behavior. Missing/disabled controlled values select no
 * panel. Removing an uncontrolled selection chooses the first enabled item.
 * Reconciliation never reports a user action. Initial values are mount-only. */
export function useSingleSelection(options: SelectionOptions) {
  const { items, value, defaultValue, onValueChange, orientation, direction, activation } = options;
  if (!Array.isArray(items)) throw Error('selection-items-invalid');
  const all = new Set<string>();
  const enabled: string[] = [];
  for (const item of items) {
    if (!item || typeof item.key !== 'string' || item.key.length === 0 ||
        (item.disabled !== undefined && typeof item.disabled !== 'boolean'))
      throw Error('selection-item-invalid');
    if (all.has(item.key)) throw Error('selection-key-duplicate');
    all.add(item.key);
    if (!item.disabled) enabled.push(item.key);
  }
  if (value !== undefined && value !== null && typeof value !== 'string') throw Error('selection-value-invalid');
  if (defaultValue !== undefined && typeof defaultValue !== 'string') throw Error('selection-initial-value-invalid');
  if (!['horizontal', 'vertical'].includes(orientation) || !['ltr', 'rtl'].includes(direction) ||
      !['automatic', 'manual'].includes(activation)) throw Error('selection-policy-invalid');
  const baseId = useId();
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const focusWithin = useRef(false);
  const reconcilingFocus = useRef(false);
  const pointerFocus = useRef<string | undefined>(undefined);
  const pointerActivation = useRef<string | undefined>(undefined);
  const [stored, setStored] = useState<string | undefined>(() =>
    defaultValue !== undefined && enabled.includes(defaultValue) ? defaultValue : enabled[0]);
  const [focused, setFocused] = useState<string | undefined>();
  const controlled = value !== undefined;
  const selected = controlled
    ? typeof value === 'string' && enabled.includes(value) ? value : undefined
    : stored !== undefined && enabled.includes(stored) ? stored : enabled[0];
  const tabStop = focused !== undefined && enabled.includes(focused) ? focused : selected ?? enabled[0];

  useEffect(() => {
    if (!controlled && stored !== selected) setStored(selected);
    if (focused !== undefined && !enabled.includes(focused)) {
      setFocused(undefined);
      if (focusWithin.current && tabStop !== undefined) {
        reconcilingFocus.current = true;
        try { nodes.current.get(tabStop)?.focus(); }
        finally { reconcilingFocus.current = false; }
      }
      if (tabStop === undefined) focusWithin.current = false;
    }
  });

  const id = (kind: 'item' | 'panel', key: string) => {
    // Fixed-width UTF-16 units also encode lone surrogates, unlike URI encoding.
    // A key never becomes an executable selector; IDs remain stable on reorder.
    let encoded = '';
    for (let i = 0; i < key.length; i++) encoded += key.charCodeAt(i).toString(16).padStart(4, '0');
    return baseId + '-' + kind + '-' + encoded;
  };
  const activate = (key: string) => {
    if (!enabled.includes(key) || key === selected) return;
    if (!controlled) setStored(key);
    onValueChange?.(key);
  };
  const itemProps = (key: string): ButtonHTMLAttributes<HTMLButtonElement> & {
    ref: (node: HTMLButtonElement | null) => void;
  } => {
    if (!all.has(key)) throw Error('selection-item-key-unmapped');
    const disabled = !enabled.includes(key);
    return {
      id: id('item', key), role: 'tab', type: 'button', disabled,
      'aria-selected': key === selected, 'aria-controls': id('panel', key),
      tabIndex: !disabled && key === tabStop ? 0 : -1,
      ref: node => { if (node) nodes.current.set(key, node); else nodes.current.delete(key); },
      onPointerDown: event => {
        pointerFocus.current = event.button === 0 && event.currentTarget !== event.currentTarget.ownerDocument.activeElement ? key : undefined;
        pointerActivation.current = undefined;
      },
      onPointerCancel: () => { pointerFocus.current = undefined; pointerActivation.current = undefined; },
      onFocus: () => {
        if (disabled) return;
        focusWithin.current = true;
        setFocused(key);
        if (activation === 'automatic' && !reconcilingFocus.current) {
          activate(key);
          if (pointerFocus.current === key) pointerActivation.current = key;
        }
        pointerFocus.current = undefined;
      },
      onBlur: event => {
        const target = event.relatedTarget;
        if (!target || !Array.from(nodes.current.values()).some(node => node === target || node.contains(target as Node))) {
          focusWithin.current = false;
          setFocused(undefined);
        }
      },
      onClick: event => {
        // Pointer focus and click are one action even when the consumer holds
        // the controlled value. A later click or Enter remains a new request.
        const alreadyRequested = event.detail > 0 && pointerActivation.current === key;
        pointerFocus.current = undefined;
        pointerActivation.current = undefined;
        if (!alreadyRequested) activate(key);
      },
      onKeyDown: event => {
        if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
        let target: string | undefined;
        const index = enabled.indexOf(key);
        if (event.key === 'Home') target = enabled[0];
        else if (event.key === 'End') target = enabled[enabled.length - 1];
        else {
          const next = orientation === 'vertical' ? 'ArrowDown' : direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
          const previous = orientation === 'vertical' ? 'ArrowUp' : direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
          const delta = event.key === next ? 1 : event.key === previous ? -1 : 0;
          if (delta !== 0) target = enabled[(index + delta + enabled.length) % enabled.length];
        }
        if (target === undefined) return;
        event.preventDefault();
        nodes.current.get(target)?.focus();
      },
    };
  };
  const panelProps = (key: string, focusable: boolean): HTMLAttributes<HTMLDivElement> => {
    if (!all.has(key)) throw Error('selection-panel-key-unmapped');
    return {
      id: id('panel', key), role: 'tabpanel', 'aria-labelledby': id('item', key),
      hidden: key !== selected, tabIndex: focusable ? 0 : undefined,
      // A component's authored display:flex/grid must not defeat HTML hidden.
      style: key !== selected ? { display: 'none' } : undefined,
    };
  };
  return {
    selected, itemProps, panelProps,
    listProps: { role: 'tablist', 'aria-orientation': orientation, dir: direction } as const,
  };
}
`;
