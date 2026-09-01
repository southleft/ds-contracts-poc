/**
 * docs/35 Phase 4 — new libraries via the reader (no hand-authored fixture tables).
 *
 * Each subject is either:
 *   mapped          — a committed capture ledger exists; the reader proposes a
 *                     table from ledger reads (review input, never a silent
 *                     overwrite of recipe/fixtures/*).
 *   capture-pending — the library is wired, but this archetype has no capture
 *                     yet (named reason).
 *   mount-blocked   — the Playwright floor refused to mount; exact blocker named.
 *
 * `recipe:fixture-drift:check` asserts every Phase-4 subject is one of those
 * three by name — never silently absent.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Ledger } from "./ledger.js";
import { hex8, px } from "./ledger.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export type Phase4Status = "mapped" | "capture-pending" | "mount-blocked";

export interface Phase4Subject {
  id: string;
  library: "shadcn" | "chakra";
  archetype: "checkbox" | "textarea";
  packageName: string;
  version: string;
  exportName: string;
  /** Relative ledger path when captured; null when not. */
  ledgerFile: string | null;
  status: Phase4Status;
  /** Why status is not mapped (required unless mapped). */
  receipt?: string;
  evidence?: string;
}

function ledgerExists(rel: string | null): boolean {
  return !!rel && existsSync(path.join(REPO, rel));
}

/** Resolve live status from disk so a capture landing flips mapped without editing this table twice. */
export function resolvePhase4Subjects(): Phase4Subject[] {
  const shadcnCheckboxLedger = "extract/computed/out/shadcn/checkbox/captured-truth.json";
  const chakraCheckboxLedger = "extract/computed/out/chakra/checkbox/captured-truth.json";
  const chakraTextareaLedger = "extract/computed/out/chakra/textarea/captured-truth.json";

  const subjects: Phase4Subject[] = [
    {
      id: "shadcn/checkbox",
      library: "shadcn",
      archetype: "checkbox",
      packageName: "@shadcn-sandbox/ui",
      version: "0.0.1",
      exportName: "Checkbox",
      ledgerFile: shadcnCheckboxLedger,
      status: ledgerExists(shadcnCheckboxLedger) ? "mapped" : "capture-pending",
      receipt: ledgerExists(shadcnCheckboxLedger)
        ? undefined
        : "shadcn Checkbox capture ledger missing under extract/computed/out/shadcn/checkbox/",
      evidence: "extract/computed/configs/shadcn.json Checkbox; examples/shadcn sandbox",
    },
    {
      id: "shadcn/textarea",
      library: "shadcn",
      archetype: "textarea",
      packageName: "@shadcn-sandbox/ui",
      version: "0.0.1",
      exportName: "Textarea",
      ledgerFile: null,
      status: "capture-pending",
      receipt:
        "Textarea is NOT in the vendored shadcn registry slice (examples/shadcn/.shadcn-sandbox/src/components/ui has alert/avatar/badge/button/card/checkbox/dialog/input/select/switch/tabs/tooltip — no textarea.tsx). Adding it would be a new registry fetch, not a reader subject of the existing capture floor.",
      evidence: "examples/shadcn/.shadcn-sandbox/src/components/ui/; extract/computed/configs/shadcn.json components list",
    },
    {
      id: "chakra/checkbox",
      library: "chakra",
      archetype: "checkbox",
      packageName: "@chakra-ui/react",
      version: "3.37.0",
      exportName: "CheckboxRoot",
      ledgerFile: chakraCheckboxLedger,
      status: ledgerExists(chakraCheckboxLedger) ? "mapped" : "capture-pending",
      receipt: ledgerExists(chakraCheckboxLedger)
        ? undefined
        : "Chakra Checkbox capture not yet committed — run extract:computed against examples/chakra/.chakra-sandbox",
      evidence: "extract/computed/configs/chakra.json; examples/chakra/README.md",
    },
    {
      id: "chakra/textarea",
      library: "chakra",
      archetype: "textarea",
      packageName: "@chakra-ui/react",
      version: "3.37.0",
      exportName: "Textarea",
      ledgerFile: chakraTextareaLedger,
      status: ledgerExists(chakraTextareaLedger) ? "mapped" : "capture-pending",
      receipt: ledgerExists(chakraTextareaLedger)
        ? undefined
        : "Chakra Textarea capture not yet committed — run extract:computed against examples/chakra/.chakra-sandbox",
      evidence: ledgerExists(chakraTextareaLedger)
        ? "extract/computed/out/chakra/textarea/captured-truth.json (ledger written); contract QUARANTINED — scroll-padding-block-end/scroll-padding-bottom not in TOKEN_CHANNELS (see REFUSAL.md). Proposed table is ledger-only; no enriched contract shipped."
        : "extract/computed/configs/chakra.json; examples/chakra/README.md",
    },
  ];
  return subjects;
}

export interface ProposedLeaf {
  path: string;
  value: number | string;
  ledgerKey: string;
  formula: string;
}

/** Propose a thin checkbox table from a capture ledger — review input only. */
export function proposeCheckboxFromLedger(ledgerFile: string): ProposedLeaf[] {
  const ledger = new Ledger(REPO, ledgerFile);
  const keys = ledger.keys();
  const unchecked = keys.find((k) => k.startsWith("unchecked.") && k.endsWith("__default"))
    ?? keys.find((k) => k.includes("unchecked") && k.endsWith("__default"));
  const checked = keys.find((k) => k.startsWith("checked.") && k.endsWith("__default") && !k.startsWith("unchecked"))
    ?? keys.find((k) => /(^|[.])checked[.]/.test(k) && k.endsWith("__default") && !k.includes("unchecked"));
  if (!unchecked) {
    throw new Error(`${ledgerFile}: no unchecked.__default capture key among ${keys.join(", ")}`);
  }
  const combo = (k: string) => k.replace(/__default$/, "");

  const tryRead = (
    pathName: string,
    comboKey: string,
    part: string,
    channel: string,
    kind: "px" | "color",
  ): ProposedLeaf | null => {
    try {
      const raw = ledger.raw(`${comboKey}__default`, part, channel);
      let value: number | string;
      if (kind === "px") value = px(raw);
      else {
        // Carry the computed spelling when it is not rgb()/rgba() (oklch, etc.) —
        // never invent a hex. The proposal quotes the ledger raw.
        try {
          value = hex8(raw);
        } catch {
          value = raw;
        }
      }
      return {
        path: pathName,
        value,
        ledgerKey: `${ledgerFile}#${comboKey}__default ${part}.${channel}`,
        formula: `ledger ${part}.${channel} @ ${comboKey}__default`,
      };
    } catch {
      return null;
    }
  };

  const out: ProposedLeaf[] = [];
  // Prefer identity-class parts; fall back to root.
  const controlParts = ["cls:chakra-checkbox__control", "cls:MuiSvgIcon-root", "root"];
  const rootParts = ["cls:chakra-checkbox__root", "root"];

  for (const part of rootParts) {
    const leaf = tryRead("wrapper.width", combo(unchecked), part, "width", "px");
    if (leaf) {
      out.push(leaf);
      break;
    }
  }
  for (const part of controlParts) {
    const size = tryRead("box.size", combo(unchecked), part, "width", "px");
    if (size) {
      out.push(size);
      const radius = tryRead("box.radius", combo(unchecked), part, "border-top-left-radius", "px");
      if (radius) out.push(radius);
      break;
    }
  }
  if (checked) {
    for (const part of controlParts) {
      const fill = tryRead("states.checked.enabled.box", combo(checked), part, "background-color", "color");
      if (fill) {
        out.push(fill);
        break;
      }
    }
  }
  return out;
}

/** Propose a thin textarea table from a capture ledger — review input only. */
export function proposeTextareaFromLedger(ledgerFile: string): ProposedLeaf[] {
  const ledger = new Ledger(REPO, ledgerFile);
  const keys = ledger.keys();
  const empty = keys.find((k) => k.startsWith("empty.") && k.endsWith("__default"))
    ?? keys.find((k) => k.includes("empty") && k.endsWith("__default"))
    ?? keys.find((k) => k.endsWith("__default"));
  if (!empty) {
    throw new Error(`${ledgerFile}: no default capture key among ${keys.join(", ")}`);
  }
  const combo = empty.replace(/__default$/, "");
  const out: ProposedLeaf[] = [];
  const tryRead = (pathName: string, part: string, channel: string, kind: "px" | "color"): void => {
    try {
      const raw = ledger.raw(`${combo}__default`, part, channel);
      out.push({
        path: pathName,
        value: kind === "px" ? px(raw) : hex8(raw),
        ledgerKey: `${ledgerFile}#${combo}__default ${part}.${channel}`,
        formula: `ledger ${part}.${channel} @ ${combo}__default`,
      });
    } catch {
      /* skip — proposed table is a best-effort projection, not a closed mapping */
    }
  };
  tryRead("root.width", "root", "width", "px");
  tryRead("root.minHeight", "root", "min-height", "px");
  tryRead("root.radius", "root", "border-top-left-radius", "px");
  tryRead("root.borderColor", "root", "border-top-color", "color");
  tryRead("root.color", "root", "color", "color");
  return out;
}

export function buildPhase4Proposals(subjects = resolvePhase4Subjects()): {
  subjects: Phase4Subject[];
  proposals: Array<{
    id: string;
    status: Phase4Status;
    source: { packageName: string; version: string; exportName: string };
    ledgerFile: string | null;
    receipt?: string;
    evidence?: string;
    proposed?: ProposedLeaf[];
    note: string;
  }>;
} {
  const proposals = subjects.map((s) => {
    const base = {
      id: s.id,
      status: s.status,
      source: {
        packageName: s.packageName,
        version: s.version,
        exportName: s.exportName,
      },
      ledgerFile: s.ledgerFile,
      receipt: s.receipt,
      evidence: s.evidence,
      note:
        "PROPOSED reviewed table from capture ledger — docs/35 Phase 4. No hand-authored recipe/fixtures/library-*.ts. Nothing overwrites fixtures without review. No live Figma remint in this phase.",
    };
    if (s.status !== "mapped" || !s.ledgerFile) return base;
    const proposed =
      s.archetype === "checkbox"
        ? proposeCheckboxFromLedger(s.ledgerFile)
        : proposeTextareaFromLedger(s.ledgerFile);
    return { ...base, proposed };
  });
  return { subjects, proposals };
}
