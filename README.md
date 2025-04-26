# MCP Server NestJS Module Library

# Table of Contents

- [Introduction](#nestjs-mcp-server)
- [Project Structure](#-project-structure)
- [Setup](#-setup)
  - [In the Cloud: Codespaces](#in-the-cloud-codespaces)
  - [Locally: DevContainers](#locally-devcontainers)
  - [Manual Setup (pnpm)](#manual-setup-pnpm)
- [Key Project Scripts](#-key-project-scripts)
- [Example Usage](#-example-usage)
- [References](#-references)
- [Changelog](#changelog)
- [License](#-license)
- [Contributions](#-contributions)

# NestJS MCP Server

NestJS MCP Server is a modular library for building [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/typescript-sdk/tree/server) servers using [NestJS](https://nestjs.com/). It provides decorators, modules, and integration patterns to expose MCP capabilities, tools, prompts, and resources in a scalable, maintainable way.

---

## 📁 Project Structure

```
.
├── src/                  # Core library source code
│   ├── [`src/mcp.module.ts`](src/mcp.module.ts )     # Main NestJS module for MCP integration
│   ├── [`src/mcp.service.ts`](src/mcp.service.ts )    # MCP server service wrapper
│   ├── mcp.controller.ts # HTTP/SSE controller for MCP endpoints
│   └── registry/         # Discovery, logger, and registry utilities
├── examples/             # Example MCP servers (resources, tools, prompts, mixed)
│   └── ...               # Each with its own [`examples/mixed/app.module.ts`](examples/mixed/app.module.ts ) and service
├── test/                 # Unit and integration tests
├── .devcontainer/        # Devcontainer configs for VS Code & Codespaces
├── [`package.json`](package.json )          # Project scripts and dependencies
├── [`tsconfig.json`](tsconfig.json )         # TypeScript configuration
├── [`eslint.config.mjs`](eslint.config.mjs )     # ESLint configuration
└── [`README.md`](README.md )             # Project documentation
```

---

## 🚀 Setup

### In the Cloud: Codespaces

1. Click the [Open in GitHub Codespaces](https://github.com/adrian-d-hidalgo/nestjs-mcp-server?quickstart=1) badge or button.
2. Wait for the environment to initialize (Node.js, PNPM, NestJS CLI, etc. are pre-installed).
3. Start developing immediately in your browser or VS Code.

### Locally: DevContainers

1. Clone the repository:
   ```sh
   git clone https://github.com/adrian-d-hidalgo/nestjs-mcp-server.git
   cd nestjs-mcp-server
   ```
2. Install [Docker](https://www.docker.com/) and [VS Code](https://code.visualstudio.com/).
3. Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).
4. Open the project folder in VS Code.
5. Open the Command Palette:
   - On **Windows/Linux**: `Ctrl+Shift+P`
   - On **macOS**: `Cmd+Shift+P`
   - Search for and select: `Dev Containers: Open Folder in Container`
6. Wait for the container to build and initialize.
7. Develop with all tools pre-installed and configured.

#### Working with Git inside the DevContainer

- The DevContainer includes an up-to-date version of Git and the GitHub CLI (`gh`).
- You can use all standard Git commands (`git status`, `git commit`, `git push`, etc.) in the integrated terminal.
- Use the GitHub CLI for advanced GitHub operations:
  - Authenticate: `gh auth login`
  - Create issues/PRs: `gh issue create`, `gh pr create`
  - List PRs: `gh pr list`
- All Git operations are performed inside the container, ensuring a consistent environment.

### Manual Setup (pnpm)

1. Install [Node.js](https://nodejs.org/) v18+ and [PNPM](https://pnpm.io/).
2. Clone the repository:
   ```sh
   git clone https://github.com/adrian-d-hidalgo/nestjs-mcp-server.git
   cd nestjs-mcp-server
   ```
3. Install dependencies:
   ```sh
   pnpm install
   # or
   npm install
   ```
4. Run an example server:
   ```sh
   pnpm start:resources
   # or
   pnpm start:tools
   # or
   pnpm start:prompts
   ```
5. The server will be available at [http://localhost:3000](http://localhost:3000).

#### Using GitHub CLI (`gh`) in DevContainers

When working inside a DevContainer, you have access to the [GitHub CLI](https://cli.github.com/) (`gh`) pre-installed and available on the `PATH`. This tool allows you to interact with GitHub repositories, issues, pull requests, and more directly from your terminal. Example usage:

- **Authenticate**:
  ```sh
  gh auth login
  ```
- **Create a new issue**:
  ```sh
  gh issue create --title "Bug: ..." --body "Steps to reproduce..."
  ```
- **View pull requests**:
  ```sh
  gh pr list
  ```
- **Clone another repo**:
  ```sh
  gh repo clone owner/repo
  ```

> For a full list of commands and advanced usage, see the [GitHub CLI documentation](https://cli.github.com/manual/).

**Working with GitHub in DevContainers**

- You can use `gh` to manage issues, pull requests, releases, and more without leaving your development environment.
- This is especially useful for collaborative workflows, code reviews, and automating repository tasks.
- The DevContainer is pre-configured for seamless GitHub integration, so you can focus on development and CI/CD without manual setup.

---

## 📦 Key Project Scripts

- `pnpm build` — Compile the project
- `pnpm lint` — Run ESLint with auto-fix
- `pnpm test` — Run all tests
- `pnpm format` — Format code with Prettier
- `pnpm start:resources` — Start the resources example server (`examples/resources/main.ts`)
- `pnpm start:prompts` — Start the prompts example server (`examples/prompts/main.ts`)
- `pnpm start:tools` — Start the tools example server (`examples/tools/main.ts`)
- `pnpm start:inspector` — Launch the MCP Inspector tool

---

## 🧩 Example Usage

The [`examples/`](examples/) directory contains detailed, ready-to-use scenarios that demonstrate how to use the MCP Server module library in various contexts. Each example illustrates a specific use case or integration pattern, such as:

- Registering and exposing MCP resources
- Implementing custom tools
- Integrating prompts
- Combining multiple MCP features in a single server

These examples are designed to help you understand the library's capabilities and serve as reference implementations for your own projects. Each example is self-contained and follows the best practices and conventions defined in this project.

---

## 📚 References

- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk/tree/server)
- [NestJS Documentation](https://docs.nestjs.com/)
- [GitHub Codespaces](https://github.com/features/codespaces)
- [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers)

---

## Changelog

<!-- TODO: Add a reference to the changelog here. The changelog should be maintained and updated with each release. Decide if it should be placed before or after the LICENSE section. -->

---

## 📝 License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

---

## 🤝 Contributions

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute, report issues, or request features.
