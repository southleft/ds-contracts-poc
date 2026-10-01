import { strokedPathNativeData } from './stroked-path-native.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { ContractSchema } from '../scripts/contract-schema.js';
import { strokeSvgGeometry } from '../extract/figma/rest/stroke-svg.js';
import { mapRestToDump } from '../extract/figma/rest/map.js';
import { importFromUrl, fetchNodes, type FetchLike } from '../extract/figma/rest/fetch.js';
import { proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { emitReact } from './emit-react.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { emitReactInline } from './emit-react-inline.js';
import { mountGenerated, generatedTypeErrors } from './react-test-runtime.js';
import { readPng, alignPair, diffPair, writeTriptych } from '../extract/figma/visual-parity/img.js';

const fixture = new URL('../extract/figma/fixtures/stroke-svg-source/', import.meta.url);
const source = JSON.parse(readFileSync(new URL('sources.json', fixture), 'utf8'));
const native = JSON.parse(readFileSync(new URL('native-nodes.json', fixture), 'utf8'));
const rows = Object.values(native.nodes).map((entry: any) => {
  const parent = entry.document, node = parent.children[0];
  const svg = source.rows.find((r: any) => r.id === node.id).svg;
  return { parent, node, svg, observed: {
    nodeId: node.id, width: node.size.x, height: node.size.y, strokeWeight: node.strokeWeight,
    strokeColor: '#171717', cap: node.strokeCap, join: node.strokeJoin,
    viewport: { width: parent.size.x, height: parent.size.y, x: node.relativeTransform[0][2], y: node.relativeTransform[1][2] },
  } };
});

test('ordinary URL capture requests pinned SVG source and never forwards the token to assets', async () => {
  const calls: string[] = [];
  const replay: FetchLike = async (url, init) => {
    calls.push(url);
    const u = new URL(url);
    const reply = (value: unknown, status = 200) => ({ ok: status === 200, status, json: async () => value, text: async () => JSON.stringify(value) });
    if (u.hostname === 'source-fixture.test') {
      assert.equal(init?.headers?.['X-Figma-Token'], undefined);
      const row = source.rows.find((r: any) => r.id === u.pathname.slice(1));
      return { ...reply({}), text: async () => row.svg };
    }
    assert.equal(init?.headers?.['X-Figma-Token'], 'fixture-token');
    if (u.pathname.endsWith('/variables/local')) return reply({}, 403);
    if (u.pathname.endsWith('/nodes')) return reply(native);
    assert.equal(u.pathname, '/v1/images/nbsDhtFZ4BICs2CY20vKih');
    assert.equal(u.searchParams.get('version'), native.version);
    assert.equal(u.searchParams.get('svg_include_node_id'), 'true');
    return reply({ images: Object.fromEntries(source.rows.map((r: any) => [r.id, 'https://source-fixture.test/' + r.id])) });
  };
  const result = await importFromUrl('https://www.figma.com/design/nbsDhtFZ4BICs2CY20vKih/?node-id=1027-7111', 'fixture-token', { captureStrokeSvg: true, fetchImpl: replay });
  assert.equal(calls.filter(u => u.includes('/v1/images/')).length, 1);
  assert.equal(calls.filter(u => u.startsWith('https://source-fixture.test/')).length, 4);
  assert.equal((result.dump.zap as any).variants[0].children[0].shape.kind, 'stroked-path');
  const provenance = result.dump._provenance as any;
  assert.equal(provenance.strokeSvgCapture.sources.version, native.version);
  assert.equal(provenance.strokeSvgCapture.sources.svgByNodeId['1027:6187'], source.rows[0].svg);
  await assert.rejects(fetchNodes('nbsDhtFZ4BICs2CY20vKih', ['1027:7111'], 'fixture-token', { fetchImpl: replay, version: 'wrong' }), /figma-dependent-source-version-mismatch/);
});

test('version-pinned sources travel through ordinary REST mapping and root proposal without injected geometry', () => {
  const fileKey = 'nbsDhtFZ4BICs2CY20vKih';
  const sources = { fileKey, version: source.version, svgByNodeId: Object.fromEntries(source.rows.map((r: any) => [r.id, r.svg])) };
  const mapped = mapRestToDump(native, { fileKey, strokeSvgSources: sources });
  const stale = mapRestToDump(native, { fileKey, strokeSvgSources: { ...sources, version: 'wrong' } });
  const wrongFile = mapRestToDump(native, { fileKey: 'wrong', strokeSvgSources: sources });
  assert.ok(wrongFile.report.notes.some(n => n.includes('stroke-svg-source-file-mismatch')));
  assert.ok(stale.report.notes.some(n => n.includes('stroke-svg-source-version-mismatch')));
  for (const r of rows) {
    const set = mapped.dump[r.parent.name] as any;
    const child = set.variants[0].children[0];
    if ('issue' in strokeSvgGeometry(r.svg, r.observed)) {
      assert.equal(child.shape, undefined);
      assert.ok(mapped.report.degradations.some(d => d.message === 'stroke-svg-export-basis-mismatch'));
      continue;
    }
    assert.equal(child.shape.kind, 'stroked-path');
    assert.equal((stale.dump[r.parent.name] as any).variants[0].children[0].shape, undefined);
    const proposal = proposeFromDump(set, { corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
      contractIdByName: new Map(), projectionMode: 'reviewable-inversion', mintUnbound: true });
    const c = ContractSchema.parse(proposal.contract);
    assert.equal(c.anatomy.root.parts!.Icon!.shape!.kind, 'stroked-path');
    assert.equal(c.anatomy.root.declared?.position, 'relative');
    assert.equal(c.anatomy.root.declared?.['overflow-x'], 'hidden');
    const tokens = proposal.mintedTokens;
    assert.ok(tokens, 'Actual proposal exposes its minted token inputs');
    const nativeScript = createFigmaEngine({ tokens: { primitives: tokens.tree, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() }).buildComponentScript(c, new Map([[c.id, c]]));
    assert.ok(/"strokeViewport"\s*:\s*true/.test(nativeScript));
  }
});

test('actual exported centerlines admit exact bases and refuse rounded exports and unsafe SVG', () => {
  const accepted = rows.filter(r => 'shape' in strokeSvgGeometry(r.svg, r.observed));
  assert.deepEqual(accepted.map(r => r.node.id), ['1027:6187', '1037:33956']);
  for (const r of rows.filter(r => !accepted.includes(r)))
    assert.deepEqual(strokeSvgGeometry(r.svg, r.observed), { issue: 'stroke-svg-export-basis-mismatch' });
  const r = accepted[0]!;
  for (const svg of [r.svg.replace('<path ', '<path onload="x" '), r.svg.replace('d="', 'd="&bad;'),
    r.svg.replace('/>', '/><script>x</script>'), r.svg.replace('<path ', '<path transform="scale(2)" '),
    r.svg.replace('stroke="#171717"', 'stroke="url(x)"')])
    assert.ok('issue' in strokeSvgGeometry(svg, r.observed));
  assert.deepEqual(strokeSvgGeometry(r.svg, { ...r.observed, nodeId: 'wrong' }), { issue: 'stroke-svg-source-identity-mismatch' });
  assert.deepEqual(strokeSvgGeometry(r.svg, { ...r.observed, strokeWeight: 3 }), { issue: 'stroke-svg-export-paint-mismatch' });
});

test('both actual generated React consumers match two independent real Figma icon PNGs on white and black', async () => {
  const output = mkdtempSync(path.join(tmpdir(), 'ds-contracts-stroke-svg-pixels-'));
  const tokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const browser = await chromium.launch(), scores: unknown[] = [];
  try {
    for (const r of rows) {
      const geometry = strokeSvgGeometry(r.svg, r.observed);
      if (!('shape' in geometry)) continue;
      const raw = { id: 'probe.stroke-source', name: 'StrokeSource', version: '1.0.0',
        description: 'Reviewed source glyph geometry only; automatic family ingestion remains unqualified.',
        archetype: 'none', semantics: { element: 'div' }, props: [], states: [],
        anatomy: { root: {
          declared: { position: 'relative', 'overflow-x': 'hidden', 'overflow-y': 'hidden' }, literals: { width: '24px', height: '24px' },
          parts: { glyph: { shape: geometry.shape, literals: { 'border-width': '2px', 'border-color': '#171717' } } },
        } }, bindings: { code: { anchors: { importPath: './StrokeSource', export: 'StrokeSource' } },
          figma: { anchors: { fileKey: null, componentSetKey: null } } },
      };
      const parsed = ContractSchema.safeParse(raw);
      if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues));
      const c = parsed.data;
      const nativeScript = createFigmaEngine({ tokens, icons: new Map() }).buildComponentScript(c, new Map([[c.id, c]]));
      assert.ok(/"strokeViewport"\s*:\s*true/.test(nativeScript), "Root native spec carries the stroke viewport");
      assert.match(nativeScript, /stroked-path-native-parent-basis-mismatch/);
      const asymmetric = structuredClone(c); asymmetric.anatomy.root.declared!['overflow-y'] = 'visible';
      assert.throws(() => createFigmaEngine({ tokens, icons: new Map() }).buildComponentScript(asymmetric, new Map([[asymmetric.id, asymmetric]])), /stroked-path-parent-clip-axes-unqualified/);
      const wrong = structuredClone(c); wrong.anatomy.root.literals!.width = '25px';
      assert.throws(() => createFigmaEngine({ tokens, icons: new Map() }).buildComponentScript(wrong, new Map([[wrong.id, wrong]])), /stroked-path-parent-basis-mismatch/);
      for (const surface of ['module', 'inline']) {
        const contracts = new Map([[c.id, c]]), icons = new Map<string, string>();
        const code = surface === 'module' ? emitReact(c, { contracts, icons, tokens: new Set() }) :
          { ...emitReactInline(c, { contracts, icons, tokens }), css: '' };
        assert.deepEqual(generatedTypeErrors(c.name, code.tsx), []);
        const page = await browser.newPage({ viewport: { width: 24, height: 24 }, deviceScaleFactor: 1 });
        try {
          const render = await mountGenerated(page, c.name, code.tsx, code.css);
          await page.addStyleTag({ content: 'body{margin:0;background:transparent}' }); await render({});
          assert.equal(await page.locator('#root path').count(), 1);
          const screenshot = await page.screenshot({ omitBackground: true });
          const actual = readPng(screenshot), expected = readPng(readFileSync(new URL(r.parent.id.replace(':', '-') + '.png', fixture)));
          assert.equal(expected.width, 24); assert.equal(expected.height, 24);
          for (const background of [255, 0] as const) {
            const aligned = alignPair(actual, expected, background), diff = diffPair(aligned, []);
            writeTriptych(path.join(output, `${r.node.id.replace(':', '-')}-${surface}-${background}.png`), aligned, diff.diff);
            scores.push({ nodeId: r.node.id, surface, background, mismatchPercent: diff.unmaskedPct });
            assert.ok(diff.unmaskedPct <= 5, `${r.node.id}/${surface}/${background}: ${diff.unmaskedPct}%`);
          }
        } finally { await page.close(); }
      }
    }
    writeFileSync(path.join(output, 'SUMMARY.json'), JSON.stringify({ scores,
      qualification: 'Two source glyphs in reviewed primitive contracts; not automatic Featured icon ingestion or never-seen-kit qualification.' }, null, 2));
    console.log('Real stroke SVG pixel evidence: ' + output);
  } finally { await browser.close(); }
});

test('both React consumers honor independently observed instance color, weight and box overrides', async () => {
  const captures = JSON.parse(readFileSync(new URL('selected-overrides.json', fixture), 'utf8'));
  const svgSources = { fileKey: 'nbsDhtFZ4BICs2CY20vKih', version: source.version,
    svgByNodeId: Object.fromEntries(source.rows.map((r: any) => [r.id, r.svg])) };
  const mapped = mapRestToDump(native, { fileKey: svgSources.fileKey, strokeSvgSources: svgSources });
  const proposal = proposeFromDump(mapped.dump.zap as any, { corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
    contractIdByName: new Map(), projectionMode: 'reviewable-inversion', mintUnbound: true });
  const c = ContractSchema.parse(proposal.contract);
  assert.deepEqual(c.anatomy.root.overridable, ['size', 'color', 'stroke-width']);
  const tokens = { primitives: proposal.mintedTokens!.tree, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const browser = await chromium.launch();
  try {
    for (const surface of ['module', 'inline']) {
      const contracts = new Map([[c.id, c]]), icons = new Map<string, string>();
      const code = surface === 'module' ? emitReact(c, { contracts, icons, tokens: new Set(proposal.mintedTokens!.entries.map(e => e.ref.replace(/^\{|\}$/g, ''))) }) :
        { ...emitReactInline(c, { contracts, icons, tokens }), css: '' };
      assert.deepEqual(generatedTypeErrors(c.name, code.tsx), []);
      const page = await browser.newPage();
      try {
        const render = await mountGenerated(page, c.name, code.tsx, code.css);
        for (const observed of captures) {
          const paint = observed.vector.strokes[0].color;
          const color = '#' + [paint.r, paint.g, paint.b].map((v: number) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
          const style = surface === 'module' ? { width: observed.size.x, height: observed.size.y,
            ['--' + c.id.replace(/[^a-zA-Z0-9]+/g, '-') + '-color']: color,
            ['--' + c.id.replace(/[^a-zA-Z0-9]+/g, '-') + '-stroke-width']: observed.vector.strokeWeight + 'px' } :
            { width: observed.size.x, height: observed.size.y, color, strokeWidth: observed.vector.strokeWeight + 'px' };
          await render({ style });
          const result = await page.locator('#root path').evaluate(p => {
            const path = p as SVGPathElement, cs = getComputedStyle(path), rect = path.getBoundingClientRect();
            return { stroke: cs.stroke, weight: parseFloat(cs.strokeWidth), width: rect.width, height: rect.height };
          });
          assert.equal(result.stroke, `rgb(${[paint.r, paint.g, paint.b].map((v: number) => Math.round(v * 255)).join(', ')})`);
          assert.ok(Math.abs(result.weight - observed.vector.strokeWeight) < .00001);
          assert.ok(Math.abs(result.width - observed.vector.size.x) < .001);
          assert.ok(Math.abs(result.height - observed.vector.size.y) < .001);
        }
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});

test('native vector path expands SVG H/V exactly across closed and multiple subpaths', () => {
  assert.equal(strokedPathNativeData('M10 0L0 12H9L8 20L18 8H9L10 0Z'), 'M 10 0 L 0 12 L 9 12 L 8 20 L 18 8 L 9 8 L 10 0 Z');
  assert.equal(strokedPathNativeData('M0 0H2 3V4ZM5 6 7 8H9'), 'M 0 0 L 2 0 L 3 0 L 3 4 Z M 5 6 L 7 8 L 9 8');
  assert.equal(strokedPathNativeData('M0 0C1 2 3 4 5 6H7Q8 9 10 11V12'), 'M 0 0 C 1 2 3 4 5 6 L 7 6 Q 8 9 10 11 L 10 12');
  assert.throws(() => strokedPathNativeData('m0 0h2'));
});
