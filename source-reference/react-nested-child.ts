/** A proved source-owned host shell with one nested caller input. This prepares
 * one observed usage, not unobserved property planes or native fidelity. */
import { canonicalJson, revisionOf } from "../core/contract-provenance.js";
import { createFigmaEngine } from "../core/emit-figma-script.js";
import { ContractSchema, walkAnatomy } from "../scripts/contract-schema.js";
import {
  enumerate,
  flatten,
  type CapturedNode,
} from "../extract/computed/lib.js";
import type { PropSpace, SweepResult } from "../extract/computed/capture.js";
import { authoredLengthIsUsed } from "./layout-unit.js";
import {
  compileObservedContentSweep,
  prepareObservedContentTree,
  type PartSizing,
} from "./observed-content.js";
import { linkReactSourceAnatomy } from "./react-source-anatomy.js";
import { observeReactSourceBindings } from "./react-source-bindings.js";
import type { ReactSourceProgram } from "./react-source-program.js";
import type { ReactOwnership } from "./react-ownership.js";
import type { ReactStyleOrigin } from "./react-style-origin.js";
import type { ReactOwnedChildEvidence } from "./react-owned-child.js";
import type { ReactChildRoot } from "./react-child-root.js";

export interface ReactNestedChild extends ReactChildRoot {
  nestedSlot: {
    sourcePath: string;
    relativePath: string;
    partName: string;
    specPath: number[];
  };
}
interface SourceToken {
  $type: string;
  $value: unknown;
  $extensions: {
    "dev.ds-contracts.css-source": {
      variable: string;
      rawValue: string;
      selectors: string[];
    };
  };
}

export function deriveReactNestedChild(
  program: ReactSourceProgram,
  ownership: ReactOwnership,
  tree: CapturedNode,
  styleOrigin: ReactStyleOrigin,
  instanceId: string,
  evidence: ReactOwnedChildEvidence,
): ReactNestedChild {
  const anatomy = linkReactSourceAnatomy(program, ownership, tree),
    instance = anatomy.instances.find((i) => i.instanceId === instanceId);
  const observed = ownership.components.find((i) => i.id === instanceId);
  if (
    anatomy.status !== "linked" ||
    !instance ||
    !observed?.parent ||
    instance.content !== "nested-caller-slot" ||
    instance.roots.length !== 1 ||
    !instance.roots[0].path ||
    !instance.callerSlotPath
  )
    throw Error("react-nested-child-source-required");
  for (const key of ["style", "className"])
    if (
      Object.hasOwn(observed.props, key) &&
      observed.props[key] !== null &&
      observed.props[key] !== "" &&
      canonicalJson(observed.props[key]) !==
        canonicalJson({ kind: "undefined" })
    )
      throw Error("react-nested-child-caller-style-unqualified");
  const rootPath = instance.roots[0].path,
    relative = (path: string) =>
      path === rootPath ? "" : path.slice(rootPath.length + 1);
  const prepared = prepareObservedContentTree(
    tree,
    evidence.fonts,
    evidence.svg,
  );
  const root = structuredClone(
    flatten(prepared).find((row) => row.path === rootPath)!.node,
  );
  const slotPath = relative(instance.callerSlotPath),
    slot = flatten(root).find((row) => row.path === slotPath)?.node;
  if (!slot) throw Error("react-nested-child-slot-missing");
  // All the surrounding hosts survive. Only the independently proved caller
  // descendants are removed from the reusable dependency.
  slot.nodes = [];
  // prepareObservedContentTree resolves a directly painted caller font. Once
  // that text is removed it cannot redefine the reusable host's CSS family.
  // The caller projection separately preserves the authenticated painted font.
  const sourceSlot = flatten(tree).find(
    (row) => row.path === instance.callerSlotPath,
  )!.node;
  if (sourceSlot.style["font-family"] === undefined)
    delete slot.style["font-family"];
  else slot.style["font-family"] = sourceSlot.style["font-family"];
  const flat = flatten(root),
    sizes = new Map<string, ReadonlySet<string>>();
  for (const row of flat) {
    const absolute = row.path ? rootPath + "." + row.path : rootPath;
    const origins = styleOrigin.roots.filter(
      (o) => o.path === absolute && o.tag === row.node.tag,
    );
    if (styleOrigin.version !== 1 || origins.length !== 1)
      throw Error("react-nested-child-style-origin-required:" + absolute);
    const origin = origins[0],
      fixed = new Set<string>();
    for (const channel of ["width", "height"] as const) {
      const facts = origin.sizes?.filter((size) => size.channel === channel);
      if (facts?.length !== 1 || facts[0].status === "unresolved")
        throw Error(
          "react-nested-child-size-unqualified:" + absolute + ":" + channel,
        );
      const size = facts[0];
      if (size.status === "fixed") {
        if (
          !size.value ||
          !authoredLengthIsUsed(size.value, row.node.style[channel])
        )
          throw Error("react-nested-child-size-observation-mismatch");
        fixed.add(channel);
      } else if (size.status === "fill")
        throw Error("react-nested-child-fill-context-unqualified");
      else if (size.status !== "auto")
        throw Error(
          "react-nested-child-size-unqualified:" + absolute + ":" + channel,
        );
    }
    sizes.set(row.path, fixed);
    if (["flex", "inline-flex"].includes(row.node.style.display))
      for (const gap of ["row-gap", "column-gap"])
        if (row.node.style[gap] === "normal") row.node.style[gap] = "0px";
  }
  const name = instance.source.exportName;
  const seed = ContractSchema.parse({
    id: "observed.nested-source",
    name,
    version: "0.1.0",
    status: "draft",
    description: `Observed ${name} host structure with one nested caller slot; other inputs and behavior remain unqualified.`,
    props: [],
    states: [],
    semantics: { element: root.tag },
    anatomy: { root: {} },
    bindings: {
      code: { anchors: { importPath: "observed/nested-source", export: name } },
      figma: { anchors: { fileKey: null, componentSetKey: null } },
    },
  });
  const enumeration = enumerate([], [], 1, {}),
    key = enumeration.combos[0].key;
  const space: PropSpace = {
    contract: seed,
    axes: [],
    presence: new Map(),
    stateProps: [],
    enumeration,
    baseComboKey: key,
    baseAxisValues: {},
    heldFixed: [],
  };
  const partSizing: PartSizing = new Map([[key, sizes]]);
  const compiled = compileObservedContentSweep(
    space,
    { name, importName: name, contract: "", sampleText: "", axes: [] },
    {
      captures: [{ combo: name + ":" + key, interaction: "default", root }],
    } as SweepResult,
    [...(sizes.get("") ?? [])],
    true,
    flat.map((row) => row.path).filter(Boolean),
    partSizing,
  );
  if (
    compiled.problems.length ||
    !compiled.contract ||
    !compiled.tokens ||
    !compiled.sourcePaths
  )
    throw Error(
      "react-nested-child-projection-unavailable:" +
        compiled.problems.join(","),
    );
  const contract = compiled.contract,
    tokens = compiled.tokens,
    parts = new Map(walkAnatomy(contract).map((row) => [row.name, row.part]));
  const slotMappings = compiled.sourcePaths.filter(
    (row) => row.sourcePath === slotPath && row.type === "frame",
  );
  if (slotMappings.length !== 1)
    throw Error("react-nested-child-slot-correspondence-unavailable");
  const slotMapping = slotMappings[0],
    slotPart = parts.get(slotMapping.partName)!;
  if (
    !slotPart ||
    slotPart.component ||
    slotPart.content ||
    slotPart.slot ||
    slotPart.text ||
    Object.keys(slotPart.parts ?? {}).length
  )
    throw Error("react-nested-child-slot-content-unqualified");
  delete slotPart.text;
  delete slotPart.parts;
  // Ordinary div frames use an implicit default element in the compiler.
  // A styled slot must explicitly retain its source-owned host; otherwise
  // both validation and React emission treat it as a bare insertion point.
  if (slotPart.element && slotPart.element !== slot.tag)
    throw Error("react-nested-child-slot-element-mismatch");
  slotPart.element = slot.tag;
  slotPart.slot = { name: "children" };
  const bindings: NonNullable<ReactChildRoot["draft"]["sourceBindings"]> = [];
  for (const row of flat) {
    const matches = compiled.sourcePaths.filter(
      (mapping) => mapping.sourcePath === row.path,
    );
    if (row.path && matches.length !== 1)
      throw Error(
        "react-nested-child-host-correspondence-unavailable:" + row.path,
      );
    const part = row.path
      ? parts.get(matches[0].partName)!
      : contract.anatomy.root;
    const projected = observeReactSourceBindings(
      row.node,
      part,
      tokens,
      styleOrigin,
      row.path ? rootPath + "." + row.path : rootPath,
    );
    if (
      projected.sourceBindings.some(
        (binding) => binding.variable && !binding.tokenPath,
      )
    )
      throw Error("react-nested-child-source-binding-unresolved");
    for (const binding of projected.sourceBindings)
      if (binding.tokenPath)
        (part.tokens ??= {})[binding.channel] = "{" + binding.tokenPath + "}";
    bindings.push(...projected.sourceBindings);
    if (projected.tokens.source) {
      const incoming = (
        projected.tokens.source as { css: Record<string, SourceToken> }
      ).css;
      const saved = (tokens.source ??= { css: {} }) as {
        css: Record<string, SourceToken>;
      };
      for (const [key, value] of Object.entries(incoming)) {
        if (saved.css[key]) {
          const field = "dev.ds-contracts.css-source",
            previous = saved.css[key],
            a = structuredClone(previous),
            b = structuredClone(value);
          a.$extensions[field].selectors = [];
          b.$extensions[field].selectors = [];
          if (canonicalJson(a) !== canonicalJson(b))
            throw Error("react-nested-child-source-binding-conflict");
          value.$extensions[field].selectors = [
            ...new Set([
              ...previous.$extensions[field].selectors,
              ...value.$extensions[field].selectors,
            ]),
          ].sort();
        }
        saved.css[key] = value;
      }
    }
  }
  const heldProps = Object.fromEntries(
    Object.entries(observed.props).filter(([key]) => key !== "children"),
  );
  const suffix = revisionOf({
    source: instance.source,
    heldProps,
    contract,
    tokens,
  }).slice(7, 23);
  contract.id = "observed.react-nested-" + suffix;
  contract.bindings.code.anchors.importPath = "observed/" + suffix;
  const assets = compiled.assets ?? [],
    engine = createFigmaEngine({
      tokens: {
        primitives: tokens,
        semantic: {},
        light: {},
        dark: {},
        brands: { default: {} },
      },
      icons: new Map(assets),
    });
  const byId = new Map([[contract.id, contract]]),
    native = engine.compileComponentData(contract, byId);
  let nativeSlot = native.variants[0].spec;
  for (const index of slotMapping.specPath) {
    if (!nativeSlot.children?.[index])
      throw Error("react-nested-child-native-slot-path-mismatch");
    nativeSlot = nativeSlot.children[index];
  }
  if (
    nativeSlot.type !== "slot" ||
    nativeSlot.slotProperty !== "Children" ||
    nativeSlot.children?.length
  )
    throw Error("react-nested-child-native-slot-path-mismatch");
  const inputRevision = revisionOf({
    program,
    ownership,
    tree,
    styleOrigin,
    instanceId,
    evidence,
  });
  engine.compileNativeContractDraft(contract, byId, {
    revision: revisionOf(tree),
    programSha256: revisionOf(program).slice(7),
    evidenceRevision: inputRevision,
  });
  return {
    version: 1,
    qualification: "observed-child-root-draft",
    acceptedContract: null,
    inputRevision,
    instanceId,
    nestedSlot: {
      sourcePath: instance.callerSlotPath,
      relativePath: slotPath,
      partName: slotMapping.partName,
      specPath: slotMapping.specPath,
    },
    assets,
    heldProps: structuredClone(observed.props),
    problems: [],
    draft: {
      instanceId,
      source: instance.source,
      status: "native-compiled",
      contract,
      tokens,
      native,
      channels: [],
      sourceBindings: bindings,
      residuals: compiled.residuals,
      problems: [],
      limitations: [
        "observed-child-inputs-only",
        "runtime-interactions-not-projected",
        "source-variable-modes-and-aliases-not-assembled",
        "nested-slot-text-template-not-projected",
        "native-fidelity-not-verified",
      ],
    },
  };
}
