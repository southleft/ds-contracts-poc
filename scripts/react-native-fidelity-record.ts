/**
 * RECORD the portable React -> native Figma fidelity evidence from the PRIVATE
 * operation archive. NOT a CI gate: it needs the private journals, which are
 * never committed.
 *
 *   npm run react:native:fidelity:record -- --private <path to .../private>
 *
 * It reads, authenticates and copies; it never writes to Figma, the network or
 * the private archive. Same input -> byte-identical output (the PNG re-encode
 * of a source crop is pngjs + this Node's zlib; the native exports are copied
 * byte for byte out of the journal).
 *
 * AUTHENTICATION, the way the journals are structured:
 *   - every journal read is hash-chained: sha256(operation.json) seeds the
 *     chain and each events/NNNNNNNN.json names the sha256 of the bytes before
 *     it (`previous` in update journals, `previousSha256` in operation
 *     journals). The WHOLE chain is verified, and the result event must answer
 *     the dispatch before it (attempt id, nonce, script hash).
 *   - an update journal's header must name the native operation it corrects.
 *   - an initial-state inspection is pinned by the operation header
 *     (`request.observation.inventorySha256` = sha256 of integrity.json, which
 *     in turn pins report.json, every state JSON and every state PNG).
 *   - the ownership archive is pinned the same way
 *     (`request...inventorySha256`), and a Card frame's source bounds come from
 *     the app's own source-framing record, which must reproduce its recorded
 *     crop hash from the pinned original.
 * Anything missing or changed is refused BY NAME; nothing is substituted.
 *
 * A variant with no honest like-for-like pair is recorded `not-measured` with
 * the exact reason. No image is reused for another variant.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PNG } from "pngjs";

import { cropSourceFrame } from "../source-reference/source-framing.js";
import {
  EVIDENCE,
  QUALIFICATION,
  REPO,
  SOURCE_HARNESS,
  assertScorerPins,
  buildScorecard,
  framingCrop,
  ratchetProblems,
  readJson,
  renderReport,
  sha256,
  verifyBytes,
  type Box,
  type Cohort,
  type KnownFile,
  type Manifest,
  type NotMeasured,
  type Pair,
  type TextRect,
} from "./react-native-fidelity-check.js";

const REFERENCE = "0907e10c3d63ae5f0ef60a31726e79e20b80cbc36599ee3e3ba230a1483cda7e";
const OWNERSHIP = "8c3437f5-8eba-4f78-92fc-a9ffbfb41af9";

const refuse = (name: string, detail: string): never => {
  throw new Error(`${name}: ${detail}`);
};
const argValue = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? (process.argv[i + 1] ?? null) : null;
};

const privateRoot = path.resolve(argValue("private") ?? refuse("usage", "npm run react:native:fidelity:record -- --private <path to ds-contracts-poc-v1/private>"));
const outDir = path.resolve(argValue("out") ?? path.join(REPO, EVIDENCE));
const bytesOf = (relative: string, name: string): Buffer => {
  const file = path.join(privateRoot, relative);
  if (!existsSync(file)) refuse(name, `${relative} is not in the private archive`);
  return readFileSync(file);
};
const json = <T = any>(relative: string, name: string): T => JSON.parse(bytesOf(relative, name).toString("utf8")) as T;

interface JournalRead { relative: string; events: number; headSha256: string; header: any; eventSha256: string; eventFile: string; attemptId: string; phase: string; recordedAt: string | null; result: any }

/** Verify the whole chain, then return the named result event. */
function readJournal(relative: string, eventFile: string | null): JournalRead {
  const headerBytes = bytesOf(`${relative}/operation.json`, "journal-missing");
  const dir = path.join(privateRoot, relative, "events");
  if (!existsSync(dir)) refuse("journal-missing", `${relative}/events`);
  const files = readdirSync(dir).sort();
  let previous = sha256(headerBytes), wanted: { event: any; sha: string; dispatch: any } | null = null, lastDispatch: any = null;
  for (const [sequence, file] of files.entries()) {
    if (file !== `${String(sequence).padStart(8, "0")}.json`) refuse("journal-sequence-invalid", `${relative}/events/${file}`);
    const data = readFileSync(path.join(dir, file)), event = JSON.parse(data.toString("utf8"));
    if (event.sequence !== sequence || (event.previous ?? event.previousSha256) !== previous) refuse("journal-chain-invalid", `${relative}/events/${file} does not name the sha256 of the bytes before it`);
    if (event.kind === "dispatch") lastDispatch = event.command;
    if (file === eventFile) wanted = { event, sha: sha256(data), dispatch: lastDispatch };
    previous = sha256(data);
  }
  const head = { relative, events: files.length, headSha256: previous, header: JSON.parse(headerBytes.toString("utf8")) };
  if (eventFile === null) return { ...head, eventSha256: "", eventFile: "", attemptId: "", phase: "", recordedAt: null, result: null };
  if (!wanted) refuse("journal-event-missing", `${relative}/events/${eventFile}`);
  const { event, sha, dispatch } = wanted!;
  const envelope = event.envelope;
  if (event.kind !== "result" || !envelope || !dispatch || !dispatch.readOnly || envelope.attemptId !== dispatch.attemptId || envelope.nonce !== dispatch.nonce || envelope.scriptSha256 !== dispatch.scriptSha256 || envelope.phase !== dispatch.phase)
    refuse("journal-result-uncorrelated", `${relative}/events/${eventFile} is not the answer to the read-only dispatch before it`);
  return { ...head, eventSha256: sha, eventFile, attemptId: envelope.attemptId, phase: envelope.phase, recordedAt: event.recordedAt ?? null, result: envelope.result };
}

function assertReadback(readback: any, operationId: string, where: string): void {
  if (!readback || readback.status !== "native-readback-collected" || readback.receiptKind !== "independent-native-component-readback" || readback.operationId !== operationId || readback.acceptedContract !== null || readback.nativeQualification !== "unqualified" || !Array.isArray(readback.problems) || readback.problems.length > 0 || !Array.isArray(readback.images) || !Array.isArray(readback.nodes))
    refuse("native-readback-unverified", `${where} is not a clean independent readback of operation ${operationId}`);
}

/** integrity.json pins every file of an archive directory; `pinned` is the sha256 the journal header names for it. */
function readArchive(relative: string, pinned: string | null): { file: (name: string) => Buffer; inventorySha256: string } {
  const inventoryBytes = bytesOf(`${relative}/integrity.json`, "archive-inventory-missing"), inventorySha256 = sha256(inventoryBytes);
  if (pinned !== null && inventorySha256 !== pinned) refuse("archive-inventory-changed", `${relative}/integrity.json is not the inventory the operation header pins`);
  const inventory = JSON.parse(inventoryBytes.toString("utf8")) as { files: Record<string, string> };
  return {
    inventorySha256,
    file: (name) => {
      const data = bytesOf(`${relative}/${name}`, "archive-file-missing");
      if (inventory.files[name] === undefined || sha256(data) !== inventory.files[name]) refuse("archive-file-changed", `${relative}/${name} is not the bytes its inventory pins`);
      return data;
    },
  };
}

const dims = (png: Buffer): { width: number; height: number } => {
  const parsed = PNG.sync.read(png, { checkCRC: true });
  return { width: parsed.width, height: parsed.height };
};

function nativeSide(readback: any, image: any, where: string): { native: Pair["native"]; png: Buffer } {
  const png = Buffer.from(image.pngBase64, "base64");
  if (png.toString("base64") !== image.pngBase64) refuse("native-image-encoding-invalid", `${where} ${image.caseId}`);
  const nodes = new Map<string, any>(readback.nodes.map((n: any) => [n.id, n]));
  const root = nodes.get(image.nodeId) ?? refuse("native-image-node-missing", `${where} ${image.caseId} ${image.nodeId}`);
  const bounds = image.exportBounds;
  if (!bounds || ![bounds.layout, bounds.render].every((b: any) => b && ["x", "y", "width", "height"].every((k) => Number.isFinite(b[k]))))
    refuse("native-layout-origin-not-recorded", `${where} ${image.caseId} carries no exportBounds`);
  const textRects: TextRect[] = [], typography: Pair["native"]["typography"] = [];
  const layoutOffset = { x: bounds.layout.x - Math.floor(bounds.render.x), y: bounds.layout.y - Math.floor(bounds.render.y) };
  for (const node of nodes.values()) {
    if (node.type !== "TEXT") continue;
    const chain: any[] = [];
    let id: string = node.id, inside = false;
    while (nodes.has(id) && !chain.includes(nodes.get(id))) {
      if (id === image.nodeId) { inside = true; break; }
      chain.push(nodes.get(id));
      id = nodes.get(id).parentId;
    }
    if (!inside) continue;
    let x = 0, y = 0, visible = true;
    for (const current of chain) {
      const t = current.values.relativeTransform;
      if (!Array.isArray(t) || t[0][0] !== 1 || t[0][1] !== 0 || t[1][0] !== 0 || t[1][1] !== 1 || t[0][2] !== current.values.x || t[1][2] !== current.values.y) refuse("text-rect-transform-unsupported", `${where} ${image.caseId} node ${current.id} is not a pure translation`);
      if (current.values.visible === false) visible = false;
      x += current.values.x;
      y += current.values.y;
    }
    if (!visible || typeof node.values.characters !== "string" || node.values.characters.length === 0) continue;
    textRects.push({ nodeId: node.id, characters: node.values.characters, x: layoutOffset.x + x, y: layoutOffset.y + y, width: node.values.width, height: node.values.height });
    typography.push({ characters: node.values.characters, family: node.values.fontName?.family, style: node.values.fontName?.style, fontSize: node.values.fontSize, lineHeight: node.values.lineHeight, letterSpacing: node.values.letterSpacing });
  }
  const order = (a: { nodeId?: string; characters: string }, b: { nodeId?: string; characters: string }) => (a.characters < b.characters ? -1 : a.characters > b.characters ? 1 : 0);
  textRects.sort((a, b) => a.y - b.y || a.x - b.x || order(a, b));
  typography.sort(order);
  return { png, native: { nodeId: image.nodeId, caseId: image.caseId, exportBounds: { layout: bounds.layout, render: bounds.render }, layoutOffset, layoutSize: { width: root.values.width, height: root.values.height }, textRects, typography } };
}

/** Every text node of a recorded source tree, with the computed typography of the element that owns it. */
function sourceTypography(tree: any, fonts: any): NonNullable<Pair["source"]["typography"]> {
  const rows: NonNullable<Pair["source"]["typography"]> = [];
  const resolved: any[] = fonts?.status === "observed" ? fonts.rows : [];
  const walk = (element: any): void => {
    for (const child of element.nodes ?? []) {
      if (child.t === "text") {
        const text = String(child.v), style = element.style ?? {}, font = resolved.find((row) => row.text === text)?.fonts?.[0];
        if (text.trim().length === 0) continue;
        for (const channel of ["font-family", "font-weight", "font-size", "line-height", "letter-spacing"]) if (typeof style[channel] !== "string") refuse("source-typography-not-recorded", `text ${JSON.stringify(text)} has no computed ${channel}`);
        rows.push({ text, family: font?.familyName ?? null, postScriptName: font?.postScriptName ?? null, cssFamily: style["font-family"], cssWeight: style["font-weight"], fontSize: style["font-size"], lineHeight: style["line-height"], letterSpacing: style["letter-spacing"] });
      } else if (child.t === "el") walk(child.el);
    }
  };
  walk(tree);
  return rows.sort((a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
}

function sourceSide(original: Buffer, bounds: Box, boundsRecord: string, typography: Pair["source"]["typography"]): { source: Pair["source"]; png: Buffer } {
  const cropped = cropSourceFrame(original, bounds);
  if (JSON.stringify(cropped.crop) !== JSON.stringify(framingCrop(bounds, cropped.sourceSize))) refuse("source-framing-drift", "cropSourceFrame no longer matches the check's framing arithmetic");
  return { png: cropped.bytes, source: { originalSha256: sha256(original), originalSize: cropped.sourceSize, bounds, crop: cropped.crop, boundsRecord, typography } };
}

/** Every label a change set could carry as a native variant name; the pairing demands exactly one hit. */
function variantCandidates(changes: Record<string, { kind: string; value?: unknown }>, axisNames: Record<string, string>): string[] {
  let out = [""];
  for (const [prop, change] of Object.entries(changes)) {
    const values = change.kind === "omit" ? ["(unset)"] : [String(change.value), `${typeof change.value}-${String(change.value)}`];
    out = out.flatMap((prefix) => values.map((v) => `${prefix}${prefix ? ", " : ""}${axisNames[prop] ?? prop}=${v}`));
  }
  return out;
}

const written: string[] = [];
const emit = (relative: string, data: Buffer | string): void => {
  const file = path.join(outDir, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, data);
  written.push(relative);
};
const fileRef = (relative: string, png: Buffer) => ({ path: relative, sha256: sha256(png), ...dims(png) });

interface InitialSpec { id: string; component: string; description: string; operation: string; journal: string; event: string; inspection: string; axisNames?: Record<string, string>; pinnedByOperation: boolean; pairedBy: string; resultKey?: "content" }

function initialCohort(spec: InitialSpec): Cohort {
  const operationJournal = `source-native-app/operations/${spec.operation}`;
  const journal = readJournal(spec.journal, spec.event);
  let header = journal.header;
  if (spec.journal !== operationJournal) {
    if (journal.header.parentId !== spec.operation) refuse("update-journal-parent-mismatch", `${spec.journal} does not correct operation ${spec.operation}`);
    header = readJournal(operationJournal, null).header; // verifies the parent chain too
  }
  const readback = journal.result;
  assertReadback(readback, spec.operation, `${spec.journal}/events/${spec.event}`);
  const pinned = spec.pinnedByOperation ? (header.request?.observation ?? refuse("operation-observation-unpinned", spec.operation)) : null;
  if (pinned && !spec.inspection.endsWith(`/${pinned.id}`)) refuse("inspection-not-the-pinned-one", `${spec.operation} pins observation ${pinned.id}`);
  const archive = readArchive(spec.inspection, pinned ? pinned.inventorySha256 : null);
  const reportBytes = archive.file("report.json");
  if (pinned && sha256(reportBytes) !== pinned.reportSha256) refuse("inspection-report-changed", spec.inspection);
  const report = JSON.parse(reportBytes.toString("utf8")), request = JSON.parse(archive.file("request.json").toString("utf8"));
  if (report.phase !== "complete" || report.sourceUnchanged !== true || report.problems.length > 0 || request.anchor?.referenceId !== REFERENCE || request.anchor?.ownership?.id !== OWNERSHIP) refuse("inspection-unverified", spec.inspection);
  if (!spec.pinnedByOperation && (header.request?.referenceId !== REFERENCE || header.request?.ownership?.id !== OWNERSHIP || header.request?.caseId !== request.caseId)) refuse("inspection-not-the-operations-source", `${spec.inspection} and ${spec.operation} do not share reference, ownership and case`);

  const pairs: Pair[] = [], claimed = new Map<string, string>(), notMeasured: NotMeasured[] = [];
  for (const row of report.observation.rows) {
    if (row.status !== "observed") refuse("source-state-not-observed", `${spec.inspection} row ${row.id}`);
    const candidates = variantCandidates(row.changes, spec.axisNames ?? {});
    const hits = readback.images.filter((image: any) => candidates.includes(String(image.caseId).replace(/^variant:/, "")));
    if (hits.length > 1) refuse("variant-pairing-ambiguous", `${spec.id} observation ${row.id}`);
    if (hits.length === 0) continue; // a source mount the native set does not carry as a variant (e.g. an omitted prop)
    const image = hits[0], variant = String(image.caseId).replace(/^variant:/, "");
    if (claimed.has(variant)) refuse("variant-pairing-ambiguous", `${spec.id} variant ${variant} matches observations ${claimed.get(variant)} and ${row.id}`);
    claimed.set(variant, row.id);
    const original = archive.file(`states/${row.id}.png`), state = JSON.parse(archive.file(`states/${row.id}.json`).toString("utf8"));
    if (sha256(original) !== row.image || state.image !== row.image) refuse("source-image-changed", `${spec.inspection}/states/${row.id}.png`);
    if (!state.bounds) refuse("source-layout-origin-not-recorded", `${spec.inspection}/states/${row.id}.json`);
    const native = nativeSide(readback, image, spec.id), source = sourceSide(original, state.bounds, `states/${row.id}.json bounds`, sourceTypography(state.tree, state.fonts));
    const nativePath = `${spec.id}/${row.id}.native.png`, sourcePath = `${spec.id}/${row.id}.source.png`;
    emit(nativePath, native.png);
    emit(sourcePath, source.png);
    pairs.push({ id: `${spec.id}/${variant}`, variant, observation: row.id, pairedBy: spec.pairedBy, files: { native: fileRef(nativePath, native.png), source: fileRef(sourcePath, source.png) }, native: native.native, source: source.source });
  }
  for (const image of readback.images) {
    const variant = String(image.caseId).replace(/^variant:/, "");
    if (!claimed.has(variant)) notMeasured.push({ variant, reason: "no original React mount with these property values exists in the pinned inspection" });
  }
  return {
    id: spec.id,
    component: spec.component,
    description: spec.description,
    native: { operationId: spec.operation, ...(spec.journal !== operationJournal ? { updateId: journal.header.id, proposalId: journal.header.proposalId } : {}), journalEvent: `${path.basename(spec.journal)}/events/${spec.event}`, journalEventSha256: journal.eventSha256, journalEventsVerified: journal.events, journalHeadSha256: journal.headSha256, attemptId: journal.attemptId, phase: journal.phase, recordedAt: journal.recordedAt, planRevision: readback.planRevision, images: readback.images.length, nodes: readback.nodes.length },
    source: { referenceId: REFERENCE, ownershipId: OWNERSHIP, inspectionId: report.id, caseId: request.caseId, instanceId: report.observation.instanceId, module: report.observation.source.module, exportName: report.observation.source.exportName, sourceSha256: report.observation.source.sourceSha256, inventorySha256: archive.inventorySha256, reportSha256: sha256(reportBytes), pinnedBy: spec.pinnedByOperation ? "the native operation's journal header (request.observation)" : "its own archive inventory only — the native plan does not cite this inspection; they share source reference, ownership archive and case" },
    pairs,
    notMeasured,
    ...(notMeasured.length ? { notMeasuredReason: "No original React mount exists for these native variants; nothing was substituted." } : {}),
  };
}

interface FrameSpec { id: string; component: string; description: string; operation: string; event: string; caseId: string }

function frameCohort(spec: FrameSpec): Cohort {
  const relative = `source-native-app/operations/${spec.operation}`, journal = readJournal(relative, spec.event), readback = journal.result?.content;
  assertReadback(readback, spec.operation, `${relative}/events/${spec.event} content`);
  const request = journal.header.request?.root ?? refuse("operation-root-unpinned", spec.operation);
  if (request.referenceId !== REFERENCE || request.ownership?.id !== OWNERSHIP || request.caseId !== spec.caseId) refuse("operation-source-mismatch", spec.operation);
  const archive = readArchive(`react-source-ownership/${REFERENCE}/${OWNERSHIP}`, request.inventorySha256);
  const reportBytes = archive.file("report.json");
  if (sha256(reportBytes) !== request.ownership.sha256) refuse("ownership-report-changed", spec.operation);
  const row = JSON.parse(reportBytes.toString("utf8")).rows.find((r: any) => r.id === spec.caseId) ?? refuse("ownership-case-missing", spec.caseId);
  const original = archive.file(`${spec.caseId}/source.png`), originalSha = sha256(original);
  if (row.sourceImage !== originalSha || row.observedImage !== originalSha || row.matched !== true) refuse("source-image-changed", `${spec.caseId}/source.png`);
  // the app's own immutable framing record for exactly these source bytes
  const records = readdirSync(path.join(privateRoot, "source-framing")).filter((f) => f.endsWith(".json")).sort().map((f) => ({ f, record: json(`source-framing/${f}`, "source-framing-missing") })).filter(({ record }) => record.sourceSha256 === originalSha);
  if (records.length === 0) refuse("source-layout-origin-not-recorded", `no source-framing record names ${spec.caseId}/source.png`);
  if (new Set(records.map(({ record }) => JSON.stringify(record.bounds))).size !== 1) refuse("source-framing-ambiguous", spec.caseId);
  const tree = JSON.parse(archive.file(`${spec.caseId}/source-tree.json`).toString("utf8"));
  if (tree.status !== "captured" || tree.sourcePngSha256 !== originalSha) refuse("source-tree-not-of-this-image", `${spec.caseId}/source-tree.json`);
  const { f, record } = records[0]!, source = sourceSide(original, record.bounds, `source-framing/${f} (inputSha256 ${record.inputSha256})`, sourceTypography(tree.tree, null));
  if (record.version !== 1 || record.qualification !== "unqualified" || sha256(source.png) !== record.imageSha256 || JSON.stringify(record.crop) !== JSON.stringify(source.source.crop)) refuse("source-framing-record-changed", f);
  if (readback.images.length !== 1) refuse("native-frame-image-count", spec.operation);
  const native = nativeSide(readback, readback.images[0], spec.id);
  const nativePath = `${spec.id}/0.native.png`, sourcePath = `${spec.id}/0.source.png`;
  emit(nativePath, native.png);
  emit(sourcePath, source.png);
  return {
    id: spec.id,
    component: spec.component,
    description: spec.description,
    native: { operationId: spec.operation, journalEvent: `${spec.operation}/events/${spec.event}`, journalEventSha256: journal.eventSha256, journalEventsVerified: journal.events, journalHeadSha256: journal.headSha256, attemptId: journal.attemptId, phase: journal.phase, recordedAt: journal.recordedAt, planRevision: readback.planRevision, images: 1, nodes: readback.nodes.length },
    source: { referenceId: REFERENCE, ownershipId: OWNERSHIP, caseId: spec.caseId, inventorySha256: archive.inventorySha256, reportSha256: sha256(reportBytes), pinnedBy: "the native operation's journal header (request.root)" },
    pairs: [{ id: `${spec.id}/${spec.caseId}`, variant: spec.caseId, observation: "source", pairedBy: "the operation header names this ownership case; the readback carries one comparison image", files: { native: fileRef(nativePath, native.png), source: fileRef(sourcePath, source.png) }, native: native.native, source: source.source }],
    notMeasured: [],
  };
}

/** The 63 retained Button roots: original images exist per variant, but the native mains are content-less. */
function buttonRootMatrix(): Cohort {
  const operation = "e9bd4394-5801-4afc-8fde-b6c1807161a4", update = "source-native-updates/c620c0e9-dc6f-7e2a-3008-0896399a0a86", event = "00000007.json";
  const journal = readJournal(update, event), readback = journal.result;
  if (journal.header.parentId !== operation) refuse("update-journal-parent-mismatch", update);
  const header = readJournal(`source-native-app/operations/${operation}`, null).header;
  assertReadback(readback, operation, `${update}/events/${event}`);
  const archive = readArchive(`react-source-ownership/${REFERENCE}/${OWNERSHIP}`, header.request.inventorySha256);
  const matrix = JSON.parse(archive.file("button-default/matrix/report.json").toString("utf8"));
  const nodes = new Map<string, any>(readback.nodes.map((n: any) => [n.id, n]));
  let withOriginal = 0, withBounds = 0, contentless = 0, exportBounds = 0;
  const notMeasured: NotMeasured[] = readback.images.map((image: any) => {
    const variant = String(image.caseId).replace(/^variant:/, "");
    const hits = matrix.rows.filter((row: any) => variantCandidates(row.changes, {}).includes(variant));
    if (hits.length === 1) {
      withOriginal++;
      archive.file(`button-default/matrix/${hits[0].id}.png`);
      if (JSON.parse(archive.file(`button-default/matrix/${hits[0].id}.json`).toString("utf8")).bounds) withBounds++;
    }
    const root = nodes.get(image.nodeId), children = (root?.childIds ?? []).map((id: string) => nodes.get(id));
    const hasContent = [...nodes.values()].some((n) => n.type === "TEXT" && String(n.id).includes(image.nodeId)) || children.some((c: any) => c && c.type !== "RECTANGLE" && c.type !== "SLOT");
    if (!hasContent && children.some((c: any) => c?.type === "SLOT")) contentless++;
    if (image.exportBounds) exportBounds++;
    return { variant, reason: "native main is a root with an EMPTY Children slot; the original React mount carries caller content (the label), so the pair is not like-for-like" };
  });
  const total = readback.images.length;
  if (contentless !== total) refuse("button-root-matrix-premise-changed", `${contentless}/${total} native mains are content-less; re-examine whether the family became measurable`);
  return {
    id: "button-root-matrix",
    component: "Button",
    description: `The retained Button family: ${total} native mains (size × variant). NOT MEASURED — see the reason below.`,
    native: { operationId: operation, updateId: journal.header.id, proposalId: journal.header.proposalId, journalEvent: `${path.basename(update)}/events/${event}`, journalEventSha256: journal.eventSha256, journalEventsVerified: journal.events, journalHeadSha256: journal.headSha256, attemptId: journal.attemptId, phase: journal.phase, recordedAt: journal.recordedAt, planRevision: readback.planRevision, images: total, nodes: readback.nodes.length, imagesWithExportBounds: exportBounds },
    source: { referenceId: REFERENCE, ownershipId: OWNERSHIP, caseId: "button-default", matrixObservations: matrix.rows.length, variantsWithAnOriginalImage: withOriginal, originalsWithRecordedBounds: withBounds, inventorySha256: archive.inventorySha256, pinnedBy: "the native operation's journal header (request.inventorySha256)" },
    pairs: [],
    notMeasured,
    notMeasuredReason: `A per-variant ORIGINAL React image exists for ${withOriginal} of the ${total} variants (the ownership archive's ${matrix.rows.length}-observation property matrix), but no honest pair can be built: (1) every one of the ${total} native mains is a Button root whose Children slot is EMPTY (component + background rectangle + slot, no text), while every original mount renders the caller's label, so an image comparison would measure the absent caller content, not the root; (2) ${withBounds} of the matrix originals record layout bounds and ${exportBounds} of the ${total} native exports record export bounds, so neither side has a recorded layout origin. No image was committed for this cohort and nothing was substituted.`,
  };
}

// ---------------------------------------------------------------------------
assertScorerPins();
const knownPath = path.join(outDir, "KNOWN-FAILURES.json");
const keptKnown = existsSync(knownPath) ? readFileSync(knownPath) : null;
// Only this lane's own cohort directories are ever removed — never the directory it was pointed at.
for (const id of ["button-initial", "checkbox-initial", "card-composed-variants", "card-composed-frame", "card-content-frame", "button-root-matrix"]) rmSync(path.join(outDir, id), { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const cohorts: Cohort[] = [
  initialCohort({
    id: "button-initial",
    component: "Button",
    description: "Button, 24 initial-state variants (disabled × variant). Native: the reader readback (export bounds recorded) of the default-fill update of the initial-state operation. Source: the pinned initial-state inspection of the original shadcn Button.",
    operation: "61f15677-e1c0-4d38-a27d-616d99d17eec",
    journal: "source-native-updates/190cfa33-d0fa-b0f1-1a74-2c4659e8a2df",
    event: "00000007.json",
    inspection: "react-initial-inspections/20d1459772eb09d42458b9c630aad4e04d8bab614fc51c3711058431276126f3/71bf5fff-ccc4-4824-a937-b5a2bc6838a5",
    pinnedByOperation: true,
    pairedBy: "the observation's property changes spell exactly one native variant name",
  }),
  initialCohort({
    id: "checkbox-initial",
    component: "Checkbox",
    description: "Checkbox, 12 initial-state variants (defaultChecked × disabled), control only. Native: the LATEST verified update readback that carries images (update d9c7a2b4…, 2026-09-18, after the live two-way-update proofs returned the canvas to opacity 0.5); the earlier privately scored run read update 0b978ebf…. Source: the pinned initial-state inspection of the original shadcn Checkbox.",
    operation: "a62ab364-a451-43c6-bed6-7e9455693552",
    journal: "source-native-updates/d9c7a2b4-fe66-8d5c-d7c6-5e28edadb516",
    event: "00000006.json",
    inspection: "react-initial-inspections/d16d1792a34a00b5b3fa55ecb2a143ff135d788a9782a976feb6ec591c36efc7/8002ed1c-96a5-471a-9257-b1937c9bab97",
    pinnedByOperation: true,
    pairedBy: "the observation's property changes spell exactly one native variant name",
  }),
  initialCohort({
    id: "card-composed-variants",
    component: "Card (composed)",
    description: "The composed Card's six parent variants (the nested Checkbox's forwarded defaultChecked × disabled). Native: the 2026-09-18 read-only readback of the native graph operation. Source: the original Card story mounted with the nested Checkbox (instance-5) in each initial state — an independent inspection the native plan does not cite; paired by property values.",
    operation: "4e6e22c3-b90d-41e3-bd11-ac50571507ce",
    journal: "source-native-app/operations/4e6e22c3-b90d-41e3-bd11-ac50571507ce",
    event: "00000011.json",
    inspection: "react-initial-inspections/100f660f44fd0c51d1fb9d43cbf78e4101adfade69c21770c60074f842944fd9/ce701240-dd52-4311-bc07-3405f2f18476",
    axisNames: { defaultChecked: "control5DefaultChecked", disabled: "control5Disabled" },
    pinnedByOperation: false,
    pairedBy: "the nested Checkbox's (instance-5) property changes spell exactly one parent variant name under the plan's forwarded axes control5DefaultChecked / control5Disabled",
  }),
  frameCohort({
    id: "card-composed-frame",
    component: "Card (composed)",
    description: "The retained single composed-Card comparison frame. Native: the LATEST readback of the comparison operation (event 39, 2026-09-17); the earlier privately scored 1.683 % read event 29's export. Source: the ownership archive's original, framed by the app's own source-framing record.",
    operation: "95db6913-5dfc-4eae-86bf-e520c43cec7d",
    event: "00000039.json",
    caseId: "card-composed",
  }),
  frameCohort({
    id: "card-content-frame",
    component: "Card (content)",
    description: "The retained single Card-content comparison frame. Native: the comparison operation's readback (event 7). Source: the ownership archive's original, framed by the app's own source-framing record.",
    operation: "4a709124-54b4-4468-a0d9-307fe5a56122",
    event: "00000007.json",
    caseId: "card-content",
  }),
  buttonRootMatrix(),
];

const manifest: Manifest = {
  artifactVersion: "react-native-fidelity-manifest-v1",
  qualification: QUALIFICATION,
  acceptedContract: null,
  note: "Portable evidence for the code-led (React -> contract -> native Figma) cohort. Measurements only: no owner grade, sign-off or accepted contract is recorded or implied. Paths are relative to this directory. Journals stay private; every committed byte is hashed here and every journal event it came from is named with its sha256.",
  sourceReferenceId: REFERENCE,
  harness: SOURCE_HARNESS,
  cohorts,
};
emit("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

const known: KnownFile = keptKnown
  ? (JSON.parse(keptKnown.toString("utf8")) as KnownFile)
  : { _marker: "KNOWN FAILURES — a shrink-only ratchet read by scripts/react-native-fidelity-check.ts. Every row is a measured historical FAIL with its cause. Admitted classes: font-substrate, font-metrics (needs `measured`), alignment-trim-threshold (proof recomputed by the check). Nothing here changes a score; the check is red on a failing row not listed, on a listed row that passes, and on a listed row whose class the measurements contradict.", qualification: QUALIFICATION, failures: {} };
emit("KNOWN-FAILURES.json", keptKnown ?? `${JSON.stringify(known, null, 2)}\n`);

verifyBytes(outDir, manifest);
const scorecard = buildScorecard(outDir, manifest, known);
emit("SCORECARD.json", `${JSON.stringify(scorecard, null, 2)}\n`);
emit("REPORT.md", renderReport(manifest, scorecard, known));

const leak = written.filter((f) => /\.(json|md)$/.test(f)).filter((f) => /\/Users\/|\/home\/|figd_|FIGMA_TOKEN|pngBase64/.test(readFileSync(path.join(outDir, f), "utf8")));
if (leak.length) refuse("evidence-leak", `${leak.join(", ")} carries a local path, a token or journal bytes`);

for (const cohort of cohorts) console.log(`${cohort.id.padEnd(26)} pairs ${String(cohort.pairs.length).padStart(2)} · not-measured ${cohort.notMeasured.length}`);
const problems = ratchetProblems(scorecard, known);
for (const p of problems) console.log(`  ratchet: ${p}`);
console.log(`\nrecorded ${written.length} files into ${path.relative(REPO, outDir) || outDir}${problems.length ? " — the ratchet is RED until KNOWN-FAILURES.json names what the measurements support" : ""}`);
