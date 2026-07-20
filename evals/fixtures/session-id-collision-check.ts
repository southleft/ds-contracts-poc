/**
 * session-id-collision eval body — live-gauntlet class ③
 * (session-id-collision-false-cycle): "RadioButton" (plain COMPONENT, key
 * 2dc14061…) and "Radio button" (the 12-variant set, key 8e246fb7…) both
 * sanitize to ds.radio-button. In a session, Radio button-icon imports
 * first and its nested RadioButton instance STUBS as ds.radio-button; when
 * the parent set then claimed the SAME id, the newest-wins registry rebound
 * the icon's ref onto the parent and the referee reported a cycle that is
 * not drawn (ds.radio-button → ds.radio-button-icon → ds.radio-button) —
 * all 12 variants refused to render on the visual stage.
 *
 * The fix (keys exist since v1.5/v1.6 — prefer key identity): proposal-time
 * id claiming applies the stubIdFor contradicting-key suffix discipline
 * against SESSION-claimed ids (contracts and stubs; never the repo), and
 * setless-component stubs now carry the component key on their anchors.
 *
 * Pins, over the committed trio fixture:
 *   · icon-first session: the parent set proposes as ds.radio-button-2 with
 *     the collision NAMED; session referee reports ZERO violations (no
 *     false cycle) — the 12 variants render
 *   · the icon's stub keeps ds.radio-button and carries the component key
 *   · heal path: importing the real "RadioButton" component claims the BASE
 *     id (its key AGREES with the stub — same component, legitimate heal)
 *   · without a session (batch/census scope) ids are UNCHANGED — the
 *     workspace re-import rule stands
 *
 * Exits non-zero with a named failure on any violated expectation.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, componentRefsOf, type Contract } from '../../scripts/contract-schema.js';
import { capturedTokensFromDump } from '../../core/captured-tokens.js';
import { validateContract, generateCss } from '../../core/emit-react.js';
import { flattenTokens, tokenInventoryFromJson } from '../../core/tokens.js';
import {
  dumpCapturesHidden,
  proposeFromDump,
  type MinimalChildContract,
} from '../../core/propose-figma.js';
import { loadTokenCorpus } from '../../extract/figma/tokens.js';
import { loadContracts } from '../../extract/figma/propose.js';

const fail = (msg: string): never => {
  console.error(`✘ session-id-collision: ${msg}`);
  process.exit(1);
};

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;
const dump = read('extract/figma/gauntlet/live/fixtures/session-id-collision-false-cycle-radio-button.dump.json');
const corpus = loadTokenCorpus(ROOT);
const loaded = loadContracts(path.resolve(ROOT, 'contracts'));
const hiddenCaptured = dumpCapturesHidden(dump._provenance as never);

interface Session {
  contracts: Map<string, Contract>;
  stubs: Map<string, Contract>;
  idByName: Map<string, string>;
  idByKey: Map<string, string>;
  claimedIds: Set<string>;
}
const session: Session = { contracts: new Map(), stubs: new Map(), idByName: new Map(), idByKey: new Map(), claimedIds: new Set() };

const importSet = (setName: string) => {
  const set = dump[setName];
  if (!set) fail(`fixture lost set "${setName}"`);
  const proposal = proposeFromDump(set as never, {
    corpus,
    contractIdByName: new Map([...loaded.byName, ...session.idByName]),
    contractIdByKey: new Map([...loaded.byKey, ...session.idByKey]),
    contractsById: new Map([
      ...(session.stubs as unknown as Map<string, MinimalChildContract>),
      ...loaded.byId,
      ...(session.contracts as unknown as Map<string, MinimalChildContract>),
    ]),
    sessionClaimedIds: session.claimedIds,
    fileKey: (dump._provenance as { fileKey?: string } | undefined)?.fileKey ?? null,
    mintUnbound: true,
    hiddenCaptured,
  });
  const contract = ContractSchema.parse(proposal.contract);
  session.contracts.set(contract.id, contract);
  session.idByName.set(contract.name, contract.id);
  session.idByName.set(setName, contract.id);
  session.claimedIds.add(contract.id);
  const key = contract.anchors.figma.componentSetKey;
  if (key) session.idByKey.set(key, contract.id);
  for (const raw of proposal.childStubs ?? []) {
    const stub = ContractSchema.safeParse(raw);
    if (!stub.success) continue;
    session.claimedIds.add(stub.data.id);
    if (!session.contracts.has(stub.data.id) && !session.stubs.has(stub.data.id)) {
      session.stubs.set(stub.data.id, stub.data);
    }
  }
  return { proposal, contract };
};

// 1) icon first — its nested RadioButton stubs as ds.radio-button, and the
//    stub carries the component KEY (setless components carry instanceKey).
const icon = importSet('Radio button-icon');
const stub = session.stubs.get('ds.radio-button');
if (!stub) fail(`icon import did not stub ds.radio-button (stubs: ${[...session.stubs.keys()].join(', ')})`);
const stubKey = stub!.anchors.figma.componentSetKey;
if (!stubKey || !String((dump.RadioButton as { key?: string }).key).startsWith(stubKey.slice(0, 8))) {
  fail(`the RadioButton stub carries key ${JSON.stringify(stubKey)} — expected the plain component's key (setless instanceKey fallback)`);
}

// 2) the parent set claims a SUFFIXED id with the collision NAMED — never a
//    silent rebind of the icon's stub ref.
const parent = importSet('Radio button');
if (parent.contract.id === 'ds.radio-button') {
  fail('the parent set claimed ds.radio-button over the session stub with a CONTRADICTING key — the false-cycle rebind is back');
}
if (parent.contract.id !== 'ds.radio-button-2') {
  fail(`parent id is ${parent.contract.id} — expected the deterministic arrival-order suffix ds.radio-button-2`);
}
if (!parent.proposal.notes.some((n) => n.includes('already claimed in this session by a DIFFERENT drawn component'))) {
  fail('the session id collision is not NAMED in the proposal notes');
}

// 3) session referee: ZERO violations — in particular no "cannot compose
//    itself" false cycle; the 12 variants are renderable.
{
  const contracts = new Map<string, Contract>([...session.stubs, ...session.contracts]);
  for (const raw of parent.proposal.childStubs ?? []) {
    const s = ContractSchema.safeParse(raw);
    if (s.success && !contracts.has(s.data.id)) contracts.set(s.data.id, s.data);
  }
  const repoTrees = [read('tokens/primitives.tokens.json'), read('tokens/semantic.tokens.json'), read('tokens/modes/semantic.light.tokens.json'), read('tokens/modes/semantic.dark.tokens.json')];
  const inventory = new Set<string>([...tokenInventoryFromJson(repoTrees)]);
  for (const e of capturedTokensFromDump(dump)?.entries ?? []) inventory.add(e.path);
  for (const p of [icon.proposal, parent.proposal]) {
    for (const k of flattenTokens((p.mintedTokens?.tree ?? {}) as Record<string, unknown>).keys()) inventory.add(k);
  }
  const icons = new Map(
    readdirSync(path.join(ROOT, 'assets', 'icons')).filter((f) => f.endsWith('.svg'))
      .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(ROOT, 'assets', 'icons', f), 'utf8').trim()] as const),
  );
  const errors: string[] = [];
  validateContract(parent.contract, contracts, errors, icons);
  generateCss(parent.contract, inventory, errors);
  const cycle = errors.find((e) => e.includes('cannot compose itself') || e.includes('Circular'));
  if (cycle) fail(`false cycle still reported: ${cycle}`);
  if (errors.length > 0) fail(`session referee violations: ${errors.slice(0, 3).join(' | ')}`);
  const refs = componentRefsOf(parent.contract).map((r) => r.ref.id);
  if (refs.includes(parent.contract.id)) fail('the parent references itself — rebind not actually prevented');
}

// 4) heal path: the REAL RadioButton component claims the BASE id — its key
//    AGREES with the stub (same component), so no suffix.
const single = importSet('RadioButton');
if (single.contract.id !== 'ds.radio-button') {
  fail(`RadioButton (the real component, key-identical to the stub) claimed ${single.contract.id} — the same-key heal path must keep the base id`);
}

// 5) no session, no change: batch/census scope proposes the base id.
{
  const p = proposeFromDump(dump['Radio button'] as never, {
    corpus,
    contractIdByName: loaded.byName,
    contractIdByKey: loaded.byKey,
    contractsById: loaded.byId,
    fileKey: null,
    mintUnbound: true,
    hiddenCaptured,
  });
  if ((p.contract as { id?: string }).id !== 'ds.radio-button') {
    fail(`without a session the set proposed as ${(p.contract as { id?: string }).id} — repo-scope behavior must not change`);
  }
}

console.log('session-id-collision ok: parent suffixed ds.radio-button-2 (named), zero referee violations (no false cycle), stub keeps ds.radio-button with the component key, real RadioButton heals onto the base id, batch scope unchanged');
