import {solidFillCompositionCss, solidFillCompositionTokenCss, type SolidFillComposition, type Part, type Contract, walkAnatomy} from '@ds-contracts/schema';

// Reset on each generated painted root, so an instance override cannot leak
// into a nested component. Inline usage styles win over the root reset.
export const INSTANCE_FILL_RESET = {
  '--dsc-instance-fill-color':'initial',
  '--dsc-instance-fill-blend':'initial',
  '--dsc-instance-fill-display':'initial',
} as const;

export function instanceFillStyle(paint: SolidFillComposition, tokenPath?: string) {
  const css=tokenPath===undefined?solidFillCompositionCss(paint):solidFillCompositionTokenCss(paint,tokenPath);
  return {position:'relative' as const,'--dsc-instance-fill-color':css.backgroundColor,'--dsc-instance-fill-blend':css.mixBlendMode,'--dsc-instance-fill-display':'block'};
}

export function rootFillLayerCss(paint: SolidFillComposition, tokenPath?: string) {
  const css=tokenPath===undefined?solidFillCompositionCss(paint):solidFillCompositionTokenCss(paint,tokenPath);
  return {...css,backgroundColor:`var(--dsc-instance-fill-color, ${css.backgroundColor})`,mixBlendMode:`var(--dsc-instance-fill-blend, ${css.mixBlendMode})`};
}

/** Generated expression uses the parent's exact cells, never the child's axes. */
export function instanceFillExpression(part: Part, codePropOf:(name:string)=>string, contracts?:ReadonlyMap<string,Contract>): string | undefined {
  if(!part.component)return undefined;
  const root=contracts?.get(part.component.id)?.anatomy.root;
  const style=(paint:SolidFillComposition,token?:string)=>root && !root.solidFillComposition && !root.solidFillCompositionByCombination
    ? {backgroundColor:token===undefined?solidFillCompositionCss(paint).backgroundColor:solidFillCompositionTokenCss(paint,token).backgroundColor}
    : instanceFillStyle(paint,token);
  if(part.solidFillComposition)return JSON.stringify(style(part.solidFillComposition,part.solidFillCompositionToken));
  const table=part.solidFillCompositionByCombination;
  if(!table)return undefined;
  return table.rows.map(row=>`(${table.props.map((axis,i)=>`String(${codePropOf(axis)}) === ${JSON.stringify(row.values[i])}`).join(' && ')}) ? ${JSON.stringify(style(row.paint,row.token))} : `).join('')+'{}';
}

/** An explicit vector paint primitive preserves graphical identity even when
 * Chromium serializes a native sub-byte alpha as zero. The token still owns
 * the exact fill, and the SVG stays outside the host's layout flow. */
export function boundFillSvgCss<T extends {backgroundColor:string}>(css:T) {
 const {backgroundColor,...rest}=css;
 return {...rest,fill:backgroundColor,width:'100%',height:'100%',display:'block',overflow:'hidden'};
}

/** A shared main must expose a graphical paint primitive when any linked usage
 * supplies token ink, including positive alpha below Chromium CSS serialization. */
export function hasBoundPaintUsage(contract:Contract,contracts?:ReadonlyMap<string,Contract>):boolean {
 return [...(contracts?.values()??[])].some(c=>walkAnatomy(c).some(({part})=>
  part.component?.id===contract.id && (part.solidFillCompositionToken!==undefined || part.solidFillCompositionByCombination?.rows.some(row=>row.token!==undefined))));
}
