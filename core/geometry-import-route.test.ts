import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importFromUrl,type FetchLike} from '../extract/figma/rest/fetch.js';
const straight=JSON.parse(readFileSync(new URL('../extract/figma/fixtures/straight-vector-network.json',import.meta.url),'utf8'));
const painted=JSON.parse(readFileSync(new URL('../extract/figma/fixtures/painted-stroke-source.json',import.meta.url),'utf8')).rows[0];
function fixture(){
 const flat=structuredClone(straight.nodes[0]);flat.absoluteBoundingBox={x:0,y:6,width:40,height:0};
 const o=painted.observed;
 const wave={id:o.nodeId,name:'Wave',type:'VECTOR',size:{x:o.width,y:o.height},absoluteBoundingBox:{x:0,y:0,width:o.width,height:o.height},relativeTransform:[[1,0,0],[0,1,0]],constraints:{horizontal:'LEFT',vertical:'TOP'},fills:[],strokes:[{type:'SOLID',color:{r:103/255,g:80/255,b:164/255,a:1}}],strokeGeometry:o.paths,strokeWeight:4,strokeAlign:'CENTER'};
 const owner=(id:string,node:unknown)=>({id,name:id,type:'COMPONENT',size:{x:40,y:12},absoluteBoundingBox:{x:0,y:0,width:40,height:12},relativeTransform:[[1,0,0],[0,1,0]],children:[node]});
 return {response:{name:'Recorded',version:straight.version,nodes:{'1:1':{document:owner('Flat',flat)},'1:2':{document:owner('Wave',wave)}}},wave};
}
test('importFromUrl forwards geometry qualification switches and obtains its own pinned outline witness',async()=>{
 const {response,wave}=fixture(),calls:string[]=[];
 const reply=(body:unknown,status=200)=>({ok:status===200,status,json:async()=>body,text:async()=>JSON.stringify(body)});
 const transport:FetchLike=async(url,init)=>{
  calls.push(url);const u=new URL(url);
  if(u.hostname==='recorded-assets.test'){assert.equal(init?.headers?.['X-Figma-Token'],undefined);return {...reply({}),text:async()=>painted.svg};}
  if(u.pathname.endsWith('/variables/local'))return reply({},403);
  if(u.pathname.endsWith('/nodes')){assert.equal(u.searchParams.get('geometry'),'paths');return reply(response);}
  if(u.pathname==='/v1/images/fixture'){assert.equal(u.searchParams.get('version'),response.version);return reply({images:{[wave.id]:'https://recorded-assets.test/wave'}});}
  throw Error('Unexpected request '+u.pathname);
 };
 const plain=await importFromUrl('https://www.figma.com/design/fixture/?node-id=1-1','test-token',{fetchImpl:transport});
 assert(!JSON.stringify(plain.dump).includes('straightVectorSource'));assert(!calls.some(url=>url.includes('/v1/images/')));
 const mapped=await importFromUrl('https://www.figma.com/design/fixture/?node-id=1-1','test-token',{fetchImpl:transport,inspectStraightVectorNetworks:true,inspectPaintedStrokeOutlines:true});
 assert.equal((mapped.dump.Flat as any).variants[0].children[0].shape.kind,'stroked-path');
 const outline=(mapped.dump.Wave as any).variants[0].children[0];
 assert.equal(outline.paintedStrokeSource.nodeId,wave.id);
 assert.equal(outline.children[0].children[0].children[0].shape.kind,'path');
 assert.equal((mapped.dump._provenance as any).strokeSvgCapture.sources.version,response.version);
 assert(mapped.report.notes.some(n=>n.includes('stroke-svg-asset-unavailable:')),'missing flat SVG remains named; explicit network supplies its geometry');
});
