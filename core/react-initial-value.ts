import {
  ContractSchema,
  type Contract,
  type Prop,
} from "../scripts/contract-schema.js";
import { codeValueLiteral } from "./code-values.js";
import { contractApiNames } from "../packages/core/src/prop-collision.js";

export const reactInitialInput = (contract: Contract, prop: Prop) =>
  `__dscInitial${contract.props.indexOf(prop)}`;
/** A lazy initializer reads the public initial input exactly once. Null, false
 * and omission remain distinct; defaults are canonical values, not coercions. */
export function reactInitialValue(contract: Contract, prop: Prop): string {
  const initial = prop.bindings.code.initial;
  if (!initial)
    return prop.default === undefined ? "undefined" : `'${prop.default}'`;
  if (typeof prop.type !== "object" || !("enum" in prop.type))
    throw Error("REACT_INITIAL_ENUM_REQUIRED");
  const raw = reactInitialInput(contract, prop),
    fallback = initial.default ?? prop.default;
  const cases = prop.type.enum
    .map(
      (value) =>
        `case ${codeValueLiteral(prop, value)}: return ${JSON.stringify(value)} as const;`,
    )
    .join(" ");
  return `() => { if (${raw} === undefined) return ${fallback === undefined ? "undefined" : JSON.stringify(fallback) + " as const"}; switch (${raw}) { ${cases} default: throw new Error(${JSON.stringify("CODE_INITIAL_VALUE_UNSUPPORTED:" + prop.name)}); } }`;
}

export function validateReactInitialBindings(contract: Contract): void {
  if (!contract.props.some((p) => p.bindings.code.initial)) return;
  ContractSchema.parse(contract);
  if (contract.bindings.code.runtime)
    throw Error("REACT_INITIAL_RETAINED_RUNTIME_UNSUPPORTED");
  const names = contractApiNames(contract);
  for (const prop of contract.props.filter((p) => p.bindings.code.initial))
    if (names.includes(reactInitialInput(contract, prop)))
      throw Error("CODE_INITIAL_BINDING_COLLISION");
}
