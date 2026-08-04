/**
 * CATALOG WORLD — the same shape extract/figma/canvas-gate/compile.ts builds,
 * loaded for THIS repository's catalog instead of examples/polaris.
 *
 * WHY A SECOND LOADER. canvas-gate's `loadWorld()` is hardcoded to
 * examples/polaris (EXAMPLE/tokens/polaris-light.dtcg.json, EXAMPLE/contracts,
 * EXAMPLE/assets/icons) because it exists to compare our canvas engine against
 * the real @shopify/polaris npm package. The cross-surface gate compares our
 * TWO emitters against each other over the shipping catalog — contracts/,
 * tokens/, assets/icons and src/styles/tokens.css. Rather than edit a loader
 * another gate depends on, this file loads the catalog and reuses everything
 * downstream of it (deriveCells, buildCanvasGateDoc, shots.ts, score.ts).
 *
 * TOKEN LAYER, SHARED BY BOTH SIDES. src/styles/tokens.css declares
 * `--<dot.path with '-'>` for every token; the canvas renderer spells the
 * engine's figma var name (`dot/path`) as `--dot-path`, and the CSS emitter
 * binds the same custom properties. So ONE stylesheet resolves both surfaces
 * and the token layer is provably not the variable under test.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  ContractSchema,
  walkAnatomy,
  type Contract,
} from '../../../scripts/contract-schema.js';
import {
  createFigmaEngine,
  type ComponentData,
} from '../../../core/emit-figma-script.js';
import { tokenInventoryFromJson } from '../../../core/index.js';
import { deriveCells, type Cell } from '../canvas-gate/compile.js';

export const REPO = path.resolve(new URL('.', import.meta.url).pathname, '../../..');

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;

export interface CatalogWorld {
  contracts: Contract[];
  byId: Map<string, Contract>;
  engine: ReturnType<typeof createFigmaEngine>;
  inventory: Set<string>;
  icons: Map<string, string>;
  /** src/styles/tokens.css — resolves every var(--…) on BOTH surfaces. */
  tokenCss: string;
}

/** contracts/ + tokens/ + assets/icons + src/styles/tokens.css. Mirrors
 *  extract/fidelity-matrix/scripts/lib.ts loadRepoData (the playground's own
 *  bundle), narrowed to what the two emitters need.
 *
 *  `contractsDir` exists so a gate can be FALSIFIED against a planted corpus
 *  without mutating the repository's own committed contracts — the same
 *  discipline scripts/child-wider.mjs:119-122 uses for its baseline. Point it
 *  at an empty directory and the run must REFUSE (denominator zero); point it
 *  at a copy with one contract patched and the run must go RED naming exactly
 *  the affected cells. Both are exercised in README.md § Falsification. */
export function loadCatalogWorld(contractsDir?: string): CatalogWorld {
  const t = (p: string) => readJson(path.join(REPO, 'tokens', p));
  const primitives = t('primitives.tokens.json');
  const semantic = t('semantic.tokens.json');
  const light = t('modes/semantic.light.tokens.json');
  const dark = t('modes/semantic.dark.tokens.json');
  const brands = Object.fromEntries(
    readdirSync(path.join(REPO, 'tokens', 'modes'))
      .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
      .map((f) => [f.replace(/^brand\.|\.tokens\.json$/g, ''), t(`modes/${f}`)]),
  );
  const dir = contractsDir ?? path.join(REPO, 'contracts');
  const contracts = readdirSync(dir)
    .filter((f) => f.endsWith('.contract.json'))
    .sort()
    .map((f) => ContractSchema.parse(readJson(path.join(dir, f))));
  const icons = new Map<string, string>(
    readdirSync(path.join(REPO, 'assets', 'icons'))
      .filter((f) => f.endsWith('.svg'))
      .sort()
      .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(REPO, 'assets', 'icons', f), 'utf8').trim()]),
  );
  return {
    contracts,
    byId: new Map(contracts.map((c) => [c.id, c])),
    engine: createFigmaEngine({ tokens: { primitives, semantic, light, dark, brands }, icons }),
    inventory: tokenInventoryFromJson([primitives, semantic, light, dark]),
    icons,
    tokenCss: readFileSync(path.join(REPO, 'src', 'styles', 'tokens.css'), 'utf8'),
  };
}

// ---------------------------------------------------------------------------
// Cells — the gate's denominator
// ---------------------------------------------------------------------------

/** How a contract STATE is driven on the CSS surface. The canvas surface needs
 *  no driver: the state-preview variant's spec already carries the state paint.
 *  A state with no entry here is REFUSED BY NAME (a refusal row in the
 *  scorecard), never silently dropped from the denominator. */
export const CSS_STATE_DRIVER: Record<string, { interaction: 'hover' | 'focus-visible' | 'active' } | { boolProp: string }> = {
  hover: { interaction: 'hover' },
  'focus-visible': { interaction: 'focus-visible' },
  focus: { interaction: 'focus-visible' },
  active: { interaction: 'active' },
  pressed: { interaction: 'active' },
  disabled: { boolProp: 'disabled' },
};

export interface CatalogCell {
  contract: Contract;
  /** `<contract.id> :: <compiled variant name>` — the row key. */
  key: string;
  index: number;
  cell: Cell;
  /** null when both surfaces are producible; a reason when the CSS surface
   *  cannot be driven into this cell's state. */
  refusal: string | null;
  cssInteraction: 'default' | 'hover' | 'focus-visible' | 'active';
  cssBools: Record<string, boolean>;
  /** Declared `content: { prop }` parts and the text each resolves to for
   *  THIS cell — the kbd-class invariant's input (see run.ts). */
  declaredContent: Array<{ part: string; prop: string; text: string }>;
}

export interface ContractCells {
  contract: Contract;
  data: ComponentData;
  cells: CatalogCell[];
}

const rowKey = (c: Contract, name: string) => `${c.id} :: ${name}`;

/** The text a `content: { prop }` part resolves to for one cell: the cell's
 *  enum substitution when the prop is an axis, else the prop's contract
 *  default. `''` means the contract declares a text slot and supplies nothing
 *  — the kbd class. */
function declaredContentFor(contract: Contract, cell: Cell): CatalogCell['declaredContent'] {
  const out: CatalogCell['declaredContent'] = [];
  for (const w of walkAnatomy(contract)) {
    const prop = w.part.content?.prop;
    if (!prop) continue;
    const decl = contract.props.find((p) => p.name === prop);
    const text =
      cell.subst[prop] !== undefined
        ? cell.subst[prop]
        : decl?.default !== undefined && decl.default !== null
          ? String(decl.default)
          : '';
    out.push({ part: w.name, prop, text });
  }
  return out;
}

export function catalogCells(world: CatalogWorld): ContractCells[] {
  const out: ContractCells[] = [];
  for (const contract of world.contracts) {
    const data = world.engine.compileComponentData(contract, world.byId);
    const cells = deriveCells(contract, data);
    const boolNames = new Set(contract.props.filter((p) => p.type === 'boolean').map((p) => p.name));
    out.push({
      contract,
      data,
      cells: cells.map((cell, index) => {
        let refusal: string | null = null;
        let cssInteraction: CatalogCell['cssInteraction'] = 'default';
        const cssBools: Record<string, boolean> = {};
        if (cell.state) {
          const driver = CSS_STATE_DRIVER[cell.state];
          if (!driver) {
            refusal = `state "${cell.state}" has no CSS-surface driver in CSS_STATE_DRIVER (world.ts)`;
          } else if ('interaction' in driver) {
            cssInteraction = driver.interaction;
          } else if (!boolNames.has(driver.boolProp)) {
            refusal = `state "${cell.state}" drives the boolean prop "${driver.boolProp}", which ${contract.id} does not declare`;
          } else {
            cssBools[driver.boolProp] = true;
          }
        }
        return {
          contract,
          key: rowKey(contract, cell.name),
          index,
          cell,
          refusal,
          cssInteraction,
          cssBools,
          declaredContent: declaredContentFor(contract, cell),
        };
      }),
    });
  }
  return out;
}
