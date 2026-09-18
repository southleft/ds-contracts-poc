/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tabs.contract.json (ds.tabs v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { Tab } from '../Tab';
import { TabPanel } from '../TabPanel';
import styles from './Tabs.module.css';

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
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
  { variant = 'default', items, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
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
