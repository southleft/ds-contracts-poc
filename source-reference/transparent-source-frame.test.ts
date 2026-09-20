import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { captureTransparentSourceFrame } from './transparent-source-frame-v2.js';

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const html = `<!doctype html><style>
html,body {margin:0; background:white;} #stage {padding:32px;}
#target {display:block;box-sizing:border-box;width:32px;height:18.4px;background:#aaa;
 border:1px solid transparent;border-radius:99px;box-shadow:0 1px 2px #0001;position:relative;}
#thumb {display:block;width:16px;height:16px;border-radius:99px;background:white;}
#target::after {content:'';position:absolute;inset:-8px;background:transparent;}
</style><div id="stage"><div id="target"><span id="thumb"></span></div></div>`;

test('transparent frame authenticates and restores fractional-size source without resampling', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 160, height: 120 }, deviceScaleFactor: 1 });
    await page.setContent(html);
    const original = await page.screenshot({ fullPage: true, caret: 'initial' });
    const first = await captureTransparentSourceFrame(page, '#target', sha(original));
    const repeat = await captureTransparentSourceFrame(page, '#target', sha(original));
    assert.deepEqual(first, repeat);
    assert.equal(first.receipt.version, 2);
    assert.deepEqual(first.receipt.component.opaqueScope, {kind:'chromium-light-tree-v1',targetNodes:2,ancestorNodes:3});
    assert.deepEqual(first.receipt.bounds, { x: 32, y: 32, width: 32, height: 18.390625 });
    assert.deepEqual(first.receipt.rootOffset, { x: 8, y: 8 });
    assert.deepEqual(first.receipt.crop, { x: 24, y: 24, width: 48, height: 35 });
    const full = PNG.sync.read(first.transparent), crop = PNG.sync.read(first.bytes);
    for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
      const a = (y * crop.width + x) * 4, b = ((y + 24) * full.width + x + 24) * 4;
      assert.deepEqual(crop.data.subarray(a, a + 4), full.data.subarray(b, b + 4));
    }
    assert((await page.screenshot({ fullPage: true, caret: 'initial' })).equals(original));
  } finally { await browser.close(); }
});

test('capture refuses context dependence, external paint and clipped content while restoring original', async t => {
  const browser = await chromium.launch();
  try {
    const controls: Array<[string, string, RegExp]> = [
      ['ancestor opacity', '#stage{opacity:.5}', /ancestor-context/],
      ['ancestor transform', '#stage{transform:translateX(.5px)}', /ancestor-context/],
      ['ancestor clip', '#stage{overflow:hidden;height:1px}', /ancestor-context/],
      ['ancestor paint containment', '#stage{contain:paint}', /ancestor-context/],
      ['ancestor background', '#stage{background:red}', /external-paint/],
      ['host border', 'body{border:1px solid red}', /host-paint/],
      ['host gradient', 'body{background:linear-gradient(red,blue)}', /host-paint/],
      ['ancestor pseudo', '#stage::before{content:"";position:absolute;inset:0;background:red}', /external-pseudo/],
      ['component blending', '#target{mix-blend-mode:multiply}', /dependent-paint:mix-blend-mode/],
      ['child blending', '#thumb{mix-blend-mode:difference}', /dependent-paint:mix-blend-mode/],
      ['pseudo blending', '#target::after{mix-blend-mode:screen}', /dependent-paint:mix-blend-mode/],
      ['backdrop filter', '#target{backdrop-filter:blur(2px)}', /dependent-paint:backdrop-filter/],
      ['filter', '#target{filter:blur(2px)}', /dependent-paint:filter/],
      ['mask', '#target{mask-image:linear-gradient(black,transparent)}', /dependent-paint:mask-image/],
      ['overflowing shadow', '#target{box-shadow:0 0 25px 15px black}', /paint-outside-frame/],
      ['paint at capture edge', '#target::after{inset:-9px;background:red}', /paint-outside-frame/],
    ];
    for (const [name, css, reason] of controls) await t.test(name, async () => {
      const page = await browser.newPage({ viewport: { width: 160, height: 120 } });
      try {
        await page.setContent(html + '<style>' + css + '</style>');
        const original = await page.screenshot({ fullPage: true, caret: 'initial' });
        await assert.rejects(captureTransparentSourceFrame(page, '#target', sha(original)), reason);
        assert((await page.screenshot({ fullPage: true, caret: 'initial' })).equals(original));
      } finally { await page.close(); }
    });
    await t.test('stale original hash', async () => {
      const page = await browser.newPage(); await page.setContent(html);
      await assert.rejects(captureTransparentSourceFrame(page, '#target', '0'.repeat(64)), /original-changed/);
      await page.close();
    });
    await t.test('overlapping external paint', async () => {
      const page = await browser.newPage();
      await page.setContent(html + '<div style="position:absolute;left:35px;top:35px;width:2px;height:2px;background:red"></div>');
      await assert.rejects(captureTransparentSourceFrame(page, '#target', sha(await page.screenshot({ fullPage: true, caret: 'initial' }))), /external-contribution/);
      await page.close();
    });
    await t.test('separate sibling label is excluded only after exact crop comparison', async () => {
      const page = await browser.newPage();
      await page.setContent(html + '<span style="position:absolute;left:100px;top:32px">A separate label</span>');
      const original = await page.screenshot({ fullPage: true, caret: 'initial' });
      const capture = await captureTransparentSourceFrame(page, '#target', sha(original));
      assert.notEqual(capture.receipt.contextSha256, capture.receipt.transparentSha256);
      assert((await page.screenshot({ fullPage: true, caret: 'initial' })).equals(original));
      await page.close();
    });
  } finally { await browser.close(); }
});


test('capture detects open and closed shadow boundaries in its target and ancestor scope', async t => {
  const browser = await chromium.launch();
  try {
    for (const scope of ['target', 'thumb', 'stage', 'body'] as const)
      for (const mode of ['open', 'closed'] as const) await t.test(scope + ':' + mode, async () => {
        const page = await browser.newPage({viewport:{width:160,height:120}});
        try {
          await page.setContent(html);
          await page.evaluate(({scope,mode}) => {
            const host = document.querySelector(scope === 'body' ? 'body' : '#' + scope)!;
            host.attachShadow({mode}).innerHTML = scope === 'body' || scope === 'stage' ? '<slot></slot>' :
              '<span style="display:block;width:16px;height:16px;background:white;mix-blend-mode:difference"></span>';
          }, {scope,mode});
          const original = await page.screenshot({fullPage:true,caret:'initial'});
          await assert.rejects(captureTransparentSourceFrame(page,'#target',sha(original)), /opaque-content/);
          assert((await page.screenshot({fullPage:true,caret:'initial'})).equals(original));
        } finally { await page.close(); }
      });
  } finally { await browser.close(); }
});

test('separate closed shadow sibling keeps exact crop exclusion and restoration', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({viewport:{width:180,height:120}});
    await page.setContent(html + '<span id="sibling" style="position:absolute;left:100px;top:32px"></span>');
    await page.evaluate(() => document.querySelector('#sibling')!.attachShadow({mode:'closed'}).innerHTML =
      '<span style="display:block;width:16px;height:16px;background:red"></span>');
    const original = await page.screenshot({fullPage:true,caret:'initial'});
    const result = await captureTransparentSourceFrame(page,'#target',sha(original));
    assert.notEqual(result.receipt.contextSha256,result.receipt.transparentSha256);
    assert((await page.screenshot({fullPage:true,caret:'initial'})).equals(original));
  } finally { await browser.close(); }
});

test('browser-owned shadow content refuses without changing the source', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(); await page.setContent(html);
    await page.evaluate(() => {
      const input = document.createElement('input'); input.type = 'date'; input.value = '2026-09-20';
      document.querySelector('#target')!.appendChild(input);
    });
    const original = await page.screenshot({fullPage:true,caret:'initial'});
    await assert.rejects(captureTransparentSourceFrame(page,'#target',sha(original)), /opaque-content/);
    assert((await page.screenshot({fullPage:true,caret:'initial'})).equals(original));
  } finally { await browser.close(); }
});

test('unavailable Chromium scope cannot become successful capture evidence', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(); await page.setContent(html);
    const original = await page.screenshot({fullPage:true,caret:'initial'});
    await page.close();
    await assert.rejects(captureTransparentSourceFrame(page,'#target',sha(original)), /scope-unavailable/);
  } finally { await browser.close(); }
});

test('oversized target refuses before backdrop mutation', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html);
    await page.evaluate(() => {
      const target = document.querySelector('#target')!;
      for (let i=0;i<10_000;i++) target.appendChild(document.createElement('i'));
    });
    const original = await page.screenshot({fullPage:true,caret:'initial'});
    await assert.rejects(captureTransparentSourceFrame(page,'#target',sha(original)), /scope-too-large/);
    assert((await page.screenshot({fullPage:true,caret:'initial'})).equals(original));
  } finally { await browser.close(); }
});

test('a shadow boundary appearing during capture refuses and the capture stylesheet is removed', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(); await page.setContent(html);
    const original = await page.screenshot({fullPage:true,caret:'initial'});
    const styles = await page.locator('style').count();
    await page.evaluate(() => {
      const observer = new MutationObserver(() => {
        if (![...document.querySelectorAll('style')].some(s => s.textContent?.includes('background: transparent !important'))) return;
        observer.disconnect();
        document.querySelector('#thumb')!.attachShadow({mode:'closed'}).innerHTML = '<span>New content</span>';
      });
      observer.observe(document.head,{childList:true,subtree:true,characterData:true});
    });
    await assert.rejects(captureTransparentSourceFrame(page,'#target',sha(original)), /opaque-content/);
    assert.equal(await page.locator('style').count(),styles);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor),'rgb(255, 255, 255)');
  } finally { await browser.close(); }
});
