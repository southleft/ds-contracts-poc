import type { DumpVariableConsumer } from '../extract/figma/types.js';

export interface TemplateSourceToken {
  id: string;
  name: string;
  path: string;
  value: string;
  type: 'dimension' | 'number' | 'color';
  /** Keep the original source alias; value is its independently captured literal. */
  reference?: string;
}

export function fail(why: string): never { throw Error(`FIGMA_SLOT_TEXT_TEMPLATE_READBACK_UNQUALIFIED: ${why}`); }
export const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const exact = (a: unknown, b: number) => typeof a === 'number' && Number.isFinite(a) && (a === b || a === Math.fround(b));
export const equivalent = (a: unknown, b: unknown): boolean => {
  if (typeof b === 'number') return exact(a, b) || typeof a === 'number' && exact(b, a);
  return object(a) && object(b) && ['r', 'g', 'b', 'a'].every(k =>
    typeof (b[k] ?? (k === 'a' ? 1 : undefined)) === 'number' &&
    equivalent(a[k] ?? (k === 'a' ? 1 : undefined), b[k] ?? (k === 'a' ? 1 : undefined)));
};
export const edge = (v: unknown): string | undefined => object(v) && Object.keys(v).sort().join('|') === 'id|type' &&
  v.type === 'VARIABLE_ALIAS' && typeof v.id === 'string' && v.id ? v.id : undefined;
export const pathOf = (name: string) => {
  if (!/^[a-z0-9-]+(?:[/.][a-z0-9-]+)*$/i.test(name) || name.startsWith('dsc-native-template/'))
    fail(`unregistrable source token ${name}`);
  if (name.split(/[/.]/).some(segment => segment === 'prototype' || Object.hasOwn(Object.prototype, segment)))
    fail(`unsafe source token path ${name}`);
  return name.replaceAll('/', '.');
};
export const spell = (c: DumpVariableConsumer, type: TemplateSourceToken['type']) => {
  if (type !== 'color') {
    if (c.resolvedType !== 'FLOAT' || typeof c.value !== 'number' || !Number.isFinite(c.value)) fail('invalid numeric alias value');
    return `${c.value}${type === 'dimension' ? 'px' : ''}`;
  }
  if (c.resolvedType !== 'COLOR' || !object(c.value) || Object.keys(c.value).some(k => !['r','g','b','a'].includes(k))) fail('invalid color alias value');
  const color = c.value as { r: number; g: number; b: number; a?: number };
  const channels = [color.r, color.g, color.b, color.a ?? 1].map(v => {
    if (!Number.isFinite(v) || v < 0 || v > 1 || !exact(v, Math.round(v * 255) / 255))
      fail('source color has no exact captured hex spelling');
    return Math.round(v * 255).toString(16).padStart(2, '0');
  });
  return '#' + channels.slice(0, channels[3] === 'ff' ? 3 : 4).join('');
};

