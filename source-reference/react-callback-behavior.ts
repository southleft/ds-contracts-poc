import type { Page } from "playwright-core";
import type { ReactSourceProgram } from "./react-source-program.js";
import { reactOwnershipRead, type ReactOwnership } from "./react-ownership.js";
import { revisionOf } from '../core/contract-provenance.js';
import { checkedToggleRole, checkedStateValid, type CheckedToggleRole } from './control-behavior.js';
import {
  reactCallbackCandidate,
  type ReactCallbackCandidate,
} from "./react-callback-candidates.js";
import {
  probeReactInitialProperties,
  probeReactProperties,
  type ReactPropertyChanges,
  type ReactCallbackObservation,
} from "./react-property-probe.js";

type Scalar = string | number | boolean | null;
type Control = { checked: string; disabled: boolean };
export interface ReactCallbackBehavior {
  /** A recorded identifier, kept as first written so sealed observations stay
   * readable. `role` names the observed member of the checked-toggle class;
   * observations sealed before it was recorded could only be a checkbox. */
  qualification: "observed-source-checkbox-behavior-only";
  role?: CheckedToggleRole;
  target?: { instanceId: string; source: ReactOwnership['components'][number]['source']; rootPath: string };
  candidates: ReactCallbackCandidate[];
  rows: Array<{
    callback: string;
    property: string;
    value: Scalar;
    action: "space" | "associated-label";
    initial: Control;
    steps: Array<{ control: Control; callback: ReactCallbackObservation }>;
    live: Control;
    restored: boolean;
  }>;
  relationships: Array<{
    callback: string;
    property: string;
    status: "controlled-observed" | "initial-only-observed" | "unresolved";
    reason: string;
  }>;
  problems: string[];
}
/** Exercise semantic checked-state toggles (checkbox, switch) by their observed
 * role, irrespective of component/export names.
 * Relationships require all finite values, two real activations, live input
 * updates, callback payloads, and independent restoration by the host. They are
 * bounded observations, not proof of arbitrary runtime behavior. */
export async function observeReactCallbackBehavior(input: {
  page: Page;
  selector: string;
  program: ReactSourceProgram;
  ownership: ReactOwnership;
  instanceId: string;
  assertRestored: () => Promise<void>;
  assertCurrent: () => void;
}) {
  const { page, selector, program, ownership, instanceId } = input;
  const instance = ownership.components.find((c) => c.id === instanceId);
  const component =
    instance &&
    program.components.find(
      (c) =>
        c.module === instance.source.module &&
        c.exportName === instance.source.exportName &&
        c.sourceSha256 === instance.source.sourceSha256 &&
        c.span.start === instance.source.span.start &&
        c.span.end === instance.source.span.end,
    );
  if (!component) throw Error("callback-source-identity-missing");
  if (!instance || instance.roots.length !== 1) throw Error('callback-control-root-ambiguous');
  const rootPath = instance.roots[0];
  if (rootPath && !/^\d+(?:\.\d+)*$/.test(rootPath)) throw Error('callback-control-path-invalid');
  const controlSelector = selector + (rootPath ? rootPath.split('.').map(i => ' > :nth-child(' + (Number(i) + 1) + ')').join('') : '');
  const candidates = component.props
    .filter((p) => p.callbackSignatures?.length)
    .map((p) => reactCallbackCandidate(component, p));
  const result: ReactCallbackBehavior = {
    qualification: "observed-source-checkbox-behavior-only",
    target: { instanceId, source: structuredClone(instance.source), rootPath },
    candidates,
    rows: [],
    relationships: [],
    problems: [],
  };
  const settle = () =>
    page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  const read = async (): Promise<Control> => {
    const current = await page.evaluate(reactOwnershipRead(selector)) as ReactOwnership;
    const target = current.components.find(c => c.id === instanceId);
    if (current.problems.length || !target || revisionOf(target.source) !== revisionOf(instance.source) ||
        target.roots.length !== 1 || target.roots[0] !== rootPath) throw Error('callback-control-identity-changed');
    if ((await page.locator(controlSelector).count()) !== 1)
      throw Error("callback-control-ambiguous");
    // The page reports facts; class membership is judged here so a refusal
    // leaves as a clean identifier, not wrapped in browser error text.
    const observed = await page.locator(controlSelector).evaluate((element) => {
      const native =
        element instanceof HTMLInputElement && element.type === "checkbox";
      return {
        role: native
          ? element.getAttribute("role") === "switch"
            ? "switch"
            : "checkbox"
          : element.getAttribute("role"),
        checked: native
          ? element.indeterminate
            ? "mixed"
            : String(element.checked)
          : element.getAttribute("aria-checked"),
        disabled:
          element instanceof HTMLInputElement ||
          element instanceof HTMLButtonElement
            ? element.disabled
            : element.getAttribute("aria-disabled") === "true",
      };
    });
    const role = checkedToggleRole(observed.role);
    if (!role) throw Error("callback-control-role-unsupported");
    if (!["false", "true", "mixed"].includes(observed.checked ?? ""))
      throw Error("callback-control-state-unsupported");
    if (!checkedStateValid(role, observed.checked))
      throw Error("callback-control-state-unsupported-for-role");
    // The member observed first is the member for every trial that follows.
    if (result.role && result.role !== role)
      throw Error("callback-control-role-changed");
    result.role = role;
    return { checked: observed.checked!, disabled: observed.disabled };
  };
  const activate = async (
    action: "space" | "associated-label",
    disabled: boolean,
  ) => {
    if (action === "space") {
      await page.locator(controlSelector).focus();
      const focused = await page
        .locator(controlSelector)
        .evaluate((element) => document.activeElement === element);
      if (focused === disabled) throw Error("callback-focus-mismatch");
      await page.keyboard.press("Space");
    } else {
      const label = await page.locator(controlSelector).evaluateHandle((element) => {
        const labels =
          element instanceof HTMLInputElement ||
          element instanceof HTMLButtonElement
            ? element.labels
            : null;
        if (
          labels?.length !== 1 ||
          labels[0].control !== element ||
          !labels[0].checkVisibility({ checkVisibilityCSS: true })
        )
          throw Error("callback-label-association-unavailable");
        return labels[0];
      });
      try {
        await label.asElement()!.click({ force: disabled, timeout: 3000 });
      } finally {
        await label.dispose();
      }
    }
    await settle();
  };
  try {
    if (!candidates.some((c) => c.status === "needs-observation"))
      throw Error("callback-finite-candidates-unavailable");
    await read();
    for (const candidate of candidates.filter(
      (c) => c.status === "needs-observation",
    )) {
      // An unknown competing value could mask either relationship. Do not change
      // a required input or silently hold it while calling the result independent.
      if (
        candidate.stateProperties.some(
          (name) => !component.props.find((p) => p.name === name)?.optional,
        )
      )
        throw Error("callback-competing-input-not-omittable");
      for (const property of candidate.stateProperties)
        for (const value of candidate.values!) {
          input.assertCurrent();
          const changes: ReactPropertyChanges = Object.fromEntries(
            candidate.stateProperties.map((name) => [
              name,
              name === property ? { kind: "set", value } : { kind: "omit" },
            ]),
          );
          const live = await probeReactProperties(
            page,
            selector,
            program,
            instanceId,
            changes,
            read,
          );
          if (!live.ownershipRestored)
            throw Error("callback-live-ownership-not-restored");
          await input.assertRestored();
          for (const action of ["space", "associated-label"] as const) {
            const trial = await probeReactInitialProperties(
              page,
              selector,
              program,
              instanceId,
              changes,
              async (phase, callback) => {
                await settle();
                const initial = await read();
                const steps: ReactCallbackBehavior["rows"][number]["steps"] =
                  [];
                if (phase === "changed") {
                  const mounting = await callback();
                  if (mounting.calls.length || mounting.problems.length)
                    throw Error("callback-fired-before-activation");
                  for (let count = 0; count < 2; count++) {
                    await activate(action, initial.disabled);
                    steps.push({
                      control: await read(),
                      callback: await callback(),
                    });
                  }
                }
                return { initial, steps };
              },
              candidate.callback,
            );
            if (!trial.ownershipRestored)
              throw Error("callback-initial-ownership-not-restored");
            await input.assertRestored();
            input.assertCurrent();
            result.rows.push({
              callback: candidate.callback,
              property,
              value,
              action,
              ...trial.changed,
              live: live.changed,
              restored: true,
            });
            if (
              trial.changed.initial.disabled &&
              trial.changed.steps.some(
                (step) =>
                  !step.control.disabled ||
                  step.control.checked !== trial.changed.initial.checked ||
                  step.callback.calls.length ||
                  step.callback.problems.length,
              )
            )
              throw Error("callback-disabled-activation-not-suppressed");
          }
        }
      for (const property of candidate.stateProperties) {
        const rows = result.rows.filter(
          (r) => r.callback === candidate.callback && r.property === property,
        );
        const stateFor = (value: Scalar) =>
          rows.find((r) => Object.is(r.value, value))?.initial.checked;
        const complete =
          rows.length === candidate.values!.length * 2 &&
          new Set(candidate.values!.map(stateFor)).size ===
            candidate.values!.length;
        const valid =
          complete &&
          rows.every(
            (row) =>
              !row.initial.disabled &&
              row.steps.every(
                (step, index) =>
                  !step.control.disabled &&
                  step.callback.problems.length === 0 &&
                  step.callback.calls.length === index + 1 &&
                  step.callback.calls.every(
                    (args) =>
                      args.length === 1 &&
                      candidate.values!.some((value) =>
                        Object.is(value, args[0]),
                      ),
                  ),
              ),
          );
        const next = (state: string) => (state === "true" ? "false" : "true");
        const held =
          valid &&
          rows.every(
            (row) =>
              row.live.checked === row.initial.checked &&
              row.steps.every(
                (step, index) =>
                  step.control.checked === row.initial.checked &&
                  stateFor(step.callback.calls[index][0]) ===
                    next(row.initial.checked),
              ),
          );
        const initialOnly =
          valid &&
          new Set(rows.map((row) => row.live.checked)).size === 1 &&
          rows.every((row) =>
            row.steps.every((step, index) => {
              const prior =
                index === 0
                  ? row.initial.checked
                  : row.steps[index - 1].control.checked;
              return (
                step.control.checked === next(prior) &&
                stateFor(step.callback.calls[index][0]) === step.control.checked
              );
            }),
          );
        result.relationships.push({
          callback: candidate.callback,
          property,
          status: held
            ? "controlled-observed"
            : initialOnly
              ? "initial-only-observed"
              : "unresolved",
          reason: held
            ? "Supplied values control rendering; activation reports the next value without changing the supplied state."
            : initialOnly
              ? "Fresh mounts use this value; live input updates leave state unchanged, while activation updates it."
              : "Observed behavior does not establish a unique controlled or initial-only relationship.",
        });
      }
    }
  } catch (error) {
    result.problems.push(
      error instanceof Error ? error.message : String(error),
    );
  }
  return result;
}
