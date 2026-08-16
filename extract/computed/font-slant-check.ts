/**
 * FC-FONT-SLANT-NOT-CARRIED — the italic carriage check.
 *
 *   npm run extract:computed:font-slant:check
 *
 * Offline. Re-fuses committed captured truth and pins the ONE fact the wall
 * was about: an AUTHORED `font-style` reaches `Part.declared` instead of
 * dying in the code-only ledger.
 *
 * Before the fix this file is RED at check 1 with the measured refusal
 *
 *   root.font-style — value shape outside mintable kinds (color/px/number/
 *   shadow/gradient) and outside the declared-channel registry — no schema
 *   channel today
 *
 * emitted by `prepareMint` (extract/computed/fuse.ts) — `font-style` was
 * absent from DECLARED_CHANNELS, so the uniform, styled, authored `italic`
 * fell through to `codeOnly` and no contract in the repo carried the slant.
 *
 *   1. tailwind/Blockquote root carries declared['font-style'] = 'italic'
 *      and the ledger no longer names it as a code-only drop.
 *   2. `normal` is NOT invented onto parts that never authored a slant —
 *      a lane whose slant equals the control baseline stays silent
 *      (carbon/Button is the witness: styledChannels never admits it).
 *   3. The bounded grammar refuses `oblique 40deg` by name rather than
 *      carrying a value the canvas cannot spell.
 *   4. The 'draw' verdict is TRUE — the carried slant reaches a real Figma
 *      text node as the italic FACE ("Semi Bold Italic"), composed with the
 *      weight rather than overwriting it, and the face is loaded.
 *   5. The RETURN leg closes too (channel-closure-check's bar): REST reports a
 *      weight NUMBER plus a separate `italic` boolean, so a face derived from
 *      the weight table alone read an italic node back as upright.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createFigmaMock } from '../../scripts/plugin-engine-mock-figma.mjs';
import { ContractSchema, DECLARED_CHANNELS, walkAnatomy, type Contract } from '../../scripts/contract-schema.js';
import { emitFigmaScript } from '../../core/emit-figma-script.js';
import { mapRestToDump, type RestNodesResponse } from '../figma/rest/map.js';
import { loadConfig, propSpaceFor, stageFor, type ComponentConfig, type SweepResult } from './capture.js';
import {
  alignSweep,
  applyMintToContract,
  detectFolds,
  enrichLayout,
  prepareMint,
  styledChannels,
} from './fuse.js';
import { reconstructCaptures, type CapturedTruthFile } from './replay.js';
import { promoteAnatomy } from './anatomy.js';
import { mintTokens } from '../../core/mint-tokens.js';
import { kebab } from '../types.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const REPO = path.resolve(HERE, '..', '..');

const failures: string[] = [];
const bad = (m: string) => failures.push(m);
const ok = (m: string) => console.log(`  ✔ ${m}`);

interface Fused {
  enriched: Contract;
  codeOnly: Array<{ part: string; channel: string; reason: string; sample?: string }>;
  styled: Map<string, Set<string>>;
}

/** run.ts phases 1→2, minus the browser: promote, fuse, apply. */
function fuseFromTruth(configRel: string, outRel: string, componentName: string): Fused {
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
  const promotion = promoteAnatomy(space, comp, aligned.union, kebab(space.contract.name));
  const svgConsumedParts = new Set([...promotion.consumed].map((i) => aligned.partNames[i]));
  const controlStyles = Object.fromEntries(
    Object.entries(truth.controls).map(([t, n]) => [t, (n as { style: Record<string, string> }).style]),
  );
  const styled = styledChannels(aligned, space, controlStyles, truth._provenance.channels, [], {
    viewport: cfg.browser.viewport,
    stage: stageFor(cfg, comp),
    portaled: comp.portalCapture === true,
  });
  const folds = detectFolds(aligned, styled, []);
  const layout = enrichLayout(aligned, space, styled, promotion.contract);
  const prep = prepareMint(
    aligned, comp, space, styled, folds, layout.handled, promotion.contract,
    svgConsumedParts, new Set(promotion.partIndex.keys()), promotion.gridMintRefusals,
  );
  const mintBase = mintTokens(comp.name, prep.baseObs, prep.axes, { nestedPairs: true });
  const mintStates = mintTokens(comp.name, prep.stateObs, prep.axes, { nestedPairs: true });
  const { enriched } = applyMintToContract(
    promotion.contract, space, mintBase, prep.baseObs, mintStates, prep.stateObs, layout.enriched,
    prep.declared, prep.declaredStates, prep.setPlaneLiterals,
    { only: prep.inheritanceOnly, stateDeltas: prep.inheritanceStateDeltas },
  );
  return { enriched: enriched as Contract, codeOnly: prep.codeOnly, styled };
}

const declaredOf = (c: Contract, partName: string): Record<string, string> =>
  (walkAnatomy(c).find((w) => w.name === partName)?.part.declared ?? {}) as Record<string, string>;

console.log('\n0. Registry — `font-style` is a declared channel');
{
  const spec = DECLARED_CHANNELS['font-style'];
  if (!spec) {
    bad('DECLARED_CHANNELS has no `font-style` entry — the slant has no carried spelling anywhere (FC-FONT-SLANT-NOT-CARRIED)');
  } else {
    ok(`font-style registered · canvas=${spec.canvas}`);
    for (const v of ['normal', 'italic', 'oblique']) {
      if (!spec.value.test(v)) bad(`grammar rejects the CSS keyword \`${v}\``);
    }
    if (spec.value.test('oblique 40deg')) {
      bad('grammar admits `oblique 40deg` — an angled slant has no canvas or emitter spelling and must refuse by name');
    } else {
      ok('grammar refuses `oblique 40deg` (named residue, not a silent carry)');
    }
  }
}

console.log('\n1. tailwind/Blockquote — authored italic reaches the contract');
{
  const f = fuseFromTruth(
    'extract/computed/configs/tailwind.json',
    'extract/computed/out/tailwind/blockquote',
    'Blockquote',
  );
  // The premise of the whole check: the capture DID see the slant as styled.
  if (!f.styled.get('root')?.has('font-style')) {
    bad('root.font-style is not even a styled channel — the capture premise moved; re-measure before touching carriage');
  } else {
    ok('root.font-style is styled (differs from the control baseline)');
  }
  const got = declaredOf(f.enriched, 'root')['font-style'];
  if (got !== 'italic') {
    const drop = f.codeOnly.find((c) => c.part === 'root' && c.channel === 'font-style');
    bad(
      `root.declared['font-style'] is ${JSON.stringify(got)}, want "italic"` +
      (drop ? `\n      dropped instead by prepareMint: ${drop.reason}` : ''),
    );
  } else {
    ok("root.declared['font-style'] = italic");
  }
  const drop = f.codeOnly.find((c) => c.part === 'root' && c.channel === 'font-style');
  if (drop) {
    bad(`font-style is STILL in the code-only ledger: ${drop.reason}`);
  } else {
    ok('font-style is no longer a code-only drop');
  }
}

console.log('\n2. No invented slant — an upright lane stays silent');
{
  const f = fuseFromTruth(
    'extract/computed/configs/carbon.json',
    'extract/computed/out/carbon/button',
    'Button',
  );
  const offenders = walkAnatomy(f.enriched)
    .filter((w) => (w.part.declared as Record<string, string> | undefined)?.['font-style'] !== undefined)
    .map((w) => `${w.name}=${(w.part.declared as Record<string, string>)['font-style']}`);
  if (offenders.length > 0) {
    bad(`carbon/Button invented a slant on ${offenders.join(', ')} — upright text authors nothing and must carry nothing`);
  } else {
    ok('carbon/Button carries no font-style (nothing invented)');
  }
}

console.log('\n3. the canvas DRAWS it — the slant becomes the italic face, not a lost note');
{
  const TOKENS = {
    primitives: {
      font: {
        size: { md: { $value: '20px', $type: 'dimension' } },
        weight: { semibold: { $value: '600', $type: 'fontWeight' } },
      },
    },
    semantic: {}, light: {}, dark: {}, brands: { default: {} },
  };
  const quote = (declared: Record<string, string>): Contract =>
    ContractSchema.parse({
      id: 'ds.eval-slant',
      name: 'EvalSlant',
      version: '0.1.0',
      status: 'draft',
      description: 'font-slant fixture',
      semantics: { element: 'blockquote' },
      props: [{
        name: 'children', type: 'text', default: 'Design is not just what it looks like.',
        bindings: { figma: { kind: 'TEXT', property: 'Content' }, code: { prop: 'children' } },
      }],
      states: [],
      anatomy: {
        root: {
          content: { prop: 'children' },
          tokens: { 'font-size': '{font.size.md}', 'font-weight': '{font.weight.semibold}' },
          ...(Object.keys(declared).length > 0 ? { declared } : {}),
        },
      },
      anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'EvalSlant' } },
    }) as Contract;

  const emit = (c: Contract) => emitFigmaScript(c, { tokens: TOKENS, icons: new Map(), contracts: new Map([[c.id, c]]) });
  const facesOf = (script: string): string[] => {
    const m = /const COMPONENTS = (\[[\s\S]*?\n\]);/.exec(script);
    if (!m) throw new Error('emitted script has no COMPONENTS payload');
    const faces: string[] = [];
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) { for (const x of o) walk(x); return; }
      if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>;
        if (typeof r.fontStyle === 'string' && r.type === 'text') faces.push(r.fontStyle);
        for (const v of Object.values(r)) walk(v);
      }
    };
    walk(JSON.parse(m[1]));
    return faces;
  };

  const upright = facesOf(emit(quote({})));
  if (!upright.includes('Semi Bold')) {
    bad(`the no-slant control did not compile to the plain weight face — got ${JSON.stringify(upright)}`);
  } else {
    ok(`no slant → face "Semi Bold" (weight only, unchanged)`);
  }

  const slantScript = emit(quote({ 'font-style': 'italic' }));
  const italic = facesOf(slantScript);
  if (!italic.includes('Semi Bold Italic')) {
    bad(
      `declared italic did not reach the canvas as a face — got ${JSON.stringify(italic)}. ` +
      `The 'draw' verdict in DECLARED_CHANNELS would then be a lie: the contract carries the slant and the canvas still draws upright.`,
    );
  } else {
    ok('declared italic → face "Semi Bold Italic" (composed with the weight, not replacing it)');
  }
  // The face must be LOADED, or the runtime assignment throws and the node
  // silently keeps Inter Regular.
  const loads = /for \(const C of COMPONENTS\) for \(const s of C\.fontStyles\) fontStyles\.add\(s\);/.test(slantScript);
  const declaredFaces = /"fontStyles":\s*\[([^\]]*)\]/.exec(slantScript)?.[1] ?? '';
  if (!loads || !declaredFaces.includes('Semi Bold Italic')) {
    bad(`the italic face is never loadFontAsync'd (fontStyles = [${declaredFaces}]) — figma.createText would keep Inter Regular`);
  } else {
    ok('the italic face rides C.fontStyles, so the runtime loads it before assignment');
  }

  // The payload saying "Semi Bold Italic" and the NODE being italic are two
  // different claims — run the emitted script against the plugin's own mock
  // and read the face off the built text node.
  {
    const mock = createFigmaMock();
    // Seed the one bound token the way a token sync would (hug-ceiling pattern).
    // The mock's .d.ts declares only the read half of `variables`; the write
    // half is what a token sync uses and what the emitted script needs bound.
    const vars = mock.figma.variables as unknown as {
      createVariableCollection(name: string): { modes: Array<{ modeId: string }> };
      createVariable(name: string, coll: unknown, type: string): { setValueForMode(mode: string, v: unknown): void };
    };
    const coll = vars.createVariableCollection('Slant');
    vars.createVariable('font/size/md', coll, 'FLOAT').setValueForMode(coll.modes[0].modeId, 20);
    const ctx = vm.createContext({ figma: mock.figma, console: { log() {}, warn() {}, error() {} } });
    await vm.runInContext(`(async () => {\n${slantScript}\n})()`, ctx, { timeout: 120_000 });
    const texts = mock.root.findAll((n: { type: string }) => n.type === 'TEXT') as Array<{ fontName?: { family: string; style: string } }>;
    const faces = texts.map((t) => t.fontName?.style);
    if (texts.length === 0) {
      bad('the emitted script built no TEXT node at all — the fixture, not the slant, is broken');
    } else if (!faces.includes('Semi Bold Italic')) {
      bad(`the BUILT canvas node is not italic — fontName.style = ${JSON.stringify(faces)}`);
    } else {
      ok(`the built canvas text node reads fontName.style = "Semi Bold Italic"`);
    }
  }
}

console.log('\n4. the RETURN leg — REST reads the slant back instead of reporting upright');
{
  // The Plugin API reader takes `fontName.style` verbatim, so it never lost
  // the slant. REST is the leg that could: it reports a weight NUMBER and a
  // separate `italic` boolean, and deriving the face from the weight table
  // alone turns "Semi Bold Italic" back into "Semi Bold" with nothing said.
  const restNode = (italic: boolean): RestNodesResponse => ({
    name: 'Slant fixture',
    nodes: {
      '1:1': {
        document: {
          id: '1:1', name: 'Quote', type: 'COMPONENT_SET',
          componentPropertyDefinitions: { Size: { type: 'VARIANT', defaultValue: 'Md', variantOptions: ['Md'] } },
          children: [{
            id: '1:2', name: 'Size=Md', type: 'COMPONENT',
            componentProperties: { Size: { type: 'VARIANT', value: 'Md' } },
            children: [{
              id: '1:3', name: 'text', type: 'TEXT', characters: 'Design is not just what it looks like.',
              style: { fontSize: 20, fontWeight: 600, ...(italic ? { italic: true } : {}) },
            }],
          }],
        },
        componentSets: { '1:1': { name: 'Quote', key: 'quote-set-key' } },
      },
    },
  } as unknown as RestNodesResponse);

  const faceOf = (italic: boolean): string | undefined => {
    const { dump } = mapRestToDump(restNode(italic));
    let face: string | undefined;
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) { for (const x of n) walk(x); return; }
      if (n && typeof n === 'object') {
        const r = n as Record<string, unknown>;
        const t = r.text as { fontStyle?: string } | undefined;
        if (t?.fontStyle) face ??= t.fontStyle;
        for (const v of Object.values(r)) walk(v);
      }
    };
    walk(dump);
    return face;
  };

  if (faceOf(false) !== 'Semi Bold') {
    bad(`the upright control changed shape — REST read back ${JSON.stringify(faceOf(false))}, want "Semi Bold"`);
  } else {
    ok('REST upright → "Semi Bold" (unchanged)');
  }
  const back = faceOf(true);
  if (back !== 'Semi Bold Italic') {
    bad(`REST dropped the slant on the way back — read ${JSON.stringify(back)}, want "Semi Bold Italic". An italic node would return as upright with nothing naming the loss.`);
  } else {
    ok('REST italic → "Semi Bold Italic" (the slant survives the round trip)');
  }
}

if (failures.length > 0) {
  console.error('\nFAIL:\n' + failures.map((f) => `  ✖ ${f}`).join('\n'));
  process.exit(1);
}
console.log('\nAll font-slant checks passed.');
