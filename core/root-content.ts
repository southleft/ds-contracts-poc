import type { Part } from '../scripts/contract-schema.js';

/** A root owns the same explicit text/content channels as an interior part.
 * Return undefined only when it delegates to the ordinary children channel.
 * JSON expressions preserve literal JSX punctuation and intentional emptiness. */
export function rootContentJsx(root: Part | undefined, codePropOf: (name: string) => string, textValueOf: (name: string, value: string) => string | boolean = (_name, value) => value): string | undefined {
  if(root?.textByCombination)throw Error('literal-text-combination-root-unqualified');
  if (root?.content) return `{${root.content.prop}}`;
  if (root?.text === undefined) return undefined;
  const byProp = root.textByProp;
  const choices = byProp ? Object.entries(byProp.map)
    .map(([value, text]) => `${codePropOf(byProp.prop)} === ${JSON.stringify(textValueOf(byProp.prop, value))} ? ${JSON.stringify(text)} : `)
    .join('') : '';
  return `{${choices}${JSON.stringify(root.text)}}`;
}

/** Keep ordinary historical output stable, while literal JSX punctuation,
 * entities and meaningful whitespace must be emitted as a string expression. */
export function literalTextJsx(text:string):string {
  return /[<>{}&\r\n\t]/.test(text) || text !== text.trim() ? `{${JSON.stringify(text)}}` : text;
}
