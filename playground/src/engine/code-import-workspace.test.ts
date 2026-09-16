import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { proposeFromCode } from '../../../core/propose-code.js';
import { ContractSchema, validateContract } from '../../../core/index.js';
import { reactEmitter, reactInlineEmitter, htmlEmitter, figmaScriptEmitter } from '../../../core/emitter.js';
import { createFigmaEngine } from '../../../core/emit-figma-script.js';
import { recordCodeProposals } from './code-import-workspace.js';
import { buildSessionRegistry, contractsInSession } from './session-registry.js';
import { applyLinkedScope, linkedImportScope } from './linked-scope.js';
import { clearWorkspace, recordImports, WORKSPACE_CAP, workspaceSnapshot } from './workspace.js';

// Three levels, with parent-to-child enum mappings. Names overlap
// bundled examples deliberately: imported references must use imported code.
export const familySource = `
import styles from './family.module.css';
interface PanelProps { density?: 'compact' | 'comfortable' }
export function Panel({density = 'comfortable'}: PanelProps) {
  return <div className={styles.panel}><Button density={density} /></div>;
}
interface ButtonProps { density?: 'compact' | 'comfortable' }
export function Button({density = 'comfortable'}: ButtonProps) {
  return <button className={styles.button} ><Caption density={density} /></button>;
}
interface CaptionProps { density?: 'compact' | 'comfortable' }
export function Caption({density = 'comfortable'}: CaptionProps) {
  return <span className={styles.caption}>Imported caption</span>;
}`;
export const familyCss = `
.panel { display: flex; flex-direction: column; padding: 16px; background-color: #e8eef5; }
.button { display: flex; padding: 8px; background-color: #174e91; }
.caption { color: #ffffff; font-size: 16px; }
`;
const receipts = { source: 'test source family', groups: [] };
const propose = () => proposeFromCode({ sourcePath: 'family.tsx', source: familySource, css: familyCss }, { tokens: [], mintUnbound: true });

beforeEach(() => clearWorkspace());

test('the imported family and its tokens survive storage and feed both shared emitters', () => {
  const proposals = propose();
  assert.equal(proposals.skipped.length, 0);
  assert.equal(proposals.proposals.length, 3);
  const records = recordCodeProposals(proposals, receipts);
  assert.deepEqual(records.map(r => r.entry.name), ['Panel', 'Button', 'Caption']);
  assert.deepEqual(workspaceSnapshot().map(e => e.name), ['Panel', 'Button', 'Caption']);
  assert.ok(records.every(r => r.entry.mintedTokens?.count));

  // Exercise the stored representation, not just live objects.
  const session = buildSessionRegistry(JSON.parse(JSON.stringify(workspaceSnapshot())));
  assert.equal(session.contracts.size, 3);
  const parent = session.contracts.get('ds.panel')!;
  const importedButton = session.contracts.get('ds.button')!;
  const demoButton = ContractSchema.parse({ ...importedButton, name: 'WrongBundledButton' });
  const scope = contractsInSession(new Map([['ds.button', demoButton]]), session, parent);
  assert.equal(scope.get('ds.button')?.name, 'Button');
  const linked = linkedImportScope(parent, scope, session.layersByContractId, new Set());
  assert.equal(linked.mintedTrees.length, 2);
  const tokens = applyLinkedScope({ primitives: {}, semantic: records[0].entry.mintedTokens!.tree, light: {}, dark: {}, brands: { default: {} } }, linked);
  const ctx = { contracts: scope, tokens, icons: new Map<string, string>(), mode: 'light' as const };
  const react = reactEmitter.emit(parent, ctx).find(f => f.path.endsWith('.tsx'))!.contents;
  assert.match(react, /<Button/);
  assert.match(react, /density=\{density\}/);
  const script = figmaScriptEmitter.emit(parent, ctx)[0].contents;
  assert.ok(script.includes('ds.button'));
  assert.ok(!script.includes('WrongBundledButton'));
  const compiled = createFigmaEngine(ctx).compileComponentData(parent, scope);
  assert.equal(compiled.variants.length, 2);
  assert.deepEqual(compiled.variants.map(v => v.spec.children?.[0].depContractId), ['ds.button', 'ds.button']);
  assert.deepEqual(compiled.variants.map(v => v.spec.children?.[0].depProps), [{ Density: 'Comfortable' }, { Density: 'Compact' }]);
  const caption = session.contracts.get('ds.caption')!;
  assert.match(reactEmitter.emit(caption, ctx)[0].contents, /Imported caption/);
  assert.match(reactInlineEmitter.emit(caption, ctx)[0].contents, /Imported caption/);
  assert.match(htmlEmitter.emit(parent, ctx)[0].contents, /Imported caption/);
  // Every family member can be selected and emitted using the same graph.
  for (const component of session.contracts.values()) {
    assert.ok(reactEmitter.emit(component, ctx).length);
    assert.ok(figmaScriptEmitter.emit(component, ctx).length);
  }
});

test('reimport replaces the complete family without accumulating stale entries', () => {
  recordCodeProposals(propose(), receipts);
  const changed = proposeFromCode({ sourcePath: 'family.tsx', source: familySource, css: familyCss.replace('#174e91', '#992244') }, { tokens: [], mintUnbound: true });
  recordCodeProposals(changed, receipts);
  assert.equal(workspaceSnapshot().length, 3);
  assert.ok(JSON.stringify(workspaceSnapshot()[1].mintedTokens).includes('#992244'));
  assert.ok(!JSON.stringify(workspaceSnapshot()[1].mintedTokens).includes('#174e91'));
});

test('an oversized or duplicate batch refuses atomically instead of dropping siblings', () => {
  const existing = recordCodeProposals(propose(), receipts);
  const before = workspaceSnapshot();
  const input = { name: 'Extra', contractId: 'ds.extra', source: 'code' as const, contractText: existing[0].entry.contractText, receipts };
  assert.throws(() => recordImports(Array.from({ length: WORKSPACE_CAP + 1 }, (_, i) => ({ ...input, name: `Extra${i}` }))), /workspace-import-too-large/);
  assert.equal(workspaceSnapshot(), before);
  assert.throws(() => recordImports([input, input]), /workspace-duplicate-import/);
  assert.equal(workspaceSnapshot(), before);
});

test('retaining a family preserves typed text and boolean forwarding in the shared contract', () => {
  for (const type of ['string', 'boolean']) {
    const source = familySource.replaceAll("density?: 'compact' | 'comfortable'", `density: ${type}`)
      .replaceAll("density = 'comfortable'", 'density');
    const result = proposeFromCode({ sourcePath: 'family.tsx', source, css: familyCss }, { tokens: [], mintUnbound: true });
    recordCodeProposals(result, receipts);
    const session = buildSessionRegistry(workspaceSnapshot());
    const parent = session.contracts.get('ds.panel')!;
    const errors: string[] = [];
    validateContract(parent, session.contracts, errors, new Map());
    assert.deepEqual(errors, []); // Native projection has its own capability checks.
  }
});

test('an absent nested dependency remains a named refusal', () => {
  const result = propose();
  recordCodeProposals({ ...result, proposals: result.proposals.slice(0, 1) }, receipts);
  const session = buildSessionRegistry(workspaceSnapshot());
  const errors: string[] = [];
  validateContract(session.contracts.get('ds.panel')!, session.contracts, errors, new Map());
  assert.ok(errors.some(e => e.includes('ds.button') && e.includes('no contract in scope')));
});
