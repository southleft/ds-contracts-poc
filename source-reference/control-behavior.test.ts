import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { observeCheckboxBehavior } from './control-behavior.js';

test('native and button-backed checkboxes exercise label and keyboard from fresh mounts, including mixed and disabled states', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage();
  for (const kind of ['input','button']) for (const checked of ['false','true','mixed'] as const) for (const disabled of [false,true]) {
    const reset = async () => {
      await page.setContent(kind === 'input'
        ? `<input id="control" type="checkbox" ${disabled ? 'disabled' : ''}><label for="control">Receive updates</label>`
        : `<button id="control" role="checkbox" aria-checked="${checked}" ${disabled ? 'disabled' : ''}></button><label for="control">Receive updates</label>`);
      await page.locator('#control').evaluate((node, checked) => {
        if (node instanceof HTMLInputElement) { node.checked = checked === 'true'; node.indeterminate = checked === 'mixed'; }
        else node.addEventListener('click', () => node.setAttribute('aria-checked', node.getAttribute('aria-checked') === 'true' ? 'false' : 'true'));
      }, checked);
    };
    const result = await observeCheckboxBehavior(page, { selector: '#control', checked, disabled, label: 'Receive updates' }, reset);
    assert.equal(result.status, 'observed', JSON.stringify({kind,checked,disabled,result}));
    assert.equal(result.rows.length, 2);
    assert(result.rows.every(row => row.before === checked && row.passed));
    assert.equal(await page.locator('#control').evaluate(node => node instanceof HTMLInputElement
      ? node.indeterminate ? 'mixed' : String(node.checked) : node.getAttribute('aria-checked')), checked);
  }
});

test('look-alike inactive controls and broken associations cannot pass behavior evidence', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage();
  const input = { selector: '#control', checked: 'false' as const, disabled: false, label: 'Receive updates' };
  const inert = await observeCheckboxBehavior(page, input, () => page.setContent('<button id="control" role="checkbox" aria-checked="false"></button><label for="control">Receive updates</label>'));
  assert.equal(inert.status, 'failed');
  assert.deepEqual(inert.rows.map(row => row.passed), [false,false]);
  const wrongLabel = await observeCheckboxBehavior(page, input, () => page.setContent('<input id="control" type="checkbox"><input id="other" type="checkbox"><label for="other">Receive updates</label>'));
  assert(wrongLabel.problems.includes('behavior-label-association-mismatch'));
  assert.equal(wrongLabel.rows.length, 0);
  const wrongState = await observeCheckboxBehavior(page, input, () => page.setContent('<input id="control" type="checkbox" checked><label for="control">Receive updates</label>'));
  assert(wrongState.problems.includes('behavior-initial-state-mismatch'));
});

test('restoration failure invalidates otherwise successful interactions', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage(); let resets = 0;
  const result = await observeCheckboxBehavior(page, {selector:'#control',checked:'false',disabled:false,label:'Receive updates'}, async () => {
    if (++resets === 3) throw Error('lost page');
    await page.setContent('<input id="control" type="checkbox"><label for="control">Receive updates</label>');
  });
  assert(result.rows.every(row => row.passed));
  assert.equal(result.status, 'failed');
  assert.deepEqual(result.problems, ['behavior-restore-failed']);
});

test('a checked-state toggle is exercised by its observed role: a switch toggles like a checkbox, mixed belongs to a checkbox only, other roles stay refused', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage();
  const mount = (role: string, checked: string, disabled = false) => async () => {
    await page.setContent(`<button id="control" role="${role}" aria-checked="${checked}" ${disabled ? 'disabled' : ''}></button><label for="control">Receive updates</label>`);
    await page.locator('#control').evaluate(node => node.addEventListener('click', () => node.setAttribute('aria-checked', node.getAttribute('aria-checked') === 'true' ? 'false' : 'true')));
  };
  for (const checked of ['false','true'] as const) for (const disabled of [false,true]) {
    const result = await observeCheckboxBehavior(page, { selector: '#control', checked, disabled, label: 'Receive updates' }, mount('switch', checked, disabled));
    assert.equal(result.status, 'observed', JSON.stringify({checked,disabled,result}));
    assert.equal(result.role, 'switch');
    assert.deepEqual(result.rows.map(row => [row.before, row.after, row.passed]), [0,1].map(() => [checked, disabled ? checked : checked === 'true' ? 'false' : 'true', true]));
  }
  assert.equal((await observeCheckboxBehavior(page, { selector: '#control', checked: 'false', disabled: false, label: 'Receive updates' }, mount('checkbox', 'false'))).role, 'checkbox');
  // ARIA defines no mixed switch. A source that claims one is not a member of this class.
  const mixed = await observeCheckboxBehavior(page, { selector: '#control', checked: 'mixed', disabled: false, label: 'Receive updates' }, mount('switch', 'mixed'));
  assert.equal(mixed.status, 'failed');
  assert.deepEqual(mixed.problems, ['behavior-state-unsupported-for-role']);
  assert.equal(mixed.rows.length, 0);
  for (const role of ['radio', 'menuitemcheckbox', 'button']) {
    const other = await observeCheckboxBehavior(page, { selector: '#control', checked: 'false', disabled: false, label: 'Receive updates' }, mount(role, 'false'));
    assert.equal(other.status, 'failed', role);
    assert.deepEqual(other.problems, ['behavior-initial-state-mismatch'], role);
    assert.equal(other.role, undefined, role);
  }
  // The role observed first is the role of the whole observation.
  let mounts = 0;
  const changing = await observeCheckboxBehavior(page, { selector: '#control', checked: 'false', disabled: false, label: 'Receive updates' },
    async () => mount(++mounts === 1 ? 'switch' : 'checkbox', 'false')());
  assert.equal(changing.status, 'failed');
  assert(changing.problems.includes('behavior-role-changed'), JSON.stringify(changing));
});
