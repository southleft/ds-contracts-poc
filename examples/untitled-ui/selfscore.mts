/** THE SELF-SCORE CONTROL + PER-VARIANT LOSS DECOMPOSITION.
 *
 *  WHY. `fidelity-score.mts` answers "how close is the render to the canvas".
 *  It cannot answer "how close COULD it get", and without that ceiling every
 *  residual point is unattributable: a row at 70 may be a broken drawing or a
 *  perfect one measured by a blunt instrument. This harness measures the
 *  instrument itself and splits each variant's shortfall into where it lands.
 *
 *  THE CONTROL. The scorer compares
 *      A = the Figma reference, rasterised by FIGMA at scale S, resampled to 1x
 *      B = the render,          rasterised by CHROME at 1x
 *  so its noise floor is "one drawing, two rasterisation paths". The naive
 *  self-score (A against A) is EXACTLY 100 by construction and measures
 *  nothing. This harness therefore substitutes the rasteriser and nothing else:
 *      A' = the SAME render, rasterised by CHROME at the SAME scale S,
 *           resampled to 1x by the SAME canvas path
 *      B  = the committed render PNG, byte-for-byte, unchanged
 *  Every other input — the drawing, the scale rule, the root anchor, the 3x3
 *  escape, the per-channel tolerance — is held fixed. score(A',B) is therefore
 *  PURE INSTRUMENT: the shortfall from 100 is what the metric charges for
 *  rasterising the identical drawing at scale S and resampling it back.
 *
 *  WHAT THE CONTROL DOES NOT COVER, stated so it is not read as more than it
 *  is: Chrome-at-S is not Figma-at-S. The control holds the FONT ENGINE and
 *  the VECTOR rasteriser constant, so it captures the resample component of
 *  the floor and not the cross-engine component. It is a LOWER BOUND on the
 *  instrument's noise, and the ceiling it implies (100 - loss) is an UPPER
 *  BOUND on what the engine can ever score. Both bounds are reported.
 *
 *  THE DECOMPOSITION. In the same pass, every reference-vs-render comparison
 *  is re-run with the failing pixels counted by kind instead of summed:
 *    · missing   — the reference inks it, the render leaves it white
 *    · extra     — the render inks it, the reference leaves it white
 *    · wrong     — both ink it, in colours further apart than the tolerance
 *    · unreachable — a failing pixel outside the render PNG's own rectangle.
 *      The render clip is the union box + 8px; canvas effect ink that reaches
 *      further (measured worst case: the tooltip shadow, 12px/side) is not in
 *      the PNG at all, so no engine change could match it. This is the 8px
 *      clip class, counted rather than asserted.
 *    · inText    — a failing pixel inside a glyph run's client rect (collected
 *      from the live DOM with Range.getClientRects, inflated 1px for
 *      antialias) — the text-rasterisation class.
 *    · inGlyph   — a failing pixel inside an <svg> box — the vector class.
 *
 *  READ-ONLY. Nothing in renders/ is rewritten except the new output
 *  `renders/fidelity-selfscore.json`. The committed render PNGs are read, not
 *  regenerated; FIDELITY.md and fidelity.json are not touched. The reference
 *  score is RECOMPUTED here from the committed bytes and asserted equal to
 *  fidelity.json — if the two disagree the row is flagged, so the
 *  decomposition can never quietly describe a different measurement.
 *
 *  The comparison kernel below (bbox/inkOf/px/put/TOL/3x3) is copied VERBATIM
 *  from fidelity-score.mts v2.1. It must stay that way; the control is only
 *  meaningful if it is the same instrument.
 *
 *    npx tsx examples/untitled-ui/selfscore.mts        # all 537
 *    SELFSCORE_ONLY=badge-base npx tsx …               # one set (a slice)
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { chromium } = await import(ROOT + '/node_modules/playwright-core/index.mjs');
const { build } = await import(ROOT + '/node_modules/esbuild/lib/main.js');
const { chromiumExecutable } = await import(ROOT + '/extract/figma/visual-parity/render.js');
const UI = `${ROOT}/examples/untitled-ui`;
const SCRATCH = process.env.SCRATCH || '/tmp';
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

// ——— identical to fidelity-score.mts ———
const SETS: Record<string, { comp: string }> = {
  'badge-base': { comp: 'BadgeBase' }, 'button-base': { comp: 'ButtonBase' },
  'toggle-base': { comp: 'ToggleBase' }, 'dropdown-list-item': { comp: 'DropdownListItem' },
  'input-field-base': { comp: 'InputFieldBase' }, 'avatar-group': { comp: 'AvatarGroup' },
  'tooltip': { comp: 'Tooltip' },
  'slider': { comp: 'Slider' }, 'progress-bar': { comp: 'ProgressBar' }, 'progress-circle': { comp: 'ProgressCircle' },
  'avatar': { comp: 'Avatar' }, 'avatar-label-group': { comp: 'AvatarLabelGroup' }, 'avatar-add-button': { comp: 'AvatarAddButton' },
  'button-group-base': { comp: 'ButtonGroupBase' }, 'social-button': { comp: 'SocialButton' },
};
const ONLY = (process.env.SELFSCORE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
// ——— WHAT-IF PROBES ———
// A probe answers "how many points would closing this defect recover" by
// MEASURING it instead of guessing: the hypothesised fix is applied as a
// stylesheet over the UNMODIFIED emitted component (nothing in
// storybook/src/generated or core/ is touched), the render is re-shot in this
// harness at 1x, and the reference score is recomputed. Probe output goes to
// renders/fidelity-probe-<name>.json and is never mixed into the table.
// PROBE=null with no CSS and the default 8px margin re-shoots the render and
// must reproduce the committed score — the probe path's own control.
const PROBE = process.env.SELFSCORE_PROBE ?? '';
const PROBE_CSS = process.env.SELFSCORE_PROBE_CSS ?? '';
const PROBE_CLIP = Number(process.env.SELFSCORE_PROBE_CLIP ?? 8);
const kebabSet = (s: string) => s.replace(/^_/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const varSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_');
const DRAWN = new Map<string, { width: number, height: number }>();
for (const f of readdirSync(`${UI}/dumps-v2`).filter(f => f.endsWith('.dump.json') && f !== 'MERGED.dump.json')) {
  const d = JSON.parse(readFileSync(`${UI}/dumps-v2/${f}`, 'utf8')) as Record<string, unknown>;
  for (const [name, value] of Object.entries(d)) {
    const set = value as { variants?: Array<{ name: string, bbox?: { width: number, height: number } }> };
    if (!set || typeof set !== 'object' || !Array.isArray(set.variants)) continue;
    for (const v of set.variants) if (v.bbox) DRAWN.set(`${kebabSet(name)}--${varSlug(v.name)}`, v.bbox);
  }
}
// The committed table is the denominator: this harness measures exactly the
// rows fidelity.json scored, never a set of its own choosing.
type FidRow = { set: string, variant: string, score: number | null };
const FID: FidRow[] = JSON.parse(readFileSync(`${UI}/renders/fidelity.json`, 'utf8'));

// ——— slug → props, copied verbatim from fidelity-score.mts ———
function invert(slug: string, varslug: string) {
  const contract = JSON.parse(readFileSync(`${UI}/storybook/contracts/${slug}.contract.json`, 'utf8'));
  const enums: Record<string, string[]> = {}; const bools: string[] = [];
  for (const p of contract.props ?? []) {
    if (p.type && typeof p.type === 'object' && 'enum' in p.type) enums[p.name] = p.type.enum;
    else if (p.type === 'boolean') bools.push(p.name);
  }
  const toks = varslug.split('_');
  const props: Record<string, unknown> = {}; let ok = true; let i = 0;
  while (i < toks.length) {
    let bound = false;
    for (let take = Math.min(4, toks.length - i); take >= 1 && !bound; take--) {
      const axisTok = norm(toks.slice(i, i + take).join(''));
      for (const [name, vals] of Object.entries(enums)) {
        if (norm(name) !== axisTok) continue;
        for (let vt = Math.min(4, toks.length - i - take); vt >= 1; vt--) {
          const valTok = norm(toks.slice(i + take, i + take + vt).join(''));
          const hit = vals.find(v => norm(v) === valTok);
          if (hit !== undefined) { props[name] = hit; i += take + vt; bound = true; break; }
        }
        if (bound) break;
      }
      if (!bound) {
        const bname = bools.find(bn => norm(bn) === axisTok);
        if (bname && i + take < toks.length) {
          const v = norm(toks[i + take]);
          if (v === 'true' || v === 'false') { props[bname] = v === 'true'; i += take + 1; bound = true; }
        }
      }
    }
    if (!bound && i + 1 < toks.length && norm(toks[i]) === 'state') {
      const sv = norm(toks[i + 1]);
      if (sv === 'disabled' && bools.includes('disabled')) { props['disabled'] = true; i += 2; bound = true; }
      else if (sv === 'hover' || sv === 'focus') { i += 2; bound = true; }
    }
    if (!bound && i + 1 < toks.length) { i += 2; bound = true; }
    if (!bound) { ok = false; break; }
  }
  return { props, ok };
}

// ——— the page, copied from render-one.mts (FIDELITY_CLIP=union) ———
const PAD = 96, VW = 1000, VH = 800;
const GEN = `${UI}/storybook/src/generated`;
const tokens = readFileSync(`${UI}/storybook/src/tokens.css`, 'utf8');
async function bundleFor(comp: string) {
  const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ${comp} } from '${GEN}/${comp}/index.ts';
const host = document.getElementById('root');
const r = createRoot(host);
window.__mount = (props) => { flushSync(() => r.render(React.createElement(${comp}, props))); };
// per-variant probe CSS: SELFSCORE_PROBE_CSS may contain {bw}/{bh}, which are
// substituted with the variant's own DRAWN box before each mount. That is how
// a hypothesis like "every root renders at the box the canvas drew" becomes a
// measurement instead of an estimate.
window.__probeCss = (css) => {
  let el = document.getElementById('probe-var');
  if (!el) { el = document.createElement('style'); el.id = 'probe-var'; document.head.appendChild(el); }
  el.textContent = css;
};
`;
  const tmp = `${SCRATCH}/ss-entry-${comp}.tsx`;
  writeFileSync(tmp, entry);
  const r = await build({ entryPoints: [tmp], bundle: true, write: false, format: 'iife', jsx: 'automatic', loader: { '.css': 'local-css' }, absWorkingDir: ROOT, nodePaths: [ROOT + '/node_modules'], outdir: `${SCRATCH}/ss-out` });
  const js = r.outputFiles.find((f: { path: string }) => f.path.endsWith('.js')).text;
  const css = r.outputFiles.filter((f: { path: string }) => f.path.endsWith('.css')).map((f: { text: string }) => f.text).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><style>${tokens}
body{margin:0;padding:${PAD}px;background:#fff;font-family:Inter,-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased;display:inline-block}</style>
<style>${css}</style>${PROBE_CSS && !PROBE_CSS.includes('{b') ? `<style>${PROBE_CSS}</style>` : ''}<div id="root" style="display:inline-block"></div><script>${js}</script>`;
  const p = `${SCRATCH}/ss-page-${comp}.html`;
  writeFileSync(p, html);
  return p;
}

// clip box + root box: byte-identical logic to render-one.mts's union branch,
// plus the glyph-run and svg rectangles the decomposition needs.
const GEOM_JS = `(() => {
  const c = document.querySelector('#root').firstElementChild; if (!c) return null;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  const add=(el)=>{ const cs=getComputedStyle(el);
    if (cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) return;
    const r=el.getBoundingClientRect();
    if (r.width>0&&r.height>0){ if(r.left<x0)x0=r.left; if(r.top<y0)y0=r.top; if(r.right>x1)x1=r.right; if(r.bottom>y1)y1=r.bottom; }
    for (const ch of el.children) add(ch); };
  add(c);
  if (!isFinite(x0)) { const r=c.getBoundingClientRect(); x0=r.left;y0=r.top;x1=r.right;y1=r.bottom; }
  const M=${PROBE_CLIP};
  x0=Math.max(0,x0-M); y0=Math.max(0,y0-M); x1=Math.min(${VW},x1+M); y1=Math.min(${VH},y1+M);
  const box={x:x0,y:y0,width:x1-x0,height:y1-y0};
  const rr=c.getBoundingClientRect();
  const root={x:rr.x,y:rr.y,width:rr.width,height:rr.height};
  // glyph runs — exact per-line rectangles of every rendered text node
  const text=[]; const w=document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
  for (let n=w.nextNode(); n; n=w.nextNode()) {
    if (!n.nodeValue || !n.nodeValue.trim()) continue;
    const pe=n.parentElement; if (!pe) continue;
    const cs=getComputedStyle(pe);
    if (cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) continue;
    const rg=document.createRange(); rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) if (r.width>0&&r.height>0) text.push({x:r.x,y:r.y,width:r.width,height:r.height});
  }
  const svg=[];
  for (const el of c.querySelectorAll('svg')) { const r=el.getBoundingClientRect(); if(r.width>0&&r.height>0) svg.push({x:r.x,y:r.y,width:r.width,height:r.height}); }
  if (c.tagName.toLowerCase()==='svg') svg.push(root);
  return {box,root,text,svg};
})()`;

// ——— the comparison kernel: VERBATIM v2.1, extended only with counters ———
const KERNEL = `async (payload) => {
  const {refB64, renB64, ctlB64, M, C, rects} = payload;
  const load=(b64)=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src='data:image/png;base64,'+b64;});
  const px=(im,w,h,sx,sy,sw,sh)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;
    const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);
    if(im)g.drawImage(im,sx,sy,sw,sh,0,0,w,h);return g.getImageData(0,0,w,h);};
  const inkOf=(d,w,h)=>{let x0=w,y0=h,x1=-1,y1=-1;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4;
      if(d[p]<248||d[p+1]<248||d[p+2]<248){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
    return x1<0?{x:0,y:0,w:w,h:h}:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};};
  const TOL=10;

  // ONE comparison, parameterised by the A side. meta.bw/bh is the box the A
  // side draws un-overflowed (the Figma node box for the reference; the render
  // root box for the control) — the anchor formula is otherwise identical.
  const compare=(ia, ic, meta, want) => {
    const S=meta.scale, RW=Math.round(ia.width/S), RH=Math.round(ia.height/S);
    // want.truthAnchor — the CONTROL knows where its own root is (its A side IS
    // the render), so the estimator is bypassed and the two images are laid on
    // top of each other. The estimator's error is REPORTED separately below
    // rather than folded into the ceiling: with it folded in, a set whose ink
    // overflows its root asymmetrically (the tooltip's bottom-heavy shadow)
    // scores its own control at 68 and the "ceiling" comes out BELOW the real
    // score, which is not a ceiling but a second, different defect.
    const refTrue=px(ia,RW,RH,0,0,ia.width,ia.height);
    const ren=px(ic,ic.width,ic.height,0,0,ic.width,ic.height);
    const ink=inkOf(ren.data,ic.width,ic.height);
    const L=Math.max(0,meta.rx-ink.x), R=Math.max(0,(ink.x+ink.w)-(meta.rx+meta.rw));
    const T=Math.max(0,meta.ry-ink.y), B=Math.max(0,(ink.y+ink.h)-(meta.ry+meta.rh));
    const DX=RW-meta.bw, DY=RH-meta.bh;
    const ox=(L+R)>0?DX*L/(L+R):DX/2, oy=(T+B)>0?DY*T/(T+B):DY/2;
    const dx=want.truthAnchor?0:Math.round(ox-meta.rx), dy=want.truthAnchor?0:Math.round(oy-meta.ry);
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
    let bad=0;
    // decomposition counters (only filled when want.decompose)
    let missing=0,extra=0,wrong=0,unreachable=0,inText=0,inGlyph=0;
    // the render PNG's own rectangle inside the frame: outside it there is no
    // render pixel at all, so no engine change could ever match those pixels.
    const rx0=dx-fx0, ry0=dy-fy0, rx1=rx0+ic.width, ry1=ry0+ic.height;
    // glyph-run / svg masks, in frame coordinates (render page coords → PNG
    // coords via -C.box, → frame coords via +dx-fx0), inflated 1px.
    const mkMask=(list)=>{ if(!want.decompose||!list||!list.length) return null;
      const m=new Uint8Array(FW*FH);
      for(const r of list){
        const ax0=Math.floor(r.x-C.box.x)+rx0-1, ay0=Math.floor(r.y-C.box.y)+ry0-1;
        const ax1=Math.ceil(r.x+r.width-C.box.x)+rx0+1, ay1=Math.ceil(r.y+r.height-C.box.y)+ry0+1;
        for(let y=Math.max(0,ay0);y<Math.min(FH,ay1);y++)for(let x=Math.max(0,ax0);x<Math.min(FW,ax1);x++) m[y*FW+x]=1;
      } return m; };
    const mText=want.decompose?mkMask(rects.text):null;
    const mSvg=want.decompose?mkMask(rects.svg):null;
    const isInk=(a,p)=>a[p]<248||a[p+1]<248||a[p+2]<248;
    for(let y=0;y<FH;y++)for(let x=0;x<FW;x++){
      const p=(y*FW+x)*4;
      let best=1e9;
      for(let ny=Math.max(0,y-1);ny<=Math.min(FH-1,y+1)&&best>TOL;ny++)
        for(let nx=Math.max(0,x-1);nx<=Math.min(FW-1,x+1)&&best>TOL;nx++){
          const q=(ny*FW+nx)*4;
          const d=Math.max(Math.abs(FA[p]-FB[q]),Math.abs(FA[p+1]-FB[q+1]),Math.abs(FA[p+2]-FB[q+2]));
          if(d<best)best=d;
        }
      if(best>TOL){ bad++;
        if(want.decompose){
          const a=isInk(FA,p), b=isInk(FB,p);
          if(a&&!b) missing++; else if(!a&&b) extra++; else wrong++;
          if(x<rx0||x>=rx1||y<ry0||y>=ry1) unreachable++;
          if(mText&&mText[y*FW+x]) inText++;
          else if(mSvg&&mSvg[y*FW+x]) inGlyph++;
        }
      }
    }
    // how much of the frame is glyph-run / svg at all — the composition of the
    // drawing, so a score can be read against what it is made of.
    let areaText=0,areaGlyph=0;
    if(want.decompose){ for(let i=0;i<FW*FH;i++){ if(mText&&mText[i])areaText++; else if(mSvg&&mSvg[i])areaGlyph++; } }
    return {score:Math.round(10000*(1-bad/(FW*FH)))/100, frame:[FW,FH], place:[dx,dy],
            // where the estimator PUT the root origin, and where it truly is.
            // On the control these two are directly comparable (the A side is
            // the render, so the truth is meta.rx/meta.ry) — their difference
            // is the anchor estimator's own error, in pixels, measured.
            est:[Math.round(ox*100)/100,Math.round(oy*100)/100], truth:[meta.rx,meta.ry],
            refBox:[RW,RH],
            bad, missing, extra, wrong, unreachable, inText, inGlyph, areaText, areaGlyph, total:FW*FH};
  };

  const [ia,ic]=await Promise.all([load(refB64),load(renB64)]);
  const ref=compare(ia,ic,M,{decompose:true});
  let ctl=null, ctlAnchored=null;
  if (ctlB64) {
    const iq=await load(ctlB64);
    ctl=compare(iq,ic,C.meta,{decompose:false,truthAnchor:true});
    ctlAnchored=compare(iq,ic,C.meta,{decompose:false});
  }
  return {ref,ctl,ctlAnchored};
}`;

type Out = {
  set: string, variant: string, comp: string,
  score: number | null, committed: number | null, agrees: boolean,
  ceiling: number | null, ceilingAnchored: number | null,
  scale: number, frame: number[], total: number,
  bad: number, missing: number, extra: number, wrong: number,
  unreachable: number, inText: number, inGlyph: number,
  areaText: number, areaGlyph: number,
  // geometry, so a size/placement defect is separable from a paint defect
  drawn: number[],        // the Figma node's own box, from the dump
  root: number[],         // the rendered root's border box, in CSS px
  clip: number[],         // the render PNG's clip box, in CSS px
  refTrue: number[],      // the reference resampled to its true box
  refOverflow: number[],  // refTrue − drawn: how far the export exceeds the box
  anchorErr: number[],    // the estimator's error on the control (px), measured
  placeRef: number[],     // where the estimator placed the render (dx,dy)
  note?: string,
};
const out: Out[] = [];

const b = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
const scorer = await (await b.newContext()).newPage();   // the comparison canvas
await scorer.goto('about:blank');

for (const [slug, { comp }] of Object.entries(SETS)) {
  if (ONLY.length && !ONLY.includes(slug)) continue;
  const rows = FID.filter(r => r.set === slug && r.score !== null);
  if (!rows.length) continue;
  const pagePath = await bundleFor(comp);
  // group by the derived export scale so one context serves many variants
  const groups = new Map<number, FidRow[]>();
  for (const r of rows) {
    const d = DRAWN.get(`${slug}--${r.variant}`)!;
    const s = Math.min(2, 600 / d.width);
    (groups.get(s) ?? groups.set(s, []).get(s)!).push(r);
  }
  for (const [S, grp] of [...groups.entries()].sort((a, b2) => a[0] - b2[0])) {
    // In PROBE mode the B side is re-shot here at 1x (the hypothesised fix
    // changes the drawing, so the committed PNG no longer describes it) and
    // the instrument control is skipped — the ceiling is a property of the
    // metric, already measured by the main run.
    const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: PROBE ? 1 : S });
    const page = await ctx.newPage();
    await page.goto('file://' + pagePath);
    for (const row of grp) {
      const { props, ok } = invert(slug, row.variant);
      const rec: Out = { set: slug, variant: row.variant, comp, score: null, committed: row.score, agrees: false, ceiling: null, ceilingAnchored: null, scale: S, frame: [0, 0], total: 0, bad: 0, missing: 0, extra: 0, wrong: 0, unreachable: 0, inText: 0, inGlyph: 0, areaText: 0, areaGlyph: 0, drawn: [0, 0], root: [0, 0], clip: [0, 0], refTrue: [0, 0], refOverflow: [0, 0], anchorErr: [0, 0], placeRef: [0, 0] };
      if (!ok) { rec.note = 'slug→props unmapped'; out.push(rec); continue; }
      const rp = `${UI}/renders/fid--${slug}--${row.variant}.png`;
      const ref = `${UI}/references/var--${slug}--${row.variant}.png`;
      if ((!existsSync(rp) && !PROBE) || !existsSync(ref)) { rec.note = 'missing committed png'; out.push(rec); continue; }
      try {
        const drawn0 = DRAWN.get(`${slug}--${row.variant}`)!;
        if (PROBE_CSS.includes('{b')) {
          await page.evaluate(`window.__probeCss(${JSON.stringify(PROBE_CSS.replace(/\{bw\}/g, String(drawn0.width)).replace(/\{bh\}/g, String(drawn0.height)))})`);
        }
        await page.evaluate(`window.__mount(${JSON.stringify(props)})`);
        await page.waitForTimeout(400);
        const g = await page.evaluate(GEOM_JS) as { box: { x: number, y: number, width: number, height: number }, root: { x: number, y: number, width: number, height: number }, text: unknown[], svg: unknown[] };
        if (!g) { rec.note = 'no root'; out.push(rec); continue; }
        const shot = (await page.screenshot({ clip: g.box })).toString('base64');
        const drawn = DRAWN.get(`${slug}--${row.variant}`)!;
        const M = { bw: drawn.width, bh: drawn.height, scale: S, rx: g.root.x - g.box.x, ry: g.root.y - g.box.y, rw: g.root.width, rh: g.root.height };
        // the CONTROL's meta: same anchor formula, but the box the A side draws
        // un-overflowed is the render's own root box.
        const C = { box: g.box, meta: { bw: g.root.width, bh: g.root.height, scale: S, rx: M.rx, ry: M.ry, rw: M.rw, rh: M.rh } };
        const payload = JSON.stringify({
          refB64: readFileSync(ref).toString('base64'),
          renB64: PROBE ? shot : readFileSync(rp).toString('base64'),
          ctlB64: PROBE ? null : shot, M, C, rects: { text: g.text, svg: g.svg },
        });
        type Cmp = { score: number, frame: number[], place: number[], est: number[], truth: number[], refBox: number[], bad: number, missing: number, extra: number, wrong: number, unreachable: number, inText: number, inGlyph: number, areaText: number, areaGlyph: number, total: number };
        const res = await scorer.evaluate(`(${KERNEL})(${payload})`) as { ref: Cmp, ctl: Cmp | null, ctlAnchored: Cmp | null };
        Object.assign(rec, {
          score: res.ref.score, agrees: Math.abs(res.ref.score - (row.score as number)) < 0.005,
          ceiling: res.ctl ? res.ctl.score : null,
          ceilingAnchored: res.ctlAnchored ? res.ctlAnchored.score : null,
          frame: res.ref.frame, total: res.ref.total, bad: res.ref.bad,
          missing: res.ref.missing, extra: res.ref.extra, wrong: res.ref.wrong,
          unreachable: res.ref.unreachable, inText: res.ref.inText, inGlyph: res.ref.inGlyph,
          areaText: res.ref.areaText, areaGlyph: res.ref.areaGlyph,
          drawn: [drawn.width, drawn.height],
          root: [Math.round(g.root.width * 100) / 100, Math.round(g.root.height * 100) / 100],
          clip: [Math.round(g.box.width * 100) / 100, Math.round(g.box.height * 100) / 100],
          refTrue: res.ref.refBox,
          refOverflow: [res.ref.refBox[0] - drawn.width, res.ref.refBox[1] - drawn.height],
          anchorErr: res.ctl ? [Math.round((res.ctl.est[0] - res.ctl.truth[0]) * 100) / 100, Math.round((res.ctl.est[1] - res.ctl.truth[1]) * 100) / 100] : [0, 0],
          placeRef: res.ref.place,
        });
      } catch (e) { rec.note = 'failed: ' + String((e as Error).message).slice(0, 140); }
      out.push(rec);
      if (out.length % 25 === 0) console.error(`  … ${out.length} rows`);
    }
    await ctx.close();
  }
  const done = out.filter(o => o.set === slug);
  const ag = done.filter(o => o.agrees).length;
  console.error(`${slug}: ${done.length} rows, ${ag} reproduce the committed score exactly`);
}
await b.close();
const stem = PROBE ? `fidelity-probe-${PROBE}` : (ONLY.length ? 'fidelity-selfscore-slice' : 'fidelity-selfscore');
writeFileSync(`${UI}/renders/${stem}.json`, JSON.stringify({
  meta: { probe: PROBE || null, probeCss: PROBE_CSS || null, clipMargin: PROBE_CLIP, sets: ONLY.length ? ONLY : 'all' },
  rows: out,
}, null, 1));
const good = out.filter(o => o.ceiling !== null);
console.log(`rows ${out.length} · reproduce committed ${out.filter(o => o.agrees).length} · ceiling measured ${good.length}`);
const scored = out.filter(o => o.score !== null);
if (scored.length) console.log(`mean score ${(scored.reduce((a, o) => a + o.score!, 0) / scored.length).toFixed(2)} · committed ${(scored.reduce((a, o) => a + (o.committed ?? 0), 0) / scored.length).toFixed(2)}`);
if (good.length) console.log(`mean ceiling ${(good.reduce((a, o) => a + o.ceiling!, 0) / good.length).toFixed(2)}`);
