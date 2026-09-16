import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createFigmaMock, type MockNode } from '../scripts/plugin-engine-mock-figma.mjs';
import { chromium } from 'playwright-core';
import { ContractSchema, validateContract, type Contract } from './index.js';
import { proposeFromCode } from './propose-code.js';
import { reactEmitter, reactInlineEmitter, htmlEmitter, figmaScriptEmitter } from './emitter.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { mountGenerated } from './react-test-runtime.js';

function family() {
  const result = proposeFromCode({ sourcePath: 'family.tsx', css: '', source: `
    interface ParentProps { label?: string; disabled?: boolean }
    export function Parent({label = 'Parent label', disabled}: ParentProps) {
      return <div><Control label={label} disabled={disabled}/></div>;
    }
    interface ControlProps { label?: string; disabled?: boolean }
    export function Control({label = 'Child label', disabled = true}: ControlProps) {
      return <button disabled={disabled}>{label}</button>;
    }
  ` }, { tokens: [] });
  assert.equal(result.proposals.length, 2);
  const contracts = new Map(result.proposals.map(p => {
    const c = ContractSchema.parse(p.proposal.contract);
    return [c.id, c] as const;
  }));
  const parent = contracts.get('ds.parent')!;
  const child = contracts.get('ds.control')!;
  const ctx = { contracts, icons: new Map<string, string>(), tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } } };
  return { parent, child, ctx };
}

test('source defaults belong to the component props across supported declaration forms', () => {
  const declarations = [
    `export function Subject({ label = 'Own', disabled = false }: Props) { return <button disabled={disabled}>{label}</button>; }`,
    `export const Subject = ({ label = 'Own', disabled = false }: Props) => <button disabled={disabled}>{label}</button>;`,
    `export const Subject = forwardRef<HTMLButtonElement, Props>(({ label = 'Own', disabled = false }, ref) => <button ref={ref} disabled={disabled}>{label}</button>);`,
    `export const Subject = memo(({ label = 'Own', disabled = false }: Props) => <button disabled={disabled}>{label}</button>);`,
    `const Original = ({ label = 'Own', disabled = false }: Props) => <button disabled={disabled}>{label}</button>; export const Subject = Original as FC<Props>;`,
    `export function Subject(props: Props) {
       const { label = 'Own', disabled = false } = props;
       const { label: unrelated = 'Wrong local', disabled: ignored = true } = other;
       function helper({ label = 'Wrong helper', disabled = true }) { return label; }
       return <button disabled={disabled}>{label}</button>;
     }`,
    `export function Subject(props: Props) { return <button disabled={props.disabled}>{props.label}</button>; }
     Subject.defaultProps = { label: 'Own', disabled: false };`,
  ];
  for (const declaration of declarations) {
    const result = proposeFromCode({ sourcePath: 'defaults.tsx', css: '', source: `
      interface Props { label?: string; disabled?: boolean }
      ${declaration}
      export function Sibling({ label = 'Wrong sibling', disabled = true }: Props) { return <button>{label}</button>; }
    ` }, { tokens: [] });
    const proposed = result.proposals.find(p => p.proposal.contract.name === 'Subject')?.proposal.contract;
    assert.ok(proposed, declaration);
    const subject = ContractSchema.parse(proposed);
    assert.equal(subject.props.find(p => p.name === 'label')?.default, 'Own', declaration);
    assert.equal(subject.props.find(p => p.name === 'disabled')?.default, false, declaration);
  }
});

test('generated React forwards changing text and booleans, preserving omission and explicit false', async () => {
  const browser = await chromium.launch();
  try {
    const { parent, child, ctx } = family();
    const errors: string[] = [];
    validateContract(parent, ctx.contracts, errors, ctx.icons);
    assert.deepEqual(errors, []);
    for (const emitter of [reactEmitter, reactInlineEmitter]) {
      const parentFiles = emitter.emit(parent, ctx);
      const childFiles = emitter.emit(child, ctx);
      const page = await browser.newPage();
      try {
        const render = await mountGenerated(page, parent.name, parentFiles[0].contents,
          parentFiles.find(f => f.path.endsWith('.css'))?.contents ?? '',
          { [child.name]: { tsx: childFiles[0].contents, css: childFiles.find(f => f.path.endsWith('.css'))?.contents } });
        for (const [props, text, disabled] of [
          [{}, 'Parent label', true],
          [{ label: 'Changed <label>', disabled: false }, 'Changed <label>', false],
          [{ label: '', disabled: true }, '', true],
          [{ label: 'Again', disabled: false }, 'Again', false],
        ] as const) {
          await render(props);
          const observed = await page.locator('#root button').evaluate((el) => ({ text: el.textContent, disabled: (el as HTMLButtonElement).disabled }));
          assert.deepEqual(observed, { text, disabled }, emitter.name);
        }
      } finally { await page.close(); }
    }
    // Static preview reflects the same default and explicit false semantics.
    const page = await browser.newPage();
    try {
      for (const explicit of [undefined, false, true]) {
        const c = structuredClone(parent);
        c.props.find(p => p.name === 'disabled')!.default = explicit;
        c.props.find(p => p.name === 'label')!.default = '';
        await page.setContent(htmlEmitter.emit(c, { ...ctx, contracts: new Map([...ctx.contracts, [c.id, c]]) })[0].contents);
        assert.equal((await page.locator('button').first().textContent())?.trim(), '');
        assert.equal(await page.locator('button').first().isDisabled(), explicit ?? true);
      }
    } finally { await page.close(); }
  } finally { await browser.close(); }
});

test('scalar mappings reject cross-type and unknown parent properties', () => {
  const { parent, child, ctx } = family();
  const childLabel = child.props.find(p => p.name === 'label')!;
  childLabel.type = 'boolean';
  const errors: string[] = [];
  validateContract(parent, ctx.contracts, errors, ctx.icons);
  assert.ok(errors.some(e => e.includes('incompatible ds.control prop "label"')));
  const part = Object.values(parent.anatomy.root.parts!)[0];
  part.component!.props!.disabled = '{missing}';
  const missing: string[] = [];
  validateContract(parent, ctx.contracts, missing, ctx.icons);
  assert.ok(missing.some(e => e.includes('no enum, text or boolean prop "missing"')));
});

test('native text and BOOLEAN-property links refuse instead of freezing defaults', () => {
  const { parent, ctx } = family();
  assert.throws(() => figmaScriptEmitter.emit(parent, ctx), /FIGMA_NESTED_TEXT_PROP_LINK_UNSUPPORTED/);
  const part = Object.values(parent.anatomy.root.parts!)[0];
  delete part.component!.props!.label;
  assert.throws(() => figmaScriptEmitter.emit(parent, ctx), /FIGMA_NESTED_BOOLEAN_PROP_LINK_UNSUPPORTED/);
});

test('native boolean VARIANT forwarding uses real booleans and preserves an omitted child default', () => {
  const { parent, ctx } = family();
  const part = Object.values(parent.anatomy.root.parts!)[0];
  delete part.component!.props!.label;
  const disabled = parent.props.find(p => p.name === 'disabled')!;
  disabled.bindings.figma = { kind: 'VARIANT', property: 'Disabled', unsetValue: 'Omitted', values: { false: 'False', true: 'True' } };
  const contract = ContractSchema.parse(parent);
  const contracts = new Map<string, Contract>([...ctx.contracts, [contract.id, contract]]);
  const data = createFigmaEngine(ctx).compileComponentData(contract, contracts);
  assert.deepEqual(data.variants.map(v => v.spec.children![0].depProps), [{}, { Disabled: false }, { Disabled: true }]);
});

interface ComposedMockNode extends MockNode {
  children: ComposedMockNode[];
  isExposedInstance: boolean;
  exposedInstances: ComposedMockNode[];
  componentProperties: Record<string, { type: string; value: unknown }>;
  componentPropertyDefinitions: Record<string, unknown>;
  createInstance(): ComposedMockNode;
  remove(): void;
}

test('native composed components expose child controls on create, amend and no-op repeat', async () => {
  for (const variantSet of [false, true]) {
    const { parent, child, ctx } = family();
    parent.props = variantSet ? [{ name: 'size', type: { enum: ['small', 'large'] }, default: 'small',
      bindings: { code: { prop: 'size' }, figma: { kind: 'VARIANT', property: 'Size', values: { small: 'Small', large: 'Large' } } } }] : [];
    const part = Object.values(parent.anatomy.root.parts!)[0];
    part.component!.props = { label: 'Composed label', disabled: false };
    const engine = createFigmaEngine(ctx);
    assert.equal(engine.compileComponentData(parent, ctx.contracts).nestedPropertyControls, 1);
    assert.equal(engine.compileComponentData(child, ctx.contracts).nestedPropertyControls, undefined);
    const { figma, root } = createFigmaMock();
    const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
    const run = (code: string) => vm.runInContext(`(async () => {\n${code}\n})()`, context, { timeout: 20_000 });
    await run(engine.buildComponentScript(child, ctx.contracts));
    await run(engine.buildComponentScript(parent, ctx.contracts));
    const target = root.findOne(n => ['COMPONENT', 'COMPONENT_SET'].includes(n.type) && n.getSharedPluginData('ds_contracts', 'contractId') === parent.id) as ComposedMockNode | null;
    assert.ok(target);
    const inspect = () => {
      const components = variantSet ? target.children : [target];
      for (const component of components) {
        const nested = component.findOne(n => n.type === 'INSTANCE');
        assert.ok(nested);
        assert.equal(nested.isExposedInstance, true);
        const instance = component.createInstance();
        try {
          assert.equal(instance.exposedInstances.length, 1);
          const props = instance.exposedInstances[0].componentProperties;
          assert.equal(Object.entries(props).find(([k]) => k.split('#')[0] === 'Label')?.[1].value, 'Composed label');
          assert.equal(Object.entries(props).find(([k]) => k.split('#')[0] === 'Disabled')?.[1].value, false);
          assert.throws(() => { instance.exposedInstances[0].isExposedInstance = false; }, /inherited/);
        } finally { instance.remove(); }
      }
      assert.ok(!Object.keys(target.componentPropertyDefinitions).some(k => k.startsWith('Label#')), 'no disconnected parent Label property');
      return components.map(c => [c.id, ...c.findAll(n => n.type === 'INSTANCE').map(n => n.id)]);
    };
    const before = inspect();
    await run(engine.buildComponentScript(parent, ctx.contracts));
    assert.deepEqual(inspect(), before, 'same compiled input leaves main and child instance identities unchanged');
    parent.description += ' Updated description forces the existing amend path.';
    await run(engine.buildComponentScript(parent, ctx.contracts));
    assert.equal(inspect()[0][0], before[0][0], 'amend preserves component identity and exposes rebuilt children');
  }
});
