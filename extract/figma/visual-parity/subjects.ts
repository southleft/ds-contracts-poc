/**
 * Visual-parity subjects — one entry per component whose preview render is
 * diffed pixel-by-pixel against Figma's own render of the same node.
 *
 * Two kinds:
 *   · dump      — a committed design dump (extract/figma fixtures). The
 *                 contract is PROPOSED from the dump (proposeFromDump with
 *                 minting + the captured-variables layer), exactly the
 *                 playground import path.
 *   · contract  — a repo catalog contract whose anchors.figma point at the
 *                 generated set in the main POC file. The contract is the
 *                 shipping one; the canvas is the generator's output.
 *
 * `setNodeId` is the COMPONENT_SET node (the grid). The harness enumerates
 * the set's variant COMPONENT children via the REST nodes API (the dumps do
 * not carry per-variant node ids — only the set's) and fetches each variant's
 * PNG from the images API at scale=2.
 *
 * Adding a subject = adding one entry here.
 */

export interface DumpSubject {
  id: string;
  label: string;
  kind: 'dump';
  /** Repo-relative path of the committed dump fixture. */
  dumpPath: string;
  /** Set name inside the dump — required when the dump carries several sets. */
  set?: string;
  /** SESSION SCOPE (dump v1.5 linking): sibling dumps proposed FIRST and
   *  registered (contract + minted tokens + key/name indexes) before this
   *  subject proposes — the parity mirror of "import Button-Brand Primary,
   *  then import Dialog": the Dialog's nested instances LINK to the sibling
   *  contract (componentSetKey first, name fallback) instead of stubbing. */
  scope?: Array<{ dumpPath: string; set?: string }>;
  fileKey: string;
  setNodeId: string;
}

export interface ContractSubject {
  id: string;
  label: string;
  kind: 'contract';
  /** Catalog contract id (contracts/<name>.contract.json `id`). */
  contractId: string;
  fileKey: string;
  setNodeId: string;
}

export type ParitySubject = DumpSubject | ContractSubject;

const CBDS = 'WofZT8xaxXuc2Q6Je9S4XE';
const MAIN = '8nim1d0IPnehMxA7B7SYxC';

export const PARITY_SUBJECTS: ParitySubject[] = [
  // ---- CBDS fixtures (the owner's file) -----------------------------------
  {
    id: 'cbds-button-brand-primary',
    label: 'CBDS Button-Brand Primary',
    kind: 'dump',
    dumpPath: 'extract/figma/fixtures/cbds-plugin-button-brand-primary.dump.json',
    fileKey: CBDS,
    setNodeId: '258:1838',
  },
  {
    id: 'cbds-tooltip',
    label: 'CBDS Tooltip',
    kind: 'dump',
    dumpPath: 'extract/figma/fixtures/cbds-plugin-all-sets.v14.dump.json',
    set: 'Tooltip',
    fileKey: CBDS,
    setNodeId: '695:313',
  },
  {
    id: 'cbds-dialog',
    label: 'CBDS Dialog',
    kind: 'dump',
    dumpPath: 'extract/figma/fixtures/cbds-plugin-dialog.dump.json',
    // Session: the owner imported Button-Brand Primary before the Dialog —
    // the Dialog's ↪️action-1 button LINKS to ds.button-brand-primary
    // (name fallback: the plugin dialog dump predates v1.5 keys).
    scope: [{ dumpPath: 'extract/figma/fixtures/cbds-plugin-button-brand-primary.dump.json' }],
    fileKey: CBDS,
    setNodeId: '599:1333',
  },

  // ---- fidelity-matrix subjects with live anchors --------------------------
  {
    id: 'shoelace-tooltip',
    label: 'Shoelace Tooltip (kit redraw)',
    kind: 'dump',
    dumpPath: 'extract/fidelity-matrix/fixtures/shoelace-tooltip/dump.json',
    fileKey: 'nl9P0h3brratHTdncjzKIr',
    setNodeId: '37:142',
  },
  {
    id: 'shoelace-button-group',
    label: 'Shoelace Button Group (kit redraw)',
    kind: 'dump',
    dumpPath: 'extract/fidelity-matrix/fixtures/shoelace-button-group/dump.json',
    fileKey: 'nl9P0h3brratHTdncjzKIr',
    setNodeId: '376:3540',
  },
  {
    id: 'eventz-button',
    label: 'Eventz Button (client-style kit)',
    kind: 'dump',
    dumpPath: 'extract/fidelity-matrix/fixtures/eventz-button/dump.json',
    fileKey: 'E7oXr98i91HYQGZxA2USOQ',
    setNodeId: '2313:42',
  },

  // ---- catalog contracts anchored in the main POC file ---------------------
  { id: 'badge', label: 'Badge (catalog)', kind: 'contract', contractId: 'ds.badge', fileKey: MAIN, setNodeId: '6:10' },
  { id: 'button', label: 'Button (catalog)', kind: 'contract', contractId: 'ds.button', fileKey: MAIN, setNodeId: '5:21' },
  { id: 'checkbox', label: 'Checkbox (catalog)', kind: 'contract', contractId: 'ds.checkbox', fileKey: MAIN, setNodeId: '11:315' },
  { id: 'switch', label: 'Switch (catalog)', kind: 'contract', contractId: 'ds.switch', fileKey: MAIN, setNodeId: '11:1286' },
  { id: 'heading', label: 'Heading (catalog)', kind: 'contract', contractId: 'ds.heading', fileKey: MAIN, setNodeId: '32:1862' },
];
