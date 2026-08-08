/**
 * WAVE B.1 — `pseudo-decor-size-varies` lift.
 *
 *   npm run extract:computed:pseudo-decor-size:check
 *
 * Offline (no browser). Re-promotes committed captured truth and pins:
 *
 *   1. Tailwind ToggleSwitch ::after (16×16 / 20×20 / 24×24 by `sizing`) is
 *      CARRIED as an unconditional shape part with per-value width/height in
 *      `literalsByProp` — not refused as `pseudo-decor-size-varies`.
 *   2. Carbon Toggle ::before (uniform 18×18, offsets per `toggled`) still
 *      carries with size uniform — no regression of the v2 knob path.
 *   3. Emit sync: a shape part whose resolved literals carry width/height
 *      compiles a NodeSpec whose `shape.width/height` match (so create +
 *      absolute placement resize per variant).
 *
 * FALSIFICATION: restore the hard `sizes.size !== 1` refuse in anatomy.ts
 * and assertion 1 fails; drop the emit shape←lits sync and assertion 3 fails.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, propSpaceFor, type ComponentConfig, type SweepResult } from './capture.js';
import { alignSweep } from './fuse.js';
import { reconstructCaptures, type CapturedTruthFile } from './replay.js';
import { promoteAnatomy } from './anatomy.js';
import { kebab } from '../types.js';
import { createFigmaEngine } from '../../core/emit-figma-script.js';
import type { Contract, Part } from '../../scripts/contract-schema.js';
import { walkAnatomy } from '../../scripts/contract-schema.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const REPO = path.resolve(HERE, '..', '..');

const failures: string[] = [];
const bad = (m: string) => failures.push(m);
const ok = (m: string) => console.log(`  ✔ ${m}`);

function promoteFromTruth(configRel: string, outRel: string, componentName: string) {
  const cfg = loadConfig(REPO, path.join(REPO, configRel));
  const comp = (cfg.components as ComponentConfig[]).find((c) => c.name === componentName);
  if (!comp) throw new Error(`component ${componentName} not in ${configRel}`);
  const truthPath = path.join(REPO, outRel, 'captured-truth.json');
  if (!existsSync(truthPath)) throw new Error(`missing ${truthPath}`);
  const truth = JSON.parse(readFileSync(truthPath, 'utf8')) as CapturedTruthFile;
  const space = propSpaceFor(REPO, cfg, comp);
  const captures = reconstructCaptures(truth).map((c) => ({ ...c, combo: `${comp.name}:${c.combo}` }));
  const sweep = {
    captures,
    controls: truth.controls,
    allProps: truth._provenance.channels,
    stylesheetSkips: [],
    browserVersion: String(truth._provenance.browser ?? 'committed'),
    fontChecks: {},
    pinnedAnimations: [],
    shadowHostTrails: {},
    textFillFolds: {},
    closedShadowSuspects: {},
  } as unknown as SweepResult;
  const aligned = alignSweep(sweep, comp, space, cfg.library.classPrefix);
  return promoteAnatomy(space, comp, aligned.union, kebab(space.contract.name));
}

function findPart(contract: Contract, name: string): Part | undefined {
  return walkAnatomy(contract).find((w) => w.name === name)?.part;
}

console.log('\n1. Tailwind ToggleSwitch — size-per-sizing thumb is carried');
{
  const promotion = promoteFromTruth(
    'extract/computed/configs/tailwind.json',
    'extract/computed/out/tailwind/toggleswitch',
    'ToggleSwitch',
  );
  const sizeRefuse = promotion.refusals.filter((r) => r.startsWith('pseudo-decor-size-varies:'));
  if (sizeRefuse.length > 0) {
    bad(`still refused size-varies:\n    ${sizeRefuse.join('\n    ')}`);
  } else {
    ok('no pseudo-decor-size-varies refusal');
  }
  const carried = promotion.receipts.filter((r) => r.includes('pseudo-decor-carried:') && r.includes('part-0::after'));
  if (carried.length === 0) bad('part-0::after was not carried (no pseudo-decor-carried receipt)');
  else if (!carried.some((r) => r.includes('size per sizing'))) {
    bad(`carried receipt does not name size-per-sizing:\n    ${carried.join('\n    ')}`);
  } else {
    ok(`carried with size per sizing (${carried[0].slice(0, 120)}…)`);
  }
  const thumb = findPart(promotion.contract, 'part-0-after');
  if (!thumb?.shape) bad('part-0-after missing shape');
  else {
    const lbp = thumb.literalsByProp?.find((e) => e.prop === 'sizing');
    if (!lbp) bad('part-0-after has no literalsByProp entry on sizing');
    else {
      const sizes = ['sm', 'md', 'lg'].map((v) => ({
        v,
        w: lbp.map[v]?.width,
        h: lbp.map[v]?.height,
      }));
      const want = { sm: '16px', md: '20px', lg: '24px' } as const;
      const okMap = sizes.every((s) => s.w === want[s.v as keyof typeof want] && s.h === want[s.v as keyof typeof want]);
      if (!okMap) bad(`sizing width/height map wrong: ${JSON.stringify(sizes)}`);
      else ok(`literalsByProp.sizing width/height = sm:16 md:20 lg:24; shape base ${thumb.shape.width}×${thumb.shape.height}`);
    }
  }
}

console.log('\n2. Carbon Toggle — uniform-size knob still carries (no regression)');
{
  const promotion = promoteFromTruth(
    'extract/computed/configs/carbon.json',
    'extract/computed/out/carbon/toggle',
    'Toggle',
  );
  const carried = promotion.receipts.filter(
    (r) => r.includes('pseudo-decor-carried:') && r.includes('toggle__switch::before'),
  );
  if (carried.length === 0) bad('Carbon toggle__switch::before not carried');
  else if (!carried.some((r) => r.includes('size uniform'))) {
    bad(`Carbon knob receipt lost size-uniform naming:\n    ${carried.join('\n    ')}`);
  } else {
    ok('Carbon knob still carried (size uniform, geometry per toggled)');
  }
  const knob = findPart(promotion.contract, 'toggle__switch-before');
  if (!knob?.shape) bad('toggle__switch-before missing shape');
  else if (knob.shape.width !== 18 || knob.shape.height !== 18) {
    bad(`Carbon knob shape drifted: ${knob.shape.width}×${knob.shape.height}`);
  } else if (knob.literalsByProp?.some((e) => Object.values(e.map).some((m) => 'width' in m || 'height' in m))) {
    bad('Carbon knob unexpectedly carries per-value width/height');
  } else {
    ok('Carbon knob shape 18×18 with no size literalsByProp');
  }
}

console.log('\n3. Emit — literalsByProp width/height resize the compiled shape');
{
  const emptyTokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const engine = createFigmaEngine({ tokens: emptyTokens, icons: new Map() });
  const contract = {
    id: 'fixture.pseudo-decor-size',
    name: 'SizeThumb',
    description: 'wave b.1 emit resize pin',
    version: '0.0.0',
    status: 'draft',
    semantics: { element: 'div' },
    props: [
      {
        name: 'sizing',
        type: { enum: ['sm', 'md', 'lg'] },
        default: 'md',
        bindings: {
          figma: { kind: 'VARIANT', property: 'Sizing' },
          code: { prop: 'sizing' },
        },
      },
    ],
    states: [],
    anatomy: {
      root: {
        layout: { display: 'flex' },
        parts: {
          thumb: {
            shape: { kind: 'ellipse', width: 20, height: 20 },
            declared: { position: 'absolute' },
            literals: {
              'background-color': 'rgba(255, 255, 255, 1)',
              top: '2px',
              left: '2px',
              width: '20px',
              height: '20px',
            },
            literalsByProp: [
              {
                prop: 'sizing',
                map: {
                  sm: { width: '16px', height: '16px' },
                  md: { width: '20px', height: '20px' },
                  lg: { width: '24px', height: '24px' },
                },
              },
            ],
          },
        },
      },
    },
    anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'SizeThumb' } },
  } as unknown as Contract;
  const data = engine.compileComponentData(contract, new Map([[contract.id, contract]]));
  const find = (s: { name?: string; shape?: { width: number; height: number }; children?: unknown[] }, name: string): typeof s | undefined =>
    s.name === name ? s : (s.children ?? []).map((c) => find(c as typeof s, name)).find(Boolean);
  const sizes: Record<string, { w: number; h: number } | undefined> = {};
  for (const variant of data.variants) {
    const sizing = /Sizing=([^,]+)/.exec(variant.name)?.[1] ?? '';
    const thumb = find(variant.spec, 'thumb');
    if (thumb?.shape) sizes[sizing] = { w: thumb.shape.width, h: thumb.shape.height };
  }
  const expect = { sm: 16, md: 20, lg: 24 };
  let emitOk = true;
  for (const [k, px] of Object.entries(expect)) {
    if (!sizes[k] || sizes[k]!.w !== px || sizes[k]!.h !== px) {
      bad(`emit shape size for sizing=${k}: got ${JSON.stringify(sizes[k])} want ${px}×${px}`);
      emitOk = false;
    }
  }
  if (emitOk) ok(`compiled shape sizes sm/md/lg = 16/20/24 (${JSON.stringify(sizes)})`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`);
  for (const f of failures) console.error(`  ✖ ${f}`);
  process.exit(1);
}
console.log('\nAll pseudo-decor size checks passed.');
