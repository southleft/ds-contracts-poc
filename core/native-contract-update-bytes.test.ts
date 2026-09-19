/** Saved plans and journals pin the bytes of their plan, programs and reader.
 * This file builds the FIRST fixture of its own process on purpose: the native
 * API mock numbers ids from a process-wide counter, so the pinned bytes only
 * reproduce there. Keep it alone in this file. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { nativeUpdateFixture } from './native-contract-update-test-fixture.js';
import { prepareNativeContractUpdate, emitNativeContractUpdateScript } from './native-contract-update.js';
import { emitNativeContractReadbackScript } from './native-source-observation.js';
import { prepareNativeTokenContext } from './native-token-context.js';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

// Measured on the parent commit (398318b16) with the unmodified modules: saved
// plans and journals pin these bytes, and must keep authenticating.
test('a plan without token changes is byte-identical to one prepared before token values were carried', async () => {
  const f = await nativeUpdateFixture(), prepared = prepareNativeContractUpdate(f.input);
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
