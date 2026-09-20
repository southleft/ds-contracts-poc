import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright-core';
import { captureJs } from '../extract/computed/capture.js';
import type { CapturedNode } from '../extract/computed/lib.js';
import { observePseudoBoxes, observedPseudoGeometry, verifiedPseudoBoxes, type PseudoBoxEvidence } from './pseudo-boxes.js';
import { unpaintedPseudoBox } from '../extract/computed/unpainted-pseudo.js';
import { nativeBoxFromCss } from '../core/absolute-box.js';
import { reactInitialObservedRoot } from './react-initial-contract.js';
import { compileObservedContentSweep } from './observed-content.js';
import { revisionOf } from '../core/contract-provenance.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import { enumerate } from '../extract/computed/lib.js';

async function capture(page: Page) {
  await page.evaluate(() => { (window as unknown as { __ALL_PROPS: string[] }).__ALL_PROPS = [...getComputedStyle(document.documentElement)]; });
  return await page.evaluate(captureJs('#stage', undefined, '', ['#source'])) as CapturedNode;
}
const html = (left: string, border = '1px', direction = 'ltr') => `<style>
body{margin:0}#source{position:relative;box-sizing:border-box;width:32px;height:18.4px;margin:64px;
border-style:solid;border-color:transparent;border-width:${border};direction:${direction}}
#source::after{content:'';position:absolute;display:block;box-sizing:border-box;left:${left}px;right:-12px;top:-8px;bottom:-8px;width:54px;height:32.4px}
</style><div id="stage"><div id="source"></div><div id="foreign"></div></div>`;

test('protocol quads distinguish identical CSS strings and retain fractional pseudo sizes without source changes', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), rows = [];
    for (const left of ['1.0156249', '1.015625', '-1.0156249', '-1.015625']) {
      await page.setContent(html(left));
      const tree = await capture(page), original = structuredClone(tree), dom = await page.content();
      const evidence = await observePseudoBoxes(page, ['#source'], tree);
      assert.equal(evidence.status, 'observed', evidence.problems.join('\n'));
      const row = verifiedPseudoBoxes(tree, evidence)[0];
      assert.deepEqual(row.host, { width: 32, height: 18.390625 });
      assert.deepEqual(row.padding, { x: 1, y: 1, width: 30, height: 16.390625 });
      assert.equal(row.box.width, 54); assert.equal(row.box.height, 32.390625); assert.equal(row.box.y, -7);
      rows.push({ css: tree.pseudo['::after']!.left, x: row.box.x });
      assert.equal(await page.content(), dom); assert.deepEqual(tree, original);
    }
    assert.deepEqual(rows, [{ css: '1.01562px', x: 2 }, { css: '1.01562px', x: 2.015625 },
      { css: '-1.01562px', x: 0 }, { css: '-1.01562px', x: -0.015625 }]);
  } finally { await browser.close(); }
});

test('host correspondence and measured boxes handle asymmetric borders and RTL overconstraint', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const [border, direction, x] of [['0px', 'ltr', -12], ['0px', 'rtl', -10],
      ['1px 2px 3px 4px', 'ltr', -8], ['1px 2px 3px 4px', 'rtl', -12]] as const) {
      await page.setContent(html('-12', border, direction));
      const tree = await capture(page), evidence = await observePseudoBoxes(page, ['#source'], tree);
      assert.equal(evidence.status, 'observed', evidence.problems.join('\n'));
      assert.equal(verifiedPseudoBoxes(tree, evidence)[0].box.x, x);
    }
  } finally { await browser.close(); }
});

test('missing or changed hosts, closed shadow boundaries, zoom and transforms cannot yield geometry evidence', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const mutation of ['missing', 'paint', 'shadow', 'zoom', 'transform', 'duplicate'] as const) {
      await page.setContent(html('-12')); const tree = await capture(page);
      await page.evaluate(kind => {
        const host = document.querySelector('#source')!;
        if (kind === 'missing') host.remove();
        if (kind === 'paint') { const style = document.createElement('style'); style.textContent = '#source::after{background:red}'; document.head.appendChild(style); }
        if (kind === 'shadow') host.attachShadow({ mode: 'closed' });
        if (kind === 'zoom') (document.querySelector('#stage') as HTMLElement).style.zoom = '2';
        if (kind === 'transform') (document.querySelector('#stage') as HTMLElement).style.transform = 'translateX(1px)';
        if (kind === 'duplicate') host.parentElement!.appendChild(host.cloneNode(true));
      }, mutation);
      const result = await observePseudoBoxes(page, ['#source'], tree);
      assert.equal(result.status, 'refused', mutation); assert.ok(result.problems.length, mutation);
    }
  } finally { await browser.close(); }
});

test('evidence coverage and tree correspondence are complete; malformed geometry refuses', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(); await page.setContent(html('-12'));
    const tree = await capture(page), evidence = await observePseudoBoxes(page, ['#source'], tree);
    assert.equal(evidence.status, 'observed', evidence.problems.join('\n'));
    for (const change of [
      (e: PseudoBoxEvidence) => { e.rows = []; },
      (e: PseudoBoxEvidence) => { e.rows.push(structuredClone(e.rows[0])); },
      (e: PseudoBoxEvidence) => { e.rows[0].path = [1]; },
      (e: PseudoBoxEvidence) => { e.rows[0].styleRevision = 'changed'; },
      (e: PseudoBoxEvidence) => { e.rows[0].box.width = 0; },
      (e: PseudoBoxEvidence) => { e.rows[0].box.x = NaN; },
      (e: PseudoBoxEvidence) => { e.rows[0].padding.x = -1; },
      (e: PseudoBoxEvidence) => { e.rows[0].host.height = 0; },
    ]) { const altered = structuredClone(evidence); change(altered); assert.throws(() => verifiedPseudoBoxes(tree, altered), /pseudo-box-/); }
    const changed = structuredClone(tree); changed.style.width = '33px';
    assert.throws(() => verifiedPseudoBoxes(changed, evidence), /pseudo-box-evidence-changed/);
    const rows = verifiedPseudoBoxes(tree, evidence); rows[0].box.x = 0;
    assert.notEqual(rows[0].box.x, evidence.rows[0].box.x);
  } finally { await browser.close(); }
});

test('a closed shadow ancestor cannot masquerade as the captured light-DOM path', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html('-12').replaceAll('#source{', '#child{').replaceAll('#source::after', '#child::after')
      .replace('<div id="source"></div>', '<div id="source"><div id="child"></div></div>'));
    const tree = await capture(page), before = await observePseudoBoxes(page, ['#source'], tree);
    assert.equal(before.status, 'observed', before.problems.join('\n'));
    assert.deepEqual(verifiedPseudoBoxes(tree, before)[0].path, [0]);
    await page.locator('#source').evaluate(el => { el.attachShadow({ mode: 'closed' }).innerHTML = '<slot></slot>'; });
    const result = await observePseudoBoxes(page, ['#source'], tree);
    assert.equal(result.status, 'refused');
    assert.ok(result.problems.includes('pseudo-box-light-dom-required'), result.problems.join('\n'));
  } finally { await browser.close(); }
});

test('replacement with an identical-looking host between protocol reads refuses', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(); await page.setContent(html('-12'));
    const tree = await capture(page), context = page.context(), open = context.newCDPSession.bind(context);
    context.newCDPSession = async target => {
      const session = await open(target), send = session.send.bind(session); let boxes = 0;
      session.send = (async (method: any, params: any) => {
        const result = await send(method, params);
        if (method === 'DOM.getBoxModel' && ++boxes === 2)
          await page.locator('#source').evaluate(el => {
            const replacement = el.cloneNode(true) as HTMLElement;
            el.replaceWith(replacement); replacement.getBoundingClientRect();
          });
        return result;
      }) as typeof session.send;
      return session;
    };
    const evidence = await observePseudoBoxes(page, ['#source'], tree);
    assert.equal(evidence.status, 'refused');
    assert.deepEqual(evidence.problems, ['pseudo-box-source-unstable']);
  } finally { await browser.close(); }
});

test('measured pseudo geometry reproduces the browser box in CSS and converts exactly to native coordinates', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const border of ['0px', '1px', '1px 2px 3px 4px']) for (const direction of ['ltr', 'rtl'])
      for (const left of ['-12', '1.0156249', '1.015625', '-1.015625']) {
        await page.setContent(html(left, border, direction));
        const tree = await capture(page), evidence = await observePseudoBoxes(page, ['#source'], tree);
        assert.equal(evidence.status, 'observed', evidence.problems.join('\n'));
        const row = verifiedPseudoBoxes(tree, evidence)[0], geometry = observedPseudoGeometry(row);
        const part = unpaintedPseudoBox(tree.style, tree.pseudo['::after'], geometry)!;
        assert.ok(part); assert.equal(part.shape!.height, 32.390625);
        const reconstructed = await page.locator('#source').evaluate((host, part) => {
          const child = document.createElement('div');
          const shape = part.shape as {width:number;height:number};
          Object.assign(child.style, { ...part.declared, ...part.literals, width: shape.width+'px', height: shape.height+'px' });
          host.appendChild(child);
          const b = child.getBoundingClientRect(), h = host.getBoundingClientRect();
          return {x:b.x-h.x,y:b.y-h.y,width:b.width,height:b.height};
        }, part);
        assert.deepEqual(reconstructed, row.box, JSON.stringify({border,direction,left}));
        const native = nativeBoxFromCss({x:geometry.left,y:geometry.top,width:geometry.width,height:geometry.height,
          right:row.padding.width-geometry.left-geometry.width,bottom:row.padding.height-geometry.top-geometry.height},
          {left:row.padding.x,top:row.padding.y,right:row.host.width-row.padding.x-row.padding.width,
            bottom:row.host.height-row.padding.y-row.padding.height});
        assert.deepEqual({x:native.x,y:native.y,width:native.width,height:native.height}, row.box);
      }
  } finally { await browser.close(); }
});

test('initial-state assembly requires complete independent pseudo evidence and preserves sealed observations', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(); await page.setContent(html('-12'));
    const tree = await capture(page), pseudoBoxes = await observePseudoBoxes(page, ['#source'], tree);
    const snapshot = { tree, fonts: { version: 1, status: 'observed', treeRevision: revisionOf(tree), rows: [], problems: [] },
      svg: { version: 1, status: 'observed', treeRevision: revisionOf(tree), rows: [], problems: [] },
      ownership: { components: [{ id: 'instance-0', roots: [''] }] } } as unknown as Parameters<typeof reactInitialObservedRoot>[0];
    assert.throws(() => reactInitialObservedRoot(snapshot, 'instance-0'), /pseudo-box-evidence-unobserved/);
    snapshot.pseudoBoxes = pseudoBoxes;
    const sealed = JSON.stringify(snapshot), { root } = reactInitialObservedRoot(snapshot, 'instance-0');
    assert.equal(JSON.stringify(snapshot), sealed);
    assert.deepEqual(root.pseudoGeometry?.['::after'], { width: 54, height: 32.390625, left: -12, top: -8 });
    const contract = ContractSchema.parse({ id: 'test.observed-geometry', name: 'ObservedGeometry', version: '0.1.0', status: 'draft',
      description: 'Independent pseudo geometry assembly probe', props: [], states: [], semantics: { element: 'div' }, anatomy: { root: {} },
      bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: './fixture', export: 'ObservedGeometry' } } } });
    const enumeration = enumerate([], [], 1, {}), key = enumeration.combos[0].key;
    const space = { contract, axes: [], presence: new Map(), stateProps: [], enumeration, baseComboKey: key, baseAxisValues: {}, heldFixed: [] };
    const result = compileObservedContentSweep(space, { name: contract.name, importName: contract.name, contract: '', sampleText: '', axes: [] },
      { captures: [{ combo: `${contract.name}:${key}`, interaction: 'default', root }] } as never, ['width', 'height']);
    assert.deepEqual(result.problems, []);
    const box = result.component!.variants[0].spec.children!.find(n => n.name === 'root-after')!;
    assert.ok(box); assert.equal(box.shape!.height, 32.390625);
    assert.deepEqual(box.absolute, { h: 'MIN', v: 'MIN', left: -11, top: -7 });
    const wrong = structuredClone(snapshot); wrong.pseudoBoxes!.rows[0].path = [1];
    assert.throws(() => reactInitialObservedRoot(wrong, 'instance-0'), /pseudo-box-source-changed/);
    const missing = structuredClone(snapshot); missing.pseudoBoxes!.rows = [];
    assert.throws(() => reactInitialObservedRoot(missing, 'instance-0'), /pseudo-box-coverage-changed/);
    assert.equal(JSON.stringify(snapshot), sealed);
  } finally { await browser.close(); }
});
