/**
 * CANVAS BINDING GATE — `npm run canvas:binding:check`.
 *
 * WHY THIS EXISTS, precisely. docs/12-roadmap.md PHASE 1 exits when "the
 * differ (not a human with a screenshot) catches a hand-made change to a
 * part's layout inside one variant", and the fingerprint it names covers
 * "part tree, layout, AND bindings". Measured before this gate was written:
 * two of the three were covered. `grep -c boundVariables
 * core/canvas-fingerprint.ts` scored 0, and the offline probe was
 * unambiguous — DETACHING a variable from paddingLeft while typing back the
 * identical literal (2) recomputed the IDENTICAL v5 hash with ZERO diff
 * lines. The designer changed what the file MEANS (the padding no longer
 * follows space/inset-y/xs) and the differ said "in-sync".
 *
 * The one binding v5 did see was unusable: the fill line was a bare
 * JSON.stringify of the paint stack, so the run-scoped alias id
 * ("id":"VariableID:279:280") went into the hash verbatim. That is fine for
 * Check Drift (stamp vs recompute inside ONE file) and worthless for
 * contract-vs-canvas or file-A-vs-file-B, because a duplicated or
 * re-imported file mints new ids for the same variables.
 *
 * THE SIX PINS BELOW ARE THE FALSIFIERS, not a description:
 *
 *   P1 bindings are captured at all       — RED if the bound: channel is dropped
 *   P2 THE DETACH (the missed edit)       — RED if a detach stops being caught
 *   P3 no raw VariableID anywhere         — RED if the resolver leaks ids
 *   P4 names resolve, none are (unresolved) — RED on a silent resolver downgrade
 *   P5 rebinding at an UNCHANGED value    — RED if the hash tracks the value, not the NAME
 *   P6 recompute over an untouched tree   — RED on NONDETERMINISM only.
 *       Stated precisely because the first draft of this comment overclaimed:
 *       P6 compares fp(node) against the stamp computed from the SAME source
 *       over the SAME node in the SAME process, so it is f(x) === f(x). It can
 *       catch a Date.now() or a counter leaking into the hash; it CANNOT catch
 *       run-scoped CONTENT, because a captured VariableID is byte-identical in
 *       both computations. P3 is the pin that catches that, and P3 alone.
 *
 * P3 and P5 are the over-application guards. Capturing the binding by ID
 * would satisfy P1 and P2 and still fail P3; hashing only the resolved
 * VALUE would satisfy P1, P2 and P3 and still fail P5.
 *
 * The path is the proven offline one — buildEngineBundle (in-memory, the zip
 * is never written) → createFigmaMock → planGenerate over a COMMITTED
 * contract. No Figma, no network.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildEngineBundle } from '../scripts/build-plugin-zip.mjs';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import { FINGERPRINT_SRC, FINGERPRINT_VERSION } from './canvas-fingerprint.js';

const CONTRACT = 'contracts/badge.contract.json';

const fail = (msg: string): never => {
  console.error(`\n✖ canvas-binding-check: ${msg}\n`);
  process.exit(1);
};
const assert = (cond: unknown, what: string): void => {
  if (!cond) fail(`pin failed: ${what}`);
};

// The snapshot/fingerprint under test, evaluated FRESH from the canonical
// module — the same lockstep discipline plugin-engine-check uses.
const evalFp = (src: string) =>
  new Function(`${src}; return { snap: dsCanvasSnapshot, fp: dsCanvasFingerprint, load: dsLoadVarNames, setNames: dsSetVarNames };`)() as {
    snap: (n: unknown) => string[];
    fp: (n: unknown) => string;
    load: () => Promise<Record<string, string>>;
    setNames: (m: Record<string, string>) => Record<string, string>;
  };

const bundle = await buildEngineBundle();
const { figma, root } = createFigmaMock();
const sandbox: Record<string, unknown> = { window: {}, console: { log() {}, warn() {}, error() {} } };
vm.createContext(sandbox);
vm.runInContext(bundle.code, sandbox, { timeout: 120_000 });
const DSC = (sandbox.window as { DSC: any }).DSC;
assert(DSC && typeof DSC.planGenerate === 'function', 'window.DSC exposes the engine API');

const scriptContext = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
const runScript = (code: string) =>
  vm.runInContext(`(async () => {\n${code}\n})()`, scriptContext, { timeout: 120_000 });

const parsed = DSC.parseIncomingText(readFileSync(CONTRACT, 'utf8'));
assert(parsed.ok && parsed.kind === 'contract', `${CONTRACT} parses as a single contract document`);
const plan = DSC.planGenerate(parsed.contracts, { withTokens: true, fileKey: '' });
assert(plan.ok, `${CONTRACT} generate plan is accepted`);
for (const step of plan.steps) await runScript(step.code);

const sets = root.findAll(
  (n: any) => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId'),
);
assert(sets.length > 0, 'a generated COMPONENT_SET exists in the mock file');
const set = sets[0];
const variant = (set.children ?? [])[0];
assert(variant, 'the set has at least one variant');

// The gate resolves names through the SAME async prologue the emitted script
// and the plugin's check-drift handler use.
const fpApi = evalFp(FINGERPRINT_SRC);
const nameMap = await (async () => {
  const all = await figma.variables.getLocalVariablesAsync();
  const m: Record<string, string> = {};
  for (const v of all) m[v.id] = v.name;
  return fpApi.setNames(m);
})();
assert(Object.keys(nameMap).length > 0, 'the mock file carries local variables to resolve against');

const storedStamp = variant.getSharedPluginData('ds_contracts', 'canvasFingerprint');
const storedSnap: string[] = JSON.parse(variant.getSharedPluginData('ds_contracts', 'canvasSnapshot') || '[]');
assert(storedSnap.length > 0, 'the variant carries a stored snapshot');
assert(
  storedStamp.startsWith(FINGERPRINT_VERSION),
  `the stamp carries the ${FINGERPRINT_VERSION} prefix (got ${JSON.stringify(storedStamp)})`,
);

// ── P1: bindings are captured at all ───────────────────────────────────────
const boundLines = storedSnap.filter((l) => l.includes('|bound:'));
assert(
  boundLines.length > 0,
  'P1 the snapshot carries at least one |bound:<field>| line — the roadmap names "part tree, layout, AND bindings" and v5 carried none',
);
const wellFormed = boundLines.filter((l) => /\|bound:[A-Za-z]+\|[^|]+$/.test(l));
assert(
  wellFormed.length === boundLines.length,
  `P1 every bound line is one channel PER FIELD (id|bound:<field>|<name>) so the drift reporter can pair each independently — malformed: ${boundLines.filter((l) => !wellFormed.includes(l)).join(' , ')}`,
);

// ── P3: no raw VariableID survives anywhere ────────────────────────────────
// This is the property that made v5's one binding useless across files.
const leaks = storedSnap.filter((l) => l.includes('VariableID:'));
assert(
  leaks.length === 0,
  `P3 no snapshot line leaks a run-scoped alias id — a duplicated or re-imported file mints new ids, so an id-bearing line can never compare across files (${leaks.length} leaking: ${leaks.slice(0, 2).join(' , ')})`,
);
const fillLines = storedSnap.filter((l) => l.includes('|fill|'));
assert(fillLines.length > 0, 'P3 the variant carries at least one fill line to inspect');
const boundFills = fillLines.filter((l) => l.includes('boundVariables'));
assert(
  boundFills.length > 0 && boundFills.every((l) => l.includes('"var":')),
  `P3 a paint binding spells its variable as {"var":"slash/name"} — the same shape extract/figma/dump.plugin.js emits (got ${JSON.stringify(boundFills[0] ?? '(none)').slice(0, 200)})`,
);

// ── P4: names actually resolved (no silent downgrade) ──────────────────────
const unresolved = storedSnap.filter((l) => l.includes('(unresolved)'));
assert(
  unresolved.length === 0,
  `P4 every binding on a freshly generated set resolves to a NAME — "(unresolved)" here means the id→name map was not filled from the async prologue (${unresolved.length}: ${unresolved.slice(0, 2).join(' , ')})`,
);
const slashy = boundLines.filter((l) => l.split('|').pop()!.includes('/'));
assert(
  slashy.length === boundLines.length,
  `P4 bound names are SLASH-FORM (dump.plugin.js spelling), e.g. space/inset-x/sm — non-slash: ${boundLines.filter((l) => !slashy.includes(l)).join(' , ')}`,
);

// ── P6: recompute over the untouched tree matches the stamp ────────────────
assert(
  fpApi.fp(variant) === storedStamp,
  `P6 recomputing over the UNTOUCHED tree reproduces the stamp — anything run-scoped in the line would break this (stamp ${storedStamp}, fresh ${fpApi.fp(variant)})`,
);

// ── P2: THE DETACH — the edit v5 missed entirely ───────────────────────────
// A designer unbinds paddingLeft from its token and types back the SAME
// literal. Geometry is byte-identical; the meaning is not.
const target = (() => {
  const walk = (n: any): any => {
    const bv = n.boundVariables ?? {};
    for (const f of Object.keys(bv)) {
      const al = bv[f];
      if (al && !Array.isArray(al) && al.id) return { node: n, field: f, alias: al };
    }
    for (const k of n.children ?? []) {
      const hit = walk(k);
      if (hit) return hit;
    }
    return null;
  };
  return walk(variant);
})();
assert(target, 'P2 a node in the variant carries a direct (non-array) variable binding to detach');
const { node: victim, field, alias } = target;
const litBefore = victim[field];
const detachName = nameMap[alias.id];
assert(detachName, `P2 the bound variable resolves to a name (id ${alias.id})`);

delete victim.boundVariables[field];
victim[field] = litBefore; // the designer typed the same number back
const fpDetached = fpApi.fp(variant);
assert(
  victim[field] === litBefore,
  'P2 the detach probe left the literal value untouched — otherwise it would be caught as a geometry edit, not a binding edit',
);
assert(
  fpDetached !== storedStamp,
  `P2 DETACHING ${field} from ${detachName} (literal still ${String(litBefore)}) CHANGES the fingerprint — this is the exact edit v5 recomputed as UNCHANGED, with zero diff lines`,
);
const snapDetached = fpApi.snap(variant);
const goneLines = storedSnap.filter((l) => !snapDetached.includes(l));
assert(
  goneLines.some((l) => l.includes(`|bound:${field}|${detachName}`)),
  `P2 the diff NAMES the lost binding (expected a removed "|bound:${field}|${detachName}" line, got: ${goneLines.slice(0, 3).join(' , ') || '(no removed lines at all)'})`,
);
// restore
victim.boundVariables[field] = alias;
victim[field] = litBefore;
assert(fpApi.fp(variant) === storedStamp, 'P2 re-attaching restores the match (the probe is reversible)');

// ── P5: rebinding at an UNCHANGED value must be caught ─────────────────────
// The over-application guard: a fingerprint that hashes the resolved VALUE
// rather than the NAME passes P1–P3 and still misses this.
const otherId = Object.keys(nameMap).find((id) => id !== alias.id && nameMap[id] !== detachName);
assert(otherId, 'P5 a second, differently-named variable exists in the mock file');
victim.boundVariables[field] = { type: 'VARIABLE_ALIAS', id: otherId };
victim[field] = litBefore; // value deliberately identical — only the NAME moved
const fpRebound = fpApi.fp(variant);
assert(
  fpRebound !== storedStamp,
  `P5 REBINDING ${field} from ${detachName} to ${nameMap[otherId!]} at an IDENTICAL literal (${String(litBefore)}) changes the fingerprint — the line must track the variable's NAME, not the value it happens to resolve to`,
);
const snapRebound = fpApi.snap(variant);
assert(
  snapRebound.some((l) => l.includes(`|bound:${field}|${nameMap[otherId!]}`)),
  `P5 the new binding is named in the snapshot (|bound:${field}|${nameMap[otherId!]})`,
);
assert(
  !snapRebound.some((l) => l.includes('VariableID:')),
  'P5 the rebound line still carries no raw id',
);
victim.boundVariables[field] = alias;
victim[field] = litBefore;

console.log(
  `  ${CONTRACT} → ${set.name} / ${variant.name}: ${storedSnap.length} snapshot lines, ${boundLines.length} bound: channels, 0 id leaks`,
);
console.log(`  P1 bindings captured           ${boundLines.length} |bound:<field>| lines, all per-field channels`);
console.log(`  P2 detach caught               ${field} ⊣ ${detachName} (literal ${String(litBefore)} unchanged) → ${storedStamp} ≠ ${fpDetached}`);
console.log(`  P3 no raw VariableID           paint bindings spell {"var":"…"} like dump.plugin.js`);
console.log(`  P4 names resolved, slash-form  0 "(unresolved)"`);
console.log(`  P5 rebind-at-same-value caught ${field}: ${detachName} → ${nameMap[otherId!]} → ${fpRebound}`);
console.log(`  P6 untouched recompute matches ${storedStamp}`);
console.log(
  `\n✔ canvas-binding-check: the ${FINGERPRINT_VERSION} fingerprint carries BINDINGS BY NAME — a detach at an unchanged literal and a rebind at an unchanged value are both caught, and no run-scoped alias id reaches the line`,
);
