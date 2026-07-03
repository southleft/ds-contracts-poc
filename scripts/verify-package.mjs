/**
 * Product-environment smoke test: imports the BUILT package (dist/, exactly
 * what an npm consumer gets) and server-renders a composed screen — the
 * contract-generated components running outside Storybook, outside the repo's
 * source tree, the way a real product would consume them.
 */
import assert from 'node:assert';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import * as DS from '../dist/index.js';

const expected = ['Avatar', 'Badge', 'Button', 'Card', 'Table', 'TableCell', 'TableHeaderCell', 'TableRow'];
for (const name of expected) {
  assert.equal(typeof DS[name], 'object', `${name} export missing from dist`);
}

const html = renderToString(
  h('main', null,
    h(DS.Card, { title: 'Team' },
      'Quarterly staffing overview.',
    ),
    h(DS.Table, { density: 'compact' },
      h(DS.TableRow, { state: 'selected' },
        h(DS.TableCell, null, 'Ada Lovelace'),
        h(DS.TableCell, null, 'Engineering'),
        h(DS.TableCell, null, 'Active'),
      ),
      h(DS.TableRow, null,
        h(DS.TableCell, null, 'Grace Hopper'),
        h(DS.TableCell, null, 'Systems'),
        h(DS.TableCell, null, 'Active'),
      ),
    ),
    h(DS.Button, { variant: 'danger', size: 'sm', loading: true }, 'Remove'),
  ),
);

assert.match(html, /role="table"/, 'Table role missing');
assert.match(html, /role="columnheader"/, 'Header cells missing');
assert.match(html, /Ada Lovelace/, 'Cell content missing');
assert.match(html, /Team<\/span>/, 'Card title missing');
assert.match(html, /data-loading="true"/, 'Button loading attribute missing');
assert.match(html, /class="[^"]*root/, 'CSS Module classes missing');

console.log(`✔ Package smoke test passed — ${expected.length} components exported, SSR output ${html.length} bytes`);
console.log('  Consumer usage: import { Table } from "ds-contracts-poc"; import "ds-contracts-poc/styles.css";');
