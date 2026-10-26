import type { DumpNode } from '../extract/figma/types.js';

export const sourcePaintEvidenceFields = ['sourceFillStack', 'sourceStrokeStack', 'sourceStrokePattern'];
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, any>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));

export function emptySourcePaintStack(stack: unknown): boolean {
  return stack === undefined || (object(stack) && keys(stack, ['version', 'order', 'complete', 'paints']) &&
    stack.version === 1 && stack.order === 'bottom-to-top' && stack.complete === true &&
    Array.isArray(stack.paints) && stack.paints.length === 0);
}

export function emptySourceStrokePattern(pattern: unknown): boolean {
  return pattern === undefined || (object(pattern) && keys(pattern, ['version', 'complete', 'dashes', 'defaulted']) &&
    pattern.version === 1 && pattern.complete === true && Array.isArray(pattern.dashes) && pattern.dashes.length === 0 &&
    (!Object.hasOwn(pattern, 'defaulted') || pattern.defaulted === true));
}

/** Validate raw capture before any carrier aliases are projected to original
 * token names. The projection must not erase a conflicting paint or binding. */
export function templateSourcePaintMatches(node: DumpNode): boolean {
  if (!emptySourcePaintStack(node.sourceStrokeStack) || !emptySourceStrokePattern(node.sourceStrokePattern)) return false;
  const stack = node.sourceFillStack;
  if (stack === undefined) return true; // Historical captures did not carry this plane.
  if (!object(stack) || !keys(stack, ['version', 'order', 'complete', 'paints']) ||
      stack.version !== 1 || stack.order !== 'bottom-to-top' || stack.complete !== true ||
      !Array.isArray(stack.paints) || stack.paints.length !== 1) return false;
  const entry = stack.paints[0];
  if (!object(entry) || !keys(entry, ['index', 'paint']) || entry.index !== 0 || !object(entry.paint)) return false;
  const paint = entry.paint;
  if (!keys(paint, ['type', 'color', 'opacity', 'visible', 'blendMode', 'boundVariables']) || paint.type !== 'SOLID' ||
      (paint.visible !== undefined && paint.visible !== true) || (paint.opacity === undefined ? 1 : paint.opacity) !== 1 ||
      (paint.blendMode === undefined ? 'NORMAL' : paint.blendMode) !== 'NORMAL' || !object(paint.color) || !keys(paint.color, ['r', 'g', 'b', 'a']) ||
      !object(paint.boundVariables) || Object.keys(paint.boundVariables).join('|') !== 'color') return false;
  const alias = paint.boundVariables.color;
  if (!object(alias) || !keys(alias, ['type', 'id']) || alias.type !== 'VARIABLE_ALIAS' || typeof alias.id !== 'string' || !alias.id) return false;
  const consumer = node.variableConsumers?.[alias.id];
  if (!consumer || consumer.resolvedType !== 'COLOR' || consumer.name !== node.fill?.var ||
      consumer.name !== node.text?.fillVar || !object(consumer.value) || !keys(consumer.value, ['r', 'g', 'b', 'a'])) return false;
  // A bound paint retains its literal fallback when the selected variable
  // changes. The exact alias selects the live color; later template/graph
  // validation corroborates that consumer against the token source.
  return ['r', 'g', 'b', 'a'].every(key => {
    const actual = paint.color[key] === undefined && key === 'a' ? 1 : paint.color[key];
    const raw = (consumer.value as Record<string, unknown>)[key];
    const expected = raw === undefined && key === 'a' ? 1 : raw;
    return typeof actual === 'number' && Number.isFinite(actual) && actual >= 0 && actual <= 1 &&
      typeof expected === 'number' && Number.isFinite(expected) && expected >= 0 && expected <= 1;
  });
}
