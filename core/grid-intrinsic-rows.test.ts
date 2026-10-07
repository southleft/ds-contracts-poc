import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { evaluateIntrinsicGridRows } from './grid-intrinsic-rows.js';

test('intrinsic fractional rows agree with browser sizing, including empty rows and subunit factors', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (let i = 0; i < 48; i++) {
      const factors = Array.from({ length: 2 + i % 5 }, (_, j) => [0.25, 0.5, 1, 2, 3][(i + j) % 5]);
      const gap = i % 4;
      const contributions = Array.from({ length: 1 + i % factors.length }, (_, row) =>
        ({ row, span: 1 as const, size: 12 + ((i + row * 7) % 11) * 3 }));
      await page.setContent(`<div id="grid" style="display:grid;width:820px;height:auto;align-content:start;row-gap:${gap}px;grid-template-rows:${factors.map(f => `minmax(0,${f}fr)`).join(' ')}">${contributions.map(c => `<div style="height:${c.size}px"></div>`).join('')}</div>`);
      const observed = await page.locator('#grid').evaluate(el => ({
        rows: getComputedStyle(el).gridTemplateRows.split(' ').map(parseFloat), height: el.getBoundingClientRect().height,
      }));
      const result = evaluateIntrinsicGridRows({ factors, gap }, contributions);
      assert.ok(Math.abs(result.height - observed.height) < 0.1, JSON.stringify({ factors, result, observed }));
      assert.ok(result.rows.every((size, row) => Math.abs(size - observed.rows[row]) < 0.1), JSON.stringify({ i, factors, contributions, result, observed }));
    }
  } finally { await browser.close(); }
});

test('fresh intrinsic contributions allow growth, shrink, and removal without mutating the source rule', () => {
  const rule = Object.freeze({ factors: Object.freeze([1, 1, 1, 1, 1]), gap: 0 });
  const items = [24, 24, 24, 24].map((size, i) => ({ row: Math.floor(i / 2), span: 1 as const, size }));
  assert.equal(evaluateIntrinsicGridRows(rule, items).height, 120);
  assert.equal(evaluateIntrinsicGridRows(rule, [{ ...items[0], size: 48 }, ...items.slice(1)]).height, 240);
  assert.equal(evaluateIntrinsicGridRows(rule, items).height, 120);
  assert.deepEqual(evaluateIntrinsicGridRows(rule, []), { fraction: 0, rows: [0, 0, 0, 0, 0], height: 0 });
  assert.equal(evaluateIntrinsicGridRows({ factors: [1, 2], gap: 4 }, [
    { row: 0, span: 1, size: 20 }, { row: 1, span: 1, size: 80 },
  ]).height, 124);
});

test('unsupported placements, invalid numbers, and overflow refuse rather than producing native geometry', () => {
  for (const factors of [[], [0], [-1], [NaN], [Infinity]])
    assert.throws(() => evaluateIntrinsicGridRows({ factors, gap: 0 }, []), /invalid-rule/);
  for (const gap of [-1, NaN, Infinity])
    assert.throws(() => evaluateIntrinsicGridRows({ factors: [1], gap }, []), /invalid-rule/);
  for (const item of [
    { row: -1, span: 1, size: 1 }, { row: 1, span: 1, size: 1 },
    { row: 0.5, span: 1, size: 1 }, { row: 0, span: 2, size: 1 },
    { row: 0, span: 1, size: NaN }, { row: 0, span: 1, size: -1 },
  ]) assert.throws(() => evaluateIntrinsicGridRows({ factors: [1], gap: 0 }, [item as never]), /invalid-contribution/);
  assert.throws(() => evaluateIntrinsicGridRows({ factors: [1, Number.MAX_VALUE], gap: 0 },
    [{ row: 0, span: 1, size: Number.MAX_VALUE }]), /overflow/);
});
