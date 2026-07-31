/** CANVAS→CODE FIDELITY SCORE v1.1 — the demo-bar number.
 *  Per per-variant canvas reference: derive props from the variant slug via
 *  the contract's enums/booleans (alnum-normalized), render the generated
 *  component standalone, normalize both images to a common 200px box in a
 *  headless page, pixel-diff. Unknown axes (dropped by the inversion, e.g.
 *  theme/state) are consumed generically: canonical-slice variants score,
 *  the rest count as axis-not-carried — the carriage debt as a column. */
const ROOT='/Users/tjpitre/Sites/ds-contracts-poc';
const { chromium } = await import(ROOT+'/node_modules/playwright-core/index.mjs');
const { chromiumExecutable } = await import(ROOT+'/extract/figma/visual-parity/render.js');
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const UI=`${ROOT}/examples/untitled-ui`;
const SCRATCH=process.env.SCRATCH || '/tmp';
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'');
const SETS: Record<string,{comp:string}> = {
  'badge-base':{comp:'BadgeBase'}, 'button-base':{comp:'ButtonBase'},
  'toggle-base':{comp:'ToggleBase'}, 'dropdown-list-item':{comp:'DropdownListItem'},
  'input-field-base':{comp:'InputFieldBase'}, 'avatar-group':{comp:'AvatarGroup'},
  'tooltip':{comp:'Tooltip'},
  'slider':{comp:'Slider'}, 'progress-bar':{comp:'ProgressBar'}, 'progress-circle':{comp:'ProgressCircle'},
};
type Row={set:string,variant:string,score:number|null,note?:string};
const results: Row[] = [];
const b = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
const page = await b.newPage();
for (const [slug,{comp}] of Object.entries(SETS)) {
  const contract = JSON.parse(readFileSync(`${UI}/storybook/contracts/${slug}.contract.json`,'utf8'));
  const enums: Record<string,string[]> = {}; const bools: string[] = [];
  for (const p of contract.props ?? []) {
    if (p.type && typeof p.type==='object' && 'enum' in p.type) enums[p.name]=p.type.enum;
    else if (p.type==='boolean') bools.push(p.name);
  }
  const refs = readdirSync(`${UI}/references`).filter(f=>f.startsWith(`var--${slug}--`));
  for (const ref of refs) {
    const varslug = ref.slice(`var--${slug}--`.length, -4);
    const toks = varslug.split('_');
    const props: Record<string,unknown> = {}; let ok=true;
    const droppedPairs: string[] = [];
    let i=0;
    while (i<toks.length) {
      let bound=false;
      for (let take=Math.min(4,toks.length-i); take>=1 && !bound; take--) {
        const axisTok=norm(toks.slice(i,i+take).join(''));
        for (const [name,vals] of Object.entries(enums)) {
          if (norm(name)!==axisTok) continue;
          for (let vt=Math.min(4,toks.length-i-take); vt>=1; vt--) {
            const valTok=norm(toks.slice(i+take,i+take+vt).join(''));
            const hit=vals.find(v=>norm(v)===valTok);
            if (hit!==undefined){ props[name]=hit; i+=take+vt; bound=true; break; }
          }
          if (bound) break;
        }
        if (!bound) {
          const bname=bools.find(bn=>norm(bn)===axisTok);
          if (bname && i+take<toks.length) {
            const v=norm(toks[i+take]);
            if (v==='true'||v==='false'){ props[bname]=v==='true'; i+=take+1; bound=true; }
          }
        }
      }
      if (!bound && i+1<toks.length) { droppedPairs.push(toks[i]+'='+norm(toks[i+1])); i+=2; bound=true; }
      if (!bound){ ok=false; break; }
    }
    const CANON=['default','light','false'];
    const nonCanon=droppedPairs.filter(d=>!CANON.includes(d.split('=')[1]));
    if (nonCanon.length>0){ results.push({set:slug,variant:varslug,score:null,note:'axis not carried: '+nonCanon.join(',')}); continue; }
    if (!ok){ results.push({set:slug,variant:varslug,score:null,note:'slug→props unmapped'}); continue; }
    const out=`fid--${slug}--${varslug}`;
    try {
      execFileSync('npx',['tsx',`${SCRATCH}/render-one.mts`,comp,JSON.stringify(props),out],{cwd:ROOT,env:{...process.env,SCRATCH},stdio:'pipe',timeout:60000});
    } catch(e){ results.push({set:slug,variant:varslug,score:null,note:'render failed'}); continue; }
    const rp=`${UI}/renders/${out}.png`;
    if(!existsSync(rp)){ results.push({set:slug,variant:varslug,score:null,note:'no render'}); continue; }
    const refB=readFileSync(`${UI}/references/${ref}`).toString('base64');
    const renB=readFileSync(rp).toString('base64');
    const score=await page.evaluate(`(async () => {
      const a = ${JSON.stringify(refB)}, c = ${JSON.stringify(renB)};
      const load=(b64)=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src='data:image/png;base64,'+b64;});
      const [ia,ic]=await Promise.all([load(a),load(c)]);
      const W=200,H=Math.max(40,Math.round(200*(ia.height/ia.width)));
      const draw=(im)=>{const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,H);
        const sc=Math.min(W/im.width,H/im.height);const w=im.width*sc,h=im.height*sc;g.drawImage(im,(W-w)/2,(H-h)/2,w,h);return g.getImageData(0,0,W,H).data;};
      const da=draw(ia),dc=draw(ic);
      let bad=0,total=W*H;
      for(let p=0;p<da.length;p+=4){const d=Math.abs(da[p]-dc[p])+Math.abs(da[p+1]-dc[p+1])+Math.abs(da[p+2]-dc[p+2]);if(d>90)bad++;}
      return Math.round(10000*(1-bad/total))/100;
    })()`) as number;
    results.push({set:slug,variant:varslug,score});
  }
}
await b.close();
const bySet: Record<string,{n:number,sum:number,unmapped:number,axisGap:number}> = {};
for(const r of results){
  const s=bySet[r.set]??={n:0,sum:0,unmapped:0,axisGap:0};
  if(r.score===null){ if((r.note||'').startsWith('axis not carried')) s.axisGap++; else s.unmapped++; continue; }
  s.n++; s.sum+=r.score;
}
const lines=['| component | variants scored | mean fidelity % | axis-not-carried | unscored |','|---|---|---|---|---|'];
let gn=0,gs=0;
for(const [k,v] of Object.entries(bySet)){ if(v.n){gn+=v.n;gs+=v.sum;} lines.push(`| ${k} | ${v.n} | ${v.n?(v.sum/v.n).toFixed(1):'—'} | ${v.axisGap} | ${v.unmapped} |`); }
lines.push(`| **ALL** | ${gn} | **${gn?(gs/gn).toFixed(1):'—'}** | | |`);
writeFileSync(`${UI}/renders/FIDELITY.md`, `# Canvas→code fidelity — ${new Date().toISOString().slice(0,10)} @ HEAD\n\nScore = % pixels within tolerance, both images normalized to a common 200px box (canvas ref up to 2x export vs standalone render). v1.1: unknown axes consumed generically; axis-not-carried counts variants unrenderable because the inversion dropped their axis. Trend metric, not the final gate.\n\n${lines.join('\n')}\n`);
writeFileSync(`${UI}/renders/fidelity.json`, JSON.stringify(results,null,1));
console.log(lines.join('\n'));
