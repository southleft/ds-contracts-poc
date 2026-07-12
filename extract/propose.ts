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
import { mintFromCss } from '../core/mint-code.js';
import type { MintAxis, MintedEntry } from '../core/mint-tokens.js';
import { isEventCallbackName, kebab, titleCase } from './types.js';
import type { ExtractedAnatomy, ExtractedComponent, ExtractedPart } from './types.js';

export interface ProposalResult {
  contract: Record<string, unknown>;
  notes: string[];
  /** Present only when proposeContract ran with a mint option and at least
   *  one provisional leaf was minted — the same shape the Figma path returns
   *  (register it as the playground's minted token layer). */
  mintedTokens?: { tree: Record<string, unknown>; count: number; entries: MintedEntry[] };
}

/** Opt-in provisional minting for the code path: unbindable styled
 *  declarations (raw literals + foreign var()s) become imported.* leaves.
 *  `customProps` is the `:root` vocabulary harvested across the WHOLE fetched
 *  CSS set (core/mint-code.ts collectRootCustomProps). */
export interface ProposeMintOptions {
  customProps: Map<string, string>;
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

export function proposeContract(
  c: ExtractedComponent,
  prefix: string,
  mint?: ProposeMintOptions,
): ProposalResult {
  const notes: string[] = [...(c.notes ?? [])];
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
      // isEventCallbackName is THE shared function-prop rule — the referee
      // (parity/diagnose.ts) applies the same predicate, so this skip is
      // never re-flagged as drift.
      if (isEventCallbackName(p.name)) {
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

  // Mint pass (opt-in): every captured unbindable declaration becomes a
  // binding to a provisional `imported.*` leaf where the values allow it —
  // the proposal keeps the wild stylesheet's styling at literal fidelity
  // instead of shipping naked. Runs BEFORE anatomy conversion so bindings
  // land in the contract, and BEFORE schema validation so a bad minted ref
  // is refused, not returned.
  let mintedTokens: ProposalResult['mintedTokens'];
  const mintNotes: string[] = [];
  if (mint && anatomy?.mintables && anatomy.mintables.length > 0) {
    const axes: MintAxis[] = c.props
      .filter((p) => p.kind === 'enum' && p.values && p.values.length > 0)
      .map((p) => ({ propName: p.name, values: p.values! }));
    const minted = mintFromCss(c.name, anatomy.mintables, axes, mint.customProps);

    const partByName = new Map<string, ExtractedPart>([['root', anatomy.root]]);
    const walkParts = (p: ExtractedPart) => {
      for (const [name, child] of Object.entries(p.parts ?? {})) {
        if (!partByName.has(name)) partByName.set(name, child);
        walkParts(child);
      }
    };
    walkParts(anatomy.root);

    const groupKey = (part: string, state: string | undefined, cssProperty: string) =>
      [part, state ?? '', cssProperty].join(' ');
    const boundGroups = new Set<string>();
    for (const b of minted.bindings) {
      const site = `${b.part}${b.state ? ` :${b.state}` : ''} ${b.cssProperty}`;
      if (!b.ref) {
        if (b.reason) mintNotes.push(`mint: ${site} — ${b.reason}`);
        continue;
      }
      if (b.state) {
        if (b.part !== 'root') {
          mintNotes.push(`mint: ${site} — state bindings live on the root only; ${b.ref} not attached`);
          continue;
        }
        const bucket = ((anatomy.root.states ??= {})[b.state] ??= {});
        if (bucket[b.cssProperty] === undefined) {
          bucket[b.cssProperty] = b.ref;
          boundGroups.add(groupKey(b.part, b.state, b.cssProperty));
        } else {
          mintNotes.push(`mint: ${site} — a real token binding already covers it; ${b.ref} not attached`);
        }
        continue;
      }
      const target = partByName.get(b.part);
      if (!target) {
        mintNotes.push(`mint: ${site} — css part "${b.part}" has no matching extracted JSX part; ${b.ref} not attached`);
        continue;
      }
      if (target.tokens?.[b.cssProperty] === undefined) {
        target.tokens = { ...target.tokens, [b.cssProperty]: b.ref };
        boundGroups.add(groupKey(b.part, undefined, b.cssProperty));
      } else {
        mintNotes.push(`mint: ${site} — a real token binding already covers it; ${b.ref} not attached`);
      }
    }

    // A fully minted usage site is bound now — its RAW VALUE report line and
    // foreign-var refusal note would contradict the contract; drop them in
    // favor of the MINTED/CARRIED VERBATIM lines below (the mint-tokens
    // unbound-filtering discipline, applied to the code path's channels).
    const handled = (f: NonNullable<ExtractedAnatomy['mintables']>[number]) =>
      boundGroups.has(groupKey(f.part, f.state, f.cssProperty));
    anatomy.rawValues = anatomy.rawValues.filter(
      (rv) =>
        !anatomy.mintables!.some(
          (f) => handled(f) && f.selector === rv.selector && f.cssProperty === rv.property && f.raw === rv.value,
        ),
    );
    const silencedVars = new Set<string>();
    for (const f of anatomy.mintables) {
      const name = f.raw.match(/^var\(\s*--([A-Za-z0-9_-]+)/)?.[1];
      if (name && handled(f)) silencedVars.add(name);
    }
    for (const cv of minted.carriedVerbatim) {
      const name = cv.expression.match(/^var\(\s*--([A-Za-z0-9_-]+)/)?.[1];
      if (name) silencedVars.add(name); // replaced by the richer CARRIED VERBATIM line
    }
    if (silencedVars.size > 0) {
      anatomy.notes = anatomy.notes.filter(
        (n) => ![...silencedVars].some((v) => n.includes(`uses var(--${v}) which resolves to NO token`)),
      );
    }

    for (const e of minted.entries) {
      mintNotes.push(
        `MINTED ${e.ref} = ${e.value} — machine-named from a resolved value — rename against your real tokens (provisional); bound at: ${e.usageSites.join(', ')}`,
      );
    }
    for (const cv of minted.carriedVerbatim) {
      mintNotes.push(
        `CARRIED VERBATIM \`${cv.selector} { ${cv.cssProperty}: ${cv.expression} }\` — ${cv.reason}; no token minted, the declaration survives only in the source`,
      );
    }
    if (minted.count > 0) {
      mintedTokens = { tree: minted.tree, count: minted.count, entries: minted.entries };
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
    notes.push(...mintNotes);
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
  return { contract, notes, ...(mintedTokens ? { mintedTokens } : {}) };
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
