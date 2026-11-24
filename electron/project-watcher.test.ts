import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isIgnored, watchProject } from "./project-watcher";

describe("isIgnored", () => {
  it("skips hidden folders, dependencies and our own build output", () => {
    expect(isIgnored(".git/index")).toBe(true);
    expect(isIgnored("src/.DS_Store")).toBe(true);
    expect(isIgnored("node_modules/x/index.js")).toBe(true);
    expect(isIgnored("MyApp.wgt")).toBe(true);
    expect(isIgnored("com.example.app_1.0.0_all.ipk")).toBe(true);
    expect(isIgnored("author-signature.xml")).toBe(true);
  });

  it("keeps project files", () => {
    expect(isIgnored("index.html")).toBe(false);
    expect(isIgnored("js/main.js")).toBe(false);
    expect(isIgnored("config.xml")).toBe(false);
  });
});

describe("watchProject", () => {
  let dir: string;
  let stop: (() => void) | undefined;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctv-bridge-watch-"));
    fs.mkdirSync(path.join(dir, "js"));
  });
  afterEach(() => {
    stop?.();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const nextChange = (target: string) =>
    new Promise<string[]>((resolve) => {
      stop = watchProject(target, resolve, 100);
    });

  it("reports a burst of changes once, without build output", async () => {
    const change = nextChange(dir);
    await new Promise((resolve) => setTimeout(resolve, 50));
    fs.writeFileSync(path.join(dir, "index.html"), "<p>hi</p>");
    fs.writeFileSync(path.join(dir, "js", "main.js"), "1");
    fs.writeFileSync(path.join(dir, "App.wgt"), "zip");
    const changed = await change;
    expect(changed.map((file) => file.replace(/\\/g, "/")).sort()).toEqual([
      "index.html",
      "js/main.js",
    ]);
  });

  it("ignores files rewritten unchanged, as ares-package does to appinfo.json", async () => {
    fs.writeFileSync(path.join(dir, "appinfo.json"), '{"id":"a"}');
    fs.writeFileSync(path.join(dir, "old.js"), "gone");
    const change = nextChange(dir);
    await new Promise((resolve) => setTimeout(resolve, 50));
    fs.writeFileSync(path.join(dir, "appinfo.json"), '{"id":"a"}');
    fs.rmSync(path.join(dir, "old.js"));
    expect(await change).toEqual(["old.js"]);
  });

  it("follows a single file that is replaced", async () => {
    const apk = path.join(dir, "app-debug.apk");
    fs.writeFileSync(apk, "v1");
    const change = nextChange(apk);
    await new Promise((resolve) => setTimeout(resolve, 50));
    fs.writeFileSync(path.join(dir, "other.txt"), "ignored");
    fs.writeFileSync(`${apk}.tmp`, "v2");
    fs.renameSync(`${apk}.tmp`, apk);
    expect(await change).toEqual(["app-debug.apk"]);
  });
});
