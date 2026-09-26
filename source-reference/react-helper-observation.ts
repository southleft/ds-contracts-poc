import { readFileSync, realpathSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { version as esbuildVersion } from "esbuild";
import type { Browser } from "playwright-core";
import type { ReactSourceProgram } from "./react-source-program.js";
import { type ReactReference, reactReferenceHtml } from "./react-reference.js";
import {
  buildReactOwnershipReference,
  reactOwnershipHook,
  reactOwnershipRead,
  reactOwnershipStructure,
  type ReactOwnership,
} from "./react-ownership.js";
import {
  readReactHelperEffects,
  readReactComponentEffects,
} from "./react-helper-effects.js";
import { createReactHelperObserver } from "./react-helper-transform.js";
import {
  reactHelperRuntimeHook,
  reactHelperRuntimeRead,
  type ReactHelperRuntimeReport,
} from "./react-helper-runtime.js";
import { type ReactHelperInstrumentationPlan } from "./react-helper-instrument.js";
import { evidenceSha } from "./react-validation-evidence.js";
import { captureValidatedTree } from "./capture.js";
import { watchSourceFailures } from "./observe.js";

export interface ReactHelperObservation {
  version: 1;
  id: string;
  /** Instance whose serialized props proposed this finite call-site context. */
  instanceId: string;
  runtimeScope: "callsite-context";
  status: "observed" | "refused";
  acceptedContract: null;
  containingContentQualified: false;
  containingFlow?: {
    status: "observed" | "refused";
    modelSha256: string;
    reason?: string;
    content?: "forwarded" | "not-directly-forwarded";
  };
  reason?: string;
  /** Also checked when the host serves the containing sealed ownership report. */
  inputs?: Record<string, string>;
  runtime?: ReactHelperRuntimeReport;
  evidence?: {
    runtimeSha256?: string;
    buildSha256?: string;
    modelSha256: string;
    planSha256: string;
    referenceId: string;
    treeSha256: string;
    pngSha256: string;
    ownershipSha256: string;
    pairedOwnershipSha256?: string;
  };
}
export function reactHelperObservationUnchanged(
  observation: ReactHelperObservation,
): boolean {
  try {
    if (
      observation.status === "observed" &&
      (!observation.inputs ||
        !Object.keys(observation.inputs).length ||
        !observation.evidence ||
        observation.runtime?.status !== "observed")
    )
      return false;
    return (
      !observation.inputs ||
      Object.entries(observation.inputs).every(
        ([file, hash]) =>
          realpathSync(file) === file &&
          evidenceSha(readFileSync(file)) === hash,
      )
    );
  } catch {
    return false;
  }
}

/** A separate guarded render for each candidate. Serialized props only propose
 * a context: the actual React object, complete key set and original bindings
 * must pass the in-realm guard before its helper executes. No native projection
 * consumes these records without a separate containing-component flow proof. */
export async function observeReactHelpers(options: {
  browser: Browser;
  reference: ReactReference;
  program: ReactSourceProgram;
  ownership: ReactOwnership;
  caseId: string;
  treeSha256: string;
  pngSha256: string;
  dir: string;
  assertCurrent(): void;
}): Promise<ReactHelperObservation[]> {
  const { browser, reference, program, ownership, caseId, dir, assertCurrent } =
    options;
  const rows: ReactHelperObservation[] = [];
  for (const instance of ownership.components) {
    const component = program.components.find(
      (c) =>
        c.module === instance.source.module &&
        c.exportName === instance.source.exportName &&
        c.sourceSha256 === instance.source.sourceSha256 &&
        c.span.start === instance.source.span.start &&
        c.span.end === instance.source.span.end,
    );
    for (const candidate of component?.helperCandidates ?? []) {
      assertCurrent();
      const row: ReactHelperObservation = {
        version: 1,
        id: "helper-" + rows.length,
        instanceId: instance.id,
        runtimeScope: "callsite-context",
        status: "refused",
        acceptedContract: null,
        containingContentQualified: false,
      };
      rows.push(row);
      const rowDir = path.join(dir, row.id);
      mkdirSync(rowDir, { recursive: true });
      const save = (name: string, value: unknown) => {
        const bytes = JSON.stringify(value, null, 2) + "\n";
        writeFileSync(path.join(rowDir, name), bytes, { flag: "wx" });
        return evidenceSha(bytes);
      };
      try {
        const properties = Object.fromEntries(
          Object.entries(instance.props)
            .filter(
              ([key]) =>
                !(key === "ref" && component!.wrappers?.includes("forwardRef")),
            )
            .map(([key, value]) => [
              key,
              value &&
              typeof value === "object" &&
              JSON.stringify(value) === '{"kind":"undefined"}'
                ? undefined
                : value,
            ]),
        );
        const model = readReactHelperEffects(
          reference,
          component!.module,
          candidate,
          properties,
        );
        const modelSha256 = save("model.json", model);
        if (model.status !== "modeled") throw Error(model.reason);
        if (!model.callSite || !model.instrumentation)
          throw Error("helper-instrumentation-plan-unavailable");
        const componentModel = readReactComponentEffects(
          reference,
          component!.module,
          candidate,
          properties,
        );
        const componentModelSha256 = save(
          "component-model.json",
          componentModel,
        );
        row.containingFlow = {
          status: "refused",
          modelSha256: componentModelSha256,
          reason:
            componentModel.status === "refused"
              ? componentModel.reason
              : "component-runtime-unobserved",
        };
        const componentModels =
          componentModel.status === "modeled" ? [componentModel] : [];
        const plan: ReactHelperInstrumentationPlan = {
          models: [model, ...componentModels],
          call: model.callSite,
          ...model.instrumentation,
          ...(componentModel.status === "modeled"
            ? { component: componentModel.component }
            : {}),
        };
        const planSha256 = save("plan.json", plan);
        const require = createRequire(import.meta.url),
          moduleRoot = path.dirname(fileURLToPath(import.meta.url));
        const engineFiles = [
          "react-helper-observation.ts",
          "react-contextual-content.ts",
          "react-helper-effects.ts",
          "react-helper-model.mjs",
          "react-helper-model.d.mts",
          "react-helper-instrument.ts",
          "react-helper-transform.ts",
          "react-helper-runtime.ts",
          "react-helper-intrinsics.ts",
          "react-helper-binding-runtime.ts",
          "react-ownership.ts",
          "react-ownership-run.ts",
          "react-reference.ts",
          "react-source-program.ts",
        ];
        // executablePath() describes full Chromium; a headless launch can use a
        // different installed binary. Ask the already-running browser itself.
        const browserSession = await browser.newBrowserCDPSession();
        let browserExecutable: string;
        try {
          const command = await browserSession.send(
            "Browser.getBrowserCommandLine",
          );
          if (
            typeof command.arguments?.[0] !== "string" ||
            !path.isAbsolute(command.arguments[0])
          )
            throw Error("helper-browser-identity-unavailable");
          browserExecutable = realpathSync(command.arguments[0]);
        } finally {
          await browserSession.detach();
        }
        const playwrightRoot = path.dirname(
          require.resolve("playwright-core/package.json"),
        );
        const tooling = [
          require.resolve("esbuild"),
          require.resolve("typescript"),
          browserExecutable,
          ...[
            "package.json",
            "lib/coreBundle.js",
            "lib/utilsBundle.js",
            "lib/serverRegistry.js",
          ].map((f) => path.join(playwrightRoot, f)),
        ];
        const bundler = path.resolve(
          path.dirname(require.resolve("esbuild/package.json")),
          "..",
          "@esbuild",
          process.platform + "-" + process.arch,
          "bin",
          "esbuild",
        );
        tooling.push(bundler);
        row.inputs = {
          ...model.checkerFiles,
          ...componentModel.checkerFiles,
          ...reference.files,
          ...Object.fromEntries(
            [
              ...engineFiles.map((f) => path.join(moduleRoot, f)),
              ...tooling,
            ].map((file) => [
              realpathSync(file),
              evidenceSha(readFileSync(file)),
            ]),
          ),
        };
        const observer = createReactHelperObserver(reference, plan);
        const guarded = await buildReactOwnershipReference(
          reference.sourceRoot,
          reference,
          program,
          observer,
        );
        observer.complete();
        assertCurrent();
        if (guarded.css !== reference.css)
          throw Error("helper-observation-css-changed");
        const buildSha256 = save("build.json", {
          version: 1,
          originalReferenceId: reference.id,
          guardedReferenceId: guarded.id,
          originalJavascript: evidenceSha(reference.javascript),
          guardedJavascript: evidenceSha(guarded.javascript),
          css: evidenceSha(guarded.css),
          inputs: row.inputs,
          transforms: observer.changes,
          toolchain: {
            node: process.version,
            esbuild: esbuildVersion,
            typescript: program.typescriptVersion,
            chromium: browser.version(),
            browserExecutable,
            renderers: ownership.rendererVersions,
          },
        });
        const context = await browser.newContext({
          viewport: { width: 900, height: 600 },
          deviceScaleFactor: 1,
          colorScheme: "light",
        });
        try {
          // One bootstrap preserves ordering relative to the shared fresh realm.
          await context.addInitScript(
            reactOwnershipHook +
              "\n" +
              reactHelperRuntimeHook([model], componentModels),
          );
          const url =
            "http://localhost/react-helper-observation?case=" +
            encodeURIComponent(caseId);
          await context.route("**/*", (route) =>
            route.request().url() === url
              ? route.fulfill({
                  status: 200,
                  contentType: "text/html",
                  headers: {
                    "Content-Security-Policy":
                      "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'",
                  },
                  body: reactReferenceHtml(guarded),
                })
              : route.abort(),
          );
          const page = await context.newPage(),
            failures = watchSourceFailures(page),
            profile = reference.cohort.profile(caseId);
          try {
            await page.goto(url);
            await page.locator(profile.path[0]).waitFor({ timeout: 15000 });
            const tree = await captureValidatedTree(
              page,
              profile,
              failures,
              "#root",
              "--",
            );
            save("tree.json", tree);
            if (tree.status !== "captured")
              throw Error("helper-observation-capture-refused");
            const png = await page.screenshot({
              fullPage: true,
              caret: "initial",
            });
            writeFileSync(path.join(rowDir, "observed.png"), png, {
              flag: "wx",
            });
            if (
              evidenceSha(png) !== tree.sourcePngSha256 ||
              tree.treeSha256 !== options.treeSha256 ||
              tree.sourcePngSha256 !== options.pngSha256
            )
              throw Error("helper-observation-render-differs");
            const actual = (await page.evaluate(
              reactOwnershipRead(profile.path[0]),
            )) as ReactOwnership;
            const ownershipSha256 = save("ownership.json", actual);
            const pairedOwnershipSha256 = save("paired-ownership.json", ownership);
            if (JSON.stringify(reactOwnershipStructure(actual)) !== JSON.stringify(reactOwnershipStructure(ownership)))
              throw Error("helper-observation-ownership-differs");
            const runtime = (await page.evaluate(
              reactHelperRuntimeRead,
            )) as ReactHelperRuntimeReport;
            const runtimeSha256 = save("runtime.json", runtime);
            row.runtime = runtime;
            if (runtime.status !== "observed") throw Error(runtime.reason);
            if (
              !runtime.events.length ||
              runtime.events.some((e) => e.context !== 0) ||
              !runtime.helperCalls
            )
              throw Error("helper-observation-context-unobserved");
            const again = await page.evaluate(reactHelperRuntimeRead);
            if (
              JSON.stringify(again) !== JSON.stringify(runtime) ||
              evidenceSha(
                await page.screenshot({ fullPage: true, caret: "initial" }),
              ) !== tree.sourcePngSha256
            )
              throw Error("helper-observation-unstable");
            row.evidence = {
              runtimeSha256,
              buildSha256,
              modelSha256,
              planSha256,
              referenceId: guarded.id,
              treeSha256: tree.treeSha256,
              pngSha256: tree.sourcePngSha256,
              ownershipSha256,
              pairedOwnershipSha256,
            };
            row.status = "observed";
            if (componentModel.status === "modeled") {
              if (!runtime.components?.length)
                throw Error("component-runtime-unobserved");
              row.containingFlow = {
                status: "observed",
                modelSha256: componentModelSha256,
                content: componentModel.content,
              };
            }
          } catch (error) {
            const runtime = (await page
              .evaluate(reactHelperRuntimeRead)
              .catch(() => ({
                status: "refused" as const,
                reason: "helper-runtime-unreadable",
              }))) as ReactHelperRuntimeReport;
            row.runtime = runtime;
            save("failure.json", {
              runtime,
              resourceFailures: failures.failedResources,
              runtimeErrors: failures.runtimeErrors,
            });
            if (
              runtime.status === "refused" &&
              runtime.reason !== "helper-runtime-call-unobserved"
            )
              throw Error(runtime.reason);
            throw error;
          } finally {
            failures.dispose();
          }
        } finally {
          await context.close();
        }
        assertCurrent();
        if (!reactHelperObservationUnchanged(row))
          throw Error("helper-observation-input-changed");
      } catch (error) {
        row.status = "refused";
        delete row.evidence;
        row.reason =
          error instanceof Error && /^helper-[a-z-]+$/.test(error.message)
            ? error.message
            : "helper-observation-unavailable";
      }
      save("report.json", row);
    }
  }
  return rows;
}
