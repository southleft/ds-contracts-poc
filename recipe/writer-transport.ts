import { createHash } from "node:crypto";

import { FIGMA_PORTABLE_RUNTIME } from "./figma-runtime-portability.js";

export const WRITER_TRANSPORT_PROTOCOL =
  "ds-contracts/figma-writer-utf8-base64/v1";

export interface WriterTransportEnvelope {
  protocol: typeof WRITER_TRANSPORT_PROTOCOL;
  encoding: "utf8+base64";
  payload: string;
  payloadBytes: number;
  payloadSha256: string;
}

export interface WriterTransportArtifact {
  envelope: WriterTransportEnvelope;
  envelopeSha256: string;
  wrapper: string;
  wrapperBytes: number;
  wrapperSha256: string;
}

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

export function createWriterTransportEnvelope(
  writerBytes: Uint8Array,
): WriterTransportEnvelope {
  return {
    protocol: WRITER_TRANSPORT_PROTOCOL,
    encoding: "utf8+base64",
    payload: Buffer.from(writerBytes).toString("base64"),
    payloadBytes: writerBytes.byteLength,
    payloadSha256: sha256(writerBytes),
  };
}

export function decodeWriterTransportEnvelope(
  envelope: WriterTransportEnvelope,
): Uint8Array {
  if (envelope.protocol !== WRITER_TRANSPORT_PROTOCOL) {
    throw new Error("WRITER-TRANSPORT-PROTOCOL");
  }
  if (envelope.encoding !== "utf8+base64") {
    throw new Error("WRITER-TRANSPORT-ENCODING");
  }
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      envelope.payload,
    )
  ) {
    throw new Error("WRITER-TRANSPORT-BASE64");
  }
  const decoded = Buffer.from(envelope.payload, "base64");
  if (decoded.toString("base64") !== envelope.payload) {
    throw new Error("WRITER-TRANSPORT-BASE64");
  }
  if (decoded.byteLength !== envelope.payloadBytes) {
    throw new Error("WRITER-TRANSPORT-LENGTH");
  }
  if (sha256(decoded) !== envelope.payloadSha256) {
    throw new Error("WRITER-TRANSPORT-SHA256");
  }
  return decoded;
}

export function createWriterTransportWrapper(
  envelope: WriterTransportEnvelope,
): string {
  const serialized = JSON.stringify(envelope);
  return `return await (async()=>{const envelope=${serialized};${FIGMA_PORTABLE_RUNTIME}
const state={protocol:envelope.protocol,payloadBytes:envelope.payloadBytes,expectedSha256:envelope.payloadSha256,decodedBytes:null,decodedSha256:null,hashImplementation:null,utf8Implementation:null,evalBegan:false,evalCompleted:false,runtimePreflight:null};
globalThis.__recipeTransportV3=state;
const fail=(code)=>{state.failure=code;throw new Error(code);};
state.runtimePreflight=runtimePreflight();
if(figma.fileKey!=="byMp6lt0Ij9b2QbkDGFwBh"||figma.root.name!=="Scratch Project"||figma.editorType!=="figma")fail("WRITER-TRANSPORT-WRONG-TARGET");
if(envelope.protocol!=="${WRITER_TRANSPORT_PROTOCOL}")fail("WRITER-TRANSPORT-PROTOCOL");
if(envelope.encoding!=="utf8+base64")fail("WRITER-TRANSPORT-ENCODING");
if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(envelope.payload))fail("WRITER-TRANSPORT-BASE64");
let bytes;try{bytes=runtimeDecodeBase64(envelope.payload)}catch{fail("WRITER-TRANSPORT-BASE64")}
state.decodedBytes=bytes.byteLength;
if(bytes.byteLength!==envelope.payloadBytes)fail("WRITER-TRANSPORT-LENGTH");
const decodedSha256=runtimeSha256(bytes);
state.hashImplementation="verified-js-fallback";
state.decodedSha256=decodedSha256;
if(decodedSha256!==envelope.payloadSha256)fail("WRITER-TRANSPORT-SHA256");
let source;try{const decoded=runtimeDecodeUtf8(bytes,"WRITER-TRANSPORT-UTF8");source=decoded.value;state.utf8Implementation=decoded.implementation;}catch(error){fail(error instanceof Error?error.message:"WRITER-TRANSPORT-UTF8")}
state.evalBegan=true;
const result=await eval("(async()=>{"+source+"\\n})()");
state.evalCompleted=true;
return {transport:state,result};
})();\n`;
}

export function createStagedWriterTransportWrapper(
  envelope: WriterTransportEnvelope,
): string {
  const placeholder = "__WRITER_TRANSPORT_STAGED_PAYLOAD__";
  const template = createWriterTransportWrapper({
    ...envelope,
    payload: placeholder,
  });
  const marker = `"payload":"${placeholder}"`;
  if (!template.includes(marker)) {
    throw new Error("WRITER-TRANSPORT-STAGED-TEMPLATE");
  }
  return template.replace(
    marker,
    '"payload":globalThis.__recipeTransportV3Payload',
  );
}

export function createWriterTransportArtifact(
  writerBytes: Uint8Array,
): WriterTransportArtifact {
  const envelope = createWriterTransportEnvelope(writerBytes);
  const envelopeBytes = `${JSON.stringify(envelope, null, 2)}\n`;
  const wrapper = createWriterTransportWrapper(envelope);
  return {
    envelope,
    envelopeSha256: sha256(envelopeBytes),
    wrapper,
    wrapperBytes: Buffer.byteLength(wrapper),
    wrapperSha256: sha256(wrapper),
  };
}

export function validateWriterTransportArtifact(
  artifact: WriterTransportArtifact,
  expectedWrapperSha256: string,
): string[] {
  const failures: string[] = [];
  try {
    decodeWriterTransportEnvelope(artifact.envelope);
  } catch (error) {
    failures.push((error as Error).message);
  }
  if (sha256(artifact.wrapper) !== artifact.wrapperSha256) {
    failures.push("WRITER-TRANSPORT-WRAPPER-ARTIFACT-SHA256");
  }
  if (artifact.wrapperSha256 !== expectedWrapperSha256) {
    failures.push("WRITER-TRANSPORT-WRAPPER-EXPECTED-SHA256");
  }
  if (Buffer.byteLength(artifact.wrapper) !== artifact.wrapperBytes) {
    failures.push("WRITER-TRANSPORT-WRAPPER-LENGTH");
  }
  return failures;
}
