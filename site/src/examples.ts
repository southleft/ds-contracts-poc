/**
 * Examples for the reference pages. Three provenance classes, each labeled
 * on the page:
 *
 *   1. SHIPPING — an excerpt of a real contract in contracts/, loaded and
 *      re-serialized at build time. These are the proof: the same files
 *      generate the React library and the canvas library.
 *   2. REPLAYED — proposed at build time by the actual import engine
 *      (core/propose-figma) from a committed capture fixture. Used for
 *      vocabulary that exists because of brownfield field cases (shape,
 *      repeat) and has no shipping contract yet.
 *   3. ILLUSTRATIVE — hand-written, but parsed against the live schema at
 *      build time, so an illustrative example that stops being legal breaks
 *      the build.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as z from 'zod';
import { codeBlock, badge } from './html.js';

const ROOT = process.cwd();

const readJson = (rel: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8')) as Record<string, unknown>;

/** Select a nested value by dotted path ("anatomy.root.tokens"). */
function pick(obj: unknown, dotted: string): unknown {
  let cur: unknown = obj;
  for (const seg of dotted.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

export interface ExcerptSpec {
  /** Dotted paths into the contract; each becomes a top-level key in the
   *  rendered excerpt (nested under its original key path). */
  paths: string[];
  /** Optional per-path array slice (path → max items). */
  limit?: Record<string, number>;
}

function assemble(source: Record<string, unknown>, spec: ExcerptSpec): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of spec.paths) {
    let v = pick(source, p);
    if (v === undefined) throw new Error(`example excerpt: path "${p}" not found`);
    const max = spec.limit?.[p];
    if (max !== undefined && Array.isArray(v)) v = v.slice(0, max);
    // Rebuild the nesting so the excerpt reads like the source document.
    const segs = p.split('.');
    let node = out;
    for (const seg of segs.slice(0, -1)) {
      node = (node[seg] ??= {}) as Record<string, unknown>;
    }
    node[segs[segs.length - 1]] = v;
  }
  return out;
}

/** A shipping-contract excerpt with provenance caption. */
export function shippingExample(file: string, spec: ExcerptSpec, note?: string): string {
  const rel = `contracts/${file}`;
  const contract = readJson(rel);
  const body = assemble(contract, spec);
  const version = typeof contract.version === 'string' ? ` · v${contract.version}` : '';
  const caption = `${rel} (excerpt${version}) — shipping contract, loaded at build time${note ? ` · ${note}` : ''}`;
  return codeBlock(JSON.stringify(body, null, 2), 'json', caption) ;
}

/** A hand-written example, VALIDATED against the given schema at build time. */
export function illustrativeExample<T>(
  schema: z.ZodType<T>,
  value: T,
  caption: string,
): string {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`illustrative example failed schema validation (${caption}):\n${parsed.error}`);
  }
  return codeBlock(
    JSON.stringify(value, null, 2),
    'json',
    `${caption} — illustrative, schema-validated at build time`,
  );
}

export const exampleBadge = (): string => badge('example');

// ---------------------------------------------------------------------------
// Engine replays — run the real import engine over committed capture
// fixtures at build time. Lazy + memoized: the engine loads the whole token
// corpus once.
// ---------------------------------------------------------------------------

interface Replays {
  /** CBDS Tooltip pointer — a real shape part (triangle, per-placement offsets). */
  shapePart: Record<string, unknown>;
  shapeStates: { visibleWhen: unknown; stylesWhenCount: number };
  /** Navigation-header menu — a real repeat part + its arrayOf prop. */
  repeatPart: Record<string, unknown>;
  repeatProp: Record<string, unknown>;
}

let replays: Replays | undefined;

export async function loadReplays(): Promise<Replays> {
  if (replays) return replays;
  const [{ loadTokenCorpus }, { proposeFromDump, loadContracts }, { proposeBatchFromDump }, schemaMod] =
    await Promise.all([
      import('../../extract/figma/tokens.js'),
      import('../../extract/figma/propose.js'),
      import('../../core/propose-figma.js'),
      import('../../scripts/contract-schema.js'),
    ]);
  const { ContractSchema, walkAnatomy } = schemaMod;
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  const corpus = loadTokenCorpus(ROOT);

  // 1 · Tooltip (shape): the CBDS field case, from the committed REST dump.
  const tooltipDump = readJson('extract/figma/fixtures/cbds-tooltip.rest-dump.json');
  const tooltip = proposeFromDump(clone(tooltipDump['Tooltip']) as never, {
    corpus,
    contractIdByName: new Map<string, string>(),
    fileKey: 'WofZT8xaxXuc2Q6Je9S4XE',
    mintUnbound: true,
  });
  const tooltipContract = ContractSchema.parse(tooltip.contract);
  const pointer = walkAnatomy(tooltipContract).find((w) => w.part.shape);
  if (!pointer) throw new Error('replay: tooltip proposal has no shape part');

  // 2 · Navigation header (repeat): the owner's-kit P9 fixture.
  const loaded = loadContracts(path.resolve(ROOT, 'contracts'));
  const navDump = readJson(
    'extract/figma/gauntlet/fixtures/pattern-repeat-collection-navigation-header.dump.json',
  );
  const provenance = navDump._provenance as { fileKey?: string } | undefined;
  const batch = proposeBatchFromDump(navDump, {
    corpus,
    contractIdByName: loaded.byName,
    contractsById: loaded.byId,
    fileKey: provenance?.fileKey ?? null,
    mintUnbound: true,
  });
  const navContract = ContractSchema.parse(batch.proposals[0].contract);
  const repeatWalk = walkAnatomy(navContract).find((w) => w.part.repeat);
  if (!repeatWalk) throw new Error('replay: navigation-header proposal has no repeat part');
  const itemsPropName = repeatWalk.part.repeat!.itemsProp;
  const repeatProp = navContract.props.find((p) => p.name === itemsPropName);
  if (!repeatProp) throw new Error('replay: repeat itemsProp not found on the proposal');

  replays = {
    shapePart: {
      [pointer.name]: {
        shape: pointer.part.shape,
        ...(pointer.part.tokens ? { tokens: pointer.part.tokens } : {}),
        ...(pointer.part.visibleWhen ? { visibleWhen: pointer.part.visibleWhen } : {}),
        ...(pointer.part.stylesWhen ? { stylesWhen: pointer.part.stylesWhen.slice(0, 3) } : {}),
      },
    },
    shapeStates: {
      visibleWhen: pointer.part.visibleWhen,
      stylesWhenCount: pointer.part.stylesWhen?.length ?? 0,
    },
    repeatPart: {
      [repeatWalk.name]: {
        component: repeatWalk.part.component,
        repeat: repeatWalk.part.repeat,
      },
    },
    repeatProp: repeatProp as unknown as Record<string, unknown>,
  };
  return replays;
}

export function replayedBlock(body: unknown, caption: string): string {
  return codeBlock(JSON.stringify(body, null, 2), 'json', caption);
}
