/**
 * Button — vanilla Custom Element <antd-button> emitted from contract
 * antd.button v0.2.0 by @ds-contracts/emitter-web-components. Do not edit.
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
import sheet from './antd-button.css.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ICONS: Record<string, string> = {
  "button-anticon": "<svg viewBox=\"0 0 910 910\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 909.6 854.5 L 649.9 594.8 C 690.2 542.7 712 479 712 412 C 712 331.8 680.7 256.6 624.1 199.9 C 567.5 143.2 492.1 112 412 112 S 256.5 143.3 199.9 199.9 C 143.2 256.5 112 331.8 112 412 C 112 492.1 143.3 567.5 199.9 624.1 C 256.5 680.8 331.8 712 412 712 C 479 712 542.6 690.2 594.7 650 L 854.4 909.6 A 8.2 8.2 0 0 0 866 909.6 L 909.6 866.1 A 8.2 8.2 0 0 0 909.6 854.5 Z M 570.4 570.4 C 528 612.7 471.8 636 412 636 S 296 612.7 253.6 570.4 C 211.3 528 188 471.8 188 412 S 211.3 295.9 253.6 253.6 C 296 211.3 352.2 188 412 188 S 528.1 211.2 570.4 253.6 S 636 352.2 636 412 S 612.7 528.1 570.4 570.4 Z\" fill=\"currentColor\"/></svg>",
  "button-anticon-2": "<svg viewBox=\"0 0 1024 1024\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 988 548 C 968.1 548 952 531.9 952 512 C 952 452.6 940.4 395 917.4 340.7 A 440.45 440.45 0 0 0 823.1 200.8 A 437.71 437.71 0 0 0 683.2 106.5 C 629 83.6 571.4 72 512 72 C 492.1 72 476 55.9 476 36 S 492.1 0 512 0 C 581.1 0 648.2 13.5 711.3 40.3 C 772.3 66 827 103 874 150 C 921 197 957.9 251.8 983.7 312.7 C 1010.4 375.8 1023.9 442.9 1023.9 512 C 1024 531.9 1007.9 548 988 548 Z\" fill=\"currentColor\"/></svg>",
};

export class ButtonElement extends HTMLElement {
  static observedAttributes = ["type","size","danger","disabled","icon","loading"];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    shadow.adoptedStyleSheets = [sheet];
  }

  /** Enum prop "type". */
  get type(): 'default' | 'primary' | 'dashed' | 'link' | 'text' {
    return (this.getAttribute('type') as 'default' | 'primary' | 'dashed' | 'link' | 'text' | null) ?? 'default';
  }
  set type(v: 'default' | 'primary' | 'dashed' | 'link' | 'text' | null) {
    if (v == null) this.removeAttribute('type');
    else this.setAttribute('type', v);
  }
  /** Enum prop "size". */
  get size(): 'small' | 'middle' | 'large' {
    return (this.getAttribute('size') as 'small' | 'middle' | 'large' | null) ?? 'middle';
  }
  set size(v: 'small' | 'middle' | 'large' | null) {
    if (v == null) this.removeAttribute('size');
    else this.setAttribute('size', v);
  }
  /** Enum prop "danger". */
  get danger(): 'safe' | 'danger' {
    return (this.getAttribute('danger') as 'safe' | 'danger' | null) ?? 'safe';
  }
  set danger(v: 'safe' | 'danger' | null) {
    if (v == null) this.removeAttribute('danger');
    else this.setAttribute('danger', v);
  }
  /** Boolean prop "disabled". */
  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(v: boolean) {
    this.toggleAttribute('disabled', v);
  }
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `icon` ({"$element":"@ant-design/icons#SearchOutlined"}); the created subtree is carried as parts gated on this prop. */
  get icon(): boolean {
    return this.hasAttribute('icon');
  }
  set icon(v: boolean) {
    this.toggleAttribute('icon', v);
  }
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `loading` (true); the created subtree is carried as parts gated on this prop. */
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
      type: this.type,
      size: this.size,
      danger: this.danger,
      disabled: this.disabled,
      icon: this.icon,
      loading: this.loading,
    };
    return `<button part="root" data-type="${__esc(String(p.type))}" data-size="${__esc(String(p.size))}" data-danger="${__esc(String(p.danger))}"${p.disabled ? ' disabled' : ''}${p.icon ? ' data-icon=""' : ''}${p.loading ? ' data-loading=""' : ''}>${p.icon === true ? `<span part="btn-icon">${p.icon === true ? `<span part="anticon"><span part="anticon-glyph" aria-hidden="true">${ICONS["button-anticon"] ?? ''}</span></span>` : ''}</span>` : ''}${p.loading === true ? `<span part="btn-icon-2">${p.loading === true ? `<span part="anticon-2"><span part="anticon-2-glyph" aria-hidden="true">${ICONS["button-anticon-2"] ?? ''}</span></span>` : ''}</span>` : ''}<span part="label"><slot>Button</slot></span></button>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    void sr;
  }
}

/** Register <antd-button> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('antd-button')) customElements.define('antd-button', ButtonElement);
}
define();

export default ButtonElement;
