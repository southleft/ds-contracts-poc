import type { Page } from 'playwright-core';

/** The ARIA checked-state toggle class. Membership is the OBSERVED role, never
 * a component or export name. `mixed` is a checkbox state; ARIA defines no
 * mixed switch, so a source claiming one is outside the class. */
export const checkedToggleRoles = ['checkbox', 'switch'] as const;
export type CheckedToggleRole = typeof checkedToggleRoles[number];
export const checkedToggleRole = (role: unknown): CheckedToggleRole | undefined => checkedToggleRoles.find(r => r === role);
export const checkedStateValid = (role: CheckedToggleRole, checked: unknown) =>
  checked === 'false' || checked === 'true' || (role === 'checkbox' && checked === 'mixed');

/** `scope` is a recorded identifier kept as first written, so sealed evidence
 * stays readable; `role` names the class member that was actually observed. */
export interface CheckboxBehavior {
  version: 1;
  scope: 'source-checkbox-interactions';
  role?: CheckedToggleRole;
  status: 'observed' | 'failed';
  rows: Array<{ action: 'associated-label' | 'space'; before: string; expected: string; after: string; passed: boolean }>;
  problems: string[];
}

/** Exercise the original in a disposable browser. No event handlers, attributes,
 * styles or state setters are injected. Each action begins from a fresh mount;
 * the caller must independently verify the restored source after this returns. */
export async function observeCheckboxBehavior(page: Page,
  input: { selector: string; checked: 'false' | 'true' | 'mixed'; disabled: boolean; label: string },
  reset: () => Promise<void>): Promise<CheckboxBehavior> {
  const result: CheckboxBehavior = { version: 1, scope: 'source-checkbox-interactions', status: 'failed', rows: [], problems: [] };
  const read = () => page.locator(input.selector).evaluate(element => {
    const native = element instanceof HTMLInputElement && element.type === 'checkbox';
    const labels = element instanceof HTMLInputElement || element instanceof HTMLButtonElement ? [...(element.labels ?? [])] : [];
    return {
      // A native checkbox carrying role="switch" is the native switch pattern.
      role: native ? element.getAttribute('role') === 'switch' ? 'switch' : 'checkbox' : element.getAttribute('role'),
      checked: native ? element.indeterminate ? 'mixed' : String(element.checked) : element.getAttribute('aria-checked'),
      disabled: element instanceof HTMLInputElement || element instanceof HTMLButtonElement ? element.disabled : element.getAttribute('aria-disabled') === 'true',
      labels: labels.map(label => ({ text: label.textContent?.trim(), associated: label.control === element, visible: label.checkVisibility({ checkVisibilityCSS: true }) })),
      focused: document.activeElement === element,
    };
  });
  try {
    for (const action of ['associated-label', 'space'] as const) {
      await reset();
      if (await page.locator(input.selector).count() !== 1) throw Error('behavior-control-ambiguous');
      const before = await read();
      const role = checkedToggleRole(before.role);
      if (!role || before.checked !== input.checked || before.disabled !== input.disabled)
        throw Error('behavior-initial-state-mismatch');
      if (!checkedStateValid(role, input.checked)) throw Error('behavior-state-unsupported-for-role');
      // Every fresh mount must be the same class member as the first.
      if (result.role && result.role !== role) throw Error('behavior-role-changed');
      result.role = role;
      if (before.labels.length !== 1 || before.labels[0].text !== input.label || !before.labels[0].associated || !before.labels[0].visible)
        throw Error('behavior-label-association-mismatch');
      const expected = input.disabled ? input.checked : input.checked === 'true' ? 'false' : 'true';
      if (action === 'associated-label') {
        // Resolve the actual native association, not nearby matching text.
        const label = await page.locator(input.selector).evaluateHandle(element =>
          (element as HTMLInputElement | HTMLButtonElement).labels![0]);
        // Playwright treats a disabled control's label as disabled. Send the
        // real pointer click anyway: the browser must suppress activation.
        try { await label.asElement()!.click({ force: input.disabled, timeout: 3000 }); } finally { await label.dispose(); }
      } else {
        await page.locator(input.selector).focus();
        if ((await read()).focused === input.disabled) throw Error('behavior-focus-mismatch');
        await page.keyboard.press('Space');
      }
      if (!input.disabled) await page.waitForFunction(({ selector, expected }) => {
        const element = document.querySelector(selector);
        return element instanceof HTMLInputElement && element.type === 'checkbox'
          ? !element.indeterminate && String(element.checked) === expected : element?.getAttribute('aria-checked') === expected;
      }, { selector: input.selector, expected }, { timeout: 1000 }).catch(() => {});
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const after = await read();
      const passed = after.checked === expected && after.role === role && after.disabled === input.disabled;
      result.rows.push({ action, before: before.checked!, expected, after: after.checked ?? 'missing', passed });
      if (!passed) result.problems.push('behavior-transition-mismatch:' + action);
    }
    if (!result.problems.length) result.status = 'observed';
  } catch (error) {
    result.problems.push(error instanceof Error && error.message.startsWith('behavior-') ? error.message : 'behavior-observation-failed');
  } finally {
    try { await reset(); } catch { result.status = 'failed'; result.problems.push('behavior-restore-failed'); }
  }
  return result;
}
