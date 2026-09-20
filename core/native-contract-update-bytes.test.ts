/** Saved plans and journals pin the bytes of their plan, programs and reader.
 * The native API mock numbers ids from a process-wide counter, so pinned bytes
 * only reproduce for the FIRST fixture of a process. The scalar pin below is
 * the first fixture of this file's own process; each sibling pin re-runs this
 * file in a child process that builds only that sibling's fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { nativeUpdateFixture } from './native-contract-update-test-fixture.js';
import { nativeRootSizeUpdateFixture } from './native-contract-size-update-test-fixture.js';
import { prepareNativeContractUpdate, emitNativeContractUpdateScript } from './native-contract-update.js';
import { emitNativeContractReadbackScript } from './native-source-observation.js';
import { prepareNativeTokenContext } from './native-token-context.js';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const SIBLING = 'NATIVE_UPDATE_BYTES_SIBLING';

if (process.env[SIBLING] === 'root-size') {
  // Child process: measure one sibling kind as the first fixture, print, exit.
  void (async () => {
    const f = await nativeRootSizeUpdateFixture(), p = prepareNativeContractUpdate(f.input);
    process.stdout.write(JSON.stringify({ kind: p.plan.kind, revision: p.revision, plan: sha(JSON.stringify(p.plan)),
      apply: sha(emitNativeContractUpdateScript(p.plan)), preflight: sha(emitNativeContractUpdateScript(p.plan, 'apply', true)),
      rollback: sha(emitNativeContractUpdateScript(p.plan, 'rollback')) }));
  })();
} else {
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

  // Sibling kinds are prepared through the scalar plan with token values
  // switched off. A root-size plan's bytes, measured on 398318b16 as the first
  // fixture of a process, must not move either.
  test('a sibling plan kind (root size) is byte-identical to one prepared before token values were carried', () => {
    const child = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url)],
      { env: { ...process.env, [SIBLING]: 'root-size' }, encoding: 'utf8', timeout: 120000 });
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), {
      kind: 'native-contract-root-size-update',
      revision: 'sha256:624f0c3bccdd197b4f3a05fe206a82ff41f41bc9312a1a5a19ec6c2aa2d92262',
      plan: '8092b39598fa576f06ee92d91cbc27fbbf85b2cea1e172b0cc8683b2ae522a14',
      apply: '874b2c4fb0b11896997b70bc496d1cf1a70507a9832917513b9c0d7f0b418b9f',
      preflight: 'b2560581b12207be1f8066f33e32f090c59247235cbafbf710b278dd80c775bc',
      rollback: 'c16633a4d45004a27c015827a96540fcd148e4d201d5408adba12ddf7b0463a5',
    });
  });
}
