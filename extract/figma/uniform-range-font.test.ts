import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createFigmaMock} from '../../scripts/plugin-engine-mock-figma.mjs';
const source=readFileSync(new URL('./dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,'const TARGET_SETS = ["FontCapture"];');
const font={family:'IBM Plex Sans',style:'Regular',variationSettings:{wdth:100,wght:400}};
const segment=(start:number,end:number,name:any=font)=>({start,end,characters:'Learn more'.slice(start,end),fontName:name});
for(const [name,ranges,expected] of [
 ['one uniform range',[segment(0,10)],true],
 ['adjacent identical ranges with reordered axis keys',[segment(0,5),segment(5,10,{...font,variationSettings:{wght:400,wdth:100}})],true],
 ['different families',[segment(0,5),segment(5,10,{...font,family:'Other'})],false],
 ['different faces',[segment(0,5),segment(5,10,{...font,style:'Bold'})],false],
 ['different variation axes',[segment(0,5),segment(5,10,{...font,variationSettings:{wdth:100,wght:600}})],false],
 ['gap',[segment(0,4),segment(5,10)],false],
 ['overlap',[segment(0,6),segment(5,10)],false],
 ['partial range',[segment(0,5)],false],
 ['wrong character evidence',[{...segment(0,10),characters:'Other'}],false],
 ['unavailable API',null,false],
] as const)test('canonical font capture: '+name,async()=>{
 const {figma:mock}=createFigmaMock(),figma:any=mock;
 const variant=figma.createComponent();variant.name='Case=One';
 const node=figma.createText();node.characters='Learn more';node.fontName=figma.mixed;variant.appendChild(node);
 node.getStyledTextSegments=ranges===null?()=>{throw Error('unavailable');}:()=>ranges;
 const set=figma.combineAsVariants([variant],figma.currentPage);set.name='FontCapture';
 const dump=JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${source}\n})()`,{figma,console:{log(){},warn(){},error(){}}})));
 const text=dump.FontCapture.variants[0].children[0].text;
 assert.equal(text.fontFamily,expected?'IBM Plex Sans':undefined);assert.equal(text.fontStyle,expected?'Regular':null);
 assert.equal(dump._degradations.some((d:any)=>d.message?.includes('fontName is mixed')), !expected);
});
