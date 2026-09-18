import type {
  ReactSourceComponent,
  ReactSourceProp,
  ReactTypeFact,
} from "./react-source-program.js";

type Scalar = string | number | boolean | null;
function finiteDomain(
  type: ReactTypeFact,
  omitUndefined = false,
): Scalar[] | undefined {
  if (type.kind === "boolean") return [false, true];
  if (type.kind === "literal") return [type.value];
  if (type.kind === "null") return [null];
  if (type.kind !== "union") return undefined;
  const domains = type.members
    .filter((member) => !omitUndefined || member.kind !== "undefined")
    .map((member) => finiteDomain(member));
  if (!domains.length || domains.some((domain) => !domain)) return undefined;
  return [
    ...new Map(
      domains
        .flatMap((domain) => domain!)
        .map((value) => [JSON.stringify(value), value]),
    ).values(),
  ];
}

export interface ReactCallbackCandidate {
  callback: string;
  signature: string;
  /** Type-compatible alternatives, never an inferred runtime relationship. */
  stateProperties: string[];
  values?: Scalar[];
  status: "needs-observation" | "unsupported";
  reason: string;
}

/** Only a proven zero-parameter void signature fits the legacy event API.
 * A printed type string is not parsed to manufacture checker evidence. */
export function callbackSignatureProblem(
  prop: ReactSourceProp,
): string | undefined {
  const signatures = prop.callbackSignatures;
  if (!signatures?.length) return "callback-signature-unverified";
  if (signatures.length !== 1) return "callback-overload-unsupported";
  if (signatures[0].typeParameters) return "callback-generic-unsupported";
  if (!signatures[0].returnsVoid) return "callback-return-value-unrepresented";
  if (signatures[0].parameters.length)
    return "callback-arguments-require-behavior-observation";
  return undefined;
}

export function reactCallbackCandidate(
  component: ReactSourceComponent,
  prop: ReactSourceProp,
): ReactCallbackCandidate {
  const row: ReactCallbackCandidate = {
    callback: prop.name,
    signature: prop.type.text,
    stateProperties: [],
    status: "unsupported",
    reason: callbackSignatureProblem(prop) ?? "zero-argument-callback",
  };
  const signature = prop.callbackSignatures?.[0];
  if (
    prop.callbackSignatures?.length !== 1 ||
    !signature ||
    signature.typeParameters ||
    !signature.returnsVoid
  )
    return row;
  if (
    signature.parameters.length !== 1 ||
    signature.parameters[0].optional ||
    signature.parameters[0].rest
  ) {
    row.reason = "callback-single-required-argument-needed";
    return row;
  }
  const values = finiteDomain(signature.parameters[0].type);
  if (!values || values.length < 2 || values.length > 16) {
    row.reason = "callback-finite-domain-required";
    return row;
  }
  row.values = values;
  const key = (domain: Scalar[]) =>
    JSON.stringify(domain.map((value) => JSON.stringify(value)).sort());
  row.stateProperties = component.props
    .filter((candidate) => {
      const domain = finiteDomain(candidate.type, candidate.optional);
      return (
        candidate.name !== prop.name && domain && key(domain) === key(values)
      );
    })
    .map((candidate) => candidate.name);
  if (row.stateProperties.length) {
    row.status = "needs-observation";
    row.reason = "matching-types-do-not-prove-state-or-callback-behavior";
  } else row.reason = "callback-state-domain-unmatched";
  return row;
}
