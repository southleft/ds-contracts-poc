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
    let textAbsence: SourceObservation['textAbsence'];
    if (p.textContent === 'absent') {
      const problems: string[] = [];
      const pending: Node[] = element ? [element] : [];
      let inspectedNodes = 0;
      if (!element) problems.push('text-absence-root-missing');
      while (pending.length) {
        const node = pending.pop()!;
        if (++inspectedNodes > 10_000) { problems.push('text-absence-scope-too-large'); break; }
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) problems.push('unexpected-source-text');
        if (node instanceof Element) {
          // Closed/custom rendering and browser-generated form text cannot be
          // established absent from ordinary light DOM. Refuse that scope.
          if (node.shadowRoot || node.localName.includes('-') || node.hasAttribute('is') ||
              ['slot','input','textarea','select','option','canvas','iframe','object','embed','video','audio','use','foreignObject'].includes(node.localName) ||
              !['http://www.w3.org/1999/xhtml','http://www.w3.org/2000/svg'].includes(node.namespaceURI ?? ''))
            problems.push('text-absence-scope-unavailable');
          const style = getComputedStyle(node);
          if (style.display === 'list-item') problems.push('text-absence-generated-content');
          if (!['','none','normal','""',"''"].includes(style.content.trim())) problems.push('text-absence-generated-content');
          for (const pseudo of ['::before','::after']) {
            const content = getComputedStyle(node,pseudo).content.trim();
            if (!['','none','normal','""',"''"].includes(content)) problems.push('text-absence-generated-content');
          }
        }
        // Count all DOM nodes, including hidden text; an empty innerText alone
        // cannot establish that the source intentionally has no text content.
        if (pending.length + inspectedNodes + node.childNodes.length > 10_000) { problems.push('text-absence-scope-too-large'); break; }
        pending.push(...node.childNodes);
      }
      textAbsence = {status:problems.length ? 'refused' : 'observed',inspectedNodes,problems:[...new Set(problems)]};
    }
    // innerText includes the actual rendered text; slots need assigned content too.
    const slotText = element ? [...element.querySelectorAll('slot')]
      .flatMap(s => s.assignedNodes({flatten:true})).map(n => n.textContent ?? '').join(' ') : '';
    return {
      found: !!element,
      visible: !!element && element.checkVisibility({checkOpacity:true, checkVisibilityCSS:true}),
      width: rect?.width ?? 0, height: rect?.height ?? 0,
      text: associatedLabel ? associatedLabel.text : ((element as HTMLElement | null)?.innerText ?? element?.textContent ?? '') + slotText,
      ...(textAbsence ? {textAbsence} : {}),
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
  const nativeText: string[] = [];
  try {
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const expression = `(() => { let root = document, element = null; for (const s of ${JSON.stringify(profile.associatedLabelText === undefined ? profile.fontPath ?? profile.path : profile.path)}) { element = root?.querySelector(s); root = element?.shadowRoot; } return ${profile.associatedLabelText === undefined ? 'element' : 'element?.labels?.length === 1 ? element.labels[0] : null'}; })()`;
    const { result } = await cdp.send('Runtime.evaluate', {expression,objectGroup:'dsc-source-fonts'});
    if (!result.objectId && profile.textContent === 'absent' && observed.textAbsence) {
      // A disappearing root is unavailable evidence, not a zero-glyph result.
      observed.textAbsence.status = 'refused';
      observed.textAbsence.problems.push('text-absence-scope-unavailable');
    }
    if (result.objectId) {
      await cdp.send('DOM.getDocument', {depth:-1, pierce:true});
      const { nodeId } = await cdp.send('DOM.requestNode', {objectId:result.objectId});
      if (profile.textContent === 'absent' && observed.textAbsence?.status === 'observed') {
        // Element.shadowRoot cannot reveal a closed shadow tree on an ordinary
        // host such as <span>. Chromium's DOM protocol exposes that boundary.
        const described = await cdp.send('DOM.describeNode', {nodeId,depth:-1,pierce:true});
        const pending = [described.node];
        let count = 0;
        while (pending.length) {
          const node = pending.pop()!;
          let problem: string | undefined;
          if (++count > 10_000 || count + pending.length + (node.children?.length ?? 0) > 10_000)
            problem = 'text-absence-scope-too-large';
          else if (node.shadowRoots?.length || node.contentDocument ||
              (node.childNodeCount ?? 0) !== (node.children?.length ?? 0))
            problem = 'text-absence-scope-unavailable';
          if (problem) {
            observed.textAbsence.status = 'refused';
            observed.textAbsence.problems.push(problem);
            break;
          }
          pending.push(...node.children ?? []);
        }
      }
      const resultFonts = await cdp.send('CSS.getPlatformFontsForNode', {nodeId});
      if (profile.textContent !== 'absent') {
        // Chromium's element census descends only two layout-object levels.
        // Read the actual TextNodes as well, so wrappers cannot hide a fallback
        // font. The protocol tree keeps the scope at this root, including its
        // shadow trees; no document-wide text or CSS-family inference is used.
        const described = await cdp.send('DOM.describeNode', {nodeId,depth:-1,pierce:true});
        const pending = [described.node];
        const nativeSeen = new Set<number>();
        let count = 0, complete = true;
        while (pending.length) {
          const node = pending.pop()!;
          if (++count > 10_000) { complete = false; break; }
          if ((node.childNodeCount ?? 0) !== (node.children?.length ?? 0)) { complete = false; break; }
          pending.push(...node.children ?? [], ...node.shadowRoots ?? []);
          // Native input ink is not a DOM Text node. Read only known textual
          // input types, within the selected source, and require this exact
          // control's painted glyphs before admitting its value as a witness.
          // No arbitrary .value getter, password, or fabricated void child.
          if (profile.associatedLabelText === undefined && node.nodeType === 1 &&
              node.localName === 'input' && !nativeSeen.has(node.backendNodeId)) {
            nativeSeen.add(node.backendNodeId);
            const {object} = await cdp.send('DOM.resolveNode', {backendNodeId:node.backendNodeId,objectGroup:'dsc-source-fonts'});
            if (!object.objectId) { complete = false; break; }
            const ink = await cdp.send('Runtime.callFunctionOn', {
              objectId:object.objectId,returnByValue:true,arguments:[{value:profile.path}],functionDeclaration:`function(path) {
                if (!(this instanceof HTMLInputElement) || !this.isConnected || this.hasAttribute('is')) return null;
                const type = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'type').get.call(this);
                if (!['text','search','email','url','tel'].includes(type)) return null;
                let scope = document, selected = null;
                for (const selector of path) { selected = scope?.querySelector(selector); scope = selected?.shadowRoot; }
                let ancestor = this;
                while (ancestor && ancestor !== selected) {
                  const root = ancestor.getRootNode();
                  if (root instanceof ShadowRoot && root.mode !== 'open') return null;
                  ancestor = ancestor.assignedSlot || ancestor.parentElement || root.host || null;
                }
                if (!selected || ancestor !== selected || !this.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})) return null;
                const rect = this.getBoundingClientRect();
                if (!(rect.width > 0 && rect.height > 0)) return null;
                // Font enumeration is not a clipping proof. Refuse masks and
                // displaced/clipped text rather than counting hidden glyphs.
                for (let current = this; current; current = current.assignedSlot || current.parentElement || current.getRootNode().host || null) {
                  const css = getComputedStyle(current);
                  if (!['none',''].includes(css.clipPath) || !['none',''].includes(css.maskImage) || !['auto',''].includes(css.clip)) return null;
                  if (current !== this) {
                    const clip = current.getBoundingClientRect();
                    if (['hidden','clip','auto','scroll'].includes(css.overflowX) &&
                        (rect.left < clip.left + current.clientLeft || rect.right > clip.left + current.clientLeft + current.clientWidth)) return null;
                    if (['hidden','clip','auto','scroll'].includes(css.overflowY) &&
                        (rect.top < clip.top + current.clientTop || rect.bottom > clip.top + current.clientTop + current.clientHeight)) return null;
                  }
                }
                let value = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').get.call(this);
                const placeholder = value === '';
                if (placeholder) {
                  if (!this.matches(':placeholder-shown')) return null;
                  value = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'placeholder').get.call(this);
                }
                if (!value.trim()) return null;
                const style = getComputedStyle(this, placeholder ? '::placeholder' : null);
                if (!(parseFloat(style.fontSize) > 0) || style.visibility !== 'visible' || style.textTransform !== 'none' ||
                    style.opacity === '0' || parseFloat(style.textIndent) !== 0 ||
                    this.scrollLeft !== 0 || this.scrollWidth > this.clientWidth + 1 ||
                    !['none',''].includes(getComputedStyle(this).webkitTextSecurity)) return null;
                const color = style.webkitTextFillColor || style.color;
                if (!/^rgb(a)?\\(/.test(color) || /^rgba\\([^,]+,[^,]+,[^,]+,\\s*0(?:\\.0*)?\\)$/.test(color)) return null;
                return value;
              }`,
            });
            if (ink.exceptionDetails) { complete = false; break; }
            if (typeof ink.result.value === 'string') {
              const {nodeId:inputId} = await cdp.send('DOM.requestNode', {objectId:object.objectId});
              const fonts = await cdp.send('CSS.getPlatformFontsForNode', {nodeId:inputId});
              if (!fonts.fonts.some(font => font.glyphCount > 0)) { complete = false; break; }
              nativeText.push(ink.result.value);
              resultFonts.fonts.push(...fonts.fonts);
            }
          }
          if (node.nodeType !== 3 || !node.nodeValue.trim()) continue;
          const {object} = await cdp.send('DOM.resolveNode', {backendNodeId:node.backendNodeId,objectGroup:'dsc-source-fonts'});
          if (!object.objectId) { complete = false; break; }
          const visible = await cdp.send('Runtime.callFunctionOn', {
            objectId:object.objectId,returnByValue:true,functionDeclaration:`function() {
              if (!(this instanceof Text) || !this.isConnected) return null;
              const parent = this.parentElement ?? this.getRootNode().host;
              if (!parent || getComputedStyle(parent).visibility !== 'visible') return false;
              for (let element = parent; element;) {
                const style = getComputedStyle(element);
                if (style.display === 'none' || style.opacity === '0' || style.contentVisibility === 'hidden') return false;
                element = element.parentElement ?? element.getRootNode().host ?? null;
              }
              const range = document.createRange(); range.selectNodeContents(this);
              return [...range.getClientRects()].some(rect => rect.width > 0 && rect.height > 0);
            }`,
          });
          if (visible.exceptionDetails || typeof visible.result.value !== 'boolean') { complete = false; break; }
          if (!visible.result.value) continue;
          const {nodeId:textNodeId} = await cdp.send('DOM.requestNode', {objectId:object.objectId});
          const fonts = await cdp.send('CSS.getPlatformFontsForNode', {nodeId:textNodeId});
          // A known sibling must not mask missing evidence for rendered text.
          if (!fonts.fonts.some(font => font.glyphCount > 0)) { complete = false; break; }
          resultFonts.fonts.push(...fonts.fonts);
        }
        if (!complete) { resultFonts.fonts = []; nativeText.length = 0; }
      }
      // Retain legacy observation bytes unless the authored profile requests
      // origin evidence. Absence is never inferred to mean a painted web font.
      const seen = new Set<string>();
      platformFonts = resultFonts.fonts.map(({familyName, glyphCount, isCustomFont}) => ({
        familyName, glyphCount,
        ...(profile.fontOrigin === 'web' && typeof isCustomFont === 'boolean' ? {isCustomFont} : {}),
      })).filter(font => {
        // Root/descendant censuses overlap. Retain actual rows, never add their
        // glyph counts as though they described disjoint text.
        const key = JSON.stringify(font);
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
    }
  } finally {
    await cdp.send('Runtime.releaseObjectGroup', {objectGroup:'dsc-source-fonts'}).catch(() => {});
    await cdp.detach();
  }
  return {...observed, text:[observed.text,...nativeText].filter(Boolean).join('\n'), platformFonts,
    failedResources:[...failures.failedResources], runtimeErrors:[...failures.runtimeErrors]};
}
