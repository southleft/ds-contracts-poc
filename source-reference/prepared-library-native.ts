import {prepareReactLibraryNativePlan, buildReactLibraryNativeWrite} from '../playground/server/react-library-native.js';
import type {NativeOperationJobsOptions} from './native-operation-jobs.js';

/** All archive/input checks are repeated by the host helper. These pins describe
 * exactly those retained bytes; no visual/source-observation pins are invented. */
export function preparedLibraryNativeAdapter(repoRoot: string): NonNullable<NativeOperationJobsOptions['preparedLibrary']> {
  return {
    prepare(request, operation) {
      const plan = prepareReactLibraryNativePlan(repoRoot, {...request, operation});
      const source = plan.plan.projection.source;
      return {plan, artifact: {id:source.artifactId, inputSha256:source.inputSha256, tarballSha256:source.tarballSha256}};
    },
    buildComponent(request, context) {
      return buildReactLibraryNativeWrite(repoRoot, {...request, operation:context.operation}, context.planRevision, context.tokens);
    },
  };
}
