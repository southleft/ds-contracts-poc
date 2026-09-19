/** Record additional declared cohorts without rewriting historical evidence.
 * npm run react:native:declared:record -- --private <archive> --spec <json> --out <NEW directory>
 * Reads only. The output must not exist; all authentication and pairing finishes before it is created.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import {
  QUALIFICATION,
  SOURCE_HARNESS,
  sha256,
  type Cohort,
  type Pair,
} from "./react-native-fidelity-check.js";
import {
  nativeSide,
  sourceSide,
  sourceTypography,
  variantCandidates,
} from "./react-native-fidelity-pair.js";

export interface DeclaredSpec {
  id: string;
  component: string;
  description: string;
  operation: string;
  journal: string;
  event: string;
  source:
    | {
        kind: "initial";
        inspection: string;
        axisNames?: Record<string, string>;
      }
    | { kind: "comparison"; framing: string };
}
export interface DeclaredManifest {
  artifactVersion: "react-native-declared-fidelity-v1";
  qualification: typeof QUALIFICATION;
  acceptedContract: null;
  harness: typeof SOURCE_HARNESS;
  cohorts: Cohort[];
}
const refuse = (name: string, detail: string): never => {
  throw new Error(`${name}: ${detail}`);
};

export function collectDeclaredEvidence(
  privateRoot: string,
  specs: DeclaredSpec[],
): { manifest: DeclaredManifest; files: Map<string, Buffer> } {
  if (!Array.isArray(specs) || specs.length === 0)
    refuse("cohorts-empty", "at least one explicit cohort is required");
  const files = new Map<string, Buffer>();
  const secrets = new Set<string>();
  const bytes = (relative: string): Buffer => {
    if (
      !relative ||
      path.isAbsolute(relative) ||
      relative.split(/[\\/]/).includes("..")
    )
      refuse("archive-path-invalid", relative);
    return readFileSync(path.join(privateRoot, relative));
  };
  const json = (relative: string): any =>
    JSON.parse(bytes(relative).toString("utf8"));
  const journal = (relative: string, eventFile?: string): any => {
    const headerBytes = bytes(`${relative}/operation.json`),
      header = JSON.parse(headerBytes.toString("utf8"));
    let previous = sha256(headerBytes),
      dispatch: any = null,
      wanted: any = null;
    const events = readdirSync(
      path.join(privateRoot, relative, "events"),
    ).sort();
    for (const [sequence, file] of events.entries()) {
      const data = bytes(`${relative}/events/${file}`),
        event = JSON.parse(data.toString("utf8"));
      if (
        file !== `${String(sequence).padStart(8, "0")}.json` ||
        event.sequence !== sequence ||
        (event.previous ?? event.previousSha256) !== previous
      )
        refuse("journal-chain-invalid", `${relative}/${file}`);
      if (event.kind === "dispatch") dispatch = event.command;
      if (file === eventFile) {
        const e = event.envelope;
        if (
          event.kind !== "result" ||
          !e ||
          !dispatch?.readOnly ||
          ["attemptId", "nonce", "scriptSha256", "phase"].some(
            (key) => e[key] !== dispatch[key],
          )
        )
          refuse("journal-result-uncorrelated", `${relative}/${file}`);
        wanted = {
          result: e.result,
          eventSha256: sha256(data),
          attemptId: e.attemptId,
          phase: e.phase,
          recordedAt: event.recordedAt ?? null,
        };
      }
      previous = sha256(data);
    }
    if (eventFile && !wanted) refuse("journal-result-missing", relative);
    return { header, events: events.length, headSha256: previous, ...wanted };
  };
  const archive = (
    relative: string,
    pin: string,
  ): { file: (name: string) => Buffer; inventorySha256: string } => {
    const data = bytes(`${relative}/integrity.json`),
      inventory = JSON.parse(data.toString("utf8"));
    if (typeof pin !== "string" || sha256(data) !== pin)
      refuse("archive-inventory-changed", relative);
    return {
      inventorySha256: pin,
      file: (name) => {
        const data = bytes(`${relative}/${name}`);
        if (sha256(data) !== inventory.files[name])
          refuse("archive-file-changed", `${relative}/${name}`);
        return data;
      },
    };
  };
  const cohorts = specs.map((spec): Cohort => {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.id) ||
      specs.filter((s) => s.id === spec.id).length !== 1
    )
      refuse("cohort-id-invalid", spec.id);
    const operationPath = `source-native-app/operations/${spec.operation}`;
    const parent = journal(operationPath),
      read = journal(spec.journal, spec.event);
    if (
      spec.journal !== operationPath &&
      read.header.parentId !== spec.operation
    )
      refuse("update-parent-mismatch", spec.id);
    const header = parent.header,
      readback =
        spec.source.kind === "comparison" ? read.result?.content : read.result;
    if (
      !readback ||
      readback.status !== "native-readback-collected" ||
      readback.receiptKind !== "independent-native-component-readback" ||
      readback.operationId !== spec.operation ||
      readback.acceptedContract !== null ||
      readback.nativeQualification !== "unqualified" ||
      !Array.isArray(readback.problems) ||
      readback.problems.length ||
      !Array.isArray(readback.images) ||
      !Array.isArray(readback.nodes)
    )
      refuse("native-readback-unverified", spec.id);
    // A later update to different source values cannot borrow the original inspection's authority.
    if (readback.planRevision !== header.planRevision)
      refuse("readback-source-plan-changed", spec.id);
    if (typeof readback.fileKey === "string") secrets.add(readback.fileKey);
    const pairs: Pair[] = [];
    const pair = (
      image: any,
      rowId: string,
      original: Buffer,
      bounds: any,
      boundsRecord: string,
      tree: any,
      fonts: any,
      variant: string,
    ): void => {
      if (!/^[a-zA-Z0-9_-]+$/.test(rowId))
        refuse("observation-id-invalid", rowId);
      if (!bounds) refuse("source-layout-origin-not-recorded", spec.id);
      const native = nativeSide(readback, image, spec.id),
        source = sourceSide(
          original,
          bounds,
          boundsRecord,
          sourceTypography(tree, fonts),
        );
      const refs = Object.fromEntries(
        (
          [
            ["native", native.png],
            ["source", source.png],
          ] as const
        ).map(([side, png]) => {
          const relative = `${spec.id}/${rowId}.${side}.png`,
            parsed = PNG.sync.read(png, { checkCRC: true });
          if (files.has(relative)) refuse("image-pair-duplicate", relative);
          files.set(relative, png);
          return [
            side,
            {
              path: relative,
              sha256: sha256(png),
              width: parsed.width,
              height: parsed.height,
            },
          ];
        }),
      ) as Pair["files"];
      pairs.push({
        id: `${spec.id}/${variant}`,
        variant,
        observation: rowId,
        pairedBy:
          "authenticated operation source; unique property assignment or single caller frame",
        files: refs,
        native: native.native,
        source: source.source,
      });
    };
    let source: Record<string, unknown>;
    if (spec.source.kind === "initial") {
      const pin = header.request.observation,
        anchor = header.request.anchor;
      if (!pin || !anchor || path.basename(spec.source.inspection) !== pin.id)
        refuse("inspection-not-pinned", spec.id);
      const sealed = archive(spec.source.inspection, pin.inventorySha256),
        reportBytes = sealed.file("report.json");
      if (sha256(reportBytes) !== pin.reportSha256)
        refuse("inspection-report-changed", spec.id);
      const report = JSON.parse(reportBytes.toString("utf8")),
        request = JSON.parse(sealed.file("request.json").toString("utf8"));
      if (
        report.phase !== "complete" ||
        report.sourceUnchanged !== true ||
        report.problems.length ||
        request.anchor?.referenceId !== anchor.referenceId ||
        request.anchor?.inventorySha256 !== anchor.inventorySha256 ||
        request.anchor?.matrixRevision !== anchor.matrixRevision ||
        request.anchor?.ownership?.id !== anchor.ownership.id ||
        request.anchor?.ownership?.sha256 !== anchor.ownership.sha256 ||
        request.caseId !== header.request.caseId
      )
        refuse("inspection-source-mismatch", spec.id);
      const claimed = new Set<string>();
      for (const row of report.observation.rows) {
        if (row.status !== "observed")
          refuse("source-state-not-observed", `${spec.id}/${row.id}`);
        const candidates = variantCandidates(
          row.changes,
          spec.source.axisNames ?? {},
        );
        const hits = readback.images.filter((i: any) =>
          candidates.includes(String(i.caseId).replace(/^variant:/, "")),
        );
        if (hits.length !== 1 || claimed.has(hits[0].nodeId))
          refuse("variant-pairing-not-unique", `${spec.id}/${row.id}`);
        const image = hits[0],
          original = sealed.file(`states/${row.id}.png`),
          state = JSON.parse(
            sealed.file(`states/${row.id}.json`).toString("utf8"),
          );
        if (sha256(original) !== row.image || state.image !== row.image)
          refuse("source-image-changed", spec.id);
        claimed.add(image.nodeId);
        pair(
          image,
          String(row.id),
          original,
          state.bounds,
          `states/${row.id}.json bounds`,
          state.tree,
          state.fonts,
          String(image.caseId).replace(/^variant:/, ""),
        );
      }
      if (claimed.size !== readback.images.length)
        refuse("native-variant-unpaired", spec.id);
      source = {
        referenceId: anchor.referenceId,
        ownershipId: anchor.ownership.id,
        caseId: request.caseId,
        inspectionId: pin.id,
        inventorySha256: sealed.inventorySha256,
        reportSha256: pin.reportSha256,
      };
    } else {
      const root = header.request.root;
      if (!root) refuse("comparison-source-unpinned", spec.id);
      const sealed = archive(
          `react-source-ownership/${root.referenceId}/${root.ownership.id}`,
          root.inventorySha256,
        ),
        reportBytes = sealed.file("report.json");
      if (sha256(reportBytes) !== root.ownership.sha256)
        refuse("ownership-report-changed", spec.id);
      const row = JSON.parse(reportBytes.toString("utf8")).rows.find(
          (r: any) => r.id === root.caseId,
        ),
        original = sealed.file(`${root.caseId}/source.png`);
      if (
        !row ||
        !row.matched ||
        row.sourceImage !== sha256(original) ||
        row.observedImage !== sha256(original)
      )
        refuse("source-image-changed", spec.id);
      const tree = JSON.parse(
          sealed.file(`${root.caseId}/source-tree.json`).toString("utf8"),
        ),
        frame = json(spec.source.framing);
      if (
        tree.status !== "captured" ||
        tree.sourcePngSha256 !== sha256(original) ||
        frame.version !== 1 ||
        frame.qualification !== "unqualified" ||
        frame.sourceSha256 !== sha256(original)
      )
        refuse("comparison-framing-mismatch", spec.id);
      const crop = sourceSide(
        original,
        frame.bounds,
        spec.source.framing,
        sourceTypography(tree.tree, null),
      );
      if (
        sha256(crop.png) !== frame.imageSha256 ||
        JSON.stringify(crop.source.crop) !== JSON.stringify(frame.crop)
      )
        refuse("comparison-framing-changed", spec.id);
      if (readback.images.length !== 1)
        refuse("comparison-image-count", spec.id);
      pair(
        readback.images[0],
        "0",
        original,
        frame.bounds,
        spec.source.framing,
        tree.tree,
        null,
        root.caseId,
      );
      source = {
        referenceId: root.referenceId,
        ownershipId: root.ownership.id,
        caseId: root.caseId,
        inventorySha256: sealed.inventorySha256,
        reportSha256: root.ownership.sha256,
      };
    }
    return {
      id: spec.id,
      component: spec.component,
      description: spec.description,
      source,
      native: {
        operationId: spec.operation,
        journalEvent: `${path.basename(spec.journal)}/events/${spec.event}`,
        journalEventSha256: read.eventSha256,
        journalEventsVerified: read.events,
        journalHeadSha256: read.headSha256,
        attemptId: read.attemptId,
        phase: read.phase,
        recordedAt: read.recordedAt,
        planRevision: readback.planRevision,
        images: readback.images.length,
        nodes: readback.nodes.length,
      },
      pairs,
      notMeasured: [],
    };
  });
  const manifest: DeclaredManifest = {
    artifactVersion: "react-native-declared-fidelity-v1",
    qualification: QUALIFICATION,
    acceptedContract: null,
    harness: SOURCE_HARNESS,
    cohorts,
  };
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  if (
    /\/Users\/|\/home\/|figd_|dscn_|FIGMA_TOKEN|pngBase64/.test(serialized) ||
    [...secrets].some((s) => serialized.includes(s))
  )
    refuse(
      "evidence-leak",
      "local path, connection, token, file key or raw journal bytes",
    );
  files.set("manifest.json", Buffer.from(serialized));
  return { manifest, files };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const arg = (name: string): string => {
    const index = process.argv.indexOf(`--${name}`);
    return index > -1 && process.argv[index + 1]
      ? process.argv[index + 1]!
      : refuse("usage", `missing --${name}`);
  };
  const out = path.resolve(arg("out"));
  if (existsSync(out))
    refuse(
      "output-exists",
      "choose a new directory; evidence is never overwritten",
    );
  const { manifest, files } = collectDeclaredEvidence(
    path.resolve(arg("private")),
    JSON.parse(readFileSync(arg("spec"), "utf8")),
  );
  mkdirSync(out, { recursive: true });
  for (const [relative, data] of files) {
    const file = path.join(out, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, data, { flag: "wx" });
  }
  console.log(
    `Recorded ${manifest.cohorts.reduce((n, c) => n + c.pairs.length, 0)} authenticated pairs in ${out}; measured, not graded.`,
  );
}
