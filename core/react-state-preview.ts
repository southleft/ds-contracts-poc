/**
 * docs/23 §D.164 — code-side state previews on the React CSS Modules surface.
 *
 * A designer who draws a wrapper's `state=hover` draws its nested child's
 * Hover cell. The child runs hover as a pseudo-class, which no caller can set,
 * so a child that opts in (`bindings.code.statePreviews`) takes a
 * `statePreview` input rendered as `data-state-preview`, and every state rule
 * in its module sheet matches either the pseudo-class or the attribute at the
 * same specificity (packages/core/src/anatomy.ts stateSelectorsFor). A parent
 * selects the drawing through `component.statePreview`. Contracts without
 * either field are byte-identical.
 */
import { CODE_STATE_PREVIEWS, type ComponentRef, type Contract } from '../scripts/contract-schema.js';
import { STATE_PREVIEW_ATTRIBUTE } from '../packages/core/src/anatomy.js';
import { componentLookupExpression } from './code-values.js';

/** The code prop a previewing component accepts (reserved by validation). */
export const STATE_PREVIEW_CODE_PROP = 'statePreview';

export const codeStatePreviews = (contract: Contract): string[] =>
  contract.bindings?.code?.statePreviews === true
    ? contract.states.filter((state) => (CODE_STATE_PREVIEWS as readonly string[]).includes(state))
    : [];

/** The child side: its props-interface line, destructure entry and root
 *  attribute — or nothing when the contract has not opted in. */
export function reactStatePreviewInput(contract: Contract): { propLine: string; destructured: string; attribute: string } | null {
  const states = codeStatePreviews(contract);
  if (states.length === 0) return null;
  return {
    propLine:
      `  /** Shows one drawn interaction state without the pointer or keyboard, as a\n` +
      `   *  composing parent's design selects it (docs/23 §D.164). The live states still run. */\n` +
      `  ${STATE_PREVIEW_CODE_PROP}?: ${states.map((state) => `'${state}'`).join(' | ')};`,
    destructured: STATE_PREVIEW_CODE_PROP,
    attribute: `${STATE_PREVIEW_ATTRIBUTE}={${STATE_PREVIEW_CODE_PROP}}`,
  };
}

/** The parent side: the JSX attribute that forwards `component.statePreview`
 *  (a literal, or a lookup of one parent enum prop whose unmapped values force
 *  nothing). */
export function reactStatePreviewAttribute(parent: Contract, ref: ComponentRef): string {
  const preview = ref.statePreview;
  if (preview === undefined) return '';
  if (typeof preview === 'string') return ` ${STATE_PREVIEW_CODE_PROP}=${JSON.stringify(preview)}`;
  const parentProp = parent.props.find((p) => p.name === preview.prop);
  return ` ${STATE_PREVIEW_CODE_PROP}={${componentLookupExpression(undefined, parentProp?.bindings.code.prop ?? preview.prop, preview.map)}}`;
}
