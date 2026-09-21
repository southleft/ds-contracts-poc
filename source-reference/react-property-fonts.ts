/** A property plane's raw tree and font witness remain archived unchanged.
 * Only a private compilation clone can use the browser's painted family.
 * Older observations have neither witness nor digest and retain legacy styling;
 * they cannot establish painted-font identity for later template admission. */
import { flatten, type CapturedNode } from '../extract/computed/lib.js';
import { evidenceSha } from './react-validation-evidence.js';
import { withPaintedTextFonts, type TextFontEvidence } from './text-fonts.js';

export function assertReactPropertyFontCoverage(rows: Array<{ id: string; fontsSha256?: string }>,
  snapshots: Record<string, { fonts?: TextFontEvidence }>) {
  if (rows.some(r => r.fontsSha256 !== undefined || snapshots[r.id]?.fonts !== undefined) &&
      rows.some(r => !r.fontsSha256 || !snapshots[r.id]?.fonts))
    throw Error('react-property-font-coverage-incomplete');
}

export function reactPropertyPaintedRoot(snapshot: { tree: CapturedNode; fonts?: TextFontEvidence },
  row: { fontsSha256?: string }, rootPath: string): CapturedNode {
  let tree = snapshot.tree;
  if (row.fontsSha256 !== undefined || snapshot.fonts !== undefined) {
    if (!snapshot.fonts || !row.fontsSha256 || evidenceSha(JSON.stringify(snapshot.fonts)) !== row.fontsSha256)
      throw Error('react-property-font-evidence-unverified');
    tree = withPaintedTextFonts(tree, snapshot.fonts);
  }
  const root = flatten(tree).find(r => r.path === rootPath)?.node;
  if (!root) throw Error('react-property-font-root-unavailable');
  return structuredClone(root);
}
