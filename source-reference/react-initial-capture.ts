/** Exact pairing with an already observed fresh-mount state. Baseline source
 * witnesses cannot describe a different input; none are weakened or rewritten.
 * This reader requires the complete tree AND full-page PNG to be identical. */
import type {Page} from 'playwright-core';
import {captureJs} from '../extract/computed/capture.js';
import type {CapturedNode} from '../extract/computed/lib.js';
import {evidenceSha} from './react-validation-evidence.js';
import type {watchSourceFailures} from './observe.js';

export async function captureMatchedInitialTree(page:Page,selectors:string[],expected:{treeSha256:string;image:string},
 failures:ReturnType<typeof watchSourceFailures>) {
 if(selectors.length!==1||![expected.treeSha256,expected.image].every(h=>/^[a-f0-9]{64}$/.test(h)))throw Error('react-initial-capture-input-invalid');
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState==='finished'||a.playState==='idle'),null,{timeout:5000});
 await page.evaluate("window.__ALL_PROPS=[...getComputedStyle(document.documentElement)].sort()");
 const read=()=>page.evaluate(captureJs('#root',undefined,'--',selectors)) as Promise<CapturedNode|null>;
 const tree=await read(),png=await page.screenshot({fullPage:true,caret:'initial'});
 const treeSha256=evidenceSha(JSON.stringify(tree)),sourcePngSha256=evidenceSha(png);
 if(!tree||treeSha256!==expected.treeSha256||sourcePngSha256!==expected.image||
    evidenceSha(JSON.stringify(await read()))!==treeSha256||evidenceSha(await page.screenshot({fullPage:true,caret:'initial'}))!==sourcePngSha256||
    failures.runtimeErrors.length||failures.failedResources.length)throw Error('react-initial-capture-pair-mismatch');
 return {status:'captured' as const,problems:[],tree,treeSha256,sourcePngSha256,qualification:'exact-observed-initial-state-recapture' as const};
}
