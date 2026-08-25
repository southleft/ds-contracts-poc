/**
 * Contract-level validation (beyond the Zod schema) — the deep referee every
 * emitter runs before it renders. Moved verbatim from the reference repo's
 * core/emit-react.ts. The signature is the one the CLI's promote step and
 * the web-components emitter depend on: it APPENDS to `errors` (never
 * throws) and takes the icon-asset map so icon refs are checked by name.
 * Pure; imports @ds-contracts/schema only.
 */
import {
  DECLARED_CHANNELS,
  LITERAL_CHANNELS,
  REF_OVERRIDE_CHANNELS,
  TOKEN_CHANNELS,
  STATE_PREVIEW_PROPERTY,
  STYLES_WHEN_ALLOWED,
  isNativeCheckablePart,
  statePreviewSubstProps,
  tokensByPropEntries,
  VOID_ELEMENTS,
  walkAnatomy,
  type Contract,
  type Part,
} from '@ds-contracts/schema';
import {
  boolProps,
  enumProps,
  isArrayType,
  isEnum,
  isMultiRoot,
  isVariantBool,
  NATIVE_ROLE_HOSTS,
  PART_STATE_CHANNELS,
  placeholdersIn,
  rootElementsOf,
  STATE_SELECTORS,
  stripBraces,
  textProps,
  topRootNames,
  topRoots,
} from './anatomy.js';
import { ELEMENT_META } from './elements.js';

// ---------------------------------------------------------------------------
// Contract-level validation (beyond the Zod schema)
// ---------------------------------------------------------------------------

/** Component refs must form a DAG — the emitters render composition by
 *  recursion, so a contract that composes itself (directly or through a
 *  chain of dependencies) is infinite anatomy. The field failure mode is a
 *  'Maximum call stack size exceeded' crash instead of a named refusal
 *  (live repro: a hand-edited ds.button whose anatomy kept a ds.button
 *  instance). Walks the ref graph (component refs + slot defaultContent)
 *  from `startId`, treating `fromId` as already on the path; returns the
 *  cycle spelled out (e.g. [ds.button, ds.button]) or null. Contracts
 *  missing from `byId` end the walk — their absence is its own refusal. */
function findComponentCycle(
  fromId: string,
  startId: string,
  byId: Map<string, Contract>,
): string[] | null {
  const acyclic = new Set<string>(); // fully explored, no cycle reachable
  const visit = (id: string, path: string[]): string[] | null => {
    const at = path.indexOf(id);
    if (at >= 0) return [...path.slice(at), id];
    if (acyclic.has(id)) return null;
    const dep = byId.get(id);
    if (!dep) return null;
    const next = [...path, id];
    for (const w of walkAnatomy(dep)) {
      const targets = [
        ...(w.part.component ? [w.part.component.id] : []),
        ...(w.part.slot?.defaultContent ?? []).map((item) => item.id),
      ];
      for (const t of targets) {
        const cycle = visit(t, next);
        if (cycle) return cycle;
      }
    }
    acyclic.add(id);
    return null;
  };
  return visit(startId, [fromId]);
}

export function validateContract(
  contract: Contract,
  byId: Map<string, Contract>,
  errors: string[],
  iconAssets: Map<string, string>,
) {
  const enumNames = new Set(enumProps(contract).map((p) => p.name));
  const hasChildrenText = (dep: Contract) =>
    dep.props.some((p) => p.type === 'text' && p.bindings.code.prop === 'children');
  const seen = new Set<string>();
  for (const { name, path: p, part } of walkAnatomy(contract)) {
    if (seen.has(name)) errors.push(`${contract.id}: duplicate anatomy part name "${name}"`);
    seen.add(name);
    if (part.component) {
      const dep = byId.get(part.component.id);
      if (!dep) {
        errors.push(`${contract.id}: part "${name}" references component "${part.component.id}" which has no contract in scope`);
      }
      const cycle = findComponentCycle(contract.id, part.component.id, byId);
      if (cycle) {
        errors.push(
          `${contract.id}: part "${name}" component ref creates a cycle (${cycle.join(' → ')}) — a contract cannot compose itself`,
        );
      }
      for (const [propName, value] of Object.entries(part.component.props ?? {})) {
        if (dep && !dep.props.some((dp) => dp.name === propName)) {
          errors.push(`${contract.id}: part "${name}" sets unknown ${dep.id} prop "${propName}"`);
        }
        const depProp = dep?.props.find((dp) => dp.name === propName);
        if (depProp && isArrayType(depProp)) {
          errors.push(`${contract.id}: part "${name}" sets ${dep!.id} arrayOf prop "${propName}" — structured values cannot be fixed in anatomy`);
        }
        const parentRef = typeof value === 'string' ? value.match(/^\{([a-z][\w-]*)\}$/) : null;
        if (parentRef && !enumNames.has(parentRef[1])) {
          errors.push(
            `${contract.id}: part "${name}" maps "{${parentRef[1]}}" but no enum prop "${parentRef[1]}" exists on this contract`,
          );
        }
      }
      if (part.component.text !== undefined && dep && !hasChildrenText(dep)) {
        errors.push(`${contract.id}: part "${name}" sets text but ${dep.id} has no children text prop`);
      }
      // Round 2 iteration 9 — per-instance overrides: registry channels
      // only, and the CHILD must declare each channel overridable on its
      // root (the child's CSS is what consumes the custom property; a host
      // setting a var nobody reads is a silent no-op, refused by name).
      for (const channel of Object.keys(part.component.overrides ?? {})) {
        if (!REF_OVERRIDE_CHANNELS[channel]) {
          errors.push(
            `${contract.id}: part "${name}" component override channel "${channel}" is not registered (REF_OVERRIDE_CHANNELS: ${Object.keys(REF_OVERRIDE_CHANNELS).join(', ')})`,
          );
          continue;
        }
        if (dep && !(dep.anatomy.root?.overridable ?? []).includes(channel)) {
          errors.push(
            `${contract.id}: part "${name}" overrides "${channel}" but ${dep.id} does not declare it overridable — the child's CSS would never consume the custom property (silent no-op refused)`,
          );
        }
      }
    }
    // Round 2 iteration 9 — `overridable` is root-only consumption
    // vocabulary: registry channels, each backed by the root's own bindings.
    if (part.overridable) {
      if (!(p.length === 1 && p[0] === 'root')) {
        errors.push(`${contract.id}: part "${name}" declares overridable — only the root part consumes per-instance overrides`);
      }
      for (const channel of part.overridable) {
        const spec = REF_OVERRIDE_CHANNELS[channel];
        if (!spec) {
          errors.push(
            `${contract.id}: part "${name}" overridable channel "${channel}" is not registered (REF_OVERRIDE_CHANNELS: ${Object.keys(REF_OVERRIDE_CHANNELS).join(', ')})`,
          );
          continue;
        }
        for (const cssProp of spec.css) {
          if (!part.tokens?.[cssProp]) {
            errors.push(
              `${contract.id}: part "${name}" declares "${channel}" overridable but binds no "${cssProp}" token — nothing to consume the override through`,
            );
          }
        }
      }
    }
    for (const item of part.slot?.defaultContent ?? []) {
      const dep = byId.get(item.id);
      if (!dep) {
        errors.push(`${contract.id}: slot "${part.slot!.name}" defaultContent references "${item.id}" which has no contract in scope`);
      }
      const cycle = findComponentCycle(contract.id, item.id, byId);
      if (cycle) {
        errors.push(
          `${contract.id}: slot "${part.slot!.name}" defaultContent "${item.id}" creates a cycle (${cycle.join(' → ')}) — a contract cannot compose itself`,
        );
      }
      if (item.text !== undefined && dep && !hasChildrenText(dep)) {
        errors.push(
          `${contract.id}: slot "${part.slot!.name}" defaultContent sets text but ${dep.id} has no children text prop`,
        );
      }
    }
    // SLOT CARDINALITY AND THE RESTRICT TIER — declared by the schema since v?,
    // refereed by nothing until now.
    //
    // MEASURED over every committed contract (48 slots): `acceptsMode` is
    // declared 38 times, `accepts` 19, `defaultContent` 12, `required` 3 — and
    // `min`, `max` and `acceptsMode: 'restrict'` are declared ZERO times. So
    // this closes a promise, not a live bug: contracts/contract.schema.json
    // accepts `min`, `max` and `restrict`, and an author who wrote one got
    // SILENCE — no carry, no refusal. That is the failure this repo is built
    // to refuse, sitting in the schema itself.
    //
    // The fixtures are therefore synthetic (core/slot-constraints-check.ts);
    // there is nothing in the corpus to point at, and saying so is part of the
    // measurement.
    if (part.slot) {
      const s = part.slot;
      const n = (s.defaultContent ?? []).length;
      if (s.min !== undefined && s.max !== undefined && s.min > s.max) {
        errors.push(`${contract.id}: slot "${s.name}" declares min ${s.min} > max ${s.max} — no content can satisfy it`);
      }
      if (s.required === true && s.min !== undefined && s.min < 1) {
        errors.push(`${contract.id}: slot "${s.name}" is required but declares min ${s.min} — a required slot cannot accept emptiness`);
      }
      // defaultContent is what the contract SHIPS in the slot, so it is the one
      // occupancy this file can check statically. A consumer may pass more at
      // runtime; that is the consumer's contract to keep, and no emitter sees it.
      if (s.max !== undefined && n > s.max) {
        errors.push(`${contract.id}: slot "${s.name}" declares max ${s.max} but its defaultContent ships ${n} item(s)`);
      }
      if (s.min !== undefined && n > 0 && n < s.min) {
        errors.push(`${contract.id}: slot "${s.name}" declares min ${s.min} but its defaultContent ships only ${n} item(s)`);
      }
      if (s.acceptsMode === 'restrict') {
        if (!s.accepts || s.accepts.length === 0) {
          errors.push(`${contract.id}: slot "${s.name}" is acceptsMode "restrict" but lists no accepts — restricting to nothing admits nothing`);
        }
        for (const item of s.defaultContent ?? []) {
          if (s.accepts && !s.accepts.includes(item.id)) {
            errors.push(
              `${contract.id}: slot "${s.name}" is acceptsMode "restrict" but its defaultContent ships "${item.id}", which is not in accepts [${(s.accepts ?? []).join(', ')}] — the contract violates its own restriction`,
            );
          }
        }
      }
    }
    const substitutableProps = new Set([...enumProps(contract), ...boolProps(contract)].map((pr) => pr.name));
    if (p.length > 1) {
      // Nested parts (path.length > 1 — NOT a top-level root, single- or
      // multi-root) carry substituted tokens as descendant rules under the
      // root's enum classes.
      //
      // GAP-CLOSING ROUND 10 — THE ARITY WAS THE EMITTER'S, NOT THE MODEL'S.
      // This used to refuse two placeholders on a nested token, and the
      // refusal propagated all the way back into the mint classifier, which
      // declines to even OFFER a nested pair to a caller whose binding placer
      // cannot spell one. The consequence was not a named approximation: the
      // channel vanished. Untitled UI's Social button draws its label WHITE
      // on the brand themes and #404040 on the two light ones — ink =
      // f(social × theme) — so `color` never reached the contract at all and
      // every one of its 108 variants rendered the UA's black on a blue,
      // black or pink ground.
      //
      // Every enum class rides the ROOT element, so a pair is the compound
      // ancestor selector `.social-facebook.theme-color .Text` — the exact
      // shape the ROOT's own two- and three-placeholder tokens already emit
      // (`.type-brand.style-fill.state-hover`) and the shape the S2
      // `tokensByProp` map lift already emits one level down. No new
      // vocabulary; the same rule, one nesting level deeper.
      //
      // RESIDUAL (2026-08-22, the states round): a BOOLEAN placeholder on a
      // nested token used to be refused here as an "unknown enum prop" while
      // the root carried it (substValues/boolFrag) and the web-components
      // emitter carried it on parts too — three surfaces, two answers. The
      // part path now expands booleans exactly like the root (attribute
      // presence on the root element); only a placeholder naming NEITHER an
      // enum nor a boolean prop is refused, by name, for every surface.
      for (const ref of Object.values(part.tokens ?? {})) {
        for (const ph of placeholdersIn(stripBraces(ref))) {
          if (!substitutableProps.has(ph)) {
            errors.push(
              `${contract.id}: part "${name}" token "${ref}" substitutes "{${ph}}", which is not an enum or boolean prop of this contract — no surface has a class or attribute to select on`,
            );
          }
        }
      }
    }
    // STATES REFS (the residual the multi-axis fix left open): a root or part
    // `states` ref may substitute ANY number of enum/boolean props — every CSS
    // surface expands the cartesian exactly like a token ref (react comboCls,
    // html comboSel, web-components rootWithCombo). Before this every surface's
    // `phs.length === 1 && enums.get(…)` branch dropped a two-placeholder or
    // boolean-placeholder state ref WITHOUT A WORD — the hover fact vanished.
    // A placeholder naming no such prop has nothing to select on anywhere and
    // is refused here, once, by name, so html/react-inline (which gate on
    // validateContract alone) refuse exactly as react/web-components do.
    for (const [state, overrides] of Object.entries(part.states ?? {})) {
      for (const [cssProp, ref] of Object.entries(overrides)) {
        for (const ph of placeholdersIn(stripBraces(ref))) {
          if (!substitutableProps.has(ph)) {
            errors.push(
              `${contract.id}: part "${name}" states.${state}.${cssProp} ref "${ref}" substitutes "{${ph}}", which is not an enum or boolean prop of this contract — no surface has a class or attribute to select on`,
            );
          }
        }
      }
    }
    if (part.content) {
      const prop = contract.props.find(
        (pr) => pr.type === 'text' && pr.bindings.code.prop === part.content!.prop,
      );
      if (!prop) {
        errors.push(
          `${contract.id}: part "${name}" binds content to unknown text prop "${part.content.prop}"`,
        );
      }
    }
    // v7 layoutByProp: the driving prop must be a declared enum and every
    // map key one of its values; component parts lay themselves out via
    // their own contract, so an override there would be silently dead.
    if (part.layoutByProp) {
      const lbp = part.layoutByProp;
      const lbpProp = contract.props.find((pr) => pr.name === lbp.prop);
      if (!lbpProp) {
        errors.push(`${contract.id}: part "${name}" layoutByProp references unknown prop "${lbp.prop}"`);
      } else if (!isEnum(lbpProp)) {
        errors.push(`${contract.id}: part "${name}" layoutByProp prop "${lbp.prop}" must be an enum prop`);
      } else {
        for (const k of Object.keys(lbp.map)) {
          if (!lbpProp.type.enum.includes(k)) {
            errors.push(`${contract.id}: part "${name}" layoutByProp map key "${k}" is not a value of prop "${lbp.prop}"`);
          }
        }
      }
      if (part.component) {
        errors.push(`${contract.id}: part "${name}" is a component instance — layoutByProp cannot restyle it (the child contract owns its layout)`);
      }
    }
    // v10 tokensByProp: the driving prop must be a declared enum, every map
    // key one of its values, and every mapped ref plain (per-value maps ARE
    // the substitution — a placeholder inside one is double substitution);
    // component parts style themselves via their own contract.
    // v14: MULTIPLE entries (ordered). Refusal rules: two entries may not
    // share BOTH a prop and a channel (a conflicting channel+prop pair is
    // ambiguous — refused by name); entries on DIFFERENT props may overlap
    // channels (later entry wins — the documented cascade order).
    const tbpEntries = tokensByPropEntries(part);
    for (const tbp of tbpEntries) {
      const tbpProp = contract.props.find((pr) => pr.name === tbp.prop);
      if (!tbpProp) {
        errors.push(`${contract.id}: part "${name}" tokensByProp references unknown prop "${tbp.prop}"`);
      } else if (!isEnum(tbpProp)) {
        errors.push(`${contract.id}: part "${name}" tokensByProp prop "${tbp.prop}" must be an enum prop`);
      } else {
        for (const [k, overrides] of Object.entries(tbp.map)) {
          if (!tbpProp.type.enum.includes(k)) {
            errors.push(`${contract.id}: part "${name}" tokensByProp map key "${k}" is not a value of prop "${tbp.prop}"`);
          }
          for (const ref of Object.values(overrides)) {
            // S2 capability lift (computed-capture floor): a per-value map
            // ref may carry AT MOST ONE placeholder naming a DIFFERENT
            // declared enum prop — the CSS emitters expand it as a compound
            // enum-class rule (.variant-primary.tone-critical). Field case:
            // a pair binding whose second axis is a defaultless enum (Button
            // tone) — the unset plane rides the base/other-axis map, the set
            // planes need the remaining axis substituted per value. More
            // than one placeholder, an unknown prop, or the entry's own prop
            // (double substitution) refuse by name, as before.
            const phs = placeholdersIn(stripBraces(ref));
            if (phs.length > 1) {
              errors.push(
                `${contract.id}: part "${name}" tokensByProp ref "${ref}" carries ${phs.length} placeholders — per-value maps hold at most one`,
              );
            } else if (phs.length === 1 && phs[0] === tbp.prop) {
              errors.push(
                `${contract.id}: part "${name}" tokensByProp ref "${ref}" substitutes the entry's own prop "${tbp.prop}" — the per-value map IS that substitution`,
              );
            } else if (phs.length === 1 && !enumProps(contract).some((pr) => pr.name === phs[0])) {
              errors.push(
                `${contract.id}: part "${name}" tokensByProp ref "${ref}" substitutes unknown enum prop "${phs[0]}"`,
              );
            }
          }
        }
      }
      if (part.component) {
        errors.push(`${contract.id}: part "${name}" is a component instance — tokensByProp cannot restyle it (the child contract owns its styling)`);
      }
    }
    // v14 conflict rule across tokensByProp entries AND literalsByProp
    // entries: the same (prop, channel) pair claimed twice is refused by
    // name — within one field or across the token/literal fields.
    {
      const claimed = new Map<string, string>(); // "prop|channel" → field label
      const claim = (prop: string, channel: string, label: string) => {
        const key = `${prop}|${channel}`;
        const prior = claimed.get(key);
        if (prior) {
          errors.push(
            `${contract.id}: part "${name}" carries channel "${channel}" for prop "${prop}" in two entries (${prior} and ${label}) — a conflicting channel+prop pair is refused by name`,
          );
        } else {
          claimed.set(key, label);
        }
      };
      tbpEntries.forEach((entry, i) => {
        const channels = new Set(Object.values(entry.map).flatMap((o) => Object.keys(o)));
        for (const ch of channels) claim(entry.prop, ch, `tokensByProp[${i}]`);
      });
      (part.literalsByProp ?? []).forEach((entry, i) => {
        const channels = new Set(Object.values(entry.map).flatMap((o) => Object.keys(o)));
        for (const ch of channels) claim(entry.prop, ch, `literalsByProp[${i}]`);
      });
      // v19 (RC2): declaredByProp joins the SAME conflict ledger. A declared
      // channel is disjoint from the token/literal vocabularies by
      // construction, but two declaredByProp entries claiming one
      // (prop, channel) pair would resolve by order alone — refuse by name.
      (part.declaredByProp ?? []).forEach((entry, i) => {
        const channels = new Set(Object.values(entry.map).flatMap((o) => Object.keys(o)));
        for (const ch of channels) claim(entry.prop, ch, `declaredByProp[${i}]`);
      });
    }
    // SILENT-LOSS ROUND (task #33, fix 4) — TOKEN CHANNELS ARE A REGISTRY.
    // `tokens` was typed `z.record(z.string(), TokenRefSchema)` and this
    // function whitelisted `declared` and `literals` but NOT `tokens`, so any
    // string was a legal channel and the CSS emitters wrote it out verbatim.
    // Live consequence: MUI's Switch carries `tokens["translate-y"]` (a
    // SYNTHETIC channel minted by decomposeTranslate) and the stylesheet said
    // `translate-y: var(…)` — a property no browser understands. Same class
    // as the `-state-checked` bug. Now every channel names what each surface
    // does with it (TOKEN_CHANNELS) or is refused BY NAME.
    const checkTokenChannel = (cssProp: string, where: string) => {
      if (TOKEN_CHANNELS[cssProp]) return;
      errors.push(
        `${contract.id}: part "${name}" ${where} sets "${cssProp}" which is not a token channel (TOKEN_CHANNELS registry — no emitter renders it; register the channel with its canvas verdict and its CSS spelling, or move the fact to declared/literals)`,
      );
    };
    for (const cssProp of Object.keys(part.tokens ?? {})) checkTokenChannel(cssProp, 'tokens');
    tokensByPropEntries(part).forEach((entry, i) => {
      for (const overrides of Object.values(entry.map ?? {})) {
        for (const ch of Object.keys(overrides)) checkTokenChannel(ch, `tokensByProp[${i}]`);
      }
    });
    // Root `states` had NO channel gate at all (nested-part states are gated
    // by the narrower PART_STATE_CHANNELS below) — the same hole, one level
    // up. It uses the token vocabulary, so it is refereed by the same
    // registry.
    if (p.length === 1) {
      for (const [state, m] of Object.entries(part.states ?? {})) {
        for (const ch of Object.keys(m ?? {})) checkTokenChannel(ch, `states.${state}`);
      }
    }
    // v14 literals: bounded channels only; literalsByProp props must be
    // declared enums with valid value keys; a channel carried by BOTH
    // base `tokens` and base `literals` is ambiguous — refused by name.
    for (const [cssProp] of Object.entries(part.literals ?? {})) {
      if (!LITERAL_CHANNELS.has(cssProp)) {
        errors.push(
          `${contract.id}: part "${name}" literals sets "${cssProp}" which is not a literal channel (${[...LITERAL_CHANNELS].join(', ')})`,
        );
      }
      if (part.tokens && cssProp in part.tokens) {
        errors.push(
          `${contract.id}: part "${name}" carries channel "${cssProp}" as BOTH a token binding (${part.tokens[cssProp]}) and a literal ("${part.literals![cssProp]}") — ambiguous, refused by name: keep ONE of tokens.${cssProp} / literals.${cssProp} (which wins is the contract author's choice; the emitter will not pick)`,
        );
      }
    }
    for (const entry of part.literalsByProp ?? []) {
      const lbpProp = contract.props.find((pr) => pr.name === entry.prop);
      if (!lbpProp) {
        errors.push(`${contract.id}: part "${name}" literalsByProp references unknown prop "${entry.prop}"`);
      } else if (!isEnum(lbpProp) && !isVariantBool(lbpProp)) {
        errors.push(
          `${contract.id}: part "${name}" literalsByProp prop "${entry.prop}" must be an enum prop or VARIANT-bound boolean`,
        );
      } else {
        const allowed = isEnum(lbpProp) ? lbpProp.type.enum : ['true', 'false'];
        for (const [k, overrides] of Object.entries(entry.map)) {
          if (!allowed.includes(k)) {
            errors.push(`${contract.id}: part "${name}" literalsByProp map key "${k}" is not a value of prop "${entry.prop}"`);
          }
          for (const ch of Object.keys(overrides)) {
            if (!LITERAL_CHANNELS.has(ch)) {
              errors.push(
                `${contract.id}: part "${name}" literalsByProp sets "${ch}" which is not a literal channel (${[...LITERAL_CHANNELS].join(', ')})`,
              );
            }
          }
        }
      }
      if (part.component) {
        errors.push(`${contract.id}: part "${name}" is a component instance — literalsByProp cannot restyle it (the child contract owns its styling)`);
      }
    }
    if (part.literals && part.component) {
      errors.push(`${contract.id}: part "${name}" is a component instance — literals cannot restyle it (the child contract owns its styling)`);
    }
    // v15 declared facts (S4): registry channels only, each value inside the
    // channel's bounded grammar; a channel carried by BOTH declared and
    // tokens/literals is ambiguous — refused by name; component/slot parts
    // refuse (the child contract / consumer owns styling). declaredStates:
    // known state names, declared in the contract's `states`, same registry.
    const checkDeclaredEntry = (cssProp: string, value: string, where: string) => {
      const spec = DECLARED_CHANNELS[cssProp];
      if (!spec) {
        errors.push(
          `${contract.id}: part "${name}" ${where} sets "${cssProp}" which is not a declared channel (DECLARED_CHANNELS registry — token/literal vocabulary channels belong in tokens/literals)`,
        );
        return;
      }
      if (!spec.value.test(value)) {
        errors.push(
          `${contract.id}: part "${name}" ${where} "${cssProp}" value ${JSON.stringify(value)} is outside the channel's bounded grammar (${spec.value})`,
        );
      }
    };
    if ((part.declared || part.declaredStates) && (part.component || part.slot)) {
      errors.push(
        `${contract.id}: part "${name}" is a ${part.component ? 'component instance' : 'slot'} — declared facts cannot restyle it (the child contract / consumer owns its styling)`,
      );
    }
    // v16 (task #37): sizing evidence describes ONE channel. A part that
    // does not carry max-width has nothing for the flag to qualify, so a
    // stray flag is a contract error, not a no-op.
    if (
      part.hugsBelowMaxWidth !== undefined &&
      !(part.tokens && 'max-width' in part.tokens) &&
      !(part.declared && 'max-width' in part.declared) &&
      !(part.literals && 'max-width' in part.literals)
    ) {
      errors.push(
        `${contract.id}: part "${name}" carries hugsBelowMaxWidth but no "max-width" channel — the flag qualifies that channel and qualifies nothing here`,
      );
    }
    for (const [cssProp, value] of Object.entries(part.declared ?? {})) {
      checkDeclaredEntry(cssProp, value, 'declared');
      if (part.tokens && cssProp in part.tokens) {
        errors.push(
          `${contract.id}: part "${name}" carries channel "${cssProp}" as BOTH a token binding and a declared fact — ambiguous, refused by name`,
        );
      }
      if (part.literals && cssProp in part.literals) {
        errors.push(
          `${contract.id}: part "${name}" carries channel "${cssProp}" as BOTH a literal and a declared fact — ambiguous, refused by name`,
        );
      }
    }
    // v19 (RC2 burn-down): per-enum-value declared overrides. SAME registry
    // and SAME bounded grammar as `declared` (checkDeclaredEntry, one
    // function, one message) — this field widens WHERE a declared value may
    // vary, never WHICH values are legal. The prop must be a real enum /
    // VARIANT-bound boolean and every map key an actual value of it, exactly
    // like literalsByProp; a channel already claimed by tokens/literals on
    // the same part stays ambiguous and refuses by name.
    for (const entry of part.declaredByProp ?? []) {
      const dbpProp = contract.props.find((pr) => pr.name === entry.prop);
      if (!dbpProp) {
        errors.push(`${contract.id}: part "${name}" declaredByProp references unknown prop "${entry.prop}"`);
      } else if (!isEnum(dbpProp) && !isVariantBool(dbpProp)) {
        errors.push(
          `${contract.id}: part "${name}" declaredByProp prop "${entry.prop}" must be an enum prop or VARIANT-bound boolean`,
        );
      } else {
        const allowed = isEnum(dbpProp) ? dbpProp.type.enum : ['true', 'false'];
        for (const k of Object.keys(entry.map)) {
          if (!allowed.includes(k)) {
            errors.push(`${contract.id}: part "${name}" declaredByProp map key "${k}" is not a value of prop "${entry.prop}"`);
          }
        }
      }
      for (const [value, overrides] of Object.entries(entry.map)) {
        for (const [cssProp, v] of Object.entries(overrides)) {
          checkDeclaredEntry(cssProp, v, `declaredByProp.${entry.prop}=${value}`);
          if (part.tokens && cssProp in part.tokens) {
            errors.push(
              `${contract.id}: part "${name}" carries channel "${cssProp}" as BOTH a token binding and a declaredByProp fact — ambiguous, refused by name`,
            );
          }
          if (part.literals && cssProp in part.literals) {
            errors.push(
              `${contract.id}: part "${name}" carries channel "${cssProp}" as BOTH a literal and a declaredByProp fact — ambiguous, refused by name`,
            );
          }
        }
      }
      if (part.component || part.slot) {
        errors.push(
          `${contract.id}: part "${name}" is a ${part.component ? 'component instance' : 'slot'} — declaredByProp facts cannot restyle it (the child contract / consumer owns its styling)`,
        );
      }
    }
    for (const [state, overrides] of Object.entries(part.declaredStates ?? {})) {
      if (!(state in STATE_SELECTORS)) {
        errors.push(
          `${contract.id}: part "${name}" declaredStates declares unknown state "${state}" — must be one of ${Object.keys(STATE_SELECTORS).join(', ')}`,
        );
        continue;
      }
      if (!contract.states.includes(state as Contract['states'][number])) {
        errors.push(
          `${contract.id}: part "${name}" declaredStates declares "${state}" but the contract's \`states\` does not — declare it or drop the override`,
        );
      }
      for (const [cssProp, value] of Object.entries(overrides)) {
        checkDeclaredEntry(cssProp, value, `declaredStates.${state}`);
      }
    }
    // v13 part-level states (P18 second half): per-state token overrides on
    // a NON-ref part — refusal-ruled, never silent: unknown state names
    // refuse (the STATE_SELECTORS vocabulary AND the contract's declared
    // states), ref/slot parts refuse (the child contract owns its styling;
    // slot content is the consumer's), and channels outside the color-kind
    // whitelist refuse by name. The ROOT's states keep their own path (full
    // vocabulary, validated in generateCss).
    if (part.states && p.length > 1) {
      if (part.component) {
        errors.push(`${contract.id}: part "${name}" is a component instance — states cannot restyle it (the child contract owns its styling)`);
      }
      if (part.slot) {
        errors.push(`${contract.id}: part "${name}" is a slot — states cannot restyle its content (the consumer owns it)`);
      }
      for (const [state, overrides] of Object.entries(part.states)) {
        if (!(state in STATE_SELECTORS)) {
          errors.push(`${contract.id}: part "${name}" states declares unknown state "${state}" — must be one of ${Object.keys(STATE_SELECTORS).join(', ')}`);
          continue;
        }
        if (!contract.states.includes(state as Contract['states'][number])) {
          errors.push(`${contract.id}: part "${name}" states declares "${state}" but the contract's \`states\` does not — declare it or drop the override`);
        }
        for (const cssProp of Object.keys(overrides)) {
          if (!PART_STATE_CHANNELS.has(cssProp)) {
            errors.push(
              `${contract.id}: part "${name}" states.${state} sets "${cssProp}" which is not a part-state channel (${[...PART_STATE_CHANNELS].join(', ')} — color-kind only, v13)`,
            );
          }
        }
      }
    }
    // v17 statesByProp — the SAME discipline `states` is held to, because a
    // per-value state binding is a state binding. Unknown/undeclared states
    // refuse, ref/slot parts refuse, non-root parts keep the color-kind
    // whitelist, the prop must be a declared enum and every map key one of its
    // canonical values, and a channel bound for the same state by BOTH
    // `states` and `statesByProp` is AMBIGUOUS — refused by name rather than
    // silently resolved by sheet order (the tokens/literals precedent).
    for (const entry of part.statesByProp ?? []) {
      const where = `statesByProp[${entry.prop}/${entry.state}]`;
      if (part.component) {
        errors.push(`${contract.id}: part "${name}" is a component instance — ${where} cannot restyle it (the child contract owns its styling)`);
      }
      if (part.slot) {
        errors.push(`${contract.id}: part "${name}" is a slot — ${where} cannot restyle its content (the consumer owns it)`);
      }
      if (!(entry.state in STATE_SELECTORS)) {
        errors.push(`${contract.id}: part "${name}" ${where} declares unknown state "${entry.state}" — must be one of ${Object.keys(STATE_SELECTORS).join(', ')}`);
        continue;
      }
      if (!contract.states.includes(entry.state as Contract['states'][number])) {
        errors.push(`${contract.id}: part "${name}" ${where} declares "${entry.state}" but the contract's \`states\` does not — declare it or drop the override`);
      }
      const declared = contract.props?.find((pr) => pr.name === entry.prop);
      const values = (declared?.type as { enum?: string[] } | undefined)?.enum;
      if (!values) {
        errors.push(`${contract.id}: part "${name}" ${where} keys on "${entry.prop}" which is not a declared enum prop`);
      } else {
        for (const key of Object.keys(entry.map)) {
          if (!values.includes(key)) {
            errors.push(`${contract.id}: part "${name}" ${where} maps "${key}" which is not one of "${entry.prop}"'s values (${values.join(', ')})`);
          }
        }
      }
      for (const overrides of Object.values(entry.map)) {
        for (const cssProp of Object.keys(overrides)) {
          if (p.length > 1 && !PART_STATE_CHANNELS.has(cssProp)) {
            errors.push(
              `${contract.id}: part "${name}" ${where} sets "${cssProp}" which is not a part-state channel (${[...PART_STATE_CHANNELS].join(', ')} — color-kind only, v13)`,
            );
          }
          if (p.length === 1) checkTokenChannel(cssProp, where);
          if (part.states?.[entry.state]?.[cssProp] !== undefined) {
            errors.push(
              `${contract.id}: part "${name}" binds "${cssProp}" for state "${entry.state}" in BOTH states and ${where} — ambiguous; keep the per-value map or the single ref, not both`,
            );
          }
        }
      }
    }
    // v7 overlay: out-of-flow parts must stay out of the flow arithmetic —
    // grow/overlap are in-flow sizing semantics, and the root cannot attach
    // to its own edge. Minimal, named refusals.
    if (part.overlay) {
      if (p.length === 1) {
        errors.push(`${contract.id}: the root part cannot be an overlay — overlays attach to the root`);
      }
      if (part.layout?.grow) {
        errors.push(`${contract.id}: part "${name}" is an overlay — it cannot also grow (grow is in-flow sizing)`);
      }
      if (part.layout?.overlap) {
        errors.push(`${contract.id}: part "${name}" is an overlay — it cannot also overlap children (in-flow semantics)`);
      }
    }
    // v7 stylesWhen: conditions must be checkable (boolean or enum+equals),
    // and the styles must stay inside the literal whitelist — colors and
    // dimensions belong in `tokens`, and a token ref here is refused by name.
    if (part.stylesWhen && part.component) {
      errors.push(`${contract.id}: part "${name}" is a component instance — stylesWhen cannot restyle it (the child contract owns its styling)`);
    }
    for (const sw of part.stylesWhen ?? []) {
      const swProp = contract.props.find((pr) => pr.name === sw.prop);
      if (!swProp) {
        errors.push(`${contract.id}: part "${name}" stylesWhen references unknown prop "${sw.prop}"`);
      } else if (isEnum(swProp)) {
        if (sw.equals === undefined) {
          errors.push(`${contract.id}: part "${name}" stylesWhen on enum prop "${sw.prop}" requires "equals"`);
        } else if (!swProp.type.enum.includes(sw.equals)) {
          errors.push(`${contract.id}: part "${name}" stylesWhen.equals "${sw.equals}" is not a value of prop "${sw.prop}"`);
        }
      } else if (swProp.type === 'boolean') {
        if (sw.equals !== undefined) {
          errors.push(`${contract.id}: part "${name}" stylesWhen on boolean prop "${sw.prop}" must omit "equals"`);
        }
      } else {
        errors.push(`${contract.id}: part "${name}" stylesWhen prop "${sw.prop}" must be a boolean or enum prop`);
      }
      for (const [cssProp, value] of Object.entries(sw.styles)) {
        if (!STYLES_WHEN_ALLOWED.has(cssProp)) {
          errors.push(`${contract.id}: part "${name}" stylesWhen sets "${cssProp}" which is not in the literal whitelist (${[...STYLES_WHEN_ALLOWED].join(', ')})`);
        }
        if (value.includes('{')) {
          errors.push(`${contract.id}: part "${name}" stylesWhen "${cssProp}" value ${JSON.stringify(value)} looks like a token reference — stylesWhen is literal CSS; token-driven styling belongs in "tokens"`);
        }
      }
    }
    // v9 shape: a parametric leaf decor — anything that would give it
    // children or content contradicts the leaf-ness and is refused by name.
    if (part.shape) {
      for (const [field, present] of Object.entries({
        parts: part.parts, slot: part.slot, component: part.component,
        content: part.content, text: part.text, icon: part.icon, meter: part.meter,
      })) {
        if (present !== undefined) {
          errors.push(`${contract.id}: part "${name}" is a shape (leaf decor) — it cannot also carry "${field}"`);
        }
      }
      if (part.shape.sides !== undefined && part.shape.kind !== 'polygon') {
        errors.push(`${contract.id}: part "${name}" shape kind "${part.shape.kind}" cannot declare sides — side count is polygon vocabulary`);
      }
      if (part.shape.arc !== undefined && part.shape.kind !== 'ellipse') {
        errors.push(`${contract.id}: part "${name}" shape kind "${part.shape.kind}" cannot declare arc — sweep is ellipse vocabulary`);
      }
    }
    // v12 repeat (P9): the item template must be mechanically renderable on
    // every surface — a component-ref template, an arrayOf prop to map, and
    // fields that map BY NAME onto the child contract's props with matching
    // scalar types. Everything else refuses by name.
    if (part.repeat) {
      if (!part.component) {
        errors.push(`${contract.id}: part "${name}" declares repeat but no component — the item template is a component ref (v12; text/frame templates have no vocabulary)`);
      }
      for (const [field, present] of Object.entries({
        slot: part.slot, content: part.content, text: part.text,
        meter: part.meter, icon: part.icon, shape: part.shape, parts: part.parts,
      })) {
        if (present !== undefined) {
          errors.push(`${contract.id}: part "${name}" is a repeat template — it cannot also carry "${field}"`);
        }
      }
      const rp = contract.props.find((pr) => pr.name === part.repeat!.itemsProp);
      if (!rp) {
        errors.push(`${contract.id}: part "${name}" repeat references unknown prop "${part.repeat.itemsProp}"`);
      } else if (!isArrayType(rp)) {
        errors.push(`${contract.id}: part "${name}" repeat prop "${part.repeat.itemsProp}" must be an arrayOf prop`);
      } else {
        const dep = part.component ? byId.get(part.component.id) : undefined;
        const FIELD_TO_PROP: Record<string, string> = { text: 'text', boolean: 'boolean', number: 'number' };
        for (const [field, ftype] of Object.entries(rp.type.arrayOf)) {
          if (part.component?.props && field in part.component.props) {
            errors.push(`${contract.id}: part "${name}" repeat field "${field}" collides with a fixed component prop — a field is per-item, a fixed prop is constant`);
          }
          if (!dep) continue; // missing child contract already refused above
          const depProp = dep.props.find((dp) => dp.name === field);
          if (!depProp) {
            errors.push(`${contract.id}: part "${name}" repeat field "${field}" names no ${dep.id} prop`);
          } else if (depProp.type !== FIELD_TO_PROP[ftype]) {
            errors.push(
              `${contract.id}: part "${name}" repeat field "${field}" (${ftype}) does not match ${dep.id} prop "${field}" (${typeof depProp.type === 'object' ? JSON.stringify(depProp.type) : depProp.type}) — per-item enum differences are P10 and stay receipted`,
            );
          }
        }
        for (const [i, rec] of part.repeat.sample.entries()) {
          for (const [key, value] of Object.entries(rec)) {
            const ftype = rp.type.arrayOf[key];
            if (ftype === undefined) {
              errors.push(`${contract.id}: part "${name}" repeat sample[${i}] key "${key}" is not a field of "${part.repeat.itemsProp}"`);
            } else if ((ftype === 'boolean') !== (typeof value === 'boolean') || (ftype === 'number') !== (typeof value === 'number')) {
              errors.push(`${contract.id}: part "${name}" repeat sample[${i}].${key} is a ${typeof value} but the field is ${ftype}`);
            }
          }
        }
      }
    }
    if (part.visibleWhen) {
      const vwProp = contract.props.find((pr) => pr.name === part.visibleWhen!.prop);
      if (!vwProp) {
        errors.push(`${contract.id}: part "${name}" visibleWhen references unknown prop "${part.visibleWhen.prop}"`);
      } else if (part.visibleWhen.equals !== undefined) {
        // Single value or value-subset array — every named value must be a
        // member of the prop's enum.
        const eqs = Array.isArray(part.visibleWhen.equals) ? part.visibleWhen.equals : [part.visibleWhen.equals];
        const enumValues = typeof vwProp.type === 'object' && 'enum' in vwProp.type ? vwProp.type.enum : [];
        for (const eq of eqs) {
          if (!enumValues.includes(eq)) {
            errors.push(`${contract.id}: part "${name}" visibleWhen.equals "${eq}" is not a value of prop "${part.visibleWhen.prop}"`);
          }
        }
      }
    }
    if (part.textByProp) {
      const tbProp = contract.props.find((pr) => pr.name === part.textByProp!.prop);
      if (part.text === undefined) {
        errors.push(`${contract.id}: part "${name}" textByProp requires a base \`text\``);
      }
      if (!tbProp) {
        errors.push(`${contract.id}: part "${name}" textByProp references unknown prop "${part.textByProp.prop}"`);
      } else {
        const tbEnum = typeof tbProp.type === 'object' && 'enum' in tbProp.type ? tbProp.type.enum : [];
        for (const key of Object.keys(part.textByProp.map)) {
          if (!tbEnum.includes(key)) {
            errors.push(`${contract.id}: part "${name}" textByProp map key "${key}" is not a value of prop "${part.textByProp.prop}"`);
          }
        }
      }
    }
    if (part.icon) {
      const ref = part.icon.asset.match(/^\{([a-z][\w-]*)\}$/);
      const assets = ref
        ? (() => {
            const p = contract.props.find((pr) => pr.name === ref[1]);
            return p && typeof p.type === 'object' && 'enum' in p.type ? p.type.enum : [];
          })()
        : [part.icon.asset];
      for (const asset of assets) {
        if (!iconAssets.has(asset)) {
          errors.push(`${contract.id}: part "${name}" needs icon asset "assets/icons/${asset}.svg" which does not exist`);
        }
      }
    }
    for (const value of Object.values(part.attrs ?? {})) {
      const ref = value.match(/^\{([a-z][\w-]*)\}$/);
      if (ref && !contract.props.some((pr) => pr.name === ref[1])) {
        errors.push(`${contract.id}: part "${name}" attrs references unknown prop "${ref[1]}"`);
      }
    }
  }
  // Multi-root: an anatomy is ≥1 top-level root. A single-root contract's one
  // entry is named "root"; a captured composite (Modal = {dialog, backdrop})
  // carries several. Each root's subtree is validated by the SAME rules above
  // (this walk already visits every root via walkAnatomy). Only an EMPTY
  // anatomy is refused. (A single-root `{root}` still validates exactly as
  // before: it has one top-level entry, so this passes identically.)
  if (topRoots(contract).length === 0) {
    errors.push(`${contract.id}: anatomy must have at least one top-level (root) part`);
  }

  // Identity + consistency gates (added after an adversarial refusal sweep
  // found these invalid states passing silently — C2 means NAMED refusal).
  if (!/^[A-Z][A-Za-z0-9]*$/.test(contract.name)) {
    errors.push(`${contract.id}: contract name "${contract.name}" must be PascalCase — it becomes the exported component and its file names`);
  }
  const seenPropNames = new Set<string>();
  const seenFigmaProps = new Set<string>();
  // Duplicate CODE bindings are the classic git-auto-merge artifact: two
  // branches each add a prop, the JSON merges cleanly, Zod accepts it, and
  // the generator would emit a duplicate interface member + duplicate
  // destructuring binding — syntactically broken output with exit 0
  // (red-team finding). Slot names and event props share the same code
  // namespace, so the uniqueness gate covers all three.
  const seenCodeNames = new Set<string>(
    walkAnatomy(contract).filter((w) => w.part.slot).map((w) => w.part.slot!.name),
  );
  for (const p of contract.props) {
    if (seenPropNames.has(p.name)) {
      errors.push(`${contract.id}: duplicate prop name "${p.name}"`);
    }
    seenPropNames.add(p.name);
    const codeName = p.bindings.code.prop;
    if (codeName !== 'children' && seenCodeNames.has(codeName)) {
      errors.push(`${contract.id}: duplicate code binding "${codeName}" — two props/slots/events share one code name (check for a bad merge)`);
    }
    seenCodeNames.add(codeName);
    if (!/^[a-z][A-Za-z0-9]*$/.test(p.bindings.code.prop)) {
      errors.push(`${contract.id}: prop "${p.name}" code binding "${p.bindings.code.prop}" is not a legal camelCase identifier`);
    }
    const figProp = p.bindings.figma.property;
    if (figProp !== undefined) {
      if (seenFigmaProps.has(figProp)) {
        errors.push(`${contract.id}: two props bind the same design property "${figProp}" — the canvas cannot host both`);
      }
      seenFigmaProps.add(figProp);
    }
    // type/default consistency
    if (p.default !== undefined) {
      if (isEnum(p) && (typeof p.default !== 'string' || !p.type.enum.includes(p.default))) {
        errors.push(`${contract.id}: prop "${p.name}" default ${JSON.stringify(p.default)} is not one of its enum values [${p.type.enum.join(', ')}]`);
      }
      if (p.type === 'boolean' && typeof p.default !== 'boolean') {
        errors.push(`${contract.id}: boolean prop "${p.name}" default must be a boolean (got ${JSON.stringify(p.default)})`);
      }
      if (p.type === 'number' && typeof p.default !== 'number') {
        errors.push(`${contract.id}: number prop "${p.name}" default must be a number (got ${JSON.stringify(p.default)})`);
      }
      if (p.type === 'text' && typeof p.default !== 'string') {
        errors.push(`${contract.id}: text prop "${p.name}" default must be a string (got ${JSON.stringify(p.default)})`);
      }
    }
    // v7 arrayOf: structured props are code-only — the pairing with figma
    // kind "NONE" is enforced BOTH ways so a scalar prop can never silently
    // vanish from the canvas and a structured prop can never pretend to
    // manifest there.
    if (isArrayType(p)) {
      if (p.bindings.figma.kind !== 'NONE') {
        errors.push(`${contract.id}: arrayOf prop "${p.name}" must bind figma kind "NONE" — structured props are code-only by declared fidelity limit`);
      }
      if (p.default !== undefined) {
        errors.push(`${contract.id}: arrayOf prop "${p.name}" cannot declare a default — it renders as an optional array in code`);
      }
      if (Object.keys(p.type.arrayOf).length === 0) {
        errors.push(`${contract.id}: arrayOf prop "${p.name}" must declare at least one field`);
      }
    } else if (p.bindings.figma.kind === 'NONE' && p.type !== 'text') {
      errors.push(`${contract.id}: prop "${p.name}" binds figma kind "NONE" but is neither an arrayOf prop nor a text prop — every other scalar prop has a canvas manifestation`);
    } else if (p.bindings.figma.kind === 'NONE' && typeof p.default !== 'string') {
      // ROUND 3 — the SECOND legitimate canvas-less scalar, found in the
      // field: a text prop promoted from a raw per-instance CHARACTER
      // override (Untitled UI's Tooltip and Avatar expose no TEXT component
      // property, yet hosts retype their labels). The canvas carries such a
      // label as an instance override, which the contract vocabulary does
      // not model — so the prop is code-only BY DECLARATION, and the canvas
      // emitter ledgers every host value it therefore cannot wire. The one
      // hard requirement is a default: it is what the canvas actually draws,
      // and without it the canvas would render the component NAME.
      errors.push(`${contract.id}: text prop "${p.name}" binds figma kind "NONE" (code-only) but declares no string default — the default IS what the canvas draws for it`);
    }
    // Required text props need a default: it is the canvas TEXT property's
    // default value AND the sample every generated story/matrix cell uses.
    if (p.type === 'text' && p.required && typeof p.default !== 'string') {
      errors.push(`${contract.id}: required text prop "${p.name}" must declare a string default (canvas default + story sample) — add "default": "<sample text>" to the "${p.name}" prop in the seed contract`);
    }
    // The figma values map, when present, must cover the enum exactly.
    if (isEnum(p) && p.bindings.figma.values) {
      const mapKeys = Object.keys(p.bindings.figma.values);
      for (const v of p.type.enum) {
        if (!mapKeys.includes(v)) {
          errors.push(`${contract.id}: prop "${p.name}" figma values map is missing enum value "${v}"`);
        }
      }
      for (const k of mapKeys) {
        if (!p.type.enum.includes(k)) {
          errors.push(`${contract.id}: prop "${p.name}" figma values map has key "${k}" which is not an enum value`);
        }
      }
    }
  }
  // Token refs must be well-formed {path} or {path.{prop}.path} shapes —
  // a malformed ref must be refused by NAME, not crash downstream.
  const TOKEN_REF = /^\{[^{}]*(\{[a-z][\w-]*\}[^{}]*)*\}$/;
  for (const { name, part } of walkAnatomy(contract)) {
    for (const [cssProp, ref] of Object.entries(part.tokens ?? {})) {
      if (!TOKEN_REF.test(ref) || ref === '{}') {
        errors.push(`${contract.id}: part "${name}" token "${cssProp}" ref ${JSON.stringify(ref)} is malformed — expected "{token.path}" with optional "{prop}" placeholders`);
      }
    }
  }

  // v6 events: the declared interaction surface must be mechanically checkable.
  const partByName = new Map(walkAnatomy(contract).map((w) => [w.name, w.part]));
  const seenEventProps = new Set<string>();
  for (const ev of contract.events ?? []) {
    const codeProp = ev.bindings.code.prop;
    if (seenEventProps.has(codeProp)) {
      errors.push(`${contract.id}: duplicate event code prop "${codeProp}"`);
    }
    seenEventProps.add(codeProp);
    if (contract.props.some((p) => p.bindings.code.prop === codeProp) || walkAnatomy(contract).some((w) => w.part.slot?.name === codeProp)) {
      errors.push(`${contract.id}: event "${ev.name}" code prop "${codeProp}" collides with a data prop or slot`);
    }
    const trigger = partByName.get(ev.trigger);
    if (!trigger) {
      errors.push(`${contract.id}: event "${ev.name}" trigger references unknown part "${ev.trigger}"`);
    } else if (!topRootNames(contract).has(ev.trigger) && trigger.element !== 'button' && !isNativeCheckablePart(trigger)) {
      // Interactivity must be honest: a clickable part is a <button> — or a
      // native checkable input (input[type=checkbox|radio]) — so keyboard
      // activation comes from the platform, not a bolted-on handler.
      errors.push(
        `${contract.id}: event "${ev.name}" trigger part "${ev.trigger}" must have element "button" or be a native checkable input (input[type=checkbox|radio]) (got "${trigger.element ?? 'div'}")`,
      );
    }
    if (ev.toggles) {
      const prop = contract.props.find((p) => p.name === ev.toggles!.prop);
      if (!prop) {
        errors.push(`${contract.id}: event "${ev.name}" toggles unknown prop "${ev.toggles.prop}"`);
      } else if (!(typeof prop.type === 'object' && 'enum' in prop.type)) {
        errors.push(`${contract.id}: event "${ev.name}" toggles non-enum prop "${ev.toggles.prop}"`);
      } else {
        for (const v of ev.toggles.between) {
          if (!prop.type.enum.includes(v)) {
            errors.push(
              `${contract.id}: event "${ev.name}" toggles between "${v}" which is not a value of "${ev.toggles.prop}"`,
            );
          }
        }
      }
    }
  }

  // bindings.figma.statePreviews (v8; spelled figmaStatePreviews until v17):
  // canvas-only state previews must be honest —
  // a preview variant that renders identically to Default is kit noise, so
  // the opt-in is refused by name unless every declared state carries root
  // token overrides; and the multiplied axis must be unambiguous.
  // A fixture built by hand (the check scripts do this to exercise one
  // refusal) may carry no `bindings` block at all; the v16 spelling lived at
  // the top level and tolerated absence. Read optionally so the refusal the
  // caller is testing for is the one reported, never a TypeError.
  if (contract.bindings?.figma?.statePreviews) {
    if (contract.bindings.figma.representation === 'native') {
      errors.push(
        `${contract.id}: bindings.figma.statePreviews requires a generated Figma component — bindings.figma.representation "native" declares there is none`,
      );
    }
    if (contract.states.length === 0) {
      errors.push(
        `${contract.id}: bindings.figma.statePreviews is set but the contract declares no interaction states — nothing to preview`,
      );
    }
    for (const state of contract.states) {
      // A state override may sit on ANY top-level root (single-root: the sole
      // "root"; multi-root: e.g. dialog/backdrop) …
      const rootCarries = topRoots(contract).some(
        ([, rp]) => Object.keys(rp.states?.[state] ?? {}).length > 0,
      );
      // v13: … or a state carried ONLY by part-level overrides (path.length >
      // 1) still previews — the compile applies part states inside the
      // State-axis variants.
      const partCarries = walkAnatomy(contract).some(
        (w) => w.path.length > 1 && Object.keys(w.part.states?.[state] ?? {}).length > 0,
      );
      // v17: … or ONLY by per-enum-value bindings. A state whose every channel
      // is a function of a variant axis carries in `statesByProp` and nowhere
      // else, and it very much does not render identically to Default — that
      // is Eventz's Button hover exactly. Reading only `states` here would
      // call the newly-carried plane "kit noise" and refuse the contract.
      const byPropCarries = walkAnatomy(contract).some((w) =>
        (w.part.statesByProp ?? []).some((e) => e.state === state && Object.keys(e.map).length > 0),
      );
      if (!rootCarries && !partCarries && !byPropCarries) {
        errors.push(
          `${contract.id}: bindings.figma.statePreviews — state "${state}" declares no token overrides on anatomy.root.states (or any part's states), so its preview variant would render identically to Default`,
        );
      }
    }
    const substProps = statePreviewSubstProps(contract);
    if (substProps.length > 1) {
      errors.push(
        `${contract.id}: bindings.figma.statePreviews — state overrides substitute ${substProps.length} enum props (${substProps.join(', ')}); previews multiply exactly ONE primary axis`,
      );
    }
    if (contract.props.some((p) => p.bindings.figma.property === STATE_PREVIEW_PROPERTY)) {
      errors.push(
        `${contract.id}: bindings.figma.statePreviews reserves the design property "${STATE_PREVIEW_PROPERTY}" for the preview axis, but a prop already binds it`,
      );
    }
  }

  // v7 elementByProp: the dynamic-tag lookup must be total and honest —
  // the prop must be a declared enum, the map must cover every value, and
  // every mapped element must be in the generator's element vocabulary
  // (an unknown element would emit JSX that silently isn't HTML).
  const ebp = contract.semantics.elementByProp;
  if (ebp) {
    const prop = contract.props.find((p) => p.name === ebp.prop);
    if (!prop) {
      errors.push(`${contract.id}: semantics.elementByProp references unknown prop "${ebp.prop}"`);
    } else if (!isEnum(prop)) {
      errors.push(`${contract.id}: semantics.elementByProp prop "${ebp.prop}" must be an enum prop`);
    } else {
      for (const v of prop.type.enum) {
        if (!(v in ebp.map)) {
          errors.push(`${contract.id}: semantics.elementByProp map is missing enum value "${v}"`);
        }
      }
      for (const [k, el] of Object.entries(ebp.map)) {
        if (!prop.type.enum.includes(k)) {
          errors.push(`${contract.id}: semantics.elementByProp map key "${k}" is not a value of prop "${ebp.prop}"`);
        }
        if (!(el in ELEMENT_META)) {
          errors.push(`${contract.id}: semantics.elementByProp maps "${k}" to unknown element "${el}" — must be one of the element vocabulary`);
        }
      }
    }
  }

  // VOID-ELEMENT MOUNT GUARD (Eventz field case — the emit-side half of the
  // #48 wrong-element-mount class): HTML void elements cannot have children,
  // and React refuses them at MOUNT, at RUNTIME — so a contract that mounts
  // anatomy children inside a void element ships code that renders NOTHING
  // and no build step ever says why (Eventz Atoms/Checkbox + Atoms/Input:
  // element "input" over drawn children, 10 fidelity rows painted nothing).
  // Refused BY NAME here, on every surface (react/html/react-inline/
  // figma-script all validate through this function). A void element with NO
  // mounted children stays legal — ds.divider's <hr> exactly.
  {
    /** What the emitters would mount INSIDE this part's element, or null. */
    const mountedChildren = (part: Part): string | null => {
      const n = Object.keys(part.parts ?? {}).length;
      if (n > 0) return `${n} child part(s)`;
      if (part.slot) return `a slot ("${part.slot.name}")`;
      if (part.content) return `bound text content (prop "${part.content.prop}")`;
      if (part.text !== undefined) return 'static text';
      if (part.icon) return 'an icon glyph';
      return null;
    };
    const refuseVoid = (site: string, el: string, what: string) => {
      errors.push(
        `${contract.id}: ${site} mounts ${what}, but children cannot mount inside void element <${el}> — React refuses it at runtime and the component renders NOTHING. Re-root the part (host the children on a container element — div/span/label per context — and mount the <${el}> control as a child part) or wrap the control`,
      );
    };
    if (!isMultiRoot(contract)) {
      // Single-root: the root part's children (or the `{children}`
      // passthrough a children-bound text prop ALWAYS fills) mount inside
      // semantics.element and every elementByProp value.
      const rootPart = contract.anatomy.root;
      const what =
        rootPart === undefined
          ? null
          : (mountedChildren(rootPart) ??
            (textProps(contract).some((p) => p.bindings.code.prop === 'children')
              ? 'the children-bound text prop'
              : null));
      if (what) {
        for (const el of new Set(rootElementsOf(contract))) {
          if (VOID_ELEMENTS.has(el)) refuseVoid(`anatomy.root (semantics.element "${el}")`, el, what);
        }
      }
    }
    // Every part carrying an explicit void element (multi-root top roots
    // included — they render as part.element ?? 'div').
    for (const { name, part, path: p } of walkAnatomy(contract)) {
      if (!isMultiRoot(contract) && p.length === 1 && name === 'root') continue; // handled above
      const el = part.element;
      if (!el || !VOID_ELEMENTS.has(el)) continue;
      const what = mountedChildren(part);
      if (what) refuseVoid(`part "${name}" (element "${el}")`, el, what);
    }
  }

  // v11 SEMANTIC LINT: a role claim that RE-CREATES a native control (see
  // NATIVE_ROLE_HOSTS) refuses BY NAME on a non-native element — unless the
  // contract declares the exception, whose one-sentence reason renders on
  // the spec sheet. This gate exists because a shipped catalog contract
  // (ds.checkbox v1.1.0) emitted <button role="checkbox"> where a native
  // <input type="checkbox"> belongs; the mistake must be impossible to
  // reintroduce silently. Every surface enforces it: react/html/react-inline
  // /figma-script all call validateContract, as do the census and the
  // playground referee.
  {
    /** True when the claim is a violation the exception would cover. */
    const violates = (role: string | undefined, element: string): boolean => {
      if (!role) return false;
      const entry = NATIVE_ROLE_HOSTS[role];
      return Boolean(entry && !entry.hosts.includes(element));
    };
    const declared = (exception: string | undefined) =>
      typeof exception === 'string' && exception.trim().length > 0;
    const refuse = (role: string, element: string, site: string, field: string) => {
      const entry = NATIVE_ROLE_HOSTS[role]!;
      errors.push(
        `${contract.id}: ${site} claims role "${role}" on element "${element}" — native ${entry.native} exists; use it or declare the exception (${field}: "<one-sentence reason>")`,
      );
    };

    // Root-level claims: semantics.role, roleByProp values, and the root
    // part's attrs.role — all covered by semantics.roleException.
    const rootEl = contract.semantics.element;
    const rootClaims: Array<{ role: string; site: string }> = [];
    if (violates(contract.semantics.role, rootEl)) {
      rootClaims.push({ role: contract.semantics.role!, site: 'semantics.role' });
    }
    for (const [k, role] of Object.entries(contract.semantics.roleByProp?.map ?? {})) {
      if (violates(role, rootEl)) rootClaims.push({ role, site: `semantics.roleByProp["${k}"]` });
    }
    // attrs.role on EACH top-level root (single-root: the sole "root", site
    // "anatomy.root attrs.role" — byte-identical; multi-root: one claim per
    // root, site "anatomy.<name> attrs.role").
    for (const [rname, rpart] of topRoots(contract)) {
      const rAttrsRole = rpart.attrs?.role;
      if (violates(rAttrsRole, rootEl)) {
        rootClaims.push({ role: rAttrsRole!, site: `anatomy.${rname} attrs.role` });
      }
    }
    if (!declared(contract.semantics.roleException)) {
      for (const c of rootClaims) refuse(c.role, rootEl, c.site, 'semantics.roleException');
    } else if (rootClaims.length === 0) {
      errors.push(
        `${contract.id}: semantics.roleException is declared but no root-level role claim needs it — exceptions never ride along silently`,
      );
    }

    // Part-level claims: attrs.role on non-root parts, covered by the
    // part's own roleException. Element default mirrors the emitters:
    // span for content/text leaves, div otherwise.
    for (const { name, part, path: p } of walkAnatomy(contract)) {
      if (p.length === 1) continue; // top-level roots handled above
      const el = part.element ?? (part.content || part.text !== undefined ? 'span' : 'div');
      const partRole = part.attrs?.role;
      const isViolation = violates(partRole, el);
      if (isViolation && !declared(part.roleException)) {
        refuse(partRole!, el, `part "${name}"`, `roleException`);
      } else if (!isViolation && declared(part.roleException)) {
        errors.push(
          `${contract.id}: part "${name}" declares roleException but claims no role that needs it — exceptions never ride along silently`,
        );
      }
    }
  }

  // ONE root role claim. `anatomy.root.attrs.role` and `semantics.role` are
  // the same fact spelled twice; every code emitter (react / react-inline /
  // web-components / html) renders the attrs spelling and skips the
  // semantics default when both are present — so an EQUAL pair emits once,
  // and a DIFFERING pair is refused here by name rather than letting an
  // emitter pick one silently. A static attrs.role against a dynamic
  // roleByProp can never agree, so that pair is always refused.
  {
    const attrsRole = contract.anatomy.root?.attrs?.role;
    if (attrsRole !== undefined) {
      if (contract.semantics.roleByProp) {
        errors.push(
          `${contract.id}: anatomy.root.attrs.role "${attrsRole}" conflicts with semantics.roleByProp (a static role cannot agree with a per-prop role) — keep one`,
        );
      } else if (contract.semantics.role !== undefined && contract.semantics.role !== attrsRole) {
        errors.push(
          `${contract.id}: anatomy.root.attrs.role "${attrsRole}" conflicts with semantics.role "${contract.semantics.role}" — the root has one role; keep one spelling`,
        );
      }
    }
  }
}

