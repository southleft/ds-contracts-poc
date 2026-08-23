/**
 * Switch — vanilla Custom Element <antd-switch> emitted from contract
 * antd.switch v0.2.0 by @ds-contracts/emitter-web-components. Do not edit.
 *
 * Token values arrive via CSS custom properties (custom properties inherit
 * through the shadow boundary) — include the token stylesheet on the page
 * or nothing resolves.
 *
 * Named no-ops on this contract (canvas-only concepts, deliberately not
 * re-created here):
 *   · bindings.figma.statePreviews (canvas State-preview axis — CSS pseudo-classes render these states live here)
 *   · bindings.figma / bindings.figma.anchors / slot.bindings.figma.property (design-side identity, no DOM manifestation)
 */
import sheet from './antd-switch.css.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class SwitchElement extends HTMLElement {
  static observedAttributes = ["size","checked","disabled"];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
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
  /** Enum prop "checked". */
  get checked(): 'unchecked' | 'checked' {
    return (this.getAttribute('checked') as 'unchecked' | 'checked' | null) ?? 'unchecked';
  }
  set checked(v: 'unchecked' | 'checked' | null) {
    if (v == null) this.removeAttribute('checked');
    else this.setAttribute('checked', v);
  }
  /** Boolean prop "disabled". */
  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(v: boolean) {
    this.toggleAttribute('disabled', v);
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
      checked: this.checked,
      disabled: this.disabled,
    };
    return `<button part="root" data-size="${__esc(String(p.size))}" data-checked="${__esc(String(p.checked))}"${p.disabled ? ' disabled' : ''}><div part="switch-handle"><div part="switch-handle-before"></div></div><span part="switch-inner"><span part="switch-inner-checked"></span><span part="switch-inner-unchecked"></span></span></button>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    void sr;
  }
}

/** Register <antd-switch> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('antd-switch')) customElements.define('antd-switch', SwitchElement);
}
define();

export default SwitchElement;
