import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{nativeStrokedPathGeometryMatches as matches,nativeStrokedPathNodeMatches,nativeStrokedPathPaintMatches}from'./native-stroked-path.js';
const fixture=JSON.parse(readFileSync(new URL('../extract/figma/fixtures/zero-height-native.json',import.meta.url),'utf8'));
const fractional=JSON.parse(readFileSync(new URL('../extract/figma/fixtures/zero-height-fractional-stretch-native.json',import.meta.url),'utf8'));
test('live STRETCH resizing snaps extent while preserving fractional margins and every vertex',()=>{
 const geometry=(r:any,stroke:any)=>({width:r.width,height:r.height,strokePath:{...stroke,data:r.paths[0].data,
  viewport:{width:r.parentWidth,height:r.parentHeight,x:r.x,y:r.y}}});
 for(const row of fractional.rows)for(const state of row.states){
  const a=geometry(row.before,row.stroke),b=geometry(state,row.stroke);assert(matches(a,b),JSON.stringify({id:row.vectorId,width:state.requested}));
  const moved=structuredClone(b);moved.strokePath.viewport.x+=0.125;assert(!matches(a,moved));
  const changed=structuredClone(b);changed.strokePath.data=changed.strokePath.data.replace(/ L [^ ]+ 0/, ' L 1 0');assert(!matches(a,changed));
  const wrongConstraint=structuredClone(b);(wrongConstraint.strokePath.constraints.horizontal as string)='SCALE';assert(!matches(a,wrongConstraint));
 }
});
test('independent live zero-height readbacks preserve centerline through parent resizing',()=>{
 for(const row of fixture.rows){assert(matches(row.before,row.after));
  for(const mutate of [(s:any)=>s.strokePath.data=s.strokePath.data.replace(' L ',' M '),(s:any)=>s.strokePath.viewport.x+=1,(s:any)=>s.strokePath.cap='SQUARE',(s:any)=>s.strokePath.join='BEVEL',(s:any)=>s.strokePath.constraints.horizontal='SCALE',(s:any)=>s.strokePath.miterLimit=5,(s:any)=>s.width+=1]){
   const changed=structuredClone(row.after);mutate(changed);assert(!matches(row.before,changed));
  }
 }
});
test('same bounds do not hide changed interior vertices or open/closed topology',()=>{
 const a=fixture.rows[0].before;
 for(const data of ['M0 0L11 0L30 0L40 0','M0 0L10 0L30 0L40 0Z'])assert(!matches(a,{...a,strokePath:{...a.strokePath,data}}));
 assert(matches(a,{...a,strokePath:{...a.strokePath,data:'M0 0H10 30 40'}}));
});
test('scaled curved centerlines retain handles and parent-relative placement',()=>{
 const a={width:10,height:10,strokePath:{data:'M0 0C0 10 10 0 10 10',cap:'ROUND' as const,join:'MITER' as const,miterLimit:4,viewport:{width:20,height:20,x:2,y:3}}};
 const b={width:20,height:30,strokePath:{...a.strokePath,data:'M0 0C0 30 20 0 20 30',viewport:{width:40,height:60,x:4,y:9}}};
 assert(matches(a,b));assert(!matches(a,{...b,strokePath:{...b.strokePath,data:'M0 0C1 30 20 0 20 30'}}));
});

test('native readback requires unmasked undashed center strokes and an independent free parent',()=>{
 for(const row of fixture.rows){const a=row.after,p=a.strokePath;
  const values={width:a.width,height:a.height,x:p.viewport.x,y:p.viewport.y,relativeTransform:[[1,0,p.viewport.x],[0,1,p.viewport.y]],vectorPaths:[{data:p.data,windingRule:'NONE'}],strokeCap:p.cap,strokeJoin:p.join,strokeMiterLimit:p.miterLimit,constraints:p.constraints,isMask:false,blendMode:'PASS_THROUGH',strokeAlign:'CENTER',dashPattern:[],fills:[],layoutSizingHorizontal:'FIXED',layoutSizingVertical:'FIXED'};
  const parent={width:p.viewport.width,height:p.viewport.height,layoutMode:'NONE'};
  assert(nativeStrokedPathNodeMatches(row.before,values,parent));
  for(const patch of [{isMask:true},{dashPattern:[2,2]},{fills:[{}]},{strokeAlign:'OUTSIDE'},{blendMode:'MULTIPLY'},{relativeTransform:[[1,0,0],[0,1,0]]},{vectorPaths:[{data:p.data,windingRule:'NONZERO'}]},{layoutSizingHorizontal:'FILL'}])assert(!nativeStrokedPathNodeMatches(row.before,{...values,...patch},parent));
  assert(!nativeStrokedPathNodeMatches(row.before,values,{...parent,layoutMode:'HORIZONTAL'}));
 }
});

test('stroke paint and weight must agree with contract literals or independently resolved tokens',()=>{
 const color={r:103/255,g:80/255,b:164/255};
 for(const row of fixture.rows){
  const spec={type:'shape' as const,name:'stroke',lits:{strokeColor:color,strokeWeight:4}};
  assert(nativeStrokedPathPaintMatches(spec,row.paint,4));
  assert(!nativeStrokedPathPaintMatches(spec,{...row.paint,strokeWeight:5},4));
  assert(!nativeStrokedPathPaintMatches(spec,{...row.paint,strokes:[{...row.paint.strokes[0],color:{r:0,g:0,b:0}}]},4));
  const bound={id:'variable:ink',color};const tokenSpec={type:'shape' as const,name:'stroke',stroke:'ink'};
  const values={...row.paint,strokes:[{...row.paint.strokes[0],boundVariables:{color:{type:'VARIABLE_ALIAS',id:bound.id}}}],boundVariables:{strokes:[{type:'VARIABLE_ALIAS',id:bound.id}]}};
  assert(nativeStrokedPathPaintMatches(tokenSpec,values,4,bound));
  assert(!nativeStrokedPathPaintMatches(tokenSpec,values,4));
  assert(!nativeStrokedPathPaintMatches(tokenSpec,values,undefined,bound));
  assert(!nativeStrokedPathPaintMatches(tokenSpec,values,4,{...bound,id:'other'}));
 }
});
