/**
 * Avatar — vanilla Custom Element <antd-avatar> emitted from contract
 * antd.avatar v0.2.0 by @ds-contracts/emitter-web-components. Do not edit.
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
import sheet from './antd-avatar.css.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class AvatarElement extends HTMLElement {
  static observedAttributes = ["size","shape"];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sheet];
  }

  /** Enum prop "size". */
  get size(): 'small' | 'default' | 'large' {
    return (this.getAttribute('size') as 'small' | 'default' | 'large' | null) ?? 'default';
  }
  set size(v: 'small' | 'default' | 'large' | null) {
    if (v == null) this.removeAttribute('size');
    else this.setAttribute('size', v);
  }
  /** Enum prop "shape". */
  get shape(): 'circle' | 'square' {
    return (this.getAttribute('shape') as 'circle' | 'square' | null) ?? 'circle';
  }
  set shape(v: 'circle' | 'square' | null) {
    if (v == null) this.removeAttribute('shape');
    else this.setAttribute('shape', v);
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
      shape: this.shape,
    };
    return `<span part="root" data-size="${__esc(String(p.size))}" data-shape="${__esc(String(p.shape))}"><span part="label"><slot>A</slot></span></span>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    void sr;
  }
}

/** Register <antd-avatar> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('antd-avatar')) customElements.define('antd-avatar', AvatarElement);
}
define();

export default AvatarElement;
