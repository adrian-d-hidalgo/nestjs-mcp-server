# Examples Directory

This directory contains ready-to-use example MCP servers demonstrating how to use the NestJS MCP Server module and expose different MCP capabilities. Each subfolder is a self-contained NestJS application showing a specific integration pattern.

## Directory Overview

- **mixed/**  
  Demonstrates how to implement and expose multiple MCP capabilities (resources, tools, and prompts) in a single server. Useful for learning how to combine different features in one service.

- **resources/**  
  Shows how to define and register MCP resources using the `@Resource` decorator. Resources are used to expose structured data endpoints to LLMs.

- **tools/**  
  Provides examples of tools implemented with the `@Tool` decorator. Tools allow LLMs to invoke server-side actions or computations, including parameter validation.

- **prompts/**  
  Contains examples of conversational prompts using the `@Prompt` decorator. Prompts enable dynamic, parameterized conversational flows for LLMs.

- **guards/**  
  Shows how to implement and use guards in MCP servers to control access to capabilities and resources. Demonstrates different guard patterns and how to apply them to protect specific MCP features.

- **dynamic/**  
  Shows the `enabled` option, which decides per connection whether a capability is advertised and invocable. Contains a statically disabled tool; `AdminGate`, a gate class with an **injected** `PermissionsService` answering **asynchronously** on the `x-role` request header; a slow gate sharing that same service; and the three fail-closed paths — a gate that throws, a gate whose promise rejects, and a gate class the container cannot resolve. Also gates a prompt and a resource, plus a statically disabled prompt and resource. Connect with `x-role: admin` to see `admin_only_tool`, `admin_only_prompt` and `admin_only_resource` appear in their lists.

- **for-root-async/**  
  Example of asynchronous module configuration of the MCP module using `forRootAsync` and environment variables.

## How to Run Examples

To run any example, set the EXAMPLE environment variable to the folder name and use:

```sh
EXAMPLE=<example-folder> pnpm start:example
```

- Example for the `mixed` example: [mixed/](./mixed/)
  ```sh
  EXAMPLE=mixed pnpm start:example
  ```

> **Windows users:** Use [cross-env](https://www.npmjs.com/package/cross-env):
>
> ```sh
> npx cross-env EXAMPLE=mixed pnpm start:example
> ```

The server will be available at [http://localhost:3000](http://localhost:3000).

## Inspector Playground

You can interactively test and debug these examples using the MCP Inspector Playground:

```sh
pnpm start:inspector
```

---

For more details, see the code and comments in each example folder.
