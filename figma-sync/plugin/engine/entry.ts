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
 *   - Token resolution is the repo token tree baked into the bundle. A
 *     contract that references tokens outside it is refused BY NAME (the
 *     emitter's own "Cannot resolve token" refusal, surfaced in plain words).
 *   - The propose diff is API-LEVEL (version, props, slots, variant axes)
 *     plus a single named line when anatomy/style bytes differ — interior
 *     style diffs are summarized, not itemized.
 */
import {
  ContractSchema,
  componentRefsOf,
  createFigmaEngine,
  dumpCapturesHidden,
  proposeBatchFromDump,
  slotsOf,
  sortByDependencies,
  tokenCorpusFromJson,
  type Contract,
} from '../../../core/index.js';

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
  | { ok: true; kind: 'contract' | 'bundle'; contracts: unknown[] }
  | { ok: false; issue: PlainIssue };

export interface UpdateRow {
  contractId: string;
  setName: string;
  version: string;
  action: 'create' | 'amend' | 'skip' | 'refused';
  /** The exact plain-words report line for this contract. */
  line: string;
  nodeId?: string;
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
      return { ok: true, kind: 'bundle', contracts };
    }
    if (raw && typeof raw === 'object' && typeof (raw as { id?: unknown }).id === 'string') {
      return { ok: true, kind: 'contract', contracts: [raw] };
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

  function specHashOf(contract: Contract, byId: Map<string, Contract>): string {
    const compiled = engine.compileComponentData(contract, byId);
    const s = JSON.stringify(compiled);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return String(h);
  }

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
  }

  function planGenerate(rawContracts: unknown[], opts: PlanOptions = {}):
    | { ok: true; steps: GenerateStep[]; notes: string[] }
    | { ok: false; issues: PlainIssue[] } {
    const issues: PlainIssue[] = [];
    const incoming: Contract[] = [];
    rawContracts.forEach((raw, i) => {
      const v = validateOne(raw, labelOf(raw, i));
      if (v.ok) incoming.push(v.contract);
      else issues.push(...v.issues);
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

    const steps: GenerateStep[] = [];
    if (opts.withTokens !== false) {
      steps.push({
        kind: 'tokens',
        title: 'Token variables (collections upserted — safe to re-run)',
        code: engine.buildTokensScript(fileKey || null),
      });
    }
    for (const contract of ordered) {
      let code: string;
      try {
        code = engine.buildComponentScript(contract, byId, fileKey);
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
   *  run-script path, mutates nothing. */
  function inventoryScriptSource(): string {
    return `// ds-contracts plugin: read-only marker inventory (nothing changes).
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
    });
  }
}
return { inventory: rows };
`;
  }

  /** Expected property-name surface of a compiled contract (variant axes,
   *  boolean/text props, slot swap + visibility props) — the API the file's
   *  componentPropertyDefinitions should carry after a sync. */
  function expectedProps(contract: Contract, byId: Map<string, Contract>): string[] {
    const compiled = engine.compileComponentData(contract, byId);
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
    // Variant axes ride the variant names ("Size=sm, Tone=critical").
    for (const v of compiled.variants) {
      for (const seg of v.name.split(',')) {
        const axis = seg.split('=')[0]?.trim();
        if (axis) names.add(axis);
      }
    }
    return [...names];
  }

  function updatePlan(rawContracts: unknown[], inventory: InventoryRow[]): UpdatePlan {
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

    rawContracts.forEach((raw, i) => {
      const contract = parsedByIndex.get(i);
      if (!contract) {
        const v = validateOne(raw, labelOf(raw, i));
        const first = v.ok ? plain('unknown') : v.issues[0];
        rows.push({
          contractId: labelOf(raw, i),
          setName: labelOf(raw, i),
          version: '',
          action: 'refused',
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
      try {
        const compiled = engine.compileComponentData(contract, byId);
        compiledVariants = compiled.variants.length + (compiled.stateVariants?.length ?? 0);
        hash = specHashOf(contract, byId);
        expected = expectedProps(contract, byId);
      } catch (e) {
        rows.push({
          contractId: contract.id,
          setName: contract.name,
          version: contract.version,
          action: 'refused',
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
      if (segments.length === 0) segments.push('interior/style changes (no API change)');
      rows.push({
        contractId: contract.id,
        setName: contract.name,
        version: contract.version,
        action: 'amend',
        nodeId: found.nodeId,
        line: `• ${contract.name} ${fromText}${contract.version}: ${segments.join('; ')}.`,
      });
    });

    const count = (a: UpdateRow['action']) => rows.filter((r) => r.action === a).length;
    const lines = [
      ...rows.map((r) => r.line),
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

  return {
    contractCount: bakedById.size,
    /** Raw JSON text of a baked repo contract (Propose pre-fills the base
     *  box from a set's identity marker) — null when the id is not baked. */
    bakedContract: (id: string): string | null => {
      const c = bakedById.get(id);
      return c ? JSON.stringify(c, null, 2) : null;
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
