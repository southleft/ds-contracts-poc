/**
 * QUARANTINE BOUNDARY CHECK — `npm run extract:computed:quarantine:check`.
 *
 * WHAT BROKE (held-out exam, Bootstrap 5, 2026-09-04). The capture sweep had no
 * per-component boundary. Bootstrap's `.spinner-grow` starts its infinite
 * keyframe at `transform: scale(0)`, so `${stage} > *` filtered to visible
 * resolves EMPTY, `hover()` times out at 30s, and the throw left the whole
 * sweep. Nothing was written and the other NINE components were never
 * attempted — they could be reported neither as passes nor as failures.
 *
 * WHAT THIS GUARDS. Not that the boundary exists — that a blanket `catch` never
 * replaces it. `run.ts` states the rule: "quarantine is for a contract the
 * generator registry refuses, never a way to swallow a bug." A boundary that
 * quarantines anything it is handed would turn every engine fault into a
 * per-component shrug, and this file fails the moment it does.
 *
 * The planted shapes are the real ones: the Bootstrap spinner's zero-area
 * children, and the four ways a timeout is NOT the library's fault.
 */
import { quarantineVerdict } from './capture.js';

const timeout = { name: 'TimeoutError', message: 'locator.hover: Timeout 30000ms exceeded.' };
const thrown = { name: 'Error', message: 'strict mode violation: resolved to 2 elements' };

const cases: Array<{ what: string; err: typeof timeout | null; boxes: Array<{ tag: string; w: number; h: number }> | null; want: boolean }> = [
  {
    what: "Bootstrap's spinner-grow: timeout + every child zero-area → QUARANTINE",
    err: timeout,
    boxes: [{ tag: 'div', w: 0, h: 0 }],
    want: true,
  },
  {
    what: 'a zero-WIDTH but tall child still has no pointable area → QUARANTINE',
    err: timeout,
    boxes: [{ tag: 'div', w: 0, h: 32 }],
    want: true,
  },
  {
    what: 'timeout but a child HAS area → engine fault, must re-throw',
    err: timeout,
    boxes: [{ tag: 'div', w: 0, h: 0 }, { tag: 'span', w: 48, h: 20 }],
    want: false,
  },
  {
    what: 'timeout but the stage was not found → engine fault, must re-throw',
    err: timeout,
    boxes: null,
    want: false,
  },
  {
    what: 'timeout but the stage has no children → nothing mounted, engine fault',
    err: timeout,
    boxes: [],
    want: false,
  },
  {
    what: 'a THROWN error, whatever the boxes → engine fault, must re-throw',
    err: thrown,
    boxes: [{ tag: 'div', w: 0, h: 0 }],
    want: false,
  },
  {
    what: 'no error object at all → engine fault, must re-throw',
    err: null,
    boxes: [{ tag: 'div', w: 0, h: 0 }],
    want: false,
  },
];

let failed = 0;
for (const c of cases) {
  const got = quarantineVerdict(c.err, c.boxes);
  const ok = got.quarantine === c.want;
  if (!ok) failed++;
  console.log(`  ${ok ? '✔' : '✖'} ${c.what}`);
  if (!ok) console.log(`      wanted quarantine=${c.want}, got ${got.quarantine} — ${got.why}`);
}

const swallowed = cases.filter((c) => !c.want && quarantineVerdict(c.err, c.boxes).quarantine);
if (swallowed.length > 0) {
  console.error(
    `\n✖ extract:computed:quarantine:check — the boundary SWALLOWED ${swallowed.length} engine fault(s). ` +
      `A quarantine that accepts anything is not a boundary, it is a catch-all, and run.ts forbids it by name.`,
  );
  process.exit(1);
}
if (failed > 0) {
  console.error(`\n✖ extract:computed:quarantine:check — ${failed} case(s) disagree`);
  process.exit(1);
}
console.log(
  `\n✔ extract:computed:quarantine:check — ${cases.length} planted shapes: the boundary quarantines only a mounted component whose every child has zero area, and re-throws all ${cases.filter((c) => !c.want).length} engine-fault shapes`,
);
