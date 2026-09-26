/** Host-authenticated, observation-specific content authority. This module does
 * not accept a browser-supplied forwarding flag or mutate source-program facts.
 * The host must anchor restored artifacts to its existing sealed report first. */
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { revisionOf } from "../core/contract-provenance.js";
import { evidenceSha } from "./react-validation-evidence.js";
import type { CapturedNode } from "../extract/computed/lib.js";
import type { ReactSourceProgram } from "./react-source-program.js";
import { reactOwnershipStructure, type ReactOwnership } from "./react-ownership.js";
import type { ReactHelperObservation } from "./react-helper-observation.js";
import type {
  ReactComponentEffects,
  ReactHelperEffects,
} from "./react-helper-effects.js";
import type { ReactHelperRuntimeReport } from "./react-helper-runtime.js";
import type { ReactHelperInstrumentationPlan } from "./react-helper-instrument.js";

export interface ReactContextualContent {
  readonly version: 1;
  readonly revision: string;
}
export interface ReactContextualContentFact {
  instanceId: string;
  tag: string;
  helperId: string;
  modelSha256: string;
}
type Proof = {
  inputRevision: string;
  facts: ReactContextualContentFact[];
  inputs: Record<string, string>;
  artifacts: Array<{ helperId: string; name: string; sha256: string }>;
};
const authority = new WeakMap<
  ReactContextualContent,
  { proof: Proof; read: (id: string, name: string) => Buffer }
>();
const inputRevision = (
  program: ReactSourceProgram,
  ownership: ReactOwnership,
  tree: CapturedNode,
) => revisionOf({ program, ownership, tree });
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function fail(reason: string): never {
  throw Error("react-contextual-content-" + reason);
}
function current(inputs: Record<string, string>) {
  for (const [file, hash] of Object.entries(inputs))
    if (realpathSync(file) !== file || evidenceSha(readFileSync(file)) !== hash)
      fail("inputs-changed");
}

/** The callback reads only this observation's host-owned helper artifacts. For
 * a restored observation, the enclosing immutable inventory must already match
 * the hash retained by the operation journal. Fresh runner rows originate from
 * observeReactHelpers, whose digest fields are held in memory before sealing. */
export function readReactContextualContent(options: {
  referenceId: string;
  sourceRoot: string;
  program: ReactSourceProgram;
  ownership: ReactOwnership;
  tree: CapturedNode;
  helpers: readonly ReactHelperObservation[];
  read(helperId: string, name: string): Buffer;
}): ReactContextualContent {
  const { program, ownership, tree, helpers, read } = options;
  const facts: ReactContextualContentFact[] = [],
    inputs: Record<string, string> = {};
  const artifacts: Proof["artifacts"] = [];
  const ids = new Set<string>(),
    instances = new Set<string>();
  for (const helper of helpers) {
    if (
      helper.status !== "observed" ||
      helper.containingFlow?.status !== "observed" ||
      helper.containingFlow.content !== "forwarded"
    )
      continue;
    if (
      !/^helper-\d+$/.test(helper.id) ||
      ids.has(helper.id) ||
      instances.has(helper.instanceId)
    )
      fail("ambiguous-observation");
    ids.add(helper.id);
    instances.add(helper.instanceId);
    const evidence = helper.evidence;
    // Legacy helper-only receipts cannot silently acquire native authority.
    if (
      !evidence?.runtimeSha256 ||
      !evidence.buildSha256 ||
      !helper.inputs ||
      !Object.keys(helper.inputs).length
    )
      fail("proof-incomplete");
    current(helper.inputs);
    const artifact = (name: string) => {
      const bytes = read(helper.id, name);
      artifacts.push({ helperId: helper.id, name, sha256: evidenceSha(bytes) });
      return bytes;
    };
    const json = <T>(name: string, hash: string): T => {
      const bytes = artifact(name);
      if (!/^[a-f0-9]{64}$/.test(hash) || evidenceSha(bytes) !== hash)
        fail("artifact-changed");
      return JSON.parse(bytes.toString()) as T;
    };
    const model = json<ReactHelperEffects>("model.json", evidence.modelSha256);
    const containing = json<ReactComponentEffects>(
      "component-model.json",
      helper.containingFlow.modelSha256,
    );
    const runtime = json<ReactHelperRuntimeReport>(
      "runtime.json",
      evidence.runtimeSha256,
    );
    const plan = json<ReactHelperInstrumentationPlan>(
      "plan.json",
      evidence.planSha256,
    );
    const recordedOwnership = json<ReactOwnership>(
      "ownership.json",
      evidence.ownershipSha256,
    );
    // Each full observation is retained and hashed. Only factory-journal fields
    // differ between these two isolated observers; they grant no helper proof.
    // Older receipts without a paired observation still require exact equality.
    const pairedOwnership = evidence.pairedOwnershipSha256
      ? json<ReactOwnership>("paired-ownership.json", evidence.pairedOwnershipSha256)
      : recordedOwnership;
    const build = json<{
      originalReferenceId: string;
      guardedReferenceId: string;
      inputs: Record<string, string>;
    }>("build.json", evidence.buildSha256);
    const recordedTree = JSON.parse(artifact("tree.json").toString());
    if (
      !same(JSON.parse(artifact("report.json").toString()), helper) ||
      !same(pairedOwnership, ownership) ||
      !same(reactOwnershipStructure(recordedOwnership),reactOwnershipStructure(pairedOwnership)) ||
      !same(runtime, helper.runtime) ||
      !same(build.inputs, helper.inputs) ||
      build.originalReferenceId !== options.referenceId ||
      build.guardedReferenceId !== evidence.referenceId ||
      recordedTree.status !== "captured" ||
      recordedTree.problems.length ||
      !same(recordedTree.tree, tree) ||
      recordedTree.treeSha256 !== evidence.treeSha256 ||
      evidence.treeSha256 !== evidenceSha(JSON.stringify(tree)) ||
      recordedTree.sourcePngSha256 !== evidence.pngSha256 ||
      evidenceSha(artifact("observed.png")) !== evidence.pngSha256
    )
      fail("observation-mismatch");
    if (
      model.status !== "modeled" ||
      containing.status !== "modeled" ||
      runtime.status !== "observed" ||
      model.acceptedContract !== null ||
      containing.acceptedContract !== null ||
      model.runtimeVerified !== false ||
      containing.runtimeVerified !== false ||
      containing.content !== "forwarded" ||
      containing.output.kind !== "jsx" ||
      containing.output.tag.kind !== "host" ||
      containing.output.props.fields.find(([key]) => key === "children")?.[1]
        .kind !== "opaque" ||
      !same(model.input, containing.input) ||
      !same(plan.models, [model, containing]) ||
      !same(plan.component, containing.component) ||
      !same(plan.call, model.callSite) ||
      !same(plan.helper, model.instrumentation?.helper) ||
      !same(plan.metadata, model.instrumentation?.metadata)
    )
      fail("model-mismatch");
    if (
      !runtime.components?.length ||
      !runtime.events.length ||
      runtime.helperCalls !== runtime.events.length ||
      runtime.components.some(
        (e) =>
          e.context !== 0 ||
          e.content !== "forwarded" ||
          !Number.isInteger(e.helperCalls) ||
          e.helperCalls <= 0,
      ) ||
      runtime.components.reduce((n, e) => n + e.helperCalls, 0) !==
        runtime.helperCalls ||
      runtime.events.some((e) => e.context !== 0)
    )
      fail("invocation-unverified");
    const instance = ownership.components.find(
      (i) => i.id === helper.instanceId,
    );
    const source =
      instance &&
      program.components.find(
        (c) =>
          c.module === instance.source.module &&
          c.exportName === instance.source.exportName &&
          c.sourceSha256 === instance.source.sourceSha256 &&
          same(c.span, instance.source.span),
      );
    if (
      !instance ||
      !source ||
      source.implementation === "unresolved" ||
      instance.roots.length !== 1 ||
      containing.component.file !== source.module ||
      containing.component.sha256 !== source.sourceSha256 ||
      containing.component.start < source.span.start ||
      containing.component.end > source.span.end ||
      !source.helperCandidates?.some(
        (c) =>
          c.call.start === model.callSite?.start &&
          c.call.end === model.callSite.end,
      ) ||
      program.files[
        realpathSync(path.resolve(options.sourceRoot, source.module))
      ] !== source.sourceSha256
    )
      fail("source-mismatch");
    const fields = Object.entries(instance.props)
      .filter(
        ([key]) => !(key === "ref" && source.wrappers?.includes("forwardRef")),
      )
      .map(([key, value]) => [
        key,
        key === "children"
          ? { kind: "opaque" }
          : same(value, { kind: "undefined" })
            ? { kind: "literal", type: "undefined" }
            : { kind: "literal", type: typeof value, value },
      ]);
    if (
      !same(containing.input, { kind: "record", fields }) ||
      runtime.events.some(
        (e) =>
          !same(
            e.inputKeys,
            fields.map((f) => f[0]),
          ),
      )
    )
      fail("input-context-mismatch");
    for (const [file, hash] of Object.entries(helper.inputs)) {
      if (inputs[file] && inputs[file] !== hash)
        fail("input-identity-conflict");
      inputs[file] = hash;
    }
    facts.push({
      instanceId: instance.id,
      tag: containing.output.tag.name,
      helperId: helper.id,
      modelSha256: helper.containingFlow.modelSha256,
    });
  }
  const proof: Proof = {
    inputRevision: inputRevision(program, ownership, tree),
    facts,
    inputs,
    artifacts,
  };
  const capability = Object.freeze({
    version: 1 as const,
    revision: revisionOf(proof),
  });
  authority.set(capability, { proof, read });
  return capability;
}

/** A deserialized/forged capability is rejected. Its exact source/instance/tree
 * context must match, and engine/source inputs are checked again at consumption. */
export function verifiedReactContextualContent(
  capability: ReactContextualContent | undefined,
  program: ReactSourceProgram,
  ownership: ReactOwnership,
  tree: CapturedNode,
): readonly ReactContextualContentFact[] {
  if (!capability) return [];
  const entry = authority.get(capability);
  if (!entry) fail("authority-unavailable");
  const { proof, read } = entry;
  if (proof.inputRevision !== inputRevision(program, ownership, tree))
    fail("context-changed");
  current(proof.inputs);
  for (const artifact of proof.artifacts)
    if (evidenceSha(read(artifact.helperId, artifact.name)) !== artifact.sha256)
      fail("artifact-changed");
  return structuredClone(proof.facts);
}
