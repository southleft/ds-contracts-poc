/**
 * HUG-CEILING PIN (task #37) — "a 320-wide Carbon button can never come back".
 *
 * THE DEFECT THIS PINS. Carbon's Button is `inline-size: max-content;
 * max-inline-size: 20rem`: the box HUGS its label under a 320px ceiling. The
 * Figma emitter used to bake a ROOT's `max-width` as a FIXED width (parts had
 * bound the real `maxWidth` field since the molecule round, but roots were
 * EXEMPTED by name), so every Carbon Button variant rendered 320px wide with
 * its label stranded at the left edge by the root's own
 * `justify: space-between`. The control was in the same paste: the SAME button
 * nested in Modal's footer — a part, so it got the ceiling — hugged at 125px.
 *
 * WHAT IT ASSERTS, per component, from the contract and the built mock tree:
 *   1. STRUCTURAL — a part carrying the measured `hugsBelowMaxWidth` fact must
 *      compile to a `maxWidth` BINDING, never a `fixedWidth`. (The fixedWidth
 *      is what bakes the cap into a width.)
 *   2. MEASURED — every built variant cell of such a root must be STRICTLY
 *      NARROWER than its own ceiling. A cell sitting exactly at the ceiling is
 *      the defect returning, whatever the spec says.
 *
 * The fact itself is a MEASUREMENT, not a list: extract/computed records
 * `hugsBelowMaxWidth` only when the captured element's used width stayed below
 * its captured max-width in every enumerated combo. A contract with no such
 * measurement (every hand-authored `{size.card.width}` root in this repo) is
 * not covered here and keeps the design-width lowering.
 *
 * ONE implementation, shared by every per-library compile receipt — the
 * `countChildWider` precedent (scripts/child-wider.mjs).
 */

const descend = (n, out = []) => { out.push(n); for (const c of n.children ?? []) descend(c, out); return out; };

/** Parts (by name) whose contract carries the measured hug fact. */
export function hugParts(contract) {
  const out = [];
  const visit = (name, part) => {
    if (part.hugsBelowMaxWidth === true) out.push(name);
    for (const [childName, child] of Object.entries(part.parts ?? {})) visit(childName, child);
  };
  for (const [name, part] of Object.entries(contract.anatomy ?? {})) visit(name, part);
  return out;
}

/**
 * @param {object}   o
 * @param {object}   o.contract  the promoted contract
 * @param {object}   o.entry     the emitted COMPONENTS payload entry
 * @param {object}   o.mockRoot  the built mock document root
 * @param {string}   o.name      script stem, for the message
 * @returns {string[]} failure messages (empty = pass)
 */
export function checkHugCeiling({ contract, entry, mockRoot, name }) {
  const failures = [];
  const parts = hugParts(contract);
  if (parts.length === 0) return failures;
  const rootHugs = contract.anatomy?.root?.hugsBelowMaxWidth === true;

  // 1. STRUCTURAL — over the emitted specs.
  const specs = (entry.variants ?? [{ spec: entry.spec }]).map((v) => v.spec).filter(Boolean);
  for (const spec of specs) {
    if (!rootHugs) break;
    if (spec.fixedWidth) {
      failures.push(
        `${name} D7 hug-ceiling pin: root variant "${spec.name}" compiled a fixedWidth of ${spec.fixedWidth.px}px from \`${spec.fixedWidth.varName}\` — the contract carries the MEASURED fact that this root hugs BENEATH its max-width, so the cap must bind Figma's \`maxWidth\` field, not bake a width`,
      );
      break;
    }
    if (!spec.bindings?.maxWidth) {
      failures.push(
        `${name} D7 hug-ceiling pin: root variant "${spec.name}" carries neither a fixedWidth nor a \`maxWidth\` binding — the measured ceiling was dropped entirely`,
      );
      break;
    }
  }

  // 2. MEASURED — over the built canvas.
  const allCells = mockRoot.findAll((n) => n.type === 'COMPONENT' && n.parent?.type === 'COMPONENT_SET');
  const cells = allCells.length > 0 ? allCells : mockRoot.findAll((n) => n.type === 'COMPONENT');
  for (const cell of cells) {
    for (const node of descend(cell)) {
      const partName = node === cell ? 'root' : node.name;
      if (!parts.includes(partName)) continue;
      const ceiling = node.maxWidth;
      if (typeof ceiling !== 'number' || !Number.isFinite(ceiling)) continue;
      if (node.width >= ceiling - 0.01) {
        failures.push(
          `${name} D7 hug-ceiling pin: "${partName}" in variant "${cell.name}" is ${Math.round(node.width * 100) / 100}px against a ${ceiling}px ceiling — a box that was MEASURED hugging beneath its max-width must never render AT it (this is the 320-wide Carbon Button, exactly)`,
        );
      }
    }
  }
  return failures.slice(0, 4);
}
