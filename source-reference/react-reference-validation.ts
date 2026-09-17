import { chromium, type Browser, type Page } from "playwright-core";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  negativeCaseIds,
  negativeControlNames,
  completeNegativeControls,
  inventoryEvidence,
  evidenceUnchanged,
} from "./react-validation-evidence.js";
import { checkSource } from "./check.js";
import { observeSource, watchSourceFailures } from "./observe.js";
import {
  captureReference,
  replayReference,
  archiveInventory,
  requireOpaqueSandbox,
} from "./replay.js";
import { captureValidatedTree } from "./capture.js";
import { observeCheckboxBehavior, type CheckboxBehavior } from './control-behavior.js';
import { reactReferenceCases } from "./react-reference-cases.js";
import {
  reactReferenceProfile,
  reactWitnessesMatch,
} from "./react-reference-profiles.js";
import {
  reactReferenceUnchanged,
  type ReactReference,
} from "./react-reference.js";

export interface ReactValidationRow {
  id: string;
  sourceValid: boolean;
  problems: string[];
  sourceImage?: string;
  replayImage?: string;
  compilerInput?: {
    status: string;
    problems: string[];
    treeSha256?: string;
    census?: unknown;
  };
  negativeControls?: { name: string; rejected: boolean; problems: string[] }[];
  behavior?: CheckboxBehavior & { restored: boolean };
}
export interface ReactValidation {
  id: string;
  referenceId: string;
  state: "running" | "complete" | "failed";
  startedAt: string;
  completedAt?: string;
  engine?: {
    profilesSha256: string;
    files: Record<string, string>;
    browser: string;
  };
  evidence?: Record<string, string>;
  denominator: number;
  valid: number;
  sourceUnchanged: boolean;
  rows: ReactValidationRow[];
  problem?: string;
}
const sha = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");
const negativeCases = new Set<string>(negativeCaseIds);

export async function corruptReactReference(
  page: Page,
  kind: string,
  selector: string,
) {
  await page.evaluate(
    ({ kind, selector }) => {
      if (kind === "missing-root") {
        document.querySelector(selector)?.remove();
        return;
      }
      if (kind === "hidden-root") {
        const node = document.querySelector<HTMLElement>(selector);
        if (node) node.style.visibility = "hidden";
        return;
      }
      const visit = (
        rules: CSSRuleList,
        owner: CSSStyleSheet | CSSGroupingRule,
      ) => {
        for (let i = rules.length - 1; i >= 0; i--) {
          const rule = rules[i];
          if (kind === "missing-font" && rule instanceof CSSFontFaceRule) {
            owner.deleteRule(i);
            continue;
          }
          if (kind === "missing-theme" && rule instanceof CSSStyleRule)
            for (const key of [...rule.style])
              if (key.startsWith("--")) rule.style.removeProperty(key);
          if ("cssRules" in rule)
            visit((rule as CSSGroupingRule).cssRules, rule as CSSGroupingRule);
        }
      };
      if (kind === "missing-css")
        document
          .querySelectorAll('style,link[rel="stylesheet"]')
          .forEach((n) => n.remove());
      else
        for (const sheet of [...document.styleSheets])
          visit(sheet.cssRules, sheet);
    },
    { kind, selector },
  );
  if (kind === "hidden-root") {
    // Authored transition:all can defer visibility:hidden. Prove the corruption
    // actually took effect without stripping transitions from the source.
    await page.waitForFunction(
      (selector) => {
        const node = document.querySelector(selector);
        return !!node && !node.checkVisibility({ checkVisibilityCSS: true });
      },
      selector,
      { timeout: 2000 },
    );
  }
  await page.evaluate(() => document.fonts.ready);
}

/** Runs the same original/replay reader as the existing source workflow. Source
 * roots never come from requests; browser corruptions affect disposable pages. */
export function startReactValidation(
  reference: ReactReference,
  origin: string,
  evidenceRoot: string,
) {
  if (!reactReferenceUnchanged(reference) || !reactWitnessesMatch(reference))
    throw Error("react-reference-witnesses-changed");
  const state: ReactValidation = {
    id: randomUUID(),
    referenceId: reference.id,
    state: "running",
    startedAt: new Date().toISOString(),
    denominator: reactReferenceCases.length,
    valid: 0,
    sourceUnchanged: false,
    rows: [],
  };
  const dir = path.join(evidenceRoot, reference.id, state.id);
  mkdirSync(dir, { recursive: true });
  let browser: Browser | undefined;
  let stopped = false;
  let sealed: Record<string, string> | undefined;
  const record = (name: string, value: unknown) =>
    writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + "\n", {
      flag: "wx",
    });
  let terminalState: "complete" | "failed" = "complete";
  const promise = (async () => {
    try {
      browser = await chromium.launch({ headless: true });
      if (stopped) throw Error("react-validation-interrupted");
      const engineRoot = path.dirname(fileURLToPath(import.meta.url));
      state.engine = {
        browser: browser.version(),
        profilesSha256: sha(
          JSON.stringify(
            reactReferenceCases.map((c) => reactReferenceProfile(c.id)),
          ),
        ),
        files: Object.fromEntries(
          [
            "react-reference-validation.ts",
            "react-validation-evidence.ts",
            "react-reference-profiles.ts",
            "react-reference-cases.ts",
            "react-reference.ts",
            "check.ts",
            "observe.ts",
            "replay.ts",
            "capture.ts",
            "control-behavior.ts",
            "../extract/computed/capture.ts",
            "../extract/computed/lib.ts",
          ].map((file) => [
            file,
            sha(readFileSync(path.join(engineRoot, file))),
          ]),
        ),
      };
      for (const entry of reactReferenceCases) {
        if (stopped) throw Error("react-validation-interrupted");
        const profile = reactReferenceProfile(entry.id);
        const url = `${origin}/api/source-reference/react/${reference.id}?case=${entry.id}`;
        const row: ReactValidationRow = {
          id: entry.id,
          sourceValid: false,
          problems: [],
        };
        state.rows.push(row);
        const rowDir = path.join(dir, entry.id);
        mkdirSync(rowDir);
        const save = (name: string, value: unknown) =>
          writeFileSync(
            path.join(rowDir, name),
            JSON.stringify(value, null, 2) + "\n",
            { flag: "wx" },
          );
        try {
          const har = path.join(rowDir, "original.har");
          const context = await browser.newContext({
            viewport: { width: 900, height: 600 },
            deviceScaleFactor: 1,
            colorScheme: "light",
            serviceWorkers: "allow",
            recordHar: { path: har, content: "embed", mode: "full" },
          });
          let source: Awaited<ReturnType<typeof captureReference>>;
          let sourceTree:
            Awaited<ReturnType<typeof captureValidatedTree>> | undefined;
          try {
            const page = await context.newPage();
            const failures = watchSourceFailures(page);
            await page.goto(url, { waitUntil: "load" });
            await page.locator(profile.path[0]).waitFor({ timeout: 15000 });
            await requireOpaqueSandbox(page);
            source = await captureReference(page, profile, failures);
            if (source.status === "valid")
              sourceTree = await captureValidatedTree(
                page,
                profile,
                failures,
                "#root",
                "--",
              );
            save("source.json", { ...source, screenshot: undefined });
            save("source-tree.json", sourceTree ?? null);
            writeFileSync(path.join(rowDir, "source.png"), source.screenshot, {
              flag: "wx",
            });
            row.sourceImage = sha(source.screenshot);
            if (sourceTree?.status === 'captured' && profile.associatedLabelText !== undefined) {
              const checked = profile.probes?.state.properties?.ariaChecked;
              const disabled = profile.probes?.state.properties?.disabled;
              if (!['false','true','mixed'].includes(String(checked)) || typeof disabled !== 'boolean')
                throw Error('behavior-profile-incomplete');
              const behavior = await observeCheckboxBehavior(page, {
                selector: profile.path[0], checked: checked as 'false' | 'true' | 'mixed', disabled, label: profile.associatedLabelText,
              }, async () => {
                await page.reload({ waitUntil: 'load' });
                await page.locator(profile.path[0]).waitFor({ timeout: 15000 });
                await requireOpaqueSandbox(page);
                await page.evaluate(() => document.fonts.ready);
              });
              const restored = await captureValidatedTree(page, profile, failures, '#root', '--');
              row.behavior = { ...behavior, restored: restored.status === 'captured' &&
                restored.treeSha256 === sourceTree.treeSha256 && restored.sourcePngSha256 === sourceTree.sourcePngSha256 };
              save('behavior.json', row.behavior);
            }
            failures.dispose();
          } finally {
            await context.close();
          }
          const replay = await replayReference(
            browser,
            har,
            url,
            profile,
            { width: 900, height: 600 },
            (page, failures) =>
              captureValidatedTree(page, profile, failures, "#root", "--"),
            undefined,
            "light",
            true,
          );
          save("replay.json", { ...replay, screenshot: undefined });
          save("archive.json", archiveInventory(har));
          writeFileSync(path.join(rowDir, "replay.png"), replay.screenshot, {
            flag: "wx",
          });
          row.replayImage = sha(replay.screenshot);
          row.problems = [...source!.problems, ...replay.problems];
          if (row.behavior) {
            row.problems.push(...row.behavior.problems);
            if (!row.behavior.restored) row.problems.push('behavior-original-not-restored');
          }
          if (source!.secondSha256 !== replay.secondSha256)
            row.problems.push("source-replay-pixels-differ");
          const replayTree = replay.inspection;
          if (
            sourceTree?.status !== "captured" ||
            replayTree?.status !== "captured" ||
            sourceTree.treeSha256 !== replayTree.treeSha256 ||
            sourceTree.sourcePngSha256 !== source!.secondSha256 ||
            replayTree.sourcePngSha256 !== replay.secondSha256
          )
            row.problems.push("source-replay-tree-unverified");
          row.compilerInput = sourceTree
            ? {
                status: sourceTree.status,
                problems: sourceTree.problems,
                ...(sourceTree.status === "captured"
                  ? {
                      treeSha256: sourceTree.treeSha256,
                      census: sourceTree.census,
                    }
                  : {}),
              }
            : { status: "refused", problems: ["source-invalid"] };
          if (negativeCases.has(entry.id)) {
            row.negativeControls = [];
            for (const name of negativeControlNames) {
              const negative = await browser.newContext({
                viewport: { width: 900, height: 600 },
                deviceScaleFactor: 1,
                colorScheme: "light",
                serviceWorkers: "allow",
              });
              try {
                const page = await negative.newPage();
                const failures = watchSourceFailures(page);
                await page.goto(url, { waitUntil: "load" });
                await page.locator(profile.path[0]).waitFor();
                await requireOpaqueSandbox(page);
                await page.evaluate(() => document.fonts.ready);
                const before = checkSource(
                  profile,
                  await observeSource(page, profile, failures),
                );
                await corruptReactReference(page, name, profile.path[0]);
                const result = checkSource(
                  profile,
                  await observeSource(page, profile, failures),
                );
                const expected =
                  name === "missing-css"
                    ? "style-mismatch:"
                    : name === "missing-theme"
                      ? "theme-token-missing:"
                      : name === "missing-font"
                        ? "font-substitution"
                        : name === "missing-root"
                          ? "component-missing"
                          : "component-not-visible";
                const rejected =
                  before.status === "valid" &&
                  result.status === "invalid" &&
                  result.problems.some((p) => p.startsWith(expected));
                row.negativeControls.push({
                  name,
                  rejected,
                  problems: result.problems,
                });
                if (!rejected)
                  row.problems.push(`negative-control-not-proven:${name}`);
                failures.dispose();
              } finally {
                await negative.close();
              }
            }
          }
          row.sourceValid = row.problems.length === 0;
        } catch {
          row.problems.push("source-capture-failed");
        }
        save("result.json", {
          scope:
            "provisional-case-result; validation.json determines cohort validity",
          ...row,
        });
      }
      state.sourceUnchanged =
        reactReferenceUnchanged(reference) && reactWitnessesMatch(reference);
      const controlsProven = completeNegativeControls(state.rows);
      if (!controlsProven) state.problem = "negative-controls-incomplete";
      if (!state.sourceUnchanged)
        state.problem = "source-changed-during-validation";
      if (state.problem) for (const row of state.rows) row.sourceValid = false;
      state.valid = state.rows.filter((r) => r.sourceValid).length;
      terminalState = "complete";
    } catch {
      terminalState = "failed";
      state.valid = 0;
      state.problem = stopped
        ? "react-validation-interrupted"
        : "react-validation-failed";
      for (const row of state.rows) row.sourceValid = false;
    } finally {
      await browser?.close();
      state.completedAt = new Date().toISOString();
      state.evidence = inventoryEvidence(dir);
      // Publish terminal state only after all evidence is closed and sealed;
      // polling during browser shutdown must keep the result provisional.
      record("validation.json", { ...state, state: terminalState });
      sealed = inventoryEvidence(dir);
      state.state = terminalState;
    }
  })();
  return {
    state,
    dir,
    promise,
    report: () => {
      const unchanged = reactReferenceUnchanged(reference);
      const evidenceOk =
        state.state === "running" ||
        (!!sealed && evidenceUnchanged(dir, sealed));
      return unchanged && evidenceOk
        ? state
        : {
            ...state,
            valid: 0,
            sourceUnchanged: unchanged,
            problem: !unchanged
              ? "source-changed-since-validation"
              : "validation-evidence-changed",
            rows: state.rows.map((row) => ({ ...row, sourceValid: false })),
          };
    },
    close: () => {
      stopped = true;
      void browser?.close().catch(() => {});
    },
  };
}
