import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { ContractSchema } from '../scripts/contract-schema.js';
import { reactEmitter, reactInlineEmitter, htmlEmitter } from './emitter.js';
import { mountGenerated } from './react-test-runtime.js';

test('root text, variant text and live content survive generated React and HTML alongside children', async () => {
  const browser = await chromium.launch();
  try {
    const cases = [
      { root: { text: 'A < B & {literal}' }, props: {}, expected: 'A < B & {literal}Suffix' },
      { root: { text: '' }, props: {}, expected: 'Suffix' },
      { root: { text: 'Base', textByProp: { prop: 'tone', map: { quiet: '' } } }, props: { tone: 'quiet' }, expected: 'Suffix' },
      { root: { content: { prop: 'label' } }, props: { label: 'Updated <text>' }, expected: 'Updated <text>Suffix' },
    ];
    for (const item of cases) {
      const contract = ContractSchema.parse({
        id: 'probe.root-content', name: 'RootContent', version: '0.1.0', status: 'draft',
        description: 'Root content conformance', archetype: 'none', semantics: { element: 'div' },
        props: [
          { name: 'tone', type: { enum: ['normal', 'quiet'] }, default: 'normal', bindings: { code: { prop: 'tone' }, figma: { kind: 'VARIANT', property: 'Tone', values: { normal: 'Normal', quiet: 'Quiet' } } } },
          { name: 'label', type: 'text', default: 'Default label', bindings: { code: { prop: 'label' }, figma: { kind: 'TEXT', property: 'Label' } } },
        ],
        states: [], anatomy: { root: { ...item.root, parts: { suffix: { text: 'Suffix' } } } },
        bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: './RootContent', export: 'RootContent' } } },
      });
      const ctx = { contracts: new Map([[contract.id, contract]]), icons: new Map<string, string>(), tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } } };
      for (const emitter of [reactEmitter, reactInlineEmitter]) {
        const files = emitter.emit(contract, ctx);
        const page = await browser.newPage();
        try {
          const render = await mountGenerated(page, contract.name, files[0].contents, files.find(f => f.path.endsWith('.css'))?.contents ?? '');
          await render(item.props);
          assert.equal((await page.locator('#root').textContent())?.replace(/\s+/g, ' ').trim(), item.expected);
          if (item.root.content) {
            await render({ label: '' });
            assert.equal(await page.locator('#root').textContent(), 'Suffix');
          }
        } finally { await page.close(); }
      }
      const observed = structuredClone(contract);
      for (const prop of observed.props) if (prop.name in item.props) prop.default = item.props[prop.name as keyof typeof item.props];
      const page = await browser.newPage();
      try {
        await page.setContent(htmlEmitter.emit(observed, { ...ctx, contracts: new Map([[observed.id, observed]]) })[0].contents);
        assert.equal((await page.locator('.showcase__item > .root-content').first().textContent())?.replace(/\s+/g, '').trim(), item.expected.replace(/\s+/g, ''));
        assert.equal(await page.locator('.root-content text').count(), 0, 'text punctuation must not become HTML');
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
