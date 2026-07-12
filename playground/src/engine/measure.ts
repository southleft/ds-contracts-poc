/**
 * Offscreen document measurement — a hidden iframe with
 * sandbox="allow-same-origin" and NO allow-scripts (nothing in the document
 * can run; the flag only lets THIS page read the layout it produced) renders
 * an emitted preview doc and reports what it actually looks like.
 *
 * Two consumers:
 *  - the "No visible change — by design" note compares RENDER signatures
 *    across a control toggle. Markup comparison alone lies when class
 *    strings change while pixels don't (ds.token's size axis) — geometry +
 *    paint of every rendered element is the honest test.
 *  - CanvasFrame's fit-to-pane zoom needs the canvas document's natural
 *    size, which a sandboxed visible iframe cannot report.
 *
 * Results are cached by document text (the docs are deterministic emitter
 * output), so a toggle costs at most one measurement per new state.
 */

/** Wide enough that no showcase/canvas doc wraps differently than it would
 *  unconstrained — both consumers care about natural layout, not viewport. */
const MEASURE_WIDTH = 2400;
const MEASURE_TIMEOUT_MS = 3000;

function inMeasureFrame<T>(doc: string, read: (body: HTMLElement, win: Window) => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const frame = document.createElement('iframe');
    // allow-same-origin WITHOUT allow-scripts: static layout, readable here.
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = [
      'position: fixed',
      'left: -10000px',
      'top: 0',
      `width: ${MEASURE_WIDTH}px`,
      'height: 1200px',
      'visibility: hidden',
      'pointer-events: none',
      'border: 0',
    ].join('; ');
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      fn();
      frame.remove();
    };
    const timer = window.setTimeout(
      () => finish(() => reject(new Error('measurement frame timed out'))),
      MEASURE_TIMEOUT_MS,
    );
    frame.onload = () => {
      window.clearTimeout(timer);
      try {
        const win = frame.contentWindow;
        const body = win?.document?.body;
        if (!win || !body) throw new Error('measurement frame has no readable document');
        const result = read(body, win);
        finish(() => resolve(result));
      } catch (e) {
        finish(() => reject(e instanceof Error ? e : new Error(String(e))));
      }
    };
    frame.srcdoc = doc;
    document.body.appendChild(frame);
  });
}

// ---------------------------------------------------------------------------
// Natural document size (canvas fit-to-pane)
// ---------------------------------------------------------------------------

export interface DocSize {
  width: number;
  height: number;
}

const sizeCache = new Map<string, DocSize>();

export async function measureDocSize(doc: string): Promise<DocSize | null> {
  const hit = sizeCache.get(doc);
  if (hit) return hit;
  try {
    const size = await inMeasureFrame(doc, (body, win) => {
      // CONTENT extent, not scrollWidth — the body spans the whole measure
      // frame, so scrollWidth would report the frame's own width for any
      // document narrower than it. The furthest element edge + the body's
      // trailing padding is the document's natural size.
      const cs = win.getComputedStyle(body);
      let right = 0;
      let bottom = 0;
      for (const el of body.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        right = Math.max(right, r.right);
        bottom = Math.max(bottom, r.bottom);
      }
      if (right === 0 && bottom === 0) throw new Error('empty document — nothing to measure');
      return {
        width: Math.ceil(right + (parseFloat(cs.paddingRight) || 0)),
        height: Math.ceil(bottom + (parseFloat(cs.paddingBottom) || 0)),
      };
    });
    trim(sizeCache);
    sizeCache.set(doc, size);
    return size;
  } catch {
    return null; // unmeasurable → the caller falls back to the unscaled frame
  }
}

// ---------------------------------------------------------------------------
// Render signature (the honest no-visible-change test)
// ---------------------------------------------------------------------------

/** The computed properties that decide what a static render LOOKS like.
 *  Geometry rides separately (bounding rects). */
const PAINT_PROPS = [
  'color',
  'backgroundColor',
  'backgroundImage',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderTopColor',
  'borderTopStyle',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'textDecorationLine',
  'textTransform',
  'opacity',
  'boxShadow',
  'outlineWidth',
  'outlineColor',
  'transform',
  'visibility',
] as const;

const sigCache = new Map<string, string>();

/** Serialize every rendered element's geometry + paint + text. Two docs with
 *  equal signatures render identically (same fonts, same width — the frames
 *  are configured identically), whatever their class strings say. */
export async function renderSignature(doc: string): Promise<string | null> {
  const hit = sigCache.get(doc);
  if (hit !== undefined) return hit;
  try {
    const sig = await inMeasureFrame(doc, (body, win) => {
      const parts: string[] = [];
      const walk = (el: Element) => {
        const cs = win.getComputedStyle(el);
        if (cs.display === 'none') return; // subtree never renders
        const r = el.getBoundingClientRect();
        const round = (n: number) => Math.round(n * 2) / 2;
        parts.push(
          [
            el.tagName,
            round(r.x),
            round(r.y),
            round(r.width),
            round(r.height),
            ...PAINT_PROPS.map((p) => cs[p as keyof CSSStyleDeclaration] as string),
          ].join('|'),
        );
        for (const child of el.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent?.trim();
            if (text) parts.push(`#${text}`);
          }
        }
        for (const child of el.children) walk(child);
      };
      walk(body);
      return parts.join('\n');
    });
    trim(sigCache);
    sigCache.set(doc, sig);
    return sig;
  } catch {
    return null; // unmeasurable → callers must NOT claim "no visible change"
  }
}

/** Small FIFO cap — docs are big strings; keep a screenful of states. */
function trim(cache: Map<string, unknown>) {
  while (cache.size >= 24) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}
