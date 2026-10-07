import { flattenTokens, makeResolveLiteral } from './tokens.js';
import type { Contract, Part } from '../scripts/contract-schema.js';

/** A path-only component is one graphic. Nested SVG viewports preserve the
 * original coordinate planes, including live CSS token dimensions. No bounds
 * are inferred from the path, and unhandled layout/behavior keeps its existing
 * DOM renderer. This projection does not modify the contract or native plan. */
export function reactComposedPath(
  contract: Contract,
  codeProp: (name: string) => string,
  resolveToken?: (path: string) => string | number,
  tokenValues?: unknown,
): string | undefined {
  const root = contract.anatomy.root;
  if (!root || Object.keys(contract.anatomy).length !== 1 || contract.events?.length || contract.states.length) return;
  const rootKeys = new Set(['parts', 'tokens', 'literals', 'declared', 'instanceRootInputs']);
  if (Object.keys(root).some(key => !rootKeys.has(key)) || !root.parts) return;
  const rootStyle = { ...root.tokens, ...root.literals, ...root.declared };
  if (!rootStyle.width || !rootStyle.height || rootStyle.position !== 'relative' ||
      Object.keys(rootStyle).some(key => !['width','height','position','opacity','overflow'].includes(key))) return;
  // SVG translation and scale need definite lengths; percentages and auto
  // would depend on a containing block this projection does not reproduce.
  const record=(v:unknown):Record<string,unknown> => v && typeof v==='object' && !Array.isArray(v) ? v as Record<string,unknown> : {};
  const trees=record(tokenValues),brands=record(trees.brands);
  const resolvers=resolveToken ? [resolveToken] : (Object.keys(brands).length ? Object.values(brands) : [{}]).flatMap(brand =>
    [trees.light,trees.dark].map(mode => makeResolveLiteral(new Map([
      ...flattenTokens(record(trees.primitives)),...flattenTokens(record(brand)),
      ...flattenTokens(record(trees.semantic)),...flattenTokens(record(mode)),
    ]))));
  const definite=(v:unknown)=>typeof v==='number' ? Number.isFinite(v) && (resolveToken !== undefined || v === 0) : typeof v==='string' && /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px)$|^0$/.test(v);
  if (Object.values(root.parts).some(part=>part.shape)) return;
  let tuples: Record<string, string | boolean>[] = [{}];
  for (const prop of contract.props) {
    const options = typeof prop.type === 'object' && 'enum' in prop.type ? prop.type.enum : prop.type === 'boolean' ? [false, true] : undefined;
    if (!options || prop.default === undefined || tuples.length * options.length > 128) return;
    tuples = tuples.flatMap(tuple => options.map(value => ({ ...tuple, [prop.name]: value })));
  }
  const keys = new Set(['parts','tokens','literals','declared','shape','visibleWhen']);
  let failed = false;
  const variants = tuples.map(tuple => {
    const value = (raw: string, length = false, size = false): string => {
      const substituted = raw.replace(/\{([\w-]+)\}/g, (match, name: string) => name in tuple ? String(tuple[name]) : match);
      const ref = substituted.match(/^\{([^{}]+)\}$/);
      if (ref) {
        if (length) { try { if (resolvers.some(resolve => !definite(resolve(ref[1])) || size && Number.parseFloat(String(resolve(ref[1]))) < 0)) failed=true; } catch { failed=true; } }
        if (!resolveToken) return `var(--${ref[1].replace(/\./g, '-')})`;
        const resolved = resolveToken(ref[1]);
        return typeof resolved === 'number' && length ? `${resolved}px` : String(resolved);
      }
      if (/[{}]/.test(substituted) || length && (!definite(substituted) || size && Number.parseFloat(substituted) < 0)) failed = true;
      return substituted;
    };
    let count = 0;
    const visit = (part: Part, siblings: number, parentSize: {width:string;height:string}): string => {
      if (Object.keys(part).some(key => !keys.has(key))) { failed = true; return ''; }
      if (part.visibleWhen) {
        const actual = tuple[part.visibleWhen.prop], expected = part.visibleWhen.equals;
        if (!(part.visibleWhen.prop in tuple)) failed = true;
        if (!(expected === undefined ? actual === true : Array.isArray(expected) ? expected.includes(String(actual)) : actual === expected)) return '';
      }
      const style = { ...part.tokens, ...part.literals, ...part.declared };
      if (part.shape) {
        const shape = part.shape;
        if (shape.kind !== 'path' || part.parts || Object.keys(style).some(key => !['background-color','position','opacity'].includes(key)) ||
            style.position !== 'absolute' || !style['background-color']) { failed = true; return ''; }
        const geometry = shape.pathsByProp ? shape.pathsByProp.map[String(tuple[shape.pathsByProp.prop])] : shape;
        const viewport = geometry?.parentViewport;
        if (!geometry?.paths || !viewport) { failed = true; return ''; }
        count++;
        const paths = geometry.paths.map(path => `<path d={${JSON.stringify(path.data)}} fillRule="${path.windingRule === 'EVENODD' ? 'evenodd' : 'nonzero'}" />`).join('');
        return `<svg x="0" y="0" width="${viewport.width}" height="${viewport.height}" viewBox="0 0 ${viewport.width} ${viewport.height}" preserveAspectRatio="none" overflow="hidden" style={${JSON.stringify({transform:`scale(calc(${value(parentSize.width,true,true)} / ${viewport.width}px), calc(${value(parentSize.height,true,true)} / ${viewport.height}px))`,transformOrigin:'0 0',fill:value(style['background-color']),opacity:style.opacity ? value(style.opacity) : undefined})}}><g transform="translate(${viewport.x} ${viewport.y})">${paths}</g></svg>`;
      }
      if (!part.parts || !style.width || !style.height || style.overflow && style.overflow !== 'visible' ||
          Object.keys(style).some(key => !['position','left','top','width','height','opacity','overflow'].includes(key)) ||
          !(style.position === 'absolute' || style.position === 'relative' && siblings === 1 && !style.left && !style.top)) { failed = true; return ''; }
      value(style.width,true,true); value(style.height,true,true);
      const children = Object.values(part.parts);
      return `<g style={${JSON.stringify({transform:`translate(${value(style.left ?? '0',true)}, ${value(style.top ?? '0',true)})`,opacity:style.opacity ? value(style.opacity) : undefined})}}>${children.map(child => visit(child,children.length,{width:style.width,height:style.height})).join('')}</g>`;
    };
    const children = Object.values(root.parts!);
    const content = children.map(part => visit(part,children.length,{width:rootStyle.width,height:rootStyle.height})).join('');
    if (!count) failed = true;
    return `<svg aria-hidden="true" width="100%" height="100%" style={{display:'block',overflow:'visible'}}>${content}</svg>`;
  });
  if (failed) return;
  // Invalid inputs must not silently substitute another variant's geometry.
  const choices = tuples.map((tuple,index) => ({
    condition:Object.entries(tuple).map(([name,value]) => `${codeProp(name)} === ${JSON.stringify(value)}`).join(' && ') || 'true',
    jsx:variants[index],
  }));
  return `{${choices.map(choice => `${choice.condition} ? (${choice.jsx}) : `).join('')}null}`;
}
