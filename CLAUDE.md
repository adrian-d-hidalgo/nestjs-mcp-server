<!-- last-reviewed: 2026-06-01 -->

# @nestjs-mcp/server — Agent Instructions

## Non-negotiable principles

- **No autonomous git or destructive ops.** Never run `git commit`, `git push`, `git reset --hard`, `git rebase`, or publish without the user typing the exact command. "Finish the task" is not authorization.
- **No time estimates.** Describe scope instead ("touches 3 resolvers", "requires an SDK type change").
- **Honesty about coverage.** Any claim without evidence is labeled `[Unverified]` or `[Inference]`. Compiling is not executing; types verify code, not behavior. A fix grounded in `[Inference]` is not done — get the evidence or say you couldn't and stop.
- **Always check SDK types before defining new ones.** This library wraps the MCP SDK v2 packages. Reuse SDK types (`CallToolResult`, `ServerContext`, `ToolAnnotations`, etc.) from `@modelcontextprotocol/server` — re-export, never redeclare.
- **If in doubt, ask.** A short question costs 30 seconds; a wrong-direction change costs an hour.

## Commands

| Action                | Command                             |
| --------------------- | ----------------------------------- |
| Install               | `pnpm install`                      |
| Build                 | `pnpm build`                        |
| Test                  | `pnpm test`                         |
| Single test           | `pnpm test -- path/to/file.spec.ts` |
| E2E test              | `pnpm test:e2e`                     |
| Lint + format + types | `pnpm quality:check`                |
| Fix lint / format     | `pnpm quality:fix`                  |
| Dead-code scan        | `pnpm knip`                         |
| Run example           | `EXAMPLE=tools pnpm start:example`  |
| MCP Inspector         | `pnpm start:inspector`              |

## Core patterns (no-lintable)

1. **Resolver classes must use `@Resolver()` decorator**, NOT `@Injectable()`.
2. **Handler signature**: `(params?, ctx: McpContext) => Result`. `McpContext` extends the SDK's `ServerContext` with the live Express `request` and its `headers`.
3. **Guard scopes**:
   - Global (`APP_GUARD`): standard NestJS `ExecutionContext`.
   - Method (`@UseGuards`): custom `McpExecutionContext`; supports DI via `ModuleRef`. `getRequest()` returns the **invoking** request; there is no `getSessionId()` — the protocol retired sessions in 2.0.

Example resolver:

```typescript
import { Resolver, Tool, McpContext } from '@nestjs-mcp/server';
import { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';

const Params = z.object({ id: z.string() });

@Resolver('namespace')
export class MyResolver {
  @Tool({ name: 'my_tool', description: 'Does X', paramsSchema: Params })
  myTool(
    params: z.infer<typeof Params>,
    ctx: McpContext,
  ): CallToolResult {
    return { content: [{ type: 'text', text: `Result for ${params.id}` }] };
  }
}
```

## Naming conventions (no-lintable)

| Aspect    | Convention                                                      |
| --------- | --------------------------------------------------------------- |
| Files     | `kebab-case.ts`                                                 |
| Classes   | `PascalCase`                                                    |
| Methods   | `camelCase`                                                     |
| MCP names | `snake_case` (e.g. `@Tool({ name: 'my_tool' })`)                |
| Schemas   | Standard Schema for `paramsSchema` / `argsSchema` — e.g. `z.object({…})`, not a raw shape |
| Types     | SDK types first; then `interface` for shapes, `type` for unions |

## When reading the codebase

Prefer the `codegraph_*` MCP tools for structural questions (who calls what, blast radius, signatures); use `Grep`/`Read` for literal text. Index is local under `.codegraph/` (gitignored); rebuild with `codegraph init -i` if missing.

## Quality gate after development

After any code change, run this gate to completion before handing off. **Fix everything a phase surfaces before advancing; never skip a phase — skipping is silent breakage.**

1. `pnpm quality:fix` — lint + format
2. `pnpm typecheck`
3. `pnpm knip` — no unused files, deps, or exports
4. `pnpm test`
5. `pnpm test:e2e`

Typecheck verifies code correctness, not feature correctness. If the public API changed, verify the examples under `examples/` still run.

## When working with git

Read `.handbook/GIT_GUIDELINES.md` before pushing.

- Branches: `feature/issue-{id}-{desc}`, `bugfix/issue-{id}-{desc}`, plus `alpha`, `beta`, `rc` for pre-releases.
- Commits: Conventional (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Version bumps are automatic via semantic-release.
- PRs target `main`. Releases run via GitHub Actions workflow_dispatch.

## When updating package version policy

Read `.handbook/PACKAGE_VERSIONING.md` first.

## Testing targets

Coverage thresholds (`package.json` → `jest.coverageThreshold`): 80% statements, 55% branches, 70% functions, 85% lines. Unit specs co-located in `src/`; E2E specs in `test/`.
