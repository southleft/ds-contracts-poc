import type {Part} from '../packages/schema/src/contract-schema.js';
/** Keep arbitrary slot text and elements above paint without isolating its
 * backdrop. The outer box owns placement/paint; this flow box carries the
 * same child layout and fills its content box. */
export function reactSlotPaintForeground(part: Part, expression: string): string {
  if(!part.solidFillComposition && !part.solidFillCompositionByCombination)return `{${expression}}`;
  const style={position:'relative',display:'inherit',flexDirection:'inherit',flexWrap:'inherit',alignItems:'inherit',justifyContent:'inherit',alignContent:'inherit',gap:'inherit',gridTemplateColumns:'inherit',gridTemplateRows:'inherit',gridTemplateAreas:'inherit',gridAutoFlow:'inherit',gridAutoColumns:'inherit',gridAutoRows:'inherit',justifyItems:'inherit',flex:'1',minWidth:0,minHeight:0,width:'100%',height:'100%'};
  return `<div data-dsc-slot-foreground="" style={${JSON.stringify(style)}}>{${expression}}</div>`;
}
