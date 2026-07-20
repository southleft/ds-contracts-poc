/**
 * underscore-set-compose eval body — live-gauntlet harness class ⑦
 * (underscore-named-sets-unaddressable): visual-parity compose.ts pickSet
 * treated EVERY dump key starting with "_" as a meta channel — but the CBDS
 * owner legitimately names 30 sets "_Input label", "_Slot-Dialog",
 * "_Tab-item", "_Error text", …; 20 live composites' session scopes refused
 * before the fix. A name-prefix convention is not a type test: the meta
 * channels (_provenance/_variables/_degradations) are now excluded BY NAME
 * and everything else is a set when it PARSES as one — matching the
 * playground's own receive path.
 *
 * Pins: composeSubject addresses an underscore-NAMED set from the committed
 * v1.6 kit dump (the real fix seam, not a source grep) and refuses an
 * unknown set BY NAME as before.
 *
 * Exits non-zero with a named failure on any violated expectation.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { composeSubject } from '../../extract/figma/visual-parity/compose.js';
import type { DumpSubject } from '../../extract/figma/visual-parity/subjects.js';

const fail = (msg: string): never => {
  console.error(`✘ underscore-set-compose: ${msg}`);
  process.exit(1);
};

const DUMP = 'extract/figma/fixtures/cbds-plugin-all-sets.v16.dump.json';
const dump = JSON.parse(readFileSync(path.join(process.cwd(), DUMP), 'utf8')) as Record<
  string,
  { nodeId?: string } | undefined
>;
const SET = '_Input label';
const drawn = dump[SET];
if (!drawn?.nodeId) fail(`fixture dump lost the underscore-named set "${SET}" — fixture drift`);

const subject: DumpSubject = {
  id: 'eval-underscore-input-label',
  label: 'eval: underscore-named set addressability',
  kind: 'dump',
  dumpPath: DUMP,
  set: SET,
  fileKey: (dump._provenance as { fileKey?: string } | undefined)?.fileKey ?? 'eval',
  setNodeId: drawn!.nodeId!,
};

const pkg = composeSubject(subject);
if (!pkg.contract || pkg.contract.id !== 'ds.input-label') {
  fail(`"${SET}" composed to ${pkg.contract?.id ?? '(nothing)'} — expected ds.input-label`);
}

// The refusal path still names unknown sets.
let refused = '';
try {
  composeSubject({ ...subject, id: 'eval-underscore-missing', set: '_No Such Set' });
} catch (e) {
  refused = (e as Error).message;
}
if (!refused.includes('"_No Such Set" not in')) {
  fail(`unknown-set refusal lost its name: ${JSON.stringify(refused)}`);
}

console.log(`underscore-set-compose ok: "${SET}" composes through visual-parity (${pkg.contract.id}); unknown sets still refuse by name`);
