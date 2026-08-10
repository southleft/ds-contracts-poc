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
 *      SLOT property named for `slot.figmaProperty`, with `accepts` on
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
 *
 * Exits non-zero with a named failure on any violated expectation.
 */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
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
    anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'EvalSlotLeaf' } },
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
    anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'EvalChildlessRoot' } },
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
    anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'EvalSlotHost' } },
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
            body: { slot: { name: 'body', figmaProperty: 'Content' } },
            footer: { slot: { name: 'footer', figmaProperty: 'Content' } },
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
  const stripped = emit(host()).replace(
    /remeasureBirthBox\(node, spec\.type === 'slot' \? spec\.slotProperty : spec\.name\);/g,
    '',
  );
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
    anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'EvalTextLeafHost' } },
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

console.log('\n✔ native-slots ok: native SLOT emission, ONE unified set-level property, amend survival (red-tested), migration reported by name, every API refusal named, the slot reads back, and an empty slot hugs — as does a childless COMPONENT root reached only by the amend path (FC-SLOT-BIRTH-BOX, both red-tested).');
