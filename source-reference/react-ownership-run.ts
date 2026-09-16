import { chromium, type Browser } from "playwright-core";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReactOwnershipReference,
  reactOwnershipHook,
  reactOwnershipRead,
  reactOwnershipMatchesTree,
  type ReactOwnership,
} from "./react-ownership.js";
import {
  reactReferenceHtml,
  reactReferenceUnchanged,
  type ReactReference,
} from "./react-reference.js";
import {
  readReactSourceProgram,
  reactSourceProgramUnchanged,
} from "./react-source-program.js";
import { reactReferenceCases } from "./react-reference-cases.js";
import { reactReferenceProfile } from "./react-reference-profiles.js";
import { captureValidatedTree } from "./capture.js";
import { watchSourceFailures } from "./observe.js";
import {
  evidenceSha,
  inventoryEvidence,
  evidenceUnchanged,
} from "./react-validation-evidence.js";
export interface ReactOwnershipRow {
  id: string;
  matched: boolean;
  problems: string[];
  sourceImage?: string;
  observedImage?: string;
  treeSha256?: string;
  ownership?: ReactOwnership;
}
export interface ReactOwnershipReport {
  id: string;
  referenceId: string;
  state: "running" | "complete" | "failed";
  acceptedContract: null;
  denominator: number;
  matched: number;
  rows: ReactOwnershipRow[];
  sourceUnchanged: boolean;
  problem?: string;
  engine?: Record<string, string>;
  observedReferenceId?: string;
}
/** Private, paired source observation using the same frozen cases and reader.
 * No render configuration, script, path or role map is accepted from the UI. */
export function startReactOwnership(
  reference: ReactReference,
  sourceRoot: string,
  evidenceRoot: string,
) {
  if (!reactReferenceUnchanged(reference))
    throw Error("react-ownership-source-changed");
  const modules = Object.keys(reference.files)
    .filter(
      (f) =>
        f.startsWith(path.join(sourceRoot, "src") + path.sep) &&
        f.endsWith(".tsx"),
    )
    .map((f) => path.relative(sourceRoot, f));
  const program = readReactSourceProgram(sourceRoot, modules);
  const state: ReactOwnershipReport = {
    id: randomUUID(),
    referenceId: reference.id,
    state: "running",
    acceptedContract: null,
    denominator: reactReferenceCases.length,
    matched: 0,
    rows: [],
    sourceUnchanged: false,
  };
  const dir = path.join(evidenceRoot, reference.id, state.id);
  mkdirSync(dir, { recursive: true });
  let browser: Browser | undefined,
    stopped = false,
    sealed: Record<string, string> | undefined;
  const unchanged = () =>
    reactReferenceUnchanged(reference) && reactSourceProgramUnchanged(program);
  const promise = (async () => {
    let terminal: "complete" | "failed" = "complete";
    try {
      const observed = await buildReactOwnershipReference(
        sourceRoot,
        reference,
        program,
      );
      state.observedReferenceId = observed.id;
      const root = path.dirname(fileURLToPath(import.meta.url));
      state.engine = Object.fromEntries(
        [
          "react-ownership.ts",
          "react-ownership-run.ts",
          "react-reference.ts",
          "react-source-program.ts",
          "react-children.ts",
          "capture.ts",
          "react-reference-profiles.ts",
          "react-reference-cases.ts",
        ].map((f) => [f, evidenceSha(readFileSync(path.join(root, f)))]),
      );
      writeFileSync(
        path.join(dir, "program.json"),
        JSON.stringify(program, null, 2) + "\n",
        { flag: "wx" },
      );
      browser = await chromium.launch();
      if (stopped) throw Error("react-ownership-interrupted");
      for (const c of reactReferenceCases) {
        if (stopped || !unchanged())
          throw Error("react-ownership-interrupted-or-source-changed");
        const row: ReactOwnershipRow = {
          id: c.id,
          matched: false,
          problems: [],
        };
        state.rows.push(row);
        const rowDir = path.join(dir, c.id);
        mkdirSync(rowDir);
        try {
          const pair = [];
          for (const instrumented of [false, true]) {
            const side = instrumented ? "observed" : "source";
            const context = await browser.newContext({
              viewport: { width: 900, height: 600 },
              deviceScaleFactor: 1,
              colorScheme: "light",
            });
            try {
              if (instrumented) await context.addInitScript(reactOwnershipHook);
              const url = "http://127.0.0.1/react-ownership?case=" + c.id;
              await context.route("**/*", (route) =>
                route.request().url() === url
                  ? route.fulfill({
                      status: 200,
                      contentType: "text/html",
                      headers: {
                        "Content-Security-Policy":
                          "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'",
                      },
                      body: reactReferenceHtml(
                        instrumented ? observed : reference,
                      ),
                    })
                  : route.abort(),
              );
              const page = await context.newPage(),
                failures = watchSourceFailures(page),
                profile = reactReferenceProfile(c.id);
              await page.goto(url);
              await page.locator(profile.path[0]).waitFor({ timeout: 15000 });
              const tree = await captureValidatedTree(
                page,
                profile,
                failures,
                "#root",
                "--",
              );
              writeFileSync(
                path.join(rowDir, side + "-tree.json"),
                JSON.stringify(tree, null, 2) + "\n",
                { flag: "wx" },
              );
              if (tree.status !== "captured")
                throw Error(
                  "react-ownership-" +
                    side +
                    "-capture-refused:" +
                    tree.problems.join(","),
                );
              const png = await page.screenshot({
                fullPage: true,
                caret: "initial",
              });
              if (evidenceSha(png) !== tree.sourcePngSha256)
                throw Error("react-ownership-render-changed-after-capture");
              writeFileSync(path.join(rowDir, side + ".png"), png, {
                flag: "wx",
              });
              const ownership = instrumented
                ? ((await page.evaluate(
                    reactOwnershipRead(profile.path[0]),
                  )) as ReactOwnership)
                : undefined;
              if (ownership?.problems.length)
                throw Error(ownership.problems.join(","));
              if (ownership) {
                if (!reactOwnershipMatchesTree(ownership, tree.tree))
                  throw Error("react-ownership-captured-paths-differ");
                const again = await page.evaluate(
                  reactOwnershipRead(profile.path[0]),
                );
                if (JSON.stringify(again) !== JSON.stringify(ownership))
                  throw Error("react-ownership-not-stable");
                if (
                  !ownership.components.some(
                    (i) =>
                      i.source.exportName === c.subject && i.roots.includes(""),
                  )
                )
                  throw Error("react-ownership-subject-root-unmatched");
              }
              pair.push({
                tree: tree.treeSha256,
                png: tree.sourcePngSha256,
                ownership,
              });
              failures.dispose();
            } finally {
              await context.close();
            }
          }
          row.sourceImage = pair[0].png;
          row.observedImage = pair[1].png;
          if (pair[0].tree !== pair[1].tree || pair[0].png !== pair[1].png)
            throw Error("react-ownership-observation-changed-reference");
          row.treeSha256 = pair[0].tree;
          row.ownership = pair[1].ownership;
          row.matched = true;
          writeFileSync(
            path.join(rowDir, "ownership.json"),
            JSON.stringify(row.ownership, null, 2) + "\n",
            { flag: "wx" },
          );
        } catch (error) {
          row.problems.push(
            error instanceof Error ? error.message : String(error),
          );
        }
      }
      if (!unchanged()) throw Error("react-ownership-source-changed");
    } catch (error) {
      terminal = "failed";
      state.problem = error instanceof Error ? error.message : String(error);
    } finally {
      await browser?.close().catch(() => {});
      state.sourceUnchanged = unchanged();
      if (stopped || !state.sourceUnchanged) {
        terminal = "failed";
        state.problem = stopped
          ? "react-ownership-interrupted"
          : "react-ownership-source-changed";
      }
      if (terminal === "failed")
        for (const row of state.rows) row.matched = false;
      state.matched = state.rows.filter((r) => r.matched).length;
      writeFileSync(
        path.join(dir, "report.json"),
        JSON.stringify({ ...state, state: terminal }, null, 2) + "\n",
        { flag: "wx" },
      );
      sealed = inventoryEvidence(dir);
      state.state = terminal;
    }
  })();
  return {
    state,
    dir,
    promise,
    report: (): ReactOwnershipReport => {
      const current = unchanged(),
        intact =
          state.state === "running" ||
          (!!sealed && evidenceUnchanged(dir, sealed));
      return current && intact
        ? state
        : {
            ...state,
            matched: 0,
            sourceUnchanged: current,
            problem: current
              ? "react-ownership-evidence-changed"
              : "react-ownership-source-changed",
            rows: state.rows.map((r) => ({ ...r, matched: false })),
          };
    },
    close: () => {
      stopped = true;
      void browser?.close().catch(() => {});
    },
  };
}
