# MCP Server NestJS Module Library <!-- omit in toc -->

This repository is a fork of https://github.com/adrian-d-hidalgo/nestjs-mcp-server.
Changes in this fork:

- multi-instance support - removed session-manager and sessions
- removed sse transport

[![NPM Version](https://img.shields.io/npm/v/@nestjs-mcp/server)](https://www.npmjs.com/package/@nestjs-mcp/server)
[![Semantic Release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Downloads](https://img.shields.io/npm/dm/@nestjs-mcp/server)](https://www.npmjs.com/package/@nestjs-mcp/server)
[![CI Pipeline](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/actions/workflows/run-tests.yml/badge.svg)](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/actions/workflows/run-tests.yml)
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

- [Overview](#overview)
- [Installation](#installation)
- [Quickstart](#quickstart)
- [What is MCP?](#what-is-mcp)
- [Core Concepts](#core-concepts)
  - [Server](#server)
  - [Resource](#resource)
  - [Tool](#tool)
  - [Prompt](#prompt)
- [Module API](#module-api)
  - [forRoot](#mcpmoduleforroot)
  - [forRootAsync](#mcpmoduleforrootasync)
  - [forFeature](#mcpmoduleforfeature)
- [Module Usage](#module-usage)
  - [1. Global Registration with `McpModule.forRoot`](#1-global-registration-with-mcpmoduleforroot)
  - [2. Feature Module Registration with `McpModule.forFeature`](#2-feature-module-registration-with-mcpmoduleforfeature)
- [Capabilities](#capabilities)
  - [Resolver Decorator](#resolver-decorator)
  - [Prompt Decorator](#prompt-decorator)
  - [Resource Decorator](#resource-decorator)
  - [Tool Decorator](#tool-decorator)
  - [RequestHandlerExtra Parameter](#requesthandlerextra-argument)
- [Guards](#guards)
  - [Global-level guards](#global-level-guards)
  - [Resolver-level guards](#resolver-level-guards)
  - [Method-level guards](#method-level-guards)
  - [Guard Example](#guard-example)
  - [MCP Execution Context](#mcp-execution-context)
- [Stateless Architecture](#stateless-architecture)
- [Transport Options](#transport-options)
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
import { RequestHandlerExtra } from '@nestjs-mcp/server'; // Import type for extra info
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
    extra: RequestHandlerExtra, // Contains sessionId and other metadata
  ) {
    console.log(`Generating summary for session: ${extra.sessionId}`);
    /* ... return CallPromptResult ... */
    return { content: [{ type: 'text', text: 'Summary generated.' }] };
  }
}
```

### Resource Decorator

Decorate methods within a Resolver class to expose them as MCP Resources. Accepts options compatible with `server.resource()` from `@modelcontextprotocol/sdk`. **The `name` should use `snake_case`.**

```ts
import { Resource, Resolver } from '@nestjs-mcp/server';
import { RequestHandlerExtra } from '@nestjs-mcp/server'; // Import type for extra info
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
    extra: RequestHandlerExtra, // Contains sessionId and other metadata
  ) {
    const userId = uri.pathname.split('/').pop(); // Example: Extract ID from URI
    console.log(`Fetching profile for ${userId}, session: ${extra.sessionId}`);
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
    extra: RequestHandlerExtra, // Contains sessionId and other metadata
  ) {
    console.log(
      `Finding documents matching '${query}', session: ${extra.sessionId}`,
    );
    /* ... return CallResourceResult ... */
    return { content: [{ type: 'text', text: 'List of documents.' }] };
  }
}
```

### Tool Decorator

Decorate methods within a Resolver class to expose them as MCP Tools. Accepts options compatible with `server.tool()` from `@modelcontextprotocol/sdk`. **The `name` should use `snake_case`.**

```ts
import { Tool, Resolver } from '@nestjs-mcp/server';
import { RequestHandlerExtra } from '@nestjs-mcp/server';
import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';

@Resolver('user_tools')
export class UserToolsResolver {
  @Tool({
    name: 'delete_user',
    description: 'Deletes a user by ID',
    paramsSchema: { userId: z.string() },
    annotations: { destructiveHint: true, readOnlyHint: false },
  })
  deleteUser(
    { userId }: { userId: string },
    extra: RequestHandlerExtra,
  ): CallToolResult {
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
  paramsSchema: { userId: z.string() },
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

### RequestHandlerExtra Argument

All MCP capability methods (`@Prompt`, `@Resource`, `@Tool`) always receive a `RequestHandlerExtra` object as their last parameter. This object extends the original type from `@modelcontextprotocol/sdk` and provides essential context about the current MCP request.

**Properties from SDK:**

- `signal`: An `AbortSignal` used to communicate if the request was cancelled
- `authInfo`: Optional information about a validated access token
- `sessionId`: The session ID from the transport, if available (may be undefined in stateless mode)
- `sendNotification`: Function to send a notification related to the current request
- `sendRequest`: Function to send a request related to the current request

**Extended Properties:**

- `request`: Express Request object providing access to headers, body, query params, IP, etc. (added by @nestjs-mcp/server)

**Usage Example:**

```ts
import { Tool, Resolver } from '@nestjs-mcp/server';
import { RequestHandlerExtra } from '@nestjs-mcp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';

@Resolver('auth')
export class AuthResolver {
  @Tool({
    name: 'authenticate_user',
    description: 'Authenticates a user with credentials',
    // ...other options
  })
  authenticateUser(
    params: { username: string; password: string },
    extra: RequestHandlerExtra, // Always the last parameter
  ): CallToolResult {
    // Access request headers
    const authHeader = extra.request.headers.authorization;
    const userAgent = extra.request.headers['user-agent'];
    const clientIp = extra.request.ip;

    console.log(`Request from: ${userAgent} (${clientIp})`);

    // Access request body
    const requestBody = extra.request.body;

    // Check if request was cancelled
    if (extra.signal.aborted) {
      return {
        content: [{ type: 'text', text: 'Request was cancelled' }],
      };
    }

    // Implement authentication logic
    return {
      content: [{ type: 'text', text: 'Authentication successful' }],
    };
  }
}
```

**Available Request Properties:**

The `extra.request` object is a standard Express Request with access to:

- `headers` - HTTP headers
- `body` - Request body (parsed by body-parser middleware)
- `query` - Query string parameters
- `params` - Route parameters
- `ip` - Client IP address
- `method` - HTTP method (GET, POST, etc.)
- `url` - Request URL
- `cookies` - Cookies (if cookie-parser middleware is used)
- And all other Express Request properties

**Important Notes:**

- `extra` is always the last parameter in any method decorated with `@Resource`, `@Prompt`, or `@Tool`
- The `request` property provides direct access to the Express Request object

---

## Guards

Apply one or more guards to a Resolver, to individual methods, or globally. Guards must implement the NestJS `CanActivate` interface.

### Global-level guards

This approach uses the standard NestJS global guard system (`APP_GUARD`). A global guard will protect **all** NestJS routes, including the MCP transport endpoint (`/mcp`). Use this for broad authentication or checks that apply before any MCP-specific logic runs.

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
    const sessionId = context.getSessionId();
    const handlerArgs = context.getArgs();
    const request = context.switchToHttp().getRequest();
    const userAgent = request?.headers['user-agent'];

    console.log(`Guard activated for session ${sessionId} from ${userAgent}`);
    console.log('Handler args:', handlerArgs);

    return true;
  }
}
```

### MCP Execution Context

When implementing **Resolver-level** or **Method-level** guards using `@UseGuards()` from this library, your `canActivate` method receives an `McpExecutionContext` instance. This context provides access to MCP-specific information:

```typescript
import { CanActivate, Injectable } from '@nestjs/common';
import { McpExecutionContext } from '@nestjs-mcp/server';
import { Request } from 'express';

@Injectable()
export class McpAuthGuard implements CanActivate {
  canActivate(context: McpExecutionContext): boolean {
    const sessionId = context.getSessionId();
    const handlerArgs = context.getArgs<any>();
    const request = context.switchToHttp().getRequest<Request>();

    console.log('MCP Handler Arguments:', handlerArgs);
    console.log('Session ID:', sessionId);

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Guard Denied: Missing or invalid Bearer token.');
      return false;
    }

    const token = authHeader.split(' ')[1];
    const isValidToken = token === 'VALID_TOKEN';

    if (isValidToken) {
      console.log(`Guard Passed for session ${sessionId} with token.`);
      return true;
    } else {
      console.log(`Guard Denied: Invalid token for session ${sessionId}.`);
      return false;
    }
  }
}
```

**Key points for `McpExecutionContext`:**

- `getSessionId()`: Retrieves the unique ID for the current MCP session (may be undefined in stateless mode)
- `getArgs()`: Provides the arguments passed to the MCP handler method (`@Tool`, `@Prompt`, `@Resource`)
- `switchToHttp().getRequest()`: Returns the Express Request object with access to headers, body, query params, etc.
- `switchToHttp().getResponse()` / `switchToHttp().getNext()`: These will throw errors as the Response object is not directly available in this context

---

## Stateless Architecture

This library implements a **stateless** approach following the recommended "Without Session Management" pattern from `@modelcontextprotocol/sdk`. Each request is handled independently without maintaining session state between requests.

### How It Works

1. **Request Flow:**

   - Client sends POST request to `/mcp`
   - Server creates a new transport for each request with `sessionIdGenerator: undefined`
   - Request is processed and transport is closed when response completes

2. **Request Context:**
   - The original Express Request is made available via `AsyncLocalStorage`
   - Guards and handlers can access request data through `extra.request`
   - No session state is maintained between requests

### Benefits

- **Simpler Architecture**: No session state to manage
- **Better Scalability**: Each request is independent
- **SDK Compliance**: Follows recommended approach from `@modelcontextprotocol/sdk`
- **Reduced Memory Usage**: No session storage overhead
- **Easier Debugging**: No cross-request state issues

### Accessing Request Data

All MCP handlers receive the Express Request object in the `extra` parameter:

```typescript
@Tool({ name: 'my_tool' })
myTool(params: any, extra: RequestHandlerExtra): CallToolResult {
  // Access headers
  const authHeader = extra.request.headers.authorization;

  // Access body
  const body = extra.request.body;

  // Access IP
  const clientIp = extra.request.ip;

  // ... use request data
}
```

Guards can also access the request through the execution context:

```typescript
@Injectable()
export class MyGuard implements CanActivate {
  canActivate(context: McpExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'];
    return !!apiKey;
  }
}
```

---

## Transport Options

The MCP server communicates over HTTP using the Streamable transport mechanism. This transport uses standard HTTP POST requests and responses, suitable for most request/response interactions.

**Configuration:**

```typescript
import { Module } from '@nestjs/common';
import { McpModule } from '@nestjs-mcp/server';

@Module({
  imports: [
    McpModule.forRoot({
      name: 'My Server',
      version: '1.0.0',
      transports: {
        streamable: { enabled: true }, // Streamable is enabled by default
      },
    }),
  ],
})
export class AppModule {}
```

**Default Configuration:**

If the `transports` option is omitted, the streamable transport (`/mcp` endpoint) is enabled by default.

```typescript
import { Module } from '@nestjs/common';
import { McpModule } from '@nestjs-mcp/server';

@Module({
  imports: [
    McpModule.forRoot({
      name: 'My Server',
      version: '1.0.0',
      // Streamable transport is enabled by default
    }),
  ],
})
export class AppModule {}
```

The server will be accessible at the `/mcp` endpoint for all MCP client requests.

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
