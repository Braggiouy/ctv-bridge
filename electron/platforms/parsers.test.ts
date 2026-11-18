import { describe, expect, it } from "vitest";
import {
  findDebugPort,
  findInspectorUrl,
  findProfilesXmlPath,
  findWebViewSocket,
  isInspectLogLine,
  parseAttachedSerials,
  parseBadging,
  parseDuid,
  parseProfilesTable,
  parsePid,
  parseProfilesXml,
  parseTizenAppId,
} from "./parsers";

describe("parseAttachedSerials", () => {
  it("reads sdb devices with names and emulators", () => {
    const stdout = [
      "List of devices attached ",
      "192.168.1.20:26101      device          UE55TU8000",
      "emulator-26101          device          T-samsung-6.0-x86",
      "192.168.1.21:26101      offline         UE43TU7000",
      "",
    ].join("\n");
    expect(parseAttachedSerials(stdout)).toEqual([
      "192.168.1.20:26101",
      "emulator-26101",
    ]);
  });

  it("reads adb devices with tabs and CRLF, skipping unauthorized ones", () => {
    const stdout =
      "List of devices attached\r\n192.168.1.30:5555\tdevice\r\nR58M123ABC\tunauthorized\r\n\r\n";
    expect(parseAttachedSerials(stdout)).toEqual(["192.168.1.30:5555"]);
  });

  it("ignores the adb daemon start-up banner", () => {
    const stdout = [
      "* daemon not running; starting now at tcp:5037",
      "* daemon started successfully",
      "List of devices attached",
      "",
    ].join("\n");
    expect(parseAttachedSerials(stdout)).toEqual([]);
  });

  it("returns nothing for an empty list", () => {
    expect(parseAttachedSerials("List of devices attached \n")).toEqual([]);
  });
});

describe("parseTizenAppId", () => {
  const config = (
    application: string
  ) => `<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" id="http://yourdomain/MyApp" version="1.0.0" viewmodes="maximized">
  ${application}
  <content src="index.html"/>
</widget>`;

  it("reads the application id, not the widget id", () => {
    const xml = config(
      '<tizen:application id="AbCdEf1234.MyApp" package="AbCdEf1234" required_version="2.3"/>'
    );
    expect(parseTizenAppId(xml)).toBe("AbCdEf1234.MyApp");
  });

  it("rejects a URL as the application id", () => {
    const xml = config('<tizen:application id="http://yourdomain/MyApp"/>');
    expect(() => parseTizenAppId(xml)).toThrow(/must be an app ID/);
  });

  it("explains when the application element is missing", () => {
    expect(() => parseTizenAppId(config(""))).toThrow(
      /Could not find <tizen:application id>/
    );
  });
});

describe("parseDuid", () => {
  it("trims a valid DUID", () => {
    expect(parseDuid("  B5CPD5GM7VNXS\n")).toBe("B5CPD5GM7VNXS");
  });

  it("rejects error output", () => {
    expect(parseDuid("error: closed")).toBeUndefined();
    expect(parseDuid("")).toBeUndefined();
  });
});

describe("findDebugPort", () => {
  it("reads the port from sdb debug output", () => {
    expect(
      findDebugPort(
        "... successfully launched pid = 4321 with debug 1 port: 34873\n"
      )
    ).toBe("34873");
  });

  it("reads the port from a devtools URL", () => {
    expect(findDebugPort("ws://127.0.0.1:7011/devtools/page/1")).toBe("7011");
    expect(findDebugPort("http://localhost:9222/json")).toBe("9222");
  });

  it("ignores output without a port", () => {
    expect(findDebugPort("result: launched")).toBeUndefined();
    expect(findDebugPort("port: 80")).toBeUndefined();
  });
});

describe("Tizen security profiles", () => {
  // Captured from Tizen Studio CLI (`tizen security-profiles list`).
  const listOutput = [
    "Loaded in '/Users/me/tizen-studio-data/profile/profiles.xml'.",
    "[Profile Name]      [Active]  ",
    "ctv-bridge          O         ",
    "old-profile         X         ",
    "",
  ].join("\n");

  it("finds the profiles.xml path", () => {
    expect(findProfilesXmlPath(listOutput)).toBe(
      "/Users/me/tizen-studio-data/profile/profiles.xml"
    );
  });

  it("reads the table", () => {
    expect(parseProfilesTable(listOutput)).toEqual([
      { name: "ctv-bridge", active: true },
      { name: "old-profile", active: false },
    ]);
  });

  it("reads names that some CLI versions glue to the marker", () => {
    expect(
      parseProfilesTable(
        "[Profile Name]      [Active]\nvery-long-profile-nameO\n"
      )
    ).toEqual([{ name: "very-long-profile-name", active: true }]);
  });

  it("reads profiles.xml and marks the active one", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<profiles active="tv" version="3.1">
<profile name="old">
<profileitem ca="" distributor="0" key="author.p12" password="x" rootca=""/>
</profile>
<profile name="tv">
<profileitem ca="" distributor="0" key="author.p12" password="x" rootca=""/>
</profile>
</profiles>`;
    expect(parseProfilesXml(xml)).toEqual([
      { name: "old", active: false },
      { name: "tv", active: true },
    ]);
  });
});

describe("ares-inspect output", () => {
  // Format from @webos-tools/cli lib/inspect.js: "Application Debugging - " + url.
  const line =
    "Application Debugging - http://localhost:41237/devtools/inspector.html?ws=localhost:41237/devtools/page/1";

  it("finds the inspector URL", () => {
    expect(findInspectorUrl(`some noise\n${line}\n`)).toBe(
      "http://localhost:41237/devtools/inspector.html?ws=localhost:41237/devtools/page/1"
    );
  });

  it("finds a bare forwarded URL", () => {
    expect(
      findInspectorUrl("Application Debugging - http://localhost:9998")
    ).toBe("http://localhost:9998");
  });

  it("returns nothing before the URL is printed", () => {
    expect(findInspectorUrl("Launching com.example.app")).toBeUndefined();
  });

  it("hides the URL line and known noise from the log", () => {
    expect(isInspectLogLine(line)).toBe(false);
    expect(isInspectLogLine("")).toBe(false);
    expect(isInspectLogLine("ares-inspect WARN something")).toBe(false);
    expect(
      isInspectLogLine("This command is deprecated, use ares-device instead")
    ).toBe(false);
    expect(
      isInspectLogLine(
        "session#forward() failed forwarding client localPort: 0"
      )
    ).toBe(false);
    expect(isInspectLogLine("Launching com.example.app")).toBe(true);
  });
});

describe("parseBadging", () => {
  it("reads the package and launch activity", () => {
    const stdout = [
      "package: name='com.example.tv' versionCode='12' versionName='1.2.0'",
      "sdkVersion:'21'",
      "launchable-activity: name='com.example.tv.MainActivity'  label='Example' icon=''",
      "leanback-launchable-activity: name='com.example.tv.MainActivity'",
    ].join("\n");
    expect(parseBadging(stdout)).toEqual({
      packageName: "com.example.tv",
      activity: "com.example.tv.MainActivity",
    });
  });

  it("uses the leanback activity for TV-only apps", () => {
    const stdout = [
      "package: name='com.example.tv' versionCode='12'",
      "leanback-launchable-activity: name='com.example.tv.TvActivity'",
    ].join("\n");
    expect(parseBadging(stdout).activity).toBe("com.example.tv.TvActivity");
  });

  it("leaves the activity empty when there is none", () => {
    expect(
      parseBadging("package: name='com.example.service' versionCode='1'")
    ).toEqual({ packageName: "com.example.service", activity: undefined });
  });
});

describe("Android WebView debugging", () => {
  // Shape of `cat /proc/net/unix`: the socket path is the last column.
  const procNetUnix = [
    "Num       RefCount Protocol Flags    Type St Inode Path",
    "0000000000000000: 00000002 00000000 00010000 0001 01 21562 @jdwp-control",
    "0000000000000000: 00000002 00000000 00010000 0001 01 88123 @webview_devtools_remote_4321",
    "0000000000000000: 00000002 00000000 00010000 0001 01 88124 @chrome_devtools_remote",
    "0000000000000000: 00000003 00000000 00000000 0001 03 12345 /dev/socket/logdw",
  ].join("\n");

  it("finds the socket of the app's WebView", () => {
    expect(findWebViewSocket(procNetUnix, "4321", "com.example.tv")).toBe(
      "webview_devtools_remote_4321"
    );
  });

  it("ignores other processes' WebViews", () => {
    expect(
      findWebViewSocket(procNetUnix, "999", "com.example.tv")
    ).toBeUndefined();
  });

  it("accepts sockets named after the package", () => {
    expect(
      findWebViewSocket(
        "0: 00000002 0 00010000 0001 01 1 @com.example.tv_devtools_remote",
        "1",
        "com.example.tv"
      )
    ).toBe("com.example.tv_devtools_remote");
  });

  it("reads the first PID from pidof", () => {
    expect(parsePid("4321\n")).toBe("4321");
    expect(parsePid("4321 4400\n")).toBe("4321");
    expect(parsePid("")).toBeUndefined();
  });
});
