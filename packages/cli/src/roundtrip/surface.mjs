// Bounded shared surface. No inference of application behavior and no model calls.
import { createHash } from 'node:crypto';

export const canonical = (value) =>
  JSON.stringify(
    value,
    (_, v) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b, 'en')))
        : v,
    2,
  ) + '\n';
export const hash = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : canonical(value))
    .digest('hex');
export const resolve = (style, axes) =>
  style?.when?.find((w) => Object.entries(w.axes).every(([k, v]) => axes[k] === v)) ?? style?.base;
export const values = (part, axes) =>
  Object.fromEntries(Object.entries(part.styles).map(([k, s]) => [k, resolve(s, axes)]));
export function validateVariants(variants) {
  if (new Set(variants.map((v) => canonical(Object.keys(v.axes ?? {}).sort()))).size > 1)
    throw Error("inconsistent variant axes");
  if (new Set(variants.map((v) => v.key)).size !== variants.length) throw Error("duplicate variant key");
  const axes = variants.map((v) =>
    canonical(Object.fromEntries(Object.entries(v.axes ?? {}).map(([key, value]) => [key, String(value)]))),
  );
  if (new Set(axes).size !== variants.length) throw Error("duplicate variant axes");
}
export const cssName = (property) =>
  ({
    fill: "background-color",
    color: "color",
    radius: "border-radius",
    stroke: "border-color",
    "stroke-width": "border-width",
    "font-family": "font-family",
    "font-size": "font-size",
    "font-weight": "font-weight",
    "line-height": "line-height",
    "letter-spacing": "letter-spacing",
    gap: "gap",
    padding: "padding",
    opacity: "opacity",
    width: "width",
    height: "height",
  })[property] ?? property;
export function validate(contract) {
  if (contract.contract !== "0.3" || !contract.parts.root || !contract.variants.length)
    throw Error("unsupported contract");
  validateVariants(contract.variants);
  for (const [name, part] of Object.entries(contract.parts)) {
    if (!["frame", "text"].includes(part.kind)) throw Error(`unsupported part: ${name} (${part.kind})`);
    if (part.parent != null && !contract.parts[part.parent]) throw Error(`missing parent: ${name}`);
    const seen = new Set([name]);
    let parent = part.parent;
    while (parent) {
      if (seen.has(parent)) throw Error(`cyclic part: ${name}`);
      seen.add(parent);
      parent = contract.parts[parent]?.parent;
    }
    for (const variant of contract.variants) {
      const s = values(part, variant.axes),
        get = (key) => s[key]?.value;
      if (part.kind === "frame" && !["row", "column"].includes(get("layout")))
        throw Error(`unsupported layout: ${name}`);
      if (get("positioning") === "absolute") throw Error(`unsupported absolute part: ${name}`);
      if (get("shadow")?.length) throw Error(`unsupported shadow: ${name}`);
      for (const key of ["fill", "color", "stroke"])
        if (get(key) != null && !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(get(key)))
          throw Error(`unsupported ${key}: ${name}`);
    }
  }
  return contract;
}
export function contractFromCapture(profile, capture, source) {
  validateVariants(profile.variants);
  const parts = {};
  for (const [name, p] of Object.entries(profile.parts)) {
    const keys = [...new Set(capture.variants.flatMap((v) => Object.keys(v.parts[name]?.styles ?? {})))].sort();
    const out = {};
    for (const key of keys) {
      const cells = capture.variants.map((v) => ({
        axes: v.axes,
        cell: {
          value: v.parts[name].styles[key],
          token: v.parts[name].tokens?.[key] ?? null,
          variable: null,
          from: { node: null, layer: p.selector, field: cssName(key) },
          confidence: "advisory",
        },
      }));
      const base = cells[0].cell;
      out[key] = {
        family:
          {
            color: "color",
            fill: "color",
            radius: "radius",
            padding: "spacing",
            gap: "spacing",
            opacity: "opacity",
            text: "content",
          }[key] ??
          (["width", "height"].includes(key)
            ? "size"
            : key.startsWith("font") ||
                ["line-height", "letter-spacing", "text-align", "text-case", "text-decoration"].includes(key)
              ? "type"
              : "structure"),
        base,
      };
      const when = cells
        .slice(1)
        .filter((x) => canonical([x.cell.value, x.cell.token]) !== canonical([base.value, base.token]))
        .map((x) => ({ ...x.cell, axes: x.axes }));
      if (when.length) out[key].when = when;
    }
    parts[name] = {
      kind: p.kind,
      parent: p.parent,
      order: p.order,
      figma: [],
      code: { element: p.element, selector: p.selector },
      ...(Object.keys(p.binds).length ? { binds: p.binds } : {}),
      styles: out,
    };
  }
  return {
    contract: "0.3",
    component: profile.component,
    axes: profile.axes,
    props: profile.props,
    variants: profile.variants.map((v) => ({
      ...v,
      figma: { nodeId: capture.variants.find((x) => x.key === v.key)?.id ?? "", name: v.key },
    })),
    parts,
    sources: {
      kit: source.kind === "figma-dump" ? source : null,
      code: source.kind === "code-capture" ? source : null,
      variables: null,
      map: null,
      labels: null,
    },
    reader: { script: "ds-contracts/roundtrip", sha256: hash("system-aware/0.1") },
    confidence: {},
    gaps: capture.gaps ?? [],
  };
}
export function makePlan(contract) {
  validate(contract);
  return {
    slug: contract.component.slug,
    name: contract.component.name,
    digest: hash(contract),
    props: contract.props,
    binds: Object.fromEntries(Object.entries(contract.parts).map(([n, p]) => [n, p.binds?.text])),
    variants: contract.variants.map((v) => ({
      ...v,
      parts: Object.fromEntries(
        Object.entries(contract.parts).map(([n, p]) => {
          let depth = 0,
            q = p;
          while (q.parent) {
            depth++;
            q = contract.parts[q.parent];
            if (depth > 100) throw Error("cyclic parts");
          }
          const cells = values(p, v.axes);
          return [
            n,
            {
              kind: p.kind,
              parent: p.parent,
              order: p.order,
              depth,
              styles: Object.fromEntries(Object.entries(cells).map(([k, c]) => [k, c.value])),
              tokens: Object.fromEntries(
                Object.entries(cells)
                  .filter(([, c]) => c.token)
                  .map(([k, c]) => [k, c.token]),
              ),
            },
          ];
        }),
      ),
    })),
  };
}
