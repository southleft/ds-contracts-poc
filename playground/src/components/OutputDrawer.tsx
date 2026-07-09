import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Receipts } from '../receipts';
import { receiptCount } from '../receipts';
import { ReceiptsPanel } from './ReceiptsPanel';

/**
 * Storybook-style bottom drawer for the output pane — Controls and Receipts
 * as tabs in ONE collapsible panel instead of two stacked strips. The
 * receipts badge carries the entry count; a fresh import auto-selects the
 * Receipts tab (but never forces the drawer open — the collapsed choice is
 * the user's, persisted per browser).
 */
const DRAWER_COLLAPSED_KEY = 'ds-playground.drawer-collapsed';

type DrawerTab = 'controls' | 'receipts';

const CHEVRON = (up: boolean) => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d={up ? 'M3 10l5-5 5 5' : 'M3 6l5 5 5-5'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function OutputDrawer({
  controls,
  receipts,
  mintedExtras,
  footNote,
}: {
  /** The Controls tab body (prop controls + contextual hints). */
  controls: ReactNode;
  receipts: Receipts | null;
  /** Rendered under the minted receipts group (MintAssist). */
  mintedExtras?: ReactNode;
  /** Right-side ⓘ content (the provenance line's new home). */
  footNote?: ReactNode;
}) {
  const [tab, setTab] = useState<DrawerTab>('controls');
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(DRAWER_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(DRAWER_COLLAPSED_KEY, c ? '0' : '1');
      } catch {
        /* storage unavailable — the choice just doesn't persist */
      }
      return !c;
    });
  };

  // A NEW receipts object (fresh import / workspace restore) pulls the
  // Receipts tab forward — the count badge alone is easy to miss.
  const lastReceipts = useRef<Receipts | null>(receipts);
  useEffect(() => {
    if (receipts && receipts !== lastReceipts.current) setTab('receipts');
    lastReceipts.current = receipts;
  }, [receipts]);

  const count = receipts ? receiptCount(receipts) : 0;

  const tabButton = (t: DrawerTab, label: ReactNode) => (
    <button
      type="button"
      role="tab"
      id={`dock-tab-${t}`}
      aria-selected={tab === t}
      aria-controls="dock-panel"
      className={`dock__tab${tab === t ? ' is-active' : ''}`}
      onClick={() => {
        setTab(t);
        if (collapsed) toggleCollapsed();
      }}
    >
      {label}
    </button>
  );

  return (
    <section className={`dock${collapsed ? ' dock--collapsed' : ''}`} aria-label="Controls and receipts">
      <div className="dock__bar">
        <div role="tablist" aria-label="Drawer panel" className="dock__tabs">
          {tabButton('controls', 'Controls')}
          {tabButton(
            'receipts',
            <>
              Receipts
              <span className="dock__badge" aria-label={`${count} receipt entries`}>
                {count}
              </span>
            </>,
          )}
        </div>
        {footNote}
        <button
          type="button"
          className="dock__toggle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand the controls and receipts drawer' : 'Collapse the controls and receipts drawer'}
          onClick={toggleCollapsed}
        >
          {CHEVRON(collapsed)}
        </button>
      </div>
      {!collapsed ? (
        <div
          className="dock__body"
          role="tabpanel"
          id="dock-panel"
          aria-labelledby={`dock-tab-${tab}`}
        >
          {tab === 'controls' ? (
            controls
          ) : (
            <ReceiptsPanel receipts={receipts} mintedExtras={mintedExtras} embedded />
          )}
        </div>
      ) : null}
    </section>
  );
}
