# Tech Stack <!-- omit in toc -->

This document provides an overview of the core technologies, tools, and configurations used in the MCP Server NestJS module library. Its objective is to clarify the project's technical foundation, ensure consistency across development environments, and help contributors understand the stack requirements for building, testing, and maintaining modules compatible with the @modelcontextprotocol/sdk.

# Table of Contents <!-- omit in toc -->

- [Framework](#framework)
- [Language \& Transpilation](#language--transpilation)
- [Package Management](#package-management)
- [Linting](#linting)
- [Code Formatter](#code-formatter)
- [Testing](#testing)
- [Build](#build)
- [Logger](#logger)
- [Documentation](#documentation)
- [Environment Management](#environment-management)
- [CI/CD](#cicd)
- [Other](#other)

This project is built primarily with **NestJS** as the main framework. All modules, services, and controllers are designed following NestJS best practices and conventions.

The stack and tooling are organized by category, with the primary technology for each area explicitly listed:

## Framework

- **NestJS**: Main application framework for building scalable server-side applications

## Language & Transpilation

- **TypeScript**: Main language for all source code

## Package Management

- **pnpm**: For dependency management and scripts
- **npm**: Only for package publishing

## Linting

- **ESLint**: Code linting (see `eslint.config.mjs`)

## Code Formatter

- **Prettier**: Code formatting (if `.prettierrc` is present)

## Testing

- **Jest**: Unit and end-to-end testing

## Build

- **TypeScript Compiler (tsc)**: Build process (see `tsconfig.json` and `tsconfig.build.json`)

## Logger

- **NestJS Logger**: Default logger for application and modules
- **Custom Logger**: `mcp-logger.service.ts` for registry-specific logging

## Documentation

- **Swagger**: (If present) For API documentation via decorators
- **Typedoc**: (If present) For code documentation

## Environment Management

- **dotenv**: (If present) For environment variable management

## CI/CD

- **GitHub Actions**: For continuous integration and deployment workflows

## Other

- **@modelcontextprotocol/sdk**: Core dependency for MCP Server compatibility

> All tools must be used in the versions specified in the workflows and configuration files to ensure compatibility and reproducibility.
