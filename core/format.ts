/**
 * Formatting for emitted code — prettier/standalone with explicit plugins,
 * so the SAME formatter runs in the CLI and in a browser. Verified
 * byte-identical to the node `prettier` API across every generated file
 * (153/153) before adoption; evals/golden.json stands as the referee.
 */
import { format } from 'prettier/standalone';
import * as pluginEstree from 'prettier/plugins/estree';
import * as pluginTypescript from 'prettier/plugins/typescript';
import * as pluginPostcss from 'prettier/plugins/postcss';

/** The generator's house style — identical to the options the CLI always passed. */
export const PRETTIER_BASE = { singleQuote: true, printWidth: 100 } as const;

export function formatTsx(src: string): Promise<string> {
  return format(src, { ...PRETTIER_BASE, parser: 'typescript', plugins: [pluginTypescript, pluginEstree] });
}

export function formatCss(src: string): Promise<string> {
  return format(src, { ...PRETTIER_BASE, parser: 'css', plugins: [pluginPostcss] });
}
