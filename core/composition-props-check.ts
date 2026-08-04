/**
 * PARENT → CHILD PROP MAPPING, ON BOTH SURFACES — `npm run composition-props:check`.
 *
 * WHY THIS EXISTS. docs/12-roadmap.md lists "parent→child prop mapping" as an
 * OPEN declared-schema gap. It is not open — it is implemented on both
 * surfaces and guarded by nothing, which is the more dangerous of the two
 * states and the reason this file exists rather than a feature commit.
 *
 * MEASURED at 2026-08-04 on the committed corpus:
 *   contracts/table.contract.json composes three ds.table-header-cell parts
 *   with `component.props = { density: "{density}" }` — a placeholder naming
 *   the PARENT's own prop.
 *   · CODE surface  src/components/Table/Table.tsx:31-33 renders
 *     `<TableHeaderCell density={density}>` — the placeholder becomes a real
 *     React prop reference.
 *   · CANVAS surface figma-sync/42-table.js carries `"Density": "Comfortable"`
 *     ×3 and `"Density": "Compact"` ×3 — core/emit-figma-script.ts's
 *     mapDepProps resolves PARENT_PROP_REF against each combo's `subst` AT
 *     COMPILE TIME, so the literal string "density" never appears in the
 *     emitted script and a grep for it returns nothing. Inferring absence from
 *     that grep is exactly the mistake this file's measurement avoided.
 *
 * WHAT WOULD BREAK SILENTLY WITHOUT THIS PIN. mapDepProps' resolution is one
 * `if` over a regex. Drop it and the canvas instance receives the literal
 * "{density}" as a variant value, which Figma has no property for — the
 * instance renders the child's DEFAULT on every parent variant, both surfaces
 * still emit, every other gate stays green, and the two surfaces disagree
 * about a component's whole density axis.
 *
 * Reads only committed artifacts. No browser, no network.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures: string[] = [];
const bad = (m: string) => failures.push(m);
const ok = (m: string) => console.log(`  ✔ ${m}`);
const read = (rel: string) => readFileSync(path.join(REPO, rel), 'utf8');

/** Every part.component that maps a PARENT prop into a child, from all roots. */
interface Mapping { contract: string; part: string; depId: string; childProp: string; parentProp: string }
const mappings: Mapping[] = [];
{
  const file = 'contracts/table.contract.json';
  const c = JSON.parse(read(file)) as { anatomy: Record<string, unknown> };
  const walk = (part: Record<string, unknown>, name: string) => {
    const comp = part.component as { id?: string; props?: Record<string, unknown> } | undefined;
    for (const [k, v] of Object.entries(comp?.props ?? {})) {
      const m = typeof v === 'string' ? /^\{([A-Za-z0-9_]+)\}$/.exec(v) : null;
      if (m) mappings.push({ contract: file, part: name, depId: comp!.id!, childProp: k, parentProp: m[1] });
    }
    for (const [k, v] of Object.entries((part.parts ?? {}) as Record<string, Record<string, unknown>>)) walk(v, k);
  };
  for (const [k, v] of Object.entries(c.anatomy as Record<string, Record<string, unknown>>)) walk(v, k);
}

console.log('\n1. the corpus still contains a parent→child mapping to measure');
if (mappings.length === 0) {
  bad('NO parent→child prop mapping found in contracts/table.contract.json — either the corpus moved or the walker broke. A check that passes because it compared nothing is the defect this repo keeps finding.');
} else {
  ok(`${mappings.length} mapping(s): ${mappings.map((m) => `${m.part}.${m.childProp} ← {${m.parentProp}}`).join(', ')}`);
}

console.log('\n2. CODE surface — the placeholder becomes a real prop reference');
{
  const tsx = 'src/components/Table/Table.tsx';
  if (!existsSync(path.join(REPO, tsx))) bad(`${tsx} is missing — the generated code surface cannot be checked`);
  else {
    const src = read(tsx);
    for (const m of mappings) {
      // `density={density}` — the child receives the PARENT's binding, not a literal.
      const wired = new RegExp(`${m.childProp}=\\{${m.parentProp}\\}`).test(src);
      const literal = src.includes(`${m.childProp}="{${m.parentProp}}"`);
      if (literal) bad(`${tsx}: ${m.childProp} is emitted as the LITERAL string "{${m.parentProp}}" — the placeholder was never resolved`);
      else if (!wired) bad(`${tsx}: no \`${m.childProp}={${m.parentProp}}\` — the parent's prop does not reach the child instance on the code surface`);
      else ok(`${tsx}: ${m.childProp}={${m.parentProp}} — parent prop reaches the child`);
    }
  }
}

console.log('\n3. CANVAS surface — the placeholder is RESOLVED per variant, not passed through');
{
  const js = 'figma-sync/42-table.js';
  if (!existsSync(path.join(REPO, js))) bad(`${js} is missing — the emitted canvas surface cannot be checked`);
  else {
    const src = read(js);
    // No placeholder may survive into the emitted script.
    for (const m of mappings) {
      if (src.includes(`{${m.parentProp}}`)) {
        bad(`${js}: the literal placeholder "{${m.parentProp}}" reached the emitted script — Figma has no property for it, so every parent variant would render the child's DEFAULT`);
      }
    }
    // The child's variant values must appear, one per parent enum value.
    const contract = JSON.parse(read('contracts/table.contract.json')) as { props: Array<{ name: string; type: unknown }> };
    for (const m of mappings) {
      const parent = contract.props.find((p) => p.name === m.parentProp);
      const values = parent && typeof parent.type === 'object' && parent.type !== null && 'enum' in parent.type
        ? ((parent.type as { enum: string[] }).enum)
        : [];
      if (values.length === 0) { bad(`contracts/table.contract.json: prop "${m.parentProp}" is not an enum — this check cannot verify per-variant resolution`); continue; }
      const missing = values.filter((v) => {
        const cap = v.charAt(0).toUpperCase() + v.slice(1);
        return !src.includes(`"${cap}"`);
      });
      if (missing.length > 0) bad(`${js}: parent "${m.parentProp}" has values [${values.join(', ')}] but the emitted script carries no child value for [${missing.join(', ')}] — the mapping did not resolve for every variant`);
      else ok(`${js}: every value of {${m.parentProp}} (${values.join(', ')}) is resolved into the child instance at compile time`);
    }
  }
}

if (failures.length > 0) {
  console.error(`\n✘ parent→child prop mapping: ${failures.length} failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✔ parent→child prop mapping holds on BOTH surfaces: the code surface passes the parent binding through, and the canvas surface resolves it per variant at compile time with no placeholder surviving.');
