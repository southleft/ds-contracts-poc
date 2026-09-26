import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from 'playwright-core';
import {captureJs} from '../extract/computed/capture.js';
import {captureMatchedInitialTree} from './react-initial-capture.js';
import {evidenceSha} from './react-validation-evidence.js';
import {watchSourceFailures} from './observe.js';

test('initial pairing rejects both a different tree and pixels changed outside its selected component',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:160,height:100}}),failures=watchSourceFailures(page);t.after(()=>failures.dispose());
 await page.setContent('<style>button{width:35px;height:20px}aside{width:10px;height:10px;background:red}</style><div id="root"><button id="target">X</button><aside></aside></div>');
 await page.evaluate("window.__ALL_PROPS=[...getComputedStyle(document.documentElement)].sort()");
 const tree=await page.evaluate(captureJs('#root',undefined,'--',['#target'])),png=await page.screenshot({fullPage:true,caret:'initial'});
 const expected={treeSha256:evidenceSha(JSON.stringify(tree)),image:evidenceSha(png)};
 assert.equal((await captureMatchedInitialTree(page,['#target'],expected,failures)).status,'captured');
 await assert.rejects(captureMatchedInitialTree(page,['#target'],{...expected,treeSha256:'f'.repeat(64)},failures),/pair-mismatch/);
 await page.locator('aside').evaluate(e=>e.style.background='blue');
 assert.equal(evidenceSha(JSON.stringify(await page.evaluate(captureJs('#root',undefined,'--',['#target'])))),expected.treeSha256);
 await assert.rejects(captureMatchedInitialTree(page,['#target'],expected,failures),/pair-mismatch/,'whole-page context also has to match');
 await page.locator('aside').evaluate(e=>e.style.background='red');
 failures.runtimeErrors.push('source error');
 await assert.rejects(captureMatchedInitialTree(page,['#target'],expected,failures),/pair-mismatch/);
 await assert.rejects(captureMatchedInitialTree(page,['#target','aside'],expected,failures),/input-invalid/);
});
