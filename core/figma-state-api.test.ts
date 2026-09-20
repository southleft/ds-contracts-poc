import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import { createFigmaEngine } from './emit-figma-script.js';
import { proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { readCodeValueAxes } from './figma-code-values.js';
import { emitReactInline } from './emit-react-inline.js';
import { mountGenerated, generatedTypeErrors } from './react-test-runtime.js';
import type { DumpSet } from '../extract/figma/types.js';

const tokens = {
  primitives: {},
  semantic: {},
  light: {},
  dark: {},
  brands: { default: {} },
};
const engine = createFigmaEngine({ tokens, icons: new Map() });
function fixture(): Contract {
  return ContractSchema.parse({
    id: 'test.state-api',
    name: 'NativeChoice',
    version: '1.0.0',
    status: 'draft',
    description: 'Retained state inputs.',
    semantics: {
      element: 'button',
      role: 'switch',
      roleException: 'Declared button-backed switch.',
    },
    props: [
      {
        name: 'state',
        type: { enum: ['off', 'on'] },
        bindings: {
          code: {
            prop: 'chosen',
            values: { off: false, on: true },
            initial: { prop: 'seed', default: 'off' },
          },
          figma: {
            kind: 'VARIANT',
            property: 'State',
            unsetValue: '(unset)',
            values: { off: 'Off', on: 'On' },
          },
        },
      },
      {
        name: 'disabled',
        type: 'boolean',
        bindings: {
          code: { prop: 'locked' },
          figma: {
            kind: 'VARIANT',
            property: 'Disabled',
            unsetValue: '(unset)',
          },
        },
      },
    ],
    states: [],
    events: [
      {
        name: 'change',
        trigger: 'root',
        toggles: { prop: 'state', between: ['off', 'on'], aria: 'checked' },
        bindings: { code: { prop: 'onNotify', argument: 'next-value' } },
      },
    ],
    anatomy: {
      root: {
        layout: { display: 'flex' },
        text: 'Choose',
        literals: { 'background-color': '#ffffff' },
        literalsByProp: [
          {
            prop: 'state',
            map: {
              on: { 'background-color': '#00ff00' },
              off: { 'background-color': '#ff0000' },
            },
          },
        ],
      },
    },
    bindings: {
      code: {
        anchors: { importPath: './NativeChoice', export: 'NativeChoice' },
      },
      figma: { anchors: { fileKey: null, componentSetKey: null } },
    },
  });
}
async function native(c = fixture()) {
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({
    figma,
    console: { log() {}, warn() {}, error() {} },
  });
  const run = (script: string) =>
    vm.runInContext(`(async()=>{${script}\n})()`, context, {
      timeout: 20000,
    }) as Promise<any>;
  const script = engine.buildComponentScript(c, new Map([[c.id, c]]));
  await run(script);
  const node = root.findOne(
    (n: any) =>
      n.type === 'COMPONENT_SET' &&
      n.getSharedPluginData('ds_contracts', 'contractId') === c.id,
  );
  assert.ok(node);
  const dump = async () => {
    const code = readFileSync(
      new URL('../extract/figma/dump.plugin.js', import.meta.url),
      'utf8',
    ).replace(
      /^const TARGET_SETS = \[[^\n]*\];$/m,
      `const TARGET_SETS = ${JSON.stringify([node.name])};`,
    );
    return (await run(code))[node.name] as DumpSet;
  };
  return { node, run, script, dump };
}
function proposal(set: DumpSet) {
  return proposeFromDump(set, {
    corpus: tokenCorpusFromJson({
      primitives: {},
      semantic: {},
      light: {},
      brandDefault: {},
    }),
    contractIdByName: new Map(),
    fileKey: null,
    projectionMode: 'exact',
    mintUnbound: true,
  });
}
function propose(set: DumpSet) {
  return ContractSchema.parse(proposal(set).contract);
}

test('native metadata returns distinct controlled, initial and callback inputs with repeat identity', async () => {
  const original = fixture(),
    live = await native(original),
    set = await live.dump(),
    back = propose(set);
  assert.equal((set.codeValueAxes as any).version, 2);
  assert.equal(set.variants.length, 9);
  for (const p of original.props)
    assert.deepEqual(
      back.props.find((q) => q.name === p.name)?.bindings.code,
      p.bindings.code,
    );
  assert.deepEqual(back.events, original.events);
  assert.equal(back.semantics.role, 'switch');
  assert.equal(back.props[0].default, undefined);
  assert.equal(back.props[0].bindings.figma.unsetValue, '(unset)');
  await live.run(live.script);
  assert.deepEqual(await live.dump(), set);
});

test('metadata cannot promote damaged native domains or executable/unrepresented semantics', async () => {
  const set = await (await native()).dump();
  const mutations: Array<(s: any) => void> = [
    (s) => {
      s.variants.pop();
    },
    (s) => {
      s.variants.push(s.variants[0]);
    },
    (s) => {
      s.semantics.role = 'checkbox';
    },
    (s) => {
      s.propertyDefinitions.Disabled.defaultValue = 'true';
    },
    (s) => {
      s.propertyDefinitions.Disabled.variantOptions.push('maybe');
    },
    (s) => {
      s.variants[0].variantProperties.Disabled = 'true';
    },
    (s) => {
      s.variants[0].name = 'State=Off, Disabled=true';
    },
    (s) => {
      s.codeValueAxes.stateApi.props[0].bindings.code.values.off = 'false';
    },
    (s) => {
      s.codeValueAxes.stateApi.props[0].bindings.code.initial.prop = 'chosen';
    },
    (s) => {
      s.codeValueAxes.stateApi.props[0].default = 'on';
    },
    (s) => {
      s.codeValueAxes.axes[0].required = true;
    },
    (s) => {
      s.codeValueAxes.stateApi.events[0].trigger = 'child';
    },
    (s) => {
      s.codeValueAxes.stateApi.events[0].bindings.code.argument = 'event';
    },
    (s) => {
      s.codeValueAxes.stateApi.events[0].toggles.between = ['on', 'off'];
    },
    (s) => {
      s.codeValueAxes.stateApi.script = 'arbitrary()';
    },
    (s) => {
      s.codeValueAxes.extra = true;
    },
    (s) => {
      s.codeValueAxes.version = 3;
    },
  ];
  for (const [i, mutate] of mutations.entries()) {
    const bad = structuredClone(set);
    mutate(bad);
    assert.throws(() => readCodeValueAxes(bad), /METADATA_INVALID/, String(i));
  }
});

test('writer refuses retained-input retirement or reinterpretation before mutations and upgrades matching old typed metadata', async () => {
  const original = fixture(),
    live = await native(original),
    set = await live.dump();
  for (const mutate of [
    (c: Contract) => {
      delete c.events![0].bindings.code.argument;
    },
    (c: Contract) => {
      c.props.push({
        name: 'label',
        type: 'text',
        bindings: {
          code: { prop: 'label' },
          figma: { kind: 'TEXT', property: 'Label' },
        },
      });
    },
    (c: Contract) => {
      delete c.props[0].bindings.code.initial;
    },
    (c: Contract) => {
      c.props[0].bindings.code.initial!.prop = 'anotherSeed';
    },
    (c: Contract) => {
      c.props[0].bindings.code.initial!.default = 'on';
    },
    (c: Contract) => {
      c.events![0].bindings.code.prop = 'onDifferent';
    },
    (c: Contract) => {
      c.props[1].bindings.code.prop = 'blocked';
    },
  ]) {
    const bad = structuredClone(original);
    mutate(bad);
    await assert.rejects(
      live.run(engine.buildComponentScript(bad, new Map([[bad.id, bad]]))),
      /RETIREMENT_REFUSED/,
    );
    assert.deepEqual(await live.dump(), set);
  }
  const stamp = JSON.parse(
    live.node.getSharedPluginData('ds_contracts', 'codeValueAxes'),
  );
  delete stamp.stateApi;
  stamp.version = 1;
  live.node.setSharedPluginData(
    'ds_contracts',
    'codeValueAxes',
    JSON.stringify(stamp),
  );
  await live.run(live.script);
  assert.deepEqual(await live.dump(), set);
  const reordered = JSON.parse(
    live.node.getSharedPluginData('ds_contracts', 'codeValueAxes'),
  );
  reordered.stateApi.props[0].bindings.code = {
    ...reordered.stateApi.props[0].bindings.code,
    initial: reordered.stateApi.props[0].bindings.code.initial,
  };
  live.node.setSharedPluginData(
    'ds_contracts',
    'codeValueAxes',
    JSON.stringify({
      stateApi: reordered.stateApi,
      axes: reordered.axes,
      version: 2,
    }),
  );
  await live.run(live.script);
  assert.deepEqual(await live.dump(), set);
});

test('broader existing controls keep native appearance without claiming the bounded retained API', async () => {
  for (const broader of [
    'text-input',
    'callback-without-next-value',
  ] as const) {
    const c = fixture();
    if (broader === 'text-input') {
      c.props.push({
        name: 'label',
        type: 'text',
        default: 'Choose',
        bindings: {
          code: { prop: 'label' },
          figma: { kind: 'TEXT', property: 'Label' },
        },
      });
      c.anatomy.root.text = '{label}';
    } else delete c.events![0].bindings.code.argument;
    const live = await native(c),
      set = await live.dump();
    assert.equal((set.codeValueAxes as any).version, 1);
    assert.equal((set.codeValueAxes as any).stateApi, undefined);
    assert.equal(readCodeValueAxes(set).length, 1);
    assert.equal(set.variants.length, 9);
    await live.run(live.script);
    assert.deepEqual(
      await live.dump(),
      set,
      'unchanged appearance repeats in place',
    );
  }
});

test('returned React executes the retained state API independently of source code', async () => {
  const returned = proposal(await (await native()).dump()),
    back = ContractSchema.parse(returned.contract);
  const output = emitReactInline(back, {
    tokens: { ...tokens, primitives: returned.mintedTokens?.tree ?? {} },
    contracts: new Map([[back.id, back]]),
    icons: new Map(),
  });
  assert.deepEqual(generatedTypeErrors(back.name, output.tsx), []);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await mountGenerated(page, back.name, output.tsx, '');
    const render = (props: Record<string, unknown>) =>
      page.evaluate((props) => {
        const w = window as any;
        w.renderSubject({ ...props, onNotify: w.report });
      }, props);
    let instance = 0;
    const control = page.getByRole('switch');
    await page.evaluate(
      'window.calls=[];window.report=value=>window.calls.push(value)',
    );
    for (const chosen of [undefined, false, true])
      for (const seed of [undefined, false, true])
        for (const locked of [undefined, false, true]) {
          await page.evaluate('window.calls=[]');
          const props = {
            ...(chosen === undefined ? {} : { chosen }),
            ...(seed === undefined ? {} : { seed }),
            ...(locked === undefined ? {} : { locked }),
          };
          await render({ ...props, key: instance++ });
          assert.equal(
            await control.getAttribute('aria-checked'),
            String(chosen ?? seed ?? false),
          );
          const before = chosen ?? seed ?? false;
          if (!locked) await control.press('Space');
          else {
            await control.focus();
            await page.keyboard.press('Space');
          }
          assert.equal(
            await control.getAttribute('aria-checked'),
            String(locked ? before : (chosen ?? !before)),
          );
          assert.deepEqual(
            await page.evaluate('window.calls'),
            locked ? [] : [!before],
          );
        }
    await render({ key: instance, seed: false });
    await render({ key: instance, seed: true });
    assert.equal(await control.getAttribute('aria-checked'), 'false');
  } finally {
    await browser.close();
  }
});

test('checkbox indeterminate state remains a typed initializer, and malformed prior metadata cannot be overwritten', async () => {
  const c = fixture();
  c.semantics.role = 'checkbox';
  c.props[0].type = { enum: ['off', 'on', 'mixed'] };
  c.props[0].bindings.code.values!.mixed = 'indeterminate';
  c.props[0].bindings.figma.values!.mixed = 'Mixed';
  c.props[0].bindings.code.initial!.default = 'mixed';
  const live = await native(c),
    set = await live.dump(),
    back = propose(set);
  assert.equal(set.variants.length, 12);
  assert.deepEqual(back.props[0].bindings.code, c.props[0].bindings.code);
  const original = live.node.getSharedPluginData(
    'ds_contracts',
    'codeValueAxes',
  );
  for (const prior of [
    '{',
    JSON.stringify({ ...JSON.parse(original), extra: true }),
    JSON.stringify({ ...JSON.parse(original), version: 3 }),
  ]) {
    live.node.setSharedPluginData('ds_contracts', 'codeValueAxes', prior);
    const before = await live.dump();
    await assert.rejects(live.run(live.script), /RETIREMENT_REFUSED/);
    assert.deepEqual(await live.dump(), before);
  }
  live.node.setSharedPluginData('ds_contracts', 'codeValueAxes', original);
  assert.deepEqual(await live.dump(), set);
  c.semantics.role = 'switch';
  assert.throws(
    () => engine.buildComponentScript(c, new Map([[c.id, c]])),
    /FIGMA_STATE_API_METADATA_INVALID/,
  );
});
