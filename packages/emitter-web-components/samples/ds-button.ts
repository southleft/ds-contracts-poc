/**
 * Button — vanilla Custom Element <ds-button> emitted from contract
 * ds.button v1.5.0 by @ds-contracts/emitter-web-components. Do not edit.
 *
 * Token values arrive via CSS custom properties (custom properties inherit
 * through the shadow boundary) — include the token stylesheet on the page
 * or nothing resolves.
 *
 * Named no-ops on this contract (canvas-only concepts, deliberately not
 * re-created here):
 *   · figmaStatePreviews (canvas State-preview axis — CSS pseudo-classes render these states live here)
 *   · a11y.contrast AA (a review gate, not a rendering fact — no emitter renders it)
 *   · bindings.figma / anchors.figma / slot.figmaProperty (design-side identity, no DOM manifestation)
 */
import sheet from './ds-button.css.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ICONS: Record<string, string> = {
  "spinner": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M 10 2.5 A 7.5 7.5 0 0 1 17.5 10\" stroke-linecap=\"round\"/></svg>",
};

export class ButtonElement extends HTMLElement {
  static observedAttributes = ["variant","size","disabled","loading"];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    shadow.adoptedStyleSheets = [sheet];
  }

  /** Visual prominence of the action. */
  get variant(): 'primary' | 'secondary' | 'danger' | 'ghost' {
    return (this.getAttribute('variant') as 'primary' | 'secondary' | 'danger' | 'ghost' | null) ?? 'primary';
  }
  set variant(v: 'primary' | 'secondary' | 'danger' | 'ghost' | null) {
    if (v == null) this.removeAttribute('variant');
    else this.setAttribute('variant', v);
  }
  /** Control density. */
  get size(): 'sm' | 'md' | 'lg' {
    return (this.getAttribute('size') as 'sm' | 'md' | 'lg' | null) ?? 'md';
  }
  set size(v: 'sm' | 'md' | 'lg' | null) {
    if (v == null) this.removeAttribute('size');
    else this.setAttribute('size', v);
  }
  /** Prevents interaction and communicates unavailability. */
  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(v: boolean) {
    this.toggleAttribute('disabled', v);
  }
  /** Shows a spinning busy indicator beside the label while an async action resolves. */
  get loading(): boolean {
    return this.hasAttribute('loading');
  }
  set loading(v: boolean) {
    this.toggleAttribute('loading', v);
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
      size: this.size,
      disabled: this.disabled,
      loading: this.loading,
    };
    return `<button part="root" data-variant="${__esc(String(p.variant))}" data-size="${__esc(String(p.size))}"${p.disabled ? ' disabled' : ''}${p.loading ? ' data-loading=""' : ''}>${p.loading === true ? `<span part="loadingSpinner" aria-hidden="true">${ICONS["spinner"] ?? ''}</span>` : ''}<span part="label"><slot>Button</slot></span></button>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    void sr;
  }
}

/** Register <ds-button> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('ds-button')) customElements.define('ds-button', ButtonElement);
}
define();

export default ButtonElement;
