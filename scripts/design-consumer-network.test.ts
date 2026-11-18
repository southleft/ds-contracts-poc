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

import {CHECK_429_POLICY,fetchFigmaForCheck} from './design-consumer-network.js';
test('the check waits out a 429 (six retries) or a 5xx (three): Retry-After, never under a doubling floor; a wait over the cap is refused at once',async()=>{
 const run=async(answers:Array<[number,string|null]>)=>{const waits:number[]=[],tokens:string[]=[];let i=0;
  const response=await fetchFigmaForCheck('https://api.figma.com/v1/x','tok',{sleep:async ms=>{waits.push(ms/1000);},report:()=>{},
   fetchImpl:async(_url,init)=>{tokens.push(init.headers['X-Figma-Token']);const [status,after]=answers[Math.min(i++,answers.length-1)];return {status,headers:{get:(n:string)=>n==='retry-after'?after:null}};}});
  return {status:response.status,waits,calls:tokens.length,tokens};};
 // F→R run 10: four 429s with a 2 to 4 s Retry-After, then the limit lifts. The importer's three retries gave up here.
 const lifted=await run([[429,'2'],[429,'4'],[429,'3'],[429,'4'],[200,null]]);
 assert.deepEqual(lifted,{status:200,waits:[5,10,20,40],calls:5,tokens:['tok','tok','tok','tok','tok']});
 assert.deepEqual((await run([[429,'30'],[200,null]])).waits,[30],'a longer Retry-After is honored');
 assert.deepEqual((await run([[429,null],[429,'']  ,[200,null]])).waits,[5,10],'absent or empty: the floor');
 const exhausted=await run([[429,'1']]);
 assert.deepEqual([exhausted.status,exhausted.waits],[429,[5,10,20,40,60,60]],'six retries, then the 429 is returned and refused by name');
 assert.equal(exhausted.waits.length,CHECK_429_POLICY.retries);
 assert.deepEqual(await run([[429,String(CHECK_429_POLICY.maxWaitSeconds+1)]]),{status:429,waits:[],calls:1,tokens:['tok']},'a wait over the cap is never slept');
 assert.deepEqual((await run([[404,null]])),{status:404,waits:[],calls:1,tokens:['tok']},'only a 429 or a 5xx is waited out');
 // F→R run 11: one HTTP 500 on the bounds read. A 5xx is waited out three times, on the same floor, counted apart from 429s.
 assert.deepEqual(await run([[500,null],[503,'7'],[200,null]]),{status:200,waits:[5,10],calls:3,tokens:['tok','tok','tok']});
 assert.deepEqual(await run([[502,null]]),{status:502,waits:[5,10,20],calls:4,tokens:['tok','tok','tok','tok']},'three retries, then the 5xx is returned and refused by name');
 assert.deepEqual((await run([[429,'2'],[500,null],[429,'2'],[200,null]])).waits,[5,5,10],'each kind keeps its own count');
 assert.deepEqual((await run([[503,String(CHECK_429_POLICY.maxWaitSeconds+1)]])).waits,[],'a wait over the cap is never slept');
});
