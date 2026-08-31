/**
 * Measured-host ledger (H2).
 *
 * Every entry is a host fact discovered in a live climb and pinned to the
 * committed evidence that named it. The writer preflight may refuse or
 * simulate these facts. It must not guess unmeasured API surface.
 *
 * Read-side host-normalize teachings stay in their scene-readback lineages.
 * This ledger is writer/sandbox only — the class the replay census
 * honesty note says it cannot catch.
 */
import { readFileSync } from "node:fs";

export const MEASURED_HOST_LEDGER_VERSION = "measured-host-ledger-v1";

export type MeasuredHostFactId =
  | "plugin-sandbox-no-textencoder"
  | "setBoundVariableForEffect-resets-shadow-geometry"
  | "later-effect-entries-paint-on-top"
  | "instance-text-property-requires-loaded-font";

export type MeasuredHostFactKind =
  | "plugin-sandbox"
  | "plugin-api"
  | "paint-order";

export interface MeasuredHostEvidencePin {
  path: string;
  /** Substring that must exist in the evidence file. */
  pin: string;
}

export interface MeasuredHostFact {
  id: MeasuredHostFactId;
  kind: MeasuredHostFactKind;
  /** What the host was measured to do. */
  statement: string;
  discoveredBy: string;
  evidence: MeasuredHostEvidencePin;
}

/**
 * Button v5 attempts 1/4/5 plus Calendar v2 — the writer-side classes with
 * committed evidence pins. Table's climb taught read-side omit/carry classes;
 * those are not hosted here.
 */
export const MEASURED_HOST_FACTS: readonly MeasuredHostFact[] = [
  {
    id: "plugin-sandbox-no-textencoder",
    kind: "plugin-sandbox",
    statement:
      "Figma's plugin main thread has no TextEncoder; `new TextEncoder()` throws `TypeError: TextEncoder is not a constructor` before the first write.",
    discoveredBy: "Button v5 attempt 1 (2026-08-30)",
    evidence: {
      path: "recipe/evidence/button-live-pivot-v5/live-attempt-1.json",
      pin: "TypeError: TextEncoder is not a constructor",
    },
  },
  {
    id: "setBoundVariableForEffect-resets-shadow-geometry",
    kind: "plugin-api",
    statement:
      "figma.variables.setBoundVariableForEffect returns the effect with offset/radius/spread reset (spread 0 measured live). The color binding survives; compile-planned geometry must be carried back over the bound effect.",
    discoveredBy: "Button v5 attempt 4 (2026-08-30)",
    evidence: {
      path: "recipe/evidence/button-live-pivot-v5/cleanup-attempt-4.json",
      pin: "setBoundVariableForEffect returned the effect with its spread RESET to 0",
    },
  },
  {
    id: "later-effect-entries-paint-on-top",
    kind: "paint-order",
    statement:
      "Figma paints later effect-list entries on top. A focus ring (spread 4, outline token) listed after a white offset-gap (spread 2) buries the gap. Ring must list first; gap last.",
    discoveredBy: "Button v5 attempt 5 (2026-08-30)",
    evidence: {
      path: "recipe/evidence/button-live-pivot-v5/cleanup-attempt-5.json",
      pin: "Figma paints LATER effect-list entries ON TOP",
    },
  },
  {
    id: "instance-text-property-requires-loaded-font",
    kind: "plugin-api",
    statement:
      "createInstance then setProperties on a TEXT component property refuses unless that component font is loaded in the plugin sandbox.",
    discoveredBy: "Calendar v2 attempt 1",
    evidence: {
      path: "recipe/evidence/calendar-live-pivot-v2-attempt-1.json",
      pin: "createInstance then setProperties(Label) without loading the instance text font",
    },
  },
];

export const BUTTON_V5_WRITER_CLASSES: readonly MeasuredHostFactId[] = [
  "plugin-sandbox-no-textencoder",
  "setBoundVariableForEffect-resets-shadow-geometry",
  "later-effect-entries-paint-on-top",
];

export function assertMeasuredHostEvidencePins(
  facts: readonly MeasuredHostFact[] = MEASURED_HOST_FACTS,
): string[] {
  const failures: string[] = [];
  for (const fact of facts) {
    let text: string;
    try {
      text = readFileSync(fact.evidence.path, "utf8");
    } catch (error) {
      failures.push(
        `${fact.id}: evidence missing at ${fact.evidence.path} (${error instanceof Error ? error.message : String(error)})`,
      );
      continue;
    }
    if (!text.includes(fact.evidence.pin)) {
      failures.push(
        `${fact.id}: pin not found in ${fact.evidence.path}: ${JSON.stringify(fact.evidence.pin)}`,
      );
    }
  }
  return failures;
}
