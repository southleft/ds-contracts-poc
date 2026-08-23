/**
 * Prop-name collisions with the platform — ONE rule for the React,
 * React-inline and Web-Components emitters.
 *
 * A contract prop named `content`, `title`, `hidden`, `color`… collides
 * with a DOM attribute React already types on the root element
 * (`HTMLAttributes.content?: string`), so `interface CardProps extends
 * HTMLAttributes<HTMLDivElement> { content?: ReactNode }` does not compile
 * (TS2430, the phase-2 exam's Card). The rule a library author applies:
 *
 *   THE CONTRACT'S PROP WINS. The base attribute type OMITS every DOM
 *   attribute whose name the contract's API (props, slots, events) claims —
 *   `extends Omit<HTMLAttributes<HTMLDivElement>, 'content' | 'title'>` —
 *   and the emitted header names each omitted attribute. A consumer can no
 *   longer pass the HTML attribute of that name through `...rest`; the
 *   component's own prop is the only channel.
 *
 *   Exempt — names the emitter forwards to the DOM attribute of the same
 *   name with the platform's own meaning, so omitting them would only
 *   re-declare what they already are:
 *     · `children` — the JSX content channel (DOMAttributes.children is the
 *       same ReactNode; a text prop bound to `children` is never redeclared);
 *     · `disabled` — when the root element supports it natively and the
 *       emitter renders `disabled={disabled}`;
 *     · a prop the contract binds to its own root attribute
 *       (`anatomy.root.attrs.href = "{href}"` → `href={href}`).
 *
 * The collision set is COMPUTED, not hand-listed: packages/core/src/prop-collision.table.ts
 * is extracted from @types/react (HTMLAttributes ∪ AriaAttributes ∪
 * DOMAttributes, plus each `<Tag>HTMLAttributes` extension) and from
 * typescript's lib.dom.d.ts (HTMLElement's instance members, for the
 * Web-Components mirror) by `npx tsx core/prop-collision-check.ts --update (root repo)`;
 * the same check refuses when the table drifts from the installed types.
 *
 * Web-Components mirror: a custom element class that declares `get title()`
 * SHADOWS HTMLElement.title (and fails to compile when the types differ —
 * `string | null` vs `string`). For a prop whose name is an HTMLElement
 * member the emitter generates NO accessor: the attribute is still observed
 * and rendered from, the platform property keeps its own reflection, and
 * the header names it — including what the platform does with that
 * attribute (`title` is the tooltip, `hidden` hides the host).
 */
import { slotsOf, type Contract } from '@ds-contracts/schema';
import {
  HTML_ELEMENT_MEMBERS,
  REACT_ELEMENT_ATTRIBUTES,
  REACT_HTML_ATTRIBUTES,
} from './prop-collision.table.js';

export interface ElementMeta {
  attrs: string;
  el: string;
  supportsDisabled: boolean;
}

/** Every name the contract's code API claims on the component: prop code
 *  names, slot names, event code names — declaration order, deduped. */
export function contractApiNames(contract: Contract): string[] {
  const names: string[] = [];
  for (const p of contract.props) names.push(p.bindings.code.prop);
  for (const { slot } of slotsOf(contract)) names.push(slot.name);
  for (const ev of contract.events ?? []) names.push(ev.bindings.code.prop);
  return [...new Set(names)];
}

/** Names the emitter forwards to the root DOM attribute of the SAME name
 *  with the platform's meaning — never omitted (see the module header). */
function forwardedAsSelf(contract: Contract, meta: ElementMeta): Set<string> {
  const out = new Set<string>(['children']);
  if (meta.supportsDisabled && contract.props.some((p) => p.name === 'disabled' && p.type === 'boolean')) {
    out.add('disabled');
  }
  const rootAttrs = contract.anatomy.root?.attrs ?? {};
  for (const p of contract.props) {
    const code = p.bindings.code.prop;
    if (rootAttrs[code] === `{${p.name}}`) out.add(code);
  }
  return out;
}

/** DOM attribute names (React's typing of the root element) the contract's
 *  API collides with — sorted, exemptions removed. */
export function reactDomCollisions(contract: Contract, meta: ElementMeta): string[] {
  const dom = new Set<string>([...REACT_HTML_ATTRIBUTES, ...(REACT_ELEMENT_ATTRIBUTES[meta.attrs] ?? [])]);
  const exempt = forwardedAsSelf(contract, meta);
  return contractApiNames(contract)
    .filter((n) => dom.has(n) && !exempt.has(n))
    .sort();
}

/** The `extends` clause for the emitted Props interface, plus the omitted
 *  names for the header. Byte-identical to the historical spelling when
 *  nothing collides. */
export function reactPropsBase(contract: Contract, meta: ElementMeta): { base: string; omitted: string[] } {
  const omitted = reactDomCollisions(contract, meta);
  const plain = `${meta.attrs}<${meta.el}>`;
  return {
    base: omitted.length === 0 ? plain : `Omit<${plain}, ${omitted.map((n) => `'${n}'`).join(' | ')}>`,
    omitted,
  };
}

/** Header lines naming the omission (empty string when nothing collides;
 *  each line is prefixed ` * ` and starts on its own line). */
export function reactOmittedNote(omitted: string[], meta: ElementMeta): string {
  if (omitted.length === 0) return '';
  return (
    `\n *\n * DOM attrs OMITTED from ${meta.attrs}<${meta.el}> — the contract's own props claim these` +
    `\n * names, so the HTML attribute of the same name cannot be passed through ...rest:` +
    `\n *   ${omitted.join(', ')}`
  );
}

/** Web-Components mirror: contract props (attribute-manifesting, by prop
 *  name — the accessor's name) that are instance members of HTMLElement. */
export function wcHostCollisions(contract: Contract): string[] {
  return [...new Set(contract.props.map((p) => p.name))].filter((n) => HTML_ELEMENT_MEMBERS.has(n)).sort();
}

/** What the platform does with the attribute of that name on the host —
 *  named in the emitted header so the consequence is never silent. */
export function wcHostAttributeEffect(name: string): string {
  switch (name) {
    case 'title':
      return 'the browser shows it as the tooltip';
    case 'hidden':
      return 'the UA stylesheet hides the host (display: none) while it is set';
    case 'id':
      return 'it is the element id (must be unique in the document)';
    case 'lang':
    case 'dir':
    case 'translate':
      return 'the platform applies it to the host and its light DOM';
    case 'slot':
      return 'it assigns the host to a named slot of ITS parent';
    case 'draggable':
    case 'contentEditable':
    case 'inert':
    case 'tabIndex':
    case 'accessKey':
    case 'role':
    case 'autofocus':
    case 'spellcheck':
    case 'popover':
      return 'the platform applies its native behaviour to the host';
    default:
      return 'it is a platform property, not attribute-reflecting — set the attribute';
  }
}
