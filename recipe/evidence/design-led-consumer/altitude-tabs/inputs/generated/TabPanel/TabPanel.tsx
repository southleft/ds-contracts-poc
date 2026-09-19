/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tab-panel.contract.json (ds.tab-panel v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLDivElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { TextPassage } from '../TextPassage';
import { Button } from '../Button';
import styles from './TabPanel.module.css';

export interface TabPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {}

/** Tag: al-tab-panel

Slots
- (default) — The tab panel content

Accessibility
- element: <div>

Docs: https://altitude.pages.dev/docs/components/tab-panel/
 * @see https://altitude.pages.dev/docs/components/tab-panel/ */
export const TabPanel = forwardRef<HTMLDivElement, TabPanelProps>(function TabPanel(
  { className, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <TextPassage state="default" width="default" />
      <TextPassage state="default" width="default" />
      <Button text="Button" variant="primary" size="md" shape="default" />
    </div>
  );
});
