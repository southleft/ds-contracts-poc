/**
 * FIXTURE READER — Alert / Banner (docs/35 Phase 2).
 *
 * MUI    extract/computed/out/mui/alert/captured-truth.json
 * AntD   extract/computed/out/antd/alert/captured-truth.json
 * Astryx extract/computed/out/astryx/banner/captured-truth.json
 */
import { px } from "./ledger.js";
import type { FactMapping } from "./reader.js";
import { FONT_PIN, firstFam, one, receipt, styleForWeight } from "./mappings-util.js";

function severityStates(
  lib: "mui" | "antd" | "astryx",
  severities: string[],
  comboOf: (sev: string) => string,
  root: string,
  title: string,
  icon: string,
): FactMapping[] {
  const out: FactMapping[] = [];
  for (const sev of severities) {
    const combo = comboOf(sev);
    if (lib === "astryx") {
      // Theme-mount: colors drift systematically — map and carry as capture-theme-unavailable.
      out.push(one(`states.${sev}.boxFill`, "color", { combo, part: root, channel: "background-color" }));
      out.push(
        receipt(
          `states.${sev}.boxBorder`,
          "Banner draws no painted border — transparent is the recipe spelling",
          "reviewed #00000000",
        ),
      );
      out.push(one(`states.${sev}.title`, "color", { combo, part: title, channel: "color" }));
      out.push(one(`states.${sev}.iconFill`, "color", { combo, part: icon, channel: "color" }));
      out.push(one(`states.${sev}.iconOpacity`, "number", { combo, part: icon, channel: "opacity" }));
    } else if (lib === "mui") {
      out.push(one(`states.${sev}.boxFill`, "color", { combo, part: root, channel: "background-color" }));
      out.push(
        receipt(
          `states.${sev}.boxBorder`,
          "standard Alert draws no painted border — transparent is the recipe spelling (ledger border-top-color is the title ink)",
          "Alert.js standard border none — reviewed #00000000",
        ),
      );
      out.push(one(`states.${sev}.title`, "color", { combo, part: title, channel: "color" }));
      out.push(one(`states.${sev}.iconFill`, "color", { combo, part: icon, channel: "color" }));
      out.push(one(`states.${sev}.iconOpacity`, "number", { combo, part: "cls:MuiAlert-icon", channel: "opacity" }));
    } else {
      out.push(one(`states.${sev}.boxFill`, "color", { combo, part: root, channel: "background-color" }));
      out.push(one(`states.${sev}.boxBorder`, "color", { combo, part: root, channel: "border-top-color" }));
      out.push(one(`states.${sev}.title`, "color", { combo, part: title, channel: "color" }));
      out.push(one(`states.${sev}.iconFill`, "color", { combo, part: icon, channel: "color" }));
      out.push(one(`states.${sev}.iconOpacity`, "number", { combo, part: icon, channel: "opacity" }));
    }
  }
  return out;
}

export const MUI_ALERT_LEDGER = "extract/computed/out/mui/alert/captured-truth.json";
const mRoot = "cls:MuiAlert-root";
const mMsg = "cls:MuiAlert-message";
const mIcon = "cls:MuiSvgIcon-root";

export const muiAlertMappings: FactMapping[] = [
  receipt(
    "box.height",
    "Alert hug-contents height depends on message line count — the recipe spells 48 from the reviewed single-line + icon pairing; the capture's content-box height is not a fixed channel",
    "Alert.js padding 6+6 + icon 22 + message leading — reviewed 48",
  ),
  one("box.paddingX", "px", { combo: "info.standard", part: mRoot, channel: "padding-left" }),
  one("box.paddingY", "px", { combo: "info.standard", part: mRoot, channel: "padding-top" }),
  one("box.radius", "px", { combo: "info.standard", part: mRoot, channel: "border-top-left-radius" }),
  one("box.borderWidth", "px", { combo: "info.standard", part: mRoot, channel: "border-top-width" }),
  receipt(
    "box.gap",
    "Alert uses margin on the icon (mr 12), not CSS gap — 12 is the recipe's spelling of that margin",
    "Alert.js icon marginRight 12 — reviewed 12",
  ),
  one("icon.size", "px", { combo: "info.standard", part: mIcon, channel: "width" }),
  one("titleFontSize", "px", { combo: "info.standard", part: mMsg, channel: "font-size" }),
  {
    path: "titleLineHeight",
    kind: "px",
    reads: { v: { combo: "info.standard", part: mMsg, channel: "line-height" } },
    formula: "sub-pixel leading rounded",
    combine: (raw) => Math.round(px(raw.v)),
  },
  ...severityStates("mui", ["info", "success", "warning", "error"], (s) => `${s}.standard`, mRoot, mMsg, mIcon),
  receipt("strokeAlign", "recipe anatomy spelling", "reviewed inside"),
  {
    path: "typography.title.family",
    kind: "string",
    reads: { v: { combo: "info.standard", part: mMsg, channel: "font-family" } },
    combine: firstFam,
  },
  {
    path: "typography.title.style",
    kind: "string",
    reads: { v: { combo: "info.standard", part: mMsg, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];

export const ANTD_ALERT_LEDGER = "extract/computed/out/antd/alert/captured-truth.json";
const aRoot = "cls:ant-alert";
const aMsg = "cls:ant-alert-message";
const aIcon = "cls:ant-alert-icon";
const aCombo = "info.icon.off.off";

export const antdAlertMappings: FactMapping[] = [
  receipt(
    "box.height",
    "capture height 40 includes the 1px border on both sides (border-box); the recipe spells the content-box 38 (8+8+22) — border-box vs content-box, not a color miss",
    "padding 8+8 + line 22 = 38 — reviewed 38",
  ),
  one("box.paddingX", "px", { combo: aCombo, part: aRoot, channel: "padding-left" }),
  one("box.paddingY", "px", { combo: aCombo, part: aRoot, channel: "padding-top" }),
  one("box.radius", "px", { combo: aCombo, part: aRoot, channel: "border-top-left-radius" }),
  one("box.borderWidth", "px", { combo: aCombo, part: aRoot, channel: "border-top-width" }),
  receipt(
    "box.gap",
    "Alert icon margin-inline-end is 8 — not a CSS gap on the root; 8 is the recipe spelling",
    "genAlertStyle icon margin — reviewed 8",
  ),
  one("icon.size", "px", { combo: aCombo, part: aIcon, channel: "width" }),
  one("titleFontSize", "px", { combo: aCombo, part: aMsg, channel: "font-size" }),
  one("titleLineHeight", "px", { combo: aCombo, part: aMsg, channel: "line-height" }),
  ...severityStates(
    "antd",
    ["info", "success", "warning", "error"],
    (s) => `${s}.icon.off.off`,
    aRoot,
    aMsg,
    aIcon,
  ),
  receipt("strokeAlign", "recipe anatomy spelling", "reviewed inside"),
  receipt("typography.title.family", FONT_PIN, "theme.getDesignToken().fontFamily starts -apple-system"),
  {
    path: "typography.title.style",
    kind: "string",
    reads: { v: { combo: aCombo, part: aMsg, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];

export const ASTRYX_ALERT_LEDGER = "extract/computed/out/astryx/banner/captured-truth.json";
const xRoot = "cls:astryx-banner";
const xTitle = "idx:0.1.0";
const xIcon = "cls:astryx-icon";
const xCombo = "info.card";

export const astryxAlertMappings: FactMapping[] = [
  receipt(
    "box.height",
    "Banner hug-contents height depends on title+description lines — the recipe spells 44 for the single-line proof; the capture mounts title+description (64)",
    "Banner.tsx single-line proof — reviewed 44",
  ),
  one("box.paddingX", "px", { combo: xCombo, part: xRoot, channel: "padding-left" }),
  one("box.paddingY", "px", { combo: xCombo, part: xRoot, channel: "padding-top" }),
  one("box.radius", "px", { combo: xCombo, part: xRoot, channel: "border-top-left-radius" }),
  one("box.borderWidth", "px", { combo: xCombo, part: xRoot, channel: "border-top-width" }),
  receipt(
    "box.gap",
    "Banner uses CSS gap 8 but the committed capture ledger does not enumerate the gap channel — 8 is the recipe spelling from Banner.tsx",
    "Banner.tsx gap --spacing-2 8 — reviewed 8",
  ),
  one("icon.size", "px", { combo: xCombo, part: xIcon, channel: "width" }),
  one("titleFontSize", "px", { combo: xCombo, part: xTitle, channel: "font-size" }),
  {
    path: "titleLineHeight",
    kind: "px",
    reads: { v: { combo: xCombo, part: xTitle, channel: "line-height" } },
    combine: (raw) => Math.round(px(raw.v)),
  },
  ...severityStates("astryx", ["info", "success", "warning", "error"], (s) => `${s}.card`, xRoot, xTitle, xIcon),
  receipt("strokeAlign", "recipe anatomy spelling", "reviewed inside"),
  {
    path: "typography.title.family",
    kind: "string",
    reads: { v: { combo: xCombo, part: xTitle, channel: "font-family" } },
    combine: firstFam,
  },
  {
    path: "typography.title.style",
    kind: "string",
    reads: { v: { combo: xCombo, part: xTitle, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];
