import type {DumpNode} from '../extract/figma/types.js';

// Empty rotated auto-layout helpers encode a responsive ratio. The primary
// extent comes from transformed child bounds; STRETCH supplies the counter
// extent. Preserve the owner, and remove helpers only when all facts agree.
export function rotatedFlowRatio(root:DumpNode):{ratio:number;residual:number;nodeIds:string[]}|undefined {
  // Spacing has no effect with zero or one child. Padding still contributes.
  const cleanLayout=(n:DumpNode)=>n.layout && ['HORIZONTAL','VERTICAL'].includes(n.layout.mode) &&
    n.layout.primarySizing==='AUTO' && n.layout.counterSizing==='FIXED' &&
    Number.isFinite(n.layout.spacing) && n.layout.padding?.length===4 && n.layout.padding.every(v=>v===0) &&
    Object.keys(n.layout).every(k=>['mode','primary','counter','primarySizing','counterSizing','spacing','padding'].includes(k));
  if(root.layout?.mode!=='VERTICAL'||!cleanLayout(root)||root.children?.length!==1||root.targetAspectRatio||root.fixedSize?.height!==undefined)return;
  const allowed=new Set(['name','type','nodeId','nativeFlowGeometry','layout','clipsContent','sourceEmptyFill','fillWidth','fillHeight','children']);
  const chain:DumpNode[]=[];let parent=root;
  while(parent.children?.length===1){
    const n=parent.children[0],g=n.nativeFlowGeometry;
    if(chain.length>=16 || n.type!=='FRAME'||!cleanLayout(n)||n.sourceEmptyFill!==true||
      Object.keys(n).some(k=>!allowed.has(k)) || !g || g.nodeId!==n.nodeId || g.parentId!==parent.nodeId ||
      g.layoutAlign!=='STRETCH'||g.layoutGrow!==0||g.primarySizing!=='AUTO'||g.counterSizing!=='FIXED'||
      !['FIXED','HUG','FILL'].includes(g.sizing?.horizontal)||!['FIXED','HUG','FILL'].includes(g.sizing?.vertical))return;
    const m=g.relativeTransform;
    if(m.length!==2||m.some(r=>r.length!==3||r.some(v=>!Number.isFinite(v))))return;
    const [a,b]=m[0],[c,d]=m[1];
    if(Math.abs(a*a+c*c-1)>0.00001||Math.abs(b*b+d*d-1)>0.00001||Math.abs(a*b+c*d)>0.00001)return;
    const size=g.localSize,p=g.parentSize;
    if([size.width,size.height,p.width,p.height].some(v=>!Number.isFinite(v)||v<=0))return;
    const axis=n.layout!.mode==='HORIZONTAL'?0:1,pa=parent.layout!.mode==='HORIZONTAL'?0:1;
    const local=[size.width,size.height],ps=[p.width,p.height];
    if(Math.abs(local[1-axis]-ps[1-pa])>0.01 ||
      Math.abs(Math.abs(m[pa][0])*local[0]+Math.abs(m[pa][1])*local[1]-ps[pa])>0.01)return;
    if(parent.nativeFlowGeometry && (Math.abs(parent.nativeFlowGeometry.localSize.width-p.width)>0.01 ||
      Math.abs(parent.nativeFlowGeometry.localSize.height-p.height)>0.01))return;
    chain.push(n);parent=n;
  }
  if(!chain.length||parent.children?.length!==0)return;
  const leaf=chain.at(-1)!,size=leaf.nativeFlowGeometry!.localSize;
  let residual=leaf.layout!.mode==='HORIZONTAL'?size.width:size.height,slope=0;
  // Figma's empty HUG floor is numerical residue, not authored fixed content.
  if(residual>0.0021)return;
  for(let i=chain.length-1;i>=0;i--){
    const n=chain[i],p=i?chain[i-1]:root,axis=n.layout!.mode==='HORIZONTAL'?0:1,pa=p.layout!.mode==='HORIZONTAL'?0:1;
    const row=n.nativeFlowGeometry!.relativeTransform[pa];
    slope=Math.abs(row[1-axis])+Math.abs(row[axis])*slope;residual*=Math.abs(row[axis]);
  }
  if(!Number.isFinite(slope)||slope<=0||residual>0.0021)return;
  return {ratio:1/slope,residual,nodeIds:chain.map(n=>n.nodeId!)};
}
