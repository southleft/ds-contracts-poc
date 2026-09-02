/**
 * ONE TABLE OF THE THIRTEEN ARCHETYPES' TOOLKITS — adapt, compile, collapse,
 * recipe, emit — so point.ts and the plugin-target proof pick by name from the
 * same place. No `if (library)` anywhere: the table is keyed by ARCHETYPE.
 */
import { adaptReviewedAlert } from "../adapters/alert.js";
import { adaptReviewedAvatar } from "../adapters/avatar.js";
import { adaptReviewedBadge } from "../adapters/badge.js";
import { adaptReviewedCheckbox } from "../adapters/checkbox.js";
import { adaptReviewedChip } from "../adapters/chip.js";
import { adaptReviewedDialog } from "../adapters/dialog.js";
import { adaptReviewedLink } from "../adapters/link.js";
import { adaptReviewedMenu } from "../adapters/menu.js";
import { adaptReviewedRadio } from "../adapters/radio.js";
import { adaptReviewedSwitch } from "../adapters/switch.js";
import { adaptReviewedTabs } from "../adapters/tabs.js";
import { adaptReviewedTextarea } from "../adapters/textarea.js";
import { adaptReviewedTooltip } from "../adapters/tooltip.js";
import { emitAlertFigmaWriter } from "../alert-figma-writer.js";
import { emitAvatarFigmaWriter } from "../avatar-figma-writer.js";
import { emitBadgeFigmaWriter } from "../badge-figma-writer.js";
import { emitCheckboxFigmaWriter } from "../checkbox-figma-writer.js";
import { emitChipFigmaWriter } from "../chip-figma-writer.js";
import { emitDialogFigmaWriter } from "../dialog-figma-writer.js";
import { emitLinkFigmaWriter } from "../link-figma-writer.js";
import { emitMenuFigmaWriter } from "../menu-figma-writer.js";
import { emitRadioFigmaWriter } from "../radio-figma-writer.js";
import { emitSwitchFigmaWriter } from "../switch-figma-writer.js";
import { emitTabsFigmaWriter } from "../tabs-figma-writer.js";
import { emitTextareaFigmaWriter } from "../textarea-figma-writer.js";
import { emitTooltipFigmaWriter } from "../tooltip-figma-writer.js";
import { alertRecipe, collapseAlertRecipe, compileAlertRecipe } from "../recipes/alert.js";
import { avatarRecipe, collapseAvatarRecipe, compileAvatarRecipe } from "../recipes/avatar.js";
import { badgeRecipe, collapseBadgeRecipe, compileBadgeRecipe } from "../recipes/badge.js";
import { checkboxRecipe, collapseCheckboxRecipe, compileCheckboxRecipe } from "../recipes/checkbox.js";
import { chipRecipe, collapseChipRecipe, compileChipRecipe } from "../recipes/chip.js";
import { collapseDialogRecipe, compileDialogRecipe, dialogRecipe } from "../recipes/dialog.js";
import { collapseLinkRecipe, compileLinkRecipe, linkRecipe } from "../recipes/link.js";
import { collapseMenuRecipe, compileMenuRecipe, menuRecipe } from "../recipes/menu.js";
import { collapseRadioRecipe, compileRadioRecipe, radioRecipe } from "../recipes/radio.js";
import { collapseSwitchRecipe, compileSwitchRecipe, switchRecipe } from "../recipes/switch.js";
import { collapseTabsRecipe, compileTabsRecipe, tabsRecipe } from "../recipes/tabs.js";
import { collapseTextareaRecipe, compileTextareaRecipe, textareaRecipe } from "../recipes/textarea.js";
import { collapseTooltipRecipe, compileTooltipRecipe, tooltipRecipe } from "../recipes/tooltip.js";

export const ARCHETYPES = ["checkbox", "switch", "avatar", "tooltip", "chip", "link", "tabs", "radio", "textarea", "alert", "badge", "menu", "dialog"] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export interface WriterSource {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelope: Envelope;
}
export type Envelope = ReturnType<typeof compileCheckboxRecipe>;

export interface ArchetypeToolkit {
  adapt: (source: unknown, config: unknown) => unknown;
  compile: (instance: unknown) => Envelope;
  collapse: (envelope: Envelope, selection: unknown) => unknown;
  recipe: unknown;
  emit: (sources: WriterSource[], opts: { target: "plugin" | "scratch" }) => { code: string; pageName: string };
}

const T = <A, C, R, E>(adapt: A, compile: C, collapse: R, recipe: unknown, emit: E): ArchetypeToolkit =>
  ({ adapt, compile, collapse, recipe, emit }) as unknown as ArchetypeToolkit;

const TOOLKITS: Record<Archetype, ArchetypeToolkit> = {
  checkbox: T(adaptReviewedCheckbox, compileCheckboxRecipe, collapseCheckboxRecipe, checkboxRecipe, emitCheckboxFigmaWriter),
  switch: T(adaptReviewedSwitch, compileSwitchRecipe, collapseSwitchRecipe, switchRecipe, emitSwitchFigmaWriter),
  avatar: T(adaptReviewedAvatar, compileAvatarRecipe, collapseAvatarRecipe, avatarRecipe, emitAvatarFigmaWriter),
  tooltip: T(adaptReviewedTooltip, compileTooltipRecipe, collapseTooltipRecipe, tooltipRecipe, emitTooltipFigmaWriter),
  chip: T(adaptReviewedChip, compileChipRecipe, collapseChipRecipe, chipRecipe, emitChipFigmaWriter),
  link: T(adaptReviewedLink, compileLinkRecipe, collapseLinkRecipe, linkRecipe, emitLinkFigmaWriter),
  tabs: T(adaptReviewedTabs, compileTabsRecipe, collapseTabsRecipe, tabsRecipe, emitTabsFigmaWriter),
  radio: T(adaptReviewedRadio, compileRadioRecipe, collapseRadioRecipe, radioRecipe, emitRadioFigmaWriter),
  textarea: T(adaptReviewedTextarea, compileTextareaRecipe, collapseTextareaRecipe, textareaRecipe, emitTextareaFigmaWriter),
  alert: T(adaptReviewedAlert, compileAlertRecipe, collapseAlertRecipe, alertRecipe, emitAlertFigmaWriter),
  badge: T(adaptReviewedBadge, compileBadgeRecipe, collapseBadgeRecipe, badgeRecipe, emitBadgeFigmaWriter),
  menu: T(adaptReviewedMenu, compileMenuRecipe, collapseMenuRecipe, menuRecipe, emitMenuFigmaWriter),
  dialog: T(adaptReviewedDialog, compileDialogRecipe, collapseDialogRecipe, dialogRecipe, emitDialogFigmaWriter),
};

export function archetypeToolkit(archetype: string): ArchetypeToolkit {
  const kit = TOOLKITS[archetype as Archetype];
  if (!kit) throw new Error(`no toolkit for archetype ${JSON.stringify(archetype)} — one of ${ARCHETYPES.join(", ")}`);
  return kit;
}

/** The generated module's export names for a library slug: `<slug>` camel-cased + `<Archetype>` + Source / AdapterConfig. */
export function generatedExportNames(archetype: string, slug: string): { source: string; config: string } {
  const camel = slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const Arch = archetype[0]!.toUpperCase() + archetype.slice(1);
  return { source: `${camel}${Arch}Source`, config: `${camel}${Arch}AdapterConfig` };
}
