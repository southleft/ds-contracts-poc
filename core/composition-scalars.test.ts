import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createFigmaMock, type MockNode } from '../scripts/plugin-engine-mock-figma.mjs';
import { chromium } from 'playwright-core';
import { ContractSchema, validateContract, type Contract } from './index.js';
import { proposeFromCode } from './propose-code.js';
import { reactEmitter, reactInlineEmitter, htmlEmitter, figmaScriptEmitter } from './emitter.js';
import { createFigmaEngine, type NodeSpec } from './emit-figma-script.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';
import { emitWebComponent } from '../packages/emitter-web-components/src/emit-wc.js';
import { scopeContractResources, type ContractResources } from './scoped-contract-resources.js';
import { flattenTokens, makeResolveLiteral } from './tokens.js';
import { nativeComparisonFixture } from './native-contract-comparison-test-fixture.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback } from './native-source-observation.js';
import { revisionOf } from './contract-provenance.js';

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

test('native composition skips static and variant-only exposure while preserving real and transitive controls', async () => {
  for (const variantSet of [false, true]) {
    const { parent, child, ctx } = family();
    const inert = ContractSchema.parse({ ...child, id: 'ds.inert', name: 'Inert', props: [],
      anatomy: { root: { parts: { copy: { text: 'Retained body' } } } } });
    const axis = ContractSchema.parse({ ...inert, id: 'ds.axis', name: 'AxisOnly', props: [{
      name: 'tone', type: { enum: ['quiet', 'strong'] }, default: 'quiet',
      bindings: { code: { prop: 'tone' }, figma: { kind: 'VARIANT', property: 'Tone' } },
    }] });
    ctx.contracts.set(inert.id, inert); ctx.contracts.set(axis.id, axis);
    parent.props = variantSet ? structuredClone(axis.props) : [];
    parent.anatomy.root.parts = {
      control: { component: { id: child.id, props: { label: 'Editable', disabled: false } } },
      retained: { component: { id: inert.id } },
      variant: { component: { id: axis.id } },
    };
    const outer = ContractSchema.parse({ ...inert, id: 'ds.outer', name: 'Outer',
      anatomy: { root: { parts: { middle: { component: { id: parent.id } } } } } });
    ctx.contracts.set(outer.id, outer);
    const engine = createFigmaEngine(ctx);
    const { figma, root } = createFigmaMock();
    const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
    const run = (contract: Contract) => vm.runInContext(`(async () => { ${engine.buildComponentScript(contract, ctx.contracts)} })()`, context);
    for (const contract of [child, inert, axis, parent, outer]) await run(contract);
    const target = root.findOne(n => n.getSharedPluginData('ds_contracts', 'contractId') === parent.id) as ComposedMockNode;
    const targetId = target.id;
    const inspect = () => {
      for (const component of variantSet ? target.children : [target]) {
        const instances = component.findAll(n => n.type === 'INSTANCE') as ComposedMockNode[];
        assert.equal(instances.find(n => n.name === 'control')!.isExposedInstance, true);
        for (const name of ['retained', 'variant']) {
          const instance = instances.find(n => n.name === name)!;
          assert.equal(instance.isExposedInstance, false);
          assert.throws(() => { instance.isExposedInstance = true; }, /Can only expose instances/);
        }
      }
    };
    inspect();
    const before = target.findAll(n => n.type === 'INSTANCE').map(n => n.id);
    await run(parent); inspect();
    assert.deepEqual(target.findAll(n => n.type === 'INSTANCE').map(n => n.id), before);
    parent.description += ' Force amend.';
    await run(parent); inspect(); assert.equal(target.id, targetId);
    const outerNode = root.findOne(n => n.getSharedPluginData('ds_contracts', 'contractId') === outer.id)!;
    const middle = outerNode.findOne(n => n.type === 'INSTANCE') as ComposedMockNode;
    assert.equal(middle.isExposedInstance, true, 'exposed nested controls remain reachable through composition');
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
  for (const mode of ['flex', 'grid', 'grid-fill', 'nested'] as const) {
    const grid = mode === 'grid' || mode === 'grid-fill';
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
    if (mode === 'grid-fill') body.anatomy.root.literals!.width = '100%';
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
    const expectedText = (caption: string, heading = 'Panel title') => [...(mode === 'nested' ? ['Private heading'] : []), caption, 'Save', heading];
    parent.props.push({ name: 'heading', type: 'text', default: 'Panel title',
      bindings: { code: { prop: 'heading' }, figma: { kind: 'TEXT', property: 'Heading' } } });
    parent.anatomy.root = { layout: { display: 'flex', direction: 'column' }, literals: { width: '300px', 'font-size': '12px' }, parts: {
      first: { component: { id: frame.id }, parts: {
        body: { component: { id: body.id }, parts: {
          caption: { content: { prop: 'caption' } },
          action: { component: { id: child.id, props: { label: 'Save', disabled: false } } },
        } },
      } },
      empty: { component: { id: frame.id }, parts: {} },
      heading: { content: { prop: 'heading' } },
    } };
    const dependencies = [child, frame, body];
    if (mode === 'grid-fill') {
      const leaf = shell('ds.caller-leaf', 'CallerLeaf');
      dependencies.push(leaf); ctx.contracts.set(leaf.id, leaf);
      parent.anatomy.root.parts!.first.parts!.body.parts!.caption = {
        component: { id: leaf.id }, parts: { captionText: { content: { prop: 'caption' } } },
      };
    }
    const contractsBefore = JSON.stringify([...ctx.contracts]);
    const engine = createFigmaEngine(ctx), data = engine.compileComponentData(parent, ctx.contracts);
    assert.equal(JSON.stringify([...ctx.contracts]), contractsBefore);
    const callerText: NodeSpec[] = [];
    const collectCallerText = (spec: NodeSpec) => {
      if (spec.callerContentProp) callerText.push(spec);
      spec.children?.forEach(collectCallerText);
    };
    data.variants.forEach(variant => collectCallerText(variant.spec));
    assert.ok(callerText.length > 0);
    assert.ok(callerText.every(spec => spec.callerContentProp === 'Caption' && spec.contentProp === undefined));
    assert.doesNotThrow(() => engine.buildBatchScript([data], null));
    // BOOLEAN visibility has no equivalent direct-edit representation and
    // remains an explicit pre-allocation blocker.
    parent.props.push({ name: 'showCaption', type: 'boolean', default: true,
      bindings: { code: { prop: 'showCaption' }, figma: { kind: 'BOOLEAN', property: 'Show caption' } } });
    const captionPart = parent.anatomy.root.parts!.first.parts!.body.parts!.caption;
    captionPart.visibleWhen = { prop: 'showCaption' };
    assert.throws(() => engine.buildComponentScript(parent, ctx.contracts), /FIGMA_CALLER_SLOT_PROPERTY_BINDING_UNSUPPORTED.*Show caption/);
    delete captionPart.visibleWhen;
    parent.props.pop();
    const { figma, root } = createFigmaMock();
    const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
    const run = (code: string) => vm.runInContext(`(async () => {\n${code}\n})()`, context, { timeout: 20_000 });
    for (const c of dependencies) await run(engine.buildComponentScript(c, ctx.contracts));
    // Live Figma invalidates private sublayers when an instance whose slot
    // already has caller content is moved into another instance's slot.
    // This test-host guard rejects that observed bad construction order; it
    // does not pretend to model Figma's virtual node IDs or their stale handles.
    const prototype = Object.getPrototypeOf(root), append = prototype.appendChild;
    prototype.appendChild = function (node: MockNode) {
      if (this.type === 'SLOT' && this._owningInstance() && node.parent !== this) {
        const populated = [node, ...node.findAll()].some((n: any) => n.type === 'INSTANCE' &&
          Object.values(n._slotFills ?? {}).some((fill: any) => fill.length > 0));
        if (populated) throw Error('native-slot-reparent-invalidates-populated-instance');
      }
      return append.call(this, node);
    };
    const mains = dependencies.map(c => root.findOne(n => ['COMPONENT', 'COMPONENT_SET'].includes(n.type) && n.getSharedPluginData('ds_contracts', 'contractId') === c.id) as ComposedMockNode);
    const mainSnapshot = (main: ComposedMockNode) => JSON.stringify({ properties: main.componentPropertyDefinitions, nodes: main.findAll(() => true).map(n => [n.id, n.type, n.name, n.characters]) });
    const before = mains.map(mainSnapshot);
    await run(engine.buildComponentScript(parent, ctx.contracts));
    const main = root.findOne(n => n.type === 'COMPONENT' && n.getSharedPluginData('ds_contracts', 'contractId') === parent.id) as ComposedMockNode;
    assert.ok(main);
    assert.deepEqual(main.findAll(n => n.type === 'TEXT').map(n => n.characters), expectedText('Caller caption'));
    assert.equal(main.findAll(n => n.type === 'INSTANCE').length, mode === 'grid-fill' ? 5 : 4);
    assert.equal(main.findOne(n => n.type === 'TEXT' && n.characters === 'Caller caption')!.fontSize, 21, 'caller content inherits the child host typography');
    assert.equal(main.findAll(n => n.type === 'SLOT').length, mode === 'grid-fill' ? 4 : 3);
    assert.equal(main.children.find(n => n.name === 'empty')!.findAll(n => n.type === 'TEXT').length, 0, 'explicit empty children override slot defaults');
    assert.equal(main.children.find(n => n.name === 'first')!.layoutSizingHorizontal, 'FILL');
    if (mode === 'grid-fill') {
      const instance = main.findOne(n => n.type === 'INSTANCE' && n.name === 'body')!;
      assert.equal(instance.layoutSizingHorizontal, 'FILL');
      const slot = instance.findOne(n => n.type === 'SLOT')!;
      assert.equal(slot.layoutSizingHorizontal, 'FILL', 'slot sizing is refreshed after its instance joins the sized parent');
      assert.equal(slot.children![0].layoutSizingHorizontal, 'FILL');
      const leaf = slot.findOne(n => n.type === 'INSTANCE' && n.name === 'caption')!;
      assert.equal(leaf.layoutSizingHorizontal, 'FILL', 'nested full-width child occupies the established grid cell');
      assert.equal(leaf.findOne(n => n.type === 'SLOT')!.layoutSizingHorizontal, 'FILL');
    }
    assert.deepEqual(mains.map(mainSnapshot), before);
    assert.equal(Object.values(main.componentPropertyDefinitions).filter((v: any) => v.type === 'SLOT').length, 0,
      'child-owned slots do not become disconnected parent properties');
    const instance = main.createInstance();
    assert.equal(instance.exposedInstances.length, 2, 'only eligible direct children are exposed by the parent');
    assert.equal(Object.keys(instance.componentProperties).some(k => k.startsWith('Caption#')), false);
    const callerCaption = instance.findOne(n => n.type === 'TEXT' && n.getSharedPluginData('ds_contracts', 'callerContentProperty') === 'Caption')!;
    assert.ok(callerCaption, 'caller text keeps exact contract correspondence on the editable native node');
    callerCaption.characters = 'Direct canvas edit';
    assert.deepEqual(instance.findAll(n => n.type === 'TEXT').map(n => n.characters), expectedText('Direct canvas edit'));
    assert.deepEqual(main.findAll(n => n.type === 'TEXT').map(n => n.characters), expectedText('Caller caption'), 'editing an instance does not change the main');
    const heading = Object.keys(instance.componentProperties).find(k => k.startsWith('Heading#'))!;
    assert.ok(heading, 'direct component text can still bind while other content occupies nested slots');
    (instance as any).setProperties({ [heading]: 'Changed panel title' });
    assert.deepEqual(instance.findAll(n => n.type === 'TEXT').map(n => n.characters), expectedText('Direct canvas edit', 'Changed panel title'));
    assert.deepEqual(main.findAll(n => n.type === 'TEXT').map(n => n.characters), expectedText('Caller caption'));
    instance.remove();
    const ids = main.findAll(() => true).map(n => n.id);
    await run(engine.buildComponentScript(parent, ctx.contracts));
    assert.deepEqual(main.findAll(() => true).map(n => n.id), ids);
    assert.equal(data.variants[0].spec.children![0].children![0].callerSlotProperty, 'Children');
    parent.props[0].default = 'Amended caller caption';
    await run(engine.buildComponentScript(parent, ctx.contracts));
    assert.deepEqual(main.findAll(n => n.type === 'TEXT').map(n => n.characters), expectedText('Amended caller caption'));
    assert.deepEqual(mains.map(mainSnapshot), before, 'amendment also builds caller content in place without changing dependencies');
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
    delete parent.anatomy.root.parts!.heading;
    delete parent.anatomy.root.literals!.width;
    assert.throws(() => engine.compileComponentData(parent, ctx.contracts), /full-width child needs a definite column or grid/);
    parent.anatomy.root.literals!.width = '300px';
    parent.anatomy.root.parts!.empty.repeat = { from: 'items', sample: [] } as any;
    assert.throws(() => engine.compileComponentData(parent, ctx.contracts), /non-repeated nested instance/);
    parent.anatomy.root = { component: { id: frame.id }, parts: {} };
    assert.throws(() => engine.compileComponentData(parent, ctx.contracts), /non-repeated nested instance/);
  }
});

test('native caller graph owns linked instances, preserves borrowed internals and passes independent readback', async () => {
  const fixture = await nativeComparisonFixture();
  const frame = fixture.contract('fixture.graph-frame', { root: { layout: { display: 'flex', direction: 'column' },
    slot: { name: 'children' } } });
  const parent = fixture.contract('fixture.graph-main', { root: { layout: { display: 'flex', direction: 'column' }, parts: {
    frame: { component: { id: frame.id }, parts: {
      caption: { content: { prop: 'caption' }, tokens: { color: '{ink}' }, declared: { 'font-family': 'Inter' } },
    } },
    spare: { component: { id: frame.id } },
  } } });
  parent.props = [{ name: 'caption', type: 'text', default: 'Caller caption',
    bindings: { code: { prop: 'caption' }, figma: { kind: 'TEXT', property: 'Caption' } } }];
  const contracts = new Map([[parent.id, parent], [frame.id, frame]]);
  const engine = createFigmaEngine({ tokens: { primitives: fixture.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
    icons: new Map(fixture.assets) });
  const operation = await fixture.context('10000000-0000-4000-8000-000000000004');
  const compiled = engine.compileNativeContractGraphDraft(parent, contracts, fixture.source, operation.operation.id);
  assert.equal(compiled.components.at(-1), compiled.component);
  assert.ok(compiled.components.every(component => component.contractId.startsWith(`source-native:${operation.operation.id}:`)));
  const creation = await fixture.run(engine.buildNativeContractGraphDraftScript(parent, contracts, fixture.source, operation));
  assert.equal(creation.status, 'created-candidate', JSON.stringify(creation));
  assert.equal(creation.graphTargets.length, 2);
  const input = { operation: operation.operation, planRevision: revisionOf('caller graph plan'),
    projection: compiled.projection, component: compiled.component, graphComponents: compiled.components,
    tokenInput: operation.tokens.input, tokenIdentity: operation.tokens.identity, creation };
  const receipt = await fixture.run(emitNativeContractReadbackScript(input));
  const verification = verifyNativeContractReadback(input, receipt);
  assert.equal(verification.status, 'supported-structure-observed', JSON.stringify(verification));
  const instance = fixture.figma.root.findOne((n: any) => n.type === 'INSTANCE' &&
    n.getSharedPluginData('ds_contracts', 'nativeContractPart'))!;
  assert.ok(instance);
  const caller = instance.findOne((n: any) => n.type === 'TEXT' &&
    n.getSharedPluginData('ds_contracts', 'callerContentProperty') === 'Caption')!;
  assert.equal(caller.characters, 'Caller caption');
  assert.ok(receipt.nodes.some((n: any) => !creation.nodes.some((born: any) => born.id === n.id)),
    'independent readback inventories inherited instance sublayers without mutating them');

  // Figma re-identifies caller content inside a nested instance's slot after a
  // save or reload (`12:34` becomes `I<instance>;<slot>;<n>`). The rows keep
  // their allocation stamp, type and slot topology; nothing else may relax.
  const settled = settledGraphSlotReceipt(creation, receipt);
  assert.equal(verifyNativeContractReadback(input, settled).status, 'supported-structure-observed', 'settled slot IDs');
  const settledRows = (r: any) => r.nodes.filter((n: any) => n.id.includes(';settled:'));
  const tampered: Array<[string, (r: any) => void]> = [
    ['missing allocation stamp', r => { settledRows(r)[0].metadata.nativeSourceAllocation = ''; }],
    ['copied allocation stamp', r => { const s = settledRows(r)[0], copy = structuredClone(s); copy.id = `${s.id}-copy`;
      r.nodes.find((n: any) => n.id === s.parentId).childIds.push(copy.id); r.nodes.push(copy); }],
    ['original still present beside its copy', r => { const s = settledRows(r)[0]; r.nodes.push({ ...structuredClone(s), id: s.metadata.nativeSourceAllocation }); }],
    ['changed node type', r => { settledRows(r)[0].type = 'RECTANGLE'; }],
    ['ID outside the owning slot', r => { const s = settledRows(r)[0], old = s.id; s.id = 'foreign:1';
      for (const n of r.nodes) { n.childIds = n.childIds.map((id: string) => id === old ? s.id : id); if (n.parentId === old) n.parentId = s.id; } }],
    ['moved out of the slot', r => { const s = settledRows(r)[0], parent = r.nodes.find((n: any) => n.id === s.parentId), page = r.nodes.find((n: any) => n.id === creation.pageId);
      parent.childIds = parent.childIds.filter((id: string) => id !== s.id); s.parentId = page.id; page.childIds.push(s.id); }],
    ['changed caller text', r => { settledRows(r).find((n: any) => n.type === 'TEXT').values.characters = 'Changed'; }],
    ['foreign owner', r => { settledRows(r)[0].metadata.nativeSourceOperation = '{}'; }],
    ['content dropped into an unfilled inherited slot', r => {
      const born = new Set(creation.nodes.map((n: any) => n.id));
      const slot = r.nodes.find((n: any) => n.type === 'SLOT' && !born.has(n.id) && n.childIds.length === 0);
      assert.ok(slot, 'fixture keeps one inherited slot unfilled');
      r.nodes.push({ id: 'foreign:rect', type: 'RECTANGLE', name: 'dropped', parentId: slot.id, childIds: [], values: {}, metadata: {} });
      slot.childIds.push('foreign:rect'); }],
  ];
  for (const [name, mutate] of tampered) {
    const changed = structuredClone(settled); mutate(changed);
    assert.equal(verifyNativeContractReadback(input, changed).status, 'refused', name);
  }
});

/** Rewrites every born caller-content row under a nested instance's slot to a
 * slot-derived ID, as Figma does after a reload, preserving stamps and topology. */
function settledGraphSlotReceipt(creation: any, receipt: any) {
  const out = structuredClone(receipt);
  const born = new Set<string>(creation.nodes.map((n: any) => n.id));
  const rows = new Map<string, any>(out.nodes.map((n: any) => [n.id, n]));
  const boundary = (row: any) => {
    for (let cursor = rows.get(row.parentId); cursor; cursor = rows.get(cursor.parentId))
      if (cursor.type === 'SLOT' || cursor.type === 'INSTANCE') return cursor;
    return undefined;
  };
  const aliases = new Map<string, string>();
  out.nodes.forEach((n: any, i: number) => {
    const slot = boundary(n);
    if (born.has(n.id) && slot?.type === 'SLOT') aliases.set(n.id, `${slot.id};settled:${i}`);
  });
  assert.ok(aliases.size > 0, 'fixture must place caller content inside a nested instance slot');
  for (const n of out.nodes) {
    n.id = aliases.get(n.id) ?? n.id;
    n.parentId = aliases.get(n.parentId) ?? n.parentId;
    n.childIds = n.childIds.map((id: string) => aliases.get(id) ?? id);
  }
  return out;
}

test('composition resources preserve colliding token values and caller property references across native compilation', () => {
  const { parent, child } = family();
  parent.props = [{ name: 'tone', type: 'text', default: '{tone}',
    bindings: { code: { prop: 'tone' }, figma: { kind: 'TEXT', property: 'Caption' } } }];
  const shell = (id: string, name: string) => ContractSchema.parse({ ...child, id, name, props: [],
    anatomy: { root: { layout: { display: 'flex', direction: 'column' }, literals: { width: '100%' },
      tokens: { 'font-size': '{type.size}', color: '{paint.alias}' }, slot: { name: 'children' } } } });
  const first = shell('ds.first', 'First'), second = shell('ds.second', 'Second');
  parent.anatomy.root = { layout: { display: 'flex', direction: 'column' }, literals: { width: '300px' }, parts: {
    first: { component: { id: first.id }, parts: { caption: { content: { prop: 'tone' } } } },
    second: { component: { id: second.id }, parts: { caption: { content: { prop: 'tone' } } } },
  } };
  const resources: ContractResources[] = [{ contractId: parent.id, tokens: {}, assets: [] },
    ...[first, second].map((c, i) => ({ contractId: c.id, assets: [] as Array<[string, string]>, tokens: {
      type: { size: { $type: 'dimension', $value: i ? '27px' : '21px' } },
      paint: { $type: 'color', base: { $value: i ? '#0000ff' : '#ff0000' }, alias: { $value: '{paint.base}' } },
    } }))];
  const originals = structuredClone({ contracts: [parent, first, second], resources });
  const scoped = scopeContractResources([parent, first, second], resources);
  assert.deepEqual({ contracts: [parent, first, second], resources }, originals);
  assert.equal(scopeContractResources([second, parent, first], [...resources].reverse()).revision, scoped.revision);
  assert.deepEqual(scoped.contracts.get(parent.id)!.props, parent.props, 'property names, literal defaults and bindings are not token refs');
  const resolve = makeResolveLiteral(flattenTokens(scoped.tokens));
  const colors = scoped.mappings.filter(m => m.contractId !== parent.id).map(m => resolve(`${m.tokenPrefix}.paint.alias`));
  assert.deepEqual(colors, ['#ff0000', '#0000ff']);
  const engine = createFigmaEngine({ tokens: { primitives: scoped.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: scoped.icons });
  const compiled = engine.compileComponentData(scoped.contracts.get(parent.id)!, scoped.contracts);
  const texts = compiled.variants[0].spec.children!.map(instance => instance.children![0].children![0]);
  assert.deepEqual(texts.map(t => t.fontSize), [21, 27]);
  assert.deepEqual(texts.map(t => t.callerContentProp), ['Caption', 'Caption']);
  assert.deepEqual(texts.map(t => t.contentProp), [undefined, undefined]);
  assert.notEqual(texts[0].textFill, texts[1].textFill);
  const edit = structuredClone(resources); (edit[1].tokens.type as any).size.$value = '23px';
  const changed = scopeContractResources([parent, first, second], edit);
  assert.notEqual(changed.revision, scoped.revision);
  assert.equal(changed.mappings.find(m => m.contractId === second.id)!.tokenPrefix,
    scoped.mappings.find(m => m.contractId === second.id)!.tokenPrefix, 'editing one resource does not retarget another');
  assert.throws(() => scopeContractResources([parent, first, second], resources.slice(1)), /IDENTITIES_INVALID/);
  const dangling = structuredClone(resources); (dangling[1].tokens.paint as any).alias.$value = '{missing}';
  assert.throws(() => scopeContractResources([parent, first, second], dangling), /Cannot resolve token/);
  const cycle = structuredClone(resources); (cycle[1].tokens.paint as any).base.$value = '{paint.alias}';
  assert.throws(() => scopeContractResources([parent, first, second], cycle), /Cannot resolve token/);
});

test('composition resources preserve distinct literal SVG assets and refuse missing or dynamic identities', () => {
  const { parent, child } = family();
  for (const c of [parent, child]) { c.props = []; c.anatomy.root = { parts: { icon: { icon: { asset: 'glyph', size: 16 } } } }; }
  const a = '<svg viewBox="0 0 16 16"><path d="M0 0L16 16"/></svg>';
  const b = '<svg viewBox="0 0 16 16"><path d="M0 16L16 0"/></svg>';
  const resources: ContractResources[] = [parent, child].map((c, i) => ({ contractId: c.id, tokens: {}, assets: [['glyph', i ? b : a]] }));
  const scoped = scopeContractResources([parent, child], resources);
  const engine = createFigmaEngine({ tokens: { primitives: scoped.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: scoped.icons });
  assert.equal(new Set([...scoped.contracts.values()].map(c => c.anatomy.root.parts!.icon.icon!.asset)).size, 2);
  for (const original of [parent, child]) {
    const c = scoped.contracts.get(original.id)!;
    const compiled = engine.compileComponentData(c, scoped.contracts);
    const baseline = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
      icons: new Map([['glyph', original === parent ? a : b]]) }).compileComponentData(original, new Map([[original.id, original]]));
    assert.equal(compiled.variants[0].spec.children![0].svg, baseline.variants[0].spec.children![0].svg);
  }
  resources[0].assets.push(['glyph', a]);
  assert.throws(() => scopeContractResources([parent, child], resources), /ASSET_IDENTITY_DUPLICATE/);
  resources[0].assets = [];
  assert.throws(() => scopeContractResources([parent, child], resources), /ASSET_UNRESOLVED/);
  parent.props.push({ name: 'glyph', type: { enum: ['glyph'] }, bindings: { code: { prop: 'glyph' }, figma: { kind: 'VARIANT', property: 'Glyph' } } });
  parent.anatomy.root.parts!.icon.icon!.asset = '{glyph}';
  assert.throws(() => scopeContractResources([parent, child], resources), /DYNAMIC_ASSET_UNQUALIFIED/);
});
