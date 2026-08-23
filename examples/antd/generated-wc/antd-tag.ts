/**
 * Tag — vanilla Custom Element <antd-tag> emitted from contract
 * antd.tag v0.2.0 by @ds-contracts/emitter-web-components. Do not edit.
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
import sheet from './antd-tag.css.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ICONS: Record<string, string> = {
  "tag-anticon": "<svg viewBox=\"0 0 858 858\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 799.86 166.31 C 799.88 166.31 799.9 166.33 799.94 166.37 L 857.63 224.07 C 857.67 224.1 857.68 224.12 857.69 224.15 A 0.12 0.12 0 0 1 857.69 224.21 C 857.69 224.24 857.67 224.26 857.63 224.3 L 569.93 512 L 857.63 799.7 C 857.67 799.74 857.68 799.76 857.69 799.79 A 0.12 0.12 0 0 1 857.69 799.86 C 857.69 799.88 857.67 799.9 857.63 799.94 L 799.93 857.63 C 799.9 857.67 799.88 857.68 799.86 857.69 A 0.12 0.12 0 0 1 799.79 857.69 C 799.76 857.69 799.74 857.67 799.7 857.63 L 512 569.93 L 224.3 857.63 C 224.26 857.67 224.24 857.68 224.21 857.69 A 0.12 0.12 0 0 1 224.14 857.69 C 224.12 857.69 224.1 857.67 224.06 857.63 L 166.37 799.93 C 166.33 799.9 166.32 799.88 166.31 799.86 A 0.12 0.12 0 0 1 166.31 799.79 C 166.31 799.76 166.33 799.74 166.37 799.7 L 454.07 512 L 166.37 224.3 C 166.33 224.26 166.32 224.24 166.31 224.21 A 0.12 0.12 0 0 1 166.31 224.14 C 166.31 224.12 166.33 224.1 166.37 224.06 L 224.07 166.37 C 224.1 166.33 224.12 166.32 224.14 166.31 A 0.12 0.12 0 0 1 224.21 166.31 C 224.24 166.31 224.26 166.33 224.3 166.37 L 512 454.07 L 799.7 166.37 C 799.74 166.33 799.76 166.32 799.79 166.31 A 0.12 0.12 0 0 1 799.86 166.31 Z\" fill=\"currentColor\" fill-rule=\"evenodd\"/></svg>",
};

export class TagElement extends HTMLElement {
  static observedAttributes = ["color","bordered","closable"];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sheet];
  }

  /** Enum prop "color". */
  get color(): 'blue' | 'green' | 'red' | 'gold' | 'success' | 'processing' | 'error' | null {
    return this.getAttribute('color') as 'blue' | 'green' | 'red' | 'gold' | 'success' | 'processing' | 'error' | null;
  }
  set color(v: 'blue' | 'green' | 'red' | 'gold' | 'success' | 'processing' | 'error' | null) {
    if (v == null) this.removeAttribute('color');
    else this.setAttribute('color', v);
  }
  /** Enum prop "bordered". */
  get bordered(): 'bordered' | 'borderless' {
    return (this.getAttribute('bordered') as 'bordered' | 'borderless' | null) ?? 'bordered';
  }
  set bordered(v: 'bordered' | 'borderless' | null) {
    if (v == null) this.removeAttribute('bordered');
    else this.setAttribute('bordered', v);
  }
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `closable` (true); the created subtree is carried as parts gated on this prop. */
  get closable(): boolean {
    return this.hasAttribute('closable');
  }
  set closable(v: boolean) {
    this.toggleAttribute('closable', v);
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue !== newValue) this.#render();
  }

  #view(): string {
    const p = {
      color: this.color,
      bordered: this.bordered,
      closable: this.closable,
    };
    return `<span part="root"${p.color == null ? '' : ` data-color="${__esc(String(p.color))}"`} data-bordered="${__esc(String(p.bordered))}"${p.closable ? ' data-closable=""' : ''}>${p.closable === true ? `<span part="anticon"><span part="anticon-glyph" aria-hidden="true">${ICONS["tag-anticon"] ?? ''}</span></span>` : ''}</span>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    void sr;
  }
}

/** Register <antd-tag> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('antd-tag')) customElements.define('antd-tag', TagElement);
}
define();

export default TagElement;
