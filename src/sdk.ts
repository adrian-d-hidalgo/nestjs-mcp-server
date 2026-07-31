/**
 * Curated re-exports from `@modelcontextprotocol/server`.
 *
 * Every type that appears in this package's public signatures must be nameable
 * from `@nestjs-mcp/server` itself. The MCP SDK is *our* dependency, not the
 * consumer's — under pnpm's strict `node_modules` layout they cannot import it
 * directly even though our `.d.ts` files mention its types.
 *
 * These are re-exports, never redeclarations, per the SDK-types-first rule.
 */

// ---------------------------------------------------------------------------
// Multi Round-Trip Requests (MRTR)
//
// Protocol revision 2026-07-28 replaced the server-initiated
// `elicitation/create` and `sampling/createMessage` requests — which needed a
// held-open bidirectional stream — with a retry handshake: the handler returns
// `inputRequired(...)`, and the client re-sends the original call with the
// answers attached.
//
// This is the ONLY way to elicit input on the modern era.
// `ctx.mcpReq.elicitInput` and `ctx.mcpReq.requestSampling` still exist but are
// deprecated and **throw** on a 2026-07-28 request.
// ---------------------------------------------------------------------------
export {
  // Reads the accepted content of an elicitation answer out of
  // `ctx.mcpReq.inputResponses` on the retried call.
  acceptedContent,
  inputRequired,
  inputResponse,
  isInputRequiredResult,
} from '@modelcontextprotocol/server';

export type {
  InputRequest,
  InputRequests,
  InputRequiredResult,
  InputResponse,
  InputResponses,
} from '@modelcontextprotocol/server';

/**
 * Mints and verifies the opaque `requestState` an MRTR handler echoes across a
 * round trip. Pair with `McpModuleOptions.server.requestState.verify` — that is
 * what makes a retry safe to land on a *different* instance, which is the whole
 * point of multi-round-trip under a stateless core.
 */
export { createRequestStateCodec } from '@modelcontextprotocol/server';

export type {
  RequestStateCodec,
  RequestStateCodecOptions,
} from '@modelcontextprotocol/server';

// ---------------------------------------------------------------------------
// Result and content types a handler returns
// ---------------------------------------------------------------------------
export type {
  CallToolResult,
  ContentBlock,
  GetPromptResult,
  ReadResourceResult,
  TextContent,
} from '@modelcontextprotocol/server';

// ---------------------------------------------------------------------------
// Types appearing in decorator options and module options
// ---------------------------------------------------------------------------
export type {
  AuthInfo,
  CacheHint,
  CacheScope,
  Icon,
  Implementation,
  ProtocolEra,
  ResourceMetadata,
  ServerContext,
  ServerEventBus,
  ServerNotifier,
  StandardSchemaWithJSON,
  ToolAnnotations,
  Variables,
} from '@modelcontextprotocol/server';
