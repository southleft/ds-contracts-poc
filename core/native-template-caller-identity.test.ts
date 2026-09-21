import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeTemplateValueUpdateFixture } from './native-template-value-update-test-fixture.js';
import { emitNativeTemplateValueWriteScript, prepareNativeTemplateComponentUpdate, type NativeTemplateComponentUpdateInput } from './native-template-value-writer.js';
import { emitNativeTemplateUpdateObservationScript } from './native-template-update-observation.js';
import { matchNativeTemplateUpdateObservation } from './native-template-update-match.js';
import { emitNativeTemplateCallerContentReadback } from './native-contract-comparison-observation.js';
import { prepareNativeTemplateUpdateProposal, restoreNativeTemplateUpdateProposal } from './native-template-update-proposal.js';

async function fixture() {
  const h = await nativeTemplateValueUpdateFixture(true, true);
  const input: NativeTemplateComponentUpdateInput = {...h.input, callerIdentity:'sdk-slot-alias-v1'};
  const row = input.consumers![0].baseline.content.nodes.find((n: any) => n.type === 'TEXT');
  const oldId = row.id, node = h.figma.getNodeById(oldId), slot = node.parent;
  node.id = slot.id + ';settled-text';
  const get = h.figma.getNodeById;
  h.figma.getNodeById = (id: string) => id === oldId ? node : get(id);
  h.figma.getNodeByIdAsync = async (id: string) => h.figma.getNodeById(id);
  return {...h, input, oldId, node, slot, get};
}

test('SDK-proven caller aliases preserve exact color updates, repeats and reversal, with live IDs in the receipt', async () => {
  const h = await fixture(), input = h.input;
  const legacy = await h.run(emitNativeTemplateValueWriteScript({...input, callerIdentity:undefined}, true));
  assert.equal(legacy.status, 'refused'); assert.deepEqual(h.assignments, []);
  const proposal = prepareNativeTemplateUpdateProposal(input);
  assert.deepEqual(prepareNativeTemplateUpdateProposal(restoreNativeTemplateUpdateProposal(proposal)), proposal);
  const sync = emitNativeTemplateCallerContentReadback(input.consumers![0].input, true, false, input.callerIdentity);
  assert.doesNotMatch(sync, /\bawait\b/);
  const syncRead = await h.run(sync);
  assert.equal(syncRead.status, 'native-readback-collected', JSON.stringify(syncRead.problems));
  assert.deepEqual(syncRead.slotIdentityAliases, [{recordedId:h.oldId,liveId:h.node.id}]);
  assert.equal(syncRead.nodes.find((n: any) => n.type === 'TEXT').id, h.oldId);
  const read = () => h.run(emitNativeTemplateUpdateObservationScript(input));
  assert.equal(matchNativeTemplateUpdateObservation(input, await read()).untouched, true);
  const preflight = await h.run(emitNativeTemplateValueWriteScript(input, true));
  assert.equal(preflight.status, 'preflight-observed', JSON.stringify(preflight.problems));
  assert.deepEqual(h.assignments, []);
  assert.ok(preflight.consumerScope.nodeIds.includes(h.node.id));
  const result = await h.run(emitNativeTemplateValueWriteScript(input));
  assert.equal(result.status, 'write-observed', JSON.stringify(result.problems));
  const raw = await read(), matched = matchNativeTemplateUpdateObservation(input, raw);
  assert.equal(matched.completed, true, JSON.stringify(matched.problems));
  for(const corrupt of [
    (r:any)=>{delete r.consumerObservations[0].slotIdentityAliases;},
    (r:any)=>{r.consumerObservations[0].slotIdentityAliases[0].liveId='unrelated';},
    (r:any)=>{r.consumerObservations[0].slotIdentityAliases.push({...r.consumerObservations[0].slotIdentityAliases[0]});},
    (r:any)=>{r.consumerObservations[0].nodes.find((n:any)=>n.type==='TEXT').values.width+=1;},
    (r:any)=>{r.observation.slotIdentityAliases=[];},
  ]) {
    const changed=structuredClone(raw);corrupt(changed);
    assert.equal(matchNativeTemplateUpdateObservation(input,changed).completed,false);
  }
  const next = {before:prepareNativeTemplateComponentUpdate(input).after,baseline:raw.observation,
    desired:input.desired,consumers:matched.consumerStates,callerIdentity:input.callerIdentity};
  const count = h.assignments.length;
  assert.equal((await h.run(emitNativeTemplateValueWriteScript(next))).status, 'no-op');
  assert.equal(h.assignments.length, count);
  const reverse = {...next,desired:input.before.templateGraph!.input};
  assert.equal((await h.run(emitNativeTemplateValueWriteScript(reverse))).status, 'write-observed');
  const reversed = await h.run(emitNativeTemplateUpdateObservationScript(reverse));
  assert.equal(matchNativeTemplateUpdateObservation(reverse, reversed).completed, true);
  assert.deepEqual(reversed.observation, input.baseline);
});

test('allocation stamps cannot substitute for SDK identity, topology or exact caller content', async () => {
  for (const [index, corrupt] of [
    (h: Awaited<ReturnType<typeof fixture>>) => {h.figma.getNodeById = (id: string) => id === h.oldId ? null : h.get(id);},
    (h: Awaited<ReturnType<typeof fixture>>) => {h.figma.getNodeById = (id: string) => id === h.oldId ? {...h.node} : h.get(id);},
    (h: Awaited<ReturnType<typeof fixture>>) => {h.node.characters = 'replacement';},
    (h: Awaited<ReturnType<typeof fixture>>) => {h.node.setSharedPluginData('ds_contracts','nativeSourceAllocation','foreign');},
    (h: Awaited<ReturnType<typeof fixture>>) => {h.node.fontName = {family:'Other',style:'Regular'};},
    (h: Awaited<ReturnType<typeof fixture>>) => {h.slot.parent.appendChild(h.node);},
    (h: Awaited<ReturnType<typeof fixture>>) => {h.slot.appendChild(h.figma.createText());},
    (h: Awaited<ReturnType<typeof fixture>>) => {h.figma.createPage().appendChild(h.slot.parent.mainComponent.createInstance());},
  ].entries()) {
    const h = await fixture(); corrupt(h);
    const result = await h.run(emitNativeTemplateValueWriteScript(h.input));
    assert.equal(result.status, 'refused', 'case '+index+': '+JSON.stringify(result.problems));
    assert.deepEqual(h.assignments, []);
    const raw = await h.run(emitNativeTemplateUpdateObservationScript(h.input));
    const match = matchNativeTemplateUpdateObservation(h.input, raw);
    assert.equal(match.completed, false);
  }
});

test('an alias changed after asynchronous preflight is rechecked before assignments', async () => {
  const h = await fixture(), load = h.figma.variables.getLocalVariablesAsync.bind(h.figma.variables);
  h.figma.variables.getLocalVariablesAsync = async () => {
    h.node.characters = 'late edit';
    return load();
  };
  const result = await h.run(emitNativeTemplateValueWriteScript(h.input));
  assert.equal(result.status, 'refused'); assert.deepEqual(h.assignments, []);
});


test('asynchronous SDK alias reads work with dynamic document access; the final write still requires static access',async()=>{
  const h=await fixture(),get=h.figma.getNodeById;
  h.figma.getNodeByIdAsync=async(id:string)=>get(id);
  h.figma.getNodeById=()=>{throw Error('dynamic-page');};
  const input=h.input.consumers![0].input;
  const asyncRead=await h.run(emitNativeTemplateCallerContentReadback(input,false,false,h.input.callerIdentity));
  assert.equal(asyncRead.status,'native-readback-collected',JSON.stringify(asyncRead.problems));
  assert.equal((await h.run(emitNativeTemplateCallerContentReadback(input,true,false,h.input.callerIdentity))).status,'refused');
  assert.deepEqual(h.assignments,[]);
});
