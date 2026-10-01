import test from 'node:test';
import assert from 'node:assert/strict';
import * as z from 'zod';
import {enumerateBranches, fieldsOf, fieldSchema} from './introspect.js';
import {ShapeSchema} from '../../scripts/contract-schema.js';
test('shape union enumerates existing geometry and new native line fields',()=>{
 const branches=enumerateBranches();
 for(const key of ['shape.width','shape.height','shape.paths.data','shape.strokePath.viewport.x','shape.arc.start','shape.line.length','shape.line.observedSources.nodeId']) assert.ok(branches.includes(key),key);
 assert.ok(!branches.includes('shape.kind.kind'));
});
test('field tables retain union types and member-dependent presence',()=>{
 const fields=fieldsOf(z.union([z.object({kind:z.literal('a'),value:z.string()}),z.object({kind:z.literal('b'),size:z.number()})]));
 assert.equal(fields.find(f=>f.name==='kind')!.type,'"a" | "b"');
 assert.equal(fields.find(f=>f.name==='kind')!.optional,false);
 assert.equal(fields.find(f=>f.name==='value')!.optional,true);
 assert.ok(fieldSchema(ShapeSchema,'line'));
 assert.throws(()=>fieldSchema(ShapeSchema,'missing'),/no field/);
});
