import test from 'node:test';
import assert from 'node:assert/strict';
import { randomFillSync } from 'node:crypto';
import { PNG } from 'pngjs';
import { chromium } from 'playwright-core';
import { emitTokensCss, externalizeTokenImages } from './emit-tokens-css.js';

test('large token images render from exact local assets and retain theme aliases', async () => {
  const png = new PNG({ width: 1024, height: 512 });
  randomFillSync(png.data);
  const bytes = PNG.sync.write(png);
  const value = `url("data:image/png;base64,${bytes.toString('base64')}")`;
  const sheet = emitTokensCss([
    { name: 'default', selector: ':root', parts: [{ slot: 'light', tree: {
      original: { $type: 'gradient', $value: value },
      image: { $type: 'gradient', $value: '{original}' },
    } }] },
    { name: 'dark', selector: '[data-theme="dark"]', parts: [{ slot: 'dark', tree: {
      image: { $type: 'gradient', $value: 'none' },
    } }] },
  ]);
  const output = externalizeTokenImages(sheet.css);
  assert.equal(output.assets.length, 1);
  assert.deepEqual(Buffer.from(output.assets[0].base64, 'base64'), bytes);
  assert.equal(externalizeTokenImages(sheet.css + sheet.css).assets.length, 1);
  assert.deepEqual(externalizeTokenImages('a{--x:red}'), { css: 'a{--x:red}', assets: [] });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    let reads = 0;
    await page.route('http://assets.test/**', async route => {
      if (route.request().url().endsWith(output.assets[0].path)) {
        reads++; await route.fulfill({ contentType: 'image/png', body: bytes });
      } else if (route.request().url().endsWith('/tokens.css')) {
        await route.fulfill({ contentType: 'text/css', body: output.css });
      } else await route.fulfill({ contentType: 'text/html', body: '<link rel="stylesheet" href="/tokens.css"><div style="width:100px;height:100px;background-image:var(--image)"></div>' });
    });
    await page.goto('http://assets.test/');
    const result = await page.locator('div').evaluate(async n => {
      const image = getComputedStyle(n).backgroundImage;
      const img = new Image(); img.src = image.slice(5, -2); await img.decode();
      return { image, width: img.naturalWidth, height: img.naturalHeight };
    });
    assert.equal(result.width, 1024); assert.equal(result.height, 512); assert(reads > 0);
    await page.locator('html').evaluate(n => n.setAttribute('data-theme', 'dark'));
    assert.equal(await page.locator('div').evaluate(n => getComputedStyle(n).backgroundImage), 'none');
    await page.locator('html').evaluate(n => n.removeAttribute('data-theme'));
    assert.equal(await page.locator('div').evaluate(n => getComputedStyle(n).backgroundImage), result.image);
  } finally { await browser.close(); }
});
