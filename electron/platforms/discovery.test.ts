import { describe, expect, it } from "vitest";
import { classify, parseDescription, parseSsdpHeaders } from "./discovery";

describe("parseSsdpHeaders", () => {
  it("reads headers with lower-case keys", () => {
    const headers = parseSsdpHeaders(
      [
        "HTTP/1.1 200 OK",
        "CACHE-CONTROL: max-age=1800",
        "LOCATION: http://192.0.2.10:7678/nservice/",
        "SERVER: Samsung-Linux/4.1, UPnP/1.0, Samsung_UPnP_SDK/1.0",
        "ST: urn:dial-multiscreen-org:service:dial:1",
        "",
        "",
      ].join("\r\n")
    );
    expect(headers.location).toBe("http://192.0.2.10:7678/nservice/");
    expect(headers.st).toBe("urn:dial-multiscreen-org:service:dial:1");
    expect(headers.server).toMatch(/^Samsung-Linux/);
  });
});

describe("parseDescription", () => {
  it("reads the UPnP device name, maker and model", () => {
    const xml = `<?xml version="1.0"?><root><device>
      <friendlyName>Samsung CU7175 50 TV</friendlyName>
      <manufacturer>Samsung</manufacturer>
      <modelName>TU50CU7175UXXC</modelName>
    </device></root>`;
    expect(parseDescription(xml)).toEqual({
      friendlyName: "Samsung CU7175 50 TV",
      manufacturer: "Samsung",
      modelName: "TU50CU7175UXXC",
    });
  });

  it("leaves missing fields undefined", () => {
    expect(parseDescription("<root></root>")).toEqual({});
  });
});

describe("classify", () => {
  const ip = "192.0.2.10";

  it("recognises Samsung, LG and Android TVs", () => {
    expect(
      classify([{ ip, server: "Samsung-Linux/4.1, UPnP/1.0" }], {
        manufacturer: "Samsung",
      })
    ).toBe("tizen");
    expect(
      classify([{ ip, st: "urn:lge-com:service:webos-second-screen:1" }], {
        manufacturer: "LG Electronics",
      })
    ).toBe("webos");
    expect(
      classify([{ ip, server: "Linux/4.19 UPnP/1.0 Android/11" }], {
        manufacturer: "Sony",
      })
    ).toBe("android");
  });

  it("ignores other devices", () => {
    expect(
      classify([{ ip, server: "Linux UPnP/1.0 MiniUPnPd/2.2" }], {
        manufacturer: "Router Co",
      })
    ).toBeUndefined();
  });
});
