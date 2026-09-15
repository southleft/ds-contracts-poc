import type { Contract, Part } from "../scripts/contract-schema.js";

// Native HTML presence booleans, using React's property spellings. Unlike
// ARIA/data strings, their false value must never become the string "false".
// Enumerated (contentEditable, draggable) and overloaded (download, capture)
// attributes are deliberately not treated as presence booleans.
const BOOLEAN_ATTRS = new Set([
  "allowFullScreen",
  "async",
  "autoFocus",
  "autoPlay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "disablePictureInPicture",
  "disableRemotePlayback",
  "formNoValidate",
  "hidden",
  "inert",
  "itemScope",
  "loop",
  "multiple",
  "muted",
  "noModule",
  "noValidate",
  "open",
  "playsInline",
  "readOnly",
  "required",
  "reversed",
  "scoped",
  "seamless",
  "selected",
]);
const NUMERIC_ATTRS = new Set([
  "rows",
  "cols",
  "tabIndex",
  "colSpan",
  "rowSpan",
]);
// DOM observations use HTML's lowercase attribute names. Normalize only this
// finite native type table, not arbitrary attributes, ARIA/data, or prop names.
const NATIVE_REACT_NAMES = new Map(
  [...BOOLEAN_ATTRS, ...NUMERIC_ATTRS].map((name) => [
    name.toLowerCase(),
    name,
  ]),
);

/** Shared attribute projection for both existing React emitters. This does not
 * infer native state from source prop names: the declared attribute target
 * determines its type, and a mismatched boolean binding refuses emission. */
export function reactPartAttrList(
  contract: Pick<Contract, "id" | "props">,
  part: Part | undefined,
  codePropOf: (name: string) => string,
): string[] {
  const seen = new Set<string>();
  return Object.entries(part?.attrs ?? {}).map(([sourceAttr, value]) => {
    const attr = NATIVE_REACT_NAMES.get(sourceAttr.toLowerCase()) ?? sourceAttr;
    if (seen.has(attr))
      throw new Error(
        `Refused — ${contract.id}: duplicate native attribute aliases for "${attr}"`,
      );
    seen.add(attr);
    const ref = value.match(/^\{([a-z][\w-]*)\}$/);
    if (ref) {
      const bound = contract.props.find((p) => p.name === ref[1]);
      if (!bound)
        throw new Error(
          `Refused — ${contract.id}: attrs references unknown prop "${ref[1]}"`,
        );
      const codeName = codePropOf(ref[1]);
      if (BOOLEAN_ATTRS.has(attr)) {
        if (bound.type !== "boolean") {
          throw new Error(
            `Refused — ${contract.id}: native boolean attribute "${attr}" requires a boolean prop (received "${ref[1]}")`,
          );
        }
        return `${attr}={${codeName}}`;
      }
      if (
        bound.type === "text" ||
        (NUMERIC_ATTRS.has(attr) && bound.type === "number")
      ) {
        return `${attr}={${codeName}}`;
      }
      // A missing optional prop is absent, not the literal string "undefined".
      // Defined false remains "false" for string-valued ARIA/data attributes.
      const expression =
        bound.default === undefined
          ? `${codeName} === undefined ? undefined : String(${codeName})`
          : `String(${codeName})`;
      return `${attr}={${expression}}`;
    }
    // Part.attrs literals are HTML attribute values: any spelling (including
    // "" and "false") of a present native boolean means true in the source.
    if (BOOLEAN_ATTRS.has(attr)) return `${attr}={true}`;
    if (
      NUMERIC_ATTRS.has(attr) &&
      /^-?\d+$/.test(value) &&
      Number.isFinite(Number(value))
    ) {
      return `${attr}={${Number(value)}}`;
    }
    return `${attr}=${JSON.stringify(value)}`;
  });
}
