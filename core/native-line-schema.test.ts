import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {ShapeSchema} from '../scripts/contract-schema.js';
import * as z from 'zod';
const rows=JSON.parse(readFileSync(new URL('../extract/figma/fixtures/native-line/caps-write.json',import.meta.url),'utf8')).write.rows;
const shape=(row:any)=>({kind:'line',width:row.width,height:0,line:{length:row.width,transform:row.relativeTransform,cap:row.strokeCap,align:row.strokeAlign,source:{nodeId:row.id,parentId:'391:2'}}});
test('all independently observed native cap/alignment cases serialize without losing geometry or identity',()=>{
 for(const row of rows){const input=shape(row);assert.deepEqual(ShapeSchema.parse(input),input);}
});
test('zero dimensions stay invalid for every preexisting shape kind',()=>{
 for(const kind of ['polygon','ellipse','rect','path','stroked-path']){
  assert.equal(ShapeSchema.safeParse({kind,width:1,height:0}).success,false);
  assert.equal(ShapeSchema.safeParse({kind,width:0,height:1}).success,false);
  assert.equal(ShapeSchema.safeParse({kind,width:1,height:1}).success,true);
 }
});
test('native line branch requires logical zero height, exact length and one geometry vocabulary',()=>{
 const input=shape(rows[0]);
 for(const patch of [{height:1},{width:0},{width:input.width+1},{rotation:1},{arc:{start:0,end:1,innerRadius:1}},{line:undefined}])
  assert.equal(ShapeSchema.safeParse({...input,...patch}).success,false);
 assert.equal(ShapeSchema.safeParse({...input,line:{...input.line,transform:[[2,0,0],[0,1,0]]}}).success,false);
});
test('exported JSON Schema preserves the preexisting positive-size branch and isolates native zero height',()=>{
 const schema=z.toJSONSchema(ShapeSchema,{target:'draft-7',io:'input'}) as any;
 assert.equal(schema.anyOf.length,2);
 const [ordinary,line]=schema.anyOf;
 assert.equal(ordinary.properties.width.exclusiveMinimum,0);
 assert.equal(ordinary.properties.height.exclusiveMinimum,0);
 assert.equal(ordinary.properties.kind.enum.includes('line'),false);
 assert.equal(line.properties.kind.const,'line');
 assert.equal(line.properties.height.const,0);
 assert.equal(line.properties.width.exclusiveMinimum,0);
});
