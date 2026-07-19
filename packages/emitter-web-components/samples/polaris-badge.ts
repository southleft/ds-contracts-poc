/**
 * Badge — vanilla Custom Element <polaris-badge> emitted from contract
 * polaris.badge v0.3.0 by @ds-contracts/emitter-web-components. Do not edit.
 *
 * Token values arrive via CSS custom properties (custom properties inherit
 * through the shadow boundary) — include the token stylesheet on the page
 * or nothing resolves.
 *
 * Named no-ops on this contract (canvas-only concepts, deliberately not
 * re-created here):
 *   · bindings.figma / anchors.figma / slot.figmaProperty (design-side identity, no DOM manifestation)
 */
import sheet from './polaris-badge.css.js';

const __esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ICONS: Record<string, string> = {
  "badge-icon-3-incomplete": "<svg viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 8.547 12.69 C 8.73 12.74 8.99 12.75 10 12.75 S 11.27 12.74 11.453 12.69 A 1.75 1.75 0 0 0 12.69 11.453 C 12.74 11.271 12.75 11.01 12.75 10 S 12.74 8.73 12.69 8.547 A 1.75 1.75 0 0 0 11.453 7.31 C 11.271 7.26 11.01 7.25 10 7.25 S 8.73 7.26 8.547 7.31 A 1.75 1.75 0 0 0 7.31 8.547 C 7.26 8.73 7.25 8.99 7.25 10 S 7.26 11.27 7.31 11.453 A 1.75 1.75 0 0 0 8.547 12.69 Z M 6.102 8.224 C 6 8.605 6 9.07 6 10 S 6 11.395 6.102 11.777 A 3 3 0 0 0 8.224 13.897 C 8.605 14 9.07 14 10 14 S 11.395 14 11.777 13.898 A 3 3 0 0 0 13.897 11.777 C 14 11.395 14 10.93 14 10 C 14 9.07 14 8.605 13.898 8.224 A 3 3 0 0 0 11.777 6.102 C 11.395 6 10.93 6 10 6 C 9.07 6 8.605 6 8.224 6.102 A 3 3 0 0 0 6.102 8.224 Z\" fill-rule=\"evenodd\"/></svg>",
  "badge-icon-3-partiallycomplete": "<svg viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 8.888 6.014 L 8.871 5.996 L 8.851 6.016 C 8.598 6.029 8.401 6.054 8.223 6.102 A 3 3 0 0 0 6.103 8.224 C 6 8.605 6 9.07 6 10 S 6 11.395 6.102 11.777 A 3 3 0 0 0 8.223 13.897 C 8.605 14 9.07 14 10 14 C 10.93 14 11.395 14 11.776 13.898 A 3 3 0 0 0 13.898 11.777 C 14 11.395 14 10.93 14 10 C 14 9.07 14 8.605 13.898 8.224 A 3 3 0 0 0 11.776 6.102 C 11.395 6 10.93 6 10 6 C 9.525 6 9.171 6 8.888 6.014 Z M 8.446 7.34 A 1.75 1.75 0 0 0 7.405 8.28 L 11.719 12.595 C 12.162 12.395 12.505 12.019 12.66 11.553 L 8.446 7.34 Z M 12.75 9.876 L 10.124 7.25 C 11.032 7.251 11.278 7.263 11.453 7.31 A 1.75 1.75 0 0 1 12.69 8.547 C 12.737 8.722 12.749 8.967 12.75 9.876 Z M 8.547 12.69 C 8.729 12.74 8.989 12.75 10 12.75 H 10.106 L 7.25 9.894 V 10 C 7.25 11.01 7.26 11.27 7.31 11.453 A 1.75 1.75 0 0 0 8.547 12.69 Z\" fill-rule=\"evenodd\"/></svg>",
  "badge-icon-3-complete": "<svg viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 6 10 C 6 9.07 6 8.605 6.102 8.224 A 3 3 0 0 1 8.223 6.102 C 8.605 6 9.07 6 10 6 C 10.93 6 11.395 6 11.776 6.102 A 3 3 0 0 1 13.898 8.224 C 14 8.605 14 9.07 14 10 S 14 11.395 13.898 11.777 A 3 3 0 0 1 11.776 13.897 C 11.395 14 10.93 14 10 14 S 8.605 14 8.223 13.898 A 3 3 0 0 1 6.103 11.777 C 6 11.395 6 10.93 6 10 Z\"/></svg>",
};

export class BadgeElement extends HTMLElement {
  static observedAttributes = ["tone","progress","tone-and-progress-label-override"];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sheet];
  }

  /** Colors and labels the badge with the given tone (round 4: enumerated from the real @shopify/polaris@13.9.5 Badge API — the static extraction had missed the styling axes entirely). */
  get tone(): 'info' | 'success' | 'warning' | 'critical' | 'attention' | 'new' | 'magic' | 'info-strong' | 'success-strong' | 'warning-strong' | 'critical-strong' | 'attention-strong' | 'read-only' | 'enabled' | null {
    return this.getAttribute('tone') as 'info' | 'success' | 'warning' | 'critical' | 'attention' | 'new' | 'magic' | 'info-strong' | 'success-strong' | 'warning-strong' | 'critical-strong' | 'attention-strong' | 'read-only' | 'enabled' | null;
  }
  set tone(v: 'info' | 'success' | 'warning' | 'critical' | 'attention' | 'new' | 'magic' | 'info-strong' | 'success-strong' | 'warning-strong' | 'critical-strong' | 'attention-strong' | 'read-only' | 'enabled' | null) {
    if (v == null) this.removeAttribute('tone');
    else this.setAttribute('tone', v);
  }
  /** Render a pip showing the progress of a given task (round 4: real Badge API axis). */
  get progress(): 'incomplete' | 'partiallyComplete' | 'complete' | null {
    return this.getAttribute('progress') as 'incomplete' | 'partiallyComplete' | 'complete' | null;
  }
  set progress(v: 'incomplete' | 'partiallyComplete' | 'complete' | null) {
    if (v == null) this.removeAttribute('progress');
    else this.setAttribute('progress', v);
  }
  /** Pass a custom accessibilityLabel */
  get toneAndProgressLabelOverride(): string | null {
    return this.getAttribute('tone-and-progress-label-override') ?? null;
  }
  set toneAndProgressLabelOverride(v: string | null) {
    if (v == null) this.removeAttribute('tone-and-progress-label-override');
    else this.setAttribute('tone-and-progress-label-override', v);
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue !== newValue) this.#render();
  }

  #view(): string {
    const p = {
      tone: this.tone,
      progress: this.progress,
      toneAndProgressLabelOverride: this.toneAndProgressLabelOverride,
    };
    return `<span part="root"${p.tone == null ? '' : ` data-tone="${__esc(String(p.tone))}"`}${p.progress == null ? '' : ` data-progress="${__esc(String(p.progress))}"`}><span part="label-2">Info</span><span part="icon"><span part="icon-2"><span part="label-3">Incomplete</span><div part="icon-3">${(p.progress ?? '') === "incomplete" ? `<span part="icon-3-incomplete" aria-hidden="true">${ICONS["badge-icon-3-incomplete"] ?? ''}</span>` : ''}${(p.progress ?? '') === "partiallyComplete" ? `<span part="icon-3-partiallycomplete" aria-hidden="true">${ICONS["badge-icon-3-partiallycomplete"] ?? ''}</span>` : ''}${(p.progress ?? '') === "complete" ? `<span part="icon-3-complete" aria-hidden="true">${ICONS["badge-icon-3-complete"] ?? ''}</span>` : ''}</div></span></span><span part="label">Fulfilled</span></span>`;
  }

  #render(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    sr.innerHTML = this.#view();
    void sr;
  }
}

/** Register <polaris-badge> (idempotent). Runs on import; exported for explicit use. */
export function define(): void {
  if (!customElements.get('polaris-badge')) customElements.define('polaris-badge', BadgeElement);
}
define();

export default BadgeElement;
