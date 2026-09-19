import { ContractSchema, type Contract } from "../scripts/contract-schema.js";
import { revisionOf } from "../core/contract-provenance.js";
import { emitReactInline } from "../core/emit-react-inline.js";
import type { ReactInitialInspection } from "./react-initial-inspection.js";
import type { ReactCallbackInspection } from "./react-callback-inspection.js";
import { checkedToggleRole, checkedStateValid } from './control-behavior.js';

export interface ReactBehaviorContract {
  status: "generated-draft" | "refused";
  contract?: Contract;
  tsx?: string;
  problems: string[];
  limitations: string[];
}
/** Host supplies authenticated records from the same source archive. This
 * adds observed state semantics to an existing appearance draft; it does not
 * manufacture appearance for controlled inputs or qualify native behavior. */
export function projectReactBehaviorContract(
  initial: ReactInitialInspection | undefined,
  behavior: ReactCallbackInspection,
): ReactBehaviorContract {
  const result: ReactBehaviorContract = {
    status: "refused",
    problems: [],
    limitations: [
      "controlled-source-appearance-not-compared",
      "associated-label-composition-not-generated",
      "generated-consumer-not-qualified",
      "native-behavior-metadata-not-qualified",
    ],
  };
  try {
    if (
      !initial ||
      initial.caseId !== behavior.caseId ||
      initial.instanceId !== behavior.instanceId ||
      initial.phase !== "complete" ||
      !initial.sourceUnchanged ||
      initial.problems.length ||
      initial.draft?.status !== "compiled-draft" ||
      !initial.observation ||
      !initial.draft.compiled?.contract ||
      !initial.draft.compiled.tokens ||
      behavior.phase !== "complete" ||
      !behavior.sourceUnchanged ||
      behavior.problems.length ||
      !behavior.observation ||
      behavior.observation.problems.length
    )
      throw Error("behavior-contract-source-evidence-incomplete");
    const observed = behavior.observation;
    if ((behavior.instanceId && !observed.target) || (observed.target &&
        (observed.target.instanceId !== initial.observation.instanceId ||
         revisionOf(observed.target.source) !== revisionOf(initial.observation.source))))
      throw Error('behavior-contract-source-target-mismatch');
    // Stored evidence is judged again here; the observer's refusal is not
    // assumed. Observations sealed before the role was recorded could only
    // have been a checkbox: the observer then refused every other role.
    const role = observed.role === undefined ? "checkbox" : checkedToggleRole(observed.role);
    if (!role) throw Error("behavior-contract-role-unsupported");
    if (observed.rows.some((row) => [row.initial, row.live, ...row.steps.map((step) => step.control)]
        .some((control) => !checkedStateValid(role, control.checked))))
      throw Error("behavior-contract-state-unsupported-for-role");
    const controlled = observed.relationships.filter(
        (r) => r.status === "controlled-observed",
      ),
      defaults = observed.relationships.filter(
        (r) => r.status === "initial-only-observed",
      );
    if (
      controlled.length !== 1 ||
      defaults.length !== 1 ||
      controlled[0].callback !== defaults[0].callback
    )
      throw Error("behavior-contract-state-relationship-ambiguous");
    const control = controlled[0],
      initialInput = defaults[0];
    const candidate = observed.candidates.find(
      (c) =>
        c.callback === control.callback && c.status === "needs-observation",
    );
    if (
      !candidate?.values ||
      candidate.stateProperties.length !== 2 ||
      !candidate.stateProperties.includes(control.property) ||
      !candidate.stateProperties.includes(initialInput.property)
    )
      throw Error("behavior-contract-source-domain-ambiguous");
    const contract = structuredClone(initial.draft.compiled.contract),
      prop = contract.props.find(
        (p) => p.bindings.code.prop === initialInput.property,
      );
    if (
      !prop ||
      typeof prop.type !== "object" ||
      !("enum" in prop.type) ||
      prop.required ||
      prop.bindings.code.initial ||
      contract.events?.length ||
      contract.props.some((p) => p.bindings.code.prop === control.property)
    )
      throw Error("behavior-contract-state-axis-unavailable");
    const values = prop.type.enum,
      publicValue = (key: string) =>
        prop.bindings.code.values ? prop.bindings.code.values[key] : key;
    if (
      values.length !== candidate.values.length ||
      values.some(
        (key) =>
          !candidate.values!.some((value) =>
            Object.is(value, publicValue(key)),
          ),
      )
    )
      throw Error("behavior-contract-state-domain-mismatch");
    const state = (key: string) => {
      const rows = observed.rows.filter(
        (row) =>
          row.callback === control.callback &&
          Object.is(row.value, publicValue(key)),
      );
      if (
        rows.length !== 4 ||
        rows.some(
          (row) =>
            !row.restored || row.initial.disabled || row.steps.length !== 2,
        ) ||
        new Set(rows.map((row) => row.initial.checked)).size !== 1
      )
        throw Error("behavior-contract-state-observation-incomplete");
      return rows[0].initial.checked;
    };
    if (observed.rows.length !== values.length * 4)
      throw Error("behavior-contract-state-observation-incomplete");
    const stateFor = (value: unknown) => {
      const key = values.find((key) => Object.is(publicValue(key), value));
      return key === undefined ? undefined : state(key);
    };
    for (const key of values) {
      const rows = observed.rows.filter((row) =>
        Object.is(row.value, publicValue(key)),
      );
      if (
        new Set(rows.map((row) => row.property + ":" + row.action)).size !== 4
      )
        throw Error("behavior-contract-duplicate-action");
      for (const row of rows) {
        const held = row.property === control.property;
        if (!held && row.property !== initialInput.property)
          throw Error("behavior-contract-unexpected-input");
        if (held && row.live.checked !== row.initial.checked)
          throw Error("behavior-contract-live-state-mismatch");
        for (const [index, step] of row.steps.entries()) {
          const prior =
            held || index === 0
              ? row.initial.checked
              : row.steps[index - 1].control.checked;
          const expected = prior === "true" ? "false" : "true";
          if (
            step.control.disabled ||
            step.control.checked !== (held ? row.initial.checked : expected) ||
            step.callback.problems.length ||
            step.callback.calls.length !== index + 1 ||
            step.callback.calls[index].length !== 1 ||
            stateFor(step.callback.calls[index][0]) !== expected
          )
            throw Error("behavior-contract-transition-unverified");
        }
      }
    }
    if (
      new Set(
        observed.rows
          .filter((row) => row.property === initialInput.property)
          .map((row) => row.live.checked),
      ).size !== 1
    )
      throw Error("behavior-contract-initial-only-unverified");
    const off = values.filter((key) => state(key) === "false"),
      on = values.filter((key) => state(key) === "true");
    if (off.length !== 1 || on.length !== 1)
      throw Error("behavior-contract-toggle-pair-unverified");
    // The missing initializer must be equivalent across every other observed
    // input context. Do not collapse a visually distinct omitted plane.
    const omissions = initial.observation.rows.filter(
      (row) => row.changes[prop.name]?.kind === "omit",
    );
    const equivalent = values.filter(
      (key) =>
        omissions.length > 0 &&
        omissions.every((row) => {
          const changes = {
            ...row.changes,
            [prop.name]: { kind: "set", value: publicValue(key) },
          };
          const explicit = initial.observation!.rows.find(
            (other) => revisionOf(other.changes) === revisionOf(changes),
          );
          return (
            explicit?.status === "observed" &&
            explicit.restored &&
            row.status === "observed" &&
            row.restored &&
            explicit.image === row.image &&
            explicit.treeSha256 === row.treeSha256
          );
        }),
    );
    if (equivalent.length !== 1)
      throw Error("behavior-contract-omitted-initial-value-unverified");
    if (
      contract.semantics.element !== "button" ||
      contract.semantics.role ||
      contract.anatomy.root.attrs?.["aria-checked"]
    )
      throw Error("behavior-contract-root-semantic-conflict");
    prop.bindings.code = {
      ...prop.bindings.code,
      prop: control.property,
      initial: { prop: initialInput.property, default: equivalent[0] },
    };
    contract.semantics = {
      ...contract.semantics,
      role,
      roleException: `Source root independently observed as a button-backed ${role}.`,
    };
    const name = control.callback.slice(2);
    contract.events = [
      {
        name: name[0]?.toLowerCase() + name.slice(1),
        trigger: "root",
        toggles: { prop: prop.name, between: [off[0], on[0]], aria: "checked" },
        bindings: { code: { prop: control.callback, argument: "next-value" } },
      },
    ];
    contract.id += "-behavior";
    contract.name += "Behavior";
    contract.bindings.code.anchors.export = contract.name;
    contract.description =
      "Observed source state/callback semantics applied to an initial appearance draft. Full visual, composition and native qualification remain pending.";
    result.contract = ContractSchema.parse(contract);
    result.tsx = emitReactInline(result.contract, {
      contracts: new Map([[result.contract.id, result.contract]]),
      icons: new Map(initial.draft.compiled.assets),
      tokens: {
        primitives: initial.draft.compiled.tokens,
        semantic: {},
        light: {},
        dark: {},
        brands: { default: {} },
      },
    }).tsx;
    result.status = "generated-draft";
  } catch (error) {
    result.problems.push(
      error instanceof Error ? error.message : String(error),
    );
  }
  return result;
}
