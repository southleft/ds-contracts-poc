/** CANVAS→CODE FIDELITY SCORE v2.1 — the demo-bar number.
 *
 *  v2.1 REPLACES THE COMPARISON GEOMETRY. v1.3–v2.0 content-TRIMMED both
 *  images to their ink and rescaled each into a common 200px box, which made
 *  the instrument blind in two MEASURED ways:
 *    (a) PURE TRANSLATION IS INVISIBLE (round 5) — the progress bar's track
 *        shrank to 112px and slid 208px right, a real defect; hand-patching it
 *        moved the score by exactly 0.00, because the trim discards absolute
 *        position and the rescale normalizes size away.
 *    (b) REMOVING A WRONG FULL-BLEED PAINT LOWERED THE SCORE (round 6) —
 *        #efefef vs #ffffff is 16 per channel, under v2.0's 90-summed-channel
 *        threshold, so a wrong gray ground scored as MATCHING while inflating
 *        the trim box; deleting it shrank the box to an 11px text run that the
 *        200px normalization magnified ~4x, dropping six rows by up to 17
 *        points for a strictly-correct render.
 *  v2.1 scores at the REFERENCE'S OWN SCALE with the two ROOT BOXES anchored:
 *    1. TRUE SCALE. The canvas export scale is not recorded, so it is DERIVED:
 *       s = min(2, 600 / bbox.width) — the shooter's rule, recovered from the
 *       committed pair (dumps-v2 variant bbox, reference PNG dimensions) and
 *       VERIFIED over all 595 references that have a dump variant: under this
 *       rule not one reference is SMALLER than the box it draws (Figma never
 *       trims a node's own box, so a negative overflow would falsify it), and
 *       every residual is an explainable positive: 0 for the plain sets, 4/8px
 *       for focus rings, 24px for tooltip shadow, 56–70px for floating value
 *       tooltips. The reference is resampled to its own true box (rw/s, rh/s);
 *       the render is used at 1:1 — neither is normalized to a common size, so
 *       a component drawn at the wrong SIZE now scores as wrong.
 *    2. ROOT ANCHOR. The render's root border box is reported by render-one on
 *       stdout (the PNG bytes are untouched). Inside the reference, the root's
 *       origin is the export's overflow split in the direction the render's own
 *       ink overflows its root box (even split when it does not overflow) — so
 *       a symmetric ring/shadow centres, a one-sided floating tooltip does not.
 *       Absolute position is measured, not discarded.
 *    3. TOLERANCE. A reference pixel is REPRODUCED when some pixel within its
 *       3x3 neighbourhood in the render is within 10 per CHANNEL (v2.0: 90
 *       summed over three channels, i.e. up to 30/channel — which is why a
 *       whole wrong gray ground counted as a match). The 3x3 escape is what
 *       makes the tight threshold usable: it forgives Figma-vs-Chrome
 *       rasterisation jitter of up to a pixel, and nothing larger.
 *  WHAT v2.1 DELIBERATELY IGNORES, stated so it is not mistaken for coverage:
 *    · sub-pixel and 1px placement error (the 3x3 escape, by design);
 *    · the component's position on the page — only the root box is anchored,
 *      so a uniform translation of the whole drawing is not visible (it is not
 *      a property of a standalone component render);
 *    · ink the render paints outside the union of the reference box and its
 *      own ink extent — there is no such region by construction;
 *    · effect ink beyond the render clip's 8px margin: the render PNG is
 *      unchanged from v2.0, so a shadow the canvas draws further out than 8px
 *      (measured worst case: tooltip, 12px/side) is missing from the render and
 *      scores as missing. Named, not fixed, this round — fixing it changes the
 *      committed render bytes, which would make the metric change unattributable.
 *  Both tables are produced by ONE run over the SAME renders: the v2.0 score is
 *  computed verbatim beside the v2.1 score, so the shift between the tables is
 *  attributable to the metric and to nothing else.
 *
 *  v2.0: the RENDER CLIP is the union bounding box of the root and all its
 *  visible descendants (render-one.mts, FIDELITY_CLIP=union — the default),
 *  not the root's border box. Under v1.3 every absolutely-positioned overflow
 *  — the slider's and progress bar's floating value tooltips, a badge hanging
 *  off a corner, any popover — was cropped out of the screenshot before the
 *  comparison, so a variant that drew it CORRECTLY was scored against a
 *  reference that shows it and a render that cannot. The metric was punishing
 *  correctness. The union clip makes the screenshot and the canvas reference
 *  cover the same content; the v1.3 content-trim + 200px normalization run
 *  unchanged AFTER it, which is also why over-inclusion is safe (surplus white
 *  is trimmed; ink destroyed at render time is gone for good).
 *  v2.0 CHANGES THE DENOMINATOR of every number in this table. Run with
 *  FIDELITY_CLIP=root to reproduce the v1.3 harness exactly (root border box,
 *  16px page gutter, 900x700 viewport) — that run writes fidelity-v13.json.
 *  v1.3: both images TRIM to content before the 200px normalization —
 *  margin/aspect mismatch between ref exports and standalone renders
 *  misaligned the whole comparison (any honest ink scored negative).
 *  Per per-variant canvas reference: derive props from the variant slug via
 *  the contract's enums/booleans (alnum-normalized), render the generated
 *  component standalone, normalize both images to a common 200px box in a
 *  headless page, pixel-diff. Unknown axes (dropped by the inversion) are
 *  consumed generically: canonical-slice variants score, the rest count as
 *  axis-not-carried — the carriage debt as a column. v1.2 honesty split:
 *  `state=disabled` maps onto the contract's `disabled` boolean (state
 *  promotion carries it as a prop, so it IS statically scorable);
 *  `state=hover|focus` refs are their own interaction-state category (the
 *  carriage is CSS pseudo-class rules — real, but not reachable by a static
 *  screenshot), NOT axis-not-carried; the debt column therefore counts only
 *  genuine carriage losses. */
const ROOT='/Users/tjpitre/Sites/ds-contracts-poc';
const { chromium } = await import(ROOT+'/node_modules/playwright-core/index.mjs');
const { chromiumExecutable } = await import(ROOT+'/extract/figma/visual-parity/render.js');
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const UI=`${ROOT}/examples/untitled-ui`;
const SCRATCH=process.env.SCRATCH || '/tmp';
const CLIP=process.env.FIDELITY_CLIP === 'root' ? 'root' : 'union';
// The renderer lives next to this file (committed pair); SCRATCH copies stay
// usable through RENDER_ONE.
const RENDER_ONE=process.env.RENDER_ONE || path.join(path.dirname(fileURLToPath(import.meta.url)), 'render-one.mts');
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'');
const SETS: Record<string,{comp:string}> = {
  'badge-base':{comp:'BadgeBase'}, 'button-base':{comp:'ButtonBase'},
  'toggle-base':{comp:'ToggleBase'}, 'dropdown-list-item':{comp:'DropdownListItem'},
  'input-field-base':{comp:'InputFieldBase'}, 'avatar-group':{comp:'AvatarGroup'},
  'tooltip':{comp:'Tooltip'},
  'slider':{comp:'Slider'}, 'progress-bar':{comp:'ProgressBar'}, 'progress-circle':{comp:'ProgressCircle'},
  'avatar':{comp:'Avatar'}, 'avatar-label-group':{comp:'AvatarLabelGroup'}, 'avatar-add-button':{comp:'AvatarAddButton'},
  'button-group-base':{comp:'ButtonGroupBase'}, 'social-button':{comp:'SocialButton'},
};
// FIDELITY_ONLY=tooltip,slider restricts the run to those sets (per-lever
// measurement); the table it prints is then a SLICE, never the demo-bar number.
const ONLY=(process.env.FIDELITY_ONLY ?? '').split(',').map(s=>s.trim()).filter(Boolean);
// v2.1 — THE TRUE CANVAS BOX per variant, read out of the committed dumps.
// Set name → slug is the pipeline's own naming ('_Badge base' → badge-base);
// variant name → slug is the reference shooter's ('Progress=0%, Label=False' →
// progress_0_label_false: lowercase, every non-alphanumeric run to '_', no
// trimming — a trailing '%' leaves a trailing '_', which the filenames show).
const kebabSet=(s:string)=>s.replace(/^_/,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const varSlug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'_');
const DRAWN=new Map<string,{width:number,height:number}>();
for (const f of readdirSync(`${UI}/dumps-v2`).filter(f=>f.endsWith('.dump.json') && f!=='MERGED.dump.json')) {
  const d=JSON.parse(readFileSync(`${UI}/dumps-v2/${f}`,'utf8')) as Record<string,unknown>;
  for (const [name,value] of Object.entries(d)) {
    const set=value as {variants?:Array<{name:string,bbox?:{width:number,height:number}}>};
    if (!set || typeof set!=='object' || !Array.isArray(set.variants)) continue;
    for (const v of set.variants) if (v.bbox) DRAWN.set(`${kebabSet(name)}--${varSlug(v.name)}`, v.bbox);
  }
}
type Row={set:string,variant:string,score:number|null,score20?:number|null,note?:string};
const results: Row[] = [];
const b = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
const page = await b.newPage();
for (const [slug,{comp}] of Object.entries(SETS)) {
  if (ONLY.length && !ONLY.includes(slug)) continue;
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
    const droppedPairs: string[] = []; let interaction=false;
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
      // v1.2: the promoted state axis. `disabled` rides the contract's
      // disabled boolean (statically scorable); hover/focus are CSS-rendered
      // interaction states — their own category, never axis-not-carried.
      if (!bound && i+1<toks.length && norm(toks[i])==='state') {
        const sv=norm(toks[i+1]);
        if (sv==='disabled' && bools.includes('disabled')) { props['disabled']=true; i+=2; bound=true; }
        else if (sv==='hover'||sv==='focus') { interaction=true; i+=2; bound=true; }
      }
      if (!bound && i+1<toks.length) { droppedPairs.push(toks[i]+'='+norm(toks[i+1])); i+=2; bound=true; }
      if (!bound){ ok=false; break; }
    }
    const CANON=['default','light','false'];
    const nonCanon=droppedPairs.filter(d=>!CANON.includes(d.split('=')[1]));
    if (nonCanon.length>0){ results.push({set:slug,variant:varslug,score:null,note:'axis not carried: '+nonCanon.join(',')}); continue; }
    if (interaction){ results.push({set:slug,variant:varslug,score:null,note:'interaction-state (CSS-rendered, not statically scorable)'}); continue; }
    if (!ok){ results.push({set:slug,variant:varslug,score:null,note:'slug→props unmapped'}); continue; }
    const out=`fid--${slug}--${varslug}`;
    let geom: {box?:{x:number,y:number},root?:{x:number,y:number,width:number,height:number}} = {};
    // Each variant launches its own chromium; under load a launch can fail
    // transiently, and an unscored row silently SHRINKS the denominator of
    // the whole table (measured: 41 rows lost to one concurrent job). One
    // retry, then the failure is recorded and visible in the count.
    let rendered=false, lastErr='';
    for (let attempt=0; attempt<2 && !rendered; attempt++) {
      try {
        const stdout=execFileSync('npx',['tsx',RENDER_ONE,comp,JSON.stringify(props),out],{cwd:ROOT,env:{...process.env,SCRATCH,FIDELITY_CLIP:CLIP},stdio:'pipe',timeout:60000}).toString();
        geom=JSON.parse(stdout.trim().split('\n').pop() || '{}');
        rendered=true;
      } catch(e){ lastErr=String((e as Error).message).slice(0,120); }
    }
    if(!rendered){ results.push({set:slug,variant:varslug,score:null,note:'render failed: '+lastErr}); continue; }
    const rp=`${UI}/renders/${out}.png`;
    if(!existsSync(rp)){ results.push({set:slug,variant:varslug,score:null,note:'no render'}); continue; }
    // v2.1 needs the DRAWN box (true scale) and the rendered root box; a
    // reference with no dump variant is unscorable at true scale — named,
    // never silently scored by a fallback that would fake a denominator.
    const drawn=DRAWN.get(`${slug}--${varslug}`);
    if(!drawn){ results.push({set:slug,variant:varslug,score:null,note:'no dump variant — true canvas box unknown'}); continue; }
    if(!geom.root || !geom.box){ results.push({set:slug,variant:varslug,score:null,note:'render reported no root box'}); continue; }
    const meta={ bw:drawn.width, bh:drawn.height, scale:Math.min(2, 600/drawn.width),
      rx:geom.root.x-geom.box.x, ry:geom.root.y-geom.box.y, rw:geom.root.width, rh:geom.root.height };
    const refB=readFileSync(`${UI}/references/${ref}`).toString('base64');
    const renB=readFileSync(rp).toString('base64');
    const scores=await page.evaluate(`(async () => {
      const a = ${JSON.stringify(refB)}, c = ${JSON.stringify(renB)}, M = ${JSON.stringify(meta)};
      const load=(b64)=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src='data:image/png;base64,'+b64;});
      const [ia,ic]=await Promise.all([load(a),load(c)]);
      // v1.3: TRIM to content before normalizing — the ref exports and the
      // standalone renders carry DIFFERENT margins, and contain-fit over
      // unequal margins misaligned every pixel (honest ink scored WORSE
      // than blank; measured on button-base circle icons).
      const bbox=(im)=>{const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;const g=cv.getContext('2d');
        g.fillStyle='#fff';g.fillRect(0,0,im.width,im.height);g.drawImage(im,0,0);
        const d=g.getImageData(0,0,im.width,im.height).data;let x0=im.width,y0=im.height,x1=-1,y1=-1;
        for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const p=(y*im.width+x)*4;
          if(d[p]<248||d[p+1]<248||d[p+2]<248){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
        return x1<0?{x:0,y:0,w:im.width,h:im.height}:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};};
      const ba=bbox(ia),bc=bbox(ic);
      const W=200,H=Math.max(40,Math.round(200*(ba.h/ba.w)));
      const draw=(im,b)=>{const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,H);
        const sc=Math.min(W/b.w,H/b.h);const w=b.w*sc,h=b.h*sc;g.drawImage(im,b.x,b.y,b.w,b.h,(W-w)/2,(H-h)/2,w,h);return g.getImageData(0,0,W,H).data;};
      const da=draw(ia,ba),dc=draw(ic,bc);
      let bad=0,total=W*H;
      for(let p=0;p<da.length;p+=4){const d=Math.abs(da[p]-dc[p])+Math.abs(da[p+1]-dc[p+1])+Math.abs(da[p+2]-dc[p+2]);if(d>90)bad++;}
      const v20=Math.round(10000*(1-bad/total))/100;

      // ——— v2.1: true scale, root-anchored, per-channel tolerance ———
      const px=(im,w,h,sx,sy,sw,sh)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;
        const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);
        if(im)g.drawImage(im,sx,sy,sw,sh,0,0,w,h);return g.getImageData(0,0,w,h);};
      const S=M.scale, RW=Math.round(ia.width/S), RH=Math.round(ia.height/S);
      const refTrue=px(ia,RW,RH,0,0,ia.width,ia.height);       // reference at its own true box
      const ren=px(ic,ic.width,ic.height,0,0,ic.width,ic.height); // render, 1:1, on white
      // the render's ink, and how far it overflows its own root box
      const inkOf=(d,w,h)=>{let x0=w,y0=h,x1=-1,y1=-1;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4;
          if(d[p]<248||d[p+1]<248||d[p+2]<248){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
        return x1<0?{x:0,y:0,w:w,h:h}:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};};
      const ink=inkOf(ren.data,ic.width,ic.height);
      const L=Math.max(0,M.rx-ink.x), R=Math.max(0,(ink.x+ink.w)-(M.rx+M.rw));
      const T=Math.max(0,M.ry-ink.y), B=Math.max(0,(ink.y+ink.h)-(M.ry+M.rh));
      const DX=RW-M.bw, DY=RH-M.bh;
      const ox=(L+R)>0?DX*L/(L+R):DX/2, oy=(T+B)>0?DY*T/(T+B):DY/2;
      // integer placement of the render PNG inside the reference's frame
      const dx=Math.round(ox-M.rx), dy=Math.round(oy-M.ry);
      // THE DENOMINATOR IS THE DRAWN AREA, not the frame: the union of the two
      // INK rectangles at their anchored positions. Scoring the reference's
      // whole box would pay for white-on-white agreement — a Figma variant
      // frame is mostly transparent (dropdown: ink is 23% of the box), so a
      // BLANK render would have scored ~77 on it.
      const rink=inkOf(refTrue.data,RW,RH);
      const fx0=Math.min(rink.x,dx+ink.x), fy0=Math.min(rink.y,dy+ink.y);
      const fx1=Math.max(rink.x+rink.w,dx+ink.x+ink.w), fy1=Math.max(rink.y+rink.h,dy+ink.y+ink.h);
      const FW=Math.min(4000,fx1-fx0), FH=Math.min(4000,fy1-fy0);
      const put=(src,sw,sh,atx,aty)=>{const o=new Uint8ClampedArray(FW*FH*4);o.fill(255);
        for(let y=0;y<sh;y++){const fy=y+aty;if(fy<0||fy>=FH)continue;
          for(let x=0;x<sw;x++){const fx=x+atx;if(fx<0||fx>=FW)continue;
            const s=(y*sw+x)*4,t=(fy*FW+fx)*4;o[t]=src[s];o[t+1]=src[s+1];o[t+2]=src[s+2];}}
        return o;};
      const FA=put(refTrue.data,RW,RH,-fx0,-fy0);
      const FB=put(ren.data,ic.width,ic.height,dx-fx0,dy-fy0);
      const TOL=10;
      let bad21=0;
      for(let y=0;y<FH;y++)for(let x=0;x<FW;x++){
        const p=(y*FW+x)*4;
        let best=1e9;
        for(let ny=Math.max(0,y-1);ny<=Math.min(FH-1,y+1)&&best>TOL;ny++)
          for(let nx=Math.max(0,x-1);nx<=Math.min(FW-1,x+1)&&best>TOL;nx++){
            const q=(ny*FW+nx)*4;
            const d=Math.max(Math.abs(FA[p]-FB[q]),Math.abs(FA[p+1]-FB[q+1]),Math.abs(FA[p+2]-FB[q+2]));
            if(d<best)best=d;
          }
        if(best>TOL)bad21++;
      }
      const v21=Math.round(10000*(1-bad21/(FW*FH)))/100;
      return {v20,v21,frame:[FW,FH],place:[dx,dy],scale:S};
    })()`) as {v20:number,v21:number,frame:number[],place:number[],scale:number};
    results.push({set:slug,variant:varslug,score:scores.v21,score20:scores.v20});
  }
}
await b.close();
const bySet: Record<string,{n:number,sum:number,sum20:number,unmapped:number,axisGap:number,interaction:number}> = {};
for(const r of results){
  const s=bySet[r.set]??={n:0,sum:0,sum20:0,unmapped:0,axisGap:0,interaction:0};
  if(r.score===null){
    if((r.note||'').startsWith('axis not carried')) s.axisGap++;
    else if((r.note||'').startsWith('interaction-state')) s.interaction++;
    else s.unmapped++;
    continue;
  }
  s.n++; s.sum+=r.score; s.sum20+=r.score20 ?? 0;
}
const HEAD='| component | variants scored | mean fidelity % | axis-not-carried | interaction-state | unscored |\n|---|---|---|---|---|---|';
const table=(pick:(v:{n:number,sum:number,sum20:number})=>number)=>{
  const ls=[HEAD]; let gn=0,gs=0;
  for(const [k,v] of Object.entries(bySet)){ if(v.n){gn+=v.n;gs+=pick(v);} ls.push(`| ${k} | ${v.n} | ${v.n?(pick(v)/v.n).toFixed(1):'—'} | ${v.axisGap} | ${v.interaction} | ${v.unmapped} |`); }
  ls.push(`| **ALL** | ${gn} | **${gn?(gs/gn).toFixed(1):'—'}** | | | |`);
  return ls;
};
const lines=table(v=>v.sum);
const lines20=table(v=>v.sum20);
const METHOD21 = `Score = % of pixels REPRODUCED, measured at the reference's own true scale with the two ROOT BOXES anchored. v2.1 stops content-trimming and stops rescaling each image into a common 200px box — the two blindnesses that cost round 5 and round 6 a measurement each: a pure TRANSLATION scored 0.00 change (the trim discards absolute position) and DELETING a wrong full-bleed gray ground LOWERED six rows (#efefef vs #ffffff is 16 per channel, inside v2.0's 90-summed-channel tolerance, so the wrong paint counted as a match AND inflated the trim box, whose loss the 200px normalization then magnified ~4x). v2.1 instead: (1) TRUE SCALE — the canvas export scale is not recorded, so it is derived as s = min(2, 600 / drawn bbox width) and verified over all 595 references that have a dump variant: no reference comes out SMALLER than the box it draws (Figma never trims a node's own box, so a negative would falsify the rule) and every residual is explainable (0 plain, 4/8px focus rings, 24px tooltip shadow, 56–70px floating value tooltips). The reference is resampled to (w/s, h/s); the render is used at 1:1. Nothing is normalized to a common size, so wrong SIZE now scores wrong. (2) ROOT ANCHOR — render-one reports the rendered root's border box on stdout (PNG bytes untouched); inside the reference the root's origin is the export's overflow split in the direction the render's own ink overflows its root box (even split when it does not), so a symmetric ring centres and a one-sided floating tooltip does not. Absolute position is measured. (3) TOLERANCE — a reference pixel is reproduced when some pixel in its 3x3 neighbourhood of the render is within 10 PER CHANNEL (v2.0: 90 summed across three, i.e. up to 30/channel); the 3x3 escape is what makes the tight threshold usable — it forgives Figma-vs-Chrome rasterisation jitter up to one pixel and nothing larger. DELIBERATELY IGNORED: sub-pixel and 1px placement (the 3x3 escape); the component's position on the page (only its root box is anchored — a uniform translation of the whole drawing is not a property of a standalone render); and effect ink beyond the render clip's 8px margin (worst case measured: tooltip, canvas shadow reaches 12px/side, so 4px of it is missing from the render and scores as missing — named, not fixed, because changing the clip would change the committed render bytes and make this metric change unattributable). MEASURED FLOOR — read the numbers with it: at true scale Figma's and Chrome's glyph rasterisation differ by more than the one-pixel escape on nearly every stem, so a frame that is ONLY text tops out near 70 (dropdown-list-item icon_false_checkbox_false_shortcut_false_state_default scores 70.45 with the two drawings indistinguishable by eye — its whole frame is one "List item" run). A text-dominated row is that floor plus its defects, and a fix measured on such a row reads COMPRESSED. The v2.0 table over the SAME renders is FIDELITY-v20.md: both are produced by one run, so the shift between them is the metric and nothing else.`;
const METHOD20 = CLIP === 'union'
  ? `Score = % pixels within tolerance. v2.0 clips the render to the UNION bounding box of the root and all its VISIBLE descendants (clamped to the viewport, +8px margin) instead of the root's border box: absolutely-positioned overflow — the slider's and progress bar's floating value tooltips, a badge hanging off a corner — used to be cropped out of the screenshot before scoring, so a variant that drew it correctly was measured against a reference that shows it and a render that could not. The union is a deliberate superset (an overflow:hidden ancestor clips visually, not geometrically); surplus white is removed by the trim that follows, whereas ink destroyed at render time was unrecoverable. v2.0 CHANGES THE DENOMINATOR of every number below — it is not comparable to a v1.3 table; \`FIDELITY_CLIP=root\` reproduces the v1.3 harness (fidelity-v13.json). Both images are then content-trimmed and normalized to a common 200px box (canvas ref up to 2x export vs standalone render; v1.3 trims margins — unequal margins misaligned every pixel).`
  : `Score = % pixels within tolerance, both images content-trimmed then normalized to a common 200px box (canvas ref up to 2x export vs standalone render; v1.3 trims margins — unequal margins misaligned every pixel).`;
const TAIL = ` v1.2: unknown axes consumed generically; axis-not-carried counts variants unrenderable because the inversion dropped their axis (genuine carriage losses only); state=disabled scores through the contract's disabled boolean; state=hover|focus variants are interaction-state (CSS-rendered, not statically scorable). Trend metric, not the final gate.`;
const stem = CLIP === 'union' ? 'fidelity' : 'fidelity-v13';
if (!ONLY.length) {
  const day=new Date().toISOString().slice(0,10);
  if (CLIP === 'union') {
    writeFileSync(`${UI}/renders/FIDELITY.md`, `# Canvas→code fidelity — ${day} @ HEAD\n\n${METHOD21}${TAIL}\n\n${lines.join('\n')}\n`);
    writeFileSync(`${UI}/renders/FIDELITY-v20.md`, `# Canvas→code fidelity, v2.0 metric — ${day} @ HEAD\n\nThe SUPERSEDED metric, kept so the v2.1 shift is attributable: this table is scored from the SAME renders in the SAME run as FIDELITY.md, so every difference between the two is the measuring rule and nothing else.\n\n${METHOD20}${TAIL}\n\n${lines20.join('\n')}\n`);
  } else {
    writeFileSync(`${UI}/renders/FIDELITY-v13.md`, `# Canvas→code fidelity — ${day} @ HEAD\n\n${METHOD20}${TAIL}\n\n${lines20.join('\n')}\n`);
  }
}
writeFileSync(`${UI}/renders/${stem}${ONLY.length?'-slice':''}.json`, JSON.stringify(results,null,1));
console.log('v2.1 (true scale, root-anchored):');
console.log(lines.join('\n'));
console.log('\nv2.0 (content-trim + 200px normalize), same renders:');
console.log(lines20.join('\n'));
