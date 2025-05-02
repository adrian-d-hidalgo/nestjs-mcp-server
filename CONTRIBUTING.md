# Contributing

Thank you for your interest in contributing to NestJS MCP Server!

---

## Developer Environment & Project Structure

### 📁 Project Structure

```
.
├── src/                  # Core library source code
│   ├── mcp.module.ts     # Main NestJS module for MCP integration
│   ├── mcp.service.ts    # MCP server service wrapper
│   ├── mcp.controller.ts # HTTP/SSE controller for MCP endpoints
│   └── registry/         # Discovery, logger, and registry utilities
├── examples/             # Example MCP servers (resources, tools, prompts, mixed)
│   └── ...               # Each with its own app.module.ts and service
├── test/                 # Unit and integration tests
├── .devcontainer/        # Devcontainer configs for VS Code & Codespaces
├── package.json          # Project scripts and dependencies
├── tsconfig.json         # TypeScript configuration
├── eslint.config.mjs     # ESLint configuration
└── README.md             # Project documentation
```

---

### 🚀 Setup

#### In the Cloud: Codespaces

1. Click the **Open in GitHub Codespaces** badge or button in the repo.
2. Wait for the environment to initialize (Node.js, PNPM, NestJS CLI, etc. are pre-installed).
3. Start developing immediately in your browser or VS Code.

#### Locally: DevContainers

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

##### Working with Git & GitHub CLI in DevContainers

- The DevContainer includes an up-to-date version of Git and the GitHub CLI (`gh`).
- Use all standard Git commands (`git status`, `git commit`, `git push`, etc.) in the integrated terminal.
- Use the GitHub CLI for advanced GitHub operations:
  - Authenticate: `gh auth login`
  - Create issues/PRs: `gh issue create`, `gh pr create`
  - List PRs: `gh pr list`
- All Git operations are performed inside the container, ensuring a consistent environment.

#### Manual Setup (pnpm)

1. Install [Node.js](https://nodejs.org/) v22+ and [PNPM](https://pnpm.io/).
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

---

## Running Examples

You can run the provided example servers to test and explore the MCP Server module integration:

- **Start the server:**

  ```sh
  pnpm start:resources
  # or
  pnpm start:tools
  # or
  pnpm start:prompts
  ```

  The server will be available at [http://localhost:3000](http://localhost:3000).

- **Inspector Playground:**
  Launch the MCP Inspector playground to interactively test and debug your MCP server examples:
  ```sh
  pnpm start:inspector
  ```
  This opens a UI tool (from `@modelcontextprotocol/inspector`) for exploring, invoking, and validating your MCP endpoints and server behavior in real time.

---

## Reporting Issues

- Use the [GitHub issue tracker](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues).
- Search existing issues before creating a new one.
- Provide clear reproduction steps, environment details, and error messages if applicable.

---

## How to Contribute

- **Open an Issue First:** Before submitting a pull request (PR), please [open an issue](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues) to discuss your proposed change, bug, or feature. This helps us coordinate efforts and avoid duplicate work.
- Fork the repository and create your branch from `main`.
- Ensure compatibility with `@modelcontextprotocol/sdk` and follow project coding standards.
- Add or update tests as appropriate.
- Run `pnpm lint` and `pnpm test` before submitting.
- Submit a pull request with a clear description of your changes, referencing the related issue.

---

## Signed Commits Requirement

All pull requests must use signed commits. Unsigned commits will not be accepted.

### Why Signed Commits?

Signed commits ensure that the author of each commit is authentic, helping to prevent impersonation and maintain the integrity of the codebase. This is required for all contributions.

### How to enable SSH commit signing

1. **Generate an SSH key if you do not have one:**
   ```sh
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```
2. **Add your SSH key as a Signing Key in GitHub:**
   - Go to **GitHub → Settings → SSH and GPG keys**
   - Click **New SSH key**
   - In the **Title** field, enter a descriptive name (e.g., "Personal Laptop")
   - In the **Key type** dropdown, select **Signing Key** (not Authentication Key)
   - In the **Key** field, paste your SSH public key (the contents of your `.pub` file)
   - Click **Add SSH key**
   - _Note: If you already added this key as an Authentication Key, you can add it again as a Signing Key, or use a different key for signing._
3. **Configure Git to sign commits with your SSH key:**
   ```sh
   git config --global gpg.format ssh
   git config --global user.signingkey ~/.ssh/id_ed25519.pub  # Path to your SSH public key
   git config --global commit.gpgsign true
   ```
4. **Make a commit and push.** GitHub should show your commit as "Verified".

For more details, see: https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits-with-ssh-keys

---

## How to Sign Commits

To sign a commit manually, use the `-S` flag:

```sh
git commit -S -m "your commit message here"
```

To sign all commits automatically, you can configure Git to always sign commits. This can be set globally (for all repositories) or locally (for the current repository only):

- **Globally:**
  ```sh
  git config --global commit.gpgsign true
  ```
- **Locally (recommended for this project):**
  ```sh
  git config --local commit.gpgsign true
  ```

With this configuration, all future commits will be signed by default.

---

## Troubleshooting: SSH Commit Signature Verification

If you encounter this error when verifying SSH-signed commits:

```
error: gpg.ssh.allowedSignersFile needs to be configured and exist for SSH signature verification
```

Git requires a file listing allowed signers (public keys) to verify SSH commit signatures.

### Solution

1. Create the allowed signers file:
   ```sh
   mkdir -p ~/.config/git
   touch ~/.config/git/allowed_signers
   ```
2. Add your public SSH key to the file:
   ```sh
   echo "your_email@example.com $(cat ~/.ssh/id_ed25519.pub)" >> ~/.config/git/allowed_signers
   ```
   > Replace the email and key path if needed.
3. Configure Git to use this file:
   ```sh
   git config --global gpg.ssh.allowedSignersFile ~/.config/git/allowed_signers
   ```
4. Verify signature verification works:
   ```sh
   git log --show-signature
   ```

Now Git will be able to verify SSH-signed commits using the allowed signers file.

---

## Pull Request Guidelines

- Follow the existing code style and linting rules
- Include tests for new functionality
- Update documentation as needed
- Keep changes focused and atomic
- Provide a clear description of changes
- For more details, see the [handbook](.handbook/) (if available)

## Development Workflow

- All feature branches should be created from `main`.
- Pull requests should target the `develop` branch.
- The `develop` branch contains the latest (potentially unstable) changes.
- The `main` branch contains the latest stable release.
- For detailed information on our Git workflow and commit guidelines, please refer to `.handbook/git-guidelines.md`.

## Testing

- Ensure all tests pass before submitting your PR.
- Add new tests for new functionality.
- Update existing tests as needed for modified code.

## Reporting Issues

- Use [GitHub Issues](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues) to report bugs or request features.
- Please provide as much detail as possible, including steps to reproduce and environment information.

## Code of Conduct

This project adheres to the [Contributor Covenant](https://www.contributor-covenant.org/). By participating, you are expected to uphold this code.

---

We appreciate your help in making this project better!
