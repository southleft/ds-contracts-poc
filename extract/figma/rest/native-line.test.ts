import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {mapRestToDump} from './map.js';
import type {DumpSet} from '../types.js';
const observed=JSON.parse(readFileSync(new URL('../fixtures/native-line/caps-rest.json',import.meta.url),'utf8'));
const writes=JSON.parse(readFileSync(new URL('../fixtures/native-line/caps-write.json',import.meta.url),'utf8')).write.rows;
const frame=observed.nodes['391:2'].document;
const plugin=readFileSync(new URL('../dump.plugin.js',import.meta.url),'utf8');
const body=plugin.slice(plugin.indexOf('function nativeLineIssue('),plugin.indexOf('\nfunction dumpShape('));
const nativeCapture=vm.runInNewContext(`const CONSTRAINT_H={MIN:'LEFT',MAX:'RIGHT',CENTER:'CENTER',STRETCH:'STRETCH',SCALE:'SCALE'}; const CONSTRAINT_V={MIN:'TOP',MAX:'BOTTOM',CENTER:'CENTER',STRETCH:'STRETCH',SCALE:'SCALE'};${body};dumpNativeLine`);
function capture(children=frame.children){
 const response={...observed,nodes:{'391:2':{...observed.nodes['391:2'],document:{...frame,type:'COMPONENT',children}}}};
 const result=mapRestToDump(response);const set=result.dump[frame.name] as DumpSet;
 return {children:set.variants[0].children!,report:result.report};
}
test('REST carries all nine actual native line transforms, cap/align and zero logical height without mutating inputs',()=>{
 const before=JSON.stringify(observed),result=capture();assert.equal(result.children.length,9);
 for(let i=0;i<9;i++){
  const original=frame.children[i],line=result.children[i].shape!;
  assert.equal(line.kind,'line');assert.equal(line.width,original.size.x);assert.equal(line.height,0);
  assert.deepEqual(line.line!.transform,original.relativeTransform);
  assert.equal(line.line!.cap,original.strokeCap??'NONE');assert.equal(line.line!.align,original.strokeAlign);
  assert.deepEqual(line.line!.source,{nodeId:original.id,parentId:frame.id});
 }
 assert.equal(JSON.stringify(observed),before);
});
test('independent plugin write observations produce the same geometry and source identity as REST',()=>{
 const result=capture();
 for(let i=0;i<9;i++){
  const native=JSON.parse(JSON.stringify(nativeCapture({...writes[i],type:'LINE'},frame)));
  const rest=result.children[i].shape!;
  assert.deepEqual(native.line,rest.line);
  assert.equal(native.width,rest.width);assert.equal(native.height,0);
 }
});
test('both routes refuse scale, arrow decoration, dashes, masks and nonzero native height',()=>{
 for(const [restPatch,pluginPatch] of [
  [{relativeTransform:[[2,0,0],[0,1,0]]},{relativeTransform:[[2,0,0],[0,1,0]]}],
  [{strokeCap:'ARROW_LINES'},{strokeCap:'ARROW_LINES'}],
  [{strokeCap:'ROUND',strokeWeight:100},{strokeCap:'ROUND',strokeWeight:100}],
  [{strokeDashes:[2,2]},{dashPattern:[2,2]}],
  [{isMask:true},{isMask:true}],
  [{size:{x:58,y:1}},{height:1}],
 ] as any[]){
  const result=capture([{...frame.children[0],...restPatch}]);
  assert.equal(result.children[0].shape,undefined);
  assert(result.report.degradations.some(d=>d.code==='native-line-unsupported'));
  assert.equal(nativeCapture({...writes[0],type:'LINE',...pluginPatch},frame),null);
 }
});

test('live dashed vectors with identical cap and network metadata can have different painted outlines',async()=>{
 const {PNG}=await import('pngjs');const {createHash}=await import('node:crypto');
 const fixture=JSON.parse(readFileSync(new URL('../fixtures/native-line/dash-cap-ambiguity.json',import.meta.url),'utf8'));
 const [node,endpoint]=fixture.rows;
 assert.deepEqual(node.observed,endpoint.observed,'the exposed fields do not distinguish dash caps from endpoint caps');
 assert.notDeepEqual(node.strokeGeometry,endpoint.strokeGeometry,'captured native paint is required to disambiguate');
 const images=fixture.rows.map((row:any)=>{const bytes=readFileSync(new URL('../fixtures/native-line/'+row.png,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);return PNG.sync.read(bytes);});
 assert.equal(images[0].width,images[1].width);assert.equal(images[0].height,images[1].height);
 assert(!images[0].data.equals(images[1].data),'same fields must not silently produce one supposed native rendering');
});
