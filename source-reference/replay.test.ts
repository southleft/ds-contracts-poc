import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';
import type { SourceProfile } from './check.js';
import { watchSourceFailures } from './observe.js';
import { archiveInventory, captureReference, replayReference, requireOpaqueSandbox } from './replay.js';

test('real source resources replay without a server; missing resources fail closed', async () => {
  const font = readFileSync('extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2');
  const server = createServer((request,response) => {
    if (request.url === '/font.woff2') { response.setHeader('Content-Type','font/woff2'); response.end(font); }
    else if (request.url === '/theme.css') {
      response.setHeader('Content-Type','text/css');
      response.end('@font-face{font-family:"IBM Plex Sans";src:url(/font.woff2)}:root{--accent:#2850a0}button{font:16px "IBM Plex Sans";background:var(--accent);display:inline-flex}');
    } else { response.setHeader('Content-Type','text/html'); response.end('<link rel="stylesheet" href="/theme.css"><button>Reference</button>'); }
  });
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  const address = server.address() as {port:number};
  const url = `http://127.0.0.1:${address.port}/`;
  const dir = mkdtempSync(path.join(tmpdir(),'source-reference-replay-'));
  const harPath = path.join(dir,'source.har');
  const profile: SourceProfile = {id:'archive-fixture',provenance:'replay.test.ts',path:['button'],fontFamily:'IBM Plex Sans',
    requiredStyles:{display:'inline-flex','background-color':'rgb(40, 80, 160)'},requiredTokens:{'--accent':'#2850a0'}};
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext({viewport:{width:900,height:600},deviceScaleFactor:1,colorScheme:'dark',serviceWorkers:'block',
      recordHar:{path:harPath,content:'embed',mode:'full'}});
    const page = await context.newPage(); const failures = watchSourceFailures(page);
    await page.goto(url);
    const original = await captureReference(page,profile,failures);
    assert.equal(original.status,'valid',JSON.stringify(original.problems));
    // A changing preview must not be saved as a stable answer key, even when
    // the component's essential CSS and font witnesses remain valid. Put the
    // changing content BELOW the viewport: a clipped screenshot must not pass.
    await page.addScriptTag({content:'const tick=document.createElement("div");tick.style.marginTop="900px";document.body.append(tick);let n=0;globalThis.referenceTimer=setInterval(()=>tick.textContent=String(++n),50);'});
    const unstable = await captureReference(page,profile,failures,180);
    assert.ok(unstable.problems.includes('render-not-stable'));
    await page.evaluate(() => { clearInterval((globalThis as any).referenceTimer); document.body.lastElementChild?.remove(); });
    failures.dispose(); await context.close();
    await new Promise<void>((resolve,reject) => server.close(e => e ? reject(e) : resolve()));
    const replay = await replayReference(browser,harPath,url,profile);
    assert.equal(replay.status,'valid',JSON.stringify(replay.problems));
    assert.equal(replay.secondSha256, original.secondSha256, 'fresh context paints the same bytes without network');
    assert.equal(archiveInventory(harPath).entries.filter(e => e.bodySha256).length, 3);

    const broken = JSON.parse(readFileSync(harPath,'utf8'));
    broken.log.entries = broken.log.entries.filter((e: {request:{url:string}}) => !e.request.url.endsWith('/theme.css'));
    const badHar = path.join(dir,'missing-theme.har'); writeFileSync(badHar,JSON.stringify(broken));
    const rejected = await replayReference(browser,badHar,url,profile);
    assert.equal(rejected.status,'invalid');
    assert.ok(rejected.problems.includes('resource-failure'));
    assert.ok(rejected.problems.includes('theme-token-missing:--accent'));
  } finally { server.close(); await browser.close(); rmSync(dir,{recursive:true,force:true}); }
});

test('opaque sandbox blocks service workers without a harness page error and replays offline', async () => {
  const font=readFileSync('extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2').toString('base64');
  const server=createServer((_req,res)=>{
    res.setHeader('Content-Type','text/html');
    res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; font-src data:; sandbox allow-scripts");
    res.end(`<style>@font-face{font-family:"IBM Plex Sans";src:url(data:font/woff2;base64,${font})}:root{--accent:#2850a0}button{font:16px "IBM Plex Sans";background:var(--accent);display:inline-flex}</style><button>Reference</button>`);
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/`;
  const dir=mkdtempSync(path.join(tmpdir(),'sandbox-replay-'));const har=path.join(dir,'source.har');
  const profile:SourceProfile={id:'sandbox',provenance:'replay.test.ts',path:['button'],fontFamily:'IBM Plex Sans',requiredStyles:{display:'inline-flex'},requiredTokens:{'--accent':'#2850a0'}};
  const browser=await chromium.launch();
  try{
    const context=await browser.newContext({viewport:{width:900,height:600},colorScheme:'light',serviceWorkers:'allow',recordHar:{path:har,content:'embed',mode:'full'}});
    const page=await context.newPage();const failures=watchSourceFailures(page);await page.goto(url);
    await requireOpaqueSandbox(page);const original=await captureReference(page,profile,failures);assert.equal(original.status,'valid',JSON.stringify(original.problems));
    await context.close();await new Promise<void>(resolve=>server.close(()=>resolve()));
    const replay=await replayReference(browser,har,url,profile,undefined,undefined,undefined,'light',true);
    assert.equal(replay.status,'valid',JSON.stringify(replay.problems));assert.equal(replay.secondSha256,original.secondSha256);
    const ordinary=await browser.newPage();await ordinary.goto('about:blank');await assert.rejects(requireOpaqueSandbox(ordinary),/opaque-sandbox-required/);
  }finally{server.close();await browser.close();rmSync(dir,{recursive:true,force:true});}
});
