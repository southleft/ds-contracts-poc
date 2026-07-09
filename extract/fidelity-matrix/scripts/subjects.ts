/**
 * The fidelity-matrix subjects — four real components, named once.
 *
 * A/B: Shoelace kit redraws (foreign Figma community kit), C: Eventz Button
 * (client-style kit), D: CBDS Button in BOTH directions (design URL + code
 * URL) — the convergence subject the thesis is measured on.
 */

export interface FigmaSubject {
  id: string;
  label: string;
  kind: 'figma';
  url: string;
  /** API-form node id (URL spells 37-142 → 37:142). */
  nodeId: string;
}

export interface CodeSubject {
  id: string;
  label: string;
  kind: 'code';
  /** GitHub blob URL of the entry TSX — the playground code-import path. */
  url: string;
}

export type Subject = FigmaSubject | CodeSubject;

export const SUBJECTS: Subject[] = [
  {
    id: 'shoelace-tooltip',
    label: 'A. Shoelace Tooltip',
    kind: 'figma',
    url: 'https://www.figma.com/design/nl9P0h3brratHTdncjzKIr/?node-id=37-142',
    nodeId: '37:142',
  },
  {
    id: 'shoelace-button-group',
    label: 'B. Shoelace Button Group',
    kind: 'figma',
    url: 'https://www.figma.com/design/nl9P0h3brratHTdncjzKIr/?node-id=376-3540',
    nodeId: '376:3540',
  },
  {
    id: 'eventz-button',
    label: 'C. Eventz Button',
    kind: 'figma',
    url: 'https://www.figma.com/design/E7oXr98i91HYQGZxA2USOQ/?node-id=2313-42',
    nodeId: '2313:42',
  },
  {
    id: 'cbds-button-design',
    label: 'D. CBDS Button (design side)',
    kind: 'figma',
    url: 'https://www.figma.com/design/WofZT8xaxXuc2Q6Je9S4XE/?node-id=258-1838',
    nodeId: '258:1838',
  },
  {
    id: 'cbds-button-code',
    label: 'D. CBDS Button (code side)',
    kind: 'code',
    url: 'https://github.com/southleft/cbds-components/blob/main/src/components/Button/Button.tsx',
  },
];

export const figmaSubjects = SUBJECTS.filter((s): s is FigmaSubject => s.kind === 'figma');
export const codeSubjects = SUBJECTS.filter((s): s is CodeSubject => s.kind === 'code');
