# MCP Server NestJS Module Library <!-- omit in toc -->

[![NPM Version](https://img.shields.io/npm/v/@nestjs-mcp/server)](https://www.npmjs.com/package/@nestjs-mcp/server)
[![Semantic Release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Downloads](https://img.shields.io/npm/dm/@nestjs-mcp/server)](https://www.npmjs.com/package/@nestjs-mcp/server)
[![CI Pipeline](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/adrian-d-hidalgo/nestjs-mcp-server/graph/badge.svg?token=5E228VKY5K)](https://codecov.io/gh/adrian-d-hidalgo/nestjs-mcp-server)
[![Known Vulnerabilities](https://snyk.io/test/github/adrian-d-hidalgo/nestjs-mcp-server/badge.svg)](https://snyk.io/test/github/adrian-d-hidalgo/nestjs-mcp-server)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

---

## Overview <!-- omit in toc -->

**NestJS MCP Server** is a modular library for building [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/typescript-sdk/tree/server) servers using [NestJS](https://nestjs.com/). It provides decorators, modules, and integration patterns to expose MCP resources, tools, and prompts in a scalable, maintainable way. This project is a wrapper for the official [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk/tree/server) and is always kept compatible with its types and specification.

---

## Table of Contents <!-- omit in toc -->

- [Installation](#installation)
- [Quickstart](#quickstart)
- [What is MCP?](#what-is-mcp)
- [Core Concepts](#core-concepts)
  - [Server](#server)
  - [Resource](#resource)
  - [Tool](#tool)
  - [Prompt](#prompt)
- [Module API](#module-api)
  - [`McpModule.forRoot`](#mcpmoduleforroot)
  - [`McpModule.forRootAsync`](#mcpmoduleforrootasync)
  - [`McpModule.forFeature`](#mcpmoduleforfeature)
- [Module Usage](#module-usage)
  - [1. Global Registration with `McpModule.forRoot`](#1-global-registration-with-mcpmoduleforroot)
  - [2. Feature Module Registration with `McpModule.forFeature`](#2-feature-module-registration-with-mcpmoduleforfeature)
- [Capabilities](#capabilities)
  - [Resolver Decorator](#resolver-decorator)
  - [Prompt Decorator](#prompt-decorator)
  - [Resource Decorator](#resource-decorator)
  - [Tool Decorator](#tool-decorator)
    - [Tool Annotations](#tool-annotations)
    - [ToolOptions Variants](#tooloptions-variants)
  - [McpContext Argument](#mcpcontext-argument)
- [Dynamic Capabilities](#dynamic-capabilities)
  - [Static toggle](#static-toggle)
  - [Capability gate](#capability-gate)
  - [What the client sees](#what-the-client-sees)
  - [Fail-closed, in five cases](#fail-closed-in-five-cases)
  - [Rules you must know before using this](#rules-you-must-know-before-using-this)
  - [This is not a replacement for guards](#this-is-not-a-replacement-for-guards)
- [Guards](#guards)
  - [Global-level guards](#global-level-guards)
  - [Resolver-level guards](#resolver-level-guards)
  - [Method-level guards](#method-level-guards)
  - [Guard Example](#guard-example)
  - [MCP Execution Context](#mcp-execution-context)
  - [Guards with Dependency Injection](#guards-with-dependency-injection)
- [Statelessness](#statelessness)
- [Transport Options](#transport-options)
- [MCP 2026-07-28 features](#mcp-2026-07-28-features)
- [Migrating from `1.x` to `2.x`](#migrating-from-1x-to-2x)
- [Inspector Playground](#inspector-playground)
- [Examples](#examples)
- [Changelog](#changelog)
- [License](#license)
- [Contributions](#contributions)

---

## Installation

```sh
npm install @nestjs-mcp/server @modelcontextprotocol/sdk zod
# or
yarn add @nestjs-mcp/server @modelcontextprotocol/sdk zod
# or
pnpm add @nestjs-mcp/server @modelcontextprotocol/sdk zod
```

---

## Quickstart

Register the MCP module in your NestJS app and expose a simple tool:

```ts
import { Module } from '@nestjs/common';

import { CallToolResult } from '@modelcontextprotocol/sdk/types';

import { Resolver, Tool, McpModule } from '@nestjs-mcp/server';

@Resolver()
export class HealthResolver {
  /**
   * Simple health check tool
   */
  @Tool({ name: 'server_health_check' })
  healthCheck(): CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text: 'Server is operational. All systems running normally.',
        },
      ],
    };
  }
}

@Module({
  imports: [
    McpModule.forRoot({
      name: 'My MCP Server',
      version: '1.0.0',
    }),
  ],
  providers: [HealthResolver],
})
export class AppModule {}
```

---

## What is MCP?

The **Model Context Protocol (MCP)** is an open protocol for connecting LLMs to external data, tools, and prompts. MCP servers expose resources (data), tools (actions), and prompts (conversational flows) in a standardized way, enabling seamless integration with LLM-powered clients.

- See the [Anthropic announcement](https://www.anthropic.com/news/model-context-protocol) for more background.

---

## Core Concepts

### Server

The MCP Server is the main entry point for exposing capabilities to LLMs. It manages the registration and discovery of resources, tools, and prompts.

### Resource

A Resource represents structured data or documents that can be queried or retrieved by LLMs. Resources are typically read-only and are identified by a unique URI.

- Learn more: [MCP Resources documentation](https://modelcontextprotocol.io/docs/concepts/resources)

### Tool

A Tool is an action or function that can be invoked by LLMs. Tools may have side effects and can accept parameters to perform computations or trigger operations.

- Learn more: [MCP Tools documentation](https://modelcontextprotocol.io/docs/concepts/tools)

### Prompt

A Prompt defines a conversational flow, template, or interaction pattern for LLMs. Prompts help guide the model's behavior in specific scenarios.

- Learn more: [MCP Prompts documentation](https://modelcontextprotocol.io/docs/concepts/prompts)

> **See the [Capabilities](#capabilities) section for implementation details and code examples.**

---

## Module API

### `McpModule.forRoot`

Registers the MCP Server globally in your NestJS application.

**Parameters:**

- `options: McpModuleOptions` — Main server configuration object:
  - `name: string`: The name of your MCP server.
  - `version: string`: The version of your MCP server.
  - `instructions?: string`: Optional description of the MCP server for the client.
  - `capabilities?: Record<string, unknown>`: Optional additional capabilities metadata.
  - `providers?: Provider[]`: Optional array of NestJS providers to include in the module.
  - `imports?: any[]`: Optional array of NestJS modules to import.
  - `logging?: McpLoggingOptions`: Optional logging configuration:
    - `enabled?: boolean` (default: `true`): Enable/disable logging.
    - `level?: 'error' | 'warn' | 'log' | 'debug' | 'verbose'` (default: `'verbose'`): Set the logging level.
  - `transports?: McpModuleTransportOptions`: Optional transport configuration (see [Transport Options](#transport-options)).
  - `protocolOptions?: Record<string, unknown>`: Optional parameters passed directly to the underlying `@modelcontextprotocol/sdk` server instance.

**Returns:**

- A dynamic NestJS module with all MCP providers registered.

**Example:**

```ts
import { Module } from '@nestjs/common';
import { McpModule } from '@nestjs-mcp/server';

@Module({
  imports: [
    McpModule.forRoot({
      name: 'My Server',
      version: '1.0.0',
      instructions: 'A server providing utility tools and data.',
      logging: { level: 'log' },
      transport: { legacy: 'reject' }, // Modern-era clients only
      // ...other MCP options
    }),
  ],
})
export class AppModule {}
```

### `McpModule.forRootAsync`

Registers the MCP Server globally using asynchronous options, useful for integrating with configuration modules like `@nestjs/config`.

> **Note:**
>
> - The `imports` array should include any modules that provide dependencies required by your `useFactory` (e.g., `ConfigModule` if you inject `ConfigService`).
> - Use `forRootAsync` only once in your root module (`AppModule`).
> - See `McpModuleAsyncOptions` for all available options.

**Parameters:**

- `options: McpModuleAsyncOptions` — Asynchronous configuration object:
  - `imports?: any[]`: Optional modules to import before the factory runs.
  - `useFactory: (...args: any[]) => Promise<McpModuleOptions> | McpModuleOptions`: A factory function that returns the `McpModuleOptions`.
  - `inject?: any[]`: Optional providers to inject into the `useFactory`.

**Returns:**

- A dynamic NestJS module.

**Example (with ConfigModule):**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { McpModule } from '@nestjs-mcp/server';

@Module({
  imports: [
    ConfigModule.forRoot(), // Make sure ConfigModule is imported
    McpModule.forRootAsync({
      imports: [ConfigModule], // Import ConfigModule here too
      useFactory: (configService: ConfigService) => ({
        name: configService.get<string>('MCP_SERVER_NAME', 'Default Server'),
        version: configService.get<string>('MCP_SERVER_VERSION', '1.0.0'),
        instructions: configService.get<string>('MCP_SERVER_DESC'),
        logging: {
          level: configService.get('MCP_LOG_LEVEL', 'verbose'),
        },
        // ... other options from configService
      }),
      inject: [ConfigService], // Inject ConfigService into the factory
    }),
  ],
})
export class AppModule {}
```

### `McpModule.forFeature`

Registers additional MCP resources, tools, or prompts within a feature module. Use this to organize large servers into multiple modules. Resolvers containing MCP capabilities must be included in the `providers` array of the feature module.

**Parameters:**

- `options?: McpFeatureOptions` (Currently unused, reserved for future enhancements).

**Returns:**

- A dynamic module.

**Example:**

```ts
// src/status/status.resolver.ts
import { Resolver, Tool } from '@nestjs-mcp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';

@Resolver('status')
export class StatusResolver {
  @Tool({ name: 'health_check' })
  healthCheck(): CallToolResult {
    return { content: [{ type: 'text', text: 'OK' }] };
  }
}

// src/status/status.module.ts
import { Module } from '@nestjs/common';
import { McpModule } from '@nestjs-mcp/server';
import { StatusResolver } from './status.resolver';

@Module({
  imports: [McpModule.forFeature()], // Import forFeature here
  providers: [StatusResolver], // Register your resolver
})
export class StatusModule {}
```

---

## Module Usage

This library provides two main ways to register MCP capabilities in your NestJS application:

### 1. Global Registration with `McpModule.forRoot`

Use `McpModule.forRoot` in your root application module to configure and register the MCP server globally. This is required for every MCP server application.

```ts
import { Module } from '@nestjs/common';
import { McpModule } from '@nestjs-mcp/server';
import { PromptsResolver } from './prompts.resolver';

@Module({
  imports: [
    McpModule.forRoot({
      name: 'My MCP Server',
      version: '1.0.0',
      // ...other MCP options
    }),
  ],
  providers: [PromptsResolver],
})
export class AppModule {}
```

### 2. Feature Module Registration with `McpModule.forFeature`

Use `McpModule.forFeature` in feature modules to register additional resolvers, tools, or resources. This is useful for organizing large servers into multiple modules.

```ts
import { Module } from '@nestjs/common';
import { McpModule } from '@nestjs-mcp/server';

import { ToolsResolver } from './tools.resolver';

@Module({
  imports: [McpModule.forFeature()],
  providers: [ToolsResolver],
})
export class ToolsModule {}
```

- Use `forRoot` or `forRootAsync` **only once** in your root module (`AppModule`).
- Use `forFeature` in any feature module where you define MCP capabilities (`@Resolver` classes).
- Ensure all Resolvers are listed in the `providers` array of their respective modules.

---

## Capabilities

This library provides a set of decorators to define MCP capabilities and apply cross-cutting concerns such as guards. Decorators can be used at both the Resolver (class) level and the method level.

### Resolver Decorator

A Resolver is a class that groups related MCP capabilities. **All** MCP capability methods (`@Prompt`, `@Resource`, `@Tool`) **must** belong to a class decorated with `@Resolver`.

- **No `@Injectable()` Needed:** Resolver classes are automatically treated as providers by the MCP module and **do not** require the `@Injectable()` decorator.
- **Dependency Injection:** Standard NestJS dependency injection works within Resolver constructors.
- **Namespacing:** You can optionally provide a string argument to `@Resolver('my_namespace')` to namespace the capabilities within that resolver.
- **Guards:** Guards can be applied at the class level using `@UseGuards()`.

**Example:**

```ts
import { Resolver, Prompt, Resource, Tool } from '@nestjs-mcp/server';
// Import any services you need to inject
import { SomeService } from '../some.service';

@Resolver('workspace') // No @Injectable()
export class MyResolver {
  // Inject dependencies as usual
  constructor(private readonly someService: SomeService) {}

  @Prompt({ name: 'greet_user' }) // Capabilities must be inside a Resolver
  greetPrompt(/*...args...*/) {
    const greeting = this.someService.getGreeting();
    /* ... */
  }

  @Resource({ name: 'user_profile', uri: 'user://{id}' })
  getUserResource(/*...args...*/) {
    /* ... */
  }

  @Tool({ name: 'calculate_sum' })
  sumTool(/*...args...*/) {
    /* ... */
  }
}
```

You can also apply guards at the resolver level:

```ts
import { UseGuards, Resolver } from '@nestjs-mcp/server';
import { MyGuard } from './guards/my.guard';

@UseGuards(MyGuard) // Applied to all capabilities in this Resolver
@Resolver('secure') // No @Injectable()
export class SecureResolver {
  // All capabilities in this resolver will use MyGuard
}
```

### Prompt Decorator

Decorate methods within a Resolver class to expose them as MCP Prompts. Accepts options compatible with `server.prompt()` from `@modelcontextprotocol/sdk`. **The `name` should use `snake_case`.**

```ts
import { Prompt, Resolver } from '@nestjs-mcp/server';
import { McpContext } from '@nestjs-mcp/server'; // Handler context type
import { z } from 'zod'; // Example if using Zod schema

// Optional: Define schema if needed
// const SummaryArgs = z.object({ topic: z.string() });

@Resolver('prompts') // Must be in a Resolver class
export class MyPrompts {
  @Prompt({
    name: 'generate_summary',
    description: 'Generates a summary for the given text.',
    // argsSchema: SummaryArgs
  })
  generateSummaryPrompt(
    // params: z.infer<typeof SummaryArgs>, // Arguments based on argsSchema (if defined)
    ctx: McpContext, // The request this call arrived on
  ) {
    console.log(`Generating summary for ${ctx.mcpReq.method}`);
    /* ... return CallPromptResult ... */
    return { content: [{ type: 'text', text: 'Summary generated.' }] };
  }
}
```

### Resource Decorator

Decorate methods within a Resolver class to expose them as MCP Resources. Accepts options compatible with `server.resource()` from `@modelcontextprotocol/sdk`. **The `name` should use `snake_case`.**

```ts
import { Resource, Resolver } from '@nestjs-mcp/server';
import { McpContext } from '@nestjs-mcp/server'; // Handler context type
import { URL } from 'url'; // Type for URI resource
import { z } from 'zod'; // Example if using Zod template

// Optional: Define template schema if needed
// const DocQueryTemplate = z.object({ query: z.string() });

@Resolver('data') // Must be in a Resolver class
export class MyResources {
  @Resource({
    name: 'user_profile',
    uri: 'user://profiles/{userId}',
    // metadata: { description: '...' } // Optional
  })
  getUserProfile(
    uri: URL, // First argument is the parsed URI
    // metadata: Record<string, any> // Second argument if is defined
    ctx: McpContext, // The request this call arrived on
  ) {
    const userId = uri.pathname.split('/').pop(); // Example: Extract ID from URI
    console.log(`Fetching profile for ${userId}`);
    /* ... return CallResourceResult ... */
    return { content: [{ type: 'text', text: `Profile data for ${userId}` }] };
  }

  @Resource({
    name: 'document_list',
    template: { type: 'string', description: 'Document content query' }, // Simple template example
    // metadata: { list: true } // Optional
  })
  findDocuments(
    uri: URL, // First arg based on simple template type
    variables: Record<string, string>, // Second arg is path params (if any)
    ctx: McpContext, // The request this call arrived on
  ) {
    console.log(`Finding documents matching '${query}'`);
    /* ... return CallResourceResult ... */
    return { content: [{ type: 'text', text: 'List of documents.' }] };
  }
}
```

### Tool Decorator

Decorate methods within a Resolver class to expose them as MCP Tools. Accepts options compatible with `server.tool()` from `@modelcontextprotocol/sdk`. **The `name` should use `snake_case`.**

```ts
import { Tool, Resolver } from '@nestjs-mcp/server';
import { McpContext } from '@nestjs-mcp/server';
import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';

@Resolver('user_tools')
export class UserToolsResolver {
  @Tool({
    name: 'delete_user',
    description: 'Deletes a user by ID',
    paramsSchema: z.object({ userId: z.string() }),
    annotations: { destructiveHint: true, readOnlyHint: false },
  })
  deleteUser({ userId }: { userId: string }, ctx: McpContext): CallToolResult {
    // ...logic...
    return { content: [{ type: 'text', text: `User ${userId} deleted.` }] };
  }
}
```

#### Tool Annotations

The `annotations` field allows you to provide protocol-level hints about the tool's behavior, such as whether it is destructive, read-only, idempotent, or has other special properties. These hints can be used by clients, UIs, or the protocol itself to display warnings, optimize calls, or enforce policies.

**Common annotation keys:**

- `destructiveHint` (boolean): Indicates the tool performs a destructive action (e.g., deletes data).
- `readOnlyHint` (boolean): Indicates the tool does not modify any data.
- `idempotentHint` (boolean): Indicates the tool can be safely called multiple times with the same effect.
- `openWorldHint` (boolean): Indicates the tool may have side effects outside the current system.

**Example:**

```ts
@Tool({
  name: 'reset_password',
  paramsSchema: z.object({ userId: z.string() }),
  annotations: { destructiveHint: true, idempotentHint: false }
})
resetPassword({ userId }: { userId: string }): CallToolResult {
  // ...
}
```

#### ToolOptions Variants

| Variant                                          | Required Fields                              |
| ------------------------------------------------ | -------------------------------------------- |
| ToolBaseOptions                                  | name                                         |
| ToolWithDescriptionOptions                       | name, description                            |
| ToolWithParamOrAnnotationsOptions                | name, paramsSchemaOrAnnotations              |
| ToolWithParamOrAnnotationsAndDescriptionOptions  | name, paramsSchemaOrAnnotations, description |
| ToolWithParamAndAnnotationsOptions               | name, paramsSchema, annotations              |
| ToolWithParamAndAnnotationsAndDescriptionOptions | name, paramsSchema, annotations, description |

- `paramsSchema` and `paramsSchemaOrAnnotations` can be a Zod schema for input validation.
- `annotations` is an object with protocol-level hints as described above.

### McpContext Argument

All MCP capability methods (`@Prompt`, `@Resource`, `@Tool`) receive an
`McpContext` object as their last parameter. It extends the SDK's own
`ServerContext` with the Express request the call arrived on.

> **Renamed in 2.0.** This was `RequestHandlerExtra`, a type the MCP SDK removed
> in v2. See [Migrating from `1.x` to `2.x`](#migrating-from-1x-to-2x).

**Properties from the SDK:**

- `mcpReq.id` — the JSON-RPC id of this request
- `mcpReq.method` — the method being served, e.g. `tools/call`
- `mcpReq._meta` / `mcpReq.envelope` — request metadata and the 2026-07-28 envelope
- `http.authInfo` — validated access-token information, when auth middleware ran
- `sessionId` — **`undefined` on 2026-07-28 traffic.** Protocol revision
  2026-07-28 retired sessions. It may still be populated for 2025-era clients
  served through the legacy fallback. Never branch on it for authorization.

**Added by @nestjs-mcp/server:**

- `request` — the live Express request for **this** call
- `headers` — shorthand for `request.headers`

**Usage Example:**

```ts
import { McpContext, Resolver, Tool } from '@nestjs-mcp/server';
import { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';

@Resolver('auth')
export class AuthResolver {
  @Tool({
    name: 'authenticate_user',
    description: 'Authenticates a user with credentials',
    paramsSchema: z.object({ username: z.string(), password: z.string() }),
  })
  authenticateUser(
    params: { username: string; password: string },
    ctx: McpContext, // Always the last parameter
  ): CallToolResult {
    // Headers of THIS call, not of the connection handshake
    const authHeader = ctx.headers.authorization;
    const userAgent = ctx.headers['user-agent'];
    console.log(`Serving ${ctx.mcpReq.method} for: ${String(userAgent)}`);

    // Anything Nest middleware attached upstream is reachable too
    console.log(ctx.request.ip);

    return {
      content: [{ type: 'text', text: 'Authentication successful' }],
    };
  }
}
```

**Important Notes:**

- `ctx` is always the last parameter in any method decorated with `@Resource`,
  `@Prompt`, or `@Tool`
- **`headers` changed meaning in 2.0.** Before 2.0 they were the headers of the
  request that opened the _connection_ — the `initialize` POST — frozen for its
  lifetime. They are now this call's own headers, so credentials that expire or
  are revoked mid-conversation are seen correctly. Code that compiled against
  1.x keeps compiling and starts receiving a different (correct) value.
- `ctx` is **not JSON-serializable**: `request` is an Express object with
  circular references, so `JSON.stringify(ctx)` throws. Read the fields you need.

---

## Dynamic Capabilities

`@Tool`, `@Prompt` and `@Resource` all accept an optional `enabled` option that decides, **per request**, whether that capability is advertised and invocable.

```ts
type McpCapabilityToggle = boolean | Type<McpCapabilityGate>;

interface McpCapabilityGate {
  isEnabled(context: McpRegistrationContext): boolean | Promise<boolean>;
}

interface McpRegistrationContext {
  /** The HTTP request whose capability set is being assembled. */
  request: Request; // express
  /** Validated token info, if auth middleware populated `req.auth`. */
  authInfo?: AuthInfo; // @modelcontextprotocol/sdk/server/auth/types
}
```

Two forms, one option key. Omitting `enabled` is the default and behaves exactly as it did before the option existed: always registered, always enabled, and it costs the request nothing.

### Static toggle

For a capability that is simply off. It needs no class, no provider and no `await`.

```ts
@Tool({
  name: 'legacy_tool',
  description: 'Kept for compatibility, not offered to clients',
  enabled: false,
})
legacyTool(): CallToolResult {
  /* ... */
}
```

### Capability gate

For a decision the server has to make. A gate is a **class**, resolved from the Nest container exactly as a guard is — so it can inject services — and its verdict is **awaited**, so it can do real asynchronous work.

```ts
import { Injectable } from '@nestjs/common';
import {
  McpCapabilityGate,
  McpRegistrationContext,
  Resolver,
  Tool,
} from '@nestjs-mcp/server';

@Injectable()
export class AdminGate implements McpCapabilityGate {
  constructor(private readonly permissions: PermissionsService) {}

  // `authInfo` may be undefined — always optional-chain it.
  async isEnabled(context: McpRegistrationContext): Promise<boolean> {
    if (context.request.headers['x-role'] === 'admin') return true;

    return this.permissions.isAdmin(context.authInfo?.clientId);
  }
}

@Resolver('admin')
export class AdminResolver {
  @Tool({
    name: 'rotate_keys',
    description: 'Only advertised to admin connections',
    enabled: AdminGate,
  })
  rotateKeys(): CallToolResult {
    /* ... */
  }
}
```

Register the gate as a provider in the module that owns the resolver:

```ts
@Module({
  imports: [McpModule.forRoot({ name: 'admin', version: '1.0.0' })],
  providers: [PermissionsService, AdminGate, AdminResolver],
})
export class AppModule {}
```

Pass the **class**, never an instance — an instance built at module scope cannot reach the container, which is the whole reason the gate is a class. A gate may also answer synchronously (`isEnabled(): boolean`) when the check is a cheap in-memory one; `boolean | Promise<boolean>` covers both.

Note that `McpRegistrationContext` carries **no `sessionId`**, deliberately. It exists under SSE at registration time but not under streamable HTTP, where the transport assigns it while handling the `initialize` POST — after registration has already run. Exposing it would make the same gate behave differently per transport.

### What the client sees

A disabled capability is **registered and then disabled**, never skipped. It is therefore absent from `tools/list` / `prompts/list` / `resources/list`, and invoking it answers `Tool <name> disabled` rather than `Tool <name> not found` — the two are distinct in the SDK and the first is the correct answer for a capability that exists but is off for you.

### Fail-closed, in five cases

A gate that cannot answer never leaves a capability exposed:

| Case                                                  | Result                                                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isEnabled` throws synchronously                      | disabled, error logged                                                                                                                                              |
| `isEnabled` returns a **rejecting** promise           | disabled, error logged                                                                                                                                              |
| the gate class cannot be resolved from the container  | disabled, error logged — it is **never** silently built with `new`, because such a gate has `undefined` dependencies and could answer something accidentally truthy |
| a gate is declared but no registration context exists | disabled, error logged                                                                                                                                              |
| `disable()` itself throws                             | the capability **remains enabled**, and the log says so — the one residual fail-open, because there is no other way to disable                                      |

A failing gate never affects the capabilities beside it, and never turns the request into a 500. Log lines name the capability and the failure only — never the request, its headers, or a token.

### Rules you must know before using this

- **Evaluated once per request.** A fresh MCP server is built for every HTTP request — that is what makes the server stateless — and `enabled` is resolved while it is being populated. Changing whatever the gate reads takes effect on the client's very next call; no reconnect is needed. (Before 2.0 the verdict was frozen for the life of a connection.)
- **No `listChanged` notification is emitted.** Every toggle is applied before the server is connected to its transport, where the SDK gates notification dispatch. This library never sends `notifications/tools/list_changed` or its prompt/resource equivalents. Do not expect a connected client to be told that something changed — nothing changes mid-session.
- **Keep gates cheap — they are on the request path.** Every `tools/list` and every `tools/call` settles every gate before the client is served, so a gate that queries a database is a per-request database query. This is the most important behavioural change in 2.0 for anyone already using the option. The library bounds what it can: registration stays synchronous, all gates settle in **one concurrency wave** (the added latency is the slowest single gate, not the sum), and each distinct gate class is both resolved from the container and _asked_ **once per request** however many capabilities share it. What it cannot bound is the gate itself — do your caching in the injected service, at provider scope. There is **no built-in timeout**: a gate that never settles leaves the request unanswered.
- **A gate with no registration context fails closed.** Both built-in transports always pass a context. If you call `RegistryService.registerAll(server)` yourself with a single argument, any capability declaring a _gate_ is disabled and the reason is logged. Static `true` / `false` and capabilities with no `enabled` option are unaffected.
- **`authInfo` may be `undefined`.** It is only populated when auth middleware (for example the SDK's `requireBearerAuth`) ran before the MCP controller. Write `context.authInfo?.scopes` — a gate that dereferences it unguarded throws, and then fails closed, which silently removes the capability.
- **Request-scoped gate providers are not supported.** A gate is resolved with `moduleRef.get(..., { strict: false })`, falling back to `moduleRef.create`. Neither handles a request-scoped provider cleanly. Use a singleton gate that reads what it needs from the registration context.

### This is not a replacement for guards

`enabled` is **discovery-level defence-in-depth**, not the authorization mechanism. [Guards](#guards) are: they run on every capability invocation, against that invocation's own context.

The reason changed in 2.0, and the conclusion survives it. Before 2.0 the argument was mechanical: the registration context was built from the `initialize` POST and nothing else, so later calls were never re-examined. That is no longer true — a gate now sees each call's own request and `req.auth`. What remains is the difference in _kind_: a gate omits a capability from a listing, while a guard refuses an invocation. Omission is not refusal. A client that already knows a tool's name can call it without ever reading the list, and only a guard stops that.

This is the same line the MCP SDK draws for its own per-request factory: the HTTP layer verifies the bearer token, while per-tool checks live in the handler, because _"the handler is the authoritative source for the executing tool."_

Use `enabled` to decide what a caller should even see; use a guard to decide whether a call is allowed. Both now see the same request, so a predicate can be factored between them — but hiding a capability is not enforcement: a client that already knows the tool name can still call it, and only a guard stops that.

### If you call `RegistryService` directly

`RegistryService.registerAll` is `async` and its second argument — the
registration context — is **required**:

```ts
await registry.registerAll(server, { request, era: 'modern' });
```

Only code that drives the registry itself is affected; using `McpModule`
normally is not. See [Migrating from `1.x` to `2.x`](#migrating-from-1x-to-2x)
for the full 2.0 change list.

> A runnable example lives in [`examples/dynamic/`](./examples/dynamic/) — `EXAMPLE=dynamic pnpm start:example`.

---

## Guards

Apply one or more guards to a Resolver, to individual methods, or globally. Guards must implement the NestJS `CanActivate` interface.

### Global-level guards

This approach uses the standard NestJS global guard system (`APP_GUARD`). A global guard will protect **all** NestJS routes, including the MCP endpoint (`/mcp`). Use this for broad authentication or checks that apply before any MCP-specific logic runs.

```ts
// src/guards/global-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class GlobalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'];
    // Example: Check for a valid API key
    return !!apiKey && apiKey === 'EXPECTED_KEY';
  }
}
```

Register the guard globally in your main module:

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { McpModule } from '@nestjs-mcp/server';
import { GlobalAuthGuard } from './guards/global-auth.guard';

@Module({
  imports: [McpModule.forRoot(/*...*/)],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GlobalAuthGuard,
    },
  ],
})
export class AppModule {}
```

### Resolver-level guards

This is a custom feature of this library. Resolver-level guards are applied using the `@UseGuards()` decorator (exported from `@nestjs-mcp/server`) on a Resolver class. All MCP methods (`@Prompt`, `@Resource`, `@Tool`) **within that specific resolver** will be protected by these guards. Use this to enforce logic (e.g., role checks) for a group of related capabilities.

```ts
import { UseGuards, Resolver, Prompt } from '@nestjs-mcp/server';
import { RoleGuard } from './guards/role.guard';

@UseGuards(RoleGuard)
@Resolver('admin')
export class AdminResolver {
  @Prompt({ name: 'admin_action' })
  adminAction(/*...*/) {
    /* ... */
  }
  // ... other admin capabilities
}
```

### Method-level guards

This is a custom feature of this library. Method-level guards are applied using the `@UseGuards()` decorator directly on an MCP capability method (`@Prompt`, `@Resource`, `@Tool`). Only the decorated method will be protected by these guards. Use this for fine-grained access control on specific capabilities.

```ts
import { UseGuards, Resolver, Prompt, Tool } from '@nestjs-mcp/server';
import { SpecificCheckGuard } from './guards/specific-check.guard';

@Resolver('mixed')
export class MixedResolver {
  @Prompt({ name: 'public_prompt' })
  publicPrompt() {
    /* Publicly accessible */
  }

  @UseGuards(SpecificCheckGuard)
  @Tool({ name: 'protected_tool' })
  protectedTool(/*...*/) {
    /* Requires SpecificCheckGuard to pass */
  }
}
```

**Important:** Resolver and Method-level guards **only run for MCP capability invocations**, not for the initial connection establishment handled by global guards. They use the custom `McpExecutionContext`.

### Guard Example

A guard for Resolver or Method-level protection:

```ts
// src/guards/my-mcp.guard.ts
import { CanActivate, Injectable } from '@nestjs/common';
import { McpExecutionContext } from '@nestjs-mcp/server';

@Injectable()
export class MyMcpGuard implements CanActivate {
  canActivate(context: McpExecutionContext): boolean {
    const request = context.getRequest();
    const userAgent = request.headers['user-agent'];

    const handlerArgs = context.getArgs();

    console.log(
      `Guard activated for ${context.getContext().mcpReq.method} from ${String(userAgent)}`,
    );
    console.log('Handler args:', handlerArgs);

    return true;
  }
}
```

### MCP Execution Context

When implementing **Resolver-level** or **Method-level** guards using
`@UseGuards()` from this library, your `canActivate` method receives an
`McpExecutionContext`. It provides access to MCP-specific information:

```typescript
import { CanActivate, Injectable } from '@nestjs/common';
import { McpExecutionContext } from '@nestjs-mcp/server';

@Injectable()
export class McpAuthGuard implements CanActivate {
  canActivate(context: McpExecutionContext): boolean {
    // The request this capability was INVOKED on — not the connection
    // handshake, as it was before 2.0.
    const request = context.getRequest();

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Guard Denied: Missing or invalid Bearer token.');
      return false;
    }

    const token = authHeader.split(' ')[1];
    return token === 'VALID_TOKEN';
  }
}
```

**Key points for `McpExecutionContext`:**

- `getRequest()` — the Express request this capability was invoked on. Since 2.0
  it is the call's own request, so expiring or revoked credentials are seen
  correctly. In 1.x it was the connection handshake, frozen for the connection's
  lifetime.
- `getContext()` — the full `McpContext`: `mcpReq` (id, method, `_meta`,
  envelope) and `http.authInfo`.
- `getArgs()` — the arguments passed to the MCP handler being invoked. Their
  shape depends on the capability type; narrow on the `type` discriminator.
- `getClass()` / `getHandler()` — the resolver class and method.
- `getSessionId()` was **removed in 2.0**. Protocol revision 2026-07-28 retired
  sessions, so there is no id to return and no store to look one up in.
- This is not Nest's `ExecutionContext`: there is no `switchToHttp()`. Use
  `getRequest()` directly.

### Guards with Dependency Injection

Guards can inject NestJS providers. Use `@Injectable()` and register the guard
as a provider:

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: McpExecutionContext): Promise<boolean> {
    const header = context.getRequest().headers.authorization;
    if (!header) return false;

    // Revocation works now: this is the token sent with THIS call.
    return this.tokens.isValid(header.replace('Bearer ', ''));
  }
}

@Module({
  imports: [McpModule.forRoot({ name: 'my-server', version: '1.0.0' })],
  providers: [AuthGuard, TokenService, MyResolver],
})
export class AppModule {}
```

> Guards without `@Injectable()` still work but won't receive injected dependencies.

---

## Statelessness

Since 2.0 this library holds **no state between requests**. There is no session
store, no session id, and no sticky-routing requirement.

The SDK's `createMcpHandler` builds a fresh `McpServer` for **every HTTP
request** from a factory this library supplies. That factory runs
`RegistryService.registerAll` against the request being served, so every
capability handler and every guard closes over that request. Nothing survives
the response.

**What this buys you**

- Run any number of instances behind a plain round-robin load balancer. No
  sticky sessions, no shared session store, no session affinity at the gateway.
- Instances can restart or autoscale mid-conversation without breaking clients.
- Deploy to serverless and edge runtimes that cannot hold a connection open.

This is the resolution of
[#121](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/121), and it
is verified end to end by `test/stateless-load-balancing.e2e-spec.ts`: two
independently constructed Nest applications behind a strict round-robin proxy,
driven by one MCP client, with an assertion that no `Mcp-Session-Id` ever
crosses the wire.

**Reaching request data**

Everything the old `SessionManager` lookup existed to recover is now handed to
you directly, and it describes the _current_ call rather than the connection
handshake:

```ts
// In a capability handler
handler(params: Params, ctx: McpContext) {
  ctx.headers.authorization; // this call's credential
  ctx.request.ip;            // the live Express request
}

// In a guard
canActivate(context: McpExecutionContext) {
  context.getRequest().headers.authorization;
}
```

---

## Transport Options

The library exposes **one** MCP endpoint: `ALL /mcp`.

> **Changed in 2.0.** 1.x served `POST/GET/DELETE /mcp` plus `GET /sse` and
> `POST /messages`, with per-transport `enabled` toggles. The HTTP+SSE transport
> was removed: it is structurally sticky-session — a long-lived `GET /sse` must
> be paired with `POST /messages` on the same instance — which is exactly the
> problem statelessness solves. `GET` and `DELETE` on `/mcp` were the 2025-era
> session operations and now answer `405`.

**Backward compatibility.** 2025-era clients are still served, on the same
endpoint, through the SDK's stateless legacy fallback. Every currently published
MCP client SDK — including `@modelcontextprotocol/sdk@1` and
`@modelcontextprotocol/client@2` — speaks that era, and both are covered by the
e2e suite.

Options are passed straight through to the SDK's `createMcpHandler`:

```ts
McpModule.forRoot({
  name: 'my-server',
  version: '1.0.0',
  transport: {
    // 'stateless' (default) — serve 2025-era clients per request.
    // 'reject'              — modern-only; refuses 2025-era traffic.
    legacy: 'stateless',

    // 'auto' (default) — JSON, upgrading to SSE if the handler streams
    // 'json'           — never stream (drops mid-call notifications)
    // 'sse'            — always stream
    responseMode: 'auto',

    // SSE keepalive interval; 0 disables. Default 15000.
    keepAliveMs: 15000,
  },
});
```

| Option             | Purpose                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `legacy`           | How 2025-era traffic is handled. Default `'stateless'`.                                                |
| `responseMode`     | Response shaping for modern exchanges. Default `'auto'`.                                               |
| `keepAliveMs`      | SSE comment-frame keepalive. Default `15000`.                                                          |
| `maxSubscriptions` | Cap on open `subscriptions/listen` streams. Default `1024`.                                            |
| `bus`              | Change-event bus for `subscriptions/listen`. Swap for Redis to fan out notifications across instances. |

Server-wide protocol options live under `server`, passed verbatim to the SDK:

| `server.*`            | Purpose                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `requestState.verify` | Validates the state an MRTR retry echoes — see [Resuming on a different instance](#resuming-on-a-different-instance)                  |
| `cacheHints`          | `ttlMs` / `cacheScope` for the server's cacheable methods (`tools/list`, `server/discover`, …). Per-resource hints go on `@Resource`. |
| `inputRequired`       | `maxRounds`, `roundTimeoutMs` for MRTR                                                                                                |
| `jsonSchemaValidator` | Swap the JSON Schema validation engine                                                                                                |

> ⚠️ `legacy: 'reject'` refuses every client SDK published today, since none of
> them speak the 2026-07-28 era yet. Choose it only when you control every
> caller and they issue raw requests.

---

## MCP 2026-07-28 features

### Multi Round-Trip Requests (MRTR)

The 2026-07-28 spec replaced server-initiated `elicitation/create` and
`sampling/createMessage` — which required a held-open bidirectional stream, and
therefore a session — with a retry handshake. A handler that needs input returns
`inputRequired(...)`; the client re-sends the same call with the answers
attached, and the handler completes.

```ts
import {
  acceptedContent,
  CallToolResult,
  inputRequired,
  InputRequiredResult,
  McpContext,
  Resolver,
  Tool,
} from '@nestjs-mcp/server';

@Resolver('ops')
export class OpsResolver {
  @Tool({ name: 'deploy', paramsSchema: z.object({ env: z.string() }) })
  deploy(
    params: { env: string },
    ctx: McpContext,
  ): CallToolResult | InputRequiredResult {
    const answer = acceptedContent<{ confirm: boolean }>(
      ctx.mcpReq.inputResponses,
      'confirm',
    );

    if (!answer) {
      return inputRequired({
        inputRequests: {
          confirm: inputRequired.elicit({
            message: `Deploy to ${params.env}?`,
            requestedSchema: {
              type: 'object',
              properties: { confirm: { type: 'boolean' } },
              required: ['confirm'],
            },
          }),
        },
      });
    }

    return { content: [{ type: 'text', text: `deployed to ${params.env}` }] };
  }
}
```

#### Resuming on a different instance

The handler above re-derives everything from its arguments, so any instance can
serve the retry. When the round trip must carry state, seal it into
`requestState` — it round-trips through the client, so it is
**attacker-controlled input** and the SDK applies no integrity protection by
default.

```ts
import { createRequestStateCodec } from '@nestjs-mcp/server';

// The HMAC key must be identical on every instance that might receive the
// echoed value. That shared key is what lets the retry land on another pod.
const codec = createRequestStateCodec<{ item: string }>({
  key: process.env.MCP_STATE_KEY!, // ≥ 32 bytes
});

McpModule.forRoot({
  name: 'shop',
  version: '1.0.0',
  server: { requestState: { verify: (...a) => codec.verify(...a) } },
});
```

```ts
// in the handler
return inputRequired({
  inputRequests: { confirm: inputRequired.elicit({/* … */}) },
  requestState: await codec.mint({ item: params.item }),
});

// on the retry, decoded and verified by whichever instance served it
const state = ctx.mcpReq.requestState<{ item: string }>();
```

Without the `verify` hook the echoed state is accepted unverified. With it, a
tampered value is rejected — both cases are covered in
`test/mcp-features.e2e-spec.ts`.

> The client must **declare** `elicitation: { form: {} }` in its capabilities on
> every request, or the server refuses to ask (`-32021`).

`ctx.mcpReq.elicitInput` and `ctx.mcpReq.requestSampling` still exist but are
deprecated and **throw** on a 2026-07-28 request. MRTR is the only path.

### Structured output and display metadata

```ts
@Tool({
  name: 'measure',
  title: 'Measure Something',              // display name
  paramsSchema: z.object({ subject: z.string() }),
  outputSchema: z.object({ subject: z.string(), value: z.number() }),
  icons: [{ src: 'https://example.com/icon.png', mimeType: 'image/png' }],
  _meta: { 'com.example/category': 'diagnostics' },
})
measure(params: { subject: string }): CallToolResult {
  return {
    content: [{ type: 'text', text: `measured ${params.subject}` }],
    structuredContent: { subject: params.subject, value: 42 },
  };
}
```

`title`, `icons` and `_meta` are also available on `@Prompt`.

### Resource cache hints

```ts
@Resource({
  name: 'catalog',
  uri: 'catalog://items',
  cacheHint: { ttlMs: 60_000, cacheScope: 'public' },
})
```

`ttlMs` and `cacheScope` ride on the `resources/read` result so clients can
cache instead of re-fetching. Resource-only by design: `tools/list` and
`prompts/list` return one result for the whole server, so a per-capability hint
would have nowhere to go — use `server.cacheHints` for those.

### Emitting `list_changed`

Inject `McpHttpService` and publish onto its notifier. This is the first release
in which the library can emit change notifications at all.

```ts
@Injectable()
export class PermissionsService {
  constructor(private readonly mcp: McpHttpService) {}

  onRoleChanged(): void {
    this.mcp.notify.toolsChanged();
  }
}
```

Notifications reach clients holding a `subscriptions/listen` stream. In a
multi-instance deployment, supply `transport.bus` backed by Redis pub/sub so a
change on one instance fans out to subscribers on the others.

---

## Migrating from `1.x` to `2.x`

2.0 adopts MCP specification **2026-07-28**, which retires sessions, and moves
to the MCP SDK's v2 package family. Existing MCP **clients keep working** — they
are served through the SDK's stateless legacy fallback — but the server-side API
changed.

### Install

```bash
# 1.x
pnpm add @nestjs-mcp/server @modelcontextprotocol/sdk

# 2.x — the SDK split into scoped packages; the server package is what you import types from
pnpm add @nestjs-mcp/server @modelcontextprotocol/server
```

### The breaking changes

| 1.x                                  | 2.x                                         | Why                                                                                       |
| ------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `RequestHandlerExtra`                | `McpContext`                                | The SDK removed the type. `ctx.request` is now the live Express request.                  |
| `extra.sessionId`                    | _(gone)_                                    | 2026-07-28 retired sessions. `ctx.sessionId` exists but is `undefined` on modern traffic. |
| `extra.headers`                      | `ctx.headers`                               | **Meaning changed** — see below.                                                          |
| `extra.body` (undocumented)          | `ctx.request.body`                          | Now declared, and from the invoking request.                                              |
| `SessionManager`                     | _(gone)_                                    | No session store. Use `ctx.request` or `context.getRequest()`.                            |
| `McpExecutionContext.getSessionId()` | _(removed)_                                 | Nothing to return. Use `getRequest()` or `getContext()`.                                  |
| `paramsSchema: { a: z.string() }`    | `paramsSchema: z.object({ a: z.string() })` | v2 takes Standard Schema; raw Zod shapes are no longer expressible.                       |
| `argsSchema: { … }`                  | `argsSchema: z.object({ … })`               | Same.                                                                                     |
| `transports: { sse, streamable }`    | `transport: { legacy, responseMode, … }`    | One endpoint; options pass through to `createMcpHandler`.                                 |
| `session: { sessionTimeoutMs, … }`   | _(gone)_                                    | No sessions to time out.                                                                  |
| `GET /sse` + `POST /messages`        | _(removed)_                                 | HTTP+SSE is structurally sticky-session.                                                  |
| `GET` / `DELETE /mcp`                | `405`                                       | These were session operations.                                                            |
| `McpModule.forFeature()`             | still present                               | Unchanged (still a no-op).                                                                |

### The silent one — read this

`extra.headers` compiled in 1.x and compiles in 2.x, but returns something
different.

In 1.x it was the headers of the request that opened the **connection** — the
`initialize` POST, or the `GET /sse` handshake — recovered from the session
store and frozen for the connection's lifetime. In 2.x it is the headers of the
**call being served**.

This is a bug fix, and it is the point of the release: an `Authorization` header
that expires or is revoked mid-conversation is now seen. But if you relied on
connection-scoped values, they no longer persist across calls. Mint an explicit
handle from a tool and have the model pass it back as an argument instead.

### Handler signature

```diff
- import { RequestHandlerExtra, Resolver, Tool } from '@nestjs-mcp/server';
- import { CallToolResult } from '@modelcontextprotocol/sdk/types';
+ import { McpContext, Resolver, Tool } from '@nestjs-mcp/server';
+ import { CallToolResult } from '@modelcontextprotocol/server';

  @Resolver('example')
  export class ExampleResolver {
    @Tool({
      name: 'my_tool',
-     paramsSchema: { id: z.string() },
+     paramsSchema: z.object({ id: z.string() }),
    })
-   myTool(params: { id: string }, extra: RequestHandlerExtra): CallToolResult {
-     const auth = extra.headers.authorization;
+   myTool(params: { id: string }, ctx: McpContext): CallToolResult {
+     const auth = ctx.headers.authorization;
      return { content: [{ type: 'text', text: params.id }] };
    }
  }
```

### Guards

```diff
  @Injectable()
  export class AuthGuard implements CanActivate {
-   constructor(private readonly sessionManager: SessionManager) {}
-
    canActivate(context: McpExecutionContext): boolean {
-     const session = this.sessionManager.getSession(context.getSessionId());
-     return !!session?.request.headers.authorization;
+     return !!context.getRequest().headers.authorization;
    }
  }
```

### Client compatibility

No client change is required. `legacy: 'stateless'` is the default and serves
2025-era clients on the same `/mcp` endpoint. Set `transport.legacy = 'reject'`
only if you control every caller — no published client SDK speaks the
2026-07-28 era yet.

---

## Inspector Playground

Use the Inspector Playground to interactively test and debug your MCP server endpoints in a browser UI. This tool, powered by [`@modelcontextprotocol/inspector`](https://www.npmjs.com/package/@modelcontextprotocol/inspector), allows you to:

- Explore available resources, tools, and prompts
- Invoke endpoints and view responses in real time
- Validate your server implementation against the MCP specification

To launch the Inspector Playground (make sure your NestJS MCP server is running):

```sh
npx @modelcontextprotocol/inspector
```

It will typically connect to `http://localhost:3000` by default, or you can specify a different target URL.

---

## Examples

The [`examples/`](./examples/) directory contains ready-to-use scenarios demonstrating how to register and expose MCP capabilities.

Each example is self-contained and follows best practices. For advanced usage, see the code and documentation in each example.

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

## Contributions

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines, reporting issues, and pull request rules.

Before contributing, please read our [Code of Conduct](./CODE_OF_CONDUCT.md) to understand the expectations for behavior in our community.
