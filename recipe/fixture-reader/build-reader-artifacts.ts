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
import { MUI_SWITCH_LEDGER as MUI_SWITCH_LEDGER_PROPOSED, muiSwitchAdapterConfig as muiSwitchProposedConfig, muiSwitchMappings as muiSwitchProposedMappings } from "../fixtures/generated/switch.mui.js";
import { SHADCN_SWITCH_LEDGER, shadcnSwitchAdapterConfig, shadcnSwitchMappings } from "../fixtures/generated/switch.shadcn.js";
import { CHAKRA_SWITCH_LEDGER, chakraSwitchAdapterConfig, chakraSwitchMappings } from "../fixtures/generated/switch.chakra.js";
import { CHAKRA_TOOLTIP_LEDGER, chakraTooltipAdapterConfig, chakraTooltipMappings } from "../fixtures/generated/tooltip.chakra.js";
import { ANTD_RADIO_LEDGER as ANTD_RADIO_LEDGER_PROPOSED, antdRadioAdapterConfig as antdRadioProposedConfig, antdRadioMappings as antdRadioProposedMappings } from "../fixtures/generated/radio.antd.js";
import { CHAKRA_RADIO_LEDGER, chakraRadioAdapterConfig, chakraRadioMappings } from "../fixtures/generated/radio.chakra.js";
import { MUI_TEXTAREA_LEDGER as MUI_TEXTAREA_LEDGER_PROPOSED, muiTextareaAdapterConfig as muiTextareaProposedConfig, muiTextareaMappings as muiTextareaProposedMappings } from "../fixtures/generated/textarea.mui.js";
import { ANTD_TEXTAREA_LEDGER as ANTD_TEXTAREA_LEDGER_PROPOSED, antdTextareaAdapterConfig as antdTextareaProposedConfig, antdTextareaMappings as antdTextareaProposedMappings } from "../fixtures/generated/textarea.antd.js";
import { CHAKRA_TEXTAREA_LEDGER, chakraTextareaAdapterConfig, chakraTextareaMappings } from "../fixtures/generated/textarea.chakra.js";
import { MUI_ALERT_LEDGER as MUI_ALERT_LEDGER_PROPOSED, muiAlertAdapterConfig as muiAlertProposedConfig, muiAlertMappings as muiAlertProposedMappings } from "../fixtures/generated/alert.mui.js";
import { CHAKRA_ALERT_LEDGER, chakraAlertAdapterConfig, chakraAlertMappings } from "../fixtures/generated/alert.chakra.js";
import { ANTD_ALERT_LEDGER as ANTD_ALERT_LEDGER_PROPOSED, antdAlertAdapterConfig as antdAlertProposedConfig, antdAlertMappings as antdAlertProposedMappings } from "../fixtures/generated/alert.antd.js";
import { CHAKRA_AVATAR_LEDGER, chakraAvatarAdapterConfig, chakraAvatarMappings } from "../fixtures/generated/avatar.chakra.js";
import { CHAKRA_CHIP_LEDGER, chakraChipAdapterConfig, chakraChipMappings } from "../fixtures/generated/chip.chakra.js";
import { CHAKRA_LINK_LEDGER, chakraLinkAdapterConfig, chakraLinkMappings } from "../fixtures/generated/link.chakra.js";
import { MUI_TABS_LEDGER as MUI_TABS_LEDGER_PROPOSED, muiTabsAdapterConfig as muiTabsProposedConfig, muiTabsMappings as muiTabsProposedMappings } from "../fixtures/generated/tabs.mui.js";
import { CARBON_TABS_LEDGER as CARBON_TABS_LEDGER_PROPOSED, carbonTabsAdapterConfig as carbonTabsProposedConfig, carbonTabsMappings as carbonTabsProposedMappings } from "../fixtures/generated/tabs.carbon.js";
import { ALTITUDE_CHIP_LEDGER as ALTITUDE_CHIP_LEDGER_PROPOSED, altitudeChipAdapterConfig as altitudeChipProposedConfig, altitudeChipMappings as altitudeChipProposedMappings } from "../fixtures/generated/chip.altitude.js";
import { MUI_CHIP_LEDGER as MUI_CHIP_LEDGER_PROPOSED, muiChipAdapterConfig as muiChipProposedConfig, muiChipMappings as muiChipProposedMappings } from "../fixtures/generated/chip.mui.js";
import { ANTD_CHIP_LEDGER as ANTD_CHIP_LEDGER_PROPOSED, antdChipAdapterConfig as antdChipProposedConfig, antdChipMappings as antdChipProposedMappings } from "../fixtures/generated/chip.antd.js";
import { CARBON_CHIP_LEDGER as CARBON_CHIP_LEDGER_PROPOSED, carbonChipAdapterConfig as carbonChipProposedConfig, carbonChipMappings as carbonChipProposedMappings } from "../fixtures/generated/chip.carbon.js";
import { ALTITUDE_LINK_LEDGER as ALTITUDE_LINK_LEDGER_PROPOSED, altitudeLinkAdapterConfig as altitudeLinkProposedConfig, altitudeLinkMappings as altitudeLinkProposedMappings } from "../fixtures/generated/link.altitude.js";
import { MUI_LINK_LEDGER as MUI_LINK_LEDGER_PROPOSED, muiLinkAdapterConfig as muiLinkProposedConfig, muiLinkMappings as muiLinkProposedMappings } from "../fixtures/generated/link.mui.js";
import { ANTD_TOOLTIP_LEDGER as ANTD_TOOLTIP_LEDGER_PROPOSED, antdTooltipAdapterConfig as antdTooltipProposedConfig, antdTooltipMappings as antdTooltipProposedMappings } from "../fixtures/generated/tooltip.antd.js";
import { MUI_TOOLTIP_LEDGER as MUI_TOOLTIP_LEDGER_PROPOSED, muiTooltipAdapterConfig as muiTooltipProposedConfig, muiTooltipMappings as muiTooltipProposedMappings } from "../fixtures/generated/tooltip.mui.js";
import { SHADCN_TOOLTIP_LEDGER as SHADCN_TOOLTIP_LEDGER_PROPOSED, shadcnTooltipAdapterConfig as shadcnTooltipProposedConfig, shadcnTooltipMappings as shadcnTooltipProposedMappings } from "../fixtures/generated/tooltip.shadcn.js";
import { MUI_AVATAR_LEDGER as MUI_AVATAR_LEDGER_PROPOSED, muiAvatarAdapterConfig as muiAvatarProposedConfig, muiAvatarMappings as muiAvatarProposedMappings } from "../fixtures/generated/avatar.mui.js";
import { ANTD_AVATAR_LEDGER as ANTD_AVATAR_LEDGER_PROPOSED, antdAvatarAdapterConfig as antdAvatarProposedConfig, antdAvatarMappings as antdAvatarProposedMappings } from "../fixtures/generated/avatar.antd.js";
import { ALTITUDE_AVATAR_LEDGER as ALTITUDE_AVATAR_LEDGER_PROPOSED, altitudeAvatarAdapterConfig as altitudeAvatarProposedConfig, altitudeAvatarMappings as altitudeAvatarProposedMappings } from "../fixtures/generated/avatar.altitude.js";
import { SHADCN_AVATAR_LEDGER as SHADCN_AVATAR_LEDGER_PROPOSED, shadcnAvatarAdapterConfig as shadcnAvatarProposedConfig, shadcnAvatarMappings as shadcnAvatarProposedMappings } from "../fixtures/generated/avatar.shadcn.js";
import { FLUENT_AVATAR_LEDGER as FLUENT_AVATAR_LEDGER_PROPOSED, fluentAvatarAdapterConfig as fluentAvatarProposedConfig, fluentAvatarMappings as fluentAvatarProposedMappings } from "../fixtures/generated/avatar.fluent.js";
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
  // textarea@1 / radio@1 proposals map these string leaves (the hand tables do not)
  "labelPlacement", "outlineTreatment", "boxClips",
  // alert@1 proposals read the four glyphs from the capture
  "icon.glyphs.info.path", "icon.glyphs.info.winding", "icon.glyphs.success.path", "icon.glyphs.success.winding", "icon.glyphs.warning.path", "icon.glyphs.warning.winding", "icon.glyphs.error.path", "icon.glyphs.error.winding",
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
  {
    // PROPOSED from MUI's own capture by the textarea@1 role schema (2026-09-02): floating notched label read from the label's transform; notchFill + the hidden disabled placeholder reviewed.
    archetype: "textarea",
    library: "mui-proposed",
    source: src(muiTextareaProposedConfig),
    ledgerFile: MUI_TEXTAREA_LEDGER_PROPOSED,
    tokens: muiTextareaProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiTextareaProposedMappings,
    extras: extrasFor(muiTextareaProposedConfig.tokens as unknown as Record<string, unknown>, muiTextareaProposedMappings),
  },
  {
    // PROPOSED from AntD's own capture: the BARE cell (no label part) — 26 read, 17 spellings, 0 invented.
    archetype: "textarea",
    library: "antd-proposed",
    source: src(antdTextareaProposedConfig),
    ledgerFile: ANTD_TEXTAREA_LEDGER_PROPOSED,
    tokens: antdTextareaProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdTextareaProposedMappings,
    extras: extrasFor(antdTextareaProposedConfig.tokens as unknown as Record<string, unknown>, antdTextareaProposedMappings),
  },
  {
    // HELD OUT (2026-09-02): Chakra's Textarea, re-captured the same day with real screenshots (the legacy contract path quarantines it on scroll-padding-block-end); the bare cell, 26 read, 0 invented.
    archetype: "textarea",
    library: "chakra",
    source: src(chakraTextareaAdapterConfig),
    ledgerFile: CHAKRA_TEXTAREA_LEDGER,
    tokens: chakraTextareaAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: chakraTextareaMappings,
    extras: extrasFor(chakraTextareaAdapterConfig.tokens as unknown as Record<string, unknown>, chakraTextareaMappings),
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
    // PROPOSED from AntD's own capture by the radio@1 role schema (2026-09-02):
    // 32 read, 4 spellings, 0 invented; scored beside the hand row.
    archetype: "radio",
    library: "antd-proposed",
    source: src(antdRadioProposedConfig),
    ledgerFile: ANTD_RADIO_LEDGER_PROPOSED,
    tokens: antdRadioProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdRadioProposedMappings,
    extras: extrasFor(antdRadioProposedConfig.tokens as unknown as Record<string, unknown>, antdRadioProposedMappings),
  },
  {
    // HELD OUT (2026-09-02): Chakra's RadioGroup, captured the same day through
    // ItemIndicator; 32 read, 0 invented; the dot is a `.dot` span at scale 0.4.
    archetype: "radio",
    library: "chakra",
    source: src(chakraRadioAdapterConfig),
    ledgerFile: CHAKRA_RADIO_LEDGER,
    tokens: chakraRadioAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: chakraRadioMappings,
    extras: extrasFor(chakraRadioAdapterConfig.tokens as unknown as Record<string, unknown>, chakraRadioMappings),
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
    // PROPOSED from MUI's bare Switch mount (no label part): the label-less
    // cell; the hand table above is the same capture transcribed by a person.
    archetype: "switch",
    library: "mui-proposed",
    source: src(muiSwitchProposedConfig),
    ledgerFile: MUI_SWITCH_LEDGER_PROPOSED,
    tokens: muiSwitchProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiSwitchProposedMappings,
    extras: extrasFor(muiSwitchProposedConfig.tokens as unknown as Record<string, unknown>, muiSwitchProposedMappings),
  },
  {
    // PROPOSED from shadcn's bare Switch: oklch colours, a pill radius in
    // exponent notation, a calc(100% - 2px) travel of the thumb's own width.
    archetype: "switch",
    library: "shadcn",
    source: src(shadcnSwitchAdapterConfig),
    ledgerFile: SHADCN_SWITCH_LEDGER,
    tokens: shadcnSwitchAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: shadcnSwitchMappings,
    extras: extrasFor(shadcnSwitchAdapterConfig.tokens as unknown as Record<string, unknown>, shadcnSwitchMappings),
  },
  {
    // PROPOSED from a capture made the same day (labelled Switch; config
    // entry authored as the person's step): 33 leaves read, no --set.
    archetype: "switch",
    library: "chakra",
    source: src(chakraSwitchAdapterConfig),
    ledgerFile: CHAKRA_SWITCH_LEDGER,
    tokens: chakraSwitchAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: chakraSwitchMappings,
    extras: extrasFor(chakraSwitchAdapterConfig.tokens as unknown as Record<string, unknown>, chakraSwitchMappings),
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
    // PROPOSED from MUI's own capture by the alert@1 role schema (2026-09-02): four glyphs from the capture's path data; viewBox reviewed.
    archetype: "alert",
    library: "mui-proposed",
    source: src(muiAlertProposedConfig),
    ledgerFile: MUI_ALERT_LEDGER_PROPOSED,
    tokens: muiAlertProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiAlertProposedMappings,
    extras: extrasFor(muiAlertProposedConfig.tokens as unknown as Record<string, unknown>, muiAlertProposedMappings),
  },
  {
    // PROPOSED from AntD's own capture: the drafter took info.icon.off.off (the nearest cell to the showIcon=false base whose svg paint changes across statuses).
    archetype: "alert",
    library: "antd-proposed",
    source: src(antdAlertProposedConfig),
    ledgerFile: ANTD_ALERT_LEDGER_PROPOSED,
    tokens: antdAlertProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdAlertProposedMappings,
    extras: extrasFor(antdAlertProposedConfig.tokens as unknown as Record<string, unknown>, antdAlertProposedMappings),
  },
  {
    // HELD OUT (2026-09-02): Chakra's Alert, captured the same day (AlertIndicator's own status icons); 39 read, 1 reviewed (viewBox), 0 invented.
    archetype: "alert",
    library: "chakra",
    source: src(chakraAlertAdapterConfig),
    ledgerFile: CHAKRA_ALERT_LEDGER,
    tokens: chakraAlertAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: chakraAlertMappings,
    extras: extrasFor(chakraAlertAdapterConfig.tokens as unknown as Record<string, unknown>, chakraAlertMappings),
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
    // PROPOSED by propose-chip.ts (held out).
    archetype: "chip",
    library: "altitude",
    source: src(altitudeChipProposedConfig),
    ledgerFile: ALTITUDE_CHIP_LEDGER_PROPOSED,
    tokens: altitudeChipProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: altitudeChipProposedMappings,
    extras: extrasFor(altitudeChipProposedConfig.tokens as unknown as Record<string, unknown>, altitudeChipProposedMappings),
  },
  {
    // PROPOSED by propose-chip.ts (the same capture as the hand table).
    archetype: "chip",
    library: "mui-proposed",
    source: src(muiChipProposedConfig),
    ledgerFile: MUI_CHIP_LEDGER_PROPOSED,
    tokens: muiChipProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiChipProposedMappings,
    extras: extrasFor(muiChipProposedConfig.tokens as unknown as Record<string, unknown>, muiChipProposedMappings),
  },
  {
    // PROPOSED by propose-chip.ts (the same Tag capture as the hand table).
    archetype: "chip",
    library: "antd-proposed",
    source: src(antdChipProposedConfig),
    ledgerFile: ANTD_CHIP_LEDGER_PROPOSED,
    tokens: antdChipProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdChipProposedMappings,
    extras: extrasFor(antdChipProposedConfig.tokens as unknown as Record<string, unknown>, antdChipProposedMappings),
  },
  {
    // PROPOSED by propose-chip.ts (held out — Carbon Tag).
    archetype: "chip",
    library: "carbon",
    source: src(carbonChipProposedConfig),
    ledgerFile: CARBON_CHIP_LEDGER_PROPOSED,
    tokens: carbonChipProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: carbonChipProposedMappings,
    extras: extrasFor(carbonChipProposedConfig.tokens as unknown as Record<string, unknown>, carbonChipProposedMappings),
  },
  {
    // PROPOSED from a capture made 2026-09-02 (held out; the config entry was the person's step).
    archetype: "chip",
    library: "chakra",
    source: src(chakraChipAdapterConfig),
    ledgerFile: CHAKRA_CHIP_LEDGER,
    tokens: chakraChipAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: chakraChipMappings,
    extras: extrasFor(chakraChipAdapterConfig.tokens as unknown as Record<string, unknown>, chakraChipMappings),
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
    // PROPOSED by propose-avatar.ts (the hand table above is the same capture read by a person).
    archetype: "avatar",
    library: "mui-proposed",
    source: src(muiAvatarProposedConfig),
    ledgerFile: MUI_AVATAR_LEDGER_PROPOSED,
    tokens: muiAvatarProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiAvatarProposedMappings,
    extras: extrasFor(muiAvatarProposedConfig.tokens as unknown as Record<string, unknown>, muiAvatarProposedMappings),
  },
  {
    // PROPOSED by propose-avatar.ts (the hand table above is the same capture read by a person).
    archetype: "avatar",
    library: "antd-proposed",
    source: src(antdAvatarProposedConfig),
    ledgerFile: ANTD_AVATAR_LEDGER_PROPOSED,
    tokens: antdAvatarProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdAvatarProposedMappings,
    extras: extrasFor(antdAvatarProposedConfig.tokens as unknown as Record<string, unknown>, antdAvatarProposedMappings),
  },
  {
    // PROPOSED by propose-avatar.ts (held out).
    archetype: "avatar",
    library: "altitude",
    source: src(altitudeAvatarProposedConfig),
    ledgerFile: ALTITUDE_AVATAR_LEDGER_PROPOSED,
    tokens: altitudeAvatarProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: altitudeAvatarProposedMappings,
    extras: extrasFor(altitudeAvatarProposedConfig.tokens as unknown as Record<string, unknown>, altitudeAvatarProposedMappings),
  },
  {
    // PROPOSED by propose-avatar.ts (held out).
    archetype: "avatar",
    library: "shadcn",
    source: src(shadcnAvatarProposedConfig),
    ledgerFile: SHADCN_AVATAR_LEDGER_PROPOSED,
    tokens: shadcnAvatarProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: shadcnAvatarProposedMappings,
    extras: extrasFor(shadcnAvatarProposedConfig.tokens as unknown as Record<string, unknown>, shadcnAvatarProposedMappings),
  },
  {
    // PROPOSED by propose-avatar.ts (held out).
    archetype: "avatar",
    library: "fluent",
    source: src(fluentAvatarProposedConfig),
    ledgerFile: FLUENT_AVATAR_LEDGER_PROPOSED,
    tokens: fluentAvatarProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: fluentAvatarProposedMappings,
    extras: extrasFor(fluentAvatarProposedConfig.tokens as unknown as Record<string, unknown>, fluentAvatarProposedMappings),
  },
  {
    // PROPOSED from a capture made 2026-09-02 (held out; the config entry was the person's step).
    archetype: "avatar",
    library: "chakra",
    source: src(chakraAvatarAdapterConfig),
    ledgerFile: CHAKRA_AVATAR_LEDGER,
    tokens: chakraAvatarAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: chakraAvatarMappings,
    extras: extrasFor(chakraAvatarAdapterConfig.tokens as unknown as Record<string, unknown>, chakraAvatarMappings),
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
    // PROPOSED by propose-link.ts (held out).
    archetype: "link",
    library: "altitude",
    source: src(altitudeLinkProposedConfig),
    ledgerFile: ALTITUDE_LINK_LEDGER_PROPOSED,
    tokens: altitudeLinkProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: altitudeLinkProposedMappings,
    extras: extrasFor(altitudeLinkProposedConfig.tokens as unknown as Record<string, unknown>, altitudeLinkProposedMappings),
  },
  {
    // PROPOSED by propose-link.ts (the same capture as the hand table).
    archetype: "link",
    library: "mui-proposed",
    source: src(muiLinkProposedConfig),
    ledgerFile: MUI_LINK_LEDGER_PROPOSED,
    tokens: muiLinkProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiLinkProposedMappings,
    extras: extrasFor(muiLinkProposedConfig.tokens as unknown as Record<string, unknown>, muiLinkProposedMappings),
  },
  {
    // PROPOSED from a capture made 2026-09-02 (held out; the config entry was the person's step).
    archetype: "link",
    library: "chakra",
    source: src(chakraLinkAdapterConfig),
    ledgerFile: CHAKRA_LINK_LEDGER,
    tokens: chakraLinkAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: chakraLinkMappings,
    extras: extrasFor(chakraLinkAdapterConfig.tokens as unknown as Record<string, unknown>, chakraLinkMappings),
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
    // PROPOSED by propose-tooltip.ts (the hand table above is the same capture read by a person).
    archetype: "tooltip",
    library: "antd-proposed",
    source: src(antdTooltipProposedConfig),
    ledgerFile: ANTD_TOOLTIP_LEDGER_PROPOSED,
    tokens: antdTooltipProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: antdTooltipProposedMappings,
    extras: extrasFor(antdTooltipProposedConfig.tokens as unknown as Record<string, unknown>, antdTooltipProposedMappings),
  },
  {
    // PROPOSED by propose-tooltip.ts (the same capture as the hand table).
    archetype: "tooltip",
    library: "mui-proposed",
    source: src(muiTooltipProposedConfig),
    ledgerFile: MUI_TOOLTIP_LEDGER_PROPOSED,
    tokens: muiTooltipProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiTooltipProposedMappings,
    extras: extrasFor(muiTooltipProposedConfig.tokens as unknown as Record<string, unknown>, muiTooltipProposedMappings),
  },
  {
    // PROPOSED by propose-tooltip.ts (held out).
    archetype: "tooltip",
    library: "shadcn",
    source: src(shadcnTooltipProposedConfig),
    ledgerFile: SHADCN_TOOLTIP_LEDGER_PROPOSED,
    tokens: shadcnTooltipProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: shadcnTooltipProposedMappings,
    extras: extrasFor(shadcnTooltipProposedConfig.tokens as unknown as Record<string, unknown>, shadcnTooltipProposedMappings),
  },
  {
    // PROPOSED from a capture made 2026-09-02 through the portal path (held out).
    archetype: "tooltip",
    library: "chakra",
    source: src(chakraTooltipAdapterConfig),
    ledgerFile: CHAKRA_TOOLTIP_LEDGER,
    tokens: chakraTooltipAdapterConfig.tokens as unknown as Record<string, unknown>,
    mappings: chakraTooltipMappings,
    extras: extrasFor(chakraTooltipAdapterConfig.tokens as unknown as Record<string, unknown>, chakraTooltipMappings),
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
    // PROPOSED by propose-tabs.ts (the same capture as the hand table).
    archetype: "tabs",
    library: "mui-proposed",
    source: src(muiTabsProposedConfig),
    ledgerFile: MUI_TABS_LEDGER_PROPOSED,
    tokens: muiTabsProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: muiTabsProposedMappings,
    extras: extrasFor(muiTabsProposedConfig.tokens as unknown as Record<string, unknown>, muiTabsProposedMappings),
  },
  {
    // PROPOSED by propose-tabs.ts (held out; the indicator is the selected tab's bottom border).
    archetype: "tabs",
    library: "carbon",
    source: src(carbonTabsProposedConfig),
    ledgerFile: CARBON_TABS_LEDGER_PROPOSED,
    tokens: carbonTabsProposedConfig.tokens as unknown as Record<string, unknown>,
    mappings: carbonTabsProposedMappings,
    extras: extrasFor(carbonTabsProposedConfig.tokens as unknown as Record<string, unknown>, carbonTabsProposedMappings),
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
