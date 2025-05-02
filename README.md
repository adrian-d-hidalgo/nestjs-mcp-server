# MCP Server NestJS Module Library <!-- omit in toc -->

[![NPM Version](https://img.shields.io/npm/v/@nestjs-mcp/server)](https://www.npmjs.com/package/@nestjs-mcp/server)
[![Semantic Release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Downloads](https://img.shields.io/npm/dm/@nestjs-mcp/server)](https://www.npmjs.com/package/@nestjs-mcp/server)
[![CI Pipeline](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/actions/workflows/run-tests.yml/badge.svg)](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/actions/workflows/run-tests.yml)
[![codecov](https://codecov.io/gh/adrian-d-hidalgo/nestjs-mcp-server/graph/badge.svg?token=5E228VKY5K)](https://codecov.io/gh/adrian-d-hidalgo/nestjs-mcp-server)
[![Known Vulnerabilities](https://snyk.io/test/github/adrian-d-hidalgo/nestjs-mcp-server/badge.svg)](https://snyk.io/test/github/adrian-d-hidalgo/nestjs-mcp-server)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

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
- [Guards](#guards)
  - [Global-level guards](#global-level-guards)
  - [Resolver-level guards](#resolver-level-guards)
  - [Method-level guards](#method-level-guards)
  - [Guard Example](#guard-example)
  - [MCP Execution Context](#mcp-execution-context)
- [Session Management](#session-management)
- [Transport Options](#transport-options)
- [Inspector Playground](#inspector-playground)
- [Examples](#examples)
- [Changelog](#changelog)
- [License](#license)
- [Contributions](#contributions)

---

## Installation

```sh
pnpm add @your-org/nestjs-mcp-server @modelcontextprotocol/sdk
# or
npm install @your-org/nestjs-mcp-server @modelcontextprotocol/sdk
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
      transports: { sse: { enabled: false } }, // Disable SSE transport
      // ...other MCP options
    }),
  ],
})
export class AppModule {}
```

### `McpModule.forRootAsync`

Registers the MCP Server globally using asynchronous options, useful for integrating with configuration modules like `@nestjs/config`.

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
import { RequestHandlerExtra } from '@nestjs-mcp/server'; // Import type for extra info
import { z } from 'zod'; // Example using Zod for schema

// Example Zod schema for parameters
const SumParams = z.object({
  num1: z.number(),
  num2: z.number(),
});

@Resolver('utils') // Must be in a Resolver class
export class MyTools {
  @Tool({
    name: 'calculate_sum',
    description: 'Calculates the sum of two numbers.',
    paramSchema: SumParams, // Use the Zod schema
  })
  sumTool(
    params: z.infer<typeof SumParams>, // First arg is typed parameters from schema
    extra: RequestHandlerExtra, // Contains sessionId and other metadata
  ) {
    console.log(`Calculating sum for session: ${extra.sessionId}`);
    const result = params.num1 + params.num2;
    /* ... return CallToolResult ... */
    return { content: [{ type: 'text', text: `Result: ${result}` }] };
  }
}
```

---

## Guards

Apply one or more guards to a Resolver, to individual methods, or globally. Guards must implement the NestJS `CanActivate` interface.

### Global-level guards

This approach uses the standard NestJS global guard system (`APP_GUARD`). A global guard will protect **all** NestJS routes, including the MCP transport endpoints (like `/mcp` or `/sse`). Use this for broad authentication or checks that apply before any MCP-specific logic runs.

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
import { McpExecutionContext, SessionManager } from '@nestjs-mcp/server';

@Injectable()
export class MyMcpGuard implements CanActivate {
  constructor(private readonly sessionManager: SessionManager) {}

  canActivate(context: McpExecutionContext): boolean {
    const sessionId = context.getSessionId();
    if (!sessionId) return false;

    const handlerArgs = context.getArgs();

    const session = this.sessionManager.getSession(sessionId);
    const request = session?.request;
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
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { McpExecutionContext, SessionManager } from '@nestjs-mcp/server';
import { Request } from 'express';

@Injectable()
export class McpAuthGuard implements CanActivate {
  constructor(private readonly sessionManager: SessionManager) {}

  canActivate(context: McpExecutionContext): boolean {
    const sessionId = context.getSessionId();
    if (!sessionId) {
      console.error('Guard Error: MCP Session ID not found in context.');
      return false;
    }

    const handlerArgs = context.getArgs<any>();
    console.log('MCP Handler Arguments:', handlerArgs);

    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      console.error(`Guard Error: Session not found for ID: ${sessionId}`);
      return false;
    }
    const request = session.request as Request;

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

- `getSessionId()`: Retrieves the unique ID for the current MCP session. **Crucial** for relating the guard check to the session state stored by `SessionManager`.
- Arguments (`handlerArgs`): Provides the arguments passed specifically to the MCP handler method (`@Tool`, `@Prompt`, `@Resource`) being invoked. The structure of these arguments depends on the capability type and its definition (e.g., `params` for tools, `query`/`params` for resources). You access these via `context.getArgs()`, but be mindful of the actual structure based on the capability.
- Request Data: Use the `SessionManager` injected into your guard to fetch the session details (including the original `Request`) based on the `sessionId` obtained from the context.
- `switchToHttp().getResponse()` / `switchToHttp().getNext()`: These will throw errors as the Response object is not directly available or relevant in this context.

Use `SessionManager` injected into your guard to fetch the session details (including the original `Request`) based on the `sessionId` obtained from the context.

---

## Session Management

This library includes a `SessionManager` service responsible for tracking active MCP sessions. Each incoming MCP connection establishes a session, identified by a unique `sessionId`. The `SessionManager` typically stores the associated initial `Request` object for each session.

**Why is it important?**

- **Accessing Request Data:** Since MCP operations (tool calls, prompt executions) might happen independently of the initial HTTP connection (especially with streaming transports like SSE), the `SessionManager` provides a way to retrieve the original `Request` context associated with a specific `sessionId`. This is essential for guards or capability methods (within Resolvers) that need access to request headers, parameters, or other connection-specific details from the original request.
- **State Management:** While currently focused on storing the request, the `SessionManager` could be extended to store additional session-specific state if needed by your application.

**Usage Example (in a Resolver):**

Resolvers might need access to the original request, for example, to get user information or API keys passed in headers during the initial connection.

```typescript
import { Tool, Resolver, SessionManager } from '@nestjs-mcp/server';
import { RequestHandlerExtra } from '@nestjs-mcp/server'; // Provides sessionId
import { Request } from 'express';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { z } from 'zod';

const UserToolParams = z.object({
  user_id: z.string().optional(),
});

@Resolver('user_tools') // No @Injectable() needed
export class UserToolsResolver {
  // Inject SessionManager
  constructor(private readonly sessionManager: SessionManager) {}

  @Tool({
    name: 'get_user_agent',
    description:
      'Gets the user agent from the original request for the session.',
    paramSchema: UserToolParams,
  })
  getUserAgent(
    params: z.infer<typeof UserToolParams>,
    extra: RequestHandlerExtra, // Get extra info, including sessionId
  ): CallToolResult {
    const sessionId = extra.sessionId;
    if (!sessionId) {
      return {
        content: [{ type: 'text', text: 'Error: Session ID missing.' }],
      };
    }

    // Use sessionId to get the session from the manager
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: Session not found for ID: ${sessionId}`,
          },
        ],
      };
    }

    // Access the original request stored in the session
    const request = session.request as Request;
    const userAgent = request.headers['user-agent'] || 'Unknown';

    return {
      content: [
        { type: 'text', text: `Session ${sessionId} User Agent: ${userAgent}` },
      ],
    };
  }
}
```

In this example:

1. The `@Tool` method receives `extra: RequestHandlerExtra`, which contains the `sessionId`.
2. The `SessionManager` is injected into the `UserToolsResolver`.
3. The `sessionId` is used with `sessionManager.getSession()` to retrieve the session data.
4. The original `request` object is accessed from the retrieved session data.

The `SessionManager` is automatically registered as a provider when you use `McpModule.forRoot` or `McpModule.forRootAsync` and can be injected like any other NestJS provider.

---

## Transport Options

The MCP server can communicate over different transport mechanisms. This library includes built-in support for:

1.  **Streamable (`/mcp` endpoint):** A common transport using standard HTTP POST requests and responses. Suitable for most request/response interactions. Enabled by default.
2.  **SSE (Server-Sent Events) (`/sse` endpoint):** A transport mechanism allowing the server to push updates to the client over a single HTTP connection. Useful for streaming responses or long-running operations. **Note:** This is considered a legacy transport but remains supported for compatibility. Enabled by default.

You can configure which transports are enabled globally using the `transports` option in `McpModule.forRoot` or `McpModule.forRootAsync`.

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
        streamable: { enabled: true }, // Keep streamable enabled (default)
        sse: { enabled: false }, // Disable legacy SSE transport
      },
    }),
  ],
})
export class AppModule {}
```

**Default Configuration:**

If the `transports` option is omitted, both `streamable` (`/mcp`) and `sse` (`/sse`) are enabled by default.

```typescript
import { Module } from '@nestjs/common';
import { McpModule } from '@nestjs-mcp/server';

@Module({
  imports: [
    McpModule.forRoot({
      name: 'My Server',
      version: '1.0.0',
      // Both streamable and sse will be enabled
    }),
  ],
})
export class AppModule {}
```

Disabling unused transports can slightly reduce the application's surface area and resource usage.

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
