/**
 * native-slots eval body — the canvas half of Figma's native SLOT property.
 *
 * SPEC: docs/research/native-slots-proposal.md, pinned against the live
 * receipts in docs/research/slots-recon-probes.md. Everything below runs
 * headlessly through scripts/plugin-engine-mock-figma.mjs, whose slot model is
 * built from those same probes plus a live re-measurement on 2026-08-08
 * (createSlot is ComponentNode-only; a slot layer rename renames its property;
 * same-named slot properties MERGE into one new id on combineAsVariants while a
 * post-combine createSlot mints a DUPLICATE; GRID inside a slot throws verbatim;
 * setProperties refuses a SLOT key; and instance slot content is stored AGAINST
 * THE PROPERTY ID).
 *
 * WHAT THIS PINS:
 *   1. NATIVE EMISSION — a contract slot becomes a real SLOT node bound to a
 *      SLOT property named for `slot.bindings.figma.property`, with `accepts` on
 *      preferredValues; NO dashed "Slot" utility component or instance exists
 *      anywhere in the file.
 *   2. UNIFICATION — a multi-variant set ends with exactly ONE set-level SLOT
 *      property, shared by every variant's slot node. On the CREATE path
 *      Figma does the merge itself (measured live: two pre-combine ids became
 *      one new id, both nodes re-pointed); the duplicate-property trap is
 *      real on the AMEND path, where createSlot on an already-combined
 *      variant mints a second set-level property under the same name (probe
 *      2c, re-confirmed live). §2 is where that trap is actually sprung.
 *   3. AMEND SURVIVAL — THE HEADLINE INVARIANT. A designer's fill inside an
 *      instance's slot survives an amend that rebuilds the whole interior,
 *      because the rebuilt slot is rebound to the PRESERVED property id. This
 *      is RED-TESTED: the same run with the rebind patched out must LOSE the
 *      fill, or the pin proves nothing.
 *   4. REFUSALS BY NAME — GRID inside a slot, slot-in-slot, two slots sharing
 *      one Figma property, an unowned slot, and the constraints the API cannot
 *      express (`min`/`max`/`required`/`acceptsMode: "restrict"`) carried as
 *      words in the SLOT description.
 *   5. MIGRATION — a set carrying the pre-native INSTANCE_SWAP spelling
 *      migrates inside a normal amend, and the instance that OVERRODE the swap
 *      is reported BY NAME (never silently dropped).
 *   6. READBACK — the dump reads the emitted slot (type, property id,
 *      preferredValues, description) and propose inverts it to a slot part.
 *   7. RC5 DESIGN-TIME CONTENT (§10/§11) — the two design-time surfaces agree.
 *      A Figma main component's slot content and a generated Storybook meta's
 *      canonical args are the same object, so an empty default `children` slot
 *      draws the SAME sample the story shows, the inverse path drops ONLY the
 *      emitter's own sample (three designer edits must come back NAMED), and a
 *      NAMED empty slot is a receipt, not a silent sliver — with §11 measuring
 *      the shells that stay empty against their own CSS render, so "just
 *      enforce a minimum box" stays refuted by numbers rather than by prose.
 *
 * Exits non-zero with a named failure on any violated expectation.
 */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ContractSchema,
  DEFAULT_SLOT_SAMPLE,
  SLOT_SAMPLE_LAYER,
  type Contract,
} from '../../scripts/contract-schema.js';
import { generateStories } from '../../core/emit-react.js';
import { emitFigmaScript } from '../../core/emit-figma-script.js';
import { createFigmaMock } from '../../scripts/plugin-engine-mock-figma.mjs';
import { proposeFromDump } from '../../core/propose-figma.js';

const fail = (msg: string): never => {
  console.error(`✘ native-slots: ${msg}`);
  process.exit(1);
};
const ok = (msg: string) => console.log(`  ✔ ${msg}`);

const TOKENS = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };

// --- the fixture contracts --------------------------------------------------
const leaf = (): Contract =>
  ContractSchema.parse({
    id: 'ds.eval-slot-leaf',
    name: 'EvalSlotLeaf',
    version: '0.1.0',
    status: 'draft',
    description: 'accepts target for the native-slots fixture',
    semantics: { element: 'span' },
    props: [],
    states: [],
    anatomy: { root: {} },
    bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: 'x', export: 'EvalSlotLeaf' } } },
  }) as Contract;

/** A CHILDLESS ROOT with a variant axis — the MUI Divider shape. No parts, so
 *  every variant COMPONENT is itself the childless node that keeps the birth
 *  box. This is the shape the slot fixture below cannot express. */
const childlessRoot = (opts: { version?: string } = {}): Contract =>
  ContractSchema.parse({
    id: 'ds.eval-childless-root',
    name: 'EvalChildlessRoot',
    version: opts.version ?? '0.1.0',
    status: 'draft',
    description: 'childless-root fixture (divider shape)',
    semantics: { element: 'hr' },
    props: [
      {
        name: 'variant',
        description: 'Inset scale.',
        type: { enum: ['fullWidth', 'inset'] },
        default: 'fullWidth',
        bindings: {
          figma: { kind: 'VARIANT', property: 'Variant', values: { fullWidth: 'FullWidth', inset: 'Inset' } },
          code: { prop: 'variant' },
        },
      },
    ],
    states: [],
    anatomy: { root: { declared: { display: 'block', 'border-bottom-style': 'solid' } } },
    bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: 'x', export: 'EvalChildlessRoot' } } },
  }) as Contract;

/** Two variants (Size=Sm/Lg) so the unification trap is live, plus one slot. */
const host = (opts: { version?: string; slot?: Record<string, unknown>; partExtras?: Record<string, unknown> } = {}): Contract =>
  ContractSchema.parse({
    id: 'ds.eval-slot-host',
    name: 'EvalSlotHost',
    version: opts.version ?? '0.1.0',
    status: 'draft',
    description: 'native-slots fixture host',
    semantics: { element: 'div' },
    props: [
      {
        name: 'size',
        description: 'Density.',
        type: { enum: ['sm', 'lg'] },
        default: 'sm',
        bindings: { figma: { kind: 'VARIANT', property: 'Size', values: { sm: 'Sm', lg: 'Lg' } }, code: { prop: 'size' } },
      },
    ],
    states: [],
    anatomy: {
      root: {
        parts: {
          body: {
            ...(opts.partExtras ?? {}),
            slot: opts.slot ?? { name: 'body', accepts: ['ds.eval-slot-leaf'], acceptsMode: 'prefer' },
          },
        },
      },
    },
    bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: 'x', export: 'EvalSlotHost' } } },
  }) as Contract;

const emit = (c: Contract): string => {
  const byId = new Map<string, Contract>([[leaf().id, leaf()], [c.id, c]]);
  return emitFigmaScript(c, { tokens: TOKENS, icons: new Map(), contracts: byId } as never);
};

type Mock = ReturnType<typeof createFigmaMock>;
const runIn = async (mock: Mock, script: string): Promise<void> => {
  const ctx = vm.createContext({ figma: mock.figma, console: { log() {}, warn() {}, error() {} } });
  await vm.runInContext(`(async () => {\n${script}\n})()`, ctx, { timeout: 120_000 });
};
/** The script's own return value (results/report), for the report pins. */
const runFor = async (mock: Mock, script: string): Promise<Record<string, unknown>> => {
  const ctx = vm.createContext({ figma: mock.figma, console: { log() {}, warn() {}, error() {} } });
  return (await vm.runInContext(`(async () => {\n${script}\n})()`, ctx, { timeout: 120_000 })) as Record<string, unknown>;
};

const findAll = (mock: Mock, pred: (n: any) => boolean): any[] => mock.root.findAll(pred);
const theSet = (mock: Mock) => findAll(mock, (n) => n.type === 'COMPONENT_SET' && n.name === 'EvalSlotHost')[0];
const slotDefs = (node: any): Array<[string, any]> =>
  Object.entries(node.componentPropertyDefinitions as Record<string, any>).filter(([, d]) => d.type === 'SLOT');

/** A fresh file with the leaf synced (the accepts target must resolve). */
const freshFile = async (hostContract: Contract): Promise<Mock> => {
  const mock = createFigmaMock();
  await runIn(mock, emit(leaf()));
  await runIn(mock, emit(hostContract));
  return mock;
};

console.log('\n1. NATIVE EMISSION — a SlotNode, not a dashed placeholder');
const first = await freshFile(host());
{
  const set = theSet(first);
  if (!set) fail('no EvalSlotHost component set built');
  const slots = findAll(first, (n) => n.type === 'SLOT');
  if (slots.length !== 2) fail(`expected one SLOT node per variant (2), got ${slots.length}`);
  if (slots.some((s) => s.name !== 'Body')) {
    fail(`slot layers must be named for the SLOT property (Body): ${slots.map((s) => s.name).join(', ')}`);
  }
  ok('each variant carries a native SLOT node named for the contract slot property');

  const defs = slotDefs(set);
  if (defs.length !== 1) fail(`UNIFICATION FAILED: expected ONE set-level SLOT property, got ${defs.length} (${defs.map(([k]) => k).join(', ')})`);
  const [key, def] = defs[0];
  if (key.split('#')[0] !== 'Body') fail(`SLOT property display name is "${key.split('#')[0]}", expected "Body"`);
  for (const s of slots) {
    if (s.componentPropertyReferences.slotContentId !== key) {
      fail(`a variant's slot node points at ${s.componentPropertyReferences.slotContentId}, not the shared ${key}`);
    }
  }
  ok(`both variants' slot nodes share ONE set-level property (${key}) — one slot, one property, whatever the variant count`);

  const leafSet = findAll(first, (n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.name === 'EvalSlotLeaf')[0];
  if (!def.preferredValues?.some((v: any) => v.key === leafSet.key)) {
    fail(`accepts did not reach preferredValues: ${JSON.stringify(def.preferredValues)}`);
  }
  ok('accepts resolved onto the SLOT property preferredValues (soft — Figma refuses nothing)');

  if (findAll(first, (n) => n.name === 'Slot').length > 0) fail('a "Slot" utility node was minted — the dashed placeholder must be gone');
  if (findAll(first, (n) => Array.isArray(n.dashPattern) && n.dashPattern.length > 0).length > 0) fail('dashed chrome was drawn on the canvas');
  ok('no dashed "Slot" utility component, instance, or dash pattern exists anywhere in the file');

  const slot = slots[0];
  if ((slot.fills ?? []).length !== 0) fail(`an empty slot must render with the contract's styling, not createSlot's default white fill: ${JSON.stringify(slot.fills)}`);
  ok("an empty slot carries the contract's own styling — zero chrome (the structural G4 convention)");
}

console.log('\n2. AMEND SURVIVAL — a designer fill rides the PROPERTY ID');
/** Build a file, fill the slot on an instance, amend, and report what a
 *  designer would then see. `patch` lets the red test break the rebind. */
const amendSurvival = async (patch?: (script: string) => string): Promise<{ children: string[]; keyBefore: string; keyAfter: string }> => {
  const mock = await freshFile(host());
  const set = theSet(mock);
  const keyBefore = slotDefs(set)[0][0];

  const inst = set.children[0].createInstance();
  mock.firstPage.appendChild(inst);
  const islot = [inst, ...inst.findAll()].find((n: any) => n.type === 'SLOT');
  if (!islot) fail('the instance carries no slot node to fill');
  const fill = mock.figma.createText();
  fill.name = 'DESIGNER FILL';
  islot.appendChild(fill);

  // The amend: a version bump is a real spec change (the compiled component
  // description carries the version), so amendSet removes every child and
  // rebuilds the interior — exactly the collision probe 2d reproduced. The
  // report is checked below: a run that SKIPPED as "unchanged" would prove
  // nothing at all.
  const amended = emit(host({ version: '0.2.0' }));
  const report = await runFor(mock, patch ? patch(amended) : amended);
  const row = (report.results as any[]).find((r) => r.contractId === 'ds.eval-slot-host');
  if (row?.skipped) fail(`the amend SKIPPED ("${row.reason}") — this pin would have proven nothing`);
  if (!(row?.rebuiltVariants > 0)) fail(`the amend rebuilt no variant interiors: ${JSON.stringify(row)}`);

  const set2 = theSet(mock);
  const defsAfter = slotDefs(set2);
  if (defsAfter.length !== 1) fail(`after amend the set carries ${defsAfter.length} SLOT properties, expected exactly 1`);
  inst._refreshFromMain();
  const islot2 = [inst, ...inst.findAll()].find((n: any) => n.type === 'SLOT');
  return {
    children: (islot2?.children ?? []).map((c: any) => c.name),
    keyBefore,
    keyAfter: defsAfter[0][0],
    // What the REBUILT slot node itself ended up bound to — the direct
    // evidence of whether the rebind ran.
    rebuiltRef: [set2.children[0], ...set2.children[0].findAll()].find((n: any) => n.type === 'SLOT')
      ?.componentPropertyReferences?.slotContentId ?? null,
  };
};
{
  const green = await amendSurvival();
  if (green.keyAfter !== green.keyBefore) {
    fail(`amend did not PRESERVE the slot property id: ${green.keyBefore} → ${green.keyAfter} (every instance fill keyed to the old id orphans)`);
  }
  if (!green.children.includes('DESIGNER FILL')) {
    fail(`the designer's slot fill did NOT survive the amend (slot children: ${JSON.stringify(green.children)})`);
  }
  ok(`the interior was rebuilt, the property id was preserved (${green.keyAfter}), and the designer's fill came back verbatim`);

  // RED TEST: without the rebind, the rebuilt slot rides a FRESH id and the
  // fill orphans. If this still passes, the assertion above proves nothing.
  const REBIND = "sl.slot.componentPropertyReferences = { slotContentId: existingKey };";
  const red = await amendSurvival((script) => {
    if (!script.includes(REBIND)) fail('the red test could not find the rebind line — the invariant moved and this pin went blind');
    return script.split(REBIND).join('/* rebind removed by the red test */');
  });
  if (red.rebuiltRef === red.keyBefore) {
    fail('RED TEST INERT: without the rebind the rebuilt slot still landed on the preserved id — the trap this eval exists for did not spring');
  }
  if (red.children.includes('DESIGNER FILL')) {
    fail('RED TEST FAILED: the fill survived even WITHOUT the rebind — this eval cannot detect the defect it exists for');
  }
  ok(`red test: without the rebind the rebuilt slot rode a FRESH property (${red.rebuiltRef} ≠ ${red.keyBefore}) and the fill is lost (slot children: ${JSON.stringify(red.children)}) — the pin has teeth`);
}

console.log('\n3. MIGRATION — the pre-native INSTANCE_SWAP spelling retires, loudly');
{
  const mock = await freshFile(host());
  const set = theSet(mock);
  const leafSet = findAll(mock, (n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.name === 'EvalSlotLeaf')[0];
  const leafMain = leafSet.type === 'COMPONENT_SET' ? leafSet.children[0] : leafSet;

  // Rewind this set to the OLD convention: delete the native property and mint
  // the INSTANCE_SWAP one an older emitter would have left, plus a dashed
  // "Slot" utility and an instance that OVERRODE the swap (a designer's
  // choice, which is exactly what must not vanish quietly).
  const nativeKey = slotDefs(set)[0][0];
  for (const s of findAll(mock, (n: any) => n.type === 'SLOT')) s.remove();
  set.deleteComponentProperty(nativeKey);
  const util = mock.figma.createComponent();
  util.name = 'Slot';
  mock.firstPage.appendChild(util);
  const legacyKey = set.addComponentProperty('Body', 'INSTANCE_SWAP', util.id, {
    preferredValues: [{ type: 'COMPONENT_SET', key: leafSet.key }],
  });
  set.setSharedPluginData('ds_contracts', 'specHash', 'stale');
  const consumer = set.children[0].createInstance();
  consumer.name = 'PreNativeConsumer';
  mock.firstPage.appendChild(consumer);
  consumer.setProperties({ [legacyKey]: leafMain.id });

  const report = await runFor(mock, emit(host({ version: '0.2.0' })));
  const row = (report.results as any[]).find((r) => r.contractId === 'ds.eval-slot-host');
  if (!row?.migratedSlots?.includes('Body')) fail(`the INSTANCE_SWAP → SLOT migration was not reported: ${JSON.stringify(row)}`);
  const set2 = theSet(mock);
  if (Object.keys(set2.componentPropertyDefinitions).some((k) => k.split('#')[0] === 'Body' && set2.componentPropertyDefinitions[k].type === 'INSTANCE_SWAP')) {
    fail('the legacy INSTANCE_SWAP property survived the migration');
  }
  if (slotDefs(set2).length !== 1) fail('migration did not leave exactly one native SLOT property');
  ok(`migration ran inside a normal amend and reported it (migratedSlots: ${JSON.stringify(row.migratedSlots)})`);

  const stranded = (row.strandedSwapOverrides ?? []) as string[];
  if (!stranded.some((s) => s.includes('PreNativeConsumer'))) {
    fail(`the designer's swap override was dropped WITHOUT being named: ${JSON.stringify(stranded)}`);
  }
  ok(`the stranded swap override is reported BY NAME (${stranded.join('; ')})`);

  const utility = (report as any).slotUtility;
  if (!utility?.retired) fail(`the "Slot" utility was not retired once nothing pointed at it: ${JSON.stringify(utility)}`);
  if (findAll(mock, (n) => n.type === 'COMPONENT' && n.name === 'Slot').length > 0) fail('the "Slot" utility component is still in the file');
  ok('the dashed "Slot" utility was deleted LAST, only after no INSTANCE_SWAP slot reference remained');
}

console.log('\n4. REFUSALS BY NAME — what the API cannot express');
const refuses = (label: string, build: () => Contract, needle: string) => {
  let message = '';
  try {
    emit(build());
  } catch (e) {
    message = (e as Error).message;
  }
  if (!message) fail(`${label}: emission SUCCEEDED — the refusal is missing`);
  if (!message.includes(needle)) fail(`${label}: refused, but not by name — expected "${needle}" in:\n${message}`);
  ok(`${label} refused by name`);
};
refuses(
  'GRID layout inside a slot',
  () => host({ partExtras: { layout: { display: 'grid', rows: [{ fr: 1 }], columns: [{ fr: 1 }, { fr: 1 }] } } }),
  'GRID layoutMode cannot be applied to Slot frames',
);
refuses(
  'slot-in-slot',
  () =>
    ContractSchema.parse({
      ...JSON.parse(JSON.stringify(host())),
      anatomy: {
        root: {
          parts: {
            body: {
              slot: { name: 'body' },
              parts: { inner: { slot: { name: 'inner' } } },
            },
          },
        },
      },
    }) as Contract,
  'slot-in-slot is out of contract',
);
refuses(
  'two slots sharing one Figma property',
  () =>
    ContractSchema.parse({
      ...JSON.parse(JSON.stringify(host())),
      anatomy: {
        root: {
          parts: {
            body: { slot: { name: 'body', bindings: { figma: { property: 'Content' } } } },
            footer: { slot: { name: 'footer', bindings: { figma: { property: 'Content' } } } },
          },
        },
      },
    }) as Contract,
  'one SLOT property cannot serve two areas',
);
{
  // The constraints Figma has no surface for are CARRIED, not refused — as
  // words on the property a designer actually reads.
  const described = async (slot: Record<string, unknown>, needle: string, label: string) => {
    const mock = await freshFile(host({ slot: { name: 'body', ...slot } }));
    const def = slotDefs(theSet(mock))[0][1];
    if (typeof def.description !== 'string' || !def.description.includes(needle)) {
      fail(`${label}: the SLOT description does not name the limit (${JSON.stringify(def.description)})`);
    }
    ok(`${label} named in the SLOT description: "${def.description}"`);
  };
  await described({ required: true }, 'REFUSED BY FIGMA: an empty slot is always legal', 'required');
  await described({ min: 1, max: 3 }, 'REFUSED BY FIGMA: a slot carries no count constraint', 'min/max');
  await described(
    { accepts: ['ds.eval-slot-leaf'], acceptsMode: 'restrict' },
    'acceptsMode "restrict" has no canvas enforcement',
    'acceptsMode restrict',
  );
}
{
  // The API's own refusals, as the live probes recorded them.
  const mock = await freshFile(host());
  const set = theSet(mock);
  const inst = set.children[0].createInstance();
  mock.firstPage.appendChild(inst);
  const key = slotDefs(set)[0][0];
  let threw = '';
  try {
    inst.setProperties({ [key]: 'anything' });
  } catch (e) {
    threw = (e as Error).message;
  }
  if (!threw.includes('Slot component property values cannot be edited')) {
    fail(`setProperties on a SLOT key must refuse verbatim, got: ${threw || '(no error)'}`);
  }
  ok('instance.setProperties refuses a SLOT key verbatim — slot content is children, never a value');

  let slotOnFrame = '';
  try {
    mock.figma.createFrame().createSlot();
  } catch (e) {
    slotOnFrame = (e as Error).message;
  }
  if (!slotOnFrame.includes('ComponentNode')) fail(`createSlot on a FRAME must refuse, got: ${slotOnFrame || '(no error)'}`);
  ok('createSlot is refused on a non-component (ComponentNode only)');
}

console.log('\n5. READBACK — the real dump reads it, propose inverts it');
{
  // The dump script EXACTLY as the plugin runs it: the ui.html #dump-source
  // block (drift-guarded against extract/figma/dump.plugin.js). Hand-writing a
  // dump here would be an alibi — it would prove what this file believes the
  // dump captures, not what it captures.
  const ui = readFileSync(path.join(process.cwd(), 'figma-sync/plugin/ui.html'), 'utf8');
  const openTag = '<script type="text/plain" id="dump-source">';
  const start = ui.indexOf(openTag);
  if (start < 0) fail('figma-sync/plugin/ui.html carries no #dump-source block');
  const scoped = ui
    .slice(start + openTag.length, ui.indexOf('</script>', start))
    .replace(/^\n/, '')
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify(['EvalSlotHost'])};`);
  const dump = (await runFor(first, scoped)) as any;
  const set = dump.EvalSlotHost;
  if (!set) fail('the dump did not capture the emitted set');

  const slotNode = (set.variants[0].children ?? []).find((c: any) => c.type === 'SLOT');
  if (!slotNode) fail(`the dump did not capture a SLOT node: ${JSON.stringify(set.variants[0]).slice(0, 400)}`);
  const propertyKey = slotDefs(theSet(first))[0][0];
  if (slotNode.slotKey !== propertyKey) fail(`dump v1.18 slotKey must carry the property id (${propertyKey}), got ${slotNode.slotKey}`);
  if (slotNode.propRefs?.slotContentId !== 'Body') fail(`propRefs does not carry the slot property display name: ${JSON.stringify(slotNode.propRefs)}`);
  if (!set.swapPreferredValues?.Body?.length) {
    fail(`accepts is INVISIBLE in the dump — SLOT preferredValues were not captured: ${JSON.stringify(set.swapPreferredValues)}`);
  }
  if (!set.propertyDefinitions || !Object.values(set.propertyDefinitions).some((d: any) => d.type === 'SLOT')) {
    fail('the dump captured no SLOT property definition');
  }
  ok(`the dump reads the emitted slot verbatim (type SLOT, slotKey ${slotNode.slotKey}, preferredValues ${JSON.stringify(set.swapPreferredValues.Body)})`);

  // …and the inversion returns a contract slot part carrying accepts.
  const leafId = leaf().id;
  const proposal = proposeFromDump(set, {
    corpus: { tokens: [], byValue: new Map(), byPath: new Map() } as never,
    contractIdByName: new Map([['EvalSlotLeaf', leafId]]),
    contractIdByKey: new Map([[findAll(first, (n) => n.name === 'EvalSlotLeaf' && (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'))[0].key, leafId]]),
  } as never) as { contract: Record<string, any>; notes?: string[] };
  const proposedParts = proposal.contract.anatomy.root.parts ?? {};
  const proposedSlot = Object.values(proposedParts).find((p: any) => p.slot) as any;
  if (!proposedSlot) fail(`propose did not invert the native slot into a slot part: ${JSON.stringify(proposedParts).slice(0, 400)}`);
  if (!(proposedSlot.slot.accepts ?? []).includes(leafId)) {
    fail(`propose lost the slot's accepts: ${JSON.stringify(proposedSlot.slot)}`);
  }
  if (!(proposal.notes ?? []).some((n) => n.includes('NATIVE Figma slot node'))) {
    fail('propose did not NAME the native-slot spelling in its notes');
  }
  ok(`propose inverts it back to a slot part with accepts ${JSON.stringify(proposedSlot.slot.accepts)} (acceptsMode "${proposedSlot.slot.acceptsMode}")`);
}

console.log("\n7. FC-SLOT-BIRTH-BOX — an empty slot measures its content, not createSlot's 100×100");
{
  // Measured live 2026-08-10 (DS Contracts Testing, Card 1:459 / Body 67:10995):
  // after the emitter set layoutMode + AUTO sizing, the slot REPORTED
  // layoutSizingVertical 'HUG' with zero children and 8+8 padding and still
  // measured 100 tall. The card shipped 320×142 against a 320×58 reference.
  // Re-asserting HUG is a no-op; only a FIXED resize round-trip re-measures.
  const mock = await freshFile(host());
  for (const variant of theSet(mock).children) {
    const slotNode = (variant.children ?? []).find((c: any) => c.type === 'SLOT');
    if (!slotNode) fail(`variant ${variant.name} carries no SLOT node to measure`);
    for (const [axis, size, mode] of [
      ['height', slotNode.height, slotNode.layoutSizingVertical],
      ['width', slotNode.width, slotNode.layoutSizingHorizontal],
    ] as Array<[string, number, string]>) {
      if (mode === 'HUG' && size === 100) {
        fail(
          `variant ${variant.name}: the slot reports ${axis} HUG and still measures 100 — ` +
            "createSlot's BIRTH BOX outlived the sizing writes (FC-SLOT-BIRTH-BOX). " +
            'The emitter must force the FIXED resize round-trip (remeasureBirthBox).',
        );
      }
    }
  }
  ok('an empty native slot hugs to its own content on both axes — no 100×100 birth box survives');

  // RED TEST — without the round-trip the birth box MUST survive. If this
  // still hugs, the mock is kinder than Figma and the pin above proves nothing
  // (which is exactly how the 320×142 card passed headlessly for two days).
  // ARGUMENT-AGNOSTIC ON PURPOSE. This used to match the call's exact argument
  // text, so adding a parameter to remeasureBirthBox silently stopped the
  // strip from matching — and a red test that strips nothing proves nothing.
  // The guard below caught it (it compares against the unstripped source), but
  // only because someone wrote that guard; match the CALL, not its arguments.
  const stripped = emit(host()).replace(/remeasureBirthBox\([^;]*\);/g, '');
  if (stripped === emit(host())) fail('the red test could not strip remeasureBirthBox — the pin below is vacuous');
  const red = createFigmaMock();
  await runIn(red, emit(leaf()));
  await runIn(red, stripped);
  const redSlot = (theSet(red).children[0].children ?? []).find((c: any) => c.type === 'SLOT');
  if (!redSlot || redSlot.height !== 100) {
    fail(
      `RED TEST DID NOT GO RED: with remeasureBirthBox stripped the slot measured ${redSlot?.height} — ` +
        'the mock is not modeling createSlot\'s 100×100 birth box, so §7 above is an alibi',
    );
  }
  ok(`red test: stripping remeasureBirthBox leaves the slot at ${redSlot.width}×${redSlot.height} — the trap is real and the pin bites`);
}

console.log("\n8. FC-SLOT-BIRTH-BOX ON AMEND — a variant COMPONENT root the emitter did not create");
{
  // Measured live 2026-08-10 on MUI Divider (set 83:1610). The rt9 rebuild
  // reported `amended: true, rebuiltVariants: 3` and Inset was STILL 216×100
  // and Middle STILL 256×100 — because the AMEND path preserves the existing
  // variant COMPONENT and rebuilds only its interior, so buildNode (which held
  // the only call site) never ran on the root. Modeled here as it happened on
  // canvas: a set built by an OLDER generation, then amended by today's.
  const emitOf = (c: Contract): string => {
    const byId = new Map<string, Contract>([[c.id, c]]);
    return emitFigmaScript(c, { tokens: TOKENS, icons: new Map(), contracts: byId } as never);
  };
  // Every call site stripped = the pre-fix emitter that built the canvas set.
  const strip = (s: string) => s.replace(/remeasureBirthBox\((?:node|comp), [^;]*\);/g, '');
  const OLD = strip(emitOf(childlessRoot()));
  if (OLD === emitOf(childlessRoot())) fail('the §8 strip matched nothing — the pins below are vacuous');

  const mock = createFigmaMock();
  await runIn(mock, OLD);
  const setOf = (m: Mock) => findAll(m, (n) => n.type === 'COMPONENT_SET' && n.name === 'EvalChildlessRoot')[0];
  const roots = (m: Mock) => setOf(m).children;
  for (const r of roots(mock)) {
    if (r.children.length) fail(`§8 fixture is wrong: variant ${r.name} has children, so it is not the childless-root shape`);
    if (r.height !== 100) {
      fail(
        `§8 SETUP DID NOT GO RED: the pre-fix emitter left variant ${r.name} at height ${r.height}, not 100 — ` +
          'this mock is not modeling the birth box on a plain COMPONENT, so the pin below is an alibi ' +
          '(exactly how MUI Divider scored a PASSING 0.00 while the canvas held 216×100)',
      );
    }
  }
  ok(`pre-fix: both variant roots stand at ${roots(mock)[0].width}×${roots(mock)[0].height} — the canvas state that scored a fake PASS`);

  // Today's emitter, version bumped so the specHash differs and it AMENDS
  // rather than skipping as unchanged.
  const report = await runFor(mock, emitOf(childlessRoot({ version: '0.2.0' })));
  if (!(report as any)?.amended && !((report as any)?.results ?? []).some((r: any) => r.amended)) {
    fail(`§8 did not exercise the AMEND path — report was ${JSON.stringify(report).slice(0, 300)}`);
  }
  for (const r of roots(mock)) {
    if (r.height === 100) {
      fail(
        `variant ${r.name} STILL measures 100 tall after an amend — the birth-box re-measure does not reach ` +
          'COMPONENT roots on the amend path (FC-SLOT-BIRTH-BOX). buildNode is not the only call site.',
      );
    }
  }
  ok(`amend re-measures the root: both variants left the birth box (now ${roots(mock)[0].width}×${roots(mock)[0].height})`);

  // RED TEST — the same amend with the call stripped must stay at 100, or the
  // pass above came from something other than the fix.
  const red = createFigmaMock();
  await runIn(red, OLD);
  await runIn(red, strip(emitOf(childlessRoot({ version: '0.2.0' }))));
  const stuck = roots(red).filter((r: any) => r.height === 100);
  if (stuck.length !== roots(red).length) {
    fail(
      `RED TEST DID NOT GO RED: with the call stripped ${roots(red).length - stuck.length} root(s) left the birth ` +
        'box anyway — something other than remeasureBirthBox is doing the work and §8 proves nothing',
    );
  }
  ok(`red test: stripping the amend-path call leaves every root at ${roots(red)[0].height} — the pin bites`);

  // LEAF GUARD. Relaxing the layout guard (spec.layout && … → the applyFrameSpec
  // default) widened the re-measure onto nodes that DECLARE no layout — which
  // includes every TEXT leaf, because a text node answers
  // `'layoutSizingVertical' in node` exactly as truthfully as a frame and has
  // no children array at all. First run after the relaxation threw
  // `Cannot read properties of undefined (reading 'length')` on the first MUI
  // text node and took four genesis batches down. `children` is the container
  // test and it must stay explicit.
  const withText = ContractSchema.parse({
    id: 'ds.eval-text-leaf-host',
    name: 'EvalTextLeafHost',
    version: '0.1.0',
    status: 'draft',
    description: 'a text leaf under a root — the shape the leaf guard protects',
    semantics: { element: 'div' },
    props: [
      {
        name: 'children',
        type: 'text',
        default: 'Label',
        description: 'The text leaf whose content this part renders.',
        bindings: { figma: { kind: 'TEXT', property: 'Content' }, code: { prop: 'children' } },
      },
    ],
    states: [],
    anatomy: { root: { parts: { label: { content: { prop: 'children' }, declared: { display: 'block' } } } } },
    bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: 'x', export: 'EvalTextLeafHost' } } },
  }) as Contract;
  const leafMock = createFigmaMock();
  try {
    await runIn(leafMock, emitOf(withText));
  } catch (e) {
    fail(
      `a TEXT leaf threw during the birth-box re-measure: ${(e as Error).message} — the guard lost its ` +
        'container test (node.children), so every text node now takes the frame path',
    );
  }
  const textNodes = findAll(leafMock, (n: any) => n.type === 'TEXT');
  if (!textNodes.length) fail('the leaf-guard fixture built no TEXT node — it is not exercising the guard');
  ok(`leaf guard: ${textNodes.length} TEXT leaf/leaves built without entering the frame-only re-measure`);
}

console.log('\n9. FC-OVERFLOW-CLIP-LOST — declared overflow hidden/clip draws as clipsContent, auto/scroll does not');
{
  // 102 parts across 34 stems in tree ship declared overflow (162 hidden,
  // 20 clip, 22 auto). The fact reached the contract and emit-react rendered
  // it; the CANVAS emitter routed the whole channel to the description
  // footnote on an 'annotate' verdict and applyDeclared's `default: break`
  // swallowed every one of them.
  const overflowContract = (v: string): Contract =>
    ContractSchema.parse({
      id: 'ds.eval-overflow',
      name: 'EvalOverflow',
      version: '0.1.0',
      status: 'draft',
      description: 'overflow carriage fixture',
      semantics: { element: 'div' },
      props: [],
      states: [],
      anatomy: { root: { declared: { display: 'block', 'overflow-x': v, 'overflow-y': v } } },
      bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: 'x', export: 'EvalOverflow' } } },
    }) as Contract;
  const emitOne = (c: Contract): string =>
    emitFigmaScript(c, { tokens: TOKENS, icons: new Map(), contracts: new Map([[c.id, c]]) } as never);
  const rootOf = (m: Mock) => findAll(m, (n: any) => n.type === 'COMPONENT' && n.name === 'EvalOverflow')[0];

  for (const v of ['hidden', 'clip']) {
    const m = createFigmaMock();
    await runIn(m, emitOne(overflowContract(v)));
    const root = rootOf(m);
    if (!root) fail(`overflow fixture (${v}) built no component`);
    if (root.clipsContent !== true) {
      fail(
        `declared overflow "${v}" did not reach the canvas: clipsContent=${root.clipsContent}. It is a native ` +
          'field and 182 declared values in tree depend on it — FC-OVERFLOW-CLIP-LOST',
      );
    }
  }
  ok('declared overflow hidden AND clip both reach the node as clipsContent=true');

  // The per-VALUE half. The registry verdict is per CHANNEL, so flipping
  // overflow to "draw" would have claimed 22 `auto` entries reach a canvas
  // that has no scroll container at all. drawExcept keeps them annotate.
  for (const v of ['auto', 'scroll']) {
    const m = createFigmaMock();
    await runIn(m, emitOne(overflowContract(v)));
    if (rootOf(m).clipsContent === true) {
      fail(
        `declared overflow "${v}" set clipsContent — scrolling has NO canvas spelling, and clipping is not ` +
          'scrolling. The channel verdict must stay per-VALUE (drawExcept)',
      );
    }
  }
  ok('auto and scroll stay OFF the canvas — clipping is not scrolling, and the registry says so per value');

  // RED TEST — strip the emitter's clipsContent write and the fact must vanish.
  const stripped = emitOne(overflowContract('hidden')).replace(/"clipsContent": true,?/g, '');
  if (stripped === emitOne(overflowContract('hidden'))) fail('the §9 red test stripped nothing — the pin is vacuous');
  const red = createFigmaMock();
  await runIn(red, stripped);
  if (rootOf(red).clipsContent !== false) {
    fail(
      `RED TEST DID NOT GO RED: with clipsContent stripped from the spec the node still reports ` +
        `${rootOf(red).clipsContent} — something other than the declared fact is clipping, and §9 proves nothing`,
    );
  }
  ok('red test: stripping clipsContent from the compiled spec leaves the node unclipped — the pin bites');
}

console.log("\n10. RC5 DESIGN-TIME SLOT SAMPLE — an empty default `children` slot is not an empty component");
{
  // THE ASYMMETRY THIS CLOSES. A Figma MAIN COMPONENT's slot content and a
  // generated Storybook meta's canonical args are the same object: the
  // design-time default an instance inherits and a fill replaces (resetSlot()
  // returns to it). core/emit-react.ts always computed one; core/emit-figma-
  // script.ts computed none, so the component a designer opens was CHILDLESS
  // — and a childless auto-layout node has nothing to re-measure, so the
  // correct birth-box repair (§7/§8) floors it at Figma's 1px. Measured on
  // the committed corpus before this fix: ds.blockquote 33x17 with both slots
  // 1x1, ds.toast 320x17, ds.card's Body slot 320x1.
  //
  // ONE policy (packages/schema designTimeSlotContent), read by both
  // emitters, so the string a story shows is the string the canvas draws.
  const twoSlotHost = (opts: { declared?: boolean } = {}): Contract =>
    ContractSchema.parse({
      id: 'ds.eval-slot-sample',
      name: 'EvalSlotSample',
      version: '0.1.0',
      status: 'draft',
      description: 'RC5 design-time slot sample fixture',
      semantics: { element: 'div' },
      props: [
        {
          name: 'size',
          description: 'Density.',
          type: { enum: ['sm', 'lg'] },
          default: 'sm',
          bindings: { figma: { kind: 'VARIANT', property: 'Size', values: { sm: 'Sm', lg: 'Lg' } }, code: { prop: 'size' } },
        },
      ],
      states: [],
      anatomy: {
        root: {
          layout: { display: 'flex', direction: 'column' },
          literals: { width: '320px' },
          parts: {
            quote: {
              description: 'The quoted content.',
              slot: opts.declared
                ? { name: 'children', accepts: ['ds.eval-slot-leaf'], acceptsMode: 'prefer', defaultContent: [{ id: 'ds.eval-slot-leaf' }] }
                : { name: 'children', acceptsMode: 'open' },
            },
            citation: {
              description: 'Attribution.',
              slot: { name: 'cite', acceptsMode: 'open' },
            },
          },
        },
      },
      bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: 'x', export: 'EvalSlotSample' } } },
    }) as Contract;

  const emitSample = (c: Contract): string =>
    emitFigmaScript(c, { tokens: TOKENS, icons: new Map(), contracts: new Map([[leaf().id, leaf()], [c.id, c]]) } as never);
  const buildSample = async (c: Contract): Promise<Mock> => {
    const m = createFigmaMock();
    await runIn(m, emit(leaf()));
    await runIn(m, emitSample(c));
    return m;
  };
  const sampleSet = (m: Mock) => findAll(m, (n: any) => n.type === 'COMPONENT_SET' && n.name === 'EvalSlotSample')[0];
  const slotNamed = (variant: any, property: string) =>
    (variant.children ?? []).find((c: any) => c.type === 'SLOT' && c.name === property);

  // (b) FIRST — the string is not a literal in this file. It is read back out
  // of the OTHER emitter's output, so the two design-time surfaces cannot
  // drift apart without this section going red.
  const storySrc = generateStories(twoSlotHost(), new Map([[leaf().id, leaf()], [twoSlotHost().id, twoSlotHost()]]));
  const argsLine = /children:\s*'((?:[^'\\]|\\.)*)'/.exec(storySrc);
  if (!argsLine) {
    fail(
      'the generated Storybook meta carries no `args.children` for a default slot with no declared content — ' +
        'the CODE surface lost its design-time sample, so there is nothing for the canvas to agree with (RC5)',
    );
  }
  const storySample = argsLine![1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  if (storySample !== DEFAULT_SLOT_SAMPLE) {
    fail(
      `the two design-time surfaces have DRIFTED: the generated story puts ${JSON.stringify(storySample)} in ` +
        `args.children while packages/schema DEFAULT_SLOT_SAMPLE is ${JSON.stringify(DEFAULT_SLOT_SAMPLE)}. ` +
        'Both emitters must read designTimeSlotContent and nothing else (RC5)',
    );
  }
  ok(`the generated story's args.children IS the shared constant (read back from generateStories, not asserted here)`);

  // (a) the canvas carries the SAME sample, in the sampled default slot only.
  const built = await buildSample(twoSlotHost());
  const set = sampleSet(built);
  if (!set) fail('the RC5 fixture built no EvalSlotSample set');
  for (const variant of set.children) {
    const children = slotNamed(variant, 'Children');
    if (!children) fail(`variant ${variant.name} carries no Children slot`);
    const kids = children.children ?? [];
    if (kids.length !== 1 || kids[0].type !== 'TEXT' || kids[0].characters !== storySample) {
      fail(
        `variant ${variant.name}: the default \`children\` slot minted ${kids.length === 0 ? 'EMPTY (1x1)' : JSON.stringify(kids.map((k: any) => `${k.type} ${JSON.stringify(k.characters ?? k.name)}`))} ` +
          '— no design-time sample, so the slot has nothing to measure and the component reads as blank. ' +
          "The generated story's args.children carries one; the canvas must carry the SAME one (RC5).",
      );
    }
    if (kids[0].name !== SLOT_SAMPLE_LAYER) {
      fail(
        `variant ${variant.name}: the sample layer is named ${JSON.stringify(kids[0].name)}, not ${JSON.stringify(SLOT_SAMPLE_LAYER)} — ` +
          'the layer name is the CARRIER the inverse path recognises the emitter\'s own sample by; without it the ' +
          'drop rule falls back to matching characters alone, which is what swallowed a designer\'s text (RC5)',
      );
    }
    if (children.width <= 1 || children.height <= 1) {
      fail(
        `variant ${variant.name}: the sampled Children slot still measures ${children.width}x${children.height} — ` +
          'the sample was minted but the slot did not re-measure around it (FC-SLOT-BIRTH-BOX)',
      );
    }
    if (kids[0].width > children.width) {
      fail(
        `variant ${variant.name}: the ${kids[0].width}px sample runs past its ${children.width}px slot — ` +
          'the sample must FILL its slot and WRAP (NodeSpec.slotSample → annotateFillW), never push the component wider',
      );
    }
  }
  ok(
    `every variant's default \`children\` slot draws the shared sample and re-measures around it ` +
      `(${set.children[0].width}x${set.children[0].height}, slot ${slotNamed(set.children[0], 'Children').width}x${slotNamed(set.children[0], 'Children').height})`,
  );

  // (e) the NAMED slot is a REFUSAL WITH A RECEIPT, not a silent sliver.
  for (const variant of set.children) {
    const cite = slotNamed(variant, 'Cite');
    if (!cite) fail(`variant ${variant.name} carries no Cite slot`);
    if ((cite.children ?? []).length !== 0) {
      fail(
        `variant ${variant.name}: the NAMED \`cite\` slot was given design-time content. No code surface has any ` +
          '(emit-react only fills a named slot the contract declares `accepts` for, emit-html renders the wrapper ' +
          'empty), so minting one would put content on the canvas that nothing else draws (RC5)',
      );
    }
  }
  const receipts = /"channel": "slot \\"(\w+)\\" design-time content"/g;
  const named = new Set<string>();
  for (let m2 = receipts.exec(emitSample(twoSlotHost())); m2; m2 = receipts.exec(emitSample(twoSlotHost()))) named.add(m2[1]);
  if (!named.has('cite')) {
    fail(
      `the empty NAMED slot "cite" shipped with NO receipt — it draws an empty region that re-measures to Figma's ` +
        '1px floor and says nothing about it. That silence is how ds.two-column shipped as a 640x1 sliver (RC5)',
    );
  }
  if (named.has('children')) {
    fail('the SAMPLED default slot must not also claim a missing-content receipt — it has content');
  }
  ok(`the empty named slot carries the code-only fact \`slot "cite" design-time content\` by name; the sampled slot does not`);

  // (d) a DECLARED defaultContent still wins, and gets no sample.
  const declaredBuilt = await buildSample(twoSlotHost({ declared: true }));
  for (const variant of sampleSet(declaredBuilt).children) {
    const kids = slotNamed(variant, 'Children').children ?? [];
    if (kids.length !== 1 || kids[0].type !== 'INSTANCE') {
      fail(
        `variant ${variant.name}: a slot with declared defaultContent must instantiate it, got ` +
          JSON.stringify(kids.map((k: any) => k.type)),
      );
    }
  }
  ok('a slot with declared defaultContent instantiates it and gets no sample — the declared fact always wins');

  // ---- ROUND TRIP ---------------------------------------------------------
  // The round trip is the whole reason the sample can exist at all: a
  // design-time DEFAULT is not a canvas fact, so contract → Figma → dump →
  // propose must return the same contract. The danger is the mirror image —
  // dropping too much. THE FIRST ATTEMPT AT THIS FIX DID EXACTLY THAT: it
  // dropped ANY TEXT child of ANY native slot whose characters matched the
  // sample, so a designer's text, in a slot the emitter never samples,
  // vanished with no receipt. Both halves are pinned below.
  const dumpSource = (): string => {
    const ui = readFileSync(path.join(process.cwd(), 'figma-sync/plugin/ui.html'), 'utf8');
    const openTag = '<script type="text/plain" id="dump-source">';
    const start = ui.indexOf(openTag);
    if (start < 0) fail('figma-sync/plugin/ui.html carries no #dump-source block');
    return ui
      .slice(start + openTag.length, ui.indexOf('</script>', start))
      .replace(/^\n/, '')
      .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify(['EvalSlotSample'])};`);
  };
  const proposeOf = async (m: Mock) => {
    const dump = (await runFor(m, dumpSource())) as any;
    const dumped = dump.EvalSlotSample;
    if (!dumped) fail('the dump did not capture the RC5 fixture set');
    return proposeFromDump(dumped, {
      corpus: { tokens: [], byValue: new Map(), byPath: new Map() } as never,
      contractIdByName: new Map([['EvalSlotLeaf', leaf().id]]),
      contractIdByKey: new Map([[findAll(m, (n: any) => n.name === 'EvalSlotLeaf' && (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'))[0].key, leaf().id]]),
    } as never) as { contract: Record<string, any>; notes?: string[] };
  };

  const proposal = await proposeOf(built);
  const parts = proposal.contract.anatomy.root.parts ?? {};
  const slotParts = Object.entries(parts).filter(([, p]: any) => p.slot);
  if (slotParts.length !== 2) {
    fail(
      `the round trip returned ${slotParts.length} slot parts, not 2 — the design-time sample became a PART: ` +
        JSON.stringify(Object.keys(parts)),
    );
  }
  const childrenPart = slotParts.map(([, p]: any) => p).find((p: any) => p.slot.name === 'children');
  if (!childrenPart) fail(`the round trip lost the default slot: ${JSON.stringify(slotParts.map(([, p]: any) => p.slot))}`);
  if ((childrenPart.slot.defaultContent ?? []).length > 0) {
    fail(
      `the round trip turned the emitter's own design-time sample into declared defaultContent: ` +
        `${JSON.stringify(childrenPart.slot.defaultContent)} — a DEFAULT is not a canvas fact, and re-emitting this ` +
        'contract would bake the placeholder in permanently (RC5)',
    );
  }
  const sampleNote = (proposal.notes ?? []).find((n) => n.includes(DEFAULT_SLOT_SAMPLE));
  if (sampleNote) fail(`the round trip reported the emitter's own sample as drawn content: ${sampleNote}`);
  ok('contract → Figma → dump → propose returns both slot parts unchanged: no extra part, no defaultContent, no note');

  // THE REGRESSION GUARD. Three ways a real canvas fact must survive the drop
  // rule — each one a conjunct of packages/schema isDesignTimeSlotSample.
  const cases: Array<[string, (m: Mock) => void]> = [
    [
      "a designer's text in a NAMED slot the emitter never samples",
      (m) => {
        for (const variant of sampleSet(m).children) {
          const cite = (variant.children ?? []).find((c: any) => c.type === 'SLOT' && c.name === 'Cite');
          const t = m.figma.createText();
          t.characters = DEFAULT_SLOT_SAMPLE;
          cite.appendChild(t);
        }
      },
    ],
    [
      "a designer's EDITED copy in the sampled slot",
      (m) => {
        for (const variant of sampleSet(m).children) {
          const kids = (variant.children ?? []).find((c: any) => c.type === 'SLOT' && c.name === 'Children').children;
          kids[0].characters = 'A real designer note.';
        }
      },
    ],
    [
      "a designer's SIBLING beside the sample",
      (m) => {
        for (const variant of sampleSet(m).children) {
          const slot = (variant.children ?? []).find((c: any) => c.type === 'SLOT' && c.name === 'Children');
          const t = m.figma.createText();
          t.characters = 'A real designer note.';
          slot.appendChild(t);
        }
      },
    ],
  ];
  for (const [what, mutate] of cases) {
    const m = await buildSample(twoSlotHost());
    mutate(m);
    const after = await proposeOf(m);
    const notes = (after.notes ?? []).join(' | ');
    if (!notes.includes('drawn content includes')) {
      fail(
        `SILENT SWALLOW — ${what} disappeared through the design-time-sample drop with NO receipt. ` +
          'The drop must be gated on ALL of: sole child, TEXT, the emitter\'s own layer name, and the exact ' +
          `sample characters (packages/schema isDesignTimeSlotSample). Notes were: ${notes.slice(0, 400) || '(none)'}`,
      );
    }
  }
  ok(`all three designer edits come back NAMED through the \`undrawn\` path — the drop rule cannot swallow a real canvas fact`);
}

console.log('\n11. RC5 NAMED WALL — the empty region on the canvas IS the empty region the CSS draws');
{
  // THE OTHER HALF OF THE CLASS, and the half the first attempt at this fix
  // was refuted for waving at. Five census rows are slot-only layout shells
  // whose slots are all NAMED (no `children`, no declared defaultContent), so
  // §10's policy gives them a receipt and nothing to draw — and they stay
  // visually empty. The obvious-looking remedy is "enforce a minimum box".
  //
  // MEASURED, IT IS THE WRONG REMEDY: the canvas is already drawing the same
  // nothing the CSS draws. This section re-derives that from committed bytes
  // every run, so it is a gate and not a paragraph. If a layout shell ever
  // does lose real height on the canvas, this goes red and the wall reopens.
  //
  // The census code half is captured by extract/figma/canvas-gate/shots.ts,
  // which clips the painted union box plus CLIP_MARGIN on every side at
  // device-pixel-ratio 2 — so the CSS CONTENT height is png.height/dpr minus
  // two margins. Both numbers are read out of the tree, never spelled here.
  const shots = readFileSync(path.join(process.cwd(), 'extract/figma/canvas-gate/shots.ts'), 'utf8');
  const marginMatch = /const CLIP_MARGIN = (\d+);/.exec(shots);
  if (!marginMatch) fail('extract/figma/canvas-gate/shots.ts no longer spells CLIP_MARGIN — §11 cannot re-derive the CSS content box');
  const margin = Number(marginMatch[1]);

  const pngHeight = (file: string): number => {
    const buf = readFileSync(file);
    if (buf.readUInt32BE(12) !== 0x49484452) fail(`${file} is not a PNG (no IHDR)`);
    return buf.readUInt32BE(20);
  };

  // WIDTH IS NOT ASSERTED HERE, and the reason is a limit of the receipt, not
  // a softened claim: the capture clip is clamped to the 600px viewport
  // (shots.ts measureJs), and every one of these shells is 640px wide, so the
  // committed PNG's width is the viewport's, not the component's. The height
  // axis is unclamped and is the axis the class is named for.
  // The REAL token set — these shells bind {space.gap.*}, and a stub map
  // would refuse at emit rather than measure anything.
  const readJson = (rel: string) => JSON.parse(readFileSync(path.join(process.cwd(), rel), 'utf8'));
  const REAL_TOKENS = {
    primitives: readJson('tokens/primitives.tokens.json'),
    semantic: readJson('tokens/semantic.tokens.json'),
    light: readJson('tokens/modes/semantic.light.tokens.json'),
    dark: readJson('tokens/modes/semantic.dark.tokens.json'),
    brands: { default: readJson('tokens/modes/brand.default.tokens.json') },
  };
  const rows: Array<[string, string, string]> = [
    ['ds.two-column', 'contracts/two-column.contract.json', 'code-twocolumn.png'],
    ['ds.sidebar-layout', 'contracts/sidebar-layout.contract.json', 'code-sidebarlayout.png'],
    ['ds.grid-gallery', 'contracts/grid-gallery.contract.json', 'code-gridgallery.png'],
  ];
  const lines: string[] = [];
  for (const [id, contractPath, png] of rows) {
    const contract = ContractSchema.parse(JSON.parse(readFileSync(path.join(process.cwd(), contractPath), 'utf8'))) as Contract;
    const receipt = path.join(process.cwd(), 'parity/receipts/v1/census/first-party', id, png);
    const render = JSON.parse(readFileSync(path.join(process.cwd(), 'parity/receipts/v1/census/first-party', id, 'code-render.json'), 'utf8'));
    const dprMatch = /dpr (\d+)/.exec(String(render.renderer));
    if (!dprMatch) fail(`${id}: code-render.json does not record the capture dpr — §11 cannot re-derive the CSS content box`);
    const cssHeight = pngHeight(receipt) / Number(dprMatch[1]) - 2 * margin;

    const m = createFigmaMock();
    await runIn(m, emitFigmaScript(contract, { tokens: REAL_TOKENS, icons: new Map(), contracts: new Map([[contract.id, contract]]) } as never));
    const node = findAll(m, (n: any) => n.type === 'COMPONENT' && n.name === contract.name)[0];
    if (!node) fail(`${id}: the fixture built no component`);
    const slots = (node.children ?? []).filter((c: any) => c.type === 'SLOT');
    if (slots.length === 0) fail(`${id} is not a slot-only shell any more — §11 is pinned to the wrong rows`);
    for (const s of slots) {
      if ((s.children ?? []).length !== 0) fail(`${id}: slot "${s.name}" drew content — §11's premise (every slot NAMED and empty) is stale`);
      if (s.height !== 1) {
        fail(
          `${id}: empty slot "${s.name}" measures ${s.height} tall, not Figma's 1px floor — the delta accounting ` +
            'below no longer describes what the canvas does',
        );
      }
    }

    // One 1px floor per GRID ROW: the row's height is its tallest occupant,
    // and every occupant is a floored empty slot. The row count is a CONTRACT
    // fact (root.layout.rows), so a re-authored shell moves this expectation
    // with it instead of drifting away from a hard-coded number.
    const trackRows = (contract.anatomy.root.layout as { rows?: unknown[] } | undefined)?.rows?.length;
    if (!trackRows) fail(`${id}: root declares no grid rows — §11 cannot derive the floor count`);
    const verdict = (h: number): string | null =>
      h - cssHeight === trackRows
        ? null
        : `${id}: the canvas draws ${h}px where the CSS surface draws ${cssHeight}px — a ${h - cssHeight}px ` +
          `difference against ${trackRows} flooring row(s). RC5's NAMED WALL says the canvas draws the same ` +
          'nothing the code draws, off by exactly one Figma 1px floor per row; that is no longer true, so either ' +
          'the shell gained real geometry (carry it) or the emitter lost some (fix it). A minimum box is not the ' +
          'answer either way — it would be geometry no surface declares.';
    const wrong = verdict(node.height);
    if (wrong) fail(wrong);

    // RED TEST — and it is the exact remedy this wall refuses. Give every
    // empty slot a 24px MINIMUM BOX (the "just make it taller" fix) and the
    // shell must fail its own agreement with the CSS surface. If it passed,
    // §11 would be pinning nothing and a fabricated box could ship as a fix.
    if (verdict(node.height + 24) === null) {
      fail(`${id}: the §11 red test did not go red — the delta rule accepts a fabricated 24px minimum box, so it proves nothing`);
    }
    lines.push(`${id} CSS ${cssHeight} vs canvas ${node.height} (+${trackRows})`);
  }
  ok(`the empty layout shells draw the CSS surface's own emptiness, off by one 1px floor per row: ${lines.join('; ')}`);
}

console.log('\n✔ native-slots ok: native SLOT emission, ONE unified set-level property, amend survival (red-tested), migration reported by name, every API refusal named, the slot reads back, an empty slot hugs — as does a childless COMPONENT root reached only by the amend path (FC-SLOT-BIRTH-BOX, both red-tested) — and RC5\'s design-time slot content agrees across both emitters, inverts without swallowing a designer\'s text, and leaves the still-empty shells measured against their own CSS render (red-tested).');
