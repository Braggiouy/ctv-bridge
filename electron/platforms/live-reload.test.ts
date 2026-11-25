import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  baseUrlOf,
  contentType,
  needsReinstall,
  projectFileFor,
} from "./live-reload";

const base =
  "file:///media/developer/apps/usr/palm/applications/com.example.app/";
const project = path.resolve("/work/app");

describe("live reload", () => {
  it("finds the folder the page is served from", () => {
    expect(baseUrlOf(`${base}index.html?x=1#top`)).toBe(base);
    expect(baseUrlOf("file:///index.html")).toBe("file:///");
  });

  it("maps requests under that folder to project files", () => {
    expect(projectFileFor(`${base}js/main.js?v=2`, base, project)).toBe(
      path.join(project, "js", "main.js")
    );
    expect(projectFileFor(`${base}img/my%20logo.png`, base, project)).toBe(
      path.join(project, "img", "my logo.png")
    );
    expect(projectFileFor(base, base, project)).toBe(
      path.join(project, "index.html")
    );
  });

  it("never serves files outside the project", () => {
    expect(projectFileFor(`${base}../other/secret`, base, project)).toBe(
      undefined
    );
    expect(projectFileFor(`${base}%2e%2e/secret`, base, project)).toBe(
      undefined
    );
    expect(projectFileFor("https://example.com/app.js", base, project)).toBe(
      undefined
    );
  });

  it("knows content types and which changes need a reinstall", () => {
    expect(contentType("a/b.JS")).toBe("text/javascript");
    expect(contentType("font.woff2")).toBe("font/woff2");
    expect(contentType("data.bin")).toBe("application/octet-stream");
    expect(needsReinstall(["index.html", "appinfo.json"])).toBe(true);
    expect(needsReinstall(["js/config.xml.bak", "index.html"])).toBe(false);
  });
});
