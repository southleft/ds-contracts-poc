import type {DumpNode,DumpHostOverride,DumpFixedSwap} from '../extract/figma/types.js';
import {canonicalJson} from './contract-provenance.js';
const emptyStack=(value:unknown)=>canonicalJson(value)===canonicalJson({version:1,order:'bottom-to-top',complete:true,paints:[]});
/** Select an ink override accompanied by an explicitly empty selected root.
 * Names never identify a target. The original selected root and complete
 * two-owner drawing census establish that the empty entry changes no paint;
 * the remaining entry still needs the caller's typed target/field checks. */
export function selectedDrawingInkOverride(node:DumpNode,observed:NonNullable<DumpFixedSwap['observedInstances']>[number]|undefined,
 main:DumpNode|undefined,key:string):DumpHostOverride|undefined {
 const entries=node.hostOverrides,g=node.instanceGeometry,w=node.instanceRootOverrides,census=node.instanceVectorContent;
 const root=observed?.selectedRoot;
 if(entries?.length!==2||!observed||!root||!main||!main.nodeId||main.nodeId!==observed.componentId||main.componentKey!==key||
    main.sourceEmptyFill!==true||!emptyStack(main.sourceFillStack)||!emptyStack(main.sourceStrokeStack)||
    main.fill||main.stroke||main.gradient||main.imageFill||main.imagePaints?.length||main.sourceFillComposition||main.sourceNormalFillComposition||
    main.children?.length!==1||!main.children[0].nodeId||main.children[0].shape?.kind!=='path'||!main.children[0].shape.paths?.length||
    root.kind!=='selected-slot-root-v1'||root.hostId!==node.nodeId||root.parentId!==node.nodeId||root.componentKey!==key||
    root.fields.length!==1||root.fields[0]!=='fills'||!g||!w||g.nodeId!==node.nodeId||w.nodeId!==node.nodeId||
    g.componentId!==root.hostMainId||w.componentId!==root.hostMainId||
    !census||census.source.length!==2||census.source[0].nodeId!==node.nodeId||census.source[0].componentId!==root.hostMainId||census.source[0].key!==node.instanceKey||
    census.source[1].nodeId!==observed.nodeId||census.source[1].componentId!==main.nodeId||census.source[1].key!==key)return undefined;
 const painted=entries.filter(h=>h.solidFillTarget!==undefined),empty=entries.filter(h=>h.solidFillTarget===undefined);
 if(painted.length!==1||empty.length!==1||empty[0].fields.length!==1||empty[0].fields[0]!=='fills'||
    Object.keys(empty[0]).some(k=>!['path','fields','sourceFillStack'].includes(k))||!emptyStack(empty[0].sourceFillStack))return undefined;
 const h=painted[0],t=h.solidFillTarget!;
 if(t.nodeId!==`${observed.nodeId};${main.children[0].nodeId}`||t.instanceId!==observed.nodeId||t.componentId!==main.nodeId||canonicalJson(t.instancePath)!==canonicalJson(observed.path)||
    canonicalJson(t.childPath)!=='[0]'||!h.fill||canonicalJson(h.fill)!==canonicalJson(census.paint))return undefined;
 return h;
}
