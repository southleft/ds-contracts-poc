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
  assert.throws(() => figmaScriptEmitter.emit(parent, ctx), /FIGMA_ROOT_SLOT_LAYOUT_UNSUPPORTED/);
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

test('composed initialProps initialize once, preserve public scalar mappings and defer to controlled inputs', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const { parent, child, ctx } = callerFamily();
  const state = child.props.find(p => p.name === 'state')!;
  state.bindings.code = { prop: 'checked', values: { off: false, on: true }, initial: { prop: 'defaultChecked', default: 'off' } };
  state.bindings.figma.unsetValue = 'Unset';
  delete state.default;
  parent.props.push({ name: 'starting', type: { enum: ['off', 'on'] },
    bindings: { code: { prop: 'start', values: { off: 'no', on: 'yes' } }, figma: { kind: 'VARIANT', property: 'Starting', unsetValue: 'Unset', values: { off: 'Off', on: 'On' } } } });
  parent.anatomy.root.parts = {
    fixed: { component: { id: child.id, props: { identity: 'fixed', disabled: false }, initialProps: { state: 'on' } } },
    mapped: { component: { id: child.id, props: { identity: 'mapped', disabled: false }, initialProps: { state: '{starting}' } } },
    controlled: { component: { id: child.id, props: { identity: 'controlled', disabled: false, state: 'off' }, initialProps: { state: 'on' } } },
  };
  for (const emitter of [reactEmitter, reactInlineEmitter]) {
    const output = emitter.emit(parent, ctx), dependency = emitter.emit(child, ctx);
    assert.deepEqual(generatedTypeErrors(parent.name, output[0].contents, { [child.name]: dependency[0].contents }), []);
    const page = await browser.newPage();
    try {
      const render = await mountGenerated(page, parent.name, output[0].contents, output.find(f => f.path.endsWith('.css'))?.contents,
        { [child.name]: { tsx: dependency[0].contents, css: dependency.find(f => f.path.endsWith('.css'))?.contents } });
      assert.equal(await page.locator('#fixed').getAttribute('aria-checked'), 'true');
      assert.equal(await page.locator('#mapped').getAttribute('aria-checked'), 'false');
      await render({ start: 'yes' });
      assert.equal(await page.locator('#mapped').getAttribute('aria-checked'), 'false', 'initializer does not reset mounted state');
      await page.locator('#fixed').press('Space');
      await page.locator('#mapped').press('Space');
      await page.locator('#controlled').press('Space');
      assert.deepEqual(await page.locator('button').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-checked'))), ['false', 'true', 'false']);
      await render({ start: 'no' });
      assert.equal(await page.locator('#mapped').getAttribute('aria-checked'), 'true');
      await page.evaluate(() => (window as unknown as { renderSubject(props: unknown): void }).renderSubject({ key: 'fresh', start: 'yes' }));
      assert.equal(await page.locator('#mapped').getAttribute('aria-checked'), 'true', 'new mount reads typed initializer');
    } finally { await page.close(); }
  }
  assert.throws(() => htmlEmitter.emit(parent, ctx), /HTML_COMPONENT_INITIAL_PROPS_UNSUPPORTED/);
  const native = createFigmaEngine(ctx).compileComponentData(parent, ctx.contracts);
  assert.ok(native.variants.length > 0);
  for (const variant of native.variants) {
    assert.equal(variant.spec.children!.find(n => n.name === 'fixed')!.depProps!.State, 'On');
    assert.equal(variant.spec.children!.find(n => n.name === 'controlled')!.depProps!.State, 'Off');
  }
  const unmappedParent = structuredClone(parent);
  delete unmappedParent.props.find(p => p.name === 'starting')!.bindings.code.values;
  assert.throws(() => emitWebComponent(unmappedParent, { ...ctx, tokens: new Set<string>() }), /WEB_COMPONENT_INITIAL_PROPS_UNSUPPORTED/);
  const errors: string[] = [];
  parent.anatomy.root.parts.fixed.component!.initialProps = { label: 'invalid' };
  parent.anatomy.root.parts.mapped.component!.initialProps = { state: '{missing}' };
  validateContract(parent, ctx.contracts, errors, ctx.icons);
  assert.ok(errors.some(e => e.includes('no declared child initializer')));
  assert.ok(errors.some(e => e.includes('outside the child canonical domain')));
});

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

test('native fresh-mount variants preserve initializer omission, controlled precedence and authored mappings', async () => {
  const { parent, child, ctx } = callerFamily();
  const state = child.props.find(p => p.name === 'state')!;
  state.bindings.code = { prop: 'checked', values: { off: false, on: true }, initial: { prop: 'defaultChecked', default: 'off' } };
  state.bindings.figma.unsetValue = 'Unset'; delete state.default;
  child.anatomy.root = { layout: { display: 'flex', direction: 'row' }, parts: {
    indicator: { text: 'Selected', visibleWhen: { prop: 'state', equals: 'on' } },
  } };
  const axis = (name: string) => ({ name, type: { enum: ['off', 'on'] }, bindings: {
    code: { prop: name, values: { off: false, on: true } },
    figma: { kind: 'VARIANT' as const, property: name, unsetValue: 'Omitted', values: { off: 'Off', on: 'On' } },
  } });
  parent.props = [axis('starting'), axis('current')];
  parent.anatomy.root.parts = {
    fixed: { component: { id: child.id, initialProps: { state: 'on' } } },
    mapped: { component: { id: child.id, initialProps: { state: '{starting}' } } },
    controlled: { component: { id: child.id, props: { state: '{current}' }, initialProps: { state: '{starting}' } } },
  };
  const engine = createFigmaEngine(ctx), data = engine.compileComponentData(parent, ctx.contracts);
  assert.equal(data.variants.length, 9);
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (code: string) => vm.runInContext(`(async () => {\n${code}\n})()`, context, { timeout: 20_000 });
  await run(engine.buildComponentScript(child, ctx.contracts));
  await run(engine.buildComponentScript(parent, ctx.contracts));
  const target = root.findOne(n => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === parent.id) as ComposedMockNode;
  assert.ok(target);
  for (const variant of data.variants) {
    const start = /starting=([^,]+)/.exec(variant.name)![1], current = /current=([^,]+)/.exec(variant.name)![1];
    const initial = start === 'Omitted' ? 'Off' : start;
    const expected = ['On', initial, current === 'Omitted' ? initial : current];
    assert.deepEqual(variant.spec.children!.map(n => n.depProps!.State), expected);
    assert.deepEqual(variant.spec.children![1].depInitialProps, { state: '{starting}' });
    const component = target.children.find(n => n.name === variant.name)!;
    assert.ok(component);
    assert.deepEqual(component.findAll(n => n.type === 'INSTANCE').map(n => n.componentProperties!.State.value), expected,
      'actual written child properties follow the parent variant, including omitted controlled inputs');
    // The shared mock records setProperties but does not swap the cloned
    // subtree for VARIANT changes. Inspect the written target variants
    // separately; a live instance-swap proof remains required.
    const childSet = root.findOne(n => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === child.id) as ComposedMockNode;
    for (const selected of expected) {
      const main = childSet.children.find(n => n.name.includes(`State=${selected}`))!;
      assert.ok(main);
      assert.equal(main.findAll(n => n.type === 'TEXT').length, selected === 'On' ? 1 : 0);
    }
  }
  const ids = target.findAll(() => true).map(n => n.id);
  await run(engine.buildComponentScript(parent, ctx.contracts));
  assert.deepEqual(target.findAll(() => true).map(n => n.id), ids, 'repeat does not recreate variants or nested instances');
  const initial = state.bindings.code.initial!;
  delete initial.default;
  const omitted = engine.compileComponentData(parent, ctx.contracts).variants.find(v => v.name === 'starting=Omitted, current=Omitted')!;
  assert.deepEqual(omitted.spec.children![1].depProps, {}, 'absent initializer and absent default preserve omission');
  state.default = 'on';
  const defaulted = engine.compileComponentData(parent, ctx.contracts).variants.find(v => v.name === 'starting=Omitted, current=Omitted')!;
  assert.equal(defaulted.spec.children![1].depProps!.State, 'On', 'omitted initializer falls back to the child canonical default');
  delete state.default; initial.default = 'off';
  parent.anatomy.root.parts!.fixed.component!.initialProps = { state: 'missing' };
  assert.throws(() => engine.compileComponentData(parent, ctx.contracts), /INITIAL_PROPS_UNSUPPORTED/);
  parent.anatomy.root.parts!.fixed.component!.initialProps = { label: 'on' };
  assert.throws(() => engine.compileComponentData(parent, ctx.contracts), /INITIAL_PROPS_UNSUPPORTED/);
  parent.anatomy.root.parts!.fixed.component!.initialProps = { state: '{absent}' };
  assert.throws(() => engine.compileComponentData(parent, ctx.contracts), /INITIAL_PROPS_UNSUPPORTED/);
  parent.anatomy.root.parts!.fixed.component!.initialProps = { state: 'on' };
  parent.props[0].bindings.figma = { kind: 'NONE' };
  assert.throws(() => engine.compileComponentData(parent, ctx.contracts), /INITIAL_PROPS_UNSUPPORTED/);
  parent.props[0] = axis('starting');
  state.bindings.figma = { kind: 'NONE' };
  assert.throws(() => engine.compileComponentData(parent, ctx.contracts), /INITIAL_PROPS_UNSUPPORTED/);
});

test('native caller content populates linked slots without altering child mains or duplicating defaults', async () => {
  for (const mode of ['flex', 'grid', 'nested'] as const) {
    const grid = mode === 'grid';
    const { parent, child, ctx } = family();
    parent.props = [{ name: 'caption', type: 'text', default: 'Caller caption',
      bindings: { code: { prop: 'caption' }, figma: { kind: 'TEXT', property: 'Caption' } } }];
    const shell = (id: string, name: string, useGrid = false) => ContractSchema.parse({ ...parent, id, name, props: [],
      anatomy: { root: { layout: useGrid
        ? { display: 'grid', columns: [{ fr: 1 }, { fr: 1 }], rows: [{ fit: true }], flow: 'row' }
        : { display: 'flex', direction: 'column' }, literals: { width: useGrid ? '240px' : '100%', height: 'fit-content' },
        slot: { name: 'children', ...(!useGrid ? { defaultContent: [{ id: child.id, props: { label: 'Default content' } }] } : {}) } } },
      bindings: { ...parent.bindings, code: { anchors: { importPath: `./${name}`, export: name } } } });
    const frame = shell('ds.caller-frame', 'CallerFrame'), body = shell('ds.caller-body', 'CallerBody', grid);
    ctx.contracts.set(frame.id, frame); ctx.contracts.set(body.id, body);
    body.anatomy.root.literals!['font-size'] = '21px';
    if (mode === 'nested') {
      const slot = body.anatomy.root.slot!; delete body.anatomy.root.slot;
      body.anatomy.root.literals!.width = '240px';
      body.anatomy.root.parts = { heading: { text: 'Private heading' }, region: {
        layout: { display: 'flex', direction: 'column' }, literals: { width: '120px' }, parts: {
          content: { slot, layout: { display: 'flex', direction: 'column' } },
        },
      } };
    }
    const expectedText = (caption: string) => [...(mode === 'nested' ? ['Private heading'] : []), caption, 'Save'];
    parent.anatomy.root = { layout: { display: 'flex', direction: 'column' }, literals: { width: '300px', 'font-size': '12px' }, parts: {
      first: { component: { id: frame.id }, parts: {
        body: { component: { id: body.id }, parts: {
          caption: { content: { prop: 'caption' } },
          action: { component: { id: child.id, props: { label: 'Save', disabled: false } } },
        } },
      } },
      empty: { component: { id: frame.id }, parts: {} },
    } };
    const contractsBefore = JSON.stringify([...ctx.contracts]);
    const engine = createFigmaEngine(ctx), data = engine.compileComponentData(parent, ctx.contracts);
    assert.equal(JSON.stringify([...ctx.contracts]), contractsBefore);
    const { figma, root } = createFigmaMock();
    const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
    const run = (code: string) => vm.runInContext(`(async () => {\n${code}\n})()`, context, { timeout: 20_000 });
    for (const c of [child, frame, body]) await run(engine.buildComponentScript(c, ctx.contracts));
    const mains = [child, frame, body].map(c => root.findOne(n => ['COMPONENT', 'COMPONENT_SET'].includes(n.type) && n.getSharedPluginData('ds_contracts', 'contractId') === c.id) as ComposedMockNode);
    const mainSnapshot = (main: ComposedMockNode) => JSON.stringify({ properties: main.componentPropertyDefinitions, nodes: main.findAll(() => true).map(n => [n.id, n.type, n.name, n.characters]) });
    const before = mains.map(mainSnapshot);
    await run(engine.buildComponentScript(parent, ctx.contracts));
    const main = root.findOne(n => n.type === 'COMPONENT' && n.getSharedPluginData('ds_contracts', 'contractId') === parent.id) as ComposedMockNode;
    assert.ok(main);
    assert.deepEqual(main.findAll(n => n.type === 'TEXT').map(n => n.characters), expectedText('Caller caption'));
    assert.equal(main.findAll(n => n.type === 'INSTANCE').length, 4);
    assert.equal(main.findOne(n => n.type === 'TEXT' && n.characters === 'Caller caption')!.fontSize, 21, 'caller content inherits the child host typography');
    assert.equal(main.findAll(n => n.type === 'SLOT').length, 3);
    assert.equal(main.children.find(n => n.name === 'empty')!.findAll(n => n.type === 'TEXT').length, 0, 'explicit empty children override slot defaults');
    assert.equal(main.children.find(n => n.name === 'first')!.layoutSizingHorizontal, 'FILL');
    assert.deepEqual(mains.map(mainSnapshot), before);
    assert.equal(Object.values(main.componentPropertyDefinitions).filter((v: any) => v.type === 'SLOT').length, 0,
      'child-owned slots do not become disconnected parent properties');
    const instance = main.createInstance();
    assert.equal(instance.exposedInstances.length, 2, 'only eligible direct children are exposed by the parent');
    const caption = Object.keys(instance.componentProperties).find(k => k.startsWith('Caption#'))!;
    assert.ok(caption);
    (instance as any).setProperties({ [caption]: 'Changed caller caption' });
    assert.deepEqual(instance.findAll(n => n.type === 'TEXT').map(n => n.characters), expectedText('Changed caller caption'));
    assert.deepEqual(main.findAll(n => n.type === 'TEXT').map(n => n.characters), expectedText('Caller caption'));
    instance.remove();
    const ids = main.findAll(() => true).map(n => n.id);
    await run(engine.buildComponentScript(parent, ctx.contracts));
    assert.deepEqual(main.findAll(() => true).map(n => n.id), ids);
    assert.equal(data.variants[0].spec.children![0].children![0].callerSlotProperty, 'Children');
    frame.anatomy.root.slot!.min = 1;
    assert.throws(() => engine.compileComponentData(parent, ctx.contracts), /CALLER_PARTS_UNSUPPORTED/);
    delete frame.anatomy.root.slot!.min;
    const bodyPart = parent.anatomy.root.parts!.first.parts!.body;
    if (grid) {
      bodyPart.parts!.third = { text: 'Third' };
      assert.throws(() => engine.compileComponentData(parent, ctx.contracts), /caller content exceeds declared grid capacity/);
      body.anatomy.root.layout = { display: 'grid', columns: [{ fr: 1 }, { fr: 1 }], autoRows: { fit: true }, flow: 'row' };
      const flowing = engine.compileComponentData(parent, ctx.contracts);
      const carrier = flowing.variants[0].spec.children![0].children![0].children![0].children![0].children![0];
      assert.equal(carrier.layout!.grid!.rows.length, 2);
      assert.equal(carrier.children!.length, 3);
      delete bodyPart.parts!.third;
    }
    parent.anatomy.root.parts!.empty.component!.text = 'Competing';
    assert.throws(() => engine.compileComponentData(parent, ctx.contracts), /competing caller content/);
    delete parent.anatomy.root.parts!.empty.component!.text;
    delete parent.anatomy.root.literals!.width;
    assert.throws(() => engine.compileComponentData(parent, ctx.contracts), /full-width child needs a definite column or grid/);
    parent.anatomy.root.literals!.width = '300px';
    parent.anatomy.root.parts!.empty.repeat = { from: 'items', sample: [] } as any;
    assert.throws(() => engine.compileComponentData(parent, ctx.contracts), /non-repeated nested instance/);
    parent.anatomy.root = { component: { id: frame.id }, parts: {} };
    assert.throws(() => engine.compileComponentData(parent, ctx.contracts), /non-repeated nested instance/);
  }
});
