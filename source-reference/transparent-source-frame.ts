/** A bounded, source-only capture instrument. The original is authenticated
 * before capture and restored afterwards; no native pixels influence framing. */
import { createHash } from 'node:crypto';
import type { Page } from 'playwright-core';
import { PNG } from 'pngjs';
import { cropSourceFrame } from './source-framing.js';

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

/** Ancestors must be unpainted HTML wrappers over a plain html/body background.
 * External siblings are excluded only when hiding them leaves the crop exact.
 * Other scenes need a different instrument, not a backdrop assumption. */
export async function captureTransparentSourceFrame(page: Page, selector: string, originalSha256: string) {
  const observe = (selector: string) => {
    const refuse = (reason: string): never => { throw Error('transparent-source-frame-' + reason); };
    const matches = document.querySelectorAll(selector);
    if (matches.length !== 1) refuse('target-not-unique');
    const root = matches[0]!;
    if (window.devicePixelRatio !== 1 || window.scrollX || window.scrollY) refuse('coordinate-context');
    if (document.getAnimations().some(a => !['finished', 'idle'].includes(a.playState))) refuse('animation-active');
    const plain = (s: CSSStyleDeclaration, ancestor: boolean) => {
      for (const [name, allowed] of Object.entries({
        'mix-blend-mode': ['normal'], 'filter': ['none'], 'backdrop-filter': ['none'],
        '-webkit-backdrop-filter': ['', 'none'], 'mask-image': ['none'], 'clip-path': ['none'],
        'perspective': ['none'], 'zoom': ['1', 'normal'],
      })) if (!allowed.includes(s.getPropertyValue(name))) refuse('dependent-paint:' + name);
      if (ancestor && (s.opacity !== '1' || s.transform !== 'none' || s.translate !== 'none' ||
          s.rotate !== 'none' || s.scale !== 'none' || s.overflowX !== 'visible' ||
          s.overflowY !== 'visible' || s.contain !== 'none' || s.clip !== 'auto')) refuse('ancestor-context');
    };
    const transparent = (color: string) => color === 'transparent' || color === 'rgba(0, 0, 0, 0)';
    const painted = (s: CSSStyleDeclaration, ignoreBackground = false) => !ignoreBackground && !transparent(s.backgroundColor) || s.backgroundImage !== 'none' ||
      s.boxShadow !== 'none' || s.textShadow !== 'none' || s.outlineStyle !== 'none' && s.outlineWidth !== '0px' ||
      ['Top', 'Right', 'Bottom', 'Left'].some(side => {
        const p = 'border' + side;
        return (s as unknown as Record<string, string>)[p + 'Style'] !== 'none' &&
          (s as unknown as Record<string, string>)[p + 'Width'] !== '0px' &&
          !transparent((s as unknown as Record<string, string>)[p + 'Color']!);
      });
    const all = Array.from(document.body.querySelectorAll('*'));
    const ancestors: Element[] = [];
    for (let n = root.parentElement; n; n = n.parentElement) ancestors.push(n);
    for (const element of ancestors) {
      const s = getComputedStyle(element);
      if (s.display === 'none') continue;
      plain(s, true);
      const host = element === document.body || element === document.documentElement;
      if (host) {
        // Only the host's solid background is neutralized. Anything else is
        // retained in the render and would contaminate the comparison.
        if (painted(s, true)) refuse('host-paint');
      } else if (painted(s)) refuse('external-paint');
      if (Array.from(element.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) refuse('external-text');
      if (['IMG', 'SVG', 'CANVAS', 'VIDEO', 'IFRAME', 'INPUT', 'SELECT', 'TEXTAREA', 'OBJECT', 'EMBED'].includes(element.tagName)) refuse('external-replaced-content');
      for (const pseudo of ['::before', '::after']) {
        const p = getComputedStyle(element, pseudo);
        if (!['none', 'normal'].includes(p.content) && p.display !== 'none') refuse('external-pseudo');
      }
    }
    const style = (s: CSSStyleDeclaration) => Object.fromEntries(Array.from(s).map(k => [k, s.getPropertyValue(k)]));
    const rect = (r: DOMRect) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
    const nodes = [root, ...root.querySelectorAll('*')].map(n => {
      if (n.shadowRoot || ['CANVAS', 'VIDEO', 'IFRAME', 'OBJECT', 'EMBED'].includes(n.tagName)) refuse('opaque-content');
      const s = getComputedStyle(n); plain(s, false);
      const pseudos = ['::before', '::after'].map(pseudo => {
        const p = getComputedStyle(n, pseudo);
        if (!['none', 'normal'].includes(p.content) && p.display !== 'none') plain(p, false);
        return style(p);
      });
      return { tag: n.tagName, html: n.outerHTML, bounds: rect(n.getBoundingClientRect()), style: style(s), pseudos };
    });
    const externalSelectors = all.filter(n => n !== root && !root.contains(n) && !ancestors.includes(n)).map(n => {
      const parts: string[] = [];
      for (let e: Element | null = n; e && e !== document.body; e = e.parentElement)
        parts.unshift(':nth-child(' + (Array.from(e.parentElement!.children).indexOf(e) + 1) + ')');
      return 'body > ' + parts.join(' > ');
    });
    return { bounds: rect(root.getBoundingClientRect()), nodes, externalSelectors };
  };
  // tsx preserves nested helper names. Supply its identity helper lexically,
  // without installing anything on the source window.
  const inspect = () => page.evaluate<ReturnType<typeof observe>>(
    `(() => { const __name = value => value; return (${observe.toString()})(${JSON.stringify(selector)}); })()`);
  const before = await inspect();
  const original = await page.screenshot({ fullPage: true, caret: 'initial' });
  if (sha(original) !== originalSha256) throw Error('transparent-source-frame-original-changed');
  const captureStyle = await page.addStyleTag({ content: 'html, body { background: transparent !important; }' });
  let exclusionStyle: Awaited<ReturnType<Page['addStyleTag']>> | undefined;
  try {
    const after = await inspect();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('transparent-source-frame-component-changed');
    const withContext = await page.screenshot({ fullPage: true, caret: 'initial', omitBackground: true });
    if (before.externalSelectors.length) exclusionStyle = await page.addStyleTag({ content:
      before.externalSelectors.flatMap(s => [s, s + '::before', s + '::after']).join(',') + '{visibility:hidden!important}' });
    const transparent = await page.screenshot({ fullPage: true, caret: 'initial', omitBackground: true });
    const repeat = await page.screenshot({ fullPage: true, caret: 'initial', omitBackground: true });
    if (!transparent.equals(repeat) || JSON.stringify(before) !== JSON.stringify(await inspect()))
      throw Error('transparent-source-frame-capture-unstable');
    const cropped = cropSourceFrame(transparent, before.bounds), full = PNG.sync.read(transparent, { checkCRC: true });
    if (!cropSourceFrame(withContext, before.bounds).bytes.equals(cropped.bytes))
      throw Error('transparent-source-frame-external-contribution');
    const { x, y, width, height } = cropped.crop;
    // A transparent border proves the observed paint is not truncated by the
    // crop. Any other page paint is conservatively refused, even far away.
    for (let row = 0; row < full.height; row++) for (let col = 0; col < full.width; col++) {
      if (full.data[(row * full.width + col) * 4 + 3] &&
          (col <= x || row <= y || col >= x + width - 1 || row >= y + height - 1))
        throw Error('transparent-source-frame-paint-outside-frame');
    }
    return { original, withContext, transparent, bytes: cropped.bytes, receipt: {
      version: 1 as const, kind: 'transparent-source-frame' as const,
      originalSha256, contextSha256: sha(withContext), transparentSha256: sha(transparent), imageSha256: sha(cropped.bytes),
      bounds: before.bounds, crop: cropped.crop, sourceSize: cropped.sourceSize,
      rootOffset: { x: before.bounds.x - x, y: before.bounds.y - y },
      component: before, qualification: 'unqualified' as const,
    } };
  } finally {
    if (exclusionStyle) await exclusionStyle.evaluate(n => n.parentNode!.removeChild(n));
    await captureStyle.evaluate(n => n.parentNode!.removeChild(n));
    if (JSON.stringify(before) !== JSON.stringify(await inspect()) ||
        !(await page.screenshot({ fullPage: true, caret: 'initial' })).equals(original))
      throw Error('transparent-source-frame-original-not-restored');
  }
}
