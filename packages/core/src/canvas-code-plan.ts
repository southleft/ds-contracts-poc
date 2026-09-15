/**
 * CANVAS → CODE, the shared plan — what a proposal from the canvas turns
 * into on the code side, and the limits of its recorded origin claim.
 *
 * The loop (task #40) has two ends that must say the SAME thing:
 *   - the plugin's Send tab, which shows a designer the files their
 *     proposal would create BEFORE they create them, and
 *   - `ds-contracts propose-pr`, which actually writes those files into the
 *     pull request next to the contract.
 * Both read this module, so the file list and the provenance sentence can
 * never drift apart. Pure and browser-safe (no node:*): the plugin engine
 * bundles it, the CLI imports it.
 *
 * ORIGIN IS NOT VERIFICATION. A `ds_contracts/contractId` marker claims tool
 * origin; it cannot authenticate itself or prove a successful round trip.
 * Reproduction requires a matching trusted canonical baseline, preserved
 * semantics/runtime identity, and independent comparison. No marker does
 * not establish human authorship. The legacy provenance enum is retained
 * for compatibility; none of its values grants verified correspondence.
 *
 * Path naming mirrors core/emitter.ts (the registry emitters) and
 * scripts/generate-components.ts (the shipping react layout). That mirroring
 * is a receipt, not a hope: scripts/plugin-engine-check.mjs runs the real
 * emitters over a real contract and asserts their paths equal these.
 */
import { kebab } from './naming.js';

/** Recorded origin classification, not authenticated history or fidelity. */
export type CanvasProvenance =
  /** A ds_contracts/contractId marker was reported: claimed tool origin. */
  | 'tool-generated'
  /** Legacy spelling for a reported unmarked set. Author remains unknown. */
  | 'hand-built'
  /** No canvas provenance was recorded (e.g. a contract document straight
   *  out of the repo). Never guessed into one of the two above. */
  | 'unrecorded';

/** Human labels for the built-in emit targets (the registry's `label`s,
 *  shortened for a 640px plugin panel). */
export const CODE_TARGET_LABELS: Record<string, string> = {
  react: 'React + CSS Modules',
  html: 'Static HTML + CSS',
  'react-inline': 'React, inline styles',
  'figma-script': 'Figma sync script',
};

export interface CodePathOptions {
  /** react only: emit <Name>.stories.tsx (the CLI's --stories). */
  stories?: boolean;
}

/**
 * The files a target writes for ONE contract, relative to the output root.
 *
 * The react target's root barrel (`index.ts` listing every component) is
 * DELIBERATELY absent: it describes the whole library, and a proposal knows
 * exactly one component — committing it would clobber the repo's barrel down
 * to a single line. Callers say so out loud; see propose-pr.
 *
 * An unregistered target returns [] — the caller must name it as unknown
 * rather than invent a file list.
 */
export function plannedCodePaths(
  contractName: string,
  target: string,
  opts: CodePathOptions = {},
): string[] {
  const slug = kebab(contractName);
  switch (target) {
    case 'react':
      return [
        `${contractName}/${contractName}.module.css`,
        `${contractName}/${contractName}.tsx`,
        ...(opts.stories ? [`${contractName}/${contractName}.stories.tsx`] : []),
        `${contractName}/index.ts`,
      ];
    case 'html':
      return [`${slug}.html`, `${slug}.css`];
    case 'react-inline':
      return [`${contractName}.inline.tsx`];
    case 'figma-script':
      return [`${slug}.figma.js`];
    default:
      return [];
  }
}

/** Origin and verification limits. Printed in the PR body and shown in the
 *  plugin BEFORE the proposal leaves the canvas; never an acceptance gate. */
export function provenanceSentence(p: CanvasProvenance): string {
  switch (p) {
    case 'tool-generated':
      return (
        'This component set carries a ds_contracts/contractId marker claiming ds-contracts origin. ' +
        'The marker does not prove a successful round trip or byte-identical reproduction. ' +
        'Verification requires a matching trusted canonical baseline, preserved semantics and runtime identity ' +
        'where applicable, and independent comparison. Until those checks pass, the generated code is an ' +
        'unverified projection of the proposed contract.'
      );
    case 'hand-built':
      return (
        'No ds_contracts/contractId marker was reported for this component set; absence does not establish who drew it. ' +
        'The contract is an INVERSION of what could be read off the canvas. ' +
        'The generated component is a STARTING POINT, NOT A REPRODUCTION: review it as new code, ' +
        'and expect unsupported or unobserved semantics to remain unresolved.'
      );
    case 'unrecorded':
      return (
        'No canvas provenance was recorded for this contract. Its design origin is unknown; the generated code ' +
        'is a projection of the contract as written, not verified correspondence to a canvas.'
      );
  }
}

/** One-line version for a cramped surface (the plugin panel). */
export function provenanceHeadline(p: CanvasProvenance): string {
  switch (p) {
    case 'tool-generated':
      return 'Claimed tool origin — marker only; round-trip verification is still required.';
    case 'hand-built':
      return 'Unmarked origin — inversion; starting point, not a reproduction.';
    case 'unrecorded':
      return 'Provenance not recorded — origin unknown; code correspondence is unverified.';
  }
}

export interface CodePlan {
  target: string;
  targetLabel: string;
  /** Output-root-relative paths, in write order. */
  paths: string[];
}

// ---------------------------------------------------------------------------
// Proposal file naming — ONE spelling for both delivery doors.
//
// These used to live only in packages/cli/src/commands/figma.ts, so the
// plugin's GitHub PR door could not name the files `figma receive` /
// `propose-pr` write without copying the rule (and drifting). They are pure
// and browser-safe, so they live here now; the CLI re-exports them.
// ---------------------------------------------------------------------------

/** Flatten an untrusted contract id into one safe filename stem: every
 *  character outside the schema's own id alphabet is replaced, path separators
 *  included, so the result is always a single flat filename. */
export const flatIdStem = (id: string, fallback: string): string =>
  id
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/\.\.+/g, '.')
    .replace(/^[.-]+|[.-]+$/g, '') || fallback;

/** id → <name>.contract.json (the prefix segment stripped) — the filename
 *  `figma receive` and `propose-pr` both give a contract, main or stub. */
export const contractFileNameForId = (id: string): string =>
  `${flatIdStem(id.replace(/^[^.]+\./, ''), 'stub')}.contract.json`;

/** Proposal artifacts retain valid ids verbatim for backward-compatible
 * filenames, while hostile ids collapse to one flat basename. */
export const proposalFileNameForId = (id: string): string =>
  `${flatIdStem(id, 'proposal')}.proposal.json`;

/** The minted DTCG sidecar's filename — the same stem propose-pr derives
 *  (`proposalFileNameForId` minus its suffix) so both doors write the
 *  provisional token tree to the SAME place. */
export const mintedTokensFileNameForId = (contractId: string): string =>
  `${flatIdStem(contractId, 'proposal')}.minted.dtcg.json`;

/** The whole answer to "what code would this proposal produce?" — one entry
 *  per target, plus the sentence. Shared by the plugin panel and the CLI. */
export function canvasCodePlan(
  contractName: string,
  targets: string[],
  opts: CodePathOptions = {},
): CodePlan[] {
  return targets.map((target) => ({
    target,
    targetLabel: CODE_TARGET_LABELS[target] ?? target,
    paths: plannedCodePaths(contractName, target, opts),
  }));
}
