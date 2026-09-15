import type {
  BindingIntervention,
  DifferentialValue,
} from "./binding-differential.js";
import type { BoundTopologyResult } from "./bound-topology.js";
import type { LitRenderMatch } from "./lit-render-match.js";

export type BindingProbeKey = "label" | "default-slot" | "aria-disabled";
export interface PlannedBindingIntervention {
  key: BindingProbeKey;
  intervention?: BindingIntervention;
  problems: string[];
}

/** Fixed finite experiment, not a discovered contract or manual anatomy map.
 * The default row always retains all three planned obligations, including when
 * source admission/correspondence failed. Every target identity comes from the
 * exact source/DOM correspondence, never label strings or CSS class similarity.
 * This module is pure and imports no browser/runtime implementation.
 */
export function planBindingInterventions(
  story: string,
  match?: LitRenderMatch,
  boundTopology?: BoundTopologyResult,
): PlannedBindingIntervention[] {
  if (story !== "atoms-button--default") return [];
  const plans: PlannedBindingIntervention[] = [
    "label",
    "default-slot",
    "aria-disabled",
  ].map((key) => ({ key: key as BindingProbeKey, problems: [] }));
  if (
    match?.status !== "structure-matched" ||
    match.problems.length ||
    boundTopology?.status !== "topology-matched" ||
    boundTopology.problems.length ||
    boundTopology.topology?.status !== "captured" ||
    !boundTopology.topology.observation ||
    match.topologyObservationSha256 !==
      boundTopology.topology.observationSha256 ||
    match.semanticObservationSha256 !== boundTopology.semanticObservationSha256
  ) {
    for (const plan of plans)
      plan.problems.push("binding-plan-structure-unavailable");
    return plans;
  }
  const topology = boundTopology.topology.observation;
  const stringValues = (prefix: string): DifferentialValue[] => [
    { kind: "value", value: `${prefix} alpha` },
    { kind: "value", value: `${prefix} omega expanded` },
  ];
  for (const plan of plans) {
    if (plan.key === "default-slot") {
      const slots = match.slots.filter((slot) => slot.name === "");
      const slot = slots.length === 1 ? slots[0] : undefined;
      const assigned =
        slot?.assigned.length === 1
          ? topology.nodes.filter(
              (node) =>
                node.domPath === slot.assigned[0] && node.kind === "text",
            )
          : [];
      if (!slot || slot.distribution !== "assigned" || assigned.length !== 1) {
        plan.problems.push("binding-plan-single-assigned-text-unavailable");
        continue;
      }
      plan.intervention = {
        kind: "slot-text",
        name: slot.name,
        path: slot.semanticPath,
        sourceNodeId: slot.sourceNodeId,
        sourceSpan: slot.sourceSpan,
        assignedDomPath: assigned[0].domPath,
        values: stringValues("Contract content"),
      };
      continue;
    }
    const attribute = plan.key === "label" ? "aria-label" : "aria-disabled";
    const property = plan.key === "label" ? "label" : "isDisabled";
    const bindings = match.bindings.filter(
      (binding) =>
        binding.sourceProperty === property &&
        binding.attribute.name === attribute,
    );
    const binding = bindings.length === 1 ? bindings[0] : undefined;
    const expression =
      binding?.attribute.parts.length === 1 &&
      binding.attribute.parts[0].kind === "expression"
        ? binding.attribute.parts[0].expression
        : undefined;
    if (
      !binding ||
      !binding.semanticPath ||
      binding.attribute.channel !== "attribute" ||
      expression?.kind !== "if-defined" ||
      expression.property !== property ||
      !binding.native ||
      binding.native.path !== binding.semanticPath ||
      binding.native.tag !== binding.tag
    ) {
      plan.problems.push("binding-plan-direct-native-attribute-unavailable");
      continue;
    }
    plan.intervention = {
      kind: "property",
      name: property,
      sourceNodeId: binding.sourceNodeId,
      sourceSpan: binding.sourceSpan,
      target: { path: binding.semanticPath, tag: binding.tag, attribute },
      values:
        plan.key === "label"
          ? stringValues("Contract label")
          : [
              { kind: "undefined" },
              { kind: "value", value: false },
              { kind: "value", value: true },
            ],
    };
  }
  return plans;
}
