/**
 * Alert — vanilla Custom Element <antd-alert> emitted from contract
 * antd.alert v0.2.0 by @ds-contracts/emitter-web-components. Do not edit.
 *
 * Token values arrive via CSS custom properties (custom properties inherit
 * through the shadow boundary) — include the token stylesheet on the page
 * or nothing resolves.
 *
 * Named no-ops on this contract (canvas-only concepts, deliberately not
 * re-created here):
 *   · bindings.figma / bindings.figma.anchors / slot.bindings.figma.property (design-side identity, no DOM manifestation)
 */
import sheet from './antd-alert.css.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ICONS: Record<string, string> = {
  "alert-alert-icon-success": "<svg viewBox=\"0 0 960 960\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 512 64 C 264.6 64 64 264.6 64 512 S 264.6 960 512 960 S 960 759.4 960 512 S 759.4 64 512 64 Z M 705.5 365.7 L 494.9 657.7 A 31.8 31.8 0 0 1 443.2 657.7 L 318.5 484.9 C 314.7 479.6 318.5 472.2 325 472.2 H 371.9 C 382.1 472.2 391.8 477.1 397.8 485.5 L 469 584.3 L 626.2 366.3 C 632.2 358 641.8 353 652.1 353 H 699 C 705.5 353 709.3 360.4 705.5 365.7 Z\" fill=\"currentColor\"/></svg>",
  "alert-alert-icon-info": "<svg viewBox=\"0 0 960 960\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 512 64 C 264.6 64 64 264.6 64 512 S 264.6 960 512 960 S 960 759.4 960 512 S 759.4 64 512 64 Z M 544 728 C 544 732.4 540.4 736 536 736 H 488 C 483.6 736 480 732.4 480 728 V 456 C 480 451.6 483.6 448 488 448 H 536 C 540.4 448 544 451.6 544 456 V 728 Z M 512 384 A 48.01 48.01 0 0 1 512 288 A 48.01 48.01 0 0 1 512 384 Z\" fill=\"currentColor\"/></svg>",
  "alert-alert-icon-warning": "<svg viewBox=\"0 0 960 960\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 512 64 C 264.6 64 64 264.6 64 512 S 264.6 960 512 960 S 960 759.4 960 512 S 759.4 64 512 64 Z M 480 296 C 480 291.6 483.6 288 488 288 H 536 C 540.4 288 544 291.6 544 296 V 568 C 544 572.4 540.4 576 536 576 H 488 C 483.6 576 480 572.4 480 568 V 296 Z M 512 736 A 48.01 48.01 0 0 1 512 640 A 48.01 48.01 0 0 1 512 736 Z\" fill=\"currentColor\"/></svg>",
  "alert-alert-icon-error": "<svg viewBox=\"0 0 960 960\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 512 64 C 759.4 64 960 264.6 960 512 S 759.4 960 512 960 S 64 759.4 64 512 S 264.6 64 512 64 Z M 639.98 338.82 H 639.94 L 639.86 338.88 L 512 466.75 L 384.14 338.88 C 384.1 338.83 384.08 338.82 384.06 338.82 A 0.12 0.12 0 0 0 383.99 338.82 C 383.96 338.82 383.94 338.83 383.9 338.87 L 338.88 383.89 A 0.2 0.2 0 0 0 338.83 383.98 A 0.12 0.12 0 0 0 338.83 384.05 V 384.07 A 0.27 0.27 0 0 0 338.89 384.13 L 466.75 512 L 338.88 639.86 C 338.83 639.9 338.82 639.92 338.82 639.94 A 0.12 0.12 0 0 0 338.82 640.01 C 338.82 640.04 338.83 640.06 338.87 640.1 L 383.89 685.12 A 0.2 0.2 0 0 0 383.98 685.17 A 0.12 0.12 0 0 0 384.05 685.17 C 384.07 685.17 384.09 685.16 384.13 685.12 L 512 557.25 L 639.86 685.12 C 639.9 685.16 639.92 685.17 639.94 685.17 A 0.12 0.12 0 0 0 640.01 685.17 C 640.04 685.17 640.06 685.16 640.1 685.12 L 685.12 640.1 A 0.2 0.2 0 0 0 685.17 640.01 A 0.12 0.12 0 0 0 685.17 639.94 V 639.92 A 0.27 0.27 0 0 0 685.12 639.86 L 557.25 512 L 685.12 384.14 C 685.16 384.1 685.17 384.08 685.17 384.06 A 0.12 0.12 0 0 0 685.17 383.99 C 685.17 383.96 685.16 383.94 685.12 383.9 L 640.1 338.88 A 0.2 0.2 0 0 0 640.01 338.83 A 0.12 0.12 0 0 0 639.94 338.83 Z\" fill=\"currentColor\" fill-rule=\"evenodd\"/></svg>",
  "alert-anticon": "<svg viewBox=\"0 0 858 858\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 799.86 166.31 C 799.88 166.31 799.9 166.33 799.94 166.37 L 857.63 224.07 C 857.67 224.1 857.68 224.12 857.69 224.15 A 0.12 0.12 0 0 1 857.69 224.21 C 857.69 224.24 857.67 224.26 857.63 224.3 L 569.93 512 L 857.63 799.7 C 857.67 799.74 857.68 799.76 857.69 799.79 A 0.12 0.12 0 0 1 857.69 799.86 C 857.69 799.88 857.67 799.9 857.63 799.94 L 799.93 857.63 C 799.9 857.67 799.88 857.68 799.86 857.69 A 0.12 0.12 0 0 1 799.79 857.69 C 799.76 857.69 799.74 857.67 799.7 857.63 L 512 569.93 L 224.3 857.63 C 224.26 857.67 224.24 857.68 224.21 857.69 A 0.12 0.12 0 0 1 224.14 857.69 C 224.12 857.69 224.1 857.67 224.06 857.63 L 166.37 799.93 C 166.33 799.9 166.32 799.88 166.31 799.86 A 0.12 0.12 0 0 1 166.31 799.79 C 166.31 799.76 166.33 799.74 166.37 799.7 L 454.07 512 L 166.37 224.3 C 166.33 224.26 166.32 224.24 166.31 224.21 A 0.12 0.12 0 0 1 166.31 224.14 C 166.31 224.12 166.33 224.1 166.37 224.06 L 224.07 166.37 C 224.1 166.33 224.12 166.32 224.14 166.31 A 0.12 0.12 0 0 1 224.21 166.31 C 224.24 166.31 224.26 166.33 224.3 166.37 L 512 454.07 L 799.7 166.37 C 799.74 166.33 799.76 166.32 799.79 166.31 A 0.12 0.12 0 0 1 799.86 166.31 Z\" fill=\"currentColor\" fill-rule=\"evenodd\"/></svg>",
};

export class AlertElement extends HTMLElement {
  static observedAttributes = ["type","show-icon","message","description","closable"];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sheet];
  }

  /** Enum prop "type". */
  get type(): 'success' | 'info' | 'warning' | 'error' {
    return (this.getAttribute('type') as 'success' | 'info' | 'warning' | 'error' | null) ?? 'info';
  }
  set type(v: 'success' | 'info' | 'warning' | 'error' | null) {
    if (v == null) this.removeAttribute('type');
    else this.setAttribute('type', v);
  }
  /** Enum prop "showIcon". */
  get showIcon(): 'noIcon' | 'icon' {
    return (this.getAttribute('show-icon') as 'noIcon' | 'icon' | null) ?? 'noIcon';
  }
  set showIcon(v: 'noIcon' | 'icon' | null) {
    if (v == null) this.removeAttribute('show-icon');
    else this.setAttribute('show-icon', v);
  }
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `description` ("Alert description copy."); the created subtree is carried as parts gated on this prop. */
  get description(): boolean {
    return this.hasAttribute('description');
  }
  set description(v: boolean) {
    this.toggleAttribute('description', v);
  }
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `closable` (true); the created subtree is carried as parts gated on this prop. */
  get closable(): boolean {
    return this.hasAttribute('closable');
  }
  set closable(v: boolean) {
    this.toggleAttribute('closable', v);
  }
  /** Text prop "message". */
  get message(): string | null {
    return this.getAttribute('message') ?? "Alert message";
  }
  set message(v: string | null) {
    if (v == null) this.removeAttribute('message');
    else this.setAttribute('message', v);
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
      showIcon: this.showIcon,
      message: this.message,
      description: this.description,
      closable: this.closable,
    };
    return `<div part="root" data-type="${__esc(String(p.type))}" data-show-icon="${__esc(String(p.showIcon))}"${p.description ? ' data-description=""' : ''}${p.closable ? ' data-closable=""' : ''}><span part="alert-icon">${(p.type ?? '') === "success" ? `<span part="alert-icon-success" aria-hidden="true">${ICONS["alert-alert-icon-success"] ?? ''}</span>` : ''}${(p.type ?? '') === "info" ? `<span part="alert-icon-info" aria-hidden="true">${ICONS["alert-alert-icon-info"] ?? ''}</span>` : ''}${(p.type ?? '') === "warning" ? `<span part="alert-icon-warning" aria-hidden="true">${ICONS["alert-alert-icon-warning"] ?? ''}</span>` : ''}${(p.type ?? '') === "error" ? `<span part="alert-icon-error" aria-hidden="true">${ICONS["alert-alert-icon-error"] ?? ''}</span>` : ''}</span><div part="alert-content"><span part="label">${__esc(String(p.message ?? "Alert message"))}</span>${p.description === true ? `<span part="label-2">Alert description copy.</span>` : ''}</div>${p.closable === true ? `<button part="alert-close-icon">${p.closable === true ? `<span part="anticon"><span part="anticon-glyph" aria-hidden="true">${ICONS["alert-anticon"] ?? ''}</span></span>` : ''}</button>` : ''}</div>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    void sr;
  }
}

/** Register <antd-alert> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('antd-alert')) customElements.define('antd-alert', AlertElement);
}
define();

export default AlertElement;
