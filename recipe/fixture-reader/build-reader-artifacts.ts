/**
 * FIXTURE READER — artifact builder (docs/35 Phase 1–2).
 *
 *   npx tsx recipe/fixture-reader/build-reader-artifacts.ts           # write
 *   npx tsx recipe/fixture-reader/build-reader-artifacts.ts --check   # byte-freshness
 *
 * Reads committed capture ledgers + fixture tables, runs mapping tables, writes
 * per-archetype reader JSON, proposed tables, and DRIFT-REPORT.md.
 * Nothing here touches recipe/fixtures/*. Byte-deterministic; `--check` refuses
 * on any byte difference.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  CHAKRA_CHECKBOX_LEDGER,
  chakraCheckboxAdapterConfig,
  chakraCheckboxMappings,
} from "../fixtures/generated/checkbox.chakra.js";
import {
  SHADCN_CHECKBOX_LEDGER,
  shadcnCheckboxAdapterConfig,
  shadcnCheckboxMappings,
} from "../fixtures/generated/checkbox.shadcn.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Ledger } from "./ledger.js";
import { runMappings, tokenLeaves, isReceipt, type FactMapping, type ReaderRow } from "./reader.js";

import {
  muiCheckboxMappings,
  antdCheckboxMappings,
  astryxCheckboxMappings,
  muiCheckPathEqual,
  astryxCheckPathEqual,
  MUI_CHECKBOX_LEDGER,
  ANTD_CHECKBOX_LEDGER,
  ASTRYX_CHECKBOX_LEDGER,
} from "./mappings-checkbox.js";
import {
  muiTextareaMappings,
  antdTextareaMappings,
  astryxTextareaMappings,
  MUI_TEXTAREA_LEDGER,
  ANTD_TEXTAREA_LEDGER,
  ASTRYX_TEXTAREA_LEDGER,
} from "./mappings-textarea.js";
import {
  muiRadioMappings,
  antdRadioMappings,
  astryxRadioMappings,
  MUI_RADIO_LEDGER,
  ANTD_RADIO_LEDGER,
} from "./mappings-radio.js";
import {
  muiSwitchMappings,
  antdSwitchMappings,
  astryxSwitchMappings,
  MUI_SWITCH_LEDGER,
  ANTD_SWITCH_LEDGER,
  ASTRYX_SWITCH_LEDGER,
} from "./mappings-switch.js";
import {
  muiAlertMappings,
  antdAlertMappings,
  astryxAlertMappings,
  MUI_ALERT_LEDGER,
  ANTD_ALERT_LEDGER,
  ASTRYX_ALERT_LEDGER,
} from "./mappings-alert.js";
import {
  muiChipMappings,
  antdChipMappings,
  astryxChipMappings,
  MUI_CHIP_LEDGER,
  ANTD_CHIP_LEDGER,
  ASTRYX_CHIP_LEDGER,
} from "./mappings-chip.js";
import {
  muiBadgeMappings,
  antdBadgeMappings,
  astryxBadgeMappings,
  MUI_BADGE_LEDGER,
  ANTD_BADGE_LEDGER,
} from "./mappings-badge.js";
import {
  muiAvatarMappings,
  antdAvatarMappings,
  astryxAvatarMappings,
  MUI_AVATAR_LEDGER,
  ANTD_AVATAR_LEDGER,
} from "./mappings-avatar.js";
import {
  muiLinkMappings,
  antdLinkMappings,
  astryxLinkMappings,
  MUI_LINK_LEDGER,
} from "./mappings-link.js";
import {
  muiTooltipMappings,
  antdTooltipMappings,
  astryxTooltipMappings,
  MUI_TOOLTIP_LEDGER,
  ANTD_TOOLTIP_LEDGER,
} from "./mappings-tooltip.js";
import {
  muiTabsMappings,
  antdTabsMappings,
  astryxTabsMappings,
  MUI_TABS_LEDGER,
} from "./mappings-tabs.js";
import {
  muiMenuMappings,
  antdMenuMappings,
  astryxMenuMappings,
  MUI_MENU_LEDGER,
} from "./mappings-menu.js";
import {
  muiDialogMappings,
  antdDialogMappings,
  astryxDialogMappings,
  MUI_DIALOG_LEDGER,
} from "./mappings-dialog.js";
import {
  astryxCheckboxAdapterConfig,
  muiCheckboxAdapterConfig,
  antdCheckboxAdapterConfig,
} from "../fixtures/library-checkboxes.js";
import {
  astryxTextareaAdapterConfig,
  muiTextareaAdapterConfig,
  antdTextareaAdapterConfig,
} from "../fixtures/library-textareas.js";
import {
  astryxRadioAdapterConfig,
  muiRadioAdapterConfig,
  antdRadioAdapterConfig,
} from "../fixtures/library-radios.js";
import {
  astryxSwitchAdapterConfig,
  muiSwitchAdapterConfig,
  antdSwitchAdapterConfig,
} from "../fixtures/library-switches.js";
import {
  astryxAlertAdapterConfig,
  muiAlertAdapterConfig,
  antdAlertAdapterConfig,
} from "../fixtures/library-alerts.js";
import {
  astryxChipAdapterConfig,
  muiChipAdapterConfig,
  antdChipAdapterConfig,
} from "../fixtures/library-chips.js";
import {
  muiBadgeAdapterConfig,
  antdBadgeAdapterConfig,
} from "../fixtures/library-badges.js";
import {
  astryxAvatarAdapterConfig,
  muiAvatarAdapterConfig,
  antdAvatarAdapterConfig,
} from "../fixtures/library-avatars.js";
import {
  astryxLinkAdapterConfig,
  muiLinkAdapterConfig,
  antdLinkAdapterConfig,
} from "../fixtures/library-links.js";
import {
  astryxTooltipAdapterConfig,
  muiTooltipAdapterConfig,
  antdTooltipAdapterConfig,
} from "../fixtures/library-tooltips.js";
import {
  astryxTabsAdapterConfig,
  muiTabsAdapterConfig,
  antdTabsAdapterConfig,
} from "../fixtures/library-tabs.js";
import {
  astryxMenuAdapterConfig,
  muiMenuAdapterConfig,
  antdMenuAdapterConfig,
} from "../fixtures/library-menus.js";
import {
  astryxDialogAdapterConfig,
  muiDialogAdapterConfig,
  antdDialogAdapterConfig,
} from "../fixtures/library-dialogs.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(REPO, "recipe", "fixture-reader", "out");
const CHECK = process.argv.includes("--check");

export type Archetype =
  | "checkbox"
  | "textarea"
  | "radio"
  | "switch"
  | "alert"
  | "chip"
  | "badge"
  | "avatar"
  | "link"
  | "tooltip"
  | "tabs"
  | "menu"
  | "dialog";

interface Typo {
  requestedFamily: string;
  requestedStyle: string;
}

interface Subject {
  archetype: Archetype;
  library: "astryx" | "mui" | "antd";
  source: { packageName: string; version: string; exportName: string };
  /** null = receipt-only subject (no capture ledger). */
  ledgerFile: string | null;
  tokens: Record<string, unknown>;
  mappings: FactMapping[];
  extras: Map<string, number | string>;
  customEqual?: Record<string, (fixture: string, captured: string) => boolean>;
}

const EXTRA_KEYS = [
  "listMode",
  "itemAlign",
  "labelLineHeightUnit",
  "rowAlign",
  // The thumb's CSS box-shadow, carried as the library's literal declaration
  // and lowered to Figma effects at compile. A plain string like rowAlign, so
  // it reaches the reader as an extra rather than a {variable, fallback} leaf.
  "thumbShadow",
  // checkbox@1's box shadow — the same shape (shadcn's shadow-xs; none elsewhere).
  "boxShadow",
  "hitClips",
  "trackClips",
  "strokeAlign",
  "lineHeightUnit",
  "decoration",
  "textCase",
  // Nested string leaf (tabs@1): the tab's content alignment. EXTRA_KEYS are
  // resolved as dotted paths below, so a nested spelling is allowed.
  "tab.contentAlign",
] as const;

const atPath = (tokens: Record<string, unknown>, dotted: string): unknown =>
  dotted.split(".").reduce<unknown>((cur, part) => (cur && typeof cur === "object" ? (cur as Record<string, unknown>)[part] : undefined), tokens);

function extrasFor(tokens: Record<string, unknown>, mappings: FactMapping[]): Map<string, number | string> {
  const mapped = new Set(mappings.map((m) => m.path));
  const out = new Map<string, number | string>();
  for (const k of EXTRA_KEYS) {
    if (!mapped.has(k)) continue;
    const v = atPath(tokens, k);
    if (typeof v === "string" || typeof v === "boolean" || typeof v === "number") {
      out.set(k, typeof v === "boolean" ? String(v) : v);
    }
  }
  const typo = tokens.typography as Record<string, Typo> | undefined;
  if (typo) {
    for (const [name, spec] of Object.entries(typo)) {
      if (spec?.requestedFamily && mapped.has(`typography.${name}.family`)) {
        out.set(`typography.${name}.family`, spec.requestedFamily);
      }
      if (spec?.requestedStyle && mapped.has(`typography.${name}.style`)) {
        out.set(`typography.${name}.style`, spec.requestedStyle);
      }
    }
  }
  return out;
}

function checkboxExtras(tokens: Record<string, unknown>): Map<string, number | string> {
  const t = tokens as { rowAlign: string; boxShadow: string; check: { path: string }; typography: { label: Typo } };
  return new Map<string, number | string>([
    ["rowAlign", t.rowAlign],
    ["boxShadow", t.boxShadow],
    ["check.path", t.check.path],
    ["typography.label.family", t.typography.label.requestedFamily],
    ["typography.label.style", t.typography.label.requestedStyle],
  ]);
}

function textareaExtras(tokens: Record<string, unknown>): Map<string, number | string> {
  const t = tokens as { typography: { label: Typo; value: Typo } };
  return new Map<string, number | string>([
    ["typography.label.family", t.typography.label.requestedFamily],
    ["typography.label.style", t.typography.label.requestedStyle],
    ["typography.value.family", t.typography.value.requestedFamily],
    ["typography.value.style", t.typography.value.requestedStyle],
  ]);
}

const src = (c: { benchmark: { packageName: string; version: string; exportName: string } }) => ({
  packageName: c.benchmark.packageName,
  version: c.benchmark.version,
  exportName: c.benchmark.exportName,
});

/** Astryx Badge overlay is refused — reuse MUI leaf paths so every refusal receipt has a fixture leaf. */
function badgeAstryxTokens(): Record<string, unknown> {
  return muiBadgeAdapterConfig.tokens as unknown as Record<string, unknown>;
}

const SUBJECTS: Subject[] = [
  // —— checkbox / textarea (Phase 1) ——
  {
    archetype: "checkbox",
    library: "astryx",
    source: src(astryxCheckboxAdapterConfig),
    ledgerFile: ASTRYX_CHECKBOX_LEDGER,
    tokens: astryxCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: astryxCheckboxMappings,
    extras: checkboxExtras(astryxCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>),
    customEqual: { "check.path": astryxCheckPathEqual },
  },
  {
    archetype: "checkbox",
    library: "mui",
    source: src(muiCheckboxAdapterConfig),
    ledgerFile: MUI_CHECKBOX_LEDGER,
    tokens: muiCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiCheckboxMappings,
    extras: checkboxExtras(muiCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>),
    customEqual: { "check.path": muiCheckPathEqual },
  },
  {
    // PROPOSED, not transcribed: recipe/fixtures/generated/checkbox.chakra.ts
    // was written by recipe/fixture-reader/propose-fixture.ts from this same
    // ledger through the role schema; the gate verifies the proposal reads
    // back unchanged (every non-receipt leaf must match).
    archetype: "checkbox",
    library: "chakra",
    source: src(chakraCheckboxAdapterConfig),
    ledgerFile: CHAKRA_CHECKBOX_LEDGER,
    tokens: chakraCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: chakraCheckboxMappings,
    extras: checkboxExtras(chakraCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>),
  },
  {
    // PROPOSED from a BARE control: no label part (the recipe's label-less
    // cell), colours declared in oklch, the indeterminate glyph a named gap.
    archetype: "checkbox",
    library: "shadcn",
    source: src(shadcnCheckboxAdapterConfig),
    ledgerFile: SHADCN_CHECKBOX_LEDGER,
    tokens: shadcnCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: shadcnCheckboxMappings,
    extras: checkboxExtras(shadcnCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>),
  },
  {
    archetype: "checkbox",
    library: "antd",
    source: src(antdCheckboxAdapterConfig),
    ledgerFile: ANTD_CHECKBOX_LEDGER,
    tokens: antdCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdCheckboxMappings,
    extras: checkboxExtras(antdCheckboxAdapterConfig.tokens as unknown as Record<string, unknown>),
  },
  {
    archetype: "textarea",
    library: "astryx",
    source: src(astryxTextareaAdapterConfig),
    ledgerFile: ASTRYX_TEXTAREA_LEDGER,
    tokens: astryxTextareaAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: astryxTextareaMappings,
    extras: textareaExtras(astryxTextareaAdapterConfig.tokens as unknown as Record<string, unknown>),
  },
  {
    archetype: "textarea",
    library: "mui",
    source: src(muiTextareaAdapterConfig),
    ledgerFile: MUI_TEXTAREA_LEDGER,
    tokens: muiTextareaAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiTextareaMappings,
    extras: textareaExtras(muiTextareaAdapterConfig.tokens as unknown as Record<string, unknown>),
  },
  {
    archetype: "textarea",
    library: "antd",
    source: src(antdTextareaAdapterConfig),
    ledgerFile: ANTD_TEXTAREA_LEDGER,
    tokens: antdTextareaAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdTextareaMappings,
    extras: textareaExtras(antdTextareaAdapterConfig.tokens as unknown as Record<string, unknown>),
  },
  // —— Phase 2 ——
  {
    archetype: "radio",
    library: "astryx",
    source: src(astryxRadioAdapterConfig),
    ledgerFile: null,
    tokens: astryxRadioAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: astryxRadioMappings,
    extras: extrasFor(astryxRadioAdapterConfig.tokens as unknown as Record<string, unknown>, astryxRadioMappings),
  },
  {
    archetype: "radio",
    library: "mui",
    source: src(muiRadioAdapterConfig),
    ledgerFile: MUI_RADIO_LEDGER,
    tokens: muiRadioAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiRadioMappings,
    extras: extrasFor(muiRadioAdapterConfig.tokens as unknown as Record<string, unknown>, muiRadioMappings),
  },
  {
    archetype: "radio",
    library: "antd",
    source: src(antdRadioAdapterConfig),
    ledgerFile: ANTD_RADIO_LEDGER,
    tokens: antdRadioAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdRadioMappings,
    extras: extrasFor(antdRadioAdapterConfig.tokens as unknown as Record<string, unknown>, antdRadioMappings),
  },
  {
    archetype: "switch",
    library: "astryx",
    source: src(astryxSwitchAdapterConfig),
    ledgerFile: ASTRYX_SWITCH_LEDGER,
    tokens: astryxSwitchAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: astryxSwitchMappings,
    extras: extrasFor(astryxSwitchAdapterConfig.tokens as unknown as Record<string, unknown>, astryxSwitchMappings),
  },
  {
    archetype: "switch",
    library: "mui",
    source: src(muiSwitchAdapterConfig),
    ledgerFile: MUI_SWITCH_LEDGER,
    tokens: muiSwitchAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiSwitchMappings,
    extras: extrasFor(muiSwitchAdapterConfig.tokens as unknown as Record<string, unknown>, muiSwitchMappings),
  },
  {
    archetype: "switch",
    library: "antd",
    source: src(antdSwitchAdapterConfig),
    ledgerFile: ANTD_SWITCH_LEDGER,
    tokens: antdSwitchAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdSwitchMappings,
    extras: extrasFor(antdSwitchAdapterConfig.tokens as unknown as Record<string, unknown>, antdSwitchMappings),
  },
  {
    archetype: "alert",
    library: "astryx",
    source: src(astryxAlertAdapterConfig),
    ledgerFile: ASTRYX_ALERT_LEDGER,
    tokens: astryxAlertAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: astryxAlertMappings,
    extras: extrasFor(astryxAlertAdapterConfig.tokens as unknown as Record<string, unknown>, astryxAlertMappings),
  },
  {
    archetype: "alert",
    library: "mui",
    source: src(muiAlertAdapterConfig),
    ledgerFile: MUI_ALERT_LEDGER,
    tokens: muiAlertAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiAlertMappings,
    extras: extrasFor(muiAlertAdapterConfig.tokens as unknown as Record<string, unknown>, muiAlertMappings),
  },
  {
    archetype: "alert",
    library: "antd",
    source: src(antdAlertAdapterConfig),
    ledgerFile: ANTD_ALERT_LEDGER,
    tokens: antdAlertAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdAlertMappings,
    extras: extrasFor(antdAlertAdapterConfig.tokens as unknown as Record<string, unknown>, antdAlertMappings),
  },
  {
    archetype: "chip",
    library: "astryx",
    source: src(astryxChipAdapterConfig),
    ledgerFile: ASTRYX_CHIP_LEDGER,
    tokens: astryxChipAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: astryxChipMappings,
    extras: extrasFor(astryxChipAdapterConfig.tokens as unknown as Record<string, unknown>, astryxChipMappings),
  },
  {
    archetype: "chip",
    library: "mui",
    source: src(muiChipAdapterConfig),
    ledgerFile: MUI_CHIP_LEDGER,
    tokens: muiChipAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiChipMappings,
    extras: extrasFor(muiChipAdapterConfig.tokens as unknown as Record<string, unknown>, muiChipMappings),
  },
  {
    archetype: "chip",
    library: "antd",
    source: src(antdChipAdapterConfig),
    ledgerFile: ANTD_CHIP_LEDGER,
    tokens: antdChipAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdChipMappings,
    extras: extrasFor(antdChipAdapterConfig.tokens as unknown as Record<string, unknown>, antdChipMappings),
  },
  {
    archetype: "badge",
    library: "astryx",
    source: {
      packageName: "@astryxdesign/core",
      version: "0.1.6",
      exportName: "Badge (overlay refused)",
    },
    ledgerFile: null,
    tokens: badgeAstryxTokens(),
    mappings: astryxBadgeMappings,
    extras: extrasFor(badgeAstryxTokens(), astryxBadgeMappings),
  },
  {
    archetype: "badge",
    library: "mui",
    source: src(muiBadgeAdapterConfig),
    ledgerFile: MUI_BADGE_LEDGER,
    tokens: muiBadgeAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiBadgeMappings,
    extras: extrasFor(muiBadgeAdapterConfig.tokens as unknown as Record<string, unknown>, muiBadgeMappings),
  },
  {
    archetype: "badge",
    library: "antd",
    source: src(antdBadgeAdapterConfig),
    ledgerFile: ANTD_BADGE_LEDGER,
    tokens: antdBadgeAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdBadgeMappings,
    extras: extrasFor(antdBadgeAdapterConfig.tokens as unknown as Record<string, unknown>, antdBadgeMappings),
  },
  {
    archetype: "avatar",
    library: "astryx",
    source: src(astryxAvatarAdapterConfig),
    ledgerFile: null,
    tokens: astryxAvatarAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: astryxAvatarMappings,
    extras: extrasFor(astryxAvatarAdapterConfig.tokens as unknown as Record<string, unknown>, astryxAvatarMappings),
  },
  {
    archetype: "avatar",
    library: "mui",
    source: src(muiAvatarAdapterConfig),
    ledgerFile: MUI_AVATAR_LEDGER,
    tokens: muiAvatarAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiAvatarMappings,
    extras: extrasFor(muiAvatarAdapterConfig.tokens as unknown as Record<string, unknown>, muiAvatarMappings),
  },
  {
    archetype: "avatar",
    library: "antd",
    source: src(antdAvatarAdapterConfig),
    ledgerFile: ANTD_AVATAR_LEDGER,
    tokens: antdAvatarAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdAvatarMappings,
    extras: extrasFor(antdAvatarAdapterConfig.tokens as unknown as Record<string, unknown>, antdAvatarMappings),
  },
  {
    archetype: "link",
    library: "astryx",
    source: src(astryxLinkAdapterConfig),
    ledgerFile: null,
    tokens: astryxLinkAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: astryxLinkMappings,
    extras: extrasFor(astryxLinkAdapterConfig.tokens as unknown as Record<string, unknown>, astryxLinkMappings),
  },
  {
    archetype: "link",
    library: "mui",
    source: src(muiLinkAdapterConfig),
    ledgerFile: MUI_LINK_LEDGER,
    tokens: muiLinkAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiLinkMappings,
    extras: extrasFor(muiLinkAdapterConfig.tokens as unknown as Record<string, unknown>, muiLinkMappings),
  },
  {
    archetype: "link",
    library: "antd",
    source: src(antdLinkAdapterConfig),
    ledgerFile: null,
    tokens: antdLinkAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdLinkMappings,
    extras: extrasFor(antdLinkAdapterConfig.tokens as unknown as Record<string, unknown>, antdLinkMappings),
  },
  {
    archetype: "tooltip",
    library: "astryx",
    source: src(astryxTooltipAdapterConfig),
    ledgerFile: null,
    tokens: astryxTooltipAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: astryxTooltipMappings,
    extras: extrasFor(astryxTooltipAdapterConfig.tokens as unknown as Record<string, unknown>, astryxTooltipMappings),
  },
  {
    archetype: "tooltip",
    library: "mui",
    source: src(muiTooltipAdapterConfig),
    ledgerFile: MUI_TOOLTIP_LEDGER,
    tokens: muiTooltipAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiTooltipMappings,
    extras: extrasFor(muiTooltipAdapterConfig.tokens as unknown as Record<string, unknown>, muiTooltipMappings),
  },
  {
    archetype: "tooltip",
    library: "antd",
    source: src(antdTooltipAdapterConfig),
    ledgerFile: ANTD_TOOLTIP_LEDGER,
    tokens: antdTooltipAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdTooltipMappings,
    extras: extrasFor(antdTooltipAdapterConfig.tokens as unknown as Record<string, unknown>, antdTooltipMappings),
  },
  {
    archetype: "tabs",
    library: "astryx",
    source: src(astryxTabsAdapterConfig),
    ledgerFile: null,
    tokens: astryxTabsAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: astryxTabsMappings,
    extras: extrasFor(astryxTabsAdapterConfig.tokens as unknown as Record<string, unknown>, astryxTabsMappings),
  },
  {
    archetype: "tabs",
    library: "mui",
    source: src(muiTabsAdapterConfig),
    ledgerFile: MUI_TABS_LEDGER,
    tokens: muiTabsAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiTabsMappings,
    extras: extrasFor(muiTabsAdapterConfig.tokens as unknown as Record<string, unknown>, muiTabsMappings),
  },
  {
    archetype: "tabs",
    library: "antd",
    source: src(antdTabsAdapterConfig),
    ledgerFile: null,
    tokens: antdTabsAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdTabsMappings,
    extras: extrasFor(antdTabsAdapterConfig.tokens as unknown as Record<string, unknown>, antdTabsMappings),
  },
  {
    archetype: "menu",
    library: "astryx",
    source: src(astryxMenuAdapterConfig),
    ledgerFile: null,
    tokens: astryxMenuAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: astryxMenuMappings,
    extras: extrasFor(astryxMenuAdapterConfig.tokens as unknown as Record<string, unknown>, astryxMenuMappings),
  },
  {
    archetype: "menu",
    library: "mui",
    source: src(muiMenuAdapterConfig),
    ledgerFile: MUI_MENU_LEDGER,
    tokens: muiMenuAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiMenuMappings,
    extras: extrasFor(muiMenuAdapterConfig.tokens as unknown as Record<string, unknown>, muiMenuMappings),
  },
  {
    archetype: "menu",
    library: "antd",
    source: src(antdMenuAdapterConfig),
    ledgerFile: null,
    tokens: antdMenuAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdMenuMappings,
    extras: extrasFor(antdMenuAdapterConfig.tokens as unknown as Record<string, unknown>, antdMenuMappings),
  },
  {
    archetype: "dialog",
    library: "astryx",
    source: src(astryxDialogAdapterConfig),
    ledgerFile: null,
    tokens: astryxDialogAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: astryxDialogMappings,
    extras: extrasFor(astryxDialogAdapterConfig.tokens as unknown as Record<string, unknown>, astryxDialogMappings),
  },
  {
    archetype: "dialog",
    library: "mui",
    source: src(muiDialogAdapterConfig),
    ledgerFile: MUI_DIALOG_LEDGER,
    tokens: muiDialogAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiDialogMappings,
    extras: extrasFor(muiDialogAdapterConfig.tokens as unknown as Record<string, unknown>, muiDialogMappings),
  },
  {
    archetype: "dialog",
    library: "antd",
    source: src(antdDialogAdapterConfig),
    ledgerFile: null,
    tokens: antdDialogAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdDialogMappings,
    extras: extrasFor(antdDialogAdapterConfig.tokens as unknown as Record<string, unknown>, antdDialogMappings),
  },
];

export interface SubjectResult {
  archetype: string;
  library: string;
  source: { packageName: string; version: string; exportName: string };
  ledgerFile: string | null;
  rows: ReaderRow[];
  counts: { match: number; drift: number; receipt: number; unread: number };
}

export function runSubject(s: Subject): SubjectResult {
  const leaves = tokenLeaves(s.tokens);
  for (const [k, v] of s.extras) leaves.set(k, v);

  let rows: ReaderRow[];
  try {
  if (s.ledgerFile === null) {
    if (!s.mappings.every(isReceipt)) {
      throw new Error(
        `${s.archetype}/${s.library}: ledgerFile is null but mappings include ledger reads — every fact must be a named receipt`,
      );
    }
    // Receipt-only: no ledger needed.
    rows = runMappings(
      new Ledger(REPO, ASTRYX_CHECKBOX_LEDGER), // unused; all receipts
      leaves,
      s.mappings,
    );
  } else {
    const ledger = new Ledger(REPO, s.ledgerFile);
    rows = runMappings(ledger, leaves, s.mappings);
  }
  } catch (e) {
    throw new Error(`${s.archetype}/${s.library}: ${(e as Error).message}`);
  }

  for (const row of rows) {
    const eq = s.customEqual?.[row.path];
    if (eq && row.verdict === "drift" && typeof row.fixtureValue === "string" && typeof row.capturedValue === "string") {
      if (eq(row.fixtureValue, row.capturedValue)) {
        row.verdict = "match";
        row.proposedValue = row.fixtureValue;
      }
    }
  }
  const counts = { match: 0, drift: 0, receipt: 0, unread: 0 };
  for (const r of rows) counts[r.verdict]++;
  return {
    archetype: s.archetype,
    library: s.library,
    source: s.source,
    ledgerFile: s.ledgerFile,
    rows,
    counts,
  };
}

const ARCHETYPES: Archetype[] = [
  "checkbox",
  "textarea",
  "radio",
  "switch",
  "alert",
  "chip",
  "badge",
  "avatar",
  "link",
  "tooltip",
  "tabs",
  "menu",
  "dialog",
];

export function buildAll(): Record<string, SubjectResult[]> {
  const results = SUBJECTS.map(runSubject);
  const out: Record<string, SubjectResult[]> = {};
  for (const a of ARCHETYPES) out[a] = results.filter((r) => r.archetype === a);
  return out;
}

function proposedTables(results: SubjectResult[]): unknown {
  return results.map((r) => ({
    library: r.library,
    archetype: r.archetype,
    source: r.source,
    ledger: r.ledgerFile,
    note:
      "PROPOSED reviewed table — review input for a Phase-2 fixture update + remint. Every `proposed` value is either the fixture value (verdict match/receipt, carried) or the CAPTURED value (verdict drift). Nothing overwrites recipe/fixtures/* without review.",
    values: Object.fromEntries(
      r.rows.map((row) => [
        row.path,
        {
          fixture: row.fixtureValue,
          proposed: row.proposedValue,
          verdict: row.verdict,
          ...(row.capturedValue !== undefined ? { captured: row.capturedValue } : {}),
          provenance: row.ledgerKeys
            ? row.ledgerKeys.join(" ; ") + (row.formula ? ` — ${row.formula}` : "")
            : `RECEIPT: ${row.receipt} [${row.evidence}]`,
          ...(row.tolerance ? { tolerance: row.tolerance, toleranceReason: row.toleranceReason } : {}),
        },
      ]),
    ),
  }));
}

function driftReport(all: Record<string, SubjectResult[]>): string {
  const L: string[] = [];
  L.push("# Fixture drift report — the reader vs the reviewed tables");
  L.push("");
  L.push(
    "> Generated by `recipe/fixture-reader/build-reader-artifacts.ts` from the committed capture ledgers (`extract/computed/out/**/captured-truth.json` — Chromium computed style of the real npm packages) against the committed fixture tables (`recipe/fixtures/library-*.ts`). No Figma writes. `overallSuccess` stays false. Product v1 remains INCOMPLETE.",
  );
  L.push(">");
  L.push(
    "> **drift** rows propose the CAPTURED value; adoption + remint is Phase 2 (docs/35 §4) and stays a reviewed act. Drift rows are carried by name in `recipe/fixture-reader/reviewed-drift.json`; an UN-carried drift fails `recipe:fixture-drift:check` closed.",
  );
  L.push(">");
  L.push(
    "> **Honesty (Phase 2):** Astryx `#262626` / Figtree / `#737373` capture values under `<Theme theme={neutralTheme}>` are **capture-theme-unavailable** relative to the branded `#0064E0` recipes (astryx.css :root / Calendar signed surface) — do **not** adopt the dark-neutral palette. AntD Checkbox `dash.height` 2→8 is the named indeterminate-square lowering — do **not** remint a filled square. MUI Checkbox/Textarea: 0 drift.",
  );
  L.push("");
  for (const a of ARCHETYPES) {
    const results = all[a];
    if (!results?.length) continue;
    L.push(`## ${a[0]!.toUpperCase()}${a.slice(1)}`);
    L.push("");
    for (const r of results) {
      L.push(`### ${r.library} — ${r.source.packageName}@${r.source.version}#${r.source.exportName}`);
      L.push("");
      if (r.ledgerFile === null) {
        L.push(
          `ledger _(none — receipt-only)_ · ${r.rows.length} facts: **${r.counts.match} match**, **${r.counts.drift} drift**, ${r.counts.receipt} named receipts, ${r.counts.unread} unread`,
        );
      } else {
        L.push(
          `ledger \`${r.ledgerFile}\` · ${r.rows.length} facts: **${r.counts.match} match**, **${r.counts.drift} drift**, ${r.counts.receipt} named receipts, ${r.counts.unread} unread`,
        );
      }
      L.push("");
      const drifts = r.rows.filter((x) => x.verdict === "drift" || x.verdict === "unread");
      if (drifts.length === 0) {
        L.push("No drift — every mapped fact equals the ledger value (or is a named receipt).");
      } else {
        L.push("| fact | fixture | captured | ledger key |");
        L.push("|---|---|---|---|");
        for (const d of drifts) {
          L.push(
            `| \`${d.path}\` | \`${String(d.fixtureValue)}\` | \`${String(d.capturedValue ?? `UNREAD: ${d.error}`)}\` | ${d.ledgerKeys?.map((k) => `\`${k}\``).join("<br>") ?? ""} |`,
          );
        }
      }
      L.push("");
    }
  }
  L.push("## Receipts (facts the ledger cannot express)");
  L.push("");
  for (const a of ARCHETYPES) {
    for (const r of all[a] ?? []) {
      for (const row of r.rows.filter((x) => x.verdict === "receipt")) {
        L.push(
          `- **${r.archetype}/${r.library}** \`${row.path}\` = \`${String(row.fixtureValue)}\` — ${row.receipt} _[${row.evidence}]_`,
        );
      }
    }
  }
  L.push("");
  return L.join("\n");
}

function stringify(v: unknown): string {
  return JSON.stringify(v, null, 2) + "\n";
}

function main(): void {
  const all = buildAll();
  const files: Record<string, string> = {
    "DRIFT-REPORT.md": driftReport(all),
  };
  for (const a of ARCHETYPES) {
    files[`${a}.reader.json`] = stringify(all[a]);
    files[`${a}.proposed-tables.json`] = stringify(proposedTables(all[a]!));
  }
  if (CHECK) {
    const stale: string[] = [];
    for (const [name, contents] of Object.entries(files)) {
      const p = path.join(OUT, name);
      if (!existsSync(p) || readFileSync(p, "utf8") !== contents) stale.push(name);
    }
    if (stale.length > 0) {
      console.error(
        `✗ recipe/fixture-reader/out is STALE: ${stale.join(", ")} — regenerate with \`npx tsx recipe/fixture-reader/build-reader-artifacts.ts\``,
      );
      process.exit(1);
    }
    console.log(`✔ recipe/fixture-reader/out is byte-fresh (${Object.keys(files).length} files)`);
    return;
  }
  mkdirSync(OUT, { recursive: true });
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(path.join(OUT, name), contents);
  }
  const totals = { match: 0, drift: 0, receipt: 0, unread: 0 };
  for (const a of ARCHETYPES) {
    for (const r of all[a]!) {
      totals.match += r.counts.match;
      totals.drift += r.counts.drift;
      totals.receipt += r.counts.receipt;
      totals.unread += r.counts.unread;
      console.log(
        `${r.archetype}/${r.library}: ${r.counts.match} match · ${r.counts.drift} drift · ${r.counts.receipt} receipts · ${r.counts.unread} unread`,
      );
    }
  }
  console.log(
    `TOTAL: ${totals.match} match · ${totals.drift} drift · ${totals.receipt} receipts · ${totals.unread} unread → recipe/fixture-reader/out/`,
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
