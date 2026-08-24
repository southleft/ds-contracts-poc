/**
 * Tooltip — vanilla Custom Element <antd-tooltip> emitted from contract
 * antd.tooltip v0.2.0 by @ds-contracts/emitter-web-components. Do not edit.
 *
 * Token values arrive via CSS custom properties (custom properties inherit
 * through the shadow boundary) — include the token stylesheet on the page
 * or nothing resolves.
 *
 * Named no-ops on this contract (canvas-only concepts, deliberately not
 * re-created here):
 *   · bindings.figma / bindings.figma.anchors / slot.bindings.figma.property (design-side identity, no DOM manifestation)
 */
import sheet from './antd-tooltip.css.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class TooltipElement extends HTMLElement {
  static observedAttributes = [];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sheet];
  }


  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue !== newValue) this.#render();
  }

  #view(): string {
    const p = {
    };
    void p;
    return `<div part="root"><div part="tooltip-arrow"><div part="tooltip-arrow-before"></div></div><div part="tooltip-content"><span part="label">Tooltip text</span></div></div>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    void sr;
  }
}

/** Register <antd-tooltip> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('antd-tooltip')) customElements.define('antd-tooltip', TooltipElement);
}
define();

export default TooltipElement;
