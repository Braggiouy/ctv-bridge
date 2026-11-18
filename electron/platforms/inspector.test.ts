import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverInspector,
  inspectorUrl,
  isInspectorUrl,
  pickTarget,
  targetSocketPath,
  type DevToolsTarget,
} from "./inspector";

const page = (id: string, extra: Partial<DevToolsTarget> = {}) => ({
  id,
  type: "page",
  webSocketDebuggerUrl: `ws://localhost:9998/devtools/page/${id}`,
  ...extra,
});

describe("targetSocketPath", () => {
  it("reads the WebSocket URL", () => {
    expect(targetSocketPath(page("1"))).toBe("/devtools/page/1");
  });

  it("falls back to the frontend URL when the socket is already taken", () => {
    expect(
      targetSocketPath({
        devtoolsFrontendUrl:
          "/devtools/inspector.html?ws=localhost:9998/devtools/page/7",
      })
    ).toBe("/devtools/page/7");
  });

  it("returns nothing for targets that can't be inspected", () => {
    expect(
      targetSocketPath({ id: "1", url: "file:///index.html" })
    ).toBeUndefined();
  });
});

describe("pickTarget", () => {
  it("prefers the page showing the app", () => {
    const targets = [
      page("bg", { url: "file:///usr/palm/applications/com.lg.launcher/" }),
      page("app", { url: "file:///media/developer/apps/com.example.app/" }),
    ];
    expect(pickTarget(targets, "com.example.app")?.id).toBe("app");
  });

  it("falls back to the first inspectable page", () => {
    const targets = [
      {
        id: "worker",
        type: "service_worker",
        webSocketDebuggerUrl: "ws://x/1",
      },
      { id: "busy", type: "page" },
      page("app"),
    ];
    expect(pickTarget(targets, "something-else")?.id).toBe("app");
  });
});

describe("inspectorUrl", () => {
  it("builds a URL that the window accepts", () => {
    const url = inspectorUrl(41237, "/devtools/page/AB-12");
    expect(url).toBe(
      "devtools://devtools/bundled/inspector.html?ws=127.0.0.1:41237/devtools/page/AB-12"
    );
    expect(isInspectorUrl(url)).toBe(true);
  });

  it("rejects anything that isn't local bundled DevTools", () => {
    expect(isInspectorUrl("https://example.com/")).toBe(false);
    expect(
      isInspectorUrl(
        "devtools://devtools/bundled/inspector.html?ws=example.com:80/devtools/page/1"
      )
    ).toBe(false);
    expect(
      isInspectorUrl(
        "devtools://devtools/bundled/inspector.html?ws=127.0.0.1:1/x&panel=evil"
      )
    ).toBe(false);
  });
});

describe("discoverInspector", () => {
  let server: http.Server | undefined;
  afterEach(() => server?.close());

  /** A debug port whose page list is empty for the first `emptyResponses` requests. */
  const startDebugPort = async (
    routes: Record<string, unknown>,
    emptyResponses = 0
  ) => {
    let requests = 0;
    server = http.createServer((req, res) => {
      const body = routes[req.url ?? ""];
      if (body === undefined) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(requests++ < emptyResponses ? [] : body));
    });
    await new Promise<void>((resolve) =>
      server!.listen(0, "127.0.0.1", resolve)
    );
    return (server!.address() as AddressInfo).port;
  };

  it("finds the app's page on /json/list", async () => {
    const port = await startDebugPort({
      "/json/list": [page("1", { url: "file:///apps/com.example.app/" })],
    });
    expect(await discoverInspector(port, "com.example.app")).toBe(
      inspectorUrl(port, "/devtools/page/1")
    );
  });

  it("falls back to /json", async () => {
    const port = await startDebugPort({ "/json": [page("2")] });
    expect(await discoverInspector(port)).toBe(
      inspectorUrl(port, "/devtools/page/2")
    );
  });

  it("waits for the page to appear while the app starts", async () => {
    const port = await startDebugPort({ "/json/list": [page("3")] }, 3);
    expect(await discoverInspector(port, undefined, { retryDelayMs: 1 })).toBe(
      inspectorUrl(port, "/devtools/page/3")
    );
  });

  it("gives up when nothing is listening", async () => {
    const port = await startDebugPort({});
    server!.close();
    expect(
      await discoverInspector(port, undefined, {
        attempts: 2,
        retryDelayMs: 1,
      })
    ).toBeUndefined();
  });
});
