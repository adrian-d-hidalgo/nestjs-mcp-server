# MCP Server NestJS Module Library <!-- omit in toc -->

[![NPM Version](https://img.shields.io/npm/v/@your-org/nestjs-mcp-server)](https://www.npmjs.com/package/@nestjs-mcp/server)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

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
  - [forFeature](#mcpmoduleforfeature)
  - [Resolver](#resolver)
- [Capabilities](#capabilities)
  - [@Resolver](#resolver-decorator)
  - [@Prompt](#prompt-decorator)
  - [@Resource](#resource-decorator)
  - [@Tool](#tool-decorator)
- [Guards](#guards)
  - [Global-level guards:](#global-guard-guards)
  - [Resolver-level guards:](#resolver-level-guards)
  - [Method-level guards:](#method-level-guards)
  - [Guard Example](#guard-example)
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
import { Injectable } from '@nestjs/common';

import { CallToolResult } from '@modelcontextprotocol/sdk/types';

import { Tool } from '@nestjs-mcp/server';

@Injectable()
export class AppService {
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
  providers: [AppService],
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

Registers the MCP Server globally in your NestJS application. Accepts an options object compatible with the MCP Server specification from `@modelcontextprotocol/sdk`.

**Parameters:**

- `options: McpServerOptions` — Main server configuration (name, version, description, etc.)

**Returns:**

- A dynamic NestJS module with all MCP providers registered

**Example:**

```ts
import { McpModule } from '@nestjs-mcp/server';

@Module({
  imports: [
    McpModule.forRoot({
      name: 'My Server',
      version: '1.0.0',
      // ...other MCP options
    }),
  ],
})
export class AppModule {}
```

### `McpModule.forFeature`

Registers additional MCP resources, tools, or prompts in a feature module. Use this to organize large servers into multiple modules.

**Parameters:**

- `providers: Provider[]` — Array of NestJS providers (resources, tools, prompts)

**Returns:**

- A dynamic module with the specified providers

**Example:**

```ts
import { McpModule } from '@nestjs-mcp/server';

@Module({
  imports: [McpModule.forFeature()],
  providers: [
    /*Your Providers with Mcp Capabilities*/
  ],
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

- Use `forRoot` only once in your root module.
- Use `forFeature` as many times as needed in feature modules.
- All resolvers, tools, and resources must be registered as providers.

---

## Capabilities

This library provides a set of decorators to define MCP capabilities and apply cross-cutting concerns such as guards. Decorators can be used at both the Resolver (class) level and the method level.

### Resolver Decorator

A Resolver is a class that groups related MCP capabilities (such as prompts, resources, and tools) and provides a workspace context for them. Use the `@Resolver` decorator to mark a class as a resolver. Dependency injection is supported, and you can apply guards or other cross-cutting concerns at the class level.

**Example:**

```ts
import { Resolver, Prompt, Resource, Tool } from '@nestjs-mcp/server';

@Resolver('workspace')
export class MyResolver {
  @Prompt({ name: 'greet' })
  greetPrompt() {
    /* ... */
  }

  @Resource({ name: 'user', uri: 'user://{id}' })
  getUserResource() {
    /* ... */
  }

  @Tool({ name: 'sum' })
  sumTool() {
    /* ... */
  }
}
```

You can also apply guards at the resolver level:

```ts
import { UseGuards, Resolver } from '@nestjs-mcp/server';
import { MyGuard } from './guards/my.guard';

@UseGuards(MyGuard)
@Resolver('secure')
export class SecureResolver {
  // ...
}
```

### Prompt Decorator

Decorate methods within a Resolver to expose them as MCP Prompts.

```ts
import { Prompt } from '@nestjs-mcp/server';

@Resolver('workspace')
export class MyResolver {
  @Prompt({ name: 'greet' })
  greetPrompt() {
    /* ... */
  }
}
```

### Resource Decorator

Decorate methods within a Resolver to expose them as MCP Resources.

```ts
import { Resource } from '@nestjs-mcp/server';

@Resolver('workspace')
export class MyResolver {
  @Resource({ name: 'user', uri: 'user://{id}' })
  getUserResource() {
    /* ... */
  }
}
```

### Tool Decorator

Decorate methods within a Resolver to expose them as MCP Tools.

```ts
import { Tool } from '@nestjs-mcp/server';

@Resolver('workspace')
export class MyResolver {
  @Tool({ name: 'sum' })
  sumTool() {
    /* ... */
  }
}
```

---

## Guards

Apply one or more guards to a Resolver, to individual methods, or globally. Guards must implement the NestJS `CanActivate` interface.

### Global-level guards:

This approach uses the standard NestJS global guard system. A global guard will protect all entry points of your MCP server by running before any connection is handled. Use this for authentication, API key checks, or any logic that should apply to every connection.

```ts
// src/guards/global-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class GlobalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Example: Allow all requests (replace with real logic)
    // You can access request info via context.switchToHttp().getRequest() if needed
    return true;
  }
}
```

Register the guard globally in your main module:

```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { McpModule } from '@nestjs-mcp/server';
import { GlobalAuthGuard } from './guards/global-auth.guard';
import { PromptsResolver } from './prompts.resolver';

@Module({
  imports: [
    McpModule.forRoot({
      name: 'My MCP Server',
      version: '1.0.0',
    }),
  ],
  providers: [
    PromptsResolver,
    {
      provide: APP_GUARD,
      useClass: GlobalAuthGuard,
    },
  ],
})
export class AppModule {}
```

**Key points:**

- The guard will run for every request handled by your NestJS application, including all MCP endpoints.
- You can implement any logic in canActivate, such as checking headers, tokens, or user roles.
- This approach is fully compatible with NestJS and your MCP Server module.

### Resolver-level guards:

This is a custom feature of this library. Resolver-level guards are applied using the `@UseGuards` decorator on a Resolver class. All MCP methods (`@Prompt`, `@Resource`, `@Tool`) in the resolver will be protected by these guards. Use this to enforce logic (e.g., role checks) for a specific group of capabilities.

```ts
import { UseGuards, Resolver, Prompt } from '@nestjs-mcp/server';
import { MyGuard } from './guards/my.guard';

@UseGuards(MyGuard)
@Resolver('secure')
export class SecureResolver {
  @Prompt({ name: 'securePrompt' })
  securePrompt() {
    /* ... */
  }
}
```

### Method-level guards:

This is a custom feature of this library. Method-level guards are applied using the `@UseGuards` decorator directly on a method. Only the decorated MCP method will be protected by these guards. Use this for fine-grained access control on specific capabilities.

```ts
import { UseGuards, Resolver, Prompt } from '@nestjs-mcp/server';
import { MyGuard } from './guards/my.guard';

@Resolver('mixed')
export class MixedResolver {
  @Prompt({ name: 'publicPrompt' })
  publicPrompt() {
    /* ... */
  }

  @UseGuards(MyGuard)
  @Prompt({ name: 'protectedPrompt' })
  protectedPrompt() {
    /* ... */
  }
}
```

### Guard Example

```ts
import { CanActivate } from '@nestjs/common';
import { McpExecutionContext } from '@nestjs-mcp/server';

export class MyGuard implements CanActivate {
  canActivate(context: McpExecutionContext): boolean {
    // Custom logic: allow or deny
    return true;
  }
}
```

### Using McpContext in Guards

When implementing guards for MCP resolvers and methods, you can use the `McpExecutionContext` interface to access MCP-specific context information. This interface extends the standard NestJS `ExecutionContext` and provides additional properties specific to MCP operations.

```ts
import { CanActivate } from '@nestjs/common';
import { McpExecutionContext } from '@nestjs-mcp/server';
import { Request, Response } from 'express';

@Injectable()
export class McpAuthGuard implements CanActivate {
  canActivate(context: McpExecutionContext): boolean {
    // Access MCP-specific context
    const { args, message } = context;

    // Access the current message from the request
    if (message) {
      const { req, res } = message;

      // Access Express request and response objects
      const request = req as Request;
      const response = res as Response;

      // Example: Check authorization header
      const authHeader = request.headers.authorization;

      // Implement your authentication logic here
      // For example, check if the authorization header is valid
    }

    // Access the arguments passed to the MCP method
    const methodArgs = args;

    return true; // or false to deny access
  }
}
```

**Key properties of McpExecutionContext:**

- `args`: The arguments passed to the MCP method being guarded
- `message`: The current message from the request, containing:
  - `req`: The Express Request object
  - `res`: The Express Response object
- `getType()`: Returns the type of execution context (always 'mcp' for MCP operations)
- `getClass()`: Returns the class of the resolver
- `getArgs()`: Returns the arguments passed to the method

This context allows you to implement guards that are aware of the MCP protocol and can make decisions based on MCP-specific information, such as checking request headers, query parameters, or other request data.

---

## Inspector Playground

Use the Inspector Playground to interactively test and debug your MCP server endpoints in a browser UI. This tool, powered by [`@modelcontextprotocol/inspector`](https://www.npmjs.com/package/@modelcontextprotocol/inspector), allows you to:

- Explore available resources, tools, and prompts
- Invoke endpoints and view responses in real time
- Validate your server implementation against the MCP specification

To launch the Inspector Playground:

```sh
npx @modelcontextprotocol/inspector
```

---

## Examples

The [`examples/`](./examples/) directory contains ready-to-use scenarios demonstrating how to register and expose MCP capabilities

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
