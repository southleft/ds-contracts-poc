/**
 * PLUGIN ENGINE ENTRY — the core barrel, packaged for the Sync Runner plugin.
 *
 * scripts/build-plugin-zip.mjs bundles this file (esbuild, platform=browser,
 * IIFE) together with the repo's tokens, contracts and icons (injected as
 * `__DSC_DATA__` at build time) and embeds the result in the packaged
 * ui.html, where it lands on `window.DSC`. Everything here is PURE compute —
 * contract text in, plain-words reports and Plugin-API script text out. The
 * scripts are EXECUTED by code.js through the same run-paste machinery the
 * paste tab uses; this module never touches the `figma` global itself, which
 * is why the headless harness (scripts/plugin-engine-check.mjs) can exercise
 * every flow in a VM with a mocked `figma`.
 *
 * Error discipline: the playground's plain-words rule — raw validator or
 * exception JSON never leaves this module as a headline; technical text
 * rides `detail` fields.
 *
 * NAMED SCOPE (v1):
 *   - Token resolution is the repo token tree baked into the bundle — OR,
 *     when a CONTRACTS-BUNDLE carries a `tokenSet` section (a foreign
 *     library's flat DTCG base + optional light/dark modes + minted tree),
 *     that tokenSet: its contracts resolve against base + minted and the
 *     tokens plan step syncs the literal set as one named collection
 *     (Light/Dark modes, Figma-native aliases for minted {alias} leaves).
 *     Either way a contract that references tokens outside its inventory is
 *     refused BY NAME (the emitter's own "Cannot resolve token" refusal,
 *     surfaced in plain words).
 *   - The propose diff is API-LEVEL (version, props, slots, variant axes)
 *     plus a single named line when anatomy/style bytes differ — interior
 *     style diffs are summarized, not itemized.
 *   - The UPDATE report's interior diff (G8) itemizes per channel only when
 *     the recorded installed version matches a baked contract's version (the
 *     sets this plugin generated); otherwise it says so and stays summary-
 *     level — never a guessed diff.
 */
import {
  ContractSchema,
  componentRefsOf,
  createFigmaEngine,
  dumpCapturesHidden,
  emitTokenSetScript,
  parseTokenSet,
  proposeBatchFromDump,
  slotsOf,
  sortByDependencies,
  tokenCorpusFromJson,
  tokenSetTokenTrees,
  type Contract,
  type TokenSetPayload,
} from '../../../core/index.js';
import { FINGERPRINT_SRC } from '../../../core/canvas-fingerprint.js';

// ---------------------------------------------------------------------------
// Data baked in at bundle time (scripts/build-plugin-zip.mjs).
// ---------------------------------------------------------------------------

export interface PluginEngineData {
  tokens: {
    primitives: Record<string, unknown>;
    semantic: Record<string, unknown>;
    light: Record<string, unknown>;
    dark: Record<string, unknown>;
    brands: Record<string, Record<string, unknown>>;
  };
  /** The repo's shipping contract documents — the reference scope
   *  composition refs resolve through when a pasted contract needs them. */
  contracts: unknown[];
  /** Icon asset name → SVG markup (assets/icons/*.svg). */
  icons: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Plain-words plumbing
// ---------------------------------------------------------------------------

export interface PlainIssue {
  /** Human sentence, safe as a visible headline. */
  headline: string;
  /** Verbatim technical text when it differs. */
  detail?: string;
}

const plain = (headline: string, detail?: string): PlainIssue =>
  detail && detail !== headline ? { headline, detail } : { headline };

const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Engine refusals are already named sentences; anything JSON-shaped or
 *  enormous is demoted to detail (the playground's plain-error rule). */
const plainFromThrow = (prefix: string, e: unknown): PlainIssue => {
  const message = errText(e);
  if (/^\s*[[{"]/.test(message) || message.length > 600) {
    return plain(`${prefix} failed with a technical error (full text below).`, message);
  }
  return plain(`${prefix}: ${message}`);
};

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

export interface GenerateStep {
  kind: 'tokens' | 'component' | 'version-marker';
  /** Plain-words step title for the run log. */
  title: string;
  contractId?: string;
  code: string;
}

export type ParsedIncoming =
  | {
      ok: true;
      kind: 'contract' | 'bundle';
      contracts: unknown[];
      /** The bundle's foreign token set (name + flat DTCG base + optional
       *  modes/minted) — null when the paste rides the baked repo tokens. */
      tokenSet: TokenSetPayload | null;
      /** Bundle-carried icon assets ({name: svgMarkup}) — null when the
       *  paste carries none; merged over the baked repo icons at plan time. */
      icons: Record<string, string> | null;
    }
  | { ok: false; issue: PlainIssue };

/** One per-channel style difference between the installed spec and the
 *  incoming one (G8) — rendered by the UI with the Drift tab's pretty
 *  printer so both reports speak one language. */
export interface StyleChange {
  /** Part name (anatomy path tail) the change sits on. */
  part: string;
  /** Designer channel word ("fill", "gap", "radius", "text color", …). */
  channel: string;
  was: string;
  now: string;
  /** Variant names carrying this change; null = every variant. */
  variants: string[] | null;
}

export interface UpdateRow {
  contractId: string;
  setName: string;
  version: string;
  action: 'create' | 'amend' | 'skip' | 'refused';
  /** The exact plain-words report line for this contract. */
  line: string;
  nodeId?: string;
  /** G2 (covenant repair): the Apply checkbox's starting state. False for
   *  canvas-edited amend targets — warn and default-safe, never block. */
  defaultSelected: boolean;
  /** G2: the target set has un-proposed canvas edits (its recomputed canvas
   *  state no longer matches the state its last sync recorded). */
  canvasEdited?: boolean;
  /** G2: the NAMED overwrite warning for a canvas-edited amend target. */
  warning?: string;
  /** G8: per-channel diff of the two compiled specs (installed vs incoming).
   *  null = the installed spec could not be matched (version unrecorded or
   *  not a baked contract's version), so nothing can be itemized honestly. */
  styleChanges?: StyleChange[] | null;
}

export interface UpdatePlan {
  rows: UpdateRow[];
  /** rows[].line plus the counts + nothing-applied tail — the whole report. */
  lines: string[];
}

export interface InventoryRow {
  contractId: string | null;
  name: string;
  nodeId: string;
  key: string | null;
  type: string;
  specHash: string | null;
  version: string | null;
  variants: number;
  props: string[];
  /** G2: canvas state vs the stamp its last sync recorded — the same
   *  recompute the Drift tab runs, joined into the update check so Apply
   *  can never silently overwrite a designer's edit. null = no stamp. */
  drift: 'in-sync' | 'canvas-edited' | 'unstamped' | null;
}

export function createPluginEngine(data: PluginEngineData) {
  const icons = new Map(Object.entries(data.icons));
  const engine = createFigmaEngine({ tokens: data.tokens, icons });
  const corpus = tokenCorpusFromJson({
    primitives: data.tokens.primitives,
    semantic: data.tokens.semantic,
    light: data.tokens.light,
    brandDefault: data.tokens.brands.default ?? {},
  });

  /** The baked reference scope (repo contracts), schema-parsed once. */
  const bakedById = new Map<string, Contract>();
  for (const raw of data.contracts) {
    const parsed = ContractSchema.safeParse(raw);
    if (parsed.success) bakedById.set(parsed.data.id, parsed.data);
  }

  // -------------------------------------------------------------------------
  // Parsing + validation (plain words)
  // -------------------------------------------------------------------------

  function parseIncomingText(text: string): ParsedIncoming {
    if (!text.trim()) {
      return { ok: false, issue: plain('Nothing to read — paste a contract or bundle JSON first.') };
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return {
        ok: false,
        issue: plain(
          "That paste isn't valid JSON — a missing quote, comma, or bracket is the usual cause.",
          errText(e),
        ),
      };
    }
    return parseIncomingValue(raw);
  }

  function parseIncomingValue(raw: unknown): ParsedIncoming {
    if (raw && typeof raw === 'object' && (raw as { type?: unknown }).type === 'CONTRACTS-BUNDLE') {
      const contracts = (raw as { contracts?: unknown }).contracts;
      if (!Array.isArray(contracts) || contracts.length === 0) {
        return {
          ok: false,
          issue: plain(
            'That is tagged CONTRACTS-BUNDLE but has no contracts — it needs a non-empty "contracts" array (ds-contracts figma push builds one).',
          ),
        };
      }
      // Optional foreign token set: contracts + tokens in ONE JSON paste —
      // the whole point is that JSON is the only thing a user ever pastes.
      const rawTokenSet = (raw as { tokenSet?: unknown }).tokenSet;
      let tokenSet: TokenSetPayload | null = null;
      if (rawTokenSet !== undefined && rawTokenSet !== null) {
        const parsedSet = parseTokenSet(rawTokenSet);
        if (!parsedSet.ok) {
          return { ok: false, issue: plain(`This bundle's token set does not parse — ${parsedSet.error}`) };
        }
        tokenSet = parsedSet.tokenSet;
      }
      // Optional bundle-carried icon assets (MOLECULE round — Autocomplete's
      // floor-reconstructed indicator/chip-delete SVGs): {name: svgMarkup},
      // the same map the CLI's --icons dir provides. Without it, a contract
      // referencing icon assets keeps the emitter's own named refusal.
      const rawIcons = (raw as { icons?: unknown }).icons;
      let icons: Record<string, string> | null = null;
      if (rawIcons !== undefined && rawIcons !== null) {
        if (typeof rawIcons !== 'object' || Array.isArray(rawIcons)) {
          return { ok: false, issue: plain('This bundle\'s "icons" section must be an object of {name: "<svg…>"} entries.') };
        }
        const bad = Object.entries(rawIcons as Record<string, unknown>).find(([, v]) => typeof v !== 'string');
        if (bad) {
          return { ok: false, issue: plain(`This bundle's "icons" entry "${bad[0]}" is not SVG text — every value must be a string.`) };
        }
        icons = rawIcons as Record<string, string>;
      }
      return { ok: true, kind: 'bundle', contracts, tokenSet, icons };
    }
    if (raw && typeof raw === 'object' && typeof (raw as { id?: unknown }).id === 'string') {
      return { ok: true, kind: 'contract', contracts: [raw], tokenSet: null, icons: null };
    }
    return {
      ok: false,
      issue: plain(
        'That JSON is neither a contract document (no "id") nor a CONTRACTS-BUNDLE envelope.',
      ),
    };
  }

  /** Schema referee, zod issues in words ("path: message" lines). */
  function validateOne(raw: unknown, label: string):
    | { ok: true; contract: Contract }
    | { ok: false; issues: PlainIssue[] } {
    const parsed = ContractSchema.safeParse(raw);
    if (parsed.success) return { ok: true, contract: parsed.data };
    const issues = parsed.error.issues.slice(0, 8).map((i) =>
      plain(`${label} — ${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`),
    );
    if (parsed.error.issues.length > 8) {
      issues.push(plain(`${label} — …and ${parsed.error.issues.length - 8} more schema issue(s).`));
    }
    return { ok: false, issues };
  }

  const labelOf = (raw: unknown, index: number): string => {
    if (raw && typeof raw === 'object') {
      const id = (raw as { id?: unknown }).id;
      if (typeof id === 'string' && id) return id;
      const name = (raw as { name?: unknown }).name;
      if (typeof name === 'string' && name) return name;
    }
    return `contract ${index + 1}`;
  };

  // -------------------------------------------------------------------------
  // Scope + ordering
  // -------------------------------------------------------------------------

  /** Incoming contracts + every baked contract they transitively reference,
   *  dependency-ordered (deps first). Throws with the sorter's own named
   *  message on unknown refs / cycles. */
  function orderedClosure(incoming: Contract[]): Contract[] {
    const byId = new Map<string, Contract>(bakedById);
    for (const c of incoming) byId.set(c.id, c); // incoming wins on id
    const wanted = new Map<string, Contract>();
    const pull = (c: Contract) => {
      if (wanted.has(c.id)) return;
      wanted.set(c.id, c);
      for (const { ref } of componentRefsOf(c)) {
        const dep = byId.get(ref.id);
        if (dep) pull(dep);
      }
      for (const { slot } of slotsOf(c)) {
        for (const id of slot.accepts ?? []) {
          const dep = byId.get(id);
          if (dep) pull(dep);
        }
      }
    };
    for (const c of incoming) pull(c);
    return sortByDependencies([...wanted.values()]);
  }

  function scopeFor(incoming: Contract[]): Map<string, Contract> {
    const byId = new Map<string, Contract>(bakedById);
    for (const c of incoming) byId.set(c.id, c);
    return byId;
  }

  // -------------------------------------------------------------------------
  // specHash mirror — djb2 over the compiled ComponentData, byte-for-byte
  // what the emitted runtime stores as ds_contracts/specHash. The headless
  // harness EXECUTES an emitted script and asserts this mirror equals the
  // stored marker, so drift between the two fails a pinned eval by name.
  // -------------------------------------------------------------------------

  function specHashOf(contract: Contract, byId: Map<string, Contract>, eng: typeof engine = engine): string {
    const compiled = eng.compileComponentData(contract, byId);
    const s = JSON.stringify(compiled);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return String(h);
  }

  /** Engine over a bundle's foreign tokenSet — the SAME construction the CLI
   *  applies for `figma <contracts> --tokens base,minted`, so the plugin's
   *  bundle path and the script path compile IDENTICAL component data. The
   *  token inventory is base + minted and NOTHING else — a contract ref
   *  outside both keeps the emitter's own named "Cannot resolve token"
   *  refusal. MOLECULE round: bundle-carried icon assets merge OVER the
   *  baked repo icons (`figma bundle --icons` embeds them — Autocomplete's
   *  floor-reconstructed SVGs); a missing asset keeps the emitter's named
   *  "needs icon asset" refusal. */
  const mergedIcons = (bundleIcons: Record<string, string> | null | undefined): Map<string, string> =>
    bundleIcons ? new Map([...icons, ...Object.entries(bundleIcons)]) : icons;
  const foreignEngineFor = (tokenSet: TokenSetPayload, bundleIcons?: Record<string, string> | null): typeof engine =>
    createFigmaEngine({ tokens: tokenSetTokenTrees(tokenSet), icons: mergedIcons(bundleIcons) });

  // -------------------------------------------------------------------------
  // Generate from contract
  // -------------------------------------------------------------------------

  interface PlanOptions {
    /** Sync the token collections first (fresh files need it; re-running is
     *  an upsert). Default true. */
    withTokens?: boolean;
    /** The CURRENT file's key — overrides each script's WRONG FILE guard so
     *  the set lands where the designer is looking. '' disables the guard
     *  (unshared drafts have no key). */
    fileKey?: string | null;
    /** The bundle's foreign token set (parseIncoming* surfaces it). When
     *  present, the tokens step syncs THAT set as its own named collection
     *  and the bundle's contracts resolve against base + minted instead of
     *  the baked repo tokens. */
    tokenSet?: TokenSetPayload | null;
    /** Bundle-carried icon assets (parseIncoming* surfaces them) — merged
     *  over the baked repo icons for the incoming contracts' compile. */
    icons?: Record<string, string> | null;
  }

  function planGenerate(rawContracts: unknown[], opts: PlanOptions = {}):
    | { ok: true; steps: GenerateStep[]; notes: string[] }
    | { ok: false; issues: PlainIssue[] } {
    const issues: PlainIssue[] = [];
    const incoming: Contract[] = [];
    const seen = new Set<string>();
    rawContracts.forEach((raw, i) => {
      const v = validateOne(raw, labelOf(raw, i));
      if (!v.ok) {
        issues.push(...v.issues);
        return;
      }
      if (seen.has(v.contract.id)) {
        issues.push(plain(`This bundle carries "${v.contract.id}" twice — each contract id must appear once.`));
        return;
      }
      seen.add(v.contract.id);
      incoming.push(v.contract);
    });
    if (issues.length > 0) return { ok: false, issues };

    let ordered: Contract[];
    try {
      ordered = orderedClosure(incoming);
    } catch (e) {
      return { ok: false, issues: [plainFromThrow('Could not order the contracts', e)] };
    }
    const byId = scopeFor(incoming);
    const fileKey = opts.fileKey ?? '';
    const notes: string[] = [];
    const incomingIds = new Set(incoming.map((c) => c.id));
    const deps = ordered.filter((c) => !incomingIds.has(c.id));
    if (deps.length > 0) {
      notes.push(
        `Also syncing ${deps.length} referenced component(s) first: ${deps.map((c) => c.name).join(', ')}.`,
      );
    }

    // Foreign token set (bundle-carried): its contracts compile against
    // base + minted through an engine built EXACTLY the way the CLI builds
    // one for `--tokens base,minted`; baked repo dependencies keep the
    // baked engine (they were written against the repo tokens).
    const tokenSet = opts.tokenSet ?? null;
    const bundleIcons = opts.icons ?? null;
    const foreign = tokenSet
      ? foreignEngineFor(tokenSet, bundleIcons)
      : bundleIcons
        ? createFigmaEngine({ tokens: data.tokens, icons: mergedIcons(bundleIcons) })
        : null;

    const steps: GenerateStep[] = [];
    if (opts.withTokens !== false) {
      if (tokenSet) {
        steps.push({
          kind: 'tokens',
          title: `Token variables — "${tokenSet.name}" collection from the bundle's token set (upserted — safe to re-run)`,
          code: emitTokenSetScript(tokenSet, fileKey || null),
        });
      }
      if (!tokenSet || deps.length > 0) {
        // The repo collections: always for a repo paste; for a foreign
        // bundle only when baked dependencies ride along (they bind these).
        steps.push({
          kind: 'tokens',
          title: 'Token variables (collections upserted — safe to re-run)',
          code: engine.buildTokensScript(fileKey || null),
        });
      }
    }
    for (const contract of ordered) {
      const eng = foreign && incomingIds.has(contract.id) ? foreign : engine;
      let code: string;
      try {
        code = eng.buildComponentScript(contract, byId, fileKey);
      } catch (e) {
        // The emitter's referee refusal (named violations) or an
        // unresolvable token — both are the engine's own words.
        return { ok: false, issues: [plainFromThrow(`${contract.name} refused`, e)] };
      }
      steps.push({
        kind: 'component',
        title: `${contract.name} (${contract.id} v${contract.version})`,
        contractId: contract.id,
        code,
      });
      steps.push({
        kind: 'version-marker',
        title: `${contract.name}: record version ${contract.version}`,
        contractId: contract.id,
        code: versionMarkerScript(contract.id, contract.version),
      });
    }
    return { ok: true, steps, notes };
  }

  /** Post-sync marker: the emitted runtime stores contractId + specHash;
   *  the plugin adds the VERSION so the next Update-library report can say
   *  "1.4.0 → 1.5.0" instead of "(installed version not recorded)". */
  function versionMarkerScript(contractId: string, version: string): string {
    return `// ds-contracts plugin: record installed contract version (read-mostly follow-up).
await figma.loadAllPagesAsync();
let target = null;
for (const page of figma.root.children) {
  target = page.findOne((n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') &&
    n.getSharedPluginData('ds_contracts', 'contractId') === ${JSON.stringify(contractId)});
  if (target) break;
}
if (target) target.setSharedPluginData('ds_contracts', 'version', ${JSON.stringify(version)});
return { marker: 'version', contractId: ${JSON.stringify(contractId)}, version: ${JSON.stringify(version)}, found: !!target };
`;
  }

  // -------------------------------------------------------------------------
  // Update library — inventory + plain-words change report BEFORE applying
  // -------------------------------------------------------------------------

  /** Read-only scan for our identity markers — runs through the same
   *  run-script path, mutates nothing. G2: the scan also RECOMPUTES each
   *  set's canvas fingerprint (the same dsCanvasFingerprint the Drift tab
   *  runs) against the stamp genesis wrote, so the update check knows which
   *  targets carry un-proposed canvas edits BEFORE anything applies. */
  function inventoryScriptSource(): string {
    return `// ds-contracts plugin: read-only marker inventory (nothing changes).
${FINGERPRINT_SRC}
await figma.loadAllPagesAsync();
const rows = [];
for (const page of figma.root.children) {
  for (const node of page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })) {
    if (node.type === 'COMPONENT' && node.parent && node.parent.type === 'COMPONENT_SET') continue;
    const contractId = node.getSharedPluginData('ds_contracts', 'contractId');
    const specHash = node.getSharedPluginData('ds_contracts', 'specHash');
    if (!contractId && !specHash) continue;
    let props = [];
    try {
      props = Object.keys(node.componentPropertyDefinitions || {}).map((k) => k.split('#')[0]);
    } catch (e) { /* non-set components can throw — the row still counts */ }
    let drift = null;
    try {
      const stored = node.getSharedPluginData('ds_contracts', 'canvasFingerprint');
      if (stored) {
        drift = stored.indexOf('v4:') !== 0 ? 'unstamped'
          : stored === dsCanvasFingerprint(node) ? 'in-sync' : 'canvas-edited';
      }
    } catch (e) { /* recompute threw — no drift verdict, never a blocker */ }
    rows.push({
      contractId: contractId || null,
      name: node.name,
      nodeId: node.id,
      key: node.key || null,
      type: node.type,
      specHash: specHash || null,
      version: node.getSharedPluginData('ds_contracts', 'version') || null,
      variants: node.type === 'COMPONENT_SET' ? node.children.length : 1,
      props: props,
      drift: drift,
    });
  }
}
return { inventory: rows };
`;
  }

  /** Expected property-name surface of a compiled contract (variant axes,
   *  boolean/text props, slot swap + visibility props) — the API the file's
   *  componentPropertyDefinitions should carry after a sync. */
  function expectedProps(contract: Contract, byId: Map<string, Contract>, eng: typeof engine = engine): string[] {
    const compiled = eng.compileComponentData(contract, byId);
    const names = new Set<string>();
    for (const bp of compiled.boolProps) names.add(bp.property);
    for (const tp of compiled.textProps) names.add(tp.property);
    const collect = (spec: import('../../../core/emit-figma-script.js').NodeSpec) => {
      if (spec.contentProp) names.add(spec.contentProp);
      if (spec.slotProperty) {
        names.add(spec.slotProperty);
        if (spec.slotOptional) names.add(`Show ${spec.slotProperty}`);
      }
      for (const child of spec.children ?? []) collect(child);
    };
    for (const v of compiled.variants) collect(v.spec);
    for (const v of compiled.stateVariants ?? []) collect(v.spec);
    // Variant axes ride the variant names ("Size=sm, Tone=critical") — the
    // State preview axis included (stateVariants carry ", State=…").
    for (const v of [...compiled.variants, ...(compiled.stateVariants ?? [])]) {
      for (const seg of v.name.split(',')) {
        const axis = seg.split('=')[0]?.trim();
        if (axis) names.add(axis);
      }
    }
    return [...names];
  }

  // -------------------------------------------------------------------------
  // G8 — plain-words style diffs. Flatten a compiled spec into
  // `variant>path|channel|value` lines (designer channel words, variable
  // names, hex literals), then pair-diff two flattenings the same way the
  // Drift tab pairs canvas snapshots. Pure compute over data already in hand
  // at plan time.
  // -------------------------------------------------------------------------

  type SpecNode = import('../../../core/emit-figma-script.js').NodeSpec;
  type CompiledData = ReturnType<typeof engine.compileComponentData>;

  /** Plugin-API binding fields → the designer's words. */
  const FIELD_WORDS: Record<string, string> = {
    paddingLeft: 'padding left',
    paddingRight: 'padding right',
    paddingTop: 'padding top',
    paddingBottom: 'padding bottom',
    itemSpacing: 'gap',
    strokeWeight: 'border width',
    strokeTopWeight: 'border width (top)',
    strokeRightWeight: 'border width (right)',
    strokeBottomWeight: 'border width (bottom)',
    strokeLeftWeight: 'border width (left)',
    cornerRadius: 'radius',
    topLeftRadius: 'radius (top left)',
    topRightRadius: 'radius (top right)',
    bottomLeftRadius: 'radius (bottom left)',
    bottomRightRadius: 'radius (bottom right)',
    minWidth: 'min width',
    minHeight: 'min height',
    maxWidth: 'max width',
    maxHeight: 'max height',
    width: 'width',
    height: 'height',
    radius: 'radius',
  };
  const fieldWord = (field: string): string => FIELD_WORDS[field] ?? field;

  const hexOfRgba = (c: { r: number; g: number; b: number; a?: number }): string => {
    const h = (x: number) => Math.round((x || 0) * 255).toString(16).padStart(2, '0');
    const alpha = c.a !== undefined && c.a < 1 ? h(c.a) : '';
    return `#${h(c.r)}${h(c.g)}${h(c.b)}${alpha}`;
  };
  const djb2 = (s: string): string => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return String(h);
  };
  /** Names ride inside `variant>path|channel|value` lines — keep the
   *  separators out of them. */
  const cleanSeg = (s: string): string => s.replace(/[|>]/g, '/');

  function specStyleLines(compiled: CompiledData): string[] {
    const lines: string[] = [];
    const push = (id: string, channel: string, value: unknown) => {
      if (value === undefined || value === null || value === '') return;
      lines.push(`${id}|${channel}|${String(value)}`);
    };
    const walk = (spec: SpecNode, id: string) => {
      if (spec.fill) push(id, 'fill', spec.fill);
      if (spec.lits?.fillClear) push(id, 'fill', 'transparent');
      if (spec.lits?.fillColor) push(id, 'fill', hexOfRgba(spec.lits.fillColor));
      if (spec.stroke) push(id, 'stroke', spec.stroke);
      if (spec.layout) {
        push(
          id,
          'layout',
          `${spec.layout.mode === 'HORIZONTAL' ? 'row' : 'column'} ${spec.layout.primary}/${spec.layout.counter}${spec.layout.wrap ? ' wrap' : ''}`,
        );
      }
      for (const [field, varName] of Object.entries(spec.bindings ?? {})) push(id, fieldWord(field), varName);
      for (const [key, value] of Object.entries(spec.lits ?? {})) {
        if (typeof value === 'number') push(id, fieldWord(key), value);
      }
      if (spec.lits?.radiusCorners) push(id, 'radius', JSON.stringify(spec.lits.radiusCorners));
      if (spec.lits?.strokeSides) push(id, 'border widths', JSON.stringify(spec.lits.strokeSides));
      if (spec.characters !== undefined) push(id, 'text', `"${spec.characters}"`);
      if (spec.fontSize !== undefined) push(id, 'text size', spec.fontSize);
      if (spec.fontStyle) push(id, 'text weight', spec.fontStyle);
      if (spec.textStyle) push(id, 'text style', spec.textStyle);
      if (spec.fontFamily) push(id, 'font', spec.fontFamily);
      if (spec.textFill) push(id, 'text color', spec.textFill);
      if (spec.lineHeight !== undefined) push(id, 'line height', spec.lineHeight);
      if (spec.opacity !== undefined) push(id, 'opacity', spec.opacity);
      if (spec.fixedWidth) push(id, 'width', `${spec.fixedWidth.px}px (${spec.fixedWidth.varName})`);
      if (spec.fixedHeight) {
        push(id, 'height', `${spec.fixedHeight.px}px${spec.fixedHeight.varName ? ` (${spec.fixedHeight.varName})` : ''}`);
      }
      if (spec.dropShadow) push(id, 'shadow', JSON.stringify(spec.dropShadow));
      if (spec.effectStack) push(id, 'shadow', `${spec.effectStack.length} layer(s) · ${djb2(JSON.stringify(spec.effectStack))}`);
      if (spec.gradient) push(id, 'gradient', JSON.stringify(spec.gradient));
      if (spec.svg) push(id, 'icon', `svg·${djb2(spec.svg)}`);
      if (spec.visibleProp) push(id, 'shown when', `${spec.visibleProp}${spec.visibleDefault === false ? ' (off by default)' : ''}`);
      for (const child of spec.children ?? []) walk(child, `${id}/${cleanSeg(child.name)}`);
    };
    for (const v of [...compiled.variants, ...(compiled.stateVariants ?? [])]) {
      walk(v.spec, `${cleanSeg(v.name)}>${cleanSeg(v.spec.name)}`);
    }
    const setId = `set>${cleanSeg(compiled.setName)}`;
    push(setId, 'description', compiled.description.replace(/\s+/g, ' ').slice(0, 120));
    for (const bp of compiled.boolProps) push(setId, `${bp.property} default`, String(bp.default));
    for (const tp of compiled.textProps) push(setId, `${tp.property} default`, `"${tp.default}"`);
    return lines;
  }

  /** Pair-diff two flattenings (the Drift tab's prefix-pairing rule), then
   *  aggregate identical changes across variants. */
  function styleDiffOf(beforeLines: string[], afterLines: string[], variantCount: number): StyleChange[] {
    const cut = (l: string): [string, string] => {
      const i = l.indexOf('|');
      const j = l.indexOf('|', i + 1);
      return j > 0 ? [l.slice(0, j), l.slice(j + 1)] : [l, ''];
    };
    const inA = new Set(beforeLines);
    const inB = new Set(afterLines);
    const removed = beforeLines.filter((l) => !inB.has(l));
    const added = afterLines.filter((l) => !inA.has(l));
    const remByPrefix = new Map<string, string[]>();
    for (const l of removed) {
      const [p] = cut(l);
      const arr = remByPrefix.get(p) ?? [];
      arr.push(l);
      remByPrefix.set(p, arr);
    }
    const used = new Set<string>();
    const raw: Array<{ prefix: string; was: string; now: string }> = [];
    for (const l of added) {
      const [p, v] = cut(l);
      const candidates = (remByPrefix.get(p) ?? []).filter((r) => !used.has(r));
      if (candidates.length === 1) {
        used.add(candidates[0]);
        raw.push({ prefix: p, was: cut(candidates[0])[1], now: v });
      } else {
        raw.push({ prefix: p, was: '(absent)', now: v });
      }
    }
    for (const l of removed) {
      if (used.has(l)) continue;
      const [p, v] = cut(l);
      raw.push({ prefix: p, was: v, now: '(removed)' });
    }
    const agg = new Map<string, { change: StyleChange; vnames: string[] }>();
    for (const r of raw) {
      const gt = r.prefix.indexOf('>');
      const variant = gt >= 0 ? r.prefix.slice(0, gt) : '';
      const rest = gt >= 0 ? r.prefix.slice(gt + 1) : r.prefix;
      const bar = rest.lastIndexOf('|');
      const pathPart = bar >= 0 ? rest.slice(0, bar) : rest;
      const channel = bar >= 0 ? rest.slice(bar + 1) : '';
      const part = pathPart.split('/').pop() ?? pathPart;
      const key = `${pathPart}|${channel}|${r.was}|${r.now}`;
      const entry = agg.get(key);
      if (entry) {
        if (!entry.vnames.includes(variant)) entry.vnames.push(variant);
      } else {
        agg.set(key, { change: { part, channel, was: r.was, now: r.now, variants: null }, vnames: [variant] });
      }
    }
    return [...agg.values()].map(({ change, vnames }) => ({
      ...change,
      variants: vnames.length >= variantCount || (vnames.length === 1 && vnames[0] === 'set') ? null : vnames,
    }));
  }

  function updatePlan(
    rawContracts: unknown[],
    inventory: InventoryRow[],
    tokenSet: TokenSetPayload | null = null,
    bundleIcons: Record<string, string> | null = null,
  ): UpdatePlan {
    // A bundle-carried foreign token set (and any bundle-carried icons):
    // every incoming contract compiles against base + minted (the same
    // engine choice planGenerate makes).
    const foreign = tokenSet
      ? foreignEngineFor(tokenSet, bundleIcons)
      : bundleIcons
        ? createFigmaEngine({ tokens: data.tokens, icons: mergedIcons(bundleIcons) })
        : null;
    const eng = foreign ?? engine;
    const rows: UpdateRow[] = [];
    const incoming: Contract[] = [];
    const parsedByIndex = new Map<number, Contract>();
    rawContracts.forEach((raw, i) => {
      const v = validateOne(raw, labelOf(raw, i));
      if (v.ok) {
        incoming.push(v.contract);
        parsedByIndex.set(i, v.contract);
      }
    });
    const byId = scopeFor(incoming);

    const seenIds = new Set<string>();
    rawContracts.forEach((raw, i) => {
      const contract = parsedByIndex.get(i);
      if (contract) {
        if (seenIds.has(contract.id)) {
          rows.push({
            contractId: contract.id,
            setName: contract.name,
            version: contract.version,
            action: 'refused',
            defaultSelected: false,
            line: `• ${contract.name}: refused — this bundle carries "${contract.id}" twice; each contract id must appear once.`,
          });
          return;
        }
        seenIds.add(contract.id);
      }
      if (!contract) {
        const v = validateOne(raw, labelOf(raw, i));
        const first = v.ok ? plain('unknown') : v.issues[0];
        rows.push({
          contractId: labelOf(raw, i),
          setName: labelOf(raw, i),
          version: '',
          action: 'refused',
          defaultSelected: false,
          line: `• ${labelOf(raw, i)}: refused — ${first.headline}`,
        });
        return;
      }
      const found =
        inventory.find((r) => r.contractId === contract.id) ??
        inventory.find(
          (r) =>
            r.key !== null &&
            contract.anchors.figma.componentSetKey !== null &&
            r.key === contract.anchors.figma.componentSetKey,
        ) ??
        null;

      let compiledVariants = 0;
      let hash: string | null = null;
      let expected: string[] = [];
      let compiledIncoming: CompiledData | null = null;
      try {
        compiledIncoming = eng.compileComponentData(contract, byId);
        compiledVariants = compiledIncoming.variants.length + (compiledIncoming.stateVariants?.length ?? 0);
        hash = specHashOf(contract, byId, eng);
        expected = expectedProps(contract, byId, eng);
      } catch (e) {
        rows.push({
          contractId: contract.id,
          setName: contract.name,
          version: contract.version,
          action: 'refused',
          defaultSelected: false,
          line: `• ${contract.name}: refused — ${plainFromThrow('the contract cannot compile', e).headline}`,
        });
        return;
      }

      if (!found) {
        rows.push({
          contractId: contract.id,
          setName: contract.name,
          version: contract.version,
          action: 'create',
          defaultSelected: true,
          line: `• ${contract.name} ${contract.version}: new — will be created (${compiledVariants} variant${compiledVariants === 1 ? '' : 's'}).`,
        });
        return;
      }
      if (found.specHash !== null && found.specHash === hash) {
        rows.push({
          contractId: contract.id,
          setName: contract.name,
          version: contract.version,
          action: 'skip',
          defaultSelected: false,
          nodeId: found.nodeId,
          line: `• ${contract.name} ${contract.version}: unchanged — will be skipped.`,
        });
        return;
      }
      const from = found.version ?? null;
      const fromText = from ? `${from} → ` : '(installed version not recorded) → ';
      const added = expected.filter((p) => !found.props.includes(p));
      const removed = found.props.filter((p) => !expected.includes(p));
      const segments: string[] = [];
      for (const p of added) segments.push(`+prop ${p}`);
      for (const p of removed) segments.push(`prop ${p} left the contract (kept — retire by hand)`);

      // G8: itemize the interior per channel. The installed spec is in hand
      // exactly when the recorded installed version is a baked contract's
      // version (the sets this plugin generated) — then both compiled specs
      // diff per channel; otherwise nothing can be itemized honestly.
      let styleChanges: StyleChange[] | null = null;
      const baked = bakedById.get(contract.id) ?? null;
      if (baked && found.version !== null && baked.version === found.version) {
        try {
          const installed = engine.compileComponentData(baked, new Map(bakedById));
          styleChanges = styleDiffOf(
            specStyleLines(installed),
            specStyleLines(compiledIncoming),
            Math.max(compiledVariants, 1),
          );
        } catch {
          styleChanges = null;
        }
      }
      if (segments.length === 0) {
        if (styleChanges && styleChanges.length > 0) {
          segments.push(`${styleChanges.length} style change${styleChanges.length === 1 ? '' : 's'} inside — listed below`);
        } else if (styleChanges) {
          segments.push('changes inside that this report cannot itemize — apply to see them, or hold this set');
        } else {
          segments.push('style changes inside the component (no prop changes)');
        }
      }

      // G2 (covenant repair): a canvas-edited target gets a NAMED overwrite
      // warning and starts UNCHECKED. Warn and default-safe — never block.
      const canvasEdited = found.drift === 'canvas-edited';
      rows.push({
        contractId: contract.id,
        setName: contract.name,
        version: contract.version,
        action: 'amend',
        defaultSelected: !canvasEdited,
        canvasEdited,
        warning: canvasEdited
          ? `${contract.name} has un-proposed canvas edits — applying will overwrite them. Review them in the Drift tab (or propose them) first; its box starts unchecked.`
          : undefined,
        styleChanges,
        nodeId: found.nodeId,
        line: `• ${contract.name} ${fromText}${contract.version}: ${segments.join('; ')}.`,
      });
    });

    const count = (a: UpdateRow['action']) => rows.filter((r) => r.action === a).length;
    const warned = rows.filter((r) => r.warning);
    const lines = [
      ...rows.map((r) => r.line),
      ...(warned.length > 0
        ? [
            `⚠ ${warned.length} set${warned.length === 1 ? ' has' : 's have'} un-proposed canvas edits — applying overwrites the edits, so ${warned.length === 1 ? 'its box starts' : 'their boxes start'} unchecked.`,
          ]
        : []),
      `${count('amend')} to update · ${count('create')} new · ${count('skip')} unchanged${count('refused') ? ` · ${count('refused')} refused` : ''}.`,
      'Nothing has been applied — review the list, then Apply.',
    ];
    return { rows, lines };
  }

  /** Scripts for the selected rows only (amend/create), dependency-ordered,
   *  tokens first — the Apply step behind the mandatory report+confirm. */
  function updateApplySteps(
    rawContracts: unknown[],
    selectedContractIds: string[],
    opts: PlanOptions = {},
  ): ReturnType<typeof planGenerate> {
    const selected: unknown[] = [];
    for (const raw of rawContracts) {
      const id = raw && typeof raw === 'object' ? (raw as { id?: unknown }).id : null;
      if (typeof id === 'string' && selectedContractIds.includes(id)) selected.push(raw);
    }
    if (selected.length === 0) {
      return { ok: false, issues: [plain('Nothing selected — tick at least one component to apply.')] };
    }
    return planGenerate(selected, opts);
  }

  // -------------------------------------------------------------------------
  // Propose change — dump → proposal → bounded API-level diff vs the base
  // -------------------------------------------------------------------------

  const DIFF_SCOPE_NOTE =
    'Scope: this diff covers the API surface (version, props, slots, variant axes) and names when anatomy/style bytes differ — interior style changes are summarized, not itemized.';

  interface ProposeDiffResult {
    ok: true;
    setName: string;
    proposal: Record<string, unknown>;
    summaryLines: string[];
    /** The downloadable artifact: base id/version, proposal, summary. */
    exportJson: string;
    proposalNotes: string[];
  }

  function proposeDiff(
    dump: Record<string, unknown>,
    setName: string,
    baseRaw: unknown,
  ): ProposeDiffResult | { ok: false; issue: PlainIssue } {
    const base = ContractSchema.safeParse(baseRaw);
    if (!base.success) {
      return {
        ok: false,
        issue: plain(
          'The base contract does not parse against the schema — paste the contract this set was generated from.',
          base.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'),
        ),
      };
    }
    const provenance = (dump as { _provenance?: { fileKey?: string | null } })._provenance;
    let batch;
    try {
      batch = proposeBatchFromDump(dump as never, {
        corpus,
        contractIdByName: new Map(
          [...bakedById.values()].map((c) => [c.name, c.id] as [string, string]),
        ),
        contractIdByKey: new Map(
          [...bakedById.values()]
            .filter((c) => c.anchors.figma.componentSetKey !== null)
            .map((c) => [c.anchors.figma.componentSetKey as string, c.id] as [string, string]),
        ),
        contractsById: new Map(bakedById),
        fileKey: provenance?.fileKey ?? null,
        mintUnbound: true,
        hiddenCaptured: dumpCapturesHidden(provenance as never),
      });
    } catch (e) {
      return { ok: false, issue: plainFromThrow('The proposal failed', e) };
    }
    const proposal = batch.proposals.find((p) => p.setName === setName) ?? batch.proposals[0];
    if (!proposal) {
      const skip = batch.skipped.find((s) => s.setName === setName) ?? batch.skipped[0];
      return {
        ok: false,
        issue: skip
          ? plain(skip.reason, skip.detail)
          : plain(`No component set named "${setName}" was in the dump.`),
      };
    }
    const summaryLines = boundedContractDiff(base.data, proposal.contract);
    const exportJson = JSON.stringify(
      {
        type: 'CONTRACT-PROPOSAL',
        baseContractId: base.data.id,
        baseVersion: base.data.version,
        setName: proposal.setName,
        summary: summaryLines,
        proposedContract: proposal.contract,
        proposalNotes: proposal.notes,
      },
      null,
      2,
    );
    return {
      ok: true,
      setName: proposal.setName,
      proposal: proposal.contract,
      summaryLines,
      exportJson,
      proposalNotes: proposal.notes,
    };
  }

  /** Bounded API-level contract diff, plain words. */
  function boundedContractDiff(base: Contract, proposedRaw: Record<string, unknown>): string[] {
    const lines: string[] = [];
    const proposed = ContractSchema.safeParse(proposedRaw);
    if (!proposed.success) {
      return [
        'The proposed contract did not parse against the schema — see the export for the raw proposal.',
        DIFF_SCOPE_NOTE,
      ];
    }
    const p = proposed.data;
    type PropDoc = Contract['props'][number];
    const typeText = (t: PropDoc['type']): string => {
      if (typeof t === 'string') return t;
      if ('enum' in t) return `enum(${t.enum.join('|')})`;
      return 'arrayOf';
    };
    const baseProps = new Map(base.props.map((x) => [x.name, x]));
    const propProps = new Map(p.props.map((x) => [x.name, x]));
    for (const [name, prop] of propProps) {
      const b = baseProps.get(name);
      if (!b) {
        lines.push(`+prop ${name} (${typeText(prop.type)})`);
        continue;
      }
      if (typeText(b.type) !== typeText(prop.type)) {
        lines.push(`prop ${name}: type ${typeText(b.type)} → ${typeText(prop.type)}`);
      }
      if (JSON.stringify(b.default) !== JSON.stringify(prop.default)) {
        lines.push(
          `prop ${name}: default ${b.default === undefined ? '(none)' : JSON.stringify(b.default)} → ${prop.default === undefined ? '(none)' : JSON.stringify(prop.default)}`,
        );
      }
    }
    for (const [name] of baseProps) {
      if (!propProps.has(name)) lines.push(`-prop ${name} (not observed in the drawn set)`);
    }
    const baseSlots = new Set([...slotsOf(base)].map((s) => s.slot.name));
    const propSlots = new Set([...slotsOf(p)].map((s) => s.slot.name));
    for (const s of propSlots) if (!baseSlots.has(s)) lines.push(`+slot ${s}`);
    for (const s of baseSlots) if (!propSlots.has(s)) lines.push(`-slot ${s} (not observed in the drawn set)`);
    if (JSON.stringify(base.anatomy) !== JSON.stringify(p.anatomy)) {
      lines.push('anatomy/style changes (see the exported proposal for the full trees)');
    }
    if (lines.length === 0) lines.push('No API-level differences — the drawn set matches its contract.');
    lines.push(DIFF_SCOPE_NOTE);
    return lines;
  }

  // -------------------------------------------------------------------------
  // Propose → GitHub PR (BYO fine-grained token; DRY-RUN plan is pure)
  // -------------------------------------------------------------------------

  interface PrRequest {
    /** Plain-words step name shown in dry-run and live logs. */
    title: string;
    method: 'GET' | 'POST' | 'PUT';
    url: string;
    /** null for GETs; a template for writes (dry-run shows it verbatim). */
    body: Record<string, unknown> | null;
  }

  interface PrPlanInput {
    owner: string;
    repo: string;
    /** Base branch; empty → resolved live from the repo's default branch. */
    base: string;
    /** Path of the contract file inside the repo. */
    path: string;
    contractJson: string;
    contractId: string;
    baseVersion: string;
    summaryLines: string[];
    /** Deterministic override for the harness; live runs derive from Date. */
    branchSuffix?: string;
  }

  function prPlan(input: PrPlanInput): { branch: string; title: string; body: string; requests: PrRequest[] } {
    const api = 'https://api.github.com';
    const suffix =
      input.branchSuffix ??
      new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').toLowerCase();
    const branch = `ds-contracts/propose-${input.contractId.replace(/[^a-z0-9.-]+/gi, '-')}-${suffix}`;
    const repoUrl = `${api}/repos/${input.owner}/${input.repo}`;
    const title = `Proposed contract change: ${input.contractId} (from Figma)`;
    const body = [
      `A designer proposed this change from Figma via the DS Contracts Sync Runner plugin.`,
      '',
      `Base: ${input.contractId} v${input.baseVersion}`,
      '',
      '## Summary',
      ...input.summaryLines.map((l) => `- ${l}`),
      '',
      '_The contract file in this PR is the proposed document; review it like any other contract diff._',
    ].join('\n');
    const requests: PrRequest[] = [
      {
        title: input.base
          ? `Confirm base branch "${input.base}" exists`
          : 'Resolve the default branch',
        method: 'GET',
        url: input.base ? `${repoUrl}/git/ref/heads/${input.base}` : repoUrl,
        body: null,
      },
      {
        title: `Create branch ${branch}`,
        method: 'POST',
        url: `${repoUrl}/git/refs`,
        body: { ref: `refs/heads/${branch}`, sha: '<base branch head sha>' },
      },
      {
        title: `Commit ${input.path} on ${branch}`,
        method: 'PUT',
        url: `${repoUrl}/contents/${input.path}`,
        body: {
          message: `propose: ${input.contractId} contract change from Figma`,
          branch,
          content: '<base64 of the proposed contract>',
          sha: '<existing file sha, when the file already exists>',
        },
      },
      {
        title: 'Open the pull request',
        method: 'POST',
        url: `${repoUrl}/pulls`,
        body: { title, head: branch, base: input.base || '<default branch>', body },
      },
    ];
    return { branch, title, body, requests };
  }

  /** Dry-run text — the exact plan, no network, no token needed. */
  function prDryRunLines(input: PrPlanInput): string[] {
    const { branch, requests } = prPlan(input);
    return [
      `DRY RUN — no request leaves this window. The live run would:`,
      ...requests.map((r, i) => `${i + 1}. ${r.title} — ${r.method} ${r.url}`),
      `Branch: ${branch}`,
      `Token: used for these requests only, kept in this window's memory, never stored.`,
    ];
  }

  /** G9 — the sample-library cold start: a curated CONTRACTS-BUNDLE built
   *  from the contracts already baked into this build (Card + the components
   *  it composes). One click on the Generate tab feeds it straight into the
   *  existing generate path — no paste, no repo, no CLI. */
  const SAMPLE_IDS = ['ds.card', 'ds.badge', 'ds.avatar', 'ds.button'];

  return {
    contractCount: bakedById.size,
    /** Raw JSON text of a baked repo contract (Propose pre-fills the base
     *  box from a set's identity marker) — null when the id is not baked. */
    bakedContract: (id: string): string | null => {
      const c = bakedById.get(id);
      return c ? JSON.stringify(c, null, 2) : null;
    },
    /** The baked sample bundle (G9) — null when this build carries none of
     *  the curated contracts (a stripped custom build). */
    sampleBundleJson: (): string | null => {
      const picked = SAMPLE_IDS.map((id) => bakedById.get(id)).filter((c): c is Contract => !!c);
      if (picked.length === 0) return null;
      return JSON.stringify(
        {
          type: 'CONTRACTS-BUNDLE',
          version: 1,
          note: 'Sample library — the reference contracts baked into this plugin build.',
          contracts: picked,
        },
        null,
        2,
      );
    },
    parseIncomingText,
    parseIncomingValue,
    validateOne,
    planGenerate,
    inventoryScriptSource,
    updatePlan,
    updateApplySteps,
    specHashOf: (raw: unknown) => {
      const v = validateOne(raw, labelOf(raw, 0));
      if (!v.ok) throw new Error(v.issues[0].headline);
      return specHashOf(v.contract, scopeFor([v.contract]));
    },
    proposeDiff,
    prPlan,
    prDryRunLines,
  };
}

export type PluginEngine = ReturnType<typeof createPluginEngine>;
