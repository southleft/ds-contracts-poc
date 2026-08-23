/**
 * Input — vanilla Custom Element <antd-input> emitted from contract
 * antd.input v0.2.0 by @ds-contracts/emitter-web-components. Do not edit.
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
import sheet from './antd-input.css.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class InputElement extends HTMLElement {
  static observedAttributes = ["size","status","variant","disabled","placeholder"];
  /** The contract's root is input-like (or hosts a native checkable
   *  control) — the element participates in forms. */
  static formAssociated = true;
  #internals: ElementInternals = this.attachInternals();

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    shadow.adoptedStyleSheets = [sheet];
  }

  /** Enum prop "size". */
  get size(): 'small' | 'middle' | 'large' {
    return (this.getAttribute('size') as 'small' | 'middle' | 'large' | null) ?? 'middle';
  }
  set size(v: 'small' | 'middle' | 'large' | null) {
    if (v == null) this.removeAttribute('size');
    else this.setAttribute('size', v);
  }
  /** Enum prop "status". */
  get status(): 'error' | 'warning' | null {
    return this.getAttribute('status') as 'error' | 'warning' | null;
  }
  set status(v: 'error' | 'warning' | null) {
    if (v == null) this.removeAttribute('status');
    else this.setAttribute('status', v);
  }
  /** Enum prop "variant". */
  get variant(): 'outlined' | 'borderless' | 'filled' | 'underlined' {
    return (this.getAttribute('variant') as 'outlined' | 'borderless' | 'filled' | 'underlined' | null) ?? 'outlined';
  }
  set variant(v: 'outlined' | 'borderless' | 'filled' | 'underlined' | null) {
    if (v == null) this.removeAttribute('variant');
    else this.setAttribute('variant', v);
  }
  /** Boolean prop "disabled". */
  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(v: boolean) {
    this.toggleAttribute('disabled', v);
  }
  /** Text prop "placeholder". */
  get placeholder(): string | null {
    return this.getAttribute('placeholder') ?? "Input";
  }
  set placeholder(v: string | null) {
    if (v == null) this.removeAttribute('placeholder');
    else this.setAttribute('placeholder', v);
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
      status: this.status,
      variant: this.variant,
      disabled: this.disabled,
      placeholder: this.placeholder,
    };
    return `<input part="root" data-size="${__esc(String(p.size))}"${p.status == null ? '' : ` data-status="${__esc(String(p.status))}"`} data-variant="${__esc(String(p.variant))}"${p.disabled ? ' disabled' : ''}><slot>Input</slot></input>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    void sr;
  }
}

/** Register <antd-input> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('antd-input')) customElements.define('antd-input', InputElement);
}
define();

export default InputElement;
