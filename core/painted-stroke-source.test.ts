import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { paintedStrokeSvgObservation, strokeSvgGeometry, type PaintedStrokeObservation } from '../extract/figma/rest/stroke-svg.js';

const fixture: { version: string; rows: Array<{ svg: string; observed: PaintedStrokeObservation }> } =
  JSON.parse(readFileSync(new URL('../extract/figma/fixtures/painted-stroke-source.json', import.meta.url), 'utf8'));

test('six pinned wave exports exactly witness painted ink without claiming centerlines or renderable shapes', () => {
  assert.equal(fixture.version, '2405899822035794365');
  assert.equal(fixture.rows.length, 6);
  for (const { svg, observed } of fixture.rows) {
    const result = paintedStrokeSvgObservation(svg, observed);
    assert('observation' in result);
    assert.equal(result.observation.kind, 'painted-stroke-outline');
    assert.deepEqual(result.observation.source, observed);
    assert.notEqual(result.observation.source.paths, observed.paths);
    assert(!('shape' in result));
    assert('issue' in strokeSvgGeometry(svg, { ...observed, strokeWeight: 4, cap: 'ROUND', join: 'ROUND',
      viewport: { width: observed.width, height: observed.height, x: 0, y: 0 } }));
  }
});

test('outline evidence refuses changed identity, basis, paint, path bytes and winding', () => {
  const { svg, observed } = fixture.rows[0]!;
  const reject = (o: PaintedStrokeObservation, reason: string) =>
    assert.deepEqual(paintedStrokeSvgObservation(svg, o), { issue: `painted-stroke-svg-${reason}` });
  reject({ ...observed, nodeId: 'other' }, 'source-identity-mismatch');
  reject({ ...observed, width: observed.width + 0.001 }, 'export-basis-mismatch');
  reject({ ...observed, strokeColor: '#6750A5' }, 'export-paint-mismatch');
  reject({ ...observed, paths: [{ ...observed.paths[0]!, path: observed.paths[0]!.path.replace('38.971', '38.972') }] }, 'export-geometry-mismatch');
  reject({ ...observed, paths: [{ ...observed.paths[0]!, windingRule: 'EVENODD' }] }, 'export-geometry-mismatch');
  for (const width of [NaN, Infinity, 0, -1, 1000001]) reject({ ...observed, width }, 'native-geometry-unqualified');
  for (const paths of [[], [...observed.paths, ...observed.paths], [{ path: 'M0 0L1 1', windingRule: 'NONZERO' as const }]])
    reject({ ...observed, paths }, 'native-geometry-unqualified');
});

test('outline evidence refuses transformations, opacity, clipping, extra geometry and active SVG content', () => {
  const { svg, observed } = fixture.rows[0]!;
  for (const attr of ['transform="translate(1)"', 'opacity="0.5"', 'clip-path="url(#clip)"',
    'stroke="black"', 'style="fill:red"', 'fill="red"', 'onload="alert(1)"']) {
    assert('issue' in paintedStrokeSvgObservation(svg.replace('<path ', `<path ${attr} `), observed), attr);
  }
  for (const altered of [svg.replace('</svg>', '<path d="M0 0L1 0L1 1Z"/></svg>'),
    svg.replace('<path ', '<g><path ').replace('</svg>', '</g></svg>'),
    svg.replace('</svg>', '<script>alert(1)</script></svg>'), ' '.repeat(70001)])
    assert('issue' in paintedStrokeSvgObservation(altered, observed));
});
