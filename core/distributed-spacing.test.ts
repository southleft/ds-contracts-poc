import assert from 'node:assert/strict';
import test from 'node:test';
import {proposeFromDump} from './propose-figma.js';
import {generateCss} from './emit-react.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import type {DumpSet} from '../extract/figma/types.js';

// Unmodified mapped _SliderHeader from the retained HeroUI Slider input:
// raw SHA256 e82093f3127c836ae036875a46422fd37b36192a172661d00877b4ac05b1673e,
// Figma THpbsacXsfsLeCpg9gP5UQ / 2306:2324, version 2404406612212874497.
// Its two FILL children occupy [0,91] and [91,182] even though itemSpacing=140.
const retainedHeader: DumpSet = {
  "setName": "_SliderHeader",
  "type": "COMPONENT_SET",
  "nodeId": "2306:2295",
  "key": "56656789ecb6a9579d37dec8502d3fcbc7460be8",
  "propertyDefinitions": {
    "value#2700:0": {
      "type": "TEXT",
      "defaultValue": "Value"
    },
    "showValue#2701:5": {
      "type": "BOOLEAN",
      "defaultValue": true
    },
    "variant": {
      "type": "VARIANT",
      "defaultValue": "default",
      "variantOptions": [
        "default"
      ]
    }
  },
  "boolDefaults": {
    "showValue": true
  },
  "variants": [
    {
      "name": "variant=default",
      "type": "COMPONENT",
      "nodeId": "2306:2296",
      "componentKey": "76a5a95c31d135142d3db92a02cebfe7eefb4acf",
      "bbox": {
        "width": 182,
        "height": 24
      },
      "layout": {
        "mode": "HORIZONTAL",
        "primary": "SPACE_BETWEEN",
        "counter": "CENTER",
        "spacing": 140,
        "padding": [
          0,
          0,
          0,
          0
        ],
        "primarySizing": "FIXED",
        "counterSizing": "AUTO"
      },
      "sourceEmptyFill": true,
      "fillWidth": true,
      "children": [
        {
          "name": "Label",
          "type": "INSTANCE",
          "nodeId": "13970:21533",
          "localGeometry": {
            "nodeId": "13970:21533",
            "parentId": "2306:2296",
            "transform": [
              [
                1,
                0,
                0
              ],
              [
                0,
                1,
                0
              ]
            ],
            "localSize": {
              "width": 91,
              "height": 24
            },
            "parentSize": {
              "width": 182,
              "height": 24
            }
          },
          "layout": {
            "mode": "HORIZONTAL",
            "primary": "MIN",
            "counter": "CENTER",
            "spacing": 4,
            "padding": [
              0,
              8,
              0,
              0
            ],
            "primarySizing": "FIXED",
            "counterSizing": "AUTO"
          },
          "sourceEmptyFill": true,
          "instanceSizing": {
            "horizontal": "FILL",
            "vertical": "HUG"
          },
          "fillWidth": true,
          "instanceOf": "Label",
          "instanceKey": "8b3d95b56e3ca352a389f2a7082da6fa64ec0e2e",
          "componentProperties": {
            "showTooltip#17804:0": false,
            "showRequired#13605:4": false,
            "value#13605:3": "Label"
          },
          "instanceGeometry": {
            "nodeId": "13970:21533",
            "componentId": "13605:42525",
            "transform": [
              [
                1,
                0,
                0
              ],
              [
                0,
                1,
                0
              ]
            ],
            "localSize": {
              "width": 91,
              "height": 24
            }
          },
          "instanceRootOverrides": {
            "nodeId": "13970:21533",
            "componentId": "13605:42525",
            "fields": [
              "height",
              "width"
            ],
            "mainSize": {
              "width": 148,
              "height": 24
            },
            "componentKey": "8b3d95b56e3ca352a389f2a7082da6fa64ec0e2e",
            "localTransform": [
              [
                1,
                0,
                0
              ],
              [
                0,
                1,
                0
              ]
            ],
            "localSize": {
              "width": 91,
              "height": 24
            }
          },
          "bbox": {
            "width": 91,
            "height": 24
          }
        },
        {
          "name": "Value",
          "type": "TEXT",
          "nodeId": "2306:2298",
          "localGeometry": {
            "nodeId": "2306:2298",
            "parentId": "2306:2296",
            "transform": [
              [
                1,
                0,
                91
              ],
              [
                0,
                1,
                0
              ]
            ],
            "localSize": {
              "width": 91,
              "height": 24
            },
            "parentSize": {
              "width": 182,
              "height": 24
            }
          },
          "fillWidth": true,
          "text": {
            "characters": "Value",
            "fontSize": 14,
            "fontStyle": "Medium",
            "fontWeight": 500,
            "lineHeight": 24,
            "fontFamily": "Inter",
            "textAlign": "RIGHT",
            "textAutoResize": "HEIGHT",
            "letterSpacing": 0,
            "style": "Body sm medium",
            "styleKey": "4603882c41120caeadc8680e31769b90edef74aa"
          },
          "fill": {
            "hex": "18181b"
          },
          "propRefs": {
            "visible": "showValue",
            "characters": "value"
          }
        }
      ],
      "variantProperties": {
        "variant": "default"
      }
    }
  ]
};
const corpus = tokenCorpusFromJson({primitives: {}, semantic: {}, light: {}, brandDefault: {}});
function project(set = structuredClone(retainedHeader), bound = false) {
  const result = proposeFromDump(set, {
    corpus: bound ? tokenCorpusFromJson({primitives: {space: {authored: {$type: 'dimension', $value: '140px'}}}, semantic: {}, light: {}, brandDefault: {}}) : corpus,
    contractIdByName: new Map([['Label', 'ds.label']]),
    contractIdByKey: new Map([['8b3d95b56e3ca352a389f2a7082da6fa64ec0e2e', 'ds.label']]),
    fileKey: 'THpbsacXsfsLeCpg9gP5UQ',
    projectionMode: 'reviewable-inversion', mintUnbound: true,
    stampsObservable: true, hiddenCaptured: true,
  });
  const contract = ContractSchema.parse(result.contract);
  const tokens = new Set(Array.from(JSON.stringify(contract).matchAll(/\{([a-z0-9.-]+)\}/gi), m => m[1]));
  const errors: string[] = [];
  const css = generateCss(contract, tokens, errors);
  assert.deepEqual(errors, []);
  return {result, contract, root: contract.anatomy.root, css};
}
const rootRule = (css: string) => css.match(/\.root \{([^}]+)\}/)?.[1] ?? '';

test('retained Slider header preserves distributed FILL geometry without adding a minimum gap', () => {
  const source = structuredClone(retainedHeader), before = JSON.stringify(source);
  assert.equal(source.variants[0].bbox!.width, 182);
  assert.equal(source.variants[0].layout!.spacing, 140);
  assert.deepEqual(source.variants[0].children!.map(child => ({
    x: child.localGeometry!.transform[0][2], width: child.localGeometry!.localSize.width, fill: child.fillWidth,
  })), [{x: 0, width: 91, fill: true}, {x: 91, width: 91, fill: true}]);
  const {root, result, css} = project(source);
  assert.equal(root.layout?.justify, 'space-between');
  assert.equal(root.parts!.Label.layout?.grow, true);
  assert.equal(root.parts!.Value.layout?.grow, true);
  assert.equal(root.tokens?.gap, undefined);
  assert.match(rootRule(css), /justify-content: space-between;/);
  assert.doesNotMatch(rootRule(css), /gap:/);
  assert.ok(result.notes.some(note => note.includes('dormant itemSpacing (140)') && note.includes('gap omitted')));
  assert.equal(JSON.stringify(source), before, 'source bounds, children and metadata stay unchanged');
});

test('a bound dormant spacing is named without publishing an active CSS minimum', () => {
  const source = structuredClone(retainedHeader);
  source.variants[0].bound = {itemSpacing: 'space/authored'};
  const {root, result, css} = project(source, true);
  assert.equal(root.tokens?.gap, undefined);
  assert.doesNotMatch(rootRule(css), /gap:/);
  assert.ok(result.notes.some(note => note.includes('bound to space/authored') && note.includes('gap omitted')));
});

test('explicit packed layouts and an unknown distribution retain their authored spacing', () => {
  for (const primary of ['MIN', 'CENTER', 'MAX', undefined] as const) {
    const source = structuredClone(retainedHeader);
    if (primary === undefined) delete source.variants[0].layout!.primary;
    else source.variants[0].layout!.primary = primary;
    const {root, result, css} = project(source);
    assert.ok(root.tokens?.gap, String(primary));
    assert.match(rootRule(css), /gap: var\(/, String(primary));
    assert.ok(!result.notes.some(note => note.includes('gap omitted')), String(primary));
  }
});

test('wrapping distributed layouts keep the existing shared row-gap path', () => {
  const source = structuredClone(retainedHeader);
  source.variants[0].layout!.wrap = true;
  const {root, result, css} = project(source);
  assert.ok(root.tokens?.gap);
  assert.match(rootRule(css), /gap: var\(/);
  assert.ok(!result.notes.some(note => note.includes('gap omitted')));
});

test('negative distributed spacing retains the existing overlap decision', () => {
  const source = structuredClone(retainedHeader);
  source.variants[0].layout!.spacing = -8;
  const {root, result} = project(source);
  assert.equal(root.layout?.overlap, true);
  assert.ok(root.tokens?.gap);
  assert.ok(!result.notes.some(note => note.includes('gap omitted')));
});

test('mixed captured distributions do not silently erase a fixed minimum', () => {
  const source = structuredClone(retainedHeader);
  const packed = structuredClone(source.variants[0]);
  packed.name = 'variant=packed'; packed.nodeId = 'test:packed';
  packed.variantProperties = {variant: 'packed'}; packed.layout!.primary = 'MIN';
  source.variants.push(packed);
  const definition = source.propertyDefinitions!.variant;
  assert(definition.type === 'VARIANT');
  definition.variantOptions = ['default', 'packed'];
  const {root, result} = project(source);
  assert.ok(root.tokens?.gap);
  assert.ok(!result.notes.some(note => note.includes('gap omitted')));
});
