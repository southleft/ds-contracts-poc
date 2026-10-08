import test from 'node:test';import assert from 'node:assert/strict';
import {domainTransitionGroups} from './design-consumer-domain.js';
const domain=[{size:'small',on:false},{size:'large',on:false},{size:'large',on:true}];
const cases=domain.map((props,i)=>({key:String(i),props}));
const axes=[{name:'size',values:['small','large']},{name:'on',values:[false,true]}];
test('enumerates every legal directed edge and names undrawn transitions',()=>{const g=domainTransitionGroups(domain,cases,axes);assert.deepEqual(g.flatMap(x=>x.pairs).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),[{from:'0',to:'1'},{from:'1',to:'0'},{from:'1',to:'2'},{from:'2',to:'1'}]);assert.equal(g.flatMap(x=>x.outside).length,2);});
for(const [name,bad] of Object.entries({missingAxis:[axes[0]],missingValue:[axes[0],{name:'on',values:[false]}],duplicateAxis:[...axes,axes[0]],duplicateValue:[axes[0],{name:'on',values:[false,true,true]}],emptyValues:[axes[0],{name:'on',values:[]}],invalidValue:[axes[0],{name:'on',values:[false,true,1]}],unknownAxis:[...axes,{name:'unknown',values:['x']}]}))test('refuses '+name,()=>assert.throws(()=>domainTransitionGroups(domain,cases,bad),/declared-transition-/));
test('singleton domain axes need no behavior mutation',()=>assert.doesNotThrow(()=>domainTransitionGroups(domain.map(x=>({...x,orientation:'vertical'})),cases.map(x=>({...x,props:{...x.props,orientation:'vertical'}})),axes)));
test('explicit enum values absent from source stay outside the declared domain',()=>{const groups=domainTransitionGroups(domain,cases,[{name:'size',values:['small','large','huge']},axes[1]]);assert.deepEqual(groups.find(g=>g.target==='huge')?.outside,['0','1','2']);});
