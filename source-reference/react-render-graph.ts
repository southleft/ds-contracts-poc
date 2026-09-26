import type {ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactOwnership} from './react-ownership.js';
import type {ReactContextConsumerVerification} from './react-context-verification.js';
import type {ReactContextValueWitness as Witness} from './react-context-runtime.js';
import type {ReactRenderGraphReport} from './react-render-graph-runtime.js';

type MembershipStep={kind:'children';factory:number}|{kind:'array-index';array:number;index:number};

export interface ReactRenderGraphVerification {
  qualification:'observed-host-render-links-only';effectsVerified:false;acceptedContract:null;
  rows:Array<{path:string;status:'linked'|'refused';reason?:string;
    steps:Array<{factory:number;render:number;sourceRender:number|null;consumerBodyVerified:boolean;
      componentModels:number[];returnedDirectly:boolean;membership?:MembershipStep[]}>;
    remainingRequirements:readonly string[]}>;
}
const same=(a:Witness|null|undefined,b:Witness|null|undefined)=>!!a&&!!b&&JSON.stringify(a)===JSON.stringify(b);

/** Reconstruct the entire observed return graph, including other branches, so
 * a missing/opaque sibling cannot conceal a second occurrence of the target. */
export function reactRenderMembership(graph:ReactRenderGraphReport,render:ReactRenderGraphReport['renders'][number],target:number):MembershipStep[]{
  function require(condition:unknown,reason:string):asserts condition {if(!condition)throw Error('render-graph-membership-'+reason);}
  const receipt=render.membership;require(receipt?.status==='verified',receipt?.status==='refused'?receipt.reason:'unavailable');
  const root=render.returnedFactory===null?undefined:graph.factories[render.returnedFactory];
  require(root&&root.id===render.returnedFactory&&same(root.element,render.output),'return-mismatch');
  require(graph.factories[target]?.id===target,'target-missing');
  const active=new Set<string>(),paths:MembershipStep[][]=[],factories:number[]=[],arrays:number[]=[];let steps=0;
  function walk(value:Witness,route:MembershipStep[],depth:number){
    require(++steps<=100000&&depth<=32,'traversal-limit');
    if(['null','undefined','string','number','boolean','bigint'].includes(value.kind))return;
    require(value.kind==='object','child-unproved');const key=JSON.stringify(value);
    require(!active.has(key),'cycle');active.add(key);
    try{
      const matches=graph.factories.filter(f=>same(f.element,value)),lists=graph.arrays.filter(a=>same(a.value,value));
      require(matches.length+lists.length===1,'identity-unproved-or-ambiguous');
      if(lists.length){
        const a=lists[0];require(graph.arrays[a.id]===a&&a.currentValuesVerified&&a.items.length<=10000,'array-changed');arrays.push(a.id);
        a.items.forEach((v,index)=>walk(v,[...route,{kind:'array-index',array:a.id,index}],depth+1));return;
      }
      const f=matches[0];require(graph.factories[f.id]===f&&f.current&&f.children?.status==='verified','children-unproved');
      factories.push(f.id);if(f.id===target)paths.push(route);require(paths.length<=1,'ambiguous');
      walk(f.children.value,[...route,{kind:'children',factory:f.id}],depth+1);
    }finally{active.delete(key);}
  }
  walk(root.element,[],0);
  require(JSON.stringify(factories)===JSON.stringify(receipt.factories)&&JSON.stringify(arrays)===JSON.stringify(receipt.arrays),'return-graph-changed');
  require(paths.length===1,'target-absent');return paths[0];
}

/** These edges belong to one guarded observation. A successful identity join
 * still does not establish source ownership, enclosing effects or native scope. */
export function verifyReactRenderGraph(ownership:ReactOwnership,runtime:ReactHelperRuntimeReport,
  consumers:ReactContextConsumerVerification):ReactRenderGraphVerification {
  const result:ReactRenderGraphVerification={qualification:'observed-host-render-links-only',effectsVerified:false,acceptedContract:null,rows:[]};
  function require(condition:unknown,reason:string):asserts condition {if(!condition)throw Error('render-graph-'+reason);}
  for(const node of ownership.nodes){
    const row:ReactRenderGraphVerification['rows'][number]={path:node.path,status:'refused',steps:[],remainingRequirements:
      ['original-source-content-ownership','input-and-return-value-semantics','enclosing-provider-and-render-effects','authored-return-membership','native-structure-and-fidelity']};result.rows.push(row);
    try{
      require(runtime.status==='observed'&&runtime.renderGraph,'runtime-unavailable');
      const graph=runtime.renderGraph,host=node.renderGraph;
      require(graph.qualification==='original-element-and-render-identity-only'&&!graph.effectsVerified&&graph.acceptedContract===null,'scope-changed');
      require(host?.status==='matched','host-unavailable');
      let factory=graph.factories[host.factory];
      require(factory&&factory.id===host.factory&&same(factory.element,host.element)&&same(factory.props,host.props)&&same(factory.type,host.type)&&same(host.type,{kind:'string',value:node.tag}),'host-mismatch');
      const seen=new Set<number>();
      for(let depth=0;depth<64;depth++){
        require(factory.current&&!seen.has(factory.id),'factory-stale-or-cycle');seen.add(factory.id);
        require(graph.factories.filter(f=>same(f.element,factory.element)||same(f.props,factory.props)).length===1,'factory-ambiguous');
        // A factory outside observed renderer calls ends the chain; it is not a body proof.
        if(factory.createdIn===null){row.status='linked';row.remainingRequirements=row.remainingRequirements.filter(r=>r!=='authored-return-membership');break;}
        const render=graph.renders[factory.createdIn];
        require(render&&render.id===factory.createdIn&&render.completion==='returned','creator-unavailable');
        const returned=render.returnedFactory===null?undefined:graph.factories[render.returnedFactory];
        require(returned?.current&&returned.id===render.returnedFactory&&same(render.output,returned.element),'return-unavailable');
        const proof=consumers.rows.filter(c=>c.render===render.sourceRender);
        if(render.sourceRender!==null){
          const frames=runtime.targetInitializers?.targets.flatMap(t=>t.invocations.map(i=>({source:t.render,...i}))).filter(i=>i.input.render===render.sourceRender&&i.output.render===render.sourceRender)??[];
          require(frames.length===1&&same(frames[0].input.value,render.input)&&same(frames[0].output.value,render.output),'source-render-mismatch');
          require(proof.length<=1,'consumer-ambiguous');
          if(proof.length)require(JSON.stringify(proof[0].source)===JSON.stringify(frames[0].source),'consumer-source-mismatch');
        }
        require(new Set(render.componentModels).size===render.componentModels.length&&render.componentModels.every(i=>Number.isSafeInteger(i)&&i>=0&&runtime.components?.some(c=>c.context===i)),'component-model-unavailable');
        row.steps.push({factory:factory.id,render:render.id,sourceRender:render.sourceRender,
          consumerBodyVerified:proof.length===1&&proof[0].status==='verified'&&proof[0].consumerBodyVerified,
          componentModels:[...render.componentModels],returnedDirectly:render.returnedFactory===factory.id});
        if(render.returnedFactory!==factory.id)row.steps.at(-1)!.membership=reactRenderMembership(graph,render,factory.id);
        require(render.factory!==null,'input-factory-unavailable');
        const next=graph.factories[render.factory];require(next&&next.id===render.factory&&same(next.props,render.factoryProps),'input-factory-missing');factory=next;
      }
      require(row.status==='linked','depth-limit');
    }catch(error){row.status='refused';row.reason=error instanceof Error?error.message:String(error);}
  }
  return result;
}
