import { startReactOwnership } from "./react-ownership-run.js";
import { proposeReactSourceProgram } from "./react-program-proposal.js";
import {
  readReactSourceProgram,
  reactSourceProgramUnchanged,
} from "./react-source-program.js";
import { startReactValidation } from "./react-reference-validation.js";
import { build, type Loader } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync, realpathSync } from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  reactReferenceCases,
  reactReferenceEntry,
} from "./react-reference-cases.js";

const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const loaders: Record<string, Loader> = {
  ".js": "js",
  ".mjs": "js",
  ".cjs": "js",
  ".jsx": "jsx",
  ".ts": "ts",
  ".tsx": "tsx",
  ".json": "json",
  ".css": "css",
  ".woff": "dataurl",
  ".woff2": "dataurl",
};
export interface ReactReference {
  id: string;
  files: Record<string, string>;
  javascript: string;
  css: string;
}

/** A host-configured source root; no browser request can choose a filesystem
 * path, executable or dependency. esbuild parses source; it never executes it. */
export async function buildReactReference(
  sourceRoot: string,
  entry: string = reactReferenceEntry,
): Promise<ReactReference> {
  sourceRoot = realpathSync(sourceRoot);
  const files: Record<string, string> = {};
  for (const file of [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "src/index.css",
    "capture-input.css",
  ]) {
    files[path.join(sourceRoot, file)] = sha(
      readFileSync(path.join(sourceRoot, file)),
    );
  }
  const output = await build({
    stdin: {
      contents: entry,
      resolveDir: sourceRoot,
      sourcefile: "react-reference.tsx",
      loader: "tsx",
    },
    absWorkingDir: sourceRoot,
    tsconfig: path.join(sourceRoot, "tsconfig.json"),
    bundle: true,
    write: false,
    outdir: "reference-memory-output",
    format: "iife",
    jsx: "automatic",
    metafile: true,
    plugins: [
      {
        name: "record-original-bytes",
        setup(builder) {
          builder.onLoad({ filter: /./, namespace: "file" }, (args) => {
            const loader = loaders[path.extname(args.path)];
            if (!loader) throw Error("react-reference-unsupported-asset");
            const contents = readFileSync(args.path);
            const hash = sha(contents);
            if (files[args.path] && files[args.path] !== hash)
              throw Error("react-reference-source-changed");
            files[args.path] = hash;
            return { contents, loader, resolveDir: path.dirname(args.path) };
          });
        },
      },
    ],
  });
  for (const input of Object.keys(output.metafile!.inputs)) {
    if (input === "react-reference.tsx") continue;
    if (!files[path.resolve(sourceRoot, input)])
      throw Error(`react-reference-input-unrecorded: ${input}`);
  }
  const javascript = output.outputFiles.find((f) =>
    f.path.endsWith(".js"),
  )?.text;
  const css = output.outputFiles.find((f) => f.path.endsWith(".css"))?.text;
  if (!javascript || !css) throw Error("react-reference-output-missing");
  const identity = {
    version: 1,
    entry: sha(entry),
    files: Object.entries(files)
      .map(([file, hash]) => [path.relative(sourceRoot, file), hash])
      .sort(),
    javascript: sha(javascript),
    css: sha(css),
  };
  const reference = {
    id: sha(JSON.stringify(identity)),
    files: Object.fromEntries(
      Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
    ),
    javascript,
    css,
  };
  if (!reactReferenceUnchanged(reference))
    throw Error("react-reference-source-changed");
  return reference;
}
export function reactReferenceUnchanged(reference: ReactReference) {
  try {
    return Object.entries(reference.files).every(
      ([file, hash]) => sha(readFileSync(file)) === hash,
    );
  } catch {
    return false;
  }
}
export function reactReferenceHtml(reference: ReactReference) {
  // Script/style raw-text elements must not let source literals close their tags.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${reference.css.replace(/<\/style/gi, "<\\/style")}</style></head><body style="padding:32px"><div id="root"></div><script>${reference.javascript.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}

/** Called only after the source service's loopback and same-origin checks. */
export function createReactReferenceService(
  repoRoot: string,
  sourceRoot = process.env.DS_CONTRACTS_REACT_SOURCE_ROOT ??
    path.resolve(
      repoRoot,
      "../ds-contracts-poc/examples/shadcn/.shadcn-sandbox",
    ),
) {
  let reference: ReactReference | undefined;
  const validations = new Map<
    string,
    ReturnType<typeof startReactValidation>
  >();
  const ownershipJobs = new Map<
    string,
    ReturnType<typeof startReactOwnership>
  >();
  let loading: Promise<ReactReference> | undefined;
  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(body));
  };
  const handle = async (
    req: IncomingMessage,
    res: ServerResponse,
    route: string,
  ) => {
    if (route === "react" && req.method === "POST") {
      if (
        Number(req.headers["content-length"] ?? 0) > 0 ||
        req.headers["transfer-encoding"]
      ) {
        json(res, 400, { error: "This action accepts no request body." });
        return;
      }
      try {
        loading ??= buildReactReference(sourceRoot);
        reference = await loading;
        if (!reactReferenceUnchanged(reference))
          throw Error("react-reference-source-changed");
        const dir = path.join(
          repoRoot,
          "private/react-source-references",
          reference.id,
        );
        mkdirSync(dir, { recursive: true });
        for (const [name, bytes] of Object.entries({
          "reference.html": reactReferenceHtml(reference),
          "provenance.json":
            JSON.stringify(
              {
                version: 1,
                id: reference.id,
                sourceRoot,
                files: reference.files,
                entrySha256: sha(reactReferenceEntry),
                qualification: "unqualified",
                cases: reactReferenceCases,
              },
              null,
              2,
            ) + "\n",
        })) {
          try {
            writeFileSync(path.join(dir, name), bytes, { flag: "wx" });
          } catch (e) {
            if (
              (e as NodeJS.ErrnoException).code !== "EEXIST" ||
              readFileSync(path.join(dir, name), "utf8") !== bytes
            )
              throw e;
          }
        }
        json(res, 200, {
          id: reference.id,
          source: "shadcn source sandbox",
          theme: "Light (sandbox stylesheet)",
          sourceFiles: Object.keys(reference.files).length,
          qualification: "unqualified",
          validation: validations.get(reference.id)?.report() ?? null,
          ownership: ownershipJobs.get(reference.id)?.report() ?? null,
          cases: reactReferenceCases.map((c) => ({
            ...c,
            url: `/api/source-reference/react/${reference!.id}?case=${c.id}`,
          })),
        });
      } catch {
        json(res, 409, {
          error:
            "React originals unavailable or changed. Configure DS_CONTRACTS_REACT_SOURCE_ROOT with the existing shadcn source sandbox and its installed dependencies; source files are never modified by this action.",
        });
      } finally {
        loading = undefined;
      }
      return;
    }
    const programRoute = /^react\/([a-f0-9]{64})\/program$/.exec(route);
    if (
      programRoute &&
      reference?.id === programRoute[1] &&
      req.method === "POST"
    ) {
      if (
        Number(req.headers["content-length"] ?? 0) > 0 ||
        req.headers["transfer-encoding"]
      ) {
        json(res, 400, { error: "This action accepts no request body." });
        return;
      }
      try {
        if (!reactReferenceUnchanged(reference)) throw Error("source-changed");
        const root = realpathSync(sourceRoot);
        const modules = Object.keys(reference.files)
          .filter(
            (file) =>
              file.startsWith(path.join(root, "src") + path.sep) &&
              file.endsWith(".tsx"),
          )
          .map((file) => path.relative(root, file));
        if (!modules.length) throw Error("component-modules-unavailable");
        const program = readReactSourceProgram(root, modules);
        if (
          !reactReferenceUnchanged(reference) ||
          !reactSourceProgramUnchanged(program)
        )
          throw Error("source-changed");
        const proposal = proposeReactSourceProgram(
          program,
          modules.map((module) => ({
            sourcePath: module,
            source: readFileSync(path.join(root, module), "utf8"),
            css: "",
          })),
        );
        if (
          !reactReferenceUnchanged(reference) ||
          !reactSourceProgramUnchanged(program)
        )
          throw Error("source-changed");
        const record = {
          version: 2,
          referenceId: reference.id,
          program,
          proposal,
        };
        const bytes = JSON.stringify(record, null, 2) + "\n";
        const id = sha(bytes);
        const dir = path.join(
          repoRoot,
          "private/react-source-programs",
          reference.id,
        );
        mkdirSync(dir, { recursive: true });
        const file = path.join(dir, id + ".json");
        try {
          writeFileSync(file, bytes, { flag: "wx" });
        } catch (error) {
          if (
            (error as NodeJS.ErrnoException).code !== "EEXIST" ||
            readFileSync(file, "utf8") !== bytes
          )
            throw error;
        }
        json(res, 200, {
          id,
          referenceId: reference.id,
          status: program.status,
          compatibilityNotes: program.compatibilityNotes,
          acceptedContract: null,
          sourceFiles: Object.keys(program.files).length,
          components: program.components,
          proposal,
          problems: program.problems,
        });
      } catch {
        json(res, 409, {
          error:
            "Source APIs could not be read from unchanged installed source and declarations. Reload originals before trying again.",
        });
      }
      return;
    }
    const ownershipRoute = /^react\/([a-f0-9]{64})\/ownership$/.exec(route);
    if (ownershipRoute && reference?.id === ownershipRoute[1]) {
      if (req.method === "POST") {
        if (
          Number(req.headers["content-length"] ?? 0) > 0 ||
          req.headers["transfer-encoding"]
        ) {
          json(res, 400, { error: "This action accepts no request body." });
          return;
        }
        try {
          let job = ownershipJobs.get(reference.id);
          if (job?.state.state !== "running") {
            job = startReactOwnership(
              reference,
              realpathSync(sourceRoot),
              path.join(repoRoot, "private/react-source-ownership"),
            );
            ownershipJobs.set(reference.id, job);
            void job.promise.catch(() => {
              job!.state.state = "failed";
              job!.state.matched = 0;
              job!.state.problem = "react-ownership-evidence-unavailable";
              for (const row of job!.state.rows) row.matched = false;
            });
          }
          json(res, 202, job.report());
        } catch {
          json(res, 409, {
            error:
              "React structure observation unavailable: original source or installed declarations changed.",
          });
        }
        return;
      }
      const job = ownershipJobs.get(reference.id);
      if (req.method === "GET" && job) {
        json(res, 200, job.report());
        return;
      }
      json(res, 404, { error: "No structure observation for this reference." });
      return;
    }
    const propertyImage = /^react\/([a-f0-9]{64})\/ownership\/([a-f0-9-]{36})\/([a-z-]+)\/properties\/(\d+)\/([a-f0-9]{64})\.png$/.exec(route);
    if (req.method === "GET" && propertyImage) {
      const [, referenceId, jobId, caseId, index, hash] = propertyImage;
      const job = ownershipJobs.get(referenceId), report = job?.report();
      const row = report?.rows.find(r=>r.id===caseId), effect = row?.propertyEffects?.rows.find(r=>r.id===index);
      if(job?.state.id!==jobId || report?.state!=="complete" || !row?.matched || effect?.status!=="observed" || effect.image!==hash) {
        json(res,404,{error:"Verified property image unavailable."}); return;
      }
      try {
        const bytes=readFileSync(path.join(job!.dir,caseId,"properties",index+".png"));
        if(sha(bytes)!==hash)throw Error("changed");
        res.setHeader("Content-Type","image/png"); res.setHeader("Cache-Control","no-store");
        res.setHeader("Cross-Origin-Resource-Policy","same-origin"); res.end(bytes);
      } catch {json(res,409,{error:"Recorded property image changed."});}
      return;
    }
    const ownershipImage =
      /^react\/([a-f0-9]{64})\/ownership\/([a-f0-9-]{36})\/([a-z-]+)\/(source|observed)\/([a-f0-9]{64})\.png$/.exec(
        route,
      );
    if (req.method === "GET" && ownershipImage) {
      const [, referenceId, jobId, caseId, side, hash] = ownershipImage;
      const job = ownershipJobs.get(referenceId),
        report = job?.report(),
        row = report?.rows.find((r) => r.id === caseId);
      const expected =
        side === "source" ? row?.sourceImage : row?.observedImage;
      if (
        job?.state.id !== jobId ||
        !row?.matched ||
        report?.state !== "complete" ||
        expected !== hash
      ) {
        json(res, 404, { error: "Verified structure image unavailable." });
        return;
      }
      try {
        const bytes = readFileSync(path.join(job!.dir, caseId, side + ".png"));
        if (sha(bytes) !== hash) throw Error("changed");
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
        res.end(bytes);
      } catch {
        json(res, 409, { error: "Recorded structure image changed." });
      }
      return;
    }
    const validationRoute = /^react\/([a-f0-9]{64})\/validate$/.exec(route);
    if (validationRoute && reference?.id === validationRoute[1]) {
      if (req.method === "POST") {
        if (
          Number(req.headers["content-length"] ?? 0) > 0 ||
          req.headers["transfer-encoding"]
        ) {
          json(res, 400, { error: "This action accepts no request body." });
          return;
        }
        try {
          let job = validations.get(reference.id);
          if (job?.state.state !== "running") {
            job = startReactValidation(
              reference,
              new URL(`http://${req.headers.host}`).origin,
              path.join(repoRoot, "private/react-source-validations"),
            );
            validations.set(reference.id, job);
            void job.promise.catch(() => {
              job!.state.state = "failed";
              job!.state.valid = 0;
              for (const row of job!.state.rows) row.sourceValid = false;
              job!.state.problem = "validation-evidence-unavailable";
            });
          }
          json(res, 202, job.report());
        } catch {
          json(res, 409, {
            error:
              "Source or readiness witnesses changed. Reload originals; new source versions require reviewed witnesses.",
          });
        }
        return;
      }
      const job = validations.get(reference.id);
      if (req.method === "GET" && job) {
        json(res, 200, job.report());
        return;
      }
      json(res, 404, { error: "No validation for this reference." });
      return;
    }
    const imageRoute =
      /^react\/([a-f0-9]{64})\/([a-f0-9-]{36})\/([a-z-]+)\/(source|replay)\/([a-f0-9]{64})\.png$/.exec(
        route,
      );
    if (req.method === "GET" && imageRoute) {
      const [, referenceId, jobId, caseId, side, hash] = imageRoute;
      const job = validations.get(referenceId);
      const row = job?.state.rows.find((r) => r.id === caseId);
      const expected = side === "source" ? row?.sourceImage : row?.replayImage;
      if (job?.state.id !== jobId || !expected || expected !== hash) {
        json(res, 404, { error: "Recorded source image not found." });
        return;
      }
      try {
        const bytes = readFileSync(path.join(job.dir, caseId, side + ".png"));
        if (sha(bytes) !== hash) throw Error("changed");
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
        res.end(bytes);
      } catch {
        json(res, 409, {
          error: "Recorded source image changed or unavailable.",
        });
      }
      return;
    }
    const match = /^react\/([a-f0-9]{64})$/.exec(route);
    const caseId = new URL(req.url ?? "", "http://localhost").searchParams.get(
      "case",
    );
    if (
      req.method !== "GET" ||
      !match ||
      reference?.id !== match[1] ||
      !reactReferenceCases.some((c) => c.id === caseId)
    ) {
      json(res, 404, {
        error: "React reference not found. Load originals in the application.",
      });
      return;
    }
    if (!reactReferenceUnchanged(reference)) {
      json(res, 409, {
        error:
          "React source changed. Load a new reference before inspecting it.",
      });
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'; sandbox allow-scripts",
    );
    res.end(reactReferenceHtml(reference));
  };
  return Object.assign(handle, {
    close() {
      for (const job of validations.values()) job.close();
      for (const job of ownershipJobs.values()) job.close();
    },
  });
}
