import { walkAnatomy, type Contract } from "@ds-contracts/schema";

/** Pure data resolved by a trusted host from verified original-runtime bytes.
 * Contracts contain only immutable references, never paths or loaders. The
 * Node-side preparer and the browser-side emitter share this boundary. */
export interface RuntimeArtifactForEmission {
  artifactRevision: string;
  interfaceRevision: string;
  registrationTag: string;
  interface: {
    module: { path: string; exportName: string };
    declaration: { path: string; exportName: string };
    writableProperties: string[];
    properties: Array<{ name: string; typeText: string; writable: boolean }>;
    slots: Array<{ name: string }>;
    peerRuntime: {
      name: "react";
      major: 19;
      mounting: "direct-custom-element";
    };
  };
  /** Local package assets already checked by the host. No remote URLs. */
  stylesheets: string[];
}

export interface RuntimeProjectionBinding {
  version: 1;
  artifactRevision: string;
  interfaceRevision: string;
  /** A changed projection refuses until its editable channel has a qualified
   * lowering. Preserving an opaque runtime does not apply arbitrary edits. */
  contractRevision: string;
  tokenRevision: string;
  properties: Array<{ contractProp: string; sourceProperty: string }>;
  slots: Array<{ contractSlot: string; sourceSlot: string }>;
}

export interface RuntimeEmissionContext {
  artifacts: ReadonlyMap<string, RuntimeArtifactForEmission>;
  bindings: ReadonlyMap<string, RuntimeProjectionBinding>;
  /** Actual token values supplied by the emitter host, not token names. */
  tokens: unknown;
}

/** A target without a qualified retained-runtime lowering must not reconstruct
 * a native lookalike, including through composition or slot defaults. */
export function refuseRetainedRuntime(
  contract: Contract,
  target: string,
  contracts: ReadonlyMap<string, Contract> = new Map(),
): void {
  const seen = new Set<string>();
  const visit = (current: Contract): void => {
    if (seen.has(current.id)) return;
    seen.add(current.id);
    if (current.bindings.code.runtime)
      throw new Error(
        `RUNTIME-EMISSION-TARGET-UNSUPPORTED: ${target} cannot lower retained runtime ${current.id}`,
      );
    for (const { part } of walkAnatomy(current)) {
      const ids = [
        part.component?.id,
        ...(part.slot?.defaultContent ?? []).map((item) => item.id),
      ];
      for (const id of ids) {
        const child = id ? contracts.get(id) : undefined;
        if (child) visit(child);
      }
    }
  };
  visit(contract);
}
