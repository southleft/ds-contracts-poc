import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { generateComponents } from '../scripts/generate-components.js';
import { literalAttrJsx, literalDocText, literalStringJs } from './emit-literal.js';
import { reactEmitter, reactInlineEmitter } from './emitter.js';
import { formatTsx } from './format.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';

// Figma text as the cold-start test met it (Altitude Banner, 2026-09-28), plus
// every character that can end a literal early: a single quote, a double
// quote, a backslash, a line break, a JSX entity and a comment terminator.
const MESSAGE = 'We\'re rolling out "v2" \\ C:\\temp\nsecond line */ & done';
const HEADING = 'Say "hi" & bye';
const CAPTION = 'Tom & "Jerry" \\ friends';

function contracts(): { parent: Contract; child: Contract } {
  const anchors = (name: string) => ({ figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: `./${name}`, export: name } } });
  const child = ContractSchema.parse({
    id: 'probe.quote-child', name: 'QuoteChild', version: '0.1.0', status: 'draft',
    description: 'Composed child for literal escaping', archetype: 'none', semantics: { element: 'span' },
    props: [{ name: 'caption', type: 'text', default: 'Child caption', bindings: { code: { prop: 'caption' }, figma: { kind: 'TEXT', property: 'Caption' } } }],
    states: [], anatomy: { root: { parts: { caption: { element: 'span', content: { prop: 'caption' } } } } },
    bindings: anchors('QuoteChild'),
  });
  const parent = ContractSchema.parse({
    id: 'probe.quote-parent', name: 'QuoteParent', version: '0.1.0', status: 'draft',
    description: 'Parent whose Figma description holds */ a comment terminator', archetype: 'none', semantics: { element: 'div' },
    props: [
      // An enum axis makes the story generator write its Matrix, where a
      // required text prop becomes a JSX attribute in every cell.
      { name: 'tone', type: { enum: ['normal', 'quiet'] }, default: 'normal', bindings: { code: { prop: 'tone' }, figma: { kind: 'VARIANT', property: 'Tone', values: { normal: 'Normal', quiet: 'Quiet' } } } },
      { name: 'message', type: 'text', default: MESSAGE, description: 'Says */ things', bindings: { code: { prop: 'message' }, figma: { kind: 'TEXT', property: 'Message' } } },
      { name: 'heading', type: 'text', required: true, default: HEADING, bindings: { code: { prop: 'heading' }, figma: { kind: 'TEXT', property: 'Heading' } } },
    ],
    states: [],
    anatomy: { root: { parts: {
      title: { element: 'strong', content: { prop: 'heading' } },
      body: { element: 'span', content: { prop: 'message' } },
      child: { component: { id: 'probe.quote-child', props: { caption: CAPTION } } },
    } } },
    bindings: anchors('QuoteParent'),
  });
  return { parent, child };
}

test('ordinary text keeps its historical spelling; text that would end a literal is escaped and round-trips', () => {
  assert.equal(literalStringJs('Badge'), "'Badge'");
  assert.equal(literalStringJs('A < B & {literal}'), "'A < B & {literal}'");
  assert.equal(literalAttrJsx('label', 'Badge'), 'label="Badge"');
  assert.equal(literalAttrJsx('label', "We're"), 'label="We\'re"');
  assert.equal(literalDocText('Plain description'), 'Plain description');
  for (const text of [MESSAGE, HEADING, CAPTION, "It's", 'back\\slash', 'line\r\nbreak']) {
    assert.equal(new Function(`return ${literalStringJs(text)};`)(), text);
  }
  assert.equal(literalAttrJsx('label', HEADING), `label={${JSON.stringify(HEADING)}}`);
  assert.equal(literalDocText('ends */ early'), 'ends *\\/ early');
});

test('a Figma text default with a quote, a backslash and a line break emits, type-checks and renders verbatim on both React surfaces', async () => {
  const { parent, child } = contracts();
  const tokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const ctx = { contracts: new Map([[parent.id, parent], [child.id, child]]), icons: new Map<string, string>(), tokens };
  const browser = await chromium.launch();
  try {
    for (const emitter of [reactEmitter, reactInlineEmitter]) {
      const childFiles = emitter.emit(child, ctx), files = emitter.emit(parent, ctx);
      const tsx = await formatTsx(files[0].contents);
      const childTsx = await formatTsx(childFiles[0].contents);
      assert.deepEqual(generatedTypeErrors(parent.name, tsx, { QuoteChild: childTsx }), [], emitter.name);
      if (emitter === reactEmitter) await formatTsx(files.find(f => f.path.endsWith('.stories.tsx'))!.contents);
      const page = await browser.newPage();
      try {
        const render = await mountGenerated(page, parent.name, tsx, files.find(f => f.path.endsWith('.css'))?.contents ?? '',
          { QuoteChild: { tsx: childTsx, css: childFiles.find(f => f.path.endsWith('.css'))?.contents ?? '' } });
        await render({ heading: HEADING });
        const text = await page.locator('#root').evaluate(el => el.textContent);
        assert.equal(text, HEADING + MESSAGE + CAPTION, emitter.name);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});

test('the library generator (the figma:to-react path) no longer refuses such text, stories included', async t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'emit-literal-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { parent, child } = contracts();
  const contractFiles = [child, parent].map((c, i) => { const f = path.join(dir, `${i}.contract.json`); writeFileSync(f, JSON.stringify(c)); return f; });
  const tokenFiles = ['primitives', 'semantic', 'light', 'dark'].map(slot => { const f = path.join(dir, `${slot}.tokens.json`); writeFileSync(f, '{}'); return `${slot}=${f}`; });
  const result = await generateComponents({ contractFiles, tokenFiles, iconsDir: path.join(dir, 'icons'), outDir: path.join(dir, 'out'), stories: true });
  assert.deepEqual(result.refused, []);
  assert.deepEqual(result.generated, ['QuoteChild', 'QuoteParent']);
  const read = (name: string, file: string) => readFileSync(path.join(dir, 'out', name, file), 'utf8');
  const tsx = read('QuoteParent', 'QuoteParent.tsx'), childTsx = read('QuoteChild', 'QuoteChild.tsx');
  assert.deepEqual(generatedTypeErrors('QuoteParent', tsx, { QuoteChild: childTsx }), []);
  assert.ok(tsx.includes('/** Parent whose Figma description holds *\\/ a comment terminator */'));
  // The story's required-text attribute carries the double quote as an expression.
  const stories = read('QuoteParent', 'QuoteParent.stories.tsx');
  assert.ok(stories.includes(`<QuoteParent tone="quiet" heading={'${HEADING}'} />`), 'Matrix cells carry the double quote as an expression');
  assert.ok(stories.includes(`heading: '${HEADING}',`));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const render = await mountGenerated(page, 'QuoteParent', tsx, read('QuoteParent', 'QuoteParent.module.css'),
      { QuoteChild: { tsx: childTsx, css: read('QuoteChild', 'QuoteChild.module.css') } });
    await render({ heading: HEADING });
    assert.equal(await page.locator('#root').evaluate(el => el.textContent), HEADING + MESSAGE + CAPTION);
  } finally { await browser.close(); }
});
