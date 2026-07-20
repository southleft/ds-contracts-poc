/**
 * Switch — vanilla Custom Element <ds-switch> emitted from contract
 * ds.switch v2.0.0 by @ds-contracts/emitter-web-components. Do not edit.
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
import sheet from './ds-switch.css.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class SwitchElement extends HTMLElement {
  static observedAttributes = ["value","label","description"];
  /** The contract's root is input-like (or hosts a native checkable
   *  control) — the element participates in forms. */
  static formAssociated = true;
  #internals: ElementInternals = this.attachInternals();

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    shadow.adoptedStyleSheets = [sheet];
  }

  /** On or off — drives the track color and thumb position. */
  get value(): 'off' | 'on' {
    return (this.getAttribute('value') as 'off' | 'on' | null) ?? 'off';
  }
  set value(v: 'off' | 'on' | null) {
    if (v == null) this.removeAttribute('value');
    else this.setAttribute('value', v);
  }
  /** Always rendered — users must know what they are toggling. */
  get label(): string | null {
    return this.getAttribute('label') ?? "Enable notifications";
  }
  set label(v: string | null) {
    if (v == null) this.removeAttribute('label');
    else this.setAttribute('label', v);
  }
  /** Secondary text below the label. */
  get description(): string | null {
    return this.getAttribute('description') ?? "Takes effect immediately.";
  }
  set description(v: string | null) {
    if (v == null) this.removeAttribute('description');
    else this.setAttribute('description', v);
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue !== newValue) this.#render();
  }

  #view(): string {
    const p = {
      value: this.value,
      label: this.label,
      description: this.description,
    };
    return `<label part="root" data-value="${__esc(String(p.value))}"><span part="track"><input part="input" type="checkbox" role="switch"${p.value === "on" ? ' checked' : ''}>${(p.value ?? '') === "on" ? `<div part="spacerStart"></div>` : ''}<span part="thumb"></span>${(p.value ?? '') === "off" ? `<div part="spacerEnd"></div>` : ''}</span><div part="textCol"><span part="labelText">${__esc(String(p.label ?? "Enable notifications"))}</span><span part="descriptionText">${__esc(String(p.description ?? "Takes effect immediately."))}</span></div></label>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    const __t0 = sr.querySelector("[part='input']");
    if (__t0) __t0.addEventListener('change', () => {
      // Uncontrolled toggle (contract event "toggle"): flips "value" between "off"/"on"; any out-of-pair value flips to "on".
      const next = this.value === "on" ? "off" : "on";
      this.setAttribute('value', next);
      this.#internals.setFormValue(next);
      this.dispatchEvent(new CustomEvent('toggle', { bubbles: true, composed: true, detail: { value: next } }));
    });
    const __chk_input = sr.querySelector<HTMLInputElement>("[part='input']");
    if (__chk_input) {
      const v = this.value;
      __chk_input.indeterminate = v != null && v !== "off" && v !== "on";
    }
  }
}

/** Register <ds-switch> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('ds-switch')) customElements.define('ds-switch', SwitchElement);
}
define();

export default SwitchElement;
