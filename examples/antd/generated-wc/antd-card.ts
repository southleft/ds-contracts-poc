/**
 * Card — vanilla Custom Element <antd-card> emitted from contract
 * antd.card v0.2.0 by @ds-contracts/emitter-web-components. Do not edit.
 *
 * Token values arrive via CSS custom properties (custom properties inherit
 * through the shadow boundary) — include the token stylesheet on the page
 * or nothing resolves.
 *
 * Named no-ops on this contract (canvas-only concepts, deliberately not
 * re-created here):
 *   · bindings.figma / bindings.figma.anchors / slot.bindings.figma.property (design-side identity, no DOM manifestation)
 *
 * HTMLElement members the contract's props collide with — NO accessor is
 * generated (it would shadow the platform's own property); the attribute is
 * observed and rendered from, and the platform still applies it:
 *   · prop "children" is an HTMLElement member — it is a platform property, not attribute-reflecting — set the attribute
 *   · prop "title" is an HTMLElement member — the browser shows it as the tooltip
 */
import sheet from './antd-card.css.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class CardElement extends HTMLElement {
  static observedAttributes = ["size","variant","title"];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sheet];
  }

  /** Enum prop "size". */
  get size(): 'default' | 'small' {
    return (this.getAttribute('size') as 'default' | 'small' | null) ?? 'default';
  }
  set size(v: 'default' | 'small' | null) {
    if (v == null) this.removeAttribute('size');
    else this.setAttribute('size', v);
  }
  /** Enum prop "variant". */
  get variant(): 'outlined' | 'borderless' {
    return (this.getAttribute('variant') as 'outlined' | 'borderless' | null) ?? 'outlined';
  }
  set variant(v: 'outlined' | 'borderless' | null) {
    if (v == null) this.removeAttribute('variant');
    else this.setAttribute('variant', v);
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue !== newValue) this.#render();
  }

  #view(): string {
    const p = {
      size: this.size,
      variant: this.variant,
      title: this.getAttribute('title') ?? "Card title",
    };
    return `<div part="root" data-size="${__esc(String(p.size))}" data-variant="${__esc(String(p.variant))}"><div part="card-head"><div part="card-head-wrapper"><span part="label">${__esc(String(p.title ?? "Card title"))}</span></div></div><span part="label-2"><slot>Card body copy for the exam.</slot></span></div>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    void sr;
  }
}

/** Register <antd-card> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('antd-card')) customElements.define('antd-card', CardElement);
}
define();

export default CardElement;
