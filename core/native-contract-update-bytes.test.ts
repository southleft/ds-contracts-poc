/** Saved plans and journals pin their inputs and program bytes. Test recorded
 * inputs, not a fresh canvas emitted by today's compiler: changing new empty
 * geometry must not quietly redefine the historical compatibility baseline. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { prepareNativeContractUpdate, emitNativeContractUpdateScript, type NativeContractUpdateInput } from './native-contract-update.js';
import { emitNativeContractReadbackScript } from './native-source-observation.js';
import { prepareNativeTokenContext } from './native-token-context.js';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const recorded = (kind: string): NativeContractUpdateInput => JSON.parse(readFileSync(
  new URL(`./fixtures/native-update-byte-inputs/${kind}.json`, import.meta.url), 'utf8'));
// Measured on the parent commit (398318b16) with the unmodified modules: saved
// plans and journals pin these bytes, and must keep authenticating.
test('a plan without token changes is byte-identical to one prepared before token values were carried', async () => {
  const input = recorded('scalar'), prepared = prepareNativeContractUpdate(input);
  const f = { input, plan: prepared.plan };
  assert.equal('tokenChanges' in prepared.plan, false); assert.equal(JSON.stringify(prepared.plan).includes('tokenChanges'), false);
  assert.equal(JSON.stringify(prepared.plan).includes('allocatedValues'), false);
  assert.equal(prepared.revision, 'sha256:8423068c1779d6d7f561927373b0e2015e96a11316e9cdac9e5d9f7b4ba52bbb');
  assert.equal(sha(JSON.stringify(f.plan)), '085705da835c83dc939be25a4a2a882e6ac2e95b204021bf6088823be4becae6');
  assert.equal(sha(emitNativeContractUpdateScript(f.plan)), 'b4bd2975e1146237ebaa22647a0ba4ffef9c241f3d9a458061aa38bf86f86977');
  assert.equal(sha(emitNativeContractUpdateScript(f.plan, 'apply', true)), '6b89a6e26ed0cfa0d726313b0f0b0b399e75de29b93e5dd70c252c612d59d102');
  assert.equal(sha(emitNativeContractUpdateScript(f.plan, 'rollback')), 'a5b3e8d44d30e3b334d562961864de918e450faafda54957ee58696989d1a467');
  assert.equal(sha(emitNativeContractReadbackScript(f.plan.after, true, true)), 'fc4ea61750ab34451cb12bb84c74ac17199158e75d2fb63c6806569a626e9bbe');
  assert.equal(prepareNativeTokenContext(f.input.before.tokenInput).revision, 'sha256:cd0f5906838ef7ea1a88a81167c4d2fc34ddd81ef868e57f04da9bed5b1cb6fe');
});

// Sibling kinds are prepared through the scalar plan with token values
// switched off. A root-size plan's bytes, measured on 398318b16 as the first
// fixture of a process, must not move either.
test('a sibling plan kind (root size) is byte-identical to one prepared before token values were carried', () => {
  const p = prepareNativeContractUpdate(recorded('root-size'));
  assert.deepEqual({ kind: p.plan.kind, revision: p.revision, plan: sha(JSON.stringify(p.plan)),
    apply: sha(emitNativeContractUpdateScript(p.plan)), preflight: sha(emitNativeContractUpdateScript(p.plan, 'apply', true)),
    rollback: sha(emitNativeContractUpdateScript(p.plan, 'rollback')) }, {
    kind: 'native-contract-root-size-update',
    revision: 'sha256:624f0c3bccdd197b4f3a05fe206a82ff41f41bc9312a1a5a19ec6c2aa2d92262',
    plan: '8092b39598fa576f06ee92d91cbc27fbbf85b2cea1e172b0cc8683b2ae522a14',
    apply: '874b2c4fb0b11896997b70bc496d1cf1a70507a9832917513b9c0d7f0b418b9f',
    preflight: 'b2560581b12207be1f8066f33e32f090c59247235cbafbf710b278dd80c775bc',
    rollback: 'c16633a4d45004a27c015827a96540fcd148e4d201d5408adba12ddf7b0463a5',
  });
});
test('written legacy token plans retain their exact pinned programs', () => {
  const prepared=prepareNativeContractUpdate(recorded('legacy-token'));
  assert.equal(prepared.plan.kind,'native-contract-opacity-update');
  if(prepared.plan.kind!=='native-contract-opacity-update')throw Error('wrong-plan');
  delete prepared.plan.tokenBindingScope;
  // Measured before this change on b61474b15, first fixture in a fresh process.
  assert.deepEqual({plan:sha(JSON.stringify(prepared.plan)), apply:sha(emitNativeContractUpdateScript(prepared.plan)),
    preflight:sha(emitNativeContractUpdateScript(prepared.plan,'apply',true)), rollback:sha(emitNativeContractUpdateScript(prepared.plan,'rollback'))},{
    plan:'8197ce593b4d34f823b97579b811c135779a39a8e970fdcb5f18a28ad0e9eed7',
    apply:'ef5c1be67c2c7f84e9d33bc5b50057310c8c88aff163e7c86b2d604c3f18b29d',
    preflight:'685e4ecfe7a1dfabceba4856a155fc85f1af80d51aa94d68c4bc48dfde0ef117',
    rollback:'1be8dde856e620a4f5d0a9769e23b6451505c6ebf338b70253d929b25bf96d62',
  });
});
