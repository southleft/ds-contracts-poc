/**
 * Card — vanilla Custom Element <ds-card> emitted from contract
 * ds.card v1.1.0 by @ds-contracts/emitter-web-components. Do not edit.
 *
 * Token values arrive via CSS custom properties (custom properties inherit
 * through the shadow boundary) — include the token stylesheet on the page
 * or nothing resolves.
 *
 * Named no-ops on this contract (canvas-only concepts, deliberately not
 * re-created here):
 *   · a11y.contrast AA (a review gate, not a rendering fact — no emitter renders it)
 *   · bindings.figma / anchors.figma / slot.figmaProperty (design-side identity, no DOM manifestation)
 */
import sheet from './ds-card.css.js';
import './ds-avatar.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class CardElement extends HTMLElement {
  static observedAttributes = ["title"];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sheet];
  }

  /** Card heading, bound to the header title part on both surfaces. */
  get title(): string | null {
    return this.getAttribute('title') ?? "Card title";
  }
  set title(v: string | null) {
    if (v == null) this.removeAttribute('title');
    else this.setAttribute('title', v);
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue !== newValue) this.#render();
  }

  #view(): string {
    const p = {
      title: this.title,
    };
    return `<article part="root"><header part="header"><ds-avatar part="avatar" size="sm"></ds-avatar><span part="title">${__esc(String(p.title ?? "Card title"))}</span></header><div part="body"><slot></slot></div><footer part="footer"><slot name="actions"></slot></footer></article>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    void sr;
  }
}

/** Register <ds-card> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('ds-card')) customElements.define('ds-card', CardElement);
}
define();

export default CardElement;
