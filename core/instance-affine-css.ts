import {allocateInstanceAffine,type InstanceAffineObservation} from '../scripts/contract-schema.js';

/** CSS owns the transformed flow box; the linked child owns its local box.
 * Container units exchange the live axes at quarter turns without a measured
 * snapshot, JavaScript resize observer, or scaling the child's paint. */
export function instanceAffineCss(observation:InstanceAffineObservation,fill:{width?:boolean;height?:boolean}={}) {
 const result=allocateInstanceAffine(observation);if('issue'in result)throw Error(result.issue);
 const {allocation:a,localSize:s,normalizedTransform:m}=result.allocation;
 const outer:Record<string,string|number>={position:'relative',flex:'none',width:a.width,height:a.height};
 const inner:Record<string,string|number>={display:'flex',alignItems:'flex-start',position:'absolute',left:0,top:0,width:s.width,height:s.height,transformOrigin:'0 0',transform:`matrix(${m[0][0]},${m[1][0]},${m[0][1]},${m[1][1]},${m[0][2]},${m[1][2]})`};
 if(!fill.width&&!fill.height)return {outer,inner};
 // A live bounding-box extent determines a local extent uniquely only when
 // the axes align. Oblique rotation would couple both sizes; refuse it.
 const linear=[m[0][0],m[0][1],m[1][0],m[1][1]];
 if(linear.some(v=>Math.abs(v-Math.round(v))>1e-6))throw Error('instance-affine-fill-requires-quarter-turn');
 const [a0,c,b,d]=linear.map(Math.round);
 const localWidth= a0!==0 ? (fill.width?'100cqw':s.width) : (fill.height?'100cqh':s.width);
 const localHeight= c!==0 ? (fill.width?'100cqw':s.height) : (fill.height?'100cqh':s.height);
 const css=(value:string|number)=>typeof value==='number'?`${value}px`:value;
 const shift=(x:number,y:number)=>x<0?css(localWidth):y<0?css(localHeight):'0px';
 // Growth stays on the allocation host, never on the rotated child. The
 // caller supplies the source's parent-owned grow/stretch class to this host.
 delete outer.flex;outer.containerType='size';outer.flexShrink=0;
 inner.width=localWidth;inner.height=localHeight;
 inner.transform=`translate(${shift(a0,c)},${shift(b,d)}) matrix(${m[0][0]},${m[1][0]},${m[0][1]},${m[1][1]},0,0)`;
 return {outer,inner,child:{flex:'none',width:'100%',height:'100%'}};
}
