import type { Page } from 'playwright-core';
import type { SourceObservation, SourceProfile } from './check.js';

/** Install before navigation. URLs are deliberately omitted: they can contain secrets. */
export function watchSourceFailures(page: Page) {
  const failedResources: string[] = [];
  const runtimeErrors: string[] = [];
  const failed = (r: import('playwright-core').Request) => failedResources.push(`network:${r.resourceType()}`);
  const response = (r: import('playwright-core').Response) => {
    if (r.status() >= 400) failedResources.push(`http-${r.status()}:${r.request().resourceType()}`);
  };
  const error = () => runtimeErrors.push('uncaught-page-error');
  page.on('requestfailed', failed);
  page.on('response', response);
  page.on('pageerror', error);
  return { failedResources, runtimeErrors, dispose() {
    page.off('requestfailed', failed); page.off('response', response); page.off('pageerror', error);
  } };
}

export async function observeSource(page: Page, profile: SourceProfile,
  failures: Pick<SourceObservation, 'failedResources' | 'runtimeErrors'>): Promise<SourceObservation> {
  const observed = await page.evaluate((p) => {
    let root: Document | ShadowRoot | null = document;
    let element: Element | null = null;
    for (const selector of p.path) {
      element = root?.querySelector(selector) ?? null;
      root = element?.shadowRoot ?? null;
    }
    const labels = element && 'labels' in element ? Array.from((element as HTMLInputElement).labels ?? []) : [];
    const label = labels.length === 1 ? labels[0] : null;
    const associated = !!element && !!label && label.control === element &&
      (!element.id || [...(element.getRootNode() as Document | ShadowRoot).querySelectorAll('[id]')].filter(n => n.id === element!.id).length === 1);
    const labelBounds = label?.getBoundingClientRect();
    const associatedLabel = p.associatedLabelText === undefined ? undefined : {
      text: label?.innerText.trim() ?? '',
      visible: !!label && !!labelBounds && labelBounds.width > 0 && labelBounds.height > 0 && label.checkVisibility({checkOpacity:true, checkVisibilityCSS:true}),
      associated,
    };
    const css = element ? getComputedStyle(element) : null;
    const rect = element?.getBoundingClientRect();
    // innerText includes the actual rendered text; slots need assigned content too.
    const slotText = element ? [...element.querySelectorAll('slot')]
      .flatMap(s => s.assignedNodes({flatten:true})).map(n => n.textContent ?? '').join(' ') : '';
    return {
      found: !!element,
      visible: !!element && element.checkVisibility({checkOpacity:true, checkVisibilityCSS:true}),
      width: rect?.width ?? 0, height: rect?.height ?? 0,
      text: associatedLabel ? associatedLabel.text : ((element as HTMLElement | null)?.innerText ?? element?.textContent ?? '') + slotText,
      ...(associatedLabel ? {associatedLabel} : {}),
      styles: Object.fromEntries(Object.keys(p.requiredStyles).map(k => [k, css?.getPropertyValue(k).trim() ?? ''])),
      tokens: Object.fromEntries(Object.keys(p.requiredTokens).map(k => [k, css?.getPropertyValue(k).trim() ?? ''])),
      fontsReady: document.fonts.status === 'loaded',
      probes: Object.fromEntries(Object.entries(p.probes ?? {}).map(([name, probe]) => {
        let scope: Document | ShadowRoot | null = document;
        let target: Element | null = null;
        for (const selector of probe.path) {
          target = scope?.querySelector(selector) ?? null;
          scope = target?.shadowRoot ?? null;
        }
        const style = target ? getComputedStyle(target) : null;
        const bounds = target?.getBoundingClientRect();
        return [name, {
          found: !!target,
          visible: !!target && !!bounds && bounds.width > 0 && bounds.height > 0 && target.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),
          styles: Object.fromEntries(Object.keys(probe.styles ?? {}).map(k => [k, style?.getPropertyValue(k).trim() ?? ''])),
          properties: Object.fromEntries(Object.keys(probe.properties ?? {}).map(k => {
            const value = target ? Reflect.get(target, k) : null;
            return [k, ['string','number','boolean'].includes(typeof value) ? value : null];
          })),
        }];
      })),
    };
  }, profile);
  // fonts.check alone can return true when a family is absent and fallback is used.
  // Ask Chromium which fonts actually painted the target, including shadow content.
  const cdp = await page.context().newCDPSession(page);
  let platformFonts: SourceObservation['platformFonts'] = [];
  try {
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const expression = `(() => { let root = document, element = null; for (const s of ${JSON.stringify(profile.associatedLabelText === undefined ? profile.fontPath ?? profile.path : profile.path)}) { element = root?.querySelector(s); root = element?.shadowRoot; } return ${profile.associatedLabelText === undefined ? 'element' : 'element?.labels?.length === 1 ? element.labels[0] : null'}; })()`;
    const { result } = await cdp.send('Runtime.evaluate', {expression});
    if (result.objectId) {
      await cdp.send('DOM.getDocument', {depth:-1, pierce:true});
      const { nodeId } = await cdp.send('DOM.requestNode', {objectId:result.objectId});
      const resultFonts = await cdp.send('CSS.getPlatformFontsForNode', {nodeId});
      platformFonts = resultFonts.fonts.map(({familyName, glyphCount}) => ({familyName, glyphCount}));
      await cdp.send('Runtime.releaseObject', {objectId:result.objectId});
    }
  } finally { await cdp.detach(); }
  return {...observed, platformFonts, failedResources:[...failures.failedResources], runtimeErrors:[...failures.runtimeErrors]};
}
