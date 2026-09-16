import type { Part } from '../../scripts/contract-schema.js';
import type { CapturedNode } from './lib.js';

export interface OrderedContentObservation {
  node: CapturedNode;
  /** One name for each immediate element, in this observation's DOM order. */
  elementParts: string[];
}

/** CSS flex creates an anonymous item for each contiguous text run. Preserve
 * those items beside element parts instead of concatenating all text before
 * all children. These are layout parts, not new source elements or public APIs.
 * A host-proven component boundary can opt in for a single text item too, so
 * its box remains independently addressable. No measured box is copied into a
 * reusable dimension. */
export function preserveOrderedFlexText(
  part: Part,
  observations: OrderedContentObservation[],
  name: string,
  usedNames: Set<string>,
  preserveBoundary = false,
): { changed: boolean; problem?: string } {
  if (!observations.length || (!part.content && part.text === undefined) || (!part.parts && !preserveBoundary))
    return { changed: false };
  const sequence = ({ node, elementParts }: OrderedContentObservation) => {
    const items: Array<{ text: string } | { element: string }> = [];
    let text = '', element = 0;
    const flush = () => {
      // Only CSS collapsible whitespace; NBSP and other content must survive.
      const value = text.replace(/[\t\n\f\r ]+/g, ' ').replace(/^ | $/g, '');
      if (value) items.push({ text: value });
      text = '';
    };
    for (const child of node.nodes) {
      if (child.t === 'text') text += child.v;
      else { flush(); items.push({ element: elementParts[element++] }); }
    }
    flush();
    return element === elementParts.length && items.every(i => 'text' in i || typeof i.element === 'string') ? items : null;
  };
  const refuse = (reason: string) => ({ changed: false, problem: `ordered-text-${reason}: ${name}` });
  const sequences = observations.map(sequence);
  if (sequences.some(s => !s)) return refuse('element-join-unqualified');
  const ordered = sequences[0]!;
  const shape = (s: NonNullable<typeof ordered>) => s.map(i => 'text' in i ? { text: true } : i);
  if (sequences.some(s => JSON.stringify(shape(s!)) !== JSON.stringify(shape(ordered))))
    return refuse('sequence-varies');
  if (!preserveBoundary && !ordered.some(i => 'element' in i)) return { changed: false };
  const runs = ordered.filter(i => 'text' in i);
  // The ordinary root/part content spelling is already faithful in this case.
  if (!runs.length || (!preserveBoundary && runs.length === 1 && 'text' in ordered[0])) return { changed: false };
  if (observations.some(({ node }) => !['flex', 'inline-flex'].includes(node.style.display) ||
      !(node.style['white-space-collapse'] === 'collapse' || ['normal', 'nowrap'].includes(node.style['white-space'])) ||
      (node.style['white-space'] && !['normal', 'nowrap'].includes(node.style['white-space'])) ||
      (node.style['white-space-collapse'] && node.style['white-space-collapse'] !== 'collapse')))
    return refuse('flow-unqualified');
  if (observations.some(o => JSON.stringify(sequence(o)) !== JSON.stringify(ordered)))
    return refuse('sequence-varies');
  const elementNames = ordered.flatMap(i => 'element' in i ? [i.element] : []);
  if (new Set(elementNames).size !== elementNames.length ||
      Object.keys(part.parts ?? {}).length !== elementNames.length || elementNames.some(n => !Object.hasOwn(part.parts!, n)))
    return refuse('element-join-unqualified');
  if ((part.content || part.textByProp) && runs.length !== 1)
    return refuse('binding-spans-elements');
  const children: Record<string, Part> = {};
  let textIndex = 0;
  for (const item of ordered) {
    if ('element' in item) { children[item.element] = part.parts![item.element]; continue; }
    let childName = `${name}-text-${++textIndex}`;
    while (usedNames.has(childName)) childName += '-run';
    usedNames.add(childName);
    children[childName] = part.content ? { content: structuredClone(part.content) }
      : { text: item.text, ...(part.textByProp ? { textByProp: structuredClone(part.textByProp) } : {}) };
  }
  delete part.text; delete part.content; delete part.textByProp;
  part.parts = children;
  return { changed: true };
}
