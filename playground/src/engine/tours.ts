/**
 * The two guided walkthroughs — COPY and step identity only. What each step
 * loads, computes and highlights lives in pages/Playground.tsx (it needs the
 * page's setters); what it shows lives in components/FlowPanel.tsx.
 *
 * Naming follows docs/BETA.md's hop numbering: hop 1 code → contract;
 * hop 2 contract → bundle → canvas (Apply); hop 3 contract → code
 * (`generate`); hop 4 canvas (dump) → proposal; hop 5 proposal → contract
 * (PR). Never "sync".
 */

export type TourId = 'code-to-figma' | 'figma-to-code';

export type CodeToFigmaStep =
  | 'contract'
  | 'compile'
  | 'script'
  | 'facts'
  | 'bundle'
  | 'canvas'
  | 'break'
  | 'reset';

export type FigmaToCodeStep =
  | 'dump'
  | 'propose'
  | 'adjudicate'
  | 'generate'
  | 'envelope'
  | 'absent'
  | 'stamped'
  | 'break';

export type StepId = CodeToFigmaStep | FigmaToCodeStep;

export interface TourStep<S extends StepId = StepId> {
  id: S;
  /** Strip label (short). */
  label: string;
  /** Panel heading. */
  title: string;
  /** Which hop this step is. */
  hop: string;
  /** Panel lead paragraph — what the reader is looking at and why. */
  lead: string;
}

export interface Tour<S extends StepId = StepId> {
  id: TourId;
  title: string;
  direction: string;
  intro: string;
  steps: TourStep<S>[];
}

export const CODE_TO_FIGMA: Tour<CodeToFigmaStep> = {
  id: 'code-to-figma',
  title: 'Code → Figma',
  direction: 'a contract becomes a component set on the canvas',
  intro:
    'Start from a contract that ships in this repo (contracts/button.contract.json), compile it with the same engine the plugin runs, read the facts the canvas cannot carry, and see the bundle and the plugin door it goes through.',
  steps: [
    {
      id: 'contract',
      label: 'Contract',
      title: 'One file, read by both sides',
      hop: 'the contract',
      lead:
        'contracts/button.contract.json is on the left. Two lines are highlighted: the root’s background-color binding, {color.action.{variant}.background}, which substitutes the Variant axis value per combo; and bindings.figma.statePreviews, which tells the canvas to draw hover / focus / disabled as State previews. Nothing else in this walkthrough reads anything but this file.',
    },
    {
      id: 'compile',
      label: 'Compile',
      title: 'Contract → canvas node specs',
      hop: 'hop 2',
      lead:
        'createFigmaEngine().compileComponentData ran on the contract in your browser — the same pure step the plugin bundles (figma-sync/plugin/engine/entry.ts) and the CLI’s figma-script emitter serialise. Below is what it produced, read straight off the ComponentData it returned.',
    },
    {
      id: 'script',
      label: 'Script',
      title: 'The same data, as a Plugin-API script',
      hop: 'hop 2',
      lead:
        'The figma-script emitter serialises the compiled data into the script the plugin’s Advanced → Paste a script drawer runs. The one line to read: the root fill is bound by slash name — the dot path of the token with dots turned into slashes — so the canvas binds a variable, not a colour.',
    },
    {
      id: 'facts',
      label: 'Code-only facts',
      title: 'What the canvas cannot carry, named per contract',
      hop: 'hop 2',
      lead:
        'Button carries zero code-only facts, so this step loads a contract that has them: the Flowbite ToggleSwitch from examples/tailwind/contracts/toggleswitch.contract.json, compiled here against the bundle’s token set. Every row is one distinct {part, kind, channel, value, reason}; click a row to jump to the contract line that states it. The live compile is checked against the committed bundle’s row for this contract.',
    },
    {
      id: 'bundle',
      label: 'Bundle',
      title: 'CONTRACTS-BUNDLE — the plugin’s everyday input',
      hop: 'hop 2',
      lead:
        'ds-contracts figma bundle <contracts..> --out <file> --tokens <set> writes ONE JSON: the contracts as raw bytes, the token set, icons, and codeOnlyFacts per contract. Bundle assembly is CLI-side (packages/cli/src/commands/figma.ts), so this pane shows the COMMITTED examples/tailwind/figma/tailwind.bundle.json with its keys annotated — a preview of the artifact, not a bundle built here.',
    },
    {
      id: 'canvas',
      label: 'On the canvas',
      title: 'Plan all-or-nothing, a human clicks Apply',
      hop: 'hop 2',
      lead:
        'The plugin’s Build tab takes the bundle, validates every contract, and plans the whole set or none of it. A person clicks Apply. Each built set is stamped with ds_contracts/* plugin data so the other direction can recognise it. Nothing in this browser writes to Figma; this step is the hand-off.',
    },
    {
      id: 'break',
      label: 'Break it',
      title: 'A refusal, by name, on the line',
      hop: 'hop 2 / hop 3',
      lead:
        'The Button’s {radius.control} now points at {radius.bogus}, a token that does not exist. The referee under the editor names the refusal and the line; the generator would write nothing for this contract, and the plugin would refuse it on paste. No output is silently produced from a broken contract.',
    },
    {
      id: 'reset',
      label: 'Reset',
      title: 'Back to the shipping Button',
      hop: 'the contract',
      lead:
        'The pristine contracts/button.contract.json is back in the editor. Take the other direction next: Figma → code starts from a dump of a set this pipeline drew.',
    },
  ],
};

export const FIGMA_TO_CODE: Tour<FigmaToCodeStep> = {
  id: 'figma-to-code',
  title: 'Figma → code',
  direction: 'a canvas dump becomes a proposed contract, then React',
  intro:
    'Start from a committed dump of the Badge set this pipeline drew (extract/figma/fixtures/main-file-dumps.json), propose a contract from it with fixed inversion rules, adjudicate it against the shipping contract, generate React, and see the envelope that goes back to the repo. Then the same on a stamped Flowbite set.',
  steps: [
    {
      id: 'dump',
      label: 'Dump',
      title: 'What the proposer consumes',
      hop: 'hop 4',
      lead:
        'A dump is plain JSON of what is drawn: per set, the variants with their layout, bound variable names and raw values; plus _provenance, _degradations (the reader’s own named gaps) and _variables. The plugin Send tab and the REST mapper both write it. Below is the fixture, labelled by its OWN _provenance.dumpVersion.',
    },
    {
      id: 'propose',
      label: 'Propose',
      title: 'Dump → proposed contract, by fixed rules',
      hop: 'hop 4',
      lead:
        'proposeBatchFromDump ran on the Badge set in your browser — the same function the JSON tab, the plugin Send tab and `npm run extract:figma` run. The proposal is in the editor; its notes[] and unbound[] are in the Receipts drawer. Exact projection was tried first and its verdict is printed below by code.',
    },
    {
      id: 'adjudicate',
      label: 'Adjudicate',
      title: 'Proposal vs the shipping contract',
      hop: 'hop 4',
      lead:
        'extract/figma/roundtrip.ts compares each proposal to the contract the canvas was generated from and writes ROUNDTRIP.md. Its comparator imports node:fs, so it does not run in this browser: the rows below are REPLAYED from the committed receipt, and one live cross-check (root token refs, channel by channel) runs here beside them.',
    },
    {
      id: 'generate',
      label: 'Generate',
      title: 'Proposed contract → React',
      hop: 'hop 3',
      lead:
        'The React emitter ran on the proposal that is in the editor. The line to read: the Info variant’s background is var(--color-feedback-info-background) — the same token the canvas bound as color/feedback/info/background, recovered by the ENUM SUBST rule and written back as a CSS custom property. Open the React tab for the whole file.',
    },
    {
      id: 'envelope',
      label: 'Envelope',
      title: 'CONTRACT-PROPOSAL — what leaves the Send tab',
      hop: 'hop 5',
      lead:
        'The plugin exports one envelope per set: the proposed contract, its notes, child stubs, minted tokens, a provenance line and a base-freshness verdict. This pane assembles that shape from the proposal you just saw; the fields a fixture cannot fill are listed, not invented. Then the three doors to the repo.',
    },
    {
      id: 'absent',
      label: 'What did not cross',
      title: 'Named, not lost',
      hop: 'hop 4 / hop 2',
      lead:
        'The four facts the Badge canvas cannot express, each with its reason, from the committed receipt; and for the ToggleSwitch the one event the canvas cannot run — named on the way out (a code-only fact in the bundle) and absent on the way back (the proposal declares no events).',
    },
    {
      id: 'stamped',
      label: 'Stamped set',
      title: 'A set this pipeline drew — exact projection',
      hop: 'hop 4',
      lead:
        'extract/figma/fixtures/flowbite-eight.dump.json carries propertyDefinitions and the ds_contracts/{contractId, specHash, version, semantics} stamps. Exact projection proves the proposed contract emits the identical variant tuple set; reviewable-inversion is the legacy name-based path. Pick either; the proposal loads in the editor with the bundle’s token set active — and the editor referee says what it thinks of it, which is part of the walkthrough.',
    },
    {
      id: 'break',
      label: 'Break it',
      title: 'Exact refuses, by code',
      hop: 'hop 4',
      lead:
        'The ToggleSwitch set’s propertyDefinitions were deleted in memory (the fixture on disk is untouched) and exact projection was asked again. The refusal carries one of the EXACT_* codes from accuracy/grammar.json, printed verbatim below. Nothing was proposed.',
    },
  ],
};

export const TOURS: Record<TourId, Tour> = {
  'code-to-figma': CODE_TO_FIGMA as Tour,
  'figma-to-code': FIGMA_TO_CODE as Tour,
};

export const isTourId = (v: string | null): v is TourId => v === 'code-to-figma' || v === 'figma-to-code';

/** The five hops, as docs/BETA.md numbers them. */
export const HOPS: Array<{ n: number; from: string; to: string; verb: string }> = [
  { n: 1, from: 'code', to: 'contract', verb: 'extract · extract --computed · promote' },
  { n: 2, from: 'contract', to: 'canvas', verb: 'figma bundle → plugin Build → Apply' },
  { n: 3, from: 'contract', to: 'code', verb: 'generate --target react | html | wc | figma-script' },
  { n: 4, from: 'canvas (dump)', to: 'proposal', verb: 'Send tab · extract:figma · propose' },
  { n: 5, from: 'proposal', to: 'contract', verb: 'PR · figma receive --apply · copy' },
];

/** Refusal sentences quoted VERBATIM from their source — each `fragment` is
 *  a substring playground/scripts/flow-check.ts requires to exist in
 *  `file`, so a reworded refusal cannot leave a stale quote here. */
export const QUOTED_REFUSALS = {
  bundle: {
    file: 'packages/cli/src/commands/figma.ts',
    text: '✘ Refused — N of M contract(s) do not compile against this token set; the plugin would refuse each of them on paste, so nothing was written:',
    fragment: ' contract(s) do not compile against this token set; the plugin would refuse each of them on paste, so nothing was written:',
  },
  plan: {
    file: 'figma-sync/plugin/engine/entry.ts',
    text: 'N of M contract(s) refused — nothing was planned; every refusal is listed below.',
    fragment: ' contract(s) refused — nothing was planned; every refusal is listed below.',
  },
  generate: {
    file: 'scripts/generate-components.ts',
    text: 'ATOMIC PER CONTRACT: a contract that fails to parse, validate, or emit is REFUSED BY NAME and leaves no file; every contract that validates is generated; a contract depending on a refused one is refused too ("depends on refused contract").',
    fragment: 'parse, validate, or emit is REFUSED BY NAME and leaves no file; every',
  },
  receive: {
    file: 'packages/cli/src/commands/figma.ts',
    text: 'Without --apply nothing but the proposal artifact (<out>/.proposals/<id>.proposal.json) is written — the contract file is never touched silently.',
    fragment: 'nothing but the proposal artifact (<out>/.proposals/<id>.proposal.json)',
  },
  everydayDoor: {
    file: 'playground/src/components/HelpDrawer.tsx',
    text: 'The plugin’s everyday door is Build, which takes a contracts file rather than a script.',
    fragment: 'everyday door is <b>Build</b>, which takes',
  },
} as const;

/** The three doors a CONTRACT-PROPOSAL has into the repo — spelled as the
 *  CLI spells them (packages/cli/src/cli.ts USAGE). */
export const ENVELOPE_DOORS: Array<{ door: string; command: string | null; writes: string }> = [
  {
    door: 'Pull request',
    command: 'ds-contracts propose-pr <envelope.json> --repo owner/name [--target react|html|react-inline] [--dry-run]',
    writes: 'one PR with the contract and the emitted component; the target is read from ds-contracts.config.json or --target, never guessed',
  },
  {
    door: 'Local diff',
    command: 'ds-contracts figma receive --out <contracts-dir> [--apply]',
    writes: 'without --apply only <out>/.proposals/<id>.proposal.json; the contract file is never touched. With --apply: the contract, each childStub, <id>.minted.dtcg.json, and the generated code',
  },
  {
    door: 'Copy',
    command: null,
    writes: 'the envelope JSON on your clipboard — paste it into the JSON tab here, or into a file for `figma receive`',
  },
];
