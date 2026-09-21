import type { DumpSet, DumpVariableConsumer } from '../extract/figma/types.js';
import type { TokenCorpus } from './token-corpus.js';
import { canonicalJson } from './contract-provenance.js';
import { px } from './tokens.js';
import { projectRootTextTemplateAliases } from './figma-template-aliases.js';

/** Bound typography requires corroborated consuming values. The reserved
 * compiler carrier projection additionally validates every selected edge. */
export function validateRootTextTemplates(set: DumpSet, corpus: TokenCorpus, capturedValues?: Map<string, string>): { family: string; normalized?: DumpSet } {
  const projection = projectRootTextTemplateAliases(set);
  if (projection) set = projection.set;
  const fail = (why: string): never => { throw Error(`FIGMA_SLOT_TEXT_TEMPLATE_READBACK_UNQUALIFIED: ${why}`); };
  const fields = new Set(['name', 'type', 'hidden', 'text', 'fill', 'variableConsumers']);
  const textFields = new Set(['characters', 'fontSize', 'fontWeight', 'fontStyle', 'fontFamily', 'lineHeight', 'letterSpacing',
    'textAutoResize', 'fontSizeVar', 'fontWeightVar', 'lineHeightVar', 'fillVar', 'textCase', 'textAlign']);
  const byName = new Map<string, string>(), modes = new Map<string, string>();
  let family: string | undefined, declared: string | undefined;
  const exact = (actual: unknown, expected: number) => actual === expected || actual === Math.fround(expected);
  const literal = (name: string): unknown => {
    const path = name.replaceAll('/', '.');
    if (capturedValues?.has(path)) return capturedValues.get(path);
    try { return corpus.resolveLiteral(path); } catch { return fail(`unresolved token ${name}`); }
  };
  const number = (name: string) => {
    try { const v = px(literal(name)); if (Number.isFinite(v)) return v; } catch { /* named below */ }
    return fail(`non-numeric token ${name}`);
  };
  const color = (name: string, consumer: DumpVariableConsumer) => {
    const value = literal(name);
    if (typeof value !== 'string' || !/^#[\da-f]{6}([\da-f]{2})?$/i.test(value))
      return fail(`color token ${name} needs a captured hex value`);
    const c = consumer.value;
    if (!c || typeof c !== 'object' || !['r','g','b'].every((key, i) => exact(c[key as 'r'|'g'|'b'], parseInt(value.slice(1 + i * 2, 3 + i * 2), 16) / 255)) ||
        !exact(c.a ?? 1, value.length === 9 ? parseInt(value.slice(7, 9), 16) / 255 : 1))
      return fail(`color token ${name} disagrees with its consuming value`);
  };
  for (const root of set.variants) {
    const node = root.children?.[0].children?.[0], t = node?.text;
    if (!node || !t || Object.keys(node).some(key => !fields.has(key)) || Object.keys(t).some(key => !textFields.has(key)) ||
        t.textAutoResize !== 'WIDTH_AND_HEIGHT' || !t.fontFamily?.trim() || !t.fontStyle?.trim() ||
        !Number.isFinite(t.fontSize) || t.fontSize <= 0 || !Number.isFinite(t.lineHeight) || t.lineHeight! <= 0 ||
        !Number.isFinite(t.letterSpacing) || !t.fontSizeVar || !t.fontWeightVar || !t.lineHeightVar || !t.fillVar ||
        !node.fill || Object.keys(node.fill).join('|') !== 'var' || node.fill.var !== t.fillVar)
      return fail(`${root.name}: unsupported or incomplete template typography`);
    const signature = canonicalJson([t.fontFamily, t.textCase ?? 'ORIGINAL', t.textAlign ?? 'LEFT', /italic/i.test(t.fontStyle)]);
    if (declared !== undefined && declared !== signature) return fail('declared typography differs across variants');
    declared = signature; family = t.fontFamily;
    const entries = Object.entries(node.variableConsumers ?? {});
    const names = new Set([t.fontSizeVar, t.fontWeightVar, t.lineHeightVar, t.fillVar]);
    if ((!projection && names.size !== 4) || entries.length !== names.size || entries.some(([, c]) => !names.has(c.name))) return fail('missing or extra consuming bindings');
    for (const name of names) {
      const matches = entries.filter(([, c]) => c.name === name);
      if (matches.length !== 1) return fail(`ambiguous consumer ${name}`);
      const [id, c] = matches[0];
      if (!id || !c.collectionId || !c.modeId || !c.modeName || canonicalJson(c.selectedValue) !== canonicalJson(c.value))
        return fail(`alias or incomplete consuming mode ${name}`);
      if (byName.has(name) && byName.get(name) !== id) return fail(`duplicate native identity ${name}`);
      byName.set(name, id);
      if (!projection && modes.has(c.collectionId) && modes.get(c.collectionId) !== c.modeId) return fail('variant-selected native modes');
      modes.set(c.collectionId, c.modeId);
      if (name === t.fillVar) {
        if (c.resolvedType !== 'COLOR') return fail(`non-color binding ${name}`);
        color(name, c);
      } else {
        const observed = [
          ...(name === t.fontSizeVar ? [t.fontSize] : []),
          ...(name === t.fontWeightVar ? [t.fontWeight] : []),
          ...(name === t.lineHeightVar ? [t.lineHeight] : []),
        ];
        if (c.resolvedType !== 'FLOAT' || !exact(c.value, number(name)) || observed.some(value => !exact(value, c.value as number)))
          return fail(`numeric binding ${name} disagrees with its consuming value`);
      }
    }
    const styles: Record<number, string> = {100:'Thin',200:'ExtraLight',300:'Light',400:'Regular',500:'Medium',600:'SemiBold',700:'Bold',800:'ExtraBold',900:'Black'};
    const style = styles[number(t.fontWeightVar)];
    const actual = t.fontStyle.replaceAll(' ', '').replace(/Italic$/, '') || 'Regular';
    if (!style || actual !== style) return fail('weight binding disagrees with native face');
  }
  return { family: family ?? fail('missing templates'), ...(projection ? { normalized: set } : {}) };
}
