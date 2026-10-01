import { strokedPathIssue } from '../scripts/contract-schema.js';

/** Figma vectorPaths lacks SVG H/V shorthand. Expand it exactly, retaining
 * every coordinate and subpath; this does not rescale or approximate paths. */
export function strokedPathNativeData(data: string): string {
  const issue = strokedPathIssue(data);
  if (issue) throw new Error(issue);
  const tokens = data.match(/[MLCQHVZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)!;
  let x = '0', y = '0', sx = '0', sy = '0';
  const output: string[] = [];
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++]!;
    if (command === 'Z') { output.push('Z'); x = sx; y = sy; continue; }
    const count = command === 'C' ? 6 : command === 'Q' ? 4 : command === 'H' || command === 'V' ? 1 : 2;
    let first = true;
    while (i < tokens.length && !/^[MLCQHVZ]$/.test(tokens[i]!)) {
      const args = tokens.slice(i, i + count); i += count;
      if (command === 'H') { x = args[0]!; output.push('L ' + x + ' ' + y); }
      else if (command === 'V') { y = args[0]!; output.push('L ' + x + ' ' + y); }
      else {
        output.push((command === 'M' && !first ? 'L' : command) + ' ' + args.join(' '));
        x = args[count - 2]!; y = args[count - 1]!;
        if (command === 'M' && first) { sx = x; sy = y; }
      }
      first = false;
    }
  }
  return output.join(' ');
}
