import { describe, expect, it } from "vitest";
import {
  allowsSecondClient,
  chromeMajorVersion,
  formatConsoleArgs,
  formatRemoteObject,
  socketUrlFromInspector,
  toLogEntry,
  type RemoteObject,
} from "./console-stream";
import { inspectorUrl } from "./inspector";

const str = (value: string): RemoteObject => ({ type: "string", value });
const num = (value: number): RemoteObject => ({
  type: "number",
  value,
  description: String(value),
});

describe("formatRemoteObject", () => {
  it("prints primitives like DevTools", () => {
    expect(formatRemoteObject(str("hi"))).toBe("hi");
    expect(formatRemoteObject(num(42))).toBe("42");
    expect(formatRemoteObject({ type: "boolean", value: false })).toBe("false");
    expect(formatRemoteObject({ type: "undefined" })).toBe("undefined");
    expect(
      formatRemoteObject({ type: "object", subtype: "null", value: null })
    ).toBe("null");
    expect(
      formatRemoteObject({ type: "number", unserializableValue: "NaN" })
    ).toBe("NaN");
  });

  it("prints object and array previews", () => {
    expect(
      formatRemoteObject({
        type: "object",
        description: "Object",
        preview: {
          overflow: false,
          properties: [
            { name: "id", type: "number", value: "7" },
            { name: "title", type: "string", value: "Movies" },
          ],
        },
      })
    ).toBe('{id: 7, title: "Movies"}');
    expect(
      formatRemoteObject({
        type: "object",
        subtype: "array",
        description: "Array(30)",
        preview: {
          subtype: "array",
          overflow: true,
          properties: [
            { name: "0", type: "number", value: "1" },
            { name: "1", type: "number", value: "2" },
          ],
        },
      })
    ).toBe("[1, 2, …]");
  });

  it("prints errors with their stack and objects without a preview by name", () => {
    expect(
      formatRemoteObject({
        type: "object",
        subtype: "error",
        description: "TypeError: x is undefined\n    at main.js:1:1",
      })
    ).toBe("TypeError: x is undefined\n    at main.js:1:1");
    expect(
      formatRemoteObject({ type: "object", description: "HTMLDivElement" })
    ).toBe("HTMLDivElement");
  });
});

describe("formatConsoleArgs", () => {
  it("joins arguments with spaces", () => {
    expect(formatConsoleArgs([str("count"), num(3)])).toBe("count 3");
  });

  it("applies format specifiers and drops %c styles", () => {
    expect(
      formatConsoleArgs([
        str("%c[player]%c %s at %dms (%f)"),
        str("color: red"),
        str(""),
        str("buffering"),
        num(1500.7),
        num(0.5),
      ])
    ).toBe("[player] buffering at 1500ms (0.5)");
  });

  it("keeps specifiers without a matching argument and appends extra ones", () => {
    expect(formatConsoleArgs([str("100%% %s"), str("done"), num(1)])).toBe(
      "100% done 1"
    );
    expect(formatConsoleArgs([str("%s and %s"), str("one")])).toBe(
      "one and %s"
    );
  });
});

describe("toLogEntry", () => {
  it("maps console calls to levels", () => {
    const call = (type: string) =>
      toLogEntry("Runtime.consoleAPICalled", { type, args: [str("x")] })?.level;
    expect(call("log")).toBe("log");
    expect(call("debug")).toBe("log");
    expect(call("info")).toBe("info");
    expect(call("warning")).toBe("warning");
    expect(call("error")).toBe("error");
    expect(call("assert")).toBe("error");
    expect(call("endGroup")).toBeUndefined();
  });

  it("adds the stack to console.error", () => {
    const entry = toLogEntry("Runtime.consoleAPICalled", {
      type: "error",
      args: [str("Request failed")],
      stackTrace: {
        callFrames: [
          {
            functionName: "load",
            url: "file:///media/developer/apps/usr/palm/applications/com.example/main.js",
            lineNumber: 41,
            columnNumber: 9,
          },
          { functionName: "", url: "", lineNumber: 0, columnNumber: 0 },
        ],
      },
    });
    expect(entry?.text).toBe(
      "Request failed\n    at load (main.js:42:10)\n    at <anonymous>:1:1"
    );
  });

  it("prints uncaught exceptions with their stack", () => {
    expect(
      toLogEntry("Runtime.exceptionThrown", {
        timestamp: 1,
        exceptionDetails: {
          text: "Uncaught",
          exception: {
            type: "object",
            subtype: "error",
            description:
              "TypeError: Cannot read properties of undefined (reading 'items')\n    at Rail.render (file:///media/developer/apps/usr/palm/applications/com.example/main.js:1832:5)\n    at file:///media/developer/apps/usr/palm/applications/com.example/index.html:17:33",
          },
        },
      })
    ).toEqual({
      level: "error",
      text: "Uncaught TypeError: Cannot read properties of undefined (reading 'items')\n    at Rail.render (main.js:1832:5)\n    at index.html:17:33",
    });
  });

  it("keeps browser warnings and errors, but not verbose messages", () => {
    expect(
      toLogEntry("Log.entryAdded", {
        entry: {
          level: "error",
          text: "Failed to load resource: the server responded with a status of 404 ()",
          url: "https://api.example.com/rails",
        },
      })
    ).toEqual({
      level: "error",
      text: "Failed to load resource: the server responded with a status of 404 () (https://api.example.com/rails)",
    });
    expect(
      toLogEntry("Log.entryAdded", { entry: { level: "verbose", text: "x" } })
    ).toBeNull();
  });

  it("truncates huge messages", () => {
    const entry = toLogEntry("Runtime.consoleAPICalled", {
      type: "log",
      args: [str("x".repeat(6000))],
    });
    expect(entry?.text).toMatch(/^x{5000}… \(1000 more characters\)$/);
  });

  it("ignores other events", () => {
    expect(toLogEntry("Runtime.executionContextCreated", {})).toBeNull();
  });
});

describe("TV compatibility", () => {
  it("reads the Chrome version from webOS, Tizen and Android user agents", () => {
    expect(
      chromeMajorVersion(
        "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 WebAppManager"
      )
    ).toBe(87);
    expect(
      chromeMajorVersion(
        "Mozilla/5.0 (SMART-TV; LINUX; Tizen 4.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 TV Safari/537.36"
      )
    ).toBeUndefined();
  });

  it("only shares the debugger with DevTools on Chrome 63 and newer", () => {
    expect(allowsSecondClient(87)).toBe(true);
    expect(allowsSecondClient(63)).toBe(true);
    expect(allowsSecondClient(56)).toBe(false);
    // Unknown versions take turns, which is safe everywhere.
    expect(allowsSecondClient(undefined)).toBe(false);
  });

  it("derives the page's WebSocket URL from the inspector URL", () => {
    expect(
      socketUrlFromInspector(inspectorUrl(41237, "/devtools/page/AB-12"))
    ).toBe("ws://127.0.0.1:41237/devtools/page/AB-12");
  });
});
