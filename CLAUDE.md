# CLAUDE.md

## Project Identity

**@nestjs-mcp/server** - NestJS wrapper library for `@modelcontextprotocol/sdk`

**Purpose**: Provide decorators (`@Tool`, `@Prompt`, `@Resource`, `@Resolver`) and module patterns (`McpModule.forRoot/forRootAsync/forFeature`) to build MCP servers in NestJS.

**Critical Principle**: This wraps the official SDK - always check SDK types before defining new ones. Reuse SDK types (`CallToolResult`, `RequestHandlerExtra`, etc.) from `@modelcontextprotocol/sdk/types`.

## Quick Reference

| Action | Command |
|--------|---------|
| Install | `pnpm install` |
| Build | `pnpm build` |
| Test | `pnpm test` |
| Lint + Format + Types | `pnpm quality:check` |
| Fix lint/format | `pnpm quality:fix` |
| Run example | `EXAMPLE=tools pnpm start:example` |
| MCP Inspector | `pnpm start:inspector` |

## Key Files

| File | Purpose |
|------|---------|
| [src/mcp.module.ts](src/mcp.module.ts) | Public API: `forRoot()`, `forRootAsync()`, `forFeature()` |
| [src/mcp.types.ts](src/mcp.types.ts) | Module options and type definitions |
| [src/decorators/](src/decorators/) | `@Resolver`, `@Tool`, `@Prompt`, `@Resource`, `@UseGuards` |
| [src/services/registry.service.ts](src/services/registry.service.ts) | Registers capabilities with McpServer |
| [src/services/discovery.service.ts](src/services/discovery.service.ts) | Discovers decorated methods via reflection |
| [src/services/session.manager.ts](src/services/session.manager.ts) | Tracks active MCP sessions |
| [src/transports/](src/transports/) | HTTP transports: `streamable/` (POST), `sse/` (legacy) |
| [examples/](examples/) | Working examples: tools, resources, prompts, guards, mixed |

## Architecture

```
McpModule.forRoot() → DiscoveryService finds @Resolver classes
                   → RegistryService wraps handlers + guards
                   → Registers with SDK McpServer
                   → Transports expose /mcp (streamable) or /sse endpoints
```

### Core Patterns

1. **Resolver classes**: Must use `@Resolver()` decorator (NOT `@Injectable()`)
2. **Handler signature**: `(params?, extra: RequestHandlerExtra) => Result`
3. **Guard scopes**:
   - Global (`APP_GUARD`): Standard NestJS `ExecutionContext`
   - Method (`@UseGuards`): Custom `McpExecutionContext`

### Example Resolver

```typescript
import { Resolver, Tool, RequestHandlerExtra } from '@nestjs-mcp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { z } from 'zod';

const Params = z.object({ id: z.string() });

@Resolver('namespace')
export class MyResolver {
  @Tool({ name: 'my_tool', description: 'Does X', paramsSchema: Params })
  myTool(params: z.infer<typeof Params>, extra: RequestHandlerExtra): CallToolResult {
    return { content: [{ type: 'text', text: `Result for ${params.id}` }] };
  }
}
```

## Conventions

| Aspect | Convention |
|--------|------------|
| Files | `kebab-case.ts` |
| Classes | `PascalCase` |
| Methods | `camelCase` |
| MCP names | `snake_case` (`@Tool({ name: 'my_tool' })`) |
| Schemas | Zod (mandatory for `paramsSchema`/`argsSchema`) |
| Types | SDK types first, then `interface` for shapes, `type` for unions |

## Documentation References

| Topic | File |
|-------|------|
| Tech stack | [.handbook/STACK.md](.handbook/STACK.md) |
| Git workflow | [.handbook/GIT_GUIDELINES.md](.handbook/GIT_GUIDELINES.md) |
| Versioning | [.handbook/PACKAGE_VERSIONING.md](.handbook/PACKAGE_VERSIONING.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Git Workflow Summary

- **Branches**: `feature/issue-{id}-{desc}`, `bugfix/issue-{id}-{desc}`, `hotfix/{version}`, `release/{version}`
- **Commits**: Conventional (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- **PRs**: Target `main` (except `relfix/*` → `release/*`)
- **Signed commits required**: `git commit -S`

## Pre-PR Checklist

```bash
pnpm quality:check  # lint + format + typecheck
pnpm test           # all tests pass
# Verify examples work if API changed
```

## Testing

- Unit: `src/**/*.spec.ts`
- E2E: `test/` directory
- Coverage: 50% statements, 25% branches, 40% functions, 50% lines
- Single file: `pnpm test -- path/to/file.spec.ts`
