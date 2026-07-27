/**
 * Diagnostic-only parity — the referee over surfaces this repo did NOT
 * generate (docs/11 Phase 3: "keep your libraries, add a referee").
 *
 *   npm run diagnose [-- path/to/extract.config.json]
 *
 * Reads three inputs, none of which assume generation:
 *   · contracts   — a directory of contract JSON (adopted or extraction
 *                   proposals), any namespace
 *   · code        — the REAL library source, through the extraction
 *                   adapters (react-tsx or cem)
 *   · design      — optional: a figma-dump.js JSON (or "parity-snapshot");
 *                   without it, design checks are skipped and SAID to be
 *                   skipped — never silently passed
 *
 * Classification semantics are identical to parity/diff.ts: every finding
 * is ahead / behind / mismatch with a remedy. Scope is the contracted API
 * surface (props, enum options, defaults, booleans, text, events, variant
 * axes) — exactly what extraction can honestly see. Exit 1 on drift.
 *
 * Three rules exist here because a brownfield kit is not a generated one
 * (all three were missing until 2026-07-26, and their absence is what made
 * the Shoelace pilot report 58 false findings):
 *
 *   1 VENDOR PREFIX — code names carry a vendor prefix the design kit does
 *     not (`SlButton` ⇄ kit "Button"). The same rule `extract/reconcile.ts`
 *     applies, read from the same config key (`idPrefix`), and every
 *     prefix-stripped match is listed, never silent.
 *   2 ORPHAN SWEEP — a design set NO contract claims is the brownfield case
 *     ("we have 300 kit components and nobody knows which are owned"). It is
 *     invisible to a loop that only walks contracts, so the sweep walks the
 *     design side too and reports `[design AHEAD]`.
 *   3 SNAPSHOT STALENESS — the design input is HAND-SAVED; no CI can refresh
 *     it, so an untouched dump would otherwise report green forever. Same
 *     gate as parity/diff.ts, same `MAX_SNAPSHOT_AGE_DAYS` override.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { loadConfig, outDir, idPrefix } from '../extract/config.js';
import { extractReactTsx } from '../extract/adapters/react-tsx.js';
import { extractCem } from '../extract/adapters/cem.js';
import { designSnapshotAge, loadDesign } from '../extract/reconcile.js';
import { isEventCallbackName, normalizeName } from '../extract/types.js';
import type { ExtractedComponent } from '../extract/types.js';

interface Finding {
  surface: 'code' | 'design';
  classification: 'ahead' | 'behind' | 'mismatch';
  subject: string;
  detail: string;
  remedy: string;
}

const RESERVED = new Set(['children', 'className', 'style', 'ref', 'key', 'id']);
const isEnum = (t: unknown): t is { enum: string[] } =>
  typeof t === 'object' && t !== null && 'enum' in (t as object);
const sortedSet = (xs: string[]) => [...new Set(xs.map(normalizeName))].sort().join('|');
/** The full diagnostic run as a FUNCTION (Phase 1): the ds-contracts CLI's
 *  `diff` verb and the `npm run diagnose` script share this one code path.
 *  Returns the process exit code (0 clean, 1 drift) — output text unchanged. */
export function runDiagnose(configArg?: string): number {
  const { config, from } = loadConfig(configArg);
  console.log(`Config: ${from}`);

  const contractsDir = config.diagnose?.contracts ?? path.join(outDir(config), 'contracts');
  if (!existsSync(contractsDir)) {
    throw new Error(`Contracts directory not found: ${contractsDir} — run \`npm run extract:code\` first, or point diagnose.contracts at your adopted contracts.`);
  }
  const contracts: Contract[] = readdirSync(contractsDir)
    .filter((f) => f.endsWith('.contract.json'))
    .map((f) => ContractSchema.parse(JSON.parse(readFileSync(path.join(contractsDir, f), 'utf8'))));
  if (contracts.length === 0) throw new Error(`No *.contract.json in ${contractsDir}`);

  const code: ExtractedComponent[] =
    config.code.adapter === 'react-tsx'
      ? extractReactTsx(config.code.root!)
      : extractCem(config.code.manifest!);
  const codeByName = new Map(code.map((c) => [normalizeName(c.name), c]));

  const design = config.design?.source ? loadDesign(config.design.source) : null;
  const designByName = design ? new Map(design.map((d) => [normalizeName(d.name), d])) : null;

  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);

  // Rule 1 — the vendor prefix. `idPrefix` is the same config key
  // extract/run.ts hands reconcile as `stripCodePrefix`; using anything else
  // here would let the two referees disagree about the same two surfaces.
  const prefix = normalizeName(idPrefix(config)) || null;
  const prefixMatched: string[] = [];
  const usedDesign = new Set<string>();
  /** Design set for a contract: exact normalized name first, then the same
   *  prefix strip reconcile uses. Returns which rule fired. */
  const designFor = (name: string) => {
    if (!designByName) return null;
    const n = normalizeName(name);
    const direct = designByName.get(n);
    if (direct) return { d: direct, viaPrefix: false };
    if (prefix && n.startsWith(prefix)) {
      const stripped = designByName.get(n.slice(prefix.length));
      if (stripped) return { d: stripped, viaPrefix: true };
    }
    return null;
  };

  // Rule 3 — snapshot staleness. Identical gate + override to parity/diff.ts.
  const MAX_SNAPSHOT_AGE_DAYS = Number(process.env.MAX_SNAPSHOT_AGE_DAYS ?? 14);
  const age = config.design?.source ? designSnapshotAge(config.design.source) : null;
  if (design && !age) {
    console.warn(
      `⚠ design snapshot freshness unverifiable (${config.design?.source}) — staleness NOT checked`,
    );
  }
  if (age && age.ageDays > MAX_SNAPSHOT_AGE_DAYS) {
    add({
      surface: 'design',
      classification: 'mismatch',
      subject: 'design-snapshot',
      detail:
        `${age.file} is ${age.ageDays.toFixed(1)} days old (max ${MAX_SNAPSHOT_AGE_DAYS}, override via MAX_SNAPSHOT_AGE_DAYS; age from ${age.basis}) — ` +
        'a hand-saved design dump cannot be refreshed by CI, so every design result below is only as current as this file',
      remedy: 'Re-run extract/figma-dump.js in the design file and save it over this dump',
    });
  }

  for (const contract of contracts) {
    // ---- code ⟷ contract -----------------------------------------------
    const c = codeByName.get(normalizeName(contract.name));
    if (!c) {
      add({
        surface: 'code',
        classification: 'behind',
        subject: contract.name,
        detail: `No component named "${contract.name}" found by the ${config.code.adapter} adapter`,
        remedy: 'Implement it, or retire the contract',
      });
    } else {
      const contractCodeNames = new Set<string>();
      for (const p of contract.props) {
        const codeName = p.bindings.code.prop;
        contractCodeNames.add(codeName);
        if (codeName === 'children') continue;
        const found = c.props.find((cp) => cp.name === codeName);
        if (!found) {
          add({
            surface: 'code',
            classification: 'behind',
            subject: `${contract.name}.${codeName}`,
            detail: `Contract prop "${p.name}" missing from the code component`,
            remedy: 'Add the prop in code, or remove it from the contract (major version)',
          });
          continue;
        }
        if (isEnum(p.type)) {
          const want = sortedSet(p.type.enum);
          const got = sortedSet(found.values ?? []);
          if (found.kind === 'enum' && want !== got) {
            add({
              surface: 'code',
              classification: 'mismatch',
              subject: `${contract.name}.${codeName}`,
              detail: `Enum values differ — contract: [${p.type.enum.join(', ')}], code: [${(found.values ?? []).join(', ')}]`,
              remedy: 'Promote the code change into the contract, or fix the code',
            });
          }
        }
        // Compare stringified: adapters may surface 5 vs "5" for the same
        // authored default — a type-representation difference, not drift.
        if (p.default !== undefined && found.default !== undefined && String(p.default) !== String(found.default)) {
          add({
            surface: 'code',
            classification: 'mismatch',
            subject: `${contract.name}.${codeName} (default)`,
            detail: `Default differs — contract: ${JSON.stringify(p.default)}, code: ${JSON.stringify(found.default)}`,
            remedy: 'Promote or fix',
          });
        }
      }
      for (const ev of contract.events ?? []) {
        contractCodeNames.add(ev.bindings.code.prop);
        if (!c.props.some((cp) => cp.name === ev.bindings.code.prop)) {
          add({
            surface: 'code',
            classification: 'behind',
            subject: `${contract.name}.${ev.bindings.code.prop}`,
            detail: `Contract event "${ev.name}" callback missing from the code component`,
            remedy: 'Add the callback, or remove the event from the contract',
          });
        }
      }
      for (const cp of c.props) {
        if (contractCodeNames.has(cp.name) || RESERVED.has(cp.name)) continue;
        if (cp.kind === 'node' || cp.kind === 'other') continue; // outside declared scope
        // Non-on* function props (render props, formatters) are outside the
        // contracted API surface BY THE SAME RULE the proposer applies
        // (extract/types.ts isEventCallbackName): propose receipts the skip,
        // so the referee flagging it as [code AHEAD] would be the pipeline
        // disagreeing with itself — not drift.
        if (cp.kind === 'event' && !isEventCallbackName(cp.name)) continue;
        add({
          surface: 'code',
          classification: 'ahead',
          subject: `${contract.name}.${cp.name}`,
          detail: `Code declares ${cp.kind} prop "${cp.name}" the contract does not define`,
          remedy: 'Review + promote into the contract, or remove from code',
        });
      }
    }

    // ---- design ⟷ contract ---------------------------------------------
    if (!designByName) continue;
    // Native-representation contracts (layout primitives) intentionally have
    // no design component set — the concept IS the canvas capability.
    if (contract.figmaRepresentation === 'native') continue;
    const hit = designFor(contract.name);
    if (!hit) {
      add({
        surface: 'design',
        classification: 'behind',
        subject: contract.name,
        detail:
          `No design component set named like "${contract.name}"` +
          (prefix ? ` (also tried without the "${idPrefix(config)}" prefix)` : ''),
        remedy: 'Create the set, or retire the contract',
      });
      continue;
    }
    const d = hit.d;
    usedDesign.add(normalizeName(d.name));
    if (hit.viaPrefix) prefixMatched.push(`${contract.name} ⇄ ${d.name}`);
    const claimed = new Set<string>();
    for (const p of contract.props) {
      const fig = p.bindings.figma;
      if (!fig?.property) continue; // kind NONE (arrayOf): code-only by declared fidelity limit
      const figProperty = fig.property;
      if (isEnum(p.type) && fig.kind === 'VARIANT') {
        const axis = Object.entries(d.variantProps).find(
          ([an]) => normalizeName(an) === normalizeName(figProperty),
        );
        if (!axis) {
          add({
            surface: 'design',
            classification: 'behind',
            subject: `${contract.name}.${fig.property}`,
            detail: `Variant axis "${fig.property}" missing from the design set`,
            remedy: 'Add the axis, or remove the prop from the contract',
          });
          continue;
        }
        claimed.add(axis[0]);
        const expected = fig.values
          ? Object.values(fig.values as Record<string, string>)
          : p.type.enum;
        if (sortedSet(expected) !== sortedSet(axis[1])) {
          add({
            surface: 'design',
            classification: 'mismatch',
            subject: `${contract.name}.${fig.property}`,
            detail: `Variant options differ — contract expects [${expected.join(', ')}], design has [${axis[1].join(', ')}]`,
            remedy: 'Promote the design change into the contract, or fix the design set',
          });
        }
      } else if (fig.kind === 'BOOLEAN' || fig.kind === 'TEXT') {
        const pool = fig.kind === 'BOOLEAN' ? d.boolProps : d.textProps;
        const hit = pool.find((n) => normalizeName(n) === normalizeName(figProperty));
        if (hit) claimed.add(hit);
        else {
          add({
            surface: 'design',
            classification: 'behind',
            subject: `${contract.name}.${fig.property}`,
            detail: `${fig.kind} property "${fig.property}" missing from the design set`,
            remedy: 'Add it, or adjust the contract binding',
          });
        }
      }
    }
    for (const [axisName, options] of Object.entries(d.variantProps)) {
      if (!claimed.has(axisName)) {
        add({
          surface: 'design',
          classification: 'ahead',
          subject: `${contract.name}.${axisName}`,
          detail: `Design declares variant axis "${axisName}" [${options.join(', ')}] the contract does not define`,
          remedy: 'Review + promote into the contract, or remove the axis',
        });
      }
    }
  }

  // Rule 2 — the orphan sweep. Everything above iterates CONTRACTS, so a
  // design set no contract mentions cannot produce a finding there. In a
  // brownfield kit that set is the whole question: it is shipping to
  // designers with nothing owning it.
  if (designByName) {
    for (const [norm, d] of designByName) {
      if (usedDesign.has(norm)) continue;
      add({
        surface: 'design',
        classification: 'ahead',
        subject: d.name,
        detail: `No contract claims design component set "${d.name}" — it ships to designers unowned by the contract layer`,
        remedy: 'Extract/author a contract for it, or retire the set',
      });
    }
  }

  const out = outDir(config);
  mkdirSync(out, { recursive: true });
  writeFileSync(
    path.join(out, 'diagnose-report.json'),
    JSON.stringify(
      {
        contractsDir,
        codeAdapter: config.code.adapter,
        designChecked: designByName !== null,
        designSource: config.design?.source ?? null,
        designSets: design?.length ?? null,
        // Recorded even when green: a report that cannot say how old its
        // design input is cannot be read as evidence about today. `ageDays` is
        // the one field here measured against the CLOCK rather than the
        // inputs — on a fresh clone a `file-mtime` basis reads ~0, which is
        // why the pilot README states its finding count both ways.
        designSnapshot: age
          ? {
              ageDays: Number(age.ageDays.toFixed(2)),
              stampMs: Math.round(age.stampMs),
              basis: age.basis,
              file: age.file,
            }
          : null,
        codePrefixStripped: prefix ? idPrefix(config) : null,
        prefixMatched,
        findings,
      },
      null,
      2,
    ) + '\n',
  );

  if (!designByName) {
    console.log('ℹ design surface not provided — design checks SKIPPED (set design.source to include them)');
  } else {
    console.log(
      `ℹ design surface: ${design!.length} set(s) from ${config.design!.source}` +
        (age ? ` (${age.ageDays.toFixed(1)}d old by ${age.basis})` : ' (age unverifiable)'),
    );
    if (prefixMatched.length > 0) {
      console.log(
        `ℹ ${prefixMatched.length} contract(s) matched a design set only after stripping the "${idPrefix(config)}" code prefix: ${prefixMatched.join(', ')}`,
      );
    }
  }
  if (findings.length === 0) {
    console.log(
      `✔ Diagnostic clean — ${contracts.length} contract(s) hold on the checked surface(s). Report → ${out}/diagnose-report.json`,
    );
  } else {
    console.error(`✘ ${findings.length} finding(s):`);
    for (const f of findings) {
      console.error(`  [${f.surface} ${f.classification.toUpperCase()}] ${f.subject} — ${f.detail}`);
    }
    console.error(`Report → ${out}/diagnose-report.json`);
    return 1;
  }
  return 0;
}

// Direct-run shell: `npm run diagnose [-- path/to/extract.config.json]`.
// Filename-matched so bundling into the ds-contracts CLI never triggers it.
if (process.argv[1] && /diagnose\.(m?[tj]s)$/.test(path.resolve(process.argv[1]))) {
  const [, , configArg] = process.argv;
  process.exit(runDiagnose(configArg));
}
