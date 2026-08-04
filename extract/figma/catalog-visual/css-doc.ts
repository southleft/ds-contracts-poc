/**
 * CSS SURFACE — one cell, emitted by core/emit-html.ts, staged for the SAME
 * capture path the canvas surface uses.
 *
 * The cell's enum values are written in as contract defaults
 * (withOverridesAsDefaults — the playground trick vendored in
 * extract/figma/visual-parity/render.ts:98-109) so the emitter's FIRST
 * showcase item is the requested cell; the remaining items and every label are
 * hidden by frame CSS, and the showcase hugs (`width: max-content`) so the
 * stage's painted union box is the component's, not the viewport's.
 *
 * FRAME PARITY, and the one asymmetry that is deliberate. Both surfaces get
 * the same body padding (24px), the same white surface, the same light
 * color-scheme, the same Inter-first family, the same frozen animations and
 * the same hugging stage — everything the canvas renderer's GATE_CSS
 * (canvas-gate/canvas-doc.ts:455-471) pins. What this side does NOT get is
 * canvas-doc's global `box-sizing: border-box` reset. That reset is a FIGMA
 * fact (a frame's size includes its padding); the emitted stylesheet is an
 * artifact we ship into other people's pages, where the UA default
 * content-box applies unless the contract declares otherwise — and the schema
 * has a real `box-sizing` channel for that. Handing the CSS side border-box
 * for free would hide exactly the class of divergence this gate exists to
 * find. The delta this choice costs is MEASURED, not assumed: see
 * README.md § "The box-sizing decision".
 */
import { emitHtml, type Contract } from '../../../core/index.js';

/** visual-parity/render.ts withOverridesAsDefaults, verbatim in behaviour:
 *  the chosen values become the clone's prop defaults so the emitter's first
 *  showcase item IS the requested cell. core/ stays untouched. */
export function withOverridesAsDefaults(
  contract: Contract,
  subst: Record<string, string>,
  bools: Record<string, boolean>,
): Contract {
  const clone = structuredClone(contract);
  for (const prop of clone.props) {
    if (prop.name in subst) prop.default = subst[prop.name];
    if (prop.name in bools) prop.default = bools[prop.name];
  }
  return clone;
}

/** Mirrors canvas-doc.ts GATE_CSS minus the border-box reset (see header),
 *  plus the showcase narrowing. `.showcase` chrome from the emitter sets its
 *  own `font-family: sans-serif`; it is neutralised to `inherit` so BOTH
 *  surfaces fall back to the same family for parts that declare none — text
 *  regions are masked in the score either way. */
const CSS_FRAME = `
  html { color-scheme: light; }
  body { margin: 0; padding: 24px; background: #ffffff; color: #1e1e1e;
         font-family: Inter, system-ui, sans-serif; }
  .gate-cell { display: flex; align-items: flex-start; width: max-content;
               margin: 0 0 64px 0; }
  .showcase { width: max-content; gap: 0; font-family: inherit; }
  .showcase__label { display: none; }
  .showcase > .showcase__item:nth-child(n + 2) { display: none; }
  *, *::before, *::after { animation-play-state: paused !important; transition: none !important; }
`;

export interface CssDocInput {
  contract: Contract;
  subst: Record<string, string>;
  bools: Record<string, boolean>;
  tokenCss: string;
  inventory: Set<string>;
  icons: Map<string, string>;
  contracts: Map<string, Contract>;
  /** [data-cell] key — matches the sentinel used for :focus-visible driving. */
  cellKey: string;
}

/** The single-cell CSS-surface document. Throws with the emitter's own
 *  refusal text when the contract does not emit. */
export function buildCssCellDoc(input: CssDocInput): string {
  const contract = withOverridesAsDefaults(input.contract, input.subst, input.bools);
  const emitted = emitHtml(contract, {
    tokens: input.inventory,
    icons: input.icons,
    contracts: input.contracts,
  });
  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8">',
    `<style>${input.tokenCss}</style>`,
    `<style>${CSS_FRAME}</style>`,
    `<style>${emitted.css}</style>`,
    '</head><body>',
    // The sentinel is what shots.ts focuses before pressing Tab, so the next
    // focusable element is inside the cell. 8×8 at #eee, 28px clear of the
    // stage — outside the 24px clip margin (canvas-gate real-page.ts:65-68).
    `<button data-sentinel="${input.cellKey}" aria-label="sentinel" style="width:8px;height:8px;padding:0;border:0;margin:0 0 28px 0;background:#eee"></button>`,
    `<div class="gate-cell" data-cell="${input.cellKey}">`,
    emitted.html,
    '</div>',
    '</body></html>',
  ].join('\n');
}

/** THE NON-PIXEL PROBE — what a screenshot diff cannot express.
 *
 *  Returns, for one staged cell: the trimmed rendered text, and the largest
 *  distance any text client rect escapes the component root's border box
 *  (the avatar-group class: initials drawn wider than the circle that clips
 *  them). `rootSel` is relative to the stage: the CSS surface's component
 *  root sits under the showcase item, the canvas surface's IS the stage's
 *  first element child.
 *
 *  NOTE: a STRING evaluate — tsx serializes function bodies with a `__name`
 *  helper the page does not have (the documented shots.ts / render.ts trap). */
export const probeJs = (cellKey: string, rootSel: string | null) => `(() => {
  const stage = document.querySelector('[data-cell="${cellKey}"]');
  if (!stage) return null;
  const root = ${rootSel ? `stage.querySelector(${JSON.stringify(rootSel)}) || stage.firstElementChild` : 'stage.firstElementChild'};
  if (!root) return null;
  const rr = root.getBoundingClientRect();
  const text = (root.textContent || '').replace(/\\s+/g, ' ').trim();
  let overflow = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent || n.textContent.trim().length === 0) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width === 0 || r.height === 0) continue;
      overflow = Math.max(overflow, r.right - rr.right, r.bottom - rr.bottom, rr.left - r.left, rr.top - r.top);
    }
  }
  return { text, textLen: text.length, overflowPx: Math.round(overflow * 100) / 100,
           rootPx: Math.round(rr.width) + 'x' + Math.round(rr.height) };
})()`;

export interface Probe {
  text: string;
  textLen: number;
  overflowPx: number;
  rootPx: string;
}

/** The CSS surface's component root inside the stage: showcase → first item →
 *  the element after the (hidden) label. Same selector visual-parity's
 *  render.ts measures. */
export const CSS_ROOT_SEL = '.showcase > .showcase__item:first-child > :nth-child(2)';
