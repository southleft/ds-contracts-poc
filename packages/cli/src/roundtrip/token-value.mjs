export function bindingType(kind, field) {
  return field === "font-size" && kind === "text"
    ? "dimension"
    : (kind === "text" ? field === "color" : ["fill", "stroke"].includes(field))
      ? "color"
      : null;
}
export function tokenValue(type, value, target = "rendered") {
  if (type === "dimension") {
    if (target === "source") {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw Error("unsupported-dimension");
      return String(value) + "px";
    }
    if (typeof value === "string" && /^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(value)) {
      const n = Number(value.slice(0, -2));
      const native = Math.fround(n);
      if (Number.isFinite(n) && n > 0 && Number.isFinite(native) && native > 0) return target === "native" ? native : n;
    }
  } else if (type === "color" && typeof value === "string" && /^#[\da-f]{6}$/i.test(value)) return value.toLowerCase();
  throw Error("unsupported-token-value: " + type);
}
