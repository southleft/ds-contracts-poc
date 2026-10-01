import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {proposeFromDump,proposeBatchFromDump,asMinimalChildContract} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema,type Contract} from '../scripts/contract-schema.js';
import {validateContract} from '../packages/core/src/validate.js';
const dump=JSON.parse(readFileSync(new URL('../extract/figma/fixtures/dependency-scope/field.json',import.meta.url),'utf8'));
const options=()=>({corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),stampsObservable:dump._provenance.stampsObservable,mintUnbound:true});
const search=()=>ContractSchema.parse(proposeFromDump(dump.search,options()).contract);
const inputOptions=(child:unknown,id='ds.search')=>({...options(),contractIdByName:new Map([['search','ds.search']]),contractsById:new Map([[id,asMinimalChildContract(child)]])});
test('exact original composition includes already-imported slot defaults in referee scope',()=>{
 const result=proposeBatchFromDump(dump,options());
 assert.deepEqual(result.skipped,[]);
 assert.deepEqual(result.proposals.map(p=>p.setName),['search','Input','Field']);
 const contracts=result.proposals.map(p=>ContractSchema.parse(p.contract)),byId=new Map(contracts.map(c=>[c.id,c]));
 for(const c of contracts){const errors:string[]=[];validateContract(c,byId,errors,new Map());assert.deepEqual(errors,[]);}
});
test('minimal and wrongly keyed registry entries cannot satisfy missing slot dependencies',()=>{
 const c=search();
 for(const opts of [inputOptions({id:c.id,props:c.props}),inputOptions(c,'wrong.id')])
  assert.throws(()=>proposeFromDump(dump.Input,opts),/defaultContent references.*no contract in scope/);
});
test('real imported dependencies retain cycle checks',()=>{
 const c=search();c.anatomy.root.parts={cycle:{component:{id:'ds.input'}}};
 assert.throws(()=>proposeFromDump(dump.Input,inputOptions(c)),/creates a cycle/);
});
