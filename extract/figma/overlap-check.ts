/**
 * Receipts for P21 — OVERLAP COLLECTIONS (negative auto-layout spacing).
 * `npm run extract:figma:overlap:check`.
 *
 * The pattern (extract/figma/gauntlet/PATTERN-TAXONOMY.md P21): an
 * AvatarGroup-shaped set draws its children with NEGATIVE itemSpacing. The
 * pre-P21 proposer minted that observation as a plain negative-px gap token —
 * actively wrong twice over: `gap: -8px` is invalid CSS (parses to nothing,
 * so the overlap silently vanished), and nothing carried the fact that the
 * children OVERLAP. The vocabulary already exists — `layout.overlap: true`
 * with the gap token carrying the drawn (negative) magnitude, whose shipped
 * projection is the ds.avatar-group owner-precedent ({space.avatarGroup.
 * overlap} → {space.overlap} = -8px): a negative CHILD MARGIN in CSS,
 * negative itemSpacing on the canvas.
 *
 * Pinned here, on the REAL owner's-kit fixture plus a uniform-negative
 * replay of the same set:
 *
 *   1. UNIFORM negative spacing (every variant) → layout.overlap: true, the
 *      gap token mints with the DRAWN value, and the CSS surfaces project it
 *      as a negative child margin — never as an invalid CSS `gap`.
 *   2. MIXED-sign spacing (the live Avatar group: type=space 4px vs
 *      type=overlap -8px) → overlap is a per-part invariant with no
 *      per-variant form, so nothing is guessed: gap is NOT minted, the limit
 *      is a NAMED note, and the unbound report survives for review. No
 *      plain negative-px gap token exists anywhere in the output.
 *   3. The untouched bound mixed-sign fixture refuses by its unsupported
 *      spacing code before publication. Captured whitespace names still
 *      register with original identity and value; uniform bound overlap carries.
 *
 * Node shell over pure core functions — the same split as every receipt in
 * extract/figma/. Reads the repo and the committed fixture; writes nothing.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  ContractSchema,
  type Contract,
} from "../../scripts/contract-schema.js";
import { capturedTokensFromDump } from "../../core/captured-tokens.js";
import { generateSurfaces, type EmitterCtx } from "../../core/emitter.js";
import { generateCss, validateContract } from "../../core/emit-react.js";
import { emitHtml } from "../../core/emit-html.js";
import {
  flattenTokens,
  tokenInventoryFromJson,
  type TokenTreeInput,
} from "../../core/tokens.js";
import {
  proposeBatchFromDump,
  type FigmaProposalResult,
} from "../../core/propose-figma.js";
import { loadTokenCorpus } from "./tokens.js";
import { loadContracts } from "./propose.js";

const ROOT = process.cwd();
const FIXTURE = path.join(
  "extract",
  "figma",
  "gauntlet",
  "fixtures",
  "component-ref-unknown-child-prop-avatar-group.dump.json",
);
const read = (p: string) =>
  JSON.parse(readFileSync(path.join(ROOT, p), "utf8")) as Record<
    string,
    unknown
  >;

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? "✔" : "✖"} ${label}`);
};

// Census/playground receive composition (class-fix-check.ts shape).
const corpus = loadTokenCorpus(ROOT);
const loaded = loadContracts(path.resolve(ROOT, "contracts"));
const repoContracts = new Map<string, Contract>(
  readdirSync(path.join(ROOT, "contracts"))
    .filter((f) => f.endsWith(".contract.json"))
    .map((f) => ContractSchema.parse(read(path.join("contracts", f))))
    .map((c) => [c.id, c]),
);
const icons = new Map<string, string>(
  readdirSync(path.join(ROOT, "assets", "icons"))
    .filter((f) => f.endsWith(".svg"))
    .map((f) => [
      f.replace(/\.svg$/, ""),
      readFileSync(path.join(ROOT, "assets", "icons", f), "utf8").trim(),
    ]),
);
const brands = Object.fromEntries(
  readdirSync(path.join(ROOT, "tokens", "modes"))
    .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
    .map((f) => [
      f.replace(/^brand\.|\.tokens\.json$/g, ""),
      read(`tokens/modes/${f}`),
    ]),
);
const repoTrees = {
  primitives: read("tokens/primitives.tokens.json"),
  semantic: read("tokens/semantic.tokens.json"),
  light: read("tokens/modes/semantic.light.tokens.json"),
  dark: read("tokens/modes/semantic.dark.tokens.json"),
};
const repoInventory = tokenInventoryFromJson([
  repoTrees.primitives,
  repoTrees.semantic,
  repoTrees.light,
  repoTrees.dark,
]);

function mergeTrees(docs: Record<string, unknown>[]): Record<string, unknown> {
  const merge = (
    a: Record<string, unknown>,
    b: Record<string, unknown>,
  ): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...a };
    for (const [k, v] of Object.entries(b)) {
      const prev = out[k];
      out[k] =
        prev &&
        v &&
        typeof prev === "object" &&
        typeof v === "object" &&
        !Array.isArray(prev) &&
        !Array.isArray(v)
          ? merge(prev as Record<string, unknown>, v as Record<string, unknown>)
          : v;
    }
    return out;
  };
  return docs.reduce(merge, {});
}

interface Replay {
  contract: Contract;
  proposal: FigmaProposalResult & { setName: string };
  violations: string[];
  emitted: string[];
  refusals: Array<{ emitter: string; message: string }>;
  css: string;
  html: string;
  ctx: EmitterCtx;
}

function replay(dump: Record<string, unknown>): Replay {
  const captured = capturedTokensFromDump(dump);
  const capturedRegistered = (captured?.entries ?? []).filter(
    (e) => !repoInventory.has(e.path),
  );
  const capturedTree: Record<string, unknown> = {};
  for (const e of capturedRegistered) {
    const segs = e.path.split(".");
    let node = capturedTree;
    for (const seg of segs.slice(0, -1))
      node = (node[seg] ??= {}) as Record<string, unknown>;
    node[segs[segs.length - 1]] = { $value: e.value, $type: e.type };
  }
  const provenance = dump._provenance as { fileKey?: string } | undefined;
  const batch = proposeBatchFromDump(dump, {
    projectionMode: "reviewable-inversion",
    corpus,
    contractIdByName: loaded.byName,
    contractsById: loaded.byId,
    fileKey: provenance?.fileKey ?? null,
    mintUnbound: true,
  });
  if (batch.proposals.length !== 1)
    throw new Error(`expected 1 proposal, got ${batch.proposals.length}`);
  const proposal = batch.proposals[0];
  const contract = ContractSchema.parse(proposal.contract);
  const contracts = new Map(repoContracts);
  contracts.set(contract.id, contract);
  for (const raw of proposal.childStubs ?? []) {
    const stub = ContractSchema.safeParse(raw);
    if (stub.success && !contracts.has(stub.data.id))
      contracts.set(stub.data.id, stub.data);
  }
  const mintedTree = (proposal.mintedTokens?.tree ?? {}) as Record<
    string,
    unknown
  >;
  const inventory = new Set<string>([
    ...repoInventory,
    ...capturedRegistered.map((e) => e.path),
    ...flattenTokens(mintedTree).keys(),
  ]);
  const violations: string[] = [];
  validateContract(contract, contracts, violations, icons);
  const css = generateCss(contract, inventory, violations);
  const tokens: TokenTreeInput = {
    ...repoTrees,
    semantic: mergeTrees([
      mergeTrees([repoTrees.semantic as Record<string, unknown>, capturedTree]),
      mintedTree,
    ]),
    brands,
  };
  const ctx: EmitterCtx = {
    tokens,
    icons,
    contracts,
    fileKey: provenance?.fileKey ?? undefined,
    mintedTokens: mintedTree,
  };
  const emitted: string[] = [];
  const refusals: Array<{ emitter: string; message: string }> = [];
  for (const emitter of generateSurfaces()) {
    try {
      emitter.emit(contract, ctx);
      emitted.push(emitter.name);
    } catch (e) {
      refusals.push({
        emitter: emitter.name,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  const html =
    refusals.length === 0
      ? emitHtml(contract, { tokens: inventory, icons, contracts }).css
      : "";
  return { contract, proposal, violations, emitted, refusals, css, html, ctx };
}

const surfaces = generateSurfaces().map((e) => e.name).join(", ");
const fixtureDump = read(FIXTURE);

// ---------------------------------------------------------------------------
// 1. UNIFORM negative spacing → layout.overlap + the drawn magnitude
// ---------------------------------------------------------------------------

console.log(
  "1. uniform negative itemSpacing (avatar-group-shaped set — the owner's overlap variants, literal spacing)",
);
{
  // The live set, restricted to its type=overlap variants (the axis pair
  // stripped) — a pure overlap collection, every variant negative. The live
  // kit binds itemSpacing to a whitespace name that registers through the
  // shared source-name rule ("spacing/100 negative" → spacing.100-negative,
  // pinned in section 3); the LITERAL spelling below is the avatar-group shape most
  // kits draw, and the path P21 fixes.
  const set = JSON.parse(JSON.stringify(fixtureDump["Avatar group"])) as {
    setName: string;
    variants: Array<{ name: string; bound?: Record<string, string> }>;
  };
  set.setName = "Avatar group overlap";
  set.variants = set.variants
    .filter((v) => v.name.includes("type=overlap"))
    .map((v) => ({ ...v, name: v.name.replace(/,\s*type=overlap/, "") }));
  for (const v of set.variants) delete v.bound?.itemSpacing;
  const dump = {
    _provenance: fixtureDump._provenance,
    _variables: fixtureDump._variables,
    "Avatar group overlap": set,
  };
  const r = replay(dump as Record<string, unknown>);
  check(
    `3 size variants replay (got ${set.variants.length})`,
    set.variants.length === 3,
  );

  const rootLayout = (r.contract.anatomy.root.layout ?? {}) as {
    overlap?: boolean;
  };
  check(
    "root proposes layout.overlap: true (children OVERLAP — P21)",
    rootLayout.overlap === true,
  );
  const note = r.proposal.notes.find(
    (n) =>
      n.includes(
        "negative itemSpacing in every variant — children OVERLAP (P21); proposed as layout.overlap: true",
      ) &&
      n.includes(
        "the ds.avatar-group owner-precedent where {space.overlap} = -8px",
      ) &&
      n.includes("never an invalid CSS `gap`"),
  );
  check(
    "the overlap carry is a NAMED note (owner-precedent projection spelled out)",
    note !== undefined,
  );

  const gapRef = (r.contract.anatomy.root.tokens ?? {})["gap"];
  check(
    `root gap binds a minted token (got ${String(gapRef)})`,
    typeof gapRef === "string" && gapRef.startsWith("{imported."),
  );
  const gapEntry = r.proposal.mintedTokens?.entries.find(
    (e) => e.ref === gapRef,
  );
  check(
    `the minted gap token carries the DRAWN magnitude -8px (got ${String(gapEntry?.value)})`,
    gapEntry?.value === "-8px",
  );

  check(
    "CSS projects the overlap as a negative CHILD MARGIN (.root > * + * { margin-left: … })",
    /\.root > \* \+ \* \{\n  margin-left: var\(--imported-[a-z0-9-]+-gap\);\n\}/.test(
      r.css,
    ),
  );
  check(
    "CSS never emits the invalid `gap:` declaration for the overlap token",
    !/  gap: var\(--imported-/.test(r.css),
  );
  check(
    `referee CLEAN (got ${r.violations.length})`,
    r.violations.length === 0,
  );
  check(
    `ALL FOUR surfaces emit (${surfaces})`,
    r.emitted.length === generateSurfaces().length && r.refusals.length === 0,
  );
  check(
    "emit-html mirrors the projection (child-margin rule, no invalid gap)",
    r.html.includes("> * + *") &&
      r.html.includes("margin-left: var(--imported-") &&
      !/  gap: var\(--imported-/.test(r.html),
  );
}

// ---------------------------------------------------------------------------
// 2. MIXED-sign spacing (the live set verbatim) → NAMED, never minted
// ---------------------------------------------------------------------------

console.log(
  "\n2. mixed-sign itemSpacing (the live set's type=space 4 / type=overlap -8, literal spelling)",
);
{
  const set = JSON.parse(JSON.stringify(fixtureDump["Avatar group"])) as {
    setName: string;
    variants: Array<{ bound?: Record<string, string> }>;
  };
  set.setName = "Avatar group mixed";
  for (const v of set.variants) delete v.bound?.itemSpacing;
  const dump = {
    _provenance: fixtureDump._provenance,
    _variables: fixtureDump._variables,
    "Avatar group mixed": set,
  };
  const r = replay(dump as Record<string, unknown>);
  const note = r.proposal.notes.find(
    (n) =>
      n.includes("itemSpacing is NEGATIVE in 3/6 variant(s) (4/-8)") &&
      n.includes(
        "layout.overlap is a per-part invariant with no per-variant form (P21)",
      ) &&
      n.includes("gap NOT minted"),
  );
  check(
    "the mixed-sign limit is a NAMED note (per-part invariant, gap NOT minted)",
    note !== undefined,
  );
  const rootLayout = (r.contract.anatomy.root.layout ?? {}) as {
    overlap?: boolean;
  };
  check(
    "layout.overlap is NOT set (overlap holds in only half the variants — never guessed)",
    rootLayout.overlap !== true,
  );
  check(
    "no gap binding ships on the root",
    (r.contract.anatomy.root.tokens ?? {})["gap"] === undefined,
  );
  const negativeMint = (r.proposal.mintedTokens?.entries ?? []).filter((e) =>
    String(e.value).startsWith("-"),
  );
  check(
    `NO negative px token mints anywhere (got ${negativeMint.length}; the pre-P21 bug class is gone)`,
    negativeMint.length === 0,
  );
  const unbound = r.proposal.unbound.find((u) => u.property === "itemSpacing");
  check(
    "the unbound itemSpacing report SURVIVES for review",
    unbound !== undefined,
  );
  check(
    `referee CLEAN (got ${r.violations.length})`,
    r.violations.length === 0,
  );
  check(
    `ALL FOUR surfaces emit (${surfaces})`,
    r.emitted.length === generateSurfaces().length && r.refusals.length === 0,
  );
}

// ---------------------------------------------------------------------------
// 3. The live fixture VERBATIM (bound mixed signs, valid registered name)
// ---------------------------------------------------------------------------

console.log('\n3. the live bound mixed-sign fixture refuses before invalid gap publication; uniform bound overlap still carries');
{
  const before=JSON.stringify(fixtureDump),captured=capturedTokensFromDump(fixtureDump)!;
  const negative=captured.entries.filter(entry=>entry.name==='spacing/100 negative');
  check('bound negative source variable preserves its original name, exact -8px and shared registered path',
    negative.length===1 && negative[0].path==='spacing.100-negative' && negative[0].value==='-8px' &&
    negative[0].type==='dimension' && flattenTokens(captured.tree).get('spacing.100-negative')?.value==='-8px');
  const collision=structuredClone(fixtureDump);
  (collision._variables as Record<string,unknown>)['spacing/100-negative']={type:'FLOAT',value:-8};
  let collisionReason='';try{capturedTokensFromDump(collision);}catch(error){collisionReason=String(error);}
  check('two distinct canvas names cannot silently share the sanitized spacing path',
    collisionReason.includes('captured-variable-name-fold-collision'));
  const batch=proposeBatchFromDump(fixtureDump,{projectionMode:'reviewable-inversion',corpus,
    contractIdByName:loaded.byName,contractsById:loaded.byId,
    fileKey:(fixtureDump._provenance as {fileKey?:string})?.fileKey ?? null,mintUnbound:true});
  const refusal=batch.skipped[0]?.reason ?? '';
  check('the untouched bound mixed-sign source refuses by exact BOUND_MIXED_SIGN_SPACING_UNSUPPORTED code',
    batch.proposals.length===0 && batch.skipped.length===1 &&
    refusal.includes('BOUND_MIXED_SIGN_SPACING_UNSUPPORTED: Avatar group:root'));
  const sourceSet=fixtureDump['Avatar group'] as {variants:Array<{name:string;layout:{spacing:number};bound:{itemSpacing:string}}>};
  const facts=sourceSet.variants.map(variant=>({variant:variant.name,spacing:variant.layout.spacing,
    variable:variant.bound.itemSpacing,token:`{${captured.variablePaths.get(variant.bound.itemSpacing)}}`}));
  check('the refusal retains every original plane, spacing value, bound source name and registered token identity',
    batch.skipped[0]?.detail?.includes(JSON.stringify(facts))===true && facts.some(fact=>fact.spacing===4 && fact.variable==='spacing/050') &&
    facts.some(fact=>fact.spacing===-8 && fact.variable==='spacing/100 negative'));
  check('no misleading contract or conditional negative CSS gap is published for the refused source',
    batch.proposals.length===0 && refusal.includes('No contract or negative CSS gap published'));
  const uniform=structuredClone(fixtureDump),set=uniform['Avatar group'] as {setName:string;variants:typeof sourceSet.variants};
  set.setName='Avatar group bound overlap';
  set.variants=set.variants.filter(variant=>variant.name.includes('type=overlap'))
    .map(variant=>({...variant,name:variant.name.replace(/,\s*type=overlap/,'')}));
  delete uniform['Avatar group'];uniform[set.setName]=set;
  const r=replay(uniform),root=r.contract.anatomy.root;
  check('uniform bound negative spacing keeps its exact sanitized source token and overlap projection',
    root.layout?.overlap===true && root.tokens?.gap==='{spacing.100-negative}' &&
    r.proposal.notes.some(note=>note.includes('spacing/100 negative') && note.includes('mapped to {spacing.100-negative}') &&
      note.includes('canvas name remains unchanged')));
  check('uniform bound CSS and HTML use negative child margins, never invalid negative gap declarations',
    r.css.includes('margin-left: var(--spacing-100-negative)') && r.html.includes('margin-left: var(--spacing-100-negative)') &&
    !/(?:^|\n)\s*gap:\s*var\(--spacing-100-negative\)/.test(r.css) &&
    !/(?:^|\n)\s*gap:\s*var\(--spacing-100-negative\)/.test(r.html));
  check('uniform bound source spacing is not replaced with an invented negative minted token',
    !(r.proposal.mintedTokens?.entries ?? []).some(entry=>String(entry.value).startsWith('-')));
  check(`uniform bound referee CLEAN (got ${r.violations.length})`,r.violations.length===0);
  check(`uniform bound ALL FOUR surfaces emit (${surfaces})`,
    r.emitted.length===generateSurfaces().length && r.refusals.length===0);
  check('registration, refusal and positive bound control leave the untouched source fixture unchanged',JSON.stringify(fixtureDump)===before);
}

// ---------------------------------------------------------------------------
// 4. Bound negative spacing requires the complete invariant projection.
// ---------------------------------------------------------------------------

console.log('\n4. incomplete bound negative captures refuse; positive uniform and per-axis spacing still carry');
{
  type SpacingPlane = {
    name: string;
    layout?: { mode: string; spacing?: number; [key:string]: unknown };
    bound?: Record<string,string>;
    children?: unknown[];
  };
  type SpacingSet = {setName:string;variants:SpacingPlane[]};
  const originalBytes=JSON.stringify(fixtureDump);
  const negativeControl=() => {
    const dump=structuredClone(fixtureDump),set=dump['Avatar group'] as SpacingSet;
    set.variants=set.variants.filter(variant=>variant.name.includes('type=overlap'))
      .map(variant=>({...variant,name:variant.name.replace(/,\s*type=overlap/,'')}));
    return {dump,set};
  };
  const controls: Array<[string,(set:SpacingSet)=>void,string]> = [
    ['missing spacing',set=>{delete set.variants[1].layout!.spacing;},'incomplete finite negative spacing capture'],
    ['all spacing missing',set=>{for(const variant of set.variants)delete variant.layout!.spacing;},'incomplete finite negative spacing capture'],
    ['missing whole layout',set=>{delete set.variants[1].layout;},'missing or non-flex layout'],
    ['non-flex layout',set=>{set.variants[1].layout!.mode='GRID';},'missing or non-flex layout'],
    ['nonfinite spacing',set=>{set.variants[1].layout!.spacing=NaN;},'incomplete finite negative spacing capture'],
    ['all spacing NaN',set=>{for(const variant of set.variants)variant.layout!.spacing=NaN;},'incomplete finite negative spacing capture'],
    ['negative infinity spacing',set=>{set.variants[1].layout!.spacing=-Infinity;},'incomplete finite negative spacing capture'],
    ['childless frame',set=>{for(const variant of set.variants)variant.children=[];},'no overlap container'],
  ];
  for(const [label,mutate,reason] of controls){
    const {dump,set}=negativeControl();
    mutate(set);
    const before=JSON.stringify(dump),captured=capturedTokensFromDump(dump)!;
    // The public proposer consumes JSON dump planes; JSON's nonfinite
    // values become null on its defensive copy. The raw caller control is
    // independently checked unchanged below, including NaN and -Infinity.
    const facts=set.variants.map(variant=>({variant:variant.name,spacing:variant.layout?.spacing ?? null,
      layoutMode:variant.layout?.mode ?? null,variable:variant.bound?.itemSpacing ?? null,
      token:variant.bound?.itemSpacing?`{${captured.variablePaths.get(variant.bound.itemSpacing)}}`:null}));
    const batch=proposeBatchFromDump(dump,{projectionMode:'reviewable-inversion',corpus,
      contractIdByName:loaded.byName,contractsById:loaded.byId,
      fileKey:(dump._provenance as {fileKey?:string})?.fileKey ?? null,mintUnbound:true});
    check(`${label}: the bound negative channel refuses before a contract or invalid gap publishes`,
      batch.proposals.length===0 && batch.skipped.length===1 &&
      batch.skipped[0].reason.includes('BOUND_NEGATIVE_SPACING_OVERLAP_UNQUALIFIED: Avatar group:root') &&
      batch.skipped[0].reason.includes(reason) && batch.skipped[0].reason.includes('No contract or negative CSS gap published'));
    check(`${label}: every captured plane, original binding and registered token identity survives in the refusal detail`,
      batch.skipped[0]?.detail?.includes(JSON.stringify(facts))===true &&
      facts.every(fact=>fact.variable==='spacing/100 negative' && fact.token==='{spacing.100-negative}') &&
      batch.skipped[0]?.detail?.includes('{"token":"{spacing.100-negative}","source":"captured-variable","value":"-8px"}')===true);
    check(`${label}: the input and original fixture stay unchanged`,JSON.stringify(dump)===before &&
      JSON.stringify(fixtureDump)===originalBytes &&
      (label!=='nonfinite spacing'||Number.isNaN(set.variants[1].layout!.spacing)) &&
      (label!=='negative infinity spacing'||set.variants[1].layout!.spacing===-Infinity) &&
      (label!=='all spacing NaN'||set.variants.every(variant=>Number.isNaN(variant.layout!.spacing))));
  }
  const corpusOnly=negativeControl();
  for(const variant of corpusOnly.set.variants){
    delete variant.layout!.spacing;variant.bound!.itemSpacing='space/avatarGroup/overlap';
  }
  const corpusOnlyBytes=JSON.stringify(corpusOnly.dump);
  const corpusRefusal=proposeBatchFromDump(corpusOnly.dump,{projectionMode:'reviewable-inversion',corpus,
    contractIdByName:loaded.byName,contractsById:loaded.byId,
    fileKey:(corpusOnly.dump._provenance as {fileKey?:string})?.fileKey ?? null,mintUnbound:true});
  check('all spacing missing: an exact negative corpus alias also refuses without a captured variable value',
    corpusRefusal.proposals.length===0 && corpusRefusal.skipped.length===1 &&
    corpusRefusal.skipped[0].reason.includes('BOUND_NEGATIVE_SPACING_OVERLAP_UNQUALIFIED') &&
    corpusRefusal.skipped[0].detail?.includes('{"token":"{space.avatarGroup.overlap}","source":"token-corpus","value":"-8px"}')===true &&
    corpusRefusal.skipped[0].detail?.includes('"variable":"space/avatarGroup/overlap"')===true &&
    JSON.stringify(corpusOnly.dump)===corpusOnlyBytes);
  const templateControl=(value:number) => {
    const {dump,set}=negativeControl();
    for(const variant of set.variants){
      const size=variant.name.match(/size=([^,]+)/)![1],name=`spacing/${size}/overlap`;
      variant.bound!.itemSpacing=name;delete variant.layout!.spacing;
      (dump._variables as Record<string,unknown>)[name]={type:'FLOAT',value};
    }
    return {dump,set};
  };
  const negativeTemplate=templateControl(-8),negativeTemplateBytes=JSON.stringify(negativeTemplate.dump);
  const templateRefusal=proposeBatchFromDump(negativeTemplate.dump,{projectionMode:'reviewable-inversion',corpus,
    contractIdByName:loaded.byName,contractsById:loaded.byId,
    fileKey:(negativeTemplate.dump._provenance as {fileKey?:string})?.fileKey ?? null,mintUnbound:true});
  check('all spacing missing: negative substituted bindings refuse by their concrete captured identities',
    templateRefusal.proposals.length===0 && templateRefusal.skipped.length===1 &&
    templateRefusal.skipped[0].reason.includes('BOUND_NEGATIVE_SPACING_OVERLAP_UNQUALIFIED') &&
    ['small','medium','large'].every(size=>templateRefusal.skipped[0].detail?.includes(
      `{"token":"{spacing.${size}.overlap}","source":"captured-variable","value":"-8px"}`)) &&
    JSON.stringify(negativeTemplate.dump)===negativeTemplateBytes);
  const positiveTemplate=templateControl(8),positiveTemplateBytes=JSON.stringify(positiveTemplate.dump),templatePositive=replay(positiveTemplate.dump);
  check('all spacing missing: exact positive substituted bindings keep the ordinary template gap and every surface',
    templatePositive.contract.anatomy.root.tokens?.gap==='{spacing.{size}.overlap}' &&
    templatePositive.contract.anatomy.root.layout?.overlap!==true &&
    templatePositive.css.includes('gap: var(--spacing-small-overlap)') &&
    templatePositive.violations.length===0 && templatePositive.refusals.length===0 &&
    templatePositive.emitted.length===generateSurfaces().length && JSON.stringify(positiveTemplate.dump)===positiveTemplateBytes);
  const positive=structuredClone(fixtureDump),positiveSet=positive['Avatar group'] as SpacingSet;
  positiveSet.variants=positiveSet.variants.filter(variant=>variant.name.includes('type=space'))
    .map(variant=>({...variant,name:variant.name.replace(/,\s*type=space/,'')}));
  const positiveBytes=JSON.stringify(positive),uniform=replay(positive),uniformRoot=uniform.contract.anatomy.root;
  check('uniform positive bound spacing keeps its original source name, value and ordinary gap projection',
    positiveSet.variants.length===3 && positiveSet.variants.every(variant=>variant.layout?.spacing===4 && variant.bound?.itemSpacing==='spacing/050') &&
    uniformRoot.tokens?.gap==='{spacing.050}' && uniformRoot.layout?.overlap!==true &&
    uniform.css.includes('gap: var(--spacing-050)') && uniform.html.includes('gap: var(--spacing-050)'));
  check('uniform positive bound spacing qualifies all four surfaces and leaves the input unchanged',
    uniform.violations.length===0 && uniform.refusals.length===0 && uniform.emitted.length===generateSurfaces().length &&
    JSON.stringify(positive)===positiveBytes);
  const positiveMissing=structuredClone(positive),positiveMissingSet=positiveMissing['Avatar group'] as SpacingSet;
  for(const variant of positiveMissingSet.variants)delete variant.layout!.spacing;
  const positiveMissingBytes=JSON.stringify(positiveMissing),positiveKnown=replay(positiveMissing);
  check('all spacing missing: the exact positive source binding still carries a truthful ordinary gap',
    positiveKnown.contract.anatomy.root.tokens?.gap==='{spacing.050}' && positiveKnown.contract.anatomy.root.layout?.overlap!==true &&
    positiveKnown.css.includes('gap: var(--spacing-050)') && positiveKnown.html.includes('gap: var(--spacing-050)') &&
    positiveKnown.violations.length===0 && positiveKnown.refusals.length===0 &&
    positiveKnown.emitted.length===generateSurfaces().length && JSON.stringify(positiveMissing)===positiveMissingBytes);
  // This explicit synthetic control changes the negative channel to a second
  // positive binding. The historical source remains untouched above.
  const varied=structuredClone(fixtureDump),variedSet=varied['Avatar group'] as SpacingSet;
  (varied._variables as Record<string,unknown>)['spacing/100 positive']={type:'FLOAT',value:8};
  for(const variant of variedSet.variants)if(variant.name.includes('type=overlap')){
    variant.layout!.spacing=8;variant.bound!.itemSpacing='spacing/100 positive';
  }
  const variedBytes=JSON.stringify(varied),perAxis=replay(varied),perAxisRoot=perAxis.contract.anatomy.root;
  check('ordinary positive variant spacing keeps default and per-axis binding identity without overlap',
    perAxisRoot.tokens?.gap==='{spacing.050}' && perAxisRoot.layout?.overlap!==true &&
    JSON.stringify(perAxisRoot.tokensByProp)==='{"prop":"type","map":{"overlap":{"gap":"{spacing.100-positive}"}}}' &&
    perAxis.css.includes('gap: var(--spacing-050)') && perAxis.css.includes('gap: var(--spacing-100-positive)') &&
    perAxis.html.includes('gap: var(--spacing-100-positive)'));
  check('ordinary positive variant spacing qualifies all four surfaces and leaves every control plane unchanged',
    perAxis.violations.length===0 && perAxis.refusals.length===0 && perAxis.emitted.length===generateSurfaces().length &&
    JSON.stringify(varied)===variedBytes && JSON.stringify(fixtureDump)===originalBytes);
  const positiveNamedNegative=structuredClone(fixtureDump),positiveNamedSet=positiveNamedNegative['Avatar group'] as SpacingSet;
  (positiveNamedNegative._variables as Record<string,unknown>)['spacing/100 negative']={type:'FLOAT',value:8};
  for(const variant of positiveNamedSet.variants)if(variant.name.includes('type=overlap'))variant.layout!.spacing=8;
  const positiveNamedBytes=JSON.stringify(positiveNamedNegative),named=replay(positiveNamedNegative);
  check('a source name containing negative supplies no sign authority when the exact bound value is positive',
    named.contract.anatomy.root.layout?.overlap!==true &&
    JSON.stringify(named.contract.anatomy.root.tokensByProp)==='{"prop":"type","map":{"overlap":{"gap":"{spacing.100-negative}"}}}' &&
    named.css.includes('gap: var(--spacing-100-negative)') &&
    named.violations.length===0 && named.refusals.length===0 && named.emitted.length===generateSurfaces().length &&
    JSON.stringify(positiveNamedNegative)===positiveNamedBytes && JSON.stringify(fixtureDump)===originalBytes);
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} overlap check(s) failed`);
  process.exit(1);
}
console.log(
  "\n✔ P21 holds — negative spacing carries as layout.overlap (uniform) or a named limit (mixed); a plain negative-px gap token never mints",
);
