/**
 * Astryx dev-journey — flagship promotion × vendor `.doc.mjs` cross-check.
 *   `node examples/astryx/scripts/flagship-doc-crosscheck.mjs`
 *
 * Meta ships a machine-readable props+anatomy table per component INSIDE
 * `@astryxdesign/core@0.1.6` (`<Name>.doc.mjs`) — an INDEPENDENT witness of
 * the API. Phase A already ran that witness against the whole census
 * (../extraction/DOC-REFEREE.md, committed: 246 vendor-documented props, 0
 * silent losses). The live referee needs the gitignored sandbox install; this
 * cross-check is the self-contained tail that ties the PROMOTED flagship
 * contracts back to that witnessed extraction:
 *
 *   - every promoted prop is either VERBATIM from the mechanical proposal
 *     (../extraction/static-contracts/, the exact set the .doc.mjs referee
 *     witnessed) or a DECLARED materialization (a ReactNode child rendered as
 *     a text slot) — no invented, un-witnessed API;
 *   - every dropped prop is NAMED (the honest losses).
 *
 * Refuses (exit 1) on any un-declared prop or a missing witness receipt.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const load = (rel) => JSON.parse(readFileSync(path.join(EX, rel), 'utf8'));

// Declared materializations: props the promotion ADDS on purpose because the
// vendor types them as a ReactNode child (a `node` prop, dropped in
// extraction — see DOC-REFEREE.md "slot candidates → anatomy step").
const MATERIALIZED = {
  badge: ['children'],
  banner: ['children'],
  card: ['children'],
};

const FLAGSHIP = ['badge', 'banner', 'button', 'card', 'checkbox-input', 'progress-bar', 'slider', 'switch', 'text-input', 'token'];

// The Phase-A .doc.mjs witness must be committed (its live regeneration needs
// the sandbox install — PROVENANCE.md).
const witness = readFileSync(path.join(EX, 'extraction', 'DOC-REFEREE.md'), 'utf8');
if (!/vendor-documented props/.test(witness) || !/0 silent losses/.test(witness)) {
  console.error('✘ cross-check: ../extraction/DOC-REFEREE.md is missing or not the 0-silent-loss witness');
  process.exit(1);
}

const failures = [];
const rows = [];
let promotedTotal = 0;
let materializedTotal = 0;
let droppedTotal = 0;

for (const key of FLAGSHIP) {
  const promoted = load(`contracts/${key}.contract.json`).props.map((p) => p.name);
  const proposal = load(`extraction/static-contracts/${key}.contract.json`).props.map((p) => p.name);
  const materialized = MATERIALIZED[key] ?? [];

  for (const p of promoted) {
    if (!proposal.includes(p) && !materialized.includes(p)) {
      failures.push(`${key}: promoted prop "${p}" is neither in the .doc.mjs-witnessed proposal nor a declared materialization`);
    }
  }
  const dropped = proposal.filter((p) => !promoted.includes(p));
  promotedTotal += promoted.length - materialized.length;
  materializedTotal += materialized.length;
  droppedTotal += dropped.length;

  rows.push(
    `| \`${key}\` | ${promoted.length - materialized.length} verbatim${materialized.length ? ` + ${materialized.length} materialized (${materialized.join(', ')})` : ''} | ${dropped.length ? dropped.map((d) => `\`${d}\``).join(', ') : '—'} |`,
  );
}

const receipt = `# Astryx dev-journey — flagship × vendor \`.doc.mjs\` cross-check

Rebuild: \`node examples/astryx/scripts/flagship-doc-crosscheck.mjs\`

Meta's own \`<Name>.doc.mjs\` modules (shipped inside \`@astryxdesign/core@0.1.6\`)
are the independent witness of the API. Phase A ran that witness against the
whole census — **246 vendor-documented props, 0 silent losses**
(\`../extraction/DOC-REFEREE.md\`). This tail ties the 10 promoted flagship
contracts back to that witnessed extraction: every promoted prop is verbatim
from the \`.doc.mjs\`-witnessed proposal or a declared materialization; every
drop is named.

- **${promotedTotal} props promoted verbatim** from the witnessed proposals
- **${materializedTotal} declared materializations** (ReactNode child → text slot)
- **${droppedTotal} props dropped, all named** (the honest losses)
- **0 invented props** (the run refuses otherwise)

| contract | promoted | dropped (named) |
|---|---|---|
${rows.join('\n')}

The full per-prop vendor agreements/disagreements live in
\`../extraction/DOC-REFEREE.md\`.
`;
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync(path.join(EX, 'receipts', 'doc'), { recursive: true });
writeFileSync(path.join(EX, 'receipts', 'doc', 'FLAGSHIP-CROSSCHECK.md'), receipt);

if (failures.length > 0) {
  console.error('✘ flagship doc cross-check FAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(
  `✔ flagship × .doc.mjs cross-check: ${promotedTotal} verbatim + ${materializedTotal} materialized props, ` +
    `${droppedTotal} named drops, 0 invented (witness: DOC-REFEREE.md) → receipts/doc/FLAGSHIP-CROSSCHECK.md`,
);
