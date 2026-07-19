/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/text-field.contract.json (polaris.text-field v0.3.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './TextField.module.css';

const ICONS: Record<string, string> = {
  "text-field-icon": "<svg viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 13.03 6.97 A 0.75 0.75 0 0 1 13.03 8.03 L 11.06 10 L 13.03 11.97 A 0.75 0.75 0 1 1 11.97 13.03 L 10 11.06 L 8.03 13.03 A 0.75 0.75 0 0 1 6.97 11.97 L 8.94 10 L 6.97 8.03 A 0.75 0.75 0 0 1 8.03 6.97 L 10 8.94 L 11.97 6.97 A 0.75 0.75 0 0 1 13.03 6.97 Z\"/><path d=\"M 10 17 A 7 7 0 1 0 10 3 A 7 7 0 0 0 10 17 Z M 10 15.5 A 5.5 5.5 0 1 0 10 4.5 A 5.5 5.5 0 0 0 10 15.5 Z\" fill-rule=\"evenodd\"/></svg>",
};

export interface TextFieldProps extends HTMLAttributes<HTMLDivElement> {
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

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/TextField/TextField.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.3.0 (extract/computed round 4): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), with the round-4 DOM-ANATOMY PROMOTION: every rendered element is a carried part, svg glyph content rides committed icon assets reconstructed from the captured d/fill channels, presence facts gate structure-creating props, contradictions resolved computed-wins per the decisions ledger (extract/computed/out/textfield/decisions.md, human-acked; source resolved.contract.json). Everything the vocabulary cannot carry is named in contracts/text-field.extension.json. Delta ledger: extract/computed/out/textfield/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md). */
export const TextField = forwardRef<HTMLDivElement, TextFieldProps>(function TextField(
  { type = 'text', inputMode = 'undefined', align = 'undefined', variant = 'inherit', size = 'medium', labelHidden = false, disabled = false, clearButton = false, selectTextOnFocus = false, readOnly = false, autoFocus = false, focused = false, spellCheck = false, ariaExpanded = false, showCharacterCount = false, requiredIndicator = false, monospaced = false, autoSize = false, loading = false, withPrefix = false, withSuffix = false, step = 0, largeStep = 0, maxLength = 0, minLength = 0, placeholder, value = '', suggestion, name, role, autoComplete, pattern, ariaOwns, ariaControls, ariaActiveDescendant, ariaAutocomplete, onFocus, className, children, ...rest },
  ref,
) {
  const handleFocus = () => { onFocus?.(); };
  const classes = [styles.root, styles[`type-${type}`], styles[`inputMode-${inputMode}`], styles[`align-${align}`], styles[`variant-${variant}`], styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} data-label-hidden={labelHidden || undefined} data-disabled={disabled || undefined} data-clear-button={clearButton || undefined} data-select-text-on-focus={selectTextOnFocus || undefined} data-read-only={readOnly || undefined} data-auto-focus={autoFocus || undefined} data-focused={focused || undefined} data-spell-check={spellCheck || undefined} data-aria-expanded={ariaExpanded || undefined} data-show-character-count={showCharacterCount || undefined} data-required-indicator={requiredIndicator || undefined} data-monospaced={monospaced || undefined} data-auto-size={autoSize || undefined} data-loading={loading || undefined} data-with-prefix={withPrefix || undefined} data-with-suffix={withSuffix || undefined} onClick={handleFocus} {...rest}>
      <div className={styles.labelled__labelwrapper}>
<div className={styles.label}>
<label className={styles.label__text}>
<span className={styles.label-2}>Store name</span>
</label>
</div>
</div>
<div className={styles.connected}>
<div className={styles.connected__item}>
<div className={styles.textfield}>
{withPrefix ? (<div className={styles.prefix}>
{withPrefix ? (<span className={styles.label-3}>$</span>) : null}
</div>) : null}
<input className={styles.input} name={String(name)} value={String(value)} placeholder={String(placeholder)}>

</input>
{withSuffix ? (<div className={styles.suffix}>
{withSuffix ? (<span className={styles.label-4}>USD</span>) : null}
</div>) : null}
{clearButton ? (<button className={styles.clearbutton}>
<span className={styles.label-5}>Clear</span>
{clearButton ? (<span className={styles.icon}><span aria-hidden="true" className={styles.iconGlyph} dangerouslySetInnerHTML={{ __html: ICONS["text-field-icon"] }} /></span>) : null}
</button>) : null}
<div className={styles.backdrop}>

</div>
</div>
</div>
</div>
    </div>
  );
});
