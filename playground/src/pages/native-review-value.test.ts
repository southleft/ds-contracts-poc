import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { correctionValue, designValue } from './NativeReviewValue';

const render = (value: ReturnType<typeof designValue>) => renderToStaticMarkup(createElement('span', null, value));

test('reviewed numeric endpoints remain distinct and round-trip without losing precision', () => {
  const values = [0.40001, 0.40002, 18.390625, Math.fround(0.4), Number.MIN_VALUE, Number.MAX_VALUE];
  for (const format of [correctionValue, designValue]) {
    assert.notEqual(render(format(values[0])), render(format(values[1])));
    for (const value of values) {
      const visible = render(format(value)).replace(/^<span>|<\/span>$/g, '');
      assert.equal(Number(visible), value, `The reviewer must see the exact value ${value}`);
    }
  }
});

test('sub-byte shadow color and opacity changes remain distinguishable', () => {
  const shadow = (r: number, a: number) => [{ type: 'DROP_SHADOW' as const, visible:true as const, blendMode:'NORMAL' as const, offset: {x:0,y:1}, radius:2, spread:0, color:{r,g:0.2,b:0.3,a} }];
  const before = render(correctionValue(shadow(0.40001, 0.50001)));
  const colorAfter = render(correctionValue(shadow(0.40002, 0.50001)));
  const opacityAfter = render(correctionValue(shadow(0.40001, 0.50002)));
  assert.notEqual(before, colorAfter);
  assert.notEqual(before, opacityAfter);
  assert.match(colorAfter, /0\.40002/);
  assert.match(opacityAfter, /0\.50002/);
});

test('long design values reveal changes beyond the preview and escape source text', () => {
  const before = {description:'<script>untrusted</script>'.repeat(10), value:0.40001};
  const after = {...before, value:0.40002};
  const shown = render(designValue(after));
  assert.notEqual(render(designValue(before)), shown);
  assert.match(shown, /<details>/);
  assert.match(shown, /<pre[^>]*>.*0\.40002.*<\/pre>/);
  assert.ok(shown.includes('&lt;script&gt;'));
  assert.ok(!shown.includes('<script>'));
});
