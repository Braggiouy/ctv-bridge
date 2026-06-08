/**
 * OpenSSL discovery and safe invocation (argv arrays, no shell).
 */

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { store } from "../store";

const execFileAsync = promisify(execFile);

/**
 * Resolves openssl: system PATH first, then common Tizen Studio locations.
 */
export async function resolveOpenssl(): Promise<string> {
  const isWin = process.platform === "win32";
  const lookupCmd = isWin ? "where" : "which";

  try {
    await execFileAsync(lookupCmd, ["openssl"]);
    return "openssl";
  } catch {
    // fall through
  }

  const tizenPath = store.get("tizenPath");
  if (tizenPath) {
    const studioRoot = path.resolve(tizenPath, "..", "..", "..", "..");
    const exe = isWin ? "openssl.exe" : "openssl";
    const candidates = [
      path.join(studioRoot, "tools", "openssl", "bin", exe),
      path.join(studioRoot, "tools", "ide", "bin", exe),
      path.join(studioRoot, "tools", exe),
    ];

    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // try next
      }
    }
  }

  throw new Error(
    "OpenSSL not found. Install OpenSSL and add it to your PATH, or configure the Tizen CLI path in Installation."
  );
}

/** Runs OpenSSL with argv (no shell). Optional stdin for `-passout stdin`. */
export async function runOpenssl(
  binary: string,
  args: string[],
  cwd: string,
  stdinInput?: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(binary, args, { cwd, shell: false });

    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`openssl exited ${code}: ${stderr.trim()}`));
    });

    if (stdinInput !== undefined) {
      proc.stdin.write(stdinInput);
    }
    proc.stdin.end();
  });
}
