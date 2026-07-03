/**
 * Typed access to the repo's governed artifacts.
 * Everything the dashboard shows is read directly from the compiled
 * catalog, the raw contracts, and the parity / eval reports.
 */
import catalogJson from '../../catalog/catalog.json';
import accountOverviewRaw from '../../evals/adherence/arm-a/account-overview.tsx?raw';
import parityJson from '../../parity/report.json';
import evalsJson from '../../evals/results.json';
import adherenceJson from '../../evals/adherence/results.json';
import figmaSnapshotJson from '../../parity/snapshots/figma-components.json';
import semanticTokensJson from '../../tokens/semantic.tokens.json';
import semanticColorTokensJson from '../../tokens/modes/semantic.light.tokens.json';

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export type PropType = string[] | 'boolean' | 'string';

export interface CatalogProp {
  name: string;
  type: PropType;
  default?: unknown;
  required?: boolean;
  description?: string;
}

export interface ChildrenPolicy {
  kind: 'text' | 'slot' | 'none';
  accepts?: string[];
  acceptsMode?: string;
  description?: string;
}

export interface SlotDef {
  prop: string;
  accepts: string[];
  acceptsMode: string;
  optional: boolean;
  description?: string;
}

export interface CatalogComponent {
  id: string;
  name: string;
  version: string;
  status: string;
  description: string;
  figma: { representation: 'component' | 'native'; componentSetKey?: string };
  props: CatalogProp[];
  children: ChildrenPolicy;
  slots: SlotDef[];
}

export interface Rule {
  id: string;
  statement: string;
  enforcement: 'judge' | 'agent';
  forbiddenRawElements?: string[];
}

export interface Catalog {
  system: { name: string; catalogVersion: string; gitCommit: string; source: string };
  package: { name: string; usage: string; stylesheet: string };
  rules: Rule[];
  tokens: { guidance: string; semanticCssVariables: string[]; allCssVariables: string[] };
  components: CatalogComponent[];
}

export const catalog = catalogJson as unknown as Catalog;

// ---------------------------------------------------------------------------
// Raw contracts
// ---------------------------------------------------------------------------

export interface AnatomyNode {
  element?: string;
  description?: string;
  optional?: boolean;
  layout?: Record<string, string>;
  tokens?: Record<string, string>;
  states?: Record<string, Record<string, string>>;
  parts?: Record<string, AnatomyNode>;
  component?: { id: string; props?: Record<string, unknown>; text?: string };
  slot?: {
    name: string;
    figmaProperty?: string;
    required?: boolean;
    accepts?: string[];
    defaultContent?: unknown[];
  };
  content?: { prop: string };
}

export interface RawProp {
  name: string;
  description?: string;
  type: 'boolean' | 'text' | { enum: string[] };
  default?: unknown;
  required?: boolean;
  bindings?: {
    figma?: { kind: string; property: string; values?: Record<string, string> };
    code?: { prop: string };
  };
}

export interface RawContract {
  id: string;
  name: string;
  version: string;
  status: string;
  description: string;
  semantics?: { element?: string; role?: string };
  props: RawProp[];
  states: string[];
  anatomy: { root: AnatomyNode };
  anchors: {
    // componentSetKey / nodeId are null for native-representation concepts
    // (Stack, Inline) — they map to Figma auto-layout, not a component set.
    figma: { fileKey: string; componentSetKey: string | null; nodeId: string | null };
    code: { importPath: string; export: string };
  };
}

const contractModules = import.meta.glob<{ default: RawContract }>(
  '../../contracts/*.contract.json',
  { eager: true },
);

export const rawContracts: RawContract[] = Object.values(contractModules).map(
  (mod) => mod.default,
);

// ---------------------------------------------------------------------------
// Merged component entries (catalog entry + raw contract, by id)
// ---------------------------------------------------------------------------

export interface ComponentEntry extends CatalogComponent {
  contract?: RawContract;
}

export const components: ComponentEntry[] = catalog.components.map((entry) => ({
  ...entry,
  contract: rawContracts.find((contract) => contract.id === entry.id),
}));

export function getComponent(id: string): ComponentEntry | undefined {
  return components.find((component) => component.id === id);
}

/** Repo path of the raw contract file backing a catalog id (ds.table-row → contracts/table-row.contract.json). */
export function contractFilePath(id: string): string {
  return `contracts/${id.replace(/^ds\./, '')}.contract.json`;
}

export const nativeComponentCount = components.filter(
  (component) => component.figma.representation === 'native',
).length;

// ---------------------------------------------------------------------------
// Figma snapshot
// ---------------------------------------------------------------------------

export interface FigmaProperty {
  type: string;
  defaultValue: unknown;
  variantOptions: string[] | null;
  preferredValues: { type: string; key: string }[] | null;
}

export interface FigmaSet {
  name: string;
  nodeId: string;
  key: string;
  variantCount: number;
  properties: Record<string, FigmaProperty>;
  nestedInstances: string[];
}

export interface FigmaSnapshot {
  fileName: string;
  fileKey: string;
  sets: FigmaSet[];
}

export const figmaSnapshot = figmaSnapshotJson as unknown as FigmaSnapshot;

export function figmaSetByName(name: string): FigmaSet | undefined {
  return figmaSnapshot.sets.find((set) => set.name === name);
}

export function figmaNodeUrl(nodeId: string): string {
  return `https://www.figma.com/design/8nim1d0IPnehMxA7B7SYxC/DS-Contracts-POC?node-id=${nodeId.replace(':', '-')}`;
}

// ---------------------------------------------------------------------------
// Parity report
// ---------------------------------------------------------------------------

export interface ParityFinding {
  surface: string;
  classification: 'ahead' | 'behind' | 'mismatch';
  subject: string;
  detail: string;
  remedy: string;
}

export interface ParityReport {
  findings: ParityFinding[];
  checkedContracts: string[];
}

export const parity = parityJson as unknown as ParityReport;

export function findingsForComponent(name: string): ParityFinding[] {
  return parity.findings.filter((finding) => finding.subject.startsWith(name));
}

// ---------------------------------------------------------------------------
// Evals
// ---------------------------------------------------------------------------

export interface EvalResult {
  id: string;
  claim: string;
  pass: boolean;
}

export interface EvalReport {
  passed: number;
  total: number;
  results: EvalResult[];
}

export const evals = evalsJson as unknown as EvalReport;

export function evalsByClaim(): Map<string, EvalResult[]> {
  const groups = new Map<string, EvalResult[]>();
  for (const result of evals.results) {
    const group = groups.get(result.claim) ?? [];
    group.push(result);
    groups.set(result.claim, group);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// The reported GAP — extracted verbatim from the governed generator's actual
// output (evals/adherence/arm-a/account-overview.tsx), not restated by hand.
// ---------------------------------------------------------------------------

function extractGapComment(source: string): string | undefined {
  const match = /\{\/\*\s*(GAP:[\s\S]*?)\*\/\}/.exec(source);
  return match ? match[1].replace(/\s+/g, ' ').trim() : undefined;
}

/** The `{/* GAP: … *\/}` comment as written by the generator, or undefined. */
export const reportedGap = extractGapComment(accountOverviewRaw);

// ---------------------------------------------------------------------------
// Adherence A/B
// ---------------------------------------------------------------------------

export interface AdherenceScreen {
  file: string;
  score: number;
  violations: number;
  adherent: boolean;
}

export interface ArmSummary {
  screens: number;
  adherentScreens: number;
  meanScore: number;
  totalViolations: number;
  totalChecks: number;
  violationsByRule: Record<string, number>;
  perScreen: AdherenceScreen[];
}

export interface AdherenceReport {
  summary: { 'arm-a': ArmSummary; 'arm-b': ArmSummary };
}

export const adherence = adherenceJson as unknown as AdherenceReport;

// ---------------------------------------------------------------------------
// Semantic tokens — walk tokens/semantic.tokens.json to recover the true
// dot paths (a css var like --space-inset-x-sm cannot be re-segmented from
// hyphens alone; the source file is authoritative).
// ---------------------------------------------------------------------------

export interface TokenInfo {
  /** e.g. "space.inset-x.sm" */
  dotPath: string;
  /** e.g. "--space-inset-x-sm" */
  cssVar: string;
  /** e.g. "space/inset-x/sm" — the Figma variable name */
  figmaName: string;
  /** top-level group: color | space | radius | size | border | font */
  group: string;
  /** DTCG $type where declared (color, dimension, fontWeight, ...) */
  type: string;
}

function walkTokens(
  node: Record<string, unknown>,
  path: string[],
  inheritedType: string,
  out: TokenInfo[],
): void {
  const type = typeof node['$type'] === 'string' ? (node['$type'] as string) : inheritedType;
  if ('$value' in node) {
    out.push({
      dotPath: path.join('.'),
      cssVar: `--${path.join('-')}`,
      figmaName: path.join('/'),
      group: path[0] ?? '',
      type,
    });
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    if (value !== null && typeof value === 'object') {
      walkTokens(value as Record<string, unknown>, [...path, key], type, out);
    }
  }
}

function collectSemanticTokens(): TokenInfo[] {
  const out: TokenInfo[] = [];
  // Color semantics are mode-scoped (light/dark share the same names), so the
  // light file supplies the color token names; everything else is unimodal.
  walkTokens(semanticColorTokensJson as unknown as Record<string, unknown>, [], '', out);
  walkTokens(semanticTokensJson as unknown as Record<string, unknown>, [], '', out);
  return out;
}

export const semanticTokens: TokenInfo[] = collectSemanticTokens();

export function semanticTokensByGroup(): Map<string, TokenInfo[]> {
  const order = ['color', 'space', 'radius', 'size', 'font', 'border', 'opacity'];
  const groups = new Map<string, TokenInfo[]>();
  for (const name of order) groups.set(name, []);
  for (const token of semanticTokens) {
    const group = groups.get(token.group) ?? [];
    group.push(token);
    groups.set(token.group, group);
  }
  for (const [name, tokens] of groups) {
    if (tokens.length === 0) groups.delete(name);
  }
  return groups;
}
