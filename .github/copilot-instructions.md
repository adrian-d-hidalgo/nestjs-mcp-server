# Copilot Rules

> This document defines the rules and guidelines for code generation with Copilot in our NestJS module library for MCP Server building. **This project is a wrapper for the @modelcontextprotocol/sdk for TypeScript to create MCP Server** ([GitHub Repository](https://github.com/modelcontextprotocol/typescript-sdk/tree/server)). It is essential to maintain compatibility with this library at all times, using its defined types and ensuring correct implementation of the MCP Server specification as a NestJS module.

## 🎯 Response Principles

- Prioritize code correctness and functionality first
- Generate maintainable, readable solutions
- Consider security implications in all code
- Respect project-specific configurations
- Verify code quality before delivering final answers
- Ensure compatibility with @modelcontextprotocol/sdk
- After code changes, verify that examples in `../examples/*` remain valid and update them if necessary

## 🌐 Language

**STRICT**: Generate all code, comments, docs, and identifiers in English unless:

- User explicitly requests another language
- Specific project requirements override this rule

## 💡 Code Style & Quality

**STRICT**: All generated code MUST follow style and formatting defined in:

- `eslint.config.mjs`
- `tsconfig.json` and `tsconfig.build.json`
- `.prettierrc` (if present)

- Use descriptive, meaningful names for variables, functions, and classes
- Apply appropriate type annotations where supported
- Prefer explicit over implicit logic
- Keep functions focused on single responsibility
- Verify generated code against linting rules before providing the final solution
- If linting issues are detected, fix them and explain the changes

## 📝 Documentation & Comments

- Add concise docstrings for functions and classes
- Document parameters with types and constraints
- Document return values and possible exceptions
- Provide usage examples for complex interfaces

**STRICT**: Include comments only for:

- Complex/non-obvious logic
- Workarounds (with explanation)
- Security considerations
- Critical design decisions
- TODO/FIXME items (with context)

## 🔐 Security

- Never include hardcoded credentials
- Always validate and sanitize input
- Use parameterized queries for database operations
- Apply proper authentication and authorization checks
- Flag potential security vulnerabilities in generated code
- Suggest security improvements for existing code

## 📦 Dependencies

- Suggest dependencies with clear justification
- Prefer established, well-maintained libraries
- Include single installation command
- Pin dependency versions precisely
- Avoid deprecated or vulnerable libraries
- Respect licensing requirements
- Minimize the number of dependencies

## ✅ Testing & Verification

Verify generated code against:

- Project linting rules
- Type checking requirements
- Security best practices

- Generate appropriate unit tests on request
- Test both success and error paths
- Consider edge cases in implementations
- Fix issues before delivering final code
- If requested, suggest test scenarios
- After each implementation, check if examples in `../examples/*` need to be updated

## 🤖 Response Format

- Structure responses clearly
- Highlight key decisions and tradeoffs
- When providing complex implementations:
  - Break down the solution into logical parts
  - Explain complex or non-obvious patterns
  - Offer alternative approaches when relevant
- Include example usage for module integration
- Verify if your solution meets all requirements before submitting

## 💬 Interaction Guidelines

- Be specific and concise
- Ask clarifying questions when requirements are ambiguous
- Break complex tasks into manageable units
- Reuse existing code patterns when appropriate
- Maintain consistent terminology with the project
- Focus responses on the specific request
- If a request cannot be fulfilled completely, explain why and offer alternatives

## ⚙️ Implementation Rules

### TypeScript Types vs Interfaces

**STRICT**: Follow these rules for type definitions:

- Use `interface` for:
  - Object shapes that may be implemented or extended
  - Class contracts
- Use `type` for:
  - Union types
  - Intersection types
  - Primitive type aliases
  - Tuple types
  - Function types
  - Mapped and conditional types
- Prefer interfaces when both options are viable (for better error messages and performance)
- Reuse and extend types from @modelcontextprotocol/sdk whenever possible
- Follow naming conventions established in the @modelcontextprotocol/sdk library

### NestJS Code Generation Rules

- Use NestJS CLI for generating files whenever possible (controllers, services, etc.)
- Only generate files manually when they cannot be created through the CLI
- Use NestJS module, controller, and service conventions
- Decorate classes and methods appropriately (@Module, @Controller, @Injectable, etc.)
- Use dependency injection for services and providers
- Structure files and folders according to NestJS best practices
- Use constructor-based injection
- Follow NestJS module patterns for library development
- Follow NestJS exception handling patterns
- Implement Logger in strategic areas for better debugging capabilities
