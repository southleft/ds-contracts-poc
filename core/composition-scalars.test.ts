import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createFigmaMock, type MockNode } from '../scripts/plugin-engine-mock-figma.mjs';
import { chromium } from 'playwright-core';
import { ContractSchema, validateContract, type Contract } from './index.js';
import { proposeFromCode } from './propose-code.js';
import { reactEmitter, reactInlineEmitter, htmlEmitter, figmaScriptEmitter } from './emitter.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';
import { emitWebComponent } from '../packages/emitter-web-components/src/emit-wc.js';

function callerFamily() {
  const { parent, child, ctx } = family();
  const text = (name: string) => ({ name, type: 'text' as const,
    bindings: { code: { prop: name }, figma: { kind: 'TEXT' as const, property: name } } });
  child.props.push(text('identity'), { name: 'state', type: { enum: ['off', 'on'] }, default: 'off',
    bindings: { code: { prop: 'checked' }, figma: { kind: 'VARIANT', property: 'State', values: { off: 'Off', on: 'On' } } } });
  child.semantics.role = 'checkbox';
  child.semantics.roleException = 'A button with declared checkbox toggle behavior.';
  child.anatomy.root.attrs = { id: '{identity}' };
  child.events = [{ name: 'change', trigger: 'root', toggles: { prop: 'state', between: ['off', 'on'], aria: 'checked' },
    bindings: { code: { prop: 'onCheckedChange' } } }];
  const shell = (id: string, name: string) => ContractSchema.parse({ ...parent, id, name, props: [],
    anatomy: { root: { slot: { name: 'children', defaultContent: [{ id: child.id, props: { label: 'Default control' } }] } } },
    bindings: { ...parent.bindings, code: { anchors: { importPath: `./${name}`, export: name } } } });
  const frame = shell('ds.frame', 'Frame'), body = shell('ds.body', 'Body');
  ctx.contracts.set(frame.id, frame); ctx.contracts.set(body.id, body);
  parent.props.push(text('firstId'), text('secondId'));
  parent.props.push({ name: 'show', type: 'boolean', default: true,
    bindings: { code: { prop: 'show' }, figma: { kind: 'BOOLEAN', property: 'Show' } } });
  parent.anatomy.root.parts = {};
  for (const key of ['first', 'second']) parent.anatomy.root.parts[key] = {
    component: { id: frame.id }, visibleWhen: { prop: 'show' }, parts: {
      [`${key}Body`]: { component: { id: body.id }, parts: {
        [`${key}Control`]: { component: { id: child.id, props: { identity: `{${key}Id}`, label: '{label}', disabled: '{disabled}' } } },
        [`${key}Caption`]: { element: 'label', attrs: { for: `{${key}Id}` }, text: `${key} label` },
      } },
    },
  };
  return { parent, child, frame, body, ctx };
}

test('nested caller children retain independent child state and parent label bindings on both React targets', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const { parent, ctx } = callerFamily();
  for (const contract of ctx.contracts.values()) {
    const errors: string[] = []; validateContract(contract, ctx.contracts, errors, ctx.icons);
    assert.deepEqual(errors, []);
  }
  for (const emitter of [reactEmitter, reactInlineEmitter]) {
    const output = [...ctx.contracts.values()].map(c => ({ name: c.name, files: emitter.emit(c, ctx) }));
    const files = output.find(o => o.name === parent.name)!.files;
    const deps = Object.fromEntries(output.filter(o => o.name !== parent.name).map(o => [o.name, {
      tsx: o.files[0].contents, css: o.files.find(f => f.path.endsWith('.css'))?.contents,
    }]));
    assert.deepEqual(generatedTypeErrors(parent.name, files[0].contents, Object.fromEntries(Object.entries(deps).map(([name, d]) => [name, d.tsx]))), []);
    const page = await browser.newPage();
    try {
      const render = await mountGenerated(page, parent.name, files[0].contents, files.find(f => f.path.endsWith('.css'))?.contents, deps);
      await render({ firstId: 'one', secondId: 'two', label: 'Toggle', disabled: false });
      assert.deepEqual(await page.locator('button').allTextContents(), ['Toggle', 'Toggle']);
      await page.getByText('first label', { exact: true }).click();
      assert.equal(await page.locator('#one').getAttribute('aria-checked'), 'true');
      assert.equal(await page.locator('#two').getAttribute('aria-checked'), 'false');
      await page.locator('#two').press('Space');
      assert.equal(await page.locator('#two').getAttribute('aria-checked'), 'true');
      await render({ firstId: 'new-one', secondId: 'new-two', label: 'Changed', disabled: false });
      assert.deepEqual(await page.locator('label').evaluateAll(labels => labels.map(l => (l as HTMLLabelElement).control?.id)), ['new-one', 'new-two']);
      assert.deepEqual(await page.locator('button').allTextContents(), ['Changed', 'Changed']);
      assert.deepEqual(await page.locator('button').evaluateAll(buttons => buttons.map(b => b.getAttribute('aria-checked'))), ['true', 'true']);
      await page.getByText('second label', { exact: true }).click();
      assert.equal(await page.locator('#new-two').getAttribute('aria-checked'), 'false');
      await render({ firstId: 'new-one', secondId: 'new-two', disabled: true });
      await page.getByText('first label', { exact: true }).click({ force: true });
      assert.equal(await page.locator('#new-one').getAttribute('aria-checked'), 'true');
      assert.equal(await page.locator('#new-one').isDisabled(), true);
      await render({ show: false });
      assert.equal(await page.locator('button').count(), 0);
    } finally { await page.close(); }
  }
});

test('caller parts refuse missing, competing or constrained slots and unsupported projections', () => {
  const { parent, frame, ctx } = callerFamily();
  const errors = () => { const errors: string[] = []; validateContract(parent, ctx.contracts, errors, ctx.icons); return errors.join('\n'); };
  const slot = frame.anatomy.root.slot!;
  delete frame.anatomy.root.slot;
  assert.match(errors(), /no unique children slot/);
  frame.anatomy.root.slot = { ...slot, min: 1 };
  assert.match(errors(), /constrained children slot/);
  frame.anatomy.root.slot = slot;
  parent.anatomy.root.parts!.first.component!.text = 'Conflicting';
  assert.match(errors(), /conflicting component caller content/);
  delete parent.anatomy.root.parts!.first.component!.text;
  assert.equal(errors(), '');
  assert.throws(() => htmlEmitter.emit(parent, ctx), /HTML_COMPONENT_CALLER_PARTS_UNSUPPORTED/);
  assert.throws(() => figmaScriptEmitter.emit(parent, ctx), /FIGMA_COMPONENT_CALLER_PARTS_UNSUPPORTED/);
  assert.throws(() => emitWebComponent(parent, { ...ctx, tokens: new Set<string>() }), /WEB_COMPONENT_CALLER_PARTS_UNSUPPORTED/);
});

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

test('parent IDs and labels reach distinct child controls and rebind without cross-activation', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const { parent, child, ctx } = family();
  const text = (name: string, code: string) => ({ name, type: 'text' as const,
    bindings: { code: { prop: code }, figma: { kind: 'TEXT' as const, property: name } } });
  child.props.push(text('identity', 'controlId'));
  child.anatomy.root.attrs = { ...child.anatomy.root.attrs, id: '{identity}' };
  parent.props.push(text('firstId', 'primaryId'), text('secondId', 'secondaryId'));
  parent.anatomy.root.parts = {
    first: { component: { id: child.id, props: { identity: '{firstId}', label: '{label}', disabled: '{disabled}' } } },
    firstCaption: { element: 'label', attrs: { for: '{firstId}' }, text: 'First control' },
    second: { component: { id: child.id, props: { identity: '{secondId}', label: 'Other control', disabled: false } } },
    secondCaption: { element: 'label', attrs: { htmlFor: '{secondId}' }, text: 'Second control' },
  };
  const errors: string[] = []; validateContract(parent, ctx.contracts, errors, ctx.icons);
  assert.deepEqual(errors, []);
  for (const emitter of [reactEmitter, reactInlineEmitter]) {
    const parentFiles = emitter.emit(parent, ctx), childFiles = emitter.emit(child, ctx);
    const page = await browser.newPage();
    try {
      const render = await mountGenerated(page, parent.name, parentFiles[0].contents,
        parentFiles.find(f => f.path.endsWith('.css'))?.contents ?? '',
        { [child.name]: { tsx: childFiles[0].contents, css: childFiles.find(f => f.path.endsWith('.css'))?.contents } });
      for (const [primaryId, secondaryId] of [['one', 'two'], ['replacement-one', 'replacement-two']]) {
        await render({ primaryId, secondaryId, label: 'Updated child', disabled: false });
        assert.deepEqual(await page.locator('label').evaluateAll(labels => labels.map(label => (label as HTMLLabelElement).control?.id)), [primaryId, secondaryId]);
        assert.deepEqual(await page.locator('button').allTextContents(), ['Updated child', 'Other control']);
        // Listen to actual browser activation; do not manually dispatch events
        // or construct the association in the generated DOM.
        await page.evaluate(() => { (window as unknown as { activations: string[] }).activations = [];
          document.querySelectorAll('button').forEach(button => { button.onclick = () => (window as unknown as { activations: string[] }).activations.push(button.id); }); });
        await page.getByText('First control', { exact: true }).click();
        await page.getByText('Second control', { exact: true }).click();
        assert.deepEqual(await page.evaluate(() => (window as unknown as { activations: string[] }).activations), [primaryId, secondaryId]);
        await render({ primaryId, secondaryId, label: '', disabled: true });
        assert.equal(await page.locator('button').first().textContent(), '');
        await page.getByText('First control', { exact: true }).click({ force: true });
        assert.deepEqual(await page.evaluate(() => (window as unknown as { activations: string[] }).activations), [primaryId, secondaryId]);
      }
    } finally { await page.close(); }
  }
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
