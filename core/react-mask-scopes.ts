import {walkAnatomy, resolveAbsoluteGeometry, tokensByPropEntries, type Contract, type Part} from '../scripts/contract-schema.js';
import {flattenTokens, makeResolveLiteral} from './tokens.js';

/** Paths, rather than bare part names, preserve the actual parent selector. */
export function reactMaskChildPaths(contract: Contract, tokenValues?: unknown): Set<string> {
  const record=(value:unknown):Record<string,unknown> => value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
  const trees=record(tokenValues),brands=record(trees.brands);
  const brandTrees=Object.keys(brands).length?Object.values(brands):[{}];
  const resolvers=brandTrees.flatMap(brand=>[trees.light,trees.dark].map(mode=>makeResolveLiteral(new Map([
    ...flattenTokens(record(trees.primitives)),...flattenTokens(record(brand)),
    ...flattenTokens(record(trees.semantic)),...flattenTokens(record(mode))]))));
  const zero=(value:unknown)=>value===0 || typeof value==='string' && /^0(?:\.0+)?(?:px)?$/.test(value);
  const borderQualified=(part:Part):boolean=>{
    const base={...part.literals,...part.tokens,...part.declared};
    const channels=Object.keys(base).filter(k=>k.startsWith('border-'));
    if(channels.some(k=>!['border-radius','border-width','border-color','border-style'].includes(k)))return false;
    if(Object.values(part.states ?? {}).some(v=>Object.keys(v).some(k=>k.startsWith('border-'))) ||
       part.stylesWhen?.some(r=>Object.keys(r.styles).some(k=>k.startsWith('border-'))) ||
       tokensByPropEntries(part).some(t=>Object.values(t.map).some(v=>Object.keys(v).some(k=>k.startsWith('border-')))) ||
       part.tokensByCombination?.some(t=>t.rows.some(r=>Object.keys(r.tokens).some(k=>k.startsWith('border-')))) ||
       part.literalsByProp?.some(t=>Object.values(t.map).some(v=>Object.keys(v).some(k=>k.startsWith('border-')))) ||
       part.literalsByCombination?.some(t=>t.rows.some(r=>Object.keys(r.literals).some(k=>k.startsWith('border-')))))return false;
    if(!channels.some(k=>k!=='border-radius'))return true;
    const ref=part.tokens?.['border-width'],literal=part.literals?.['border-width'] ?? part.declared?.['border-width'];
    if(ref && literal!==undefined)return false;
    for(const child of Object.values(part.parts ?? {}).filter(p=>p.mask)){
      const table=child.absoluteGeometryByCombination;
      const rows=table?table.rows:child.absoluteGeometry?[{values:[],geometry:child.absoluteGeometry}]:[];
      if(!rows.length)return false;
      for(const row of rows){
        if(Object.values(row.geometry.border ?? {}).some(value=>value!==0))return false;
        if(!ref){if(!zero(literal))return false;continue;}
        if(!tokenValues || !ref.startsWith('{') || !ref.endsWith('}'))return false;
        const subst=Object.fromEntries((table?.props ?? []).map((prop,i)=>[prop,row.values[i]]));
        const path=ref.slice(1,-1).replace(/\{([^{}]+)\}/g,(_,prop:string)=>typeof subst[prop]==='string'?subst[prop]:'{'+prop+'}');
        if(/[{}]/.test(path))return false;
        try{if(resolvers.some(resolve=>!zero(resolve(path))))return false;}catch{return false;}
      }
    }
    return true;
  };
  const paths=new Set<string>();
  for(const {name,part,path} of walkAnatomy(contract)) {
    if(path.length===1 && part.mask)throw Error(`react-mask-composition-unqualified:${name}:${part.mask.type}:root-mask`);
    if(!Object.values(part.parts ?? {}).some(child=>child.mask))continue;
    if(part.component || part.slot || part.icon || part.text!==undefined || part.content || part.repeat || part.meter ||
      !borderQualified(part))
      throw Error(`react-mask-composition-unqualified:${name}:parent-plane-unqualified`);
    reactMaskChildren(part.parts,()=> '');
    let masked=false;
    for(const [childName,child] of Object.entries(part.parts ?? {})) {
      if(child.mask){masked=true;continue;}
      if(masked)paths.add(JSON.stringify([...path,childName]));
    }
  }
  return paths;
}

/** Figma composites following siblings together before applying a mask.
 * Keep their original parent-sized coordinate plane. Flow children cannot
 * be reparented this way without changing their layout; refuse that case.
 * Luminance remains unqualified: native colored controls do not match the
 * browser's ordinary luminance conversion. No guessed color formula here.
 */
export function reactMaskChildren(parts: Record<string, Part> | undefined,
  render: (name: string, part: Part) => string,
  resolvePaint: (tokenPath:string)=>string|number = path=>`var(--${path.split('.').join('-')}, transparent)`,
  codePropOf: (prop:string)=>string = prop=>prop): string[] {
  const entries=Object.entries(parts ?? {}), out:string[]=[];
  for(let i=0;i<entries.length;i++) {
    const [name,part]=entries[i];
    if(!part.mask){out.push(render(name,part));continue;}
    const refuse=(reason:string):never=>{throw Error(`react-mask-composition-unqualified:${name}:${part.mask!.type}:${reason}`);};
    if(part.mask.type==='LUMINANCE')refuse('native-luminance-transfer-unqualified');
    if(part.repeat || part.component || part.slot || part.parts || part.text !== undefined || part.content || part.icon || part.meter)
      refuse('mask-owner-or-presence-unqualified');
    if(part.absolutePlacementByCombination || part.literalsByCombination?.length || part.tokensByCombination?.length || part.tokensByProp || part.states || part.stylesWhen?.length)
      refuse('mask-variant-paint-or-placement-unqualified');
    const table=part.absoluteGeometryByCombination;
    const geometries=table?table.rows.map(row=>({geometry:row.geometry,values:row.values}))
      :part.absoluteGeometry?[{geometry:part.absoluteGeometry,values:[] as Array<string|null>}]:[];
    if(!geometries.length)refuse('mask-coordinate-plane-unqualified');
    const shape=part.shape,outline=part.mask.outline ?? shape?.kind;
    if(!outline || !['rect','ellipse','path'].includes(outline) || shape?.rotation ||
      shape?.kind==='ellipse' && shape.arc || part.mask.outline && shape && shape.kind!==part.mask.outline)
      refuse('mask-outline-unqualified');
    for(const {geometry:g} of geometries) {
      if(!['SCALE','LEFT','RIGHT','CENTER','STRETCH'].includes(g.box.constraints.horizontal) ||
        !['SCALE','TOP','BOTTOM','CENTER','STRETCH'].includes(g.box.constraints.vertical) ||
        Object.values(g.border ?? {}).some(v=>v!==0))refuse('mask-coordinate-plane-unqualified');
      if(outline!=='rect' && Object.values(g.box.constraints).includes('STRETCH'))refuse('mask-stretch-outline-unqualified');
      if(!table && shape && shape.kind!=='path' && (shape.width!==g.box.width || shape.height!==g.box.height))
        refuse('mask-outline-extent-unqualified');
    }
    if(Object.keys(part.tokens ?? {}).some(k=>!['background-color','background-image','border-radius'].includes(k)) || part.layoutByProp || part.literalsByProp ||
      Object.keys(part.declared ?? {}).some(k=>k!=='position'))refuse('mask-paint-unqualified');
    const paint=part.literals ?? {};
    const stroke=part.mask.stroke,paintedStroke=part.mask.paintedStroke;
    if((stroke || paintedStroke) && (part.mask.type!=='ALPHA' || outline!=='path' || part.tokens?.['background-color'] || paint['background-color']!==undefined || part.tokens?.['background-image'] || paint['background-image']!==undefined))
      refuse('mask-stroke-paint-or-outline-unqualified');
    if(Object.keys(paint).some(k=>!['background-color','background-image','border-radius','width','height'].includes(k)))
      refuse('mask-paint-channel-unqualified');
    const unit=(v:unknown):number|undefined=>typeof v==='number'?v:typeof v==='string' && /^\d*\.?\d+(?:px)?$/.test(v)?Number(v.replace(/px$/,'')):undefined;
    let paintLayer:string|undefined;
    const gradientRef=part.tokens?.['background-image'],gradientLiteral=paint['background-image'];
    const hasGradient=gradientRef!==undefined || gradientLiteral!==undefined;
    if(hasGradient){
      if(part.mask.type!=='ALPHA' || outline!=='rect')refuse('mask-gradient-outline-or-type-unqualified');
      if(gradientRef && !/^\{[a-zA-Z0-9_.-]+\}$/.test(gradientRef))refuse('mask-gradient-token-plane-unqualified');
      if(gradientRef && gradientLiteral!==undefined)refuse('mask-gradient-competing-channel');
      if(part.tokens?.['background-color'] || paint['background-color']!==undefined)refuse('mask-gradient-paint-stack-unqualified');
      const value=gradientRef?String(resolvePaint(gradientRef.slice(1,-1))):gradientLiteral;
      if(typeof value!=='string' || !gradientRef && !/^linear-gradient\(.+\)$/.test(value))refuse('mask-gradient-paint-unqualified');
      paintLayer=value;
    }
    if(part.mask.type==='ALPHA' && !hasGradient && !stroke && !paintedStroke) {
      const ref=part.tokens?.['background-color'];
      if(ref && !/^\{[a-zA-Z0-9_.-]+\}$/.test(ref))refuse('mask-fill-token-plane-unqualified');
      const color=ref?String(resolvePaint(ref.slice(1,-1))):paint['background-color'];
      if(typeof color!=='string' || !ref && !/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(color))refuse('mask-fill-alpha-unqualified');
      // CSS alpha masks retain the token's actual theme alpha. A data-URI
      // SVG cannot inherit custom properties from the component's host.
      paintLayer=`linear-gradient(${color}, ${color})`;
    }
    const radiusRef=part.tokens?.['border-radius'];
    if(radiusRef && !/^\{[a-zA-Z0-9_.-]+\}$/.test(radiusRef))refuse('mask-radius-token-plane-unqualified');
    if(radiusRef && paint['border-radius']!==undefined)refuse('mask-radius-competing-channel');
    const radius=paint['border-radius']===undefined?0:unit(paint['border-radius']);
    if(radius===undefined || radius<0)refuse('mask-radius-unqualified');
    const roundedRect=outline==='rect' && (radiusRef!==undefined || radius!==0);
    if(!roundedRect && (radiusRef || radius!==0))refuse('mask-radius-outline-unqualified');
    // A constant native corner radius stays constant while SCALE constraints
    // resize the box. Scaling an SVG rx changes that radius; CSS inset round
    // instead clamps the actual radius against the current box dimensions.
    const cssRect=roundedRect || outline==='rect' && (hasGradient || geometries.some(({geometry:g})=>Object.values(g.box.constraints).includes('STRETCH')));
    const radiusCss=radiusRef?String(resolvePaint(radiusRef.slice(1,-1))):`${radius}px`;
    const inset=(start:number,extent:number,end:number,parent:number,constraint:string):[string,string]=>{
      if(constraint==='SCALE')return [`${start/parent*100}%`,`${end/parent*100}%`];
      if(constraint==='STRETCH')return [`${start}px`,`${end}px`];
      if(constraint==='RIGHT'||constraint==='BOTTOM')return [`calc(100% - ${end+extent}px)`,`${end}px`];
      if(constraint==='CENTER')return [`calc(50% + ${start-parent/2}px)`,`calc(50% - ${start+extent-parent/2}px)`];
      return [`${start}px`,`calc(100% - ${start+extent}px)`];
    };
    const pathTable=shape?.kind==='path'?shape.pathsByProp:undefined;
    const props=[...(table?.props ?? [])];
    if(pathTable && !props.includes(pathTable.prop))props.push(pathTable.prop);
    const planes=geometries.flatMap(({geometry,values})=>{
      if(!pathTable || table?.props.includes(pathTable.prop))return [{geometry,values}];
      return Object.keys(pathTable.map).map(value=>({geometry,values:[...values,value]}));
    });
    const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
    const images=planes.map(({geometry:g,values})=>{
      const box=g.box,plane=g.parent;
      let shapeMarkup:string;
      if(outline==='path') {
        if(shape?.kind!=='path' || !shape.paths?.length)refuse('mask-path-geometry-unqualified');
        const value=pathTable?values[props.indexOf(pathTable.prop)]:undefined;
        const drawing=pathTable?typeof value==='string'?pathTable.map[value]:undefined:shape;
        if(!drawing || !drawing.paths?.length)return refuse('mask-path-variant-unqualified');
        if(stroke || paintedStroke){
          if(drawing.paths.some(path=>path.windingRule==='NONE'))refuse('mask-stroke-interior-unqualified');
          const interior=drawing.paths.map(path=>`<path d="${escape(path.data)}" clip-rule="${path.windingRule==='EVENODD'?'evenodd':'nonzero'}"/>`).join('');
          const outlines=paintedStroke ? paintedStroke.paths.map(path=>`<path d="${escape(path.data)}" fill="white" fill-rule="${path.windingRule==='EVENODD'?'evenodd':'nonzero'}" clip-path="url(#inside)"/>`).join('') : drawing.paths.map(path=>`<path d="${escape(path.data)}" fill="none" stroke="white" stroke-width="${stroke!.weight*2}" stroke-linecap="${stroke!.cap==='NONE'?'butt':stroke!.cap.toLowerCase()}" stroke-linejoin="${stroke!.join.toLowerCase()}" stroke-miterlimit="${stroke!.miterLimit}" vector-effect="non-scaling-stroke" clip-path="url(#inside)"/>`).join('');
          shapeMarkup=`<svg x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" viewBox="0 0 ${drawing.width} ${drawing.height}" preserveAspectRatio="none"><defs><clipPath id="inside">${interior}</clipPath></defs>${outlines}</svg>`;
        }else shapeMarkup=`<g transform="translate(${box.x} ${box.y}) scale(${box.width/drawing.width} ${box.height/drawing.height})">${drawing.paths.map(path=>`<path d="${escape(path.data)}" fill="white" fill-rule="${path.windingRule==='EVENODD'?'evenodd':'nonzero'}"/>`).join('')}</g>`;
      } else shapeMarkup=outline==='ellipse'
        ? `<ellipse cx="${box.x+box.width/2}" cy="${box.y+box.height/2}" rx="${box.width/2}" ry="${box.height/2}" fill="white"/>`
        : `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${radius}" fill="white"/>`;
      const svg=`<svg xmlns="http://www.w3.org/2000/svg"${stroke || paintedStroke?' width="100%" height="100%"':''} viewBox="0 0 ${plane.width} ${plane.height}" preserveAspectRatio="none">${shapeMarkup}</svg>`;
      const image=cssRect?(paintLayer ?? 'linear-gradient(white, white)')
        :[`url("data:image/svg+xml,${encodeURIComponent(svg)}")`,...(paintLayer?[paintLayer]:[])].join(', ');
      const h=box.constraints.horizontal,v=box.constraints.vertical;
      const size=`${h==='SCALE'?'100%':plane.width+'px'} ${v==='SCALE'?'100%':plane.height+'px'}`;
      const position=`${h==='RIGHT'?'right':h==='CENTER'?'center':'left'} ${v==='BOTTOM'?'bottom':v==='CENTER'?'center':'top'}`;
      const [left,right]=inset(box.x,box.width,box.right,plane.width,h),
        [top,bottom]=inset(box.y,box.height,box.bottom,plane.height,v);
      // Gradient handles are local to the drawn mask box. CSS percentages
      // position an image in the available space (parent minus image extent),
      // not against the parent's full size; retain that distinction on resize.
      const gradientSize=(start:number,extent:number,end:number,parent:number,constraint:string)=>constraint==='SCALE'
        ? `${extent/parent*100}%`:constraint==='STRETCH'?`calc(100% - ${start}px - ${end}px)`:`${extent}px`;
      const gradientPosition=(start:number,extent:number,end:number,parent:number,constraint:string)=>{
        if(constraint==='SCALE'){
          if(parent===extent && start!==0)refuse('mask-gradient-scale-origin-unqualified');
          return `${parent===extent?0:start/(parent-extent)*100}%`;
        }
        if(constraint==='RIGHT'||constraint==='BOTTOM')return `calc(100% - ${end}px)`;
        if(constraint==='CENTER')return `calc(50% + ${start+extent/2-parent/2}px)`;
        return `${start}px`;
      };
      const localPaintSize=hasGradient?`${gradientSize(box.x,box.width,box.right,plane.width,h)} ${gradientSize(box.y,box.height,box.bottom,plane.height,v)}`:'100% 100%';
      const localPaintPosition=hasGradient?`left ${gradientPosition(box.x,box.width,box.right,plane.width,h)} top ${gradientPosition(box.y,box.height,box.bottom,plane.height,v)}`:'left top';
      return [JSON.stringify(values),{image,size:cssRect?localPaintSize:[size,...(paintLayer?['100% 100%']:[])].join(', '),position:cssRect?localPaintPosition:[position,...(paintLayer?['left top']:[])].join(', '),
        ...(cssRect?{clipPath:`inset(${top} ${right} ${bottom} ${left} round ${radiusCss})`}:{})}] as const;
    });
    const children:string[]=[];
    while(i+1<entries.length && !entries[i+1][1].mask){
      const [childName,child]=entries[++i];
      if(child.repeat || child.slot || child.component)refuse(`sibling-plane-unqualified:${childName}`);
      if(child.absoluteGeometryByCombination?.props.some(prop=>!props.includes(prop)))refuse(`sibling-plane-axis-unqualified:${childName}`);
      for(const {geometry:g,values} of planes) {
        const subst=Object.fromEntries(props.flatMap((prop,i)=>values[i]===null?[]:[[prop,values[i]!]]));
        const cg=resolveAbsoluteGeometry(child,subst);
        if(!cg || cg.parent.width!==g.parent.width || cg.parent.height!==g.parent.height ||
          Object.values(cg.border ?? {}).some(v=>v!==0))refuse(`sibling-plane-unqualified:${childName}`);
      }
      children.push(render(childName,child));
    }
    const selected=props.length
      ? `(()=>{const value=new Map<string,{image:string;size:string;position:string${cssRect?';clipPath?:string':''}}>(${JSON.stringify(images)}).get(JSON.stringify([${props.map(prop=>`${codePropOf(prop)} === undefined ? null : String(${codePropOf(prop)})`).join(',')} ]));if(value===undefined)throw Error(${JSON.stringify(`react-mask-geometry-combination-unavailable:${name}`)});return value;})()`
      : JSON.stringify(images[0][1]);
    const gate=part.visibleWhen;
    const condition=gate?gate.equals===undefined?codePropOf(gate.prop)
      :(Array.isArray(gate.equals)?gate.equals:[gate.equals]).map(v=>`${codePropOf(gate.prop)} === ${JSON.stringify(v)}`).join(' || '):undefined;
    const valueExpr=condition?`(${condition}) ? (${selected}) : ${JSON.stringify({image:'none',size:'100% 100%',position:'left top'})}`:selected;
    const fixed={position:'absolute',inset:0,maskRepeat:'no-repeat',
      WebkitMaskRepeat:'no-repeat',maskMode:'alpha',...(paintLayer && !cssRect?{maskComposite:'intersect',WebkitMaskComposite:'source-in'}:{})};
    // Fixed constraints retain physical path sizes; SCALE alone stretches the
    // observed parent plane. The alpha paint covers the whole current owner.
    const styleExpr=`(()=>{const value=${valueExpr};return {...(${JSON.stringify(fixed)} as const),maskImage:value.image,WebkitMaskImage:value.image,maskSize:value.size,WebkitMaskSize:value.size,maskPosition:value.position,WebkitMaskPosition:value.position${cssRect?',clipPath:value.clipPath ?? "none"':''}};})()`;
    out.push(`<div data-ds-mask-scope=${JSON.stringify(name)} style={${styleExpr}}>${children.join('\n')}</div>`);
  }
  return out;
}
