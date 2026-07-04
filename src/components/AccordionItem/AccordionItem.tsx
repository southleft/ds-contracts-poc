/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/accordion-item.contract.json (ds.accordion-item v1.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef, useState } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './AccordionItem.module.css';

const ICONS: Record<string, string> = {
  closed:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="7.8,5.5 12.3,10 7.8,14.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  open: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="5.5,7.8 10,12.3 14.5,7.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export interface AccordionItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Closed shows only the trigger; open reveals the content and rotates the chevron. */
  state?: 'closed' | 'open';
  /** The always-visible trigger text. */
  title: string;
  /** Fires when the trigger is activated; uncontrolled instances flip state closed/open themselves. */
  onToggle?: () => void;
}

/** A collapsible content row: trigger with a state chevron, content revealed when open. API mirrors industry convention (Astryx Collapsible) with the open state flattened to a closed/open enum so both surfaces render both states; the toggle itself is contract-declared (onToggle + aria-expanded, generated); richer behavior stays a declared boundary. */
export const AccordionItem = forwardRef<HTMLDivElement, AccordionItemProps>(function AccordionItem(
  { state: stateProp, title, onToggle, className, children, ...rest },
  ref,
) {
  const [stateUncontrolled, setStateUncontrolled] = useState<'closed' | 'open'>('closed');
  const state = stateProp ?? stateUncontrolled;
  const handleToggle = () => {
    setStateUncontrolled(state === 'open' ? 'closed' : 'open');
    onToggle?.();
  };
  const classes = [styles.root, styles[`state-${state}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <button
        className={styles.trigger}
        type="button"
        onClick={handleToggle}
        aria-expanded={state === 'open'}
      >
        <span
          className={styles.chevron}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: ICONS[state] }}
        />
        <span className={styles.titleText}>{title}</span>
      </button>
      {state === 'open' ? <div className={styles.contentArea}>{children}</div> : null}
    </div>
  );
});
