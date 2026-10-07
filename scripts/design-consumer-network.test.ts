import test from 'node:test';import assert from 'node:assert/strict';
import {retryConsumerRead} from './design-consumer-network.js';
test('interrupted response reads retry within a fixed bound and retain exact bytes',async()=>{
 let calls=0;const waits:number[]=[],messages:string[]=[];
 const result=await retryConsumerRead('image:node',async()=>{if(++calls<3)throw new TypeError('fetch failed');return Buffer.from('original');},{sleep:async ms=>{waits.push(ms);},report:m=>messages.push(m)});
 assert.equal(result.toString(),'original');assert.deepEqual(waits,[1000,2000]);assert.equal(messages.length,2);
});
test('HTTP refusals and parsing errors stay failures without retries',async()=>{
 for(const error of [Error('HTTP 403'),Error('HTTP 429'),new SyntaxError('invalid JSON')]){let calls=0;await assert.rejects(retryConsumerRead('bounds:before',async()=>{calls++;throw error;}),/bounds:before/);assert.equal(calls,1);}
});
test('exhausted transport retains cause and stage, never supplies successful data',async()=>{
 let calls=0;const error=new TypeError('terminated');await assert.rejects(retryConsumerRead('render:123',async()=>{calls++;throw error;},{sleep:async()=>{},report:()=>{}}),e=>e instanceof Error&&e.message==='render:123:transport-retries-exhausted'&&e.cause===error);assert.equal(calls,3);
});
