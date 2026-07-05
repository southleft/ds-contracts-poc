/**
 * Extraction → PROPOSED contracts.
 *
 * Every proposal is validated against ContractSchema before it is written —
 * a proposal you can't build on is worse than no proposal. What extraction
 * cannot know is stated, not guessed:
 *   · anatomy is a minimal root stub (anatomy stays human-owned, docs/11)
 *   · figma bindings are INFERRED spellings (TitleCase) awaiting the
 *     design-side reconciliation
 *   · on* function props become declared events with trigger 'root'
 *   · node-kind props are skipped and reported as slot candidates
 * The sidecar report (proposals.md) lists every inference and every skip.
 */
import { ContractSchema } from '../scripts/contract-schema.js';
import { kebab, titleCase } from './types.js';
import type { ExtractedComponent, ExtractedProp } from './types.js';

export interface ProposalResult {
  contract: Record<string, unknown>;
  notes: string[];
}

const RESERVED = new Set(['children', 'className', 'style', 'ref', 'key', 'id']);

export function proposeContract(c: ExtractedComponent, prefix: string): ProposalResult {
  const notes: string[] = [];
  const props: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];

  for (const p of c.props) {
    if (RESERVED.has(p.name)) {
      notes.push(`prop \`${p.name}\`: platform prop — not contract API, skipped`);
      continue;
    }
    if (p.confidence === 'inferred') {
      notes.push(`prop \`${p.name}\`: type resolved heuristically — review`);
    }
    const base = {
      name: p.name,
      ...(p.description ? { description: p.description } : {}),
    };
    if (p.kind === 'enum' && p.values && p.values.length > 0) {
      props.push({
        ...base,
        type: { enum: p.values },
        ...(typeof p.default === 'string' && p.values.includes(p.default) ? { default: p.default } : {}),
        bindings: {
          figma: {
            kind: 'VARIANT',
            property: titleCase(p.name),
            values: Object.fromEntries(p.values.map((v) => [v, titleCase(v)])),
          },
          code: { prop: p.name },
        },
      });
      notes.push(
        `prop \`${p.name}\`: figma binding INFERRED as VARIANT "${titleCase(p.name)}" — confirm against the design library (reconcile step)`,
      );
    } else if (p.kind === 'boolean') {
      props.push({
        ...base,
        type: 'boolean',
        ...(typeof p.default === 'boolean' ? { default: p.default } : {}),
        bindings: {
          figma: { kind: 'BOOLEAN', property: titleCase(p.name) },
          code: { prop: p.name },
        },
      });
    } else if (p.kind === 'string' || p.kind === 'number') {
      props.push({
        ...base,
        type: p.kind === 'number' ? 'number' : 'text',
        ...(p.default !== undefined ? { default: p.default } : {}),
        ...(p.kind === 'string' && !p.optional ? { required: true } : {}),
        bindings: {
          figma: { kind: 'TEXT', property: titleCase(p.name) },
          code: { prop: p.name },
        },
      });
    } else if (p.kind === 'event') {
      if (/^on[A-Z]/.test(p.name)) {
        events.push({
          name: p.name.slice(2).replace(/^[A-Z]/, (ch) => ch.toLowerCase()),
          ...(p.description ? { description: p.description } : {}),
          bindings: { code: { prop: p.name } },
          trigger: 'root',
        });
        notes.push(
          `event \`${p.name}\`: declared with trigger 'root' — assign the real trigger part once anatomy is authored`,
        );
      } else {
        notes.push(`prop \`${p.name}\`: function-typed but not on* — skipped, review manually`);
      }
    } else if (p.kind === 'node') {
      notes.push(`prop \`${p.name}\`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually`);
    } else {
      notes.push(`prop \`${p.name}\`: unclassified type — not proposed, review manually`);
    }
  }

  const contract = {
    $schema: './contract.schema.json',
    id: `${prefix}.${kebab(c.name)}`,
    name: c.name,
    version: '0.1.0',
    status: 'draft' as const,
    description:
      (c.description ? `${c.description} ` : '') +
      `PROPOSED contract extracted from ${c.source} (${c.adapter} adapter) — API surface only; anatomy, tokens, and design bindings await reconciliation and human review.`,
    semantics: { element: 'div' as const },
    props,
    ...(events.length > 0 ? { events } : {}),
    states: [],
    anatomy: { root: {} },
    anchors: {
      figma: { fileKey: null, componentSetKey: null },
      code: { importPath: c.source.replace(/\.tsx?$/, ''), export: c.name },
    },
  };

  // Refuse to emit an unusable proposal.
  ContractSchema.parse(contract);
  notes.unshift(`semantics.element defaulted to "div" — set the real host element`);
  notes.unshift(`anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)`);
  return { contract, notes };
}

export function proposalsReport(
  results: { component: ExtractedComponent; proposal: ProposalResult }[],
): string {
  const lines = [
    '# Proposed contracts — extraction report',
    '',
    `${results.length} component(s) extracted. Every proposal parses against the contract schema, but a proposal is a STARTING POINT: confirm inferred design bindings via \`npm run reconcile\`, then review the notes below per component.`,
    '',
  ];
  for (const { component, proposal } of results) {
    const evCount = (proposal.contract.events as unknown[] | undefined)?.length ?? 0;
    lines.push(
      `## ${component.name}`,
      '',
      `- source: \`${component.source}\` (${component.adapter})`,
      `- proposed: ${(proposal.contract.props as unknown[]).length} props, ${evCount} events`,
      ...proposal.notes.map((n) => `- ${n}`),
      '',
    );
  }
  return lines.join('\n');
}
