# Testing Guide

## Overview

- **Test framework**: Vitest
- **Run all tests**: `bun run test`
- **CI runs**: `bun run test --exclude "electron/ipc/tizen/**"` (Tizen tests are excluded until the flow is stable)

## Test‑Utility Helpers

### Tizen

- `mockExecSuccess(stdout, stderr?)` – mock a successful `child_process.exec` call.
- `mockExecFailure(errorMsg, stdout?, stderr?)` – mock a failing exec call.
- `mockFsForSuccessfulBuild()` – set up the mocked `fs/promises` methods to simulate a successful `.wgt` build.
- `getFsMock()` – retrieve the mocked `fs` methods (`readdir`, `stat`, `mkdir`, `copyFile`).

### WebOS

- `childProcessExecMock` – stub for `child_process.exec`.
- `fsReaddirMock`, `fsStatMock`, `fsRenameMock` – stubs for `fs/promises` methods.
- `mockExecSuccess(stdout, stderr?)` – mock a successful exec.
- `mockExecCommandNotFound(command)` – mock a "command not found" error.

### Updater

- `mockChildProcessExec` – stub for `child_process.exec`.
- `mockFsReaddir`, `mockFsStat`, `mockFsRename` – stubs for file‑system operations.
- `mockExecSuccess(stdout, stderr?)` – mock a successful exec.
- `mockExecFailure(errorMsg, stdout?, stderr?)` – mock a failing exec.

## Running Specific Suites

```bash
# Only WebOS tests
bun run test --include "electron/ipc/webos/**"

# Only Tizen tests (local, not CI)
bun run test --include "electron/ipc/tizen/**"
```

## Enabling Tizen Tests in CI

1. Open `.github/workflows/test.yml`.
2. Remove the `--exclude "electron/ipc/tizen/**"` flag from the `Run Tests` step.
3. Commit and push – the workflow will now execute the Tizen suite.

## Debugging Tips

- Use `vi.clearAllMocks()` in a `beforeEach` hook to reset mock state.
- Inspect mock calls with `expect(childProcessExecMock).toHaveBeenCalledWith(...);`.
- When a test fails, check the console output of the mocked command for the expected `stdout`/`stderr` values.

---

For any questions, refer to the [CONTRIBUTING.md](CONTRIBUTING.md) guide or open an issue.
