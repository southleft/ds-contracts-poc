import assert from 'node:assert/strict';
import vm from 'node:vm';
import { ContractSchema } from '../scripts/contract-schema.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { revisionOf } from './contract-provenance.js';
import { flattenTokens } from './tokens.js';
import { nativeFixtureHost } from '../source-reference/native-operation-test-fixture.js';
import { emitNativeTokenContextScript, emitNativeTokenContextReadbackScript } from './token-set.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput } from './native-source-observation.js';
import type { NativeTokenContextInput } from './native-token-context.js';
import {prepareNativeContractUpdate} from './native-contract-update.js';

export async function nativeSvgUpdateFixture() {
  const host = nativeFixtureHost(), { figma } = host;
  const proto = Object.getPrototypeOf(figma.currentPage);
  proto.setExplicitVariableModeForCollection = function(c: any, mode: string) { this.explicitVariableModes = { [c.id]: mode }; };
  const makeSvg = figma.createNodeFromSvg.bind(figma);
  figma.createNodeFromSvg = (svg: string) => {
    const frame = makeSvg(svg), vector = new proto.constructor('VECTOR');
    vector.strokeWeight=2;vector.vectorPaths=[{windingRule:'NONZERO',data:'M 4 12 L 10 18 L 20 4'}];vector.fills = []; vector.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]; frame.appendChild(vector); return frame;
  };
  const run = async (script: string) => JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${script}\n})()`, { figma, console }, { timeout: 5000 })));
  const tokens = { ink: { $type: 'color', $value: '#fafafa' }, size: { $type: 'dimension', $value: '16px' }, faded: { $type: 'number', $value: 0.5 } };
  const engine = createFigmaEngine({ tokens: { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
    icons: new Map([['glyph', '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12L10 18L20 4" stroke="currentColor" stroke-width="2"/></svg>']]) });
  const contract = ContractSchema.parse({ id: 'fixture.initial', name: 'Initial', version: '0.1.0', status: 'draft',
    description: 'Synthetic finite initial-state draft', states: [], semantics: { element: 'button' }, props: [{ name: 'value', type: { enum: ['off','on'] },
      bindings: { code: { prop: 'value' }, figma: { kind: 'VARIANT', property: 'Value', unsetValue: '(unset)' } } }],
    anatomy: { root: { layout: { display: 'flex', direction: 'row', align: 'center', justify: 'center' }, tokens: { width: '{size}', height: '{size}', opacity: '{faded}' }, parts: {
      glyph: { icon: { asset: 'glyph', size: 14 }, tokens: { color: '{ink}' }, visibleWhen: { prop: 'value', equals: 'on' } },
      region: { shape: { kind: 'rect', width: 38, height: 30 }, declared: { position: 'absolute', 'pointer-events': 'auto' },
        literals: { left: '-12px', top: '-8px', 'background-color': 'transparent' } },
    } } }, bindings: { code: { anchors: { importPath: './fixture', export: 'Initial' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
  const source = { revision: revisionOf('source'), programSha256: 'b'.repeat(64), evidenceRevision: revisionOf('observations') };
  const byId = new Map([[contract.id, contract]]), compiled = engine.compileNativeContractDraft(contract, byId, source);
  const operation = { id: '10000000-0000-4000-8000-000000000006', fileKey: figma.fileKey };
  const input: NativeTokenContextInput = { fileKey: operation.fileKey, scopeId: 'source-' + operation.id,
    source: { revision: source.revision, sourceProgramSha256: source.programSha256, tokensSha256: revisionOf(tokens).slice(7) },
    tokenPaths: [...flattenTokens(tokens).keys()].sort(), modes: [{ sourceMode: 'light', brand: 'default', nativeModeName: 'Light', tokens, tokenTreeRevision: revisionOf(tokens) }] };
  const created = await run(emitNativeTokenContextScript(input).script), observed = await run(emitNativeTokenContextReadbackScript(input, created.creationIdentity));
  const context = { operation, tokens: { input, identity: created.creationIdentity, receipt: observed.receipt } };
  const emit = () => engine.buildNativeContractDraftScript(contract, byId, source, context);
  const beforeComponent=structuredClone(compiled.component);
  const svgs:string[]=[];
  function historical(n:import('./emit-figma-script.js').NodeSpec) {
    if(n.type==='svg') {svgs.push(n.svg!);n.svg=n.svg!.replace(/ height="14" width="14"/,'');}
    n.children?.forEach(historical);
  }
  beforeComponent.variants.forEach(v=>historical(v.spec));
  let script=emit();
  for(const svg of svgs)script=script.replaceAll(JSON.stringify(svg).slice(1,-1),JSON.stringify(svg.replace(/ height="14" width="14"/,'')).slice(1,-1));
  const creation=await run(script);assert.equal(creation.status,'created-candidate');
  const before:NativeContractObservationInput={operation,planRevision:revisionOf('old-plan'),component:beforeComponent,projection:compiled.projection,
    tokenInput:input,tokenIdentity:created.creationIdentity,creation};
  const baseline=await run(emitNativeContractReadbackScript(before));
  assert.equal(verifyNativeContractReadback(before,baseline).status,'supported-structure-observed');
  const updateInput={before,baseline,desired:{component:compiled.component,revision:revisionOf(compiled),tokenInput:input}};
  return {figma,run,input:updateInput,plan:prepareNativeContractUpdate(updateInput).plan,
    nodes:await Promise.all(creation.variants.map((v:any)=>figma.getNodeByIdAsync(v.id))),
    vectors:figma.root.findAll((n:any)=>n.type==='VECTOR')};
}
