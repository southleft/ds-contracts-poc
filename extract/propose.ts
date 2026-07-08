/**
 * Extraction → PROPOSED contracts.
 *
 * Every proposal is validated against ContractSchema before it is written —
 * a proposal you can't build on is worse than no proposal. What extraction
 * cannot know is stated, not guessed:
 *   · anatomy: when the adapter could read structure (react-tsx with a
 *     co-located CSS Module), the proposal carries a REAL anatomy — part
 *     tree, token bindings, layout, states — inverted from the source and
 *     resolved against the real token tree. When it could not, anatomy
 *     stays the minimal root stub (anatomy is human-owned/reviewed, docs/11)
 *   · raw CSS values are REPORTED with nearest-token candidates — a literal
 *     color or dimension never becomes an invented token reference
 *   · figma bindings are INFERRED spellings (TitleCase) awaiting the
 *     design-side reconciliation
 *   · on* function props become declared events; when the code's onClick
 *     wiring is legible the trigger part (and toggle behavior) is read from
 *     it, otherwise trigger defaults to 'root' with a note
 *   · node-kind props become slots when the JSX shows where they render;
 *     otherwise they are skipped and reported as slot candidates
 * The sidecar report (proposals.md) lists every inference and every skip.
 */
import { ContractSchema } from '../scripts/contract-schema.js';
import { kebab, titleCase } from './types.js';
import type { ExtractedAnatomy, ExtractedComponent, ExtractedPart } from './types.js';

export interface ProposalResult {
  contract: Record<string, unknown>;
  notes: string[];
}

const RESERVED = new Set(['children', 'className', 'style', 'ref', 'key', 'id']);

/** The code generator's host-element vocabulary (ContractSchema semantics). */
const ELEMENT_VOCAB = new Set(
  (ContractSchema.shape.semantics.shape.element as { options: readonly string[] }).options,
);

/** IR part → contract Part JSON: component NAME refs become contract ids
 *  under the configured prefix; everything else is already contract-shaped. */
function convertPart(part: ExtractedPart, prefix: string, notes: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (part.element) out.element = part.element;
  if (part.layout) out.layout = part.layout;
  if (part.overlay) out.overlay = part.overlay;
  if (part.tokens && Object.keys(part.tokens).length > 0) out.tokens = part.tokens;
  if (part.states && Object.keys(part.states).length > 0) out.states = part.states;
  if (part.content) out.content = part.content;
  if (part.text !== undefined) out.text = part.text;
  if (part.animation) out.animation = part.animation;
  if (part.slot) out.slot = part.slot;
  if (part.component) {
    const id = `${prefix}.${kebab(part.component.name)}`;
    out.component = {
      id,
      ...(part.component.props ? { props: part.component.props } : {}),
      ...(part.component.text !== undefined ? { text: part.component.text } : {}),
    };
    notes.push(
      `anatomy: component ref \`<${part.component.name}>\` mapped to contract id \`${id}\` — confirm that contract exists (or adjust the id) before adoption`,
    );
  }
  if (part.attrs && Object.keys(part.attrs).length > 0) out.attrs = part.attrs;
  if (part.visibleWhen) out.visibleWhen = part.visibleWhen;
  if (part.optional) out.optional = true;
  if (part.parts) {
    out.parts = Object.fromEntries(
      Object.entries(part.parts).map(([name, child]) => [name, convertPart(child, prefix, notes)]),
    );
  }
  return out;
}

function anatomyNotes(anatomy: ExtractedAnatomy): string[] {
  const notes: string[] = [];
  for (const rv of anatomy.rawValues) {
    const candidates =
      rv.candidates.length > 0
        ? `nearest tokens by value: ${rv.candidates.map((c) => `\`{${c}}\``).join(', ')}`
        : 'no token in the tree has this value';
    notes.push(
      `RAW VALUE (not tokenized): \`${rv.selector} { ${rv.property}: ${rv.value} }\` — ${candidates}. A raw value is reported, never turned into an invented token; bind it to a real token and re-extract.`,
    );
  }
  notes.push(...anatomy.notes);
  return notes;
}

export function proposeContract(c: ExtractedComponent, prefix: string): ProposalResult {
  const notes: string[] = [];
  const props: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  const anatomy = c.anatomy;
  const slotProps = new Set<string>();
  if (anatomy) {
    // node props that the JSX places into named parts are real slots — they
    // must not double-report as "slot candidates".
    const walk = (p: ExtractedPart) => {
      if (p.slot) slotProps.add(p.slot.name);
      for (const child of Object.values(p.parts ?? {})) walk(child);
    };
    walk(anatomy.root);
  }
  // A toggled enum prop's default lives in the useState initializer, not the
  // destructuring — carry it over when the wiring made it legible.
  const toggleDefaults = new Map<string, string>();
  for (const wiring of Object.values(anatomy?.events ?? {})) {
    if (wiring.toggles && wiring.uncontrolledDefault !== undefined) {
      toggleDefaults.set(wiring.toggles.prop, wiring.uncontrolledDefault);
    }
  }

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
      const dflt =
        typeof p.default === 'string' && p.values.includes(p.default)
          ? p.default
          : toggleDefaults.has(p.name) && p.values.includes(toggleDefaults.get(p.name)!)
            ? toggleDefaults.get(p.name)!
            : undefined;
      props.push({
        ...base,
        type: { enum: p.values },
        ...(dflt !== undefined ? { default: dflt } : {}),
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
      if (dflt !== undefined && p.default === undefined) {
        notes.push(`prop \`${p.name}\`: default '${dflt}' read from the uncontrolled useState initializer`);
      }
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
        const name = p.name.slice(2).replace(/^[A-Z]/, (ch) => ch.toLowerCase());
        const wiring = anatomy?.events?.[name];
        events.push({
          name,
          ...(p.description ? { description: p.description } : {}),
          bindings: { code: { prop: p.name } },
          trigger: wiring?.trigger ?? 'root',
          ...(wiring?.toggles
            ? { toggles: { prop: wiring.toggles.prop, between: wiring.toggles.between, ...(wiring.toggles.aria ? { aria: wiring.toggles.aria } : {}) } }
            : {}),
        });
        notes.push(
          wiring
            ? `event \`${p.name}\`: trigger '${wiring.trigger}' read from the onClick wiring${wiring.toggles ? `; toggles ${wiring.toggles.prop} between [${wiring.toggles.between.join(', ')}]` : ''}`
            : `event \`${p.name}\`: declared with trigger 'root' — assign the real trigger part once anatomy is authored`,
        );
      } else {
        notes.push(`prop \`${p.name}\`: function-typed but not on* — skipped, review manually`);
      }
    } else if (p.kind === 'node') {
      notes.push(
        slotProps.has(p.name)
          ? `prop \`${p.name}\`: ReactNode — extracted as anatomy slot "${p.name}"`
          : `prop \`${p.name}\`: ReactNode — SLOT CANDIDATE, author as anatomy slot manually`,
      );
    } else {
      notes.push(`prop \`${p.name}\`: unclassified type — not proposed, review manually`);
    }
  }

  let anatomyJson: Record<string, unknown> = { root: {} };
  let element = 'div';
  let role: string | undefined;
  let states: string[] = [];
  if (anatomy) {
    if (ELEMENT_VOCAB.has(anatomy.element)) {
      element = anatomy.element;
    } else {
      notes.push(
        `semantics.element: extracted root element "${anatomy.element}" is outside the contract element vocabulary — defaulted to "div", review`,
      );
    }
    role = anatomy.role;
    states = anatomy.states;
    anatomyJson = { root: convertPart(anatomy.root, prefix, notes) };
    notes.push(...anatomyNotes(anatomy));
  }

  const contract = {
    $schema: './contract.schema.json',
    id: `${prefix}.${kebab(c.name)}`,
    name: c.name,
    version: '0.1.0',
    status: 'draft' as const,
    description:
      (c.description ? `${c.description} ` : '') +
      (anatomy
        ? `PROPOSED contract extracted from ${c.source} (${c.adapter} + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review.`
        : `PROPOSED contract extracted from ${c.source} (${c.adapter} adapter) — API surface only; anatomy, tokens, and design bindings await reconciliation and human review.`),
    semantics: { element: element as 'div', ...(role ? { role } : {}) },
    props,
    ...(events.length > 0 ? { events } : {}),
    states,
    anatomy: anatomyJson,
    anchors: {
      figma: { fileKey: null, componentSetKey: null },
      code: { importPath: c.source.replace(/\.tsx?$/, ''), export: c.name },
    },
  };

  // Refuse to emit an unusable proposal.
  ContractSchema.parse(contract);
  if (anatomy) {
    const countParts = (p: ExtractedPart): number =>
      1 + Object.values(p.parts ?? {}).reduce((n, child) => n + countParts(child), 0);
    const countTokens = (p: ExtractedPart): number =>
      Object.keys(p.tokens ?? {}).length +
      Object.values(p.parts ?? {}).reduce((n, child) => n + countTokens(child), 0);
    notes.unshift(
      `anatomy EXTRACTED from JSX + CSS Module — ${countParts(anatomy.root)} part(s), ${countTokens(anatomy.root)} token binding(s), ${anatomy.rawValues.length} raw value(s) reported. Anatomy is human-REVIEWED: check it against design intent before adoption.`,
    );
  } else {
    notes.unshift(`semantics.element defaulted to "div" — set the real host element`);
    notes.unshift(`anatomy is a stub — anatomy is human-owned, author it (or adopt diagnostic-only without it)`);
  }
  return { contract, notes };
}

export function proposalsReport(
  results: { component: ExtractedComponent; proposal: ProposalResult }[],
): string {
  const withAnatomy = results.filter((r) => r.component.anatomy).length;
  const lines = [
    '# Proposed contracts — extraction report',
    '',
    `${results.length} component(s) extracted${withAnatomy > 0 ? `, ${withAnatomy} with extracted anatomy` : ''}. Every proposal parses against the contract schema, but a proposal is a STARTING POINT: confirm inferred design bindings via \`npm run reconcile\`, then review the notes below per component.`,
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
