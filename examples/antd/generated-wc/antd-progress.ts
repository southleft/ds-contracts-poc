/**
 * Progress — vanilla Custom Element <antd-progress> emitted from contract
 * antd.progress v0.2.0 by @ds-contracts/emitter-web-components. Do not edit.
 *
 * Token values arrive via CSS custom properties (custom properties inherit
 * through the shadow boundary) — include the token stylesheet on the page
 * or nothing resolves.
 *
 * Named no-ops on this contract (canvas-only concepts, deliberately not
 * re-created here):
 *   · bindings.figma / bindings.figma.anchors / slot.bindings.figma.property (design-side identity, no DOM manifestation)
 */
import sheet from './antd-progress.css.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ICONS: Record<string, string> = {
  "progress-anticon-exception": "<svg viewBox=\"0 0 960 960\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 512 64 C 759.4 64 960 264.6 960 512 S 759.4 960 512 960 S 64 759.4 64 512 S 264.6 64 512 64 Z M 639.98 338.82 H 639.94 L 639.86 338.88 L 512 466.75 L 384.14 338.88 C 384.1 338.83 384.08 338.82 384.06 338.82 A 0.12 0.12 0 0 0 383.99 338.82 C 383.96 338.82 383.94 338.83 383.9 338.87 L 338.88 383.89 A 0.2 0.2 0 0 0 338.83 383.98 A 0.12 0.12 0 0 0 338.83 384.05 V 384.07 A 0.27 0.27 0 0 0 338.89 384.13 L 466.75 512 L 338.88 639.86 C 338.83 639.9 338.82 639.92 338.82 639.94 A 0.12 0.12 0 0 0 338.82 640.01 C 338.82 640.04 338.83 640.06 338.87 640.1 L 383.89 685.12 A 0.2 0.2 0 0 0 383.98 685.17 A 0.12 0.12 0 0 0 384.05 685.17 C 384.07 685.17 384.09 685.16 384.13 685.12 L 512 557.25 L 639.86 685.12 C 639.9 685.16 639.92 685.17 639.94 685.17 A 0.12 0.12 0 0 0 640.01 685.17 C 640.04 685.17 640.06 685.16 640.1 685.12 L 685.12 640.1 A 0.2 0.2 0 0 0 685.17 640.01 A 0.12 0.12 0 0 0 685.17 639.94 V 639.92 A 0.27 0.27 0 0 0 685.12 639.86 L 557.25 512 L 685.12 384.14 C 685.16 384.1 685.17 384.08 685.17 384.06 A 0.12 0.12 0 0 0 685.17 383.99 C 685.17 383.96 685.16 383.94 685.12 383.9 L 640.1 338.88 A 0.2 0.2 0 0 0 640.01 338.83 A 0.12 0.12 0 0 0 639.94 338.83 Z\" fill=\"currentColor\" fill-rule=\"evenodd\"/></svg>",
  "progress-anticon-success": "<svg viewBox=\"0 0 960 960\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 512 64 C 264.6 64 64 264.6 64 512 S 264.6 960 512 960 S 960 759.4 960 512 S 759.4 64 512 64 Z M 705.5 365.7 L 494.9 657.7 A 31.8 31.8 0 0 1 443.2 657.7 L 318.5 484.9 C 314.7 479.6 318.5 472.2 325 472.2 H 371.9 C 382.1 472.2 391.8 477.1 397.8 485.5 L 469 584.3 L 626.2 366.3 C 632.2 358 641.8 353 652.1 353 H 699 C 705.5 353 709.3 360.4 705.5 365.7 Z\" fill=\"currentColor\"/></svg>",
};

export class ProgressElement extends HTMLElement {
  static observedAttributes = ["status","percent","max"];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sheet];
  }

  /** Enum prop "status". */
  get status(): 'unset' | 'exception' | 'active' | 'success' {
    return (this.getAttribute('status') as 'unset' | 'exception' | 'active' | 'success' | null) ?? 'unset';
  }
  set status(v: 'unset' | 'exception' | 'active' | 'success' | null) {
    if (v == null) this.removeAttribute('status');
    else this.setAttribute('status', v);
  }
  /** Number prop "percent". */
  get percent(): number | null {
    const v = this.getAttribute('percent');
    if (v === null || v === '') return 40;
    const n = Number(v);
    return Number.isNaN(n) ? 40 : n;
  }
  set percent(v: number | null) {
    if (v == null) this.removeAttribute('percent');
    else this.setAttribute('percent', String(v));
  }
  /** Number prop "max". */
  get max(): number | null {
    const v = this.getAttribute('max');
    if (v === null || v === '') return 100;
    const n = Number(v);
    return Number.isNaN(n) ? 100 : n;
  }
  set max(v: number | null) {
    if (v == null) this.removeAttribute('max');
    else this.setAttribute('max', String(v));
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue !== newValue) this.#render();
  }

  #view(): string {
    const p = {
      status: this.status,
      percent: this.percent,
      max: this.max,
    };
    const __meter_progress_bg = Math.min(100, Math.max(0, ((p.percent ?? 0) / ((p.max ?? 100) || 100)) * 100));
    return `<div part="root" data-status="${__esc(String(p.status))}"><div part="progress-outer"><div part="progress-inner"><div part="progress-bg" style="width: ${__meter_progress_bg}%"></div></div><span part="label">40%</span></div></div>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    void sr;
  }
}

/** Register <antd-progress> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('antd-progress')) customElements.define('antd-progress', ProgressElement);
}
define();

export default ProgressElement;
