/**
 * DESIGN → CONTRACT: propose a full contract (API + anatomy + token bindings)
 * from a node-tree dump of a drawn component set.
 *
 * This ends the "anatomy is human-owned" era for the DESIGN side: a designer
 * draws a net-new component, dump.plugin.js captures its structure, and this
 * module inverts the exact forward mappings scripts/generate-figma.ts applies
 * — so a contract-generated set round-trips to its own contract (the receipt:
 * extract/figma/roundtrip.ts → ROUNDTRIP.md).
 *
 * Inversion rules (each is the inverse of a documented generator rule):
 *
 *   LAYOUT      mode/primary/counter → direction/justify/align via the inverse
 *               of layoutSpec's ALIGN_FIGMA/JUSTIFY_FIGMA maps. MIN inverts to
 *               "unspecified" (start ≡ absent on the canvas). align:stretch is
 *               observable only through its artifact — every eligible child
 *               (FRAME/TEXT without a bound width; instances are excluded by
 *               the generator) carries layoutSizingHorizontal FILL in a column
 *               parent. fillWidth in a ROW parent inverts to layout.grow.
 *               A root drawn exactly at the generator's root default
 *               (row/center/center) proposes NO layout block.
 *
 *   TOKENS      Variable names use SLASHES on the canvas; contract refs use
 *               DOTS in braces. paddingLeft==paddingRight → padding-inline
 *               (same for -block); four equal radii → border-radius; four
 *               equal stroke weights → border-width; itemSpacing → gap; a
 *               bound width on the ROOT → max-width (a component's outer
 *               dimension is fluid-up-to in code; the canvas renders the max),
 *               elsewhere → width.
 *
 *   ENUM SUBST  Where the same node path binds different tokens across an
 *               enum axis's variants and the paths differ in exactly ONE
 *               segment that equals the variant's canonical value, emit the
 *               substituted ref ({color.feedback.{variant}.background}).
 *               Identical bindings emit the literal ref. Differences that do
 *               NOT correlate with an axis are reported as drift — never
 *               guessed.
 *
 *   TEXT        A text node riding a named TextStyle carries its token
 *               identity ("badge" ← font.badge.size) → font-size ref; the
 *               style group's declared weight token → font-weight, emitted
 *               only when the style's Inter style ≠ 'Medium' (Medium is the
 *               runtime default — a weight token resolving to it is canvas-
 *               indistinguishable from no weight token, a declared fidelity
 *               limit). Style-less text matches (fontSize, fontStyle) against
 *               the derived-style definitions; a unique hit adopts that
 *               identity, anything else is reported. font-family is never
 *               recoverable (everything renders Inter — fidelity scope).
 *
 *   PROPS       Variant axes → enum props (canonical values = camelCase of
 *               the Figma values, default = the first variant's value — the
 *               generator emits the default combo first). A two-value axis
 *               proposes a boolean ONLY when its options are literally
 *               true/false (mirroring extract/reconcile.ts isBoolAxis); an
 *               Off/On axis stays a two-value enum — both states render
 *               truthfully on both surfaces — with a note that a code boolean
 *               is a compatible code-side binding. propRefs.characters →
 *               TEXT props (default = the bound node's characters).
 *
 *   SLOTS       A frame whose sole child is a Slot-utility instance bound to
 *               an INSTANCE_SWAP property is a slot part; the utility
 *               instance's own styling (stroke/padding/radius) is the
 *               utility's, and is elided. A "Show <Property>" visibility
 *               binding on the wrapper marks the part optional (and is NOT an
 *               API prop). preferredValues (dump v1.5 swapPreferredValues)
 *               resolve by component key into `accepts` (acceptsMode
 *               'prefer'); unresolvable keys stay a NAMED note — older dumps
 *               keep the "author accepts manually" note, never invented.
 *               Drawn design-time content becomes defaultContent: LINKED
 *               when the child resolves, else a geometry STUB (dump v1.5
 *               bbox). Native SLOT nodes (Schema 2025) map to the same slot
 *               part with a provenance note. The first non-optional slot in
 *               tree order is judged the default slot (name "children").
 *
 *   COMPOSITION A non-Slot INSTANCE child → anatomy `component` ref, id
 *               resolved by componentSetKey FIRST (dump v1.5 instanceSetKey/
 *               instanceKey against in-scope contracts' anchors — rename-
 *               safe), drawn name as the fallback; a name match whose keys
 *               CONTRADICT is refused by name (a foreign kit's "Button" must
 *               not link to ds.button). Its internals (the child component's
 *               own geometry/paints) belong to the child contract and are
 *               elided — but a child with NO contract in scope ships a STUB
 *               rendering the OBSERVED bounding box + primary paint (dump
 *               v1.5) as minted imported.stub-* tokens. Fixed prop values
 *               ride componentProperties; a value tracking a parent enum
 *               axis 1:1 threads as "{parentProp}". Absences stay declared
 *               limits, not guesses.
 *
 *   ARTIFACTS   Two generator artifacts are recognized and folded away:
 *               (1) the auto-injected `label` text node (a root with no parts
 *               but a children-bound text prop) — its text tokens hoist to
 *               the ROOT and the node itself is not a part; (2) the styled-
 *               static-text WRAPPER frame (an empty frame at the generator's
 *               wrap default row/center/center with fills/fixed size, e.g.
 *               Switch's thumb) — proposed as a leaf part with tokens only,
 *               the wrap-default layout elided.
 *
 *   SPACERS     An empty, paint-less, binding-less fill-width frame is a
 *               spacer (a grow part). Spacers present in only a subset of
 *               variants — presence correlated with a single axis value —
 *               reconstruct their visibleWhen ({ prop, equals }); that is how
 *               Switch's structural thumb alignment survives the round trip.
 *
 *   UNBOUND     A raw (variable-less) paint or nonzero literal dimension on a
 *               non-utility node NEVER becomes a token. It is a named entry
 *               in the proposal report: node path, property, raw value, and
 *               nearest-token candidates computed from tokens/*.tokens.json
 *               by value match. The proposal stays schema-valid without it.
 *
 * Every proposal is validated against ContractSchema before it is written.
 */
import type { MinimalChildContract } from '../../core/propose-figma.js';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DumpFile } from './types.js';
import { isDumpSet } from './types.js';
import { loadTokenCorpus } from './tokens.js';
import { componentIdSlug, dumpCapturesHidden, figmaProposalsReport, proposeFromDump, type FigmaProposalResult } from '../../core/propose-figma.js';

// The inversion engine itself is the pure core module — re-exported here so
// existing importers (extract/figma/roundtrip.ts) keep their import path.
export {
  camel,
  figmaProposalsReport,
  mergeOrders,
  proposeFromDump,
  type FigmaProposalResult,
  type UnboundValue,
} from '../../core/propose-figma.js';

// ---------------------------------------------------------------------------
// Corpus helpers + report
// ---------------------------------------------------------------------------

export function loadContractIdsByName(dir: string): Map<string, string> {
  return loadContracts(dir).byName;
}

/** Name→id map plus the contracts themselves (for fixed-prop canonicalization). */
export function loadContracts(dir: string): {
  byName: Map<string, string>;
  byId: Map<string, MinimalChildContract>;
  /** componentSetKey → id (dump v1.5 session linking — key checked FIRST). */
  byKey: Map<string, string>;
} {
  const out = new Map<string, string>();
  const contractsById = new Map<string, MinimalChildContract>();
  const byKey = new Map<string, string>();
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.contract.json'));
  } catch {
    return { byName: out, byId: contractsById, byKey };
  }
  for (const f of files) {
    try {
      const c = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as {
        id?: string;
        name?: string;
        anchors?: { figma?: { componentSetKey?: string | null } };
      };
      if (c.id && c.name) {
        out.set(c.name, c.id);
        contractsById.set(c.id, c as unknown as MinimalChildContract);
        const key = c.anchors?.figma?.componentSetKey;
        if (key) byKey.set(key, c.id);
      }
    } catch {
      /* not a contract — skip */
    }
  }
  return { byName: out, byId: contractsById, byKey };
}


// ---------------------------------------------------------------------------
// CLI: npm run extract:figma -- <dump.json> [--out dir] [--contracts dir]
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const readFlag = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const outDir = readFlag('--out') ?? path.join('extract', 'out', 'figma');
  const contractsDir = readFlag('--contracts') ?? 'contracts';
  const dumpPathArg = args[0];
  if (!dumpPathArg) {
    console.error('Usage: npm run extract:figma -- <dump.json> [--out dir] [--contracts dir]');
    process.exit(2);
  }
  const root = process.cwd();
  const dump = JSON.parse(readFileSync(path.resolve(root, dumpPathArg), 'utf8')) as DumpFile;
  const corpus = loadTokenCorpus(root);
  const loaded = loadContracts(path.resolve(root, contractsDir));
  const contractIdByName = loaded.byName;
  const fileKey = dump._provenance?.fileKey ?? null;

  const results: Array<{ setName: string; proposal: FigmaProposalResult }> = [];
  mkdirSync(path.resolve(root, outDir), { recursive: true });
  for (const [name, value] of Object.entries(dump)) {
    if (name === '_provenance' || !isDumpSet(value)) continue;
    const proposal = proposeFromDump(value, {
      corpus,
      contractIdByName,
      contractsById: loaded.byId,
      contractIdByKey: loaded.byKey,
      fileKey,
      hiddenCaptured: dumpCapturesHidden(dump._provenance),
    });
    results.push({ setName: name, proposal });
    // componentIdSlug, not raw kebab: a set name like "Button / Primary /
    // Medium" must not turn the output filename into a directory walk.
    const file = path.resolve(root, outDir, `${componentIdSlug(name)}.contract.proposed.json`);
    writeFileSync(file, JSON.stringify(proposal.contract, null, 2) + '\n');
    console.log(`✔ ${name} → ${path.relative(root, file)} (${proposal.notes.length} notes, ${proposal.unbound.length} unbound value(s))`);
  }
  writeFileSync(path.resolve(root, outDir, 'figma-proposals.md'), figmaProposalsReport(results) + '\n');
  console.log(`✔ report → ${path.join(outDir, 'figma-proposals.md')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
