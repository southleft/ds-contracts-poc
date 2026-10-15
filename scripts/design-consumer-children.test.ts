import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {installedBooleanChildren,probeConsumerChildren,consumerChildrenProblems} from './design-consumer-children.js';

const PACKAGE='@consumer/control';
const booleanContract={props:[{name:'showLabel',type:'boolean',bindings:{code:{prop:'children'}}}],anatomy:{root:{}}};
function fixture(type:string,extra=''){
  const consumer=mkdtempSync(path.join(tmpdir(),'consumer-children-types-'));
  const installed=path.join(consumer,'node_modules',...PACKAGE.split('/'));
  const dist=path.join(installed,'dist','Control');mkdirSync(dist,{recursive:true});
  writeFileSync(path.join(installed,'package.json'),JSON.stringify({name:PACKAGE,type:'module',types:'./dist/Control/Control.d.ts',exports:{'.':{types:'./dist/Control/Control.d.ts'}}}));
  writeFileSync(path.join(dist,'Control.d.ts'),`import type {HTMLAttributes,ForwardRefExoticComponent,RefAttributes} from 'react';
export interface ControlProps extends HTMLAttributes<HTMLDivElement> { children?: ${type}; }
export declare const Control: ForwardRefExoticComponent<ControlProps & RefAttributes<HTMLDivElement>>;
${extra}`);
  return {consumer,close:()=>rmSync(consumer,{recursive:true,force:true})};
}

function cssBarrel(consumer:string,imports="import './tokens.css';"){
  const installed=path.join(consumer,'node_modules',...PACKAGE.split('/'));
  const pkg=JSON.parse(readFileSync(path.join(installed,'package.json'),'utf8'));
  pkg.types='./dist/index.d.ts';pkg.exports['.'].types='./dist/index.d.ts';
  writeFileSync(path.join(installed,'package.json'),JSON.stringify(pkg));
  writeFileSync(path.join(installed,'dist/index.d.ts'),`${imports}\nexport * from './Control/Control';\n`);
  return path.join(installed,'dist/tokens.css');
}

test('real installed side-effect CSS qualifies without weakening Boolean prop types',async()=>{
  for(const type of ['boolean','string','boolean | string']){
    const f=fixture(type);try{
      const css=cssBarrel(f.consumer);writeFileSync(css,':root { --token: red; }');
      assert.equal(await installedBooleanChildren(f.consumer,PACKAGE,'Control'),type==='boolean',type);
      assert.equal(readFileSync(css,'utf8'),':root { --token: red; }','the installed asset is not rewritten');
    }finally{f.close();}
  }
});

test('CSS typing retains missing-asset, value-import, and unrelated declaration refusals',async()=>{
  const missing=fixture('boolean');try{
    cssBarrel(missing.consumer);
    await assert.rejects(installedBooleanChildren(missing.consumer,PACKAGE,'Control'),/children-type-check-unqualified: .*TS2882/);
  }finally{missing.close();}
  const nonCss=fixture('boolean');try{
    const css=cssBarrel(nonCss.consumer,"import './tokens.png';");writeFileSync(css.replace(/\.css$/,'.png'),'actual bytes');
    await assert.rejects(installedBooleanChildren(nonCss.consumer,PACKAGE,'Control'),/children-type-check-unqualified: .*TS2882/);
  }finally{nonCss.close();}
  const value=fixture('boolean');try{
    const css=cssBarrel(value.consumer,"import { classes } from './tokens.css';\nexport { classes };");writeFileSync(css,'.control{}');
    await assert.rejects(installedBooleanChildren(value.consumer,PACKAGE,'Control'),/children-type-check-unqualified: .*TS2305/);
  }finally{value.close();}
  const broken=fixture('boolean','export declare const broken: MissingType;');try{
    writeFileSync(cssBarrel(broken.consumer),'.control{}');
    await assert.rejects(installedBooleanChildren(broken.consumer,PACKAGE,'Control'),/children-type-check-unqualified: .*TS2304/);
  }finally{broken.close();}
});

test('CSS outside the installed package cannot supply its virtual declaration',async()=>{
  const f=fixture('boolean');try{
    const css=cssBarrel(f.consumer);const outside=path.join(f.consumer,'outside.css');
    writeFileSync(outside,'.control{}');symlinkSync(outside,css);
    await assert.rejects(installedBooleanChildren(f.consumer,PACKAGE,'Control'),/children-type-check-unqualified: .*TS2882/);
  }finally{f.close();}
});

test('a symlinked consumer uses the installed package canonical CSS boundary',async()=>{
  const f=fixture('boolean');try{
    writeFileSync(cssBarrel(f.consumer),'.control{}');
    const linked=path.join(f.consumer,'linked-consumer');symlinkSync(f.consumer,linked,'dir');
    assert.equal(await installedBooleanChildren(linked,PACKAGE,'Control'),true);
  }finally{f.close();}
});

test('a string overload hidden by the last Boolean signature cannot bypass the runtime marker',async()=>{
  const f=fixture('boolean');try{
    const file=path.join(f.consumer,'node_modules',...PACKAGE.split('/'),'dist/Control/Control.d.ts');
    writeFileSync(file,`import type {ReactElement} from 'react';
export declare function Control(props:{children?: string}): ReactElement;
export declare function Control(props:{children?: boolean}): ReactElement;
`);
    assert.equal(await installedBooleanChildren(f.consumer,PACKAGE,'Control'),false);
    writeFileSync(file,`import type {ReactElement} from 'react';
export declare function Control(props:{mode:'text';children?: string}): ReactElement;
export declare function Control(props:{mode:'flag';children?: boolean}): ReactElement;
`);
    assert.equal(await installedBooleanChildren(f.consumer,PACKAGE,'Control'),false,'different required props cannot hide an overload either');
  }finally{f.close();}
});

test('the installed Boolean API accepts both Boolean values and rejects the marker string',async()=>{
  const f=fixture('boolean');try{
    assert.equal(await installedBooleanChildren(f.consumer,PACKAGE,'Control'),true);
  }finally{f.close();}
});

test('string, any, a Boolean literal, and widened Boolean APIs cannot qualify as Boolean children',async()=>{
  for(const type of ['string','any','true','boolean | string']){
    const f=fixture(type);try{
      assert.equal(await installedBooleanChildren(f.consumer,PACKAGE,'Control'),false,type);
    }finally{f.close();}
  }
});

test('unrelated declaration and package import failures cannot be mistaken for marker rejection',async()=>{
  const broken=fixture('boolean','export declare const broken: MissingType;');try{
    await assert.rejects(installedBooleanChildren(broken.consumer,PACKAGE,'Control'),/children-type-check-unqualified: .*TS2304/);
  }finally{broken.close();}
  const missing=fixture('boolean');try{
    await assert.rejects(installedBooleanChildren(missing.consumer,'@consumer/missing','Control'),/children-type-check-unqualified: .*TS2307/);
  }finally{missing.close();}
});

test('Boolean children retain original cells; wrongly typed APIs still receive the runtime marker',async()=>{
  const browser=await chromium.launch({headless:true});try{
    const page=await browser.newPage();
    await page.setContent('<div data-cell="yes">Original yes</div><div data-cell="no">Original no</div>');
    await page.evaluate('window.calls=[];window.__consumer={setVariantOverride:(props)=>{window.calls.push(props)}}');
    const good=fixture('boolean');try{
      const receipt=await probeConsumerChildren(page,booleanContract,good.consumer,PACKAGE,'Control',['yes','no']);
      assert.deepEqual(receipt,{contractDeclaresSlot:false,renderedAtRuntime:false,refusedByType:true});
      assert.deepEqual(consumerChildrenProblems(receipt),[]);
      assert.deepEqual(await page.evaluate(()=>(window as any).calls),[]);
      assert.equal(await page.locator('[data-cell="yes"]').innerText(),'Original yes');
      assert.equal(await page.locator('[data-cell="no"]').innerText(),'Original no');
    }finally{good.close();}
    for(const type of ['string','any']){
      await page.evaluate(()=>(window as any).calls=[]);
      const bad=fixture(type);try{
        const receipt=await probeConsumerChildren(page,booleanContract,bad.consumer,PACKAGE,'Control',['yes','no']);
        assert.equal(receipt.refusedByType,false);
        assert.deepEqual(consumerChildrenProblems(receipt),['children-accepted-but-discarded']);
        assert.deepEqual(await page.evaluate(()=>(window as any).calls),[{children:'Consumer child content'},null]);
      }finally{bad.close();}
    }
  }finally{await browser.close();}
});

test('declared children slots and ordinary inherited children still obey the original runtime rules',async()=>{
  const browser=await chromium.launch({headless:true});try{
    const page=await browser.newPage();
    await page.setContent('<div data-cell="a">Original</div>');
    await page.evaluate('window.__consumer={setVariantOverride:()=>{}}');
    const f=fixture('boolean');try{
      const slot={...booleanContract,anatomy:{root:{parts:{body:{slot:{name:'children'}}}}}};
      const receipt=await probeConsumerChildren(page,slot,f.consumer,PACKAGE,'Control',['a']);
      assert.deepEqual(consumerChildrenProblems(receipt),['children-slot-discarded'],'even a Boolean annotation cannot skip a real slot probe');
    }finally{f.close();}
    const inherited=fixture("import('react').ReactNode");try{
      const contract={props:[],anatomy:{root:{}}};
      const receipt=await probeConsumerChildren(page,contract,inherited.consumer,PACKAGE,'Control',['a']);
      assert.deepEqual(consumerChildrenProblems(receipt),['children-accepted-but-discarded']);
      await page.evaluate("window.__consumer={setVariantOverride:(props)=>{document.querySelector('[data-cell]').textContent=props?.children??'Original'}}");
      const shown=await probeConsumerChildren(page,contract,inherited.consumer,PACKAGE,'Control',['a']);
      assert.equal(shown.renderedAtRuntime,true);
      assert.deepEqual(consumerChildrenProblems(shown),[]);
    }finally{inherited.close();}
  }finally{await browser.close();}
});
