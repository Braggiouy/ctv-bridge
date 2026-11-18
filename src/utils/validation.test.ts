import { describe, expect, it } from "vitest";
import { isValidIp, validateDevice } from "./validation";

describe("isValidIp", () => {
  it("accepts IPv4 addresses", () => {
    expect(isValidIp("192.168.1.20")).toBe(true);
    expect(isValidIp("10.0.0.255")).toBe(true);
  });

  it("rejects malformed or out-of-range addresses", () => {
    expect(isValidIp("192.168.1")).toBe(false);
    expect(isValidIp("192.168.1.256")).toBe(false);
    expect(isValidIp("192.168.1.20:26101")).toBe(false);
    expect(isValidIp("tv.local")).toBe(false);
  });
});

describe("validateDevice", () => {
  it("only requires an IP on Tizen and Android", () => {
    expect(validateDevice("tizen", { name: "", ip: "192.168.1.20" })).toEqual(
      {}
    );
    expect(validateDevice("android", { name: "", ip: "nope" })).toEqual({
      ip: "Enter a valid IPv4 address",
    });
  });

  it("requires a CLI-safe name and a valid port on webOS", () => {
    const errors = validateDevice("webos", {
      name: "Living room",
      ip: "192.168.1.40",
      port: "70000",
    });
    expect(errors.name).toMatch(/letters, numbers/);
    expect(errors.port).toMatch(/between 1 and 65535/);
    expect(
      validateDevice("webos", {
        name: "living-room_2",
        ip: "192.168.1.40",
        port: "9922",
      })
    ).toEqual({});
  });
});
