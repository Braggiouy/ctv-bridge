# Contributing to CTV Bridge

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to CTV Bridge. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## 📚 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Development Workflow](#development-workflow)
  - [Project Structure](#project-structure)
  - [Running Locally](#running-locally)
  - [Building](#building)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
  - [Style Guide](#style-guide)
  - [Commit Messages](#commit-messages)

---

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [bruno.aggierni@gmail.com](mailto:bruno.aggierni@gmail.com).

---

## Getting Started

### Prerequisites

- **Node.js**: v20 or higher
- **Bun**: v1.1 or higher (we use Bun for package management and scripts)
- **Git**: Latest version

### Installation

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ctv-bridge.git
   cd ctv-bridge
   ```
3. **Install dependencies**:
   ```bash
   bun install
   ```

---

## Development Workflow

### Project Structure

- `src/`: React frontend application (UI components, pages, logic)
- `electron/`: Electron main process code (IPC handlers, system integration)
- `public/`: Static assets
- `.github/`: GitHub Actions workflows and templates

### Running Locally

To start the development server with hot-reloading:

```bash
bun run dev
```

This will launch the Electron app window. Changes to `src/` will hot-reload, while changes to `electron/` will restart the main process.

### Building

To build the application for your current operating system:

```bash
bun run build
```

Artifacts will be generated in the `release/` directory.

---

## Pull Request Process

1.  **Create a Branch**: Create a new branch for your feature or bugfix.
    ```bash
    git checkout -b feature/amazing-feature
    ```
2.  **Make Changes**: Implement your changes. Ensure code is clean and documented.
3.  **Test**: Verify your changes manually (automated tests coming soon!).
4.  **Commit**: Use [Conventional Commits](#commit-messages) for your commit messages.
5.  **Push**: Push your branch to your fork.
6.  **Open a PR**: Submit a Pull Request to the `main` branch of the upstream repository.
    - Fill out the PR template completely.
    - Link any related issues.
    - Wait for review!

---

## Coding Standards

### Style Guide

- **TypeScript**: We use TypeScript for type safety. Avoid `any` whenever possible.
- **React**: Use Functional Components and Hooks.
- **Styling**: We use Tailwind CSS and shadcn/ui components.
- **Formatting**: We use Prettier. Run `bun run format` to format your code.
- **Linting**: We use ESLint. Run `bun run lint` to check for issues.

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This allows us to automatically generate changelogs and version numbers.

**Format**: `<type>(<scope>): <description>`

**Types**:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

**Examples**:

- `feat(ui): add dark mode toggle`
- `fix(tizen): resolve connection timeout issue`
- `docs: update contributing guidelines`
