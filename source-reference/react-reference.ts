import {projectReactBehaviorContract} from './react-behavior-contract.js';
import {readReactCallerCompositionGraph} from './react-caller-composition-evidence.js';
import {canonicalJson, revisionOf} from '../core/contract-provenance.js';
import {compileReactCallerNative} from './react-caller-native.js';
import {buildReactCallerPreview} from './react-caller-preview.js';
import {buildReactBehaviorPreview} from './react-behavior-preview.js';
import { selectReactComparisonCase } from './react-comparison-case.js';
import { reactComparisonContentScope, reactComparisonContentOperation } from './react-comparison-request.js';
import {withEvidenceReadSnapshot} from './evidence-read-snapshot.js';
import { readReactCompositionEvidence } from './react-composition-evidence.js';
import { restoreReactOwnership } from './react-ownership-restore.js';
import type { ReactInitialNativeRequest } from './react-initial-native-request.js';
import type { createNativeUpdatePlans } from './native-update-plans.js';
import type { createNativeUpdateJobs } from './native-update-jobs.js';
import type { createNativeSourceSuccessions } from './native-source-succession.js';
import { selectReactComparisonRequest, readReactComparisonEvidence, refreshReactComparisonEvidence } from './react-comparison-evidence.js';
import { createReactSourceFramingStore, loadReactFrameInput, measureReactSourceTypography } from './react-source-framing.js';
import { createReactCallbackInspectionStore } from './react-callback-inspection.js';
import { createReactInitialInspectionStore, reactInspectionRequest } from './react-initial-inspection.js';
import type { ReactComparisonRequest } from './react-comparison-request.js';
import { startReactOwnership } from "./react-ownership-run.js";
import { startReactContentInspection, readReactContentInspection } from './react-content-inspection.js';
import { readReactNativeEvidence, readReactNativeContentEvidence, selectReactNativeRequest, selectReactChildRequest } from './react-native-evidence.js';
import type { ReactNativeRequest } from './react-native-request.js';
import { isReactCallerNativeRequest, reactCallerNativeReservation, type ReactCallerNativeRequest } from './react-caller-native-request.js';
import type { createNativeOperationJobs } from './native-operation-jobs.js';
import type { createNativeOperationTransport } from './native-operation-transport.js';
import { proposeReactSourceProgram } from "./react-program-proposal.js";
import {
  readReactSourceProgram,
  reactSourceProgramUnchanged,
} from "./react-source-program.js";
import { startReactValidation } from "./react-reference-validation.js";
import { build, type Loader } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync, realpathSync } from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  reactReferenceCases,
  reactReferenceEntry,
} from "./react-reference-cases.js";

const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const loaders: Record<string, Loader> = {
  ".js": "js",
  ".mjs": "js",
  ".cjs": "js",
  ".jsx": "jsx",
  ".ts": "ts",
  ".tsx": "tsx",
  ".json": "json",
  ".css": "css",
  ".woff": "dataurl",
  ".woff2": "dataurl",
};
export interface ReactReference {
  id: string;
  files: Record<string, string>;
  javascript: string;
  css: string;
}

/** A host-configured source root; no browser request can choose a filesystem
 * path, executable or dependency. esbuild parses source; it never executes it. */
export async function buildReactReference(
  sourceRoot: string,
  entry: string = reactReferenceEntry,
): Promise<ReactReference> {
  sourceRoot = realpathSync(sourceRoot);
  const files: Record<string, string> = {};
  for (const file of [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "src/index.css",
    "capture-input.css",
  ]) {
    files[path.join(sourceRoot, file)] = sha(
      readFileSync(path.join(sourceRoot, file)),
    );
  }
  const output = await build({
    stdin: {
      contents: entry,
      resolveDir: sourceRoot,
      sourcefile: "react-reference.tsx",
      loader: "tsx",
    },
    absWorkingDir: sourceRoot,
    tsconfig: path.join(sourceRoot, "tsconfig.json"),
    bundle: true,
    write: false,
    outdir: "reference-memory-output",
    format: "iife",
    jsx: "automatic",
    metafile: true,
    plugins: [
      {
        name: "record-original-bytes",
        setup(builder) {
          builder.onLoad({ filter: /./, namespace: "file" }, (args) => {
            const loader = loaders[path.extname(args.path)];
            if (!loader) throw Error("react-reference-unsupported-asset");
            const contents = readFileSync(args.path);
            const hash = sha(contents);
            if (files[args.path] && files[args.path] !== hash)
              throw Error("react-reference-source-changed");
            files[args.path] = hash;
            return { contents, loader, resolveDir: path.dirname(args.path) };
          });
        },
      },
    ],
  });
  for (const input of Object.keys(output.metafile!.inputs)) {
    if (input === "react-reference.tsx") continue;
    if (!files[path.resolve(sourceRoot, input)])
      throw Error(`react-reference-input-unrecorded: ${input}`);
  }
  const javascript = output.outputFiles.find((f) =>
    f.path.endsWith(".js"),
  )?.text;
  const css = output.outputFiles.find((f) => f.path.endsWith(".css"))?.text;
  if (!javascript || !css) throw Error("react-reference-output-missing");
  const identity = {
    version: 1,
    entry: sha(entry),
    files: Object.entries(files)
      .map(([file, hash]) => [path.relative(sourceRoot, file), hash])
      .sort(),
    javascript: sha(javascript),
    css: sha(css),
  };
  const reference = {
    id: sha(JSON.stringify(identity)),
    files: Object.fromEntries(
      Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
    ),
    javascript,
    css,
  };
  if (!reactReferenceUnchanged(reference))
    throw Error("react-reference-source-changed");
  return reference;
}
export function reactReferenceUnchanged(reference: ReactReference) {
  try {
    return Object.entries(reference.files).every(
      ([file, hash]) => sha(readFileSync(file)) === hash,
    );
  } catch {
    return false;
  }
}
export function reactReferenceHtml(reference: ReactReference) {
  // Script/style raw-text elements must not let source literals close their tags.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${reference.css.replace(/<\/style/gi, "<\\/style")}</style></head><body style="padding:32px"><div id="root"></div><script>${reference.javascript.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}

/** Called only after the source service's loopback and same-origin checks. */
export function createReactReferenceService(
  repoRoot: string,
  sourceRoot = process.env.DS_CONTRACTS_REACT_SOURCE_ROOT ??
    path.resolve(
      repoRoot,
      "../ds-contracts-poc/examples/shadcn/.shadcn-sandbox",
    ),
  native?: () => { jobs: ReturnType<typeof createNativeOperationJobs>; transport: ReturnType<typeof createNativeOperationTransport>; updates?: ReturnType<typeof createNativeUpdatePlans>; updateJobs?: ReturnType<typeof createNativeUpdateJobs>; successions?: ReturnType<typeof createNativeSourceSuccessions>; updateTransport?: ReturnType<typeof createNativeOperationTransport> },
) {
  let reference: ReactReference | undefined;
  const frames = createReactSourceFramingStore(repoRoot, (referenceId, operationId) => {
    if (!native || !reference || reference.id !== referenceId) throw Error('react-source-framing-reference-unavailable');
    return { reference, request: native().jobs.reactSourceRequest(operationId) };
  });
  const selectInspectionSource = (referenceId: string) => {
    if (!native || !reference || reference.id !== referenceId) throw Error('react-initial-reference-unavailable');
    // Reuse the immutable ownership archive already pinned by a saved root
    // operation. No fresh property matrix or browser-supplied evidence paths.
    const selected = withEvidenceReadSnapshot(() => native!().jobs.withReadSnapshot(() => {
      const roots = native!().jobs.listReact(referenceId, 'root').filter(r => r.kind === 'root');
      // A root that follows this source through a recorded succession anchors
      // the sealed observation it follows, not its creation pin. Its creation
      // plan is rightly stale; the followed archive must still read unchanged.
      const followed = (id: string) => {
        const pin = native!().jobs.reactEffectiveRequest(id);
        if (revisionOf(pin.ownership) === revisionOf(native!().jobs.reactRequest(id).ownership)) return undefined;
        try { readReactNativeEvidence(repoRoot, reference!, pin); return pin; } catch { return undefined; }
      };
      const current = roots.flatMap(r => r.operation.sourceCurrent ? [native!().jobs.reactRequest(r.operation.id)] : followed(r.operation.id) ?? [])
        .sort((a,b) => a.ownership.id.localeCompare(b.ownership.id));
      // Native plan compatibility is not source freshness. Initial-state reads
      // independently authenticate the old source archive, without authorizing
      // a native write or replacing that operation's pinned compiler output.
      return { anchor: current[0], anchors: roots.map(r => native!().jobs.reactEffectiveRequest(r.operation.id)) };
    }));
    const { anchor, anchors } = selected;
    if (!anchor) throw Error('react-initial-saved-observation-required');
    return { reference, anchor, anchors };
  };
  const initialStates = createReactInitialInspectionStore(repoRoot, sourceRoot, selectInspectionSource);
  const callbacks = createReactCallbackInspectionStore(repoRoot, sourceRoot, selectInspectionSource,
    (referenceId,caseId,report) => projectReactBehaviorContract(initialStates.read(referenceId,caseId,report.instanceId),report));
  const callerGraph = (operationId: string) => {
    if (!native || !reference || !reactReferenceUnchanged(reference)) throw Error('react-caller-source-unavailable');
    const current = reference;
    const request = native().jobs.reactRequest(operationId);
    if (request.version !== 1 || request.referenceId !== current.id) throw Error('react-caller-source-mismatch');
    const graph = withEvidenceReadSnapshot(() => native!().jobs.withReadSnapshot(() => readReactCallerCompositionGraph(repoRoot, current,
      request, operationId, (caseId, instanceId) => {
        const behavior = callbacks.read(current.id, caseId, instanceId)?.draft;
        if (behavior?.status !== 'generated-draft' || !behavior.contract) return undefined;
        const initial = initialStates.nativeEvidence(current, initialStates.nativeRequest(current.id, caseId, instanceId));
        return { ...initial.composition, initialContract: initial.draft.compiled!.contract!, contract: behavior.contract,
          tokens: initial.draft.compiled!.tokens!, assets: initial.draft.compiled!.assets ?? [] };
      })));
    if (!reactReferenceUnchanged(current)) throw Error('react-caller-source-changed');
    return { current, request, graph };
  };
  const callerNativeEvidence = (request: ReactCallerNativeRequest) => {
    if (!isReactCallerNativeRequest(request)) throw Error('react-caller-native-request-invalid');
    const current = callerGraph(request.parentOperationId);
    const nativeCompilation = compileReactCallerNative(current.graph);
    if (request.referenceId !== current.current.id || request.caseId !== current.request.caseId ||
        request.inventorySha256 !== current.request.inventorySha256 ||
        canonicalJson(request.ownership) !== canonicalJson(current.request.ownership) ||
        request.graphRevision !== nativeCompilation.report.graphRevision)
      throw Error('react-caller-native-evidence-changed');
    const { source } = readReactNativeEvidence(repoRoot, current.current, current.request);
    return { graph: current.graph, source };
  };
  const thisInitialEvidence = (request: ReactInitialNativeRequest) => {
    if (!reference) throw Error('react-initial-native-reference-unavailable');
    return initialStates.nativeEvidence(reference, request);
  };
  const contentJobs = new Map<string, ReturnType<typeof startReactContentInspection>>();
  const validations = new Map<
    string,
    ReturnType<typeof startReactValidation>
  >();
  const ownershipJobs = new Map<
    string,
    ReturnType<typeof startReactOwnership>
  >();
  const savedOwnership = (current: ReactReference) => {
    let job = ownershipJobs.get(current.id);
    if (!job && native) {
      try {
        const jobs = native().jobs;
        const pinned = jobs.listReact(current.id, 'root').filter(row => row.operation.sourceCurrent)
          .map(row => jobs.reactRequest(row.operation.id));
        const archives = new Set(pinned.map(r => JSON.stringify([r.ownership, r.inventorySha256])));
        // Do not let recency or filesystem order choose between different baselines.
        if (archives.size === 1) {
          job = restoreReactOwnership(repoRoot, current, pinned[0]);
          ownershipJobs.set(current.id, job);
        }
      } catch { /* Leave unavailable; never start an implicit observation. */ }
    }
    return job;
  };
  let loading: Promise<ReactReference> | undefined;
  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(body));
  };
  const handle = async (
    req: IncomingMessage,
    res: ServerResponse,
    route: string,
  ) => {
    const contextual = /^react\/([a-f0-9]{64})\/native-operation\/([a-f0-9-]{36})\/caller-react\/child\/(instance-\d+)\/(initial-states|callback-behavior)$/.exec(route);
    if (contextual) {
      try {
        if (!['GET','POST'].includes(req.method ?? '') || Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'] ||
            !native || !reference || reference.id !== contextual[1] || !reactReferenceUnchanged(reference))
          throw Error('react-contextual-request-invalid');
        const request = native().jobs.reactRequest(contextual[2]);
        if (request.version !== 1 || request.referenceId !== reference.id) throw Error('react-contextual-source-mismatch');
        const store = contextual[4] === 'initial-states' ? initialStates : callbacks;
        const running = req.method === 'GET' ? store.running(reactInspectionRequest(request, request.caseId, contextual[3])) : undefined;
        // Running status cannot authorize generation. The source was checked
        // above; sealed evidence is fully re-read once the job is terminal.
        if (running) { json(res, 200, { inspection: running }); return; }
        const selected = selectInspectionSource(reference.id).anchor;
        if (request.version !== 1 || request.referenceId !== reference.id ||
            revisionOf(request.ownership) !== revisionOf(selected.ownership) || request.inventorySha256 !== selected.inventorySha256)
          throw Error('react-contextual-source-mismatch');
        if (req.method === 'POST') {
          const job = store.start(reference.id, request.caseId, contextual[3]);
          void job.promise.catch(() => {});
          json(res, 200, { inspection: job.state });
        } else json(res, 200, { inspection: store.read(reference.id, request.caseId, contextual[3]) ?? null });
      } catch { json(res, 409, { error: 'Contextual inspection requires an unchanged saved composition and its exact nested source instance.' }); }
      return;
    }
    const callerReact = /^react\/([a-f0-9]{64})\/native-operation\/([a-f0-9-]{36})\/caller-react(\/preview|\/native-compilation|\/native-operation|\/source-frame)?$/.exec(route);
    if (callerReact) {
      try {
        if (!['GET', ...(['/native-operation', '/source-frame'].includes(callerReact[3] ?? '') ? ['POST'] : [])].includes(req.method ?? '') || Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'] ||
            !native || !reference || reference.id !== callerReact[1] || !reactReferenceUnchanged(reference))
          throw Error('react-caller-request-invalid');
        if (callerReact[3] === '/source-frame') {
          const request = native().jobs.reactRequest(callerReact[2]);
          if (request.referenceId !== reference.id || request.caseId !== 'card-composed')
            throw Error('react-caller-source-frame-mismatch');
          const frame = req.method === 'POST'
            ? await frames.create(reference.id, callerReact[2])
            : frames.read(reference.id, callerReact[2]);
          if (!reactReferenceUnchanged(reference)) throw Error('react-caller-source-changed');
          json(res, 200, { frame }); return;
        }
        const current = callerGraph(callerReact[2]);
        const { graph } = current;
        const { draft } = graph;
        if (callerReact[3] === '/native-compilation') {
          const { report } = compileReactCallerNative(graph);
          if (!reactReferenceUnchanged(current.current)) throw Error('react-caller-source-changed');
          json(res, 200, { compilation: report }); return;
        }
        if (callerReact[3] === '/native-operation') {
          const compilation = compileReactCallerNative(graph);
          const selected: ReactCallerNativeRequest = { version: 1, kind: 'react-caller-graph-draft',
            referenceId: current.request.referenceId, parentOperationId: callerReact[2], ownership: current.request.ownership,
            inventorySha256: current.request.inventorySha256, caseId: current.request.caseId,
            graphRevision: compilation.report.graphRevision };
          const operation = req.method === 'POST' ? native().jobs.prepare(selected)
            : native().jobs.forBaseline(reactCallerNativeReservation(selected));
          json(res, 200, { operation, connection: operation ? native().transport.status(operation.id, Date.now()) : null }); return;
        }
        if (!callerReact[3]) { json(res, 200, { draft }); return; }
        const output = await buildReactCallerPreview(repoRoot, draft);
        if (!reactReferenceUnchanged(current.current)) throw Error('react-caller-source-changed');
        res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'; sandbox allow-scripts");
        res.end(reactReferenceHtml({ ...current.current, ...output }));
      } catch { json(res, 409, { error: 'Generated composition unavailable. Unchanged source, saved content relationships and compatible behavior observations are required.' }); }
      return;
    }
    const behaviorPreview = /^react\/([a-f0-9]{64})\/behavior-preview\/([a-z-]+)$/.exec(route);
    if (behaviorPreview) {
      try {
        if (req.method !== 'GET' || Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'])
          throw Error('react-behavior-preview-request-invalid');
        const draft = callbacks.read(behaviorPreview[1], behaviorPreview[2])?.draft;
        if (!draft) throw Error('react-behavior-preview-draft-unavailable');
        const output = await buildReactBehaviorPreview(repoRoot, draft);
        if (!reference || reference.id !== behaviorPreview[1] || !reactReferenceUnchanged(reference)) throw Error('react-behavior-preview-source-changed');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'; sandbox allow-scripts");
        res.end(reactReferenceHtml({ ...reference, ...output }));
      } catch {
        json(res, 409, { error: 'Generated React preview unavailable. A current verified behavior draft is required.' });
      }
      return;
    }
    const callbackRoute = /^react\/([a-f0-9]{64})\/callback-behavior\/([a-z-]+)$/.exec(route);
    if (callbackRoute) {
      try {
        if (!['GET', 'POST'].includes(req.method ?? '')) throw Error('callback-method-invalid');
        if (Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding']) {
          json(res, 400, { error: 'This action accepts no request body.' }); return;
        }
        if (req.method === 'POST') {
          const job = callbacks.start(callbackRoute[1], callbackRoute[2]);
          void job.promise.catch(() => {});
          json(res, 200, { inspection: job.state });
        } else json(res, 200, { inspection: callbacks.read(callbackRoute[1], callbackRoute[2]) ?? null });
      } catch { json(res, 409, { error: 'Callback inspection unavailable. Load unchanged originals and use the saved structure observation first.' }); }
      return;
    }
    const initialRoute = /^react\/([a-f0-9]{64})\/initial-states\/([a-z-]+)(?:\/([a-f0-9-]{36})\/(\d+)\.png)?$/.exec(route);
    if (initialRoute) {
      try {
        if (initialRoute[3] && req.method === 'GET') {
          const bytes = initialStates.image(initialRoute[1], initialRoute[2], initialRoute[3], initialRoute[4]);
          res.setHeader('Content-Type', 'image/png'); res.setHeader('Cache-Control', 'no-store'); res.end(bytes);
        } else if (!initialRoute[3] && ['GET','POST'].includes(req.method ?? '')) {
          if (req.method === 'POST') void initialStates.start(initialRoute[1], initialRoute[2]).promise.catch(() => {});
          json(res, 200, { inspection: initialStates.read(initialRoute[1], initialRoute[2]) ?? null });
        } else throw Error('react-initial-method-invalid');
      } catch { json(res, 409, { error: 'Initial-state inspection unavailable. Load unchanged originals and prepare a supported root from the same saved structure observation first.' }); }
      return;
    }
    const typography = /^react\/([a-f0-9]{64})\/native-operation\/([a-f0-9-]{36})\/source-typography$/.exec(route);
    if (typography && req.method === 'POST') {
      try {
        if (!native || !reference || reference.id !== typography[1] || !reactReferenceUnchanged(reference))
          throw Error('react-source-typography-reference-unavailable');
        const request = native().jobs.reactSourceRequest(typography[2]);
        if (request.referenceId !== reference.id) throw Error('react-source-typography-reference-mismatch');
        const input = loadReactFrameInput(repoRoot, reference, request);
        const measured = await measureReactSourceTypography(input);
        if (!reactReferenceUnchanged(reference) || loadReactFrameInput(repoRoot, reference, request).sourceSha256 !== measured.sourceSha256)
          throw Error('react-source-typography-source-changed');
        json(res, 200, { typography: measured });
      } catch { json(res, 409, { error: 'Original typography could not be measured unchanged. Mixed text and nested inline content are not yet supported by this diagnostic.' }); }
      return;
    }
    const initialImage = /^react\/([a-f0-9]{64})\/native-operation\/([a-f0-9-]{36})\/initial-source\/(\d+)\.png$/.exec(route);
    if (initialImage && req.method === 'GET') {
      try {
        if (!native || !reference || reference.id !== initialImage[1]) throw Error('react-initial-reference-unavailable');
        const bytes = initialStates.nativeImage(reference, native().jobs.reactInitialRequest(initialImage[2]), initialImage[3]);
        res.setHeader('Content-Type', 'image/png'); res.setHeader('Cache-Control', 'no-store'); res.end(bytes);
      } catch { json(res, 409, { error: 'Pinned original state image unavailable or changed.' }); }
      return;
    }
    const framedImage = /^react\/([a-f0-9]{64})\/native-operation\/([a-f0-9-]{36})\/source-frame\/([a-f0-9]{64})\.png$/.exec(route);
    if (framedImage && req.method === 'GET') {
      try {
        const bytes = frames.image(framedImage[1], framedImage[2], framedImage[3]);
        res.setHeader('Content-Type', 'image/png'); res.setHeader('Cache-Control', 'no-store'); res.end(bytes);
      } catch { json(res, 409, { error: 'Original source framing unavailable or changed.' }); }
      return;
    }
    const originalImage = /^react\/([a-f0-9]{64})\/native-operation\/([a-f0-9-]{36})\/source\.png$/.exec(route);
    if (originalImage && req.method === 'GET') {
      try {
        if (!reference || reference.id !== originalImage[1] || !native) throw Error('source unavailable');
        const request = native().jobs.reactSourceRequest(originalImage[2]);
        const evidence = readReactNativeContentEvidence(repoRoot, reference, request);
        const bytes = readFileSync(path.join(repoRoot, 'private/react-source-ownership', request.referenceId, request.ownership.id, request.caseId, 'source.png'));
        if (sha(bytes) !== evidence.captured.sourcePngSha256) throw Error('source image changed');
        res.setHeader('Content-Type', 'image/png'); res.setHeader('Cache-Control', 'no-store'); res.end(bytes);
      } catch { json(res, 409, { error: 'Original source image unavailable or changed.' }); }
      return;
    }
    const initialNativeRoute = /^react\/([a-f0-9]{64})\/native-initial\/([a-z-]+)$/.exec(route);
    const nativeRoute = /^react\/([a-f0-9]{64})\/native(?:\/([a-z-]+))?$/.exec(route);
    const childRoute = /^react\/([a-f0-9]{64})\/native-operation\/([a-f0-9-]{36})\/child\/([a-z][a-z0-9-]{0,79})$/.exec(route);
    const caseComparisonRoute = /^react\/([a-f0-9]{64})\/native-operation\/([a-f0-9-]{36})\/compare-case\/([a-z-]+)$/.exec(route);
    const nativeAction = /^react\/([a-f0-9]{64})\/native-operation\/([a-f0-9-]{36})\/(connection|start|retry-observation|content|comparison|source-frame|update-plan|resume-comparison|repair-comparison|adopt-source)$/.exec(route);
    const updateAction = /^react\/([a-f0-9]{64})\/native-operation\/([a-f0-9-]{36})\/update\/([a-f0-9]{64})\/(prepare|connection|start|retry-observation)$/.exec(route);
    const updateImage = /^react\/([a-f0-9]{64})\/native-operation\/([a-f0-9-]{36})\/update\/([a-f0-9]{64})\/images\/([a-f0-9]{64})\.png$/.exec(route);
    if (nativeRoute || nativeAction || initialNativeRoute || updateAction || updateImage || childRoute || caseComparisonRoute) {
      try {
        if (!native || !reference || reference.id !== (nativeRoute ?? nativeAction ?? initialNativeRoute ?? updateAction ?? updateImage ?? childRoute ?? caseComparisonRoute)![1]) throw Error('react-native-reference-unavailable');
        const { jobs, transport } = native();
        if (updateImage) {
          const { updateJobs }=native();
          if(req.method!=='GET' || !updateJobs || jobs.reactIdentity(updateImage[2]).referenceId!==reference.id) throw Error('react-update-image-refused');
          const png=updateJobs.imageForProposal(updateImage[2],updateImage[3],updateImage[4]);
          res.writeHead(200,{'Content-Type':'image/png','Content-Length':png.length,'Cache-Control':'no-store'});res.end(png);return;
        }
        if (req.method === 'POST') {
          if (Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'])
            throw Error('react-native-body-refused');
          if (caseComparisonRoute) {
            const [, , parentId, caseId] = caseComparisonRoute;
            const parent = jobs.verifiedReactObservation(parentId);
            const source = selectReactComparisonCase(repoRoot, reference, parent.request, caseId);
            const existing = jobs.listReact(reference.id).find(row => row.kind === 'comparison' &&
              row.parentOperationId === parentId && row.caseId === caseId && row.ownershipId === source.ownership.id);
            if (!existing) {
              const scope = reactComparisonContentScope(parentId, source);
              let inspected = readReactContentInspection(repoRoot, reference, source, scope);
              if (!inspected || inspected.phase !== 'complete') {
                let job = contentJobs.get(scope);
                if (!job || job.state.phase !== 'running') {
                  job = startReactContentInspection(repoRoot, reference, source, scope);
                  contentJobs.set(scope, job);
                }
                await job.promise;
                inspected = job.report();
              }
              if (inspected.phase !== 'complete' || !inspected.sourceUnchanged) throw Error('react-comparison-content-unavailable');
              const composition = readReactCompositionEvidence(repoRoot, reference, source, scope, jobs, undefined, initialStates.nativeEvidence);
              const selected = selectReactComparisonRequest(repoRoot, reference, source, scope, composition);
              const prepared = jobs.prepare({ ...selected, version: 3, parentOperationId: parentId, mainRoot: parent.request });
              await frames.create(reference.id, prepared.id);
            } else if (!existing.operation.sourceCurrent) throw Error('react-comparison-source-changed');
          } else if (childRoute) {
            const parent = jobs.reactRequest(childRoute[2]);
            if (parent.referenceId !== reference.id) throw Error('react-child-parent-source-mismatch');
            const composition = readReactCompositionEvidence(repoRoot, reference, parent, childRoute[2], jobs, undefined, initialStates.nativeEvidence);
            const review = composition.review;
            const existing = jobs.listReact(reference.id, 'root').find(row => row.kind === 'nested' &&
              row.caseId === parent.caseId && row.ownershipId === parent.ownership.id && row.nestedInstanceId === childRoute[3]);
            if (!existing && !review.rows.find(r => r.instanceId === childRoute[3])?.canPrepareMain)
              throw Error('react-child-root-preparation-unavailable');
            const constraints=composition.inspection.gridConstraints?.status==='observed' && composition.inspectionSelection
              ? {operationId:childRoute[2],...composition.inspectionSelection} : undefined;
            jobs.prepare(existing ? jobs.reactRequest(existing.operation.id)
              : selectReactChildRequest(repoRoot, reference, parent, childRoute[3], constraints));
          } else if (updateAction) {
            const { updateJobs, updateTransport }=native();
            const [, , parentId, proposalId, action]=updateAction;
            if(!updateJobs || !updateTransport || jobs.reactIdentity(parentId).referenceId!==reference.id) throw Error('react-update-unavailable');
            const update=action==='prepare'?updateJobs.prepare(parentId,proposalId):updateJobs.forProposal(parentId,proposalId);
            if(!update) throw Error('react-update-unavailable');
            if(action==='connection') {
              if(new URL(`http://${req.headers.host}`).port!=='5181') throw Error('react-native-pairing-port');
              json(res,200,{connection:updateTransport.pair(update.id)});return;
            }
            if(action==='start') updateTransport.start(update.id);
            if(action==='retry-observation') updateTransport.retryObservation(update.id);
          } else if (initialNativeRoute) {
            jobs.prepare(initialStates.nativeRequest(reference.id, initialNativeRoute[2]));
          } else if (nativeRoute?.[2]) {
            const job = ownershipJobs.get(reference.id);
            if (!job) throw Error('react-native-observation-required');
            const report = job.report();
            const existing = jobs.listReact(reference.id).find(row => row.kind === 'root' && row.caseId === nativeRoute[2] && row.ownershipId === report.id);
            if (existing) jobs.get(existing.operation.id);
            else jobs.prepare({ ...selectReactNativeRequest(repoRoot, report, nativeRoute[2]), compilation: 'current' });
          } else if (nativeAction?.[3] === 'adopt-source') {
            // The one action addressed to an operation that follows ANOTHER
            // source revision: record that it now follows this one. Nothing is
            // written to Figma; the next update review compiles the difference.
            const id = nativeAction[2], { successions, updateJobs } = native();
            if (!successions || !updateJobs) throw Error('react-source-succession-unavailable');
            const original = jobs.reactSuccessionSubject(id);
            // A written correction must settle against the inputs it was planned from.
            if (updateJobs.updateHistory(id).some(entry => entry.pending || entry.phase !== 'update-verified'))
              throw Error('react-source-succession-update-unresolved');
            let successor: ReactNativeRequest | ReactInitialNativeRequest;
            if (original.kind === 'react-initial-draft')
              successor = initialStates.nativeRequest(reference.id, original.caseId, original.version === 2 ? original.instanceId : undefined);
            else {
              const job = ownershipJobs.get(reference.id);
              if (!job) throw Error('react-native-observation-required');
              successor = selectReactNativeRequest(repoRoot, job.report(), original.caseId);
            }
            // Only a sealed observation readable from the live, unchanged source qualifies.
            if (successor.kind === 'react-initial-draft') initialStates.nativeEvidence(reference, successor);
            else readReactNativeEvidence(repoRoot, reference, successor);
            successions.adopt(id, original, successor);
          } else if (nativeAction) {
            const id = nativeAction[2];
            if (jobs.reactIdentity(id).referenceId !== reference.id) throw Error('react-native-operation-mismatch');
            if (nativeAction[3] === 'connection') {
              if (new URL(`http://${req.headers.host}`).port !== '5181') throw Error('react-native-pairing-port');
              json(res, 200, { connection: transport.pair(id) }); return;
            }
            if (nativeAction[3] === 'update-plan') {
              const updates = native().updates;
              if (!updates) throw Error('react-update-planning-unavailable');
              updates.prepare(id);
            } else if (nativeAction[3] === 'content') {
              if (contentJobs.get(id)?.state.phase !== 'running') {
                const job = startReactContentInspection(repoRoot, reference, jobs.reactRequest(id), id);
                contentJobs.set(id, job);
                void job.promise.catch(() => { job.state.phase = 'failed'; job.state.problems = ['react-content-evidence-unavailable']; });
              }
            } else if (nativeAction[3] === 'source-frame') {
              await frames.create(reference.id, id);
            } else if (nativeAction[3] === 'comparison') {
              jobs.verifiedReactObservation(id);
              jobs.prepare(selectReactComparisonRequest(repoRoot, reference, jobs.reactRequest(id), id, readReactCompositionEvidence(repoRoot, reference, jobs.reactRequest(id), id, jobs, undefined, initialStates.nativeEvidence)));
            } else if (nativeAction[3] === 'repair-comparison') jobs.dispatch(id,'comparison-repair-preflight-readback');
            else if (nativeAction[3] === 'resume-comparison') jobs.dispatch(id,'comparison-recovery-readback');
            else if (nativeAction[3] === 'retry-observation') transport.retryObservation(id);
            else transport.start(id);
          } else throw Error('react-native-action-invalid');
        } else if (req.method !== 'GET' || !nativeRoute || nativeRoute[2]) throw Error('react-native-action-invalid');
        const observedAt = Date.now();
        json(res, 200, { moved: jobs.listReactMoved(reference.id), operations: withEvidenceReadSnapshot(() => jobs.withReadSnapshot(() => jobs.listReact(reference!.id).map(row => {
          let content;
          let composition, compositionProblem;
          let sourceFrame, sourceFrameProblem, initialStates: Array<{ observation: string; variant: string; frame?: import('./source-framing.js').SourceFrame }> | undefined;
          if (row.kind === 'initial') {
            // A corrected compiler plan differs from creation without changing
            // its pinned source archive. Authenticate that archive separately.
            try { const evidence = thisInitialEvidence(jobs.reactInitialRequest(row.operation.id));
              initialStates = evidence.draft.nativeVariants.map(state => ({ ...state, frame: evidence.frames[state.observation] })); }
            catch { /* Image endpoints independently refuse unavailable source. */ }
          }
          if (row.kind === 'comparison') {
            try { sourceFrame = frames.read(reference!.id, row.sourceOperationId!); }
            catch { sourceFrameProblem = 'Original source framing unavailable or changed.'; }
          }
          if (row.kind === 'root') {
            const id = row.operation.id, running = contentJobs.get(id);
            try {
              if (running && running.state.phase !== 'complete') content = running.report();
              else {
                try {
                  // The composition reader authenticates and returns the saved
                  // inspection too. Do not read the same sealed archive twice.
                  const evidence = readReactCompositionEvidence(repoRoot, reference!, jobs.reactRequest(id), id, jobs, undefined, (_reference, request) => thisInitialEvidence(request));
                  if (running && evidence.inspection.id !== running.state.id) throw Error('react-content-persistence-pending');
                  content = evidence.inspection; composition = evidence.review;
                } catch {
                  content = running?.report() ?? readReactContentInspection(repoRoot, reference!, jobs.reactRequest(id), id);
                  if (content?.phase === 'complete' && content.content?.status === 'compiled-comparison-draft')
                    compositionProblem = 'Nested component evidence is unavailable or changed. Reload the unchanged original and inspect its content.';
                }
              }
            } catch { content = { phase: 'failed', sourceUnchanged: false, problems: ['react-content-evidence-unavailable'] }; }
          }
          let sourceRevisions: string[] | undefined;
          if (row.kind === 'root' || row.kind === 'initial')
            try { sourceRevisions = native().successions?.history(row.operation.id, jobs.reactSuccessionSubject(row.operation.id)); }
            catch { /* An unreadable succession journal already fails identity above. */ }
          return { ...row, content, composition, compositionProblem, sourceFrame, sourceFrameProblem, initialStates, sourceRevisions,
            updates: (native().updates?.list(row.operation.id) ?? []).map(proposal => {
              const operation=native().updateJobs?.forProposal(row.operation.id,proposal.id);
              return {...proposal, operation, connection:operation?native().updateTransport?.status(operation.id,observedAt):undefined};
            }), connection: transport.status(row.operation.id, observedAt) };
        }))) });
      } catch (error) {
        // Refuse by name. Only identifier-shaped reasons leave the host: no
        // paths, no file contents, no free text from a dependency.
        const message = error instanceof Error ? error.message : '';
        const reason = /^[a-z][a-z0-9-]{2,100}(?::[A-Za-z0-9:;._-]{1,80})?$/.test(message) ? message : undefined;
        json(res, 409, { error: 'Native inspection unavailable. Load unchanged originals and complete a sealed structure observation before preparing a new draft. Existing operations retain their identity; inspect their state before retrying.', ...(reason ? { reason } : {}) });
      }
      return;
    }
    if (route === "react" && req.method === "POST") {
      if (
        Number(req.headers["content-length"] ?? 0) > 0 ||
        req.headers["transfer-encoding"]
      ) {
        json(res, 400, { error: "This action accepts no request body." });
        return;
      }
      try {
        loading ??= buildReactReference(sourceRoot);
        reference = await loading;
        if (!reactReferenceUnchanged(reference))
          throw Error("react-reference-source-changed");
        const dir = path.join(
          repoRoot,
          "private/react-source-references",
          reference.id,
        );
        mkdirSync(dir, { recursive: true });
        for (const [name, bytes] of Object.entries({
          "reference.html": reactReferenceHtml(reference),
          "provenance.json":
            JSON.stringify(
              {
                version: 1,
                id: reference.id,
                sourceRoot,
                files: reference.files,
                entrySha256: sha(reactReferenceEntry),
                qualification: "unqualified",
                cases: reactReferenceCases,
              },
              null,
              2,
            ) + "\n",
        })) {
          try {
            writeFileSync(path.join(dir, name), bytes, { flag: "wx" });
          } catch (e) {
            if (
              (e as NodeJS.ErrnoException).code !== "EEXIST" ||
              readFileSync(path.join(dir, name), "utf8") !== bytes
            )
              throw e;
          }
        }
        json(res, 200, {
          id: reference.id,
          source: "shadcn source sandbox",
          theme: "Light (sandbox stylesheet)",
          sourceFiles: Object.keys(reference.files).length,
          qualification: "unqualified",
          validation: validations.get(reference.id)?.report() ?? null,
          ownership: savedOwnership(reference)?.report() ?? null,
          cases: reactReferenceCases.map((c) => ({
            ...c,
            url: `/api/source-reference/react/${reference!.id}?case=${c.id}`,
          })),
        });
      } catch {
        json(res, 409, {
          error:
            "React originals unavailable or changed. Configure DS_CONTRACTS_REACT_SOURCE_ROOT with the existing shadcn source sandbox and its installed dependencies; source files are never modified by this action.",
        });
      } finally {
        loading = undefined;
      }
      return;
    }
    const programRoute = /^react\/([a-f0-9]{64})\/program$/.exec(route);
    if (
      programRoute &&
      reference?.id === programRoute[1] &&
      req.method === "POST"
    ) {
      if (
        Number(req.headers["content-length"] ?? 0) > 0 ||
        req.headers["transfer-encoding"]
      ) {
        json(res, 400, { error: "This action accepts no request body." });
        return;
      }
      try {
        if (!reactReferenceUnchanged(reference)) throw Error("source-changed");
        const root = realpathSync(sourceRoot);
        const modules = Object.keys(reference.files)
          .filter(
            (file) =>
              file.startsWith(path.join(root, "src") + path.sep) &&
              file.endsWith(".tsx"),
          )
          .map((file) => path.relative(root, file));
        if (!modules.length) throw Error("component-modules-unavailable");
        const program = readReactSourceProgram(root, modules);
        if (
          !reactReferenceUnchanged(reference) ||
          !reactSourceProgramUnchanged(program)
        )
          throw Error("source-changed");
        const proposal = proposeReactSourceProgram(
          program,
          modules.map((module) => ({
            sourcePath: module,
            source: readFileSync(path.join(root, module), "utf8"),
            css: "",
          })),
        );
        if (
          !reactReferenceUnchanged(reference) ||
          !reactSourceProgramUnchanged(program)
        )
          throw Error("source-changed");
        const record = {
          version: 2,
          referenceId: reference.id,
          program,
          proposal,
        };
        const bytes = JSON.stringify(record, null, 2) + "\n";
        const id = sha(bytes);
        const dir = path.join(
          repoRoot,
          "private/react-source-programs",
          reference.id,
        );
        mkdirSync(dir, { recursive: true });
        const file = path.join(dir, id + ".json");
        try {
          writeFileSync(file, bytes, { flag: "wx" });
        } catch (error) {
          if (
            (error as NodeJS.ErrnoException).code !== "EEXIST" ||
            readFileSync(file, "utf8") !== bytes
          )
            throw error;
        }
        json(res, 200, {
          id,
          referenceId: reference.id,
          status: program.status,
          compatibilityNotes: program.compatibilityNotes,
          acceptedContract: null,
          sourceFiles: Object.keys(program.files).length,
          components: program.components,
          proposal,
          problems: program.problems,
        });
      } catch {
        json(res, 409, {
          error:
            "Source APIs could not be read from unchanged installed source and declarations. Reload originals before trying again.",
        });
      }
      return;
    }
    const ownershipRoute = /^react\/([a-f0-9]{64})\/ownership$/.exec(route);
    if (ownershipRoute && reference?.id === ownershipRoute[1]) {
      if (req.method === "POST") {
        if (
          Number(req.headers["content-length"] ?? 0) > 0 ||
          req.headers["transfer-encoding"]
        ) {
          json(res, 400, { error: "This action accepts no request body." });
          return;
        }
        try {
          let job = ownershipJobs.get(reference.id);
          if (job?.state.state !== "running") {
            job = startReactOwnership(
              reference,
              realpathSync(sourceRoot),
              path.join(repoRoot, "private/react-source-ownership"),
            );
            ownershipJobs.set(reference.id, job);
            void job.promise.catch(() => {
              job!.state.state = "failed";
              job!.state.matched = 0;
              job!.state.problem = "react-ownership-evidence-unavailable";
              for (const row of job!.state.rows) row.matched = false;
            });
          }
          json(res, 202, job.report());
        } catch {
          json(res, 409, {
            error:
              "React structure observation unavailable: original source or installed declarations changed.",
          });
        }
        return;
      }
      const job = savedOwnership(reference);
      if (req.method === "GET" && job) {
        json(res, 200, job.report());
        return;
      }
      json(res, 404, { error: "No structure observation for this reference." });
      return;
    }
    const propertyImage = /^react\/([a-f0-9]{64})\/ownership\/([a-f0-9-]{36})\/([a-z-]+)\/matrix\/(\d+)\/([a-f0-9]{64})\.png$/.exec(route);
    if (req.method === "GET" && propertyImage) {
      const [, referenceId, jobId, caseId, index, hash] = propertyImage;
      const job = ownershipJobs.get(referenceId), report = job?.report();
      const row = report?.rows.find(r=>r.id===caseId), effect = row?.propertyMatrix?.rows.find(r=>r.id===index);
      if(job?.state.id!==jobId || report?.state!=="complete" || !row?.matched || effect?.status!=="observed" || effect.image!==hash) {
        json(res,404,{error:"Verified property image unavailable."}); return;
      }
      try {
        const bytes=readFileSync(path.join(job!.dir,caseId,"matrix",index+".png"));
        if(sha(bytes)!==hash)throw Error("changed");
        res.setHeader("Content-Type","image/png"); res.setHeader("Cache-Control","no-store");
        res.setHeader("Cross-Origin-Resource-Policy","same-origin"); res.end(bytes);
      } catch {json(res,409,{error:"Recorded property image changed."});}
      return;
    }
    const ownershipImage =
      /^react\/([a-f0-9]{64})\/ownership\/([a-f0-9-]{36})\/([a-z-]+)\/(source|observed)\/([a-f0-9]{64})\.png$/.exec(
        route,
      );
    if (req.method === "GET" && ownershipImage) {
      const [, referenceId, jobId, caseId, side, hash] = ownershipImage;
      const job = ownershipJobs.get(referenceId),
        report = job?.report(),
        row = report?.rows.find((r) => r.id === caseId);
      const expected =
        side === "source" ? row?.sourceImage : row?.observedImage;
      if (
        job?.state.id !== jobId ||
        !row?.matched ||
        report?.state !== "complete" ||
        expected !== hash
      ) {
        json(res, 404, { error: "Verified structure image unavailable." });
        return;
      }
      try {
        const bytes = readFileSync(path.join(job!.dir, caseId, side + ".png"));
        if (sha(bytes) !== hash) throw Error("changed");
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
        res.end(bytes);
      } catch {
        json(res, 409, { error: "Recorded structure image changed." });
      }
      return;
    }
    const validationRoute = /^react\/([a-f0-9]{64})\/validate$/.exec(route);
    if (validationRoute && reference?.id === validationRoute[1]) {
      if (req.method === "POST") {
        if (
          Number(req.headers["content-length"] ?? 0) > 0 ||
          req.headers["transfer-encoding"]
        ) {
          json(res, 400, { error: "This action accepts no request body." });
          return;
        }
        try {
          let job = validations.get(reference.id);
          if (job?.state.state !== "running") {
            job = startReactValidation(
              reference,
              new URL(`http://${req.headers.host}`).origin,
              path.join(repoRoot, "private/react-source-validations"),
            );
            validations.set(reference.id, job);
            void job.promise.catch(() => {
              job!.state.state = "failed";
              job!.state.valid = 0;
              for (const row of job!.state.rows) row.sourceValid = false;
              job!.state.problem = "validation-evidence-unavailable";
            });
          }
          json(res, 202, job.report());
        } catch {
          json(res, 409, {
            error:
              "Source or readiness witnesses changed. Reload originals; new source versions require reviewed witnesses.",
          });
        }
        return;
      }
      const job = validations.get(reference.id);
      if (req.method === "GET" && job) {
        json(res, 200, job.report());
        return;
      }
      json(res, 404, { error: "No validation for this reference." });
      return;
    }
    const imageRoute =
      /^react\/([a-f0-9]{64})\/([a-f0-9-]{36})\/([a-z-]+)\/(source|replay)\/([a-f0-9]{64})\.png$/.exec(
        route,
      );
    if (req.method === "GET" && imageRoute) {
      const [, referenceId, jobId, caseId, side, hash] = imageRoute;
      const job = validations.get(referenceId);
      const row = job?.state.rows.find((r) => r.id === caseId);
      const expected = side === "source" ? row?.sourceImage : row?.replayImage;
      if (job?.state.id !== jobId || !expected || expected !== hash) {
        json(res, 404, { error: "Recorded source image not found." });
        return;
      }
      try {
        const bytes = readFileSync(path.join(job.dir, caseId, side + ".png"));
        if (sha(bytes) !== hash) throw Error("changed");
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
        res.end(bytes);
      } catch {
        json(res, 409, {
          error: "Recorded source image changed or unavailable.",
        });
      }
      return;
    }
    const match = /^react\/([a-f0-9]{64})$/.exec(route);
    const caseId = new URL(req.url ?? "", "http://localhost").searchParams.get(
      "case",
    );
    if (
      req.method !== "GET" ||
      !match ||
      reference?.id !== match[1] ||
      !reactReferenceCases.some((c) => c.id === caseId)
    ) {
      json(res, 404, {
        error: "React reference not found. Load originals in the application.",
      });
      return;
    }
    if (!reactReferenceUnchanged(reference)) {
      json(res, 409, {
        error:
          "React source changed. Load a new reference before inspecting it.",
      });
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'; sandbox allow-scripts",
    );
    res.end(reactReferenceHtml(reference));
  };
  return Object.assign(handle, {
    initialNativeEvidence(request: ReactInitialNativeRequest, identity?: string) {
      if (!reference) throw Error('react-initial-native-reference-unavailable');
      return initialStates.nativeEvidence(reference, request, identity);
    },
    refreshComparisonEvidence(request: ReactComparisonRequest, parent: Parameters<typeof readReactComparisonEvidence>[3]) {
      if (!reference) throw Error('react-native-reference-unavailable');
      return refreshReactComparisonEvidence(repoRoot, reference, request, parent, request.composition
        ? readReactCompositionEvidence(repoRoot, reference, request.root, reactComparisonContentOperation(request), native!().jobs,
          { id: request.content.id, inventorySha256: request.content.inventorySha256 }, initialStates.nativeEvidence) : undefined);
    },
    comparisonEvidence(request: ReactComparisonRequest, parent: Parameters<typeof readReactComparisonEvidence>[3]) {
      if (!reference) throw Error('react-native-reference-unavailable');
      return readReactComparisonEvidence(repoRoot, reference, request, parent, request.composition
        ? readReactCompositionEvidence(repoRoot, reference, request.root, reactComparisonContentOperation(request), native!().jobs,
          { id: request.content.id, inventorySha256: request.content.inventorySha256 }, initialStates.nativeEvidence) : undefined);
    },
    nativeEvidence(request: ReactNativeRequest) {
      if (!reference) throw Error('react-native-reference-unavailable');
      return readReactNativeEvidence(repoRoot, reference, request);
    },
    callerNativeEvidence,
    close() {
      for (const job of validations.values()) job.close();
      for (const job of ownershipJobs.values()) job.close();
    },
  });
}
