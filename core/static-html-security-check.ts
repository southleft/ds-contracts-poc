/**
 * Adversarial checks for contract-controlled static HTML identities and values.
 *
 * Run with:
 *   npx tsx core/static-html-security-check.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { emitHtml } from './emit-html.js';
import { tokenInventoryFromJson } from './tokens.js';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (relativePath: string) =>
  JSON.parse(readFileSync(path.join(ROOT, relativePath), 'utf8'));
const parse = (raw: unknown): Contract => ContractSchema.parse(raw);
const clone = <T>(value: T): T => structuredClone(value);

const contracts = new Map<string, Contract>(
  readdirSync(path.join(ROOT, 'contracts'))
    .filter((file) => file.endsWith('.contract.json'))
    .map((file) => parse(read(path.join('contracts', file))))
    .map((contract) => [contract.id, contract]),
);
const icons = new Map<string, string>(
  readdirSync(path.join(ROOT, 'assets', 'icons'))
    .filter((file) => file.endsWith('.svg'))
    .map((file) => [
      file.replace(/\.svg$/, ''),
      readFileSync(path.join(ROOT, 'assets', 'icons', file), 'utf8').trim(),
    ]),
);
const tokens = tokenInventoryFromJson([
  read('tokens/primitives.tokens.json'),
  read('tokens/semantic.tokens.json'),
  read('tokens/modes/semantic.light.tokens.json'),
  read('tokens/modes/semantic.dark.tokens.json'),
]);

const failures: string[] = [];
const check = (condition: boolean, message: string) => {
  console.log(`  ${condition ? '✔' : '✖'} ${message}`);
  if (!condition) failures.push(message);
};
const emit = (contract: Contract, extra: Contract[] = []) => {
  const byId = new Map(contracts);
  byId.set(contract.id, contract);
  for (const dep of extra) byId.set(dep.id, dep);
  return emitHtml(contract, { contracts: byId, icons, tokens });
};
const schemaValid = (raw: unknown, message: string): Contract => {
  const result = ContractSchema.safeParse(raw);
  check(result.success, `${message}: attack contract remains schema-valid`);
  if (!result.success) throw result.error;
  return result.data;
};
const refused = (raw: unknown, kind: string, message: string) => {
  const contract = schemaValid(raw, message);
  let error = '';
  try {
    emit(contract);
  } catch (cause) {
    error = String(cause);
  }
  check(error.includes(`Refused — unsafe static HTML ${kind}`), `${message}: named ${kind} refusal before output`);
};

console.log('\nStatic HTML identity refusals');
for (const attr of ['onclick', 'x"', 'aria-label x', 'x>', 'x/y', `x\u2028y`]) {
  const raw = clone(read('contracts/status-dot.contract.json'));
  raw.anatomy.root.attrs[attr] = 'attack';
  refused(raw, 'attribute name', `attribute ${JSON.stringify(attr)}`);
}

for (const element of ['div onmouseover=x', 'img/x', 'x>', `x\u2028y`]) {
  const raw = clone(read('contracts/status-dot.contract.json'));
  raw.anatomy.root.parts = { attack: { element } };
  refused(raw, 'element name', `element ${JSON.stringify(element)}`);
}

for (const role of ['button" autofocus="', 'button status', 'button>', 'button/alert', `button\u2028alert`]) {
  const raw = clone(read('contracts/status-dot.contract.json'));
  raw.semantics.role = role;
  refused(raw, 'role', `role ${JSON.stringify(role)}`);
}

for (const value of ['x" onclick="alert(1)', 'x y', 'x>', 'x/y', `x\u2028y`]) {
  const raw = clone(read('contracts/badge.contract.json'));
  raw.props[0].type.enum.push(value);
  refused(raw, 'enum class fragment', `enum ${JSON.stringify(value)}`);
}

{
  const raw = clone(read('contracts/status-dot.contract.json'));
  raw.semantics.elementByProp = {
    prop: 'variant',
    map: Object.fromEntries(raw.props[0].type.enum.map((value: string) => [value, 'span'])),
  };
  raw.semantics.elementByProp.map.neutral = 'span><img src=x onerror=alert(1)';
  refused(raw, 'element name', 'elementByProp injection');
}

{
  const raw = clone(read('contracts/status-dot.contract.json'));
  raw.semantics.roleByProp = {
    prop: 'variant',
    map: Object.fromEntries(raw.props[0].type.enum.map((value: string) => [value, 'img'])),
  };
  raw.semantics.roleByProp.map.neutral = 'img" onmouseover="alert(1)';
  refused(raw, 'role', 'roleByProp injection');
}

{
  const raw = clone(read('contracts/status-dot.contract.json'));
  raw.anatomy.root.attrs.role = '{label}';
  raw.props.find((prop: { name: string }) => prop.name === 'label').default = 'img" onclick="alert(1)';
  refused(raw, 'role', 'prop-driven anatomy role injection');
}

console.log('\nStatic HTML contextual escaping');
{
  const raw = clone(read('contracts/status-dot.contract.json'));
  const attack = `quoted" whitespace > slash/ unicode\u2028 <img src=x onerror="alert(1)"> &`;
  raw.props.find((prop: { name: string }) => prop.name === 'label').default = attack;
  raw.anatomy.root.attrs.title = attack;
  const contract = schemaValid(raw, 'literal and prop-driven attribute values');
  const { html } = emit(contract);
  const encoded = 'quoted&quot; whitespace &gt; slash/ unicode\u2028 &lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp;';
  check(html.includes(`aria-label="${encoded}"`), 'prop-driven attribute value is HTML-attribute encoded');
  check(html.includes(`title="${encoded}"`), 'literal attribute value is HTML-attribute encoded');
  check(!html.includes('<img src=x onerror='), 'encoded values create no injected element');
}

{
  const childRaw = clone(read('contracts/status-dot.contract.json'));
  childRaw.id = 'attack.status-dot';
  const child = schemaValid(childRaw, 'component-ref child');
  const parentRaw = clone(read('contracts/card.contract.json'));
  const ref = parentRaw.anatomy.root.parts.header.parts.avatar.component;
  ref.id = child.id;
  ref.props = { label: `child"><img src=x onerror="alert(1)">` };
  const parent = schemaValid(parentRaw, 'component-ref applied value');
  const { html } = emit(parent, [child]);
  check(
    html.includes('aria-label="child&quot;&gt;&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"'),
    'component-ref applied value is encoded at the child attribute sink',
  );
  check(!html.includes('<img src=x onerror='), 'component-ref value creates no injected element');
}

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} static HTML security check failure(s).`);
  process.exit(1);
}

console.log('\n✔ Static HTML refuses unsafe identities and contextually encodes contract values.');
