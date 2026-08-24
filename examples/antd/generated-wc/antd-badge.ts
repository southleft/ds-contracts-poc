/**
 * Badge — vanilla Custom Element <antd-badge> emitted from contract
 * antd.badge v0.2.0 by @ds-contracts/emitter-web-components. Do not edit.
 *
 * Token values arrive via CSS custom properties (custom properties inherit
 * through the shadow boundary) — include the token stylesheet on the page
 * or nothing resolves.
 *
 * Named no-ops on this contract (canvas-only concepts, deliberately not
 * re-created here):
 *   · bindings.figma / bindings.figma.anchors / slot.bindings.figma.property (design-side identity, no DOM manifestation)
 */
import sheet from './antd-badge.css.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class BadgeElement extends HTMLElement {
  static observedAttributes = ["mode","color"];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sheet];
  }

  /** Enum prop "mode". */
  get mode(): 'count' | 'dot' {
    return (this.getAttribute('mode') as 'count' | 'dot' | null) ?? 'count';
  }
  set mode(v: 'count' | 'dot' | null) {
    if (v == null) this.removeAttribute('mode');
    else this.setAttribute('mode', v);
  }
  /** Enum prop "color". */
  get color(): 'blue' | 'green' | 'purple' | null {
    return this.getAttribute('color') as 'blue' | 'green' | 'purple' | null;
  }
  set color(v: 'blue' | 'green' | 'purple' | null) {
    if (v == null) this.removeAttribute('color');
    else this.setAttribute('color', v);
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue !== newValue) this.#render();
  }

  #view(): string {
    const p = {
      mode: this.mode,
      color: this.color,
    };
    return `<span part="root" data-mode="${__esc(String(p.mode))}"${p.color == null ? '' : ` data-color="${__esc(String(p.color))}"`}><span part="avatar"><span part="label">A</span></span><sup part="badge-dot"></sup><sup part="badge-count"><bdi part="part-1-0"><span part="scroll-number-only"><span part="label-2">5</span></span></bdi></sup></span>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    void sr;
  }
}

/** Register <antd-badge> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('antd-badge')) customElements.define('antd-badge', BadgeElement);
}
define();

export default BadgeElement;
