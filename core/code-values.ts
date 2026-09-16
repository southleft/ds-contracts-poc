/** Explicit typed code values for canonical finite contract axes. No name-
 * based boolean conversion: false, "false", null and omission stay distinct. */
import type { Contract, Prop } from "../scripts/contract-schema.js";
import {
  PropSchema,
  walkAnatomy,
  omittedCodeBindingConflicts,
} from "../scripts/contract-schema.js";
export type CodeScalar = string | number | boolean | null;
export const hasCodeValues = (p: Prop): boolean =>
  p.bindings.code.values !== undefined;
export function codeValue(p: Prop, canonical: string): CodeScalar {
  const values = p.bindings.code.values;
  if (!values) return canonical;
  if (!Object.hasOwn(values, canonical))
    throw Error(`CODE_VALUE_UNKNOWN:${p.name}:${canonical}`);
  return values[canonical];
}
export const codeValueLiteral = (p: Prop, canonical: string): string =>
  JSON.stringify(codeValue(p, canonical));
export function codeValueUnion(p: Prop): string {
  if (typeof p.type !== "object" || !("enum" in p.type))
    throw Error(`CODE_VALUE_ENUM_REQUIRED:${p.name}`);
  return p.type.enum.map((v) => codeValueLiteral(p, v)).join(" | ");
}
export function codeValueExpression(
  p: Prop | undefined,
  canonicalExpression: string,
): string {
  if (!p?.bindings.code.values) return canonicalExpression;
  const cases = Object.entries(p.bindings.code.values)
    .map(
      ([canonical, value]) =>
        `case ${JSON.stringify(canonical)}: return ${JSON.stringify(value)};`,
    )
    .join(" ");
  return `((value: unknown): ${codeValueUnion(p)}${p.required ? "" : " | undefined"} => { ${p.required ? "" : "if (value === undefined) return undefined; "}switch (value) { ${cases} default: throw new Error(${JSON.stringify("CODE_VALUE_UNKNOWN:" + p.name)}); } })(${canonicalExpression})`;
}
const rawName = (index: number) => `__dscValue${index}`;
export function mappedPropBinding(
  p: Prop,
  index: number,
  controlled = false,
): string {
  return `${p.bindings.code.prop}: ${rawName(index)}${controlled || p.default === undefined ? "" : " = " + codeValueLiteral(p, String(p.default))}`;
}
export function mappedPropPrelude(contract: Contract): string[] {
  const out: string[] = [];
  contract.props.forEach((p, index) => {
    if (!p.bindings.code.values) return;
    const cases = Object.entries(p.bindings.code.values)
      .map(
        ([canonical, value]) =>
          `case ${JSON.stringify(value)}: return ${JSON.stringify(canonical)} as const;`,
      )
      .join(" ");
    const local =
      p.bindings.code.prop +
      (contract.events?.some((e) => e.toggles?.prop === p.name) ? "Prop" : "");
    out.push(
      `  const ${local} = ${p.required ? "" : `${rawName(index)} === undefined ? undefined : `}(() => { switch (${rawName(index)}) { ${cases} default: throw new Error(${JSON.stringify("CODE_VALUE_UNSUPPORTED:" + p.name)}); } })();`,
    );
  });
  return out;
}
export function validateCodeValueConsumers(contract: Contract): void {
  const mapped = contract.props.filter(hasCodeValues);
  if (!mapped.length) return;
  mapped.forEach((p) => PropSchema.parse(p));
  const names = new Set(contract.props.map((p) => p.bindings.code.prop));
  for (const w of walkAnatomy(contract))
    if (w.part.slot) names.add(w.part.slot.name);
  for (const e of contract.events ?? []) names.add(e.bindings.code.prop);
  const collisions = omittedCodeBindingConflicts(contract, [...names]);
  if (collisions.length)
    throw Error(`CODE_VALUE_BINDING_COLLISION:${collisions.join(",")}`);
  contract.props.forEach((p, index) => {
    if (!hasCodeValues(p)) return;
    const locals = [rawName(index)];
    if (contract.events?.some((e) => e.toggles?.prop === p.name))
      locals.push(p.bindings.code.prop + "Prop");
    for (const local of locals)
      if (names.has(local))
        throw Error(`CODE_VALUE_BINDING_COLLISION:${local}`);
  });
}
