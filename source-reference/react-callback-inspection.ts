import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { chromium } from "playwright-core";
import { revisionOf } from "../core/contract-provenance.js";
import {
  reactReferenceHtml,
  reactReferenceUnchanged,
  type ReactReference,
} from "./react-reference.js";
import type { ReactNativeRequest } from "./react-native-request.js";
import { readReactInspectionOriginal } from "./react-initial-inspection.js";
import {
  readReactSourceProgram,
  reactSourceProgramUnchanged,
} from "./react-source-program.js";
import {
  buildReactOwnershipReference,
  reactOwnershipHook,
  reactOwnershipRead,
  type ReactOwnership,
} from "./react-ownership.js";
import { reactReferenceProfile } from "./react-reference-profiles.js";
import { captureValidatedTree } from "./capture.js";
import { watchSourceFailures } from "./observe.js";
import {
  evidenceSha,
  inventoryEvidence,
  evidenceUnchanged,
} from "./react-validation-evidence.js";
import {
  observeReactCallbackBehavior,
  type ReactCallbackBehavior,
} from "./react-callback-behavior.js";

export interface ReactCallbackInspection {
  id: string;
  caseId: string;
  phase: "running" | "complete" | "failed";
  sourceUnchanged: boolean;
  observation?: ReactCallbackBehavior;
  restoration?: {strategy:'verify-structure-then-replay-original';checks:Array<{sameMountPixelsMatch:boolean}>};
  problems: string[];
}
export function readReactCallbackInspectionRecord(value: {
  root: string;
  request: { version: 1; anchor: ReactNativeRequest; caseId: string };
}) {
  const pointer = path.join(value.root, "latest.json");
  if (!existsSync(pointer)) return;
  const latest = JSON.parse(readFileSync(pointer, "utf8")) as {id:string;inventorySha256:string};
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(latest.id))
    throw Error("callback-record-invalid");
  const dir = path.join(value.root, latest.id),
    sealBytes = readFileSync(path.join(dir, "integrity.json"));
  if (evidenceSha(sealBytes) !== latest.inventorySha256)
    throw Error("callback-inventory-changed");
  const seal = JSON.parse(sealBytes.toString()) as {version:number;files:Record<string,string>};
  if (
    seal.version !== 1 ||
    !evidenceUnchanged(
      dir,
      Object.fromEntries(
        Object.entries({
          ...seal.files,
          "integrity.json": latest.inventorySha256,
        }).sort(([a], [b]) => a.localeCompare(b)),
      ),
    ) ||
    revisionOf(
      JSON.parse(readFileSync(path.join(dir, "request.json"), "utf8")),
    ) !== revisionOf(value.request)
  )
    throw Error("callback-evidence-changed");
  const report = JSON.parse(
    readFileSync(path.join(dir, "report.json"), "utf8"),
  ) as ReactCallbackInspection;
  if (
    report.id !== latest.id ||
    report.caseId !== value.request.caseId ||
    report.phase === "running"
  )
    throw Error("callback-report-invalid");
  const program = JSON.parse(
    readFileSync(path.join(dir, "program.json"), "utf8"),
  );
  if (!reactSourceProgramUnchanged(program))
    throw Error("callback-program-changed");
  return report;
}

/** Separate immutable observations. Earlier ownership and initial-state records
 * are inputs, never rewritten to retrofit new checker or behavior facts. */
export function createReactCallbackInspectionStore(
  repo: string,
  sourceRoot: string,
  select: (
    referenceId: string,
    caseId: string,
  ) => { reference: ReactReference; anchor: ReactNativeRequest },
) {
  const active = new Map<
    string,
    { state: ReactCallbackInspection; promise: Promise<void> }
  >();
  const input = (referenceId: string, caseId: string) => {
    const { reference, anchor } = select(referenceId, caseId),
      request = { version: 1 as const, anchor, caseId };
    const source = readReactInspectionOriginal(repo, reference, request),
      key = revisionOf(request).slice(7);
    return {
      reference,
      request,
      source,
      key,
      root: path.join(repo, "private/react-callback-inspections", key),
    };
  };
  const saved = readReactCallbackInspectionRecord;
  return {
    read(referenceId: string, caseId: string) {
      const running = active.get(referenceId + "/" + caseId);
      if (running) return structuredClone(running.state);
      return structuredClone(saved(input(referenceId, caseId)));
    },
    start(referenceId: string, caseId: string) {
      const activeKey = referenceId + "/" + caseId;
      const existing = active.get(activeKey);
      if (existing) return existing;
      const value = input(referenceId, caseId);
      const prior = saved(value);
      if (prior?.phase === "complete")
        return { state: prior, promise: Promise.resolve() };
      const program = readReactSourceProgram(sourceRoot, [
        ...new Set(value.source.program.components.map((c) => c.module)),
      ]);
      const identities = (p: typeof program) =>
        p.components.map((c) => ({
          module: c.module,
          exportName: c.exportName,
          sourceSha256: c.sourceSha256,
          span: c.span,
        }));
      if (
        program.problems.length ||
        revisionOf(program.files) !== revisionOf(value.source.program.files) ||
        revisionOf(identities(program)) !==
          revisionOf(identities(value.source.program))
      )
        throw Error("callback-installed-source-program-changed");
      const state: ReactCallbackInspection = {
        id: randomUUID(),
        caseId,
        phase: "running",
        sourceUnchanged: false,
        restoration: {strategy:"verify-structure-then-replay-original",checks:[]},
        problems: [],
      };
      const dir = path.join(value.root, state.id);
      mkdirSync(dir, { recursive: true });
      const save = (file: string, data: unknown) =>
        writeFileSync(
          path.join(dir, file),
          JSON.stringify(data, null, 2) + "\n",
          { flag: "wx" },
        );
      save("request.json", value.request);
      save("program.json", program);
      const promise = (async () => {
        let browser;
        try {
          const observed = await buildReactOwnershipReference(
            sourceRoot,
            value.reference,
            program,
          );
          browser = await chromium.launch();
          const context = await browser.newContext({
            viewport: { width: 900, height: 600 },
            deviceScaleFactor: 1,
            colorScheme: "light",
          });
          await context.addInitScript(reactOwnershipHook);
          const url = "http://127.0.0.1/react-ownership?case=" + caseId;
          await context.route("**/*", (r) =>
            r.request().url() === url
              ? r.fulfill({
                  status: 200,
                  contentType: "text/html",
                  headers: {
                    "Content-Security-Policy":
                      "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'",
                  },
                  body: reactReferenceHtml(observed),
                })
              : r.abort(),
          );
          const page = await context.newPage(),
            failures = watchSourceFailures(page),
            profile = reactReferenceProfile(caseId);
          const assertCurrent = () => {
            if (
              !reactReferenceUnchanged(value.reference) ||
              !reactSourceProgramUnchanged(program)
            )
              throw Error("callback-source-changed");
          };
          let restorationFailures = 0;
          const assertRestored = async (replay = false) => {
            assertCurrent();
            // Observe settled source pixels; never cancel or fast-forward the
            // component's own transitions to make restoration appear exact.
            await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState === 'finished' || animation.playState === 'idle'), undefined, {timeout:5000});
            const captured = await captureValidatedTree(
              page,
              profile,
              failures,
              "#root",
              "--",
            );
            if (
              captured.status !== "captured" ||
              captured.treeSha256 !== value.source.captured.treeSha256 ||
              (!replay && captured.sourcePngSha256 !== value.source.captured.sourcePngSha256)
            ) {
              const name = 'restoration-failure-' + ++restorationFailures;
              save(name + '.json', {captured, expected:{treeSha256:value.source.captured.treeSha256,sourcePngSha256:value.source.captured.sourcePngSha256}});
              writeFileSync(path.join(dir,name + '.png'),await page.screenshot({fullPage:true,caret:'initial'}),{flag:'wx'});
              throw Error("callback-original-render-not-restored");
            }
            const ownership = (await page.evaluate(
              reactOwnershipRead(profile.path[0]),
            )) as ReactOwnership;
            if (revisionOf(ownership) !== revisionOf(value.source.ownership))
              throw Error("callback-original-ownership-not-restored");
            if (replay && captured.status === 'captured') {
              const sameMountPixelsMatch = captured.sourcePngSha256 === value.source.captured.sourcePngSha256;
              if (!sameMountPixelsMatch) {
                const name = 'same-mount-pixel-difference-' + state.restoration!.checks.length;
                save(name + '.json', {captured,expected:value.source.captured.sourcePngSha256});
                writeFileSync(path.join(dir,name + '.png'),await page.screenshot({fullPage:true,caret:'initial'}),{flag:'wx'});
              }
              // Every independent trial returns to the exact archived page.
              // This resets disposable runtime state, not user/business state.
              await page.goto(url);
              await page.locator(profile.path[0]).waitFor({state:'attached',timeout:15000});
              await assertRestored(false);
              state.restoration!.checks.push({sameMountPixelsMatch});
            }
          };
          try {
            await page.goto(url);
            await page
              .locator(profile.path[0])
              .waitFor({ state: "attached", timeout: 15000 });
            await assertRestored();
            const targets = value.source.ownership.components.filter((c) =>
              c.roots.includes(""),
            );
            if (targets.length !== 1) throw Error("callback-root-ambiguous");
            state.observation = await observeReactCallbackBehavior({
              page,
              selector: profile.path[0],
              program,
              ownership: value.source.ownership,
              instanceId: targets[0].id,
              assertCurrent,
              assertRestored: () => assertRestored(true),
            });
            await assertRestored();
            readReactInspectionOriginal(repo, value.reference, value.request);
            state.sourceUnchanged = true;
            if (state.observation.problems.length)
              throw Error("callback-observation-incomplete");
            state.phase = "complete";
          } finally {
            failures.dispose();
          }
        } catch (error) {
          state.phase = "failed";
          state.problems.push(
            error instanceof Error ? error.message : String(error),
          );
        } finally {
          try {
            await browser?.close();
            save("report.json", state);
            save("integrity.json", {
              version: 1,
              files: inventoryEvidence(dir),
            });
            writeFileSync(
              path.join(value.root, "latest.tmp"),
              JSON.stringify({
                id: state.id,
                inventorySha256: evidenceSha(
                  readFileSync(path.join(dir, "integrity.json")),
                ),
              }),
            );
            renameSync(
              path.join(value.root, "latest.tmp"),
              path.join(value.root, "latest.json"),
            );
          } finally {
            active.delete(activeKey);
          }
        }
      })();
      const job = { state, promise };
      active.set(activeKey, job);
      return job;
    },
  };
}
