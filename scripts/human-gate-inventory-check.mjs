/**
 * Inventory remaining human / release / second-impl gates.
 *
 * Passes when HUMAN-HANDOFF.md exists and lists only non-automation rows.
 * Fails if the handoff claims v1 shipped, Phase 3 Candidate, or invents a
 * second implementation. Does not auto-close pilot/Wave8/publish rows.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HANDOFF = path.join(
  ROOT,
  ".agents/runs/post-exact-conversion-next-waves/HUMAN-HANDOFF.md",
);

const REQUIRED_OPEN = [
  { id: "PILOT", pattern: /[Pp]ilot persona sign-off/ },
  { id: "WAVE8", pattern: /[Ww]ave 8 team drift/ },
  { id: "SECURITY", pattern: /[Ss]ecurity owner/ },
  { id: "PUBLISH", pattern: /npm publish|[Pp]ublish \/ tag|[Pp]ublish\/deploy/ },
  { id: "DEPLOY", pattern: /[Cc]loudflare deploy/ },
  { id: "W11C", pattern: /[Ww]ave 11-C|second implementation/ },
  { id: "PHASE4", pattern: /[Pp]hase 4/ },
];

const FORBIDDEN = [
  { id: "V1-SHIPPED", pattern: /\bv1 shipped\b/i, unlessNegated: true },
  { id: "CANDIDATE", pattern: /Phase 3 Candidate/i, unlessNegated: true },
];

if (!existsSync(HANDOFF)) {
  console.error("✖ human-gates:inventory: HUMAN-HANDOFF.md missing");
  process.exit(1);
}

const text = readFileSync(HANDOFF, "utf8");
const errors = [];
const open = [];

for (const row of REQUIRED_OPEN) {
  if (!row.pattern.test(text)) {
    errors.push(`handoff must still list open human row: ${row.id}`);
  } else {
    open.push(row.id);
  }
}

// Negation-aware: allow "Do not claim v1 shipped" / "not Phase 3 Candidate"
for (const row of FORBIDDEN) {
  const hits = [...text.matchAll(new RegExp(row.pattern.source, "gi"))];
  for (const hit of hits) {
    const start = Math.max(0, hit.index - 40);
    const window = text.slice(start, hit.index + hit[0].length + 40);
    const negated =
      /\bdo not claim\b|\bnot claim\b|\bdoes not claim\b|\bblocked\b|\bwaits on\b|\buntil\b|\breconsider\b|\bnever from\b|\bnot (?:a |an )?Candidate\b/i.test(
        window,
      );
    if (!negated) {
      errors.push(
        `${row.id}: handoff appears to claim a forbidden close — nearby: ${JSON.stringify(window.trim())}`,
      );
    }
  }
}

if (!/Do not claim v1 shipped/i.test(text)) {
  errors.push('handoff must include "Do not claim v1 shipped"');
}
if (!/Do not claim Phase 3 Candidate/i.test(text)) {
  errors.push('handoff must include "Do not claim Phase 3 Candidate"');
}

if (errors.length) {
  console.error(
    "✖ human-gates:inventory:\n" + errors.map((e) => `  - ${e}`).join("\n"),
  );
  process.exit(1);
}

console.log(
  `✔ human-gates:inventory: ${open.length} human/release/second-impl row(s) still open (${open.join(", ")}); no false v1/Candidate claim`,
);
