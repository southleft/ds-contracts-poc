/** Host preparation only. Reopen all retained bytes on every phase; an artifact
 * ID is a lookup key, never a claim of independently observed React provenance.
 * The application journal must authorize and persist delivery separately. */
import {readPreparedReactLibrary} from './react-library-artifact.js';
import {createFigmaEngine} from '../../core/emit-figma-script.js';
import {canonicalJson,revisionOf} from '../../core/contract-provenance.js';
import {layeredNativeTokenModes} from '../../core/layered-native-token-modes.js';
import {prepareNativeTokenContext,type NativeTokenContextInput} from '../../core/native-token-context.js';
import type {NativeSourceWriteContext} from '../../core/native-source-write.js';
import type {NativePreparedLibrarySource} from '../../core/native-prepared-library.js';

export interface PreparedLibraryNativeRequest {
  artifactId:string;
  mode:'light'|'dark';
  brand:string;
  operation:{id:string;fileKey:string};
}
function reopen(repoRoot:string,request:PreparedLibraryNativeRequest) {
  if (!request || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(request.operation?.id) ||
      !/^[A-Za-z0-9]{10,80}$/.test(request.operation?.fileKey) || !['light','dark'].includes(request.mode))
    throw Error('react-library-native-request-invalid');
  const artifact=readPreparedReactLibrary(repoRoot,request.artifactId), {input,receipt}=artifact;
  const routed=layeredNativeTokenModes(input.tokens,[{sourceMode:request.mode,brand:request.brand,nativeModeName:'Selected'}]);
  const source:NativePreparedLibrarySource={kind:'prepared-contract-library',revision:'sha256:'+artifact.id,
    artifactId:artifact.id,inputSha256:receipt.inputSha256,tarballSha256:receipt.tarballSha256,tokensSha256:routed.tokensSha256};
  const engine=createFigmaEngine({tokens:input.tokens,icons:new Map(input.icons),mode:request.mode,brand:request.brand});
  const contracts=new Map(input.contracts.map(c=>[c.id,c]));
  const compiled=engine.compileNativePreparedLibrary(input.root,contracts,source,request.operation.id);
  // Allocate the graph's actual bindings and their exact alias closure. The
  // retained token library can contain unrelated or unsupported vocabulary;
  // its bytes still participate in the source identity, but are not silently
  // promoted to native variables. Missing types on a used path still refuse.
  const tokenPaths=compiled.boundNames.map(name=>name.replaceAll('/','.')).sort();
  const tokenInput:NativeTokenContextInput={fileKey:request.operation.fileKey,scopeId:'source-'+request.operation.id,
    source,tokenPaths,modes:routed.modes,writeProtocol:'explicit-modes-v1'};
  const plan={version:1 as const,kind:'prepared-library-native-inspection' as const,purpose:'source-candidate-inspection' as const,
    acceptedContract:null,nativeQualification:'unqualified' as const,operation:{...request.operation},
    artifactId:artifact.id,projection:compiled.projection,component:compiled.component,componentRevision:revisionOf(compiled.component),
    graphComponents:compiled.components,graphVerification:2 as const,componentRevisions:compiled.componentRevisions,
    tokenInput,tokenPreparation:prepareNativeTokenContext(tokenInput),
    limitations:['native-visual-fidelity-unverified','react-behavior-not-qualified','application-dispatch-not-authorized-by-plan']};
  return {artifact,engine,contracts,source,plan,revision:revisionOf(plan)};
}
export function prepareReactLibraryNativePlan(repoRoot:string,request:PreparedLibraryNativeRequest) {
  const {plan,revision}=reopen(repoRoot,request);return {plan,revision};
}
export function buildReactLibraryNativeWrite(repoRoot:string,request:PreparedLibraryNativeRequest,
  expectedPlanRevision:string,tokens:NativeSourceWriteContext['tokens']) {
  const current=reopen(repoRoot,request);
  if (current.revision !== expectedPlanRevision || canonicalJson(current.plan.tokenInput) !== canonicalJson(tokens.input))
    throw Error('react-library-native-plan-stale');
  return {planRevision:current.revision,script:current.engine.buildNativePreparedLibraryScript(
    current.artifact.input.root,current.contracts,current.source,{operation:request.operation,tokens})};
}
