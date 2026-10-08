import type {Contract} from '../scripts/contract-schema.js';
import type {DumpNode} from '../extract/figma/types.js';
import {revisionOf} from './contract-provenance.js';
/** Read context for an inspected remote main, never its upstream owning file.
 * Valid only for the exact draft revision and matching cached-main usage. */
export type DraftDrawingReadback={readFileKey:string;componentId:string;componentKey:string;remote:true;contractRevision:string};
export function draftDrawingReadbackMatches(receipt:DraftDrawingReadback|undefined,child:Contract,node:DumpNode,fileKey:string|null):boolean {
 const anchor=child.bindings.figma.anchors;
 return !!receipt && receipt.remote===true && !!fileKey && receipt.readFileKey===fileKey && anchor.fileKey===null &&
  !!anchor.nodeId && receipt.componentId===anchor.nodeId && receipt.componentKey===anchor.componentSetKey &&
  node.instanceKey===receipt.componentKey && !node.instanceSetKey && !!node.nodeId && node.instanceGeometry?.nodeId===node.nodeId && node.instanceGeometry.componentId===receipt.componentId &&
  receipt.contractRevision===revisionOf(child);
}
