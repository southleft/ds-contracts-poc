import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {build} from 'esbuild';
import {canonical,hash,contractFromCapture} from './surface.mjs';
import {resolveBundle,resolved,seal} from './model.mjs';

export function inspectProfile(P,root){
 assert.equal(P.version,1,'unsupported roundtrip profile');
 for(const key of ['system','component','appearance','tokens','dependencies','instances','capture','figma'])assert(P[key],'missing profile field: '+key);
 assert(P.appearance.variants.length>0&&P.appearance.variants.length<=128,'invalid declared variants');
 assert(/^[A-Za-z_$][\w$]*$/.test(P.component.export),'invalid component export');
 for(const v of P.appearance.variants)assert(/^[\w-]+$/.test(v.key),'invalid variant key');
 assert(existsSync(path.resolve(root,P.capture.font.file)),'missing font: '+P.capture.font.family);
 const local=p=>path.resolve(root,p),read=p=>readFileSync(local(p),'utf8'),tokens={};
 for(const [id,p]of Object.entries(P.tokens)){
  assert(['primitive','semantic','component'].includes(p.tier),'invalid token tier: '+id);
  let value=JSON.parse(read(p.file)),type;
  for(const k of id.split('.')){type=value.$type??value.type??type;value=value[k];assert(value,'missing token: '+id);}
  type=value.$type??value.type??type;assert.equal(type,'color','unsupported token type: '+id);
  const field=p.field??'$value',literal=value[field];assert.equal(typeof literal,'string');const alias=literal.match(/^\{(.+)\}$/);
  tokens[id]={id,tier:p.tier,role:p.role??p.tier,type,scopes:p.scopes??[],css:p.css??'--'+id.replaceAll('.','-'),...(alias?{alias:alias[1]}:{value:literal.toLowerCase()}),source:{file:p.file,path:[...id.split('.'),field],sha256:hash(read(p.file))}};
 }
 const components={};for(const [id,d]of Object.entries(P.dependencies)){assert(d.selector,'missing dependency selector: '+id);if(d.export)assert(/^[A-Za-z_$][\w$]*$/.test(d.export),'invalid dependency export');components[id]={id,name:d.name,kind:'svg',source:{path:d.source,sha256:hash(read(d.source))},svg:'',viewport:'',inputs:{color:'currentColor'},requires:[]};}
 const parent={id:P.component.id,name:P.component.name,kind:'component',source:{path:P.source,sha256:hash(read(P.source))},requires:Object.keys(components).map(id=>({id,revision:''})),instances:P.instances,codeOnly:P.codeOnly??[]};components[parent.id]=parent;
 for(const dep of Object.values(P.instances))assert(components[dep.component],'missing-component-contract: '+dep.component);
 const B=seal({contract:'system-aware/0.1',root:parent.id,system:{...P.system,architecture:P.architecture,tokens},components});
 for(const d of parent.requires)d.revision=components[d.id].revision;seal(B);
 const graph=resolveBundle(B);assert.equal(graph.status,'ready',JSON.stringify(graph.gaps));return B;
}

function observe({P,variant}){
 const num=s=>parseFloat(s)||0,color=s=>{const n=s.match(/[\d.]+/g)?.map(Number);if(!n||n[3]===0)return null;if(n[3]!=null&&n[3]!==1)throw Error('unsupported translucent paint');return '#'+n.slice(0,3).map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');},parts={},assets={};
 for(const [id,p]of Object.entries(P.appearance.parts)){
  const matches=document.querySelectorAll(p.selector);if(matches.length!==1)throw Error('ambiguous part: '+id);const n=matches[0],s=getComputedStyle(n);let r=n.getBoundingClientRect(),text=n.textContent;
  if(p.textNode){const nodes=[...n.childNodes].filter(x=>x.nodeType===3&&x.textContent.trim());if(nodes.length!==1)throw Error('ambiguous text: '+id);const range=document.createRange();range.selectNodeContents(nodes[0]);r=range.getBoundingClientRect();text=nodes[0].textContent;}
  if(s.transform!=='none'||s.filter!=='none'||s.backgroundImage!=='none'||s.textShadow!=='none')throw Error('unsupported CSS effect: '+id);
  const styles={visible:s.display!=='none',opacity:num(s.opacity),width:r.width,height:p.textNode?num(s.lineHeight):r.height,'width-sizing':p.sizing[0],'height-sizing':p.sizing[1]};
  if(p.kind==='text'){if(!['left','start'].includes(s.textAlign)||s.textTransform!=='none'||s.textDecorationLine!=='none'||s.position==='absolute'||s.fontFamily.split(',')[0].replace(/["']/g,'').trim()!==P.capture.font.family||!P.capture.font.styles[s.fontWeight])throw Error('unsupported typography: '+id);Object.assign(styles,{text,'font-family':P.capture.font.family,'font-style':P.capture.font.styles[s.fontWeight],'font-weight':num(s.fontWeight),'font-size':num(s.fontSize),'line-height':s.lineHeight==='normal'?r.height:num(s.lineHeight),'letter-spacing':num(s.letterSpacing),color:color(s.color),'text-align':'left','text-case':'original','text-decoration':'none',positioning:'flow'});}
  else {if(!['flex','inline-flex'].includes(s.display))throw Error('unsupported layout: '+id);if(!['row','column'].includes(s.flexDirection)||!['normal','flex-start','start','center'].includes(s.justifyContent)||!['normal','stretch','flex-start','start','center'].includes(s.alignItems)||s.flexWrap!=='nowrap'||s.position==='absolute'||s.boxShadow!=='none')throw Error('unsupported structure: '+id);Object.assign(styles,{layout:s.flexDirection==='column'?'column':'row',gap:num(s.gap),padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft].map(num),radius:num(s.borderTopLeftRadius),fill:color(s.backgroundColor),clip:['hidden','clip'].includes(s.overflow),'align-main':s.justifyContent==='center'?'center':'start','align-cross':s.alignItems==='center'?'center':'start',shadow:[],stroke:num(s.borderTopWidth)?color(s.borderTopColor):null,'stroke-width':num(s.borderTopWidth)||null,'stroke-align':num(s.borderTopWidth)?'inside':null,'stroke-in-layout':!!num(s.borderTopWidth)});}
  parts[id]={styles,tokens:p.bindings??{}};
 }
 for(const [id,d]of Object.entries(P.dependencies)){const svg=document.querySelector(d.selector);if(!svg||svg.tagName.toLowerCase()!=='svg')throw Error('missing rendered dependency: '+id);const clone=svg.cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');assets[id]={svg:clone.outerHTML,viewport:svg.getAttribute('viewBox')};}
 return {key:variant.key,axes:variant.axes,parts,assets};
}

export async function capture(P,root,out,reader){
 const B=inspectProfile(P,root),read=p=>readFileSync(path.resolve(root,p),'utf8');mkdirSync(out,{recursive:true});
 const inputs=[...new Set([P.source,P.story,P.stylesheet,P.capture.font.file,...Object.values(P.tokens).map(t=>t.file),...Object.values(P.dependencies).map(d=>d.source),...(P.capture.inputs??[])].filter(Boolean))].map(file=>({file:path.resolve(root,file),sha256:hash(read(file))}));
 for(const step of P.capture.build??[]){const args=step.args.map(a=>a.replaceAll('$OUT',out));execFileSync(step.command,args,{cwd:root,stdio:'pipe'});}
 const depImports=Object.entries(P.dependencies).filter(([,d])=>d.export).map(([id,d],i)=>({id,...d,local:'Dependency'+i}));
 const imports=depImports.map(d=>`import {${d.export} as ${d.local}} from ${JSON.stringify(path.resolve(root,d.source))};`).join('');
 const props=depImports.flatMap(d=>(d.props??[]).map(p=>JSON.stringify(p)+':React.createElement('+d.local+')')).join(',');
 const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {${P.component.export} as Component} from ${JSON.stringify(path.resolve(root,P.source))};${imports}const root=createRoot(document.getElementById('subject'));let key=0;window.render=(p={})=>root.render(React.createElement(Component,{key:++key,...${JSON.stringify(P.capture.props??{})},${props}${props?',':''}...p}));window.render();`;
 const built=await build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},bundle:true,write:false,outfile:'browser.js',format:'iife',platform:'browser',metafile:true});
 for(const file of Object.keys(built.metafile.inputs).filter(f=>f!=='<stdin>')){const full=path.resolve(file);if(!inputs.some(g=>g.file===full))inputs.push({file:full,sha256:hash(read(full))});}
 const js=built.outputFiles.find(f=>f.path.endsWith('.js')).text,css=built.outputFiles.find(f=>f.path.endsWith('.css'))?.text??'',font=readFileSync(path.resolve(root,P.capture.font.file)).toString('base64');
 const sheets=(P.capture.styles??[]).map(p=>read(p.replaceAll('$OUT',out))).join('\n');
 const html=`<!doctype html><html><head><style>@font-face{font-family:${JSON.stringify(P.capture.font.family)};src:url(data:font/woff2;base64,${font});font-weight:100 900;font-style:normal}body{background:white;padding:40px}#subject{width:${P.capture.width??280}px}${P.capture.contextCSS??''}</style><style>${sheets}\n${css}</style></head><body><div id="subject"></div><script>${js}</script></body></html>`;
 const pinned=await reader.pinnedBrowser();try{
  const {clock,randomSeed,...options}=reader.PAGE,context=await pinned.browser.newContext(options),page=await context.newPage();await page.clock.setFixedTime(new Date(clock));await page.setContent(html);await page.addScriptTag({content:'window.__name=(f)=>f;'});
  await page.evaluate(async family=>{await document.fonts.load('500 14px '+JSON.stringify(family));if(!document.fonts.check('500 14px '+JSON.stringify(family)))throw Error('missing font: '+family);},P.capture.font.family);
  const capture={variants:[],assets:{},gaps:[]};for(const variant of P.appearance.variants){await page.evaluate(p=>window.render(p),variant.props??{});await page.waitForTimeout(100);const v=await page.evaluate(observe,{P,variant});if(capture.variants.length)assert.equal(canonical(v.assets),canonical(capture.assets),'variant-dependent SVG requires separate dependencies');capture.assets=v.assets;delete v.assets;capture.variants.push(v);await page.locator(P.appearance.parts.root.selector).screenshot({path:path.join(out,variant.key+'.png')});}
  const appearance=contractFromCapture(P.appearance,capture,{kind:'code-capture',path:'capture.json',sha256:hash(capture),pairing:{path:'profile.json',sha256:hash(P)},storybook:{url:P.story,indexSha256:hash(read(P.story))}});
  for(const [id,asset]of Object.entries(capture.assets))Object.assign(B.components[id],asset);seal(B);const parent=B.components[B.root];for(const d of parent.requires)d.revision=B.components[d.id].revision;parent.appearance=appearance;seal(B);
  for(const v of capture.variants)for(const part of Object.values(v.parts))for(const [field,id]of Object.entries(part.tokens))assert.equal(part.styles[field],resolved(B,id),'binding does not resolve to rendered value: '+id);
  for(const g of inputs)assert.equal(hash(read(g.file)),g.sha256,'source changed during capture: '+g.file);
  for(const [file,value]of Object.entries({'capture.json':capture,'bundle.json':B,'environment.json':pinned.environment,'build-inputs.json':Object.keys(built.metafile.inputs),'source-inputs.json':inputs}))writeFileSync(path.join(out,file),canonical(value));
  writeFileSync(path.join(out,'preview.html'),html);return B;
 }finally{await pinned.browser.close();pinned.stop();}
}
