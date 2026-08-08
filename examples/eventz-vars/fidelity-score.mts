/** CANVAS→CODE FIDELITY SCORE v2.1 — the Eventz kit.
 *
 *  The untitled-ui scoring kernel (examples/untitled-ui/fidelity-score.mts),
 *  applied to this kit with THREE deliberate, named deltas — everything else
 *  (true-scale comparison, root-anchored placement, 3x3/10-per-channel
 *  tolerance, ink-union denominator, the v2.0 table computed beside v2.1 for
 *  attribution, the geometry sidecar + FIDELITY_RESCORE=committed re-derive
 *  path) is the same kernel, verbatim:
 *
 *  1. SCALE IS 1, MEASURED NOT DERIVED. The uui references were hand-exported
 *     at the shooter's min(2, 600/w) rule; these references come from the
 *     REST images API at scale=1 (fetch-references.mts). Verified over all
 *     108 references against the dump's own variant bboxes: not one is
 *     SMALLER than the box it draws (0 negative overflows), and every
 *     residual is an explainable positive (74 exact, 8px focus rings, 1px
 *     rounding, 120px Molecules/Alert shadow).
 *  2. state=active JOINS hover|focus AS INTERACTION-STATE. Eventz crosses a
 *     state axis (default|hover|active|focus) with its variant axes; the
 *     carriage for hover/active is CSS pseudo-class rules (statesByProp,
 *     v17), real but not reachable by a static screenshot. uui had no
 *     active plane, so its kernel only knew hover|focus.
 *  3. ONE MERGED DUMP. The drawn boxes come from dumps/MERGED.json (the
 *     kit's only committed dump) instead of per-set dump files.
 *
 *  Contract-stage refusals this table scores THROUGH, honestly (they are
 *  named in NOTES.md and in the dump's _degradations, not silently healed):
 *  GRADIENT_LINEAR fills omitted (accent/featured badges render unpainted),
 *  textCase UPPER dropped ("Label" vs "LABEL"), icons-* child sets never
 *  imported (stub bbox + primary paint only), and the harness loads no
 *  webfonts (FC-FONT-SUBSTRATE — glyph substrate differs wholesale).
 *
 *  KNOWN-RED, named: Checkbox and Input mount as <input> WITH CHILDREN (the
 *  inference proposed element "input", the emitter has no void-element
 *  guard), so React renders nothing and their default-plane rows land in the
 *  unscored column. See the residual notes in FIDELITY.md. */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { chromium } = await import(ROOT+'/node_modules/playwright-core/index.mjs');
const { chromiumExecutable } = await import(ROOT+'/extract/figma/visual-parity/render.js');
const EV=`${ROOT}/examples/eventz-vars`;
// FIDELITY_RENDERS_DIR redirects every output (PNGs via render-one, the
// FIDELITY tables and fidelity.json) so a fresh-check can regenerate into a
// temp dir and byte-compare instead of mutating the committed evidence.
const RENDERS=process.env.FIDELITY_RENDERS_DIR || `${EV}/renders`;
mkdirSync(RENDERS, { recursive: true });
const SCRATCH=process.env.SCRATCH || '/tmp';
const CLIP=process.env.FIDELITY_CLIP === 'root' ? 'root' : 'union';
// FIDELITY_RESCORE=committed — no component is rendered: every row's score is
// RECOMPUTED from the committed bytes (renders/*.png, references/*.png, the
// dump, and the committed geometry sidecar) through the SAME kernel below.
const RESCORE=process.env.FIDELITY_RESCORE === 'committed';
type Geom={box:{x:number,y:number,width:number,height:number},root:{x:number,y:number,width:number,height:number}};
const GEO_IN: Record<string,Geom> = RESCORE
  ? JSON.parse(readFileSync(`${EV}/renders/fidelity-geometry.json`,'utf8'))
  : {};
const GEO_OUT: Record<string,Geom> = {};
const RENDER_ONE=process.env.RENDER_ONE || path.join(path.dirname(fileURLToPath(import.meta.url)), 'render-one.mts');
// PREFLIGHT — REFUSE to score against a STALE STYLESHEET (the uui guard,
// measured there: a token rename scored -1.3 from byte-identical values).
{
  const r = spawnSync('npx', ['tsx', path.join(EV, 'tokens-css.mts')], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(
      'REFUSED: examples/eventz-vars/storybook/src/tokens.css is STALE relative to the committed DTCG trees.\n' +
        'Every var() this run would render resolves against that file, so the score would measure the\n' +
        'stylesheet and not the kit. Rebuild it first:\n' +
        '  npx tsx examples/eventz-vars/tokens-css.mts --write\n' +
        (r.stderr || r.stdout || '').trim(),
    );
    process.exit(1);
  }
}

const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'');
const SETS: Record<string,{comp:string}> = {
  'atoms-badge':{comp:'AtomsBadge'}, 'atoms-button':{comp:'AtomsButton'},
  'atoms-icon-button':{comp:'AtomsIconButton'}, 'atoms-checkbox':{comp:'AtomsCheckbox'},
  'atoms-input':{comp:'AtomsInput'}, 'atoms-tag':{comp:'AtomsTag'},
  'molecules-alert':{comp:'MoleculesAlert'},
};
// FIDELITY_ONLY=atoms-badge,atoms-tag restricts the run to those sets; the
// table it prints is then a SLICE, never the headline number.
const ONLY=(process.env.FIDELITY_ONLY ?? '').split(',').map(s=>s.trim()).filter(Boolean);
// THE TRUE CANVAS BOX per variant, read out of the committed dump. Set name →
// slug is the pipeline's own naming ('Atoms/Badge' → atoms-badge); variant
// name → slug is fetch-references.mts's own (lowercase, non-alnum runs → '_').
const kebabSet=(s:string)=>s.replace(/^_/,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const varSlug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'_');
const DRAWN=new Map<string,{width:number,height:number}>();
{
  const d=JSON.parse(readFileSync(`${EV}/dumps/MERGED.json`,'utf8')) as Record<string,unknown>;
  for (const [name,value] of Object.entries(d)) {
    if (name.startsWith('_')) continue;
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
  const contract = JSON.parse(readFileSync(`${EV}/contracts/${slug}.contract.json`,'utf8'));
  const enums: Record<string,string[]> = {}; const bools: string[] = [];
  for (const p of contract.props ?? []) {
    if (p.type && typeof p.type==='object' && 'enum' in p.type) enums[p.name]=p.type.enum;
    else if (p.type==='boolean') bools.push(p.name);
  }
  const refs = readdirSync(`${EV}/references`).filter(f=>f.startsWith(`var--${slug}--`));
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
      // The promoted state axis. `disabled` rides a contract boolean
      // (statically scorable); hover/ACTIVE/focus are CSS-rendered
      // interaction states — their own category, never axis-not-carried.
      // Delta 2 vs uui: Eventz has an active plane, uui did not.
      if (!bound && i+1<toks.length && norm(toks[i])==='state') {
        const sv=norm(toks[i+1]);
        if (sv==='disabled' && bools.includes('disabled')) { props['disabled']=true; i+=2; bound=true; }
        else if (sv==='hover'||sv==='focus'||sv==='active') { interaction=true; i+=2; bound=true; }
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
    let geom: Partial<Geom> = {};
    if (RESCORE) {
      const g=GEO_IN[`${slug}--${varslug}`];
      if(!g){
        // A committed render WITHOUT geometry is the mounted-nothing case
        // (render-one screenshots the page but reports no root box — the
        // void-element rows); reproduce the live run's note byte-for-byte so
        // a rescore re-derives fidelity.json exactly. No PNG at all means
        // the row was never rendered on this checkout.
        const note=existsSync(`${EV}/renders/${out}.png`)
          ? 'render reported no root box'
          : 'no committed geometry — run `npm run eventz:fidelity` and commit renders/';
        results.push({set:slug,variant:varslug,score:null,note}); continue;
      }
      geom=g;
    } else {
    // One retry per render — an unscored row silently SHRINKS the table's
    // denominator (measured on uui: 41 rows lost to one concurrent job).
    let rendered=false, lastErr='';
    for (let attempt=0; attempt<2 && !rendered; attempt++) {
      try {
        const stdout=execFileSync('npx',['tsx',RENDER_ONE,comp,JSON.stringify(props),out],{cwd:ROOT,env:{...process.env,SCRATCH,FIDELITY_CLIP:CLIP},stdio:'pipe',timeout:60000}).toString();
        geom=JSON.parse(stdout.trim().split('\n').pop() || '{}');
        rendered=true;
      } catch(e){ lastErr=String((e as Error).message).slice(0,120); }
    }
    if(!rendered){ results.push({set:slug,variant:varslug,score:null,note:'render failed: '+lastErr}); continue; }
    if(geom.box && geom.root) GEO_OUT[`${slug}--${varslug}`]=geom as Geom;
    }
    // In rescore mode the render PNG is the COMMITTED one — that is the point.
    const rp=RESCORE ? `${EV}/renders/${out}.png` : `${RENDERS}/${out}.png`;
    if(!existsSync(rp)){ results.push({set:slug,variant:varslug,score:null,note:'no render'}); continue; }
    const drawn=DRAWN.get(`${slug}--${varslug}`);
    if(!drawn){ results.push({set:slug,variant:varslug,score:null,note:'no dump variant — true canvas box unknown'}); continue; }
    if(!geom.root || !geom.box){ results.push({set:slug,variant:varslug,score:null,note:'render reported no root box'}); continue; }
    // Delta 1 vs uui: the references are REST scale-1 exports, so the true
    // scale is 1 by construction (verified: 0/108 negative overflows).
    const meta={ bw:drawn.width, bh:drawn.height, scale:1,
      rx:geom.root.x-geom.box.x, ry:geom.root.y-geom.box.y, rw:geom.root.width, rh:geom.root.height };
    const refB=readFileSync(`${EV}/references/${ref}`).toString('base64');
    const renB=readFileSync(rp).toString('base64');
    const scores=await page.evaluate(`(async () => {
      const a = ${JSON.stringify(refB)}, c = ${JSON.stringify(renB)}, M = ${JSON.stringify(meta)};
      const load=(b64)=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src='data:image/png;base64,'+b64;});
      const [ia,ic]=await Promise.all([load(a),load(c)]);
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
      const inkOf=(d,w,h)=>{let x0=w,y0=h,x1=-1,y1=-1;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4;
          if(d[p]<248||d[p+1]<248||d[p+2]<248){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
        return x1<0?{x:0,y:0,w:w,h:h}:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};};
      const ink=inkOf(ren.data,ic.width,ic.height);
      const L=Math.max(0,M.rx-ink.x), R=Math.max(0,(ink.x+ink.w)-(M.rx+M.rw));
      const T=Math.max(0,M.ry-ink.y), B=Math.max(0,(ink.y+ink.h)-(M.ry+M.rh));
      const DX=RW-M.bw, DY=RH-M.bh;
      const ox=(L+R)>0?DX*L/(L+R):DX/2, oy=(T+B)>0?DY*T/(T+B):DY/2;
      const dx=Math.round(ox-M.rx), dy=Math.round(oy-M.ry);
      // THE DENOMINATOR IS THE DRAWN AREA — the union of the two INK
      // rectangles at their anchored positions, never the whole frame.
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
const METHOD21 = `Score = % of pixels REPRODUCED, measured at the reference's own true scale with the two ROOT BOXES anchored — the untitled-ui v2.1 kernel verbatim (see examples/untitled-ui/fidelity-score.mts for its full derivation and the two measured blindnesses it replaced), with three named deltas for this kit. (1) TRUE SCALE IS 1 BY CONSTRUCTION — references come from the REST images API at scale=1 (fetch-references.mts), not a hand shooter's min(2, 600/w) rule; verified over all 108 references against the dump's variant bboxes: 0 negative overflows, residuals all explainable positives (74 exact, 8px focus rings, 1px rounding, 120px Molecules/Alert shadow). (2) state=active is interaction-state alongside hover|focus — Eventz crosses state=default|hover|active|focus with its variant axes; the hover/active carriage is CSS pseudo-class rules via statesByProp (v17), real but not reachable by a static screenshot. (3) The drawn boxes come from dumps/MERGED.json, the kit's only committed dump. TOLERANCE unchanged: a reference pixel is reproduced when some pixel in its 3x3 neighbourhood of the render is within 10 PER CHANNEL; the denominator is the union of the two ink rectangles, never the frame. DELIBERATELY IGNORED, same as uui: sub-pixel and 1px placement; the component's position on the page; effect ink beyond the render clip's 8px margin — which BITES here: Molecules/Alert's canvas shadow reaches ~60px/side, so most of its shadow is absent from the render and scores as missing by design. MEASURED FLOOR: Figma-vs-Chrome glyph rasterisation differs beyond the one-pixel escape on nearly every stem, and this harness loads NO webfonts (FC-FONT-SUBSTRATE), so text-dominated rows read compressed. Trend metric, not the final gate.`;
const METHOD20 = `Score = % pixels within tolerance under the superseded v2.0 rule (content-trim + 200px normalize, 90-summed-channel tolerance), computed from the SAME renders in the SAME run as the v2.1 table so the shift between the two tables is the metric and nothing else.`;
const RESIDUALS = `## Honest residual notes — where the score goes, named

Lead finding first, then the classes already on the record (NOTES.md, dumps/MERGED.json _degradations, or the harness header). None is silently healed; each costs this table points wherever it applies.

- **VOID-ELEMENT MOUNT — ENGINE DEFECT, this kit's headline.** The name/axis inference proposed \`semantics.element: "input"\` for Atoms/Checkbox and Atoms/Input (uui's input-field-base drew no such name and got \`div\`), and core/emit-react.ts emits the anatomy's drawn children INSIDE that element. \`<input>\` is a void element, React refuses it at mount, and every Checkbox and Input row renders NOTHING — the 10 default-plane rows are the \`unscored\` column, not a low score. The emitter needs a void-element guard (or the reviewer must override the element before adoption); neither exists today, so the rows are refused by name rather than painted around.
- **GRADIENT_LINEAR fills omitted** — dump v1 carries solid paints only, so the accent and featured Badge grounds (and any other gradient paint) were refused by name at capture; the render draws NO ground there and every such pixel scores as missing.
- **textCase UPPER dropped** — the dump's typography projection carries (fontSize, fontStyle, style identity) only, so the canvas's "LABEL" renders as "Label". Named in _degradations per variant.
- **icons-\\* are STUBS** — the icon child sets were never imported; their contracts carry the observed bounding box and primary paint only (the stub-geometry rule), so every glyph drawing scores as a colored box at best.
- **FC-FONT-SUBSTRATE** — render-one loads no webfonts; the kit's text renders in whatever the OS resolves for Inter/system-ui. Glyph substrate differs wholesale from the canvas's, on top of the Figma-vs-Chrome rasterisation floor.
- **Molecules/Alert shadow clipped** — the canvas export carries ~60px of shadow per side; the render clip's 8px margin keeps at most 8px of it, so the rest is missing by design (the uui tooltip limitation, larger here).
- **Dark plane unexercised** — tokens.css flattens the BASE (Light) captured tree; the 43 variables that differ in Dark are carried in the committed light/dark trees but no dark render is scored.
- **hover/active/focus planes unscored** — carried as CSS pseudo-class rules (statesByProp), counted in the interaction-state column, not rendered statically.

## Lane wiring

\`npm run eventz:fidelity\` re-renders and re-scores (Chromium, ~1–2s/variant); it is not a CI lane. The fidelity:uui:fresh precedent applies unchanged: the scoring kernel runs canvas drawImage resampling inside Chromium, so byte-identity of fidelity.json across OSes is UNVERIFIED — a fresh-gate would join a lane only after one Linux run reproduces the committed table byte-for-byte, and unlike uui this kit has no accuracy:check floor holding its per-set means yet. Until then the committed fidelity.json + geometry sidecar keep the table re-derivable locally via FIDELITY_RESCORE=committed.`;
const stem='fidelity';
if (!ONLY.length) {
  const day=new Date().toISOString().slice(0,10);
  writeFileSync(`${RENDERS}/FIDELITY.md`, `# Eventz canvas→code fidelity — ${day} @ HEAD\n\n${METHOD21}\n\n${lines.join('\n')}\n\n${RESIDUALS}\n\n## v2.0 metric, same renders (attribution only)\n\n${METHOD20}\n\n${lines20.join('\n')}\n`);
}
writeFileSync(`${RENDERS}/${stem}${ONLY.length?'-slice':''}.json`, JSON.stringify(results,null,1));
// The geometry sidecar — rendered root/clip boxes per scored row, the one
// input to the v2.1 anchor that exists only in the DOM at render time.
if (!RESCORE && CLIP === 'union') writeFileSync(`${RENDERS}/fidelity-geometry${ONLY.length?'-slice':''}.json`, JSON.stringify(GEO_OUT,null,1));
console.log('v2.1 (true scale=1, root-anchored):');
console.log(lines.join('\n'));
console.log('\nv2.0 (content-trim + 200px normalize), same renders:');
console.log(lines20.join('\n'));
