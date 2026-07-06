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
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { loadConfig, outDir } from '../extract/config.js';
import { extractReactTsx } from '../extract/adapters/react-tsx.js';
import { extractCem } from '../extract/adapters/cem.js';
import { loadDesign } from '../extract/reconcile.js';
import { normalizeName } from '../extract/types.js';
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

const [, , configArg] = process.argv;
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
  const d = designByName.get(normalizeName(contract.name));
  if (!d) {
    add({
      surface: 'design',
      classification: 'behind',
      subject: contract.name,
      detail: `No design component set named like "${contract.name}"`,
      remedy: 'Create the set, or retire the contract',
    });
    continue;
  }
  const claimed = new Set<string>();
  for (const p of contract.props) {
    const fig = p.bindings.figma;
    if (!fig?.property) continue;
    if (isEnum(p.type) && fig.kind === 'VARIANT') {
      const axis = Object.entries(d.variantProps).find(
        ([an]) => normalizeName(an) === normalizeName(fig.property),
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
      const hit = pool.find((n) => normalizeName(n) === normalizeName(fig.property));
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

const out = outDir(config);
mkdirSync(out, { recursive: true });
writeFileSync(
  path.join(out, 'diagnose-report.json'),
  JSON.stringify(
    {
      contractsDir,
      codeAdapter: config.code.adapter,
      designChecked: designByName !== null,
      findings,
    },
    null,
    2,
  ) + '\n',
);

if (!designByName) {
  console.log('ℹ design surface not provided — design checks SKIPPED (set design.source to include them)');
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
  process.exit(1);
}
