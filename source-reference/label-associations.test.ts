import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, type Page } from 'playwright-core';
import { captureJs } from '../extract/computed/capture.js';
import type { CapturedNode } from '../extract/computed/lib.js';
import { observeLabelAssociations, verifiedLabelAssociations } from './label-associations.js';

async function capture(page: Page) {
  await page.evaluate(() => { (window as unknown as { __ALL_PROPS: string[] }).__ALL_PROPS = [...getComputedStyle(document.documentElement)]; });
  return page.evaluate(captureJs('#stage', undefined, '', ['#source'])) as Promise<CapturedNode>;
}

test('reads exact explicit, multiple and implicit label relationships without touching the original', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent(`<div id="stage"><div id="source">Leading text
    <button id="alpha" role="checkbox" aria-checked="false">Control</button>
    <label for="alpha">First <span>label</span></label><label for="alpha">Second label</label>
    <label>Implicit <input type="checkbox" disabled></label>
  </div></div>`);
  const tree = await capture(page), image = await page.screenshot(), html = await page.content();
  const result = await observeLabelAssociations(page, ['#source'], tree);
  assert.equal(result.status, 'observed', result.problems.join(';'));
  assert.deepEqual(verifiedLabelAssociations(tree, result), [
    { labelPath: '1', controlPath: '0', controlTag: 'button', mode: 'explicit', sourceId: 'alpha', text: 'First label' },
    { labelPath: '2', controlPath: '0', controlTag: 'button', mode: 'explicit', sourceId: 'alpha', text: 'Second label' },
    { labelPath: '3', controlPath: '3.0', controlTag: 'input', mode: 'implicit', sourceId: '', text: 'Implicit ' },
  ]);
  assert.equal(await page.content(), html);
  assert.deepEqual(await page.screenshot(), image);
  const missing = structuredClone(result); missing.rows.pop();
  assert.throws(() => verifiedLabelAssociations(tree, missing), /coverage-changed/);
  const changed = structuredClone(result); changed.rows[0].controlPath = '1';
  assert.throws(() => verifiedLabelAssociations(tree, changed), /source-changed/);
  const different = structuredClone(tree); different.nodes.push({ t: 'text', v: 'changed' });
  assert.throws(() => verifiedLabelAssociations(different, result), /evidence-changed/);
});

test('refuses missing, external, ambiguous and changed composition relationships', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage();
  for (const [inside, outside, reason] of [
    ['<label for="missing">Missing</label>', '', 'control-missing'],
    ['<label for="outside">External control</label>', '<input id="outside">', 'control-outside-composition'],
    ['<button id="inside">Control</button>', '<label for="inside">External label</label>', 'label-outside-composition'],
    ['<button id="duplicate">Control</button><label for="duplicate">Duplicate ID</label>', '<button id="duplicate">Other</button>', 'id-ambiguous'],
    ['<label>Unassociated text</label>', '', 'control-missing'],
  ]) {
    await page.setContent(`<div id="stage"><div id="source">${inside}</div>${outside}</div>`);
    const evidence = await observeLabelAssociations(page, ['#source'], await capture(page));
    assert.equal(evidence.status, 'refused'); assert.deepEqual(evidence.rows, []);
    assert.match(evidence.problems.join(';'), new RegExp(reason));
  }
  await page.setContent('<div id="stage"><div id="source"><button id="a">One</button><label for="a">Name</label></div></div>');
  const tree = await capture(page);
  await page.locator('#source').evaluate(el => el.appendChild(document.createElement('span')));
  assert.match((await observeLabelAssociations(page, ['#source'], tree)).problems.join(';'), /tree-changed/);
});
