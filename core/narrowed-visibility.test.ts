import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformSync} from 'esbuild';
import {ContractSchema, type Contract} from '../scripts/contract-schema.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {generatedTypeErrors} from './react-test-runtime.js';

const tokens = {primitives: {}, semantic: {}, light: {}, dark: {}, brands: {default: {}}};

function fixture(): Contract {
  return ContractSchema.parse({
    id: 'test.narrowed-visibility',
    name: 'NarrowedVisibility',
    version: '0.1.0',
    status: 'draft',
    description: 'Ancestor enum visibility must not emit an impossible comparison',
    semantics: {element: 'div'},
    states: [],
    props: [{
      name: 'state',
      type: {enum: ['inactive', 'active', 'quiet']},
      default: 'inactive',
      bindings: {code: {prop: 'state'}, figma: {kind: 'VARIANT', property: 'State', values: {inactive: 'Inactive', active: 'Active', quiet: 'Quiet'}}},
    }],
    anatomy: {
      root: {
        layout: {display: 'flex'},
        parts: {
          open: {
            visibleWhen: {prop: 'state', equals: 'active'},
            parts: {
              shown: {text: 'shown', visibleWhen: {prop: 'state', equals: 'active'}},
              hidden: {text: 'hidden', visibleWhen: {prop: 'state', equals: 'inactive'}},
            },
          },
          group: {
            visibleWhen: {prop: 'state', equals: ['active', 'quiet']},
            parts: {
              quiet: {text: 'quiet', visibleWhen: {prop: 'state', equals: ['quiet', 'inactive']}},
            },
          },
        },
      },
    },
    bindings: {code: {anchors: {importPath: './NarrowedVisibility', export: 'NarrowedVisibility'}}, figma: {anchors: {fileKey: null, componentSetKey: null}}},
  });
}

const load = (tsx: string) => {
  const module = {exports: {} as {NarrowedVisibility?: React.ComponentType<{state?: string}>}};
  const req = createRequire(import.meta.url);
  vm.runInNewContext(transformSync(tsx, {loader: 'tsx', format: 'cjs', jsx: 'automatic'}).code, {
    module,
    exports: module.exports,
    require: (p: string) => p.endsWith('.css') ? {default: new Proxy({}, {get: (_, k) => String(k)})} : req(p),
  });
  return module.exports.NarrowedVisibility!;
};

test('a visibleWhen value excluded by an ancestor is omitted instead of failing the build', () => {
  const contract = fixture();
  const contracts = new Map([[contract.id, contract]]);
  for (const tsx of [
    emitReact(contract, {tokens: new Set(), icons: new Map(), contracts}).tsx,
    emitReactInline(contract, {tokens, icons: new Map(), contracts}).tsx,
  ]) {
    assert.equal(tsx.includes("=== 'inactive'"), false, tsx);
    assert.equal(tsx.includes('>hidden<'), false, tsx);
    assert.equal(tsx.includes('>shown<'), true, tsx);
    assert.equal(tsx.includes("=== 'quiet'"), true, tsx);
    assert.deepEqual(generatedTypeErrors('NarrowedVisibility', tsx), []);
    const View = load(tsx);
    assert.equal(renderToStaticMarkup(React.createElement(View, {state: 'active'})).includes('shown'), true);
    assert.equal(renderToStaticMarkup(React.createElement(View, {state: 'active'})).includes('hidden'), false);
    assert.equal(renderToStaticMarkup(React.createElement(View, {state: 'inactive'})).includes('hidden'), false);
    assert.equal(renderToStaticMarkup(React.createElement(View, {state: 'quiet'})).includes('quiet'), true);
  }
});
