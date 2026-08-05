/**
 * Guarded static promotion — the one artifact boundary used by static code
 * extraction. It is pure: callers plan every contract first, then perform
 * writes only if the complete batch was accepted.
 */
import {
  assertContractProvenance,
  canonicalRevisionOf,
  revisionOf,
  type ContractProvenance,
  type ProvenancedContract,
} from "../core/contract-provenance.js";
import type {
  ContractRelevantExtraction,
  ExtractedComponent,
} from "./types.js";

export interface StaticPromotionOptions {
  /** Explicit acknowledgement for adopting an old, unprovenanced canonical
   * that differs from today's extraction. Never inferred. */
  acknowledgeUnprovenancedMismatch?: boolean;
}

export interface StaticSourceRevision {
  adapter: string;
  revision: string;
}

/** Filesystem locations and adapter labels are not contract-relevant source
 * facts. Everything else emitted by the adapter is canonicalized by key. */
export function normalizedContractExtraction(
  component: ExtractedComponent,
): ContractRelevantExtraction {
  const { source: _sourcePath, adapter: _adapter, ...relevant } = component;
  return relevant;
}

export function extractionRevision(component: ExtractedComponent): string {
  return revisionOf(normalizedContractExtraction(component));
}

export function promoteStaticCandidate(
  canonical: ProvenancedContract | null,
  candidate: ProvenancedContract,
  component: ExtractedComponent,
  options: StaticPromotionOptions = {},
): ProvenancedContract {
  return promoteStaticArtifact(
    canonical,
    candidate,
    { adapter: component.adapter, revision: extractionRevision(component) },
    options,
  );
}

export function promoteStaticArtifact(
  canonical: ProvenancedContract | null,
  candidate: ProvenancedContract,
  source: StaticSourceRevision,
  options: StaticPromotionOptions = {},
): ProvenancedContract {
  const label = String(candidate.id ?? "contract");
  if (canonical) {
    assertContractProvenance(canonical, label);
    if (canonical.id !== candidate.id) {
      throw new Error(
        `${label}: static promotion REFUSED — canonical id ${String(canonical.id)} does not match candidate id ${String(candidate.id)}`,
      );
    }
  }
  const sourceRevision = source.revision;
  const candidateBare = structuredClone(candidate);
  delete candidateBare.provenance;
  const candidateRevision = canonicalRevisionOf(candidateBare);
  const prior = canonical?.provenance;

  if (canonical && !prior) {
    const oldRevision = canonicalRevisionOf(canonical);
    if (
      oldRevision !== candidateRevision &&
      !options.acknowledgeUnprovenancedMismatch
    ) {
      throw new Error(
        `${label}: static promotion REFUSED — the existing canonical has no provenance and differs from today's extraction. Re-run with explicit acknowledgement only after reviewing that bootstrap diff.`,
      );
    }
  }

  if (canonical && prior?.awaitingCodeAdoption) {
    const awaiting = prior.awaitingCodeAdoption;
    const sourceUnchanged = sourceRevision === awaiting.sourceRevision;
    if (sourceUnchanged && candidateRevision !== prior.canonicalRevision) {
      throw new Error(
        `${label}: stale-source REFUSED — canonical ${prior.canonicalRevision} is awaiting code adoption from design, but the ${source.adapter} extraction is still source revision ${sourceRevision} and would silently revert it. Change the contract-relevant source, then review/promote that extraction.`,
      );
    }
    // An unchanged extraction cannot claim adoption merely by being rerun.
    if (sourceUnchanged) return structuredClone(canonical);
  }

  const provenance: ContractProvenance = {
    version: 1,
    canonicalRevision: candidateRevision,
    source: {
      kind: "code",
      adapter: source.adapter,
      revision: sourceRevision,
    },
  };
  return { ...candidateBare, provenance };
}
