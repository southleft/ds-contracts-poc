/**
 * Radio — vanilla Custom Element <antd-radio> emitted from contract
 * antd.radio v0.2.0 by @ds-contracts/emitter-web-components. Do not edit.
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
 */
import sheet from './antd-radio.css.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class RadioElement extends HTMLElement {
  static observedAttributes = ["checked","disabled"];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    shadow.adoptedStyleSheets = [sheet];
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
      checked: this.checked,
      disabled: this.disabled,
    };
    return `<label part="root" data-checked="${__esc(String(p.checked))}"${p.disabled ? ' data-disabled=""' : ''}><span part="radio"><input part="radio-input"></input><span part="radio-inner"></span></span><span part="label"><slot>Radio</slot></span></label>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    void sr;
  }
}

/** Register <antd-radio> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('antd-radio')) customElements.define('antd-radio', RadioElement);
}
define();

export default RadioElement;
