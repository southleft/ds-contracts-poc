/** Shared local native delivery boundary; only the journal chooses executable commands. */
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {createNativeOperationTransport} from './native-operation-transport.js';
type Transport=Pick<ReturnType<typeof createNativeOperationTransport>,'authorize'|'claim'|'begin'|'acceptDelivery'>;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export function loopbackOrigin(value: unknown): string {
  if (typeof value !== "string")
    throw new Error("Enter a local Storybook origin.");
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Only an unauthenticated local Storybook origin is supported.",
    );
  return url.origin;
}

export const json = (res: ServerResponse, status: number, value: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
};
export async function handleNativeRequest(req:IncomingMessage,res:ServerResponse,deliveryTransport:(id:string)=>Transport){
    const remote = req.socket.remoteAddress;
    if (!remote || !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)) {
      json(res, 403, { error: "Local access only." });
      return null;
    }
    // Guard DNS rebinding as well as cross-origin writes/reads.
    let host: URL;
    try {
      host = new URL(`http://${req.headers.host}`);
      loopbackOrigin(host.origin);
    } catch {
      json(res, 403, { error: "Local host required." });
      return null;
    }
    const route = (req.url ?? "")
      .split("?")[0]
      .replace(/^\/api\/source-reference\/?/, "");
    // The plugin is a different origin. Only these three routes accept its
    // high-entropy pairing capability; no general service CORS exemption.
    const pluginRoute = /^native\/([a-f0-9-]+)\/(claim|begin|result)$/.exec(route);
    const body = async (limit: number) => {
      if (!req.headers["content-type"]?.startsWith("application/json"))
        throw Error("JSON required");
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > limit) throw Error("Request too large");
        chunks.push(bytes);
      }
      return JSON.parse(Buffer.concat(chunks).toString());
    };
    if (pluginRoute) {
      if (req.headers.origin === "null") {
        res.setHeader("Access-Control-Allow-Origin", "null");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Authorization, Content-Type",
        );
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      } else if (req.headers.origin && req.headers.origin !== host.origin) {
        json(res, 403, { error: "Plugin origin required." });
        return null;
      }
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return null;
      }
      if (req.method !== "POST") {
        json(res, 405, { error: "POST required." });
        return null;
      }
      const secret =
        /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? "")?.[1] ??
        "";
      try {
        deliveryTransport(pluginRoute[1]).authorize(pluginRoute[1], secret);
      } catch {
        json(res, 403, { error: "Native connection refused." });
        return null;
      }
      try {
        const payload = await body(
          pluginRoute[2] === "result" ? 4 * 1024 * 1024 : 2048,
        );
        if (pluginRoute[2] === "begin") {
          // Asked immediately before a write executes; refused once a canvas
          // read has been dispatched to settle that same write.
          if (!object(payload) || Object.keys(payload).join() !== "attemptId" || typeof payload.attemptId !== "string" || !UUID.test(payload.attemptId)) {
            json(res, 400, { error: "Only the write attempt identity is accepted." });
            return null;
          }
          json(res, 200, deliveryTransport(pluginRoute[1]).begin(pluginRoute[1], secret, payload.attemptId));
        } else if (pluginRoute[2] === "claim") {
          if (
            !object(payload) ||
            Object.keys(payload).some(
              (key) => !["fileKey", "replaceReadbackAttemptId", "resolveWriteAttemptId", "protocol"].includes(key),
            ) ||
            typeof payload.fileKey !== "string" ||
            (payload.protocol !== undefined && payload.protocol !== 2) ||
            [payload.replaceReadbackAttemptId, payload.resolveWriteAttemptId].some(
              (attempt) => attempt !== undefined && (typeof attempt !== "string" || !UUID.test(attempt)))
          ) {
            json(res, 400, {
              error:
                "Only the active file and an optional interrupted readback identity are accepted.",
            });
            return null;
          }
          json(
            res,
            200,
            deliveryTransport(pluginRoute[1]).claim(
              pluginRoute[1],
              secret,
              payload.fileKey,
              payload.replaceReadbackAttemptId as string | undefined,
              payload.resolveWriteAttemptId as string | undefined,
              payload.protocol as number | undefined,
            ),
          );
        } else {
          json(
            res,
            200,
            deliveryTransport(pluginRoute[1]).acceptDelivery(pluginRoute[1], secret, payload),
          );
        }
      } catch {
        json(res, 409, {
          error:
            "Native delivery could not proceed. Inspect the operation in the local app; a missing result does not authorize another creation.",
        });
      }
      return null;
    }
    if (req.headers.origin && req.headers.origin !== host.origin) {
      json(res, 403, { error: "Same-origin access required." });
      return null;
    }
  return {route,body,host};
}
