/**
 * Minimal streamable-HTTP MCP client for the Figma desktop Dev Mode MCP
 * server (default http://127.0.0.1:3845/mcp) — the third import rung: variable
 * NAMES from the user's own desktop app, no Enterprise plan gating.
 *
 * Browser-pure by construction: global `fetch` only (injectable), no node
 * builtins. Today the desktop server's CSP/CORS posture blocks a hosted page
 * from calling it directly, so the CLI (extract/figma/mcp/cli.ts) is the
 * shipping consumer — but a future local bridge or extension can reuse this
 * module unchanged.
 *
 * Protocol surface (streamable HTTP, spec rev 2025-06-18), exactly what the
 * live server was observed to speak:
 *
 *   POST initialize                 → response carries an `mcp-session-id`
 *                                     header; every later call echoes it
 *   POST notifications/initialized  → 202, no body
 *   POST tools/call                 → result.content[] text parts
 *
 * Every POST sends `Accept: application/json, text/event-stream` and parses
 * BOTH response framings: plain JSON, and SSE (`event: message` / `data: {…}`
 * lines — the framing the desktop server actually uses).
 */

// ---------------------------------------------------------------------------
// Fetch shape (headers access needed for the session id — the rest/fetch.ts
// FetchLike doesn't expose headers, so this module declares its own)
// ---------------------------------------------------------------------------

export type McpFetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export interface McpClientOptions {
  /** Injectable for tests / fixture replay. Defaults to global fetch. */
  fetchImpl?: McpFetchLike;
  clientInfo?: { name: string; version: string };
}

export const MCP_DEFAULT_URL = 'http://127.0.0.1:3845/mcp';
export const MCP_PROTOCOL_VERSION = '2025-06-18';

// ---------------------------------------------------------------------------
// JSON-RPC + SSE parsing
// ---------------------------------------------------------------------------

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/** Parse a response body in either framing into its JSON-RPC messages. An SSE
 *  body is a sequence of events whose `data:` lines each carry one message. */
export function parseMcpBody(contentType: string, body: string): JsonRpcResponse[] {
  if (contentType.includes('text/event-stream')) {
    const messages: JsonRpcResponse[] = [];
    // Events are separated by blank lines; an event's payload is the
    // concatenation of its data lines (SSE spec).
    for (const event of body.split(/\r?\n\r?\n/)) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data) continue;
      messages.push(JSON.parse(data) as JsonRpcResponse);
    }
    return messages;
  }
  if (body.trim() === '') return [];
  return [JSON.parse(body) as JsonRpcResponse];
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** One tool invocation's outcome. `text` joins the result's text parts;
 *  `isError` is the MCP-level tool failure flag (the transport succeeded but
 *  the tool refused — e.g. "No node could be found…"). */
export interface McpToolResult {
  text: string;
  isError: boolean;
}

export interface McpConnection {
  sessionId: string | null;
  serverName: string;
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
}

interface ToolCallResult {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

/**
 * Initialize handshake → live connection. A failed fetch here (connection
 * refused) means the Dev Mode MCP server is not running — callers own the
 * user-facing wording for that.
 */
export async function connectMcp(url: string = MCP_DEFAULT_URL, opts: McpClientOptions = {}): Promise<McpConnection> {
  const fetchImpl = opts.fetchImpl ?? (fetch as unknown as McpFetchLike);
  let nextId = 1;
  let sessionId: string | null = null;

  const post = async (payload: Record<string, unknown>): Promise<JsonRpcResponse[]> => {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
      },
      body: JSON.stringify(payload),
    });
    sessionId = res.headers.get('mcp-session-id') ?? sessionId;
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`MCP server responded ${res.status} on ${String(payload.method)}${body ? ` — ${body.slice(0, 200)}` : ''}`);
    }
    const contentType = res.headers.get('content-type') ?? 'application/json';
    return parseMcpBody(contentType, await res.text());
  };

  const request = async (method: string, params?: Record<string, unknown>): Promise<unknown> => {
    const id = nextId++;
    const messages = await post({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
    const response = messages.find((m) => m.id === id) ?? messages.find((m) => m.result !== undefined || m.error !== undefined);
    if (!response) throw new Error(`MCP server sent no response to ${method}`);
    if (response.error) throw new Error(`MCP ${method} failed: ${response.error.message}`);
    return response.result;
  };

  const init = (await request('initialize', {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: opts.clientInfo ?? { name: 'ds-contracts-poc', version: '0.1.0' },
  })) as { serverInfo?: { name?: string } };
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' });

  return {
    get sessionId() {
      return sessionId;
    },
    serverName: init.serverInfo?.name ?? '(unnamed MCP server)',
    async callTool(name, args) {
      const result = (await request('tools/call', { name, arguments: args })) as ToolCallResult;
      const text = (result.content ?? [])
        .filter((c) => c.type === 'text' && typeof c.text === 'string')
        .map((c) => c.text as string)
        .join('\n');
      return { text, isError: result.isError === true };
    },
  };
}
