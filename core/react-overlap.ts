import type {Part} from '../scripts/contract-schema.js';

export function wrapReactOverlap(part: Part, jsx: string): string {
  return part.layout?.overlap && part.tokens?.gap ? `<__DscOverlap>${jsx}</__DscOverlap>` : jsx;
}

/** No extra DOM: measure the current visible flex items, including caller text.
 * Native evidence: negative spacing is capped at the smallest item, globally. */
export const REACT_OVERLAP_RUNTIME = `
import * as __DscReact from 'react';
function __DscOverlap({children}: {children: __DscReact.ReactElement<any>}) {
  const host = __DscReact.useRef<HTMLElement | null>(null);
  const childRef = children.props.ref ?? Object.getOwnPropertyDescriptor(children, 'ref')?.value;
  const ref = __DscReact.useCallback((node: HTMLElement | null) => {
    host.current = node;
    if (typeof childRef === 'function') return childRef(node);
    else if (childRef) childRef.current = node;
  }, [childRef]);
  __DscReact.useLayoutEffect(() => {
    const node = host.current; if (!node) return;
    const saved = new Map<HTMLElement, {left: string; right: string; top: string; bottom: string}>();
    let stopped = false;
    let previous = '';
    let previousItems: HTMLElement[] = [];
    const measured = new WeakMap<Element, {width: number; height: number}>();
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) { const box = entry.borderBoxSize[0]; if (box) { const vertical = getComputedStyle(entry.target).writingMode.startsWith('vertical'); measured.set(entry.target, {width: vertical ? box.blockSize : box.inlineSize, height: vertical ? box.inlineSize : box.blockSize}); } }
      update();
    });
    const update = () => {
      if (stopped) return;
      const style = getComputedStyle(node);
      const raw = style.getPropertyValue('--dsc-overlap-gap').trim();
      const unit = raw.match(/^(-?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+))(px|rem|em)?$/);
      const requested = unit ? Number(unit[1]) * (unit[2] === 'rem' ? parseFloat(getComputedStyle(document.documentElement).fontSize) : unit[2] === 'em' ? parseFloat(style.fontSize) : 1) : NaN;
      if (!Number.isFinite(requested)) return;
      const column = style.flexDirection.startsWith('column');
      const reverse = style.flexDirection.endsWith('reverse');
      const side = column ? (reverse ? 'marginBottom' : 'marginTop') : ((reverse !== (style.direction === 'rtl')) ? 'marginRight' : 'marginLeft');
      const items = Array.from(node.children).filter((child): child is HTMLElement => child instanceof HTMLElement).filter(child => {
        const css = getComputedStyle(child);
        return css.display !== 'none' && css.position !== 'absolute' && css.position !== 'fixed';
      });
      const sizes = items.map(child => {const cached = measured.get(child); if(cached) return column ? cached.height : cached.width; const css = getComputedStyle(child); const axis = column ? 'height' : 'width'; let size = parseFloat(css[axis]); if (css.boxSizing !== 'border-box') size += column ? parseFloat(css.paddingTop)+parseFloat(css.paddingBottom)+parseFloat(css.borderTopWidth)+parseFloat(css.borderBottomWidth) : parseFloat(css.paddingLeft)+parseFloat(css.paddingRight)+parseFloat(css.borderLeftWidth)+parseFloat(css.borderRightWidth); return size;});
      const signature = JSON.stringify([requested, side, sizes]);
      if (signature === previous && items.length === previousItems.length && items.every((item,i)=>item===previousItems[i])) return;
      previous = signature; previousItems = items;
      for (const child of items) {
        if (!saved.has(child)) { saved.set(child, {left: child.style.marginLeft, right: child.style.marginRight, top: child.style.marginTop, bottom: child.style.marginBottom}); observer.observe(child); }
        child.style.marginLeft = child.style.marginRight = child.style.marginTop = child.style.marginBottom = '0px';
      }
      const minimum = Math.min(...sizes);
      const gap = Math.max(requested, -minimum);
      items.forEach((child, i) => { child.style[side] = i ? gap + 'px' : '0px'; });
    };
    update(); observer.observe(node);
    const mutations = new MutationObserver(update);
    mutations.observe(node, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style','class','hidden','dir']});
    for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) mutations.observe(ancestor, {attributes: true, attributeFilter: ['style','class','dir']});
    if (document.head) mutations.observe(document.head, {childList: true, subtree: true, characterData: true});
    return () => { stopped = true; observer.disconnect(); mutations.disconnect(); for (const [child, old] of saved) { child.style.marginLeft = old.left; child.style.marginRight = old.right; child.style.marginTop = old.top; child.style.marginBottom = old.bottom; } };
  });
  return __DscReact.cloneElement(children, {ref});
}
`;
