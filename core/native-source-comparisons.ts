/** Comparison instances use observed source content, never main defaults.
 * The host rederives the complete saved samples before supplying this input. */
import { canonicalJson, revisionOf } from "./contract-provenance.js";
import type { Contract } from "../scripts/contract-schema.js";
import type { ComponentData, NodeSpec } from "./emit-figma-script.js";
import type { NativeSourceCandidateProjection } from "./native-source-projection.js";

export interface NativeSourceSampleIdentity {
  caseId: string;
  sourceName: string;
  partPath: string[];
  sampleIds: string[];
  sampleRevision: string;
  specRevision: string;
  /** Within the compiled content sequence, not a source DOM path. */
  specPath: number[];
}
/** Structural subset of the server's full sample record. Its entire object,
 * including additional source/style/geometry fields, is pinned by revision. */
export interface NativeSourceComparisonInput {
  revision: string;
  samples: {
    version: 1;
    status: "comparison-samples-lowered" | "refused";
    acceptedContract: null;
    qualification: "comparison-instance-samples-only";
    nativeQualification: "unqualified";
    visualRevision: string;
    source: {
      revision: string;
      sourceSha256: string;
      sourceProgramSha256: string;
      semanticsRevision: string;
    };
    problems: string[];
    cases: Array<{
      id: string;
      status: "lowered" | "refused";
      sourceTreeSha256?: string;
      topologyObservationSha256?: string;
      problems: string[];
      slots: Array<{
        identity: {
          templateId: string;
          sourceNodeId: string;
          sourceSpan: unknown;
        };
        sourceName: string;
        status: "lowered" | "refused";
        sampleIds: string[];
        sampleRevision: string;
        specRevision?: string;
        specs: NodeSpec[];
        problems: string[];
      }>;
    }>;
  };
}

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const revision = /^sha256:[a-f0-9]{64}$/;
function fail(code: string): never {
  throw Error(`native-source-comparisons-${code}`);
}
const specKeys = new Set([
  "type",
  "name",
  "children",
  "layout",
  "lits",
  "characters",
  "fontSize",
  "fontStyle",
  "lineHeight",
  "textFillLit",
  "textCase",
  "textDecoration",
  "textAlignH",
  "fontFamily",
  "letterSpacing",
  "svg",
  "iconSize",
]);

export function prepareNativeSourceComparisons(
  contract: Contract,
  component: ComponentData,
  projection: NativeSourceCandidateProjection,
  input: NativeSourceComparisonInput,
) {
  const samples = input?.samples;
  if (
    !samples ||
    !revision.test(input.revision) ||
    revisionOf(samples) !== input.revision ||
    samples.version !== 1 ||
    samples.status !== "comparison-samples-lowered" ||
    samples.acceptedContract !== null ||
    samples.qualification !== "comparison-instance-samples-only" ||
    samples.nativeQualification !== "unqualified" ||
    samples.problems.length ||
    samples.visualRevision !== projection.evidence.visualRevision ||
    samples.source.revision !== projection.source.revision ||
    samples.source.sourceSha256 !== projection.source.sourceSha256 ||
    samples.source.sourceProgramSha256 !== projection.source.programSha256 ||
    samples.source.semanticsRevision !==
      projection.evidence.semanticsRevision ||
    !same(
      samples.cases.map((c) => c.id),
      projection.cases.map((c) => c.id),
    )
  )
    fail("source-or-coverage-changed");
  const fonts = new Map<string, { family: string; styles: string[] }>();
  const specs: NodeSpec[] = [];
  const nodeTypes = new Set<string>();
  let totalNodes = 0;
  const annotate = (
    spec: NodeSpec,
    identity: NativeSourceSampleIdentity,
  ): NodeSpec => {
    if (
      ++totalNodes > 4096 ||
      identity.specPath.length > 32 ||
      !spec ||
      !["frame", "text", "svg"].includes(spec.type) ||
      typeof spec.name !== "string" ||
      Object.entries(spec).some(
        ([key, value]) => value !== undefined && !specKeys.has(key),
      ) ||
      (spec.type !== "frame" && spec.children?.length) ||
      (spec.lits &&
        Object.keys(spec.lits).some((k) => !["width", "height"].includes(k))) ||
      (spec.layout &&
        (!["HORIZONTAL", "VERTICAL"].includes(spec.layout.mode) ||
          Object.keys(spec.layout).some(
            (k) =>
              !["mode", "primary", "counter", "stretchChildren"].includes(k),
          )))
    )
      fail("sample-grammar-refused");
    if (spec.type === "text") {
      if (
        typeof spec.characters !== "string" ||
        typeof spec.fontFamily !== "string" ||
        !spec.fontFamily ||
        typeof spec.fontStyle !== "string" ||
        !spec.fontStyle ||
        !Number.isFinite(spec.fontSize) ||
        !spec.textFillLit
      )
        fail("text-expectation-missing");
      // buildNode first assigns an Inter face, then resolves the actual family.
      // Both must be available before any page/node allocation.
      fonts.set(`Inter/${spec.fontStyle}`, {
        family: "Inter",
        styles: [spec.fontStyle],
      });
      if (spec.fontFamily !== "Inter")
        fonts.set(`${spec.fontFamily}/${spec.fontStyle}`, {
          family: spec.fontFamily,
          styles: [
            ...new Set([spec.fontStyle, spec.fontStyle.split(" ").join("")]),
          ],
        });
    }
    nodeTypes.add(spec.type);
    const out = JSON.parse(canonicalJson(spec)) as NodeSpec;
    out.nativeSourceSample = identity;
    if (spec.children)
      out.children = spec.children.map((child, i) =>
        annotate(child, { ...identity, specPath: [...identity.specPath, i] }),
      );
    return out;
  };
  const cases = projection.cases.map((sourceCase, index) => {
    const sample = samples.cases[index];
    if (sourceCase.status === "refused") {
      if (
        sample.status !== "refused" ||
        sample.slots.length ||
        !sample.problems.length
      )
        fail("refused-case-changed");
      return {
        id: sourceCase.id,
        status: "refused" as const,
        problems: [...new Set([...sourceCase.problems, ...sample.problems])],
      };
    }
    if (
      sample.status !== "lowered" ||
      sample.problems.length ||
      sample.sourceTreeSha256 !== sourceCase.sourceTreeSha256 ||
      sample.topologyObservationSha256 !== sourceCase.topologyObservationSha256
    )
      fail("case-source-changed");
    const properties = Object.fromEntries(
      contract.props.map((prop) => {
        const value = sourceCase.properties![prop.name];
        return [
          prop.bindings.figma.property!,
          value.kind === "omitted"
            ? prop.bindings.figma.unsetValue!
            : (prop.bindings.figma.values?.[String(value.value)] ??
              String(value.value)),
        ];
      }),
    );
    const variantName =
      Object.entries(properties)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ") || contract.name;
    if (component.variants.filter((v) => v.name === variantName).length !== 1)
      fail("variant-identity-ambiguous");
    const seen = new Set<string>();
    const slots = sample.slots.map((slot) => {
      const parts = projection.parts.filter(
        (part) =>
          part.kind === "slot" &&
          part.sourceSlotName === slot.sourceName &&
          part.templateId === slot.identity.templateId &&
          part.sourceNodeId === slot.identity.sourceNodeId &&
          same(part.sourceSpan, slot.identity.sourceSpan),
      );
      if (
        parts.length !== 1 ||
        slot.status !== "lowered" ||
        slot.problems.length ||
        !revision.test(slot.sampleRevision) ||
        slot.specRevision !== revisionOf(slot.specs) ||
        !Array.isArray(slot.sampleIds) ||
        new Set(slot.sampleIds).size !== slot.sampleIds.length ||
        slot.sampleIds.some((id) => typeof id !== "string" || !id)
      )
        fail("slot-source-changed");
      const part = parts[0],
        key = canonicalJson(part.partPath);
      if (seen.has(key)) fail("slot-duplicate");
      seen.add(key);
      const content = slot.specs.map((spec, i) =>
        annotate(spec, {
          caseId: sourceCase.id,
          sourceName: slot.sourceName,
          partPath: part.partPath,
          sampleIds: slot.sampleIds,
          sampleRevision: slot.sampleRevision,
          specRevision: slot.specRevision!,
          specPath: [i],
        }),
      );
      specs.push(...content);
      return {
        partPath: part.partPath,
        sourceName: slot.sourceName,
        specs: content,
      };
    });
    return {
      id: sourceCase.id,
      status: "lowered" as const,
      variantName,
      properties,
      wrappers: sourceCase.wrappers!,
      slots,
      problems: [],
    };
  });
  return {
    revision: input.revision,
    cases,
    fonts: [...fonts.values()],
    nodeTypes: [...nodeTypes].sort(),
    specs,
  };
}

/** Called inside buildSyncScript, sharing its buildNode. Instance source
 * nodes pair with the freshly created main's exact tree and full SLOT IDs;
 * inherited metadata, layer names and unstable instance child IDs are not keys. */
export const NATIVE_COMPARISONS_RUNTIME = `
async function nativeBuildComparisons(target, built) {
  if (!NATIVE.comparisons) nativeRefuse('comparison-context-missing');
  const board = figma.createFrame();
  NATIVE_RESULT.comparisonBoardId = board.id;
  nativeOwn(board);
  NATIVE_PAGE.appendChild(board);
  board.setExplicitVariableModeForCollection(NATIVE_COLLECTION, NATIVE.identity.modes[0].modeId);
  board.name = 'Observed source cases'; board.fills = [];
  board.layoutMode = 'VERTICAL'; board.primaryAxisSizingMode = 'AUTO'; board.counterAxisSizingMode = 'AUTO';
  board.itemSpacing = 24; board.x = target.width + 80; board.y = 0;
  NATIVE_RESULT.comparisons = [];
  for (const c of NATIVE.comparisons.cases) {
    nativeFileGuard();
    if (c.status === 'refused') { NATIVE_RESULT.comparisons.push({ id: c.id, status: 'refused', problems: c.problems }); continue; }
    const main = built.find(b => b.v.name === c.variantName).comp;
    if (nativeCanonical(main.variantProperties) !== nativeCanonical(c.properties)) nativeRefuse('comparison-variant-properties-mismatch');
    const inst = main.createInstance();
    const recorded = { id: c.id, status: 'building', instanceId: inst.id, mainId: main.id, sourceParts: [], slots: [] };
    NATIVE_RESULT.comparisons.push(recorded);
    nativeOwn(inst); board.appendChild(inst); inst.name = c.id;
    inst.setExplicitVariableModeForCollection(NATIVE_COLLECTION, NATIVE.identity.modes[0].modeId);
    if ((await inst.getMainComponentAsync()).id !== main.id) nativeRefuse('comparison-main-mismatch');
    const parts = new Map();
    function pair(source, node, root) {
      if ((root ? node.type !== 'INSTANCE' : node.type !== source.type) ||
          (source.children || []).length !== (node.children || []).length) nativeRefuse('comparison-tree-mismatch');
      const identity = JSON.parse(source.getSharedPluginData('ds_contracts', 'nativeSourcePart'));
      const key = nativeCanonical(identity.partPath);
      if (parts.has(key)) nativeRefuse('comparison-part-ambiguous');
      if (!root) nativeOwn(node);
      node.setSharedPluginData('ds_contracts', 'nativeSourcePart', JSON.stringify(identity));
      node.setExplicitVariableModeForCollection(NATIVE_COLLECTION, NATIVE.identity.modes[0].modeId);
      if (node.type === 'SLOT' && node.componentPropertyReferences.slotContentId !== source.componentPropertyReferences.slotContentId)
        nativeRefuse('comparison-slot-property-mismatch');
      parts.set(key, node); recorded.sourceParts.push({ partPath: identity.partPath, nodeId: node.id });
      for (let i = 0; i < (source.children || []).length; i++) pair(source.children[i], node.children[i], false);
    }
    pair(main, inst, true);
    // This is a recorded snapshot override. It does not teach Figma to run
    // the source predicate automatically when later content is edited.
    for (const wrapper of c.wrappers) {
      const node = parts.get(nativeCanonical(wrapper.partPath));
      if (!node || node.type !== 'FRAME') nativeRefuse('comparison-wrapper-missing');
      node.visible = wrapper.visible;
    }
    for (const sample of c.slots) {
      const slot = parts.get(nativeCanonical(sample.partPath));
      if (!slot || slot.type !== 'SLOT' || slot.children.length) nativeRefuse('comparison-slot-not-empty');
      const saved = { partPath: sample.partPath, nodeId: slot.id, propertyKey: slot.componentPropertyReferences.slotContentId, contentNodeIds: [] };
      recorded.slots.push(saved);
      for (const spec of sample.specs) {
        const node = await buildNode(spec, { texts: [], slots: [], visibles: [] });
        saved.contentNodeIds.push(node.id); slot.appendChild(node);
      }
    }
    inst.setSharedPluginData('ds_contracts', 'nativeSourceCase', JSON.stringify({ id: c.id, samplesRevision: NATIVE.comparisons.revision }));
    dsStampFingerprints(inst);
    recorded.status = 'created-comparison';
  }
}
`;
