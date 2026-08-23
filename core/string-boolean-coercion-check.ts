/**
 * STRING→BOOLEAN COMPOSITION — leftover "true"/"false" spellings must
 * emit as booleans, never as truthy string attributes.
 *
 *   npx tsx core/string-boolean-coercion-check.ts
 */
import { ContractSchema, type Contract } from './index.js';
import { generateCss, generateTsx } from './emit-react.js';
import { tokenInventoryFromJson } from './index.js';

const failures: string[] = [];
const check = (label: string, condition: boolean): void => {
  if (!condition) failures.push(label);
  console.log(`  ${condition ? '✔' : '✖'} ${label}`);
};

const child = ContractSchema.parse({
  id: 'ds.avatar',
  name: 'Avatar',
  version: '1.0.0',
  status: 'draft',
  description: 'coercion pin',
  semantics: { element: 'div' },
  props: [
    {
      name: 'round',
      type: 'boolean',
      default: false,
      bindings: { figma: { kind: 'BOOLEAN', property: 'Round' }, code: { prop: 'round' } },
    },
  ],
  states: [],
  anatomy: { root: { tokens: {}, parts: {} } },
  a11y: { contrast: 'AA' },
  bindings: { figma: { anchors: { fileKey: 'pin', componentSetKey: 'avatar-pin', nodeId: '0:1' } }, code: { anchors: { importPath: 'x', export: 'Avatar' } } },
});

const parent = ContractSchema.parse({
  id: 'ds.card-image',
  name: 'CardImage',
  version: '1.0.0',
  status: 'draft',
  description: 'coercion pin',
  semantics: { element: 'div' },
  props: [],
  states: [],
  anatomy: {
    root: {
      tokens: {},
      parts: {
        avatar: { component: { id: 'ds.avatar', props: { round: 'true' } } },
      },
    },
  },
  a11y: { contrast: 'AA' },
  bindings: { figma: { anchors: { fileKey: 'pin', componentSetKey: 'card-pin', nodeId: '0:2' } }, code: { anchors: { importPath: 'x', export: 'CardImage' } } },
});

const byId = new Map<string, Contract>([
  [child.id, child],
  [parent.id, parent],
]);
const inventory = tokenInventoryFromJson([{}]);
const cssErrors: string[] = [];
const css = generateCss(parent, inventory, cssErrors);
let tsx = '';
try {
  tsx = generateTsx(parent, byId, new Map(), css);
} catch (e) {
  failures.push(`generateTsx threw: ${e instanceof Error ? e.message : e}`);
}

check('generateTsx accepts leftover string "true" on a boolean child prop', tsx.length > 0);
check('emits boolean presence `round`, not round="true"', /round(?!=)/.test(tsx) && !/round="true"/.test(tsx));

const parentFalse = ContractSchema.parse({
  ...parent,
  anatomy: {
    root: {
      tokens: {},
      parts: {
        avatar: { component: { id: 'ds.avatar', props: { round: 'False' } } },
      },
    },
  },
});
let tsxFalse = '';
try {
  tsxFalse = generateTsx(parentFalse, byId, new Map(), css);
} catch (e) {
  failures.push(`generateTsx threw on False: ${e instanceof Error ? e.message : e}`);
}
check(
  'spelling "False" emits round={false} (or omits when default is false)',
  !/round="False"/.test(tsxFalse) && !/round="false"/.test(tsxFalse),
);

if (failures.length > 0) {
  console.error(`\n✘ string-boolean-coercion: ${failures.length} failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✔ string-boolean-coercion: leftover Figma spellings coerce at emit');
