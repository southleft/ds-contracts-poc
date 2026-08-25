/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/text-field.contract.json (polaris.text-field v0.4.0)
 * Regenerate with: npm run generate
 *
 * DOM attrs OMITTED from HTMLAttributes<HTMLDivElement> — the contract's own props claim these
 * names, so the HTML attribute of the same name cannot be passed through ...rest:
 *   autoFocus, inputMode, onFocus, role, spellCheck
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './TextField.module.css';

export interface TextFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'autoFocus' | 'inputMode' | 'onFocus' | 'role' | 'spellCheck'> {
  /** Hint text to display */
  placeholder?: string;
  /** Initial value for the input */
  value?: string;
  /** Visually hide the label */
  labelHidden?: boolean;
  /** Disable the input */
  disabled?: boolean;
  /** Show a clear text button in the input */
  clearButton?: boolean;
  /** Indicates whether or not the entire value should be selected on focus. */
  selectTextOnFocus?: boolean;
  /** An inline autocomplete suggestion containing the input value. The characters that complete the input value are selected for ease of deletion on input change or keypress of Backspace/Delete. The selected substring is visually highlighted with subdued styling. */
  suggestion?: string;
  /** Disable editing of the input */
  readOnly?: boolean;
  /** Automatically focus the input */
  autoFocus?: boolean;
  /** Force the focus state on the input */
  focused?: boolean;
  /** Determine type of input */
  type?: 'text' | 'email' | 'number' | 'integer' | 'password' | 'search' | 'tel' | 'url' | 'date' | 'datetime-local' | 'month' | 'time' | 'week' | 'currency';
  /** Name of the input */
  name?: string;
  /** Defines a specific role attribute for the input */
  role?: string;
  /** Limit increment value for numeric and date-time inputs */
  step?: number;
  /** Increment value for numeric and date-time inputs when using Page Up or Page Down */
  largeStep?: number;
  /** Enable automatic completion by the browser. Set to "off" when you do not want the browser to fill in info */
  autoComplete: string;
  /** Maximum character length for an input */
  maxLength?: number;
  /** Minimum character length for an input */
  minLength?: number;
  /** A regular expression to check the value against */
  pattern?: string;
  /** Choose the keyboard that should be used on mobile devices */
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
  /** Indicate whether value should have spelling checked */
  spellCheck?: boolean;
  /** Indicates the id of a component owned by the input */
  ariaOwns?: string;
  /** Indicates whether or not a Popover is displayed */
  ariaExpanded?: boolean;
  /** Indicates the id of a component controlled by the input */
  ariaControls?: string;
  /** Indicates the id of a related component’s visually focused element to the input */
  ariaActiveDescendant?: string;
  /** Indicates what kind of user input completion suggestions are provided */
  ariaAutocomplete?: string;
  /** Indicates whether or not the character count should be displayed */
  showCharacterCount?: boolean;
  /** Determines the alignment of the text in the input */
  align?: 'left' | 'center' | 'right';
  /** Visual required indicator, adds an asterisk to label */
  requiredIndicator?: boolean;
  /** Indicates whether or not a monospaced font should be used */
  monospaced?: boolean;
  /** Visual styling options for the TextField */
  variant?: 'inherit' | 'borderless';
  /** Changes the size of the input, giving it more or less padding */
  size?: 'slim' | 'medium';
  /** Whether the TextField will grow as the text within the input changes */
  autoSize?: boolean;
  /** Indicates the loading state */
  loading?: boolean;
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `prefix` ("$"); the created subtree is carried as parts gated on this prop. */
  withPrefix?: boolean;
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `suffix` ("USD"); the created subtree is carried as parts gated on this prop. */
  withSuffix?: boolean;
  /** Callback fired when input is focused */
  onFocus?: () => void;
}

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/TextField/TextField.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/polaris/scripts/promote-floor.ts): resolved.contract.json — computed-capture truth; minted leaves source-aliased to Polaris's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const TextField = forwardRef<HTMLDivElement, TextFieldProps>(function TextField(
  { type = 'text', inputMode = 'undefined', align = 'undefined', variant = 'inherit', size = 'medium', labelHidden = false, disabled = false, clearButton = false, selectTextOnFocus = false, readOnly = false, autoFocus = false, focused = false, spellCheck = false, ariaExpanded = false, showCharacterCount = false, requiredIndicator = false, monospaced = false, autoSize = false, loading = false, withPrefix = false, withSuffix = false, step = 0, largeStep = 0, maxLength = 0, minLength = 0, placeholder, value = '', suggestion, name, role, autoComplete, pattern, ariaOwns, ariaControls, ariaActiveDescendant, ariaAutocomplete, onFocus, className, children, ...rest },
  ref,
) {
  const handleFocus = () => { onFocus?.(); };
  // axis-inert (ledgered, not a throw): type, inputMode, align — no `.<axis>-*` rule
  // exists in TextField.module.css, so no class is composed for them. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever these axes carry rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, styles[`variant-${variant}`], styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} data-label-hidden={labelHidden || undefined} data-disabled={disabled || undefined} data-clear-button={clearButton || undefined} data-select-text-on-focus={selectTextOnFocus || undefined} data-read-only={readOnly || undefined} data-auto-focus={autoFocus || undefined} data-focused={focused || undefined} data-spell-check={spellCheck || undefined} data-aria-expanded={ariaExpanded || undefined} data-show-character-count={showCharacterCount || undefined} data-required-indicator={requiredIndicator || undefined} data-monospaced={monospaced || undefined} data-auto-size={autoSize || undefined} data-loading={loading || undefined} data-with-prefix={withPrefix || undefined} data-with-suffix={withSuffix || undefined} onClick={handleFocus} {...rest}>
      <div className={styles.labelled__labelwrapper}>
<div className={styles.label}>
<label className={styles.label__text}>
<span className={styles["label-2"]}>Store name</span>
</label>
</div>
</div>
<div className={styles.connected}>
<div className={styles.connected__item}>
<div className={styles.textfield}>
{withPrefix ? (<div className={styles.prefix}>
{withPrefix ? (<span className={styles["label-3"]}>$</span>) : null}
</div>) : null}
<input className={styles.input} name={name} value={value} placeholder={placeholder}>

</input>
{withSuffix ? (<div className={styles.suffix}>
{withSuffix ? (<span className={styles["label-4"]}>USD</span>) : null}
</div>) : null}
<button className={styles["clearbutton-2"]}>

</button>
<div className={styles.backdrop}>

</div>
</div>
</div>
</div>
    </div>
  );
});
