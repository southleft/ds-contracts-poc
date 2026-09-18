/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tabs.contract.json (ds.tabs v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLDivElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { Tab } from '../Tab';
import { TabPanel } from '../TabPanel';
import styles from './Tabs.module.css';

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  variant?: 'default' | 'stretch';
  items?: Array<{ text: string }>;
}

/** Tag: al-tabs

Props
- variant — Tabs variant
  - default: Tabs are left-aligned, and the width of each tab is defined by the length of its content
  - stretch: Tabs stretch horizontally to have equal widths, which is calculated by the width of the screen divided by the number of tabs

Slots
- (default) — The tab items for the tabs
- panel — The tab panels that correspond to the slotted tab items

Accessibility
- element: <div>
- key ArrowRight: Activates the next tab.
- key ArrowLeft: Activates the previous tab.
- key Home: Activates the first tab.
- key End: Activates the last tab.
- focus: Roving focus across the tab list: the arrow keys move focus and activation together, so the list is a single tab stop and the panel is the next one.

Docs: https://altitude.pages.dev/docs/components/tabs/
 * @see https://altitude.pages.dev/docs/components/tabs/ */
export const Tabs = forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  { variant = 'default', items, className, ...rest },
  ref,
) {
  // axis-inert (ledgered, not a throw): variant — no `.<axis>-*` rule
  // exists in Tabs.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles.alCTabsHeader}>
        <div className={styles.alCTabsList}>
          {items?.map((item, index) => (
            <Tab key={index} state="default" text={item.text} />
          ))}
        </div>
      </div>
      <div className={styles.alCTabsBody}>
        <TabPanel state="default" />
      </div>
    </div>
  );
});
