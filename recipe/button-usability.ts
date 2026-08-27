export interface ButtonLabelGeometry {
  characters: string;
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  fillAlpha: number;
  visible: boolean;
  width: number;
  height: number;
  x: number;
  horizontalAlignment: "MIN" | "CENTER" | "MAX";
}

export interface ButtonResizeProbe {
  sourceIntent: "HUG";
  before: {
    width: number;
    label: ButtonLabelGeometry;
  };
  grown: {
    width: number;
    label: ButtonLabelGeometry;
  };
  restored: {
    width: number;
    label: ButtonLabelGeometry;
  };
  restorationBeforeSha256: string;
  restorationAfterSha256: string;
}

export function validateButtonResizeProbe(probe: ButtonResizeProbe): string[] {
  const failures: string[] = [];
  const validateLabel = (
    label: ButtonLabelGeometry,
    phase: "before" | "grown" | "restored",
  ): void => {
    if (label.characters.trim().length === 0) {
      failures.push(`${phase}: label text is empty`);
    }
    if (
      label.fontFamily.trim().length === 0 ||
      label.fontStyle.trim().length === 0 ||
      !Number.isFinite(label.fontSize) ||
      label.fontSize <= 0
    ) {
      failures.push(`${phase}: label font is invalid`);
    }
    if (!label.visible || label.fillAlpha <= 0) {
      failures.push(`${phase}: label is invisible`);
    }
    if (label.width <= 0 || label.height <= 0) {
      failures.push(`${phase}: label dimensions must be positive`);
    }
    if (label.horizontalAlignment !== "CENTER") {
      failures.push(`${phase}: label alignment must be CENTER`);
    }
  };
  validateLabel(probe.before.label, "before");
  validateLabel(probe.grown.label, "grown");
  validateLabel(probe.restored.label, "restored");
  if (probe.sourceIntent !== "HUG") {
    failures.push("source intent must remain HUG");
  }
  if (probe.grown.width <= probe.before.width) {
    failures.push("designer resize snapped back instead of growing");
  }
  if (
    probe.grown.label.x === probe.before.label.x &&
    probe.grown.label.width === probe.before.label.width
  ) {
    failures.push("responsive label geometry stayed frozen");
  }
  const rootDelta = probe.grown.width - probe.before.width;
  const labelCenterDelta =
    probe.grown.label.x +
    probe.grown.label.width / 2 -
    (probe.before.label.x + probe.before.label.width / 2);
  if (Math.abs(labelCenterDelta - rootDelta / 2) > 0.5) {
    failures.push("responsive label is not centered after resize");
  }
  if (
    probe.restorationBeforeSha256 !== probe.restorationAfterSha256 ||
    probe.restored.width !== probe.before.width ||
    JSON.stringify(probe.restored.label) !== JSON.stringify(probe.before.label)
  ) {
    failures.push("sizing restoration is not exact");
  }
  return failures;
}
