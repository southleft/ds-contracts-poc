/**
 * Badge — vanilla Custom Element <ds-badge> emitted from contract
 * ds.badge v1.1.0 by @ds-contracts/emitter-web-components. Do not edit.
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
import sheet from './ds-badge.css.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class BadgeElement extends HTMLElement {
  static observedAttributes = ["variant"];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sheet];
  }

  /** The feedback tone being communicated. */
  get variant(): 'info' | 'success' | 'warning' | 'danger' | 'error' {
    return (this.getAttribute('variant') as 'info' | 'success' | 'warning' | 'danger' | 'error' | null) ?? 'info';
  }
  set variant(v: 'info' | 'success' | 'warning' | 'danger' | 'error' | null) {
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
      variant: this.variant,
    };
    return `<span part="root" data-variant="${__esc(String(p.variant))}" role="status"><slot>Badge</slot></span>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    void sr;
  }
}

/** Register <ds-badge> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('ds-badge')) customElements.define('ds-badge', BadgeElement);
}
define();

export default BadgeElement;
