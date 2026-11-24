import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const userData = fs.mkdtempSync(path.join(os.tmpdir(), "ctv-bridge-test-"));

vi.mock("electron", () => ({
  app: { getPath: () => userData, on: () => undefined },
}));

// A fake sdb/adb: `attached` is what `devices` lists, `connectOutput` what `connect` prints.
const fake = vi.hoisted(() => ({
  attached: new Set<string>(),
  connectOutput: "",
  connectSucceeds: true,
  calls: [] as string[][],
}));

vi.mock("../utils/cli", () => ({
  runCli: vi.fn(async (_cli: string, args: string[]) => {
    fake.calls.push(args);
    const [command, serial] = args;
    if (command === "devices") {
      const lines = [...fake.attached].map((s) => `${s}\tdevice`);
      return {
        stdout: `List of devices attached\n${lines.join("\n")}\n`,
        stderr: "",
      };
    }
    if (command === "connect" && fake.connectSucceeds)
      fake.attached.add(serial);
    if (command === "disconnect") fake.attached.delete(serial);
    return {
      stdout: command === "connect" ? fake.connectOutput : "",
      stderr: "",
    };
  }),
  cliOutput: (error: Error) => error.message,
}));

vi.mock("./common", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./common")>()),
  assertReachable: vi.fn(async () => undefined),
}));

const { createBridge } = await import("./bridge");
const { knownDevices, localIpFor } = await import("./common");

const tv = { name: "Living room", ip: "192.168.1.10" };

function bridge(overrides: Partial<Parameters<typeof createBridge>[0]> = {}) {
  return createBridge({
    platform: "tizen",
    cli: () => "sdb",
    port: 26101,
    portFix: "Turn on Developer Mode",
    ...overrides,
  });
}

beforeEach(() => {
  fake.attached.clear();
  fake.connectOutput = "";
  fake.connectSucceeds = true;
  fake.calls = [];
  knownDevices.forget("tizen", tv.ip);
  knownDevices.forget("tizen", "192.168.1.11");
});

describe("createBridge", () => {
  it("connects as ip:port and remembers the TV with its DUID", async () => {
    const readDuid = vi.fn(async () => "DUID123456");
    const { devices } = bridge({ readDuid });

    await expect(devices.testConnection(tv)).resolves.toEqual({
      message: "Connected to Living room",
      duid: "DUID123456",
    });
    expect(fake.calls).toContainEqual(["connect", "192.168.1.10:26101"]);
    expect(readDuid).toHaveBeenCalledWith("192.168.1.10:26101");
    expect(await devices.listDevices()).toEqual([
      { ...tv, duid: "DUID123456" },
    ]);
  });

  it("doesn't reconnect a TV that is already attached", async () => {
    fake.attached.add("192.168.1.10:26101");
    await bridge().connect(tv.ip);
    expect(fake.calls).toEqual([["devices"]]);
  });

  it("lists emulators by name and remembered TVs that aren't attached", async () => {
    fake.attached.add("emulator-26101");
    knownDevices.remember("tizen", tv.ip, { name: tv.name });
    expect(await bridge().devices.listDevices()).toEqual([
      { ip: "emulator-26101", name: "emulator-26101", duid: undefined },
      { ...tv, duid: undefined },
    ]);
  });

  it("explains a failed connection, preferring the platform's own message", async () => {
    fake.connectSucceeds = false;
    const connectError = (output: string) =>
      /refused/.test(output) ? "Enable Developer Mode" : undefined;

    fake.connectOutput = "failed to connect: refused";
    await expect(bridge({ connectError }).connect(tv.ip)).rejects.toThrow(
      "Enable Developer Mode"
    );
    fake.connectOutput = "failed to connect: timed out";
    await expect(bridge({ connectError }).connect(tv.ip)).rejects.toThrow(
      "TV unreachable"
    );
    fake.connectOutput = "something odd";
    await expect(bridge({ connectError }).connect(tv.ip)).rejects.toThrow(
      "something odd"
    );
  });

  it("moves a TV to its new IP and forgets the old one", async () => {
    const { devices } = bridge();
    await devices.addDevice(tv);
    await devices.updateDevice(tv, { ...tv, ip: "192.168.1.11" });

    expect(fake.calls).toContainEqual(["disconnect", "192.168.1.10:26101"]);
    expect(await devices.listDevices()).toEqual([
      { ...tv, ip: "192.168.1.11", duid: undefined },
    ]);

    await devices.removeDevice({ ...tv, ip: "192.168.1.11" });
    expect(await devices.listDevices()).toEqual([]);
  });
});

describe("localIpFor", () => {
  it("picks this computer's address on the TV's network", () => {
    expect(
      localIpFor("192.168.1.131", ["10.0.0.5", "192.168.1.149", "172.16.0.2"])
    ).toBe("192.168.1.149");
  });

  it("falls back to any address, or none", () => {
    expect(localIpFor("192.168.1.131", ["10.0.0.5"])).toBe("10.0.0.5");
    expect(localIpFor("192.168.1.131", [])).toBeUndefined();
  });
});

it("passes the TV's IP to the platform's connect error", async () => {
  fake.connectSucceeds = false;
  fake.connectOutput = "failed to connect to 192.168.1.10:26101";
  const connectError = vi.fn(() => "Set the Host PC IP");
  await expect(bridge({ connectError }).connect(tv.ip)).rejects.toThrow(
    "Set the Host PC IP"
  );
  expect(connectError).toHaveBeenCalledWith(
    expect.stringContaining("failed to connect"),
    tv.ip
  );
});
