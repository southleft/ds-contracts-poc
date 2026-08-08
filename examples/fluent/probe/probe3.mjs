import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const url = 'file://' + path.resolve('examples/fluent/.fluent-sandbox/probe/portal.html');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 800 }, deviceScaleFactor: 1, colorScheme: 'light' });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const snap = () =>
  page.evaluate(() =>
    [...document.body.children].map((c) => {
      const b = c.getBoundingClientRect();
      const cs = getComputedStyle(c);
      return {
        tag: c.tagName.toLowerCase(),
        cls: [...c.classList].filter((x) => /^fui-/.test(x)),
        clsN: c.classList.length,
        attrs: [...c.attributes].filter((a) => a.name !== 'class' && a.name !== 'style').map((a) => a.name),
        box: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)],
        pos: cs.position,
        bg: cs.backgroundColor,
        kids: [...c.children].map((k) => k.tagName.toLowerCase() + '.' + [...k.classList].filter((x) => /^fui-/.test(x)).join('.')),
      };
    }),
  );

const key = (c) => `${c.tag}[${c.attrs.join(',')}]${c.cls.join('.')}`;
const out = {};
const baseline = await snap();
out.baseline = baseline;
const baseKeys = baseline.map(key);

for (const which of ['plain', 'tooltip', 'dialog', 'popover', 'menu']) {
  await page.evaluate((w) => window.setWhich('none'), which);
  await page.waitForTimeout(200);
  const before = await snap();
  await page.evaluate((w) => window.setWhich(w), which);
  await page.waitForTimeout(600);
  const after = await snap();
  const beforeKeys = before.map(key);
  const newRoots = after.filter((c, i) => {
    const k = key(c);
    const countBefore = beforeKeys.filter((x) => x === k).length;
    const countUpTo = after.slice(0, i + 1).map(key).filter((x) => x === k).length;
    return countUpTo > countBefore;
  });
  out[which] = { beforeCount: before.length, afterCount: after.length, newRoots };
}

// focus-visible modality probe: does Tab set [data-fui-focus-visible]?
await page.evaluate(() => window.setWhich('plain'));
await page.waitForTimeout(300);
const focus = {};
focus.beforeTab = await page.evaluate(() => {
  const b = document.querySelector('.fui-Button');
  return b ? { attrs: [...b.attributes].map((a) => a.name), outline: getComputedStyle(b).outline, border: getComputedStyle(b).borderColor } : null;
});
await page.keyboard.press('Tab');
await page.waitForTimeout(200);
focus.afterTab = await page.evaluate(() => {
  const b = document.querySelector('.fui-Button');
  return b
    ? { attrs: [...b.attributes].map((a) => a.name), focused: document.activeElement === b,
        matchesFV: b.matches(':focus-visible'), hasDataFui: b.hasAttribute('data-fui-focus-visible'),
        outline: getComputedStyle(b).outline, border: getComputedStyle(b).borderColor,
        after: getComputedStyle(b, '::after').borderColor }
    : null;
});
// hover plane
await page.hover('.fui-Button');
await page.waitForTimeout(200);
focus.hover = await page.evaluate(() => {
  const b = document.querySelector('.fui-Button');
  return { bg: getComputedStyle(b).backgroundColor };
});
out.focus = focus;
out.errs = errs;

fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
await browser.close();
console.log('errs', errs.length);
